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
- Float consumed if activity slips (from P6 total float)
- Daily delay cost (from project settings)
- Project time zone (from project settings)
- Observed holidays (from project settings)

**Preconditions:**
- RFI status = open or in review, not closed
- RFI due date exists and is past
- Linked activity exists and is not complete
- Ball-in-court party and contact exist
- **If linked to multiple activities:** urgency is determined by the earliest-starting linked activity; $ impact computed from the activity with the least float; card lists the other linked activities ("also blocks A2340")

**Output:**
- Draft email (read-only, plain text + HTML)
- To: ball-in-court contact
- Subject: "RFI [number] overdue – [activity name] starts [date]"
- Body: RFI number, question summary (1 line), days overdue, activity name, activity start date, days to start, float and $ at risk, specific answer-by date (computed: activity start − 5 working days), request for response
- Citations: RFI record link, schedule activity link
- **Banned wording:** waived, liable, breach, entitled, any legal conclusion

**Approval tier:**
- PE approves always (human click required)

**Due / escalation:** Activity start − 5 working days. Not approved by due → moves up one level (PE → PM → PX).

**Scoring:**
- **Float days protected:** If RFI is answered before activity start, log float days that would have been consumed. Counted as "confirmed" only when the RFI answer shows up in synced Procore data and the activity starts on or before its planned date.
- **Critical-path days avoided:** If the activity is on the critical path (total float ≤ 0), days saved before activity start.
- **$ impact:** Critical-path days avoided × daily delay cost (float days are not converted to $)

**Outcome event:**
- Created: timestamp, action id, RFI id, activity id, drafted-by (model or template)
- Approved/dismissed: timestamp, user id, reason (if dismissed)
- Sent: timestamp (user-confirmed or detected in sent items)
- RFI answered: timestamp, days before activity start (if before start)

**Eval cases needed:**
- Positive: overdue RFI, near-term activity, known ball-in-court → valid draft
- Negative: RFI not overdue → no action
- Negative: activity > 14 working days out → no action
- Negative: RFI already closed → no action
- Edge: RFI due on a weekend/holiday → correct business-day calculation

---

### A2: Submittal chase

**id:** `submittal-chase`  
**version:** 1  
**object:** Submittal (Procore submittal record)  
**owner role:** PE  
**trigger:** Submittal in review past due, or R&R not resubmitted, + linked activity ≤ 45 working days  

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
- **Lead time:** use the submittal's lead time field; if not set, use per-project lead time by spec division (configured at onboarding); if neither exists, card shows "Confirm lead time" and no $ impact

**Output:**
- Draft email
- To: ball-in-court (reviewer if in review; sub/vendor if R&R)
- Subject: "Submittal [number] needed for [activity name] by [date]"
- Body: submittal number, title, current status, days past due (if applicable), activity name, start date, release-by or resubmit-by date, lead time rationale, float and $ at risk
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PE

**Due / escalation:** Release-by date (activity start − lead time). Not approved by due → moves up one level (PE → PM → PX).

**Scoring:**
- **Float days protected:** Submittal returned before activity start → float days preserved. Counted as "confirmed" when submittal approval shows in synced Procore data and activity starts on or before planned date.
- **Critical-path days avoided:** If activity is on critical path, days saved.
- **$ impact:** Critical-path days avoided × daily delay cost (float days are not converted to $)

**Outcome event:**
- Created, approved/dismissed, sent (same structure as A1)
- Submittal returned/approved: timestamp, days before activity start

**Eval cases needed:**
- Positive: overdue review, near-term activity → valid draft
- Positive: R&R not resubmitted, activity approaching → valid draft
- Negative: submittal approved → no action
- Negative: activity > 45 working days out → no action
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
- Shared spec section or sheet number (deterministic link between ASI/drawing revision and submittal), or email naming both

**Preconditions:**
- Submittal status = approved
- ASI issue date > submittal approval date
- **Deterministic link exists:** shared spec section or sheet number between the ASI/drawing revision and the submittal, OR one email naming both. No keyword-only matching. Weak link triggers Confirm chip.
- Sub/vendor contact exists
- **Note:** This action is off unless drawing sets are mapped or the ASI arrives by email with clear linkage

