# What-If Scenario Math Specification
**Owner:** Engineering + Product  
**Status:** Draft, Oct 9, 2026  
**Purpose:** Deterministic computation rules for Ask SiteTech scenario analysis ("what if the switchgear slips 3 more weeks"). All days, dollars, and notice deadlines are computed by code, not estimated by the model.

---

## Overview

The "what if" feature lets users ask plain-English schedule questions:
- "What if the switchgear slips 3 weeks?"
- "What happens if we delay the steel delivery?"
- "If the curtain wall is 10 days late, what's the impact?"

The system:
1. **Parses** the question into a structured scenario (activity id, slip days) using the model, with confirmation of the matched activity
2. **Computes** the impact using deterministic code: CPM/float walk, dollars, notice deadlines
3. **Explains** the result in plain language (model-generated, but constrained to cite code outputs)
4. **Drafts** any registered actions triggered by the scenario (e.g., notice to owner, expedite request)

**Core principle:** The model only parses the question and explains the numbers. All numbers come from code.

---

## Input: Structured scenario

The model parses the user's plain-English question into a structured JSON scenario:

```json
{
  "activityId": "A2310",
  "activityName": "L3 shaft framing",
  "slipDays": 21,
  "confidence": "high",
  "matchReason": "Exact match on activity name 'shaft framing' and location 'L3'",
  "alternativeMatches": []
}
```

**Fields:**
- `activityId` (string): P6 or Procore schedule activity unique id
- `activityName` (string): Activity description from schedule
- `slipDays` (integer): Number of days to slip the activity finish date (positive = delay, negative = accelerate)
- `confidence` (enum): `"high"`, `"medium"`, `"low"` – model's confidence in the activity match
- `matchReason` (string): Human-readable explanation of why this activity was matched (for user confirmation)
- `alternativeMatches` (array of objects, optional): Up to 3 alternative activities if confidence < high, each with `{ activityId, activityName, matchReason }`

### Confidence and confirmation rules

**The confidence enum (`high`, `medium`, `low`) is internal.** The user only sees the Confirm chip or picker, never the confidence score itself.

| Internal confidence | UI behavior |
|---|---|
| **high** | Proceed immediately with computation; show activity name + confirm chip ("Is this the right activity? Yes / No") |
| **medium** | Show top match + alternatives (up to 3) in a picker; user selects before computation |
| **low** | Show "I found these activities that might match: [list]. Which one?" – user must pick or rephrase |

**If the user says "No" to a high-confidence match:** fall back to medium behavior (show alternatives).

**If no activity matches:** "I couldn't find an activity matching '[user's query]'. Try searching by activity ID or a more specific name."

**Activity matching rules:** Normalize case, spaces, and hyphens before matching ("curtainwall" = "curtain wall" = "curtain-wall"). Support both activity name substring match and exact ID match. Always confirm the matched activity with a Confirm chip or picker.

---

## Computation: CPM float walk + dollars + notice deadline

All computation is deterministic code over the latest schedule snapshot (P6 XER or Procore schedule). No model estimates.

### 1. Schedule impact walk (NOT a full CPM recalculation)

**CTO guardrail: We are NOT building a schedule engine.** In v1, float and dates come straight from the P6 XER file (or Procore schedule). What-if pushes a slip forward through successor activities using P6's dependencies (FS, SS, FF), lags, and calendars. The result is labeled **"estimate, confirm in P6"**. Constraints (must-start, must-finish) and resource leveling stay in P6.

