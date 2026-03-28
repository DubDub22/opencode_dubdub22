import React, { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, Wind, Wrench, Feather, Crosshair, UploadCloud } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Asset Imports
import fullSide from "@assets/Screenshot 2025-11-25 at 2.00.44 AM_1764054189439.png";
import topDown from "@assets/Screenshot 2025-11-25 at 1.58.38 AM_1764054189441.png";
import internals from "@assets/Screenshot 2025-11-25 at 1.56.59 AM_1764054189440.png";
import exploded from "@assets/Screenshot 2025-11-25 at 1.55.28 AM_1764054189440.png";
import topAngled from "@assets/Screenshot 2025-11-25 at 1.52.23 AM_1764054189441.png";

const IMAGES = {
  fullSide,
  topDown,
  internals,
  exploded,
  topAngled,
};

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
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
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

const warrantyFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  confirmEmail: z.string().email({ message: "Please confirm your email address." }),
  serialNumber: z.string().min(1, { message: "Serial number is required." }),
  description: z.string().min(10, { message: "Please describe the parts needed or missing." }),
  missingParts: z.boolean().default(false),
}).refine((data) => data.email === data.confirmEmail, {
  message: "Email addresses must match.",
  path: ["confirmEmail"],
});

// Framer Motion Variants
const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    }
  }
};

const featureStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    }
  }
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

const fadeSlideLeftItem = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

const scaleFadeItem = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } }
};

// Extracted UI Components for reuse / readability
function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div variants={fadeUpItem}>
      <Card className="bg-card border-border hover:border-primary/50 shadow-lg hover:shadow-2xl transition-all duration-300 group">
        <CardContent className="pt-6">
          <div className="mb-4 p-3 rounded-full bg-secondary w-fit group-hover:bg-primary/20 transition-colors duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm group-hover:shadow-md">
            {icon}
          </div>
          <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-muted-foreground leading-relaxed">
            {description}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SpecRow({ label, value }: { label: string, value: string }) {
  return (
    <motion.div variants={fadeSlideLeftItem} className="relative overflow-hidden group">
      <div className="flex justify-between items-center py-4 px-6 border-b border-border/50 last:border-0 hover:bg-secondary/50 transition-colors relative z-10">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold text-foreground text-right">{value}</span>
      </div>
      {/* Subtle highlight sweep */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-in-out z-0 pointer-events-none" />
    </motion.div>
  );
}

const MotionWrapButton = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`inline-block ${className}`}>
    {children}
  </motion.div>
);

function FileInputZone({ id, label, accept, capture, required, description }: any) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const input = document.getElementById(id) as HTMLInputElement;
    if (input && !input.value) {
      setFileName(null);
    }
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



