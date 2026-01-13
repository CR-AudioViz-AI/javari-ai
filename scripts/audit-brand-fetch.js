#!/usr/bin/env node
/**
 * CR AudioViz AI - Web-Fetch Brand Audit Script
 * 
 * @description API-based brand + copy audit (no browser required)
 * @author CR AudioViz AI Engineering
 * @version 1.1.0
 * 
 * Usage:
 *   SITE_URL=https://javariai.com node scripts/audit-brand-fetch.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SITE_URL = process.env.SITE_URL || 'https://javariai.com';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '50', 10);

// Load brand rules
const BRAND_RULES_PATH = path.join(__dirname, '..', 'config', 'brand.rules.json');
let brandRules = {};

try {
  brandRules = JSON.parse(fs.readFileSync(BRAND_RULES_PATH, 'utf-8'));
} catch (err) {
  console.error(`[ERROR] Failed to load brand rules: ${err.message}`);
  process.exit(1);
}

// Output directories
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence/brand-audit');
const REPORT_DIR = path.join(__dirname, '..', 'reports');

[EVIDENCE_DIR, REPORT_DIR].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// =============================================================================
// UTILITIES
// =============================================================================

function timestamp() {
  return new Date().toISOString().split('T')[0];
}

function timestampET() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
}

function fetchPage(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout, headers: { 'User-Agent': 'CRAudioVizAI-BrandAudit/1.1' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location, timeout).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  return match ? match[1].trim() : null;
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  return match ? match[1].trim() : null;
}

function extractH1s(html) {
  const matches = html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi);
  return [...matches].map(m => m[1].trim()).filter(Boolean);
}

function extractLinks(html, baseUrl) {
  const matches = html.matchAll(/href=["']([^"']+)["']/gi);
  const links = new Set();
  const base = new URL(baseUrl);
  
  for (const match of matches) {
    try {
      const link = new URL(match[1], baseUrl);
      if (link.origin === base.origin && !link.pathname.includes('/api/')) {
        link.hash = '';
        links.add(link.href);
      }
    } catch {}
  }
  return [...links];
}

function checkDeprecatedTokens(html, tokens) {
  const found = [];
  for (const token of tokens) {
    if (html.includes(token)) {
      found.push(token);
    }
  }
  return found;
}

function checkElement(html, name) {
  const patterns = {
    header: /<header|role=["']banner["']|<nav/i,
    footer: /<footer|role=["']contentinfo["']/i,
    logo: /logo|Logo/i
  };
  return patterns[name] ? patterns[name].test(html) : false;
}

// =============================================================================
// AUDIT RESULTS
// =============================================================================

const auditResults = {
  metadata: {
    siteUrl: SITE_URL,
    auditDate: new Date().toISOString(),
    auditDateET: timestampET(),
    version: '1.1.0'
  },
  summary: {
    totalPages: 0,
    pagesAudited: 0,
    passedPages: 0,
    failedPages: 0,
    warnings: 0,
    errors: 0,
    deprecatedTokensFound: 0,
    missingMeta: 0,
    duplicateTitles: [],
    duplicateDescriptions: []
  },
  pages: [],
  brandIssues: []
};

// =============================================================================
// MAIN AUDIT
// =============================================================================

async function auditPage(url) {
  const result = {
    url,
    status: null,
    title: null,
    metaDescription: null,
    canonical: null,
    h1s: [],
    brandChecks: {
      headerPresent: false,
      footerPresent: false,
      logoPresent: false,
      deprecatedTokens: []
    },
    copyChecks: {
      titleLength: null,
      titleValid: false,
      descriptionLength: null,
      descriptionValid: false
    },
    errors: [],
    warnings: []
  };

  try {
    console.log(`  Auditing: ${url}`);
    const { status, body } = await fetchPage(url);
    result.status = status;

    if (status !== 200) {
      result.errors.push(`HTTP ${status}`);
      return result;
    }

    // Extract metadata
    result.title = extractTitle(body);
    result.metaDescription = extractMetaDescription(body);
    result.canonical = extractCanonical(body);
    result.h1s = extractH1s(body);

    // Brand checks
    result.brandChecks.headerPresent = checkElement(body, 'header');
    result.brandChecks.footerPresent = checkElement(body, 'footer');
    result.brandChecks.logoPresent = checkElement(body, 'logo');

    // Deprecated tokens
    const deprecated = brandRules.deprecatedTokens?.oldBranding || [];
    result.brandChecks.deprecatedTokens = checkDeprecatedTokens(body, deprecated);
    
    if (result.brandChecks.deprecatedTokens.length > 0) {
      auditResults.summary.deprecatedTokensFound += result.brandChecks.deprecatedTokens.length;
      auditResults.brandIssues.push({
        url,
        tokens: result.brandChecks.deprecatedTokens
      });
      result.warnings.push(`Deprecated tokens: ${result.brandChecks.deprecatedTokens.join(', ')}`);
    }

    // Meta validation
    const metaReqs = brandRules.metaRequirements || {};
    
    if (result.title) {
      result.copyChecks.titleLength = result.title.length;
      result.copyChecks.titleValid = result.title.length >= (metaReqs.titleMinLength || 30) &&
                                      result.title.length <= (metaReqs.titleMaxLength || 60);
      if (!result.copyChecks.titleValid) {
        result.warnings.push(`Title length ${result.title.length} outside range 30-60`);
      }
    } else {
      result.errors.push('Missing title');
      auditResults.summary.missingMeta++;
    }

    if (result.metaDescription) {
      result.copyChecks.descriptionLength = result.metaDescription.length;
      result.copyChecks.descriptionValid = result.metaDescription.length >= (metaReqs.descriptionMinLength || 120) &&
                                            result.metaDescription.length <= (metaReqs.descriptionMaxLength || 160);
      if (!result.copyChecks.descriptionValid) {
        result.warnings.push(`Description length ${result.metaDescription.length} outside range 120-160`);
      }
    } else {
      result.errors.push('Missing meta description');
      auditResults.summary.missingMeta++;
    }

    // Element warnings
    if (!result.brandChecks.headerPresent) result.warnings.push('Header not found');
    if (!result.brandChecks.footerPresent) result.warnings.push('Footer not found');

    // Collect links for crawling
    result.links = extractLinks(body, url);

    // Update summary
    if (result.errors.length > 0) {
      auditResults.summary.failedPages++;
      auditResults.summary.errors += result.errors.length;
    } else {
      auditResults.summary.passedPages++;
    }
    auditResults.summary.warnings += result.warnings.length;

  } catch (err) {
    result.errors.push(`Fetch error: ${err.message}`);
    auditResults.summary.errors++;
    auditResults.summary.failedPages++;
  }

  return result;
}

async function runAudit() {
  console.log('='.repeat(70));
  console.log('CR AudioViz AI - Brand + Copy Audit (Web Fetch)');
  console.log('='.repeat(70));
  console.log(`Site: ${SITE_URL}`);
  console.log(`Started: ${auditResults.metadata.auditDateET}`);
  console.log('='.repeat(70));

  const visited = new Set();
  const queue = [SITE_URL];

  // Add seed URLs
  const seeds = brandRules.crawlConfig?.includePaths || [];
  for (const seed of seeds) {
    try {
      const seedUrl = new URL(seed, SITE_URL).href;
      if (!queue.includes(seedUrl)) queue.push(seedUrl);
    } catch {}
  }

  console.log(`\n[1/2] Auditing pages...`);

  while (queue.length > 0 && auditResults.pages.length < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    const result = await auditPage(url);
    auditResults.pages.push(result);
    auditResults.summary.pagesAudited++;

    // Add discovered links
    if (result.links) {
      for (const link of result.links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
    }
  }

  auditResults.summary.totalPages = visited.size;

  // Check duplicates
  console.log(`\n[2/2] Checking duplicates...`);
  const titleMap = new Map();
  const descMap = new Map();

  for (const pg of auditResults.pages) {
    if (pg.title) {
      if (!titleMap.has(pg.title)) titleMap.set(pg.title, []);
      titleMap.get(pg.title).push(pg.url);
    }
    if (pg.metaDescription) {
      if (!descMap.has(pg.metaDescription)) descMap.set(pg.metaDescription, []);
      descMap.get(pg.metaDescription).push(pg.url);
    }
  }

  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      auditResults.summary.duplicateTitles.push({ title: title.substring(0, 50), urls });
    }
  }

  for (const [desc, urls] of descMap) {
    if (urls.length > 1) {
      auditResults.summary.duplicateDescriptions.push({ description: desc.substring(0, 50), urls });
    }
  }

  // Generate reports
  console.log('\n' + '='.repeat(70));
  console.log('Generating Reports...');

  // JSON
  const jsonPath = path.join(EVIDENCE_DIR, 'brand-audit-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2));
  console.log(`  JSON: ${jsonPath}`);

  // Markdown
  const mdReport = generateMarkdown();
  const mdPath = path.join(REPORT_DIR, `BRAND_AUDIT_REPORT_${timestamp()}.md`);
  fs.writeFileSync(mdPath, mdReport);
  console.log(`  Markdown: ${mdPath}`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Pages Audited: ${auditResults.summary.pagesAudited}`);
  console.log(`Passed: ${auditResults.summary.passedPages}`);
  console.log(`Failed: ${auditResults.summary.failedPages}`);
  console.log(`Warnings: ${auditResults.summary.warnings}`);
  console.log(`Deprecated Tokens: ${auditResults.summary.deprecatedTokensFound}`);
  console.log(`Missing Meta: ${auditResults.summary.missingMeta}`);
  console.log('='.repeat(70));

  const hasIssues = auditResults.summary.failedPages > 0 || auditResults.summary.deprecatedTokensFound > 0;
  process.exit(hasIssues ? 1 : 0);
}

function generateMarkdown() {
  const r = auditResults;
  let md = `# Brand + Copy Audit Report\n\n`;
  md += `**Site:** ${r.metadata.siteUrl}\n`;
  md += `**Date:** ${r.metadata.auditDateET}\n\n`;
  
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Pages Audited | ${r.summary.pagesAudited} |\n`;
  md += `| ✅ Passed | ${r.summary.passedPages} |\n`;
  md += `| ❌ Failed | ${r.summary.failedPages} |\n`;
  md += `| ⚠️ Warnings | ${r.summary.warnings} |\n`;
  md += `| 🏷️ Deprecated Tokens | ${r.summary.deprecatedTokensFound} |\n`;
  md += `| 📝 Missing Meta | ${r.summary.missingMeta} |\n\n`;

  if (r.brandIssues.length > 0) {
    md += `## Brand Issues\n\n`;
    for (const issue of r.brandIssues) {
      md += `- **${issue.url}**: \`${issue.tokens.join('`, `')}\`\n`;
    }
    md += '\n';
  }

  if (r.summary.duplicateTitles.length > 0) {
    md += `## Duplicate Titles\n\n`;
    for (const dup of r.summary.duplicateTitles) {
      md += `- "${dup.title}..." (${dup.urls.length} pages)\n`;
    }
    md += '\n';
  }

  md += `## Page Details\n\n`;
  for (const pg of r.pages.slice(0, 20)) {
    const status = pg.errors.length > 0 ? '❌' : pg.warnings.length > 0 ? '⚠️' : '✅';
    md += `### ${status} ${pg.url}\n\n`;
    md += `- **Title:** ${pg.title || 'MISSING'} (${pg.copyChecks.titleLength || 0} chars)\n`;
    md += `- **Description:** ${pg.metaDescription ? pg.metaDescription.substring(0, 60) + '...' : 'MISSING'}\n`;
    if (pg.errors.length) md += `- **Errors:** ${pg.errors.join(', ')}\n`;
    if (pg.warnings.length) md += `- **Warnings:** ${pg.warnings.join(', ')}\n`;
    md += '\n';
  }

  md += `---\n*Generated by CR AudioViz AI Brand Audit v1.1.0*\n`;
  return md;
}

runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
