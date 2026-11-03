# Restoring the original "AI infrastructure for real estate" frontend

Two separate workflows. **A** lets you look at or demo the old business without
touching the current site. **B** returns the live website to the old business.

Facts used throughout (see `ORIGINAL_FRONTEND_ARCHIVE.md` for provenance):

| | |
| --- | --- |
| Baseline SHA | `34355dc3a872fcf9b677371cc0b95d6908a562a7` |
| Archive branch | `archive/ai-infrastructure-2026-11-03` |
| Archive tag | `archive-ai-infrastructure-2026-11-03` |
| Pivot branch | `pivot/data-referrals` |
| Private bundle | `~/SiteTechAI-archive/sitetech-ai-infrastructure-2026-11-03.bundle` |
| Repo | `/Users/seanraineri/SiteTechAI` |

If the archive refs are ever missing from the repo, recover them from the bundle:

```bash
cd /Users/seanraineri/SiteTechAI
git bundle verify ~/SiteTechAI-archive/sitetech-ai-infrastructure-2026-11-03.bundle
git fetch ~/SiteTechAI-archive/sitetech-ai-infrastructure-2026-11-03.bundle \
  'refs/heads/archive/ai-infrastructure-2026-11-03:refs/heads/archive/ai-infrastructure-2026-11-03' \
  'refs/tags/archive-ai-infrastructure-2026-11-03:refs/tags/archive-ai-infrastructure-2026-11-03'
git rev-parse archive-ai-infrastructure-2026-11-03^{commit}   # must print 34355dc3a872fcf9b677371cc0b95d6908a562a7
```

---

## Workflow A — Preview the original business (no impact on the live site)

Uses a separate Git worktree so the pivot working directory is untouched, and a
separate port so both can run side by side.

```bash
cd /Users/seanraineri/SiteTechAI

# 1. Confirm the tag points where it should.
git rev-parse archive-ai-infrastructure-2026-11-03^{commit}
#    -> 34355dc3a872fcf9b677371cc0b95d6908a562a7

# 2. Create an isolated worktree at the archived SHA (detached HEAD is fine for preview).
git worktree add --detach ../SiteTechAI-original archive-ai-infrastructure-2026-11-03

# 3. Install with the ORIGINAL lockfile (npm, lockfileVersion 3). Node 20+ works; 23.11 was verified.
cd ../SiteTechAI-original
npm ci

# 4. Environment: the original needs NO environment variables. Form delivery and the
#    Calendly link are hardcoded in lib/site.ts. Nothing to copy.

# 5. Run on a port that does not collide with the pivot (which uses 8000).
npx next dev -p 8001
#    open http://localhost:8001
```

Production-style preview instead of dev:

```bash
cd ../SiteTechAI-original && npm run build && npx next start -p 8001
```

Notes:
- `next build` fetches Inter/Geist Mono from Google Fonts; it needs network access.
- The contact form on the preview posts to the real Web3Forms inbox. Don't submit test data you don't want in that inbox.
- Clean up when done: `cd /Users/seanraineri/SiteTechAI && git worktree remove ../SiteTechAI-original`.

---

## Workflow B — Return the active website to the original business

Do **not** reset or force-push the production branch backwards. Make a new,
forward commit that restores the old marketing surfaces, then release it
through the normal process (PR → review → merge → Vercel deploy).

### B.0 Before you start

1. In the Vercel dashboard, confirm **which Git branch is the production branch** for www.sitetechai.com and which repo the project is connected to. (As of 2026-11-03 the deployed code matched `34355dc` = `origin/marketing-legacy`; this was inferred from markup, not read from Vercel.)
2. Note any env vars set in Vercel. The pivot introduced one *optional* public var: `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` (falls back to the committed key if unset).
3. Export/save any inquiries received during the pivot (see B.5).

### B.1 Start a restoration branch from the then-current production branch

```bash
cd /Users/seanraineri/SiteTechAI
git fetch origin --tags
# Replace <production-branch> with the branch Vercel deploys (e.g. main or marketing-legacy).
git switch -c restore/ai-infrastructure origin/<production-branch>
```

### B.2 Option 1 — Revert the pivot commits (preferred when the pivot is the only thing on top)

