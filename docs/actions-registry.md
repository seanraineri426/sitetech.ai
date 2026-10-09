# Actions Registry
**Owner:** Product + Engineering  
**Status:** Draft, Oct 9 2026  
**Purpose:** Closed list of actions that the Ask SiteTech agent and the overnight action queue may draft. The model may only propose a registered action; anything else is refused.

---

## Registration principles

1. **Closed list.** The model may only draft actions defined in this registry. An unregistered request receives: "I can't do that yet. Here's what I can do:" plus the closest registered actions.
2. **Versioned.** Each action has a version number. Breaking changes (new required inputs, different output schema) increment the version.
3. **Eval-gated.** Each action requires a passing eval pack (positives + negatives, ≥ 10 cases) before launch. No action ships without its test suite.
4. **Audit trail.** Every drafted action logs: model call id, verifier result (pass/fail/not-run), and whether each sentence came from the template or the model. This proves read-only compliance and tracks model drift.
5. **No improvisation.** If a precondition fails or a required input is missing, the action displays the failure reason (e.g., "Procore not connected, confirm there's no existing change event") rather than proceeding with a guess or default. **OPEN** items below mark inputs or rules not yet defined.

---

## Registered actions

### A1: RFI overdue escalation

**id:** `rfi-overdue-escalation`  
**version:** 1  
**object:** RFI (Procore RFI record)  
**owner role:** PE (Project Engineer)  
**trigger:** RFI is overdue + linked schedule activity starts ≤ 14 days  

**Required inputs:**
- RFI number, question, ball-in-court (from Procore)
- Linked schedule activity id, activity name, planned start date (from Procore or P6)
- Days overdue (computed: today - RFI due date)
- Days to activity start (computed: activity start - today, accounting for working calendar)
- Float consumed if activity slips (from CPM float walk)
- Daily delay cost (from project settings)
- Project time zone (from project settings)
- Observed holidays (from project settings)

**Preconditions:**
- RFI status = open or in review, not closed
- RFI due date exists and is past
- Linked activity exists and is not complete
- Ball-in-court party and contact exist
- **OPEN:** How to handle an RFI linked to multiple activities (take the nearest start date?)

**Output:**
- Draft email (read-only, plain text + HTML)
- To: ball-in-court contact
- Subject: "RFI [number] overdue – [activity name] starts [date]"
- Body: RFI number, question summary (1 line), days overdue, activity name, activity start date, days to start, float and $ at risk, specific answer-by date (computed: activity start - lead time buffer), request for response
- Citations: RFI record link, schedule activity link
- **Banned wording:** waived, liable, breach, entitled, any legal conclusion

**Approval tier:**
- PE approves always (human click required)

**Scoring:**
- **Float days protected:** If RFI is answered before activity start, log float days that would have been consumed (= days overdue capped at activity float)
- **$ impact:** Float days protected × daily delay cost

**Outcome event:**
- Created: timestamp, action id, RFI id, activity id, drafted-by (model or template)
- Approved/dismissed: timestamp, user id, reason (if dismissed)
- Sent: timestamp (user-confirmed or detected in sent items)
- RFI answered: timestamp, days before activity start (if before start)

**Eval cases needed:**
- Positive: overdue RFI, near-term activity, known ball-in-court → valid draft
- Negative: RFI not overdue → no action
- Negative: activity > 14 days out → no action
- Negative: RFI already closed → no action
- Edge: RFI due on a weekend/holiday → correct business-day calculation

---

### A2: Submittal chase

**id:** `submittal-chase`  
**version:** 1  
**object:** Submittal (Procore submittal record)  
**owner role:** PE  
**trigger:** Submittal in review past due, or R&R not resubmitted, + linked activity ≤ 45 days  

**Required inputs:**
- Submittal number, title, status, ball-in-court (from Procore)
- Due date (review due or resubmit-by date)
- Linked schedule activity, start date
- Lead time from submittal approval to activity start (from activity metadata or project default)
- Release-by date or resubmit-by date (computed: activity start - lead time)
- Float, daily delay cost, time zone, holidays (from project settings)

**Preconditions:**
- Submittal status = in review (past due) or returned & resubmit (not yet resubmitted)
- Linked activity exists and is not complete
- Ball-in-court party and contact exist
- **OPEN:** Default lead time if not specified per activity (30 days? 45 days?)

