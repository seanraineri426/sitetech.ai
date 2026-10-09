/**
 * Lint boundary bypass test file.
 * 
 * This file contains INTENTIONAL violations of the brief-reference import boundary.
 * Every line should trigger ESLint errors. If lint passes on this file, the boundary is broken.
 * 
 * Run: pnpm lint __tests__/lint-boundary-bypass-attempts.test.ts
 * Expected: Multiple ESLint errors, non-zero exit code
 */

// BYPASS ATTEMPT 1: Direct static import
import { something } from "tools/brief-reference/evals/harness/pipeline";

// BYPASS ATTEMPT 2: Relative path static import
import { something2 } from "../tools/brief-reference/README.md";

// BYPASS ATTEMPT 3: Deep relative path
import { something3 } from "../../tools/brief-reference/run_tests.py";

// BYPASS ATTEMPT 4: Wildcard static import
import * as briefRef from "tools/brief-reference/evals/fixture_tools";

// BYPASS ATTEMPT 5: Type-only import (should still be blocked)
import type { SomeType } from "tools/brief-reference/evals/score_brief";

// BYPASS ATTEMPT 6: Dynamic import with string literal
async function bypass6() {
  const module = await import("tools/brief-reference/evals/harness/stages/rank");
  return module;
}

// BYPASS ATTEMPT 7: Dynamic import with template string
async function bypass7() {
  const path = "tools/brief-reference";
  const module = await import(`${path}/evals/harness/stages/verify`);
  return module;
}

// BYPASS ATTEMPT 8: require() call
function bypass8() {
  const module = require("tools/brief-reference/evals/harness/stages/deliver");
  return module;
}

// BYPASS ATTEMPT 9: require() with template string
function bypass9() {
  const path = "tools/brief-reference";
  const module = require(`${path}/evals/harness/stages/rules`);
  return module;
}

// BYPASS ATTEMPT 10: Nested path with alias
import { config } from "../tools/brief-reference/evals/harness/config.yaml";

export {};
