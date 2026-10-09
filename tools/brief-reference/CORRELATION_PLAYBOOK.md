# Correlation Playbook (v0.1)

**Owner:** AI & Agent Systems Engineer · **Used by:** correlator (prompts/correlator.md), domain analysts, S7 impact code, evals
**Companions:** findings rule IDs in DAILY_BRIEF_SPEC §4 · link keys in ARCHITECTURE §3.2/§5

These are the connections an experienced PX, PM, superintendent, or development manager makes in their head, and that siloed software never does. Each pattern has the same structure:

- **Signals → sources:** the findings (rule IDs) and records that must be present.
- **Link keys:** how the records are joined (ARCHITECTURE §3.2: `spec`, `loc`, `activity`, `company`, `trade`, `cost_code`, `rec`).
- **Inference:** the construction logic, stated so a PX would agree with it.
- **Impact method:** what S7 code computes. Models never compute it.
- **Action + owner role:** one concrete next step.
- **Confidence:** what raises or lowers it. The ceiling is set by freshness (ARCHITECTURE §12).
- **Milestone / fixture:** when it becomes possible (M1/M2/M3), and which answer-key finding exercises it (`evals/fixture/expected_findings.json`).

> Rules of use for the correlator. (1) A pattern fires only if its **required** signals are present as findings or cited records. Optional signals raise confidence. (2) Patterns merge: if PB-01 and PB-02 share anchors, emit one insight listing both IDs. (3) Never assert entitlement, fault, or default. Say "notice received" and "pattern consistent with", and let humans judge. (4) If a required number is missing (ROS, lead time, float), the pattern emits a **gap** and an onboarding ask, not a guess.

---

## A. Schedule × design-team turnaround

### PB-01: Long-lead package blocked by an aging RFI on a low-float path
- **Signals → sources:** `RFI-OVERDUE` (Procore RFI) + `SUB-REVIEW-OVERDUE` or `SUB-ROS-RISK` on a submittal in the same spec section (Procore submittal) + an activity with TF ≤ 10 wd (schedule). *Optional:* meeting action item naming the RFI; `SCH-FLOAT-EROSION` on the fabrication/erection activities.
- **Link keys:** `spec` (05 12 00) + `loc` (grid C/4-7) between RFI and submittal; `submittal.scheduled_task` or the onboarding activity map → fabrication + install activities; `rec` from minutes.
- **Inference:** Fabrication can't start until the shop drawings are approved, and approval is waiting on the RFI answer. Float on fabrication → erection is the buffer. When it's gone, the delay lands on the successor chain.
- **Impact method:** projected approval date = max(RFI due, submittal due, today) + the remaining review. Fabrication start slip = projected approval − planned release. Milestone shift = max(0, slip_wd − TF_wd). $ = milestone_cd × daily delay cost.
- **Action / owner:** Design team (EOR/architect) answers the RFI and returns the submittal by (release deadline − 1 business day). The GC PM escalates and asks the fabricator about partial release of unaffected members.
- **Confidence:** + fabricator-stated dates (fresh) · + float erosion in consecutive updates · − aging schedule (cap Likely) · − RFI with a pending "answer received" event.
- **Milestone / fixture:** M1 (RFI + submittal), full in M3. **F1.**

### PB-02: Fabricator or supplier release deadline vs. design-team ball-in-court
- **Signals → sources:** email with intent `release_dependency` and a dated consequence ("need approved drawings by Fri 10/9 or slot slips to 10/26") (Outlook) + an open RFI or submittal where BIC = design team.
- **Link keys:** `company` (vendor ↔ commitment) + `rec` (RFI number in the email) or `spec` + `loc`.
- **Inference:** The vendor has turned a soft overdue item into a hard deadline with a stated consequence. The decision deadline is now the vendor's date, not the RFI due date.
- **Impact method:** consequence dates from the email (delivery old → new) → slip_wd → successor-chain propagation as in PB-01.
- **Action / owner:** GC PM escalates to the design principal with the vendor's deadline in writing. The GC confirms the release once approved.
- **Confidence:** + record number cited in the email (L1 link) · + vendor's prior date history consistent · − date is only implied ("soon").
- **Milestone / fixture:** M2. **F1** (`msg_E104`).

