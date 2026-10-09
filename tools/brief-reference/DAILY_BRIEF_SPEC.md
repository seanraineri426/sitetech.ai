# Daily Project Brief: Engineering Spec (v0.1)

**Owner:** AI & Agent Systems Engineer · **Date:** 2026-10-06 · **Implements:** `/workspace/sitetech/daily-project-brief-spec.md` (product spec v0.1, Sean)
**Machine contract:** `schemas/brief.schema.json` · **Reference output:** `examples/brief_linden_yard_2026-10-06.json` → `examples/render_brief.py` → `.md`

The product spec defines *what* the brief is: the PX/DM reader, a 3-minute read, ≤ 700 words, ≤ 7 ranked items, every item tied to days or $, cited, with an owner, date, and next step. This document defines *exactly how* the pipeline decides what goes in it: rule IDs, thresholds, ranking math, diffing, and the output schema. Where this spec extends or departs from the product spec, it says so in **§0.1**.

---

## 0. Scope

- One brief per project per business day. It is written for the PX / owner DM. Secondary readers (PM, super) get the same JSON rendered with different defaults later.
- Every item rests on **findings** (deterministic rule outputs in the `findings` table) and/or **linked records**. Models select, connect, and phrase. Code computes every number (ARCHITECTURE §2, §9).
- Milestones: M1 produces the RFI/submittal findings and the overdue lists only, with no written brief. M2 produces the first written brief (RFI, submittal, email, decisions). M3 adds schedule, cost, procurement, and daily-log rules. Sections whose sources aren't connected yet are **omitted, and the omission is listed in `gaps`**. They are never shown as empty.

### 0.1 Extensions and deviations from product spec v0.1 (please confirm)

| # | Product spec says | This spec does | Why |
|---|---|---|---|
| D1 | Brief covers "Mon 6:00 AM → Tue 6:00 AM" and is titled with the delivery date | `as_of` = **the business day covered**. Day counts are as of close of that day. Delivered next morning at 06:15 (e.g., "Covers Tue 10/6 · generated Wed 10/7 5:52 AM") | Snapshots are reproducible per business day, findings carry one `run_date`, and the eval fixture is keyed this way. The alternative costs one day of off-by-one ambiguity. Sean to confirm the label |
| D2 | Manpower: < 70% of plan for ≥ 3 consecutive workdays | Keeps that rule, **plus** an *acute* trigger: a ≥ 40% day-over-day drop to < 50% of plan on an activity with TF ≤ 5 wd, not weather-related | A critical-path crew halving overnight shouldn't wait 3 days. The acute trigger is capped at *Likely* until it repeats |
| D3 | Ranking uses "cost_exposure_$" | Defines exposure **by kind** (§5.2). Exposure already recognized in the budget's pending column counts once, under contingency, not again per item. Payment risk (overbilling) is weighted by a configurable non-recovery factor | Prevents double counting and keeps a $145k ROM that is already in the budget from outranking a critical-path threat |
| D4 | Floors: critical-path items | Adds a **contractual-notice floor** (open notice window ≤ 10 business days) and an **owner-contingency floor** | A missed notice can waive recovery regardless of $. Owner readers need contingency alarms even when no single item is large |
| D5 | Email delivery at 06:15 | V1 shows the brief in-app. Email delivery needs a sender decision, because there is no `Mail.Send` on the customer tenant | Integrations scope is read-only (ARCHITECTURE §0) |
| D6 | MVP Q&A limited to "why is this here / show source" | The JSON carries `claim_ids` and citations per item, enough for both that and the CTO's M3 chat box | Scope decision for Sean (README) |

---

## 1. Run definition

