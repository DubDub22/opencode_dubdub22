import React, { useState } from "react";
import { useSearchParams } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, Loader2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// ─── Schema ────────────────────────────────────────────────────────────────────

const dealerApplySchema = z.object({
  dealerName: z.string().min(2, "Dealer / FFL name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  email: z.string().email("Valid email is required"),
  fflNumber: z.string().min(9, "Valid FFL number is required"),
  fflExpiry: z.string().optional(),
  ein: z.string().optional(),
  contactPhone: z.string().optional(),
  message: z.string().optional(),
  address: z.string().optional(),
});

type DealerApplyValues = z.infer<typeof dealerApplySchema>;

// ─── Pending FFL Upload (dealer not in database) ────────────────────────────────

function PendingUpload(props: { fflNumber: string }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pendingSchema = z.object({
    dealerName: z.string().min(2, "FFL / Dealer name is required"),
    contactName: z.string().min(2, "Contact name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(10, "Valid phone number is required"),
    address: z.string().min(5, "Address is required"),
    message: z.string().optional(),
  });

  type PendingValues = z.infer<typeof pendingSchema>;

  const form = useForm<PendingValues>({
    resolver: zodResolver(pendingSchema),
    defaultValues: {
      dealerName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      message: "",
    },
  });

  async function onSubmit(values: PendingValues) {
    setSubmitting(true);
    try {
      const resp = await fetch("/api/ffl/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fflNumber: props.fflNumber,
          dealerName: values.dealerName,
          contactName: values.contactName,
          email: values.email,
          phone: values.phone,
          address: values.address,
          message: values.message || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Submission failed");
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10"
        >
          <CheckCircle className="w-8 h-8 text-green-400" />
        </motion.div>
        <h2 className="text-2xl font-bold">Application Submitted</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Check your spam folder for an email from dubdub22.com. We will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-200">
          Your FFL was not found in our database. Fill out the form below and we will verify your FFL and add you to our dealer list.
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">
            FFL Number:{" "}
            <span className="font-mono text-primary">{props.fflNumber}</span>
          </p>
        </div>

        <FormField
          control={form.control}
          name="dealerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>FFL / Dealer Name</FormLabel>
              <FormControl>
                <Input {...field} className="bg-card border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Point of Contact</FormLabel>
              <FormControl>
                <Input {...field} className="bg-card border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input {...field} type="email" className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Address</FormLabel>
              <FormControl>
                <Input {...field} className="bg-card border-border" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} className="bg-card border-border resize-none" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={submitting}
          className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90 cursor-pointer"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </span>
          ) : (
            "SUBMIT FOR REVIEW"
          )}
        </Button>
      </form>
    </Form>
  );
}

// ─── Dealer Form (verified FFL — place order or inquiry) ───────────────────────

function DealerForm(props: { fflNumber: string; dealerName?: string; email?: string; phone?: string; expiry?: string }) {
  const { toast } = useToast();
  const [orderKind, setOrderKind] = useState<"inquiry" | "demo" | "stocking">("inquiry");
  const [quantityCans, setQuantityCans] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<DealerApplyValues>({
    resolver: zodResolver(dealerApplySchema),
    defaultValues: {
      dealerName: props.dealerName || "",
      contactName: "",
      email: props.email || "",
      fflNumber: props.fflNumber,
      fflExpiry: props.expiry || "",
      ein: "",
      contactPhone: props.phone || "",
      address: "",
      message: "",
    },
  });

  async function onSubmit(values: DealerApplyValues) {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        ...values,
        orderKind,
      };

      if (orderKind !== "inquiry") {
        body.quantityCans = quantityCans;
      }

      const resp = await fetch("/api/dealer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Request failed");
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-12">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
        </motion.div>
        <h2 className="text-2xl font-bold">Request Submitted</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Check your spam folder for an email from dubdub22.com.
        </p>
        <Button
          onClick={() => window.location.href = "/"}
          variant="outline"
          className="mt-4 cursor-pointer"
        >
          Return Home
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Order type selector ── */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">How can we help you today?</p>
          <div className="grid gap-3">
            {[
              { value: "inquiry", label: "Dealer Inquiry", sub: "Request more information about DubDub22" },
              { value: "demo", label: "Demo Order", sub: "Order 1 Demo Can", price: "$60" },
              { value: "stocking", label: "Stocking Order", sub: "Order in bulk for your inventory", price: "$60/unit" },
            ].map((opt) => (
              <label
                key={opt.value}
                className={
                  "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors " +
                  (orderKind === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")
                }
              >
                <input
                  type="radio"
                  name="orderKind"
                  value={opt.value}
                  checked={orderKind === opt.value}
                  onChange={() => setOrderKind(opt.value as typeof orderKind)}
                  className="accent-primary"
                />
                <div className="flex-1">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-sm text-muted-foreground ml-2">{opt.sub}</span>
                </div>
                {opt.price && <span className="text-primary font-bold">{opt.price}</span>}
              </label>
            ))}
          </div>
        </div>

        {/* ── Contact fields ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="dealerName" render={({ field }) => (
            <FormItem><FormLabel>Dealer / FFL Name</FormLabel><FormControl><Input {...field} className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="contactName" render={({ field }) => (
            <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        {/* ── Email / Phone ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input {...field} type="email" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="contactPhone" render={({ field }) => (
            <FormItem><FormLabel>Contact Phone <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input {...field} type="tel" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        {/* ── FFL / Expiry / EIN ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="fflNumber" render={({ field }) => (
            <FormItem><FormLabel>FFL Number</FormLabel><FormControl><Input {...field} className="bg-card border-border font-mono" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="fflExpiry" render={({ field }) => (
            <FormItem><FormLabel>FFL Expiration <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input {...field} placeholder="MM/DD/YYYY" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="ein" render={({ field }) => (
            <FormItem><FormLabel>EIN <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input {...field} placeholder="XX-XXXXXXX" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem><FormLabel>Business Address <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input {...field} className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        {/* ── Stocking quantity ── */}
        {orderKind === "stocking" && (
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <label htmlFor="quantity-select" className="text-sm font-medium">
              Quantity <span className="text-red-400">*</span>
            </label>
            <select
              id="quantity-select"
              value={quantityCans}
              onChange={(e) => setQuantityCans(e.target.value)}
              className="w-full h-10 rounded-md bg-background border border-border px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              required
            >
              {[5,10,15,20].map((n) => (
                <option key={n} value={String(n)}>{n} cans — ${n*60} (${60}/unit)</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Inquiry message ── */}
        {orderKind === "inquiry" && (
          <FormField control={form.control} name="message" render={({ field }) => (
            <FormItem>
              <FormLabel>Questions or Comments <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel>
              <FormControl><Textarea rows={3} {...field} placeholder="Tell us about your shop, what you're looking for..." className="bg-card border-border resize-none" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        {/* ── Submit ── */}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90 cursor-pointer"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </span>
          ) : (
            orderKind === "inquiry" ? "SUBMIT INQUIRY" : orderKind === "demo" ? "REQUEST DEMO INVOICE" : "REQUEST STOCKING INVOICE"
          )}
        </Button>

      </form>
    </Form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const [params] = useSearchParams();
  const ffl = params.get("ffl") || "";
  const dealerName = params.get("name") || "";
  const email = params.get("email") || "";
  const phone = params.get("phone") || "";
  const expiry = params.get("expiry") || "";
  const pending = params.get("pending") === "1";

  if (!ffl) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <section className="pt-32 text-center">
          <div className="container mx-auto px-6">
            <h1 className="text-3xl font-bold mb-4">Dealer Portal</h1>
            <p className="text-muted-foreground mb-8">Please verify your FFL first.</p>
            <Button asChild className="bg-primary cursor-pointer">
              <a href="/dealers">Go to FFL Verification</a>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold mb-2">
              {pending ? "FFL Review" : "Dealer Portal"}
            </h1>
            <p className="text-muted-foreground">
              {pending ? "Submit your FFL for verification" : "Place an order or make an inquiry"}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-lg border border-border p-6 shadow-lg"
          >
            {pending ? (
              <PendingUpload fflNumber={ffl} />
            ) : (
              <DealerForm fflNumber={ffl} dealerName={dealerName} email={email} phone={phone} expiry={expiry} />
            )}
          </motion.div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
