import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Plus, Search, Trash2, AlertCircle, Sparkles,
  Wand2, CheckCircle2, AlertTriangle, Pencil, Linkedin,
  Mail, Phone, MapPin, Building2, User, Globe, ArrowLeft,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type IngestStep = "input" | "analyzing" | "preview" | "manual_edit";

interface ExtractedContact {
  fullName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  websiteUrl?: string;
  confidence: number;
  fieldConfidence: Record<string, number>;
  inputType: string;
  rawInput: string;
}

interface DuplicateInfo {
  matched: boolean;
  existingId?: number;
  matchType?: string;
  existingPerson?: { id: number; fullName: string; company?: string | null };
}

export default function People() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // AI Ingest state
  const [step, setStep] = useState<IngestStep>("input");
  const [rawInput, setRawInput] = useState("");
  const [extracted, setExtracted] = useState<ExtractedContact | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "", title: "", company: "", email: "", phone: "",
    location: "", linkedinUrl: "",
  });
  // Manual form state (fallback)
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState({
    fullName: "", title: "", company: "", email: "", location: "", linkedinUrl: "",
  });

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.people.list.useQuery({ search: search || undefined });

  const ingestMutation = trpc.people.ingest.useMutation({
    onSuccess: (result) => {
      setExtracted(result.extracted);
      setDuplicate(result.duplicateMatch);
      setEditForm({
        fullName: result.extracted.fullName || "",
        title: result.extracted.title || "",
        company: result.extracted.company || "",
        email: result.extracted.email || "",
        phone: result.extracted.phone || "",
        location: result.extracted.location || "",
        linkedinUrl: result.extracted.linkedinUrl || "",
      });
      setStep("preview");
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("input");
    },
  });

  const createMutation = trpc.people.create.useMutation({
    onSuccess: () => {
      utils.people.list.invalidate();
      resetDialog();
      toast.success("Contact added!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.people.delete.useMutation({
    onMutate: async (input) => {
      await utils.people.list.cancel();
      const prevData = utils.people.list.getData({ search: search || undefined });
      utils.people.list.setData({ search: search || undefined }, (old: any) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.filter((p: any) => p.id !== input.id), total: (old.total ?? 1) - 1 };
      });
      return { prevData };
    },
    onError: (_err, _input, context) => {
      if (context?.prevData) {
        utils.people.list.setData({ search: search || undefined }, context.prevData);
      }
      toast.error("Failed to delete contact. Reverted.");
    },
    onSettled: () => {
      utils.people.list.invalidate();
      toast.success("Contact removed");
    },
  });

  function resetDialog() {
    setDialogOpen(false);
    setStep("input");
    setRawInput("");
    setExtracted(null);
    setDuplicate(null);
    setEditMode(false);
    setManualMode(false);
    setManualForm({ fullName: "", title: "", company: "", email: "", location: "", linkedinUrl: "" });
  }

  function handleAnalyze() {
    if (!rawInput.trim()) return;
    setStep("analyzing");
    ingestMutation.mutate({ rawInput: rawInput.trim() });
  }

  function handleSaveExtracted() {
    const source = editMode ? editForm : {
      fullName: extracted!.fullName,
      title: extracted!.title,
      company: extracted!.company,
      email: extracted!.email,
      phone: extracted!.phone,
      location: extracted!.location,
      linkedinUrl: extracted!.linkedinUrl,
    };
    createMutation.mutate({
      fullName: source.fullName,
      title: source.title || undefined,
      company: source.company || undefined,
      email: source.email || undefined,
      phone: (source as any).phone || undefined,
      location: source.location || undefined,
      linkedinUrl: source.linkedinUrl || undefined,
      sourceType: "ai_ingest",
    });
  }

  function handleSaveManual() {
    createMutation.mutate({
      fullName: manualForm.fullName,
      title: manualForm.title || undefined,
      company: manualForm.company || undefined,
      email: manualForm.email || undefined,
      location: manualForm.location || undefined,
      linkedinUrl: manualForm.linkedinUrl || undefined,
    });
  }

  function confidenceBadge(score: number) {
    if (score >= 80) return <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-600">High</Badge>;
    if (score >= 50) return <Badge variant="secondary" className="text-[10px] bg-amber-600/20 text-amber-400 hover:bg-amber-600/20">Medium</Badge>;
    return <Badge variant="secondary" className="text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/20">Low</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="text-muted-foreground mt-1">
            {data?.total ?? 0} contacts in your network
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Person
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {step === "input" && !manualMode && <><Wand2 className="h-5 w-5 text-primary" /> AI Contact Input</>}
                {step === "analyzing" && <><Loader2 className="h-5 w-5 text-primary animate-spin" /> Analyzing...</>}
                {step === "preview" && <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Contact Found</>}
                {manualMode && <><Pencil className="h-5 w-5 text-muted-foreground" /> Manual Entry</>}
              </DialogTitle>
            </DialogHeader>

            {/* ─── Step 1: AI Input ─── */}
            {step === "input" && !manualMode && (
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-sm text-muted-foreground">Paste anything about this person</Label>
                  <Textarea
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    placeholder={"Malcolm Nowlin CEO at Acme\nhttps://linkedin.com/in/xxxx\njohn@acme.com"}
                    className="mt-1.5 min-h-[100px] resize-none"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleAnalyze(); }}
                  />
                </div>

                <div className="rounded-lg border border-dashed border-muted-foreground/25 p-3">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Supported inputs:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { icon: Linkedin, label: "LinkedIn URL" },
                      { icon: Mail, label: "Email address" },
                      { icon: Phone, label: "Phone number" },
                      { icon: User, label: "Name + details" },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="h-3 w-3" /> {label}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleAnalyze}
                  disabled={!rawInput.trim()}
                >
                  <Wand2 className="h-4 w-4" /> Analyze Contact
                </Button>

                <div className="text-center">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                    onClick={() => setManualMode(true)}
                  >
                    or enter manually
                  </button>
                </div>
              </div>
            )}

            {/* ─── Step 2: Analyzing ─── */}
            {step === "analyzing" && (
              <div className="py-12 text-center space-y-3">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <Wand2 className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Extracting contact information...</p>
              </div>
            )}

            {/* ─── Step 3: Preview Card ─── */}
            {step === "preview" && extracted && (
              <div className="space-y-4 mt-2">
                {/* Duplicate warning */}
                {duplicate && duplicate.matched && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-400">Possible duplicate</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Matches "{duplicate.existingPerson?.fullName}" ({duplicate.matchType})
                      </p>
                    </div>
                  </div>
                )}

                {/* Confidence */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Overall confidence</span>
                  {confidenceBadge(extracted.confidence)}
                </div>

                {/* Contact card */}
                {!editMode ? (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-lg font-semibold text-primary">
                          {extracted.fullName?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{extracted.fullName}</p>
                        {(extracted.title || extracted.company) && (
                          <p className="text-sm text-muted-foreground">
                            {[extracted.title, extracted.company].filter(Boolean).join(" at ")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                      {extracted.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{extracted.email}</span>
                          {extracted.fieldConfidence?.email != null && confidenceBadge(extracted.fieldConfidence.email)}
                        </div>
                      )}
                      {extracted.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{extracted.phone}</span>
                        </div>
                      )}
                      {extracted.linkedinUrl && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Linkedin className="h-3.5 w-3.5" />
                          <span className="truncate">{extracted.linkedinUrl}</span>
                        </div>
                      )}
                      {extracted.location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{extracted.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Full Name *</Label>
                      <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Title</Label>
                        <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Company</Label>
                        <Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Phone</Label>
                        <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Location</Label>
                        <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">LinkedIn</Label>
                        <Input value={editForm.linkedinUrl} onChange={(e) => setEditForm({ ...editForm, linkedinUrl: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSaveExtracted}
                    disabled={createMutation.isPending || (!editMode && !extracted.fullName) || (editMode && !editForm.fullName.trim())}
                  >
                    {createMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" /> Save Contact</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(!editMode)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex justify-between">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setStep("input"); setExtracted(null); setDuplicate(null); }}
                  >
                    <ArrowLeft className="h-3 w-3 inline mr-1" />Try different input
                  </button>
                  <span className="text-[10px] text-muted-foreground/50">
                    Detected: {extracted.inputType.replace("_", " ")}
                  </span>
                </div>
              </div>
            )}

            {/* ─── Manual Entry (fallback) ─── */}
            {manualMode && step === "input" && (
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={manualForm.fullName} onChange={(e) => setManualForm({ ...manualForm, fullName: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Title</Label>
                    <Input value={manualForm.title} onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })} placeholder="CEO" />
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input value={manualForm.company} onChange={(e) => setManualForm({ ...manualForm, company: e.target.value })} placeholder="Acme Inc" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input value={manualForm.email} onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })} placeholder="john@example.com" />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={manualForm.location} onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })} placeholder="San Francisco" />
                  </div>
                </div>
                <div>
                  <Label>LinkedIn URL</Label>
                  <Input value={manualForm.linkedinUrl} onChange={(e) => setManualForm({ ...manualForm, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveManual}
                  disabled={!manualForm.fullName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Adding..." : "Add Contact"}
                </Button>
                <div className="text-center">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                    onClick={() => setManualMode(false)}
                  >
                    <ArrowLeft className="h-3 w-3 inline mr-1" />back to AI input
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {error ? (
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 text-destructive/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Failed to load contacts</h3>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => utils.people.list.invalidate()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="space-y-2">
          {data.items.map((person: any) => (
            <Card
              key={person.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setLocation(`/people/${person.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {person.fullName?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {person.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[person.title, person.company].filter(Boolean).join(" at ")}
                      </p>
                      {person.location && (
                        <p className="text-xs text-muted-foreground">{person.location}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {person.status && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {person.status}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate({ id: person.id });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No contacts yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add people manually or discover them with AI.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setLocation("/discover")}>
              <Sparkles className="h-4 w-4 mr-1" />
              Discover People
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
