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
    const token = localStorage.getItem("dubdub_token");
    fetch("/api/dealer/auth/me", { headers: { "x-auth-token": token || "" } })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setProfile(data.dealer);
          return fetch("/api/dealer/orders", { headers: { "x-auth-token": token || "" } });
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
    const token = localStorage.getItem("dubdub_token");
    localStorage.removeItem("dubdub_token");
    await fetch("/api/dealer/auth/logout", { method: "POST", headers: { "x-auth-token": token || "" } });
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <DocStatusCard
              label="FFL License"
              onFile={profile.fflOnFile}
              expiry={profile.fflExpiryDate}
              type="ffl"
              detail={profile.fflLicenseNumber || "Not on file"}
            />
            <DocStatusCard
              label="SOT License"
              onFile={profile.sotOnFile}
              expiry={profile.sotExpiryDate}
              type="sot"
              detail={profile.ein || profile.fflLicenseNumber || "Not on file"}
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
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ActionLink href="/dealer/order" label="Place New Order" />
                <AdditionalUpload dealerName={profile.businessName} />
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

function getExpiryStatus(expiry: string | undefined): "green" | "amber" | "red" {
  if (!expiry) return "red";
  const d = new Date(expiry + "T23:59:59");
  if (isNaN(d.getTime())) return "red";
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return "red";
  if (daysLeft <= 90) return "amber";
  return "green";
}

function DocStatusCard({ label, onFile, expiry, type, detail }: {
  label: string; onFile: boolean; expiry?: string; type: "ffl" | "sot"; detail: string;
}) {
  const status = onFile ? getExpiryStatus(expiry) : "red";
  const colors = { green: "border-green-500/50 bg-green-500/5", amber: "border-yellow-500/50 bg-yellow-500/5", red: "border-red-500/50 bg-red-500/5" };
  const icons = { green: CheckCircle, amber: Clock, red: XCircle };
  const iconColors = { green: "text-green-500", amber: "text-yellow-500", red: "text-red-500" };
  const labels = { green: "Current", amber: "Expires Soon", red: onFile ? "Expired" : "Not on File" };
  const Icon = icons[status];
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [newExpiry, setNewExpiry] = useState("");
  const [sotYear, setSotYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const needsUpload = status === "red" || status === "amber";

  async function doUpload() {
    if (!file) return;
    const exp = type === "ffl" ? newExpiry : `06/30/${sotYear}`;
    if (type === "ffl" && !newExpiry) { toast({ title: "Expiration required", variant: "destructive" }); return; }
    if (type === "sot" && !sotYear) { toast({ title: "SOT year required", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const b64 = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.readAsDataURL(file); });
      const token = localStorage.getItem("dubdub_token");
      const resp = await fetch("/api/dealer/upload-document-renewal", {
        method: "POST", headers: { "Content-Type": "application/json", "x-auth-token": token || "" },
        body: JSON.stringify({ fileData: b64, fileName: file.name, documentType: type, newExpiry: exp }),
      });
      const d = await resp.json();
      if (d.ok) { toast({ title: "Uploaded" }); window.location.reload(); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setUploading(false); }
  }

  return (
    <Card className={colors[status]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-1">
            <Icon className={`w-5 h-5 ${iconColors[status]}`} />
            <span className={`text-xs font-medium ${iconColors[status]}`}>{labels[status]}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{detail}</p>
        {expiry && <p className="text-xs text-muted-foreground mb-1">Expires: {expiry}</p>}
        {!onFile && <p className="text-xs text-muted-foreground mb-2">No document on file</p>}
        
        {needsUpload && !showUpload && (
          <Button size="sm" variant="outline" onClick={() => setShowUpload(true)} className="w-full mt-1 text-xs">
            <Upload className="w-3 h-3 mr-1" /> Upload New {type.toUpperCase()}
          </Button>
        )}

        {showUpload && (
          <div className="mt-2 space-y-2">
            <FileDrop file={file} setFile={setFile} />
            {type === "ffl" && (
              <Input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} placeholder="New expiration date" className="bg-background h-8 text-xs" />
            )}
            {type === "sot" && (
              <select value={sotYear} onChange={e => setSotYear(e.target.value)} className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs">
                <option value="">Select SOT year...</option>
                {[2025,2026,2027,2028,2029,2030].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={doUpload} disabled={uploading || !file} className="text-xs h-7 flex-1">
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Upload"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowUpload(false)} className="text-xs h-7">Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdditionalUpload({ dealerName }: { dealerName: string }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function doUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.readAsDataURL(file); });
      const token = localStorage.getItem("dubdub_token");
      const resp = await fetch("/api/dealer/upload-misc", {
        method: "POST", headers: { "Content-Type": "application/json", "x-auth-token": token || "" },
        body: JSON.stringify({ fileData: b64, fileName: file.name, dealerName }),
      });
      const d = await resp.json();
      if (d.ok) { toast({ title: "File sent to docs@" }); setFile(null); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setUploading(false); }
  }

  return (
    <div className="border-t border-border pt-2 mt-2">
      <p className="text-xs text-muted-foreground mb-2">Additional File Upload — sends to docs@dubdub22.com</p>
      <FileDrop file={file} setFile={setFile} />
      {file && (
        <Button size="sm" onClick={doUpload} disabled={uploading} className="w-full mt-1 text-xs h-7">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send to docs@"}
        </Button>
      )}
    </div>
  );
}

function FileDrop({ file, setFile }: { file: File | null; setFile: (f: File | null) => void }) {
  return (
    <label className={`flex items-center justify-center border-2 border-dashed rounded p-2 cursor-pointer text-xs transition-colors ${file ? "border-green-500/50 bg-green-500/5" : "border-border hover:border-primary/40 bg-card"}`}
      onDragOver={e => { e.preventDefault() }} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}>
      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={e => setFile(e.target.files?.[0] || null)} />
      {file ? <span className="text-green-500">{file.name}</span> : <span className="text-muted-foreground"><Upload className="w-3 h-3 inline mr-1" />Drop file or click</span>}
    </label>
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
