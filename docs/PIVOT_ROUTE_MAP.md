# Pivot route map — data-referral frontend (2026-11-03)

Disposition of every public route that existed at the baseline (`34355dc`) and
every route added by the pivot. Verified against a production build
(`next build && next start`) on 2026-11-03.

Legend: **Rewritten** = same URL, new content · **Retained with context** =
content kept, notice added · **Temporarily redirected** = 307 · **Retired** =
no longer exists (history only) · **New** = added by the pivot.

## Baseline routes

| Route | Was | Action | Now |
| --- | --- | --- | --- |
| `/` | AI-infrastructure homepage | **Rewritten** | Data-referral homepage: hero, 3-step strip, opportunity, process, who it's for, control, embedded fit check (`#data-fit`), FAQ (`#faq`), closing CTA. Anchors: `#opportunity`, `#process`, `#who-its-for`, `#data-fit`, `#faq`. |
| `/how-it-works` | Assessment → architecture → implementation → managed infra | **Rewritten** | Four referral steps, "SiteTech's role" (does / does not), buyer link, CTA. |
| `/pricing` | "Engagement" tiers + the site's only contact form (`#contact`) | **Temporarily redirected** (307) → `/contact` | The contact anchor was the reason most links pointed here; `/contact` is the equivalent destination. |
| `/solutions` | Index of AI workflow solutions (acquisitions, development, construction, brokerage, executive) | **Rewritten as a retirement/context page** ("Previous services", `noindex,follow`) | States that AI implementation services are no longer offered, lists what was offered, points to the fit check and blog. Single landing spot for all retired service URLs — no redirect chains. |
| `/solutions/affordable-housing` | Service page | **Temporarily redirected** (307) → `/solutions` | Unrelated retired service → context page, not homepage. |
| `/solutions/property-management` | Service page | **Temporarily redirected** (307) → `/solutions` | Same. |
| `/integrations` | Procore/Yardi/etc. integration marketing | **Temporarily redirected** (307) → `/solutions` | Same. |
| `/blog` | 10 articles on affordable-housing AI operations | **Retained with context** | Original titles, dates (2026), authorship, and FAQ/Blog JSON-LD kept. `ArchiveNotice` banner added at the top; header description moved to past tense; CTA now points to the fit check. |
| `/blog/[slug]` (10) | Articles | **Retained with context** | `ArchiveNotice` after the deck; article body untouched. In-article "Related" links to `/solutions/affordable-housing` now resolve via one 307 to `/solutions`. |
| `/insights`, `/insights/[slug]` | Dead pages (already 308 → `/blog*` in `next.config.ts`) | **Retired** (files removed; redirects kept) | Behaviour unchanged for visitors. |
| `/platform` → `/how-it-works` | Pre-existing 308 | **Unchanged** | Destination still relevant. |
| `/workflows` → `/solutions` | Pre-existing 308 | **Unchanged** | Lands on the retirement/context page. |
| `/sitemap.xml` | Old route list | **Rewritten** | Only real public pivot routes + blog. `/solutions` (noindex) excluded. |
| `/robots.txt` | allow all | **Unchanged in effect** | Regenerated from `SITE_URL`. |
| `/opengraph-image` | Old headline | **Rewritten** | Same monochrome layout, new headline/description. |
| `/icon.png`, `/apple-icon.png`, `/favicon.ico`, `/logo-mark*.png` | Brand assets | **Unchanged** | |

## New routes

| Route | Purpose | Notes |
| --- | --- | --- |
| `/data-fit` | Shareable, dedicated fit check (same `DataFitQuiz` component as the homepage, `autoStart`) | Indexed. Answers never enter the URL. |
| `/contact` | General process question (`inquiryType: process_question`) | Optional short note (600 chars) with a no-confidential-content instruction. |
| `/for-buyers` | Buyer / licensing-partner inquiry (`inquiryType: buyer_partner`) | Linked discreetly from the process section, how-it-works, footer, and mobile menu. |
| `/privacy` | Factual description of what the fit check and forms collect, how Web3Forms delivers it, and how SiteTech uses it | Linked from the consent checkbox and footer. Contains no invented retention periods or certifications. |

## Navigation

| Location | Links |
| --- | --- |
| Header (desktop) | The opportunity (`/#opportunity`) · Who it's for (`/#who-its-for`) · How it works (`/how-it-works`) · FAQ (`/#faq`) · **Check your data fit** (`/#data-fit` on the homepage, `/data-fit` elsewhere) |
| Header (mobile) | Same + For buyers & partners |
| Footer — Explore | Check your data fit · How it works · Who it's for · FAQ · Blog |
| Footer — Company | Contact · For buyers & partners · Privacy · Previous services |

## Things deliberately **not** done

- No route redirects to the homepage.
- No redirect chains (every 307/308 resolves in one hop to a 200).
- No `/terms` page was invented; none existed and no verified terms text was available.
- The Calendly link was not carried into the new funnel (its event is scoped to the retired assessment offer). It remains in `lib/site.ts` as `LEGACY_BOOKING_URL` for reference.
- `origin/main` (the separate product app) was not modified.

## Verification (2026-11-03, `next start` on :8000)

```
/                                200
/data-fit                        200
/how-it-works                    200
/for-buyers                      200
/contact                         200
/privacy                         200
/solutions                       200   (noindex)
/blog                            200
/blog/recertification-is-a-queue 200
/pricing                         307 -> /contact
/solutions/affordable-housing    307 -> /solutions
/solutions/property-management   307 -> /solutions
/integrations                    307 -> /solutions
/insights                        308 -> /blog
/insights/:slug                  308 -> /blog/:slug
/platform                        308 -> /how-it-works
/workflows                       308 -> /solutions
/sitemap.xml, /robots.txt        200
/opengraph-image                 200
/nonexistent                     404
```
