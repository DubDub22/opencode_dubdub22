import React from "react";
import { motion } from "framer-motion";
import { ArrowDown, Wind, Wrench, Weight, Crosshair } from "lucide-react";
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

const dealerFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  company: z.string().min(2, { message: "Company name is required." }),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});

const warrantyFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  serialNumber: z.string().min(1, { message: "Serial number is required." }),
  description: z.string().min(10, { message: "Please describe the parts needed or missing." }),
  missingParts: z.boolean().default(false),
});

export default function Home() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-display font-bold text-2xl tracking-wider text-primary">DUBDUB22</div>
          <div className="hidden md:flex gap-8 font-sans text-sm font-medium text-muted-foreground">
            <button onClick={() => scrollToSection('features')} className="hover:text-primary transition-colors">FEATURES</button>
            <button onClick={() => scrollToSection('specs')} className="hover:text-primary transition-colors">SPECS</button>
            <button onClick={() => scrollToSection('gallery')} className="hover:text-primary transition-colors">GALLERY</button>
          </div>
          <Button 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-display uppercase tracking-wide hidden sm:flex cursor-pointer"
            onClick={() => scrollToSection('contact')}
          >
            Dealer Inquiries
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16 bg-grid-pattern">
        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-primary font-mono text-sm tracking-[0.2em] mb-4">NEXT GEN 22LR SUPPRESSION</h2>
              <h1 className="text-6xl md:text-8xl font-bold leading-none mb-6">
                DUB DUB <br />
                <span className="text-outline-primary">22</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg font-light leading-relaxed mb-6">
                Fully 3D printed with PPA Carbon Fiber, TPU sleeves, and Stainless Steel blast baffles. Flow-through technology. Lightning fast maintenance. Ready to rock on any host.
              </p>
              
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-2xl font-bold text-primary">MSRP $129</span>
                <span className="text-muted-foreground italic">(found as low as $99!)</span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-wrap gap-4"
            >
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-display text-lg h-14 px-8 cursor-pointer" onClick={() => scrollToSection('features')}>
                Explore Features
              </Button>
              <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary font-display text-lg h-14 px-8 cursor-pointer" onClick={() => scrollToSection('specs')}>
                Technical Specs
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
            className="relative z-10 flex justify-center"
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

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground">
          <ArrowDown size={24} />
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-card/30">
        <div className="container mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl font-bold mb-4">ENGINEERED FOR PERFORMANCE</h2>
            <Separator className="w-24 bg-primary h-1" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Wind className="w-10 h-10 text-primary" />}
              title="Flow-Through"
              description="4x flow-through channels drastically reduce back pressure and keep gas out of your face."
            />
            <FeatureCard 
              icon={<Wrench className="w-10 h-10 text-primary" />}
              title="Easy Maintenance"
              description="Simple clamshell design allows for easy disassembly and cleaning. Components nest perfectly."
            />
            <FeatureCard 
              icon={<Weight className="w-10 h-10 text-primary" />}
              title="Ultra Lightweight"
              description="Weighing in at just 3 ounces, you'll barely notice it's there until you pull the trigger."
            />
            <FeatureCard 
              icon={<Crosshair className="w-10 h-10 text-primary" />}
              title="Full Auto Rated"
              description="Tested up to 60 rounds continuous full auto on rifles. Ready for heavy use."
            />
          </div>
        </div>
      </section>

      {/* Deep Dive / Internals */}
      <section className="py-24 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative order-2 lg:order-1">
              <img 
                src={IMAGES.internals} 
                alt="Internal Clamshell Design" 
                className="rounded-lg border border-border shadow-2xl w-full"
              />
              <img 
                src={IMAGES.exploded} 
                alt="Exploded View" 
                className="absolute -bottom-12 -right-12 w-2/3 rounded-lg border border-border shadow-2xl bg-black hidden md:block"
              />
            </div>
            
            <div className="space-y-8 order-1 lg:order-2">
              <div>
                <h3 className="text-primary font-mono mb-2">THE ANATOMY</h3>
                <h2 className="text-4xl font-bold mb-6">SIMPLE. ROBUST. EFFECTIVE.</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  The Dub Dub 22 features a unique two-piece clamshell design where components nest securely in slots. This entire assembly slips effortlessly into the outer tube.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">PPA CF Sleeve & Baffles</h4>
                    <p className="text-muted-foreground">High-strength Carbon Fiber reinforced PPA for durability and heat resistance.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Stainless Steel Blast Baffles</h4>
                    <p className="text-muted-foreground">Critical first-stage baffling made from stainless steel to handle the initial blast.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Universal Mounting</h4>
                    <p className="text-muted-foreground">Uses a standard 1/2x28 AR15 lock nut for threading onto any 22LR host.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specs Section */}
      <section id="specs" className="py-24 bg-secondary/20">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
             <div>
                <h2 className="text-4xl font-bold mb-8">TECHNICAL SPECIFICATIONS</h2>
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <SpecRow label="Caliber" value="22LR" />
                  <SpecRow label="Weight" value="~3.0 oz" />
                  <SpecRow label="Length" value="Standard Compact" />
                  <SpecRow label="Diameter" value="Standard Rimfire" />
                  <SpecRow label="Thread Pitch" value="1/2 x 28" />
                  <SpecRow label="Tube and Baffles" value="PPA Carbon Fiber" />
                  <SpecRow label="Blast Baffles" value="Stainless Steel" />
                  <SpecRow label="Sleeves (2x)" value="TPU (Rubberlike)" />
                  <SpecRow label="Full Auto Rated" value="Yes (Rifle)" />
                  <SpecRow label="Maintenance" value="User Serviceable" />
                </div>
             </div>
             <div className="flex justify-center items-center relative">
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
                <img 
                  src={IMAGES.topDown} 
                  alt="Top Down View showing flow through" 
                  className="max-w-full h-auto drop-shadow-[0_0_50px_rgba(0,255,255,0.15)]"
                />
             </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="py-24 text-center">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold mb-6">READY TO ROCK</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            Experience the silence. The Dub Dub 22 offers sound suppression comparable to top-tier market leaders.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 h-80 md:h-64">
             <div className="relative group overflow-hidden rounded-lg border border-border">
                <img src={IMAGES.topAngled} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Gallery 1" />
             </div>
             <div className="relative group overflow-hidden rounded-lg border border-border md:col-span-2">
                <img src={IMAGES.fullSide} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Gallery 2" />
             </div>
          </div>
        </div>
      </section>

      {/* Dealer Inquiry Section */}
      <section id="contact" className="py-24 bg-card/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20"></div>
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold">BECOME A DEALER</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Interested in stocking the Dub Dub 22? We offer ULTRA competitive dealer pricing and fully functional dealer samples on the house (you cover shipping).
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3 text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="font-medium">Standard Dealer Pricing</span>
                </div>
                <div className="flex items-center gap-3 text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="font-medium">Volume Discounts</span>
                </div>
                <div className="flex items-center gap-3 text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="font-medium">Fast Shipping</span>
                </div>
              </div>
            </div>

            <Card className="border-border bg-background/50 backdrop-blur-sm p-6 shadow-2xl">
               <DealerForm />
            </Card>
          </div>
        </div>
      </section>

      {/* Warranty Section */}
      <section id="warranty" className="py-24 bg-secondary/10 relative border-t border-border/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">WARRANTY SERVICE</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We stand behind our product. Fill out the form below and we'll get you back up and running.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="order-2 md:order-1">
               <Card className="border-border bg-background/50 backdrop-blur-sm p-6 shadow-2xl">
                 <WarrantyForm />
               </Card>
            </div>
            
            <div className="space-y-6 text-sm text-muted-foreground order-1 md:order-2">
              <div className="bg-card border border-border p-6 rounded-lg space-y-4">
                <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" /> Service Process
                </h3>
                <ul className="space-y-3 list-disc pl-4 marker:text-primary">
                  <li>We typically respond within <strong>24-48 hours</strong> with mailing instructions.</li>
                  <li>You will need to send the parts needing replacement + a return envelope/box with your address and <strong>adult signature required</strong>.</li>
                  <li>Warranty service is <strong>free</strong>, but you supply the return label.</li>
                </ul>
              </div>

              <div className="bg-card border border-border p-6 rounded-lg space-y-4">
                <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
                  <ArrowDown className="w-5 h-5 text-primary" /> Important Notes
                </h3>
                <ul className="space-y-3 list-disc pl-4 marker:text-primary">
                  <li><strong>Missing Baffles:</strong> Include a signed & dated handwritten note explaining why (e.g., ejected down range). Send sleeves without them.</li>
                  <li><strong>Exclusions:</strong> We do not replace the 1/2x28 locknut or stainless steel blast baffles (source elsewhere).</li>
                  <li><strong>Outer Tube:</strong> Keep unless damaged. If damaged, a <strong>$75 fee</strong> applies (check mailed with tube). (psst this means don't try putting this on your AR15! she's rated for 22LR, and no, before you ask, not .22Mag either)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-card/50">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-display font-bold tracking-wider">DUBDUB22.COM</div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Dub Dub 22. All rights reserved. 
            <br className="md:hidden"/> Designed for enthusiasts, by enthusiasts.
          </p>
        </div>
      </footer>
    </div>
  );
}

