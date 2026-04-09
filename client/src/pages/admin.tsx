import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  Copy, Image as ImageIcon, Download, Trash2, Package, Archive,
  ChevronRight, ArrowLeft, Building2, FileText,
  Upload, Eye, X, Search, Inbox,
  MessageSquare, ShieldCheck, Phone, Files, CheckCircle, XCircle, Send,
  RefreshCw, Store
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// ── Types ──────────────────────────────────────────────────────────────────────

type Submission = {
  id: string;
  type: string;
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  serialNumber: string;
  quantity: string;
  description: string;
  fflFileName: string;
  fflFileData?: string;
  sotFileName?: string;
  sotFileData?: string;
  taxFormName?: string;
  taxFormData?: string;
  stateTaxFileName?: string;
  stateTaxFileData?: string;
  serialPhotoName?: string;
  serialPhotoData?: string;
  damagePhoto1Name?: string;
  damagePhoto1Data?: string;
  damagePhoto2Name?: string;
  damagePhoto2Data?: string;
  atfFormName?: string;
  atfFormData?: string;
  trackingNumber?: string;
  shippedAt?: string;
  hasOrderedDemo?: string;
  createdAt: string;
  order_type?: string;
  archived?: boolean;
  archived_from?: string;
};

type Dealer = {
  id: string;
  businessName: string;
  ein?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  sotLicenseType?: string;
  sotTaxYear?: string;
  sotPeriodStart?: string;
  sotPeriodEnd?: string;
  sotControlNumber?: string;
  sotReceiptDate?: string;
  sotFileName?: string;
  sotFileData?: string;
  sotOnFile?: boolean;
  sotExpiryDate?: string;
  fflLicenseNumber?: string;
  fflLicenseType?: string;
  fflExpiry?: string;
  fflFileName?: string;
  fflFileData?: string;
  fflOnFile?: boolean;
  fflExpiryDate?: string;
  fflLoaExpiry?: string;
  taxExempt?: boolean;
  taxExemptNotes?: string;
  salesTaxId?: string;
  salesTaxFormData?: string;
  salesTaxFormName?: string;
  taxFormOnFile?: boolean;
  notes?: string;
  sourceSubmissionId?: string;
  purchased?: boolean;
  lastOrderDate?: string;
  createdAt: string;
  updatedAt: string;
  orderCount?: number;
  dealerOrderCount?: number;
  demoFulfilledAt?: string;
  submissions?: Submission[];
};

type Tab = "submissions" | "warranty" | "dealer_inquiries" | "retail_inquiries" | "files" | "tax_forms" | "archives";

// ── Schemas ────────────────────────────────────────────────────────────────────

const pinSchema = z.object({ pin: z.string().length(6, "PIN must be 6 digits") });

const dealerFormSchema = z.object({
  businessName: z.string().min(1, "Required"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  ein: z.string().optional(),
  businessAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  sotLicenseType: z.string().optional(),
  sotTaxYear: z.string().optional(),
  sotPeriodStart: z.string().optional(),
  sotPeriodEnd: z.string().optional(),
  sotControlNumber: z.string().optional(),
  sotReceiptDate: z.string().optional(),
  fflLicenseNumber: z.string().optional(),
  fflLicenseType: z.string().optional(),
  fflExpiry: z.string().optional(),
  fflLoaExpiry: z.string().optional(),
  taxExempt: z.boolean().optional(),
  taxExemptNotes: z.string().optional(),
  salesTaxId: z.string().optional(),
  notes: z.string().optional(),
  purchased: z.boolean().optional(),
  lastOrderDate: z.string().optional(),
});
type DealerFormValues = z.infer<typeof dealerFormSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyableText({ text }: { text: string }) {
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard.", duration: 2000 });
  };
  return (
    <div className="group flex items-center gap-1.5 cursor-pointer" onClick={handleCopy} title="Click to copy">
      <span className="text-sm">{text}</span>
      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
    </div>
  );
}

