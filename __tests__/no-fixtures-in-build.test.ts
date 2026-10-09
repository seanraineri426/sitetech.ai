import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixtureStrings = [
  'Linden Yard',
  'architect@example.com',
  'reviewer@example.com',
  'RFI 112 past due - L3 shaft framing starting Tue 10/13',
  'Submittal S-0042 review needed',
  'test-rfi-1',
];

function* walkDir(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function scanFileForFixtures(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return fixtureStrings.filter(str => content.includes(str));
  } catch {
    return [];
  }
}

describe('build output does not contain fixture data', () => {
  const nextDir = join(process.cwd(), '.next');
  const shouldSkip = !existsSync(nextDir) && !process.env.CI;

  it.skipIf(shouldSkip)('should not find any fixture strings in .next build output', () => {
    if (!existsSync(nextDir)) {
      throw new Error('.next directory does not exist; run `pnpm build` first');
    }

    const matches: Array<{ file: string; found: string[] }> = [];
    for (const file of walkDir(nextDir)) {
      const found = scanFileForFixtures(file);
      if (found.length > 0) {
        matches.push({ file, found });
      }
    }

    if (matches.length > 0) {
      const details = matches
        .map(({ file, found }) => `  ${file}: ${found.join(', ')}`)
        .join('\n');
      throw new Error(`Found fixture strings in .next:\n${details}`);
    }

    expect(matches).toHaveLength(0);
  });
});
