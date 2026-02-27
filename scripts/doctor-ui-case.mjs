#!/usr/bin/env node
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let exitCode = 0;

async function check() {
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
    console.error('\\n❌ CASE-DUPLICATE FILES:');
    duplicates.forEach(([a, b]) => console.error(`   ${a} <-> ${b}`));
    exitCode = 1;
  } else {
    console.log('✅ No case duplicates');
  }
}

check().then(() => process.exit(exitCode)).catch(err => {
  console.error(err);
  process.exit(1);
});