function DealerForm() {
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
    // Validate based on request type
    if (requestType === 'order' && !values.quantityCans) {
      toast({
        title: "Quantity Required",
        description: "Please select the number of DubDubs for your order.",
        variant: "destructive",
      });
      return;
    }

    const fflInput = document.getElementById("fflUpload") as HTMLInputElement | null;
    const selectedFile = fflInput?.files?.[0] || null;
    const fflName = selectedFile?.name || "No file attached";

    if (requestType === 'order' && !selectedFile) {
      toast({
        title: "FFL / SOT Required",
        description: "Please attach your SOT file before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      let fileBase64: string | undefined;
      if (selectedFile) {
        fileBase64 = await processImage(selectedFile);
      }

      const resp = await fetch('/api/dealer-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          confirmEmail: undefined,
          requestType: requestType === 'inquiry' ? 'Dealer Inquiry' : 'Dealer Order',
          fflFileName: fflName,
          fflFileData: fileBase64,
        }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        if (data?.error === 'demo_already_ordered') {
          toast({
            title: "Demo Can Already Ordered",
            description: data.message || "Demo can limit of 1 per dealer has been fulfilled. Please place future orders in multiples of 5.",
            variant: "destructive",
          });
          return;
        }
        if (data?.error === 'must_be_multiple_of_5') {
          toast({
            title: "Order Must Be Multiple of 5",
            description: data.message || "After your demo can, subsequent orders must be in multiples of 5 units.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Request Failed",
          description: data?.error || "Could not send request. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: requestType === 'inquiry' ? "Inquiry Sent" : "Request Sent",
        description: requestType === 'inquiry'
          ? "We've received your inquiry and will respond by email shortly."
          : "Invoice request received. We'll follow up by email shortly.",
        className: "bg-orange-500 text-black border-orange-600",
      });

      form.reset({
        contactName: "",
        businessName: "",
        email: "",
        confirmEmail: "",
        phone: "",
        quantityCans: "5",
      });
      setRequestType('none');
      if (fflInput) fflInput.value = "";
    } catch (err) {
      toast({
        title: "Send Failed",
        description: "Could not send request. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">
        {/* Step 1: Intent Selection */}
        {requestType === 'none' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">How can we help you today?</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="requestType"
                  value="inquiry"
                  onChange={() => setRequestType('inquiry')}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">I&apos;d like to make an inquiry</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="requestType"
                  value="order"
                  onChange={() => setRequestType('order')}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">I&apos;d like to place an order</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Form Fields (shown after selection) */}
        {requestType !== 'none' && (
          <>
            <button
              type="button"
              onClick={() => setRequestType('none')}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← Change selection
            </button>

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} className="bg-card border-border focus:border-primary" />
                  </FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Tactical Solutions LLC" {...field} className="bg-card border-border focus:border-primary" />
                  </FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" />
                  </FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
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
                      <Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" />
                    </FormControl>
                    <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number {requestType === 'inquiry' && <span className="text-xs text-muted-foreground">(optional)</span>}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="(555)123-4567"
                      value={field.value}
                      onChange={(e) => field.onChange(formatPhone(e.target.value))}
                      className="bg-card border-border focus:border-primary"
                    />
                  </FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )}
            />

            {/* Order-only fields */}
            {requestType === 'order' && (
              <>
                <FormField
                  control={form.control}
                  name="quantityCans"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of DubDubs</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          className="w-full h-10 rounded-md bg-card border border-border px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="1">1 – Demo Can</option>
                          {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((n) => (
                            <option key={n} value={String(n)}>{n}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                    </FormItem>
                  )}
                />
                <FileInputZone id="fflUpload" label="SOT Upload" accept=".pdf,.png,.jpg,.jpeg" required={true} description="Accepted: PDF, PNG, JPG/JPEG" />
              </>
            )}

            {/* Inquiry-only field */}
            {requestType === 'inquiry' && (
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Questions or Comments <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us about your shop, what you're looking for, any questions you have..."
                        rows={3}
                        {...field}
                        className="bg-card border-border focus:border-primary resize-none"
                      />
                    </FormControl>
                    <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                  </FormItem>
                )}
              />
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

function WarrantyForm() {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof warrantyFormSchema>>({
    resolver: zodResolver(warrantyFormSchema),
    defaultValues: {
      name: "",
      email: "",
      confirmEmail: "",
      serialNumber: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof warrantyFormSchema>) {
    try {
      const serialPhotoInput = document.getElementById("serialPhotoUpload") as HTMLInputElement | null;
      const damagePhoto1Input = document.getElementById("damagePhoto1Upload") as HTMLInputElement | null;
      const damagePhoto2Input = document.getElementById("damagePhoto2Upload") as HTMLInputElement | null;

      const serialPhotoData = await processImage(serialPhotoInput?.files?.[0] || null);
      const damagePhoto1Data = await processImage(damagePhoto1Input?.files?.[0] || null);
      const damagePhoto2Data = await processImage(damagePhoto2Input?.files?.[0] || null);

      const payload = {
        ...values,
        confirmEmail: undefined,
        serialPhotoName: serialPhotoInput?.files?.[0]?.name,
        serialPhotoData,
        damagePhoto1Name: damagePhoto1Input?.files?.[0]?.name,
        damagePhoto1Data,
        damagePhoto2Name: damagePhoto2Input?.files?.[0]?.name,
        damagePhoto2Data,
      };

      const resp = await fetch('/api/warranty-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || 'submit_failed');

      toast({
        title: "Warranty Request Received",
        description: "We'll verify your details and send instructions within 24-48 hours.",
        className: "bg-orange-500 text-black border-orange-600",
      });
      form.reset();
    } catch (err) {
      toast({
        title: "Send Failed",
        description: "Could not send warranty request. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} className="bg-card border-border focus:border-primary" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" />
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
                  <Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="serialNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serial Number</FormLabel>
              <FormControl>
                <Input placeholder="DDXXXXXX" {...field} className="bg-card border-border focus:border-primary" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description of Issue / Missing Parts</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Please describe what happened and list any missing parts..."
                  className="min-h-[100px] bg-card border-border focus:border-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-6 pt-2">
          <FileInputZone id="serialPhotoUpload" label="Serialized Area Photo" accept="image/*" capture="environment" description="optional" />
          <FileInputZone id="damagePhoto1Upload" label="Damage Photo 1" accept="image/*" capture="environment" description="optional" />
          <FileInputZone id="damagePhoto2Upload" label="Damage Photo 2" accept="image/*" capture="environment" description="optional" />
        </div>
        <MotionWrapButton className="w-full">
          <Button type="submit" variant="outline" className="w-full font-display text-lg border-primary text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer shadow-lg hover:shadow-xl transition-shadow">
            SUBMIT WARRANTY CLAIM
          </Button>
        </MotionWrapButton>
      </form>
    </Form>
  );
}

export default function Home() {
  const { scrollY } = useScroll();
  const navShadow = useTransform(scrollY, [0, 50], ["none", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"]);
  const heroImageY = useTransform(scrollY, [0, 800], [0, 150]);
  const arrowOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Navigation */}
      <motion.nav
        initial={{ y: "-100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ boxShadow: navShadow }}
        className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5"
      >
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-display font-bold text-2xl tracking-wider text-primary drop-shadow-sm">DUBDUB22</div>
          <div className="hidden md:flex gap-8 font-sans text-sm font-medium text-muted-foreground">
            <button onClick={() => scrollToSection('features')} className="group relative hover:text-primary transition-colors py-1">
              FEATURES
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary transition-all duration-300 group-hover:w-full"></span>
            </button>
            <button onClick={() => scrollToSection('specs')} className="group relative hover:text-primary transition-colors py-1">
              SPECS
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary transition-all duration-300 group-hover:w-full"></span>
            </button>
            <button onClick={() => scrollToSection('gallery')} className="group relative hover:text-primary transition-colors py-1">
              GALLERY
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary transition-all duration-300 group-hover:w-full"></span>
            </button>
          </div>
          <MotionWrapButton className="hidden sm:flex">
            <Button
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-display uppercase tracking-wide cursor-pointer"
              onClick={() => scrollToSection('contact')}
            >
              Dealer Inquiries
            </Button>
          </MotionWrapButton>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16 bg-grid-pattern overflow-hidden">
        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="space-y-8 z-10"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.h2 variants={fadeUpItem} className="text-primary font-mono text-sm tracking-[0.2em] mb-4">NEXT GEN 22LR SUPPRESSION</motion.h2>
            <motion.h1 variants={fadeUpItem} className="text-6xl md:text-8xl font-bold leading-none mb-6 whitespace-nowrap">
              DUBDUB<span className="text-outline-primary">22</span>
            </motion.h1>
            <motion.p variants={fadeUpItem} className="text-xl text-muted-foreground max-w-lg font-light leading-relaxed mb-6">
              3D printed with PPA-CF (Engineering Grade), TPU sleeves, and Stainless Steel blast baffles. Pressure-release technology. Lightning fast maintenance. Ready to rock on any host.
            </motion.p>

            <motion.div variants={fadeUpItem} className="flex items-baseline gap-3 mb-2">
              <span className="text-2xl font-bold text-primary drop-shadow-sm">MSRP $129</span>
            </motion.div>

            <motion.div
              variants={fadeUpItem}
              className="flex flex-wrap gap-4"
            >
              <MotionWrapButton>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-display text-lg h-14 px-8 cursor-pointer shadow-lg hover:shadow-primary/20 transition-shadow" onClick={() => scrollToSection('features')}>
                  Explore Features
                </Button>
              </MotionWrapButton>
              <MotionWrapButton>
                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary font-display text-lg h-14 px-8 cursor-pointer hover:shadow-md transition-shadow" onClick={() => scrollToSection('specs')}>
                  Technical Specs
                </Button>
              </MotionWrapButton>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.6, duration: 0.8, type: "spring", bounce: 0.4 }}
            className="relative z-10 flex justify-center"
            style={{ y: heroImageY }}
          >
            <div className="relative w-full max-w-[500px] aspect-[9/16] md:aspect-square">
              <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full" />
              <img
                src={IMAGES.fullSide}
                alt="Dub Dub 22 Suppressor"
                className="relative w-full h-full object-contain drop-shadow-2xl"
              />
            </div>
          </motion.div>
        </div>

        <motion.div
          style={{ opacity: arrowOpacity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-muted-foreground"
        >
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ArrowDown size={24} />
          </motion.div>
        </motion.div>
      </section>

      <div className="h-16 bg-gradient-to-b from-transparent via-background/50 to-transparent pointer-events-none" />

      {/* Main Video */}
      <motion.section
        className="py-12 bg-background"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="rounded-lg overflow-hidden border border-border shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-black">
            <div className="relative" style={{ paddingTop: '56.25%' }}>
              <iframe
                src="https://player.vimeo.com/video/1169362105"
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="DubDub Main Video"
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-card/30">
        <motion.div
          className="container mx-auto px-6"
          variants={featureStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div variants={fadeUpItem} className="mb-16">
            <h2 className="text-4xl font-bold mb-4">ENGINEERED FOR PERFORMANCE</h2>
            <Separator className="w-24 bg-primary h-1" />
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Wind className="w-10 h-10 text-primary drop-shadow-sm" />}
              title="Pressure Release"
              description="4x pressure-release channels drastically reduce back pressure and keep gas out of your face."
            />
            <FeatureCard
              icon={<Wrench className="w-10 h-10 text-primary drop-shadow-sm" />}
              title="Easy Maintenance"
              description="Simple clamshell design allows for easy disassembly and cleaning. Components nest perfectly."
            />
            <FeatureCard
              icon={<Feather className="w-10 h-10 text-primary drop-shadow-sm" />}
              title="Ultra Lightweight"
              description="Weighing in at just 4 oz, you'll barely notice it's there until you pull the trigger."
            />
            <FeatureCard
              icon={<Crosshair className="w-10 h-10 text-primary drop-shadow-sm" />}
              title="Full Auto Rated"
              description="Tested up to 60 rounds continuous full auto on rifles. Ready for heavy use."
            />
          </div>
        </motion.div>
      </section>

      <div className="h-16 bg-gradient-to-b from-transparent via-background/50 to-transparent pointer-events-none" />

      {/* Deep Dive / Internals */}
      <motion.section
        className="py-24 overflow-hidden"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative order-2 lg:order-1 flex justify-center items-center h-full min-h-[400px]">
              <img
                src={IMAGES.exploded}
                alt="Internal Clamshell Design"
                className="w-full max-w-[350px] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              />
            </div>

            <motion.div
              className="space-y-8 order-1 lg:order-2"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              <motion.div variants={fadeUpItem}>
                <h3 className="text-primary font-mono mb-2">THE ANATOMY</h3>
                <h2 className="text-4xl font-bold mb-6">SIMPLE. ROBUST. EFFECTIVE.</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  The Dub Dub 22 features a unique two-piece clamshell design where components nest securely in slots. This entire assembly slips effortlessly into the outer tube.
                </p>
              </motion.div>

              <div className="space-y-4">
                <motion.div variants={fadeUpItem} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">PPA CF Sleeve & Baffles</h4>
                    <p className="text-muted-foreground">High-strength Carbon Fiber reinforced PPA for durability and heat resistance.</p>
                  </div>
                </motion.div>
                <motion.div variants={fadeUpItem} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Stainless Steel Blast Baffles</h4>
                    <p className="text-muted-foreground">Critical first-stage baffling made from stainless steel to handle the initial blast.</p>
                  </div>
                </motion.div>
                <motion.div variants={fadeUpItem} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Universal Mounting</h4>
                    <p className="text-muted-foreground">Uses a standard 1/2x28 AR15 lock nut for threading onto any 22LR host.</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Specs Section */}
      <section id="specs" className="py-24 bg-secondary/20 relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-background/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              <h2 className="text-4xl font-bold mb-8 drop-shadow-sm">TECHNICAL SPECIFICATIONS</h2>
              <motion.div
                className="bg-card rounded-lg border border-border overflow-hidden shadow-xl"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
              >
                <SpecRow label="Caliber" value="22LR" />
                <SpecRow label="Weight" value="~4.0 oz" />
                <SpecRow label="Length" value="4.7 inches" />
                <SpecRow label="Diameter" value="1.776&quot;" />
                <SpecRow label="Thread Pitch" value="1/2 x 28" />
                <SpecRow label="Tube and Baffles" value="PPA-CF (Engineering Grade)" />
                <SpecRow label="Blast Baffles" value="Stainless Steel" />
                <SpecRow label="Sleeves (2x)" value="TPU (Rubberlike)" />
                <SpecRow label="Full Auto Rated" value="Yes (Rifle)" />
                <SpecRow label="Maintenance" value="User Serviceable" />
              </motion.div>
            </motion.div>
            <motion.div
              className="flex justify-center items-center relative"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
              <img
                src={IMAGES.topDown}
                alt="Top Down View showing pressure release channels"
                className="max-w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <div className="h-16 bg-gradient-to-b from-transparent via-background/50 to-transparent pointer-events-none" />

      {/* Gallery */}
      <section id="gallery" className="py-24 text-center">
        <motion.div
          className="container mx-auto px-6"
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.h2 variants={fadeUpItem} className="text-4xl font-bold mb-6">READY TO ROCK</motion.h2>
          <motion.p variants={fadeUpItem} className="text-xl text-muted-foreground max-w-2xl mx-auto">
            DubDub22 delivers sound suppression that easily rivals top-tier market leaders. We deal suppressors for a living, and we have honestly never shot a quieter suppressor.
          </motion.p>
        </motion.div>
      </section>

      <div className="h-16 bg-gradient-to-b from-transparent via-background/50 to-transparent pointer-events-none" />

      {/* Dealer Inquiry Section */}
      <motion.section
        id="contact"
        className="py-24 bg-card/30 relative overflow-hidden"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20"></div>
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12">
            <motion.div variants={fadeUpItem} className="space-y-6 text-center md:text-left flex flex-col justify-center">
              <h2 className="text-4xl font-bold drop-shadow-sm">DEALER FORM</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Interested in carrying DubDub22 suppressors? Fill out the form and we&apos;ll be in touch.
              </p>
            </motion.div>

            <motion.div variants={fadeUpItem}>
              <Card className="border-border bg-background/50 backdrop-blur-md p-6 shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-shadow duration-500 focus-within:ring-1 focus-within:ring-black/10 focus-within:-translate-y-1">
                <DealerForm />
              </Card>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Warranty Section */}
      <motion.section
        id="warranty"
        className="py-24 bg-secondary/10 relative border-t border-border/30"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div variants={fadeUpItem} className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">WARRANTY SERVICE</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              We stand behind our product. Fill out the form below and we'll get you back up and running.
            </p>
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg max-w-2xl mx-auto shadow-sm">
              <p className="text-sm font-medium text-primary">
                NOTE: Many dealers who are rated as manufacturers will carry replacement sleeves and extra baffles in stock.
              </p>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <motion.div variants={fadeUpItem} className="order-2 md:order-1">
              <Card className="border-border bg-background/50 backdrop-blur-md p-6 shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-shadow duration-500 focus-within:ring-1 focus-within:ring-black/10 focus-within:-translate-y-1">
                <WarrantyForm />
              </Card>
            </motion.div>

            <motion.div
              className="space-y-6 text-sm text-muted-foreground order-1 md:order-2"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              <motion.div variants={fadeUpItem} className="bg-card border border-border p-6 rounded-lg space-y-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" /> Service Process
                </h3>
                <ul className="space-y-3 list-disc pl-4 marker:text-primary">
                  <li>We typically respond within <strong>24-48 hours</strong> with mailing instructions.</li>
                  <li>You will need to send the parts needing replacement + a return envelope/box with your address and <strong>adult signature required</strong>.</li>
                  <li>Warranty service is <strong>free</strong>, but you supply the return label.</li>
                </ul>
              </motion.div>

              <motion.div variants={fadeUpItem} className="bg-card border border-border p-6 rounded-lg space-y-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                  <ArrowDown className="w-5 h-5 text-primary" /> Important Notes
                </h3>
                <ul className="space-y-3 list-disc pl-4 marker:text-primary">
                  <li><strong>Missing Baffles:</strong> Include a signed & dated handwritten note explaining why (e.g., ejected down range). Send sleeves without them.</li>
                  <li><strong>Exclusions:</strong> We do not replace the 1/2x28 locknut or stainless steel blast baffles (source elsewhere).</li>
                  <li><strong>Outer Tube (Serialized Part):</strong> Please keep this part; do not mail it. Because the outer tube is the legally serialized component, if it is irreparably damaged or destroyed, it cannot be legally replaced under warranty. You will need to purchase an entirely new suppressor. (Remember: rated for 22LR only!)</li>
                </ul>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-card/50">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-display font-bold tracking-wider drop-shadow-sm">DUBDUB22.COM</div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} DubDub22. All rights reserved.
            <br className="md:hidden" /> Designed by shooters, for shooters.
          </p>
        </div>
      </footer>
    </div>
  );
}
