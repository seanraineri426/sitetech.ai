/**
 * ESLint boundary enforcement test.
 * 
 * Runs eslint on the bypass attempts file via subprocess and verifies errors.
 * 
 * Asserts exact rule IDs and error counts to catch boundary regressions.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

describe('ESLint architectural boundary', () => {
  it('catches all brief-reference import bypass attempts', () => {
    const bypassFile = join(__dirname, '../__lint-tests__/lint-boundary-bypass-attempts.ts');
    
    let output = '';
    let exitCode = 0;
    try {
      // Use --no-ignore to lint the file despite being in globalIgnores
      execSync(`./node_modules/.bin/eslint --no-ignore ${bypassFile}`, { 
        cwd: join(__dirname, '..'),
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch (error) {
      const execError = error as { stdout: string; stderr: string; status: number };
      output = execError.stdout + execError.stderr;
      exitCode = execError.status;
    }
    
    // Should fail (exit code 1)
    expect(exitCode).toBe(1);
    
    // Expected errors with rule IDs for brief-reference boundary violations
    const expectedErrors = [
      { line: 12, rule: 'no-restricted-imports', message: 'tools/brief-reference' },
      { line: 15, rule: 'no-restricted-imports', message: 'tools/brief-reference' },
      { line: 18, rule: 'no-restricted-imports', message: 'tools/brief-reference' },
      { line: 21, rule: 'no-restricted-imports', message: 'tools/brief-reference' },
      { line: 24, rule: 'no-restricted-imports', message: 'tools/brief-reference' },
      { line: 28, rule: 'no-restricted-syntax', message: 'Dynamic import() with string literal from tools/brief-reference/' },
      { line: 35, rule: 'no-restricted-syntax', message: 'Dynamic import() with template literal' },
      { line: 35, rule: 'no-restricted-syntax', message: 'Dynamic import() must use string literals only' },
      { line: 41, rule: 'no-restricted-syntax', message: 'require() with string literal from tools/brief-reference/' },
      { line: 48, rule: 'no-restricted-syntax', message: 'require() with template literal' },
      { line: 48, rule: 'no-restricted-syntax', message: 'require() must use string literals only' },
      { line: 53, rule: 'no-restricted-imports', message: 'tools/brief-reference' },
    ];
    
    // Verify each expected error is present with correct rule ID and message
    for (const { line, rule, message } of expectedErrors) {
      const lineErrorPattern = new RegExp(`${line}:\\d+\\s+error.*${rule}`, 'i');
      expect(output, `Expected ${rule} error on line ${line}`).toMatch(lineErrorPattern);
      expect(output, `Expected message "${message}" on line ${line}`).toContain(message);
    }
    
    // Assert exact error count for brief-reference boundary rules
    const noRestrictedImportsCount = (output.match(/no-restricted-imports/g) || []).length;
    const noRestrictedSyntaxCount = (output.match(/no-restricted-syntax/g) || []).length;
    
    expect(noRestrictedImportsCount, 'no-restricted-imports violations').toBe(6);
    expect(noRestrictedSyntaxCount, 'no-restricted-syntax violations').toBe(6);
    
    // Verify total error count (18 errors from reviewer measurement)
    const errorMatch = output.match(/(\d+)\s+errors?,\s+(\d+)\s+warnings?/);
    expect(errorMatch).toBeTruthy();
    expect(parseInt(errorMatch![1]), 'total error count').toBe(18);
  });
});
