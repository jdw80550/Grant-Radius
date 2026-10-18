import type { Grant, Tier } from "./grants.functions";

function cell(value: unknown): string {
  const text = value == null ? "" : String(value);
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function opportunityCSV(g: Grant, organization: string, tier?: Tier, status = "Interested", notes = ""): string {
  const headers = ["Name", "Foundation", "Organization", "Search radius", "Category", "Summary", "Minimum funding", "Maximum funding", "Deadline", "Complexity", "Foundation website", "Application URL", "Fit rating (out of 5)", "Fit rationale", "Mission", "Goals", "Requirements to verify", "Application status", "Notes"];
  const fit = g.eligibility;
  const values = [g.program, g.foundation, organization, tier ?? "", g.category, g.summary, g.minAmount, g.maxAmount, g.deadline, g.complexity, g.website, g.applicationUrl || g.website, fit?.stars, fit?.rationale, fit?.profile.mission, fit?.profile.goals, fit?.requirementsToVerify.join("; "), status, notes];
  return "\uFEFF" + [headers, values].map(row => row.map(cell).join(",")).join("\r\n");
}

export function downloadOpportunity(g: Grant, organization: string, tier?: Tier, status?: string, notes?: string) {
  const url = URL.createObjectURL(new Blob([opportunityCSV(g, organization, tier, status, notes)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `monday-${g.program.replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}