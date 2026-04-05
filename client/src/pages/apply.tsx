import React, { useState } from "react";
import { useSearchParams } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadCloud, CheckCircle, Loader2 } from "lucide-react";
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
});

type DealerApplyValues = z.infer<typeof dealerApplySchema>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── File Upload Zone ───────────────────────────────────────────────────────────

const FileZone = React.forwardRef<HTMLInputElement, {
  id: string;
  label: string;
  accept: string;
  required?: boolean;
  description?: string;
  onFileSelect?: (file: File | null) => void;
}>((props, ref) => {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setFileName(file?.name || null);
    props.onFileSelect?.(file);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
        {props.required ? " *" : null}
        {props.description ? (
          <span className="text-muted-foreground font-normal ml-1">{props.description}</span>
        ) : null}
      </label>
      <div
        className={
          "relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors h-32 " +
          (dragging ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30")
        }
      >
        <input
          id={props.id}
          type="file"
          accept={props.accept}
          required={props.required}
          ref={ref}
          className="absolute inset-0 w-[200%] h-[200%] -ml-10 -mt-10 opacity-0 cursor-pointer z-50"
          onChange={handleChange}
          onDragOver={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDrop={() => setDragging(false)}
        />
        <div className="flex flex-col items-center gap-1 text-center pointer-events-none">
          <UploadCloud className={"w-7 h-7 " + (dragging ? "text-primary" : "text-muted-foreground")} />
          <span className="text-sm text-muted-foreground">
            {fileName ? (
              <span className="text-primary font-semibold block truncate max-w-[260px]">{fileName}</span>
            ) : (
              "Drop file or click to browse"
            )}
          </span>
        </div>
      </div>
    </div>
  );
});

// ─── Pending FFL Upload (dealer not in database) ────────────────────────────────

function PendingUpload(props: { fflNumber: string }) {
  const { toast } = useToast();
  const fflRef = React.useRef<HTMLInputElement>(null);
  const sotRef = React.useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const fflFile = fflRef.current?.files?.[0] || null;
    const sotFile = sotRef.current?.files?.[0] || null;
    console.log("[DUB_DUB] handleSubmit fired", { fflFile: fflFile?.name, sotFile: sotFile?.name });
    if (!fflFile && !sotFile) {
      console.log("[DUB_DUB] NO FILES - showing toast");
      toast({ title: "FFL or SOT Required", description: "Please upload your FFL or SOT document.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      console.log("[DUB_DUB] reading files...");
      const fflData = fflFile ? await readFileAsBase64(fflFile).then(b => b.split(",")[1]) : undefined;
      const sotData = sotFile ? await readFileAsBase64(sotFile).then(b => b.split(",")[1]) : undefined;
      console.log("[DUB_DUB] fflData length:", fflData?.length, "sotData length:", sotData?.length);
      const resp = await fetch("/api/ffl/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fflNumber: props.fflNumber,
          fflData,
          sotData,
          sotFileName: sotFile?.name || null,
        }),
      });
      console.log("[DUB_DUB] resp status:", resp.status);
      const data = await resp.json();
      console.log("[DUB_DUB] resp data:", JSON.stringify(data));
      if (!resp.ok) throw new Error(data.error || "Upload failed");
      setSubmitted(true);
    } catch (err: any) {
      console.log("[DUB_DUB] catch err:", err.message);
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      console.log("[DUB_DUB] finally, setting submitting=false");
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
        <h2 className="text-2xl font-bold">FFL Submitted for Review</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your FFL has been submitted. We will review it and add you to our dealer list. You will receive an email once approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-200">
        Your FFL was not found in our database. Upload your FFL and we will verify it and add you.
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          FFL Number:{" "}
          <span className="font-mono text-primary">{props.fflNumber}</span>
        </p>
      </div>
      <FileZone
        id="ffl-upload"
        label="FFL Document"
        accept=".pdf,.png,.jpg,.jpeg"
        description="Accepted: PDF, PNG, JPG"
        ref={fflRef}
      />
      <FileZone
        id="sot-upload"
        label="SOT Document"
        accept=".pdf,.png,.jpg,.jpeg"
        description="Accepted: PDF, PNG, JPG"
        ref={sotRef}
      />
      <Button
        type="button"
        disabled={submitting}
        className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90 cursor-pointer"
        onClick={() => { console.log("[DUB_DUB] button clicked"); handleSubmit({ preventDefault: () => {}, stopPropagation: () => {} } as any); }}
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
  );
}

// ─── Dealer Form (verified FFL — place order or inquiry) ───────────────────────

