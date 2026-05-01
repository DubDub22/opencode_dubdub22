import React, { useState, useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, Package, ShieldCheck, Building2, Mail, Phone, MapPin, ArrowLeft } from "lucide-react";

export default function DealerOrderPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState("stocking");
  const [quantity, setQuantity] = useState(5);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    fetch("/api/dealer/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.ok) setProfile(data.dealer);
        else window.location.href = "/dealer/login";
      })
      .catch(() => window.location.href = "/dealer/login")
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (!termsAccepted) { toast({ title: "Terms required", description: "Please accept the terms and conditions.", variant: "destructive" }); return; }
    if (orderType === "demo" && profile?.hasDemoUnitShipped) { toast({ title: "Demo already shipped", description: "You have already received a demo unit.", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("dubdub_token");
      const resp = await fetch("/api/dealer/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token || "" },
        body: JSON.stringify({ orderType, quantity: orderType === "demo" ? 1 : quantity, termsAccepted: true }),
      });
      const data = await resp.json();
      if (data.ok) {
        setSubmitted(true);
        toast({ title: "Order Submitted!", description: `Your ${orderType === "demo" ? "demo request" : "stocking order"} has been received.` });
      } else {
        toast({ title: "Error", description: data.error || "Order failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return null;

  const fflExpired = profile.fflExpiryDate && new Date(profile.fflExpiryDate + "T23:59:59") < new Date();
  const sotExpired = profile.sotExpiryDate && new Date(profile.sotExpiryDate + "T23:59:59") < new Date();
  const canOrder = !fflExpired && !sotExpired && profile.fflOnFile && profile.sotOnFile;

  const unitPrice = 60;
  const qty = orderType === "demo" ? 1 : quantity;
  const subtotal = qty * unitPrice;
  const shipping = 10;
  const total = subtotal + shipping;

  if (submitted) return (
    <div className="min-h-screen bg-background"><SiteHeader/>
    <section className="pt-24 pb-16 max-w-xl mx-auto px-6 text-center">
      <div className="bg-card border border-border rounded-lg p-8">
        <ShieldCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-display font-bold mb-2">Order Submitted</h1>
        <p className="text-muted-foreground mb-6">Your order has been received and will be reviewed shortly. You'll receive a confirmation email.</p>
        <Button onClick={() => window.location.href = "/dealer/dashboard"} variant="outline" className="font-display">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    </section></div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground"><SiteHeader/>
    <section className="pt-24 pb-16 max-w-xl mx-auto px-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <a href="/dealer/dashboard" className="hover:text-primary"><ArrowLeft className="w-4 h-4 inline mr-1"/>Dashboard</a>
        <span>/</span>
        <span className="text-foreground">Place Order</span>
      </div>

      <h1 className="text-3xl font-display font-bold">Place Order</h1>

      {!canOrder && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm">
          <p className="font-medium text-red-400 mb-1">Ordering is blocked</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            {fflExpired && <li>Your FFL has expired. Please upload a renewed FFL from your dashboard.</li>}
            {sotExpired && <li>Your SOT has expired. Please upload a renewed SOT from your dashboard.</li>}
            {!profile.fflOnFile && <li>No FFL document on file.</li>}
            {!profile.sotOnFile && <li>No SOT document on file.</li>}
          </ul>
        </div>
      )}

      {/* Dealer Info Summary */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground"/><span className="font-medium">{profile.businessName}</span></div>
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground"/><span>{profile.email}</span></div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground"/><span>{profile.phone || "N/A"}</span></div>
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground"/><span>{[profile.city, profile.state].filter(Boolean).join(", ")}</span></div>
        </CardContent>
      </Card>

      {/* Order Type */}
      <Card>
        <CardHeader><CardTitle className="text-lg"><ShoppingCart className="w-5 h-5 inline mr-2 text-primary"/>Order Type</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!profile.hasDemoUnitShipped && (
            <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${orderType === "demo" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <input type="radio" name="type" checked={orderType === "demo"} onChange={() => setOrderType("demo")} className="mt-1 accent-primary" />
              <div>
                <span className="font-medium">Demo Unit</span>
                <span className="text-muted-foreground ml-2 text-sm">$60 + $10 shipping</span>
                <p className="text-xs text-muted-foreground mt-1">1 suppressor for evaluation. Limit 1 per dealer.</p>
              </div>
            </label>
          )}

          <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${orderType === "stocking" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
            <input type="radio" name="type" checked={orderType === "stocking"} onChange={() => { setOrderType("stocking"); setQuantity(5); }} className="mt-1 accent-primary" />
            <div>
              <span className="font-medium">Stocking Order</span>
              <span className="text-muted-foreground ml-2 text-sm">${unitPrice}/unit</span>
              <p className="text-xs text-muted-foreground mt-1">Minimum 1 unit.</p>
            </div>
          </label>

          {orderType === "stocking" && (
            <div className="flex items-center gap-3 pl-7">
              <span className="text-sm">Quantity:</span>
              <select value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm">
                {[5,10,15,20].map(n => <option key={n} value={n}>{n} units — ${(n * unitPrice).toFixed(2)}</option>)}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader><CardTitle className="text-lg"><Package className="w-5 h-5 inline mr-2 text-primary"/>Order Summary</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span>{orderType === "demo" ? "1x Demo Unit" : `${quantity}x DubDub22 @ $${unitPrice}/ea`}</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Shipping & Handling</span><span>${shipping.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-2"><span>Total</span><span className="text-primary">${total.toFixed(2)}</span></div>
        </CardContent>
      </Card>

      {/* Terms */}
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 accent-primary" />
        <span>I understand that all NFA rules apply. Suppressors must be transferred on an approved ATF Form 3 (dealer-to-dealer) or Form 4 (individual). The buyer is responsible for all transfer taxes and compliance. Orders subject to availability.</span>
      </label>

      <Button onClick={() => setShowTerms(true)} disabled={submitting || !termsAccepted || !canOrder} className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : !canOrder ? "Order Blocked — Expired Documents" : orderType === "demo" ? "Request Demo Unit" : `Place Order — $${total.toFixed(2)}`}
      </Button>

      {/* Terms & Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4" onClick={() => setShowTerms(false)}>
          <div className="bg-card border border-border rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-display font-bold mb-4">Terms &amp; Conditions</h2>
            <div className="space-y-4 text-sm text-muted-foreground mb-6">
              <div>
                <h3 className="font-semibold text-foreground mb-1">No Returns on Suppressors</h3>
                <p>Suppressors are regulated by the ATF and cannot be returned once sold. All suppressor sales are final.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Restocking Fee</h3>
                <p>Any order cancelled after processing is subject to a 10% restocking fee to cover ATF Form 3 transfer and administrative processing.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">NFA Compliance</h3>
                <p>All NFA rules apply. Suppressors must be transferred on an approved ATF Form 3 (dealer-to-dealer) or Form 4 (individual). Buyer is responsible for all transfer taxes and compliance.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Shipping</h3>
                <p>Orders ship via USPS Priority Mail with tracking. Shipping and handling is $10 flat rate per order.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Demo Units</h3>
                <p>Limit 1 demo unit per FFL. Demo units require the same ATF transfer process as stocking orders.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowTerms(false)} variant="outline" className="flex-1">Cancel</Button>
              <Button onClick={() => { setShowTerms(false); handleSubmit(); }} className="flex-1 bg-primary hover:bg-primary/90">I Accept — Place Order</Button>
            </div>
          </div>
        </div>
      )}
    </section></div>
  );
}
