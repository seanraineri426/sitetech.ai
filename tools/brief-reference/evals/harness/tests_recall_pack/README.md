# Recall paraphrase pack v1 as a zero-cost suite

`/workspace/sitetech/product/recall-paraphrase-pack-v1.md` (Product unit tests, OK to tune against) -> `cases.py` (pack wording verbatim,
each wrapped in a minimal FICTIONAL fixture built by `builder.py`, 0002 shape: activities with dates/float/predecessors,
`submittals.schedule_activity_id`). Never reads `evals/holdout/` or any held-out key.

```bash
cd evals
/tmp/stvenv/bin/python -m harness.tests_recall_pack            # $0: cached facts -> code judgment -> catch check; exit 1 on any miss
/tmp/stvenv/bin/python -m harness.tests_recall_pack --legacy   # same cases without extracted facts (pre-split code paths)
/tmp/stvenv/bin/python -m harness.tests_recall_pack.extract --dry       # what is not cached yet
/tmp/stvenv/bin/python -m harness.tests_recall_pack.extract --cap 1.0   # PAID: fill evals/fact_cache/ (OpenRouter -> Bedrock ZDR, Claude pinned)
```
Caught = right record cited + right finding type + date and/or $ shown (P1 additionally needs $ > 0; P5/P6 need the right notice types and a
deadline computed from configured periods; P4 needs location + owner-notice flag). Negatives must not fire (P5 N4 is a guard: flagged
with party + deadline unknown). Mixed set = P1 #6 (zero float) + one item each of P2-P6: P1 must rank #1. Extraction accuracy is reported
per field per pattern against the gold in `cases.py` (model output before judgment).
