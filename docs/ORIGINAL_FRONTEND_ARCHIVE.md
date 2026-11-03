# Original frontend archive — "AI infrastructure for real estate"

This document records exactly where the pre-pivot SiteTech AI marketing site
is preserved and how that preservation was verified. The companion runbook is
[`RESTORE_ORIGINAL_FRONTEND.md`](./RESTORE_ORIGINAL_FRONTEND.md).

## Capture

| Item | Value |
| --- | --- |
| Captured | 2026-11-03, ~15:20–15:30 US Eastern |
| Repository | `/Users/seanraineri/SiteTechAI` (GitHub remote `origin` = `git@github.com:seanraineri426/sitetech.ai.git`) |
| Original branch / HEAD at capture | `main` @ `34355dc3a872fcf9b677371cc0b95d6908a562a7` |
| Working tree at capture | Clean — no staged, modified, or untracked source. No baseline commit was needed; the baseline **is** `34355dc`. |
| Preserved baseline SHA | `34355dc3a872fcf9b677371cc0b95d6908a562a7` ("Add Blog section with SEO posts for affordable housing workflows.", 2026-08-24) |
| Archive branch | `archive/ai-infrastructure-2026-11-03` → `34355dc` |
| Annotated archive tag | `archive-ai-infrastructure-2026-11-03` (tag object `df63e1180e45e8506f20cfc02fcb370bf931b7a9`) → `34355dc` |
| Pivot working branch | `pivot/data-referrals` (branched from `34355dc`) |
| Remote branch at same SHA | `origin/marketing-legacy` → `34355dc` (already on GitHub before this work) |

Full history of the baseline (4 commits, root to tip):

```
0da6198 Initial commit: SiteTech AI marketing site
9bd8f83 Mobile optimization: viewport, spacing, and overflow safety
496f0aa Reposition site as AI infrastructure for real estate
34355dc Add Blog section with SEO posts for affordable housing workflows.
```

## Local vs. production vs. `origin/main`

Three distinct things exist and must not be confused:

1. **Local `main` = `34355dc`** — the marketing-only Next.js site. This is the archived baseline.
2. **Production at https://www.sitetechai.com** — verified on 2026-11-03 to be a build of this same marketing-only codebase:
   - Served by Vercel (`server: Vercel`), deployment id `dpl_CgPV3m1tvvjny6Ryo61VSaiKqTGd` (from asset URLs in the HTML).
   - Rendered header/footer/nav markup is byte-identical to `components/Header.tsx` / `components/Footer.tsx` at `34355dc`.
   - `/login` returns 404 (the product app in `origin/main` has a login route; this deployment does not).
   - The exact source commit of that Vercel deployment could not be read from outside the Vercel dashboard; the markup match plus `origin/marketing-legacy == 34355dc` is the evidence. **Confirm in Vercel → Deployments before relying on it.**
3. **`origin/main` = `81587b9`** (205 commits, *no common ancestor* with local `main`) — a separate product application (`sitetech-app`, Next 16, pnpm, Supabase) that merged a copy of the marketing site under `app/(marketing)/` and `components/marketing/`. It is **not** what is deployed at www.sitetechai.com. It was left untouched. Its marketing copy differs slightly from `34355dc` (Header/Footer/Contact/Reveal/FlowShowcase and all pages differ; most other components are identical).

The local `main` branch was left pointing at `34355dc`; nothing was rebased, reset, or force-pushed.

## Stack at the baseline

