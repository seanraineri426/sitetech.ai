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
2. **Computes** the impact using deterministic code: slip propagation through P6 dependencies, dollars, notice deadlines
3. **Explains** the result in plain language (model-generated, but constrained to cite code outputs)
4. **Drafts** any registered actions triggered by the scenario (e.g., outgoing delay notice, expedite request)

**Core principle:** The model only parses the question and explains the numbers. All numbers come from code.

**Slip unit:** Working days on the activity's P6 calendar. "Weeks" convert to 5 working days per week (Mon-Fri standard calendar).

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
- `activityId` (string): P6 schedule activity unique id
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

## Data requirements

**Current state (on main branch):**
- `schedule_activities` table exists with `total_float_days` and `free_float_days` (in days, not hours)
- `schedule_activities.predecessors` is `text[]`, which cannot hold relationship type or lag
- Notice periods are in `project_notice_periods` table
- No `calendars` table, no `calendar_id` on activities
- No `remaining_duration_days`, `original_duration_days`, `actual_start`, `actual_finish`, `driving_path` fields on activities
- No `schedule_snapshots` table to track XER imports
- **🔶 OPEN:** `hours_per_day` source (needed for fixture; propose: add to `projects` table or XER metadata)

**Proposed schema changes for M2:**

### schedule_snapshots table (new, proposed)
```sql
CREATE TABLE schedule_snapshots (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  xer_filename TEXT,
  data_date DATE NOT NULL,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  import_status TEXT CHECK (import_status IN ('pending', 'success', 'failed')),
  hours_per_day INTEGER DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### schedule_activities additional fields (proposed)
```sql
ALTER TABLE schedule_activities
  ADD COLUMN snapshot_id UUID REFERENCES schedule_snapshots(id),
  ADD COLUMN calendar_id TEXT,
  ADD COLUMN remaining_duration_days INTEGER,
  ADD COLUMN original_duration_days INTEGER,
  ADD COLUMN actual_start DATE,
  ADD COLUMN actual_finish DATE,
  ADD COLUMN driving_path BOOLEAN;