**Output:**
- Draft email
- To: ball-in-court (reviewer if in review; sub/vendor if R&R)
- Subject: "Submittal [number] needed for [activity name] by [date]"
- Body: submittal number, title, current status, days past due (if applicable), activity name, start date, release-by or resubmit-by date, lead time rationale, float and $ at risk
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PE

**Scoring:**
- **Float days protected:** Submittal returned before activity start → float days preserved
- **$ impact:** Float days × daily delay cost

**Outcome event:**
- Created, approved/dismissed, sent (same structure as A1)
- Submittal returned/approved: timestamp, days before activity start

**Eval cases needed:**
- Positive: overdue review, near-term activity → valid draft
- Positive: R&R not resubmitted, activity approaching → valid draft
- Negative: submittal approved → no action
- Negative: activity > 45 days out → no action
- Edge: lead time spans a shutdown period or holidays

---

### A3: Fabrication hold (approved submittal + later ASI)

**id:** `fabrication-hold`  
**version:** 1  
**object:** Submittal + ASI (Procore records)  
**owner role:** PE → PM (escalates to PM for approval)  
**trigger:** Submittal approved + Architect's Supplemental Instruction (ASI) issued afterward that affects the submittal scope  

**Required inputs:**
- Submittal number, title, approval date
- ASI number, title, issue date, description
- Sub/vendor contact
- What changed (extracted from ASI text or manually specified)
- **OPEN:** How to detect that an ASI affects an approved submittal (keyword match? manual link? Procore relationship?)

**Preconditions:**
- Submittal status = approved
- ASI issue date > submittal approval date
- ASI affects the submittal scope (detection rule **OPEN**)
- Sub/vendor contact exists

**Output:**
- Draft email
- To: sub/vendor
- Subject: "Hold fabrication – ASI [number] affects approved submittal [number]"
- Body: submittal number, approval date, ASI number and title, what changed, request to hold fabrication pending revised submittal, contact for questions
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM (escalated from PE queue)

**Scoring:**
- **$ impact:** **OPEN** – rework cost avoided? No direct float metric unless linked to an activity slip.

**Outcome event:**
- Created, approved/dismissed, sent
- Fabrication held (user-confirmed): timestamp
- Revised submittal received: timestamp

**Eval cases needed:**
- Positive: approved submittal, later ASI clearly affecting scope → valid draft
- Negative: ASI unrelated to submittal → no action
- Negative: ASI issued before submittal approval → no action
- **OPEN:** What constitutes "clearly affecting scope"?

---

### A4: Pre-filled change event draft (owner directive or closed RFI adding scope)

**id:** `change-event-draft`  
**version:** 1  
**object:** Owner directive (email or meeting decision) or closed RFI with added scope  
**owner role:** PM  
**trigger:** Owner directive with no linked change event, or closed RFI that added cost/scope  

**Required inputs:**
- Source: email (sender, date, subject, body excerpt) or meeting (meeting id, date, attendee, transcript quote)
- Closed RFI (if applicable): RFI number, question, answer, closed date
- Existing change events on the project (to check for duplicates)
- Procore connection status
- **OPEN:** ROM (rough order of magnitude) $ – from model estimate, user input, or code heuristic?

**Preconditions:**
- Source is from owner or owner's representative (verified by project parties list from settings)
- No existing change event already linked to this source (checked against Procore CE records by description match or manual link)
- **Procore connection check:** If Procore is not connected, show: "Procore not connected, confirm there's no existing change event" rather than drafting
- **OPEN:** For closed RFIs, how to detect "adds scope" vs. clarification (keyword-based? manual flag?)

**Output:**
- Pre-filled change event (read-only draft for paste into Procore)
- Title (1 line summary of the change)
- Description: source quote (email excerpt or meeting transcript), date, why it's a change
- Reason code: **OPEN** – does Procore have standard reason codes (owner directive, differing site condition, etc.)? Or project-specific?
- Linked RFI or email reference
- ROM $ (if known; else "TBD – requires estimate")
- Deep link to create CE in Procore + copy block for paste
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Scoring:**
- **Change dollars captured:** If CE is created in Procore within 30 days and traces to this action (via outcome log), log the CE amount
- **OPEN:** Should "captured" require the CE to be approved, or just created?

**Outcome event:**
- Created, approved/dismissed
- CE created in Procore: timestamp, CE number, amount (if entered)
- CE approved: timestamp, final amount