| Item | Value |
| --- | --- |
| Framework | Next.js `^15.3.3` (lockfile resolves **15.5.18**), App Router, `next/font/google` (Inter 300–600, Geist Mono) |
| React | 19.2.6 / react-dom 19.2.6 |
| Styling | Tailwind CSS 4.3.0 via `@tailwindcss/postcss`; tokens in `app/globals.css` `@theme` |
| 3D | three 0.184.0 (hero background grid, client-only dynamic import) |
| TypeScript | 5.9.3, `strict: true` |
| Package manager | npm (lockfile `package-lock.json`, lockfileVersion 3). No pnpm/yarn. |
| Runtime used for verification | Node v23.11.0, npm 10.9.2 |
| Scripts | `dev` (`next dev -p 8000`), `build`, `start`, `lint` (`next lint` — **not configured**, see below) |
| Git LFS / submodules | None (`.gitattributes`, `.gitmodules` absent) |
| Env files | None present locally (`.env*` is gitignored; none exist) |

## Everything needed to reproduce the original public frontend

All of the following are in Git at `34355dc` (48 tracked files):

- Routes: `app/page.tsx`, `app/how-it-works`, `app/pricing` (engagement + contact form), `app/solutions`, `app/solutions/affordable-housing`, `app/solutions/property-management`, `app/integrations`, `app/blog`, `app/blog/[slug]`, `app/insights`, `app/insights/[slug]` (dead — redirected to `/blog` by `next.config.ts`).
- Shared layout/metadata: `app/layout.tsx` (title/description/OG/Twitter/robots meta, Organization JSON-LD), `app/opengraph-image.tsx` (edge-rendered OG image), `app/sitemap.ts`, `app/robots.ts`.
- Components: `components/*.tsx` (Header, Footer, Hero, HeroCanvas, HeroSchematic, Problem, LayerStack, Pricing, Contact, CTA, PageHeader, Reveal, SolutionBlock, WorkflowFlow, BriefCard) and `components/home/*` (FlowShowcase, AffordableSpotlight, HowItWorksStrip).
- Copy: inline in the components/pages above; blog articles in `lib/insights.ts` (10 posts, dated 2026, author "SiteTech AI").
- Design tokens & CSS: `app/globals.css`.
- Assets: `public/logo-mark.png`, `public/logo-mark-dark.png`, `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`. Fonts are fetched from Google Fonts **at build time** by `next/font/google` (not vendored).
- Config: `package.json`, `package-lock.json`, `next.config.ts` (redirects + security headers), `tsconfig.json`, `postcss.config.mjs`, `.gitignore`.
- Form wiring: `lib/site.ts` (Web3Forms endpoint + access key, Calendly URL) and `components/Contact.tsx` (client-side `FormData` POST to Web3Forms).

### Dependencies external to Git (NOT backed up by a commit)

| Dependency | What it is | Where it lives |
| --- | --- | --- |
| Vercel project | Hosting, production branch mapping, domain `www.sitetechai.com`, any env vars | Vercel dashboard (account not inspected). No `vercel.json` in repo. |
| DNS for `sitetechai.com` | A/CNAME to Vercel | Registrar/DNS provider (not inspected) |
| `sitetech.ai` | Used as canonical/OG/sitemap host in code, but **did not resolve** on 2026-11-03 | Registrar — pre-existing mismatch, see "Pre-existing problems" |
| Web3Forms | Form delivery to SiteTech's inbox; access key `a6e64ba7-…-3323e6006099` is committed in `lib/site.ts` (by design, Web3Forms keys are public) | web3forms.com account |
| Calendly | `https://calendly.com/seanvraineri/sitetech-ai` (returned 200 on 2026-11-03) | Calendly account |
| Google Fonts | Inter + Geist Mono fetched during `next build` | Public CDN; builds fail offline |
| CMS / database / analytics | **None.** No analytics, no DB, no auth, no API routes at the baseline. | — |

Required environment variables at the baseline: **none**. Everything was hardcoded.

## Supplemental private backup (outside the repository)

