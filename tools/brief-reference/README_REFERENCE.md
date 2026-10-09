# SiteTech Daily Project Brief - Reference Implementation

This directory contains a **reference-only** Python implementation of the SiteTech Daily Project Brief intelligence layer. This code is **not used in production**. The production TypeScript implementation will be built in `lib/brief/`.

## Purpose

This reference implementation demonstrates:
- The harness (deterministic findings, model extraction of email facts, code judgment/ranking, verifier, scorer)
- Prompts and schemas
- Tool definitions
- The Linden Yard training fixture
- PM variety-pack tests
- Cached extraction results for offline testing

## Running Tests

All test suites run **fully offline** at **zero cost** (no network access, no model API calls).

### Quick Start

From the repository root:

```bash
pnpm test:brief
```

This command:
1. Installs Python dependencies from `requirements.txt` (locked with pip-tools)
2. Runs all free test suites:
   - `tests_iter4` - Zero-cost checks for iteration 4 (held-out gaps)
   - `tests_iter3` - Iteration 3 test suite
   - `tests_zero_cost` - Core zero-cost checks (no network, no model)
   - `tests_recall_pack` - Recall pattern tests
3. Enforces offline mode with network blocking

### Manual Test Execution

From this directory:

```bash
# Install dependencies
./setup.sh

# Run all tests
python3 run_tests.py

# Or run individual test suites
cd evals
python3 -m harness.tests_iter4
python3 -m harness.tests_iter3
python3 -m harness.tests_zero_cost
python3 -m harness.tests_recall_pack
```

## Network Blocking

The test runner enforces strict offline mode by blocking all socket connections. Any attempt to access the network will fail with:

```
NETWORK ACCESS BLOCKED: Tests must run fully offline.
```

This ensures tests cost $0 and never make external API calls.

## Paid Model Runs

Paid model runs (using actual LLM APIs) are **not included in CI** and should only be run outside of the test suite with explicit configuration. The paid-run config (`config.yaml`) is not included in this repository.

## Dependencies

- Python 3.11+
- Dependencies listed in `requirements.txt` (pinned with pip-tools from `requirements.in`):
  - `jsonschema` - JSON schema validation
  - `PyYAML` - YAML parsing

## Architecture Documents

See the root-level documentation files:
- `ARCHITECTURE.md` - Full design and system architecture
- `DAILY_BRIEF_SPEC.md` - Brief sections, rules, and specifications
- `CORRELATION_PLAYBOOK.md` - Cross-source correlation patterns
- `RECONCILE.md` - Field and ownership reconciliation notes

## Important Notes

- **This is reference code only** - Production implementation will be in TypeScript under `lib/brief/`
- **No imports allowed** - Production code in `app/` and `lib/` cannot import from this directory (enforced by ESLint)
- **Held-out material excluded** - The archive excludes `evals/holdout/` and related held-out test data
- **No secrets** - No API keys or `.env` files are included

## CI Integration

The test suite runs in CI via GitHub Actions (`.github/workflows/ci.yml`) with:
- Python 3.11 setup
- Automatic dependency installation
- Full test execution
- Zero-cost guarantee

## Contact

For questions about this reference implementation, contact the AI and Agent Systems Engineer or Lead Engineer.
