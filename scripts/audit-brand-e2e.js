#!/usr/bin/env node
/**
 * CR AudioViz AI - Automated Brand + Copy + Flow Audit Script
 * 
 * @description Full E2E audit: crawl, brand consistency, screenshots, user flows
 * @author CR AudioViz AI Engineering
 * @version 1.0.0
 * @license Proprietary
 * 
 * Usage:
 *   SITE_URL=https://craudiovizai.com node scripts/audit-brand-e2e.js
 *   
 * Environment Variables:
 *   SITE_URL          - Base URL to audit (required)
 *   TEST_USER_EMAIL   - Test user email for login flow (optional)
 *   TEST_USER_PASS    - Test user password for login flow (optional, redacted in logs)
 *   MAX_DEPTH         - Crawl depth (default: 3)
 *   MAX_PAGES         - Max pages to audit (default: 100)
 *   CI                - Set to 'true' for CI mode (no interactive prompts)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SITE_URL = process.env.SITE_URL || 'https://craudiovizai.com';
const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '3', 10);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '100', 10);
const CI_MODE = process.env.CI === 'true';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_USER_PASS = process.env.TEST_USER_PASS || '';

// Load brand rules
const BRAND_RULES_PATH = path.join(__dirname, '..', 'config', 'brand.rules.json');
let brandRules = {};

try {
  brandRules = JSON.parse(fs.readFileSync(BRAND_RULES_PATH, 'utf-8'));
} catch (err) {
  console.error(`[ERROR] Failed to load brand rules from ${BRAND_RULES_PATH}`);
  console.error(err.message);
  process.exit(1);
}

// Output directories
const EVIDENCE_DIR = path.join(__dirname, '..', brandRules.reporting?.outputDir || 'evidence/brand-audit');
const SCREENSHOT_DIR = path.join(__dirname, '..', brandRules.reporting?.screenshotDir || 'evidence/brand-audit/screenshots');
const REPORT_DIR = path.join(__dirname, '..', brandRules.reporting?.reportDir || 'reports');

// Ensure directories exist
[EVIDENCE_DIR, SCREENSHOT_DIR, REPORT_DIR].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Redact sensitive data from strings (tokens, passwords, etc.)
 */
function redact(str) {
  if (!str) return '';
  if (str.length <= 8) return '****';
  return str.substring(0, 4) + '****' + str.substring(str.length - 4);
}

/**
 * Generate timestamp for reports
 */
function timestamp() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate full timestamp with time
 */
function fullTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Sanitize URL for filename
 */