| Item | Value |
| --- | --- |
| Location | `~/SiteTechAI-archive/` (i.e. `/Users/seanraineri/SiteTechAI-archive/`, outside the app directory, not tracked by Git) |
| Git bundle | `sitetech-ai-infrastructure-2026-11-03.bundle` (117,789 bytes) |
| SHA-256 | `56967e103775288d1942beff1d65c62d3c8f876131cd825b167e78ce862390e5` |
| Refs in bundle | `refs/heads/main`, `refs/heads/archive/ai-infrastructure-2026-11-03`, `refs/tags/archive-ai-infrastructure-2026-11-03`, `refs/remotes/origin/marketing-legacy` — all → `34355dc` (complete history) |
| Verification | `git bundle verify` → "okay… records a complete history". Then cloned to `/tmp/sitetech-archive-verify`, `npm ci` (55 packages), `npm run build` → **success**, 37 static pages. |
| Reference screenshots | `~/SiteTechAI-archive/screenshots/baseline/` (live www.sitetechai.com + local `34355dc`, desktop 1440 and mobile 375, home/how-it-works/solutions/pricing/blog) and `~/SiteTechAI-archive/screenshots/pivot/` (after). |

The bundle and screenshots are private. Repository history may contain
material you do not want public; do not publish the bundle.

The archive **was not pushed** to GitHub. The Vercel production-branch mapping
could not be verified from the repo, so no remote write was made. To back up
remotely once you have confirmed in Vercel which branch deploys production:

```bash
git push origin archive/ai-infrastructure-2026-11-03
git push origin archive-ai-infrastructure-2026-11-03
```

(Pushing a non-production branch to a Vercel-connected repo may create a
*preview* deployment; it will not change production unless that branch is
the production branch.)

## Archive material is outside the production application

- No copy of the old app exists under `app/`, `components/`, `lib/`, or `public/` on the pivot branch. Retired pages and components were `git rm`'d; Git history is the archive.
- `docs/` is not part of route discovery, type checking (`tsconfig.json` includes `**/*.ts(x)` but `docs/` contains only Markdown), the production bundle, or public downloads.
- Confirmed after build: `.next/server/app` contains only the pivot routes; `rg` for archive doc names in `.next/server` finds nothing.

## Baseline build / smoke check (at `34355dc`, before any edit)

| Check | Result |
| --- | --- |
| `npm run build` | ✅ success — 37 static pages, `/opengraph-image` dynamic (edge) |
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ⚠️ **Not configured.** `next lint` prompts interactively to set up ESLint; no ESLint config or dependency exists. Pre-existing. |
| Isolated clone of bundle → `npm ci` → `npm run build` | ✅ success on second attempt; first attempt failed in `next-font-loader` (transient Google Fonts fetch). Builds require network. |
| Live site reachable | ✅ `https://www.sitetechai.com/` 200; `/solutions` 200; `/login` 404; `/privacy`, `/contact`, `/data-fit`, `/for-buyers`, `/terms` all 404 (did not exist). |

### Pre-existing problems (not regressions from the pivot)

1. **Canonical host mismatch.** `app/layout.tsx`, `sitemap.ts`, `robots.ts`, and every page's `openGraph.url` use `https://sitetech.ai`, but the site is served at `https://www.sitetechai.com` and `sitetech.ai` did not resolve on 2026-11-03. Canonicals therefore point at a dead host. The pivot centralizes this into one constant (`SITE_URL` in `lib/site.ts`) but intentionally does not change the value — that is a business/SEO decision.
2. **`npm run lint` is unconfigured** (see above).
3. **`/insights` pages are dead code** — `next.config.ts` permanently redirects `/insights*` → `/blog*`, so `app/insights/*` was never reachable.
4. **No privacy or terms page existed**, although the contact form collected name, company, email, industry, and free text.
5. **Headless/No-WebGL browsers**: `components/HeroCanvas.tsx` threw an uncaught promise rejection when WebGL was unavailable (three.js could not create a context). Harmless on normal browsers. (The pivot adds a try/catch; the archived version does not have it.)
6. `BOOKING_ENABLED` in `lib/site.ts` checked for the substring `"your-handle"`, so the Calendly button was always on.
