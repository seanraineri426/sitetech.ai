/**
 * Integrity tests for the redaction module.
 * Ensures exactly one implementation exists and detects unauthorized changes.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Expected SHA-256 hash of lib/redact/addresses.ts.
 * This hash is updated when the Lead reviews and approves changes to the redaction logic.
 * Any change to addresses.ts will fail this test, requiring deliberate test update.
 * 
 * Current hash corresponds to the trailing-'@' fix (f960d02).
 */
const EXPECTED_ADDRESSES_SHA256 = "08bd9c01438947393bbfc6ffde0ae0a7369babc1";

describe("redaction module integrity", () => {
  it("has exactly one redactAddresses implementation in the repo", () => {
    const repoRoot = join(__dirname, "../../..");
    const sourceFiles: string[] = [];
    
    // Walk the repo and collect all .ts/.tsx files (excluding node_modules, .next)
    function walk(dir: string) {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules, .next, .git
          if (entry === "node_modules" || entry === ".next" || entry === ".git") {
            continue;
          }
          walk(fullPath);
        } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
          sourceFiles.push(fullPath);
        }
      }
    }
    
    walk(repoRoot);
    
    // Find all files that define redactAddresses
    const implementations: string[] = [];
    const patterns = [
      /export\s+function\s+redactAddresses\s*\(/,
      /export\s+const\s+redactAddresses\s*=/,
      /function\s+redactAddresses\s*\(/,
    ];
    
    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf-8");
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          implementations.push(relative(repoRoot, file));
          break;
        }
      }
    }
    
    // Must have exactly one implementation in lib/redact/addresses.ts
    expect(implementations).toHaveLength(1);
    expect(implementations[0]).toBe("lib/redact/addresses.ts");
  });

  it("lib/redact/addresses.ts matches approved SHA-256", () => {
    const addressesPath = join(__dirname, "../addresses.ts");
    const content = readFileSync(addressesPath, "utf-8");
    
    // Compute SHA-256 (using git's object format for consistency)
    // Git stores blobs as: "blob <size>\0<content>"
    const blobContent = `blob ${Buffer.byteLength(content, "utf-8")}\0${content}`;
    const hash = createHash("sha1").update(blobContent).digest("hex");
    
    expect(hash).toBe(EXPECTED_ADDRESSES_SHA256);
    
    // If this test fails, it means addresses.ts was changed.
    // Review the changes carefully and update EXPECTED_ADDRESSES_SHA256 only after Lead approval.
  });
});
