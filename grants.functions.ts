import { createServerFn } from "@tanstack/react-start";
import { structuredAI } from "./ai.server";
import type { FitAssessment } from "./eligibility";

export type EntityType = "nonprofit" | "education" | "municipality";
export type Tier = "local" | "regional" | "national";

export interface ResolvedLocation {
  found: boolean;
  name: string;
  city: string;
  county: string | null;
  state: string;
  region: string;
  note: string;
}

export type Category =
  | "education"
  | "infrastructure"
  | "community-programs"
  | "health"
  | "arts-culture"
  | "environment"
  | "economic-development"
  | "public-safety"
  | "other";

export const CATEGORY_IDS: Category[] = [
  "education",
  "infrastructure",
  "community-programs",
  "health",
  "arts-culture",
  "environment",
  "economic-development",
  "public-safety",
  "other",
];

export interface Grant {
  eligibility?: FitAssessment | undefined;
  foundation: string;
  program: string;
  website: string;
  applicationUrl: string | null;
  category: Category;
  summary: string;
  minAmount: number | null;
  maxAmount: number | null;
  deadline: string;
  complexity: "Low" | "Medium" | "High";
  complexityNote: string;
}

const str = { type: "string" };
const nstr = { type: ["string", "null"] };
const nnum = { type: ["number", "null"] };

export const resolveLocation = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; type: EntityType }) => {
    const name = String(d.name ?? "").trim().slice(0, 200);
    if (!name) throw new Error("Please enter an organization name.");
    return { name, type: d.type };
  })
  .handler(async ({ data }) =>
    structuredAI<ResolvedLocation>({
      system:
        "You identify the headquarters location of US organizations. If you are not reasonably confident, set found=false and give your best guess in note. Never invent.",
      prompt: `Organization: "${data.name}" (type: ${data.type}). Where is it located?`,
      schemaName: "location",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["found", "name", "city", "county", "state", "region", "note"],
        properties: {
          found: { type: "boolean" },
          name: { ...str, description: "Official organization name" },
          city: str,
          county: nstr,
          state: { ...str, description: "Full US state name" },
          region: { ...str, description: "US region, e.g. Mountain West, Pacific Northwest" },
          note: str,
        },
      },
    }),
  );

const TIER_GUIDE: Record<Tier, string> = {
  local:
    "LOCAL: community foundations, city/county funders, and local corporate giving programs serving this specific city/county/metro area.",
  regional:
    "STATE/REGIONAL: statewide foundations, state-focused funders, and multi-state regional foundations covering this state or region. Exclude purely local and purely national funders.",
  national:
    "NATIONAL: major national foundations and corporate foundations that fund eligible organizations anywhere in the US.",
};

const TARGET = 20;
const MAX_PASSES = 3;

const GRANTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["grants"],
  properties: {
    grants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["foundation", "program", "website", "applicationUrl", "category", "summary", "minAmount", "maxAmount", "deadline", "complexity", "complexityNote"],
        properties: {
          foundation: str,
          program: str,
          website: str,
          applicationUrl: { ...nstr, description: "Direct URL to the application/apply page or RFP if you know it, otherwise null" },
          category: {
            type: "string",
            enum: CATEGORY_IDS,
            description: "Best-fit category for what the grant funds",
          },
          summary: { ...str, description: "2-3 sentences" },
          minAmount: nnum,
          maxAmount: nnum,
          deadline: str,
          complexity: { type: "string", enum: ["Low", "Medium", "High"] },
          complexityNote: { ...str, description: "One short phrase explaining the complexity" },
        },
      },
    },
  },
};

const SYSTEM =
  "You are a grant research expert. List real, existing foundations and grant programs you are confident about — never invent one and never list the same program twice. Use the foundation's official website URL, and when you know the direct application or RFP page, return it in applicationUrl. Categorize each program by what it funds: education (schools, teachers, students, literacy, STEM), infrastructure (facilities, transportation, utilities, broadband, capital projects), community-programs (youth development, food security, housing, civic life), health, arts-culture, environment, economic-development, or public-safety. If an exact amount or deadline is unknown, use null for amounts and describe deadline as 'Rolling' or 'Varies — check website'. Complexity: Low = short online form/LOI; Medium = full proposal with budget; High = multi-stage, extensive documentation, audits or evaluations. Work for breadth: smaller community, family and corporate funders count just as much as famous ones, so keep listing genuine fiters until the requested number is reached.";

const keyOf = (g: Grant) => `${g.foundation}::${g.program}`.toLowerCase().replace(/\s+/g, " ").trim();

export const searchGrants = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { name: string; type: EntityType; city: string; state: string; region: string; focus: string; tier: Tier }) => ({
      name: String(d.name ?? "").slice(0, 200),
      type: d.type,
      city: String(d.city ?? "").slice(0, 100),
      state: String(d.state ?? "").slice(0, 100),
      region: String(d.region ?? "").slice(0, 100),
      focus: String(d.focus ?? "").slice(0, 300),
      tier: (["local", "regional", "national"] as const).includes(d.tier) ? d.tier : "national",
    }),
  )
  .handler(async ({ data }) => {
    const label = { nonprofit: "a nonprofit organization", education: "an education entity (school, district, college)", municipality: "a municipality / local government" }[data.type];
    const subject = `${data.name ? `"${data.name}", ` : ""}${label} located in ${data.city}, ${data.state} (${data.region})`;
    const focusLine = data.focus ? `Program focus areas: ${data.focus}.` : "";

    const found: Grant[] = [];
    const seen = new Set<string>();

    for (let pass = 0; pass < MAX_PASSES && found.length < TARGET; pass++) {
      const need = TARGET - found.length;
      const already = found.length
        ? `\nAlready found — do NOT repeat any of these or a near-duplicate of one: ${found.map((g) => `${g.foundation} — ${g.program}`).join("; ")}.`
        : "";

      const prompt =
        pass === 0
          ? `Find ${TARGET} grant programs that ${subject} could apply to.
${focusLine}
Search radius: ${TIER_GUIDE[data.tier]}
List exactly ${TARGET} distinct programs. Start with the most likely funders, then keep going: community foundations, family foundations, corporate giving programs, and cause-specific funders — one program each.`
          : `Find ${need} more grant programs that ${subject} could apply to, all distinct from the ones already listed.
${focusLine}
Search radius: ${TIER_GUIDE[data.tier]}
Dig deeper than the obvious names: lesser-known community foundations, family foundations, corporate giving programs, and regional or cause-specific funders. List exactly ${need} new programs.`;

      const result = await structuredAI<{ grants: Grant[] }>({
        system: SYSTEM,
        prompt: prompt + already,
        schemaName: "grants",
        schema: GRANTS_SCHEMA,
      });

      let added = 0;
      for (const g of result.grants) {
        const k = keyOf(g);
        if (seen.has(k)) continue;
        seen.add(k);
        found.push(g);
        added++;
        if (found.length >= TARGET) break;
      }
      if (added === 0) break;
    }

    return found;
  });
