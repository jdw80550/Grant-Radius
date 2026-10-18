# Grantscope

Find foundation grants for a nonprofit, school district, or municipality — grouped into
three search radii (Local, State & Regional, National) — with fit ratings, category
filters, and a Monday.com-ready export.

## What it does

- **Location resolution** — type an organization name (or paste an address) and the app
  finds where the entity actually is. You confirm or correct it before searching.
- **Three search radii** — every search returns up to 20 grants per tier:
  - **Local** — community foundations and funders within the entity's own area
  - **State & Regional** — state-wide and regional funders
  - **National** — big national foundations and corporate programs
- **Per-grant detail** — foundation name, program name, summary, minimum and maximum
  funding, submission deadline, application complexity (Low / Medium / High), and the
  foundation's website.
- **Category filters** — narrow results to education, infrastructure, community programs,
  health, arts & culture, environment, economic development, public safety, or other.
  Filter chips show live counts for the tier you're viewing.
- **Apply buttons** — every card links straight to the foundation's application page
  (falling back to their homepage when the direct page isn't published).
- **Fit rating** — paste your organization's mission and goals once and each grant gets a
  1–5 star fit score with a plain-language rationale, strengths, concerns, and a list of
  requirements to verify with the funder.
- **My grants** — star grants to save them, mark a status (Interested, Applying, Applied,
  Awarded, Declined), add notes, and re-run saved searches.
- **Monday.com export** — download any grant as a CSV with columns ready for a Monday.com
  board import. No account connection needed.

## Tech stack

- [TanStack Start](https://tanstack.com/start) v1 (React 19, Vite 7, SSR)
- TypeScript, Tailwind CSS v4, shadcn/ui primitives
- Zod for schema validation
- Lovable AI Gateway for location resolution, grant discovery, and fit scoring
- Lovable Cloud (Supabase) for backend services
- Vitest + Testing Library for tests

## Getting started

You need [Node.js](https://nodejs.org) (or Bun) installed.

```sh
git clone <this-repository-url>
cd grantscope
npm install
cp .env.example .env
npm run dev
```

The app runs at http://localhost:8080.

## Environment variables

Copy `.env.example` to `.env` and fill in the values for your project. The app reads them
from the server runtime (`process.env`) and from browser config (`import.meta.env`).

| Variable | Where it's read | Purpose |
| --- | --- | --- |
| `LOVABLE_API_KEY` | server | Authorizes calls to the AI gateway used for search and fit scoring |
| `SUPABASE_URL` | server | Backend project URL |
| `SUPABASE_PUBLISHABLE_KEY` | server | Backend publishable key |
| `SUPABASE_PROJECT_ID` | server | Backend project id |
| `VITE_SUPABASE_URL` | browser | Backend project URL for the browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Backend publishable key for the browser client |
| `VITE_SUPABASE_PROJECT_ID` | browser | Backend project id for the browser client |

Never commit `.env` — it is git-ignored.

## Scripts

```sh
npm run dev        # start the dev server
npm run build      # production build
npm run preview    # serve the production build locally
npm run lint       # eslint
npm run format     # prettier
npm test           # vitest
```

## Project structure

```text
src/
  lib/
    ai.server.ts              # AI gateway client (streaming + strict JSON schema)
    ai-run-id.server.ts       # request tracking for AI calls
    grants.functions.ts       # location resolution + three-radius grant search
    eligibility.ts            # mission/goals and fit-rating schemas
    eligibility.functions.ts  # server function that scores fit
    monday-export.ts          # CSV builder + browser download for Monday.com
    saved.ts                  # localStorage hooks for favorites and saved searches
    error-capture.ts          # recovers swallowed server errors
    error-page.ts             # minimal "page didn't load" HTML
    lovable-error-reporting.ts# forwards boundary errors to the editor preview
  components/
    grant-eligibility.tsx     # profile fields, star rating, export button
    ui/                       # shadcn/ui primitives
  routes/
    __root.tsx                # shared layout, fonts, head metadata
    index.tsx                 # search form, tabs, category filters, grant cards
    saved.tsx                 # "My grants" page
  integrations/supabase/      # generated backend client (do not edit by hand)
  test/                       # vitest setup and tests
  router.tsx                  # router setup
  start.ts                    # app instance + auth middleware
  server.ts                   # SSR server entry
  styles.css                  # Tailwind v4 theme tokens (deep green / cream)
drizzle/                      # database schema + migration metadata
supabase/config.toml          # backend configuration
```

`src/routeTree.gen.ts` is generated by the router plugin on dev/build. Don't edit it by
hand.

## Notes and limitations

- Grant results are AI-generated from model knowledge, not from a live funder database.
  Funding amounts and deadlines can be stale or unknown ("Varies") — always confirm on the
  foundation's own site before relying on them.
- Favorites and saved searches are stored in the browser's `localStorage`, so they live on
  one device and one browser profile. Add sign-in accounts if you want them to follow you
  across devices.
- Fit ratings are a preliminary assessment, not verified eligibility. The rating tells you
  whether a grant is worth your time; the funder's own rules decide eligibility.
