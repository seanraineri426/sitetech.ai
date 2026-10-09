# M2 Spec: Role-Based Action Queue (supersedes "Daily Project Brief" as the M2 target)
Owner: Product (Sitetech AI PM). Approved direction: Sean + CTO, Oct 9, 2026.
Principle: **SiteTech is action-based, not report-based.** If an item doesn't hand a specific person a prepared action that protects schedule days or dollars, it doesn't ship.

## 1. What it is
Cursor/Grok Bot for GCs and developers: it knows the whole project and does the work, and a human approves.
- **Proactive:** overnight, SiteTech reads Procore, project email, and the schedule, finds what threatens schedule or cost, and prepares the next step for the right person. It's waiting at 6:30am.
- **On-demand:** "Ask SiteTech" command bar. Plain-English requests ("chase the steel shop drawings", "draft the change event for the EV chargers") produce the same verified drafts.
- **Nothing leaves without a human click.** M2 is read-only: the user sends from Outlook, or pastes into Procore.

## 2. Users (M2 = PE, PM, PX; Super and Developer/Owner's PM in M3)
| Role | Morning question | Queue gets |
|---|---|---|
| Project Engineer | What paperwork is blocking work? | Overdue RFIs blocking near-term activities; submittals stuck in review or R&R; ASI fabrication holds |
| Project Manager | Where's my cost and schedule exposure? | Vendor/sub schedule slips with $; owner directives with no change event; closed RFIs adding cost; long-lead release risk |
| Project Executive | What could hurt margin or the client? | Formal notices + deadlines (incl. owner pass-through); top-3 $ exposures across their jobs; owner decisions blocking procurement; PM approvals waiting > 2 days |

Routing: every finding gets an owner role (by rule) and a named person when Procore's assignee or ball-in-court gives one. Escalation: an action not acted on by its due date moves up one level (PE → PM → PX) with a one-line reason.

## 3. M2 action types (fixed set; each must pass its own test pack before launch)
| # | Trigger (finding) | Prepared action | Who approves | Output channel |
|---|---|---|---|---|
| A1 | RFI overdue + activity ≤ 14 days | Escalation email to ball-in-court with activity date, days to start, $ at risk, and a specific answer-by date | PE | Open in Outlook |
| A2 | Submittal in review past due, or R&R not resubmitted, linked activity ≤ 45 days | Chase email to reviewer or sub with release-by / resubmit-by date and lead time | PE | Open in Outlook |
| A3 | Approved submittal + later ASI | Fabrication-hold email to the sub/vendor naming the ASI and what changed | PE → PM | Open in Outlook |
| A4 | Owner directive with no CE, or closed RFI adding scope | Pre-filled change event (title, description quoting the source, reason code, linked RFI/email, ROM $ if known) | PM | Procore deep link + copy block |
| A5 | Vendor/sub slip vs schedule activity | Recovery options card: (a) expedite ask to vendor (drafted), (b) resequence suggestion naming the next unblocked activities (from P6 logic), (c) notify owner. Each shows float and $ impact | PM | Open in Outlook for (a)/(c); (b) is guidance |
| A6 | Formal notice received (sub or owner) | Acknowledgement/response draft + owner pass-through notice draft + calendar hold on the deadline | PX (PM prepares) | Open in Outlook + .ics |
| A7 | Owner decision open, blocks procurement by date X | Decision-request email to owner's rep with the options, the blocking date, and $/day after it | PM | Open in Outlook |

Not in M2: sending from our system, writing to Procore, pay apps, budgets, daily logs, photos, lender draws.

## 4. "Ask SiteTech" command bar
- Plain English. Maps the request to one of A1–A7 (or "find/show" questions answered with citations).
- If the request doesn't map: "I can't do that yet. Here's what I can do:" plus the closest actions. Never improvise an unverified action.
- Every answer and draft cites its records; tap a citation to open the Procore item or email.
- Examples that must work at launch:
  - "What's blocking level 3 this week?"
  - "Chase the curtain wall shop drawings."
  - "Draft the change event for the owner's EV charger email."
  - "Did anyone send us a formal notice this month?"
  - "What happens if the switchgear slips 3 weeks?"

