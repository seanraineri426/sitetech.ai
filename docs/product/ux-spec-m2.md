# M2 UX spec: action queue (Product, Oct 9 2026)
> **Update Oct 9 (Sean): SiteTech is an enterprise desktop web app first.** The phone is a companion for approving from the morning email. Visual direction: dark, polished command-center look with real charts (see `design/desktop-*.png`, example data, design concept only). Desktop screens: Command center (PX portfolio), Project actions workspace (queue + detail + schedule impact + recovery options), Ask SiteTech (answers with charts and draft buttons), Schedule, Notices, Scorecard. The phone sections below still apply to the companion view.
Builds on `m2-action-queue-spec.md` §5. Users are PEs, PMs, and PXs, not software people. Every screen must be usable on an iPhone, one-handed, in the trailer, in 30 seconds.

## Principles
1. One card = one action. No dashboards, charts, or report pages in M2.
2. Days and dollars on every card, or a plain reason they're missing.
3. Plain construction language. Never show rule codes, "agent", "model", "AI", or confidence scores.
4. Nothing leaves without a human tap. M2 opens Outlook or a Procore page; it never sends.
5. **No mock data in any shipped screen.** Real project data or an empty state. Fictional fixtures render only in automated tests and a non-production design preview (`/preview`, blocked in production builds).
6. Quiet days are quiet.

## Navigation
Mobile: bottom bar with **Queue** · **Ask** · **Done**. Project switcher at the top (hidden when the user has one project). Desktop: same three in a left rail; the queue and an open card side by side.

## Screen 1: Morning email (6:30am project time; Outlook, also Teams later)
- Subject: `4 actions on Linden Yard · about $310k at risk` / quiet: `Nothing needs you today on Linden Yard`.
- Body: one line per card (headline + $ / days), ranked by $, max 7, each deep-links to the card. "More (3)" link.
- Footer: "Checked against Procore and project email at 5:12am."
- Signed link: opening a card from the email doesn't require logging in for viewing and approving (magic-link token scoped to that user + card, expires in 24h). Editing settings requires sign-in.

## Screen 2: Queue
- Header: project name, "4 actions · $310k at risk", last checked time.
- Cards ranked by $ (days as tiebreak). Max 7, then a "More" section with the same ranking.
- Each collapsed card: headline (≤ 80 chars), one line with $ and days, due chip ("due today", "2 days left", "overdue 1 day" in red), role tag only if the user holds more than one role.
- Escalated cards show "Moved up from PE: not acted on by Oct 8".
- Swipe right = open, swipe left = dismiss (same reasons sheet). Pull to refresh.
- Empty: "Nothing needs you today on Linden Yard." and the time of the last check. No illustrations or filler.

## Screen 3: Action card (expanded)
Order, top to bottom:
1. Headline: what happened, in one line.
2. Why it matters: one sentence, $ and days ("If framing slips, about $36k at risk: 3 days × $12k").
3. Prepared action: draft preview (to, subject, first 3 lines), or for A4 the change event fields, or for A5 the three recovery options.
4. Buttons: **Approve & open** (primary, full-width, thumb zone), **Edit**, **Dismiss**.
5. **Why** line (tappable): the exact email quote or record field that triggered the card.
6. **Confirm** chips where a match was by name only or the owner is unknown ("Confirm activity", "Confirm owner"). Never a confidence score.
7. Trust line: "Checked against Procore 5:12am · RFI 112 · Activity A2310". Tap opens a sheet listing each source record with a link to it in Procore or the email in Outlook.
If $ can't be computed: replace line 2 with the reason and a fix ("Link a schedule activity to see $" with a picker).

## Screen 4: Edit and approve
- Full-screen editor for the draft: recipient(s), subject, body. Numbers that came from records are highlighted; editing one shows "This no longer matches RFI 112 (due Oct 3)" but still allows it.
- **Approve & open**: email → opens Outlook (mobile app or web) with the draft filled in; Procore → opens the right Procore page and copies the change event block to the clipboard with a "Copied" toast.
- After return: "Did you send it?" Yes / Not yet. (Mailbox detection confirms later; the answer feeds the outcome log.)
- Dismiss sheet: Already handled · Not relevant · Wrong (optional note). "Wrong" goes to Product review.

## Screen 5: Ask SiteTech
- One text box at the top ("Ask or tell SiteTech to do something"), mic button for voice.
- Suggested prompts from the user's own queue ("Chase the curtain wall shop drawings").
- Answers: plain sentences with tappable citations. Action requests return a card (Screen 3) that's the same as a queue card.
- Out of scope: "I can't do that yet. Here's what I can do:" plus up to 3 nearest actions as buttons.
- History of the user's last 20 asks under the box.

## Screen 6: Admin setup (one-time, desktop; the PE never sees it)
Stepper, each step shows status (Not started / Waiting on IT / Connected / Problem):
1. Company and project: name, time zone, holidays.
2. Connect Procore (install app on one project).
3. Connect Microsoft 365 (send the IT approval link; shows who it went to and status).
4. Schedule: Procore schedule or P6 XER upload.
5. Granola (optional).
6. People and roles: PE, PM, PX (and super) from the Procore directory, confirm mapping ("their APM = our PE").
7. Daily delay cost, notice periods, project parties.
8. Turn actions on/off (A1–A10, defaults on).
Finish: "First queue arrives tomorrow at 6:30am." Unmapped items show as "needs a decision", never guessed.

## Screen 7: PX scorecard (day 30, also live)
Four numbers, each tappable to the list of actions behind it: float days protected × daily delay cost; change dollars captured; notices answered on time; PE hours saved. Plus the dismiss rate by reason. No charts in M2 except a simple weekly bar for $ protected.
- A number counts only when code confirmed the outcome from synced data after a human approved the action (e.g. RFI answered before activity start; change event exists in Procore within 5 days). Self-reported "sent" alone never counts.
- **Export as a one-page PDF** the PX can forward to their CFO: the four numbers, each with links to the exact action and record behind it.

## States every screen needs
Loading (skeleton, < 2 s target), empty, error ("Couldn't reach Procore at 5:12am; showing yesterday's check" with time), offline (cached queue, buttons that need the network disabled), and data stale > 24h (yellow banner).

## Visual (desktop-first)
Dark navy base with indigo/violet accent gradient; cards on raised panels; charts in SVG (exposure vs protected area chart, float-by-project bars, schedule-impact Gantt with dashed slip, scenario bars). Color meaning is fixed: red = at risk/overdue, amber = slipping/due soon, green = protected/on track, indigo = change event, cyan = commitments. Dollars in tabular numbers. Left nav (Command center, Actions, Ask, Schedule, Notices, Scorecard, projects), ⌘K Ask bar on every page. Phone companion uses the same tokens, light/dark follows the device.

## Acceptance (M2)
- A PE who has never seen it clears 5 cards on a phone in under 3 minutes without help.
- Queue loads < 2 s on 4G; Approve & open hands off to Outlook in < 1 s.
- Zero sample data reachable in a production build (CI check that `/preview` and fixtures are excluded).
- Every card has $ and days, or a reason and fix.
- No native app in M2: responsive web app on shadcn/ui + Tailwind; morning email via Resend or Postmark on sitetech.ai with SPF, DKIM, DMARC.

## Build order
Screens 3 → 2 → 4 → 1 → 6 → 5 → 7. A card that works end to end on the first real project comes before everything else.