List the pivot commits and revert them newest-first in one go:

```bash
git log --oneline 34355dc..pivot/data-referrals          # the implementation commits
git revert --no-edit 34355dc..pivot/data-referrals       # creates one revert commit per pivot commit
```

If later commits (security fixes, dependency bumps) sit between the pivot and
production HEAD, Git will stop on conflicts. Resolve each keeping the *later*
fix, then `git revert --continue`.

### B.2 Option 2 — Restore the archived marketing surfaces explicitly (when history is messier)

Bring the whole original frontend back from the tag, then remove the pivot-only files listed in B.3:

```bash
git checkout archive-ai-infrastructure-2026-11-03 -- \
  app/page.tsx app/layout.tsx app/globals.css app/opengraph-image.tsx app/sitemap.ts app/robots.ts \
  app/how-it-works app/pricing app/solutions app/integrations app/blog \
  components lib/site.ts lib/insights.ts next.config.ts README.md tsconfig.json package.json
```

Then review `package.json`/`tsconfig.json` diffs — keep any *later* dependency
or security changes that are unrelated to the pivot. (The pivot only added
`typecheck`/`test` scripts and `allowImportingTsExtensions`; it added no
dependencies.)

### B.3 Pivot-only things that must be removed or disabled

Whichever option you used, confirm none of these remain:

| Kind | Items |
| --- | --- |
| Routes | `app/data-fit/`, `app/for-buyers/`, `app/contact/`, `app/privacy/`, the rewritten `app/solutions/page.tsx` ("Previous services" page) |
| Components | `components/data-fit/` (DataFitQuiz, ResultView, InquiryForm, OptionItem), `components/ArchiveNotice.tsx`, `components/home/{Opportunity,Process,Audience,Control,FitCheckSection,FAQ}.tsx` |
| Logic | `lib/data-fit/` (questions, result, copy), `lib/inquiry/` (schema, submit) |
| Tests | `tests/` and the `test`/`typecheck` scripts in `package.json` |
| Redirects in `next.config.ts` | the four temporary (307) rules: `/pricing → /contact`, `/solutions/affordable-housing → /solutions`, `/solutions/property-management → /solutions`, `/integrations → /solutions` |
| Metadata | layout title/description/keywords/OG/Twitter, Organization JSON-LD, OG image headline, per-page metadata, FAQPage JSON-LD on the homepage |
| Sitemap | the pivot route list in `app/sitemap.ts` |
| Docs | `docs/` may stay (it's inert) or be removed |
| Env | `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` in Vercel, if it was set — harmless to leave but unused by the original |

Restoring only `app/page.tsx` is **not** sufficient: the header, footer, CTA
defaults, metadata, sitemap, redirects, and the `/pricing` contact form all
changed. Use one of the two options above, then diff against the tag:

```bash
git diff --stat archive-ai-infrastructure-2026-11-03 -- app components lib next.config.ts
# Expected: empty, or only the later non-pivot fixes you deliberately kept.
```

### B.4 Verify, then release normally

```bash
npm ci
npx tsc --noEmit
npm run build
npx next start -p 8001        # smoke-test: /, /solutions, /pricing#contact, /how-it-works, /blog
```

Then push the branch, open a PR into the production branch, review, merge.
Vercel deploys from the merge. No force-push, no branch reset.

### B.5 What a source rollback does NOT restore

- **Hosting environment values** (Vercel env vars, domains, production-branch setting) — unchanged by Git.
- **DNS** — unchanged by Git. The `sitetech.ai` canonical mismatch predates the pivot and will still exist after restore.
- **Third-party configuration** — the Web3Forms inbox/key and the Calendly event live in those services.
- **Databases** — none exist in this project.
- **Leads received during the pivot.** Inquiries were delivered by email via Web3Forms to SiteTech's inbox; they are not in the repo. Save them before switching messaging back, and remember consent was given for SiteTech to *respond to that request* — not for anything else.
- **Search engine state.** The pivot used *temporary* (307) redirects for retired routes precisely so crawlers would not permanently re-map them. The four pre-pivot 308 redirects (`/platform`, `/workflows`, `/insights*`) were unchanged.
