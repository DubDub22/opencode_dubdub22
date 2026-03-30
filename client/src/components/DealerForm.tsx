import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const dealerFormSchema = z.object({
  contactName: z.string().min(2, { message: "Contact name is required." }),
  businessName: z.string().min(2, { message: "Business name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  confirmEmail: z.string().email({ message: "Please confirm your email address." }),
  phone: z.string().min(13, { message: "Phone number is required." }),
  quantityCans: z.string().optional(),
  message: z.string().optional(),
}).refine((data) => data.email === data.confirmEmail, {
  message: "Email addresses must match.",
  path: ["confirmEmail"],
});

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
}

async function processImage(selectedFile: File | null): Promise<string | undefined> {
  if (!selectedFile) return undefined;
  return new Promise<string>((resolve, reject) => {
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
      reader.readAsDataURL(selectedFile);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(selectedFile);
    }
  });
}

function FileInputZone({ id, label, accept, capture, required, description }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  React.useEffect(() => {
    const input = document.getElementById(id) as HTMLInputElement;
    if (input && !input.value) setFileName(null);
  });

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label} {description && <span className="text-muted-foreground font-normal">({description})</span>}
      </label>
      <div
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors duration-200 ${isDragging ? "border-primary bg-primary/10" : "border-border bg-card"} hover:border-primary/30 cursor-pointer h-32 overflow-hidden`}
      >
        <Input
          id={id}
          type="file"
          accept={accept}
          required={required}
          capture={capture as any}
          className="absolute inset-0 w-[200%] h-[200%] -ml-10 -mt-10 opacity-0 cursor-pointer z-50 file:cursor-pointer"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
          onDragOver={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDrop={() => setIsDragging(false)}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 pointer-events-none">
          <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm text-muted-foreground">
            {fileName ? (
              <span className="text-primary font-semibold block truncate max-w-[260px]">{fileName}</span>
            ) : (
              <>Drop file here, or <span className="text-primary font-medium">click to browse</span></>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

const MotionWrapButton = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`inline-block ${className}`}>
    {children}
  </motion.div>
);

export default function DealerForm() {
  const { toast } = useToast();
  const [requestType, setRequestType] = useState<'none' | 'inquiry' | 'order'>('none');
  const form = useForm<z.infer<typeof dealerFormSchema>>({
    resolver: zodResolver(dealerFormSchema),
    defaultValues: {
      contactName: "",
      businessName: "",
      email: "",
      confirmEmail: "",
      phone: "",
      quantityCans: "5",
    },
  });

  async function onSubmit(values: z.infer<typeof dealerFormSchema>) {
    if (requestType === 'order' && !values.quantityCans) {
      toast({ title: "Quantity Required", description: "Please select the number of DubDubs for your order.", variant: "destructive" });
      return;
    }
    const fflInput = document.getElementById("fflUpload") as HTMLInputElement | null;
    const selectedFile = fflInput?.files?.[0] || null;
    const fflName = selectedFile?.name || "No file attached";
    if (requestType === 'order' && !selectedFile) {
      toast({ title: "FFL / SOT Required", description: "Please attach your SOT file before submitting.", variant: "destructive" });
      return;
    }
    try {
      let fileBase64: string | undefined;
      if (selectedFile) fileBase64 = await processImage(selectedFile);
      const resp = await fetch('/api/dealer-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values, confirmEmail: undefined,
          requestType: requestType === 'inquiry' ? 'Dealer Inquiry' : 'Dealer Order',
          fflFileName: fflName, fflFileData: fileBase64,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (data?.error === 'demo_already_ordered') {
          toast({ title: "Demo Can Already Ordered", description: data.message || "Demo can limit of 1 per dealer has been fulfilled. Please place future orders in multiples of 5.", variant: "destructive" });
          return;
        }
        if (data?.error === 'invalid_quantity') {
          toast({ title: "Invalid Quantity", description: data.message || "Dealer orders must be 1 (demo can) or a multiple of 5.", variant: "destructive" });
          return;
        }
        toast({ title: "Request Failed", description: data?.error || "Could not send request. Please try again.", variant: "destructive" });
        return;
      }
      toast({
        title: requestType === 'inquiry' ? "Inquiry Sent" : "Request Sent",
        description: requestType === 'inquiry' ? "We've received your inquiry and will respond by email shortly." : "Invoice request received. We'll follow up by email shortly.",
        className: "bg-orange-500 text-black border-orange-600",
      });
      form.reset({ contactName: "", businessName: "", email: "", confirmEmail: "", phone: "", quantityCans: "5" });
      setRequestType('none');
      if (fflInput) fflInput.value = "";
    } catch {
      toast({ title: "Send Failed", description: "Could not send request. Please try again.", variant: "destructive" });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">
        {requestType === 'none' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">How can we help you today?</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="radio" name="requestType" value="inquiry" onChange={() => setRequestType('inquiry')} className="accent-primary" />
                <span className="text-sm font-medium">I&apos;d like to make an inquiry</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="radio" name="requestType" value="order" onChange={() => setRequestType('order')} className="accent-primary" />
                <span className="text-sm font-medium">I&apos;d like to place an order</span>
              </label>
            </div>
          </div>
        )}
        {requestType !== 'none' && (
          <>
            <button type="button" onClick={() => setRequestType('none')} className="text-xs text-muted-foreground hover:text-primary transition-colors">← Change selection</button>
            <FormField control={form.control} name="contactName" render={({ field }) => (
              <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} className="bg-card border-border focus:border-primary" /></FormControl><FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" /></FormItem>
            )} />
            <FormField control={form.control} name="businessName" render={({ field }) => (
              <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input placeholder="Tactical Solutions LLC" {...field} className="bg-card border-border focus:border-primary" /></FormControl><FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" /></FormControl><FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" /></FormItem>
            )} />
            {form.watch("email").includes("@") && (
              <FormField control={form.control} name="confirmEmail" render={({ field }) => (
                <FormItem><FormLabel>Confirm Email</FormLabel><FormControl><Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" /></FormControl><FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number {requestType === 'inquiry' && <span className="text-xs text-muted-foreground">(optional)</span>}</FormLabel>
                <FormControl><Input placeholder="(555)123-4567" value={field.value} onChange={(e) => field.onChange(formatPhone(e.target.value))} className="bg-card border-border focus:border-primary" /></FormControl>
                <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
              </FormItem>
            )} />
            {requestType === 'order' && (
              <>
                <FormField control={form.control} name="quantityCans" render={({ field }) => (
                  <FormItem><FormLabel>Number of DubDubs</FormLabel><FormControl>
                    <select value={field.value} onChange={field.onChange} className="w-full h-10 rounded-md bg-card border border-border px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="1">1 – Demo Can</option>
                      {[5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100].map((n) => <option key={n} value={String(n)}>{n}</option>)}
                    </select>
                  </FormControl><FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" /></FormItem>
                )} />
                <FileInputZone id="fflUpload" label="SOT Upload" accept=".pdf,.png,.jpg,.jpeg" required={true} description="Accepted: PDF, PNG, JPG/JPEG" />
              </>
            )}
            {requestType === 'inquiry' && (
              <FormField control={form.control} name="message" render={({ field }) => (
                <FormItem><FormLabel>Questions or Comments <span className="text-xs text-muted-foreground">(optional)</span></FormLabel><FormControl><Textarea placeholder="Tell us about your shop, what you're looking for, any questions you have..." rows={3} {...field} className="bg-card border-border focus:border-primary resize-none" /></FormControl><FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" /></FormItem>
              )} />
            )}
            <MotionWrapButton className="w-full">
              <Button type="submit" className="w-full font-display text-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg hover:shadow-xl transition-shadow">
                {requestType === 'inquiry' ? 'SUBMIT INQUIRY' : 'REQUEST INVOICE'}
              </Button>
            </MotionWrapButton>
          </>
        )}
      </form>
    </Form>
  );
}