```

### schedule_relationships table (new, proposed)
```sql
CREATE TABLE schedule_relationships (
  id UUID PRIMARY KEY,
  snapshot_id UUID REFERENCES schedule_snapshots(id),
  predecessor_activity_id TEXT,
  successor_activity_id TEXT,
  type TEXT CHECK (type IN ('FS', 'SS', 'FF', 'SF')),
  lag_hours INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Alternative:** store as `jsonb` in schedule_activities:
```sql
ALTER TABLE schedule_activities ADD COLUMN relationships jsonb;
-- Format: [{"pred_id": "A100", "type": "FS", "lag_hrs": 0}, ...]
```

### schedule_calendars table (new, proposed)
```sql
CREATE TABLE schedule_calendars (
  id UUID PRIMARY KEY,
  snapshot_id UUID REFERENCES schedule_snapshots(id),
  calendar_id TEXT,
  calendar_name TEXT,
  work_days INTEGER[],
  holidays DATE[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Note: work_days: 1=Mon, 5=Fri, 6=Sat, 7=Sun or 0=Sun (per P6 XER convention)
```

### Delay cost configuration
**Current on main:** `projects.daily_delay_cost_usd` (unit not specified)

**Proposed:** Add `delay_cost_unit`:
```sql
ALTER TABLE projects ADD COLUMN delay_cost_unit TEXT CHECK (delay_cost_unit IN ('calendar_day', 'working_day'));
```

**If delay cost is per calendar day:** slip propagation (in working days) must be converted to calendar days for $ computation. Conversion: count calendar days between original completion and new completion, accounting for non-working days.

**Source tables:**
- Delay cost: `projects.daily_delay_cost_usd` + `projects.delay_cost_unit` (proposed)
- Notice periods: `project_notice_periods` (exists on main) keyed on `(contract_kind, counterparty_name, notice_type)`

---

## Computation: slip propagation + dollars + notice deadline

All computation is deterministic code over the latest successful P6 XER snapshot. No model estimates. **V1 is P6 XER only.**

### 1. Slip propagation (NOT a schedule engine)

**CTO guardrail: We are NOT building a schedule engine.** Float and dates come straight from the P6 XER file. What-if pushes a slip forward through successor activities using P6's dependencies (FS, SS, FF), lags, and calendars. The result is labeled **"estimate, confirm in P6"**. Constraints and resource leveling stay in P6.

**Critical status:** Taken from P6 XER (total_float ≤ 0).

**Rules (from `docs/what-if-examples/compute.py`):**

* **Counting rule:** Day 1 is the first working day AFTER the start date; the start date itself is not counted. Activity dates are inclusive (a 4-day activity starting Mon Nov 9 finishes Thu Nov 12).

* **No CPM recalculation.** Early/late dates and total float come from the P6 snapshot as given. A slip is pushed forward through every successor of the slipped activity:
  * **FS+lag:** successor start >= predecessor finish + (1 + lag) working days
  * **SS+lag:** successor start >= predecessor start + lag working days
  * **FF+lag:** successor finish >= predecessor finish + lag working days (start back-calculated from remaining duration)
  * **SF:** treated as FS and flagged "SF relationship detected, check in P6"
  
  Lags are hours / hours_per_day, counted on the SUCCESSOR's calendar (**🔶 OPEN:** P6's default is predecessor's calendar; XER project setting should decide). With several predecessors the latest (driving) requirement wins. For a slip an activity never moves earlier than its P6 date; for an acceleration successors move earlier only as far as all their predecessors allow (and not before the data date).

* **Slip modes:**
  * **"shift":** a not-started activity starts N working days later (start and finish move)
  * **"extend":** finish moves N working days (start fixed; in-progress = remaining duration from the data date grows)
  * Negative N = acceleration

* **Propagated delay of an activity** = working days its early finish moved. **Resulting float** = P6 total float - delay (no clamp; negative means it now drives completion late). **Float consumed** = min(delay, P6 float) for delay > 0. **🔶 OPEN:** No activity starts with negative float in the fixture because constraints stay in P6.

* **Completion slip** = working days the completion activity's early finish moved. **Calendar days** = calendar-date difference between the old and new completion finish. **$** = calendar days × daily delay cost (calendar-day unit). No $ when delay cost is not set; acceleration reports days recovered only (no $ savings).

* **Notice deadline (only when completion slips)** = event date + notice period in business days (skip weekends and project holidays; same counting rule). Passed if deadline < as_of. **🔶 OPEN:** Source of notice event date (proposed: the received date of the email or upload that revealed the slip).

**What this does NOT do (stays in P6):**
- Constraint checking (must-start, must-finish, SNET, FNLT, etc.)
- Resource leveling
- Baseline comparisons
- Activity splitting
- Recalculating total float (we use P6's values)

**Output (per activity impacted):**

```json
{
  "activityId": "A2310",
  "activityName": "L3 shaft framing",
  "originalEarlyFinish": "2026-10-15",
  "newEarlyFinish": "2026-11-13",
  "slipWorkingDays": 21,
  "floatConsumed": 3.0,
  "remainingFloat": 0,
  "onCriticalPath": false
}
```

**Test cases required:**
1. **Zero float (critical):** slip directly impacts completion
2. **Positive float:** slip absorbed by float, no completion impact
3. **Negative float:** activity already late; additional slip extends lateness
4. **Multi-path:** multiple successors; only critical path matters for completion
5. **Holiday spanning:** slip correctly skips non-working days per P6 calendar
6. **Shutdown period:** slip correctly uses P6 calendar non-work periods
7. **In-progress activity:** uses P6 remaining_duration from data date
8. **FS lag:** FS+5 is the driving relationship, lag preserved
9. **SS logic:** start-to-start propagation
10. **FF logic:** finish-to-finish propagation
11. **SF logic:** ⚠️ start-to-finish flagged "check in P6"

---

### 2. Dollars computation

**Formula:**  
`$ impact = (days on critical path) × (daily delay cost)`

**Rules:**
- **Daily delay cost** comes from project settings (GC general conditions + owner carry cost per day, entered by PX during onboarding)
- **No default:** if daily delay cost is not set, show "Set delay cost in settings to see $ impact" – never guess
- **Days on critical path:** only days that slip the project completion date count toward $
  - If the slip is absorbed by float (no critical path impact), $ impact = $0 (but show "X days of float consumed")
  - If the slip consumes float partially, only the days beyond float (negative float on the completion activity) count toward $

**Working days → Calendar days conversion:**
- The slip propagation algorithm operates in **working days** (per the project calendar)
- When `delay_cost_unit = "calendar_day"`, completion slip must be converted to **calendar days** before multiplying
- Conversion: count calendar days between original and new completion dates on the project calendar (including weekends and holidays)
- Both working days and calendar days are reported in the result

**Example (from computed fixture):**
- Activity A2310 slips 8 working days
- Float on A2310: 3 days
- Propagated delay to completion activity A3000: 2 working days (after absorbing float along the chain)
- Completion slip: 2 working days = 4 calendar days (counting calendar days between original Nov 19 and new Nov 23)
- $ impact: 4 calendar days × $12,000/calendar day = **$48,000**

**Output:**

```json
{
  "dollarImpact": 48000,
  "completionSlipWorkingDays": 2,
  "completionSlipCalendarDays": 4,
  "dailyDelayCost": 12000,
  "dailyDelayCostUnit": "calendar_day",
  "dailyDelayCostSource": "project_settings"
}
```

**Edge cases:**
- **Activity not on critical path, slip absorbed by float:** `dollarImpact = 0`, `completionSlipWorkingDays = 0`, `completionSlipCalendarDays = 0`
- **Activity on critical path (zero float):** `dollarImpact = completionSlipCalendarDays × dailyDelayCost` (or working days if `delay_cost_unit = "working_day"`)
- **Daily delay cost not set:** `dollarImpact = null`, `dailyDelayCost = null`, `dailyDelayCostSource = "not_configured"`

---

### 3. Notice deadline computation

**Formula:**  
`Notice deadline = event date + notice period`

**Rules:**
- **Notice period** comes from project settings (configured per notice type: delay/time, cost/change claim, differing site condition, change directive dispute, cure notice, injury/property damage)
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
  "noticeDeadline": "2026-10-26",
  "deadlineSource": "project_settings_contract_section_8.3"
}
```

**Edge cases:**
- **Deadline falls on weekend/holiday (business days):** advance to next business day
- **Deadline falls on weekend/holiday (calendar days):** deadline is that day (no adjustment)
- **Notice period not configured:** `noticeDeadline = null`, `deadlineSource = "not_configured"`
- **Urgent notice (< 2 business days):** handled by action routing (A6 escalates from PM to PX same day if deadline < 2 business days from response requirement)
- **Deadline has already passed:** Card text must be exactly: "Deadline per project settings was \<date\>; confirm with PX". Must not draw any legal conclusion (no "waived", "defaulted", "forfeited", etc.).

---

## Output: What-if result JSON

The computation returns a structured result that the model uses to generate a plain-English explanation:

```json
{
  "scenario": {
    "activityId": "A2310",
    "activityName": "L3 shaft framing",
    "slipWorkingDays": 21
  },
  "impacts": {
    "primaryActivity": {
      "activityId": "A2310",
      "activityName": "L3 shaft framing",
      "originalEarlyFinish": "2026-10-22",
      "newEarlyFinish": "2026-11-20",
      "slipWorkingDays": 21,
      "floatConsumed": 3.0,
      "remainingFloat": -18.0,
      "onCriticalPath": true
    },
    "successors": [
      {
        "activityId": "A2320",
        "activityName": "L3 MEP rough-in",
        "propagatedDelay": 18.0,
        "p6TotalFloat": 3.0,
        "resultingFloat": -15.0,
        "onCriticalPath": true
      },
      {
        "activityId": "A3000",
        "activityName": "Exterior envelope closeout",
        "propagatedDelay": 15.0,
        "p6TotalFloat": 0.0,
        "resultingFloat": -15.0,
        "onCriticalPath": true
      }
    ],
    "projectCompletion": {
      "originalDate": "2026-11-19",
      "newDate": "2026-12-14",
      "slipWorkingDays": 15,
      "slipCalendarDays": 25
    }
  },
  "dollars": {
    "dollarImpact": 300000,
    "completionSlipWorkingDays": 15,
    "completionSlipCalendarDays": 25,
    "dailyDelayCost": 12000,
    "dailyDelayCostUnit": "calendar_day",
    "dailyDelayCostSource": "project_settings"
  },
  "notices": [
    {
      "noticeType": "delay_time_extension",
      "noticeInfo": "If this happens: notice period per settings is 7 business days (§8.3), deadline Dec 3. Confirm with PX.",
      "eventDate": "2026-11-20",
      "noticePeriodDays": 7,
      "calendarOrBusiness": "business",
      "noticeDeadline": "2026-12-03",
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
      "actionId": "outgoing-delay-notice",
      "actionName": "Outgoing delay notice to owner (A11)",
      "targetActivityId": null,
      "reason": "Project completion slips by 25 calendar days, triggering delay notice requirement"
    }
  ],
  "sourceData": {
    "scheduleSnapshot": "P6_XER_2026-10-08_05-12",
    "scheduleDataDate": "2026-10-08",
    "projectSettings": "project_12345_settings_v3",
    "computedAt": "2026-10-09T18:27:42Z"
  },
  "estimateLabel": "estimate, confirm in P6"
}
```

### JSON schema summary

**Top-level:**
- `scenario` (object): echoes the input scenario (activityId, activityName, slipWorkingDays)
- `impacts` (object): computation results
  - `primaryActivity` (object): the activity the user asked about
  - `successors` (array of objects): impacted successor activities. **Ordering:** critical-path activities (remaining float ≤ 0) first, then rest ordered by least float (ascending).
  - `projectCompletion` (object): project finish date impact (slipWorkingDays and slipCalendarDays)
- `dollars` (object): $ impact breakdown (completionSlipWorkingDays, completionSlipCalendarDays, dollarImpact)
- `notices` (array of objects): triggered notice requirements (from contract notice periods)
- `suggestedActions` (array of objects): registered actions that would be triggered by this scenario (for drafting)
- `sourceData` (object): audit trail (schedule snapshot id, **schedule data date**, settings version, timestamp)
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

**Successor display:** Show the impacted activities. **Ordering:** critical-path activities (remaining float ≤ 0) first, then rest ordered by least float (ascending). Display all impacted successors in the propagation chain; if there are many, the UI can collapse/expand.

---

## Model explanation rules

The model generates a plain-English explanation of the what-if result, constrained to:
1. **Cite the source JSON:** every number must come from the `impacts`, `dollars`, or `notices` objects (no guessing)
2. **Structure:** (a) restate the scenario, (b) explain the primary impact, (c) mention key successors (up to 3), (d) state the $ impact and project completion impact, (e) list any triggered notices, (f) offer to draft suggested actions
3. **Tone:** direct, construction-professional, no jargon ("3 weeks" not "21 business days", "$ at risk" not "cost exposure")
4. **Banned wording:** waived, liable, breach, entitled (same as actions)
5. **Always show float:** "This slip consumes 21 days of float; 3 days remain" (helps users understand why $ impact may be $0)

**Example explanation (model-generated, but citing code):**

> If **L3 shaft framing** slips **15 working days** (3 weeks), here's what happens:
>
> - The activity finishes **Nov 12** instead of **Oct 22**, consuming its **3 days of float**. Resulting float: **-12 days** (now critical).
> - **L3 MEP rough-in** receives **12 working days** of propagated delay, consuming its **3 days of float**. Resulting float: **-9 days** (critical).
> - **Exterior envelope closeout** (already critical) receives **9 working days** of delay.
> - **Project completion** slips **9 working days = 15 calendar days** (from Nov 19 to Dec 4).
> - **$ impact: $180,000** (15 calendar days × $12,000/calendar day delay cost).
>
> **If this happens:** notice period per settings is 7 business days (§8.3), deadline Dec 1. Confirm with PX.
>
> **What would you like to do?**
> - Review outgoing delay notice requirements (A11)
> - See recovery options for L3 shaft framing
> - Show me the propagation chain

**Confirmation prompt (always included):**
> Is **L3 shaft framing** (activity A2310) the right activity? [Yes] [No, show alternatives]

---

## Citation rules (every number on screen must cite its source)

Every number displayed in the what-if result must include a citation (tap to see source):
- **Float days consumed:** cites the schedule snapshot + schedule data date + P6's calculated float values (shows original float from P6, slip propagated, remaining float)
- **$ impact:** cites the daily delay cost (from project settings, line item) + critical path slip days (from schedule impact walk) + schedule data date
- **Notice deadline:** cites the contract notice period (from project settings, contract section) + event date + business day calculation log
- **Project completion date:** cites the schedule snapshot + schedule data date + critical path slip propagation
- **Successor impacts:** cites the successor logic (from schedule: predecessor, lag, relationship type FS/SS/FF) + slip propagation + schedule data date

**All citations include:**
- The schedule snapshot's data date (the "as of" date for all schedule data)
- The reminder: "estimate, confirm in P6"

**Example citation card (shown on tap):**

> **$ impact: $312,000**
>
> **Source:**  
> - Critical path slip: 26 days (from schedule impact walk, P6 XER snapshot P6_XER_2026-10-08_05-12)
> - Schedule data date: Oct 8, 2026
> - Daily delay cost: $12,000/calendar day (from project settings)
> - Computation: 26 days × $12,000/day = $312,000
> - **Note:** This is an estimate. Confirm in P6 (constraints and resource leveling not applied).
>
> [View schedule snapshot] [View project settings]

**Citation links (PM):** Link to the schedule snapshot summary for M2. Direct deep-links to Procore activities or P6 web UI rows are desirable for M3 but require deep-link support from those tools.

---

## Test cases required (deterministic correctness)

Each test case includes:
1. **Input:** scenario (activityId, slipDays) + schedule fixture (P6 XER) + project settings (daily delay cost, holidays, notice periods)
2. **Expected output:** impacts (primaryActivity, successors, projectCompletion), dollars, notices (all fields)
3. **Assertion:** computed output matches expected output exactly (no tolerance; deterministic)

### Test case list (minimum for M2)

Reference fixture: `docs/what-if-examples/fixture.json`. All numbers computed by `compute.py`.

| Test | Scenario | Expected result |
|---|---|---|
| **TC1: Zero float** | A3000 (completion, 0d float) slips 10 wd | Completion slip: 10 wd = 14 calendar days. $ = $168,000 (14 cd × $12k/cd) |
| **TC2: Positive float** | A1100 (7d float) slips 5 wd | Float consumed 5d, remaining float +2d. Completion slip: 0 wd. $ = $0 (absorbed by float) |
| **TC3: Float exceeded** | A1100 (7d float) slips 12 wd | Resulting float -5d. Completion slip: 5 wd = 7 cd. $ = $84,000 (7 cd × $12k/cd) |
| **TC4: Negative float** | A2100 (critical, 0d float) slips 8 wd | Resulting float -8d. Completion slip: 8 wd = 10 cd. $ = $120,000 (10 cd × $12k/cd) |
| **TC5: Multi-path merge** | A1100 slips exactly its 7d float | Two paths to A3000: A1100→A3000 (FS+2) and A2200→A3000 (FS). A1200 is open end with no successors. Latest predecessor drives (tie, no slip). $ = $0 |
| **TC6: Holiday spanning** | A2200 slips 10 wd across Thanksgiving (Nov 26-27) | A2200 moves to Nov 23-30 (skipping Nov 26-27 holidays). A3000 starts Dec 1. Completion slip: 10 wd = 14 cd. $ = $168,000 |
| **TC7: Shutdown period** | A3000 slips 20 wd across Dec 25 and Jan 1 | Completion slip: 20 wd = 30 cd. $ = $360,000. (Dec 25, Jan 1 non-work) |
| **TC8: In-progress** | A1000 (in progress, 6d remaining from Oct 8) extends +5 wd | Uses remaining duration from data date. Slip absorbed by float. $ = $0 |
| **TC9: Lag (FS+2)** | A1100 slips 9 wd; FS+2 lag to A3000 preserved | Completion slip: 2 wd = 2 cd (lag + 1 convention). $ = $24,000 |
| **TC10: SS logic** | A2000 slips 4 wd; A2100 follows via SS+5 | Completion slip: 4 wd = 4 cd. $ = $48,000 |
| **TC11: FF logic** | A2100 finish extends +3 wd; A2200 follows via FF+2 | Completion slip: 3 wd = 3 cd. $ = $36,000 |
| **TC12: SF logic** | A2200 slips 2 wd; A2200→A3000 treated as SF | SF flagged. Completion slip: 2 wd = 2 cd. $ = $24,000 |
| **TC13: Delay cost not set** | TC1 with daily_delay_cost_usd = null | Completion slip: 10 wd = 14 cd. $ = null. UI: "Set delay cost in settings to see $ impact" |
| **TC14: Notice triggered** | A2100 slips 5 wd, event Nov 19 (deadline spans Thanksgiving) | Completion slip: 5 wd = 7 cd. $ = $84,000. Notice deadline: Nov 19 + 7 business days = Dec 2 |
| **TC15: Notice deadline passed** | A3000 slips 3 wd, event Sep 28, as_of Oct 9 | Completion slip: 3 wd = 3 cd. $ = $36,000. Notice: "Deadline per project settings was Oct 7; confirm with PX" |
| **TC16: No successors** | A1200 (open end, 19d float) slips 10 wd | Float consumed 10d, remaining +9d. Completion slip: 0 wd. $ = $0 |
| **TC17: Accelerate** | A2100 finish -10 wd (acceleration) | Completion slip: -7 wd = -13 cd (limited by A1100 path). $ = null (days recovered reported, no $ savings) |

---

## Performance requirements

- **Computation time:** < 500ms for a scenario with up to 5,000 activities (typical P6 project)
- **Successor depth:** walk up to 100 levels deep (typical max for construction schedules)
- **UI render time:** < 1s to show the summary card + chart after computation completes
- **Concurrent requests:** support 10 concurrent what-if scenarios per project (users exploring different options)
- **Caching (PM):** Not needed for M2; 500ms is fast enough. May revisit for M3 if performance requires it.

---

## Open questions

**Most OPEN items have been resolved as of Oct 9, 2026 (PM answers in PR #17 comments + CTO guardrail).** The following have been answered and incorporated into the spec above:

1. ✅ **Relationship types (PM):** Support FS, SS, FF with lags in M2 (from P6 XER). SF (start-to-finish, rare) is treated as FS with "check in P6" flag.
2. ✅ **Shutdown periods (PM):** Use P6 calendars in the XER (they carry non-work periods) plus project holidays from settings. No separate manual calendar for M2.
3. ✅ **Activity matching (PM):** Normalize case, spaces, and hyphens ("curtainwall" = "curtain wall"). Confidence enum stays internal; user only sees Confirm chip or picker.
4. ✅ **Successor display (PM):** Show impacted activities. Successors ordered: critical-path activities first, then rest by least float (ascending).
5. ✅ **Citation links (PM):** Link to schedule snapshot summary for M2. Direct deep-links to Procore/P6 desirable for M3 but require tool support. Every citation shows the schedule snapshot's data date.
6. ✅ **Acceleration savings (PM):** Do not compute $ savings for acceleration (negative slip). Delay impact only. (Savings are less common and harder to justify; delay impact is the primary use case.)
7. ✅ **Cache results (PM):** Not needed for M2; 500ms is fast enough. May revisit for M3.
8. ✅ **Notice threshold (PM):** Handled by action routing. A6 escalates to PX same day if deadline < 2 business days.
9. ✅ **CTO guardrail applied:** We are NOT building a schedule engine. Float and dates come from P6 file; what-if pushes slips forward using P6 dependencies, lags, and calendars. Constraints and resource leveling stay in P6. Result labeled "estimate, confirm in P6".

**One remaining consideration for M3 (not blocking M2):**
- **Default lead time for what-if scenarios:** Related to A2 action – should what-if scenarios use a default lead time if not specified per activity, or always require explicit lead time? (Always require is safer for M2; default may be useful for M3 exploration.)

**No blocking OPEN items for M2.** All computation rules are deterministic and testable.

---

## Version history

- **v1.0 (Oct 9, 2026, 14:00 UTC):** Initial spec for M2. Open questions noted inline.
- **v1.1 (Oct 9, 2026, 18:07 UTC):** PM resolved 9 OPEN questions. Applied CTO guardrail (NOT building schedule engine).
- **v1.2 (Oct 9, 2026, 18:14 UTC):** Lead review at 1966299 (first round). Renamed "slip propagation". Added Data requirements section. P6 XER only. Fixed FS+1 convention, SF flag, notice deadline calculation. Created fixture and compute script.
- **v1.3 (Oct 9, 2026, 18:56 UTC):** Lead review at 4069227 (second round). Rebuilt fixture with contiguous activities. Fixed propagate_slip to honor shared float. Added Jul 5, 2027 holiday. Updated all examples/test cases with computed numbers. Fixed working→calendar day $ conversion. Removed CPM references. Data requirements match main migration. Added Due/escalation to A1/A2/A4/A5/A7/A8. Fixed A6 escalation, flagged A11 CEO escalation OPEN. requires_procore on all actions. Party enum gc_vendor OPEN, cure_default display label clarified. A4 email mode consistent across precondition/eval.
- **v1.4 (Oct 9, 2026, 19:20 UTC):** Reference fixture & compute (sha256 verified). Replaced all examples with reference numbers from fixture (A1000/A1100/A1200/A2000/A2100/A2200/A3000). Added verbatim rules from compute.py docstring (counting rule, shift vs extend, FS/SS/FF/SF, lag calendar, no max(0) float clamp, completion slip, $, notice). Marked OPEN: notice event date source, lag calendar (successor vs predecessor), no negative float constraints. Removed early/late columns from Data requirements (exist on main), use project_holidays, removed delay_cost_unit and driving_path defaults. TC1-TC17 updated with exact reference numbers. Added check.py for fixture validation. Note: A4 closed-RFI path needs Procore.