### PB-05: Revise-and-resubmit loop on an ROS-constrained package
- **Signals → sources:** `SUB-REV-LOOP` (≥ 2 R&R) + `SUB-ROS-RISK` (margin ≤ 14 d) + reviewer email listing the open items.
- **Link keys:** submittal series (`formatted_number`); `spec` → install activity.
- **Inference:** Each loop costs 2–4 weeks. With little margin left, **one more loop breaches the drop-dead date**. Repeat comments usually mean the sub isn't fixing the root cause (unstamped calcs, missing certs), not that the reviewer is slow.
- **Impact method:** scenario "one more cycle" = resubmit time + design_team_review_time. ROS slip vs. install activity TF → milestone shift. Labeled Signal (it depends on the review outcome).
- **Action / owner:** GC PE runs a pre-review call with the architect, checks the resubmittal for completeness against the comment list, and asks for an expedited review. The sub's PM produces the missing items.
- **Confidence:** + reviewer comments are concrete and finite · + the same comment repeated across cycles (raises the risk of another loop) · − ROS or lead time missing (emit a gap).
- **Milestone / fixture:** M1 (rules) + M2 (email). **F2.**

### PB-06: Drawing revision issued during an open submittal cycle
- **Signals → sources:** drawing revision (Procore drawings metadata) issued while a linked submittal is in Draft or review + reviewer comment referencing the new revision.
- **Link keys:** sheet number ↔ `spec` (sheet-to-spec map from onboarding) + `rec` (ASI number).
- **Inference:** The resubmittal must incorporate the new detail, or it will be rejected again. This is the feeder for PB-05.
- **Impact method:** no standalone $. It raises the PB-05 scenario probability (Signal → Likely if the reviewer explicitly requires it).
- **Action / owner:** GC PE distributes the revision to the sub with an explicit "incorporate in rev N" instruction.
- **Confidence:** + reviewer email names the sheet/revision.
- **Milestone / fixture:** M2/M3. **F2** (A-501 Rev 4 / ASI-08).

### PB-12: Drawing revision issued after the related submittal was approved
- **Signals → sources:** `SCH-DWG-REV-AFTER-APPROVAL`: drawing revision date > submittal approval date, same spec or sheet. *Optional:* sub email saying material is already fabricated; an RFI on the change.
- **Link keys:** `spec` + sheet number + `rec` (ASI).
- **Inference:** Material fabricated to the superseded revision is at risk of rework. Expect a cost claim and a resequence. Control: a revision issued **before** the submittal was received is *not* this pattern (fixture N4).
- **Impact method:** $ only if a sub states a price or quantity (else unpriced). Schedule: rework duration vs. install activity TF.
- **Action / owner:** GC PE re-reviews the approved submittal against the new revision, confirms fabricated quantities, and opens or links a CE.
- **Confidence:** + email confirming fabrication · + RFI on the delta · − revision is administrative (title block only); the metadata description helps.
- **Milestone / fixture:** M3. **F9** (and feeds F8).

### PB-17: Repeat RFIs on the same spec section or detail
- **Signals → sources:** `RFI-REPEAT`: ≥ 3 RFIs in 30 days on the same `spec`, sheet/detail, or `loc`.
- **Link keys:** `spec`, sheet, `loc`. In Mode A, also text similarity of subjects.
- **Inference:** A coordination hole in the design (e.g., structural vs. architectural backgrounds). More RFIs, ASIs, and cost are coming in that area.
- **Impact method:** count, plus sum of declared cost/schedule impacts. No extrapolated $.
- **Action / owner:** owner DM asks the architect for a coordination review or bulletin for that area.
- **Confidence:** + answers referencing "revised detail to follow" · − RFIs from different trades on unrelated aspects. Mode B loses wording similarity (ARCHITECTURE §5.4).
- **Milestone / fixture:** M2. Not planted (generalization test).

