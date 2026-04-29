import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  Copy, Image as ImageIcon, Download, Trash2, Package, Archive,
  ChevronRight, ArrowLeft, ArrowUpDown, Building2, FileText,
  Upload, Eye, X, Search, Inbox,
  MessageSquare, ShieldCheck, Phone, Files, CheckCircle, XCircle, Send,
  RefreshCw, Store, ShoppingCart
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  // Dealer-level docs (joined by FFL license number)
  dealerFflFileName?: string;
  dealerFflFileData?: string;
  dealerSotFileName?: string;
  dealerSotFileData?: string;
  dealerTaxFormName?: string;
  dealerTaxFormData?: string;
  dealerStateTaxFileName?: string;
  dealerStateTaxFileData?: string;
  // FFL license number used to build SFTP file path
  fflLicenseNumber?: string;
  serialPhotoName?: string;
  serialPhotoData?: string;
  damagePhoto1Name?: string;
  damagePhoto1Data?: string;
  damagePhoto2Name?: string;
  damagePhoto2Data?: string;
  atfFormName?: string;
  atfFormData?: string;
  form3PdfName?: string;
  form3PdfData?: string;
  trackingNumber?: string;
  shippedAt?: string;
  paidAt?: string;
  paidNotes?: string;
  hasOrderedDemo?: string;
  createdAt: string;
  order_type?: string;
  dealer_order_quantity?: string;
  archived?: boolean;
  archived_from?: string;
  hasInvoice?: boolean;
  invoiceNumber?: string;
  form3SubmittedAt?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;
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

