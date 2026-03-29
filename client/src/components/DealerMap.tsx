import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MapPin, X, Loader2, Phone, Mail, User, MessageSquare } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

// Custom colored marker icons for dealer tiers
const goldIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="
    width: 25px;
    height: 41px;
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2px solid #8B6914;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    margin-left: -3px;
    margin-top: -38px;
  "></div>
  <div style="
    width: 10px;
    height: 10px;
    background: #FFD700;
    border: 2px solid #8B6914;
    border-radius: 50%;
    margin-left: 4px;
    margin-top: -34px;
    position: absolute;
  "></div>`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
});

const blackIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="
    width: 25px;
    height: 41px;
    background: linear-gradient(135deg, #333 0%, #111 100%);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2px solid #000;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    margin-left: -3px;
    margin-top: -38px;
  "></div>
  <div style="
    width: 10px;
    height: 10px;
    background: #333;
    border: 2px solid #000;
    border-radius: 50%;
    margin-left: 4px;
    margin-top: -34px;
    position: absolute;
  "></div>`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
});

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Dealer {
  id: string;
  business_name: string;
  city: string;
  state: string;
  zip: string;
  tier: string;
  verified: boolean;
  email?: string;
  phone?: string;
}

// Geocode a zip code to lat/lng using Zippopotam
async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const lat = parseFloat(data.places[0].latitude);
    const lng = parseFloat(data.places[0].longitude);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// Haversine distance in miles
function haversineMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const RADIUS_MILES = 50;
const DEFAULT_CENTER: [number, number] = [39.5, -98.35];

// Zoom map to show 50-mile circle around search coords
function ZoomToRadius({ center, radius }: { center: [number, number]; radius: number }) {
  const map = useMap();
  useEffect(() => {
    // zoom level 8 gives roughly a 50-mile radius circle to fit nicely
    map.setView(center, 8, { animate: true, duration: 0.5 });
  }, [center, map]);
  return null;
}

