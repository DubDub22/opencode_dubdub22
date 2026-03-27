import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Copy, Image as ImageIcon, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
            const dateStr = format(parseISO(sub.createdAt), 'MMM d, yyyy h:mm a').toLowerCase();
            const searchable = `${dateStr} ${sub.contactName} ${sub.businessName} ${sub.email} ${sub.phone} ${sub.serialNumber} ${sub.description}`.toLowerCase();
            if (!searchable.includes(query)) return false;
        }
        return true;
    }).sort((a, b) => {
        const dA = new Date(a.createdAt).getTime();
        const dB = new Date(b.createdAt).getTime();
        return sortDir === "desc" ? dB - dA : dA - dB;
    });

    return (
        <div className="min-h-screen bg-background p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold font-display text-primary">Admin Dashboard</h1>
                    <Button variant="outline" onClick={onLogout}>Logout</Button>
                </div>

                <Card className="bg-card/50 border-border">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <Input
                                placeholder="Search by name, dealer, email, serial..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="max-w-md bg-background focus:ring-primary"
                            />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="h-10 rounded-md bg-background border border-border px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="all">All Forms</option>
                                <option value="dealer">Dealer Requests</option>
                                <option value="warranty">Warranty Claims</option>
                            </select>
                            <Button
                                variant="outline"
                                onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                                className="h-10 px-4 whitespace-nowrap bg-background text-foreground"
                            >
                                Sort Date: {sortDir === "desc" ? "Newest First" : "Oldest First"}
                            </Button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Type</th>
                                        <th className="px-6 py-3 min-w-[200px]">Details</th>
                                        <th className="px-6 py-3">Message / Payload</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8">Loading...</td>
                                        </tr>
                                    ) : filteredSubmissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8 text-muted-foreground">No submissions found.</td>
                                        </tr>
                                    ) : (
                                        filteredSubmissions.map((sub) => (
                                            <tr key={sub.id} className="border-b border-border hover:bg-secondary/10">
                                                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                                                    {format(parseISO(sub.createdAt), 'MMM d, yyyy h:mm a')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${sub.type === 'dealer' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'}`}>
                                                        {sub.type.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-foreground">
                                                        <CopyableText text={sub.contactName} />
                                                    </div>
                                                    <div className="text-muted-foreground mt-1 text-xs">
                                                        <CopyableText text={sub.email} />
                                                    </div>
                                                    {sub.phone && (
                                                        <div className="text-muted-foreground mt-1 text-xs">
                                                            <CopyableText text={sub.phone} />
                                                        </div>
                                                    )}
                                                    {sub.businessName && (
                                                        <div className="mt-2 text-xs px-2 py-1 bg-secondary rounded inline-block">
                                                            {sub.businessName}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {sub.type === 'dealer' ? (
                                                        <div className="space-y-2">
                                                            {sub.quantity && <div><span className="text-muted-foreground">Quantity:</span> <span className="font-medium text-foreground">{sub.quantity} units</span></div>}
                                                            {sub.description && <div className="max-w-xs"><span className="text-muted-foreground block mb-1">Message:</span> <span className="text-foreground text-sm">{sub.description}</span></div>}
                                                            {sub.fflFileName && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-muted-foreground">File:</span>
                                                                    <span className="truncate max-w-[150px] inline-block align-bottom">{sub.fflFileName}</span>

                                                                    {sub.fflFileData && (
                                                                        <>
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1">
                                                                                        <ImageIcon className="h-4 w-4" />
                                                                                    </Button>
                                                                                </PopoverTrigger>
                                                                                <PopoverContent className="w-96 p-1 border-border">
                                                                                    {sub.fflFileName?.toLowerCase().endsWith('.pdf') ? (
                                                                                        <iframe
                                                                                            src={`data:application/pdf;base64,${sub.fflFileData}`}
                                                                                            className="w-full rounded-sm"
                                                                                            style={{ height: '500px' }}
                                                                                            title="PDF Preview"
                                                                                        />
                                                                                    ) : (
                                                                                        <img src={`data:image;base64,${sub.fflFileData}`} alt="Document Preview" className="w-full h-auto rounded-sm" />
                                                                                    )}
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                                                                <a href={`data:application/octet-stream;base64,${sub.fflFileData}`} download={sub.fflFileName}>
                                                                                    <Download className="h-4 w-4" />
                                                                                </a>
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono text-foreground">{sub.serialNumber}</span></div>
                                                            <div className="max-w-md text-foreground"><span className="text-muted-foreground block mb-1">Issue:</span> {sub.description}</div>

                                                            <div className="flex gap-4 mt-2">
                                                                {sub.serialPhotoData && (
                                                                    <div className="flex items-center gap-1 bg-secondary/30 p-1 px-2 rounded-md">
                                                                        <span className="text-xs text-muted-foreground mr-1">Serial</span>
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-black/20 text-orange-400">
                                                                                    <ImageIcon className="h-3 w-3" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-80 p-1 border-border bg-black">
                                                                                <img src={`data:image;base64,${sub.serialPhotoData}`} alt="Serial Preview" className="w-full h-auto rounded-sm" />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-black/20 text-blue-400" asChild>
                                                                            <a href={`data:application/octet-stream;base64,${sub.serialPhotoData}`} download={sub.serialPhotoName || "serial.jpg"}>
                                                                                <Download className="h-3 w-3" />
                                                                            </a>
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {sub.damagePhoto1Data && (
                                                                    <div className="flex items-center gap-1 bg-secondary/30 p-1 px-2 rounded-md">
                                                                        <span className="text-xs text-muted-foreground mr-1">Dmg 1</span>
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-black/20 text-orange-400">
                                                                                    <ImageIcon className="h-3 w-3" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-80 p-1 border-border bg-black">
                                                                                <img src={`data:image;base64,${sub.damagePhoto1Data}`} alt="Damage 1 Preview" className="w-full h-auto rounded-sm" />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-black/20 text-blue-400" asChild>
                                                                            <a href={`data:application/octet-stream;base64,${sub.damagePhoto1Data}`} download={sub.damagePhoto1Name || "damage1.jpg"}>
                                                                                <Download className="h-3 w-3" />
                                                                            </a>
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {sub.damagePhoto2Data && (
                                                                    <div className="flex items-center gap-1 bg-secondary/30 p-1 px-2 rounded-md">
                                                                        <span className="text-xs text-muted-foreground mr-1">Dmg 2</span>
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-black/20 text-orange-400">
                                                                                    <ImageIcon className="h-3 w-3" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-80 p-1 border-border bg-black">
                                                                                <img src={`data:image;base64,${sub.damagePhoto2Data}`} alt="Damage 2 Preview" className="w-full h-auto rounded-sm" />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-black/20 text-blue-400" asChild>
                                                                            <a href={`data:application/octet-stream;base64,${sub.damagePhoto2Data}`} download={sub.damagePhoto2Name || "damage2.jpg"}>
                                                                                <Download className="h-3 w-3" />
                                                                            </a>
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
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
        </div>
    );
}
