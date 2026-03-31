import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function formatFFL(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 1) return digits;
  if (digits.length <= 3) return `${digits[0]}-${digits.slice(1)}`;
  if (digits.length <= 6) return `${digits[0]}-${digits.slice(1, 3)}-${digits.slice(3)}`;
  return `${digits[0]}-${digits.slice(1, 3)}-${digits.slice(3, 9)}`;
}

export default function DealersPage() {
  const { toast } = useToast();
  const [ffl, setFfl] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "not-found">("idle");
  const [dealerName, setDealerName] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (ffl.replace(/\D/g, "").length !== 9) {
      toast({ title: "Invalid FFL", description: "FFL must be 9 digits (e.g. X-XX-XXXXX)", variant: "destructive" });
      return;
    }
    setStatus("checking");
    try {
      const resp = await fetch("/api/ffl/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fflNumber: ffl }),
      });
      const data = await resp.json();
      if (data.valid) {
        setDealerName(data.dealerName || "");
        setStatus("success");
        // Redirect to portal after brief display
        setTimeout(() => {
          window.location.href = `/apply?ffl=${encodeURIComponent(ffl)}&name=${encodeURIComponent(data.dealerName || "")}`;
        }, 1500);
      } else {
        setStatus("not-found");
        setTimeout(() => {
          window.location.href = `/apply?ffl=${encodeURIComponent(ffl)}&pending=1`;
        }, 2000);
      }
    } catch {
      setStatus("idle");
      toast({ title: "Verification Failed", description: "Could not verify FFL. Please try again.", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="pt-24 pb-16 bg-grid-pattern relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">DEALER PORTAL</h1>
            <p className="text-lg text-muted-foreground">
              Enter your FFL number to access the dealer portal. If you are not yet a registered dealer, you will be able to upload your FFL for review.
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onSubmit={handleVerify}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label htmlFor="ffl-input" className="text-sm font-medium text-left block">
                FFL Number
              </label>
              <Input
                id="ffl-input"
                placeholder="X-XX-XXXXX"
                value={ffl}
                onChange={(e) => setFfl(formatFFL(e.target.value))}
                className="text-center text-2xl tracking-widest font-mono bg-card border-border focus:border-primary h-14"
                maxLength={11}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Format: 1-23456 or X-XX-XXXXX</p>
            </div>

            <Button
              type="submit"
              disabled={status === "checking" || ffl.replace(/\D/g, "").length < 9}
              className="w-full font-display text-lg h-14 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg"
            >
              {status === "checking" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                "VERIFY FFL"
              )}
            </Button>
          </motion.form>

          {/* Status Display */}
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30"
            >
              <div className="flex items-center justify-center gap-2 text-green-400 font-medium">
                <CheckCircle className="w-5 h-5" />
                FFL Verified — Loading Dealer Portal...
              </div>
              {dealerName && <p className="text-sm text-muted-foreground mt-1">{dealerName}</p>}
            </motion.div>
          )}

          {status === "not-found" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
            >
              <div className="flex items-center justify-center gap-2 text-yellow-400 font-medium">
                <XCircle className="w-5 h-5" />
                FFL Not Found — Redirecting to FFL Upload...
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-sm text-muted-foreground"
          >
            <p>Not yet a dealer? After verification fails, you will be able to submit your FFL for review.</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
