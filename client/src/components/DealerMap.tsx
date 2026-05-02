import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MapPin, X, Loader2, Phone, Mail } from "lucide-react";
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
  displayPhone?: string;
  lat?: number;
  lng?: number;
  _dist?: number;
  _latlng?: [number, number];
}

const RADIUS_MILES = 50;
const DEFAULT_CENTER: [number, number] = [39.5, -98.35];

// Zoom map to show 50-mile circle around search coords
function ZoomToRadius({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 8, { animate: true, duration: 0.5 });
  }, [center, map]);
  return null;
}

export default function DealerMap() {
  const { toast } = useToast();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(false);

  // Zip search state
  const [searchZip, setSearchZip] = useState("");
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchingZip, setSearchingZip] = useState(false);
  const [searchedZip, setSearchedZip] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [contactDealer, setContactDealer] = useState<Dealer | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nearestPreferred, setNearestPreferred] = useState<(Dealer & { _dist: number }) | null>(null);

  // Separate preferred from standard dealers for display
  const { preferredDealers, standardDealers } = useMemo(() => {
    const pref: (Dealer & { _dist: number })[] = [];
    const std: (Dealer & { _dist: number })[] = [];
    for (const d of dealers) {
      if (d.tier === "Preferred") {
        pref.push(d as Dealer & { _dist: number });
      } else {
        std.push(d as Dealer & { _dist: number });
      }
    }
    return { preferredDealers: pref, standardDealers: std };
  }, [dealers]);

  // Build lat/lng from DB coords, jitter duplicate pins so they spread on the map
  const mappableDealers = useMemo(() => {
    const seen: Record<string, number> = {};
    return dealers
      .map(d => {
        if (d.lat != null && d.lng != null) {
          const key = `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`;
          const jitter = seen[key] || 0;
          seen[key] = jitter + 1;
          // Add ~50-150m jitter for duplicates (0.0005-0.0015 degrees)
          const jitterLat = jitter > 0 ? d.lat + (Math.random() * 0.001 + 0.0005) * (jitter % 2 === 0 ? 1 : -1) : d.lat;
          const jitterLng = jitter > 0 ? d.lng + (Math.random() * 0.001 + 0.0005) * (jitter % 2 === 0 ? 1 : -1) : d.lng;
          return { ...d, _latlng: [jitterLat, jitterLng] as [number, number] };
        }
        return null;
      })
      .filter(Boolean) as Dealer[];
  }, [dealers]);

  async function handleZipSearch(e: React.FormEvent) {
    e.preventDefault();
    const zip = searchZip.trim().replace(/[^0-9]/g, "");
    if (zip.length !== 5) {
      toast({ title: "Enter a valid 5-digit zip code", variant: "destructive" });
      return;
    }
    setSearchingZip(true);
    setLoading(true);
    try {
      const resp = await fetch(`/api/dealers/nearby?zip=${zip}`);
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || "Could not find dealers");
      setSearchCoords(data.searchCoords);
      setSearchedZip(zip);
      setHasSearched(true);
      setNearestPreferred(data.nearestPreferred);
      // Attach _latlng from DB coords
      const withCoords = (data.dealers as Dealer[]).map((d: Dealer) => ({
        ...d,
        _latlng: d.lat != null && d.lng != null ? [d.lat, d.lng] as [number, number] : undefined,
      }));
      setDealers(withCoords);
      toast({
        title: `Showing nearest ${data.dealers.length} dealers near ${zip}`,
        duration: 4000,
      });
    } catch (err: any) {
      toast({ title: err.message || "Could not find dealers for that zip code", variant: "destructive" });
      setSearchCoords(null);
      setHasSearched(false);
      setDealers([]);
    } finally {
      setSearchingZip(false);
      setLoading(false);
    }
  }

  function clearZipSearch() {
    setSearchZip("");
    setSearchCoords(null);
    setSearchedZip("");
    setHasSearched(false);
    setDealers([]);
    setNearestPreferred(null);
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
          {hasSearched && (
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
      {hasSearched && !loading && (
        <p className="text-center text-sm text-muted-foreground mb-3">
          Nearest {dealers.length} dealers to {searchedZip}
        </p>
      )}

      {/* Prompt when no search yet */}
      {!hasSearched && !loading && (
        <div className="rounded-xl border border-border shadow-xl flex items-center justify-center" style={{ height: "500px", background: "hsl(var(--card))" }}>
          <div className="text-center">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Enter your zip code above to find dealers near you.</p>
          </div>
        </div>
      )}

      {/* Map */}
      {(loading || hasSearched) && (
        <div className="rounded-xl overflow-hidden border border-border shadow-xl" style={{ height: "500px", zIndex: 1 }}>
          <MapContainer
            center={searchCoords ? [searchCoords.lat, searchCoords.lng] as [number, number] : DEFAULT_CENTER}
            zoom={searchCoords ? 8 : 4}
            style={{ height: "100%", width: "100%", zIndex: 1 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {searchCoords && (
              <Circle
                center={[searchCoords.lat, searchCoords.lng]}
                radius={RADIUS_MILES * 1609.34}
                pathOptions={{ color: "#FF6600", fillColor: "#FF6600", fillOpacity: 0.08, weight: 2 }}
              />
            )}

            {searchCoords && (
              <ZoomToRadius center={[searchCoords.lat, searchCoords.lng]} />
            )}

            {mappableDealers.map(dealer => (
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
          </MapContainer>
        </div>
      )}

      {/* Dealer list below map */}
      {!loading && dealers.length > 0 && (
        <div className="mt-6 space-y-3">
          {/* Featured Preferred Dealers — always in a framed box at top */}
          {preferredDealers.length > 0 && (
            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5 space-y-3">
              <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-3">★ Preferred Dealers</p>
              {preferredDealers.map(preferred => {
                const phone = formatPhone(preferred.displayPhone);
                return (
                  <Card key={preferred.id} className="bg-card border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-lg">{preferred.business_name}</p>
                        {preferred._dist !== undefined && (
                          <span className="text-xs text-muted-foreground">{preferred._dist.toFixed(1)} mi</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {preferred.city}, {preferred.state} {preferred.zip}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {phone && (
                          <a href={`tel:${preferred.displayPhone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <Phone className="w-3.5 h-3.5" /> {phone}
                          </a>
                        )}
                      </div>
                    </div>
                    {preferred.email && (
                      <div className="flex gap-2 shrink-0">
                        <Dialog.Root open={contactDealer?.id === preferred.id} onOpenChange={(open) => setContactDealer(open ? preferred : null)}>
                          <Dialog.Trigger asChild>
                            <button
                              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold px-4 py-2 rounded transition-colors cursor-pointer border-0"
                              onClick={(e) => { e.stopPropagation(); setContactDealer(preferred); }}
                            >
                              <Mail className="w-3.5 h-3.5" /> Contact Dealer
                            </button>
                          </Dialog.Trigger>
                          <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
                            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border w-full max-w-md p-6 rounded-xl shadow-2xl">
                              <Dialog.Title className="text-xl font-bold font-display mb-1">Contact {preferred.business_name}</Dialog.Title>
                              <Dialog.Description className="text-sm text-muted-foreground mb-4">
                                Send a message to this dealer and we'll share your interest in the DubDub22.
                              </Dialog.Description>
                              <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!contactDealer) return;
                                if (!contactEmail && !contactPhone) { toast({ title: "Error", description: "Please provide an email or phone number.", variant: "destructive" }); return; }
                                setSubmitting(true);
                                try {
                                  const res = await fetch("/api/retail-inquiry", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ dealerId: contactDealer.id, contactName, email: contactEmail, phone: contactPhone, message: contactMessage }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok || !data.ok) throw new Error(data.error || "Submission failed");
                                  toast({ title: "Message sent!", description: `${contactDealer.business_name} will be in touch soon.` });
                                  setContactDealer(null); setContactName(""); setContactEmail(""); setContactPhone(""); setContactMessage("");
                                } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
                                finally { setSubmitting(false); }
                              }}>
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">Your Name *</label>
                                    <Input required value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="John Smith" />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">Your Email</label>
                                    <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="john@example.com" />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">Your Phone</label>
                                    <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 555-5555" />
                                  </div>
                                  { !contactEmail && !contactPhone && (
                                    <p className="text-xs text-muted-foreground">Please provide an email or phone number so the dealer can reach you.</p>
                                  )}
                                  <div>
                                    <label className="text-sm font-medium mb-1 block">Message</label>
                                    <textarea className="w-full px-3 py-2 bg-background border border-border text-sm rounded-md resize-none" rows={3} value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="I'm interested in the DubDub22 suppressor..." />
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-4 justify-end">
                                  <Dialog.Close asChild><Button type="button" variant="outline" onClick={() => { setContactDealer(null); setContactName(""); setContactEmail(""); setContactPhone(""); setContactMessage(""); }}>Cancel</Button></Dialog.Close>
                                  <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Message"}</Button>
                                </div>
                              </form>
                              <Dialog.Close asChild>
                                <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => { setContactDealer(null); setContactName(""); setContactEmail(""); setContactPhone(""); setContactMessage(""); }}><X className="w-4 h-4" /></button>
                              </Dialog.Close>
                            </Dialog.Content>
                          </Dialog.Portal>
                        </Dialog.Root>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Standard dealers */}
          {standardDealers.map(dealer => {
            const phone = formatPhone(dealer.displayPhone);
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
                        href={`tel:${dealer.displayPhone}`}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {phone}
                      </a>
                    )}
                  </div>
                </div>
                {dealer.email && (
                  <div className="flex gap-2 shrink-0">
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
                            if (!contactEmail && !contactPhone) { toast({ title: "Error", description: "Please provide an email or phone number.", variant: "destructive" }); return; }
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
                                <label className="text-sm font-medium mb-1 block">Your Email</label>
                                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="john@example.com" />
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-1 block">Your Phone</label>
                                <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 555-5555" />
                              </div>
                              { !contactEmail && !contactPhone && (
                                <p className="text-xs text-muted-foreground">Please provide an email or phone number so the dealer can reach you.</p>
                              )}
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
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!loading && hasSearched && dealers.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No dealers found. Try a different zip code.
        </p>
      )}
    </>
  );
}
