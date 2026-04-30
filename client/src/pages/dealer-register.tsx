import React, { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function DealerRegister() {
  const { toast } = useToast();
  const [fflInput, setFflInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState(false);
  const [form, setForm] = useState({
    fflNumber:"", companyName:"", licenseName:"", phone:"", address:"",
    city:"", state:"", zip:"", fflExpiry:"", ein:"", einType:"3", email:"", password:""
  });

  function update(f, v) { setForm(p => ({...p, [f]: v})); }

  async function lookupFFL() {
    if (!fflInput.trim()) return;
    setLooking(true);
    const r = await fetch("/api/ffl/validate", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({fflNumber:fflInput.trim()})
    });
    const d = await r.json();
    if (d.valid) {
      setForm(p => ({...p, fflNumber:d.fflLicenseNumber||fflInput, companyName:d.tradeName||d.dealerName||"",
        licenseName:d.licenseName||"", phone:d.voicePhone||"", address:d.premiseAddress1||"",
        city:d.premiseCity||"", state:d.premiseState||"", zip:d.premiseZipCode||"",
        fflExpiry:d.fflExpiryDate||"", einType:d.einType||"3"}));
      setFound(true);
    } else {
      toast({title:"Not Found", variant:"destructive"});
      setFound(true);
    }
    setLooking(false);
  }

  async function handleSubmit() {
    if (!form.companyName||!form.email) {
      toast({title:"Missing fields", variant:"destructive"}); return;
    }
    try {
      const r = await fetch("/api/dealer/register-full", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          fflNumber:form.fflNumber, companyName:form.companyName,
          licenseName:form.licenseName, phone:form.phone,
          address:form.address, city:form.city, state:form.state, zip:form.zip,
          fflExpiry:form.fflExpiry, ein:form.ein, einType:form.einType,
          email:form.email, password:form.password,
          regType:"Manufacturer", businessDescription:"", stateTaxIds:[], signatureDataUrl:""
        })
      });
      const d = await r.json();
      if (d.ok) toast({title:"Done!"});
      else toast({title:"Error", description:d.error, variant:"destructive"});
    } catch { toast({title:"Connection error", variant:"destructive"}); }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="pt-24 pb-16 max-w-xl mx-auto px-6 space-y-4">
        <h1 className="text-2xl font-bold">Dealer Registration</h1>

        <div className="flex gap-2">
          <Input value={fflInput} onChange={e=>setFflInput(e.target.value)} placeholder="FFL Number" />
          <Button onClick={lookupFFL} disabled={looking}>{looking?<Loader2 className="w-4 h-4 animate-spin"/>:"Lookup"}</Button>
        </div>
        {found && <p className="text-green-500 text-sm">Found in ATF database</p>}

        <Input placeholder="Company Name *" value={form.companyName} onChange={e=>update("companyName",e.target.value)} />
        <Input placeholder="License Name" value={form.licenseName} onChange={e=>update("licenseName",e.target.value)} />
        <Input placeholder="Phone" value={form.phone} onChange={e=>update("phone",e.target.value)} />
        <Input placeholder="Email *" type="email" value={form.email} onChange={e=>update("email",e.target.value)} />
        <Input placeholder="Password *" type="password" value={form.password} onChange={e=>update("password",e.target.value)} />
        <Input placeholder="EIN" value={form.ein} onChange={e=>update("ein",e.target.value)} />

        <Button onClick={handleSubmit} className="w-full">Submit Registration</Button>
      </section>
    </div>
  );
}
