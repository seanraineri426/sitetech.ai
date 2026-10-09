import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

function getAllFilesRecursive(dir: string, fileList: string[] = []): string[] {
  if (!existsSync(dir)) {
    return fileList;
  }
  
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
  it('no production code imports from tests/fixtures', () => {
    const dirs = ['app', 'components', 'lib'];
    const proxyFile = join(process.cwd(), 'proxy.ts');
    
    let allFiles: string[] = [];
    
    dirs.forEach((dir) => {
      const fullDir = join(process.cwd(), dir);
      allFiles = allFiles.concat(getAllFilesRecursive(fullDir));
    });
    
    if (existsSync(proxyFile)) {
      allFiles.push(proxyFile);
    }
    
    const productionFiles = allFiles.filter((file) => !file.includes('/(dev)/') && !file.includes('/__tests__/'));
    
    const violations: string[] = [];

    productionFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const fromPattern = /from\s+['"]@?\/tests\/fixtures/;
      const relativeFromPattern = /from\s+['"]\.\.?\/.*tests\/fixtures/;
      const importPattern = /import\(\s*['"]@?\/tests\/fixtures/;
      const relativeImportPattern = /import\(\s*['"]\.\.?\/.*tests\/fixtures/;
      const requirePattern = /require\(\s*['"]@?\/tests\/fixtures/;
      const relativeRequirePattern = /require\(\s*['"]\.\.?\/.*tests\/fixtures/;
      
      if (
        fromPattern.test(content) || 
        relativeFromPattern.test(content) ||
        importPattern.test(content) ||
        relativeImportPattern.test(content) ||
        requirePattern.test(content) ||
        relativeRequirePattern.test(content)
      ) {
        violations.push(file);
      }
    });

    if (violations.length > 0) {
      const relativePaths = violations.map((f) => f.replace(process.cwd() + '/', ''));
      expect.fail(
        `The following production files import from tests/fixtures:\n${relativePaths.join('\n')}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
