import React, { useState } from "react";
import { useSearchParams } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadCloud, CheckCircle, Loader2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const dealerApplySchema = z.object({
  dealerName: z.string().min(2, "Dealer/FFL name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  fflNumber: z.string().min(9, "Valid FFL number required"),
  ein: z.string().optional(),
  message: z.string().optional(),
});

type DealerApplyValues = z.infer<typeof dealerApplySchema>;

async function processImage(file: File | null): Promise<string | undefined> {
  if (!file) return undefined;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const MAX = 1024;
        if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6).split(",")[1]);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FileZone(props: { id: string; label: string; accept: string; required?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="text-sm font-medium">{props.label}{props.required ? " *" : ""}</label>
      <div className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors h-32 ${dragging ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"}`}>
        <Input id={props.id} type="file" accept={props.accept} required={props.required}
          className="absolute inset-0 w-[200%] h-[200%] -ml-10 -mt-10 opacity-0 cursor-pointer z-50"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
          onDragOver={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDrop={() => setDragging(false)} />
        <div className="flex flex-col items-center gap-1 text-center pointer-events-none">
          <UploadCloud className="w-7 h-7 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {fileName ? <span className="text-primary font-semibold">{fileName}</span> : "Drop file or click"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PendingUpload(props: { fflNumber: string }) {
  const { toast } = useToast();
  const [fflFile, setFflFile] = useState<File | null>(null);
  const [sotFile, setSotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fflFile) {
      toast({ title: "FFL Required", description: "Please upload your FFL document.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const fflData = await processImage(fflFile);
      const sotData = sotFile ? await processImage(sotFile) : undefined;
      const resp = await fetch("/api/ffl/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fflNumber: props.fflNumber, fflData, sotData, sotFileName: sotFile?.name }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Upload failed");
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-12">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10">
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
        <p className="text-sm font-medium">FFL Number: <span className="font-mono text-primary">{props.fflNumber}</span></p>
      </div>
      <FileZone id="ffl-upload" label="FFL Document" accept=".pdf,.png,.jpg,.jpeg" required />
      <FileZone id="sot-upload" label="SOT Document" accept=".pdf,.png,.jpg,.jpeg" />
      <Button type="submit" disabled={submitting}
        className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90 cursor-pointer">
        {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</> : "SUBMIT FOR REVIEW"}
      </Button>
    </form>
  );
}

function DealerForm(props: { fflNumber: string; dealerName?: string }) {
  const { toast } = useToast();
  const [orderType, setOrderType] = useState<"inquiry" | "demo" | "stocking">("inquiry");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<DealerApplyValues>({
    resolver: zodResolver(dealerApplySchema),
    defaultValues: {
      dealerName: props.dealerName || "",
      contactName: "",
      fflNumber: props.fflNumber,
      ein: "",
      message: "",
    },
  });

  async function onSubmit(values: DealerApplyValues) {
    setSubmitting(true);
    try {
      const fflInput = document.getElementById("ffl-upload") as HTMLInputElement | null;
      const sotInput = document.getElementById("sot-upload") as HTMLInputElement | null;
      const fflData = fflInput?.files?.[0] ? await processImage(fflInput.files[0]) : undefined;
      const sotData = sotInput?.files?.[0] ? await processImage(sotInput.files[0]) : undefined;

      const resp = await fetch("/api/dealer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          requestType: orderType === "inquiry" ? "Dealer Inquiry" : "Dealer Order",
          orderKind: orderType,
          fflFileName: fflInput?.files?.[0]?.name || "onfile",
          fflFileData: fflData,
          sotFileName: sotInput?.files?.[0]?.name,
          sotFileData: sotData,
        }),
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
          {orderType === "inquiry" ? "Your inquiry has been received. We will respond by email shortly." : "Your order request has been received. We will send an invoice shortly."}
        </p>
        <Button onClick={() => window.location.href = "/"} variant="outline" className="mt-4 cursor-pointer">Return Home</Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">How can we help you today?</p>
          <div className="grid gap-3">
            <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${orderType === "inquiry" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              <input type="radio" name="orderType" value="inquiry" checked={orderType === "inquiry"} onChange={() => setOrderType("inquiry")} className="accent-primary" />
              <div className="flex-1">
                <span className="font-medium">Dealer Inquiry</span>
                <span className="text-sm text-muted-foreground ml-2">Request more information about DubDub22</span>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${orderType === "demo" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              <input type="radio" name="orderType" value="demo" checked={orderType === "demo"} onChange={() => setOrderType("demo")} className="accent-primary" />
              <div className="flex-1">
                <span className="font-medium">Demo Order</span>
                <span className="text-sm text-muted-foreground ml-2">Order 1 Demo Can</span>
              </div>
              <span className="text-primary font-bold">$60</span>
            </label>
            <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${orderType === "stocking" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              <input type="radio" name="orderType" value="stocking" checked={orderType === "stocking"} onChange={() => setOrderType("stocking")} className="accent-primary" />
              <div className="flex-1">
                <span className="font-medium">Stocking Order</span>
                <span className="text-sm text-muted-foreground ml-2">Order in bulk for your inventory</span>
              </div>
              <span className="text-primary font-bold">$60/unit</span>
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="dealerName" render={({ field }) => (
            <FormItem><FormLabel>Dealer / FFL Name</FormLabel>
              <FormControl><Input {...field} className="bg-card border-border" /></FormControl>
              <FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="contactName" render={({ field }) => (
            <FormItem><FormLabel>Contact Person</FormLabel>
              <FormControl><Input {...field} className="bg-card border-border" /></FormControl>
              <FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <FormField control={form.control} name="fflNumber" render={({ field }) => (
            <FormItem><FormLabel>FFL Number</FormLabel>
              <FormControl><Input {...field} readOnly className="bg-card border-border font-mono" /></FormControl>
              <FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="ein" render={({ field }) => (
            <FormItem><FormLabel>EIN <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
              <FormControl><Input {...field} placeholder="XX-XXXXXXX" className="bg-card border-border" /></FormControl>
              <FormMessage /></FormItem>
          )} />
        </div>

        {orderType === "stocking" ? (
          <div className="p-4 rounded-lg border border-border bg-card">
            <label className="text-sm font-medium mb-2 block">Quantity</label>
            <select className="w-full h-10 rounded-md bg-background border border-border px-3">
              <option value="5">5 cans — $300 ($60/unit)</option>
              <option value="10">10 cans — $600 ($60/unit)</option>
              <option value="15">15 cans — $900 ($60/unit)</option>
              <option value="20">20 cans — $1,200 ($60/unit)</option>
            </select>
          </div>
        ) : null}

        {orderType === "inquiry" ? (
          <FormField control={form.control} name="message" render={({ field }) => (
            <FormItem><FormLabel>Questions or Comments</FormLabel>
              <FormControl><Textarea rows={3} {...field} placeholder="Tell us about your shop..." className="bg-card border-border resize-none" /></FormControl>
              <FormMessage /></FormItem>
          )} />
        ) : null}

        <div className="grid md:grid-cols-2 gap-4">
          <FileZone id="ffl-upload" label="FFL on File" accept=".pdf,.png,.jpg,.jpeg" />
          <FileZone id="sot-upload" label="SOT Document" accept=".pdf,.png,.jpg,.jpeg" />
        </div>

        <Button type="submit" disabled={submitting}
          className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90 cursor-pointer">
          {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</> : "SUBMIT REQUEST"}
        </Button>
      </form>
    </Form>
  );
}

export default function ApplyPage() {
  const [params] = useSearchParams();
  const ffl = params.get("ffl") || "";
  const dealerName = params.get("name") || "";
  const pending = params.get("pending") === "1";

  if (!ffl) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <section className="pt-32 text-center">
          <div className="container mx-auto px-6">
            <h1 className="text-3xl font-bold mb-4">Dealer Portal</h1>
            <p className="text-muted-foreground mb-8">Please verify your FFL first.</p>
            <Button asChild className="bg-primary cursor-pointer"><a href="/dealers">Go to FFL Verification</a></Button>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">{pending ? "FFL Review" : "Dealer Portal"}</h1>
            <p className="text-muted-foreground">{pending ? "Upload your FFL for verification" : "Place an order or make an inquiry"}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-lg border border-border p-6 shadow-lg">
            {pending ? <PendingUpload fflNumber={ffl} /> : <DealerForm fflNumber={ffl} dealerName={dealerName} />}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
