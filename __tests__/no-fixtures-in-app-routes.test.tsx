import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('App routes have no fixture data', () => {
  it('main app page has no fixture strings in source', () => {
    const appPagePath = join(process.cwd(), 'app', 'page.tsx');
    const content = readFileSync(appPagePath, 'utf-8');

    expect(content).not.toContain('Linden Yard');
    expect(content).not.toContain('Harbor Point');
    expect(content).not.toContain('Elm Street');
    expect(content).not.toContain('Example Builders');
    expect(content).not.toContain('ABC Architecture');
  });
});