**Output:**
- Draft email
- To: sub/vendor
- Subject: "Hold fabrication – ASI [number] affects approved submittal [number]"
- Body: submittal number, approval date, ASI number and title, what changed, request to hold fabrication pending revised submittal, contact for questions
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM (escalated from PE queue)

**Due / escalation:** ASI issue date + 2 working days. Not approved by due → moves up one level (PE → PM → PX).

**Scoring:**
- **Fabrication holds (count):** Actions approved, sent, and confirmed by user or revised submittal received
- **Confirmed holds:** Holds where the sub confirmed they stopped work (user-confirmed flag or revised submittal with ASI reference)
- **$ impact:** Only if a source document states a rework cost amount. Otherwise, counted by hold only, no $.

**Outcome event:**
- Created, approved/dismissed, sent
- Fabrication held (user-confirmed flag): timestamp
- Revised submittal received: timestamp

**Eval cases needed:**
- Positive: approved submittal, later ASI with shared spec section/sheet number → valid draft
- Positive: approved submittal, email naming both the ASI and submittal → valid draft
- Negative: ASI unrelated to submittal (no shared spec section/sheet, no linking email) → no action
- Negative: ASI issued before submittal approval → no action
- Edge: weak link (ambiguous spec section) → Confirm chip before drafting

---

### A4: Pre-filled change event draft (owner directive or closed RFI adding scope)

**id:** `change-event-draft`  
**version:** 1  
**object:** Owner directive (email or meeting decision) or closed RFI with added scope  
**owner role:** PM  
**trigger:** Owner directive with no linked change event, or closed RFI that added cost/scope  

**Required inputs:**
- Source: email (sender, date, subject, body excerpt) or meeting (meeting id, date, attendee, transcript quote)
- Closed RFI (if applicable): RFI number, question, answer, closed date, cost/schedule impact field
- Existing change events on the project (to check for duplicates)
- Procore connection status
- ROM $ (only if an amount is stated in a source document: email, RFI, quote, meeting transcript; never from model estimate or heuristic)

**Preconditions:**
- Source is from owner or owner's representative (verified by project parties list from settings)
- **For closed RFIs:** fire only if the RFI's cost/schedule impact field = yes, OR the answer contains wording from a fixed cost-adding list (add, provide additional, revise to include, relocate, upgrade), AND no CE is already linked or title-matched. Clarification RFIs do not fire this action.
- No existing change event already linked to this source (checked against Procore CE records by description match or manual link)
- **Procore connection check:** If Procore is not connected, the draft is still created but includes a **"Confirm no existing change event"** chip that the PM must tap before approval (email-only mode)
- **Email redaction:** Stored email body, subject, and preview replace addresses with `[email-<domain>]` placeholders. Quotes in the draft are matched against the redacted body.

**Output:**
- Pre-filled change event (read-only draft for paste into Procore)
- Title (1 line summary of the change)
- Description: source quote (email excerpt or meeting transcript), date, why it's a change
- Reason code: project-specific, determined through per-client source mapping; unmapped = blank for PM to fill
- Linked RFI or email reference
- ROM $ (if stated in source; else "Add ROM")
- Deep link to create CE in Procore + copy block for paste
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Due / escalation:** Directive date + 5 working days. Not approved by due → moves up one level (PM → PX).

**Scoring:**
- **Change dollars captured:** tracked in three separate stages, never summed together:
  1. **Raised:** PM approved the card (timestamp, card id)
  2. **Submitted:** CE appears in Procore OR a change proposal to the owner is detected in the project mailbox, traced back to this card (timestamp, CE/proposal id, amount from CE or proposal, never from our estimate). **This is the pilot headline metric.**
  3. **Approved:** Owner executed the change order (timestamp, final CO amount). Reported separately, not added to Submitted.
- Dollar amounts come from the CE or proposal amount, never from our ROM estimate. A ROM amount is used only when it is stated in a source document.

**Outcome event:**
- Created: timestamp, action id, source reference
- Raised: PM approved the card (timestamp, user id)
- Submitted: CE created in Procore or change proposal detected in mailbox (timestamp, CE/proposal id, amount)
- Approved: Owner executed CO (timestamp, final amount)