**Eval cases needed:**
- Positive: owner email directive, no existing CE → valid draft
- Positive: closed RFI with cost impact, no existing CE → valid draft
- Negative: email from sub (not owner) → no action
- Negative: existing CE already linked → no action
- Negative: clarification RFI with no cost → no action
- Edge: Procore not connected → shows connection warning, not a draft

---

### A5: Vendor/sub schedule slip recovery options

**id:** `schedule-slip-recovery`  
**version:** 1  
**object:** Schedule activity with vendor/sub slip vs. baseline or commitment  
**owner role:** PM  
**trigger:** Vendor or sub reports a slip, or schedule shows activity delay vs. baseline  

**Required inputs:**
- Activity id, name, responsible party (vendor/sub), original start/finish, current start/finish
- Slip duration (days)
- Float (from CPM float walk)
- Successor activities (from P6 logic)
- Next unblocked activities (computed: activities with no other blocking predecessors)
- Daily delay cost, time zone, holidays (from project settings)

**Preconditions:**
- Activity is not yet complete
- Slip > 0 days
- Responsible party is a vendor or sub (not GC or owner)
- **OPEN:** Minimum slip threshold to trigger action (e.g., ≥ 3 days)?

**Output:**
- Recovery options card (read-only, shows 3 options):
  1. **Expedite ask to vendor:** draft email to vendor/sub requesting expedited delivery, shows float consumed and $ at risk
  2. **Resequence suggestion:** guidance (not a draft) naming the next unblocked activities that could proceed, computed from P6 logic, shows which activities can start while waiting for the slipped activity
  3. **Notify owner:** draft email to owner's rep explaining the slip, impact on completion date, and $ impact
- Each option shows: float impact, $ impact (days on critical path × daily delay cost), and deadline (if applicable)
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Scoring:**
- **Float days protected:** If expedite succeeds or resequence absorbs the slip without critical path impact, log the float days saved
- **$ impact:** Float days × daily delay cost

**Outcome event:**
- Created, approved/dismissed
- Action taken: which option (expedite/resequence/notify), timestamp
- Slip resolved: timestamp, float impact (if measured)

**Eval cases needed:**
- Positive: vendor slip, float available → shows expedite + resequence + notify
- Positive: slip consumes all float → shows only expedite + notify (no resequence)
- Negative: slip ≤ threshold → no action
- Edge: slip on critical path (zero float) → $ impact immediate
- **OPEN:** How to verify resequence logic correctness?

---

### A6: Formal notice acknowledgment/response + owner pass-through

**id:** `notice-response`  
**version:** 1  
**object:** Formal contract notice (received from sub or owner)  
**owner role:** PX (PM prepares)  
**trigger:** Formal notice received (identified by notice keywords + sender party)  

**Required inputs:**
- Notice source: email or letter
- Notice type (from project settings contract notice periods): delay/time extension, cost/change claim, differing site condition, change directive dispute, cure/default, injury/property damage
- Sender party, date received
- Notice period: days, calendar vs. business days, contract section (from project settings)
- Response deadline (computed: date received + notice period, accounting for calendar vs. business and holidays)
- Owner pass-through requirement (if notice is from sub and contract requires pass-through to owner)
- Project time zone, holidays (from project settings)

**Preconditions:**
- Sender is a contract party (verified against project parties from settings)
- Notice type is configured in project settings (notice period exists)
- **If notice period is not configured:** action shows "Notice period not configured for [type], confirm deadline" and does not compute a deadline
- **Never default** a notice period – this is a contract compliance matter

**Output:**
- Draft acknowledgment/response email to sender
- Subject: "Acknowledgment: [notice type] notice dated [date]"
- Body: acknowledgment of receipt, notice type, date received, response deadline (if known), next steps
- **If owner pass-through required:** separate draft email to owner with notice attached and pass-through deadline
- Calendar hold (.ics file) on the response deadline
- **Banned wording:** waived, liable, breach, entitled (especially critical for notices)

**Approval tier:** PX (PM prepares, PX approves)

**Scoring:**
- **Notices answered on time:** count and % (answered before deadline)
- No direct $ or float metric, but failure to respond on time can result in waiver of rights (**contract risk**)

**Outcome event:**
- Created, approved/dismissed
- Acknowledgment sent: timestamp
- Response sent: timestamp, on-time (Y/N)
- Owner pass-through sent: timestamp, on-time (Y/N)

