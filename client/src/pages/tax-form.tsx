import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, PenTool, Upload } from "lucide-react";

export default function TaxFormPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [taxFormOnFile, setTaxFormOnFile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Dealer info (auto-filled from API)
  const [dealerName, setDealerName] = useState("");
  const [dealerContact, setDealerContact] = useState("");
  const [dealerEmail, setDealerEmail] = useState("");
  const [dealerPhone, setDealerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [stateTaxId, setStateTaxId] = useState("");

  const [resaleCertFile, setResaleCertFile] = useState<File | null>(null);
  const [resaleCertDataUrl, setResaleCertDataUrl] = useState("");

  const orderType = searchParams.get("type") || "demo";
  const quantity = searchParams.get("qty") || "1";
  const ffl = searchParams.get("ffl") || "";

  // Fetch dealer profile and auto-fill ALL fields
  useEffect(() => {
    if (!ffl) {
      setTaxFormOnFile(false);
      setLoading(false);
      return;
    }

    fetch(`/api/dealer/profile?ffl=${encodeURIComponent(ffl)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.data) {
          setTaxFormOnFile(false);
          setLoading(false);
          return;
        }

        const d = data.data;

        // Auto-fill ALL dealer info from database (read-only)
        setDealerName(d.tradeName || d.businessName || "");
        setDealerContact(d.licenseName || d.contactName || "");
        setDealerEmail(d.email || "");
        setDealerPhone(d.phone || "");
        setCustomerAddress(d.premiseAddress1 || "");
        setCustomerCity(d.premiseCity || "");
        setCustomerState(d.premiseState || "");
        setCustomerZip(d.premiseZipCode || "");
        setStateTaxId(d.ein || d.stateTaxId || "");

        // Check if tax form already on file
        if (d.hasTaxFormOnFile) {
          setTaxFormOnFile(true);
          // Skip tax form page, go directly to order confirmation
          const params = new URLSearchParams({
            type: orderType,
            qty: quantity,
            ffl: ffl,
          });
          window.location.href = `/order-confirmation?${params.toString()}`;
        } else {
          setTaxFormOnFile(false);
          setLoading(false);
        }
      })
      .catch(() => {
        setTaxFormOnFile(false);
        setLoading(false);
      });
  }, [ffl]);

  // Canvas setup for signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let x, y;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let x, y;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureDataUrl("");
  };

  const handleSubmit = async () => {
    if (!hasSignature) {
      toast({
        title: "Signature Required",
        description: "Please sign the tax form before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (!stateTaxId.trim()) {
      toast({
        title: "State Tax ID Required",
        description: "Please enter your State Tax ID number.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Read resale certificate file if uploaded
      let resaleCertBase64 = "";
      let resaleCertName = "";
      if (resaleCertFile) {
        resaleCertBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(resaleCertFile);
        });
        resaleCertBase64 = resaleCertBase64.split(",")[1]; // Remove data:... prefix
        resaleCertName = resaleCertFile.name;
      }

      // Generate tax form PDF with signature + State Tax ID
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Header
      page.drawText("MULTI-STATE TAX FORM", { x: 50, y: 720, size: 18, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText("Resale Certificate", { x: 50, y: 700, size: 14, font, color: rgb(0, 0, 0) });
      page.drawText(`State: ${customerState}`, { x: 400, y: 720, size: 12, font, color: rgb(0, 0, 0) });

      // Dealer info (auto-filled, read-only)
      page.drawText(`Dealer: ${dealerName}`, { x: 50, y: 650, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Contact: ${dealerContact}`, { x: 50, y: 635, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Email: ${dealerEmail}`, { x: 50, y: 620, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Phone: ${dealerPhone}`, { x: 50, y: 605, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Address: ${customerAddress}, ${customerCity}, ${customerState} ${customerZip}`, { x: 50, y: 590, size: 12, font, color: rgb(0, 0, 0) });

      // State Tax ID (on correct line for their state)
      page.drawText(`State Tax ID: ${stateTaxId}`, { x: 50, y: 560, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(`(State-issued resale certificate number)`, { x: 50, y: 545, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

      // Tax exemption statement
      page.drawText("I hereby certify that the above-named dealer is purchasing tax-free", { x: 50, y: 510, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText("items for resale in the ordinary course of business.", { x: 50, y: 495, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText("This certificate applies to all tax-free purchases from DubDub22.", { x: 50, y: 480, size: 11, font, color: rgb(0, 0, 0) });

      // Signature
      page.drawText("Signature:", { x: 50, y: 430, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      if (signatureDataUrl) {
        const sigImage = await pdfDoc.embedPng(signatureDataUrl.split(",")[1]);
        page.drawImage(sigImage, { x: 50, y: 360, width: 200, height: 60 });
      }
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: 330, size: 12, font, color: rgb(0, 0, 0) });

      // Footer
      page.drawText("DubDub22 / Double T Tactical", { x: 50, y: 100, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
      page.drawText("This document serves as a multi-state tax exemption certificate.", { x: 50, y: 85, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

      // Upload to server (attach to dealer record + FastBound)
      const uploadRes = await fetch("/api/dealer/upload-tax-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ffl: ffl,
          taxFormData: pdfBase64,
          taxFormName: `TaxForm_${dealerName}_${Date.now()}.pdf`,
          stateTaxId: stateTaxId,
          resaleCertData: resaleCertBase64,
          resaleCertName: resaleCertName,
        }),
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload tax form");
      }

      toast({
        title: "Tax Form Submitted",
        description: "Redirecting to order confirmation...",
      });

      // Redirect to order confirmation
      const params = new URLSearchParams({
        type: orderType,
        qty: quantity,
        ffl: ffl,
      });
      window.location.href = `/order-confirmation?${params.toString()}`;
    } catch (err: any) {
      toast({
        title: "Submission Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (taxFormOnFile) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-card border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-display text-center">
                Multi-State Tax Form
              </CardTitle>
              <p className="text-center text-muted-foreground text-sm mt-2">
                Please sign the tax resale certificate to continue
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tax Form Content (Auto-filled, Read-only) */}
              <div className="bg-secondary/10 p-6 rounded-lg space-y-4">
                <h3 className="font-bold text-lg">Resale Certificate</h3>
                <p className="text-sm text-muted-foreground">
                  I hereby certify that the above-named dealer is purchasing tax-free
                  items for resale in the ordinary course of business. This certificate
                  applies to all tax-free purchases from DubDub22.
                </p>

                <Separator className="bg-border" />

                <div className="space-y-2">
                  <p className="text-sm"><strong>Dealer:</strong> <span className="text-muted-foreground">{dealerName}</span></p>
                  <p className="text-sm"><strong>Contact:</strong> <span className="text-muted-foreground">{dealerContact}</span></p>
                  <p className="text-sm"><strong>Email:</strong> <span className="text-muted-foreground">{dealerEmail}</span></p>
                  <p className="text-sm"><strong>Phone:</strong> <span className="text-muted-foreground">{dealerPhone}</span></p>
                  <p className="text-sm">
                    <strong>Address:</strong> <span className="text-muted-foreground">{customerAddress}, {customerCity}, {customerState} {customerZip}</span>
                  </p>
                </div>
              </div>

              {/* State Tax ID (Editable) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  State Tax ID Number ({customerState})
                </label>
                <Input
                  type="text"
                  placeholder={`Enter ${customerState} Tax ID...`}
                  value={stateTaxId}
                  onChange={(e) => setStateTaxId(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your state-issued resale certificate number (not EIN)
                </p>
              </div>

              {/* State Resale Certificate Upload (Optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  State-Issued Resale Certificate (Optional)
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("resaleCertInput")?.click()}>
                  <input
                    id="resaleCertInput"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setResaleCertFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setResaleCertDataUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {resaleCertFile ? (
                    <div className="space-y-1">
                      <p className="text-sm text-green-600 font-medium">{resaleCertFile.name}</p>
                      <p className="text-xs text-muted-foreground">Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Upload your state-issued resale certificate
                      </p>
                      <p className="text-xs text-muted-foreground">PDF, PNG, JPG accepted</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Digital Signature */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Digital Signature
                </label>
                <div className="border-2 border-border rounded-lg p-4 bg-background">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={150}
                    className="w-full cursor-crosshair border border-dashed border-muted-foreground/30 rounded"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-muted-foreground">
                      Sign above using your mouse or touch
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSignature}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !hasSignature || !stateTaxId.trim()}
                className="w-full font-display text-lg bg-primary text-primary-foreground hover:bg-primary/90 h-12"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Tax Form & Continue"
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}
