/**
 * Javari Autonomous System - Quick Start Example
 * Shows how to use all components together
 * 
 * November 20, 2025, 2:50 PM EST
 */

import { createJavariOrchestrator } from './lib/orchestrator';

/**
 * Example 1: Build a complete app from scratch
 */
async function example1_buildCompleteApp() {
  console.log('Example 1: Building a complete app autonomously\n');

  const javari = await createJavariOrchestrator();

  const result = await javari.buildApp({
    appName: 'Task Manager Pro',
    description: 'A professional task management application with team collaboration',
    features: [
      'User authentication and profiles',
      'Create, edit, delete tasks',
      'Task categories and tags',
      'Team collaboration and sharing',
      'Real-time updates',
      'Mobile responsive design',
      'Dark mode support',
    ],
    tech: {
      framework: 'nextjs',
      database: 'supabase',
      styling: 'tailwind',
      auth: true,
      payments: false,
    },
    deployment: {
      autoPreview: true,
      autoProduction: false, // Manual production promotion
    },
  });

  console.log('Build Result:', {
    success: result.success,
    repoUrl: result.repoUrl,
    previewUrl: result.previewUrl,
    duration: `${(result.duration / 1000).toFixed(0)}s`,
    filesGenerated: result.logs.filter((log) => log.includes('Committed:')).length,
  });

  // Check health status
  const health = await javari.getHealthStatus();
  console.log('\nSystem Health:', health.overallStatus);

  return result;
}

/**
 * Example 2: Update an existing app
 */
async function example2_updateExistingApp() {
  console.log('\nExample 2: Updating an existing app\n');

  const javari = await createJavariOrchestrator();

  const result = await javari.updateApp({
    repoName: 'task-manager-pro',
    changes: 'Add a calendar view to show tasks by due date',
    autoDeploy: true,
  });

  console.log('Update Result:', {
    success: result.success,
    previewUrl: result.previewUrl,
    duration: `${(result.duration / 1000).toFixed(0)}s`,
  });

  return result;
}

/**
 * Example 3: Monitor system health and view repairs
 */
async function example3_monitorHealth() {
  console.log('\nExample 3: Monitoring system health\n');

  const javari = await createJavariOrchestrator();

  // Get current health status
  const health = await javari.getHealthStatus();
  console.log('Current Health Status:');
  console.log('  Overall:', health.overallStatus);
  console.log('  Deployment:', health.checks.deployment.status);
  console.log('  Build:', health.checks.build.status);
  console.log('  Runtime:', health.checks.runtime.status);
  console.log('  API:', health.checks.api.status);

  // Get repair history
  const repairs = javari.getRepairHistory();
  console.log(`\nRecent Repairs: ${repairs.length}`);

  repairs.slice(0, 5).forEach((repair, i) => {
    console.log(`\n${i + 1}. Error: ${repair.errorId}`);
    console.log(`   Success: ${repair.success ? '✅' : '❌'}`);
    console.log(`   Duration: ${(repair.duration / 1000).toFixed(0)}s`);
    console.log(`   Actions: ${repair.actions.length}`);
  });

  return { health, repairs };
}

/**
 * Example 4: Build multiple apps in parallel
 */
async function example4_buildMultipleApps() {
  console.log('\nExample 4: Building multiple apps in parallel\n');

  const javari = await createJavariOrchestrator();

  const apps = [
    {
      appName: 'Blog Platform',
      description: 'A modern blogging platform with markdown support',
      features: ['markdown editor', 'comments', 'categories', 'SEO'],
      tech: {
        framework: 'nextjs' as const,
        database: 'supabase' as const,
        styling: 'tailwind' as const,
        auth: true,
        payments: false,
      },
      deployment: { autoPreview: true, autoProduction: false },
    },
    {
      appName: 'E-commerce Store',
      description: 'Complete online store with shopping cart',
      features: ['product catalog', 'cart', 'checkout', 'inventory'],
      tech: {
        framework: 'nextjs' as const,
        database: 'supabase' as const,
        styling: 'tailwind' as const,
        auth: true,
        payments: true,
      },
      deployment: { autoPreview: true, autoProduction: false },
    },
    {
      appName: 'Analytics Dashboard',
      description: 'Real-time analytics and reporting dashboard',
      features: ['charts', 'reports', 'export', 'filters'],
      tech: {
        framework: 'nextjs' as const,
        database: 'supabase' as const,
        styling: 'tailwind' as const,
        auth: true,
        payments: false,
      },
      deployment: { autoPreview: true, autoProduction: false },
    },
  ];

  console.log(`Building ${apps.length} apps in parallel...\n`);

  const results = await Promise.all(apps.map((app) => javari.buildApp(app)));

  console.log('Results:');
  results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${apps[i].appName}`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(0)}s`);
    console.log(`   URL: ${result.previewUrl}`);
  });

  return results;
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('='.repeat(60));
  console.log('JAVARI AUTONOMOUS SYSTEM - EXAMPLES');
  console.log('='.repeat(60));

  try {
    // Example 1: Build complete app
    await example1_buildCompleteApp();

    // Wait a bit between examples
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Example 2: Update app
    await example2_updateExistingApp();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Example 3: Monitor health
    await example3_monitorHealth();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Example 4: Build multiple apps
    await example4_buildMultipleApps();

    console.log('\n' + '='.repeat(60));
    console.log('ALL EXAMPLES COMPLETE ✅');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

// Export for use in other files
export {
  example1_buildCompleteApp,
  example2_updateExistingApp,
  example3_monitorHealth,
  example4_buildMultipleApps,
  runAllExamples,
};
