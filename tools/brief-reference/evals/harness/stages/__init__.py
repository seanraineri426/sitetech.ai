"""The five production stages (CTO, 2026-10-06): read -> rules -> rank -> verify -> deliver. Each is a plain function with explicit
inputs/outputs that maps 1:1 to an Inngest `step.run(<name>, fn)`; outputs are saved per run as stages/<n>_<name>.json (the step's
memoized return value). Every action a stage takes is recorded with its permission tier (ARCHITECTURE 11): T0 read, T1 SiteTech-internal
write, T2 external/system-of-record write (approval required; all disabled_in_v1), T3 never."""
import json, os

TIERS = {"T0": "read", "T1": "sitetech_internal_write", "T2": "external_write_requires_approval", "T3": "never_a_tool"}

class Actions:
    """Per-stage action log with the approval tier of every action. T2 actions are refused (disabled_in_v1); T3 never runs."""
    def __init__(self, stage): self.stage = stage; self.rows = []
    def add(self, action, tier, detail=None):
        if tier not in TIERS: raise ValueError(tier)
        if tier == "T3": raise PermissionError(f"{action}: T3 actions are never executed by SiteTech")
        if tier == "T2":
            self.rows.append({"action": action, "tier": tier, "approval": "required", "status": "disabled_in_v1", "detail": detail}); return False
        self.rows.append({"action": action, "tier": tier, "approval": "not_required", "status": "done", "detail": detail}); return True

def save(run_dir, n, name, inputs_ref, outputs, actions):
    d = os.path.join(run_dir, "stages"); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, f"{n}_{name}.json")
    json.dump({"stage": name, "inputs_from": inputs_ref, "actions": actions.rows, "outputs": outputs}, open(p, "w"), indent=1, ensure_ascii=False, default=str)
    return p