**Eval cases needed:**
- Positive: notice received, type configured → valid draft + deadline
- Positive: sub notice requiring owner pass-through → two drafts (ack + pass-through)
- Negative: notice type not configured → shows "confirm deadline" message, no draft
- Negative: email from party not in project parties → no action (not recognized as notice)
- Edge: deadline falls on weekend/holiday → adjusted to next business day (if business days)
- Edge: calendar vs. business days calculation

---

### A7: Owner decision request (blocking procurement)

**id:** `owner-decision-request`  
**version:** 1  
**object:** Owner decision (open item blocking procurement or schedule milestone)  
**owner role:** PM  
**trigger:** Owner decision is open + procurement or activity is blocked by date X  

**Required inputs:**
- Decision description (what needs to be decided)
- Options (if known)
- Blocking date (procurement deadline or activity start)
- Why it's blocking (e.g., "long-lead item must be ordered by [date]")
- Days from blocking date to impact on schedule (lead time or float)
- $/day impact after blocking date (from daily delay cost)
- Owner's representative contact
- **OPEN:** Source of open owner decisions – manual entry, extracted from meetings, inferred from schedule/submittals?

**Preconditions:**
- Decision is open (not resolved)
- Blocking date is ≤ 30 days out (**OPEN:** threshold?)
- Owner contact exists

**Output:**
- Draft email to owner's representative
- Subject: "Decision needed by [date]: [decision summary]"
- Body: decision description, options (if known), blocking date, why it's blocking, $/day impact after blocking date, request for decision by specific date
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Scoring:**
- **Float days protected:** If decision is received before blocking date, log the float days preserved (= days between decision received and blocking date)
- **$ impact:** Float days × daily delay cost

**Outcome event:**
- Created, approved/dismissed, sent
- Decision received: timestamp, on-time (Y/N), float days preserved

**Eval cases needed:**
- Positive: open decision, blocking date ≤ 30 days → valid draft
- Negative: decision already resolved → no action
- Negative: blocking date > threshold → no action
- Edge: blocking date is past → shows overdue message
- **OPEN:** How to detect decision resolution (manual mark-complete? email parsing?)

---

### A8: Meeting commitment follow-up

**id:** `meeting-commitment-followup`  
**version:** 1  
**object:** Meeting commitment (from Granola transcript or manual entry)  
**owner role:** PE/PM (depends on commitment type)  
**trigger:** Commitment made in a meeting with owner + due date; due date passes without completion  

**Required inputs:**
- Commitment text (what was committed)
- Meeting id, date, attendee list
- Transcript quote + timestamp (source)
- Owner: company + person (if known from transcript speaker identification)
- Due date (stated in meeting)
- Linked record (RFI, submittal, decision, etc., if applicable)

**Preconditions:**
- Commitment has an owner (company identified from transcript or project parties)
- **If owner is unclear (speaker not identified):** action shows "confirm owner" rather than guessing – this is a **hard rule**
- Due date exists and is past
- Commitment is not marked complete

**Output:**
- Draft chase email to owner (if owner is known)
- Subject: "Follow-up: [commitment summary] (due [date])"
- Body: commitment text, meeting date, stated due date, days overdue, linked record (if any), request for update or completion
- **If owner is unclear:** card shows "confirm owner" prompt, no draft until owner is manually assigned
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PE or PM (depends on commitment type; routing **OPEN**)

**Scoring:**
- **Commitment completion rate:** % of commitments completed on time
- **Float days protected:** if commitment is linked to an activity and completed before activity impact

**Outcome event:**
- Created, approved/dismissed, sent
- Owner confirmed (if was unknown): timestamp, user id
- Commitment completed: timestamp, on-time (Y/N)

**Eval cases needed:**
- Positive: clear commitment, known owner, due date past → valid draft
- Positive: commitment to answer RFI, known owner, overdue → draft links to RFI
- Negative: commitment completed before due date → no action
- Negative: speaker not identified → shows "confirm owner", no draft
- Edge: "by Friday" commitment in a Tuesday meeting → interprets as the upcoming Friday
- **OPEN:** Natural language date parsing rules ("by end of week", "next Tuesday")

---

### A9: Meeting-based change event draft (owner decision in meeting with cost impact)

**id:** `meeting-change-event-draft`  
**version:** 1  
**object:** Owner decision made in meeting with cost impact, no linked CE  
**owner role:** PM  
**trigger:** Owner decision made in a meeting (from Granola transcript) with cost/schedule impact + no existing CE linked  