function DealerForm(props: { fflNumber: string; dealerName?: string; email?: string; phone?: string; expiry?: string }) {
  const { toast } = useToast();
  const [orderKind, setOrderKind] = useState<"inquiry" | "demo" | "stocking">("inquiry");
  const [quantityCans, setQuantityCans] = useState("5");
  const fflRef = React.useRef<HTMLInputElement>(null);
  const sotRef = React.useRef<HTMLInputElement>(null);
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
      message: "",
    },
  });

  async function onSubmit(values: DealerApplyValues) {
    const fflFile = fflRef.current?.files?.[0] || null;
    const sotFile = sotRef.current?.files?.[0] || null;
    if (!fflFile && !sotFile) {
      toast({ title: "FFL or SOT Required", description: "Please upload your FFL or SOT document.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const fflData = fflFile ? await readFileAsBase64(fflFile).then(b => b.split(",")[1]) : undefined;
      const sotData = sotFile ? await readFileAsBase64(sotFile).then(b => b.split(",")[1]) : undefined;

      const body: Record<string, unknown> = {
        ...values,
        orderKind,
        fflFileName: fflFile?.name || "onfile",
        fflFileData: fflData,
        sotFileName: sotFile?.name || null,
        sotFileData: sotData,
      };

      // Only send quantity for non-inquiry requests
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
          {orderKind === "inquiry"
            ? "Your inquiry has been received. We will respond by email shortly."
            : orderKind === "demo"
            ? "Your demo can order has been received. We will send an invoice shortly."
            : "Your stocking order request has been received. We will send an invoice shortly."}
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

  const sotRequired = orderKind !== "inquiry";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Order type selector ── */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">How can we help you today?</p>
          <div className="grid gap-3">

            <label className={
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors " +
              (orderKind === "inquiry" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")
            }>
              <input
                type="radio"
                name="orderKind"
                value="inquiry"
                checked={orderKind === "inquiry"}
                onChange={() => setOrderKind("inquiry")}
                className="accent-primary"
              />
              <div className="flex-1">
                <span className="font-medium">Dealer Inquiry</span>
                <span className="text-sm text-muted-foreground ml-2">Request more information about DubDub22</span>
              </div>
            </label>

            <label className={
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors " +
              (orderKind === "demo" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")
            }>
              <input
                type="radio"
                name="orderKind"
                value="demo"
                checked={orderKind === "demo"}
                onChange={() => setOrderKind("demo")}
                className="accent-primary"
              />
              <div className="flex-1">
                <span className="font-medium">Demo Order</span>
                <span className="text-sm text-muted-foreground ml-2">Order 1 Demo Can</span>
              </div>
              <span className="text-primary font-bold">$60</span>
            </label>

            <label className={
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors " +
              (orderKind === "stocking" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")
            }>
              <input
                type="radio"
                name="orderKind"
                value="stocking"
                checked={orderKind === "stocking"}
                onChange={() => setOrderKind("stocking")}
                className="accent-primary"
              />
              <div className="flex-1">
                <span className="font-medium">Stocking Order</span>
                <span className="text-sm text-muted-foreground ml-2">Order in bulk for your inventory</span>
              </div>
              <span className="text-primary font-bold">$60/unit</span>
            </label>

          </div>
        </div>

        {/* ── Contact fields ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dealerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dealer / FFL Name</FormLabel>
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
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Email / Phone ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="dealer@example.com" className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel>
                <FormControl>
                  <Input {...field} type="tel" placeholder="(555) 555-5555" className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── FFL / Expiry / EIN ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="fflNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FFL Number</FormLabel>
                <FormControl>
                  <Input {...field} className="bg-card border-border font-mono" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fflExpiry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  FFL Expiration Date <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="MM/DD/YYYY" className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ein"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  EIN <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="XX-XXXXXXX" className="bg-card border-border" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Stocking quantity ── */}
        {orderKind === "stocking" ? (
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
              <option value="5">5 cans — $300 ($60/unit)</option>
              <option value="10">10 cans — $600 ($60/unit)</option>
              <option value="15">15 cans — $900 ($60/unit)</option>
              <option value="20">20 cans — $1,200 ($60/unit)</option>
            </select>
          </div>
        ) : null}

        {/* ── Inquiry message ── */}
        {orderKind === "inquiry" ? (
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Questions or Comments{" "}
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    {...field}
                    placeholder="Tell us about your shop, what you're looking for, any questions you have..."
                    className="bg-card border-border resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {/* ── File uploads ── */}
        <div className="grid md:grid-cols-2 gap-4">
          <FileZone
            id="ffl-upload"
            label="FFL on File"
            accept=".pdf,.png,.jpg,.jpeg"
            description="Accepted: PDF, PNG, JPG"
            ref={fflRef}
          />
          <FileZone
            id="sot-upload"
            label={"SOT Document" + (sotRequired ? " *" : "")}
            accept=".pdf,.png,.jpg,.jpeg"
            required={sotRequired}
            description="Accepted: PDF, PNG, JPG"
            ref={sotRef}
          />
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
              {pending ? "Upload your FFL for verification" : "Place an order or make an inquiry"}
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
