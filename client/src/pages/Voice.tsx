import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mic, MicOff, Loader2, Users, CheckSquare, StickyNote, Bell } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

export default function Voice() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedResult, setParsedResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const uploadMutation = trpc.voice.uploadAudio.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();
  const parseMutation = trpc.voice.parseIntent.useMutation({
    onSuccess: (data) => {
      setParsedResult(data);
      toast.success("Voice note parsed!");
    },
    onError: (err) => toast.error(err.message),
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

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Convert to base64 and upload
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const { url } = await uploadMutation.mutateAsync({
              audioBase64: base64,
              mimeType: "audio/webm",
            });

            const result = await transcribeMutation.mutateAsync({
              audioUrl: url,
              language: "en",
            });

            setTranscript(result.text);
            toast.success("Transcription complete!");

            // Auto-parse
            parseMutation.mutate({ transcript: result.text });
          } catch (err: any) {
            toast.error(err.message ?? "Transcription failed");
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript("");
      setParsedResult(null);
    } catch {
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const isProcessing =
    uploadMutation.isPending ||
    transcribeMutation.isPending ||
    parseMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Voice Capture</h1>
        <p className="text-muted-foreground mt-1">
          Record voice notes and let AI parse them into actions.
        </p>
      </div>

      {/* Recording Area */}
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`h-20 w-20 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isProcessing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </button>
            <p className="text-sm text-muted-foreground">
              {isProcessing
                ? "Processing..."
                : isRecording
                  ? "Recording... Click to stop"
                  : "Click to start recording"}
            </p>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="mt-6 text-left">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Transcript:
              </p>
              <p className="text-sm bg-secondary/50 p-3 rounded-lg">
                {transcript}
              </p>
            </div>
          )}

          {/* Parsed Result */}
          {parsedResult && (
            <div className="mt-6 text-left grid sm:grid-cols-2 gap-4">
              {parsedResult.people?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> People Mentioned
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {parsedResult.people.map((p: any, i: number) => (
                      <div key={i} className="text-sm py-1">
                        <span className="font-medium">{p.name}</span>
                        {p.context && (
                          <span className="text-muted-foreground"> — {p.context}</span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {parsedResult.tasks?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-primary" /> Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {parsedResult.tasks.map((t: any, i: number) => (
                      <div key={i} className="text-sm py-1">
                        <span>{t.title}</span>
                        {t.dueHint && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {t.dueHint}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {parsedResult.notes?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-primary" /> Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {parsedResult.notes.map((n: any, i: number) => (
                      <div key={i} className="text-sm py-1">
                        <span className="font-medium">{n.personName}:</span>{" "}
                        <span className="text-muted-foreground">{n.content}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {parsedResult.reminders?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" /> Reminders
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {parsedResult.reminders.map((r: any, i: number) => (
                      <div key={i} className="text-sm py-1">
                        <span>{r.text}</span>
                        {r.when && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {r.when}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
