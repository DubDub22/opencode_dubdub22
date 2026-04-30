import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Loader2, LogOut, Package, FileText, Upload, ShoppingCart,
  CheckCircle, XCircle, Clock, ChevronRight, ShieldCheck, Building2, Phone, Mail, MapPin
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface DealerProfile {
  id: string;
  email: string;
  businessName: string;
  contactName: string;
  phone: string;
  fflLicenseNumber: string;
  fflExpiryDate: string;
  fflOnFile: boolean;
  sotOnFile: boolean;
  taxFormOnFile: boolean;
  ein: string;
  einType: string;
  businessAddress: string;
  city: string;
  state: string;
  zip: string;
  tier: string;
  verified: boolean;
  sotExpiryDate: string;
  hasDemoUnitShipped: boolean;
  lastLoginAt: string;
  createdAt: string;
}

interface OrderItem {
  id: string;
  type: string;
  quantity: string;
  description: string;
  created_at: string;
  tracking_number: string;
  shipped_at: string;
  paid_at: string;
  ffl_license_number: string;
  serial_number: string;
  order_type: string;
}

export default function DealerDashboardPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<DealerProfile | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dealer/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setProfile(data.dealer);
          return fetch("/api/dealer/orders");
        } else {
          window.location.href = "/dealer/login";
          return null;
        }
      })
      .then(r => r?.json())
      .then(data => {
        if (data?.ok) setOrders(data.orders || []);
      })
      .catch(() => {
        window.location.href = "/dealer/login";
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/dealer/auth/logout", { method: "POST" });
    window.location.href = "/dealer/login";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-5xl">
          {/* ── Header ────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-3xl font-display font-bold">{profile.businessName}</h1>
              <p className="text-muted-foreground mt-1">Dealer Dashboard</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.href = "/dealer/order"}
                className="font-display border-primary text-primary hover:bg-primary/10"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Place Order
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </motion.div>

          {/* ── Status Cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatusCard
              label="FFL"
              onFile={profile.fflOnFile}
              detail={profile.fflLicenseNumber || "Not provided"}
              expiry={profile.fflExpiryDate}
            />
            <StatusCard
              label="SOT"
              onFile={profile.sotOnFile}
              detail={profile.einType === "2" ? "Manufacturer" : "Dealer"}
              expiry={profile.sotExpiryDate}
            />
            <StatusCard
              label="Tax Form"
              onFile={profile.taxFormOnFile}
              detail={profile.ein || "Not provided"}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ── Profile Info ────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{profile.email}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{profile.phone || "Not provided"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>
                    {[profile.businessAddress, profile.city, profile.state, profile.zip]
                      .filter(Boolean).join(", ") || "No address"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{profile.tier} Dealer{profile.verified ? " (Verified)" : ""}</span>
                </div>
              </CardContent>
            </Card>

            {/* ── Quick Actions ──────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Document Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ActionLink href={`/apply?ffl=${profile.fflLicenseNumber || ""}`} label="Upload FFL/SOT Documents" />
                <ActionLink href="/dealer/tax-form" label="Complete Multi-State Tax Form" />
                <ActionLink href="/upload-tax-form" label="Upload State Tax ID Document" />
                <ActionLink href="/dealer/order" label="Place New Order" />
              </CardContent>
            </Card>

            {/* ── Recent Orders ──────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {orders.slice(0, 5).map(order => (
                      <div key={order.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                        <div>
                          <span className="font-medium">{order.order_type || order.type}</span>
                          {order.tracking_number && (
                            <span className="text-xs text-muted-foreground ml-2">
                              Tracking: {order.tracking_number}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCard({ label, onFile, detail, expiry }: {
  label: string;
  onFile: boolean;
  detail: string;
  expiry?: string;
}) {
  return (
    <Card className={onFile ? "border-green-500/30" : "border-red-500/30"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{label}</span>
          {onFile ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{detail}</p>
        {expiry && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Expires: {expiry}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between p-2 rounded hover:bg-primary/5 text-sm transition-colors border border-transparent hover:border-primary/20"
    >
      <span>{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </a>
  );
}