function DealerForm() {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof dealerFormSchema>>({
    resolver: zodResolver(dealerFormSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      message: "",
    },
  });

  function onSubmit(values: z.infer<typeof dealerFormSchema>) {
    toast({
      title: "Inquiry Sent",
      description: "Thanks for reaching out! We'll be in touch shortly.",
    });
    console.log(values);
    form.reset();
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
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company / FFL</FormLabel>
              <FormControl>
                <Input placeholder="Tactical Solutions LLC" {...field} className="bg-card border-border focus:border-primary" />
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
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Tell us about your shop..." 
                  className="min-h-[100px] bg-card border-border focus:border-primary" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-display text-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
          SEND INQUIRY
        </Button>
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
      serialNumber: "",
      description: "",
    },
  });

  function onSubmit(values: z.infer<typeof warrantyFormSchema>) {
    toast({
      title: "Warranty Request Received",
      description: "We'll verify your details and send instructions within 24-48 hours.",
    });
    console.log(values);
    form.reset();
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
        <FormField
          control={form.control}
          name="serialNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serial Number</FormLabel>
              <FormControl>
                <Input placeholder="SN-12345" {...field} className="bg-card border-border focus:border-primary" />
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
        <Button type="submit" variant="outline" className="w-full font-display text-lg border-primary text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer">
          SUBMIT WARRANTY CLAIM
        </Button>
      </form>
    </Form>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors duration-300 group">
      <CardContent className="pt-6">
        <div className="mb-4 p-3 rounded-full bg-secondary w-fit group-hover:bg-primary/20 transition-colors duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function SpecRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-4 px-6 border-b border-border/50 last:border-0 hover:bg-secondary/50 transition-colors">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="font-bold text-foreground text-right">{value}</span>
    </div>
  );
}
