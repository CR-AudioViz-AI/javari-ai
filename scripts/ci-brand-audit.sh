#!/bin/bash
# =============================================================================
# CR AudioViz AI - Brand Audit CI Runner
# =============================================================================
# Usage: 
#   SITE_URL=https://craudiovizai.com bash scripts/ci-brand-audit.sh
#
# Environment Variables:
#   SITE_URL          - Base URL to audit (required)
#   TEST_USER_EMAIL   - Test user email for login flow (optional)
#   TEST_USER_PASS    - Test user password for login flow (optional)
#   MAX_DEPTH         - Crawl depth (default: 3)
#   MAX_PAGES         - Max pages to audit (default: 100)
# =============================================================================

set -e  # Exit on error
set -o pipefail  # Pipe failure is error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timestamp function
timestamp() {
  date -u +"%Y-%m-%d %H:%M:%S UTC"
}

# Print with timestamp
log() {
  echo -e "${BLUE}[$(timestamp)]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[$(timestamp)] ✅ $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}[$(timestamp)] ⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}[$(timestamp)] ❌ $1${NC}"
}

# Banner
echo ""
echo "=============================================================================="
echo "  CR AudioViz AI - Brand + Copy + Flow Audit"
echo "  CI Runner v1.0.0"
echo "=============================================================================="
echo ""

# Check required environment
if [ -z "$SITE_URL" ]; then
  log_error "SITE_URL environment variable is required"
  echo "  Usage: SITE_URL=https://craudiovizai.com bash scripts/ci-brand-audit.sh"
  exit 1
fi

log "Site URL: $SITE_URL"
log "Max Depth: ${MAX_DEPTH:-3}"
log "Max Pages: ${MAX_PAGES:-100}"

# Detect script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log "Project Root: $PROJECT_ROOT"

# Change to project root
cd "$PROJECT_ROOT"

# =============================================================================
# STEP 1: Check/Install Dependencies
# =============================================================================
log ""
log "Step 1: Checking dependencies..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  log_error "Node.js is not installed"
  exit 1
fi

NODE_VERSION=$(node --version)
log "Node.js version: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  log_error "npm is not installed"
  exit 1
fi

NPM_VERSION=$(npm --version)
log "npm version: $NPM_VERSION"

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  log "Installing npm dependencies..."
  npm ci --silent 2>/dev/null || npm install --silent
  log_success "Dependencies installed"
else
  log "Dependencies already installed"
fi

# =============================================================================
# STEP 2: Install Playwright browsers
# =============================================================================
log ""
log "Step 2: Checking Playwright browsers..."

# Check if Playwright is installed and install browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  log "Installing Playwright browsers (first run)..."
  npx playwright install chromium --with-deps
  log_success "Playwright browsers installed"
else
  log "Playwright browsers already installed"
fi

# =============================================================================
# STEP 3: Create output directories
# =============================================================================
log ""
log "Step 3: Preparing output directories..."

mkdir -p evidence/brand-audit/screenshots
mkdir -p reports

log_success "Output directories ready"

# =============================================================================
# STEP 4: Run the audit
# =============================================================================
log ""
log "Step 4: Running brand audit..."
log ""

# Set CI mode
export CI=true

# Run the audit script
AUDIT_EXIT_CODE=0
node scripts/audit-brand-e2e.js || AUDIT_EXIT_CODE=$?

# =============================================================================
# STEP 5: Report results
# =============================================================================
log ""
log "=============================================================================="

if [ $AUDIT_EXIT_CODE -eq 0 ]; then
  log_success "Brand audit completed successfully"
else
  log_warn "Brand audit completed with issues (exit code: $AUDIT_EXIT_CODE)"
fi

# List generated artifacts
log ""
log "Generated Artifacts:"
log "-------------------"

if [ -f "evidence/brand-audit/brand-audit-results.json" ]; then
  JSON_SIZE=$(du -h "evidence/brand-audit/brand-audit-results.json" | cut -f1)
  log "  📄 evidence/brand-audit/brand-audit-results.json ($JSON_SIZE)"
fi

REPORT_COUNT=$(ls -1 reports/BRAND_AUDIT_REPORT_*.md 2>/dev/null | wc -l)
if [ "$REPORT_COUNT" -gt 0 ]; then
  LATEST_REPORT=$(ls -t reports/BRAND_AUDIT_REPORT_*.md | head -1)
  log "  📝 $LATEST_REPORT"
fi

SCREENSHOT_COUNT=$(ls -1 evidence/brand-audit/screenshots/*.png 2>/dev/null | wc -l || echo "0")
log "  📸 Screenshots captured: $SCREENSHOT_COUNT"

log ""
log "=============================================================================="
log "Audit completed at $(timestamp)"
log "=============================================================================="
log ""

# Return the audit exit code for CI
exit $AUDIT_EXIT_CODE
