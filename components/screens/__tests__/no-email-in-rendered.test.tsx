/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Email redaction in screen components', () => {
  it('command-center component has no raw email addresses in source', () => {
    const filePath = join(process.cwd(), 'components', 'screens', 'command-center.tsx');
    const content = readFileSync(filePath, 'utf-8');
    
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailPattern);
    
    expect(matches).toBeNull();
  });

  it('project-actions component has no raw email addresses in source', () => {
    const filePath = join(process.cwd(), 'components', 'screens', 'project-actions.tsx');
    const content = readFileSync(filePath, 'utf-8');
    
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailPattern);
    
    expect(matches).toBeNull();
  });

  it('ask-sitetech component has no raw email addresses in source', () => {
    const filePath = join(process.cwd(), 'components', 'screens', 'ask-sitetech.tsx');
    const content = readFileSync(filePath, 'utf-8');
    
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailPattern);
    
    expect(matches).toBeNull();
  });

  it('app-shell component has no raw email addresses in source', () => {
    const filePath = join(process.cwd(), 'components', 'shell', 'app-shell.tsx');
    const content = readFileSync(filePath, 'utf-8');
    
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailPattern);
    
    expect(matches).toBeNull();
  });
});
