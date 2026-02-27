#!/usr/bin/env node
/**
 * Doctor Script: UI Component Case Normalization Checker
 * 
 * Ensures:
 * 1. No case-duplicate files in components/ui/
 * 2. No uppercase UI imports in app/ or components/
 * 
 * Exits non-zero if violations found.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let exitCode = 0;

// Check for case-duplicate files in components/ui
async function checkCaseDuplicates() {
  const uiDir = join(rootDir, 'components', 'ui');
  const files = await readdir(uiDir);
  
  const seen = new Map();
  const duplicates = [];
  
  for (const file of files) {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
    const lower = file.toLowerCase();
    if (seen.has(lower) && seen.get(lower) !== file) {
      duplicates.push([seen.get(lower), file]);
    }
    seen.set(lower, file);
  }
  
  if (duplicates.length > 0) {
    console.error('\n❌ CASE-DUPLICATE UI FILES DETECTED:');
    for (const [file1, file2] of duplicates) {
      console.error(`   - ${file1} <-> ${file2}`);
    }
    console.error('\n   Fix: Delete one of each pair to resolve case conflicts.\n');
    exitCode = 1;
  } else {
    console.log('✅ No case-duplicate UI files');
  }
}

// Check for uppercase UI imports (should use lowercase for shadcn consistency)
async function checkImportCasing() {
  const dirsToScan = ['app', 'components'];
  const badImports = [];
  
  async function scanDir(dir) {
    try {
      const entries = await readdir(join(rootDir, dir), { withFileTypes: true });
      
      for (const entry of entries) {
        const path = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDir(path);
        } else if (entry.name.match(/\.(tsx?|jsx?)$/)) {
          const content = await readFile(join(rootDir, path), 'utf-8');
          
          // Check for uppercase UI component imports
          // Pattern: @/components/ui/Badge, @/components/ui/Button, @/components/ui/Card
          const upperCaseImports = content.match(/@\/components\/ui\/[A-Z][a-zA-Z]+/g);
          
          if (upperCaseImports) {
            badImports.push({ file: path, imports: [...new Set(upperCaseImports)] });
          }
        }
      }
    } catch (err) {
      // Directory might not exist, skip
    }
  }
  
  for (const dir of dirsToScan) {
    await scanDir(dir);
  }
  
  if (badImports.length > 0) {
    console.error('\n❌ UPPERCASE UI IMPORTS DETECTED:');
    for (const { file, imports } of badImports) {
      console.error(`   ${file}:`);
      for (const imp of imports) {
        console.error(`     - ${imp}`);
      }
    }
    console.error('\n   Fix: Use lowercase imports (e.g., @/components/ui/badge)\n');
    exitCode = 1;
  } else {
    console.log('✅ No uppercase UI imports');
  }
}

async function main() {
  console.log('🔍 Running UI Component Doctor...\n');
  
  await checkCaseDuplicates();
  await checkImportCasing();
  
  if (exitCode === 0) {
    console.log('\n✅ All checks passed!\n');
  } else {
    console.error('\n❌ Doctor checks failed. Fix the issues above.\n');
  }
  
  process.exit(exitCode);
}

main().catch(err => {
  console.error('Doctor script error:', err);
  process.exit(1);
});