**Eval cases needed:**
- Positive: owner email directive, no existing CE → valid draft
- Positive: closed RFI with cost impact, no existing CE → valid draft
- Negative: email from sub (not owner) → no action
- Negative: existing CE already linked → no action
- Negative: clarification RFI with no cost → no action
- Edge: Procore not connected → draft created with "Confirm no existing CE" chip

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
- Float (from P6 total float)
- Successor activities (from P6 logic)
- Next unblocked activities (computed: activities with no other blocking predecessors)
- Daily delay cost, time zone, holidays (from project settings)

**Preconditions:**
- Activity is not yet complete
- Slip > 0 days
- Responsible party is a vendor or sub (not GC or owner)
- **Slip threshold:** fire when the slip leaves ≤ 5 working days of float OR hits the critical path (0 float). Per-project setting can change the 5-day threshold.

**Output:**
- Recovery options card (read-only, shows 3 options):
  1. **Expedite ask to vendor:** draft email to vendor/sub requesting expedited delivery, shows float consumed and $ at risk
  2. **Resequence suggestion:** guidance (not a draft) naming the next unblocked activities that could proceed (activities whose P6 predecessors are complete or unaffected), computed from P6 logic. Labeled **"guidance, check in P6"**. Shows which activities can start while waiting for the slipped activity.
  3. **Notify owner:** draft email to owner's rep explaining the slip, impact on completion date, and $ impact
- Each option shows: float impact, $ impact (days on critical path × daily delay cost), and deadline (if applicable)
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Due / escalation:** 2 working days after slip detected. Not approved by due → moves up one level (PM → PX).

**Scoring:**
- **Float days protected:** If expedite succeeds or resequence absorbs the slip without critical path impact, log the float days saved. Counted as "confirmed" when updated schedule data shows the activity completed without slipping project completion.
- **Critical-path days avoided:** Days the project completion would have slipped if the action wasn't taken.
- **$ impact:** Critical-path days avoided × daily delay cost (float days are not converted to $)

**Outcome event:**
- Created, approved/dismissed
- Action taken: which option (expedite/resequence/notify), timestamp
- Slip resolved: timestamp, float impact (if measured)

**Eval cases needed:**
- Positive: vendor slip leaving ≤ 5 days float → shows expedite + resequence + notify
- Positive: slip consumes all float (hits critical path) → shows only expedite + notify (no resequence if no float)
- Negative: slip leaves > 5 days float and not on critical path → no action
- Edge: slip on critical path (zero float) → $ impact immediate
- Edge: resequence shows only activities whose predecessors are complete/unaffected (verify against P6 logic)

---

### A6: Formal notice acknowledgment/response + owner pass-through

**id:** `notice-response`  
**version:** 1  
**object:** Formal contract notice (received from sub or owner)  
**owner role:** PX (PM prepares)  
**trigger:** Formal notice received (identified by notice keywords + sender party)  

