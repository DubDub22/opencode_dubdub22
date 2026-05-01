import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SiteHeader from "@/components/SiteHeader";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, PenTool, Upload, X } from "lucide-react";

const REG_TYPES = ["Wholesaler", "Retailer", "Manufacturer", "Lessor", "Exempt Organization", "Other"];

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

const TAX_FORM_STATES = [
  "AL","MO","AR","NE","AZ","NV","CA","NJ","CO","NM","CT","NC","FL","ND","GA","OH",
  "HI","OK","ID","PA","IL","RI","IA","SC","KS","SD","KY","TN","ME","TX","MD","UT",
  "MI","VT","MN","WA","WI"
]; // 37 states that have tax ID fields on the form

interface StateTaxEntry {
  state: string;
  taxId: string;
}

export default function TaxFormPage() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dealer info (auto-filled from session)
  const [dealerId, setDealerId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [dealState, setDealState] = useState("");
  const [zip, setZip] = useState("");

  // Tax form fields
  const [regType, setRegType] = useState("");
  const [otherRegType, setOtherRegType] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [stateTaxIds, setStateTaxIds] = useState<StateTaxEntry[]>([]);
  const [selectedState, setSelectedState] = useState("");
  const [selectedTaxId, setSelectedTaxId] = useState("");

  // State tax ID document upload
  const [stateDocFile, setStateDocFile] = useState<File | null>(null);

  // Draw canvas
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Fetch dealer profile from session
    const token = localStorage.getItem("dubdub_token");
    fetch("/api/dealer/auth/me", { headers: { "x-auth-token": token || "" } })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const d = data.dealer;
          setDealerId(d.id);
          setCompanyName(d.businessName || "");
          setAddress([d.businessAddress, d.city, d.state, d.zip].filter(Boolean).join(", "));
          setCity(d.city || "");
          setDealState(d.state || "");
          setZip(d.zip || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext("2d");
    }
    ctxRef.current!.beginPath();
    ctxRef.current!.moveTo(x, y);
    ctxRef.current!.strokeStyle = "#000";
    ctxRef.current!.lineWidth = 2;
    ctxRef.current!.lineCap = "round";
    lastPos.current = { x, y };
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || !ctxRef.current || !lastPos.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
    setHasSignature(true);
  }

  function stopDraw() {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (ctxRef.current) ctxRef.current.closePath();
    if (canvasRef.current) {
      setSignatureDataUrl(canvasRef.current.toDataURL());
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureDataUrl("");
  }

  function addStateTaxId() {
    if (!selectedState || !selectedTaxId.trim()) return;
    if (stateTaxIds.some(s => s.state === selectedState)) {
      toast({ title: "Already added", description: `Tax ID for ${selectedState} already entered`, variant: "destructive" });
      return;
    }
    setStateTaxIds(prev => [...prev, { state: selectedState, taxId: selectedTaxId.trim() }]);
    setSelectedState("");
    setSelectedTaxId("");
  }

  function removeStateTaxId(state: string) {
    setStateTaxIds(prev => prev.filter(s => s.state !== state));
  }

  async function handleSubmit() {
    if (!companyName) { toast({ title: "Missing info", description: "Company name is required", variant: "destructive" }); return; }
    if (!regType) { toast({ title: "Missing info", description: "Select your registration type", variant: "destructive" }); return; }
    if (!hasSignature) { toast({ title: "Missing signature", description: "Please sign the form", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      // If state document uploaded, upload it first
      let stateDocBase64 = "";
      if (stateDocFile) {
        stateDocBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(stateDocFile);
        });
      }

      const token = localStorage.getItem("dubdub_token");
      const resp = await fetch("/api/dealer/tax-form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token || "" },
        body: JSON.stringify({
          dealerId,
          companyName,
          address,
          regType: regType === "Other" ? otherRegType : regType,
          businessDescription,
          stateTaxIds,
          signatureDataUrl,
          stateDocFileName: stateDocFile?.name || null,
          stateDocFileData: stateDocBase64 || null,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        toast({ title: "Tax Form Submitted", description: "Your tax form has been saved and attached to your account." });
        setTimeout(() => window.location.href = "/dealer/dashboard", 1500);
      } else {
        toast({ title: "Error", description: data.error || "Submission failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-3xl font-display font-bold">Multi-State Tax Form</h1>
            <p className="text-muted-foreground mt-1">Complete and sign your resale tax exemption certificate</p>
          </motion.div>

          <div className="space-y-6">
            {/* Firm Info (auto-filled) */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Firm / Buyer Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Company Name</label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Address</label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} className="bg-background" />
                </div>
              </CardContent>
            </Card>

            {/* Registration Type */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Engaged As (Registered)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={regType} onValueChange={setRegType}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select registration type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REG_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {regType === "Other" && (
                  <Input placeholder="Specify other type..." value={otherRegType} onChange={e => setOtherRegType(e.target.value)} className="bg-background" />
                )}
                <div>
                  <label className="text-sm font-medium mb-1 block">Description of Business</label>
                  <Textarea value={businessDescription} onChange={e => setBusinessDescription(e.target.value)} placeholder="e.g. Retail firearms dealer" className="bg-background" rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* State Tax IDs */}
            <Card>
              <CardHeader><CardTitle className="text-lg">State Tax Registration Numbers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the tax ID from your state-issued sales tax permit for each state you need.</p>
                <div className="flex gap-2">
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="bg-background w-32">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_FORM_STATES.filter(s => !stateTaxIds.some(e => e.state === s)).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={selectedTaxId} onChange={e => setSelectedTaxId(e.target.value)} placeholder="Tax ID number" className="bg-background" />
                  <Button variant="outline" onClick={addStateTaxId} disabled={!selectedState || !selectedTaxId.trim()}>Add</Button>
                </div>
                {stateTaxIds.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {stateTaxIds.map(s => (
                      <div key={s.state} className="flex items-center justify-between bg-muted/30 rounded px-3 py-1.5 text-sm">
                        <span><strong>{s.state}</strong>: {s.taxId}</span>
                        <button onClick={() => removeStateTaxId(s.state)} className="text-muted-foreground hover:text-red-400"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* State Tax ID Document Upload */}
            <Card>
              <CardHeader><CardTitle className="text-lg">State-Issued Tax ID Document</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Upload your state-issued sales tax / resale permit document.</p>
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${stateDocFile ? "border-green-500/50 bg-green-500/5" : "border-border hover:border-primary/40 bg-card"}`}>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={e => setStateDocFile(e.target.files?.[0] || null)} />
                  {stateDocFile ? (
                    <span className="text-sm text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {stateDocFile.name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Upload className="w-4 h-4" /> Click to upload (PDF, PNG, JPG)</span>
                  )}
                </label>
              </CardContent>
            </Card>

            {/* Signature */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Signature</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="border border-border rounded-lg bg-white" style={{ touchAction: "none" }}>
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={120}
                    className="w-full rounded-lg cursor-crosshair"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <PenTool className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Sign above with mouse or touch</span>
                  {hasSignature && (
                    <button onClick={clearSignature} className="text-sm text-red-400 hover:underline ml-auto">Clear</button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !hasSignature}
              className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "SUBMIT TAX FORM"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
