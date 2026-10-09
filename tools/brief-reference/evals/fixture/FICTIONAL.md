# All fixture data is fictional

Every project, company, person, email address, phone number, dollar amount, date, and record ID under `evals/fixture/` is invented for testing. Nothing comes from a real project or customer. JSON objects carry a `_FICTIONAL` key. The M1 seed files (`m1/day*/`) and `_ref_index.json` are bare JSON arrays to keep the table shape, so this file and `m1/SCHEMA_NOTES.md` carry the label for them.

## Additions 2026-10-06 (eval harness iteration 3, CTO notice guardrails)
- `project.json.notice_periods`: mirrors the planned `project_notice_periods` table (contract, sub_name, notice_type, days, day_basis,
  contract_section, entered_by/at) plus one documented extension field `trigger` (`event` | `notice_received`: what the days count from).
  Rows are transcribed only from contract terms already in this fixture: CT-1 (Prime 15.1.2, owner-GC, 21 cd after the event, claims →
  `delay` and `cost_or_change_claim`) and CT-2 (Subcontract form 9.3, GC-sub, 7 days of the event, delay or additional cost; `sub_name: "*"`
  = every subcontract on the form). No `differing_site_condition` row: the fixture contract has no clause for it, so the brief must say
  "deadline unknown, check the contract" for that type.
- `project.json.holidays`: copy of `calendar.holidays` at top level (business-day windows use it).
- `harness_fixture.yaml` (new file): Linden Yard's run settings (as_of, compare_to, simulated sync/cutoff times), moved out of
  `harness/config.yaml` so nothing project-specific is left in the harness config. Other fixtures may omit it (settings are then derived).

## Answer-key additions 2026-10-06 (iteration 3, `expected_findings.json`; schema `schemas/expected_findings.schema.json`)
Only fields that encode rules already in DAILY_BRIEF_SPEC.md or existing key entries; no expected value was loosened. The pre-change key
is kept outside the repo tree for diffing only. Each added field carries a `*_basis` note in the key itself.
| Field | Added | Basis |
|---|---|---|
| `F5.forbidden_label` | `["Confirmed"]` (informational) | spec §4.3 COST-PAYAPP-AHEAD: "Likely at best when the schedule is aging"; F5 `confidence_expectation` already says Likely |
| `F6.forbidden_label` | `["Confirmed"]` (informational) | spec §0.1 D2: acute manpower trigger "capped at Likely until it repeats" |
| `F8.required_elements` | owner-notice deadline `2026-10-15` in `management_attention`, **gated** | spec §5.3/§5.4 (F8 = notice_window floor, window to 10/15; `owner_notice_deadline` already a key fact) + §5.5 rule 1 |
| `rank_constraints` | F3 above F1, **gated** | spec §5.4 worked ranking (F3 #1, F1 #2) + §5.5 ranking rule (14 cd vs 12 cd at $16k/cd) |
| `must_not_flag[N5].check` | text_pattern for weather blame | machine encoding of the existing N5 trap (previously hardcoded in score_brief.py) |
| `status_items[S1-S5].checks` | in_closed / in_section / not_in_section / not_in_top | machine encoding of the existing S1-S5 expectations (previously hardcoded in score_brief.py) |

- `project.json.project_parties` (iteration 4): explicit party list with roles `owner` | `architect_engineer` | `gc` | `sub` and email
  `domain`. Derived from `companies` (lender monitor omitted — not one of the four roles). Models see `Company (role)`, never raw addresses.
  Unknown domain → unknown party; a formal notice from an unknown party gets deadline unknown.