export default function DealerMap() {
  const { toast } = useToast();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  // Zip search state
  const [searchZip, setSearchZip] = useState("");
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchingZip, setSearchingZip] = useState(false);
  const [searchedZip, setSearchedZip] = useState("");
  const [contactDealer, setContactDealer] = useState<Dealer | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load all dealers once
  useEffect(() => {
    async function loadDealers() {
      try {
        const resp = await fetch("/api/dealers/map");
        const data = await resp.json();
        if (!data.ok) throw new Error("Failed to load dealers");
        // Attach coordinates to each dealer
        const withCoords = await Promise.all(
          (data.data || []).map(async (d: Dealer) => {
            if ((d as any)._latlng) return d;
            const coords = await geocodeZip(d.zip);
            return { ...d, _latlng: coords };
          })
        );
        setDealers(withCoords);
      } catch {
        toast({ title: "Could not load dealer map", variant: "destructive" });
        setDealers([]);
      } finally {
        setLoading(false);
      }
    }
    loadDealers();
  }, [toast]);

  // Dealers with coordinates
  const mappableDealers = useMemo(
    () => dealers.filter(d => (d as any)._latlng),
    [dealers]
  );

  // Dealers within 50-mile radius of searched zip (sorted by distance)
  const nearbyDealers = useMemo(() => {
    if (!searchCoords) return [];
    return mappableDealers
      .map(d => {
        const ll = (d as any)._latlng as [number, number];
        const dist = haversineMiles(searchCoords.lat, searchCoords.lng, ll[0], ll[1]);
        return { ...d, _dist: dist };
      })
      .filter(d => d._dist <= RADIUS_MILES)
      .sort((a, b) => a._dist - b._dist);
  }, [mappableDealers, searchCoords]);

  // Show all dealers if no search; otherwise show only nearby
  const visibleDealers = searchCoords ? nearbyDealers : mappableDealers;

  async function handleZipSearch(e: React.FormEvent) {
    e.preventDefault();
    const zip = searchZip.trim().replace(/[^0-9]/g, "");
    if (zip.length !== 5) {
      toast({ title: "Enter a valid 5-digit zip code", variant: "destructive" });
      return;
    }
    setSearchingZip(true);
    const coords = await geocodeZip(zip);
    if (!coords) {
      toast({ title: "Could not find that zip code", variant: "destructive" });
      setSearchCoords(null);
    } else {
      setSearchCoords(coords);
      setSearchedZip(zip);
      toast({ title: `Showing dealers within ${RADIUS_MILES} mi of ${zip}`, duration: 3000 });
    }
    setSearchingZip(false);
  }

  function clearZipSearch() {
    setSearchZip("");
    setSearchCoords(null);
    setSearchedZip("");
  }

  function formatPhone(phone?: string) {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  return (
    <>
      {/* Search bar */}
      <div className="flex justify-center mb-4 gap-2">
        <form onSubmit={handleZipSearch} className="flex gap-2">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="Your zip code"
            value={searchZip}
            onChange={e => setSearchZip(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            className="w-36 text-center bg-card border-border"
          />
          <Button
            type="submit"
            variant="default"
            disabled={searchingZip}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-display cursor-pointer"
          >
            {searchingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find Dealers"}
          </Button>
          {searchCoords && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearZipSearch}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </form>
      </div>

      {/* Results summary */}
      {!loading && (
        <p className="text-center text-sm text-muted-foreground mb-3">
          {searchCoords
            ? `${nearbyDealers.length} dealer${nearbyDealers.length !== 1 ? "s" : ""} within ${RADIUS_MILES} miles of ${searchedZip}`
            : `${mappableDealers.length} dealer${mappableDealers.length !== 1 ? "s" : ""} on map`}
        </p>
      )}

      {/* Map */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border shadow-xl" style={{ height: "500px" }}>
          <MapContainer
            center={searchCoords ? [searchCoords.lat, searchCoords.lng] as [number, number] : DEFAULT_CENTER}
            zoom={searchCoords ? 8 : 4}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* 50-mile radius circle when zip searched */}
            {searchCoords && (
              <Circle
                center={[searchCoords.lat, searchCoords.lng]}
                radius={RADIUS_MILES * 1609.34}
                pathOptions={{ color: "#FF6600", fillColor: "#FF6600", fillOpacity: 0.08, weight: 2 }}
              />
            )}

            {searchCoords && (
              <ZoomToRadius
                center={[searchCoords.lat, searchCoords.lng]}
                radius={RADIUS_MILES}
              />
            )}

            {visibleDealers.map(dealer => (
              <Marker
                key={dealer.id}
                // @ts-expect-error custom property
                position={dealer._latlng}
                icon={dealer.tier === "Preferred" ? goldIcon : blackIcon}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <p className="font-bold text-sm">{dealer.business_name}</p>
                    <p className="text-xs text-gray-600">{dealer.city}, {dealer.state} {dealer.zip}</p>
                    {dealer.tier === "Preferred" && (
                      <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Preferred
                      </span>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Fit bounds when no zip search */}
            {!searchCoords && visibleDealers.length > 0 && (
              <FitBoundsOnLoad dealers={visibleDealers} />
            )}
          </MapContainer>
        </div>
      )}

      {/* Dealer list below map */}
      {!loading && visibleDealers.length > 0 && (
        <div className="mt-6 space-y-3">
          {visibleDealers.map(dealer => {
            const phone = formatPhone(dealer.phone);
            const hasEmail = dealer.email && dealer.email.includes("@");
            return (
              <Card
                key={dealer.id}
                className="bg-card border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground">{dealer.business_name}</p>
                    {dealer.tier === "Preferred" && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                        Preferred
                      </span>
                    )}
                    {dealer._dist !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {dealer._dist.toFixed(1)} mi
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {dealer.city}, {dealer.state} {dealer.zip}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {phone && (
                      <a
                        href={`tel:${dealer.phone}`}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {phone}
                      </a>
                    )}
                    {hasEmail && (
                      <a
                        href={`mailto:${dealer.email}`}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {dealer.email}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {hasEmail && (
                    <Dialog.Root open={contactDealer?.id === dealer.id} onOpenChange={(open) => setContactDealer(open ? dealer : null)}>
                      <Dialog.Trigger asChild>
                        <button
                          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold px-4 py-2 rounded transition-colors cursor-pointer border-0"
                          onClick={(e) => { e.stopPropagation(); setContactDealer(dealer); }}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Contact Dealer
                        </button>
                      </Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
                        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border w-full max-w-md p-6 rounded-xl shadow-2xl">
                          <Dialog.Title className="text-xl font-bold font-display mb-1">Contact {dealer.business_name}</Dialog.Title>
                          <Dialog.Description className="text-sm text-muted-foreground mb-4">
                            Send a message to this dealer and we'll share your interest in the DubDub22.
                          </Dialog.Description>
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!contactDealer) return;
                            setSubmitting(true);
                            try {
                              const res = await fetch("/api/retail-inquiry", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  dealerId: contactDealer.id,
                                  contactName,
                                  email: contactEmail,
                                  phone: contactPhone,
                                  message: contactMessage,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok || !data.ok) throw new Error(data.error || "Submission failed");
                              toast({ title: "Message sent!", description: `${contactDealer.business_name} will be in touch soon.` });
                              setContactDealer(null);
                              setContactName(""); setContactEmail(""); setContactPhone(""); setContactMessage("");
                            } catch (err: any) {
                              toast({ title: "Error", description: err.message, variant: "destructive" });
                            } finally {
                              setSubmitting(false);
                            }
                          }}>
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium mb-1 block">Your Name *</label>
                                <Input required value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="John Smith" />
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-1 block">Your Email *</label>
                                <Input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="john@example.com" />
                              </div>
                              <div>
                                <label className="text-sm fontlighter mb-1 block">Your Phone</label>
                                <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 555-5555" />
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-1 block">Message</label>
                                <textarea
                                  className="w-full px-3 py-2 bg-background border border-border text-sm rounded-md resize-none"
                                  rows={3}
                                  value={contactMessage}
                                  onChange={(e) => setContactMessage(e.target.value)}
                                  placeholder="I'm interested in the DubDub22 suppressor..."
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4 justify-end">
                              <Dialog.Close asChild>
                                <Button type="button" variant="outline" onClick={() => { setContactDealer(null); setContactName(""); setContactEmail(""); setContactPhone(""); setContactMessage(""); }}>Cancel</Button>
                              </Dialog.Close>
                              <Button type="submit" disabled={submitting}>
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Message"}
                              </Button>
                            </div>
                          </form>
                          <Dialog.Close asChild>
                            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => { setContactDealer(null); setContactName(""); setContactEmail(""); setContactPhone(""); setContactMessage(""); }}>
                              <X className="w-4 h-4" />
                            </button>
                          </Dialog.Close>
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && visibleDealers.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          {searchCoords
            ? `No dealers within ${RADIUS_MILES} miles of ${searchedZip}. Try a different zip code.`
            : "No dealers found."}
        </p>
      )}
    </>
  );
}

function FitBoundsOnLoad({ dealers }: { dealers: Dealer[] }) {
  const map = useMap();
  useEffect(() => {
    if (dealers.length === 0) return;
    const coords = dealers
      .map(d => (d as any)._latlng as [number, number] | undefined)
      .filter(Boolean) as [number, number][];
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 10);
    } else {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [dealers, map]);
  return null;
}
