import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assessEligibility } from "@/lib/eligibility.functions";
import { clientProfileSchema, type ClientProfile, type FitAssessment } from "@/lib/eligibility";
import { downloadOpportunity } from "@/lib/monday-export";
import type { Grant, Tier } from "@/lib/grants.functions";

export function ProfileFields({ profile, onChange }: { profile: ClientProfile; onChange: (p: ClientProfile) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    {(["mission", "goals"] as const).map(field => <label key={field} className="block text-sm font-medium">
      Client {field}
      <textarea value={profile[field]} maxLength={3000} rows={3} onChange={e => onChange({ ...profile, [field]: e.target.value })} placeholder={field === "mission" ? "Who does the client serve, and why?" : "What outcomes will this project achieve?"} className="mt-2 w-full rounded border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" />
    </label>)}
  </div>;
}

export function GrantEligibility({ grant, organization, tier, profile: suppliedProfile, onAssessment, status, notes }: { grant: Grant; organization: string; tier?: Tier | undefined; profile?: ClientProfile | undefined; onAssessment: (fit: FitAssessment) => void; status?: string | undefined; notes?: string | undefined }) {
  const assess = useServerFn(assessEligibility);
  const [localProfile, setLocalProfile] = useState<ClientProfile>(grant.eligibility?.profile ?? { mission: "", goals: "" });
  const profile = suppliedProfile ?? localProfile;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fit = grant.eligibility;
  const stale = fit && (fit.profile.mission !== profile.mission.trim() || fit.profile.goals !== profile.goals.trim());
  async function check() {
    const parsed = clientProfileSchema.safeParse(profile);
    if (!parsed.success) { setError("Enter both the client's mission and goals before checking fit."); return; }
    setBusy(true); setError("");
    try { onAssessment(await assess({ data: { profile: parsed.data, organization, grant } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not assess fit."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 border-t border-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-primary">Eligibility & fit</h4>
      <div className="flex items-center gap-1" role="img" aria-label={fit && !stale ? `${fit.stars} out of 5 stars` : "Not rated"}>
        {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${fit && !stale && i < fit.stars ? "fill-accent text-accent" : "text-muted-foreground"}`} />)}
        <span className="ml-1 text-xs text-muted-foreground">{fit && !stale ? `${fit.stars}/5` : "Not rated"}</span>
      </div>
    </div>
    {!suppliedProfile && <div className="mt-3"><ProfileFields profile={localProfile} onChange={setLocalProfile} /></div>}
    {stale && <p className="mt-2 text-xs text-muted-foreground">Client details changed — check fit again.</p>}
    {fit && !stale && <div className="mt-3 space-y-2 text-sm">
      <p>{fit.rationale}</p>
      {([{ title: "Alignment", items: fit.strengths }, { title: "Concerns", items: fit.concerns }, { title: "Confirm with the funder", items: fit.requirementsToVerify }]).map(section => section.items.length > 0 && <div key={section.title}><p className="font-medium">{section.title}</p><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{section.items.map((item, i) => <li key={i}>{item}</li>)}</ul></div>)}
    </div>}
    <p className="mt-2 text-xs text-muted-foreground">Preliminary AI fit estimate, not confirmed eligibility or an award prediction.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={check}><Star />{busy ? "Checking fit…" : fit ? "Recheck fit" : "Check fit"}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => downloadOpportunity(stale ? { ...grant, eligibility: undefined } : grant, organization, tier, status, notes)} title="Download a CSV file to import into Monday.com"><Download />Monday.com CSV</Button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}