type Tab = "submissions" | "warranty" | "dealer_inquiries" | "retail_inquiries" | "retail" | "files" | "archives";

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
  fflLicenseNumber: z.string()
    .regex(/^\d-\d{2}-\d{3}-\d{2}-\d{2}-\d{5}$/, {
      message: "FFL must be in format X-XX-XXX-XX-XX-XXXXX (15 digits, dashes only)."
    })
    .optional()
    .or(z.literal("")),
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
// hasFile: green only when a file_name is present (indicating an upload happened).
// SFTP path (fflLicenseNumber + createdAt) only enables the download URL, not the green badge.
function DocBadge({ type, fileName, fileData, orDealerFileData, submissionId, fflLicenseNumber, createdAt }: { type: "ffl" | "sot" | "tax" | "state_tax"; fileName?: string; fileData?: string; orDealerFileData?: string; submissionId: string; fflLicenseNumber?: string; createdAt?: string }) {
  // hasFile: true when fileName is present (upload happened), OR when base64 data exists (dealer-level file).
  // fileData is now always null for submissions (files moved to SFTP) — fileName is the signal.
  const hasFile = !!(fileName) || !!(orDealerFileData);
  const label = type === "state_tax" ? "STATE TAX" : type.toUpperCase();
  const colors: Record<string, string> = {
    ffl: hasFile ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-500 text-white hover:bg-red-600",
    sot: hasFile ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-500 text-white hover:bg-red-600",
    tax: hasFile ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-500 text-white hover:bg-red-600",
    state_tax: hasFile ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-pink-500 text-white hover:bg-pink-600",
  };

  if (hasFile) {
    // Green badge — file confirmed on SFTP. Click to view in new tab.
    const viewUrl = `/api/admin/submissions/${submissionId}/file/${type}`;
    return (
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" className={`text-xs px-2 py-0.5 rounded font-bold ${colors[type]} hover:underline`}>{label}</a>
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
                if (res.ok) { toast({ title: `${label} uploaded`, description: file.name }); window.location.href = window.location.href; }
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
  sortDir, setSortDir, sortBy, setSortBy, showArchived, setShowArchived,
  setArchiveTarget, setShipTarget, setInvoiceTarget, setDeleteTarget, setPaidTarget,
  setRequestDocsTarget, setForm3SubmittedTarget,
  onFetchSubmissions
}: {
  submissions: Submission[]; isLoading: boolean;
  search: string; setSearch: (s: string) => void;
  sortDir: "desc" | "asc"; setSortDir: (d: "desc" | "asc") => void;
  sortBy: "date" | "quantity"; setSortBy: (s: "date" | "quantity") => void;
  showArchived: boolean; setShowArchived: (v: boolean) => void;
  setArchiveTarget: (s: Submission | null) => void;
  setShipTarget: (s: Submission | null) => void;
  setInvoiceTarget: (s: Submission | null) => void;
  setDeleteTarget: (s: Submission | null) => void;
  setPaidTarget: (s: Submission | null) => void;
  setRequestDocsTarget: (s: Submission | null) => void;
  setForm3SubmittedTarget: (s: Submission | null) => void;
  onFetchSubmissions: () => void;
}) {
  // Exclude warranty submissions, and dealer inquiries (type=dealer + order_type=inquiry) — they go to Dealer Inquiries tab
  const filtered = submissions.filter((sub) => {
    if (sub.type === "warranty") return false;
    // Exclude dealer leads that haven't been converted to orders yet
    if (sub.type === "dealer" && sub.order_type === "inquiry") return false;
    if (search) {
      const q = search.toLowerCase();
      const s = `${fmtDate(sub.createdAt)} ${sub.contactName} ${sub.businessName} ${sub.email} ${sub.phone} ${sub.serialNumber} ${sub.description || ""}`.toLowerCase();
      if (!s.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    // Three-tier sort: Open → Shipped → Paid
    const aPaid = !!a.paidAt;
    const bPaid = !!b.paidAt;
    if (aPaid !== bPaid) return aPaid ? 1 : -1;

    const aShipped = !!a.trackingNumber;
    const bShipped = !!b.trackingNumber;
    if (aShipped !== bShipped) return aShipped ? 1 : -1;

    // Within paid: newest first
    if (aPaid && bPaid) {
      return new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime();
    }

    // Within shipped: newest shipped first
    if (aShipped && bShipped) {
      return new Date(b.shippedAt!).getTime() - new Date(a.shippedAt!).getTime();
    }

    const t = sortDir === "desc" ? -1 : 1;
    if (sortBy === "quantity") {
      const qA = parseInt(String(a.quantity || 0));
      const qB = parseInt(String(b.quantity || 0));
      return (qA - qB) * t;
    }
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
        <Button variant="outline" size="sm" onClick={() => setSortBy(s => s === "date" ? "quantity" : "date")}
          className="h-9 bg-background text-xs whitespace-nowrap">
          Sort: {sortBy === "date" ? "Date" : "Qty"}
        </Button>
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
            onDelete={() => { console.log("delete card clicked", sub.id); setDeleteTarget(sub); }}
            onShip={() => setShipTarget(sub)}
            onInvoice={() => setInvoiceTarget(sub)}
            onPaid={() => setPaidTarget(sub)}
            onFastBoundPending={() => { setFastBoundTarget(sub); setSerialInput(""); }}
            onForm3Approved={() => setForm3Target(sub)} />)}
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
                onDelete={() => { console.log("delete row clicked", sub.id); setDeleteTarget(sub); }}
                onShip={() => setShipTarget(sub)}
                onInvoice={() => setInvoiceTarget(sub)}
                onRequestDocs={() => setRequestDocsTarget(sub)}
                onForm3Submitted={() => setForm3SubmittedTarget(sub)}
                onPaid={() => setPaidTarget(sub)}
                onFastBoundPending={() => { setFastBoundTarget(sub); setSerialInput(""); }}
                onForm3Approved={() => setForm3Target(sub)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmissionCard({ sub, onArchive, onDelete, onShip, onInvoice, onPaid, onFastBoundPending, onForm3Approved }: {
  sub: Submission; onArchive: () => void; onDelete: () => void;
  onShip: () => void; onInvoice: () => void; onPaid: () => void;
  onFastBoundPending?: () => void; onForm3Approved?: () => void;
}) {
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
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500" onClick={onDelete} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
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
        {sub.businessName && <p className="text-sm font-semibold">{sub.businessName}</p>}
        {sub.contactName && <p className="text-xs text-muted-foreground">{sub.contactName}</p>}
        {sub.email && <p className="text-xs text-muted-foreground">{sub.email}</p>}
        {sub.phone && <p className="text-xs text-muted-foreground">{sub.phone}</p>}
      </div>
      <div className="border-t border-border pt-2 space-y-1">
        {sub.type === "dealer" || sub.type === "dealer_order" ? (
          <>
            {sub.quantity && <p className="text-xs text-muted-foreground">Qty: <span className="text-foreground font-medium">{sub.quantity}</span></p>}
            {sub.description && <p className="text-xs text-foreground italic">"{sub.description}"</p>}
          </>
        ) : sub.type === "demo" ? (
          <>
            {sub.quantity && <p className="text-xs text-muted-foreground">Qty: <span className="text-foreground font-medium">{sub.quantity}</span></p>}
            {!sub.quantity && <p className="text-xs text-muted-foreground">Qty: <span className="text-foreground font-medium">1</span></p>}
            {sub.description && <p className="text-xs text-foreground">{sub.description}</p>}
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
          {/* Admin API returns camelCase (routes.ts maps DB columns to camelCase) */}
          {/* Note: API returns dealerFflFileName (filename) not base64 — use filename as orDealerFileData since truthy string = green badge */}
          <DocBadge type="ffl" fileName={sub.fflFileName} fileData={sub.fflFileData} orDealerFileData={sub.dealerFflFileName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
          <DocBadge type="sot" fileName={sub.sotFileName} fileData={sub.sotFileData} orDealerFileData={sub.dealerSotFileName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
          <DocBadge type="tax" fileName={sub.taxFormName} fileData={sub.taxFormData} orDealerFileData={sub.dealerTaxFormName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
          <DocBadge type="state_tax" fileName={sub.stateTaxFileName} fileData={sub.stateTaxFileData} orDealerFileData={sub.dealerStateTaxFileName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
        </div>
      </div>
      {/* Shipping / Paid */}
      <div className="border-t border-border pt-2 mt-2 space-y-1">
        {sub.trackingNumber ? (
          <div className="space-y-1">
            <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded font-bold">SHIPPED</span>
            <p className="text-xs font-mono text-foreground">{sub.trackingNumber}</p>
            {sub.shippedAt && <p className="text-xs text-muted-foreground">{format(parseISO(sub.shippedAt), "MM/dd/yy HH:mm")}</p>}
            {sub.paidAt && (
              <div className="mt-1">
                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-xs rounded font-bold">PAID</span>
                {sub.paidNotes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{sub.paidNotes}"</p>}
              </div>
            )}
            {!sub.paidAt && (
              <Button variant="outline" size="sm" className="w-full h-7 text-xs border-emerald-600 text-emerald-600 hover:bg-emerald-50" onClick={onPaid}>
                Mark Paid
              </Button>
            )}
          </div>
          ) : (
            <div className="space-y-1">
              <Button
                variant="outline"
                size="sm"
                className={`w-full h-8 text-xs ${!sub.form3SubmittedAt ? "border-gray-400 text-gray-400 cursor-not-allowed" : (sub.trackingNumber ? "border-green-600 text-green-600 hover:bg-green-50" : "border-primary text-primary hover:bg-primary/10")}`}
                onClick={!sub.form3SubmittedAt ? undefined : (sub.trackingNumber ? undefined : onShip)}
              >
                {sub.trackingNumber ? "✓ Shipped" : (!sub.form3SubmittedAt ? "Awaiting Form 3" : "Mark as Shipped")}
              </Button>
              {!sub.trackingNumber && onFastBoundPending && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={onFastBoundPending}
                  title="Assign serials & create FastBound pending disposition"
                >
                  FB Pending
                </Button>
              )}
              {!sub.trackingNumber && onForm3Approved && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs border-green-600 text-green-600 hover:bg-green-50"
                  onClick={onForm3Approved}
                  title="Form 3 Approved: create label, commit FastBound, email dealer"
                >
                  Form 3 ✓
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={`w-full h-8 text-xs ${sub.hasInvoice
                  ? "border-green-600 text-green-600 hover:bg-green-50"
                  : "border-red-600 text-red-600 hover:bg-red-50"
                }`}
                onClick={onInvoice}
              >
                {sub.hasInvoice ? `✓ Invoice Sent` : "Send Invoice"}
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}

function SubmissionRow({ sub, onArchive, onDelete, onShip, onInvoice, onRequestDocs, onForm3Submitted, onPaid, onFastBoundPending, onForm3Approved }: {
  sub: Submission; onArchive: () => void; onDelete: () => void; onShip: () => void; onInvoice: () => void;
  onRequestDocs: () => void; onForm3Submitted?: () => void; onPaid: () => void;
  onFastBoundPending?: () => void; onForm3Approved?: () => void;
}) {
  return (
    <tr className={`border-b border-border hover:bg-secondary/10 ${sub.archived ? "opacity-50" : ""}`}>
      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground text-xs font-mono">{fmtDate(sub.createdAt)}</td>
      <td className="px-3 py-3">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.type === "dealer" ? "bg-orange-500 text-white" : "bg-red-500 text-white"}`}>
          {sub.type.toUpperCase()}
        </span>
      </td>
      <td className="px-3 py-3">
        {sub.businessName && <div className="font-semibold text-sm"><CopyableText text={sub.businessName} /></div>}
        {sub.contactName && <div className="text-muted-foreground text-xs"><CopyableText text={sub.contactName} /></div>}
        {sub.email && <div className="text-muted-foreground text-xs"><CopyableText text={sub.email} /></div>}
        {sub.phone && <div className="text-muted-foreground text-xs"><CopyableText text={sub.phone} /></div>}
      </td>
      <td className="px-3 py-3">
        {sub.type === "dealer" || sub.type === "dealer_order" ? (
          <div className="space-y-1">
            {sub.quantity && <div className="text-xs"><span className="text-muted-foreground">Qty:</span> <span className="font-medium text-foreground">{sub.quantity}</span></div>}
            {sub.description && <div className="text-xs max-w-[200px] text-foreground italic">"{sub.description}"</div>}
          </div>
        ) : sub.type === "demo" ? (
          <div className="space-y-1">
            {sub.quantity && <div className="text-xs"><span className="text-muted-foreground">Qty:</span> <span className="font-medium text-foreground">{sub.quantity}</span></div>}
            {!sub.quantity && <div className="text-xs"><span className="text-muted-foreground">Qty:</span> <span className="font-medium text-foreground">1</span></div>}
            {sub.description && <div className="text-xs text-foreground max-w-[250px]">{sub.description}</div>}
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
          {/* Admin API returns camelCase (routes.ts maps DB columns to camelCase) */}
          {/* Note: API returns dealerFflFileName (filename) not base64 — use filename as orDealerFileData since truthy string = green badge */}
          <DocBadge type="ffl" fileName={sub.fflFileName} fileData={sub.fflFileData} orDealerFileData={sub.dealerFflFileName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
          <DocBadge type="sot" fileName={sub.sotFileName} fileData={sub.sotFileData} orDealerFileData={sub.dealerSotFileName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
          <DocBadge type="tax" fileName={sub.taxFormName} fileData={sub.taxFormData} orDealerFileData={sub.dealerTaxFormName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
          <DocBadge type="state_tax" fileName={sub.stateTaxFileName} fileData={sub.stateTaxFileData} orDealerFileData={sub.dealerStateTaxFileName} submissionId={sub.id} fflLicenseNumber={sub.fflLicenseNumber} createdAt={sub.createdAt} />
        </div>
      </td>
      <td className="px-3 py-3">
        {sub.trackingNumber ? (
          <div className="space-y-1">
            <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded font-bold">SHIPPED</span>
            <p className="text-xs font-mono text-foreground">{sub.trackingNumber}</p>
            {sub.shippedAt && <p className="text-xs text-muted-foreground">{format(parseISO(sub.shippedAt), "MM/dd/yy HH:mm")}</p>}
            {sub.paidAt && (
              <div className="mt-1">
                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-xs rounded font-bold">PAID</span>
                {sub.paidNotes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{sub.paidNotes}"</p>}
              </div>
            )}
            {!sub.paidAt && (
              <Button variant="outline" size="sm" className="h-7 text-xs whitespace-nowrap border-emerald-600 text-emerald-600 hover:bg-emerald-50" onClick={onPaid}>
                Mark Paid
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs whitespace-nowrap border-blue-600 text-blue-600 hover:bg-blue-50"
              onClick={onRequestDocs}
            >
              Request Docs
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs whitespace-nowrap ${sub.form3SubmittedAt
                ? "border-green-600 text-green-600 hover:bg-green-50"
                : "border-purple-600 text-purple-600 hover:bg-purple-50"
              }`}
              onClick={sub.form3SubmittedAt ? undefined : onForm3Submitted}
              title={sub.form3SubmittedAt ? "Form 3 already submitted" : "Send Form 3 Submitted email"}
            >
              {sub.form3SubmittedAt ? "✓ Form 3 Submitted" : "Form 3 Pending"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs whitespace-nowrap ${sub.hasInvoice
                ? "border-green-600 text-green-600 hover:bg-green-50"
                : "border-red-600 text-red-600 hover:bg-red-50"
              }`}
              onClick={onInvoice}
            >
              {sub.hasInvoice ? `✓ Invoice Sent` : "Send Invoice"}
            </Button>
              <Button
                variant="outline"
                size="sm"
                className={`h-7 text-xs whitespace-nowrap ${!sub.form3SubmittedAt ? "border-gray-400 text-gray-400 cursor-not-allowed" : (sub.trackingNumber ? "border-green-600 text-green-600 hover:bg-green-50" : "border-primary text-primary hover:bg-primary/10")}`}
                onClick={!sub.form3SubmittedAt ? undefined : (sub.trackingNumber ? undefined : onShip)}
                title={!sub.form3SubmittedAt ? "Form 3 must be sent before marking shipped" : (sub.trackingNumber ? "Already shipped" : "Mark as shipped")}
              >
                {sub.trackingNumber ? "✓ Shipped" : (!sub.form3SubmittedAt ? "Awaiting Form 3" : "Mark Shipped")}
              </Button>
              {!sub.trackingNumber && onFastBoundPending && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs whitespace-nowrap border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={onFastBoundPending}
                  title="Assign serials & create FastBound pending disposition"
                >
                  FB Pending
                </Button>
              )}
              {!sub.trackingNumber && onForm3Approved && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs whitespace-nowrap border-green-600 text-green-600 hover:bg-green-50"
                  onClick={onForm3Approved}
                  title="Form 3 Approved: create label, commit FastBound, email dealer"
                >
                  Form 3 ✓
                </Button>
              )}
            </div>
          )}
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={onDelete} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
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
          try {
            const res = await fetch("/api/admin/dealers/link-submissions", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Link failed");
            toast({ title: "Linked!", description: "Submissions linked to dealers." });
          } catch (err: any) {
            toast({ title: "Link Failed", description: err.message, variant: "destructive" });
          }
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
        // Set on-file flags when files are present
        fflOnFile: !!(fflFileData || dealer.fflFileData),
        sotOnFile: !!(sotFileData || dealer.sotFileData),
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
        body: JSON.stringify({ salesTaxFormName: taxFile.name, salesTaxFormData: fileData, taxFormOnFile: true }),
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
                          <FormControl><Input {...field} className="bg-background" placeholder="X-XX-XXX-XX-XX-XXXXX" /></FormControl>
                          <p className="text-xs text-muted-foreground mt-1">Format: X-XX-XXX-XX-XX-XXXXX (15 digits, dashes only)</p>
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
                  {dealer.fflLicenseNumber && (() => {
                    const parts = dealer.fflLicenseNumber.split('-');
                    const first2 = parts.slice(0, 2).join('-');
                    const last5 = parts[parts.length - 1];
                    return <div><span className="text-muted-foreground text-xs">FFL:</span> <CopyableText text={`${first2}-${last5}`} /></div>;
                  })()}
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
              <FormField control={form.control} name="fflLicenseNumber"
                render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>FFL License Number</FormLabel>
                    <FormControl><Input {...field} placeholder="X-XX-XXX-XX-XX-XXXXX" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="fflExpiry"
                render={({ field }) => (
                  <FormItem><FormLabel>FFL Expiry</FormLabel>
                    <FormControl><Input {...field} placeholder="MM/DD/YYYY" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="sotLicenseType"
                render={({ field }) => (
                  <FormItem><FormLabel>SOT License Type</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Type 2" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="sotTaxYear"
                render={({ field }) => (
                  <FormItem><FormLabel>SOT Tax Year</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 2025" className="bg-background" /></FormControl>
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

  // Pre-fill from submission when opened (refetch to get latest fields including customer address)
  useEffect(() => {
    if (!open || !sub) return;
    setCustomerName(sub.contactName || sub.retailCustomerName || "");
    setCustomerEmail(sub.email || sub.retailCustomerEmail || "");
    setCustomerPhone(sub.phone || sub.retailCustomerPhone || "");
    setQuantity(sub.quantity ? parseInt(sub.quantity) || 1 : 1);
    // Refetch to get customer address fields
    fetch(`/api/admin/submissions/${sub.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data) {
          setCustomerAddress(data.data.customerAddress || data.data.retailCustomerAddress || "");
          setCustomerCity(data.data.customerCity || data.data.retailCustomerCity || "");
          setCustomerState(data.data.customerState || data.data.retailCustomerState || "");
          setCustomerZip(data.data.customerZip || data.data.retailCustomerZip || "");
        }
      })
      .catch(() => {
        // Fallback to existing sub prop
        setCustomerAddress((sub as any).customerAddress || sub.retailCustomerAddress || "");
        setCustomerCity((sub as any).customerCity || sub.retailCustomerCity || "");
        setCustomerState((sub as any).customerState || sub.retailCustomerState || "");
        setCustomerZip((sub as any).customerZip || sub.retailCustomerZip || "");
      });
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
  const [form3File, setForm3File] = useState<File | null>(null);
  const [form3Preview, setForm3Preview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) { setTracking(""); setForm3File(null); setForm3Preview(null); } }, [open]);

  const handleForm3Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm3Preview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setForm3File(file);
  };

  const handleShip = async () => {
    if (!sub || !tracking.trim()) { toast({ title: "Tracking Required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      let atfData: string | undefined;
      if (form3File) {
        atfData = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(form3File);
        });
      }
      const res = await fetch(`/api/admin/submissions/${sub.id}/ship`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: tracking.trim(), atfFormName: form3File?.name || null, atfFormData: atfData || null, form3Data: atfData || null }),
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
            <label className="text-sm font-medium block mb-1.5">Form 3 PDF (required) <span className="text-xs text-muted-foreground font-normal">(optional)</span></label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("atf-file-input")?.click()}>
              <input id="form3-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleForm3Change} />
              {form3Preview ? (
                <div className="space-y-2">
                  <img src={form3Preview} alt="ATF preview" className="max-h-32 mx-auto rounded object-contain" />
                  <p className="text-xs text-muted-foreground">{form3File?.name}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload Form 3 PDF</p>
                  <p className="text-xs text-muted-foreground">PDF recommended</p>
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

// ── Paid Dialog ────────────────────────────────────────────────────────────────

function PaidDialog({ sub, open, onClose, onPaid }: {
  sub: Submission | null; open: boolean; onClose: () => void; onPaid: () => void;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) setNotes(""); }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/submissions/${sub?.id}/paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidNotes: notes }),
      });
      if (!res.ok) throw new Error("Failed to mark as paid");
      toast({ title: "Marked as Paid", description: notes ? `Note saved: "${notes}"` : "No note added." });
      onPaid();
      onClose();
    } catch {
      toast({ title: "Error", description: "Could not mark as paid.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Order as Paid</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add an optional note about the payment (e.g., "Check #1234", "Venmo", "Paid in full").
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Check #1234, Venmo, Paid in full..."
            rows={3}
            className="bg-background border-border resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "Saving..." : "Mark as Paid"}
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
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No warranty claims found.</td></tr>
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
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-orange-500 hover:text-orange-400"
                      title={r.archived ? "Unarchive" : "Archive"}
                      onClick={async () => {
                        setUpdating(String(r.id));
                        try {
                          const url = r.archived
                            ? `/api/admin/warranty-requests/${r.id}/unarchive`
                            : `/api/admin/warranty-requests/${r.id}/archive`;
                          const res = await fetch(url, { method: "PATCH" });
                          if (!res.ok) throw new Error();
                          toast({ title: r.archived ? "Unarchived" : "Archived" });
                          onRefresh();
                        } catch {
                          toast({ title: "Error", variant: "destructive" });
                        } finally { setUpdating(null); }
                      }}
                    >
                      {r.archived ? <ArrowUpDown className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-400"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete warranty claim for ${r.customer_name || r.contact_name || r.id}? This cannot be undone.`)) {
                          (async () => {
                            setUpdating(String(r.id));
                            try {
                              const res = await fetch(`/api/admin/warranty-requests/${r.id}`, { method: "DELETE" });
                              if (!res.ok) throw new Error();
                              toast({ title: "Deleted" });
                              onRefresh();
                            } catch {
                              toast({ title: "Error deleting", variant: "destructive" });
                            } finally { setUpdating(null); }
                          })();
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                onClick={async () => {
                  setUpdating(String(r.id));
                  try {
                    const url = r.archived
                      ? `/api/admin/warranty-requests/${r.id}/unarchive`
                      : `/api/admin/warranty-requests/${r.id}/archive`;
                    const res = await fetch(url, { method: "PATCH" });
                    if (!res.ok) throw new Error();
                    toast({ title: r.archived ? "Unarchived" : "Archived" });
                    onRefresh();
                  } catch {
                    toast({ title: "Error", variant: "destructive" });
                  } finally { setUpdating(null); }
                }}
              >
                {r.archived ? "Unarchive" : "Archive"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Delete warranty claim for ${r.customer_name || r.contact_name || r.id}? This cannot be undone.`)) {
                    (async () => {
                      setUpdating(String(r.id));
                      try {
                        const res = await fetch(`/api/admin/warranty-requests/${r.id}`, { method: "DELETE" });
                        if (!res.ok) throw new Error();
                        toast({ title: "Deleted" });
                        onRefresh();
                      } catch {
                        toast({ title: "Error deleting", variant: "destructive" });
                      } finally { setUpdating(null); }
                    })();
                  }
                }}
              >
                Delete
              </Button>
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
                {sub.message && <p className="text-xs mt-1 italic text-muted-foreground border-t border-border pt-1">{sub.message}</p>}
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
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No dealer inquiries found.</td></tr>
              : filtered.map(sub => (
                <tr key={sub.id} className="border-b border-border hover:bg-secondary/10">
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{fmtDate(sub.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{sub.businessName || <span className="text-muted-foreground">No business name</span>}</div>
                    {sub.contactName && <div className="text-xs text-muted-foreground">{sub.contactName}</div>}
                    {sub.phone && <div className="text-xs text-muted-foreground">{sub.phone}</div>}
                    {sub.email && <div className="text-xs text-muted-foreground"><CopyableText text={sub.email} /></div>}
                    <DocCautionBanner dealer={sub} />
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{sub.message || "—"}</p>
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
                  <td className="px-3 py-2"><p className="text-xs text-muted-foreground whitespace-pre-wrap">{sub.message || "—"}</p></td>
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

// ── Retail Orders Tab ───────────────────────────────────────────────────────────────

interface RetailOrder {
  id: number;
  invoice_number: string | null;
  retail_customer_name: string;
  retail_customer_email: string | null;
  retail_customer_phone: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  form4_submitted_at: string | null;
  form4_approved_at: string | null;
  delivered_at: string | null;
  notes: string | null;
}

function RetailOrdersTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formQty, setFormQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editStatus, setEditStatus] = useState<{ id: number; current: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/retail-orders");
      const data = await res.json();
      if (data.ok) setOrders(data.orders);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const createOrder = async () => {
    if (!formName.trim()) { toast({ title: "Customer name is required" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/retail-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: formName.trim(), customerEmail: formEmail.trim(), customerPhone: formPhone.trim(), quantity: formQty }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Order created", description: `${formQty} × DubDub22 Suppressor for ${formName}` });
        setFormName(""); setFormEmail(""); setFormPhone(""); setFormQty(1);
        setShowNewForm(false);
        fetchOrders();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sendInvoice = async (orderId: number) => {
    try {
      const res = await fetch(`/api/admin/retail-orders/${orderId}/send-invoice`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Invoice sent!", description: data.invoiceNumber });
        fetchOrders();
      } else {
        toast({ title: "Error", description: data.error });
      }
    } catch { toast({ title: "Failed to send invoice" }); }
  };

  const updateStatus = async (orderId: number, field: string, value: string) => {
    const body: Record<string, any> = {};
    if (field === "status") {
      body.status = value;
      if (value === "paid") body.paid_at = new Date().toISOString();
      if (value === "form4_submitted") body.form4_submitted_at = new Date().toISOString();
      if (value === "form4_approved") body.form4_approved_at = new Date().toISOString();
      if (value === "delivered") body.delivered_at = new Date().toISOString();
    }
    await fetch(`/api/admin/retail-orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchOrders();
  };

  const statusOrder = ["pending", "paid", "invoiced", "form4_submitted", "form4_approved", "delivered"];
  const statusLabel: Record<string, string> = {
    pending: "Pending", paid: "Paid", invoiced: "Invoice Sent",
    form4_submitted: "Form 4 Submitted", form4_approved: "Form 4 Approved", delivered: "Delivered",
  };
  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    invoiced: "bg-blue-100 text-blue-800",
    form4_submitted: "bg-purple-100 text-purple-800",
    form4_approved: "bg-indigo-100 text-indigo-800",
    delivered: "bg-emerald-100 text-emerald-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Retail Orders</h2>
        <Button size="sm" onClick={() => setShowNewForm(s => !s)}>+ New Order</Button>
      </div>

      {showNewForm && (
        <Card className="border-border">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
            <Input placeholder="Customer Name *" value={formName} onChange={e => setFormName(e.target.value)} />
            <Input placeholder="Email" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            <Input placeholder="Phone" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
            <Input placeholder="Qty" type="number" min={1} value={formQty} onChange={e => setFormQty(parseInt(e.target.value) || 1)} />
            <Button onClick={createOrder} disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting ? "Creating..." : "Create Order"}
            </Button>
          </CardContent>
          <CardContent className="pt-0 px-4 pb-4 text-sm text-muted-foreground">
            DubDub22 Suppressor × qty — $129/ea — 8.25% sales tax — no shipping
            {formQty > 0 && formName && (
              <span className="ml-2 font-medium text-foreground">
                = ${(formQty * 129 * 1.0825).toFixed(2)} total
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">No retail orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium hidden md:table-cell">Email</th>
                <th className="py-2 pr-3 font-medium hidden sm:table-cell">Phone</th>
                <th className="py-2 pr-3 font-medium text-center">Qty</th>
                <th className="py-2 pr-3 font-medium text-right">Total</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium hidden lg:table-cell">Created</th>
                <th className="py-2 pr-3 font-medium">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-b border-border hover:bg-muted/40">
                  <td className="py-2 pr-3 font-medium">{order.retail_customer_name}</td>
                  <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground">{order.retail_customer_email || "—"}</td>
                  <td className="py-2 pr-3 hidden sm:table-cell text-muted-foreground">{order.retail_customer_phone || "—"}</td>
                  <td className="py-2 pr-3 text-center">{order.quantity}</td>
                  <td className="py-2 pr-3 text-right font-medium">${order.total_amount.toFixed(2)}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={order.status}
                      onChange={e => updateStatus(order.id, "status", e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${statusColor[order.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {statusOrder.map(s => (
                        <option key={s} value={s}>{statusLabel[s] || s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {order.created_at ? format(new Date(order.created_at), "MM/dd/yy") : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {!order.invoice_number ? (
                      <Button variant="outline" size="sm" onClick={() => sendInvoice(order.id)}>
                        Send Invoice
                      </Button>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground">{order.invoice_number}</span>
                    )}
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
      key: "dealer_files",
      label: "Dealer Files",
      description: "All dealers with FFL or SOT files on SFTP — full contact info, license numbers, file names, tier, and active status. Blank columns for Tom to fill in email, phone, and other missing data.",
      countLabel: "24 dealers",
    },
    {
      key: "dealers_ffl_sot",
      label: "Dealers w/ FFL & SOT",
      description: "All dealers in DB with both FFL and SOT files on record — from both the dealers table and submissions. Includes contact info where available, or a blank column to fill in.",
      countLabel: "16 dealers",
    },
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
  const [sortBy, setSortBy] = useState<"date" | "quantity">("date");
  const [archiveTarget, setArchiveTarget] = useState<Submission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shipTarget, setShipTarget] = useState<Submission | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Submission | null>(null);
  const [requestDocsTarget, setRequestDocsTarget] = useState<Submission | null>(null);
  const [requestDocsSaving, setRequestDocsSaving] = useState(false);
  const [form3SubmittedTarget, setForm3SubmittedTarget] = useState<Submission | null>(null);
  const [paidTarget, setPaidTarget] = useState<Submission | null>(null);
  const [form3SubmittedSaving, setForm3SubmittedSaving] = useState(false);
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

  // FastBound & Form 3 state
  const [fastBoundTarget, setFastBoundTarget] = useState<Submission | null>(null);
  const [form3Target, setForm3Target] = useState<Submission | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [availableSerials, setAvailableSerials] = useState<any[]>([]);
  const [fastBoundLoading, setFastBoundLoading] = useState(false);
  const [form3Loading, setForm3Loading] = useState(false);

  const pinForm = useForm<z.infer<typeof pinSchema>>({ resolver: zodResolver(pinSchema), defaultValues: { pin: "" } });

  const fetchSubmissions = useCallback(async (tabOverride?: string) => {
    const activeTab = tabOverride ?? tab;
    try {
      setIsLoading(true);
      // Archives tab always needs archived submissions; submissions tab respects showArchived toggle
      const includeArchived = activeTab === "archives" ? true : showArchived;
      const res = await fetch(`/api/admin/submissions?includeArchived=${includeArchived}&_=${Date.now()}`);
      if (res.status === 403) { setAuthStatus("needs_pin"); setIsLoading(false); return; }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const normalized = Array.isArray(data.data) ? data.data : [];
      setSubmissions(normalized);
      setAuthStatus("authorized");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setIsLoading(false); }
  }, [tab, showArchived]);

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
    if (!deleteTarget || deletingId) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSubmissions(prev => prev.filter(s => s.id !== id));
      toast({ title: "Deleted", description: "Submission removed." });
    } catch { toast({ title: "Error", description: "Could not delete.", variant: "destructive" }); }
    finally { setDeleteTarget(null); setDeletingId(null); }
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

  const handleFastBoundPending = async () => {
    if (!fastBoundTarget || !serialInput.trim()) return;
    setFastBoundLoading(true);
    try {
      const serials = serialInput.split(",").map(s => s.trim()).filter(Boolean);
      const res = await fetch(`/api/admin/submissions/${fastBoundTarget.id}/fastbound-pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumbers: serials }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "FastBound error");
      toast({ title: "Pending Disposition Created", description: `ID: ${data.dispositionId}` });
      setFastBoundTarget(null);
      setSerialInput("");
      fetchSubmissions();
    } catch (err: any) {
      toast({ title: "FastBound Error", description: err.message, variant: "destructive" });
    } finally { setFastBoundLoading(false); }
  };

  const handleForm3Approved = async () => {
    if (!form3Target) return;
    setForm3Loading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${form3Target.id}/form3-approved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Form 3 workflow failed");
      toast({ title: "Form 3 Approved", description: `Tracking: ${data.trackingNumber}` });
      setForm3Target(null);
      fetchSubmissions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setForm3Loading(false); }
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
            onClick={() => { setTab("retail"); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "retail" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            >
            <ShoppingCart className="w-4 h-4 inline mr-1.5" />Retail Orders
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
            onClick={() => { setTab("archives"); fetchSubmissions("archives"); }}
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
                sortDir={sortDir} setSortDir={setSortDir} sortBy={sortBy} setSortBy={setSortBy}
                showArchived={showArchived} setShowArchived={setShowArchived}
                setArchiveTarget={setArchiveTarget}
                setShipTarget={setShipTarget} setInvoiceTarget={setInvoiceTarget}
                setDeleteTarget={setDeleteTarget}
                setRequestDocsTarget={setRequestDocsTarget}
                setForm3SubmittedTarget={setForm3SubmittedTarget}
                setPaidTarget={setPaidTarget}
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

        {tab === "retail" && (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 md:p-6">
              <RetailOrdersTab />
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

        {tab === "archives" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Archived Submissions <span className="text-sm font-normal text-muted-foreground">(total: {submissions.length}, archived: {submissions.filter(s=>s.archived).length})</span></h2>
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
                        onDelete={() => { console.log("delete card clicked", sub.id); setDeleteTarget(sub); }}
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
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" onClick={handleDelete} disabled={!!deletingId}>Delete</AlertDialogAction>
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
      <PaidDialog sub={paidTarget} open={!!paidTarget} onClose={() => setPaidTarget(null)} onPaid={fetchSubmissions} />
      <InvoiceDialog sub={invoiceTarget} open={!!invoiceTarget} onClose={() => setInvoiceTarget(null)} />

      <Dialog open={!!requestDocsTarget} onOpenChange={(o) => { if (!o) setRequestDocsTarget(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Request Documents</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Send an email to {requestDocsTarget?.email} requesting missing documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">The following will be requested:</p>
            <ul className="text-sm space-y-1 list-disc pl-5">
              {requestDocsTarget && !requestDocsTarget.dealerFflFileData && !requestDocsTarget.fflFileData && <li>FFL (Federal Firearms License)</li>}
              {requestDocsTarget && !requestDocsTarget.dealerSotFileData && !requestDocsTarget.sotFileData && <li>SOT (Special Occupational Tax)</li>}
              {requestDocsTarget && !requestDocsTarget.dealerStateTaxFileData && !requestDocsTarget.stateTaxFileData && <li>Multi-State Tax Affidavit <span className="text-blue-600 font-medium">(will be attached)</span></li>}
            </ul>
            {requestDocsTarget && !requestDocsTarget.dealerStateTaxFileData && !requestDocsTarget.stateTaxFileData && (
              <p className="text-xs text-muted-foreground">The Multi-State Tax Affidavit PDF will be attached to the email automatically.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDocsTarget(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!requestDocsTarget) return;
                setRequestDocsSaving(true);
                try {
                  const res = await fetch(`/api/admin/submissions/${requestDocsTarget.id}/request-docs`, { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed");
                  toast({ title: "Email Sent!", description: data.missing ? `${data.missing} item(s) requested.` : "All docs already on file." });
                  setRequestDocsTarget(null);
                } catch {
                  toast({ title: "Error Sending Email", variant: "destructive" });
                } finally {
                  setRequestDocsSaving(false);
                }
              }}
              disabled={requestDocsSaving}
            >
              {requestDocsSaving ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!form3SubmittedTarget} onOpenChange={(o) => { if (!o) setForm3SubmittedTarget(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Form 3 Submitted</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Send Form 3 notification to {form3SubmittedTarget?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">The email will include:</p>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>Form 3 submitted — preparing for shipment</li>
              {form3SubmittedTarget && !form3SubmittedTarget.dealerFflFileData && !form3SubmittedTarget.fflFileData && <li>FFL (still missing)</li>}
              {form3SubmittedTarget && !form3SubmittedTarget.dealerSotFileData && !form3SubmittedTarget.sotFileData && <li>SOT (still missing)</li>}
              {form3SubmittedTarget && !form3SubmittedTarget.dealerStateTaxFileData && !form3SubmittedTarget.stateTaxFileData && <li>Multi-State Tax Affidavit <span className="text-blue-600 font-medium">(will be attached)</span></li>}
              {(!form3SubmittedTarget?.dealerFflFileData && !form3SubmittedTarget?.fflFileData && !form3SubmittedTarget?.dealerSotFileData && !form3SubmittedTarget?.sotFileData && !form3SubmittedTarget?.dealerStateTaxFileData && !form3SubmittedTarget?.stateTaxFileData) && <li className="text-green-600 font-medium">All docs on file ✓</li>}
            </ul>
            <p className="text-xs text-muted-foreground">Invoice will be sent after Form 3 approval.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm3SubmittedTarget(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!form3SubmittedTarget) return;
                setForm3SubmittedSaving(true);
                try {
                  const res = await fetch(`/api/admin/submissions/${form3SubmittedTarget.id}/form3-submitted`, { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed");
                  toast({ title: "Email Sent!", description: "Form 3 submitted notification sent." });
                  setForm3SubmittedTarget(null);
                  onFetchSubmissions();
                } catch {
                  toast({ title: "Error Sending Email", variant: "destructive" });
                } finally {
                  setForm3SubmittedSaving(false);
                }
              }}
              disabled={form3SubmittedSaving}
            >
              {form3SubmittedSaving ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FastBound: Assign Serials & Create Pending Disposition */}
      <Dialog open={!!fastBoundTarget} onOpenChange={(o) => { if (!o) { setFastBoundTarget(null); setSerialInput(""); setAvailableSerials([]); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>FastBound: Assign Serials</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Select serial numbers for {fastBoundTarget?.contactName} (Qty: {fastBoundTarget?.quantity || "1"}).
              Only DubDub22 suppressors in FastBound inventory shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/admin/fastbound/inventory?limit=${fastBoundTarget?.quantity || 10}`);
                  const data = await res.json();
                  setAvailableSerials(data.items || []);
                } catch (e) { console.error("Failed to fetch inventory", e); }
              }}
              className="mb-2"
            >
              Load Available Serials
            </Button>
            {availableSerials.length > 0 && (
              <select
                multiple
                value={serialInput.split(",").filter(Boolean)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                  setSerialInput(selected.join(","));
                }}
                className="w-full h-32 bg-background border rounded p-2 text-sm"
              >
                {availableSerials.map((item: any) => (
                  <option key={item.serialNumber} value={item.serialNumber}>
                    {item.serialNumber} {item.model ? `(${item.model})` : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted-foreground">
              Hold Ctrl/Cmd to select multiple. This creates a pending disposition in FastBound.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFastBoundTarget(null); setSerialInput(""); setAvailableSerials([]); }}>Cancel</Button>
            <Button
              onClick={handleFastBoundPending}
              disabled={fastBoundLoading || !serialInput.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {fastBoundLoading ? "Creating..." : "Create Pending Disposition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form 3 Approved: Full Workflow */}
      <Dialog open={!!form3Target} onOpenChange={(o) => { if (!o) setForm3Target(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Form 3 Approved</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will: (1) Create USPS shipping label, (2) Push tracking to FastBound, (3) Commit disposition, (4) Email dealer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">Dealer: {form3Target?.contactName}</p>
            <p className="text-xs text-muted-foreground">Serial: {form3Target?.serialNumber || "Not assigned"}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm3Target(null)}>Cancel</Button>
            <Button
              onClick={handleForm3Approved}
              disabled={form3Loading}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {form3Loading ? "Processing..." : "Run Form 3 Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