## 5. UX for non-technical users (hard requirements)
GCs and developers are not software engineers. It has to be useful in the trailer, on a phone, in 30 seconds.
1. **No setup screens for the PE.** Admin connects once; the PE opens a link and their queue is there.
2. **Phone-first.** Every action card works one-handed on an iPhone. Desktop is a wider version of the same thing, not a different product.
3. **Plain construction language.** "RFI 112 is 6 days late and level 3 framing starts Tuesday", never "finding SUB-RR-NOT-RESUBMITTED". No jargon from our side: no "agent", "model", "confidence score".
4. **One card = one action.** Card shows: what happened (1 line), why it matters ($ and days), the prepared draft, and three buttons: **Approve & open**, **Edit**, **Dismiss** (with a one-tap reason: "already handled", "not relevant", "wrong").
5. **Dollars and days on every card.** If we can't compute them, the card says why ("confirm the schedule activity to see $").
6. **Morning entry point is email/Teams, not a new app.** 6:30am email: "You have 4 actions on Linden Yard, about $310k at risk." Each line deep-links to its card. Logging in is optional for approving.
7. **Speed:** queue loads < 2 s; draft opens in Outlook < 1 s after tap.
8. **Trust visible:** a small "checked against Procore 5:12am" line on every card; tap shows the source records.
9. **Quiet days are quiet.** No actions = one line: "Nothing needs you today on Linden Yard."
10. **Max 7 cards per person per day**, ranked by $; the rest are under "More" with the same ranking.

## 6. What a card looks like (example — fictional test data)
> **RFI 112 is 6 days late, and L3 framing starts Tue Oct 13**
> Architect hasn't answered the shaft-wall rating question. If framing slips, about $36k at risk (3 days × $12k).
> **Draft to:** architect (via Outlook) — "RFI 112 is now 6 days past due and controls L3 shaft framing starting Tue 10/13. We need the response by Fri 10/9 COB to hold the start…"
> [Approve & open] [Edit] [Dismiss]
> Checked against Procore 5:12am · RFI 112 · Schedule activity A2310

## 7. How we prove ROI (ships with A1)
Each action logs: created, shown, approved/edited/dismissed (+ reason), sent (user-confirmed or detected in the mailbox), and outcome:
- RFI/submittal: answered/returned before the activity start? Days of float preserved.
- Change event: created in Procore within N days of the directive? $ captured.
- Notice: responded before deadline? Y/N.
Pilot scorecard for the PX after 30 days:
- **Float days protected × daily delay cost**
- **Change dollars captured** (CEs opened that trace to an A4 card)
- **Notices answered on time** (count, %)
- **PE hours saved** (actions approved × minutes-per-action, which we time with the pilot PE during week 1)
- Dismiss rate by reason ("wrong" must stay < 5%)

## 8. Acceptance tests for M2
- Each action type A1–A7 passes its own variety pack (positives + negatives) with 0 false actions.
- Held-out project gate (existing): ≥ 10/11 caught, 0 false alarms, 0 unsupported claims — now applied to **actions**, not report lines.
- Every number in every draft matches its record (verifier) or the draft is replaced by the code template.
- Routing: on the test project, each action lands in the correct role's queue 100% of the time.
- Usability: a PE who has never seen it clears 5 cards on a phone in under 3 minutes with no help (tested with the pilot PE in week 1).
- Read-only: zero write calls to Procore or Graph (existing GET-only tests).

## 9. Changes vs. earlier plan
- "Daily Project Brief" becomes the 6:30am **action email** (a list of cards), not a report.
- Brief sections are removed. The ranking, checks, templates, and held-out tests carry over unchanged.
- New: roles, routing, escalation, command bar, outcome log, PX scorecard.
- Marketing and the pilot one-pager will be rewritten around "prepared actions that save days" (Product, next).

## 10. Open items for Sean
1. Confirm M2 roles: PE, PM, PX first.
2. Any action type missing from A1–A7 that a PE/PM at the pilot GC does every day?

## 11. Additions (Oct 9, after Sean's direction)
- **Sources:** Procore + project email (built) → Granola meetings (M2, Business/Enterprise Space API key per project) → physical note-takers (post-pilot, off-the-shelf device transcripts) → Teams/ACC/Sage only when a paying customer needs them.
- **Meeting actions (M2):**
  - A8: a commitment made in a meeting ("architect will answer RFI 112 by Friday") becomes a tracked item with owner + due; a missed due date triggers a chase draft. Unknown speaker = "confirm owner", never a guess.
  - A9: an owner decision with cost impact made in a meeting with no CE → pre-filled change event (same as A4).
  - A10: minutes drafted in the SiteTech OAC template (docs/product/oac-minutes-template.md), PM approves, pasted into Procore Meetings (M3: written back via the meeting topics API).
- **No mock data in anything a user sees.** Fictional fixtures exist only inside automated tests. Staging/first use = a real project (VCD, with VCD's written OK).
- **Positioning vs Procore AI:** see docs/product/procore-ai-positioning.md. Don't build what Procore ships (RFI drafting from field notes, daily logs, submittal-vs-spec review, generic minutes).