### PB-19: Shadow RFI (design question in email, nothing logged)
- **Signals → sources:** `RFI-SHADOW`: an email to the design team with intent `design_question` and no matching RFI (L1–L3) after 3 business days.
- **Link keys:** `loc`, `spec`, sender company; Mode A text similarity to existing RFIs.
- **Inference:** Informal answers become undocumented direction. That leads to lost cost recovery and disputes.
- **Impact method:** none (Signal).
- **Action / owner:** GC PE logs the RFI, or links the existing one.
- **Confidence:** Signal by default. Mode B weakens duplicate detection.
- **Milestone / fixture:** M2. Not planted.

### PB-25: Reviewer SLA pattern (one reviewer is the bottleneck)
- **Signals → sources:** ≥ 3 open `SUB-REVIEW-OVERDUE`/`RFI-OVERDUE` findings with the same BIC person or company.
- **Link keys:** `person` / `company` on BIC.
- **Inference:** It's a capacity problem at one firm, not an item-by-item problem. Escalate once, at the principal level, with the whole list.
- **Impact method:** sum of linked items' delay exposure (no double count; dedupe by activity chain).
- **Action / owner:** owner DM (contract holder with the A/E) escalates to the design principal with a ranked list.
- **Confidence:** Confirmed when counts come from records.
- **Milestone / fixture:** M1. Fixture: Hannah Cole holds RFI 39, RFI 43, and submittal 6601 (low severity; tests that the brief doesn't over-escalate).

---

## B. Procurement × schedule × commercial

### PB-03: PO not issued vs. required-on-site minus lead time
- **Signals → sources:** `PROC-PO-NOT-ISSUED`: commitment status Draft or unexecuted (Procore commitments) + submittal approved (Procore) + procurement activity unstarted (`SCH-UNSTARTED-ERODING`). *Optional:* meeting action "issue PO" overdue.
- **Link keys:** `spec` (26 24 13) + `company` (vendor) + `cost_code` + activity map.
- **Inference:** On equipment, the clock starts at the PO, not at approval. Every workday the PO sits unissued, procurement float drops by one.
- **Impact method:** projected TF = TF at data date − workdays since data date. If issued at deadline D: TF_D. If lead time steps up after D: milestone shift = max(0, added_lead_wd − TF_D).
- **Action / owner:** GC procurement manager issues the PO. The GC PM confirms the factory acknowledgment and ship week.
- **Confidence:** + quote terms in writing · + overdue meeting action · − aging schedule (cap Likely; the float estimate is an extrapolation).
- **Milestone / fixture:** M3. **F3.**

### PB-04: Quote or price expiry on an unissued commitment
- **Signals → sources:** `PROC-QUOTE-EXPIRY`: email or commitment field with a validity date and post-expiry terms (Outlook/Procore).
- **Link keys:** `company`, quote number, `cost_code`.
- **Inference:** Escalation and lead-time step-ups are often tied to factory allocation, so missing the date costs both $ and days.
- **Impact method:** escalation $ = % × amount (`escalation` kind). Days via PB-03.
- **Action / owner:** same as PB-03. The date to hit is (expiry − 1 business day).
- **Confidence:** Confirmed for terms stated in writing.
- **Milestone / fixture:** M2 (email) + M3 (commitments). **F3.**

### PB-20: Vendor ship-date slip vs. ROS and the procurement log
- **Signals → sources:** `PROC-VENDOR-DATE-SLIP` (email-extracted new date) + submittal ROS/lead time or a procurement-log row (SharePoint spreadsheet; M2 doc parse) + install activity.
- **Link keys:** `company`, PO/SO number (`rec`), `spec`.
- **Inference:** A new ship date later than ROS − install prep = a delay. A log that disagrees with the latest vendor email = a stale log. Cite both.
- **Impact method:** (new date − ROS) → slip vs. install activity TF → milestone shift.
- **Action / owner:** GC PM gets a written ship-date commitment and asks about partial shipment or an alternate supplier.
- **Confidence:** + order acknowledgment attached (name only) · − verbal or "tentative" language.
- **Milestone / fixture:** M2. Not planted (generalization).

### PB-24: Permanent-power chain (switchgear → utility energization → TCO)
- **Signals → sources:** switchgear procurement activity float + utility coordination activity (energization) + any utility email.
- **Link keys:** activity chain A3050 → A3100 → TCO; `spec` 26 24 13.
- **Inference:** Utilities typically need gear set weeks before energization. Permanent power often gates the final inspections needed for TCO. The chain's float is shared, so slips stack.
- **Impact method:** propagate the slip through the chain to the milestone.
- **Action / owner:** owner DM confirms the utility's requirements and lead times. The GC PM confirms the energization date.
- **Confidence:** depends on schedule freshness.
- **Milestone / fixture:** M3. Supports **F3** (A3100 shares float).

### PB-27: Buyout gap as install approaches
- **Signals → sources:** `COST-BUYOUT-GAP`: budget line with no executed commitment + install activity starting within lead + 30 days. *Optional:* an owner selection pending (PB-14).
- **Link keys:** `cost_code`, `spec`, activity map.
- **Inference:** Unbought scope carries price risk (no committed number) and schedule risk (lead time). Late buyout also cuts the bidding pool.
- **Impact method:** lead-time margin = install start − (today + lead + submittal cycle). $ only if a budget-vs-quote gap is known.
- **Action / owner:** GC procurement buys out, or the owner unblocks the selection.
- **Confidence:** Confirmed on record states.
- **Milestone / fixture:** M3. **F7** (pavers).

---

## C. Cost × contingency × contract

### PB-07: Change-event volume and pending COs vs. remaining contingency
- **Signals → sources:** `COST-CONTINGENCY-BURN` (budget snapshot) + open/unpriced CEs (`COST-CE-UNPRICED`) + % complete (cost; owner draw).
- **Link keys:** contingency budget lines; CE → `cost_code`; CE funding source = owner contingency.
- **Inference:** What matters is the burn *rate* against progress. At 46% complete with 92% of contingency committed (including pending), the remaining risk on the job (MEP close-in, finishes, closeout) has almost no cushion. Each unpriced CE is a call on contingency that has no number yet.
- **Impact method:** remaining = original − approved − pending. Used incl. pending vs. % complete (gap in points). Report "any price above $X exhausts contingency" for unpriced CEs. Don't forecast unpriced amounts.
- **Action / owner:** owner DM / VP Construction sets the contingency strategy (VE, scope holds, lender conversation) and requires pricing dates on unpriced CEs.
- **Confidence:** Confirmed (budget records). The configured budget view must be the owner view (verify columns per tenant).
- **Milestone / fixture:** M3. **F4.**

### PB-08: Pay-app % complete vs. schedule % complete (front-loading)
- **Signals → sources:** `COST-PAYAPP-AHEAD`: requisition SOV line % (Procore requisitions; post-M3 per integrations, verify) + mapped activities' % complete or actual dates (schedule).
- **Link keys:** commitment `company` + SOV line ↔ `cost_code` ↔ activities (WBS/area map: "Wing A framing" ↔ A1450–A1530).
- **Inference:** Billing ahead of work in place moves risk onto the payer. If the sub fails, the overpayment is gone, and the completion cost has to come out of the budget. Lenders' monitors look for exactly this.
- **Impact method:** schedule-earned % = Σ(activity duration × % complete) / Σ duration over mapped activities. Overbilled $ = SV × (billed % − earned %). Net = × (1 − retainage).
- **Action / owner:** GC PM holds the line to verified in-place % (walk it with the super). The owner DM reviews before the lender draw.
- **Confidence:** Likely at best when the schedule is aging, or when duration weighting is a proxy for quantities. + super's walk-down quantities (future) · + lender visit imminent (urgency only).
- **Milestone / fixture:** M3+. **F5.**

### PB-11: Contractual notice received from a sub → GC's pass-through clock
- **Signals → sources:** email with `notice_language` (Outlook) + contract terms (SharePoint; human-confirmed) + the triggering event's date (ASI or drawing revision issue date, directive, RFI answer).
- **Link keys:** `rec` (ASI, RFI), `company` → subcontract, `spec`.
- **Inference:** The GC typically has its own (often longer) prime-contract window to notify the owner. Missing it can waive recovery even when the sub's claim is valid. Separately, the sub's own timeliness against its subcontract window is a **fact to flag, not a conclusion to draw**.
- **Impact method:** deadline = event date + notice days (calendar unless the clause says otherwise; verify clause wording). Days remaining in business days. $ = sub's stated amount, or unpriced.
- **Action / owner:** GC PM decides whether to send pass-through notice by (deadline − 1 business day). Owner DM is informed of a potential claim.
- **Confidence:** Confirmed for receipt and dates **only if** the contract terms are human-confirmed. Otherwise Signal ("clause extracted, not confirmed"). Never assert entitlement.
- **Milestone / fixture:** M2 (email + SharePoint terms). **F8.**

### PB-16: Unforeseen condition → RFI → CE → contingency and float
- **Signals → sources:** notes or delay log ("hit rock", "unsuitable soils", "existing utility") (daily logs) + RFI on the condition + CE with ROM + crew idle (manpower/email) + activity TF.
- **Link keys:** `loc` (Wing B elevator pit) + `rec` (RFI 41) + `company`.
- **Inference:** A differing site condition generates cost (typically owner contingency) and idle time. The EOR's answer sets the path (redesign vs. removal), which drives both.
- **Impact method:** CE ROM (recognized when pending; counted once under PB-07). Delay = idle days beyond activity TF.
- **Action / owner:** EOR gives direction by the RFI due date. The GC prices the CE by a set date. The owner is informed.
- **Confidence:** Confirmed (records) for the facts. Delay depends on the answer date.
- **Milestone / fixture:** M3. **F11.**

### PB-18: RFI answered with change language but no change event
- **Signals → sources:** `COST-RFI-NO-CE`: RFI answer text (Mode A) contains change language + cost impact yes/TBD + no linked CE after 5 business days.
- **Link keys:** RFI ↔ CE linked-RFI field; `spec`/`loc` fallback.
- **Inference:** Cost exists but hasn't been recognized. Notice windows may be running.
- **Impact method:** unpriced, unless the answer or a sub's email gives quantities.
- **Action / owner:** GC PM opens and links the CE and requests pricing.
- **Confidence:** Likely in Mode A. In **Mode B the answer text is not persisted**, so this runs only during the nightly run with the in-memory text (ARCHITECTURE §5.4).
- **Milestone / fixture:** M2/M3. Not planted.

### PB-21: Owner approval by email not converted to a change order
- **Signals → sources:** email with intent `decision_made` from the owner (role resolved from the directory) + CE/PCO still pending in Procore. Control: contingency math already includes it as pending.
- **Link keys:** `rec` (PCO number), amount match.
- **Inference:** The decision is made, but the record isn't updated. Risk: the work proceeds without a CO, or the CO gets double counted.
- **Impact method:** none (status). Verifies that the amount is already in pending.
- **Action / owner:** GC PM issues the CO for signature.
- **Confidence:** Confirmed if the amount and number match.
- **Milestone / fixture:** M2. **S4** (status item).

---

## D. Field × people × communications

### PB-09: Manpower drop on a critical activity that weather doesn't explain
- **Signals → sources:** `SCH-MANPOWER-ACUTE` or `SCH-MANPOWER-SUSTAINED` (manpower log) + activity TF ≤ 5 + weather log showing no delay (control) + notes log.
- **Link keys:** `company` (vendor) + `loc` (Wing A > Level 4) + activity map (A1500).
- **Inference:** On a zero-float activity, every crew-day short is a day lost unless it's recovered. Clear weather rules out the innocent explanation. Never blame weather when the weather log shows no delay (fixture N5).
- **Impact method:** lost wd = horizon (5 wd) × (1 − actual / planned). Milestone shift = max(0, lost − TF).
- **Action / owner:** Super gets a written recovery commitment (crew by day). The GC PM lines up a supplemental crew.
- **Confidence:** Confirmed on counts. The impact is Likely (it assumes the shortfall persists).
- **Milestone / fixture:** M3. **F6.**

### PB-10: Subcontractor financial-distress composite
- **Signals → sources (≥ 3 of):** PB-08 overbilling · retainage-reduction or early-payment request (`COST-RETAINAGE-REQUEST`) · PB-09 manpower drop · cash-strain language ("cash is tight", "two jobs starting") · supplier non-payment notices or lien warnings · slow RFI/submittal responses from that sub · key-person turnover.
- **Link keys:** `company` (same sub across systems), within a 30-day window.
- **Inference:** Each signal alone is noise. Together they are the classic run-up to a sub default. The cheapest time to act is before the next payment goes out.
- **Impact method:** payment risk (PB-08 net overbilling) + schedule exposure (PB-09). Don't add speculative completion-cost premiums.
- **Action / owner:** GC PM holds payment to in-place %, considers joint checks, reviews the subcontract default/notice provisions with counsel, and books backup capacity. The owner DM is informed before the lender draw.
- **Confidence:** Likely with 3 signals, never Confirmed. Wording: "pattern consistent with", never "is failing".
- **Milestone / fixture:** M3. **F5 + F6** composite.

### PB-13: Decision promised in a meeting with no follow-through
- **Signals → sources:** meeting item (decision or action) past due + no corresponding record change (CE/CO, RFI answer, submittal return, PO) and no email from the assignee on the topic.
- **Link keys:** `rec` in the item text; assignee `person`; `spec`/`loc`.
- **Inference:** Meeting minutes are where commitments go to die. A due-and-silent item is a dropped ball unless shown otherwise.
- **Impact method:** inherits the impact of whatever the item blocks (e.g., OAC 14.06 → PB-03).
- **Action / owner:** assignee named in the minutes. The PM raises it at the next OAC with the record evidence.
- **Confidence:** + item explicitly dated · − possible off-mailbox follow-through (single-mailbox gap, so say so).
- **Milestone / fixture:** M2. **F1** (14.05), **F3** (14.06).

### PB-14: Owner decision late, blocking submittal and buyout (cost of waiting)
- **Signals → sources:** `DEC-OVERDUE` + `DEC-CARRIED` (meetings) + `SUB-SUBMIT-BY-MISSED` on the dependent submittal + `COST-BUYOUT-GAP` + install activity float.
- **Link keys:** `spec` (32 14 00) + `loc` (amenity deck) + `rec` (RFI 44 on the same detail).
- **Inference:** The owner's indecision is now the GC's schedule risk, and it's documented, which supports a potential owner-caused delay position. Show options and cost of waiting only. No recommendation (product spec).
- **Impact method:** float erosion per day of waiting (ROS margin = 0 → day-for-day against install activity TF).
- **Action / owner:** owner DM decides by a stated date.
- **Confidence:** Confirmed (records).
- **Milestone / fixture:** M2. **F7.**

### PB-15: Inspection failure on a near-critical activity
- **Signals → sources:** `SCH-INSPECTION-FAIL` (inspection log) + new RFI on the deficiency + re-inspection date + activity TF.
- **Link keys:** `loc` (Wing A > Level 2) + activity map (A1620) + `rec`.
- **Inference:** Close-in (insulation/drywall) can't proceed until the re-inspection passes. If the RFI isn't answered before the re-inspection, the failure repeats.
- **Impact method:** slip = re-inspection date − planned finish (+ risk of a second failure). Milestone shift vs. TF.
- **Action / owner:** Super / trade foreman corrects the items. The design team answers the RFI before the re-inspection.
- **Confidence:** Confirmed facts. Delay is conditional.
- **Milestone / fixture:** M3. **F10.**

### PB-22: Weather days consumed vs. the schedule allowance
- **Signals → sources:** `SCH-WEATHER-DAYS`: weather logs with delay = true, cumulated, vs. weather days carried in the schedule or contract.
- **Link keys:** project calendar; weather-sensitive activities (envelope, sitework, roofing).
- **Inference:** Once the allowance is exhausted, further weather days are typically excusable but often non-compensable (contract-dependent; verify the clause), and they need timely notice.
- **Impact method:** excess days on weather-sensitive critical activities.
- **Action / owner:** GC PM tracks and gives notice per contract.
- **Confidence:** depends on log discipline.
- **Milestone / fixture:** M3. Fixture control **N5** (weather NOT the cause).

### PB-23: Lender/monitor visit approaching with open payment or schedule gaps
- **Signals → sources:** email from the lender's monitor with a visit date + open PB-08/PB-10 + schedule freshness band aging/stale (the monitor asks for "current schedule update").
- **Link keys:** project; date window ≤ 10 business days.
- **Inference:** The draw review will see the overbilling and the stale schedule. Fix both before the visit, not during it.
- **Impact method:** urgency only (sets the decision deadline for PB-08).
- **Action / owner:** owner DM prepares. The GC PM reconciles the pay app and uploads a current schedule.
- **Confidence:** Confirmed (dated email).
- **Milestone / fixture:** M2. **F5** (`msg_E109`).

### PB-26: Field reality vs. an aging schedule
- **Signals → sources:** schedule band aging/stale + fresher field signals that contradict it (lookahead email, daily logs showing an activity not started that the XER says is in progress, vendor dates).
- **Link keys:** activity map; `loc`; `company`.
- **Inference:** The official schedule is no longer a reliable basis. Claims built on it must be downgraded, and the brief should ask for an update rather than compute precise float.
- **Impact method:** none. It triggers confidence caps and the "request current XER" action.
- **Action / owner:** GC PM / scheduler uploads the current update.
- **Confidence:** Confirmed on dates.
- **Milestone / fixture:** M3. Fixture freshness disclosure (XER data date 9/28, uploaded 10/2).

---

## E. Pattern index

| ID | Pattern | Min. milestone | Fixture |
|---|---|---|---|
| PB-01 | Aging RFI blocks long-lead package on low float | M1/M3 | F1 |
| PB-02 | Vendor release deadline vs. design-team BIC | M2 | F1 |
| PB-03 | PO not issued vs. ROS − lead time | M3 | F3 |
| PB-04 | Quote expiry on unissued commitment | M2/M3 | F3 |
| PB-05 | R&R loop on ROS-constrained submittal | M1/M2 | F2 |
| PB-06 | Drawing revision during open submittal cycle | M2/M3 | F2 |
| PB-07 | CE volume / pending vs. remaining contingency | M3 | F4 |
| PB-08 | Pay app % vs. schedule-earned % | M3+ | F5 |
| PB-09 | Manpower drop on critical activity (not weather) | M3 | F6 |
| PB-10 | Sub financial-distress composite | M3 | F5+F6 |
| PB-11 | Sub notice → GC pass-through clock | M2 | F8 |
| PB-12 | Drawing revision after submittal approval | M3 | F9 |
| PB-13 | Meeting promise, no follow-through | M2 | F1, F3 |
| PB-14 | Late owner decision blocks submittal/buyout | M2 | F7 |
| PB-15 | Inspection failure on near-critical activity | M3 | F10 |
| PB-16 | Unforeseen condition → RFI → CE → contingency | M3 | F11 |
| PB-17 | Repeat RFIs on same detail | M2 | — |
| PB-18 | RFI answer with change language, no CE | M2/M3 | — |
| PB-19 | Shadow RFI | M2 | — |
| PB-20 | Vendor ship-date slip vs. ROS/log | M2 | — |
| PB-21 | Owner email approval not converted to CO | M2 | S4 |
| PB-22 | Weather days vs. allowance | M3 | N5 (control) |
| PB-23 | Lender visit with open payment/schedule gaps | M2 | F5 |
| PB-24 | Permanent-power chain to TCO | M3 | F3 |
| PB-25 | Reviewer bottleneck | M1 | (low-severity control) |
| PB-26 | Field reality vs. aging schedule | M3 | freshness disclosure |
| PB-27 | Buyout gap as install approaches | M3 | F7 |

Patterns without fixture coverage (PB-17/18/19/20) are generalization tests. Add them to the fixture in the next iteration (EVALS.md §6).
