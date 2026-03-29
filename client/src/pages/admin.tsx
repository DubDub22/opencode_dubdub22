import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Copy, Image as ImageIcon, Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
    serialPhotoName?: string;
    serialPhotoData?: string;
    damagePhoto1Name?: string;
    damagePhoto1Data?: string;
    damagePhoto2Name?: string;
    damagePhoto2Data?: string;
    createdAt: string;
};

const pinSchema = z.object({
    pin: z.string().length(6, "PIN must be 6 digits"),
});

function CopyableText({ text }: { text: string }) {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!", description: `Copied to clipboard.`, duration: 2000 });
    };

    return (
        <div className="group flex items-center gap-2 cursor-pointer" onClick={handleCopy} title="Click to copy">
            <span>{text}</span>
            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
        </div>
    );
}

export default function AdminPage() {
    const { toast } = useToast();
    const [authStatus, setAuthStatus] = useState<'checking' | 'needs_pin' | 'pin_sent' | 'authorized'>('checking');
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
    const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: "" },
    });

    const fetchSubmissions = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/admin/submissions");
            if (res.status === 403) {
                setAuthStatus('needs_pin');
                setIsLoading(false);
                return;
            }
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setSubmissions(data.data || []);
            setAuthStatus('authorized');
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        // Check if IP is already whitelisted on mount
        fetch("/api/admin/check-auth")
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                if (data.authorized) {
                    setExpiresAt(data.expiresAt || null);
                    fetchSubmissions();
                } else {
                    setAuthStatus('needs_pin');
                }
            })
            .catch(() => {
                if (!cancelled) setAuthStatus('needs_pin');
            });
        return () => { cancelled = true; };
    }, [fetchSubmissions]);

    const onRequestPin = async () => {
        try {
            const res = await fetch("/api/admin/request-pin", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                toast({ title: "Request Failed", description: data.error || "Could not request PIN", variant: "destructive" });
                return;
            }
            toast({ title: "PIN Sent", description: "Check the #general channel on Discord for your PIN." });
            setAuthStatus('pin_sent');
        } catch {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
        }
    };

    const onVerifyPin = async (values: z.infer<typeof pinSchema>) => {
        try {
            const res = await fetch("/api/admin/verify-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: values.pin }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast({ title: "Invalid PIN", description: data.error || "The PIN was invalid or expired.", variant: "destructive" });
                pinForm.reset();
                return;
            }
            setExpiresAt(data.expiresAt || null);
            setAuthStatus('authorized');
            fetchSubmissions();
        } catch {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
        }
    };

    const onLogout = async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        setAuthStatus('needs_pin');
        setSubmissions([]);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/admin/submissions/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setSubmissions(prev => prev.filter(s => s.id !== deleteTarget.id));
            toast({ title: "Deleted", description: "Submission removed." });
        } catch {
            toast({ title: "Error", description: "Could not delete submission.", variant: "destructive" });
        } finally {
            setDeleteTarget(null);
        }
    };

    if (authStatus === 'checking') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-muted-foreground">Checking access...</p>
            </div>
        );
    }

    if (authStatus === 'needs_pin' || authStatus === 'pin_sent') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <Card className="w-full max-w-md bg-card border-border shadow-2xl pt-6">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-center">🔐 Admin Access</CardTitle>
                        <p className="text-center text-muted-foreground text-sm mt-2">
                            {authStatus === 'needs_pin'
                                ? "Request a PIN to access the admin panel."
                                : "Enter the PIN posted in #general on Discord."}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {authStatus === 'needs_pin' && (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground text-center">
                                    Clicking below will post a 6-digit PIN to the <strong>#general</strong> Discord channel.
                                </p>
                                <Button onClick={onRequestPin} className="w-full text-black bg-primary hover:bg-primary/90">
                                    Request PIN
                                </Button>
                            </div>
                        )}
                        {authStatus === 'pin_sent' && (
                            <Form {...pinForm}>
                                <form onSubmit={pinForm.handleSubmit(onVerifyPin)} className="space-y-4">
                                    <FormField
                                        control={pinForm.control}
                                        name="pin"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>6-Digit PIN</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        maxLength={6}
                                                        placeholder="123456"
                                                        className="text-center text-2xl tracking-widest font-mono bg-background"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full text-black bg-primary hover:bg-primary/90">
                                        Unlock
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => setAuthStatus('needs_pin')}
                                        className="w-full text-xs text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        Need a new PIN?
                                    </button>
                                </form>
                            </Form>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const filteredSubmissions = submissions.filter((sub) => {
        if (typeFilter !== "all" && sub.type !== typeFilter) return false;

        if (search) {
            const query = search.toLowerCase();
            const dateStr = format(parseISO(sub.createdAt), 'yyyy-MM-dd HH:mm').toLowerCase();
            const searchable = `${dateStr} ${sub.contactName} ${sub.businessName} ${sub.email} ${sub.phone} ${sub.serialNumber} ${sub.description}`.toLowerCase();
            if (!searchable.includes(query)) return false;
        }
        return true;
    }).sort((a, b) => {
        const dA = new Date(a.createdAt).getTime();
        const dB = new Date(b.createdAt).getTime();
        return sortDir === "desc" ? dB - dA : dA - dB;
    });

    // Format date as yyyy-MM-dd HH:mm (24hr)
    const fmtDate = (d: string) => format(parseISO(d), 'yyyy-MM-dd HH:mm');

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-bold font-display text-primary">Admin Dashboard</h1>
                    <Button variant="outline" size="sm" onClick={onLogout}>Logout</Button>
                </div>

                <Card className="bg-card/50 border-border">
                    <CardContent className="p-4 md:p-6">
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <Input
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="sm:max-w-xs bg-background focus:ring-primary h-9"
                            />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="h-9 rounded-md bg-background border border-border px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="all">All</option>
                                <option value="dealer">Dealer</option>
                                <option value="warranty">Warranty</option>
                            </select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                                className="h-9 whitespace-nowrap bg-background text-foreground text-xs"
                            >
                                {sortDir === "desc" ? "↓ Newest" : "↑ Oldest"}
                            </Button>
                        </div>

                        {/* ── Mobile: stacked cards ── */}
                        <div className="block md:hidden space-y-3">
                            {isLoading ? (
                                <p className="text-center py-8 text-muted-foreground">Loading...</p>
                            ) : filteredSubmissions.length === 0 ? (
                                <p className="text-center py-8 text-muted-foreground">No submissions found.</p>
                            ) : (
                                filteredSubmissions.map((sub) => (
                                    <div key={sub.id} className="relative border border-border rounded-lg p-3 bg-card hover:bg-secondary/5">
                                        {/* Header row */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.type === 'dealer' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    {sub.type.toUpperCase()}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-mono">{fmtDate(sub.createdAt)}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                                                onClick={() => setDeleteTarget(sub)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>

                                        {/* Contact */}
                                        <div className="space-y-1 mb-2">
                                            <p className="text-sm font-semibold text-foreground">{sub.contactName}</p>
                                            <p className="text-xs text-muted-foreground">{sub.email}</p>
                                            {sub.phone && <p className="text-xs text-muted-foreground">{sub.phone}</p>}
                                            {sub.businessName && (
                                                <p className="text-xs px-1.5 py-0.5 bg-secondary rounded inline-block mt-0.5">{sub.businessName}</p>
                                            )}
                                        </div>

                                        {/* Payload */}
                                        <div className="border-t border-border pt-2 space-y-1">
                                            {sub.type === 'dealer' ? (
                                                <>
                                                    {sub.quantity && <p className="text-xs text-muted-foreground">Qty: <span className="text-foreground font-medium">{sub.quantity}</span></p>}
                                                    {sub.description && <p className="text-xs text-foreground italic">"{sub.description}"</p>}
                                                    {sub.fflFileName && (
                                                        <div className="mt-2 space-y-1">
                                                            <p className="text-xs text-muted-foreground">SOT: {sub.fflFileName}</p>
                                                            {sub.fflFileData && (
                                                                <div className="flex gap-2 flex-wrap">
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button variant="outline" size="sm" className="h-7 text-xs">View</Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-80 p-1 border-border bg-card">
                                                                            {sub.fflFileName?.toLowerCase().endsWith('.pdf') ? (
                                                                                <iframe src={`data:application/pdf;base64,${sub.fflFileData}`} className="w-full rounded-sm" style={{ height: '400px' }} title="SOT Preview" />
                                                                            ) : (
                                                                                <img src={`data:image;base64,${sub.fflFileData}`} alt="SOT Preview" className="w-full h-auto rounded-sm" />
                                                                            )}
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                    <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                                                                        <a href={`data:application/octet-stream;base64,${sub.fflFileData}`} download={sub.fflFileName}>
                                                                            Download
                                                                        </a>
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xs text-muted-foreground">Serial: <span className="font-mono text-foreground">{sub.serialNumber}</span></p>
                                                    <p className="text-xs text-foreground">{sub.description}</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ── Desktop: table ── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                                    <tr>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Type</th>
                                        <th className="px-3 py-2 min-w-[180px]">Details</th>
                                        <th className="px-3 py-2">Message / Payload</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8">Loading...</td>
                                        </tr>
                                    ) : filteredSubmissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-muted-foreground">No submissions found.</td>
                                        </tr>
                                    ) : (
                                        filteredSubmissions.map((sub) => (
                                            <tr key={sub.id} className="border-b border-border hover:bg-secondary/10">
                                                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground text-xs font-mono">
                                                    {fmtDate(sub.createdAt)}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${sub.type === 'dealer' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'}`}>
                                                        {sub.type.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="font-semibold text-foreground text-sm">
                                                        <CopyableText text={sub.contactName} />
                                                    </div>
                                                    <div className="text-muted-foreground text-xs">
                                                        <CopyableText text={sub.email} />
                                                    </div>
                                                    {sub.phone && (
                                                        <div className="text-muted-foreground text-xs"><CopyableText text={sub.phone} /></div>
                                                    )}
                                                    {sub.businessName && (
                                                        <div className="mt-1 text-xs px-1.5 py-0.5 bg-secondary rounded inline-block">{sub.businessName}</div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {sub.type === 'dealer' ? (
                                                        <div className="space-y-1">
                                                            {sub.quantity && <div className="text-xs"><span className="text-muted-foreground">Qty:</span> <span className="font-medium text-foreground">{sub.quantity}</span></div>}
                                                            {sub.description && <div className="text-xs max-w-[200px] text-foreground italic">"{sub.description}"</div>}
                                                            {sub.fflFileName && (
                                                                <div className="text-xs text-muted-foreground">{sub.fflFileName}</div>
                                                            )}
                                                            {sub.fflFileData && sub.fflFileName && (
                                                                <div className="flex gap-1 mt-1">
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                <ImageIcon className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-96 p-1 border-border bg-card">
                                                                            {sub.fflFileName?.toLowerCase().endsWith('.pdf') ? (
                                                                                <iframe src={`data:application/pdf;base64,${sub.fflFileData}`} className="w-full rounded-sm" style={{ height: '500px' }} title="SOT Preview" />
                                                                            ) : (
                                                                                <img src={`data:image;base64,${sub.fflFileData}`} alt="SOT Preview" className="w-full h-auto rounded-sm" />
                                                                            )}
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                                                        <a href={`data:application/octet-stream;base64,${sub.fflFileData}`} download={sub.fflFileName}>
                                                                            <Download className="h-3.5 w-3.5" />
                                                                        </a>
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div className="text-xs"><span className="text-muted-foreground">Serial:</span> <span className="font-mono text-foreground">{sub.serialNumber}</span></div>
                                                            <div className="text-xs text-foreground max-w-[250px]">{sub.description}</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                                                        onClick={() => setDeleteTarget(sub)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            This will permanently remove the submission from {deleteTarget?.contactName} ({deleteTarget?.email}). This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80 border-border">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={handleDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