**Required inputs:**
- Meeting id, date, attendee list
- Transcript quote + timestamp (source of decision)
- Decision summary (1-2 sentences)
- Owner representative who made the decision (if identifiable from speaker)
- Cost/schedule impact (stated in meeting or inferred from context)
- Existing change events (to check for duplicates)
- Procore connection status

**Preconditions:**
- Decision is from owner or owner's representative (verified against project parties)
- Decision has cost or schedule impact (stated or inferred)
- No existing CE linked to this decision
- **Procore connection check:** same as A4

**Output:**
- Pre-filled change event (same format as A4)
- Title, description (quoting transcript), source (meeting + date), ROM $ (if stated; else TBD), deep link to Procore CE creation
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Scoring:**
- **Change dollars captured:** same as A4

**Outcome event:**
- Created, approved/dismissed
- CE created, CE approved: same as A4

**Eval cases needed:**
- Positive: owner decision in meeting, cost stated, no existing CE → valid draft
- Positive: owner decision implied from discussion, cost inferable → valid draft with ROM
- Negative: decision from sub/vendor (not owner) → no action
- Negative: existing CE already covers this decision → no action
- **OPEN:** How to infer cost impact when not explicitly stated (model confidence threshold?)

---

### A10: OAC meeting minutes draft

**id:** `oac-minutes-draft`  
**version:** 1  
**object:** OAC (Owner-Architect-Contractor) meeting (from Granola transcript)  
**owner role:** PM  
**trigger:** Recorded OAC meeting completes  

**Required inputs:**
- Meeting id, date, time, time zone, location/link
- Attendee list: name, company, role, present/absent (from Granola + project parties)
- Transcript (full, with speaker identification and timestamps)
- Procore meeting categories and prior meeting items (for carry-over)
- Schedule, RFI, submittal, CE data (for linking items)
- Float and $ computation (same as actions)

**Preconditions:**
- Meeting type = OAC (or similar owner/architect/contractor coordination meeting)
- Transcript quality sufficient for item extraction (**OPEN:** quality threshold?)
- PM approves before distribution (always)

**Output:**
- Draft minutes in SiteTech OAC template (docs/product/oac-minutes-template.md)
- Header: project, meeting type, meeting #, date/time/zone, location, attendees, distribution, next meeting
- Categories (fixed order): Safety, Schedule, RFIs, Submittals, Procurement, Changes, Owner decisions, Field/quality/inspections, Old business, New business
- Every item: item # (category.sequence), title, discussion (1-3 sentences), status (open/closed/on hold), ball in court (company + person, or "confirm owner"), due date (stated or "none stated"), linked record, days/$ at risk (from code, same rules as actions; else blank), source (transcript quote + timestamp), commitment flag (yes = becomes A8 tracked action)
- Open items from prior meeting carry forward with original item #
- Owner decision with cost + no CE → becomes A9 (change event draft)
- Missed commitment → becomes A8 (chase draft)
- Distribution note: "Please send corrections within 5 business days."
- **Banned wording:** waived, liable, breach, entitled, any legal conclusion
- **Ready for paste into Procore Meetings** (M2) or write-back via API (M3)

**Approval tier:** PM (always; never auto-distributed)

**Scoring:**
- Minutes prepared (count)
- Time saved vs. manual minutes (user-reported or timed)
- **OPEN:** Track whether minutes are actually distributed? (sent-item detection or manual confirm?)

**Outcome event:**
- Created, approved/dismissed
- Distributed: timestamp, recipients

**Eval cases needed:**
- Positive: OAC meeting transcript → valid minutes with all categories
- Positive: open items from prior meeting → carried forward correctly
- Positive: commitment stated → marked as commitment, becomes A8
- Positive: owner decision with $ → creates A9 draft
- Negative: non-OAC meeting → no minutes (or different template)
- Edge: speaker not identified → "confirm owner" for ball-in-court
- Edge: multiple topics in one discussion → split into separate items
- **OPEN:** How to map freeform discussion to the 10 fixed categories?

---

## Common rules across all actions

### Banned wording (legal conclusions)
No action may include these terms in any draft or output:
- **waived** / waiver
- **liable** / liability (except "property damage liability insurance" if quoting contract)
- **breach** / breached
- **entitled** / entitlement (except "entitlement phase" in developer/owner context)
- **default** (the contract remedy; "default setting" is OK)
- Any statement that concludes legal rights or obligations

