import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Target, LogOut, Save, Loader2, Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [newIndustry, setNewIndustry] = useState("");
  const [geographies, setGeographies] = useState<string[]>([]);
  const [newGeo, setNewGeo] = useState("");
  const [bio, setBio] = useState("");
  const [targetRoles, setTargetRoles] = useState("");

  const { data: userGoals } = trpc.onboarding.getGoals.useQuery();
  const saveGoals = trpc.onboarding.saveGoals.useMutation({
    onSuccess: () => toast.success("Settings saved!"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (userGoals) {
      setPrimaryGoal(userGoals.primaryGoal ?? "");
      setIndustries(userGoals.industries ?? []);
      setGeographies(userGoals.geographies ?? []);
      const prefs = (userGoals.preferences ?? {}) as Record<string, any>;
      setBio(prefs.bio ?? "");
      setTargetRoles(prefs.targetRoles ?? "");
    }
  }, [userGoals]);

  const addIndustry = () => {
    if (newIndustry.trim() && !industries.includes(newIndustry.trim())) {
      setIndustries([...industries, newIndustry.trim()]);
      setNewIndustry("");
    }
  };

  const addGeo = () => {
    if (newGeo.trim() && !geographies.includes(newGeo.trim())) {
      setGeographies([...geographies, newGeo.trim()]);
      setNewGeo("");
    }
  };

  const handleSave = () => {
    saveGoals.mutate({
      primaryGoal,
      industries,
      geographies,
      preferences: { bio, targetRoles },
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile and networking preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Name</Label>
              <p className="text-sm font-medium">{user?.name ?? "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="text-sm font-medium">{user?.email ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Networking Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Networking Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Primary Goal</Label>
            <Input
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              placeholder="e.g., Find co-founders, Raise seed funding, Expand network"
              className="mt-1"
            />
          </div>

          <div>
            <Label>About You</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief description of who you are and what you're working on..."
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <Label>Target Industries</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {industries.map((ind) => (
                <Badge key={ind} variant="secondary" className="gap-1 pr-1">
                  {ind}
                  <button
                    onClick={() => setIndustries(industries.filter((x) => x !== ind))}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                placeholder="e.g., AI/ML, SaaS, FinTech"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIndustry())}
              />
              <Button variant="outline" size="icon" onClick={addIndustry} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Target Geographies</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {geographies.map((geo) => (
                <Badge key={geo} variant="secondary" className="gap-1 pr-1">
                  {geo}
                  <button
                    onClick={() => setGeographies(geographies.filter((x) => x !== geo))}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={newGeo}
                onChange={(e) => setNewGeo(e.target.value)}
                placeholder="e.g., San Francisco, New York, Remote"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGeo())}
              />
              <Button variant="outline" size="icon" onClick={addGeo} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Target Roles</Label>
            <Input
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
              placeholder="e.g., CTO, VP Engineering, Investor"
              className="mt-1"
            />
          </div>

          <Button onClick={handleSave} disabled={saveGoals.isPending} className="gap-2">
            {saveGoals.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Sign Out */}
      <Card className="border-destructive/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Sign Out</p>
              <p className="text-xs text-muted-foreground">
                Sign out of your iNexus account.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
