import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function getAllFilesRecursive(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getAllFilesRecursive(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

describe('Fixture import restrictions', () => {
  it('no app file (outside (dev)) imports from tests/fixtures', () => {
    const appDir = join(process.cwd(), 'app');
    const allFiles = getAllFilesRecursive(appDir);
    
    const nonDevFiles = allFiles.filter((file) => !file.includes('/(dev)/'));
    
    const violations: string[] = [];

    nonDevFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const fixtureImportPattern = /from\s+['"]@?\/tests\/fixtures/;
      const relativeFixturePattern = /from\s+['"]\.\.?\/.*tests\/fixtures/;
      
      if (fixtureImportPattern.test(content) || relativeFixturePattern.test(content)) {
        violations.push(file);
      }
    });

    if (violations.length > 0) {
      const relativePaths = violations.map((f) => f.replace(process.cwd() + '/', ''));
      expect.fail(
        `The following app files (outside (dev)) import from tests/fixtures:\n${relativePaths.join('\n')}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
