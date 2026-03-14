import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Mic,
  MicOff,
  Loader2,
  Users,
  CheckSquare,
  StickyNote,
  Bell,
  Save,
  Pencil,
  X,
  RotateCcw,
  Check,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

type VoiceStep = "idle" | "recording" | "processing" | "review" | "saving" | "saved" | "error";

export default function Voice() {
  const [step, setStep] = useState<VoiceStep>("idle");
  const [transcript, setTranscript] = useState("");
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [editingItems, setEditingItems] = useState<Record<string, any>>({});
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState("");
  const [lastAudioUrl, setLastAudioUrl] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const utils = trpc.useUtils();
  const uploadMutation = trpc.voice.uploadAudio.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();
  const parseMutation = trpc.voice.parseIntent.useMutation();
  const confirmMutation = trpc.voice.confirmActions.useMutation({
    onSuccess: () => {
      utils.voice.history.invalidate();
      toast.success("Voice actions saved successfully!");
      setStep("saved");
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("review");
    },
  });
  const { data: history, isLoading: historyLoading } = trpc.voice.history.useQuery();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        processRecording();
      };

      mediaRecorder.start();
      setStep("recording");
      setTranscript("");
      setParsedResult(null);
      setEditingItems({});
      setRemovedItems(new Set());
      setErrorMsg("");
    } catch {
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setStep("processing");
  }, []);

  const processRecording = async () => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const { url } = await uploadMutation.mutateAsync({
          audioBase64: base64,
          mimeType: "audio/webm",
        });
        setLastAudioUrl(url);

        const result = await transcribeMutation.mutateAsync({
          audioUrl: url,
          language: "en",
        });
        setTranscript(result.text);

        const parsed = await parseMutation.mutateAsync({ transcript: result.text });
        setParsedResult(parsed);
        setStep("review");
      } catch (err: any) {
        setErrorMsg(err.message ?? "Processing failed");
        setStep("error");
      }
    };
    reader.readAsDataURL(blob);
  };

  const retryParse = async () => {
    if (!transcript) return;
    setStep("processing");
    setErrorMsg("");
    try {
      const parsed = await parseMutation.mutateAsync({ transcript });
      setParsedResult(parsed);
      setStep("review");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Parse failed");
      setStep("error");
    }
  };

  const retryFromTranscript = async () => {
    if (!lastAudioUrl) return;
    setStep("processing");
    setErrorMsg("");
    try {
      const result = await transcribeMutation.mutateAsync({
        audioUrl: lastAudioUrl,
        language: "en",
      });
      setTranscript(result.text);
      const parsed = await parseMutation.mutateAsync({ transcript: result.text });
      setParsedResult(parsed);
      setStep("review");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Retry failed");
      setStep("error");
    }
  };

  const toggleRemoveItem = (key: string) => {
    setRemovedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEditItem = (key: string, item: any) => {
    setEditingItems((prev) => ({ ...prev, [key]: { ...item } }));
  };

  const updateEditItem = (key: string, field: string, value: string) => {
    setEditingItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const saveEditItem = (key: string, category: string, index: number) => {
    if (!editingItems[key]) return;
    const updated = { ...parsedResult };
    updated[category] = [...(updated[category] || [])];
    updated[category][index] = editingItems[key];
    setParsedResult(updated);
    setEditingItems((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const cancelEditItem = (key: string) => {
    setEditingItems((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleConfirm = () => {
    if (!parsedResult) return;
    setStep("saving");

    // Filter out removed items
    const filtered = {
      people: (parsedResult.people || []).filter((_: any, i: number) => !removedItems.has(`people-${i}`)),
      tasks: (parsedResult.tasks || []).filter((_: any, i: number) => !removedItems.has(`tasks-${i}`)),
      notes: (parsedResult.notes || []).filter((_: any, i: number) => !removedItems.has(`notes-${i}`)),
      reminders: (parsedResult.reminders || []).filter((_: any, i: number) => !removedItems.has(`reminders-${i}`)),
    };

    // We need a captureId from a saved capture. For now, pass the filtered data.
    // The voice.parseIntent already creates a capture, so we use its id.
    const captureId = parsedResult._captureId || 0;
    confirmMutation.mutate({
      captureId,
      people: filtered.people.map((p: any) => ({
        name: p.name || "",
        role: p.role,
        company: p.company,
        action: p.context || p.action,
        save: true,
      })),
      tasks: filtered.tasks.map((t: any) => ({
        title: t.title || "",
        priority: t.priority || "medium",
        dueDate: t.dueHint || t.dueDate,
        save: true,
      })),
      notes: filtered.notes.map((n: any) => ({
        personName: n.personName,
        content: n.content || "",
        save: true,
      })),
    });
  };

  const handleStartOver = () => {
    setStep("idle");
    setTranscript("");
    setParsedResult(null);
    setEditingItems({});
    setRemovedItems(new Set());
    setErrorMsg("");
    setLastAudioUrl("");
  };

  const totalActions =
    (parsedResult?.people?.length || 0) +
    (parsedResult?.tasks?.length || 0) +
    (parsedResult?.notes?.length || 0) +
    (parsedResult?.reminders?.length || 0) -
    removedItems.size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Voice Capture</h1>
        <p className="text-muted-foreground mt-1">
          Record voice notes and let AI parse them into actions.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["Record", "Process", "Review", "Save"].map((label, i) => {
          const stepMap: VoiceStep[] = ["recording", "processing", "review", "saving"];
          const stepIndex = stepMap.indexOf(step);
          const isActive = i <= stepIndex || step === "saved";
          return (
            <div key={label} className="flex items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full ${
                  isActive ? "bg-primary" : "bg-muted"
                }`}
              />
              <span className={isActive ? "text-foreground" : ""}>{label}</span>
              {i < 3 && <span className="mx-1">→</span>}
            </div>
          );
        })}
      </div>

      {/* Recording Area */}
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          {step === "idle" || step === "recording" ? (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={step === "recording" ? stopRecording : startRecording}
                className={`h-20 w-20 rounded-full flex items-center justify-center transition-all ${
                  step === "recording"
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {step === "recording" ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
              <p className="text-sm text-muted-foreground">
                {step === "recording"
                  ? "Recording... Click to stop"
                  : "Click to start recording"}
              </p>
            </div>
          ) : step === "processing" ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {uploadMutation.isPending
                  ? "Uploading audio..."
                  : transcribeMutation.isPending
                    ? "Transcribing..."
                    : "Parsing actions..."}
              </p>
            </div>
          ) : step === "error" ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-destructive">{errorMsg}</p>
              <div className="flex gap-2">
                {transcript && (
                  <Button variant="outline" size="sm" onClick={retryParse}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Retry Parse
                  </Button>
                )}
                {lastAudioUrl && (
                  <Button variant="outline" size="sm" onClick={retryFromTranscript}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Retry Transcription
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleStartOver}>
                  Start Over
                </Button>
              </div>
            </div>
          ) : step === "saved" ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm text-green-500 font-medium">Actions saved successfully!</p>
              <Button variant="outline" size="sm" onClick={handleStartOver}>
                <Mic className="h-4 w-4 mr-1" /> Record Another
              </Button>
            </div>
          ) : null}

          {/* Transcript (editable in review) */}
          {(step === "review" || step === "saving") && transcript && (
            <div className="mt-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Transcript:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTranscript(!editingTranscript)}
                  className="h-6 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {editingTranscript ? "Done" : "Edit"}
                </Button>
              </div>
              {editingTranscript ? (
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="text-sm min-h-[80px]"
                />
              ) : (
                <p className="text-sm bg-secondary/50 p-3 rounded-lg">{transcript}</p>
              )}
              {editingTranscript && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setEditingTranscript(false);
                    retryParse();
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Re-parse with edited transcript
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parsed Result — Review & Edit */}
      {(step === "review" || step === "saving") && parsedResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Parsed Actions ({totalActions > 0 ? totalActions : 0})
            </h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleStartOver}>
                <X className="h-4 w-4 mr-1" /> Discard
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={step === "saving" || totalActions <= 0}
              >
                {step === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Confirm & Save
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* People */}
            {parsedResult.people?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> People ({parsedResult.people.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {parsedResult.people.map((p: any, i: number) => {
                    const key = `people-${i}`;
                    const isRemoved = removedItems.has(key);
                    const isEditing = !!editingItems[key];
                    return (
                      <div
                        key={key}
                        className={`text-sm py-2 px-2 rounded flex items-start justify-between gap-2 ${
                          isRemoved ? "opacity-30 line-through" : "bg-secondary/30"
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex-1 space-y-1">
                            <Input
                              value={editingItems[key].name}
                              onChange={(e) => updateEditItem(key, "name", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Name"
                            />
                            <Input
                              value={editingItems[key].context || ""}
                              onChange={(e) => updateEditItem(key, "context", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Context"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveEditItem(key, "people", i)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancelEditItem(key)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <span className="font-medium">{p.name}</span>
                              {p.context && (
                                <span className="text-muted-foreground"> — {p.context}</span>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditItem(key, p)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleRemoveItem(key)}>
                                {isRemoved ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Tasks */}
            {parsedResult.tasks?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" /> Tasks ({parsedResult.tasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {parsedResult.tasks.map((t: any, i: number) => {
                    const key = `tasks-${i}`;
                    const isRemoved = removedItems.has(key);
                    const isEditing = !!editingItems[key];
                    return (
                      <div
                        key={key}
                        className={`text-sm py-2 px-2 rounded flex items-start justify-between gap-2 ${
                          isRemoved ? "opacity-30 line-through" : "bg-secondary/30"
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex-1 space-y-1">
                            <Input
                              value={editingItems[key].title}
                              onChange={(e) => updateEditItem(key, "title", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Task title"
                            />
                            <Input
                              value={editingItems[key].dueHint || ""}
                              onChange={(e) => updateEditItem(key, "dueHint", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Due hint (e.g. tomorrow)"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveEditItem(key, "tasks", i)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancelEditItem(key)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <span>{t.title}</span>
                              {t.dueHint && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {t.dueHint}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditItem(key, t)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleRemoveItem(key)}>
                                {isRemoved ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {parsedResult.notes?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-primary" /> Notes ({parsedResult.notes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {parsedResult.notes.map((n: any, i: number) => {
                    const key = `notes-${i}`;
                    const isRemoved = removedItems.has(key);
                    const isEditing = !!editingItems[key];
                    return (
                      <div
                        key={key}
                        className={`text-sm py-2 px-2 rounded flex items-start justify-between gap-2 ${
                          isRemoved ? "opacity-30 line-through" : "bg-secondary/30"
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex-1 space-y-1">
                            <Input
                              value={editingItems[key].personName || ""}
                              onChange={(e) => updateEditItem(key, "personName", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Person name"
                            />
                            <Textarea
                              value={editingItems[key].content || ""}
                              onChange={(e) => updateEditItem(key, "content", e.target.value)}
                              className="text-sm min-h-[60px]"
                              placeholder="Note content"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveEditItem(key, "notes", i)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancelEditItem(key)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <span className="font-medium">{n.personName}:</span>{" "}
                              <span className="text-muted-foreground">{n.content}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditItem(key, n)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleRemoveItem(key)}>
                                {isRemoved ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Reminders */}
            {parsedResult.reminders?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" /> Reminders ({parsedResult.reminders.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {parsedResult.reminders.map((r: any, i: number) => {
                    const key = `reminders-${i}`;
                    const isRemoved = removedItems.has(key);
                    const isEditing = !!editingItems[key];
                    return (
                      <div
                        key={key}
                        className={`text-sm py-2 px-2 rounded flex items-start justify-between gap-2 ${
                          isRemoved ? "opacity-30 line-through" : "bg-secondary/30"
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex-1 space-y-1">
                            <Input
                              value={editingItems[key].text || ""}
                              onChange={(e) => updateEditItem(key, "text", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="Reminder text"
                            />
                            <Input
                              value={editingItems[key].when || ""}
                              onChange={(e) => updateEditItem(key, "when", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="When (e.g. next week)"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveEditItem(key, "reminders", i)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancelEditItem(key)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <span>{r.text}</span>
                              {r.when && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {r.when}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditItem(key, r)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleRemoveItem(key)}>
                                {isRemoved ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Voice Captures</h2>
        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : history && history.length > 0 ? (
          <div className="space-y-2">
            {history.map((capture: any) => (
              <Card key={capture.id}>
                <CardContent className="p-4">
                  <p className="text-sm line-clamp-2">{capture.transcript}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {capture.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(capture.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No voice captures yet. Record your first note above.
          </p>
        )}
      </div>
    </div>
  );
}
