import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SiteHeader from "@/components/SiteHeader";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Upload, X, PenTool, ShieldCheck, FileText, ArrowRight, ArrowLeft, Search, AlertTriangle } from "lucide-react";

// ═══ Types ═══════════════════════════════════════════════════════════

interface Step1Data {
  fflNumber: string; companyName: string; licenseName: string; phone: string;
  address: string; city: string; state: string; zip: string; fflExpiry: string;
  ein: string; einType: string; email: string; password: string;
  fflFile: File | null; sotFile: File | null; fflHasSot: boolean;
  fieldsEdited: string[];
}

interface Step2Data {
  regType: string; businessDescription: string; stateTaxIds: {state: string; taxId: string}[];
  signatureDataUrl: string; stateDocFile: File | null;
}

// ═══ Step 1: FFL/SOT Information ══════════════════════════════════════

function Step1FFL({ onNext }: { onNext: (data: Step1Data) => void }) {
  const { toast } = useToast();
  const [fflInput, setFflInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState(false);
  const [edits, setEdits] = useState<Set<string>>(new Set());

  // Auto-populated from ATF CSV
  const [form, setForm] = useState({
    fflNumber: "", companyName: "", licenseName: "", phone: "",
    address: "", city: "", state: "", zip: "", fflExpiry: "",
    ein: "", einType: "3", email: "", password: "",
  });

  // File uploads
  const [fflFile, setFflFile] = useState<File | null>(null);
  const [sotFile, setSotFile] = useState<File | null>(null);
  const [fflHasSot, setFflHasSot] = useState(false);

  function markEdit(field: string) {
    if (found) setEdits(prev => new Set(prev).add(field));
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function lookupFFL() {
    if (!fflInput.trim()) return;
    setLooking(true);
    try {
      const resp = await fetch("/api/ffl/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fflNumber: fflInput.trim() }),
      });
      const data = await resp.json();
      if (data.valid) {
        setForm(prev => ({
          ...prev,
          fflNumber: data.fflLicenseNumber || fflInput,
          companyName: data.tradeName || data.dealerName || "",
          licenseName: data.licenseName || "",
          phone: data.voicePhone || "",
          address: data.premiseAddress1 || "",
          city: data.premiseCity || "",
          state: data.premiseState || "",
          zip: data.premiseZipCode || "",
          fflExpiry: data.fflExpiryDate || "",
          einType: data.einType || "3",
        }));
        setFound(true);
      } else {
        toast({ title: "FFL Not Found", description: "Not in the ATF database. You can still enter info manually.", variant: "destructive" });
        setFound(true); // Still allow proceeding
      }
    } catch {
      toast({ title: "Error", description: "Could not verify FFL. Continue manually.", variant: "destructive" });
      setFound(true);
    } finally {
      setLooking(false);
    }
  }

  function handleNext() {
    if (!form.companyName || !form.fflNumber) {
      toast({ title: "Missing info", description: "Company name and FFL number are required", variant: "destructive" });
      return;
    }
    if (!form.email || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) {
      toast({ title: "Invalid email", description: "A valid email is required", variant: "destructive" });
      return;
    }
    if (!form.password || form.password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (!fflFile && !fflHasSot) {
      toast({ title: "Missing FFL", description: "Please upload your FFL document", variant: "destructive" });
      return;
    }
    if (!fflHasSot && !sotFile) {
      toast({ title: "Missing SOT", description: "Please upload your SOT or check the combined box", variant: "destructive" });
      return;
    }
    onNext({
      ...form,
      fflFile, sotFile, fflHasSot,
      fieldsEdited: Array.from(edits),
    });
  }

  const inputClass = "bg-background border-border";
  const labelClass = "text-sm font-medium mb-1 block";

  return (
    <div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      {/* FFL Lookup */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Search className="w-5 h-5 text-primary" /> FFL Lookup</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={fflInput} onChange={e => setFflInput(e.target.value)} placeholder="Enter FFL number (X-XX-XXX-XX-XX-XXXXX)" className={inputClass} />
            <Button onClick={lookupFFL} disabled={looking} variant="outline" className="shrink-0">
              {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>
          {found && <p className="text-sm text-green-500 mt-2 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Data loaded from ATF database</p>}
        </CardContent>
      </Card>

      {/* Business Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> FFL / Business Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Company Name * {edits.has("companyName") && <AlertTriangle className="w-3 h-3 inline text-yellow-500" />}</label>
            <Input value={form.companyName} onChange={e => { update("companyName", e.target.value); markEdit("companyName"); }} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>License Name {edits.has("licenseName") && <AlertTriangle className="w-3 h-3 inline text-yellow-500" />}</label>
            <Input value={form.licenseName} onChange={e => { update("licenseName", e.target.value); markEdit("licenseName"); }} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>FFL Number *</label>
            <Input value={form.fflNumber} onChange={e => update("fflNumber", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>FFL Expiration {edits.has("fflExpiry") && <AlertTriangle className="w-3 h-3 inline text-yellow-500" />}</label>
            <Input value={form.fflExpiry} onChange={e => { update("fflExpiry", e.target.value); markEdit("fflExpiry"); }} className={inputClass} placeholder="YYYY-MM-DD" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <Input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Password * (min 8 chars)</label>
            <Input type="password" value={form.password} onChange={e => update("password", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>EIN (Federal) *</label>
            <Input value={form.ein} onChange={e => update("ein", e.target.value)} placeholder="XX-XXXXXXX" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>EIN Type * (from FFL type)</label>
            <select value={form.einType} onChange={e => update("einType", e.target.value)} className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="3">3 - Dealer (FFL 01, 02, 09)</option>
              <option value="2">2 - Manufacturer (FFL 07, 10)</option>
              <option value="1">1 - Importer (FFL 08, 11)</option>
            </select>
          </div>
          {found && <p className="text-xs text-muted-foreground">Auto-detected from FFL type in ATF database</p>}
          <div>
            <label className={labelClass}>Address {edits.has("address") && <AlertTriangle className="w-3 h-3 inline text-yellow-500" />}</label>
            <Input value={form.address} onChange={e => { update("address", e.target.value); markEdit("address"); }} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>City {edits.has("city") && <AlertTriangle className="w-3 h-3 inline text-yellow-500" />}</label>
            <Input value={form.city} onChange={e => { update("city", e.target.value); markEdit("city"); }} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State {edits.has("state") && <AlertTriangle className="w-3 h-3 inline text-yellow-500" />}</label>
            <Input value={form.state} onChange={e => { update("state", e.target.value); markEdit("state"); }} className={inputClass} maxLength={2} />
          </div>
          <div>
            <label className={labelClass}>ZIP {edits.has("zip") && <AlertTriangle className="w-3 h-3 inline text-yellow-500" />}</label>
            <Input value={form.zip} onChange={e => { update("zip", e.target.value); markEdit("zip"); }} className={inputClass} maxLength={10} />
          </div>
        </CardContent>
      </Card>

      {/* Document Uploads */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Required Documents</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className={labelClass}>FFL License *</label>
            <FileUpload id="ffl-upload" file={fflFile} setFile={setFflFile} accept=".pdf,.png,.jpg,.jpeg" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={fflHasSot} onChange={e => setFflHasSot(e.target.checked)} className="accent-primary" />
            My FFL has SOT combined on the same page
          </label>
          {!fflHasSot && (
            <div>
              <label className={labelClass}>SOT License *</label>
              <FileUpload id="sot-upload" file={sotFile} setFile={setSotFile} accept=".pdf,.png,.jpg,.jpeg" />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleNext} className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90">
        Next: Tax Form <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}

// ═══ File Upload Helper ══════════════════════════════════════════════

function FileUpload({ id, file, setFile, accept }: { id: string; file: File | null; setFile: (f: File | null) => void; accept: string }) {
  return (
    <label htmlFor={id} className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${file ? "border-green-500/50 bg-green-500/5" : "border-border hover:border-primary/40 bg-card"}`}>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={e => setFile(e.target.files?.[0] || null)} />
      {file ? (
        <span className="text-sm text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {file.name}</span>
      ) : (
        <span className="text-sm text-muted-foreground flex items-center gap-2"><Upload className="w-4 h-4" /> Upload {accept}</span>
      )}
    </label>
  );
}

// ═══ Step 2: Tax Form ════════════════════════════════════════════════

function Step2TaxForm({ data, onBack, onSubmit }: { data: Step1Data; onBack: () => void; onSubmit: (data: Step2Data) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [regType, setRegType] = useState("");
  const [otherRegType, setOtherRegType] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [stateTaxIds, setStateTaxIds] = useState<{state: string; taxId: string}[]>([{state: dealerState, taxId: ""}]);
  const [addingState, setAddingState] = useState("");
  const [addingTaxId, setAddingTaxId] = useState("");
  const [stateDocFile, setStateDocFile] = useState<File | null>(null);

  // Auto-set the dealer's state from FFL lookup
  const dealerState = data.state || "";

  // Drawing handlers
  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    setIsDrawing(true);
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round";
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return; e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;
    canvas.getContext("2d")!.lineTo(x, y); canvas.getContext("2d")!.stroke();
    setHasSignature(true);
  }
  function stopDraw() { setIsDrawing(false); if (canvasRef.current) setSignatureDataUrl(canvasRef.current.toDataURL()); }
  function clearSig() {
    const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasSignature(false); setSignatureDataUrl("");
  }

  return (
    <div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
      {/* Registration Type */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Multi-State Tax Exemption Certificate</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This information will be used to fill your Multi-State Sales &amp; Use Tax Exemption form.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Company Name</label>
              <Input value={data.companyName} disabled className="bg-muted/30" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">State (from FFL)</label>
              <Input value={dealerState} disabled className="bg-muted/30" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Registered As *</label>
            <select value={regType} onChange={e => setRegType(e.target.value)} className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Select type...</option>
              <option value="Wholesaler">Wholesaler</option>
              <option value="Retailer">Retailer</option>
              <option value="Manufacturer">Manufacturer</option>
              <option value="Lessor">Lessor</option>
              <option value="Exempt Organization">Exempt Organization</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {regType === "Other" && (
            <Input placeholder="Specify other..." value={otherRegType} onChange={e => setOtherRegType(e.target.value)} className="bg-background" />
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Description of Business</label>
            <Textarea value={businessDescription} onChange={e => setBusinessDescription(e.target.value)} placeholder="e.g. Retail firearms and accessories dealer" className="bg-background" rows={2} />
          </div>

          {/* State Tax IDs */}
          <div>
            <label className="text-sm font-medium mb-1 block">State Tax Registration Numbers</label>
            <p className="text-xs text-muted-foreground mb-2">Enter the tax ID from your state-issued sales tax permit. Add additional states if you have locations in multiple states.</p>
            
            {stateTaxIds.map((entry, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input value={entry.state} disabled={i === 0} className={`bg-muted/30 w-16 text-center font-bold ${i > 0 ? "bg-background" : ""}`} />
                <Input value={entry.taxId} onChange={e => {
                  const next = [...stateTaxIds];
                  next[i] = {...next[i], taxId: e.target.value};
                  setStateTaxIds(next);
                }} placeholder={`${entry.state} tax ID (e.g. X-XXXXX-XXXX-X)`} className="bg-background" />
                {i > 0 && (
                  <button onClick={() => setStateTaxIds(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 shrink-0"><X className="w-5 h-5" /></button>
                )}
              </div>
            ))}
            
            <div className="flex gap-2 mt-1">
              <select value={addingState} onChange={e => setAddingState(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm w-20">
                <option value="">+</option>
                {["AL","AK","AZ","AR","CO","CT","DE","FL","GA","ID","IL","IN","IA","KS","KY","LA","ME","MD","MI","MN","MS","MO","MT","NE","NV","NH","NM","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","UT","VT","VA","WA","WV","WI","WY"].filter(s => !stateTaxIds.some(e => e.state === s)).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <Input value={addingTaxId} onChange={e => setAddingTaxId(e.target.value)} placeholder="Tax ID for additional state" className="bg-background h-9" />
              <Button variant="outline" size="sm" onClick={() => {
                if (addingState && addingTaxId.trim()) {
                  setStateTaxIds(prev => [...prev, {state: addingState, taxId: addingTaxId.trim()}]);
                  setAddingState(""); setAddingTaxId("");
                }
              }} disabled={!addingState || !addingTaxId.trim()}>Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* State Tax ID Document Upload */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> State-Issued Tax ID Document</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Upload your state-issued sales tax / resale permit.</p>
          <FileUpload id="state-doc" file={stateDocFile} setFile={setStateDocFile} accept=".pdf,.png,.jpg,.jpeg" />
        </CardContent>
      </Card>

      {/* Signature */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><PenTool className="w-5 h-5 text-primary" /> Digital Signature</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="border border-border rounded-lg bg-white" style={{ touchAction: "none" }}>
            <canvas ref={canvasRef} width={500} height={120} className="w-full rounded-lg cursor-crosshair"
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
          </div>
          <div className="flex items-center gap-3">
            <PenTool className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sign above</span>
            {hasSignature && <button onClick={clearSig} className="text-sm text-red-400 hover:underline ml-auto">Clear</button>}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="outline" className="flex-1 font-display"><ArrowLeft className="w-5 h-5 mr-2" /> Back</Button>
        <Button onClick={() => onSubmit({ regType: regType === "Other" ? otherRegType : regType, businessDescription, stateTaxIds: stateTaxIds.filter(s => s.taxId.trim()), signatureDataUrl, stateDocFile })} disabled={!hasSignature || !regType || stateTaxIds.every(s => !s.taxId.trim())} className="flex-1 font-display bg-primary hover:bg-primary/90">
          Submit Registration
        </Button>
      </div>
    </div>
  );
}

// ═══ Main Registration Page ══════════════════════════════════════════

export default function DealerRegistrationWizard() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toBase64(file: File): Promise<string> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(file);
    });
  }

  async function handleFinalSubmit(step2Data: Step2Data) {
    setSubmitting(true);
    try {
      const s1 = step1Data!;
      const fflBase64 = s1.fflFile ? await toBase64(s1.fflFile) : "";
      const sotBase64 = s1.sotFile ? await toBase64(s1.sotFile) : "";
      const stateDocBase64 = step2Data.stateDocFile ? await toBase64(step2Data.stateDocFile) : "";

      const resp = await fetch("/api/dealer/register-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Step 1
          fflNumber: s1.fflNumber, companyName: s1.companyName, licenseName: s1.licenseName,
          phone: s1.phone, address: s1.address, city: s1.city, state: s1.state, zip: s1.zip,
          fflExpiry: s1.fflExpiry, ein: s1.ein, einType: s1.einType,
          email: s1.email, password: s1.password,
          fflFileName: s1.fflFile?.name || null, fflFileData: fflBase64 || null,
          sotFileName: s1.sotFile?.name || null, sotFileData: sotBase64 || null,
          fflHasSot: s1.fflHasSot,
          fieldsEdited: s1.fieldsEdited,
          // Step 2
          regType: step2Data.regType, businessDescription: step2Data.businessDescription,
          stateTaxIds: step2Data.stateTaxIds, signatureDataUrl: step2Data.signatureDataUrl,
          stateDocFileName: step2Data.stateDocFile?.name || null, stateDocFileData: stateDocBase64 || null,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        toast({ title: "Registration Complete!", description: "Your account has been created and documents submitted for review." });
        window.location.href = "/dealer/dashboard";
      } else {
        toast({ title: "Error", description: data.error || "Registration failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-2xl">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 1 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? "bg-primary text-white" : "bg-muted"}`}>1</div>
              FFL & Documents
            </div>
            <div className="w-12 h-0.5 bg-border" />
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 2 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? "bg-primary text-white" : "bg-muted"}`}>2</div>
              Tax Form & Sign
            </div>
          </div>

          {step === 1 && <Step1FFL key="s1" onNext={(data) => { setStep1Data(data); setStep(2); }} />}
          {step === 2 && step1Data && (
            <Step2TaxForm key="s2" data={step1Data} onBack={() => setStep(1)} onSubmit={handleFinalSubmit} />
          )}

          {submitting && (
            <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                <p className="text-lg font-display">Processing your registration...</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
