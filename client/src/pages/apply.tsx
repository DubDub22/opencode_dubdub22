import React, { useState } from "react";
import { useSearchParams } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";

import { CheckCircle, Loader2, UploadCloud, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealerApplyValues {
  dealerName: string;
  contactName: string;
  email: string;
  confirmEmail: string;
  fflExpiry: string;
  ein: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  message: string;
}

// ─── Upload Field Helper ─────────────────────────────────────────────────────
function UploadField({
  id,
  accept,
  file,
  onFileChange,
  error,
}: {
  id: string;
  accept: string;
  file: File | null;
  onFileChange: (f: File | null) => void;
  error?: string;
}) {
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer p-4 text-center ${error ? "border-red-500 bg-red-500/5" : "border-border hover:border-primary/40 bg-card"}`}
        style={{ minHeight: "80px" }}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-sm text-foreground truncate max-w-[220px]">{file.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
              className="text-muted-foreground hover:text-destructive shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <UploadCloud className="w-6 h-6 mb-2 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Click to upload</span>
            <span className="text-xs text-muted-foreground mt-0.5">PDF, PNG, JPG</span>
          </>
        )}
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── Pending FFL Upload (dealer not in database) ────────────────────────────────

function PendingUpload(props: { fflNumber: string }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fflSegs, setFflSegs] = useState(["", "", "", "", "", ""]);
  const [fflError, setFflError] = useState("");
  const [fflHasSot, setFflHasSot] = useState(false);
  const [fflFile, setFflFile] = useState<File | null>(null);
  const [sotFile, setSotFile] = useState<File | null>(null);

  type PendingValues = {
    dealerName: string;
    contactName: string;
    email: string;
    confirmEmail: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    ein: string;
    message: string;
  };

  const form = useForm<PendingValues>({
    defaultValues: {
      dealerName: "",
      contactName: "",
      email: "",
      confirmEmail: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      ein: "",
      message: "",
    },
  });

  async function onSubmit(values: PendingValues) {
    // Manual validation
    if (!values.dealerName || values.dealerName.trim().length < 2) { toast({ title: "Validation", description: "Dealer name must be at least 2 characters", variant: "destructive" }); return; }
    if (!values.contactName || values.contactName.trim().length < 2) { toast({ title: "Validation", description: "Contact name must be at least 2 characters", variant: "destructive" }); return; }
    if (!values.email || !/^[^@]+@[^@]+\.[^@]+$/.test(values.email)) { toast({ title: "Validation", description: "Valid email is required", variant: "destructive" }); return; }
    if (values.email !== values.confirmEmail) { toast({ title: "Validation", description: "Emails do not match", variant: "destructive" }); return; }
    if (!values.phone || values.phone.replace(/\D/g, "").length < 10) { toast({ title: "Validation", description: "Valid phone number is required", variant: "destructive" }); return; }
    if (!values.address || values.address.trim().length < 5) { toast({ title: "Validation", description: "Address is required", variant: "destructive" }); return; }
    if (!values.city || values.city.trim().length < 2) { toast({ title: "Validation", description: "City is required", variant: "destructive" }); return; }
    if (!values.state || values.state.trim().length < 2) { toast({ title: "Validation", description: "State is required", variant: "destructive" }); return; }
    if (!values.zipCode || values.zipCode.trim().length < 5) { toast({ title: "Validation", description: "ZIP code is required", variant: "destructive" }); return; }
    if (!values.ein || values.ein.trim().length < 2) { toast({ title: "Validation", description: "EIN is required", variant: "destructive" }); return; }

    const fullFfl = fflSegs.join("-");
    if (fflSegs.some(s => s.length === 0)) {
      setFflError("Please fill in all FFL number segments");
      return;
    }
    if (!fflFile) {
      toast({ title: "Missing FFL", description: "Please upload your FFL document.", variant: "destructive" });
      return;
    }
    if (!fflHasSot && !sotFile) {
      toast({ title: "Missing SOT", description: "Please upload your SOT document, or check the box if your FFL has SOT on the same page.", variant: "destructive" });
      return;
    }
    setFflError("");
    setSubmitting(true);
    try {
      // Convert files to base64
      const toBase64 = (f: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(f);
        });

      const fflBase64 = await toBase64(fflFile);
      const sotBase64 = sotFile ? await toBase64(sotFile) : null;

      const resp = await fetch("/api/ffl/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fflNumber: fullFfl,
          dealerName: values.dealerName,
          contactName: values.contactName,
          email: values.email,
          phone: values.phone,
          address: values.address,
          city: values.city,
          state: values.state,
          zipCode: values.zipCode,
          ein: values.ein,
          message: values.message || null,
          fflFileName: fflFile.name,
          fflFileData: fflBase64,
          sotFileName: sotFile ? sotFile.name : null,
          sotFileData: sotBase64,
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

        {/* FFL Number — 6-segment input boxes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">FFL Number</label>
          <div className="flex items-center gap-1 font-mono text-sm">
            <input
              key="seg0"
              type="text"
              maxLength={1}
              value={fflSegs[0]}
              onChange={e => { const v = e.target.value.toUpperCase(); setFflSegs([v, fflSegs[1], fflSegs[2], fflSegs[3], fflSegs[4], fflSegs[5]]); if (v) (document.getElementById("ffl-seg1") as HTMLInputElement)?.focus(); }}
              className="w-8 h-9 border border-border rounded bg-card text-center text-center uppercase"
              id="ffl-seg0"
              placeholder="X"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key="seg1"
              type="text"
              maxLength={2}
              value={fflSegs[1]}
              onChange={e => { const v = e.target.value.toUpperCase(); setFflSegs([fflSegs[0], v, fflSegs[2], fflSegs[3], fflSegs[4], fflSegs[5]]); if (v.length === 2) (document.getElementById("ffl-seg2") as HTMLInputElement)?.focus(); }}
              className="w-10 h-9 border border-border rounded bg-card text-center uppercase"
              id="ffl-seg1"
              placeholder="XX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key="seg2"
              type="text"
              maxLength={3}
              value={fflSegs[2]}
              onChange={e => { const v = e.target.value.toUpperCase(); setFflSegs([fflSegs[0], fflSegs[1], v, fflSegs[3], fflSegs[4], fflSegs[5]]); if (v.length === 3) (document.getElementById("ffl-seg3") as HTMLInputElement)?.focus(); }}
              className="w-12 h-9 border border-border rounded bg-card text-center uppercase"
              id="ffl-seg2"
              placeholder="XXX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key="seg3"
              type="text"
              maxLength={2}
              value={fflSegs[3]}
              onChange={e => { const v = e.target.value.toUpperCase(); setFflSegs([fflSegs[0], fflSegs[1], fflSegs[2], v, fflSegs[4], fflSegs[5]]); if (v.length === 2) (document.getElementById("ffl-seg4") as HTMLInputElement)?.focus(); }}
              className="w-10 h-9 border border-border rounded bg-card text-center uppercase"
              id="ffl-seg3"
              placeholder="XX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key="seg4"
              type="text"
              maxLength={2}
              value={fflSegs[4]}
              onChange={e => { const v = e.target.value.toUpperCase(); setFflSegs([fflSegs[0], fflSegs[1], fflSegs[2], fflSegs[3], v, fflSegs[5]]); if (v.length === 2) (document.getElementById("ffl-seg5") as HTMLInputElement)?.focus(); }}
              className="w-10 h-9 border border-border rounded bg-card text-center uppercase"
              id="ffl-seg4"
              placeholder="XX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key="seg5"
              type="text"
              maxLength={5}
              value={fflSegs[5]}
              onChange={e => { const v = e.target.value.toUpperCase(); setFflSegs([fflSegs[0], fflSegs[1], fflSegs[2], fflSegs[3], fflSegs[4], v]); }}
              className="w-14 h-9 border border-border rounded bg-card text-center uppercase"
              id="ffl-seg5"
              placeholder="XXXXX"
            />
          </div>
          {fflError && <p className="text-xs text-red-500">{fflError}</p>}
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
          {form.watch("email").includes("@") && (
            <FormField
              control={form.control}
              name="confirmEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" className="bg-card border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP Code</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

        {/* ── File Uploads ── */}
        <div className="space-y-4 p-4 rounded-lg border border-border bg-card/50">
          <p className="text-sm font-medium">Required Documents</p>

          {/* FFL Upload */}
          <div className="space-y-1">
            <label className="text-xs font-medium">
              FFL <span className="text-red-400">*</span>
            </label>
            <UploadField
              id="pending-ffl-upload"
              accept=".pdf,.png,.jpg,.jpeg"
              file={fflFile}
              onFileChange={(f) => {
                setFflFile(f);
                setFflError("");
              }}
              error={!fflFile ? fflError : ""}
            />
          </div>

          {/* FFL has SOT combined checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={fflHasSot}
              onChange={(e) => setFflHasSot(e.target.checked)}
              className="accent-primary"
            />
            My FFL has SOT combined on the same page
          </label>

          {/* SOT Upload — required only if FFL does NOT have SOT combined */}
          {!fflHasSot && (
            <div className="space-y-1">
              <label className="text-xs font-medium">
                SOT <span className="text-red-400">*</span>
              </label>
              <UploadField
                id="pending-sot-upload"
                accept=".pdf,.png,.jpg,.jpeg"
                file={sotFile}
                onFileChange={setSotFile}
              />
            </div>
          )}
        </div>

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

function DealerForm(props: { fflNumber: string; dealerName?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zip?: string }) {
  const { toast } = useToast();
  const [orderKind, setOrderKind] = useState<"inquiry" | "demo" | "stocking">("inquiry");
  const [quantityCans, setQuantityCans] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasDemoUnitShipped, setHasDemoUnitShipped] = useState(false);
  const [fflHasSot, setFflHasSot] = useState(false);
  const [fflFile, setFflFile] = useState<File | null>(null);
  const [sotFile, setSotFile] = useState<File | null>(null);

  // Check if dealer already received a demo unit — if so, hide the demo option
  React.useEffect(() => {
    if (!props.email) return;
    fetch(`/api/dealer-request/demo-status?email=${encodeURIComponent(props.email)}`)
      .then(r => r.json())
      .then(data => {
        if (data.hasShippedDemo) {
          setHasDemoUnitShipped(true);
          // If demo was selected, fall back to inquiry
          setOrderKind("inquiry");
        }
      })
      .catch(() => {});
  }, [props.email]);

  // Parse FFL number into 6 segments for display/editing
  // Handles both dashed ("1-66-075-01-8B-00358") and raw 15-digit ("166075018B00358") formats
  const parseFflSegments = (ffl: string): string[] => {
    if (ffl.includes("-")) {
      // Has dashes — split directly
      const parts = ffl.split("-");
      return [
        parts[0] || "",
        parts[1] || "",
        parts[2] || "",
        parts[3] || "",
        parts[4] || "",
        parts[5] || "",
      ];
    }
    // Raw 15-digit — parse by position (ATF format: X-XX-XXX-XX-XX-XXXXX)
    return [
      ffl.slice(0, 1)  || "",
      ffl.slice(1, 3)  || "",
      ffl.slice(3, 6)  || "",
      ffl.slice(6, 8)  || "",
      ffl.slice(8, 10) || "",
      ffl.slice(10, 15) || "",
    ];
  };

  const [fflSegs, setFflSegs] = useState<string[]>(() => parseFflSegments(props.fflNumber));

  function handleFflSegChange(idx: number, val: string) {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const maxLens = [1, 2, 3, 2, 2, 5];
    const capped = cleaned.slice(0, maxLens[idx]);
    const next = [...fflSegs];
    next[idx] = capped;
    setFflSegs(next);
    // Auto-advance focus
    if (capped.length >= maxLens[idx] && idx < 5) {
      setTimeout(() => {
        (document.getElementById(`df-seg${idx + 1}`) as HTMLInputElement)?.focus();
      }, 0);
    }
  }

  // Auto-fill from dealer profile when returning
  React.useEffect(() => {
    if (!props.fflNumber) return;
    fetch(`/api/dealer/profile?ffl=${encodeURIComponent(props.fflNumber)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.data) return;
        const d = data.data;
        form.reset({
          ...form.getValues(),
          dealerName: form.getValues("dealerName") || d.businessName || "",
          contactName: form.getValues("contactName") || d.contactName || "",
          email: form.getValues("email") || d.email || "",
          confirmEmail: form.getValues("confirmEmail") || d.email || "",
          contactPhone: form.getValues("contactPhone") || d.phone || "",
          address: form.getValues("address") || d.address || "",
          city: form.getValues("city") || d.city || "",
          state: form.getValues("state") || d.state || "",
          zipCode: form.getValues("zipCode") || d.zip || "",
          ein: form.getValues("ein") || d.ein || "",
          fflExpiry: form.getValues("fflExpiry") || d.fflExpiryDate || "",
        });
      })
      .catch(() => {});
  }, [props.fflNumber]);

  const form = useForm<DealerApplyValues>({
    defaultValues: {
      dealerName: props.dealerName || "",
      contactName: "",
      email: props.email || "",
      confirmEmail: "",
      fflExpiry: "",
      ein: "",
      contactPhone: props.phone || "",
      address: props.address || "",
      city: props.city || "",
      state: props.state || "",
      zipCode: props.zip || "",
      message: "",
    },
  });

  async function onSubmit(values: DealerApplyValues) {
    // Manual validation
    if (!values.dealerName || values.dealerName.trim().length < 2) { toast({ title: "Validation", description: "Dealer / FFL name must be at least 2 characters", variant: "destructive" }); return; }
    if (!values.contactName || values.contactName.trim().length < 2) { toast({ title: "Validation", description: "Contact name must be at least 2 characters", variant: "destructive" }); return; }
    if (!values.email || !/^[^@]+@[^@]+\.[^@]+$/.test(values.email)) { toast({ title: "Validation", description: "Valid email is required", variant: "destructive" }); return; }
    if (values.email !== values.confirmEmail) { toast({ title: "Validation", description: "Emails do not match", variant: "destructive" }); return; }
    if (!values.contactPhone || values.contactPhone.replace(/\D/g, "").length < 10) { toast({ title: "Validation", description: "Contact phone is required", variant: "destructive" }); return; }
    if (!values.city || values.city.trim().length < 2) { toast({ title: "Validation", description: "City is required", variant: "destructive" }); return; }
    if (!values.state || values.state.trim().length < 2) { toast({ title: "Validation", description: "State is required", variant: "destructive" }); return; }
    if (!values.zipCode || values.zipCode.trim().length < 5) { toast({ title: "Validation", description: "ZIP code is required", variant: "destructive" }); return; }
    if (!values.ein || values.ein.trim().length < 2) { toast({ title: "Validation", description: "EIN is required", variant: "destructive" }); return; }
    if (orderKind === "inquiry" && (!values.message || values.message.trim().length < 1)) { toast({ title: "Validation", description: "Message is required", variant: "destructive" }); return; }

    const fullFfl = fflSegs.join("-");
    if (fullFfl.replace(/-/g, "").length < 15) {
      toast({ title: "Invalid FFL", description: "FFL number must be 15 characters.", variant: "destructive" });
      return;
    }
    if (!fflFile) {
      toast({ title: "Missing FFL", description: "Please upload your FFL document.", variant: "destructive" });
      return;
    }
    if (!fflHasSot && !sotFile) {
      toast({ title: "Missing SOT", description: "Please upload your SOT document, or check the box if your FFL has SOT on the same page.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const toBase64 = (f: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(f);
        });

      const fflBase64 = await toBase64(fflFile);
      const sotBase64 = sotFile ? await toBase64(sotFile) : null;

      const { confirmEmail, fflNumber: _fflNumber, ...rest } = values;
      const body: Record<string, unknown> = {
        ...rest,
        fflNumber: fullFfl,
        orderKind,
        fflFileName: fflFile.name,
        fflFileData: fflBase64,
        sotFileName: sotFile ? sotFile.name : null,
        sotFileData: sotBase64,
      };

      if (orderKind !== "inquiry") {
        body.quantityCans = quantityCans;
        body.termsAccepted = false;
      }

      const resp = await fetch("/api/dealer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Request failed");

      // Demo / stocking orders → redirect to order confirmation to accept terms
      if (orderKind !== "inquiry") {
        // Store file data for the confirmation page to include in the final order POST
        sessionStorage.setItem("pendingFflFileName", fflFile.name);
        sessionStorage.setItem("pendingFflFileData", fflBase64);
        sessionStorage.setItem("pendingSotFileName", sotFile ? sotFile.name : "");
        sessionStorage.setItem("pendingSotFileData", sotBase64 || "");
        const qty = quantityCans ? String(quantityCans) : "1";
        const params = new URLSearchParams({
          type: orderKind === "demo" ? "demo" : "stocking",
          qty,
          dealer: encodeURIComponent(values.dealerName || ""),
          contact: encodeURIComponent(values.contactName || ""),
          email: encodeURIComponent(values.email || ""),
          phone: encodeURIComponent(values.contactPhone || ""),
          address: encodeURIComponent(values.address || ""),
          city: encodeURIComponent(values.city || ""),
          state: encodeURIComponent(values.state || ""),
          zip: encodeURIComponent(values.zipCode || ""),
        });
        window.location.href = `/order-confirmation?${params.toString()}`;
        return;
      }

      // Inquiries show the success screen
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
            ].filter(opt => opt.value !== "demo" || !hasDemoUnitShipped).map((opt) => (
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

        {/* ── FFL Number — 6-segment entry ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">FFL Number</label>
          <div className="flex items-center gap-1 font-mono text-sm">
            <input
              key={`df-seg0-${fflSegs[0]}`}
              type="text"
              maxLength={1}
              value={fflSegs[0]}
              onChange={e => handleFflSegChange(0, e.target.value)}
              className="w-8 h-9 border border-border rounded bg-card text-center uppercase"
              id="df-seg0"
              placeholder="X"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key={`df-seg1-${fflSegs[1]}`}
              type="text"
              maxLength={2}
              value={fflSegs[1]}
              onChange={e => handleFflSegChange(1, e.target.value)}
              className="w-10 h-9 border border-border rounded bg-card text-center uppercase"
              id="df-seg1"
              placeholder="XX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key={`df-seg2-${fflSegs[2]}`}
              type="text"
              maxLength={3}
              value={fflSegs[2]}
              onChange={e => handleFflSegChange(2, e.target.value)}
              className="w-12 h-9 border border-border rounded bg-card text-center uppercase"
              id="df-seg2"
              placeholder="XXX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key={`df-seg3-${fflSegs[3]}`}
              type="text"
              maxLength={2}
              value={fflSegs[3]}
              onChange={e => handleFflSegChange(3, e.target.value)}
              className="w-10 h-9 border border-border rounded bg-card text-center uppercase"
              id="df-seg3"
              placeholder="XX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key={`df-seg4-${fflSegs[4]}`}
              type="text"
              maxLength={2}
              value={fflSegs[4]}
              onChange={e => handleFflSegChange(4, e.target.value)}
              className="w-10 h-9 border border-border rounded bg-card text-center uppercase"
              id="df-seg4"
              placeholder="XX"
            />
            <span className="text-muted-foreground mx-0.5">-</span>
            <input
              key={`df-seg5-${fflSegs[5]}`}
              type="text"
              maxLength={5}
              value={fflSegs[5]}
              onChange={e => handleFflSegChange(5, e.target.value)}
              className="w-14 h-9 border border-border rounded bg-card text-center uppercase"
              id="df-seg5"
              placeholder="XXXXX"
            />
          </div>
          <p className="text-xs text-muted-foreground">Edit if needed.</p>
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
          <FormField control={form.control} name="confirmEmail" render={({ field }) => (
            <FormItem><FormLabel>Confirm Email</FormLabel><FormControl><Input {...field} type="email" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="contactPhone" render={({ field }) => (
            <FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input {...field} type="tel" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        {/* ── FFL Expiry / EIN ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="fflExpiry" render={({ field }) => (
            <FormItem><FormLabel>FFL Expiration <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input {...field} placeholder="MM/DD/YYYY" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="ein" render={({ field }) => (
            <FormItem><FormLabel>EIN <span className="text-xs text-destructive font-normal">*</span></FormLabel><FormControl><Input {...field} placeholder="XX-XXXXXXX" className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Business Address</FormLabel><FormControl><Input {...field} className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="state" render={({ field }) => (
            <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="zipCode" render={({ field }) => (
            <FormItem><FormLabel>ZIP Code</FormLabel><FormControl><Input {...field} className="bg-card border-border" /></FormControl><FormMessage /></FormItem>
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
              <FormLabel>Questions or Comments <span className="text-xs text-red-400 font-normal">(required)</span></FormLabel>
              <FormControl><Textarea rows={3} {...field} placeholder="Tell us about your shop, what you're looking for..." className="bg-card border-border resize-none" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        {/* ── File Uploads (all order types) ── */}
        <div className="space-y-4 p-4 rounded-lg border border-border bg-card/50">
          <p className="text-sm font-medium">Required Documents</p>

          {/* FFL Upload */}
          <div className="space-y-1">
            <label className="text-xs font-medium">
              FFL <span className="text-red-400">*</span>
            </label>
            <UploadField
              id="df-ffl-upload"
              accept=".pdf,.png,.jpg,.jpeg"
              file={fflFile}
              onFileChange={setFflFile}
            />
          </div>

          {/* FFL has SOT combined checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={fflHasSot}
              onChange={(e) => setFflHasSot(e.target.checked)}
              className="accent-primary"
            />
            My FFL has SOT combined on the same page
          </label>

          {/* SOT Upload — required only if FFL does NOT have SOT combined */}
          {!fflHasSot && (
            <div className="space-y-1">
              <label className="text-xs font-medium">
                SOT <span className="text-red-400">*</span>
              </label>
              <UploadField
                id="df-sot-upload"
                accept=".pdf,.png,.jpg,.jpeg"
                file={sotFile}
                onFileChange={setSotFile}
              />
            </div>
          )}
        </div>

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
  const address = params.get("address") || "";
  const city = params.get("city") || "";
  const state = params.get("state") || "";
  const zip = params.get("zip") || "";
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
              <DealerForm fflNumber={ffl} dealerName={dealerName} email={email} phone={phone} address={address} city={city} state={state} zip={zip} />
            )}
          </motion.div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
