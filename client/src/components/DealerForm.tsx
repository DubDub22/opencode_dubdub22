import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const dealerFormSchema = z.object({
  licenseName: z.string().min(2, { message: "License name is required." }),
  tradeName: z.string().min(2, { message: "Trade name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  confirmEmail: z.string().email({ message: "Please confirm your email address." }),
  phone: z.string().min(13, { message: "Phone number is required." }),
  fflNumber: z.string()
    .min(1, { message: "FFL number is required." })
    .regex(/^\d-\d{2}-\d{3}-\d{2}-\d{2}-\d{5}$/, {
      message: "FFL must be in format X-XX-XXX-XX-XX-XXXXX (15 digits, dashes only)."
    }),
  fflName: z.string().min(2, { message: "FFL name is required." }),
  premiseAddress1: z.string().min(5, { message: "Address is required." }),
  premiseCity: z.string().min(2, { message: "City is required." }),
  premiseState: z.string().min(2, { message: "State is required." }),
  premiseZipCode: z.string().min(5, { message: "ZIP code is required." }),
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

const MotionWrapButton = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`inline-block ${className}`}>
    {children}
  </motion.div>
);

export default function DealerForm() {
  const { toast } = useToast();
  const [requestType, setRequestType] = useState<'none' | 'inquiry' | 'order'>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof dealerFormSchema>>({
    resolver: zodResolver(dealerFormSchema),
    defaultValues: {
      licenseName: "",
      tradeName: "",
      email: "",
      confirmEmail: "",
      phone: "",
      fflNumber: "",
      fflName: "",
      premiseAddress1: "",
      premiseCity: "",
      premiseState: "",
      premiseZipCode: "",
      message: "",
    },
  });

  async function onSubmit(values: z.infer<typeof dealerFormSchema>) {
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/dealer-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseName: values.licenseName,
          tradeName: values.tradeName,
          email: values.email,
          phone: values.phone,
          requestType: requestType === 'inquiry' ? 'Dealer Inquiry' : 'Dealer Order',
          fflNumber: values.fflNumber,
          fflName: values.fflName,
          premiseAddress1: values.premiseAddress1,
          premiseCity: values.premiseCity,
          premiseState: values.premiseState,
          premiseZipCode: values.premiseZipCode,
          message: values.message || "",
        }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        toast({
          title: "Request Failed",
          description: data?.error || "Could not send request. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Request Sent",
        description: "Check your spam folder for an email from dubdub22.com.",
        className: "bg-green-600 text-white border-green-700",
      });

      form.reset();
      setRequestType('none');
    } catch {
      toast({
        title: "Send Failed",
        description: "Could not send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
            <button
              type="button"
              onClick={() => setRequestType('none')}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← Change selection
            </button>

            <div className="grid grid-cols-1 gap-4">
              <FormField control={form.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Point of Contact</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )} />

              <FormField control={form.control} name="businessName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl><Input placeholder="Tactical Solutions LLC" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
              </FormItem>
            )} />

            {form.watch("email").includes("@") && (
              <FormField control={form.control} name="confirmEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Email</FormLabel>
                  <FormControl><Input placeholder="john@example.com" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl><Input placeholder="(555)123-4567" value={field.value} onChange={(e) => field.onChange(formatPhone(e.target.value))} className="bg-card border-border focus:border-primary" /></FormControl>
                <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
              </FormItem>
            )} />

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">FFL Information</p>

              <div className="grid grid-cols-1 gap-4">
                <FormField control={form.control} name="fflNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>FFL Number</FormLabel>
                    <FormControl><Input placeholder="X-XX-XXX-XX-XX-XXXXX" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Format: X-XX-XXX-XX-XX-XXXXX (15 digits, dashes only)</p>
                    <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="fflName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>FFL Name</FormLabel>
                    <FormControl><Input placeholder="John's Firearms LLC" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                    <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input placeholder="123 Main St" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4 mt-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input placeholder="Houston" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                    <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl><Input placeholder="TX" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                    <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="zipCode" render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>ZIP Code</FormLabel>
                  <FormControl><Input placeholder="77541" {...field} className="bg-card border-border focus:border-primary" /></FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )} />
            </div>

            {requestType === 'inquiry' && (
              <FormField control={form.control} name="message" render={({ field }) => (
                <FormItem>
                  <FormLabel>Questions or Comments <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl><Textarea placeholder="Tell us about your shop, what you're looking for..." rows={3} {...field} className="bg-card border-border focus:border-primary resize-none" /></FormControl>
                  <FormMessage className="mt-2 inline-block bg-black/80 text-red-300 px-2 py-1 rounded-md font-semibold border border-red-500/40" />
                </FormItem>
              )} />
            )}

            <MotionWrapButton className="w-full">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full font-display text-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg hover:shadow-xl transition-shadow disabled:opacity-60"
              >
                {isSubmitting ? "SENDING..." : requestType === 'inquiry' ? 'SUBMIT INQUIRY' : 'SUBMIT'}
              </Button>
            </MotionWrapButton>
          </>
        )}
      </form>
    </Form>
  );
}
