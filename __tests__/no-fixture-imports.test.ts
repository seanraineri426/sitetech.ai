import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, normalize, sep } from 'path';

function getAllFilesRecursive(dir: string, fileList: string[] = []): string[] {
  if (!existsSync(dir)) {
    return fileList;
  }
  
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      if (file === 'node_modules' || file === '.next' || file === 'tests') {
        return;
      }
      getAllFilesRecursive(filePath, fileList);
    } else if (
      file.endsWith('.tsx') ||
      file.endsWith('.ts') ||
      file.endsWith('.jsx') ||
      file.endsWith('.js') ||
<<<<<<< HEAD
      file.endsWith('.mjs') ||
      file.endsWith('.cjs') ||
      file.endsWith('.mts') ||
      file.endsWith('.cts')
=======
      file.endsWith('.mjs')
>>>>>>> 8c5fb55 (wip: implement review feedback (partial))
    ) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function normalizePathSeparators(path: string): string {
  return normalize(path).replace(/\/\/+/g, sep).replace(/\/\.\//g, sep);
}

describe('Fixture import restrictions', () => {
  it('no production code imports from tests/fixtures', () => {
    const rootDir = process.cwd();
    const allFiles = getAllFilesRecursive(rootDir);
    
    const productionFiles = allFiles.filter((file) => {
      const relativePath = normalizePathSeparators(file.replace(rootDir + sep, ''));
      
      if (relativePath.includes('__tests__')) {
        return false;
      }
      
      const isDevFile = /app[/\\]\(dev\)[/\\].*\.dev\.(tsx|ts|jsx|js|mjs|cjs|mts|cts)$/.test(relativePath);
      return !isDevFile;
    });
    
<<<<<<< HEAD
=======
    if (existsSync(proxyFile)) {
      allFiles.push(proxyFile);
    }
    
    const productionFiles = allFiles.filter(
      (file) => !file.endsWith('.dev.tsx') && !file.endsWith('.dev.ts') && !file.includes('/__tests__/')
    );
    
>>>>>>> 8c5fb55 (wip: implement review feedback (partial))
    const violations: string[] = [];
    const fixturePattern = /['"`](?:@\/|(?:\.\.?\/)+)tests\/fixtures/;

    productionFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      
      if (fixturePattern.test(content)) {
        violations.push(file);
      }
    });

    if (violations.length > 0) {
      const relativePaths = violations.map((f) => normalizePathSeparators(f.replace(rootDir + sep, '')));
      expect.fail(
        `The following production files import from tests/fixtures:\n${relativePaths.join('\n')}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
