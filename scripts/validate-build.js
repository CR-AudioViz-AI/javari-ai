#!/usr/bin/env node
/**
 * scripts/validate-build.js
 * Build-time validation script
 * Created: 2026-02-22 03:39 ET
 * 
 * Validates build environment before Next.js build:
 * - Required environment variables
 * - Required directories
 * - Critical imports
 * - Module resolution
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvVars() {
  log('\n🔍 Checking environment variables...', 'blue');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const optionalEnvVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];

  let hasErrors = false;

  // Check required vars
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      log(`  ✗ Missing required: ${varName}`, 'red');
      hasErrors = true;
    } else {
      log(`  ✓ ${varName}`, 'green');
    }
  });

  // Check optional vars (warning only)
  optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      log(`  ⚠ Missing optional: ${varName}`, 'yellow');
    } else {
      log(`  ✓ ${varName}`, 'green');
    }
  });

  return !hasErrors;
}

function checkDirectories() {
  log('\n📁 Checking required directories...', 'blue');
  
  const requiredDirs = [
    'app',
    'components',
    'lib',
    'public',
  ];

  let hasErrors = false;

  requiredDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      log(`  ✗ Missing directory: ${dir}`, 'red');
      hasErrors = true;
    } else {
      log(`  ✓ ${dir}/`, 'green');
    }
  });

  return !hasErrors;
}

function checkCriticalFiles() {
  log('\n📄 Checking critical files...', 'blue');
  
  const criticalFiles = [
    'package.json',
    'next.config.js',
    'tsconfig.json',
    'tailwind.config.ts',
  ];

  let hasErrors = false;

  criticalFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      log(`  ✗ Missing file: ${file}`, 'red');
      hasErrors = true;
    } else {
      log(`  ✓ ${file}`, 'green');
    }
  });

  return !hasErrors;
}

function checkPackageJson() {
  log('\n📦 Checking package.json dependencies...', 'blue');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const criticalPackages = [
      'next',
      'react',
      'react-dom',
      'typescript',
      '@supabase/supabase-js',
    ];

    let hasErrors = false;

    criticalPackages.forEach(pkg => {
      if (!deps[pkg]) {
        log(`  ✗ Missing package: ${pkg}`, 'red');
        hasErrors = true;
      } else {
        log(`  ✓ ${pkg} (${deps[pkg]})`, 'green');
      }
    });

    return !hasErrors;

  } catch (error) {
    log(`  ✗ Error reading package.json: ${error.message}`, 'red');
    return false;
  }
}

function checkApiRoutes() {
  log('\n🔌 Checking API routes for common issues...', 'blue');
  
  const apiDir = path.join(process.cwd(), 'app', 'api');
  
  if (!fs.existsSync(apiDir)) {
    log('  ⚠ No API routes directory found', 'yellow');
    return true;
  }

  let hasWarnings = false;

  // Check for module-level Supabase client creation (common build error)
  function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern: createClient at module level
    if (content.includes('const supabase = createClient(') || 
        content.includes('const supabase=createClient(')) {
      const relativePath = path.relative(process.cwd(), filePath);
      log(`  ⚠ Potential issue in ${relativePath}`, 'yellow');
      log(`    → Supabase client created at module level (may fail during build)`, 'yellow');
      hasWarnings = true;
    }
  }

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        checkFile(filePath);
      }
    });
  }

  try {
    walkDir(apiDir);
    
    if (!hasWarnings) {
      log('  ✓ No obvious issues found', 'green');
    }
  } catch (error) {
    log(`  ✗ Error checking API routes: ${error.message}`, 'red');
    return false;
  }

  return true; // Warnings don't fail build
}

function main() {
  log('\n╔════════════════════════════════════════╗', 'blue');
  log('║   BUILD VALIDATION - JAVARI AI        ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');

  const checks = [
    { name: 'Environment Variables', fn: checkEnvVars },
    { name: 'Directories', fn: checkDirectories },
    { name: 'Critical Files', fn: checkCriticalFiles },
    { name: 'Package Dependencies', fn: checkPackageJson },
    { name: 'API Routes', fn: checkApiRoutes },
  ];

  let allPassed = true;

  checks.forEach(check => {
    const passed = check.fn();
    if (!passed) {
      allPassed = false;
    }
  });

  log('\n' + '═'.repeat(42), 'blue');
  
  if (allPassed) {
    log('✅ BUILD VALIDATION PASSED', 'green');
    log('   Ready to build', 'green');
    process.exit(0);
  } else {
    log('❌ BUILD VALIDATION FAILED', 'red');
    log('   Fix errors above before building', 'red');
    process.exit(1);
  }
}

// Run validation
main();
