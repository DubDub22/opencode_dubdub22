import React, { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function DealerLoginPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Please enter email and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/dealer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (data.ok) {
        localStorage.setItem("dubdub_token", data.token);
        window.location.href = "/dealer/dashboard";
      } else {
        toast({ title: "Login failed", description: data.error === "invalid_credentials" ? "Invalid email or password" : (data.message || "Please try again"), variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection error", description: "Could not reach server. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card border border-border rounded-lg p-8"
          >
            <div className="text-center mb-6">
              <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-3" />
              <h1 className="text-2xl font-display font-semibold">Dealer Login</h1>
              <p className="text-sm text-muted-foreground mt-1">Access your DubDub22 dealer account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dealer@example.com"
                  className="bg-background"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-background"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full font-display bg-primary hover:bg-primary/90">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SIGN IN"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Don't have an account? </span>
              <a href="/dealer/register" className="text-primary hover:underline font-medium">Register here</a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
