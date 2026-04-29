import React, { useState } from "react";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "wouter";

// Dealer pricing: $60/unit for stocking orders; demo units are informational only (no charge)
const DEALER_PRICE_PER_UNIT = 60.0;
const TAX_RATE = 0.0; // Dealer orders — tax exemption applies via resale certificate

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function OrderConfirmationPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Order details passed from the order page / FFL challenge flow
  const orderType = searchParams.get("type") || "demo"; // "demo" | "stocking"
  const quantity = parseInt(searchParams.get("qty") || "1", 10);
  const dealerName = searchParams.get("dealer") || "Registered Dealer";
  const dealerContact = searchParams.get("contact") || dealerName;
  const dealerEmail = searchParams.get("email") || "";
  const dealerPhone = searchParams.get("phone") || "";
  const customerAddress = searchParams.get("address") || "";
  const customerCity = searchParams.get("city") || "";
  const customerState = searchParams.get("state") || "";
  const customerZip = searchParams.get("zip") || "";

  const [accepted, setAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signatureDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [accepting, setAccepting] = useState(false);

  const unitCount = orderType === "stocking" ? quantity : 1;
  const subtotal = DEALER_PRICE_PER_UNIT * unitCount;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const isStocking = orderType === "stocking";

  async function handleAccept() {
    if (!accepted) {
      toast({
        title: "Terms Required",
        description: "You must accept the Terms and Conditions to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!signatureName.trim()) {
      toast({
        title: "Signature Required",
        description: "Please type your full legal name to sign.",
        variant: "destructive",
      });
      return;
    }

    setAccepting(true);
    try {
      // File data was uploaded to SFTP via /api/dealer-request — no file relay needed here
      const pendingFflFileName = null;
      const pendingFflFileData = null;
      const pendingSotFileName = null;
      const pendingSotFileData = null;

      // Call /api/retail-order with the same shape as the public order form,
      // so the dealer order gets a DB record AND automatic emails sent
      await fetch("/api/retail-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: isStocking ? "order" : "demo",
          contactName: dealerContact,
          businessName: dealerName,
          email: dealerEmail,
          phone: dealerPhone || null,
          message: null,
          quantity: String(unitCount),
          fflFileName: pendingFflFileName,
          fflFileData: pendingFflFileData,
          sotFileName: pendingSotFileName || null,
          sotFileData: pendingSotFileData || null,
          customerAddress: customerAddress || null,
          customerCity: customerCity || null,
          customerState: customerState || null,
          customerZip: customerZip || null,
          termsAccepted: true,
        }),
      });
      // Redirect to order-received page — Tom will review and send invoice manually
      window.location.href = "/order-received";
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setAccepting(false);
    }
  }

  function handleDecline() {
    window.location.href = "/order";
  }

  const step1Done = accepted;
  const step2Done = !!signatureName.trim();
  const [taxFormDone, setTaxFormDone] = useState(false);
  const [taxBusinessName, setTaxBusinessName] = useState(dealerName);
  const [taxAddress, setTaxAddress] = useState(customerAddress);
  const [taxCity, setTaxCity] = useState(customerCity);
  const [taxState, setTaxState] = useState(customerState);
  const [taxZip, setTaxZip] = useState(customerZip);
  const [taxEin, setTaxEin] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const stepsComplete = accepted && signatureName.trim() && taxFormDone;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader variant="home" />

      {/* Sticky CTA banner — visible until both steps are done */}
      {!stepsComplete && (
        <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-3 text-sm font-medium shadow-md">
          <div className="container mx-auto max-w-2xl flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">Next:</span>
            <span className={step1Done ? "line-through opacity-50" : ""}>☐ Read & accept the Terms &amp; Conditions</span>
            <span className="opacity-40 mx-1">›</span>
            <span className={step2Done ? "line-through opacity-50" : ""}>☐ Type your name to sign</span>
            <span className="opacity-40 mx-1">›</span>
            <span className={stepsComplete ? "text-green-300 font-bold" : "opacity-50"}>✓ Click Accept below</span>
          </div>
        </div>
      )}

      <main className="container mx-auto px-6 py-12 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2">Order Review</h1>
          <p className="text-muted-foreground mb-8">
            {isStocking
              ? "Please review your stocking order details and accept the terms to proceed to payment."
              : "Please review your demo request details and accept the terms to proceed."}
          </p>
          <Separator className="mb-10 bg-border" />
        </motion.div>

        {/* Dealer Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border border-border p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-4">Dealer Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Dealer / Business</span>
              <span className="font-medium">{dealerName}</span>
            </div>
            {dealerContact && dealerContact !== dealerName && (
              <div>
                <span className="text-muted-foreground block">Contact</span>
                <span className="font-medium">{dealerContact}</span>
              </div>
            )}
            {dealerEmail && (
              <div>
                <span className="text-muted-foreground block">Email</span>
                <span className="font-medium">{dealerEmail}</span>
              </div>
            )}
            {dealerPhone && (
              <div>
                <span className="text-muted-foreground block">Phone</span>
                <span className="font-medium">{dealerPhone}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-lg border border-border p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium block">DubDub22 Suppressor</span>
                <span className="text-muted-foreground text-xs">
                  NFA-regulated sound suppressor — Class 3
                </span>
              </div>
              <span className="font-medium">{formatCurrency(DEALER_PRICE_PER_UNIT)} each</span>
            </div>

            {isStocking ? (
              <div className="flex justify-between">
                <span>Stocking Order — {quantity} units</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>Demo Unit — 1 unit</span>
                <span>Included</span>
              </div>
            )}

            <Separator className="bg-border" />

            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            {tax > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Sales Tax</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground italic">
              {isStocking
                ? "Invoicing will be sent via Authorize.net. Payment terms are NET 30 from invoice date."
                : "Demo unit pricing will be included on your dealer invoice. No charge at this step."}
            </p>
          </div>
        </motion.div>

        {/* Tax Form Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-lg border border-border p-6 mb-6"
      >
        <h2 className="text-lg font-semibold mb-4">Multi-State Tax Affidavit</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Fill out the tax form below. It will be generated as a PDF and attached to your dealer record.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <label htmlFor="taxBusinessName" className="text-muted-foreground block mb-1">Business Name</label>
            <input
              id="taxBusinessName"
              type="text"
              value={taxBusinessName}
              onChange={(e) => setTaxBusinessName(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <div>
            <label htmlFor="taxEin" className="text-muted-foreground block mb-1">EIN</label>
            <input
              id="taxEin"
              type="text"
              value={taxEin}
              onChange={(e) => setTaxEin(e.target.value)}
              placeholder="XX-XXXXXXX"
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <div>
            <label htmlFor="taxAddress" className="text-muted-foreground block mb-1">Address</label>
            <input
              id="taxAddress"
              type="text"
              value={taxAddress}
              onChange={(e) => setTaxAddress(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <div>
            <label htmlFor="taxCity" className="text-muted-foreground block mb-1">City</label>
            <input
              id="taxCity"
              type="text"
              value={taxCity}
              onChange={(e) => setTaxCity(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <div>
            <label htmlFor="taxState" className="text-muted-foreground block mb-1">State</label>
            <input
              id="taxState"
              type="text"
              value={taxState}
              onChange={(e) => setTaxState(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <div>
            <label htmlFor="taxZip" className="text-muted-foreground block mb-1">Zip Code</label>
            <input
              id="taxZip"
              type="text"
              value={taxZip}
              onChange={(e) => setTaxZip(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground"
            />
          </div>
        </div>
        <Button
          onClick={async () => {
            setGeneratingPdf(true);
            try {
              const res = await fetch("/api/admin/tax-form/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  businessName: taxBusinessName,
                  ein: taxEin,
                  address: taxAddress,
                  city: taxCity,
                  state: taxState,
                  zip: taxZip,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Failed to generate PDF");
              // Download base64 PDF
              const link = document.createElement("a");
              link.href = `data:application/pdf;base64,${data.pdfBase64}`;
              link.download = data.filename || `tax_form_${taxBusinessName}.pdf`;
              link.click();
              setTaxFormDone(true);
              toast({ title: "Success", description: "Tax form PDF generated and downloaded." });
            } catch (err: any) {
              toast({ title: "Error", description: err.message, variant: "destructive" });
            } finally {
              setGeneratingPdf(false);
            }
          }}
          disabled={!taxBusinessName || !taxEin || generatingPdf}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          {generatingPdf ? "Generating PDF..." : "Generate & Download Tax Form PDF"}
        </Button>
      </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-lg border border-border p-6 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4">Terms and Conditions</h2>
          <div className="bg-background rounded-md border border-border p-4 max-h-64 overflow-y-auto text-xs text-muted-foreground space-y-4 mb-4">
            <p>
              <strong className="text-foreground">Important — Read Carefully</strong>
            </p>

            <p>
              By clicking &quot;I Accept&quot; below, you (the &quot;Dealer&quot;) agree to the following terms and
              conditions in connection with your order for DubDub22 suppressors (&quot;Product&quot;) from
              Double T Tactical (&quot;Seller&quot;).
            </p>

            <p>
              <strong className="text-foreground">1. Dealer Representations.</strong> Dealer represents
              and warrants that: (a) Dealer holds a valid Federal Firearms License (FFL) and is
              authorized to deal in NFA-regulated items; (b) all information provided in connection
              with this order is true, accurate, and complete; (c) Dealer will comply with all
              applicable federal, state, and local laws governing the receipt, storage, transfer,
              and sale of the Products.
            </p>

            <p>
              <strong className="text-foreground">2. NFA Compliance.</strong> Dealer acknowledges
              that Products regulated under the National Firearms Act (NFA) may only be transferred
              in accordance with all applicable provisions of the NFA, Title 27 CFR Part 479, and
              any relevant ATF rulings and guidance. Any Form 3 or Form 4 transfer required for
              delivery shall be completed prior to Dealer taking possession of the Product.
            </p>

            <p>
              <strong className="text-foreground">3. Pricing and Payment.</strong> Prices are
              exclusive of all federal, state, and local taxes. Dealer is responsible for all
              applicable taxes unless a valid tax exemption certificate is provided prior to
              invoicing. Seller reserves the right to cancel any order if payment terms are not met.
            </p>

            <p>
              <strong className="text-foreground">4. Shipping and Risk of Loss.</strong> All orders
              are shipped with a flat rate of $10 and insured by shipper. Shipper choice is
              determined by shipper.
            </p>

            <p>
              <strong className="text-foreground">5. Returns and Cancellations.</strong> Stocking
              orders may be cancelled prior to shipment with written notice. NFA items that have
              been transferred to Dealer may not be returned. There is a 20% restocking and
              cancellation fee for all orders cancelled prior to shipment.
            </p>

            <p>
              <strong className="text-foreground">6. Warranty.</strong> All Products are covered
              by Double T Tactical&apos;s limited warranty. Warranty claims must be submitted through
              the official DubDub22 warranty portal at dubdub22.com/warranty. The warranty does
              not cover damage caused by misuse, unauthorized modifications, or failure to follow
              normal maintenance procedures.
            </p>

            <p>
              <strong className="text-foreground">7. Limitation of Liability.</strong> Seller&apos;s
              liability for any claim arising out of or related to the Products shall not exceed
              the purchase price paid by Dealer for the Products. In no event shall Seller be
              liable for any consequential, incidental, or special damages. Seller is not
              responsible for any damages caused by use beyond what the specified limits of the
              DubDub22 suppressor are.
            </p>

            <p>
              <strong className="text-foreground">8. Compliance with Laws.</strong> Dealer agrees
              to comply with all applicable export control laws and regulations, including the
              Export Administration Regulations (&quot;EAR&quot;) and International Traffic in Arms Regulations
              (&quot;ITAR&quot;), as applicable.
            </p>

            <p>
              <strong className="text-foreground">9. Governing Law.</strong> These terms shall be
              governed by and construed in accordance with the laws of the State of Texas, without
              regard to its conflict of law principles. Any dispute arising under these terms shall
              be resolved in the state or federal courts located in Texas.
            </p>

            <p>
              <strong className="text-foreground">10. Entire Agreement.</strong> These terms,
              together with any written addenda or dealer agreements signed by both parties,
              constitute the entire agreement between the parties with respect to the Products and
              supersede all prior representations, discussions, and agreements.
            </p>

            <p className="text-muted-foreground italic">
              Double T Tactical — Floresville, TX — dubdub22.com
            </p>
          </div>

          {/* Acceptance checkbox */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="acceptTerms"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
              className="mt-0.5 cursor-pointer"
            />
            <label htmlFor="acceptTerms" className="text-sm leading-relaxed cursor-pointer select-none">
              I have read and agree to the above Terms and Conditions. I understand that my order
              is subject to review and acceptance by Double T Tactical, and that my FFL and tax
              documentation will be verified prior to shipment.
            </label>
          </div>

          {/* Digital signature */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="signatureName" className="text-sm font-medium block mb-1.5">
                Digital Signature <span className="text-destructive">*</span>
              </label>
              <input
                id="signatureName"
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Type your full legal name"
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                By typing your name above, you agree this constitutes a legally binding digital signature.
              </p>
            </div>
            <div>
              <label htmlFor="signatureDate" className="text-sm font-medium block mb-1.5">
                Date <span className="text-destructive">*</span>
              </label>
              <input
                id="signatureDate"
                type="text"
                value={signatureDate}
                readOnly
                className="w-full h-10 px-3 rounded-md border border-border bg-muted text-sm text-foreground cursor-default"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Date of acceptance (auto-populated).
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action buttons */}
        {!accepted && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-3 mb-4 text-sm text-amber-700 dark:text-amber-400">
            <strong>To continue:</strong> Scroll up, check the Terms acceptance box, and type your name in the Signature field below.
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Button
            variant="outline"
            onClick={handleDecline}
            className="flex-1 h-12 text-base border-border hover:bg-muted/50 cursor-pointer"
          >
            Decline / Go Back
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!accepted || !signatureName.trim() || accepting}
            loading={accepting}
            className="flex-1 h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-lg"
          >
            {isStocking ? "Accept & Proceed to Payment" : "Accept & Submit Demo Request"}
          </Button>
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}