function urlToFilename(url) {
  try {
    const parsed = new URL(url);
    const pathPart = parsed.pathname.replace(/\//g, '_').replace(/^_/, '') || 'index';
    return pathPart.substring(0, 50).replace(/[^a-zA-Z0-9_-]/g, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Fetch URL content (for sitemap)
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Parse sitemap.xml for URLs
 */
function parseSitemap(xml) {
  const urls = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

/**
 * Check if URL should be excluded
 */
function shouldExclude(url, baseUrl) {
  try {
    const parsed = new URL(url);
    const baseParsed = new URL(baseUrl);
    
    // Must be same origin
    if (parsed.origin !== baseParsed.origin) return true;
    
    // Check exclude patterns
    const excludePatterns = brandRules.crawlConfig?.excludePatterns || [];
    for (const pattern of excludePatterns) {
      if (parsed.pathname.includes(pattern) || parsed.href.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return true;
  }
}

/**
 * Normalize URL (remove hash, trailing slash consistency)
 */
function normalizeUrl(url, baseUrl) {
  try {
    const parsed = new URL(url, baseUrl);
    parsed.hash = '';
    // Remove trailing slash for consistency (except root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return null;
  }
}

// =============================================================================
// AUDIT RESULT STRUCTURE
// =============================================================================

const auditResults = {
  metadata: {
    siteUrl: SITE_URL,
    auditDate: new Date().toISOString(),
    auditDateET: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
    maxDepth: MAX_DEPTH,
    maxPages: MAX_PAGES,
    brandRulesVersion: '1.0.0'
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
    duplicateDescriptions: [],
    e2eFlowsPassed: 0,
    e2eFlowsFailed: 0
  },
  pages: [],
  brandIssues: [],
  copyIssues: [],
  e2eResults: [],
  screenshots: []
};

// =============================================================================
// PAGE AUDIT FUNCTIONS
// =============================================================================

/**
 * Audit a single page for brand consistency and copy
 */
async function auditPage(page, url, depth) {
  const pageResult = {
    url: url,
    depth: depth,
    timestamp: new Date().toISOString(),
    status: null,
    title: null,
    canonical: null,
    metaDescription: null,
    h1: [],
    navLabels: [],
    heroText: null,
    brandChecks: {
      headerPresent: false,
      footerPresent: false,
      logoPresent: false,
      deprecatedTokens: [],
      requiredTokensMissing: []
    },
    copyChecks: {
      titleLength: null,
      titleValid: false,
      descriptionLength: null,
      descriptionValid: false,
      duplicateTitle: false,
      duplicateDescription: false
    },
    errors: [],
    warnings: [],
    screenshots: {
      desktop: null,
      mobile: null
    },
    links: []
  };

  try {
    // Navigate to page
    const response = await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: brandRules.crawlConfig?.timeout || 30000 
    });
    
    pageResult.status = response?.status() || 0;

    // Skip non-200 pages for detailed audit
    if (pageResult.status !== 200) {
      pageResult.errors.push(`HTTP ${pageResult.status}`);
      return pageResult;
    }

    // Wait for page to be fully rendered
    await page.waitForLoadState('domcontentloaded');
    
    // Extract page metadata
    pageResult.title = await page.title();
    pageResult.canonical = await page.$eval('link[rel="canonical"]', el => el.href).catch(() => null);
    pageResult.metaDescription = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);

    // Extract H1s
    pageResult.h1 = await page.$$eval('h1', els => els.map(el => el.textContent?.trim()).filter(Boolean));

    // Extract nav labels
    pageResult.navLabels = await page.$$eval('nav a, header a, [role="navigation"] a', 
      els => els.map(el => el.textContent?.trim()).filter(Boolean).slice(0, 20)
    );

    // Extract hero text (first large heading or hero section)
    pageResult.heroText = await page.$eval(
      '[class*="hero"] h1, [class*="hero"] h2, [class*="Hero"] h1, main > section:first-child h1, .hero-title',
      el => el.textContent?.trim()
    ).catch(() => null);

    // =========================================================================
    // BRAND CHECKS
    // =========================================================================

    // Check header presence
    const headerSelectors = brandRules.requiredElements?.header?.selector || 'header';
    pageResult.brandChecks.headerPresent = await page.$(headerSelectors).then(el => !!el);

    // Check footer presence
    const footerSelectors = brandRules.requiredElements?.footer?.selector || 'footer';
    pageResult.brandChecks.footerPresent = await page.$(footerSelectors).then(el => !!el);

    // Check logo presence
    const logoSelectors = brandRules.requiredElements?.logo?.selector || 'img[alt*="logo"]';
    pageResult.brandChecks.logoPresent = await page.$(logoSelectors).then(el => !!el);

    // Get full page text for token checking
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const pageHtml = await page.content();

    // Check for deprecated tokens
    const deprecatedTokens = brandRules.deprecatedTokens?.oldBranding || [];
    for (const token of deprecatedTokens) {
      if (pageText.includes(token) || pageHtml.includes(token)) {
        pageResult.brandChecks.deprecatedTokens.push(token);
        auditResults.summary.deprecatedTokensFound++;
        pageResult.warnings.push(`Deprecated token found: "${token}"`);
      }
    }

    // Add brand issues to global list
    if (pageResult.brandChecks.deprecatedTokens.length > 0) {
      auditResults.brandIssues.push({
        url: url,
        issue: 'deprecated_tokens',
        tokens: pageResult.brandChecks.deprecatedTokens
      });
    }

    if (!pageResult.brandChecks.headerPresent) {
      pageResult.warnings.push('Header element not found');
    }
    if (!pageResult.brandChecks.footerPresent) {
      pageResult.warnings.push('Footer element not found');
    }
    if (!pageResult.brandChecks.logoPresent) {
      pageResult.warnings.push('Logo element not found');
    }

    // =========================================================================
    // COPY/META CHECKS
    // =========================================================================

    const metaReqs = brandRules.metaRequirements || {};
    
    // Title validation
    if (pageResult.title) {
      pageResult.copyChecks.titleLength = pageResult.title.length;
      pageResult.copyChecks.titleValid = 
        pageResult.title.length >= (metaReqs.titleMinLength || 30) &&
        pageResult.title.length <= (metaReqs.titleMaxLength || 60);
      
      if (!pageResult.copyChecks.titleValid) {
        pageResult.warnings.push(`Title length (${pageResult.title.length}) outside recommended range (${metaReqs.titleMinLength || 30}-${metaReqs.titleMaxLength || 60})`);
      }
    } else {
      pageResult.errors.push('Missing page title');
      auditResults.summary.missingMeta++;
    }

    // Description validation
    if (pageResult.metaDescription) {
      pageResult.copyChecks.descriptionLength = pageResult.metaDescription.length;
      pageResult.copyChecks.descriptionValid = 
        pageResult.metaDescription.length >= (metaReqs.descriptionMinLength || 120) &&
        pageResult.metaDescription.length <= (metaReqs.descriptionMaxLength || 160);
      
      if (!pageResult.copyChecks.descriptionValid) {
        pageResult.warnings.push(`Meta description length (${pageResult.metaDescription.length}) outside recommended range (${metaReqs.descriptionMinLength || 120}-${metaReqs.descriptionMaxLength || 160})`);
      }
    } else {
      pageResult.errors.push('Missing meta description');
      auditResults.summary.missingMeta++;
    }

    // =========================================================================
    // SCREENSHOTS
    // =========================================================================

    const filename = urlToFilename(url);
    const viewports = brandRules.crawlConfig?.viewports || {
      desktop: { width: 1920, height: 1080 },
      mobile: { width: 390, height: 844 }
    };

    // Desktop screenshot
    await page.setViewportSize(viewports.desktop);
    await page.waitForTimeout(500); // Allow reflow
    const desktopPath = path.join(SCREENSHOT_DIR, `${filename}_desktop_${fullTimestamp()}.png`);
    await page.screenshot({ path: desktopPath, fullPage: false });
    pageResult.screenshots.desktop = path.relative(path.join(__dirname, '..'), desktopPath);
    auditResults.screenshots.push({ url, type: 'desktop', path: pageResult.screenshots.desktop });

    // Mobile screenshot
    await page.setViewportSize(viewports.mobile);
    await page.waitForTimeout(500);
    const mobilePath = path.join(SCREENSHOT_DIR, `${filename}_mobile_${fullTimestamp()}.png`);
    await page.screenshot({ path: mobilePath, fullPage: false });
    pageResult.screenshots.mobile = path.relative(path.join(__dirname, '..'), mobilePath);
    auditResults.screenshots.push({ url, type: 'mobile', path: pageResult.screenshots.mobile });

    // Reset viewport
    await page.setViewportSize(viewports.desktop);

    // =========================================================================
    // EXTRACT LINKS FOR CRAWLING
    // =========================================================================

    if (depth < MAX_DEPTH) {
      const links = await page.$$eval('a[href]', els => els.map(el => el.href));
      pageResult.links = links
        .map(link => normalizeUrl(link, SITE_URL))
        .filter(link => link && !shouldExclude(link, SITE_URL));
    }

    // Update summary
    if (pageResult.errors.length > 0) {
      auditResults.summary.failedPages++;
      auditResults.summary.errors += pageResult.errors.length;
    } else {
      auditResults.summary.passedPages++;
    }
    auditResults.summary.warnings += pageResult.warnings.length;

  } catch (err) {
    pageResult.errors.push(`Audit error: ${err.message}`);
    auditResults.summary.errors++;
    auditResults.summary.failedPages++;
  }

  return pageResult;
}

// =============================================================================
// E2E FLOW TESTS
// =============================================================================

/**
 * Run E2E login flow test
 */
async function testLoginFlow(page, context) {
  const flowResult = {
    name: 'login',
    status: 'skipped',
    steps: [],
    errors: [],
    duration: 0
  };

  const loginConfig = brandRules.e2eFlows?.login;
  if (!loginConfig) {
    flowResult.errors.push('No login flow configuration found');
    return flowResult;
  }

  const startTime = Date.now();

  try {
    // Step 1: Navigate to login page
    const loginUrl = new URL(loginConfig.path, SITE_URL).href;
    flowResult.steps.push({ step: 'navigate', url: loginUrl, status: 'pending' });
    
    const response = await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    if (response?.status() !== 200) {
      flowResult.steps[0].status = 'failed';
      flowResult.errors.push(`Login page returned HTTP ${response?.status()}`);
      flowResult.status = 'failed';
      return flowResult;
    }
    flowResult.steps[0].status = 'passed';

    // Step 2: Check for login form elements
    flowResult.steps.push({ step: 'check_form', status: 'pending' });
    
    const emailSelector = loginConfig.elements?.emailInput || 'input[type="email"]';
    const passSelector = loginConfig.elements?.passwordInput || 'input[type="password"]';
    const submitSelector = loginConfig.elements?.submitButton || 'button[type="submit"]';

    const emailInput = await page.$(emailSelector);
    const passInput = await page.$(passSelector);
    const submitBtn = await page.$(submitSelector);

    if (!emailInput || !passInput || !submitBtn) {
      flowResult.steps[1].status = 'failed';
      flowResult.errors.push('Login form elements not found');
      flowResult.status = 'failed';
      return flowResult;
    }
    flowResult.steps[1].status = 'passed';

    // Step 3: Attempt login if credentials provided
    if (TEST_USER_EMAIL && TEST_USER_PASS) {
      flowResult.steps.push({ step: 'login_attempt', status: 'pending', email: redact(TEST_USER_EMAIL) });
      
      await emailInput.fill(TEST_USER_EMAIL);
      await passInput.fill(TEST_USER_PASS);
      await submitBtn.click();
      
      // Wait for navigation or error
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      const expectedRedirect = loginConfig.successRedirect || '/dashboard';
      
      if (currentUrl.includes(expectedRedirect)) {
        flowResult.steps[2].status = 'passed';
        flowResult.steps.push({ step: 'redirect_check', expected: expectedRedirect, actual: currentUrl, status: 'passed' });
        
        // Step 4: Check session persistence
        flowResult.steps.push({ step: 'session_check', status: 'pending' });
        
        // Refresh page and check if still logged in
        await page.reload({ waitUntil: 'networkidle' });
        const afterRefreshUrl = page.url();
        
        if (afterRefreshUrl.includes(expectedRedirect) || !afterRefreshUrl.includes('/login')) {
          flowResult.steps[4].status = 'passed';
        } else {
          flowResult.steps[4].status = 'failed';
          flowResult.errors.push('Session not persisted after refresh');
        }
        
        flowResult.status = 'passed';
        auditResults.summary.e2eFlowsPassed++;
      } else {
        flowResult.steps[2].status = 'failed';
        flowResult.errors.push(`Login did not redirect to ${expectedRedirect}, stayed at ${redact(currentUrl)}`);
        flowResult.status = 'failed';
        auditResults.summary.e2eFlowsFailed++;
      }
    } else {
      flowResult.steps.push({ step: 'login_attempt', status: 'skipped', reason: 'No test credentials provided' });
      flowResult.status = 'partial';
    }

  } catch (err) {
    flowResult.errors.push(`Login flow error: ${err.message}`);
    flowResult.status = 'failed';
    auditResults.summary.e2eFlowsFailed++;
  }

  flowResult.duration = Date.now() - startTime;
  return flowResult;
}

/**
 * Run E2E logout flow test
 */
async function testLogoutFlow(page) {
  const flowResult = {
    name: 'logout',
    status: 'skipped',
    steps: [],
    errors: [],
    duration: 0
  };

  const logoutConfig = brandRules.e2eFlows?.logout;
  if (!logoutConfig) {
    flowResult.errors.push('No logout flow configuration found');
    return flowResult;
  }

  const startTime = Date.now();

  try {
    // Check if we're logged in (should be on dashboard or similar)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      flowResult.status = 'skipped';
      flowResult.errors.push('Not logged in, cannot test logout');
      return flowResult;
    }

    flowResult.steps.push({ step: 'find_logout', status: 'pending' });

    // Find and click logout
    const logoutTrigger = logoutConfig.trigger || 'button:has-text("Logout")';
    const logoutBtn = await page.$(logoutTrigger);

    if (!logoutBtn) {
      flowResult.steps[0].status = 'failed';
      flowResult.errors.push('Logout button/link not found');
      flowResult.status = 'failed';
      return flowResult;
    }
    flowResult.steps[0].status = 'passed';

    flowResult.steps.push({ step: 'click_logout', status: 'pending' });
    await logoutBtn.click();
    await page.waitForTimeout(2000);

    const afterLogoutUrl = page.url();
    const expectedRedirect = logoutConfig.successRedirect || '/login';

    if (afterLogoutUrl.includes(expectedRedirect)) {
      flowResult.steps[1].status = 'passed';
      flowResult.status = 'passed';
      auditResults.summary.e2eFlowsPassed++;
    } else {
      flowResult.steps[1].status = 'failed';
      flowResult.errors.push(`Logout did not redirect to ${expectedRedirect}`);
      flowResult.status = 'failed';
      auditResults.summary.e2eFlowsFailed++;
    }

  } catch (err) {
    flowResult.errors.push(`Logout flow error: ${err.message}`);
    flowResult.status = 'failed';
    auditResults.summary.e2eFlowsFailed++;
  }

  flowResult.duration = Date.now() - startTime;
  return flowResult;
}

// =============================================================================
// MAIN CRAWLER
// =============================================================================

async function runAudit() {
  console.log('='.repeat(80));
  console.log('CR AudioViz AI - Brand + Copy + Flow Audit');
  console.log('='.repeat(80));
  console.log(`Site URL: ${SITE_URL}`);
  console.log(`Max Depth: ${MAX_DEPTH}`);
  console.log(`Max Pages: ${MAX_PAGES}`);
  console.log(`CI Mode: ${CI_MODE}`);
  console.log(`Audit Started: ${auditResults.metadata.auditDateET}`);
  console.log('='.repeat(80));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'CRAudioVizAI-AuditBot/1.0 (Brand Audit; +https://craudiovizai.com)',
    viewport: brandRules.crawlConfig?.viewports?.desktop || { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Disable images and media for faster crawling (but enable for screenshots)
  // await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,mp4,webm}', route => route.abort());

  try {
    // =========================================================================
    // STEP 1: DISCOVER URLS
    // =========================================================================
    console.log('\n[1/4] Discovering URLs...');
    
    const urlsToAudit = new Set();
    const visitedUrls = new Set();

    // Try sitemap.xml first
    try {
      const sitemapUrl = new URL('/sitemap.xml', SITE_URL).href;
      console.log(`  Trying sitemap: ${sitemapUrl}`);
      const sitemapResponse = await fetchUrl(sitemapUrl);
      
      if (sitemapResponse.status === 200 && sitemapResponse.body.includes('<urlset')) {
        const sitemapUrls = parseSitemap(sitemapResponse.body);
        console.log(`  Found ${sitemapUrls.length} URLs in sitemap`);
        sitemapUrls.forEach(url => {
          if (!shouldExclude(url, SITE_URL)) {
            urlsToAudit.add(normalizeUrl(url, SITE_URL));
          }
        });
      }
    } catch (err) {
      console.log(`  Sitemap not available: ${err.message}`);
    }

    // Add configured include paths
    const includePaths = brandRules.crawlConfig?.includePaths || ['/'];
    includePaths.forEach(path => {
      const fullUrl = new URL(path, SITE_URL).href;
      urlsToAudit.add(normalizeUrl(fullUrl, SITE_URL));
    });

    // Start with root if nothing else
    if (urlsToAudit.size === 0) {
      urlsToAudit.add(SITE_URL);
    }

    console.log(`  Total seed URLs: ${urlsToAudit.size}`);

    // =========================================================================
    // STEP 2: CRAWL AND AUDIT PAGES
    // =========================================================================
    console.log('\n[2/4] Crawling and auditing pages...');

    const queue = [...urlsToAudit].map(url => ({ url, depth: 0 }));
    
    while (queue.length > 0 && auditResults.pages.length < MAX_PAGES) {
      const { url, depth } = queue.shift();
      
      if (visitedUrls.has(url)) continue;
      visitedUrls.add(url);

      console.log(`  [${auditResults.pages.length + 1}/${MAX_PAGES}] Auditing: ${url} (depth: ${depth})`);
      
      const pageResult = await auditPage(page, url, depth);
      auditResults.pages.push(pageResult);
      auditResults.summary.pagesAudited++;

      // Add discovered links to queue
      if (pageResult.links && depth < MAX_DEPTH) {
        for (const link of pageResult.links) {
          if (!visitedUrls.has(link) && !queue.some(q => q.url === link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }

    auditResults.summary.totalPages = visitedUrls.size;

    // =========================================================================
    // STEP 3: CHECK FOR DUPLICATES
    // =========================================================================
    console.log('\n[3/4] Checking for duplicate titles/descriptions...');

    const titleMap = new Map();
    const descMap = new Map();

    for (const pg of auditResults.pages) {
      if (pg.title) {
        if (titleMap.has(pg.title)) {
          titleMap.get(pg.title).push(pg.url);
        } else {
          titleMap.set(pg.title, [pg.url]);
        }
      }
      if (pg.metaDescription) {
        if (descMap.has(pg.metaDescription)) {
          descMap.get(pg.metaDescription).push(pg.url);
        } else {
          descMap.set(pg.metaDescription, [pg.url]);
        }
      }
    }

    // Find duplicates
    for (const [title, urls] of titleMap) {
      if (urls.length > 1) {
        auditResults.summary.duplicateTitles.push({ title, urls });
        urls.forEach(url => {
          const pg = auditResults.pages.find(p => p.url === url);
          if (pg) {
            pg.copyChecks.duplicateTitle = true;
            pg.warnings.push(`Duplicate title shared with ${urls.length - 1} other page(s)`);
          }
        });
      }
    }

    for (const [desc, urls] of descMap) {
      if (urls.length > 1) {
        auditResults.summary.duplicateDescriptions.push({ description: desc.substring(0, 50) + '...', urls });
        urls.forEach(url => {
          const pg = auditResults.pages.find(p => p.url === url);
          if (pg) {
            pg.copyChecks.duplicateDescription = true;
            pg.warnings.push(`Duplicate meta description shared with ${urls.length - 1} other page(s)`);
          }
        });
      }
    }

    console.log(`  Duplicate titles: ${auditResults.summary.duplicateTitles.length}`);
    console.log(`  Duplicate descriptions: ${auditResults.summary.duplicateDescriptions.length}`);

    // =========================================================================
    // STEP 4: E2E FLOW TESTS
    // =========================================================================
    console.log('\n[4/4] Running E2E flow tests...');

    // Login flow
    console.log('  Testing login flow...');
    const loginResult = await testLoginFlow(page, context);
    auditResults.e2eResults.push(loginResult);
    console.log(`    Login flow: ${loginResult.status}`);

    // Logout flow (only if login succeeded)
    if (loginResult.status === 'passed') {
      console.log('  Testing logout flow...');
      const logoutResult = await testLogoutFlow(page);
      auditResults.e2eResults.push(logoutResult);
      console.log(`    Logout flow: ${logoutResult.status}`);
    }

  } catch (err) {
    console.error(`\n[ERROR] Audit failed: ${err.message}`);
    auditResults.summary.errors++;
  } finally {
    await browser.close();
  }

  // ===========================================================================
  // GENERATE REPORTS
  // ===========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('Generating Reports...');
  console.log('='.repeat(80));

  // JSON Report
  const jsonPath = path.join(EVIDENCE_DIR, brandRules.reporting?.jsonOutput || 'brand-audit-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2));
  console.log(`  JSON: ${jsonPath}`);

  // Markdown Report
  const mdReport = generateMarkdownReport(auditResults);
  const mdFilename = `${brandRules.reporting?.mdOutput || 'BRAND_AUDIT_REPORT'}_${timestamp()}.md`;
  const mdPath = path.join(REPORT_DIR, mdFilename);
  fs.writeFileSync(mdPath, mdReport);
  console.log(`  Markdown: ${mdPath}`);

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Pages Discovered: ${auditResults.summary.totalPages}`);
  console.log(`Pages Audited: ${auditResults.summary.pagesAudited}`);
  console.log(`Passed: ${auditResults.summary.passedPages}`);
  console.log(`Failed: ${auditResults.summary.failedPages}`);
  console.log(`Warnings: ${auditResults.summary.warnings}`);
  console.log(`Errors: ${auditResults.summary.errors}`);
  console.log(`Deprecated Tokens Found: ${auditResults.summary.deprecatedTokensFound}`);
  console.log(`Missing Meta: ${auditResults.summary.missingMeta}`);
  console.log(`Duplicate Titles: ${auditResults.summary.duplicateTitles.length}`);
  console.log(`Duplicate Descriptions: ${auditResults.summary.duplicateDescriptions.length}`);
  console.log(`E2E Flows Passed: ${auditResults.summary.e2eFlowsPassed}`);
  console.log(`E2E Flows Failed: ${auditResults.summary.e2eFlowsFailed}`);
  console.log('='.repeat(80));

  // Exit code based on results
  const hasErrors = auditResults.summary.errors > 0 || auditResults.summary.failedPages > 0;
  const hasDeprecatedTokens = auditResults.summary.deprecatedTokensFound > 0;
  
  if (hasErrors || hasDeprecatedTokens) {
    console.log('\n⚠️  Audit completed with issues. Review report for details.');
    process.exit(1);
  } else {
    console.log('\n✅ Audit completed successfully.');
    process.exit(0);
  }
}

// =============================================================================
// MARKDOWN REPORT GENERATOR
// =============================================================================

function generateMarkdownReport(results) {
  const lines = [];
  
  lines.push('# CR AudioViz AI - Brand + Copy + Flow Audit Report');
  lines.push('');
  lines.push(`**Generated:** ${results.metadata.auditDateET} (Eastern Time)`);
  lines.push(`**Site:** ${results.metadata.siteUrl}`);
  lines.push(`**Audit Depth:** ${results.metadata.maxDepth}`);
  lines.push(`**Max Pages:** ${results.metadata.maxPages}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Pages Discovered | ${results.summary.totalPages} |`);
  lines.push(`| Pages Audited | ${results.summary.pagesAudited} |`);
  lines.push(`| ✅ Passed | ${results.summary.passedPages} |`);
  lines.push(`| ❌ Failed | ${results.summary.failedPages} |`);
  lines.push(`| ⚠️ Warnings | ${results.summary.warnings} |`);
  lines.push(`| 🚨 Errors | ${results.summary.errors} |`);
  lines.push(`| 🏷️ Deprecated Tokens | ${results.summary.deprecatedTokensFound} |`);
  lines.push(`| 📝 Missing Meta | ${results.summary.missingMeta} |`);
  lines.push(`| 🔄 E2E Passed | ${results.summary.e2eFlowsPassed} |`);
  lines.push(`| 🔄 E2E Failed | ${results.summary.e2eFlowsFailed} |`);
  lines.push('');

  // Brand Issues
  if (results.brandIssues.length > 0) {
    lines.push('## Brand Issues');
    lines.push('');
    lines.push('### Deprecated Tokens Found');
    lines.push('');
    lines.push('The following deprecated branding tokens were found and should be updated:');
    lines.push('');
    for (const issue of results.brandIssues) {
      lines.push(`- **${issue.url}**`);
      lines.push(`  - Tokens: \`${issue.tokens.join('`, `')}\``);
    }
    lines.push('');
  }

  // Duplicate Content
  if (results.summary.duplicateTitles.length > 0 || results.summary.duplicateDescriptions.length > 0) {
    lines.push('## Duplicate Content Issues');
    lines.push('');
    
    if (results.summary.duplicateTitles.length > 0) {
      lines.push('### Duplicate Page Titles');
      lines.push('');
      for (const dup of results.summary.duplicateTitles) {
        lines.push(`- **"${dup.title}"** (${dup.urls.length} pages)`);
        for (const url of dup.urls) {
          lines.push(`  - ${url}`);
        }
      }
      lines.push('');
    }
    
    if (results.summary.duplicateDescriptions.length > 0) {
      lines.push('### Duplicate Meta Descriptions');
      lines.push('');
      for (const dup of results.summary.duplicateDescriptions) {
        lines.push(`- **"${dup.description}"** (${dup.urls.length} pages)`);
        for (const url of dup.urls) {
          lines.push(`  - ${url}`);
        }
      }
      lines.push('');
    }
  }

  // E2E Flow Results
  lines.push('## E2E Flow Test Results');
  lines.push('');
  for (const flow of results.e2eResults) {
    const statusEmoji = flow.status === 'passed' ? '✅' : flow.status === 'failed' ? '❌' : '⏭️';
    lines.push(`### ${statusEmoji} ${flow.name.charAt(0).toUpperCase() + flow.name.slice(1)} Flow`);
    lines.push('');
    lines.push(`- **Status:** ${flow.status}`);
    lines.push(`- **Duration:** ${flow.duration}ms`);
    
    if (flow.steps.length > 0) {
      lines.push('- **Steps:**');
      for (const step of flow.steps) {
        const stepEmoji = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
        lines.push(`  - ${stepEmoji} ${step.step}: ${step.status}`);
      }
    }
    
    if (flow.errors.length > 0) {
      lines.push('- **Errors:**');
      for (const err of flow.errors) {
        lines.push(`  - ${err}`);
      }
    }
    lines.push('');
  }

  // Page Details
  lines.push('## Page Audit Details');
  lines.push('');
  
  // Group by status
  const failedPages = results.pages.filter(p => p.errors.length > 0);
  const warningPages = results.pages.filter(p => p.errors.length === 0 && p.warnings.length > 0);
  const passedPages = results.pages.filter(p => p.errors.length === 0 && p.warnings.length === 0);

  if (failedPages.length > 0) {
    lines.push('### ❌ Pages with Errors');
    lines.push('');
    for (const pg of failedPages.slice(0, 20)) {
      lines.push(`#### ${pg.url}`);
      lines.push('');
      lines.push(`- **Status:** HTTP ${pg.status}`);
      lines.push(`- **Title:** ${pg.title || 'MISSING'}`);
      lines.push('- **Errors:**');
      for (const err of pg.errors) {
        lines.push(`  - ${err}`);
      }
      if (pg.warnings.length > 0) {
        lines.push('- **Warnings:**');
        for (const warn of pg.warnings) {
          lines.push(`  - ${warn}`);
        }
      }
      lines.push('');
    }
  }

  if (warningPages.length > 0) {
    lines.push('### ⚠️ Pages with Warnings');
    lines.push('');
    for (const pg of warningPages.slice(0, 20)) {
      lines.push(`#### ${pg.url}`);
      lines.push('');
      lines.push(`- **Title:** ${pg.title || 'N/A'}`);
      lines.push('- **Warnings:**');
      for (const warn of pg.warnings) {
        lines.push(`  - ${warn}`);
      }
      lines.push('');
    }
  }

  // Copy Review JSON (for LLM/human review)
  lines.push('## Copy Review Data');
  lines.push('');
  lines.push('The following JSON contains extracted copy elements for manual or LLM-assisted review:');
  lines.push('');
  lines.push('```json');
  const copyData = results.pages.slice(0, 20).map(pg => ({
    url: pg.url,
    title: pg.title,
    metaDescription: pg.metaDescription,
    h1: pg.h1,
    heroText: pg.heroText,
    navLabels: pg.navLabels.slice(0, 10)
  }));
  lines.push(JSON.stringify(copyData, null, 2));
  lines.push('```');
  lines.push('');

  // Screenshots Reference
  lines.push('## Screenshots');
  lines.push('');
  lines.push(`Total screenshots captured: ${results.screenshots.length}`);
  lines.push('');
  lines.push('Screenshots are stored in: `evidence/brand-audit/screenshots/`');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Report generated by CR AudioViz AI Brand Audit System v1.0.0*');
  lines.push(`*Audit completed: ${results.metadata.auditDateET}*`);

  return lines.join('\n');
}

// =============================================================================
// RUN
// =============================================================================

runAudit().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
