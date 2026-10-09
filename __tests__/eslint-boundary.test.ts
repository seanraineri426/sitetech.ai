/**
 * ESLint boundary enforcement test.
 * 
 * Runs `pnpm lint` on the bypass attempts file via subprocess and verifies errors.
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
      execSync(`pnpm eslint --no-ignore ${bypassFile}`, { 
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
    
    // Expected errors on these lines
    const expectedErrorLines = [
      12,  // static import
      15,  // relative static import  
      18,  // deep relative import
      21,  // wildcard import
      24,  // type-only import
      28,  // dynamic import with string literal
      35,  // dynamic import with template literal
      41,  // require() with string literal
      48,  // require() with template literal
      53,  // relative import via alias
    ];
    
    // Verify errors reported on expected lines
    for (const line of expectedErrorLines) {
      const lineError = new RegExp(`${line}:\\d+\\s+error`, 'i');
      expect(output, `Expected error on line ${line}`).toMatch(lineError);
    }
    
    // Check key error messages present
    expect(output).toContain('brief-reference');
    expect(output).toContain('template literal');
  });
});
