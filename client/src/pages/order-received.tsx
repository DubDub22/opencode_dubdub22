import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function OrderReceivedPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader variant="home" />
      <main className="container mx-auto px-6 py-24 max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-4">Order Received</h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
            Your order has been submitted. It will be reviewed within 1–2 business days with next steps and your invoice.
          </p>
          <p className="text-sm text-muted-foreground mb-10">
            Check your email for a confirmation. If you don&apos;t see it, check your spam folder.
          </p>
          <Button
            onClick={() => window.location.href = "/"}
            className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            Return to Home
          </Button>
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}
