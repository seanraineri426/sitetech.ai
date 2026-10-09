"""Hard spend cap across all harness runs. Ledger: evals/runs/_spend_ledger.json (cost from OpenRouter usage.cost).
Before every call: abort if spent + worst-case estimate of this call > cap. After every call: record actual cost."""
import json, os, threading, datetime as dt

class BudgetExceeded(RuntimeError):
    pass

class CostGuard:
    def __init__(self, ledger_path, cap_usd, run_id=None, run_cap_usd=None):
        """cap_usd: cap on the whole ledger (all runs). run_cap_usd: cap on entries tagged with this run_id."""
        self.path = ledger_path; self.cap = cap_usd; self.lock = threading.Lock()
        self.run_id = run_id; self.run_cap = run_cap_usd
        self.data = json.load(open(ledger_path)) if os.path.exists(ledger_path) else {"cap_usd": cap_usd, "entries": []}
        self.reserved = 0.0

    @property
    def spent(self):
        return sum(e.get("cost_usd") or 0 for e in self.data["entries"])

    @property
    def run_spent(self):
        return sum(e.get("cost_usd") or 0 for e in self.data["entries"] if self.run_id and e.get("run_id") == self.run_id)

    def reserve(self, est_usd, label):
        with self.lock:
            if self.run_cap is not None and self.run_spent + self.reserved + est_usd > self.run_cap:
                raise BudgetExceeded(f"run cost cap: run spent ${self.run_spent:.4f} + reserved ${self.reserved:.4f} + est ${est_usd:.4f} "
                                     f"> run cap ${self.run_cap:.2f} ({label})")
            if self.spent + self.reserved + est_usd > self.cap:
                raise BudgetExceeded(f"cost cap: spent ${self.spent:.4f} + reserved ${self.reserved:.4f} + est ${est_usd:.4f} "
                                     f"> cap ${self.cap:.2f} ({label})")
            self.reserved += est_usd

    def record(self, est_usd, entry):
        with self.lock:
            self.reserved -= est_usd
            entry["ts"] = dt.datetime.now().isoformat(timespec="seconds")
            if entry.get("cost_usd") is None:   # provider did not report cost: count the worst-case estimate
                entry["cost_usd"] = est_usd; entry["cost_source"] = "estimate_worst_case"
            self.data["entries"].append(entry)
            json.dump(self.data, open(self.path, "w"), indent=1)
            if self.run_cap is not None and self.run_spent > self.run_cap:
                raise BudgetExceeded(f"run cost cap exceeded after call: ${self.run_spent:.4f} > ${self.run_cap:.2f}")
            if self.spent > self.cap:
                raise BudgetExceeded(f"cost cap exceeded after call: ${self.spent:.4f} > ${self.cap:.2f}")

def estimate_cost(model, system, messages, max_tokens):
    chars = len(system) + sum(len(m["content"]) if isinstance(m["content"], str) else len(json.dumps(m["content"])) for m in messages)
    p, c = model.price_per_token()
    return (chars / 3.0) * p + max_tokens * c   # chars/3 over-estimates tokens on JSON-heavy prompts: deliberate