If the model generates a draft with banned wording, the verifier flags it, and the code template is used instead (pre-written, safe language).

### Required inputs from project settings
Every action requiring these inputs must check that they exist in project settings; if missing, the action displays a setup prompt rather than proceeding:
- **Daily delay cost:** no default; missing = "Set delay cost in settings to see $ impact"
- **Notice periods:** no default; missing = "Configure notice period for [type] to see deadline"
- **Project parties:** required for owner/sub/vendor identification
- **Holidays + time zone:** required for deadline computation
- **Working calendar:** required for business-day calculations (linked to schedule, or project default)

### Float and $ computation
All float and $ values are computed by **deterministic code** (see docs/what-if-math.md), never estimated by the model:
- **Float days:** from CPM float walk over latest P6/Procore schedule
- **$ impact:** float days × daily delay cost (only when both are known)
- **Notice deadline:** event date + notice period (accounting for calendar vs. business days + holidays)

If the code cannot compute a value (e.g., no schedule link, no delay cost), the action shows "unknown" or prompts for the missing input rather than guessing.

### Outcome tracking and audit
Every action logs:
- **Creation:** timestamp, action id, version, triggering object id(s), owner role, assigned person (if known)
- **Model call:** id, model version, prompt version
- **Verifier result:** pass/fail, failure reason (if failed)
- **Sentence provenance:** for each sentence in the draft, whether it came from the code template or the model
- **User decision:** approved (timestamp, user id), edited (timestamp, user id, edit summary), dismissed (timestamp, user id, reason: "already handled" / "not relevant" / "wrong")
- **Sent:** timestamp, detection method (user-confirmed or sent-item match)
- **Outcome:** action-specific (RFI answered, CE created, notice responded, etc.), timestamp, on-time flag, float/$ saved

This audit trail is used for:
1. ROI scorecard (float days protected, change $ captured, notice compliance %)
2. Model drift detection (verifier pass rate over time)
3. Template vs. model sentence ratio (proves read-only compliance)
4. Dismiss-rate analysis by reason ("wrong" must stay < 5%)

---

## Open questions

1. **A1 (RFI overdue):** How to handle an RFI linked to multiple activities? (Take the nearest start date? Show all? Priority rule?)
2. **A2 (Submittal chase):** Default lead time if not specified per activity (30 days? 45 days? Project-wide setting?)
3. **A3 (Fabrication hold):** How to detect that an ASI affects an approved submittal? (Keyword match? Manual link? Procore relationship field?) What constitutes "clearly affecting scope"?
4. **A4 (Change event draft):** For closed RFIs, how to detect "adds scope" vs. clarification? (Keyword-based? Manual flag? Cost delta in RFI?) Should "change dollars captured" require CE approval, or just CE creation? Does Procore have standard reason codes, or are they project-specific?
5. **A4 (Change event draft):** ROM $ – from model estimate, user input, or code heuristic? (e.g., cost per day × duration)
6. **A5 (Schedule slip recovery):** Minimum slip threshold to trigger action (≥ 3 days? Configurable?)? How to verify resequence logic correctness (vs. P6 what-if)?
7. **A7 (Owner decision request):** Source of open owner decisions – manual entry, extracted from meetings, inferred from schedule/submittals? Threshold for "blocking date ≤ X days"? How to detect decision resolution (manual mark-complete? Email parsing? Meeting follow-up?)
8. **A8 (Meeting commitment):** Routing rule for PE vs. PM approval (by commitment type? By linked object? Manual?)? Natural language date parsing rules for "by end of week", "next Tuesday", etc.
9. **A9 (Meeting change event):** How to infer cost impact when not explicitly stated in the meeting? (Model confidence threshold? Manual confirmation required?)
10. **A10 (OAC minutes):** Transcript quality threshold for item extraction (speaker identification %, audio clarity)? How to map freeform discussion to the 10 fixed categories (model tags + PM review)? Should we track whether minutes are actually distributed (sent-item detection or manual confirm)?
11. **All actions:** Should there be a project-wide setting for "minimum $ threshold" to show an action (e.g., don't show actions < $5k)? Or always show if float is consumed?
12. **Routing escalation:** If an action is not acted on by its due date, it moves up one level (PE → PM → PX). What is the due date for each action type (e.g., RFI escalation due = activity start - 3 days)? Escalation message wording?

---

## Version history

- **v1 (Oct 9, 2026):** Initial registry draft for M2 (A1–A10). Open questions noted inline.
