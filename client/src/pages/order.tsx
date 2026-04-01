import React, { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadCloud, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import { Separator } from "@/components/ui/separator";

const orderFormSchema = z.object({
  contactName: z.string().min(2, { message: "Name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  confirmEmail: z.string().email({ message: "Please confirm your email address." }),
  phone: z.string().optional(),
  message: z.string().optional(),
}).refine((data) => data.email === data.confirmEmail, {
  message: "Email addresses must match.",
  path: ["confirmEmail"],
});

type IntentType = "info" | "demo" | "order";

const QUANTITY_OPTIONS = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "15", value: "15" },
  { label: "20", value: "20" },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const MotionWrapButton = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`inline-block ${className}`}>
    {children}
  </motion.div>
);

export default function OrderPage() {
  const { toast } = useToast();
  const [intent, setIntent] = useState<IntentType>("info");
  const [quantity, setQuantity] = useState<string>("5");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof orderFormSchema>>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      contactName: "",
      email: "",
      confirmEmail: "",
      phone: "",
      message: "",
    },
  });

  async function onSubmit(values: z.infer<typeof orderFormSchema>) {
    setSubmitting(true);
    try {
      const fflInput = document.getElementById("fflUpload") as HTMLInputElement | null;
      const selectedFile = fflInput?.files?.[0] || null;
      const fflName = selectedFile?.name || null;

      let fileBase64: string | null = null;
      if (selectedFile) {
        const reader = new FileReader();
        fileBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      }

      const isInfo = intent === "info";
      const payload = {
        intent,
        contactName: values.contactName,
        email: values.email,
        phone: values.phone || null,
        message: values.message || null,
        quantity: isInfo ? null : intent === "demo" ? "1" : quantity,
        fflFileName: fflName,
        fflFileData: fileBase64,
      };

      const resp = await fetch("/api/retail-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        toast({
          title: "Submission Failed",
          description: data?.error || "Could not submit. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isInfo ? "Request Received" : "Order Received",
        description: isInfo
          ? "We've received your inquiry and will follow up shortly."
          : "We've received your order and will send an invoice by email shortly.",
        className: "bg-orange-500 text-black border-orange-600",
      });
      setSubmitted(true);
      form.reset();
      setIntent("info");
      setQuantity("5");
      if (fflInput) fflInput.value = "";
    } catch {
      toast({
        title: "Send Failed",
        description: "Could not submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader variant="home" />

      <main className="container mx-auto px-6 py-16 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2">ORDER / INQUIRY</h1>
          <p className="text-muted-foreground mb-8">Select an option below to get started.</p>
          <Separator className="mb-10 bg-border" />
        </motion.div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">

            {/* Intent Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="text-sm font-medium mb-2 block">How can we help you?</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as IntentType)}
                className="w-full h-12 rounded-md bg-card border border-border px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="info">Send Me More Information</option>
                <option value="demo">I want a Demo Can</option>
                <option value="order">I want to place an order</option>
              </select>
            </motion.div>

            {/* Quantity selector — only shown for "order" intent */}
            {intent === "order" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <label className="text-sm font-medium mb-2 block">Number of cans</label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-12 rounded-md bg-card border border-border px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  {QUANTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} cans
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Maximum 20 units per order.</p>
              </motion.div>
            )}

            {/* Name */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} className="bg-card border-border focus:border-primary h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Email */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" type="email" {...field} className="bg-card border-border focus:border-primary h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Confirm Email */}
            {form.watch("email")?.includes("@") && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
              >
                <FormField
                  control={form.control}
                  name="confirmEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" type="email" {...field} className="bg-card border-border focus:border-primary h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}

            {/* Phone — optional for info, required for orders */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Phone {intent === "info" && <span className="text-xs text-muted-foreground">(optional)</span>}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(555) 123-4567"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                        className="bg-card border-border focus:border-primary h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* FFL Upload — only for demo and order */}
            {intent !== "info" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    FFL / SOT Upload
                  </label>
                  <div className="relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors duration-200 border-border bg-card hover:border-primary/30 cursor-pointer h-32 overflow-hidden">
                    <Input
                      id="fflUpload"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="absolute inset-0 w-[200%] h-[200%] -ml-10 -mt-10 opacity-0 cursor-pointer z-50 file:cursor-pointer"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 pointer-events-none">
                      <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Drop your SOT file here, or{" "}
                        <span className="text-primary font-medium">click to browse</span>
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG/JPEG accepted</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Message — only for "info" intent */}
            {intent === "info" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        What would you like to know?{" "}
                        <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about yourself, your needs, any questions you have..."
                          rows={4}
                          {...field}
                          className="bg-card border-border focus:border-primary resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}

            <Separator className="bg-border" />

            {/* Submit */}
            {submitted ? (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span className="font-medium">
                  {intent === "info"
                    ? "Submitted — we'll be in touch shortly."
                    : intent === "demo"
                    ? "Demo request submitted — we'll be in touch."
                    : "Order submitted — invoice incoming shortly."}
                </span>
              </div>
            ) : (
              <MotionWrapButton className="w-full">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full font-display text-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg hover:shadow-xl transition-shadow h-12"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      In Process.....
                    </>
                  ) : intent === "info"
                  ? "SUBMIT"
                  : intent === "demo"
                  ? "REQUEST DEMO CAN"
                  : `REQUEST INVOICE (${quantity} CANS)`}
                </Button>
              </MotionWrapButton>
            )}
          </form>
        </Form>
      </main>
    </div>
  );
}