**Goal:** Compute the impact of slipping an activity by N days on:
- The activity's finish date (accounting for working calendar + holidays from P6)
- Float consumed (from P6's calculated float values)
- Successor activities' start/finish dates (cascade via P6 logic)
- Project completion date (if critical path is impacted)

**Algorithm (forward slip propagation, NOT full CPM):**

1. **Load the latest schedule:** P6 XER or Procore schedule snapshot (most recent successful import). Use P6's calculated float values, not recalculated.
2. **Identify the activity:** by `activityId` from the scenario input
3. **Apply the slip:**
   - New finish date = original finish date + `slipDays` (accounting for **working calendar from P6**: skip weekends, project holidays, shutdown periods defined in P6 calendars)
   - If the activity is in progress, slip from today (actual finish date); if not started, slip from planned finish date
4. **Walk successors:** for each successor linked by finish-to-start (FS), start-to-start (SS), or finish-to-finish (FF) logic:
   - **FS (finish-to-start):** If successor's early start ≤ activity's new finish + lag, successor is delayed. Successor's new early start = activity's new finish + lag + 1 (working days).
   - **SS (start-to-start):** If successor's early start ≤ activity's new start + lag, successor is delayed. Successor's new early start = activity's new start + lag.
   - **FF (finish-to-finish):** If successor's early finish ≤ activity's new finish + lag, successor is delayed. Successor's new early finish = activity's new finish + lag; back-calculate new early start from duration.
   - **SF (start-to-finish, rare):** Treat as FS and flag "check in P6" (SF logic is uncommon and complex; verify in P6).
   - Compute successor's new early start/finish (accounting for successor duration + working calendar from P6)
   - If successor has multiple predecessors, take the latest driving predecessor (the one that pushes successor's start the latest)
   - Recurse through the successor chain until no more activities are delayed
5. **Compute float consumed:**
   - **Use P6's calculated float values** (total float = late finish - early finish from the P6 XER)
   - Float consumed = min(slipDays propagated to this activity, original float from P6)
   - Negative float = days past the late finish (critical path slip, impacts project completion)
6. **Project completion impact:** if any activity on the critical path (float ≤ 0 in P6) is delayed, project completion slips by the propagated delay amount
7. **Working calendar rules:**
   - Use P6's calendars from the XER (they include non-working days, weekends, holidays, shutdown periods)
   - Add project holidays from project settings (union with P6 calendars)
   - Project time zone (from project settings) for date/time calculations
   - Skip non-working days when computing new finish dates
8. **Label the result:** All what-if results are labeled **"estimate, confirm in P6"** because this is NOT a full schedule recalculation. Constraints (must-start-on, must-finish-on, start-no-earlier-than, etc.) and resource leveling are NOT applied.

**What this does NOT do (stays in P6):**
- Constraint checking (must-start, must-finish, SNET, SNLT, FNET, FNLT)
- Resource leveling
- Baseline comparisons (except using P6's stored baseline dates)
- Activity splitting or calendar exceptions beyond what P6 provides
- Recalculating total float (we use P6's calculated values)

**Output (per activity impacted):**

```json
{
  "activityId": "A2310",
  "activityName": "L3 shaft framing",
  "originalEarlyFinish": "2026-10-15",
  "newEarlyFinish": "2026-11-05",
  "slipDays": 21,
  "floatConsumed": 21,
  "remainingFloat": 3,
  "onCriticalPath": false
}
```

**Test cases required:**
1. **Zero float (critical path activity):** slip directly impacts project completion, $ impact is immediate
2. **Positive float:** slip absorbed by float, no critical path impact (until float is exhausted)
3. **Negative float:** activity already late; additional slip makes it later
4. **Multi-path:** activity has multiple successors on different paths; only the critical path matters for $
5. **Holiday spanning:** slip that spans a holiday period (e.g., Thanksgiving week) correctly skips non-working days using P6 calendar
6. **Shutdown period:** slip that spans a shutdown (e.g., winter break) correctly uses P6 calendar non-work periods
7. **In-progress activity:** slip from today (actual finish) vs. not-started activity (slip from planned)
8. **FS lag:** successor with finish-to-start + lag (e.g., FS+3 days) correctly accounts for lag
9. **SS logic:** start-to-start relationship correctly propagates slip to successor start
10. **FF logic:** finish-to-finish relationship correctly propagates slip to successor finish
11. **SF logic:** start-to-finish (rare) treated as FS with "check in P6" flag

---

### 2. Dollars computation

**Formula:**  
`$ impact = (days on critical path) × (daily delay cost)`

**Rules:**
- **Daily delay cost** comes from project settings (GC general conditions + owner carry cost per day, entered by PX during onboarding)
- **No default:** if daily delay cost is not set, show "Set delay cost in settings to see $ impact" – never guess
- **Days on critical path:** only days that slip the project completion date count toward $
  - If the slip is absorbed by float (no critical path impact), $ impact = $0 (but show "X days of float consumed")
  - If the slip consumes float partially, only the days beyond float (negative float) count toward $
- **Multi-path:** if an activity has multiple successors, compute the critical path (longest path to project completion); only delays on that path count

**Example:**
- Activity has 10 days of float
- User asks: "What if this slips 15 days?"
- Float consumed: 10 days (absorbed, no $ impact)
- Critical path slip: 5 days
- $ impact: 5 days × $12,000/day = $60,000

**Output:**

```json
{
  "dollarImpact": 60000,
  "criticalPathSlipDays": 5,
  "floatConsumedDays": 10,
  "dailyDelayCost": 12000,
  "dailyDelayCostSource": "project_settings"
}
```

**Edge cases:**
- **Activity not on critical path, slip absorbed by float:** `dollarImpact = 0`, `criticalPathSlipDays = 0`, `floatConsumedDays = slipDays`
- **Activity on critical path (zero float):** `dollarImpact = slipDays × dailyDelayCost`, `floatConsumedDays = 0`
- **Daily delay cost not set:** `dollarImpact = null`, `dailyDelayCost = null`, `dailyDelayCostSource = "not_configured"`

---

### 3. Notice deadline computation

**Formula:**  
`Notice deadline = event date + notice period`

**Rules:**
- **Notice period** comes from project settings (configured per notice type: delay/time, cost/change claim, differing site condition, change directive dispute, cure/default, injury/property damage)
- **Calendar vs. business days:** project setting per notice type
  - Calendar days: count every day including weekends/holidays
  - Business days: skip weekends + observed holidays (from project settings)
- **No default:** if notice period is not configured for the notice type, show "Notice period not configured for [type], confirm deadline" – never guess
- **Time zone:** project time zone (from settings) for date calculations

**Output:**

```json
{
  "noticeType": "delay_time_extension",
  "eventDate": "2026-10-15",
  "noticePeriodDays": 7,
  "calendarOrBusiness": "business",
  "noticeDeadline": "2026-10-24",
  "deadlineSource": "project_settings_contract_section_8.3"
}
```

**Edge cases:**
- **Deadline falls on weekend/holiday (business days):** advance to next business day
- **Deadline falls on weekend/holiday (calendar days):** deadline is that day (no adjustment)
- **Notice period not configured:** `noticeDeadline = null`, `deadlineSource = "not_configured"`
- **Urgent notice (< 3 days):** handled by action routing (A6 escalates to PX same day if deadline is < 2 business days from response requirement)

---

## Output: What-if result JSON

The computation returns a structured result that the model uses to generate a plain-English explanation:

```json
{
  "scenario": {
    "activityId": "A2310",
    "activityName": "L3 shaft framing",
    "slipDays": 21
  },
  "impacts": {
    "primaryActivity": {
      "activityId": "A2310",
      "activityName": "L3 shaft framing",
      "originalEarlyFinish": "2026-10-15",
      "newEarlyFinish": "2026-11-05",
      "slipDays": 21,
      "floatConsumed": 21,
      "remainingFloat": 3,
      "onCriticalPath": false
    },
    "successors": [
      {
        "activityId": "A2320",
        "activityName": "L3 MEP rough-in",
        "originalEarlyStart": "2026-10-16",
        "newEarlyStart": "2026-11-06",
        "slipDays": 21,
        "floatConsumed": 5,
        "remainingFloat": 0,
        "onCriticalPath": true
      }
    ],
    "projectCompletion": {
      "originalDate": "2027-06-30",
      "newDate": "2027-07-26",
      "slipDays": 26
    }
  },
  "dollars": {
    "dollarImpact": 312000,
    "criticalPathSlipDays": 26,
    "floatConsumedDays": 21,
    "dailyDelayCost": 12000,
    "dailyDelayCostSource": "project_settings"
  },
  "notices": [
    {
      "noticeType": "delay_time_extension",
      "triggerReason": "Project completion slips by 26 days (> 10 day threshold)",
      "eventDate": "2026-11-05",
      "noticePeriodDays": 7,
      "calendarOrBusiness": "business",
      "noticeDeadline": "2026-11-14",
      "deadlineSource": "project_settings_contract_section_8.3"
    }
  ],
  "suggestedActions": [
    {
      "actionId": "schedule-slip-recovery",
      "actionName": "Vendor slip recovery options",
      "targetActivityId": "A2310",
      "reason": "Activity slips and consumes float"
    },
    {
      "actionId": "notice-response",
      "actionName": "Delay notice to owner",
      "targetActivityId": null,
      "reason": "Project completion slips by 26 days, triggering delay notice requirement"
    }
  ],
  "sourceData": {
    "scheduleSnapshot": "P6_XER_2026-10-08_05-12",
    "projectSettings": "project_12345_settings_v3",
    "computedAt": "2026-10-09T17:38:42Z"
  },
  "estimateLabel": "estimate, confirm in P6"
}
```

### JSON schema summary

**Top-level:**
- `scenario` (object): echoes the input scenario (activityId, activityName, slipDays)
- `impacts` (object): computation results
  - `primaryActivity` (object): the activity the user asked about
  - `successors` (array of objects): impacted successor activities (**PROPOSED:** up to 10 shown by default; more available on request. Not yet decided by PM.)
  - `projectCompletion` (object): project finish date impact (if any)
- `dollars` (object): $ impact breakdown
- `notices` (array of objects): triggered notice requirements (from contract notice periods)
- `suggestedActions` (array of objects): registered actions that would be triggered by this scenario (for drafting)
- `sourceData` (object): audit trail (schedule snapshot id, settings version, timestamp)
- **`estimateLabel`** (string): Always "estimate, confirm in P6" to remind users this is NOT a full schedule recalculation

---

## UI: Chart series and display rules

The what-if result is displayed as:
1. **Summary card** (top): activity name, slip days, float consumed, $ impact (bold, large), project completion impact
2. **Gantt-style timeline** (middle): original schedule (gray) vs. new schedule (red = critical path, yellow = float consumed) for the primary activity + key successors
3. **Action buttons** (bottom): draft suggested actions (if any)

### Chart series

**X-axis:** Time (dates), from 2 weeks before the primary activity's original start to 2 weeks after the latest impacted successor's new finish (or project completion)

**Y-axis:** Activities (rows), sorted by schedule order (earliest start first)

**Series:**
1. **Original schedule (gray bars):** early start to early finish for each activity (baseline or current schedule)
2. **New schedule (colored bars):**
   - Red: activities on the critical path (remaining float ≤ 0 after slip)
   - Yellow: activities with float consumed but not on critical path (remaining float > 0)
   - Green: activities not impacted (no slip)
3. **Float indicator (dotted line):** from new finish to late finish (shows remaining float)
4. **Today line (vertical):** current date
5. **Milestones (diamonds):** project completion (original vs. new)

**Labels:**
- Each bar: activity name, slip days (if > 0), remaining float
- Hover: full activity details (id, original dates, new dates, float consumed, $ impact if on critical path)
- **Result labeled:** All charts and outputs include the label **"estimate, confirm in P6"** to remind users this is NOT a full schedule recalculation

**Successor display (PROPOSED by Agent Engineer, not yet decided):** Show the primary activity + up to 10 immediate successors by default. User can expand to see full critical path if needed. (Full critical path can be 50+ activities; showing all by default risks overwhelming the UI.)

---

## Model explanation rules

The model generates a plain-English explanation of the what-if result, constrained to:
1. **Cite the source JSON:** every number must come from the `impacts`, `dollars`, or `notices` objects (no guessing)
2. **Structure:** (a) restate the scenario, (b) explain the primary impact, (c) mention key successors (up to 3), (d) state the $ impact and project completion impact, (e) list any triggered notices, (f) offer to draft suggested actions
3. **Tone:** direct, construction-professional, no jargon ("3 weeks" not "21 business days", "$ at risk" not "cost exposure")
4. **Banned wording:** waived, liable, breach, entitled (same as actions)
5. **Always show float:** "This slip consumes 21 days of float; 3 days remain" (helps users understand why $ impact may be $0)

**Example explanation (model-generated, but citing code):**

> If **L3 shaft framing** slips **3 weeks** (21 days), here's what happens:
>
> - The activity finishes **Nov 5** instead of **Oct 15**, consuming **21 days of float** (3 days remain).
> - **L3 MEP rough-in** starts **Nov 6** (was Oct 16), consuming its **5 days of float** and putting it on the critical path.
> - **Project completion** slips **26 days** (Jul 26 instead of Jun 30), because MEP rough-in drives the exterior envelope closeout.
> - **$ impact: $312,000** (26 days on the critical path × $12,000/day delay cost).
>
> You'll need to send a **delay notice to the owner** by **Nov 14** (7 business days from the slip date, per contract section 8.3).
>
> **What would you like to do?**
> - Draft the delay notice
> - See recovery options for L3 shaft framing
> - Show me the full critical path

**Confirmation prompt (always included):**
> Is **L3 shaft framing** (activity A2310) the right activity? [Yes] [No, show alternatives]

---

## Citation rules (every number on screen must cite its source)

Every number displayed in the what-if result must include a citation (tap to see source):
- **Float days consumed:** cites the schedule snapshot + P6's calculated float values (shows original float from P6, slip propagated, remaining float)
- **$ impact:** cites the daily delay cost (from project settings, line item) + critical path slip days (from schedule impact walk)
- **Notice deadline:** cites the contract notice period (from project settings, contract section) + event date + business day calculation log
- **Project completion date:** cites the schedule snapshot + critical path slip propagation
- **Successor impacts:** cites the successor logic (from schedule: predecessor, lag, relationship type FS/SS/FF) + slip propagation

**All citations include the reminder:** "estimate, confirm in P6"

**Example citation card (shown on tap):**

> **$ impact: $312,000**
>
> **Source:**  
> - Critical path slip: 26 days (from schedule impact walk, P6 XER snapshot P6_XER_2026-10-08_05-12)
> - Daily delay cost: $12,000 (from project settings, entered by PX on Oct 1, 2026)
> - Computation: 26 days × $12,000/day = $312,000
> - **Note:** This is an estimate. Confirm in P6 (constraints and resource leveling not applied).
>
> [View schedule snapshot] [View project settings]

**Citation links (PROPOSED by Agent Engineer, not yet decided):** Link to the schedule snapshot summary for M2. Direct deep-links to Procore activities or P6 web UI rows are desirable for M3 but require deep-link support from those tools.

---

## Test cases required (deterministic correctness)

Each test case includes:
1. **Input:** scenario (activityId, slipDays) + schedule fixture (P6 XER or Procore JSON) + project settings (daily delay cost, holidays, notice periods)
2. **Expected output:** impacts (primaryActivity, successors, projectCompletion), dollars, notices (all fields)
3. **Assertion:** computed output matches expected output exactly (no tolerance; deterministic)

### Test case list (minimum for M2)

| Test | Scenario | Expected result |
|---|---|---|
| **TC1: Zero float (critical path)** | Slip a critical path activity (float = 0) by 10 days | Project completion slips 10 days; $ impact = 10 × daily delay cost; float consumed = 0; remaining float = 0 |
| **TC2: Positive float** | Slip an activity with 20 days of float by 10 days | Activity finish slips 10 days; float consumed = 10; remaining float = 10; project completion unchanged; $ impact = $0 |
| **TC3: Float exhausted** | Slip an activity with 10 days of float by 15 days | Float consumed = 10; critical path slip = 5; project completion slips 5 days; $ impact = 5 × daily delay cost |
| **TC4: Negative float** | Slip an activity already 5 days late (negative float) by 10 days | Float consumed = 0 (already exhausted); critical path slip = 10; project completion slips 10 days (from current late date); $ impact = 10 × daily delay cost |
| **TC5: Multi-path** | Slip an activity with 2 successors: one on critical path (float = 0), one with float = 15 days | Only the critical path successor impacts project completion; $ impact based on critical path slip only |
| **TC6: Holiday spanning** | Slip an activity by 10 days, where days 3-5 fall on Thanksgiving (Thu-Fri) + weekend (Sat-Sun) | New finish date accounts for 4 non-working days (Thu-Sun) per P6 calendar; actual calendar slip = 14 days; work days slip = 10 days |
| **TC7: Shutdown period** | Slip an activity by 10 days, where days 5-19 fall in a 2-week winter shutdown (Dec 24 - Jan 4) per P6 calendar | New finish date accounts for shutdown days per P6 calendar non-work periods; work days slip = 10 days |
| **TC8: In-progress activity** | Slip an in-progress activity (50% complete, planned finish = Oct 15, today = Oct 10) by 5 days | New finish = Oct 20 (slip from today, not from original finish); successors slip accordingly |
| **TC9: FS lag** | Slip an activity with a successor linked by FS+5 (finish-to-start + 5 day lag) by 10 days | Successor start slips by 10 days (lag is preserved); project completion slips if successor is on critical path |
| **TC10: SS logic** | Slip an activity with start-to-start (SS) successor logic by 10 days | Successor start slips by 10 days (or slip + lag if SS+lag); verify propagation |
| **TC11: FF logic** | Slip an activity with finish-to-finish (FF) successor logic by 10 days | Successor finish slips by 10 days (or slip + lag if FF+lag); verify back-calculation of start |
| **TC12: SF logic** | Slip an activity with start-to-finish (SF) successor logic | Treated as FS; result flagged "check in P6" |
| **TC13: Daily delay cost not set** | Slip a critical path activity by 10 days, but daily delay cost is null in project settings | Project completion slips 10 days; $ impact = null; UI shows "Set delay cost to see $ impact" |
| **TC14: Notice triggered** | Slip causes project completion to slip by 15 days (> 10 day threshold for delay notice) | `notices` array includes delay_time_extension notice with correct deadline (event date + notice period, accounting for business days + holidays) |
| **TC15: No successors** | Slip an activity with no successors (end of a path, not on critical path) | Activity finish slips; float consumed; no impact on project completion; $ impact = $0 |
| **TC16: Accelerate (negative slip)** | Slip an activity by -5 days (acceleration) | Activity finish moves earlier; successors' early start may move earlier if this is the driving predecessor; no float consumed (float increases); $ impact = $0 (savings not computed) |

---

## Performance requirements

- **Computation time:** < 500ms for a scenario with up to 5,000 activities (typical P6 project)
- **Successor depth:** walk up to 100 levels deep (typical max for construction schedules)
- **UI render time:** < 1s to show the summary card + chart after computation completes
- **Concurrent requests:** support 10 concurrent what-if scenarios per project (users exploring different options)
- **Caching (PROPOSED by Agent Engineer, not yet decided):** Not needed for M2; 500ms is fast enough. May revisit for M3 if performance requires it.

---

## Open questions

**Most OPEN items have been resolved as of Oct 9, 2026 (PM answers in PR #17 comments + CTO guardrail).** The following have been answered and incorporated into the spec above:

1. ✅ **CPM float walk / Relationship types (PM):** Support FS, SS, FF with lags in M2 (from P6 XER). SF (start-to-finish, rare) is treated as FS with "check in P6" flag.
2. ✅ **Shutdown periods (PM):** Use P6 calendars in the XER (they carry non-work periods) plus project holidays from settings. No separate manual calendar for M2.
3. ✅ **Activity matching (PM):** Normalize case, spaces, and hyphens ("curtainwall" = "curtain wall"). Confidence enum stays internal; user only sees Confirm chip or picker.
4. 🔧 **Successor display (PROPOSED by Agent Engineer, not yet decided):** Show primary + up to 10 immediate successors by default; user can expand for full critical path. (All impacted activities can be 50+; showing a limited set by default avoids overwhelming the UI.)
5. 🔧 **Citation links (PROPOSED by Agent Engineer, not yet decided):** Link to schedule snapshot summary for M2. Direct deep-links to Procore/P6 desirable for M3 but require tool support.
6. 🔧 **Acceleration savings (PROPOSED by Agent Engineer, not yet decided):** Do not compute $ savings for acceleration (negative slip). Delay impact only. (Savings are less common and harder to justify; delay impact is the primary use case.)
7. 🔧 **Cache CPM results (PROPOSED by Agent Engineer, not yet decided):** Not needed for M2; 500ms is fast enough. May revisit for M3.
8. 🔧 **Notice threshold (PROPOSED by Agent Engineer, not yet decided):** Handled by action routing. A6 escalates to PX same day if deadline < 2 business days.
9. ✅ **CTO guardrail applied:** We are NOT building a schedule engine. Float and dates come from P6 file; what-if pushes slips forward using P6 dependencies, lags, and calendars. Constraints and resource leveling stay in P6. Result labeled "estimate, confirm in P6".

**One remaining consideration for M3 (not blocking M2):**
- **Default lead time for what-if scenarios:** Related to A2 action – should what-if scenarios use a default lead time if not specified per activity, or always require explicit lead time? (Always require is safer for M2; default may be useful for M3 exploration.)

**No blocking OPEN items for M2.** All computation rules are deterministic and testable.

---

## Version history

- **v1 (Oct 9, 2026):** Initial spec for M2. Open questions noted inline.
