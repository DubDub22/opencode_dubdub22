import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function DealersPage() {
  const { toast } = useToast();
  const [fflSegs, setFflSegs] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "not-found">("idle");
  const [dealerName, setDealerName] = useState("");
  const [fflError, setFflError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const fullFfl = fflSegs.join("-");
    if (fflSegs.some(s => s.length === 0)) {
      setFflError("Please fill in all FFL number segments");
      return;
    }
    setFflError("");
    setStatus("checking");
    try {
      const resp = await fetch("/api/ffl/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fflNumber: fullFfl }),
      });
      const data = await resp.json();
      if (data.valid) {
        setDealerName(data.dealerName || "");
        setStatus("success");
        setTimeout(() => {
          window.location.href = `/apply?ffl=${encodeURIComponent(fullFfl)}`;
        }, 1500);
      } else {
        setStatus("not-found");
        setTimeout(() => {
          window.location.href = `/apply?ffl=${encodeURIComponent(fullFfl)}&pending=1`;
        }, 2000);
      }
    } catch {
      setStatus("idle");
      toast({ title: "Verification Failed", description: "Could not verify FFL. Please try again.", variant: "destructive" });
    }
  }

  function handleFflSegChange(idx: number, val: string) {
    const maxLens = [1, 2, 3, 2, 2, 5];
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLens[idx]);
    const next = [...fflSegs];
    next[idx] = cleaned;
    setFflSegs(next);
    setFflError("");
    if (cleaned.length >= maxLens[idx] && idx < 5) {
      setTimeout(() => {
        (document.getElementById(`dealer-ffl-seg${idx + 1}`) as HTMLInputElement)?.focus();
      }, 0);
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
              <label className="text-sm font-medium text-left block">
                FFL Number
              </label>
              <div className="flex items-center justify-center gap-1 font-mono text-sm">
                <input
                  key="dealer-ffl-seg0"
                  type="text"
                  maxLength={1}
                  value={fflSegs[0]}
                  onChange={e => handleFflSegChange(0, e.target.value)}
                  className="w-8 h-12 border border-border rounded bg-card text-center text-center uppercase text-lg focus:border-primary focus:outline-none"
                  id="dealer-ffl-seg0"
                  placeholder="X"
                  autoFocus
                />
                <span className="text-muted-foreground mx-0.5">-</span>
                <input
                  key="dealer-ffl-seg1"
                  type="text"
                  maxLength={2}
                  value={fflSegs[1]}
                  onChange={e => handleFflSegChange(1, e.target.value)}
                  className="w-10 h-12 border border-border rounded bg-card text-center text-center uppercase text-lg focus:border-primary focus:outline-none"
                  id="dealer-ffl-seg1"
                  placeholder="XX"
                />
                <span className="text-muted-foreground mx-0.5">-</span>
                <input
                  key="dealer-ffl-seg2"
                  type="text"
                  maxLength={3}
                  value={fflSegs[2]}
                  onChange={e => handleFflSegChange(2, e.target.value)}
                  className="w-12 h-12 border border-border rounded bg-card text-center text-center uppercase text-lg focus:border-primary focus:outline-none"
                  id="dealer-ffl-seg2"
                  placeholder="XXX"
                />
                <span className="text-muted-foreground mx-0.5">-</span>
                <input
                  key="dealer-ffl-seg3"
                  type="text"
                  maxLength={2}
                  value={fflSegs[3]}
                  onChange={e => handleFflSegChange(3, e.target.value)}
                  className="w-10 h-12 border border-border rounded bg-card text-center text-center uppercase text-lg focus:border-primary focus:outline-none"
                  id="dealer-ffl-seg3"
                  placeholder="XX"
                />
                <span className="text-muted-foreground mx-0.5">-</span>
                <input
                  key="dealer-ffl-seg4"
                  type="text"
                  maxLength={2}
                  value={fflSegs[4]}
                  onChange={e => handleFflSegChange(4, e.target.value)}
                  className="w-10 h-12 border border-border rounded bg-card text-center text-center uppercase text-lg focus:border-primary focus:outline-none"
                  id="dealer-ffl-seg4"
                  placeholder="XX"
                />
                <span className="text-muted-foreground mx-0.5">-</span>
                <input
                  key="dealer-ffl-seg5"
                  type="text"
                  maxLength={5}
                  value={fflSegs[5]}
                  onChange={e => handleFflSegChange(5, e.target.value)}
                  className="w-14 h-12 border border-border rounded bg-card text-center text-center uppercase text-lg focus:border-primary focus:outline-none"
                  id="dealer-ffl-seg5"
                  placeholder="XXXXX"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">Format: X-XX-XXX-XX-XX-XXXXX</p>
              {fflError && <p className="text-xs text-red-500 text-center">{fflError}</p>}
            </div>

            <Button
              type="submit"
              disabled={status === "checking" || fflSegs.some(s => s.length === 0)}
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
