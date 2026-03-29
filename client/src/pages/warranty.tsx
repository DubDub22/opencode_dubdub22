import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const warrantyFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  confirmEmail: z.string().optional(),
  serialNumber: z.string().min(1, "Serial number is required"),
  description: z.string().min(1, "Please describe the issue"),
});

async function processImage(selectedFile: File | null): Promise<string | undefined> {
  if (!selectedFile) return undefined;
  return new Promise<string>((resolve, reject) => {
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(selectedFile);
    } else {
      resolve(undefined);
    }
  });
}

function FileInputZone({ id, label, accept, capture, required, description }: any) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        {label}
        {description && <span className="text-muted-foreground text-xs">({description})</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="file"
          accept={accept}
          capture={capture}
          required={required}
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
        />
        <label
          htmlFor={id}
          className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-border hover:border-primary cursor-pointer rounded-lg py-3 px-4 transition-colors text-sm text-muted-foreground hover:text-primary"
        >
          <span>{fileName || "Choose file..."}</span>
        </label>
      </div>
    </div>
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

      const resp = await fetch("/api/warranty-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "submit_failed");

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
        <Button type="submit" variant="outline" className="w-full font-display text-lg border-primary text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer shadow-lg hover:shadow-xl transition-shadow">
          SUBMIT WARRANTY CLAIM
        </Button>
      </form>
    </Form>
  );
}

export default function WarrantyPage() {
  const { scrollY } = useScroll();
  const navShadow = useTransform(scrollY, [0, 50], ["none", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
        style={{ boxShadow: navShadow }}
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-display font-bold tracking-wider">DUBDUB22</a>
          <div className="flex gap-3">
            <a href="/dealers" className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors border border-primary/50 px-3 py-1.5 rounded hover:bg-primary hover:text-primary-foreground">Find a Dealer</a>
            <a href="/apply" className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors border border-primary/50 px-3 py-1.5 rounded hover:bg-primary hover:text-primary-foreground">Become a Dealer</a>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="pt-32 pb-16 bg-grid-pattern">
        <div className="container mx-auto px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-display font-bold mb-6"
          >
            WARRANTY SERVICE
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6"
          >
            We stand behind our product. Fill out the form below and we'll get you back up and running.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-primary/5 border border-primary/20 p-4 rounded-lg max-w-2xl mx-auto shadow-sm inline-block"
          >
            <p className="text-sm font-medium text-primary">
              NOTE: Many dealers who are rated as manufacturers will carry replacement sleeves and extra baffles in stock.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Warranty Form & Info */}
      <section className="py-16 bg-secondary/10">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-border bg-background/50 backdrop-blur-md p-6 shadow-2xl">
                <WarrantyForm />
              </Card>
            </motion.div>

            {/* Info */}
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="bg-card border border-border p-6 rounded-lg space-y-4 shadow-lg">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" /> Service Process
                </h3>
                <ul className="space-y-3 list-disc pl-4 marker:text-primary text-sm">
                  <li>We typically respond within <strong>24-48 hours</strong> with mailing instructions.</li>
                  <li>You will need to send the parts needing replacement + a return envelope/box with your address and <strong>adult signature required</strong>.</li>
                  <li>Warranty service is <strong>free</strong>, but you supply the return label.</li>
                </ul>
              </div>

              <div className="bg-card border border-border p-6 rounded-lg space-y-4 shadow-lg">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <ArrowDown className="w-5 h-5 text-primary" /> Important Notes
                </h3>
                <ul className="space-y-3 list-disc pl-4 marker:text-primary text-sm">
                  <li><strong>Missing Baffles:</strong> Include a signed & dated handwritten note explaining why (e.g., ejected down range). Send sleeves without them.</li>
                  <li><strong>Exclusions:</strong> We do not replace the 1/2x28 locknut or stainless steel blast baffles (source elsewhere).</li>
                  <li><strong>Outer Tube (Serialized Part):</strong> Please keep this part; do not mail it. Because the outer tube is the legally serialized component, if it is irreparably damaged or destroyed, it cannot be legally replaced under warranty. You will need to purchase an entirely new suppressor. (Remember: rated for 22LR only!)</li>
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

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