function FilePreview({ fileName, fileData, label = "View" }: { fileName?: string; fileData?: string; label?: string }) {
  if (!fileData || !fileName) return null;
  const isPdf = fileName.toLowerCase().endsWith(".pdf");
  const src = isPdf
    ? `data:application/pdf;base64,${fileData}`
    : `data:image;base64,${fileData}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <Eye className="w-3 h-3" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-1 border-border bg-card max-h-[500px] overflow-auto">
        {isPdf ? (
          <iframe src={src} className="w-full rounded-sm" style={{ height: "480px" }} title={fileName} />
        ) : (
          <img src={src} alt={fileName} className="w-full h-auto rounded-sm" />
        )}
      </PopoverContent>
    </Popover>
  );
}

function FileDownload({ fileName, fileData }: { fileName?: string; fileData?: string }) {
  if (!fileData || !fileName) return null;
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
      <a href={`data:application/octet-stream;base64,${fileData}`} download={fileName} title="Download">
        <Download className="w-3.5 h-3.5" />
      </a>
    </Button>
  );
}

// Always-visible FFL/SOT/TAX/STATE TAX badges — green = has file, red = missing. Badge is clickable to view or upload.
function DocBadge({ type, fileName, fileData, submissionId }: { type: "ffl" | "sot" | "tax" | "state_tax"; fileName?: string; fileData?: string; submissionId: string }) {
  const hasFile = !!(fileName && fileData);
  const label = type === "state_tax" ? "STATE TAX" : type.toUpperCase();
  const colors: Record<string, string> = {
    ffl: hasFile ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-500 text-white hover:bg-red-600",
    sot: hasFile ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-500 text-white hover:bg-red-600",
    tax: hasFile ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-500 text-white hover:bg-red-600",
    state_tax: hasFile ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-pink-500 text-white hover:bg-pink-600",
  };

  if (hasFile) {
    // Has file — show preview popover
    const isPdf = fileName!.toLowerCase().endsWith(".pdf");
    const src = isPdf ? `data:application/pdf;base64,${fileData}` : `data:image;base64,${fileData}`;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className={`text-xs px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${colors[type]}`}>{label}</button>
        </PopoverTrigger>
        <PopoverContent className="w-[480px] max-h-[520px] p-0 border-border bg-card overflow-auto">
          {isPdf ? (
            <iframe src={src} className="w-full rounded" style={{ height: "500px" }} title={fileName} />
          ) : (
            <img src={src} alt={fileName} className="w-full h-auto rounded" />
          )}
        </PopoverContent>
      </Popover>
    );
  } else {
    // Missing — click to upload
    const inputId = `doc-upload-${type}-${submissionId.replace(/-/g, "")}`;
    return (
      <label htmlFor={inputId} className={`text-xs px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${colors[type]}`}>
        {label}
        <input
          id={inputId}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const base64 = (ev.target?.result as string).split(",")[1];
              const endpoint = type === "ffl" ? "/api/admin/submissions/:id/ffl-file" : type === "sot" ? "/api/admin/submissions/:id/sot-file" : type === "state_tax" ? "/api/admin/submissions/:id/state-tax" : "/api/admin/submissions/:id/tax-form";
              const body: Record<string, string> = {};
              if (type === "ffl") { body.fflFileName = file.name; body.fflFileData = base64; }
              else if (type === "sot") { body.sotFileName = file.name; body.sotFileData = base64; }
              else if (type === "state_tax") { body.stateTaxFileName = file.name; body.stateTaxFileData = base64; }
              else { body.taxFormName = file.name; body.taxFormData = base64; }
              try {
                const res = await fetch(endpoint.replace(":id", submissionId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                console.log(`Upload ${type} response:`, res.status, await res.text().catch(() => ""));
                if (res.ok) { toast({ title: `${label} uploaded`, description: file.name }); window.location.reload(); }
                else { const err = await res.json().catch(() => ({})); toast({ title: `Upload failed`, description: err.error || res.statusText, variant: "destructive" }); }
              } catch (err) { console.error(`Upload ${type} error:`, err); toast({ title: `Upload failed`, variant: "destructive" }); }
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
    );
  }
}

function SotBadge({ dealer }: { dealer: Dealer }) {
  const now = new Date();
  // Prefer new sotExpiryDate (ISO), fall back to old sotPeriodEnd string
  const endStr = dealer.sotExpiryDate || dealer.sotPeriodEnd;
  const end = endStr
    ? (endStr.includes("/") ? parseISO(`20${endStr}`) : parseISO(endStr))
    : null;
  const expired = end && end < now;
  const soon = end && !expired && (end.getTime() - now.getTime()) < 90 * 24 * 60 * 60 * 1000;
  // Use sot_on_file boolean if set, otherwise fall back to presence of license type
  if (!dealer.sotOnFile && !dealer.sotLicenseType) return <Badge variant="secondary" className="text-xs">No SOT</Badge>;
  if (expired) return <Badge variant="destructive" className="text-xs">SOT Expired</Badge>;
  if (soon) return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">SOT Expiring Soon</Badge>;
  return <Badge variant="default" className="text-xs bg-green-600">SOT Active</Badge>;
}

function FflBadge({ dealer }: { dealer: Dealer }) {
  const now = new Date();
  // Prefer new fflExpiryDate (ISO), fall back to old fflExpiry string (MM/DD/YYYY)
  const endStr = dealer.fflExpiryDate || dealer.fflExpiry;
  const end = endStr
    ? (endStr.includes("/") ? parseISO(endStr) : parseISO(endStr))
    : null;
  const expired = end && end < now;
  const soon = end && !expired && (end.getTime() - now.getTime()) < 90 * 24 * 60 * 60 * 1000;
  // Use ffl_on_file boolean if set, otherwise fall back to presence of license number
  if (!dealer.fflOnFile && !dealer.fflLicenseNumber) return <Badge variant="secondary" className="text-xs">No FFL</Badge>;
  if (expired) return <Badge variant="destructive" className="text-xs">FFL Expired</Badge>;
  if (soon) return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">FFL Expiring Soon</Badge>;
  return <Badge variant="default" className="text-xs bg-green-600">FFL Active</Badge>;
}

function TaxBadge({ dealer }: { dealer: Dealer }) {
  if (dealer.taxFormOnFile) return <Badge variant="default" className="text-xs bg-blue-600">Tax Form ✓</Badge>;
  if (dealer.taxExempt) return <Badge variant="default" className="text-xs bg-blue-600">Tax Exempt</Badge>;
  return null;
}

function fmtDate(d: string | Date) {
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "yyyy-MM-dd HH:mm");
  } catch {
    return String(d);
  }
}

// ── Submissions Tab ───────────────────────────────────────────────────────────

function SubmissionsTab({
  submissions, isLoading, search, setSearch,
  sortDir, setSortDir, showArchived, setShowArchived,
  setArchiveTarget, setShipTarget, setInvoiceTarget, onFetchSubmissions
}: {
  submissions: Submission[]; isLoading: boolean;
  search: string; setSearch: (s: string) => void;
  sortDir: "desc" | "asc"; setSortDir: (d: "desc" | "asc") => void;
  showArchived: boolean; setShowArchived: (v: boolean) => void;
  setArchiveTarget: (s: Submission | null) => void;
  setShipTarget: (s: Submission | null) => void;
  setInvoiceTarget: (s: Submission | null) => void;
  onFetchSubmissions: () => void;
}) {
  // Exclude warranty submissions — they go to the Warranty tab
  const filtered = submissions.filter((sub) => {
    if (sub.type === "warranty") return false;
    if (search) {
      const q = search.toLowerCase();
      const s = `${fmtDate(sub.createdAt)} ${sub.contactName} ${sub.businessName} ${sub.email} ${sub.phone} ${sub.serialNumber} ${sub.description || ""}`.toLowerCase();
      if (!s.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    const t = sortDir === "desc" ? -1 : 1;
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * t;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search submissions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs bg-background h-9"
        />
        <Button variant="outline" size="sm" onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
          className="h-9 bg-background text-xs whitespace-nowrap">
          {sortDir === "desc" ? "↓ Newest" : "↑ Oldest"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onFetchSubmissions} className="h-9 text-xs">
          Refresh
        </Button>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => { setShowArchived(v => !v); onFetchSubmissions(); }}
          className={`h-9 text-xs whitespace-nowrap ${showArchived ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : "bg-background"}`}
        >
          {showArchived ? "✓ Archived" : "Archived"}
        </Button>
      </div>

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
          : filtered.length === 0 ? <p className="text-center py-8 text-muted-foreground">No submissions.</p>
          : filtered.map(sub => <SubmissionCard key={sub.id} sub={sub}
            onArchive={() => setArchiveTarget(sub)}
            onDelete={() => setDeleteTarget(sub)}
            onShip={() => setShipTarget(sub)}
            onInvoice={() => setInvoiceTarget(sub)} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 min-w-[180px]">Business / Contact</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">Documents</th>
              <th className="px-3 py-2">Shipping</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No submissions found.</td></tr>
              : filtered.map(sub => <SubmissionRow key={sub.id} sub={sub}
                onArchive={() => setArchiveTarget(sub)}
                onDelete={() => setDeleteTarget(sub)}
                onShip={() => setShipTarget(sub)}
                onInvoice={() => setInvoiceTarget(sub)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmissionCard({ sub, onArchive, onDelete, onShip, onInvoice }: { sub: Submission; onArchive: () => void; onDelete: () => void; onShip: () => void; onInvoice: () => void }) {
  return (
    <div className={`border border-border rounded-lg p-3 bg-card hover:bg-secondary/5 ${sub.archived ? "opacity-60 bg-secondary/5" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.type === "dealer" || sub.type === "dealer_order" ? "bg-orange-500 text-white" : "bg-red-500 text-white"}`}>
            {sub.type.toUpperCase()}
          </span>
          {sub.archived && <span className="px-1.5 py-0.5 bg-gray-400 text-white text-xs rounded">Archived</span>}
          <span className="text-xs text-muted-foreground font-mono">{fmtDate(sub.createdAt)}</span>
        </div>
        <div className="flex gap-1">
          {!sub.archived && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {!sub.archived && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-orange-500" onClick={onArchive} title="Archive">
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          {sub.archived && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-green-600 hover:text-green-500" onClick={onArchive} title="Unarchive">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1 mb-2">
        <p className="text-sm font-semibold">{sub.contactName}</p>
        <p className="text-xs text-muted-foreground">{sub.email}</p>
        {sub.phone && <p className="text-xs text-muted-foreground">{sub.phone}</p>}
        {sub.businessName && <p className="text-xs px-1.5 py-0.5 bg-secondary rounded inline-block">{sub.businessName}</p>}
      </div>
      <div className="border-t border-border pt-2 space-y-1">
        {sub.type === "dealer" || sub.type === "dealer_order" ? (
          <>
            {sub.quantity && <p className="text-xs text-muted-foreground">Qty: <span className="text-foreground font-medium">{sub.quantity}</span></p>}
            {sub.description && <p className="text-xs text-foreground italic">"{sub.description}"</p>}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Serial: <span className="font-mono text-foreground">{sub.serialNumber}</span></p>
            <p className="text-xs text-foreground">{sub.description}</p>
          </>
        )}
      </div>
      {/* Documents — mobile */}
      <div className="border-t border-border pt-2 mt-2">
        <div className="flex flex-wrap gap-1.5">
          <DocBadge type="ffl" fileName={sub.fflFileName} fileData={sub.fflFileData} submissionId={sub.id} />
          <DocBadge type="sot" fileName={sub.sotFileName} fileData={sub.sotFileData} submissionId={sub.id} />
          <DocBadge type="tax" fileName={sub.taxFormName} fileData={sub.taxFormData} submissionId={sub.id} />
          <DocBadge type="state_tax" fileName={sub.stateTaxFileName} fileData={sub.stateTaxFileData} submissionId={sub.id} />
        </div>
      </div>
      {/* Shipping */}
      <div className="border-t border-border pt-2 mt-2">
        {sub.trackingNumber ? (
          <div className="space-y-1">
            <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded font-bold">SHIPPED</span>
            <p className="text-xs font-mono text-foreground">{sub.trackingNumber}</p>
            {sub.shippedAt && <p className="text-xs text-muted-foreground">{format(parseISO(sub.shippedAt), "MM/dd/yy HH:mm")}</p>}
          </div>
        ) : (
          <div className="space-y-1">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs border-primary text-primary hover:bg-primary/10" onClick={onShip}>
              Mark as Shipped
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`w-full h-8 text-xs ${(sub as any).hasInvoice
                ? "border-green-600 text-green-600 hover:bg-green-50"
                : "border-red-600 text-red-600 hover:bg-red-50"
              }`}
              onClick={onInvoice}
            >
              {(sub as any).hasInvoice ? `✓ Invoice Sent` : "Send Invoice"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionRow({ sub, onArchive, onDelete, onShip, onInvoice }: { sub: Submission; onArchive: () => void; onDelete: () => void; onShip: () => void; onInvoice: () => void }) {
  return (
    <tr className={`border-b border-border hover:bg-secondary/10 ${sub.archived ? "opacity-50" : ""}`}>
      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground text-xs font-mono">{fmtDate(sub.createdAt)}</td>
      <td className="px-3 py-3">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.type === "dealer" ? "bg-orange-500 text-white" : "bg-red-500 text-white"}`}>
          {sub.type.toUpperCase()}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="font-semibold text-sm"><CopyableText text={sub.contactName || ""} /></div>
        <div className="text-muted-foreground text-xs"><CopyableText text={sub.email} /></div>
        {sub.phone && <div className="text-muted-foreground text-xs"><CopyableText text={sub.phone} /></div>}
        {sub.businessName && <div className="mt-1 text-xs px-1.5 py-0.5 bg-secondary rounded inline-block">{sub.businessName}</div>}
      </td>
      <td className="px-3 py-3">
        {sub.type === "dealer" || sub.type === "dealer_order" ? (
          <div className="space-y-1">
            {sub.quantity && <div className="text-xs"><span className="text-muted-foreground">Qty:</span> <span className="font-medium text-foreground">{sub.quantity}</span></div>}
            {sub.description && <div className="text-xs max-w-[200px] text-foreground italic">"{sub.description}"</div>}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-xs"><span className="text-muted-foreground">Serial:</span> <span className="font-mono text-foreground">{sub.serialNumber}</span></div>
            <div className="text-xs text-foreground max-w-[250px]">{sub.description}</div>
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          <DocBadge type="ffl" fileName={sub.fflFileName} fileData={sub.fflFileData} submissionId={sub.id} />
          <DocBadge type="sot" fileName={sub.sotFileName} fileData={sub.sotFileData} submissionId={sub.id} />
          <DocBadge type="tax" fileName={sub.taxFormName} fileData={sub.taxFormData} submissionId={sub.id} />
          <DocBadge type="state_tax" fileName={sub.stateTaxFileName} fileData={sub.stateTaxFileData} submissionId={sub.id} />
        </div>
      </td>
      <td className="px-3 py-3">
        {sub.trackingNumber ? (
          <div className="space-y-1">
            <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded font-bold">SHIPPED</span>
            <p className="text-xs font-mono text-foreground">{sub.trackingNumber}</p>
            {sub.shippedAt && <p className="text-xs text-muted-foreground">{format(parseISO(sub.shippedAt), "MM/dd/yy HH:mm")}</p>}
          </div>
        ) : (
          <div className="space-y-1">
            <Button variant="outline" size="sm" className="h-7 text-xs whitespace-nowrap border-primary text-primary hover:bg-primary/10" onClick={onShip}>
              Mark Shipped
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs whitespace-nowrap w-full mt-1 ${(sub as any).hasInvoice
                ? "border-green-600 text-green-600 hover:bg-green-50"
                : "border-red-600 text-red-600 hover:bg-red-50"
              }`}
              onClick={onInvoice}
            >
              {(sub as any).hasInvoice ? `✓ Invoice Sent` : "Send Invoice"}
            </Button>
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          {!sub.archived && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {!sub.archived ? (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-orange-500" onClick={onArchive} title="Archive">
              <Archive className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-500" onClick={onArchive} title="Unarchive">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Dealers Tab ────────────────────────────────────────────────────────────────

function DealersTab({ dealers, isLoading, onSelect, onAddNew }: {
  dealers: Dealer[]; isLoading: boolean;
  onSelect: (d: Dealer) => void; onAddNew: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = dealers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${d.businessName} ${d.contactName} ${d.email} ${d.city || ""} ${d.state || ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Expiry notifications */}
      {(() => {
        const now = new Date();
        const sotSoon = dealers.filter(d => {
          const str = d.sotExpiryDate || d.sotPeriodEnd;
          if (!str) return false;
          const end = str.includes("/") ? parseISO(`20${str}`) : parseISO(str);
          const diff = end.getTime() - now.getTime();
          return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
        });
        const sotExpired = dealers.filter(d => {
          const str = d.sotExpiryDate || d.sotPeriodEnd;
          if (!str) return false;
          const end = str.includes("/") ? parseISO(`20${str}`) : parseISO(str);
          return end < now;
        });
        const fflSoon = dealers.filter(d => {
          const str = d.fflExpiryDate || d.fflExpiry;
          if (!str) return false;
          const end = parseISO(str);
          const diff = end.getTime() - now.getTime();
          return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
        });
        const fflExpired = dealers.filter(d => {
          const str = d.fflExpiryDate || d.fflExpiry;
          if (!str) return false;
          return parseISO(str) < now;
        });
        const total = sotSoon.length + sotExpired.length + fflSoon.length + fflExpired.length;
        if (total === 0) return null;
        return (
          <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-3 space-y-1.5">
            <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
              <span className="text-base">⚠️</span> Document Expiry Alerts — {total} dealer{total !== 1 ? "s" : ""} need attention
            </div>
            {sotExpired.map(d => <div key={`sot-exp-${d.id}`} className="text-xs text-yellow-700 dark:text-yellow-300">❌ <strong>{d.businessName}</strong> — SOT expired {d.sotExpiryDate || d.sotPeriodEnd}</div>)}
            {sotSoon.map(d => <div key={`sot-soon-${d.id}`} className="text-xs text-yellow-700 dark:text-yellow-300">🟡 <strong>{d.businessName}</strong> — SOT expiring {d.sotExpiryDate || d.sotPeriodEnd}</div>)}
            {fflExpired.map(d => <div key={`ffl-exp-${d.id}`} className="text-xs text-yellow-700 dark:text-yellow-300">❌ <strong>{d.businessName}</strong> — FFL expired {d.fflExpiryDate || d.fflExpiry}</div>)}
            {fflSoon.map(d => <div key={`ffl-soon-${d.id}`} className="text-xs text-yellow-700 dark:text-yellow-300">🟡 <strong>{d.businessName}</strong> — FFL expiring {d.fflExpiryDate || d.fflExpiry}</div>)}
          </div>
        );
      })()}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search dealers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background h-9"
          />
        </div>
        <Button onClick={onAddNew} className="h-9 text-sm gap-1.5">
          <Building2 className="w-4 h-4" /> Add Dealer
        </Button>
        <Button variant="outline" onClick={async () => {
          await fetch("/api/admin/dealers/link-submissions", { method: "POST" });
        }} className="h-9 text-sm">
          Link Submissions
        </Button>
      </div>

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
          : filtered.length === 0 ? <p className="text-center py-8 text-muted-foreground">
            {dealers.length === 0 ? "No dealers yet. Add one or link submissions." : "No dealers match your search."}
          </p>
          : filtered.map(d => <DealerCard key={d.id} dealer={d} onClick={() => onSelect(d)} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">EIN / SOT</th>
              <th className="px-3 py-2">SOT Status</th>
              <th className="px-3 py-2">FFL Status</th>
              <th className="px-3 py-2">Tax</th>
              <th className="px-3 py-2">Orders</th>
              <th className="px-3 py-2">Added</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={9} className="text-center py-8">Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">
                {dealers.length === 0 ? "No dealers yet." : "No dealers match your search."}
              </td></tr>
              : filtered.map(d => <DealerRow key={d.id} dealer={d} onClick={() => onSelect(d)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DealerCard({ dealer, onClick }: { dealer: Dealer; onClick: () => void }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:bg-secondary/5 cursor-pointer"
      onClick={onClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-sm">{dealer.businessName}</p>
          {dealer.city && dealer.state && <p className="text-xs text-muted-foreground">{dealer.city}, {dealer.state}</p>}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <SotBadge dealer={dealer} />
        <FflBadge dealer={dealer} />
        <TaxBadge dealer={dealer} />
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        
        {dealer.dealerOrderCount !== undefined && <span>Dealer Orders: <strong className="text-foreground">{dealer.dealerOrderCount}</strong></span>}
        {dealer.orderCount !== undefined && <span>Total: <strong className="text-foreground">{dealer.orderCount}</strong></span>}
      </div>
    </div>
  );
}

function DealerRow({ dealer, onClick }: { dealer: Dealer; onClick: () => void }) {
  return (
    <tr className="border-b border-border hover:bg-secondary/10 cursor-pointer" onClick={onClick}>
      <td className="px-3 py-3">
        <div className="font-semibold text-sm">{dealer.businessName}</div>
        {dealer.city && dealer.state && <div className="text-xs text-muted-foreground">{dealer.city}, {dealer.state}</div>}
      </td>
      <td className="px-3 py-3">
        <div className="text-sm">{dealer.contactName || "—"}</div>
        <div className="text-xs text-muted-foreground"><CopyableText text={dealer.email || ""} /></div>
      </td>
      <td className="px-3 py-3">
        {dealer.ein && <div className="text-xs font-mono">{dealer.ein}</div>}
        {dealer.sotLicenseType && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{dealer.sotLicenseType}</div>}
      </td>
      <td className="px-3 py-3"><SotBadge dealer={dealer} /></td>
      <td className="px-3 py-3"><FflBadge dealer={dealer} /></td>
      <td className="px-3 py-3"><TaxBadge dealer={dealer} /></td>
      <td className="px-3 py-3">
        <div className="flex gap-3 text-xs">
          
          {dealer.dealerOrderCount !== undefined && <span title="Dealer orders">📦 <strong>{dealer.dealerOrderCount}</strong></span>}
        </div>
        {dealer.demoFulfilledAt && <div className="text-xs text-muted-foreground mt-1">Demo: {fmtDate(dealer.demoFulfilledAt)}</div>}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
        {fmtDate(dealer.createdAt)}
      </td>
      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ── Dealer Detail / Edit View ─────────────────────────────────────────────────

function DealerDetail({
  dealer, onBack, onUpdate, onDeleteDealer, isSaving
}: {
  dealer: Dealer; onBack: () => void; onUpdate: (d: Dealer) => void; onDeleteDealer: () => void; isSaving: boolean;
}) {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [sotParsing, setSotParsing] = useState(false);
  const [fflParsing, setFflParsing] = useState(false);
  const [sotFile, setSotFile] = useState<File | null>(null);
  const [sotPreview, setSotPreview] = useState<string | null>(null);
  const [fflFile, setFflFile] = useState<File | null>(null);
  const [fflPreview, setFflPreview] = useState<string | null>(null);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [taxPreview, setTaxPreview] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const form = useForm<DealerFormValues>({
    resolver: zodResolver(dealerFormSchema),
    defaultValues: {
      businessName: dealer.businessName,
      contactName: dealer.contactName || "",
      email: dealer.email || "",
      phone: dealer.phone || "",
      ein: dealer.ein || "",
      businessAddress: dealer.businessAddress || "",
      city: dealer.city || "",
      state: dealer.state || "",
      zip: dealer.zip || "",
      sotLicenseType: dealer.sotLicenseType || "",
      sotTaxYear: dealer.sotTaxYear || "",
      sotPeriodStart: dealer.sotPeriodStart || "",
      sotPeriodEnd: dealer.sotPeriodEnd || "",
      sotControlNumber: dealer.sotControlNumber || "",
      sotReceiptDate: dealer.sotReceiptDate || "",
      fflLicenseNumber: dealer.fflLicenseNumber || "",
      fflLicenseType: dealer.fflLicenseType || "",
      fflExpiry: dealer.fflExpiry || "",
      fflLoaExpiry: dealer.fflLoaExpiry || "",
      taxExempt: dealer.taxExempt || false,
      taxExemptNotes: dealer.taxExemptNotes || "",
      salesTaxId: dealer.salesTaxId || "",
      notes: dealer.notes || "",
    },
  });

  const handleSotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setSotFile(file);
  };

  const handleFflFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFflPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setFflFile(file);
  };

  const handleTaxFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTaxPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setTaxFile(file);
  };

  const handleParseSot = async () => {
    if (!sotFile && !dealer.sotFileData) {
      toast({ title: "No SOT File", description: "Upload an SOT file first, then parse it.", variant: "destructive" });
      return;
    }
    setSotParsing(true);
    try {
      let fileData = dealer.sotFileData;
      if (sotFile) {
        fileData = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(sotFile);
        });
      }
      const res = await fetch("/api/admin/dealers/parse-sot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sotFileData: fileData, sotFileName: sotFile?.name || dealer.sotFileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const p = data.data.parsed;
      if (p.businessName) form.setValue("businessName", p.businessName);
      if (p.ein) form.setValue("ein", p.ein);
      if (p.businessAddress) form.setValue("businessAddress", p.businessAddress);
      if (p.zip) form.setValue("zip", p.zip);
      if (p.state) form.setValue("state", p.state);
      if (p.sotLicenseType) form.setValue("sotLicenseType", p.sotLicenseType);
      if (p.sotTaxYear) form.setValue("sotTaxYear", p.sotTaxYear);
      if (p.sotPeriodStart) form.setValue("sotPeriodStart", p.sotPeriodStart);
      if (p.sotPeriodEnd) form.setValue("sotPeriodEnd", p.sotPeriodEnd);
      if (p.sotControlNumber) form.setValue("sotControlNumber", p.sotControlNumber);
      if (p.sotReceiptDate) form.setValue("sotReceiptDate", p.sotReceiptDate);

      toast({ title: "SOT Parsed!", description: "Fields auto-filled from the SOT document." });
    } catch (err: any) {
      toast({ title: "Parse Failed", description: err.message, variant: "destructive" });
    } finally {
      setSotParsing(false);
    }
  };

  const handleParseFfl = async () => {
    if (!fflFile && !dealer.fflFileData) {
      toast({ title: "No FFL File", description: "Upload an FFL file first, then parse it.", variant: "destructive" });
      return;
    }
    setFflParsing(true);
    try {
      let fileData = dealer.fflFileData;
      if (fflFile) {
        fileData = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(fflFile);
        });
      }
      const res = await fetch("/api/admin/dealers/parse-ffl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fflFileData: fileData, fflFileName: fflFile?.name || dealer.fflFileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const p = data.data.parsed;
      if (p.businessName) form.setValue("businessName", p.businessName);
      if (p.fflLicenseNumber) form.setValue("fflLicenseNumber", p.fflLicenseNumber);
      if (p.fflLicenseType) form.setValue("fflLicenseType", p.fflLicenseType);
      if (p.fflExpiry) form.setValue("fflExpiry", p.fflExpiry);
      if (p.city) form.setValue("city", p.city);
      if (p.state) form.setValue("state", p.state);
      if (p.zip) form.setValue("zip", p.zip);

      toast({ title: "FFL Parsed!", description: "Fields auto-filled from the FFL document." });
    } catch (err: any) {
      toast({ title: "Parse Failed", description: err.message, variant: "destructive" });
    } finally {
      setFflParsing(false);
    }
  };

  const handleSave = async (values: DealerFormValues) => {
    try {
      let sotFileData = dealer.sotFileData;
      let sotFileName = dealer.sotFileName;
      if (sotFile) {
        sotFileData = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(sotFile);
        });
        sotFileName = sotFile.name;
      }

      let fflFileData = dealer.fflFileData;
      let fflFileName = dealer.fflFileName;
      if (fflFile) {
        fflFileData = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(fflFile);
        });
        fflFileName = fflFile.name;
      }

      const payload = {
        ...values,
        sotFileName,
        sotFileData: sotFileData || undefined,
        fflFileName,
        fflFileData: fflFileData || undefined,
      };

      const res = await fetch(`/api/admin/dealers/${dealer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast({ title: "Saved!", description: "Dealer profile updated." });
      setEditMode(false);
      onUpdate({ ...dealer, ...values, sotFileName, sotFileData, fflFileName, fflFileData });
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveTaxForm = async () => {
    if (!taxFile) return;
    try {
      const fileData = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(taxFile);
      });
      await fetch(`/api/admin/dealers/${dealer.id}/sales-tax-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesTaxFormName: taxFile.name, salesTaxFormData: fileData }),
      });
      toast({ title: "Tax Form Saved!", description: "Sales tax exemption form uploaded." });
    } catch {
      toast({ title: "Upload Failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{dealer.businessName}</h2>
          {dealer.city && dealer.state && <p className="text-xs text-muted-foreground">{dealer.city}, {dealer.state}</p>}
        </div>
        <div className="flex gap-2">
          <SotBadge dealer={dealer} />
          <TaxBadge dealer={dealer} />
        </div>
        {!editMode ? (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditMode(false); form.reset(); }}>Cancel</Button>
            <Button size="sm" onClick={form.handleSubmit(handleSave)} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {editMode ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="businessName"
                    render={({ field }) => (
                      <FormItem><FormLabel>Business Name *</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="contactName"
                    render={({ field }) => (
                      <FormItem><FormLabel>Contact Name</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="email"
                    render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="phone"
                    render={({ field }) => (
                      <FormItem><FormLabel>Phone</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="ein"
                    render={({ field }) => (
                      <FormItem><FormLabel>EIN</FormLabel>
                        <FormControl><Input {...field} placeholder="XX-XXXXXXX" className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="businessAddress"
                    render={({ field }) => (
                      <FormItem><FormLabel>Street Address</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="city"
                    render={({ field }) => (
                      <FormItem><FormLabel>City</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="state"
                    render={({ field }) => (
                      <FormItem><FormLabel>State</FormLabel>
                        <FormControl><Input {...field} maxLength={2} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  <FormField control={form.control} name="zip"
                    render={({ field }) => (
                      <FormItem><FormLabel>ZIP</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                </div>

                {/* SOT Section */}
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> SOT Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="sotLicenseType"
                      render={({ field }) => (
                        <FormItem><FormLabel>License Type</FormLabel>
                          <FormControl><Input {...field} placeholder="NFA FIREARMS MFGR (REDUCED)" className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="sotTaxYear"
                      render={({ field }) => (
                        <FormItem><FormLabel>Tax Year</FormLabel>
                          <FormControl><Input {...field} placeholder="2026" className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="sotPeriodStart"
                      render={({ field }) => (
                        <FormItem><FormLabel>Period Start</FormLabel>
                          <FormControl><Input {...field} placeholder="07/01/2025" className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="sotPeriodEnd"
                      render={({ field }) => (
                        <FormItem><FormLabel>Period End</FormLabel>
                          <FormControl><Input {...field} placeholder="06/30/2026" className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="sotControlNumber"
                      render={({ field }) => (
                        <FormItem><FormLabel>Control Number</FormLabel>
                          <FormControl><Input {...field} className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="sotReceiptDate"
                      render={({ field }) => (
                        <FormItem><FormLabel>Receipt Date</FormLabel>
                          <FormControl><Input {...field} placeholder="July 03, 2025" className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                  </div>

                  {/* SOT file upload */}
                  <div className="mt-3 space-y-2">
                    <label className="text-sm font-medium block">SOT Document</label>
                    <div className="flex gap-2 flex-wrap">
                      <div className="border-2 border-dashed border-border rounded-lg p-3 text-center hover:border-primary/50 transition-colors cursor-pointer flex-1 min-w-[200px]"
                        onClick={() => document.getElementById("sot-file-input")?.click()}>
                        <input id="sot-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleSotFileChange} />
                        {sotPreview ? (
                          <div className="space-y-1">
                            <img src={sotPreview} alt="SOT preview" className="max-h-24 mx-auto rounded object-contain" />
                            <p className="text-xs text-muted-foreground">{sotFile?.name}</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Click to upload SOT</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {dealer.sotFileData && dealer.sotFileName && (
                          <>
                            <FilePreview fileName={dealer.sotFileName} fileData={dealer.sotFileData} label="View Current" />
                            <FileDownload fileName={dealer.sotFileName} fileData={dealer.sotFileData} />
                          </>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={handleParseSot} disabled={sotParsing}
                          className="h-7 text-xs whitespace-nowrap">
                          {sotParsing ? "Parsing..." : "🤖 Parse SOT"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FFL Section */}
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> FFL Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="fflLicenseNumber"
                      render={({ field }) => (
                        <FormItem><FormLabel>License Number</FormLabel>
                          <FormControl><Input {...field} className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="fflLicenseType"
                      render={({ field }) => (
                        <FormItem><FormLabel>License Type</FormLabel>
                          <FormControl><Input {...field} className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="fflExpiry"
                      render={({ field }) => (
                        <FormItem><FormLabel>Expiry Date</FormLabel>
                          <FormControl><Input {...field} className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <FormField control={form.control} name="fflLoaExpiry"
                      render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">LOA Expiry <span className="text-muted-foreground font-normal">(internal — ATF LOA accepted as valid FFL)</span></FormLabel>
                          <FormControl><Input {...field} className="bg-background" placeholder="YYYY-MM-DD" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                  </div>

                  {/* FFL file upload */}
                  <div className="mt-3 space-y-2">
                    <label className="text-sm font-medium block">FFL Document</label>
                    <div className="flex gap-2 flex-wrap">
                      <div className="border-2 border-dashed border-border rounded-lg p-3 text-center hover:border-primary/50 transition-colors cursor-pointer flex-1 min-w-[200px]"
                        onClick={() => document.getElementById("ffl-file-input")?.click()}>
                        <input id="ffl-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFflFileChange} />
                        {fflPreview ? (
                          <div className="space-y-1">
                            <img src={fflPreview} alt="FFL preview" className="max-h-24 mx-auto rounded object-contain" />
                            <p className="text-xs text-muted-foreground">{fflFile?.name}</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Click to upload FFL</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {dealer.fflFileData && dealer.fflFileName && (
                          <>
                            <FilePreview fileName={dealer.fflFileName} fileData={dealer.fflFileData} label="View Current" />
                            <FileDownload fileName={dealer.fflFileName} fileData={dealer.fflFileData} />
                          </>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={handleParseFfl} disabled={fflParsing}
                          className="h-7 text-xs whitespace-nowrap">
                          {fflParsing ? "Parsing..." : "🤖 Parse FFL"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax Section */}
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    Tax Exemption
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="taxExempt"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 h-10">
                          <FormControl><input type="checkbox" className="w-4 h-4 accent-primary"
                            checked={field.value || false} onChange={field.onChange} /></FormControl>
                          <FormLabel className="mb-0">Tax Exempt</FormLabel>
                          <FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="salesTaxId"
                      render={({ field }) => (
                        <FormItem><FormLabel>Sales Tax ID / Exemption #</FormLabel>
                          <FormControl><Input {...field} className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                  </div>
                  <FormField control={form.control} name="taxExemptNotes"
                    render={({ field }) => (
                      <FormItem><FormLabel>Tax Notes</FormLabel>
                        <FormControl><Textarea {...field} rows={2} className="bg-background" placeholder="e.g. Texas — no state sales tax on NFA items" /></FormControl>
                        <FormMessage /></FormItem>
                    )} />

                  {/* Tax form upload */}
                  <div className="mt-3 space-y-2">
                    <label className="text-sm font-medium block">Sales Tax Exemption Form</label>
                    <div className="flex gap-2 flex-wrap">
                      <div className="border-2 border-dashed border-border rounded-lg p-3 text-center hover:border-primary/50 transition-colors cursor-pointer flex-1 min-w-[200px]"
                        onClick={() => document.getElementById("tax-file-input")?.click()}>
                        <input id="tax-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleTaxFileChange} />
                        {taxPreview ? (
                          <div className="space-y-1">
                            <img src={taxPreview} alt="Tax form preview" className="max-h-24 mx-auto rounded object-contain" />
                            <p className="text-xs text-muted-foreground">{taxFile?.name}</p>
                          </div>
                        ) : dealer.salesTaxFormData && dealer.salesTaxFormName ? (
                          <div className="space-y-1">
                            <FileText className="h-6 w-6 mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{dealer.salesTaxFormName} (current)</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Click to upload tax form</p>
                          </div>
                        )}
                      </div>
                      {taxFile && (
                        <Button type="button" size="sm" onClick={handleSaveTaxForm} className="h-9">
                          Save Tax Form
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="border-t border-border pt-4">
                  {/* Order status */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <FormField control={form.control} name="purchased"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Has Purchased</FormLabel>
                            <p className="text-xs text-muted-foreground">Dealer has placed an order</p>
                          </div>
                          <FormControl>
                            <input type="checkbox" checked={field.value ?? false}
                              onChange={field.onChange} className="accent-primary w-5 h-5 cursor-pointer" />
                          </FormControl>
                        </FormItem>
                      )} />
                    <FormField control={form.control} name="lastOrderDate"
                      render={({ field }) => (
                        <FormItem><FormLabel>Last Order Date</FormLabel>
                          <FormControl><Input type="date" {...field} className="bg-background" /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                  </div>
                  <FormField control={form.control} name="notes"
                    render={({ field }) => (
                      <FormItem><FormLabel>Internal Notes</FormLabel>
                        <FormControl><Textarea {...field} rows={3} className="bg-background"
                          placeholder="Private notes about this dealer..." /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                </div>
              </form>
            </Form>
          ) : (
            /* Read-only view */
            <div className="space-y-4">
              {/* Contact & Business */}
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Business & Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dealer.contactName && <div><span className="text-muted-foreground text-xs">Contact:</span> <strong>{dealer.contactName}</strong></div>}
                  {dealer.email && <div><span className="text-muted-foreground text-xs">Email:</span> <CopyableText text={dealer.email} /></div>}
                  {dealer.phone && <div><span className="text-muted-foreground text-xs">Phone:</span> <CopyableText text={dealer.phone} /></div>}
                  {dealer.ein && <div><span className="text-muted-foreground text-xs">EIN:</span> <CopyableText text={dealer.ein} /></div>}
                  {dealer.businessAddress && <div><span className="text-muted-foreground text-xs">Address:</span> {dealer.businessAddress}</div>}
                  {(dealer.city || dealer.state || dealer.zip) && (
                    <div><span className="text-muted-foreground text-xs">City/State/ZIP:</span> {[dealer.city, dealer.state, dealer.zip].filter(Boolean).join(", ")}</div>
                  )}
                </CardContent>
              </Card>

              {/* SOT */}
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" /> SOT Information
                    <SotBadge dealer={dealer} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dealer.sotLicenseType && <div><span className="text-muted-foreground text-xs">Type:</span> {dealer.sotLicenseType}</div>}
                  {dealer.sotTaxYear && <div><span className="text-muted-foreground text-xs">Tax Year:</span> {dealer.sotTaxYear}</div>}
                  {(dealer.sotPeriodStart || dealer.sotPeriodEnd) && (
                    <div><span className="text-muted-foreground text-xs">Period:</span> {dealer.sotPeriodStart} — {dealer.sotPeriodEnd}</div>
                  )}
                  {dealer.sotControlNumber && <div><span className="text-muted-foreground text-xs">Control #:</span> <CopyableText text={dealer.sotControlNumber} /></div>}
                  {dealer.sotReceiptDate && <div><span className="text-muted-foreground text-xs">Receipt Date:</span> {dealer.sotReceiptDate}</div>}
                  {dealer.sotFileName && (
                    <div className="flex gap-2 items-center">
                      <span className="text-muted-foreground text-xs">Document:</span>
                      <span className="text-xs">{dealer.sotFileName}</span>
                      {dealer.sotFileData && <><FilePreview fileName={dealer.sotFileName} fileData={dealer.sotFileData} /><FileDownload fileName={dealer.sotFileName} fileData={dealer.sotFileData} /></>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* FFL */}
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" /> FFL Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dealer.fflLicenseNumber && <div><span className="text-muted-foreground text-xs">License #:</span> <CopyableText text={dealer.fflLicenseNumber} /></div>}
                  {dealer.fflLicenseType && <div><span className="text-muted-foreground text-xs">Type:</span> {dealer.fflLicenseType}</div>}
                  {dealer.fflExpiry && <div><span className="text-muted-foreground text-xs">Expires:</span> {dealer.fflExpiry}</div>}
                  {dealer.fflFileName && (
                    <div className="flex gap-2 items-center">
                      <span className="text-muted-foreground text-xs">Document:</span>
                      <span className="text-xs">{dealer.fflFileName}</span>
                      {dealer.fflFileData && <><FilePreview fileName={dealer.fflFileName} fileData={dealer.fflFileData} /><FileDownload fileName={dealer.fflFileName} fileData={dealer.fflFileData} /></>}
                    </div>
                  )}
                  {!dealer.fflLicenseNumber && !dealer.fflFileName && (
                    <p className="text-xs text-muted-foreground italic">No FFL on file.</p>
                  )}
                </CardContent>
              </Card>

              {/* Tax */}
              <Card className="bg-card/50 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Tax Exemption <TaxBadge dealer={dealer} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {dealer.taxExempt ? (
                    <>
                      <div><span className="text-muted-foreground text-xs">Status:</span> <strong>Tax Exempt</strong></div>
                      {dealer.salesTaxId && <div><span className="text-muted-foreground text-xs">Tax ID:</span> <CopyableText text={dealer.salesTaxId} /></div>}
                      {dealer.taxExemptNotes && <div className="text-xs italic">{dealer.taxExemptNotes}</div>}
                    </>
                  ) : <p className="text-xs text-muted-foreground italic">No tax exemption on file.</p>}
                  {dealer.salesTaxFormData && dealer.salesTaxFormName && (
                    <div className="flex gap-2 items-center">
                      <span className="text-muted-foreground text-xs">Form:</span>
                      <span className="text-xs">{dealer.salesTaxFormName}</span>
                      <FilePreview fileName={dealer.salesTaxFormName} fileData={dealer.salesTaxFormData} label="View" />
                      <FileDownload fileName={dealer.salesTaxFormName} fileData={dealer.salesTaxFormData} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {dealer.notes && (
                <Card className="bg-card/50 border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Internal Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm italic whitespace-pre-wrap">{dealer.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: submission history */}
        <div className="space-y-4">
          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Inbox className="w-4 h-4" /> Order History
                {dealer.orderCount !== undefined && (
                  <Badge variant="secondary" className="text-xs ml-auto">{dealer.orderCount}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dealer.submissions && dealer.submissions.length > 0 ? (
                <div className="space-y-2">
                  {dealer.submissions.map(sub => (
                    <div key={sub.id} className="border-b border-border pb-2 last:border-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          sub.order_type === "demo_order" ? "bg-blue-600 text-white" :
                          sub.order_type === "dealer" ? "bg-orange-500 text-white" :
                          "bg-gray-500 text-white"
                        }`}>
                          {sub.order_type === "demo_order" ? "DEMO" :
                           sub.order_type === "dealer" ? "DEALER ORDER" : "INQUIRY"}
                        </span>
                        {sub.quantity && sub.quantity !== "1" && (
                          <span className="text-xs text-muted-foreground">×{sub.quantity}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{fmtDate(sub.createdAt)}</p>
                      {sub.trackingNumber && (
                        <p className="text-xs font-mono text-green-600 mt-0.5">✓ {sub.trackingNumber}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No submissions linked.</p>
              )}
              <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground flex gap-3">
                
                {dealer.dealerOrderCount !== undefined && <span>📦 Dealer Orders: {dealer.dealerOrderCount}</span>}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div><span className="text-muted-foreground">Added:</span> {fmtDate(dealer.createdAt)}</div>
              <div><span className="text-muted-foreground">Updated:</span> {dealer.updatedAt ? fmtDate(dealer.updatedAt) : "—"}</div>
              <div><span className="text-muted-foreground">Dealer ID:</span>
                <CopyableText text={dealer.id} />
              </div>
            </CardContent>
          </Card>

          <Button variant="destructive" className="w-full text-sm" onClick={() => setDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete Dealer
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dealer?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete {dealer.businessName} and all linked submission records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={onDeleteDealer}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Add Dealer Dialog ──────────────────────────────────────────────────────────

function AddDealerDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (d: Dealer) => void }) {
  const { toast } = useToast();
  const form = useForm<DealerFormValues>({
    resolver: zodResolver(dealerFormSchema),
    defaultValues: { businessName: "", contactName: "", email: "", phone: "", ein: "", businessAddress: "", city: "", state: "", zip: "" },
  });

  const handleAdd = async (values: DealerFormValues) => {
    try {
      const res = await fetch("/api/admin/dealers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Dealer Added!", description: `${values.businessName} has been added.` });
      onAdd({ ...data.data, orderCount: 0, dealerOrderCount: 0, submissions: [] });
      form.reset();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-bold">Add New Dealer</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAdd)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="businessName"
                render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Business Name *</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="contactName"
                render={({ field }) => (
                  <FormItem><FormLabel>Contact Name</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="phone"
                render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="email"
                render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="businessAddress"
                render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Street Address</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="city"
                render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="state"
                render={({ field }) => (
                  <FormItem><FormLabel>State</FormLabel>
                    <FormControl><Input {...field} maxLength={2} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="zip"
                render={({ field }) => (
                  <FormItem><FormLabel>ZIP</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="ein"
                render={({ field }) => (
                  <FormItem><FormLabel>EIN</FormLabel>
                    <FormControl><Input {...field} placeholder="XX-XXXXXXX" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">Add Dealer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Invoice Dialog ─────────────────────────────────────────────────────────────
function InvoiceDialog({ sub, open, onClose }: {
  sub: Submission | null; open: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);

  // Dealer = $60/unit no tax; Warranty = $10 flat S&H only
  const isWarranty = sub?.type === "warranty";
  const unitPrice = isWarranty ? 0 : 60.0;
  const subtotal = isWarranty ? 10.0 : quantity * unitPrice;
  const taxAmount = 0;
  const total = subtotal;

  // Pre-fill from submission when opened (including address)
  useEffect(() => {
    if (open && sub) {
      setCustomerName(sub.contactName || sub.retailCustomerName || "");
      setCustomerEmail(sub.email || sub.retailCustomerEmail || "");
      setCustomerPhone(sub.phone || sub.retailCustomerPhone || "");
      setCustomerAddress((sub as any).customerAddress || sub.retailCustomerAddress || "");
      setCustomerCity((sub as any).customerCity || sub.retailCustomerCity || "");
      setCustomerState((sub as any).customerState || sub.retailCustomerState || "");
      setCustomerZip((sub as any).customerZip || sub.retailCustomerZip || "");
      setQuantity(sub.quantity ? parseInt(sub.quantity) || 1 : 1);
    }
  }, [open, sub]);

  const handleSend = async () => {
    if (!customerName.trim()) { toast({ title: "Customer name required", variant: "destructive" }); return; }
    setSending(true);
    try {
      const res = await fetch("/api/admin/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: sub?.id || null,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          customerCity: customerCity.trim() || undefined,
          customerState: customerState.trim() || undefined,
          customerZip: customerZip.trim() || undefined,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invoice");
      toast({ title: "Invoice Sent!", description: `Invoice ${data.invoiceNumber} sent successfully.` });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  if (!sub) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {isWarranty ? "Send Warranty Invoice" : "Send Invoice"} — {sub.contactName || sub.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
          {/* Pricing summary */}
          <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
            <div className="text-xs text-muted-foreground mb-1">
              {isWarranty ? "Warranty" : "Dealer"} — {isWarranty ? "$10 flat S&H" : `${unitPrice.toFixed(2)}/unit`}
              {!isWarranty && <span className="ml-2 text-green-600 font-medium">No tax</span>}
            </div>
            {!isWarranty && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-24">Quantity:</label>
              <select
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="h-8 rounded border border-border bg-background px-2 text-sm"
              >
                {[1, 2, 3, 4, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-sm text-muted-foreground">× ${unitPrice.toFixed(2)} = ${subtotal.toFixed(2)}</span>
            </div>
            )}
            {isWarranty && (
              <div className="flex justify-between text-sm pl-0">
                <span>Shipping &amp; Handling:</span><span>$10.00</span>
              </div>
            )}
            {!isWarranty && (
            <div className="flex justify-between text-sm pl-24">
              <span>Subtotal:</span><span>${subtotal.toFixed(2)}</span>
            </div>
            )}
            <div className="flex justify-between font-bold text-sm pl-24 border-t border-border pt-1">
              <span>Total:</span><span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Customer fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block">Customer Name *</label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Email</label>
              <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@email.com" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Phone</label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="512-555-0100" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block">Street Address</label>
              <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="123 Main St" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">City</label>
              <Input value={customerCity} onChange={e => setCustomerCity(e.target.value)} placeholder="Austin" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block">State</label>
                <Input value={customerState} onChange={e => setCustomerState(e.target.value.toUpperCase().slice(0,2))} placeholder="TX" maxLength={2} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block">ZIP</label>
                <Input value={customerZip} onChange={e => setCustomerZip(e.target.value)} placeholder="78701" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="bg-green-600 hover:bg-green-700 text-white">
            <Send className="w-4 h-4 mr-1.5" />
            {sending ? "Sending..." : `Send Invoice — $${total.toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ship Dialog ───────────────────────────────────────────────────────────────

function ShipDialog({ sub, open, onClose }: {
  sub: Submission | null; open: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const [tracking, setTracking] = useState("");
  const [atfFile, setAtfFile] = useState<File | null>(null);
  const [atfPreview, setAtfPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) { setTracking(""); setAtfFile(null); setAtfPreview(null); } }, [open]);

  const handleAtfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAtfPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setAtfFile(file);
  };

  const handleShip = async () => {
    if (!sub || !tracking.trim()) { toast({ title: "Tracking Required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      let atfData: string | undefined;
      if (atfFile) {
        atfData = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(atfFile);
        });
      }
      const res = await fetch(`/api/admin/submissions/${sub.id}/ship`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: tracking.trim(), atfFormName: atfFile?.name || null, atfFormData: atfData || null }),
      });
      if (!res.ok) throw new Error("Ship failed");
      toast({ title: "Order Shipped!", description: `Tracking: ${tracking.trim()}` });
      onClose();
    } catch { toast({ title: "Error", variant: "destructive" }); } finally { setSaving(false); }
  };

  if (!sub) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Mark Order as Shipped</DialogTitle>
          <p className="text-sm text-muted-foreground">{sub.contactName} · {sub.businessName} · Qty: {sub.quantity || "N/A"}</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium block mb-1.5">Tracking Number <span className="text-red-500">*</span></label>
            <Input placeholder="1Z999AA10123456784" value={tracking} onChange={e => setTracking(e.target.value)} className="bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">ATF Form 5320.3 <span className="text-xs text-muted-foreground font-normal">(optional)</span></label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("atf-file-input")?.click()}>
              <input id="atf-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleAtfChange} />
              {atfPreview ? (
                <div className="space-y-2">
                  <img src={atfPreview} alt="ATF preview" className="max-h-32 mx-auto rounded object-contain" />
                  <p className="text-xs text-muted-foreground">{atfFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload ATF Form 5320.3</p>
                  <p className="text-xs text-muted-foreground">PDF, PNG, JPG accepted</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleShip} disabled={saving}>
            {saving ? "Saving..." : "Confirm & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Warranty Tab ───────────────────────────────────────────────────────────────

function WarrantyTab({
  requests, search, setSearch, statusFilter, setStatusFilter, onRefresh
}: {
  requests: any[]; search: string; setSearch: (s: string) => void;
  statusFilter: string; setStatusFilter: (s: string) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered = requests.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const s = `${r.contact_name || ""} ${r.email || ""} ${r.serial_number || ""} ${r.description || ""}`.toLowerCase();
      if (!s.includes(q)) return false;
    }
    return true;
  });

  const handleStatusChange = async (id: number, newStatus: string) => {
    setUpdating(String(id));
    try {
      const res = await fetch(`/api/admin/warranty-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast({ title: "Status updated", description: newStatus });
      onRefresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally { setUpdating(null); }
  };

  const statusColor = (s: string) => {
    if (s === "closed" || s === "rejected") return "bg-gray-500 text-white";
    if (s === "approved" || s === "completed") return "bg-green-600 text-white";
    if (s === "under_review") return "bg-blue-600 text-white";
    if (s === "pending") return "bg-orange-500 text-white";
    return "bg-gray-400 text-white";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search warranty claims..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:max-w-xs bg-background h-9"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-md bg-background border border-border px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="h-9 text-xs">Refresh</Button>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Serial #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No warranty claims found.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-border hover:bg-secondary/10">
                <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                  {r.created_at ? fmtDate(r.created_at) : "—"}
                </td>
                <td className="px-3 py-3">
                  <select
                    value={r.status || "pending"}
                    disabled={updating === String(r.id)}
                    onChange={e => handleStatusChange(r.id, e.target.value)}
                    className={`h-7 rounded border text-xs px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ${statusColor(r.status || "pending")}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs">{r.request_type || "—"}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="font-mono text-xs">{r.serial_number || "—"}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm">{r.customer_name || "—"}</div>
                  {r.customer_email && <div className="text-xs text-muted-foreground"><CopyableText text={r.customer_email} /></div>}
                </td>
                <td className="px-3 py-3">
                  <div className="text-xs max-w-[200px] truncate">{r.description || "—"}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-xs text-muted-foreground max-w-[120px] truncate">{r.admin_notes || "—"}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No warranty claims found.</p>
        ) : filtered.map(r => (
          <div key={r.id} className="border border-border rounded-lg p-3 bg-card hover:bg-secondary/5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{r.created_at ? fmtDate(r.created_at) : "—"}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColor(r.status || "pending")}`}>
                  {r.status?.replace("_", " ").toUpperCase() || "PENDING"}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm"><strong>{r.request_type || "—"}</strong></p>
              <p className="text-xs text-muted-foreground">Serial: <span className="font-mono">{r.serial_number || "—"}</span></p>
              <p className="text-xs text-muted-foreground">{r.customer_name || "—"} {r.customer_email && `(${r.customer_email})`}</p>
              {r.description && <p className="text-xs border-t border-border pt-1 mt-1">{r.description}</p>}
              {r.admin_notes && <p className="text-xs text-muted-foreground italic">Note: {r.admin_notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Doc Expiry Caution Banner ─────────────────────────────────────────────

function DocCautionBanner({ dealer }: { dealer: any }) {
  const now = new Date();
  const fflExpired = !dealer.dealer_ffl_on_file || (dealer.dealer_ffl_expiry && new Date(dealer.dealer_ffl_expiry) < now);
  const sotExpired = !dealer.dealer_sot_on_file || (dealer.dealer_sot_expiry && new Date(dealer.dealer_sot_expiry) < now);
  if (!fflExpired && !sotExpired) return null;
  return (
    <div className="rounded border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1 mt-1.5 text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-1.5">
      <span className="font-semibold">⚠️ EXPIRED</span>
      {!dealer.dealer_ffl_on_file || (dealer.dealer_ffl_expiry && new Date(dealer.dealer_ffl_expiry) < now) && <span>FFL {!dealer.dealer_ffl_on_file ? "missing" : "expired"}{dealer.dealer_ffl_expiry ? ` (${dealer.dealer_ffl_expiry})` : ""}</span>}
      {!dealer.dealer_sot_on_file || (dealer.dealer_sot_expiry && new Date(dealer.dealer_sot_expiry) < now) && <span>SOT {!dealer.dealer_sot_on_file ? "missing" : "expired"}{dealer.dealer_sot_expiry ? ` (${dealer.dealer_sot_expiry})` : ""}</span>}
    </div>
  );
}

// ── Dealer Inquiries Tab ───────────────────────────────────────────────────

function DealerInquiriesTab({
  submissions, search, setSearch, onDelete
}: {
  submissions: (Submission & { source?: string; dealer_ffl_on_file?: boolean; dealer_ffl_expiry?: string; dealer_sot_on_file?: boolean; dealer_sot_expiry?: string; dealer_ffl_license_number?: string })[];
  search: string;
  setSearch: (s: string) => void;
  onDelete: (sub: Submission & { source?: string }) => void;
}) {
  const filtered = submissions.filter((sub) => {
    if (search) {
      const q = search.toLowerCase();
      const s = `${fmtDate(sub.createdAt)} ${sub.contactName} ${sub.businessName} ${sub.email} ${sub.phone}`.toLowerCase();
      if (!s.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search dealer inquiries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs bg-background h-9"
        />
      </div>

      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? <p className="text-center py-8 text-muted-foreground">No dealer inquiries.</p>
          : filtered.map(sub => (
            <div key={sub.id} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500 text-white">LEAD</span>
                  <span className="text-xs text-muted-foreground font-mono">{fmtDate(sub.createdAt)}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500" onClick={() => onDelete(sub)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{sub.businessName || "—"}</p>
                <p className="text-xs text-muted-foreground">{sub.contactName || "—"}</p>
                <p className="text-xs text-muted-foreground">{sub.email || "—"}</p>
                {sub.phone && <p className="text-xs text-muted-foreground">{sub.phone}</p>}
                <DocCautionBanner dealer={sub} />
              </div>
            </div>
          ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No dealer inquiries found.</td></tr>
              : filtered.map(sub => (
                <tr key={sub.id} className="border-b border-border hover:bg-secondary/10">
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{fmtDate(sub.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{sub.businessName || "—"}</div>
                    <DocCautionBanner dealer={sub} />
                  </td>
                  <td className="px-3 py-2">{sub.contactName || "—"}</td>
                  <td className="px-3 py-2">{sub.email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{sub.phone || "—"}</td>
                  <td className="px-3 py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => onDelete(sub)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Retail Inquiries Tab ───────────────────────────────────────────────────────

function RetailInquiriesTab({
  submissions, search, setSearch, onDelete
}: {
  submissions: (Submission & {
    dealerId?: string; dealerName?: string; contactName?: string;
    email?: string; phone?: string; message?: string; createdAt?: string;
    status?: string; dealerFflonFile?: boolean; dealerFflExpiry?: string;
    dealerSotOnFile?: boolean; dealerSotExpiry?: string;
    dealerFflLicenseNumber?: string;
  })[];
  search: string;
  setSearch: (s: string) => void;
  onDelete: (sub: any) => void;
}) {
  const filtered = submissions.filter((sub) => {
    if (search) {
      const q = search.toLowerCase();
      const s = `${fmtDate(sub.createdAt)} ${sub.contactName || ""} ${sub.dealerName || ""} ${sub.email || ""} ${sub.phone || ""}`.toLowerCase();
      if (!s.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search retail inquiries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs bg-background h-9"
        />
      </div>

      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? <p className="text-center py-8 text-muted-foreground">No retail inquiries.</p>
          : filtered.map(sub => (
            <div key={sub.id} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500 text-white">RETAIL</span>
                  <span className="text-xs text-muted-foreground font-mono">{fmtDate(sub.createdAt)}</span>
                  {sub.status && <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.status === "responded" ? "bg-green-500 text-white" : sub.status === "new" ? "bg-blue-500 text-white" : "bg-gray-500 text-white"}`}>{sub.status.toUpperCase()}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500" onClick={() => onDelete(sub)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{sub.dealerName || "—"}</p>
                <p className="text-xs text-muted-foreground">{sub.contactName || "—"}</p>
                <p className="text-xs text-muted-foreground">{sub.email || "—"}</p>
                {sub.phone && <p className="text-xs text-muted-foreground">{sub.phone}</p>}
                {sub.message && <p className="text-xs mt-1 italic text-muted-foreground">"{sub.message}"</p>}
              </div>
            </div>
          ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Dealer</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No retail inquiries found.</td></tr>
              : filtered.map(sub => (
                <tr key={sub.id} className="border-b border-border hover:bg-secondary/10">
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{fmtDate(sub.createdAt)}</td>
                  <td className="px-3 py-2 font-medium">{sub.dealerName || "—"}</td>
                  <td className="px-3 py-2">{sub.contactName || "—"}</td>
                  <td className="px-3 py-2">{sub.email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{sub.phone || "—"}</td>
                  <td className="px-3 py-2 text-xs max-w-xs truncate">{sub.message || "—"}</td>
                  <td className="px-3 py-2">
                    {sub.status && <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.status === "responded" ? "bg-green-500 text-white" : sub.status === "new" ? "bg-blue-500 text-white" : "bg-gray-500 text-white"}`}>{sub.status.toUpperCase()}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => onDelete(sub)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ── Tax Forms Tab ─────────────────────────────────────────────────────────────

function TaxFormsTab() {
  const { toast } = useToast();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [sendingLink, setSendingLink] = useState<string | null>(null);

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tax-forms");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setForms(Array.isArray(data.data) ? data.data : []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const handleSendUploadLink = async (dealerId: string, submissionId?: string, fflNumber?: string) => {
    try {
      setSendingLink(dealerId);
      const res = await fetch("/api/tax-form/send-upload-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerId, submissionId, fflNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast({ title: "Link Sent", description: `Upload link emailed to dealer. Token: ${data.token.slice(0, 8)}...` });
      fetchForms();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSendingLink(null);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tax-forms/${id}/accept`, { method: "POST" });
      if (!res.ok) throw new Error("Accept failed");
      toast({ title: "Accepted", description: "Tax form accepted and filed to 3dprintmanager." });
      setReviewTarget(null);
      fetchForms();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeny = async (id: string) => {
    if (!denyReason.trim()) {
      toast({ title: "Reason Required", description: "Please enter a reason for the denial.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/admin/tax-forms/${id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: denyReason }),
      });
      if (!res.ok) throw new Error("Deny failed");
      toast({ title: "Denied", description: "Dealer notified with re-upload link." });
      setReviewTarget(null);
      setDenyReason("");
      fetchForms();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = statusFilter === "all" ? forms : forms.filter(f => f.status === statusFilter);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: "Pending", cls: "bg-yellow-600/20 text-yellow-400 border-yellow-600/40" },
      uploaded: { label: "Uploaded", cls: "bg-blue-600/20 text-blue-400 border-blue-600/40" },
      accepted: { label: "Accepted", cls: "bg-green-600/20 text-green-400 border-green-600/40" },
      denied: { label: "Denied", cls: "bg-red-600/20 text-red-400 border-red-600/40" },
    };
    const b = map[status] || { label: status, cls: "bg-gray-600/20 text-gray-400 border-gray-600/40" };
    return <Badge className={`border ${b.cls}`}>{b.label}</Badge>;
  };

  if (loading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg font-semibold">Tax Form Submissions</h2>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-background border border-border text-sm rounded px-2 py-1.5"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="uploaded">Uploaded</option>
          <option value="accepted">Accepted</option>
          <option value="denied">Denied</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tax form records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Dealer</th>
                <th className="pb-2 pr-4 font-medium">FFL</th>
                <th className="pb-2 pr-4 font-medium">File</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Uploaded</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(form => (
                <tr key={form.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium">{form.dealer_name}</div>
                    <div className="text-xs text-muted-foreground">{form.dealer_contact}</div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{form.ffl_license_number || form.ffl_number}</td>
                  <td className="py-2.5 pr-4 text-xs">{form.file_name || "—"}</td>
                  <td className="py-2.5 pr-4">{statusBadge(form.status)}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                    {form.uploaded_at ? format(parseISO(form.uploaded_at), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2 flex-wrap">
                      {form.status === "pending" && (
                        <Button
                          variant="outline" size="sm" className="text-xs h-7"
                          onClick={() => handleSendUploadLink(form.dealer_id, form.submission_id, form.ffl_number)}
                          disabled={sendingLink === form.dealer_id}
                        >
                          <Send className="w-3 h-3 mr-1" />Send Upload Link
                        </Button>
                      )}
                      {(form.status === "uploaded" || form.status === "denied") && (
                        <Button
                          variant="outline" size="sm" className="text-xs h-7"
                          onClick={() => { setReviewTarget(form); setPreviewPdf(form.file_data ? `data:application/pdf;base64,${form.file_data}` : null); }}
                        >
                          <Eye className="w-3 h-3 mr-1" />Review
                        </Button>
                      )}
                      {form.status === "accepted" && (
                        <span className="text-xs text-muted-foreground flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1 text-green-500" />Filed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={open => !open && (setReviewTarget(null), setDenyReason(""), setPreviewPdf(null))}>
        <DialogContent className="bg-card border-border max-w-3xl w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Tax Form — {reviewTarget?.dealer_name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded border border-border bg-muted/30">
            {previewPdf ? (
              <iframe src={previewPdf} className="w-full h-[60vh] rounded" title="Tax Form PDF" />
            ) : (
              <div className="flex items-center justify-center h-[60vh] text-muted-foreground text-sm">
                No PDF available for preview
              </div>
            )}
          </div>
          {reviewTarget?.status !== "accepted" && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Reason for denial (optional)..."
                  value={denyReason}
                  onChange={e => setDenyReason(e.target.value)}
                  rows={2}
                  className="bg-background border-border text-sm flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-green-400 border-green-600/40 hover:bg-green-600/10"
                  onClick={() => handleAccept(reviewTarget?.id)}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />Accept
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-400 border-red-600/40 hover:bg-red-600/10"
                  onClick={() => handleDeny(reviewTarget?.id)}
                >
                  <XCircle className="w-4 h-4 mr-1" />Deny &amp; Notify
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Serials Tab ────────────────────────────────────────────────────────────────

function SerialsTab() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/label-runs");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRuns(Array.isArray(data.data) ? data.data : []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const handleDownload = async (run: any) => {
    setDownloading(run.id);
    try {
      const res = await fetch(`/api/admin/labels/download?path=${encodeURIComponent(run.filename)}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = run.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: run.filename });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <p className="text-muted-foreground text-sm">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Serial Label Runs</h2>
          <p className="text-sm text-muted-foreground">All generated label strips — click to re-download.</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchRuns}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {runs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No label runs yet. Generate your first set from the Files tab.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Range</th>
                <th className="pb-2 pr-4 font-medium">Count</th>
                <th className="pb-2 pr-4 font-medium">Generated</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2.5 pr-4 font-mono text-sm">
                    {run.start_serial} – {run.end_serial}
                  </td>
                  <td className="py-2.5 pr-4">{run.label_count} labels</td>
                  <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                    {new Date(run.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5">
                    <Button
                      variant="outline" size="sm" className="text-xs h-7 gap-1.5"
                      onClick={() => handleDownload(run)}
                      disabled={downloading === run.id}
                    >
                      <Download className="w-3 h-3" />
                      {downloading === run.id ? "Preparing..." : "Download"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Files Tab ─────────────────────────────────────────────────────────────────

function FilesTab() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const sources = [
    {
      key: "rebel_dealer_list",
      label: "Rebel Dealer List",
      description: "826 dealers from Tom's uploaded list (35 Preferred, 791 Standard).",
      countLabel: "826 dealers",
    },
    {
      key: "web_form",
      label: "Web Form Submissions",
      description: "9 dealers who submitted through the website form.",
      countLabel: "9 dealers",
    },
    {
      key: "manual",
      label: "Manual Entries",
      description: "3 manually entered Preferred dealers.",
      countLabel: "3 dealers",
    },
    {
      key: "master_ffl",
      label: "Master FFL CSV",
      description: "Cleaned ATF FFL dealer list — 69,905 active FFL holders (types 1, 2, 7).",
      countLabel: "69,905 dealers",
    },
    {
      key: "ffl_zip_match",
      label: "FFL ZIP Match",
      description: "Master FFL rows where ZIP matches Tom's Rebel dealer list — 5,307 records.",
      countLabel: "5,307 dealers",
    },
    {
      key: "compliance_template",
      label: "Compliance Pages Template",
      description: "Text file with draft Privacy Policy, Refund Policy, Shipping Policy, Terms of Service, and Cookie Policy — ready for Tom to edit and upload.",
      countLabel: "5 pages",
    },
  ];

  const handleDownload = async (key: string) => {
    setDownloading(key);
    try {
      const res = await fetch(`/api/admin/dealers/export/${key}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Download failed");
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `dealers_${key}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: filename });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
        <h2 className="text-lg font-semibold mb-1">Data Export</h2>
        <p className="text-sm text-muted-foreground">
          Download dealer records by source. These are all sources <em>outside</em> the ATF master FFL list.
        </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sources.map(src => (
          <Card key={src.key} className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{src.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{src.description}</p>
              <p className="text-xs font-medium text-primary">{src.countLabel}</p>
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={() => handleDownload(src.key)}
                disabled={downloading === src.key}
              >
                <Download className="w-3.5 h-3.5" />
                {downloading === src.key ? "Preparing..." : "Download CSV"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { toast } = useToast();
  const [authStatus, setAuthStatus] = useState<"checking" | "needs_pin" | "pin_sent" | "authorized">("checking");
  const [tab, setTab] = useState<Tab>("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedFromFilter, setArchivedFromFilter] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [archiveTarget, setArchiveTarget] = useState<Submission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [shipTarget, setShipTarget] = useState<Submission | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Submission | null>(null);
  const [warrantyRequests, setWarrantyRequests] = useState<any[]>([]);
  const [warrantySearch, setWarrantySearch] = useState("");
  const [warrantyStatus, setWarrantyStatus] = useState("all");
  const [dealerInquiries, setDealerInquiries] = useState<any[]>([]);
  const [dealerInquiriesSearch, setDealerInquiriesSearch] = useState("");
  const [dealerInquiryDeleteTarget, setDealerInquiryDeleteTarget] = useState<any | null>(null);
  const [retailInquiries, setRetailInquiries] = useState<any[]>([]);
  const [retailInquiriesSearch, setRetailInquiriesSearch] = useState("");
  const [retailInquiryDeleteTarget, setRetailInquiryDeleteTarget] = useState<any | null>(null);
  const [retailInquiryStatus, setRetailInquiryStatus] = useState("all");

  const pinForm = useForm<z.infer<typeof pinSchema>>({ resolver: zodResolver(pinSchema), defaultValues: { pin: "" } });

  const fetchSubmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/submissions?includeArchived=${showArchived}`);
      if (res.status === 403) { setAuthStatus("needs_pin"); setIsLoading(false); return; }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const normalized = Array.isArray(data.data) ? data.data : [];
      setSubmissions(normalized);
      setAuthStatus("authorized");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  }, [showArchived]);

  const fetchDealers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dealers");
      if (!res.ok) throw new Error("Failed to fetch dealers");
      const data = await res.json();
      setDealers(Array.isArray(data.data) ? data.data : []);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  }, []);

  const fetchWarrantyRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/warranty-requests");
      if (!res.ok) throw new Error("Failed to fetch warranty requests");
      const data = await res.json();
      setWarrantyRequests(Array.isArray(data.data) ? data.data : []);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  }, []);

  const fetchDealerInquiries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dealer-inquiries");
      if (!res.ok) throw new Error("Failed to fetch dealer inquiries");
      const data = await res.json();
      // Normalize snake_case from DB to camelCase for the tab component
      const normalized = (data.data || []).map((r: any) => ({
        id: r.id,
        source: r.source,
        contactName: r.contact_name,
        businessName: r.business_name,
        email: r.email,
        phone: r.phone,
        message: r.message,
        createdAt: r.created_at,
        dealer_ffl_on_file: r.dealer_ffl_on_file,
        dealer_ffl_expiry: r.dealer_ffl_expiry,
        dealer_sot_on_file: r.dealer_sot_on_file,
        dealer_sot_expiry: r.dealer_sot_expiry,
        dealer_ffl_license_number: r.dealer_ffl_license_number,
      }));
      setDealerInquiries(normalized);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  }, []);

  // Fetch dealer inquiries from combined API (submissions leads only)
  useEffect(() => {
    fetchDealerInquiries();
  }, [fetchDealerInquiries]);

  const fetchRetailInquiries = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/retail-inquiries?status=${retailInquiryStatus}`);
      if (!res.ok) throw new Error("Failed to fetch retail inquiries");
      const data = await res.json();
      const normalized = (data.data || []).map((r: any) => ({
        id: r.id,
        dealerId: r.dealer_id,
        dealerName: r.dealer_name,
        contactName: r.contact_name,
        email: r.email,
        phone: r.phone,
        message: r.message,
        createdAt: r.created_at,
        status: r.status,
        dealerFflonFile: r.dealer_ffl_on_file,
        dealerFflExpiry: r.dealer_ffl_expiry,
        dealerSotOnFile: r.dealer_sot_on_file,
        dealerSotExpiry: r.dealer_sot_expiry,
        dealerFflLicenseNumber: r.dealer_ffl_license_number,
      }));
      setRetailInquiries(normalized);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  }, [retailInquiryStatus]);

  useEffect(() => {
    fetchRetailInquiries();
  }, [fetchRetailInquiries]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/check-auth")
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.authorized) {
          fetchSubmissions();
          fetchWarrantyRequests();
          fetchDealerInquiries();
          fetchRetailInquiries();
          setAuthStatus("authorized");
        }
        else setAuthStatus("needs_pin");
      })
      .catch(() => { if (!cancelled) setAuthStatus("needs_pin"); });
    return () => { cancelled = true; };
  }, [fetchSubmissions, fetchWarrantyRequests, fetchDealerInquiries, fetchRetailInquiries]);

  const onRequestPin = async () => {
    try {
      const res = await fetch("/api/admin/request-pin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Request Failed", description: data.error || "Could not request PIN", variant: "destructive" }); return; }
      toast({ title: "PIN Sent", description: "Check the #general channel on Discord for your PIN." });
      setAuthStatus("pin_sent");
    } catch { toast({ title: "Error", description: "Network error", variant: "destructive" }); }
  };

  const onVerifyPin = async (values: z.infer<typeof pinSchema>) => {
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: values.pin }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Invalid PIN", description: data.error || "The PIN was invalid or expired.", variant: "destructive" }); pinForm.reset(); return; }
      setAuthStatus("authorized");
      fetchSubmissions();
    } catch { toast({ title: "Error", description: "Network error", variant: "destructive" }); }
  };

  const onLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthStatus("needs_pin");
    setSubmissions([]);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/submissions/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSubmissions(prev => prev.filter(s => s.id !== deleteTarget.id));
      toast({ title: "Deleted", description: "Submission removed." });
    } catch { toast({ title: "Error", description: "Could not delete.", variant: "destructive" }); }
    finally { setDeleteTarget(null); }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      const isArchived = archiveTarget.archived;
      const endpoint = isArchived
        ? `/api/admin/submissions/${archiveTarget.id}/unarchive`
        : `/api/admin/submissions/${archiveTarget.id}/archive${tab !== "archives" ? `?from=${tab}` : ""}`;
      const method = "PATCH";
      const res = await fetch(endpoint, { method });
      if (!res.ok) throw new Error("Archive failed");
      setSubmissions(prev => prev.map(s => s.id === archiveTarget.id ? { ...s, archived: !isArchived, archived_from: isArchived ? undefined : tab } : s));
      toast({ title: isArchived ? "Unarchived" : "Archived", description: isArchived ? "Submission restored." : "Submission moved to archived." });
    } catch { toast({ title: "Error", description: "Could not archive.", variant: "destructive" }); }
    finally { setArchiveTarget(null); }
  };

  const handleDealerInquiryDelete = async () => {
    if (!dealerInquiryDeleteTarget) return;
    try {
      const res = await fetch(`/api/admin/dealer-inquiries/${dealerInquiryDeleteTarget.source}/${dealerInquiryDeleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDealerInquiries(prev => prev.filter(s => s.id !== dealerInquiryDeleteTarget.id));
      toast({ title: "Deleted", description: "Dealer inquiry removed." });
    } catch { toast({ title: "Error", description: "Could not delete.", variant: "destructive" }); }
    finally { setDealerInquiryDeleteTarget(null); }
  };

  const handleRetailInquiryDelete = async () => {
    if (!retailInquiryDeleteTarget) return;
    try {
      const res = await fetch(`/api/admin/retail-inquiries/${retailInquiryDeleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setRetailInquiries(prev => prev.filter(s => s.id !== retailInquiryDeleteTarget.id));
      toast({ title: "Deleted", description: "Retail inquiry removed." });
    } catch { toast({ title: "Error", description: "Could not delete.", variant: "destructive" }); }
    finally { setRetailInquiryDeleteTarget(null); }
  };


  if (authStatus === "checking") {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Checking access...</p></div>;
  }

  if (authStatus === "needs_pin" || authStatus === "pin_sent") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border shadow-2xl pt-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">🔐 Admin Access</CardTitle>
            <p className="text-center text-muted-foreground text-sm mt-2">
              {authStatus === "needs_pin" ? "Request a PIN to access the admin panel."
                : "Enter the PIN posted in #general on Discord."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {authStatus === "needs_pin" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Clicking below will post a 6-digit PIN to the <strong>#general</strong> Discord channel.
                </p>
                <Button onClick={onRequestPin} className="w-full text-black bg-primary hover:bg-primary/90">
                  Request PIN
                </Button>
              </div>
            )}
            {authStatus === "pin_sent" && (
              <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(onVerifyPin)} className="space-y-4">
                  <FormField control={pinForm.control} name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>6-Digit PIN</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="123456"
                            className="text-center text-2xl tracking-widest font-mono bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  <Button type="submit" className="w-full text-black bg-primary hover:bg-primary/90">Unlock</Button>
                  <button type="button" onClick={() => setAuthStatus("needs_pin")}
                    className="w-full text-xs text-muted-foreground hover:text-primary transition-colors">Need a new PIN?</button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-primary">Admin Dashboard</h1>
          <Button variant="outline" size="sm" onClick={onLogout}>Logout</Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          <button
            onClick={() => { setTab("submissions"); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "submissions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="w-4 h-4 inline mr-1.5" />Orders
            <Badge variant="secondary" className="ml-2 text-xs">{submissions.length}</Badge>
          </button>
          <button
            onClick={() => { setTab("warranty"); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "warranty" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4 inline mr-1.5" />Warranty
            <Badge variant="secondary" className="ml-2 text-xs">{warrantyRequests.length}</Badge>
          </button>
          <button
            onClick={() => { setTab("dealer_inquiries"); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "dealer_inquiries" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Phone className="w-4 h-4 inline mr-1.5" />Dealer Inquiries
            <Badge variant="secondary" className="ml-2 text-xs">{dealerInquiries.length}</Badge>
          </button>
          <button
            onClick={() => { setTab("retail_inquiries"); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "retail_inquiries" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store className="w-4 h-4 inline mr-1.5" />Retail Inquiries
            <Badge variant="secondary" className="ml-2 text-xs">{retailInquiries.length}</Badge>
          </button>
          <button
            onClick={() => { setTab("files"); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "files" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Files className="w-4 h-4 inline mr-1.5" />Files
          </button>
          <button
            onClick={() => { setTab("tax_forms"); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "tax_forms" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-1.5" />Tax Forms
          </button>
          <button
            onClick={() => { setTab("archives"); }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "archives" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Archives
          </button>
        </div>

        {/* Tab content */}
        {tab === "submissions" && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 md:p-6">
              <SubmissionsTab
                submissions={submissions} isLoading={isLoading}
                search={search} setSearch={setSearch}
                sortDir={sortDir} setSortDir={setSortDir}
                showArchived={showArchived} setShowArchived={setShowArchived}
                setArchiveTarget={setArchiveTarget}
                setShipTarget={setShipTarget} setInvoiceTarget={setInvoiceTarget}
                onFetchSubmissions={fetchSubmissions}
              />
            </CardContent>
          </Card>
        )}

        {tab === "warranty" && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 md:p-6">
              <WarrantyTab
                requests={warrantyRequests}
                search={warrantySearch}
                setSearch={setWarrantySearch}
                statusFilter={warrantyStatus}
                setStatusFilter={setWarrantyStatus}
                onRefresh={fetchWarrantyRequests}
              />
            </CardContent>
          </Card>
        )}

        {tab === "dealer_inquiries" && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 md:p-6">
              <DealerInquiriesTab
                submissions={dealerInquiries}
                search={dealerInquiriesSearch}
                setSearch={setDealerInquiriesSearch}
                onDelete={(sub) => setDealerInquiryDeleteTarget(sub)}
              />
            </CardContent>
          </Card>
        )}

        {tab === "retail_inquiries" && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 md:p-6">
              <RetailInquiriesTab
                submissions={retailInquiries}
                search={retailInquiriesSearch}
                setSearch={setRetailInquiriesSearch}
                onDelete={(sub) => setRetailInquiryDeleteTarget(sub)}
              />
            </CardContent>
          </Card>
        )}

        {tab === "files" && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 md:p-6">
              <FilesTab />
            </CardContent>
          </Card>
        )}

        {tab === "tax_forms" && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 md:p-6">
              <TaxFormsTab />
            </CardContent>
          </Card>
        )}

        {tab === "archives" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Archived Submissions</h2>
              <select
                value={archivedFromFilter}
                onChange={e => setArchivedFromFilter(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              >
                <option value="">All Sources</option>
                <option value="orders">Orders</option>
                <option value="warranty">Warranty</option>
                <option value="dealer_inquiries">Dealer Inquiries</option>
                <option value="retail_inquiries">Retail Inquiries</option>
              </select>
            </div>
            {isLoading ? <p>Loading...</p> : (
              <div className="space-y-3">
                {submissions.filter(s => s.archived && (archivedFromFilter === "" || s.archived_from === archivedFromFilter)).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No archived submissions.</p>
                ) : (
                  submissions
                    .filter(s => s.archived && (archivedFromFilter === "" || s.archived_from === archivedFromFilter))
                    .map(sub => (
                      <SubmissionCard
                        key={sub.id}
                        sub={sub}
                        onArchive={() => setArchiveTarget(sub)}
                        onDelete={() => {}}
                        onShip={() => {}}
                        onInvoice={() => {}}
                      />
                    ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={open => !open && setArchiveTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{archiveTarget?.archived ? "Unarchive Submission?" : "Archive Submission?"}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {archiveTarget?.archived
                ? `This will restore the submission from ${archiveTarget?.contactName} (${archiveTarget?.email}) back to the Orders tab.`
                : `This will move the submission from ${archiveTarget?.contactName} (${archiveTarget?.email}) to Archived. You can restore it later.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80 border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-orange-600 text-white hover:bg-orange-700" onClick={handleArchive}>
              {archiveTarget?.archived ? "Unarchive" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently remove the submission from {deleteTarget?.contactName} ({deleteTarget?.email}). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80 border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dealer Inquiry delete confirmation */}
      <AlertDialog open={!!dealerInquiryDeleteTarget} onOpenChange={open => !open && setDealerInquiryDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dealer Inquiry?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently remove the inquiry from {dealerInquiryDeleteTarget?.businessName || dealerInquiryDeleteTarget?.contactName}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80 border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleDealerInquiryDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retail Inquiry delete confirmation */}
      <AlertDialog open={!!retailInquiryDeleteTarget} onOpenChange={open => !open && setRetailInquiryDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Retail Inquiry?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently remove the inquiry from {retailInquiryDeleteTarget?.dealerName || retailInquiryDeleteTarget?.contactName}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80 border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleRetailInquiryDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShipDialog sub={shipTarget} open={!!shipTarget} onClose={() => setShipTarget(null)} />
      <InvoiceDialog sub={invoiceTarget} open={!!invoiceTarget} onClose={() => setInvoiceTarget(null)} />

    </div>
  );
}