| Term | Definition |
|---|---|
| `as_of` | Project-local business day being reported (5-day calendar + project holidays from onboarding) |
| Coverage window | `(prior brief's cutoff_at, this cutoff_at]`. Monday's brief therefore includes weekend activity. Records are attributed by source timestamps (`updated_at`, `received_at`, `log_date`) |
| `cutoff_at` | When all required syncs reported `sync.completed`, or the hard deadline of 05:20 local. Anything later goes into the next brief |
| Compare-to | The latest **published** snapshot with `as_of` < this `as_of` (normally the prior business day). If it is missing: `basis = prior_snapshot_missing` and no NEW/WORSE tags. First run: `first_run_no_prior`, labeled "Baseline brief" |
| Days overdue | **Calendar days**, `as_of − governing_date`, floored at 0. Stored on the finding (`days_overdue`). (Verify whether the customer's Procore "days overdue" uses business days. If so, make it configurable per tenant) |
| Float | **Working days** from the schedule source (`total_float_wd`, `free_float_wd`). Never mixed with calendar days in arithmetic. Conversions go through the project calendar |
| Delay $ | Calendar-day shift of the key milestone × `daily_delay_cost` (GC general conditions/day + owner carry/day, from onboarding) |
| Watched activities | Activities with TF ≤ 10 wd, on the driving path to a key milestone, or mapped to a long-lead spec section (onboarding list) |

---

## 2. Brief anatomy (render order)

1. **Header + data freshness line.** One line per source, with band (ARCHITECTURE §4), e.g. *"Schedule as of XER data date Mon 9/28 (uploaded Fri 10/2): aging"*, plus scope notes (*"Only lindenyard@… is covered"*) and the effect of the band on confidence.
2. **Project status:** ≤ 3 lines (§4.1).
3. **Top of Brief:** ≤ 7 items ranked by impact across all categories (§5).
4. **Reference sections** (collapsed by default in the UI; top items appear as one-line pointers, never repeated in full): New schedule risks · Cost risks · Overdue RFIs · Overdue submittals · Procurement issues · New decisions · Unresolved decisions · Significant emails.
5. **Management action items:** one per problem, owner · due · unblocks.
6. **Watching** (below threshold, kept visible for continuity), **Closed since last brief** (one line each, shown once), **Gaps**.

**Mapping the ten requested sections to the product spec's eight:** executive status → 4.1. New schedule risks → 4.2. Cost risks → 4.3. Overdue RFIs → 4.4. Overdue submittals → 4.5. Procurement issues → 4.6. New + unresolved decisions → 4.7, split into two lists. Significant emails → new list (§4.9), feeding all sections. Management action items → 4.8.

**No all-clear noise.** An empty section is omitted. On a quiet day the brief is the status block plus *"No new exposure detected. N items being watched."*

---

## 3. Severity and governing dates (shared)

- **Severity scale:** `low < medium < high < critical`. Base by days overdue: ≥ 10 → high, 5–9 → medium, 1–4 → low (M1 code `base_by_days`). Raised one level when a declared or linked schedule impact exists, or when the linked ROS risk is high or critical. Severity orders rows *within* a section. It is not the ranking (§5).
- **Governing date:** the date whose passing makes the item late (`due_date`, `submit_by`, `latest_return_date`, `quote_expiry`, `notice_deadline`, `needed_by`). Stored on the finding as `governing_date` and `governing_date_kind`.
- **Decision deadline:** the last date on which action still prevents the impact. It drives urgency (§5.3). It often differs from the governing date: RFI 42 was due 9/29, but the decision deadline is the fabricator's 10/9 release.

---

## 4. Section definitions, inclusion rules, and thresholds

Rule IDs are stable. A finding stores `rule_id` and `rule_version`. CORRELATION_PLAYBOOK `PB-xx` patterns combine these findings across systems. *M1* rules are implemented in the fixture generator (`evals/fixture/src/p2_rules_m3.py → m1_findings`). The rest are specifications for M2/M3.

### 4.1 Executive project status (3 lines)

| Health | Rule (first match wins) |
|---|---|
| **Slipping** | Key-milestone forecast in the latest schedule is later than baseline, **or** Confirmed critical-path exposure totals ≥ 5 days |
| **At risk** | Likely-or-better exposure on near-critical items (TF ≤ 5 wd) totals ≥ 3 days, **or** net new cost exposure today > 10% of remaining contingency, **or** the owner-contingency floor (§4.3 COST-CONTINGENCY-BURN) fires |
| **On track** | None of the above |
| **Unknown (schedule)** | Schedule band = missing. Health is computed from cost only, and the line says "schedule impact unknown: no current schedule" |

- Line 1: health, key milestone forecast vs. baseline (with the schedule basis), and the largest conditional exposure.
- Line 2: net new cost exposure, split into *recognized* (entered the budget's pending or approved columns since the last snapshot) and *at risk* (quantified but not yet recognized). Add contingency position if the floor fired.
- Line 3: decisions needed this week, and items flagged vs. shown.
- The `health_rule` that fired is stored and shown on hover.

### 4.2 New schedule risks *(M3; schedule source-agnostic: P6 XER or Procore schedule)*

| Rule ID | Fires when | Default severity |
|---|---|---|
| `SCH-FLOAT-EROSION` | A watched activity's TF drops by ≥ 3 wd between consecutive schedule updates, **or** crosses from > 5 to ≤ 5 wd | high if TF ≤ 5 after; critical if ≤ 0 |
| `SCH-NEG-FLOAT` | Any activity with TF < 0 | critical |
| `SCH-DRIVING-PATH-CHANGE` | The set of activities on the driving path to a key milestone gains a member that was not on it in the prior update | high |
| `SCH-MILESTONE-SLIP` | Key milestone forecast moves later by ≥ 1 wd vs. prior update, or sits later than baseline | critical if > baseline |
| `SCH-UNSTARTED-ERODING` | Activity with early start ≤ today and no actual start: projected TF = TF at data date − workdays since data date (flagged when projected TF ≤ 5) | high |
| `SCH-MANPOWER-SUSTAINED` | Trade manpower < 70% of planned crew for ≥ 3 consecutive workdays on a watched activity (product spec) | high on TF ≤ 5 |
| `SCH-MANPOWER-ACUTE` | Day-over-day drop ≥ 40% **and** < 50% of planned, on TF ≤ 5 wd, with **no weather delay that day** (D2) | high; confidence ≤ Likely until repeated |
| `SCH-INSPECTION-FAIL` | Failed inspection on an activity with TF ≤ 10 wd, or a re-inspection within 5 wd | medium; high if TF ≤ 5 |
| `SCH-DELAY-LOG` | Delay-log entry of any type on an activity with TF ≤ 5 wd | medium |
| `SCH-WEATHER-DAYS` | Cumulative weather-lost days > weather days carried in the schedule | medium |
| `SCH-UPSTREAM-BLOCKER` | Open RFI / submittal / undelivered material linked to an activity starting within 15 wd | by linked severity |
| `SCH-DWG-REV-AFTER-APPROVAL` | Drawing revision issued **after** a linked submittal was approved (link by spec section and sheet), with the work not yet installed | medium; high if fabricated material is mentioned |

**Freshness:** float and dates come from the latest schedule update. With an aging schedule (8–14 days since data date), schedule-derived impacts are capped at **Likely** unless a fresher record independently corroborates them. With a stale one (15–28 days), they are capped at **Signal** and the brief adds the action "request current schedule update" (ARCHITECTURE §12.2).
**Impact method:** S7 code propagates the modeled slip through successors. Milestone shift = max(0, slip_wd − TF_wd), converted to calendar days on the project calendar.

### 4.3 Cost risks *(M3)*

| Rule ID | Fires when | Notes |
|---|---|---|
| `COST-CONTINGENCY-BURN` | Owner or GC contingency used **incl. pending** − % complete (cost) ≥ 30 points, **or** remaining < 10% of original, **or** net new exposure today > 10% of remaining (product spec) | **Owner-contingency floor** (D4) |
| `COST-CE-UNPRICED` | Open change event with no ROM after 7 days, or ROM but no pricing after 14 days (product spec) | Age from CE creation |
| `COST-RFI-NO-CE` | RFI with cost impact yes/TBD whose answer contains change language ("revise", "provide", "add", "see ASI") and has no linked CE within 5 business days | |
| `COST-BUYOUT-GAP` | Budget line with no executed commitment, where the install activity starts within (lead time + 30 days), or an owner selection blocks buyout | e.g. pavers |
| `COST-PAYAPP-AHEAD` | SOV line billed % − schedule-earned % ≥ 15 points **and** ≥ $100k. Schedule-earned % = duration-weighted completion of the mapped activities at data date | Likely at best when the schedule is aging |
| `COST-RETAINAGE-REQUEST` | Sub requests a retainage reduction or expedited payment while `COST-PAYAPP-AHEAD` or a manpower rule is open on the same company | Feeds PB-10 (distress) |
| `COST-COMMITMENT-DRIFT` | Pending commitment COs plus Signal-level exposure > 10% of the commitment's remaining value | |
| `COST-APPROVED-NOT-ISSUED` | Owner approval found (email/minutes) but no executed CO after 5 business days | Shown under New decisions until it ages |
| `COST-SCOPE-LANGUAGE` | Email from a sub, supplier, or design team containing scope/cost language (product spec list), tied to a scope key | Signal unless corroborated |

### 4.4 Overdue RFIs *(M1, implemented)*

| Rule ID | Fires when | `days_overdue` | Severity |
|---|---|---|---|
| `RFI-OVERDUE` | `status = open` **and** `due_date < as_of`. Drafts excluded | `as_of − due_date` (calendar) | base_by_days, +1 if `schedule_impact.status ∈ {yes_known, yes_unknown}` |
| `RFI-BIC-STALL` *(M2)* | Ball-in-court unchanged > 7 days on an open RFI (needs `event_log` history) | 0 | low, +1 if linked to a watched activity |
| `RFI-ANSWER-NOT-ACTED` *(M2)* | Answer contains "see revised", "ASI to follow", "bulletin", "provide", "add", and no CE or drawing revision is linked within 5 business days | 0 | medium |
| `RFI-SHADOW` *(M2)* | Email to the design team asking a design question (S1 intent = `design_question`) with no matching RFI after 3 business days | 0 | low (Signal) |
| `RFI-REPEAT` *(M2)* | ≥ 3 RFIs on the same spec section or detail within 30 days | 0 | medium |
| `RFI-NO-DUE-DATE` | Open RFI with no due date | 0 | listed in Gaps, not ranked |

**Listing:** every open `RFI-OVERDUE` appears in the Overdue RFIs table, sorted by severity, then days overdue. An RFI goes into the **Top of Brief** only through ranking (linked impact), never for age alone. Example: RFI 39 is 6 days overdue, but its activity has 35 wd of float, so it is listed with a "low priority" note and not ranked.
**Closed since last brief:** a finding that resolves (status closed, or due date extended past `as_of`) appears once in the footer with *how* it closed. A due-date extension is labeled as such, not as "answered."

### 4.5 Overdue submittals *(M1, implemented)*

Evaluated on the **current revision** of each submittal series.

| Rule ID | Fires when | `days_overdue` | Severity |
|---|---|---|---|
| `SUB-REVIEW-OVERDUE` | Status Open, `received_date` set, `due_date < as_of` | `as_of − due_date` | base_by_days, +1 if ROS risk high/critical |
| `SUB-SUBMIT-BY-MISSED` | Status Draft, `submit_by < as_of`, no `received_date` | `as_of − submit_by` | base_by_days, +1 if ROS risk high/critical |
| `SUB-ROS-RISK` | ROS and lead time present and **margin ≤ 14 days**, where `latest_return = required_on_site_date − lead_time − buffer_time` and `projected_return` = (in review) max(due_date, as_of), or (draft) max(submit_by, as_of) + design_team_review_time + internal_review_time. `margin = latest_return − projected_return` | `max(0, −margin)` | critical if margin < 0; high if ≤ 5; medium otherwise |
| `SUB-REV-LOOP` | ≥ 2 "Revise and Resubmit" responses in the series | days past `submit_by` only if the next revision **has not been received** | high if ROS risk high/critical, else medium |
| `SUB-ROS-MISSING` *(M2)* | Long-lead spec section (onboarding list) with no ROS or lead time | 0 | Gap + onboarding task (ask, don't guess) |

Procore's documented submittal schedule math is *Planned Return = ROS − Lead Time* (verify the exact field semantics per tenant). `SUB-ROS-RISK` adds `buffer_time` and the projected review duration, so it fires **before** the planned return date passes.

### 4.6 Procurement issues *(M3; M2 for email-only signals)*

| Rule ID | Fires when | Severity |
|---|---|---|
| `PROC-PO-NOT-ISSUED` | Submittal approved and the commitment still Draft/unexecuted > 10 business days later, **or** PO-needed date (ROS − lead time − fabrication buffer) within 15 wd | high |
| `PROC-QUOTE-EXPIRY` | Unissued PO with quote expiry within 10 business days (expiry date from a commitment field or email extraction) | high if the post-expiry lead time increases |
| `PROC-VENDOR-DATE-SLIP` | Email-extracted ship/delivery date later than the prior extracted date, or later than ROS | by margin |
| `PROC-RELEASE-DEPENDENCY` | Vendor states a release prerequisite (approved drawings, RFI answer, deposit) with a date, and the matching record is not closed | high when the date is ≤ 5 business days away |
| `PROC-NO-SHIP-CONFIRM` | Long-lead item within 30 days of ROS with no confirmed delivery date or acknowledgment | medium |
| `PROC-DELIVERY-MISSED` | Expected delivery date passed with no delivery-log entry | medium |

### 4.7 New decisions / unresolved decisions *(M2)*

**Decisions register** (ARCHITECTURE §6) sources: meeting items typed `decision_pending` or `decision_made`, email decisions (S1 intent `decision_made` or `decision_requested`, with the decider's role resolved from the directory), and owner-BIC RFIs and change events.

| Rule ID | List | Fires when |
|---|---|---|
| `DEC-NEW` | New decisions | Decision made within the coverage window (email or minutes). Shows any required follow-through ("CO must be issued") |
| `DEC-OVERDUE` | Unresolved | `needed_by < as_of` and still pending |
| `DEC-CARRIED` | Unresolved | Carried in ≥ 2 meetings (product spec) |
| `DEC-DUE-SOON` | Unresolved | `needed_by` within 10 wd |
| `DEC-BLOCKING` | Unresolved | Blocks a §4.2–4.6 item with ≥ 2 days at risk |
| `DEC-NO-FOLLOW-THROUGH` | Unresolved | Decision made or promised in a meeting with no corresponding record action (CE, CO, submittal, RFI answer) after 5 business days |

Each decision shows the options **as stated in the source**, the owner, the deadline, and the **cost of waiting** (days × daily delay cost, or float erosion per day). It shows **no recommendation on owner design or commercial choices** (product spec §4.7).

### 4.8 Management action items

- Exactly **one action per top item or decision**, de-duplicated across emails.
- **Owner:** a named person resolved from the Procore directory or email sender, with role.
- **Due:** the earlier of the date stated in the source and (decision deadline − 1 business day).
- **Definition of done:** a verifiable record state ("RFI 42 closed and rev 1 returned").
- Drafted messages (T1, stored in SiteTech) are attached via `draft_ref` once draft tools are enabled. In V1 they are disabled (tools/tool_schemas.json).

### 4.9 Significant emails *(M2)*

S1 extracts per message: `intent[]`, dates, $, record numbers, scope keys, `notice_language`, and `sentiment_risk`. Significance score:

| Signal | Points |
|---|---|
| Contractual notice language ("notice of delay", "reserve our right", "claim", "pursuant to Section") | **automatic include** |
| States a dated consequence ("if we miss X, Y moves to Z") | 3 |
| Cost/scope language tied to a scope key | 2 |
| Decision made or requested by an owner, PX, or design principal | 2 |
| Cash strain / payment acceleration / retainage request | 2 |
| From a lender, monitor, AHJ, or utility | 2 |
| Links (L1/L2) to an open finding or top item | 1 |
| Design-team return (R&R, rejected) | 1 |
| Internal logistics, social, automated notifications, or newsletters | −5 |

Include if score ≥ 3. Show at most 6, by score. **The negation rule:** a risk word with a non-project object ("lunch & learn delayed") scores −5. That is fixture control N1.

### 4.10 Watching, Closed, Gaps

- **Watching:** items with impact below the floor or confidence below Signal-promotion, which the reader has seen before. At most 5, one line each. They drop off after 5 business days without change.
- **Closed since last brief:** findings resolved in this run, plus top items from the prior brief that no longer fire. Shown once.
- **Gaps:** missing or stale sources, missing permissions, missing ROS/lead time on long-lead items, unconfirmed contract terms, and mailbox scope.

---

## 5. Ranking and prioritization

### 5.1 Score (product spec §3.1, made exact)

```
score = ( P(schedule claim) × delay_usd  +  P(cost claim) × direct_usd ) × urgency
delay_usd  = milestone_cd × daily_delay_cost            # S7 code: slip beyond float, on the project calendar
direct_usd = exposure by kind (5.2)
P          = Confirmed 0.9 · Likely 0.6 · Signal 0.3     # taken from the label of the IMPACT claim, not the facts
```

### 5.2 Exposure by kind (D3)

| Kind | `direct_usd` | Example |
|---|---|---|
| `recognized` | $ that newly entered the budget's pending or approved columns since compare-to. Counts **once**, on the contingency item | CE-031 $145k ROM |
| `at_risk` | Quantified exposure not yet in the budget: email-stated price, a ROM in a CE not yet in pending, or unit-cost estimate (method shown) | Sub's "9 crew-days + materials" |
| `escalation` | Quoted price change × amount | Switchgear +4% = $19,460 |
| `payment_risk` | Overbilled amount × (1 − retainage%) × P(non-recovery). Default **0.25**; config per tenant | $702k × 0.9 × 0.25 |
| `unpriced` | 0. Can only rank through a floor or delay_usd | Polar notice (CE-030) |

### 5.3 Urgency, floors, caps, ties

- **Urgency** from business days to the **decision deadline**: past or ≤ 2 → 1.5; 3–5 → 1.25; 6–10 → 1.1; > 10 or none → 1.0.
- **Floors** (always in the top 7; a floor item displaces the lowest-scoring non-floor item):
  - `critical_path`: activity TF ≤ 5 wd with ≥ 2 days of exposure (product spec).
  - `notice_window`: an open contractual notice window closing in ≤ 10 business days, with the term confirmed by a human.
  - `owner_escalation`: COST-CONTINGENCY-BURN on owner contingency.
- **Signal cap:** a Signal item cannot be #1 unless its impact is > 5 days or > $100k (product spec).
- **Order:** scored items by score, descending. Unscored floor items after them, by deadline. **Ties** (scores within 2%) go to the earlier decision deadline, then higher severity, then older `first_detected_on`.
- **Merging before ranking:** the correlator merges findings that share a mechanism into one insight (e.g., RFI 42 + submittal 6103 + Bayline email + A1225/A1230 = one item). One item may satisfy several answer-key findings.
- **Overflow:** if more than 7 items qualify, show 7 and print "N items flagged, top 7 shown". Items 8+ go to their sections, never to a longer top list.
- **Overrides:** PX "always show X" and "mute Y" are applied after scoring and logged to `audit_log` as feedback. A muted item returns only if it gets WORSE.

### 5.4 Worked ranking: fixture day 2 (2026-10-06), daily delay cost $16,000/cd

Generated by `evals/fixture/src/reference_ranking.py` → `evals/fixture/reference_ranking.json`.

| Rank | Answer-key finding | Delay basis | Direct $ | Urgency | Score | Floor |
|---|---|---|---|---|---|---|
| 1 | F3 Switchgear PO / quote expiry | 9 wd beyond float → 14 cd → $224k × 0.6 | $19,460 × 0.9 | 1.25 (10/9) | **$189,892** | — |
| 2 | F1 Transfer steel | 10 wd slip − 3 TF = 7 wd → 12 cd → $192k × 0.6 | — | 1.25 (10/9) | **$144,000** | critical_path |
| 3 | F4 Owner contingency | — | $145,000 recognized × 0.9 | 1.0 | **$130,500** | owner_escalation |
| 4 | F5 Timberline pay app | — | $702k × 0.9 × 0.25 × 0.6 | 1.25 (10/13) | **$118,462** | — |
| 5 | F2 Windows R&R loop | 1 more cycle: 20 wd − 12 TF = 8 wd → 13 cd → $208k × 0.3 | — | 1.5 (10/7) | **$93,600** | — |
| 6 | F6 Framing manpower | 5 wd × (1 − 6/16) ≈ 3 wd → 5 cd → $80k × 0.6 | — | 1.0 | **$48,000** | critical_path |
| 7 | F8 Polar notice | unpriced | — | 1.1 (10/15) | 0 | notice_window |
| — | F7, F9, F10, F11 | float absorbs; $ unpriced or already recognized | | | 0 | sections only |

Note why F11 (pit rock, $145k ROM) is **not** ranked on its own: that $145k is recognized in the budget today and is counted once under F4 (D3). F11 appears in Cost risks with its RFI 41 deadline. *(Amended 2026-10-06 by §5.5 rule 3 and the D3 amendment: a differing site condition now carries its own exposure line and owner-notice flag; totals still count the $ once.)*

### 5.5 PM product rules and notice guardrails (2026-10-06; win over §5.1–5.4 where they differ)

**Ranking rule (PM).** Items are ordered by schedule $ = days of possible critical-path slip (S7 code, milestone cd) × the project's daily delay cost; ties go to the earlier due/decision date. Items with no schedule $ follow, by cost exposure. Items with **no $ exposure** rank below every item with exposure, then by severity, then by due date (a pending credit without a change order cannot outrank a real risk unless a floor applies). Probability weights (§5.1 P) do not order items; labels are still shown. Floors (§5.3) still guarantee top-7 membership.

1. **Formal contractual notice is always pinned.** Any formal contractual notice (delay, claim, cost/change, default, differing site condition, reservation of rights under a contract section) is always in Management Attention (top items, floor `notice_window`) with its computed response deadline, regardless of dollar rank or window length. This replaces the §5.3 `notice_window` floor condition ("closing in ≤ 10 business days").
2. **Approved before a later design revision.** A submittal approved before a later design revision (ASI, bulletin or drawing revision affecting its spec section) is its own item, one per submittal, phrased "*<submittal> approved <date> before <drawing rev> (<instrument>, issued <date>): approved before revision, confirm fabrication hold*". Never merged into another item (code-owned; analysts may cite it but not absorb it).
3. **Differing site condition.** A differing site condition (unforeseen rock, soil, groundwater, existing/concealed conditions, typically via an RFI, delay log or CE) is its own item with its own exposure line (linked CE ROM as `at_risk`), not absorbed into the contingency item, plus the flag "owner notice may be required" (with the configured differing-site-condition period's deadline if one exists, else "deadline unknown, check the contract").
4. **Open owner decision with its blocking date.** An open owner decision is listed under Decisions with the date it starts (or started) blocking procurement or schedule: the earliest governing date (submit-by, latest return, PO-needed, quote expiry, start) of the non-decision findings in the same issue cluster ("blocking since 10/3 (paver submittal submit-by)").

**D3 amendment.** An item whose records drive a cost risk (e.g. an RFI or delay log linked to a CE with a ROM) carries its own exposure line, used for its ranking and shown on the item. Portfolio totals (contingency used incl. pending, remaining) still count each dollar once; the item line is marked "counted once in contingency totals".

**Section entries carry record facts.** Every section entry (and top item, as a "Record facts" line outside the 700-word body) shows, where the records have them: each record's due/governing date with days overdue (or days out) and ball-in-court, open activities' total float with the schedule source and data date, the slip basis (cd to the key milestone, code or quote-verified scenario), the item's own $ exposure lines, and notice / owner-notice flags.

**Notice guardrails (CTO).**
- Response deadlines come **only** from configured notice periods (`project_notice_periods`: contract owner-GC | GC-sub (+ sub name or `*`), notice_type delay | cost_or_change_claim | differing_site_condition | other, days, day_basis calendar | business, contract_section citation, entered_by/at; fixture extension `trigger` event | notice_received). There is **no default number of days** anywhere. No matching row → deadline null and the brief shows "deadline unknown, check the contract".
- The model only classifies an email as a formal notice and cites it (verbatim quote required); code computes every deadline. A model-proposed notice deadline or notice-window scenario is never accepted.
- The notice timestamp (UTC receivedDateTime) is converted to the project time zone (`timezone`, required, no default) before counting days; business-day periods use the project's holiday list (`holidays`, may be empty). Event-triggered periods start at the issue date of the design-change instrument named in the notice.
- A notice that arrived via forward/BCC fallback (source flag) shows "verify notice date" instead of a firm deadline.
- For a subcontractor's notice, the GC-sub period is shown as a fact ("timing for the project team to review"), never as a conclusion.
- Wording flags risk ("response window may be running"); never legal conclusions ("rights waived", "claim accepted/rejected/valid", "entitled/entitlement", "time-barred", "liable", "breach", "notice was late/untimely/valid"). The verifier drops claims and removes brief sentences containing these phrases (verbatim record quotes exempt) and reports them in the gate report.

---

### 5.6 Additional deterministic findings (2026-10-06, held-out gaps; M1/M2 trim same day: items 4, 5, 9 deferred to M3)

These fire as their own findings (with code-computed exposure where noted). They do not depend on any one project's IDs.

1. **Email-driven schedule slip (`SCH-EMAIL-DATE-SLIP`).** When an email states a new date for a utility / long-lead / milestone item that maps (via record links, then spec/scheduled_task — never submittal `location`/`cost_code`) to schedule activities on the driving path or with TF ≤ 10, fire a finding with dollar exposure = days of slip (from the two dates in the email) × daily delay cost. Do not leave it as a Significant-email row only.
2. **Closed RFI with declared impact and no CE (`RFI-CLOSED-IMPACT-NO-CE`).** A closed RFI whose `cost_impact` or `schedule_impact` is `yes_*` and that has no linked change event → finding.
3. **Owner directive by email with no CE (`COST-OWNER-DIRECTIVE-NO-CE`).** An email from a `project_parties` row with role `owner` that directs a scope/finish change and states a dollar amount, with no matching CE/PCO/CO on file → finding (unrecorded change) with an `at_risk` exposure line. Not merely a Decisions row.
4. ~~Manpower decline (`SCH-MANPOWER-TREND`)~~ **Deferred to M3** (CTO/Lead/Integrations M1/M2 trim, 2026-10-06). Removed from brief logic; `SCH-MANPOWER-ACUTE` / `-SUSTAINED` (§4) unchanged.
5. ~~Failed inspection in daily-log notes~~ **Deferred to M3** (M1/M2 trim, 2026-10-06). `SCH-INSPECTION-FAIL` reads typed `inspection_log` rows only (§4, as before). RFI `location` stays a first-class field. Submittal rules never rely on `location` or `cost_code`.
6. **Trap: automated delivery-delay emails.** If a `delivery_log` **or a later email / Procore record** clearly says the same material / PO / order was received, delivered, on site, or inventoried, that delay email is never Significant and never a top-item claim (code score forced down; verifier drops delivery-delay claims contradicted by the confirmation). Same-thread confirmations and shared PO/SO keys both count.
7. **`project_parties`.** Every project lists parties with roles `owner` | `architect_engineer` | `gc` | `sub` and email `domain`. Models see `Company (role)`, never raw addresses. Unknown domain → unknown party; a formal notice from an unknown party → deadline unknown (no owner-GC period applied).
8. **Long-lead / overdue review exposure.** When a submittal sits with the reviewer past the review period (`SUB-REVIEW-OVERDUE`) and an activity float or ROS margin is known, code attaches a `delay_chain` so key facts clear the scorer threshold. Mapping uses `scheduled_task` / `spec_section` only.
9. ~~Cost line overrun + contingency pairing (`COST-LINE-OVERRUN`)~~ **Deferred to M3** (M1/M2 trim, 2026-10-06). Removed from brief logic; `COST-CONTINGENCY-BURN` (§4.3) unchanged.

## 6. "New since yesterday": snapshots and diffs

### 6.1 What a snapshot holds (`project_snapshots.snapshot`)

```jsonc
{ "as_of": "2026-10-06", "cutoff_at": "...", "pipeline_version": "...",
  "findings":  { "<fingerprint>": { "severity", "days_overdue", "governing_date", "status" } },
  "insights":  { "<insight_fingerprint>": { "anchor_refs": [], "impact": { "milestone_wd", "direct_usd" }, "confidence_label", "decision_deadline", "rank" } },
  "entities":  { "<ref>": "<material-field hash>" },        // watched entity types only, see 6.2
  "kpis":      { "contingency_used_incl_pending": 0.924, "open_rfis_overdue": 3, "tf": { "A1230": 3, "A3050": 10 } },
  "decisions": { "<decision_ref>": { "status", "needed_by", "carried_count" } },
  "freshness": { "...": "band + timestamps" } }
```

### 6.2 Material fields (a change to these counts as "changed")

| Entity | Material fields |
|---|---|
| RFI | status, due_date, ball_in_court, schedule_impact, cost_impact, answer present |
| Submittal (current rev) | status, revision, due_date, submit_by, ball_in_court, approver response, ROS, lead_time |
| Activity | early start/finish, TF, FF, on_driving_path, pct_complete, actual start/finish |
| Commitment | status, amount, executed_date |
| Change event | status, ROM/amount, funding |
| Budget (contingency lines) | approved, pending, remaining |
| Meeting item | status, due_date, carried_from |

### 6.3 Diff algorithm (S4, code only)

1. **Findings.** Join on `fingerprint = rule_id|entity_type|key`. A new fingerprint → `new`. Higher severity → `worse`. Lower → `better`. Present before but absent now → emit a `resolved` row (fixture: RFI 38). This is `carry_lifecycle()` in the fixture generator, the reference implementation.
2. **Insights.** Fingerprint = `playbook_rule_ids + sorted(anchor_refs)`, where anchor refs are the 1–3 records that define the problem (e.g. `rfi:9042`, `activity:A1230`). Continuity matching: if no exact match exists, a prior insight sharing ≥ 50% of its anchors is treated as the same insight. That way, absorbing a new email doesn't re-tag it NEW.
3. **Tags** (an item gets one):
   - **NEW:** no prior insight. Also a reopened fingerprint that resolved within the last 14 days, labeled "NEW (reopened)".
   - **WORSE:** any of: severity up; milestone impact up ≥ 2 wd or ≥ 20%; direct $ up ≥ $25k or ≥ 20%; confidence up a level (Signal → Likely); decision deadline now ≤ 2 business days; a new corroborating record from a *different source system*. `delta_text` must state what changed, with the before → after numbers.
   - **BETTER:** shown only in sections, never in the top list.
   - **UNCHANGED:** no tag is rendered.
   - **DECISION:** used for decision items that are neither new nor worse.
4. **Status line deltas** come from `kpis` diffs (e.g. contingency 80.8% → 92.4%).
5. **Regenerate (v2+)** diffs against the same compare-to as v1. A Monday brief diffs against Friday. Weekend activity falls in the window by construction (§1).

---

## 7. Output JSON schema

The full JSON Schema (draft 2020-12) is in **`schemas/brief.schema.json`**. Key constraints:

- `top_items`: maxItems **7**. Each item **requires** ≥ 1 citation, an owner, an action with a due date, a confidence label, an impact with a `method` string, and a score. `tag = WORSE` requires `delta_text`.
- Citation `ref` pattern: `^(procore|msgraph_outlook|msgraph_sharepoint|p6|procore_schedule|sitetech):[a-z_]+:[A-Za-z0-9_.-]+$`. This is the same triple as the normalized-row uniqueness key.
- `metrics.word_count_main` has maximum **700**. The example build fails validation if the prose exceeds the budget. (That happened while writing the example. The schema caught it at 841 words.)
- `freshness` is required, with one entry per source, including schedule `data_date`, `uploaded_at`, and `schedule_update_id`.
- Sections reference top items by `item_id` instead of repeating them. The overdue tables carry `finding_id` back to the `findings` row.
- The renderer (`examples/render_brief.py`) is deterministic code. The model never writes markdown directly.

---

## 8. Rendered example: Linden Yard Apartments (fictional)

> **ALL DATA FICTIONAL.** This is generated from the eval fixture (`evals/fixture/`): a 186-unit, 5-over-1 Type IIIA wood-frame multifamily project over a concrete podium. Every number traces to a fixture record. JSON: `examples/brief_linden_yard_2026-10-06.json`. Regenerate with `python3 examples/example_brief.py && python3 examples/render_brief.py examples/brief_linden_yard_2026-10-06.json examples/brief_linden_yard_2026-10-06.md`.

---

**SiteTech Daily Project Brief: Linden Yard Apartments**  
**Covers Tue 10/6** (day counts as of close of business) · generated Wed 10/7 5:52 AM ET · compared with Mon 10/5  
*Data: Procore synced Wed 10/7 4:46 AM (fresh) · Project mailbox synced Wed 10/7 4:41 AM (fresh) · Schedule as of XER data date Mon 9/28 (uploaded Fri 10/2) (aging) · Contract terms CT-1/CT-2 confirmed by GC 9/15 (fresh)*  
*Only lindenyard@larkspurdev.example. Threads that don't copy this mailbox are invisible.*  
*Schedule-derived float and TCO effects are capped at Likely unless a fresher record corroborates them.*  

**AT RISK: TCO Aug 27, 2027 holds on the 9/28 schedule; two Fri 10/9 deadlines each add 7-9 wd if missed.**  
Cost: +$145k recognized (CE-031); owner contingency 92% committed at 46% complete.  
4 decisions this week · 13 items flagged, top 7 shown  

#### Top of Brief (ranked by impact)

**1. NEW · Switchgear PO-0117 still in Draft; quote expires Fri 10/9, then lead time grows 2 weeks** *Likely*
Quote ($486,500, 30-week lead) holds through 10/9; after that +4% ($19.5k) and 32 weeks. Submittal approved 9/18; OAC 14.06 had the PO due 9/30. A3050 float fell 15 to 10 wd and loses ~1 wd per workday unissued (~4 wd now). If missed: ~9 wd to TCO (~$224k) plus escalation.
→ **Lauren Pike** (GC Procurement Manager; Priya Nair): Issue PO-0117 at quoted price and lead time by **Thu 10/8**.
*Sources: [PO-0117 Ampere Supply (Draft)] · [Email: Ampere Supply 10/5 11:20 AM] · [Submittal 26 24 13-001 (Approved as Noted 9/18)] · [OAC #14 item 14.06] · [A3050 Procure Switchgear]*

**2. WORSE · Transfer steel: RFI 42 and shop drawings must clear by Fri 10/9 or delivery slips 2 weeks** *Likely*
*Worse: New today: fabricator release deadline of Fri 10/9. Shop drawing review now 5 days overdue (was 4); severity raised to high.*
RFI 42 (embeds, Grid C/4-7) is 7 days overdue and shop drawings rev 1 are 5 days overdue, both with Tandem. Bayline says a missed 10/9 release moves its shop slot to Oct 26 and delivery from Nov 9 to ~Nov 23. A1225/A1230 float fell 8 to 3 wd, so TCO would move ~7 wd (~$192k).
→ **Raj Mehta** (Structural EOR; Priya Nair): Answer RFI 42 and return rev 1; GC escalates today, asks Bayline about releasing non-embed members by **Thu 10/8**.
*Sources: [RFI #42] · [Submittal 05 12 00-003 rev 1] · [Email: Bayline Steel 10/6 8:12 AM] · [A1225 Fabricate Transfer Steel] · [A1230 Erect Transfer Steel] · [OAC #14 item 14.05 (due 10/2, open)]*

**3. WORSE · Owner contingency 92% committed at 46% complete; $95k left** *Confirmed*
*Worse: +$145k pending (CE-031). Contingency used incl. pending: 80.8% -> 92.4%.*
CE-031 (pit rock, $145k ROM) went pending today. Of $1.25M: $612k approved, $543k pending, $95k left. CE-030 (ASI-07 duct shaft) is unpriced and now under notice (item 7); any CE-030 price above $95k exhausts contingency.
→ **Dana Whitfield** (Owner Development Director; Marcus Bell): Set contingency strategy before more PCOs; set firm pricing dates for CE-030/031 by **Tue 10/13**.
*Sources: [Owner budget snapshot 10/6] · [Owner budget snapshot 10/5] · [CE-031 Rock removal ($145k ROM)] · [CE-030 ASI-07 duct shaft (unpriced)]*

**4. NEW · Timberline pay app bills Wing A framing at 62% vs ~35% earned; retainage cut requested** *Likely*
Requisition 6 bills 62% of $2.6M (was 45%); the 9/28 schedule supports ~35% (L2-L3 done, L4 started). That is ~$702k ahead (~$632k net of retainage). Timberline also asks for early payment and 5% retainage ('cash is tight'). Lender Draw 9 visit is Tue 10/13.
→ **Priya Nair** (GC Senior PM; Dana Whitfield): Hold Wing A line to verified in-place %; defer retainage cut; reconcile before Draw 9 by **Mon 10/12**.
*Sources: [Timberline requisition #6] · [A1500 Frame L4 Wing A] · [Email: Timberline 10/6 11:02 AM] · [Email: Ridgeway CM 10/6 4:05 PM]*

**5. WORSE · Windows: third revise-and-resubmit; rev 3 due Wed 10/7 with zero margin** *Confirmed*
*Worse: Third revise-and-resubmit returned today. Rev 3 now has zero days of margin.*
Arcwell returned rev 2 today: unstamped anchorage calcs, missing NFRC certs (W3/W5), sill per new A-501 Rev 4 (ASI-08). A 112-day lead to the 2/15 on-site date needs approval back by 10/21, so rev 3 by 10/7 with a 14-day review. Another cycle: ~8 wd past A2400 float (~$208k).
→ **Kevin Osei** (GC Project Engineer; Eli Novak): Take Arcwell's pre-review call; complete rev 3 in; request 7-day review by **Wed 10/7**.
*Sources: [Submittal 08 53 13-001 rev 2 (R&R 10/6)] · [Submittal 08 53 13-001 rev 3 (Draft)] · [Email: Arcwell 10/6 2:40 PM] · [A-501 Rev 4 (ASI-08, 10/6)] · [A2400 Install Windows]*

**6. NEW · Framing crew on critical L4 fell 14 to 6 (16 planned); not weather** *Likely*
A1500 has zero float. Clear, dry day; super's note: no return date from Timberline. With item 4 (billing ahead, retainage request, cash strain) this fits an early sub-distress pattern. If the shortfall lasts a week: ~3 wd to TCO (~$80k).
→ **Tom Alvarez** (Superintendent; Priya Nair): Written manpower recovery plan from Timberline; PM lines up backup crew and reviews subcontract default terms by **Wed 10/7**.
*Sources: [Manpower log 10/6 (6 workers)] · [Manpower log 10/5 (14 workers)] · [A1500 Frame L4 Wing A] · [Weather log 10/6 (clear, 0.0 in)] · [Notes log 10/6] · [Email: Timberline 10/6 11:02 AM]*

**7. NEW · Polar Mechanical formal notice of delay/cost on ASI-07; GC notice to owner due Thu 10/15** *Confirmed*
ASI-07 (9/24) enlarged the Stack 07 shaft after duct shop drawings were approved on Rev 2. ~40% of L2-L4 Stack 07 duct is fabricated; install stopped pending RFI 43 (3 days overdue). Prime notice is 21 days (by 10/15). Polar's notice came 12 days after the event vs a 7-day clause; entitlement is your call. Unpriced (CE-030).
→ **Priya Nair** (GC Senior PM; Kevin Osei): Decide on pass-through notice to Larkspur; PE gets RFI 43 answered and duct re-reviewed vs M-401 Rev 3 by **Wed 10/14**.
*Sources: [Email: Polar Mechanical 10/6 10:31 AM] · [CE-030 (unpriced)] · [RFI #43] · [M-401 Rev 3 (ASI-07, 9/24)] · [Submittal 23 31 13-002 (approved 9/15)] · [Prime Contract 15.1.2 p.31] · [Subcontract 9.3 p.9]*

#### Schedule (not in top 7)
- NEW · L2 plumbing rough-in inspection failed. A1620 has 4 wd of float. New RFI 46. Re-inspection Fri 10/9 → Tom Alvarez: Correct the 3 items and get RFI 46 answered before re-inspection on 10/9 *[Inspection log 10/6 (Failed)] · [RFI #46] · [A1620]*
- NEW · Duct shop drawings approved 9/15 against M-401 Rev 2; Rev 3 (ASI-07) issued 9/24. Fabricated Stack 07 duct at risk of rework (A1700 TF 9). See top item 7 → Kevin Osei: Re-review the duct shop drawings against Rev 3 and confirm fabricated quantities *[Submittal 23 31 13-002] · [M-401 Rev 3]*

#### Cost (not in top 7)
- NEW · Rock in the Wing B elevator pit: RFI 41 due Thu 10/8, CE-031 ROM $145k (counted in item 3), concrete crew idle on the east half. A1210 has 5 wd of float → Raj Mehta: EOR direction on RFI 41 (raise pit vs. remove rock) by 10/8; priced CE-031 by Fri 10/9 *[RFI #41] · [CE-031] · [Notes log 10/5] · [Email: Granite Line 10/6 4:40 PM]*

#### Overdue RFIs
| Record | Days overdue | Ball in court | Note |
|---|---|---|---|
| RFI #42: Embed plate layout at transfer girders, Grid C/4-7 | 7 (due Tue 9/29) | Raj Mehta | Top item 2 |
| RFI #39: Roof drain location vs. truss layout, Wing A gridline 9 | 6 (due Wed 9/30) | Hannah Cole | Low priority: A3400 has 35 wd of float |
| RFI #43: Duct shaft size at Unit Stack 07 per ASI-07 | 3 (due Sat 10/3) | Hannah Cole | Top item 7 |

#### Overdue submittals
| Record | Days overdue | Ball in court | Note |
|---|---|---|---|
| 05 12 00-003 rev 1: Structural steel shop drawings, podium transfer & embeds | 5 (review due Thu 10/1) | Raj Mehta | Top item 2 |
| 32 14 00-001 rev 0: Amenity deck pavers and pedestals | 3 (submit-by Sat 10/3) | Kevin Osei | Blocked by the owner paver decision (see Decisions); zero margin to on-site date |
| 10 28 13-001 rev 0: Toilet accessories | 4 (review due Fri 10/2) | Hannah Cole | Low priority: on-site date 2027-06-14 |

#### Decisions
- **Made:** Owner approved PCO-014 (retail storefront upgrade) at $118,000 by email. The Procore change order is not issued yet. Contingency math is unchanged because the amount was already counted as pending. *[Email: Larkspur 10/6 5:10 PM] · [CE-028 storefront upgrade (pending)]*
- **Pending (Dana Whitfield needed by Sat 10/3, 3 days late, carried forward 2x):** Amenity deck pavers: base vs. Alt 2 (+$22k ROM). Cost of waiting: Paver submittal can't go in, and the scope isn't bought out. With zero margin to the on-site date, each day of delay takes a day from A2800's 10 wd of float. *[OAC #14 item 14.03] · [Submittal 32 14 00-001 (Draft)] · [RFI #44 paver pedestal height] · [Email: Larkspur 10/6]*
- **Pending (Dana Whitfield):** Timberline request to reduce retainage from 10% to 5% and expedite pay app 6. *[Requisition #6] · [Email: Timberline 10/6]*
- **Pending (Priya Nair needed by Tue 10/13):** Corridor LVT VE credit ($38,000 deductive CO) to be issued. Due 10/13, not late. *[OAC #14 item 14.08]*

#### Significant email (project mailbox only)
- Sandra Kim, Polar Mechanical, 10:31 AM: "Notice of delay and additional cost - ASI-07 duct shaft revisions": Formal contractual notice; starts the GC's pass-through clock.
- Gus Moreno, Bayline Steel, 8:12 AM: "Transfer steel shop release / RFI 42": Sets a hard release date (10/9) with a stated 2-week consequence.
- Jake Rourke, Timberline Framing, 11:02 AM: "Pay app 6 - request for expedited payment and retainage reduction": Cash-strain language from a critical-path sub on the same day its crew dropped.
- Hannah Cole, Arcwell, 2:40 PM: "Window submittal rev 2 - REVISE AND RESUBMIT": Third revise-and-resubmit on a 112-day-lead package.
- Carol Diaz, Ridgeway CM, 4:05 PM: "Draw 9 site visit": Lender monitor visit 10/13 wants the pay app and a current schedule update.
- Dana Whitfield, Larkspur, 5:10 PM: "PCO-014 storefront upgrade - approved": Owner decision made by email; CO must follow.

#### Action items
| # | Action | Owner | Due | Unblocks |
|---|---|---|---|---|
| A1 | Issue switchgear PO-0117 at quoted terms | Lauren Pike | Thu 10/8 | Item 1 |
| A2 | Answer RFI 42 and return steel rev 1; GC escalates today and asks about partial release | Raj Mehta | Thu 10/8 | Item 2 |
| A3 | Get Timberline's written manpower recovery plan | Tom Alvarez | Wed 10/7 | Item 6 |
| A4 | Complete window rev 3 submitted; request a 7-day review | Kevin Osei | Wed 10/7 | Item 5 |
| A5 | Hold Wing A framing line to in-place %; answer retainage request | Priya Nair | Mon 10/12 | Item 4 |
| A6 | Owner contingency strategy; pricing dates for CE-030/031 | Dana Whitfield | Tue 10/13 | Item 3 |
| A7 | Decide on pass-through notice for Polar / ASI-07 | Priya Nair | Wed 10/14 | Item 7 |
| A8 | Paver selection: base vs. Alt 2 | Dana Whitfield | Fri 10/9 | OAC-14.03 |

**Closed since last brief:** RFI #38 answered (Stair 2 handrail extension)  
**Gaps:** Single-mailbox scope: Vendor or design-team threads that don't copy the project mailbox are not seen · Pay apps are post-M3 in the integrations plan; requisition read here for the fixture: Item 4 depends on requisition access (verify tool permission)  
*Main body 586 words · 41 claims checked: 37 passed, 4 downgraded, 0 dropped*

---

## 9. Pre-publish checks (S8/S9 gates; any failure holds the brief)

| # | Check | Owner |
|---|---|---|
| 1 | JSON validates against `schemas/brief.schema.json` (≤ 7 items, ≤ 700 words, required fields) | code |
| 2 | Every `ref` resolves to a live, non-deleted normalized row in this project | code |
| 3 | Every number and date in `headline`/`body`/`delta_text` matches a `numeric_assertion` recomputed by S7 (ints and dates exact; $ ±0.5%; "~" values within the stated tolerance) | code |
| 4 | Every sentence maps to ≥ 1 verifier-passed claim (closed-book check) | code + LLM |
| 5 | Confidence label ≤ the freshness cap of every source the claim relies on | code |
| 6 | No entitlement, fault, or liability assertion unless quoted from a source ("entitlement is your call" pattern) | LLM lint + regex |
| 7 | Each top item has a named owner from the directory, a due date ≥ `as_of`, and a definition of done | code |
| 8 | Must-not-flag classes are suppressed: non-project "delay" language, closed records, weather blamed when the weather log shows no delay | eval-backed rules |
| 9 | Brief versus prior brief: every prior top item is in this brief, in Closed, or explicitly dropped with a reason | code |