**Required inputs:**
- Notice source: email or letter
- Notice type: delay/time extension, cost/change claim, differing site condition, change directive dispute, **cure notice** (stored as `cure_default`), injury/property damage
- Sender party (counterparty), date received
- **Notice period lookup:** keyed on `contract_kind` (from sender's party role: owner_gc, gc_sub; **🔶 gc_vendor OPEN - not in current enum**) + `counterparty_name` + `notice_type`. Returns days, calendar vs. business days, contract section.
- Owner pass-through requirement: determined by `owner_gc` contract row (if notice is from sub/vendor and owner_gc contract requires pass-through)
- Project time zone, holidays (from project settings)

**Preconditions:**
- Sender is a contract party (verified against project parties from settings)
- **Action always drafts acknowledgment**, even if notice period is not configured. If notice period missing, shows "Confirm deadline with PX" for the response deadline.

**Output:**
- Draft acknowledgment/response email to sender (always drafted)
- Subject: "Acknowledgment: [notice type] notice dated [date]"
- Body: acknowledgment of receipt, notice type, date received, response deadline (if known; else "Confirm deadline with PX"), next steps
- **If owner pass-through required:** separate draft email to owner with notice attached and pass-through deadline (from owner_gc contract row)
- **If deadline has already passed (deadline < today):** card text must be exactly: "Deadline per project settings was \<date\>; confirm with PX". Must not draw any legal conclusion.
- Calendar hold (.ics file) on the response deadline (if not passed and known)
- **Banned wording:** waived, liable, breach, entitled, defaulted, forfeited (especially critical for notices)

**Approval tier:** PX (PM prepares, PX approves)

**Due / escalation:** Response deadline − 2 business days. (Already PX-tier; urgent notice handling.)

**Scoring:**
- **Notices answered on time:** count and % (answered before deadline)
- No direct $ or float metric, but failure to respond on time can result in waiver of rights (**contract risk**)

**Outcome event:**
- Created, approved/dismissed
- Acknowledgment sent: timestamp
- Response sent: timestamp, on-time (Y/N)
- Owner pass-through sent: timestamp, on-time (Y/N)

**Eval cases needed:**
- Positive: notice received, type configured → valid draft + computed deadline
- Positive: notice received, type not configured → valid draft with "Confirm deadline with PX" (no computed deadline)
- Positive: sub notice requiring owner pass-through → two drafts (ack + pass-through), using owner_gc contract row
- Negative: email from party not in project parties → no action (not recognized as notice)
- Edge: deadline falls on weekend/holiday → adjusted to next business day (if business days)
- Edge: calendar vs. business days calculation
- Edge: deadline has already passed (deadline < today) → card text exactly: "Deadline per project settings was \<date\>; confirm with PX" (no legal conclusions)

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
- **Sources of open owner decisions:** meeting decisions marked open (from A8/A9 extraction), emails asking the owner/OR a question, and RFIs/submittals with ball-in-court on the owner

**Preconditions:**
- Decision is open (not resolved)
- **Blocking:** linked procurement activity start minus lead time ≤ 21 days. If lead time is missing, use A2's "Confirm lead time" rule (per-project setting by division, else show "Confirm lead time").
- Owner contact exists
- **Resolution detection:** decision is resolved when an owner reply is detected AND the PM confirms in one tap, OR minutes mark it closed

**Output:**
- Draft email to owner's representative
- Subject: "Decision needed by [date]: [decision summary]"
- Body: decision description, options (if known), blocking date, why it's blocking, $/day impact after blocking date, request for decision by specific date
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Due / escalation:** Blocking date. Not approved by due → moves up one level (PM → PX).

**Scoring:**
- **Float days protected:** If decision is received before blocking date, log the float days preserved. Counted as "confirmed" when decision shows in synced data (email reply or meeting minutes) and procurement/activity proceeds on schedule.
- **Critical-path days avoided:** If blocked activity is on critical path, days saved.
- **$ impact:** Critical-path days avoided × daily delay cost (float days are not converted to $)

**Outcome event:**
- Created, approved/dismissed, sent
- Decision received: timestamp, on-time (Y/N), float days preserved

**Eval cases needed:**
- Positive: open decision, procurement blocking date ≤ 21 days → valid draft
- Positive: decision from meeting marked open, owner needs to decide → valid draft
- Negative: decision already resolved (owner replied + PM confirmed, or minutes marked closed) → no action
- Negative: blocking date > 21 days → no action
- Edge: blocking date is past → shows overdue message
- Edge: owner reply detected but PM hasn't confirmed → decision still open, action remains

---

### A8: Meeting commitment follow-up

**id:** `meeting-commitment-followup`  
**version:** 1  
**object:** Meeting commitment (from Granola transcript or manual entry)  
**owner role:** Determined by linked object: RFI/submittal → PE; cost, schedule, owner-related → PM; notice → PX; unlinked → PM  
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
- **Date parsing rules:**
  - "end of week" = Friday 5pm project time
  - "next Tuesday" = Tuesday of the following week
  - Ambiguous dates = "Confirm date"
  - No date stated = "none stated" and no chase is drafted

**Output:**
- Draft chase email to owner (if owner is known)
- Subject: "Follow-up: [commitment summary] (due [date])"
- Body: commitment text, meeting date, stated due date, days overdue, linked record (if any), request for update or completion
- **If owner is unclear:** card shows "confirm owner" prompt, no draft until owner is manually assigned
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** Determined by linked object: RFI/submittal → PE; cost, schedule, owner-related → PM; notice → PX; unlinked → PM

**Due / escalation:** Commitment due date + 1 working day. Not approved by due → moves up one level (PM → PX).

**Scoring:**
- **Commitment completion rate:** % of commitments completed on time
- **Float days protected:** if commitment is linked to an activity and completed before activity impact

**Outcome event:**
- Created, approved/dismissed, sent
- Owner confirmed (if was unknown): timestamp, user id
- Commitment completed: timestamp, on-time (Y/N)

**Eval cases needed:**
- Positive: clear commitment, known owner, due date past → valid draft
- Positive: commitment to answer RFI, known owner, overdue → draft links to RFI, routed to PE
- Negative: commitment completed before due date → no action
- Negative: speaker not identified → shows "confirm owner", no draft
- Edge: "by Friday" commitment in a Tuesday meeting → interprets as the upcoming Friday 5pm
- Edge: "by end of week" → Friday 5pm project time
- Edge: "next Tuesday" in a Friday meeting → Tuesday of the following week
- Edge: ambiguous date ("soon", "in a few days") → shows "Confirm date", no chase until date confirmed

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
- Cost/schedule impact (only if stated in the meeting transcript)
- Existing change events (to check for duplicates)
- Procore connection status

**Preconditions:**
- Decision is from owner or owner's representative (verified against project parties)
- Decision has cost or schedule impact (stated in the meeting transcript)
- **Never infer cost impact:** If owner directs added work with no $ stated, card fires with "Add ROM". If there is no directive, no card is created.
- No existing CE linked to this decision
- **Procore connection check:** same as A4

**Output:**
- Pre-filled change event (same format as A4)
- Title, description (quoting transcript), source (meeting + date), ROM $ (if stated in meeting; else "Add ROM"), deep link to Procore CE creation
- **Banned wording:** waived, liable, breach, entitled

**Approval tier:** PM

**Due / escalation:** Directive date + 5 working days. Not approved by due → moves up one level (PM → PX).

**Scoring:**
- **Change dollars:** tracked in three separate stages (same as A4): Raised (PM approved card), Submitted (CE in Procore or proposal in mailbox, traced to card), Approved (owner executed CO). Dollars from CE/proposal amount, not our estimate.

**Outcome event:**
- Created, approved/dismissed
- CE created, CE approved: same as A4

**Eval cases needed:**
- Positive: owner decision in meeting, cost stated, no existing CE → valid draft with ROM
- Positive: owner directive for added work, no $ stated → card fires with "Add ROM"
- Negative: decision from sub/vendor (not owner) → no action
- Negative: existing CE already covers this decision → no action
- Negative: no directive from owner (just discussion, no decision) → no action

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
- **No transcript quality threshold:** process all transcripts. Unlabeled speakers → ball-in-court "confirm owner".
- PM approves before distribution (always)

**Output:**
- Draft minutes in SiteTech OAC template (docs/product/oac-minutes-template.md)
- Header: project, meeting type, meeting #, date/time/zone, location, attendees, distribution, next meeting
- Categories (fixed order): Safety, Schedule, RFIs, Submittals, Procurement, Changes, Owner decisions, Field/quality/inspections, Old business, New business
- **Category mapping:** Model tags categories, PM reviews during approval; untagged items → New business
- Every item: item # (category.sequence), title, discussion (1-3 sentences), status (open/closed/on hold), ball in court (company + person, or "confirm owner" if speaker unlabeled), due date (stated or "none stated"), linked record, days/$ at risk (from code, same rules as actions; else blank), source (transcript quote + timestamp), commitment flag (yes = becomes A8 tracked action)
- Open items from prior meeting carry forward with original item #
- Owner decision with cost + no CE → becomes A9 (change event draft)
- Missed commitment → becomes A8 (chase draft)
- Distribution note: "Please send corrections within 5 business days."
- **Distribution tracking:** by sent-item detection in the project mailbox, else one-tap confirm
- **Banned wording:** waived, liable, breach, entitled, any legal conclusion
- **Ready for paste into Procore Meetings** (M2) or write-back via API (M3)

**Approval tier:** PM (always; never auto-distributed)

**Due / escalation:** Meeting date + 2 working days. Not approved by due → moves up one level (PM → PX).

**Scoring:**
- Minutes prepared (count)
- Estimated hours saved vs. manual minutes (approved × week-1 timed minutes per PM)
- Distribution tracked by sent-item detection or one-tap confirm

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
- Edge: freeform discussion → model tags category, PM reviews; untagged → New business

---

### A11: Outgoing delay notice to owner

**id:** `outgoing-delay-notice`  
**version:** 1  
**object:** Project completion slip (from what-if scenario or actual schedule update)  
**owner role:** PX  
**trigger:** Project completion slips (from what-if scenario user accepts, or schedule update shows slip), triggering contractual notice requirement  

**Required inputs:**
- Slip event: what-if scenario result or schedule update showing completion slip
- Slip duration (working days and calendar days)
- Notice period: from project settings, keyed on `contract_kind: owner_gc` + `counterparty_name: [owner]` + `notice_type: delay_time_extension`
- Response deadline (computed: event date + notice period, business days + holidays)
- Owner representative contact
- Project time zone, holidays

**Preconditions:**
- Completion slip meets contractual threshold (if specified; else any slip that triggers notice period)
- Notice period is configured for owner_gc contract
- Owner contact exists

**Output:**
- **Notice information card (not a draft):** "If this happens: notice period per settings is [X] business days (§[section]), deadline [date]. Confirm with PX."
- **What-if creates cards only when user taps.** Those cards go through PX approvals before any notice is sent.
- If user proceeds, draft delay notice email to owner:
  - Subject: "Notice of delay: [project name]"
  - Body: notice per contract (§[section]), event causing delay, completion slip duration, new completion date, request for time extension or acknowledgment
  - No legal conclusions
- **Banned wording:** waived, liable, breach, entitled, defaulted

**Approval tier:** PX (always)

**Due / escalation:** Event date + notice period − 2 business days. If not approved by due, escalates to CEO. **🔶 OPEN:** CEO tier not in current enum (PE/PM/PX); add CEO tier or change escalation target?

**Scoring:**
- **Notices sent before deadline:** count and % (on-time compliance)
- No $ metric; compliance-driven

**Outcome event:**
- Created (from what-if or schedule update), timestamp
- Approved/dismissed
- Sent: timestamp, on-time (Y/N)

**Eval cases needed:**
- Positive: completion slip from what-if, notice period configured → valid info card, PX can proceed to draft
- Positive: completion slip from schedule update, notice period configured → card fires automatically
- Negative: notice period not configured → shows "Confirm notice period with PX"
- Edge: deadline < 2 days → urgent flag, immediate PX notification

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

### Email redaction and quote matching
**Stored email body, subject, and preview replace addresses with `[email-<domain>]` placeholders.** When an action quotes from email, quotes are matched against the redacted body. This protects PII while preserving the ability to cite and verify sources.

### Float and $ computation
All float and $ values are computed by **deterministic code** (see docs/what-if-math.md), never estimated by the model:
- **Float days:** from P6's total float field in the latest schedule snapshot. Float is reported in days only and is **never converted to dollars**.
- **$ impact:** critical-path days avoided × daily delay cost. Only days that would have slipped project completion count toward $.
- **Float days protected (scoring):** When an action prevents a delay, the float days that would have been consumed are logged for ROI reporting, but not converted to dollars.
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

### Scorecard outcomes (ROI reporting)

Aggregated metrics for the PX after 30 days:
- **Float days protected:** Sum of confirmed float days preserved (A1, A2, A5, A7). "Confirmed" requires synced data showing the predicted outcome occurred.
- **Critical-path days avoided:** Sum of confirmed critical-path days avoided × daily delay cost.
- **Change dollars:** reported in three stages separately (never summed):
  - **Raised:** Count and total $ of CEs where PM approved the card (A4, A9)
  - **Submitted:** Count and total $ of CEs in Procore or proposals in mailbox, traced to cards (pilot headline metric)
  - **Approved:** Count and total $ of owner-executed COs, traced to cards
- **Confirmed catches ≥ $25k:** Count of change-dollar Submitted events where amount ≥ $25,000
- **Share approved:** % of actions shown that were approved (not dismissed)
- **"Wrong" dismiss rate:** % of dismissals with reason "wrong" (must stay < 5%)
- **Estimated hours saved per PM/PE:** (actions approved × week-1 timed minutes-per-action) / 60. Minutes-per-action timed with pilot PM/PE during week 1.
- **Notices sent before deadline:** Count and % of A6 actions sent before the response deadline (on-time compliance)
- **Fabrication holds (A3):** Count approved, count confirmed (user-confirmed flag or revised submittal received)

**Data sources:**
- Raised/Submitted/Approved amounts: `change_dollars` table with stage enum and card_id trace
- Confirmed flag: `action_outcomes.confirmed` boolean (set when synced data shows predicted outcome)
- Dismiss reasons: `action_outcomes.dismiss_reason` enum
- Minutes-per-action: `project_settings.minutes_per_action_pe` and `minutes_per_action_pm` (timed in week 1)

### Write-path and approvals

Every outgoing write or send is an `approvals` row with a tier enum per action:
- **Tier:** `PE`, `PM`, `PX` (from action's approval tier field)
- **Timeout:** action's due date (from Due/escalation field). `step.waitForEvent` times out at due date, then escalates one level.
- **Escalation:** If not approved by due date, action moves up one level (PE → PM → PX → CEO if needed). Escalation message: "Moved up from [tier]: not acted on by [date] ([action context])."

**M2 (read-only):**
- **"Approve & open"** only opens Outlook (with draft email pre-filled) or shows a paste block (for Procore CE). Nothing is sent server-side.
- **A6 .ics file:** downloaded locally, not a Graph API write.
- **GET-only clients:** All M2 data clients are GET-only. No write methods.

**M3 (write-back, future):**
- Separate write client behind approvals tier system
- Write-back to Procore (create CE, add meeting items), Graph (send email, create calendar event)
- GET-only clients never gain write methods; write client is a separate module

### Model receives redacted text; code fills recipients

The model receives only redacted email body/subject/preview (addresses → `[email-<domain>]` placeholders). It drafts without specific email addresses. When the draft opens in Outlook or shows in a card, **code fills in the actual recipient addresses** from the ball-in-court or owner contact fields. Cards show company name and role (e.g., "To: Architect (via Outlook)"), not specific email addresses.

### Procore dependencies and email mode

**Requires Procore field:** Each action has a `requires_procore` boolean:
- **A1** (RFI overdue escalation) - `true` (requires Procore RFI data)
- **A2** (Submittal chase) - `true` (requires Procore submittal data)
- **A3** (Fabrication hold) - `true` (requires Procore submittal + ASI data)
- **A4** (Change event draft) - `false` (works in email-only mode; shows "Confirm no existing CE" chip when Procore not connected)
- **A5** (Schedule slip recovery) - `false` (uses P6 XER schedule data)
- **A6** (Notice response) - `false` (email/letter-based)
- **A7** (Owner decision request) - `false` (meeting/email/RFI-based)
- **A8** (Meeting commitment followup) - `false` (meeting transcript-based)
- **A9** (Meeting change event draft) - `false` (meeting transcript-based; same email-only mode as A4)
- **A10** (OAC minutes draft) - `false` (meeting transcript-based)
- **A11** (Outgoing delay notice) - `false` (what-if scenario or schedule update-based)

**A4 email mode:** A4 (change event draft) works in email-only mode when Procore is not connected. Instead of checking for existing CEs in Procore, the draft shows a **"Confirm no existing change event"** chip that the PM must tap before approval. The draft includes source quotes and ROM $ (if stated), ready for the PM to create the CE manually.

**Submitted tracing (change dollars):** A CE or proposal is traced back to an A4 or A9 card when:
1. Created after the card was approved (timestamp check)
2. AND matched by source reference (email message-id, meeting id, RFI number in CE description) OR manual link (user taps "link to card")
3. Amount comes from the CE or proposal, never from our ROM estimate

---

## Open questions

**All major OPEN items have been resolved as of Oct 9, 2026 (PM answers in PR #17 comments).** The following have been answered and incorporated into the spec above:

1. ✅ **A1 (RFI multiple activities):** Urgency from earliest-starting linked activity; $ from activity with least float; card lists others
2. ✅ **A2 (Lead time):** Use submittal's lead time, else per-project setting by division, else "Confirm lead time"
3. ✅ **A3 (ASI detection):** Deterministic link via shared spec section/sheet number or email naming both; weak link = Confirm chip
4. ✅ **A4 (RFI adds scope):** Fire if cost/schedule impact field = yes OR answer contains fixed cost-adding wording, AND no CE linked
5. ✅ **A4 (Change $ captured):** Three stages (Raised, Submitted, Approved), never summed; dollars from CE/proposal amount, not estimate
6. ✅ **A4 (Reason codes):** Project-specific via source mapping; unmapped = blank
7. ✅ **A4 (ROM $):** Only when stated in source; never model estimate
8. ✅ **A5 (Slip threshold):** Fire when slip leaves ≤ 5 working days of float OR hits the critical path (configurable per-project)
9. ✅ **A5 (Resequence verification):** Only suggest activities whose P6 predecessors are complete/unaffected; labeled "guidance, check in P6"
10. ✅ **A7 (Owner decision sources):** Meeting decisions marked open, emails to owner, RFIs/submittals with owner ball-in-court
11. ✅ **A7 (Blocking threshold):** Procurement activity start minus lead time ≤ 21 days
12. ✅ **A7 (Resolution detection):** Owner reply + PM one-tap confirm, OR minutes mark closed
13. ✅ **A8 (Routing):** By linked object (RFI/submittal→PE, cost/schedule/owner→PM, notice→PX, unlinked→PM)
14. ✅ **A8 (Date parsing):** "end of week" = Friday 5pm, "next Tuesday" = following week Tuesday, ambiguous = "Confirm date", no date = "none stated" no chase
15. ✅ **A9 (Cost inference):** Never infer; no $ stated = "Add ROM"; no directive = no card
16. ✅ **A10 (Transcript quality):** No threshold; process all; unlabeled speakers → "confirm owner"
17. ✅ **A10 (Category mapping):** Model tags + PM reviews; untagged → New business
18. ✅ **A10 (Distribution tracking):** Sent-item detection or one-tap confirm
19. ✅ **Minimum $ threshold:** None by default; rank by $; always show if float ≤ 5 days OR critical path OR notice deadline involved; optional per-project setting
20. ✅ **Due dates / escalation:** Defined per action:
    - **A1:** answer-by = activity start − 5 working days
    - **A2:** release-by date (activity start − lead time)
    - **A4:** directive date + 5 working days
    - **A5:** 2 working days after slip detected
    - **A6:** deadline − 2 business days (escalates to PX same day if not acted)
    - **A7:** blocking date
    - **A8:** commitment due date + 1 day
    - **Not approved by due date** → moves up one level (PE → PM → PX) with wording: "Moved up from PE: not acted on by Oct 8 (RFI 112 answer-by Oct 9)."

**Remaining OPEN questions for M2:**

1. **🔶 A5 resequence (for PM):** When an activity has no float remaining (≤ 0), should A5 omit the resequence suggestion entirely, or show it with a note that float is exhausted?
2. **🔶 Delay cost definition (for PX):** Confirm delay-cost definition. Current: "GC general conditions + owner carry cost per day." Concern: owner carry cost mixes in owner-side cost, which may not be appropriate for internal GC ROI. Should it be GC general conditions only, or full project delay cost?

**No other blocking OPEN items for M2.** All action rules are now deterministic and testable.

---

## Version history

- **v1.0 (Oct 9, 2026, 14:00 UTC):** Initial registry draft for M2 (A1–A10). Open questions noted inline.
- **v1.1 (Oct 9, 2026, 18:07 UTC):** PM resolved all 20 OPEN questions. Applied 4 decisions (change $ tracking, slip threshold, CTO guardrail, email redaction).
- **v1.2 (Oct 9, 2026, 18:14 UTC):** Lead review at 1966299 (first round). Added A11 (outgoing delay notice). Fixed $ calculation (critical-path days × delay cost; float days not converted to $). Added Data requirements, write-path approvals, scorecard outcomes, Procore dependencies. Rebuilt all examples from fixture. Added 2 OPEN questions for PM/PX.
- **v1.3 (Oct 9, 2026, 18:56 UTC):** Lead review at 4069227 (second round). Added Due/escalation to A1, A2, A4, A5, A7, A8. Fixed A6 escalation wording. Flagged A11 CEO escalation OPEN. Set requires_procore on all actions (A1-A3 true, rest false). Flagged gc_vendor party enum OPEN. Clarified cure_default stored value / "cure notice" display label. Fixed A4 email mode consistency (precondition/eval). Removed CPM references. Clarified A1/A2 working-day windows (14 wd, 45 wd).
- **v1.4 (Oct 9, 2026, 19:20 UTC):** Note: A4 closed-RFI path requires Procore (cost/schedule impact field verification).
