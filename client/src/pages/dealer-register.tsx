import React, { useState, useRef } from "react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Upload, X, PenTool, ShieldCheck, FileText, ArrowRight, ArrowLeft, Search } from "lucide-react";

const EIN_TYPE_LABELS = { "3": "Dealer", "2": "Manufacturer", "1": "Importer" };

export default function DealerRegister() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [fflInput, setFflInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState(false);
  const [form, setForm] = useState({ fflNumber:"", companyName:"", licenseName:"", phone:"", address:"", city:"", state:"", zip:"", fflExpiry:"", ein:"", einType:"3", email:"", password:"" });
  const [fflFile, setFflFile] = useState<File | null>(null);
  const [sotFile, setSotFile] = useState<File | null>(null);
  const [fflHasSot, setFflHasSot] = useState(false);
  const [edits, setEdits] = useState<Set<string>>(new Set());

  // Step 2
  const [regType, setRegType] = useState("");
  const [otherRegType, setOtherRegType] = useState("");
  const [businessDesc, setBusinessDesc] = useState("");
  const [taxIds, setTaxIds] = useState([{ state: "", taxId: "" }]);
  const [stateDocFile, setStateDocFile] = useState<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const [sigData, setSigData] = useState("");

  const ic = "bg-background border-border";
  const lc = "text-sm font-medium mb-1 block";

  function upd(f: string, v: string) { setForm(p => ({ ...p, [f]: v })); }
  function mark(f: string) { if (found) setEdits(new Set([...Array.from(edits), f])); }

  async function lookup() {
    if (!fflInput.trim()) return;
    setLooking(true);
    try {
      const r = await fetch("/api/ffl/validate", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({fflNumber:fflInput.trim()}) });
      const d = await r.json();
      if (d.valid) {
        setForm(p => ({ ...p, fflNumber:d.fflLicenseNumber||fflInput, companyName:d.tradeName||d.dealerName||"", licenseName:d.licenseName||"", phone:d.voicePhone||"", address:d.premiseAddress1||"", city:d.premiseCity||"", state:d.premiseState||"", zip:d.premiseZipCode||"", fflExpiry:d.fflExpiryDate||"", einType:d.einType||"3" }));
        setFound(true);
      } else { toast({title:"Not Found", description:"FFL not in ATF database. Enter info manually.", variant:"destructive"}); setFound(true); }
    } catch { toast({title:"Error", variant:"destructive"}); setFound(true); }
    finally { setLooking(false); }
  }

  function nextStep() {
    if (!form.companyName||!form.fflNumber) { toast({title:"Missing",description:"Company name and FFL required",variant:"destructive"}); return; }
    if (!form.email||!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) { toast({title:"Invalid email",variant:"destructive"}); return; }
    if (!form.password||form.password.length<8) { toast({title:"Password",description:"Min 8 characters",variant:"destructive"}); return; }
    if (!fflFile&&!fflHasSot) { toast({title:"Missing FFL",description:"Upload FFL document",variant:"destructive"}); return; }
    if (!fflHasSot&&!sotFile) { toast({title:"Missing SOT",description:"Upload SOT or check combined box",variant:"destructive"}); return; }
    setTaxIds([{ state: form.state, taxId: "" }]);
    setStep(2);
  }

  function toB64(file: File) { return new Promise<string>(resolve => { const r = new FileReader(); r.onload = () => resolve((r.result as string).split(",")[1]); r.readAsDataURL(file); }); }

  async function submit() {
    if (!hasSig||!regType) { toast({title:"Missing",description:"Signature and registration type required",variant:"destructive"}); return; }
    setSubmitting(true);
    try {
      const fb64 = fflFile?await toB64(fflFile):"", sb64 = sotFile?await toB64(sotFile):"", db64 = stateDocFile?await toB64(stateDocFile):"";
      const r = await fetch("/api/dealer/register-full", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ fflNumber:form.fflNumber,companyName:form.companyName,licenseName:form.licenseName,phone:form.phone,address:form.address,city:form.city,state:form.state,zip:form.zip,fflExpiry:form.fflExpiry,ein:form.ein,einType:form.einType,email:form.email,password:form.password,fflFileName:fflFile?.name||null,fflFileData:fb64||null,sotFileName:sotFile?.name||null,sotFileData:sb64||null,fflHasSot,fieldsEdited:Array.from(edits),regType:regType==="Other"?otherRegType:regType,businessDescription:businessDesc,stateTaxIds:taxIds.filter(s=>s.taxId.trim()),signatureDataUrl:sigData,stateDocFileName:stateDocFile?.name||null,stateDocFileData:db64||null }) });
      const d = await r.json();
      if (d.ok) { toast({title:"Registration Complete!"}); setTimeout(()=>window.location.href="/dealer/dashboard",1500); }
      else toast({title:"Error",description:d.error||"Failed",variant:"destructive"});
    } catch { toast({title:"Error",description:"Connection error",variant:"destructive"}); }
    finally { setSubmitting(false); }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) { drawingRef.current=true; const c=canvasRef.current!; const r=c.getBoundingClientRect(); const x=((e as React.TouchEvent).touches? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX)-r.left; const y=((e as React.TouchEvent).touches? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY)-r.top; const ctx=c.getContext("2d")!; ctx.beginPath();ctx.moveTo(x,y);ctx.strokeStyle="#000";ctx.lineWidth=2;ctx.lineCap="round"; }
  function draw(e: React.MouseEvent | React.TouchEvent) { if(!drawingRef.current)return;e.preventDefault();const c=canvasRef.current!;const r=c.getBoundingClientRect();const x=((e as React.TouchEvent).touches? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX)-r.left;const y=((e as React.TouchEvent).touches? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY)-r.top;c.getContext("2d")!.lineTo(x,y);c.getContext("2d")!.stroke();setHasSig(true); }
  function stopDraw() { drawingRef.current=false; if(canvasRef.current)setSigData((canvasRef.current as HTMLCanvasElement).toDataURL()); }
  function clearSig() { const c=canvasRef.current!;c.getContext("2d")!.clearRect(0,0,c.width,c.height);setHasSig(false);setSigData(""); }

  // Step 1 UI
  if (step === 1) return (
    <div className="min-h-screen bg-background"><SiteHeader/>
    <section className="pt-24 pb-16 max-w-xl mx-auto px-6 space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</div><span className="font-medium">FFL & Documents</span>
        <div className="w-12 h-0.5 bg-border"/>
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">2</div><span className="text-muted-foreground">Tax Form & Sign</span>
      </div>

      <Card><CardHeader><CardTitle className="text-lg"><Search className="w-5 h-5 inline mr-2 text-primary"/>FFL Lookup</CardTitle></CardHeader>
        <CardContent>
           <div className="flex gap-2"><Input value={fflInput} onChange={e=>setFflInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")lookup()}} placeholder="FFL number (X-XX-XXX-XX-XX-XXXXX)" className={ic}/><Button onClick={lookup} disabled={looking} variant="outline">{looking?<Loader2 className="w-4 h-4 animate-spin"/>:"Lookup"}</Button></div>
          {found && <p className="text-sm text-green-500 mt-2"><CheckCircle className="w-4 h-4 inline mr-1"/>Data loaded from ATF database</p>}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-lg"><ShieldCheck className="w-5 h-5 inline mr-2 text-primary"/>FFL / Business Info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><label className={lc}>Company Name *</label><Input value={form.companyName} onChange={e=>{upd("companyName",e.target.value);mark("companyName")}} className={ic}/></div>
          <div><label className={lc}>License Name</label><Input value={form.licenseName} onChange={e=>{upd("licenseName",e.target.value);mark("licenseName")}} className={ic}/></div>
          <div><label className={lc}>FFL Number *</label><Input value={form.fflNumber} onChange={e=>upd("fflNumber",e.target.value)} className={ic}/></div>
          <div><label className={lc}>FFL Expiration</label><Input value={form.fflExpiry} onChange={e=>{upd("fflExpiry",e.target.value);mark("fflExpiry")}} className={ic} placeholder="YYYY-MM-DD"/></div>
          <div><label className={lc}>Phone</label><Input value={form.phone} onChange={e=>upd("phone",e.target.value)} className={ic}/></div>
          <div><label className={lc}>EIN (Federal)</label><Input value={form.ein} onChange={e=>upd("ein",e.target.value)} placeholder="XX-XXXXXXX" className={ic}/></div>
          <div><label className={lc}>Email *</label><Input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} className={ic}/></div>
          <div><label className={lc}>Password * (min 8)</label><Input type="password" value={form.password} onChange={e=>upd("password",e.target.value)} className={ic}/></div>
          <div><label className={lc}>EIN Type (from FFL)</label>
            <select value={form.einType} onChange={e=>upd("einType",e.target.value)} className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="3">Dealer (FFL 01/02/09)</option><option value="2">Manufacturer (FFL 07/10)</option><option value="1">Importer (FFL 08/11)</option>
            </select>
          </div>
          <div><label className={lc}>Address</label><Input value={form.address} onChange={e=>{upd("address",e.target.value);mark("address")}} className={ic}/></div>
          <div><label className={lc}>City</label><Input value={form.city} onChange={e=>{upd("city",e.target.value);mark("city")}} className={ic}/></div>
          <div><label className={lc}>State</label><Input value={form.state} onChange={e=>{upd("state",e.target.value);mark("state")}} className={ic} maxLength={2}/></div>
          <div><label className={lc}>ZIP</label><Input value={form.zip} onChange={e=>{upd("zip",e.target.value);mark("zip")}} className={ic} maxLength={10}/></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-lg"><Upload className="w-5 h-5 inline mr-2 text-primary"/>Required Documents</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><label className={lc}>FFL License *</label><FileDrop file={fflFile} setFile={setFflFile}/></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={fflHasSot} onChange={e=>setFflHasSot(e.target.checked)} className="accent-primary"/>My FFL has SOT combined on the same page</label>
          {!fflHasSot && <div><label className={lc}>SOT License *</label><FileDrop file={sotFile} setFile={setSotFile}/></div>}
        </CardContent>
      </Card>

      <Button onClick={nextStep} className="w-full font-display text-lg h-12 bg-primary hover:bg-primary/90">Next: Tax Form <ArrowRight className="w-5 h-5 ml-2"/></Button>
    </section></div>
  );

  // Step 2 UI
  if (step === 2) return (
    <div className="min-h-screen bg-background"><SiteHeader/>
    <section className="pt-24 pb-16 max-w-xl mx-auto px-6 space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">1</div><span className="text-muted-foreground">FFL & Documents</span>
        <div className="w-12 h-0.5 bg-border"/>
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">2</div><span className="font-medium">Tax Form & Sign</span>
      </div>

      <Card><CardHeader><CardTitle className="text-lg"><FileText className="w-5 h-5 inline mr-2 text-primary"/>Multi-State Tax Exemption Certificate</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This fills your Multi-State Sales & Use Tax Exemption form.</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lc}>Company Name</label><Input value={form.companyName} disabled className="bg-muted/30"/></div>
            <div><label className={lc}>State (from FFL)</label><Input value={form.state} disabled className="bg-muted/30"/></div>
          </div>
          <div><label className={lc}>Registered As *</label>
            <select value={regType} onChange={e=>setRegType(e.target.value)} className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Select type...</option>
              <option value="Wholesaler">Wholesaler</option><option value="Retailer">Retailer</option>
              <option value="Manufacturer">Manufacturer</option><option value="Lessor">Lessor</option>
              <option value="Exempt Organization">Exempt Organization</option><option value="Other">Other</option>
            </select>
          </div>
          {regType==="Other" && <Input value={otherRegType} onChange={e=>setOtherRegType(e.target.value)} placeholder="Specify other..." className={ic}/>}
          <div><label className={lc}>Description of Business</label><Textarea value={businessDesc} onChange={e=>setBusinessDesc(e.target.value)} placeholder="e.g. Retail firearms and accessories" className={ic} rows={2}/></div>
          <div><label className={lc}>State Tax Registration Numbers</label>
            {taxIds.map((e,i)=>(
              <div key={i} className="flex gap-2 mb-2">
                <Input value={e.state} disabled={i===0} className={`${i===0?"bg-muted/30":"bg-background"} w-16 text-center font-bold`}/>
                <Input value={e.taxId} onChange={ev=>{const v=ev.target.value;const n=[...taxIds];n[i]={...n[i],taxId:v};setTaxIds(n)}} placeholder={`${e.state||"XX"} tax ID`} className={ic}/>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-lg"><Upload className="w-5 h-5 inline mr-2 text-primary"/>State-Issued Tax ID Document</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Upload your state sales tax / resale permit.</p>
          <FileDrop file={stateDocFile} setFile={setStateDocFile}/>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-lg"><PenTool className="w-5 h-5 inline mr-2 text-primary"/>Digital Signature</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="border border-border rounded-lg bg-white" style={{touchAction:"none"}}>
            <canvas ref={canvasRef} width={500} height={120} className="w-full rounded-lg cursor-crosshair" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}/>
          </div>
          <div className="flex items-center gap-3"><PenTool className="w-4 h-4 text-muted-foreground"/><span className="text-sm text-muted-foreground">Sign above</span>{hasSig && <button onClick={clearSig} className="text-sm text-red-400 hover:underline ml-auto">Clear</button>}</div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={()=>setStep(1)} variant="outline" className="flex-1"><ArrowLeft className="w-5 h-5 mr-2"/>Back</Button>
        <Button onClick={submit} disabled={submitting} className="flex-1 bg-primary hover:bg-primary/90">{submitting?<Loader2 className="w-4 h-4 animate-spin"/>:"Submit Registration"}</Button>
      </div>

      {submitting && <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"><div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3"/><p className="text-lg font-display">Processing...</p></div></div>}
    </section></div>
  );
}

function FileDrop({ file, setFile }: { file: File | null; setFile: (f: File | null) => void }) {
  return (
    <label className={`flex items-center justify-center border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${file?"border-green-500/50 bg-green-500/5":"border-border hover:border-primary/40 bg-card"}`}
      onDragOver={e=>{e.preventDefault()}} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)setFile(f)}}>
      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={e=>setFile(e.target.files?.[0]||null)}/>
      {file ? <span className="text-sm text-green-500 flex items-center gap-2"><CheckCircle className="w-4 h-4"/>{file.name}</span> : <span className="text-sm text-muted-foreground flex items-center gap-2"><Upload className="w-4 h-4"/>Drop file or click to browse</span>}
    </label>
  );
}
