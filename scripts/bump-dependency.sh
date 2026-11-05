#!/usr/bin/env bash
# Partially automates the CVE dependency bump workflow.
# Usage: ./scripts/bump-dependency.sh <package> [version]
#   e.g. ./scripts/bump-dependency.sh webpack-dev-server
#        ./scripts/bump-dependency.sh express 4.21.2
#
# Rules:
#   - Never uses npm audit fix, --force, --legacy-peer-deps, or
#     --min-release-age=0
#   - Prefers lockfile-only changes for transitive deps
#   - Only adds package.json overrides if necessary to force a version
#   - Does not edit .npmrc

set -eo pipefail

# ---------------------------------------------------------------------------
# Colors (with no-color fallback)
# ---------------------------------------------------------------------------
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BOLD='' RESET=''
fi

info()  { echo -e "${BOLD}$*${RESET}"; }
pass()  { echo -e "${GREEN}PASS${RESET}: $*"; }
fail()  { echo -e "${RED}FAIL${RESET}: $*"; }
warn()  { echo -e "${YELLOW}WARN${RESET}: $*"; }

# Extract advisory IDs from an npm audit JSON file into an output file.
# Usage: extract_advisories <audit_json> <output_file>
# Supports both .vulnerabilities and .advisories JSON formats.
# Exits with failure if neither key is present (e.g. network error).
extract_advisories() {
  local audit_json="$1"
  local output_file="$2"
  if jq -e '.vulnerabilities' "$audit_json" &>/dev/null; then
    jq -r '
      [.vulnerabilities | to_entries[] | .value.via[]?
       | select(type == "object") | .source // empty] | unique | .[]
    ' "$audit_json" > "$output_file"
  elif jq -e '.advisories' "$audit_json" &>/dev/null; then
    jq -r '.advisories | keys[]' "$audit_json" > "$output_file"
  else
    fail "npm audit JSON has no .vulnerabilities or .advisories — possible network error"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: $0 <package> [version]

Partially automates the CVE dependency bump workflow for this npm project.

Steps performed:
  1. Preflight checks (npm version, repo root)
  2. Baseline npm audit snapshot
  3. Dependency analysis (direct vs transitive, parent chain)
  4. Perform the upgrade
  5. Post-upgrade audit diff (fixed / new / unchanged advisories)
  6. Validation (npm run build, npm run test-unit)
  7. Summary with next-step guidance

Options:
  -h, --help    Show this help message and exit

Rules this script follows:
  - Never uses npm audit fix, --force, --legacy-peer-deps, or
    --min-release-age=0
  - Prefers lockfile-only changes for transitive deps
  - Only adds package.json overrides if necessary to force a version
  - Does not edit .npmrc

Examples:
  $0 webpack-dev-server
  $0 express 4.21.2
EOF
  exit 0
}

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

PACKAGE="${1:-}"
VERSION="${2:-}"

if [[ -z "$PACKAGE" ]]; then
  echo "Error: package name is required." >&2
  echo "Usage: $0 <package> [version]" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Preflight checks
# ---------------------------------------------------------------------------
info "=== Step 1: Preflight checks ==="

# Check npm is installed and meets minimum version
if ! command -v npm &>/dev/null; then
  fail "npm is not installed"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  fail "jq is not installed (required to parse npm audit and package.json)"
  exit 1
fi

NPM_VERSION="$(npm --version)"
MIN_NPM="11.10.0"

version_gte() {
  # Returns 0 if $1 >= $2 using semver-style comparison
  printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1 | grep -qx "$2"
}

if ! version_gte "$NPM_VERSION" "$MIN_NPM"; then
  fail "npm $NPM_VERSION is installed, but >= $MIN_NPM is required (min-release-age needs it)"
  echo "  Run: npm install -g npm@latest" >&2
  exit 1
fi
pass "npm $NPM_VERSION >= $MIN_NPM"

# Verify we're in the repo root
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$REPO_ROOT/package.json" ]]; then
  fail "package.json not found in $REPO_ROOT — run this script from the repo root"
  exit 1
fi
cd "$REPO_ROOT"
pass "repo root: $REPO_ROOT"

echo

# ---------------------------------------------------------------------------
# 2. Baseline audit
# ---------------------------------------------------------------------------
info "=== Step 2: Baseline audit ==="

TMPDIR_WORK="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_WORK"' EXIT

AUDIT_BEFORE="$TMPDIR_WORK/audit-before.json"
AUDIT_AFTER="$TMPDIR_WORK/audit-after.json"

# npm audit exits non-zero when vulnerabilities exist, so we allow that
npm audit --json > "$AUDIT_BEFORE" 2>/dev/null || true

ADVISORIES_BEFORE="$TMPDIR_WORK/advisories-before.txt"
extract_advisories "$AUDIT_BEFORE" "$ADVISORIES_BEFORE"

BEFORE_COUNT="$(wc -l < "$ADVISORIES_BEFORE" | tr -d ' ')"
info "Baseline: $BEFORE_COUNT advisory ID(s) found"
echo

# ---------------------------------------------------------------------------
# 3. Dependency analysis
# ---------------------------------------------------------------------------
info "=== Step 3: Dependency analysis ==="

info "Dependency chain for $PACKAGE:"
npm ls "$PACKAGE" 2>/dev/null || true
echo

# Determine if it's a direct or transitive dependency
IS_DIRECT=false
PARENT_PKG=""

if jq -e --arg pkg "$PACKAGE" \
  '(.dependencies[$pkg] // .devDependencies[$pkg] // .peerDependencies[$pkg]) != null' \
  package.json &>/dev/null; then
  IS_DIRECT=true
  pass "$PACKAGE is a DIRECT dependency"
else
  IS_DIRECT=false
  warn "$PACKAGE is a TRANSITIVE dependency"

  # Find the direct (parent) dependency that pulls it in by parsing
  # the JSON dependency tree (handles scoped packages correctly)
  PARENT_PKG="$(
    npm ls "$PACKAGE" --all --json 2>/dev/null \
      | jq -r --arg pkg "$PACKAGE" '
        .dependencies // {} | to_entries[]
        | select(.key != $pkg) | .key
      ' 2>/dev/null | head -n1 || true
  )"

  if [[ -n "$PARENT_PKG" && "$PARENT_PKG" != "$PACKAGE" ]]; then
    info "  Pulled in by direct dependency: $PARENT_PKG"
  else
    info "  Could not determine the parent dependency automatically."
    info "  Check 'npm ls $PACKAGE' output above."
    PARENT_PKG=""
  fi
fi

# Check publish-age if version is specified
if [[ -n "$VERSION" ]]; then
  info "Checking publish date for $PACKAGE@$VERSION..."
  PUBLISH_DATE="$(
    npm view "$PACKAGE" time --json 2>/dev/null \
      | jq -r --arg v "$VERSION" '.[$v] // empty' \
      || true
  )"
  if [[ -n "$PUBLISH_DATE" ]]; then
    PUBLISH_EPOCH="$(date -d "$PUBLISH_DATE" +%s 2>/dev/null || true)"
    NOW_EPOCH="$(date +%s)"
    if [[ -n "$PUBLISH_EPOCH" ]]; then
      AGE_DAYS="$(( (NOW_EPOCH - PUBLISH_EPOCH) / 86400 ))"
      if [[ "$AGE_DAYS" -lt 14 ]]; then
        warn "$PACKAGE@$VERSION was published $AGE_DAYS day(s) ago ($PUBLISH_DATE)"
        warn "This is under 14 days old and will be blocked by min-release-age=14 in .npmrc"
      else
        pass "$PACKAGE@$VERSION was published $AGE_DAYS day(s) ago — OK for min-release-age=14"
      fi
    fi
  else
    warn "Could not find publish date for $PACKAGE@$VERSION — version may not exist"
  fi
fi

echo

# ---------------------------------------------------------------------------
# 4. Perform the upgrade
# ---------------------------------------------------------------------------
info "=== Step 4: Perform the upgrade ==="

UPGRADE_TYPE=""

if $IS_DIRECT; then
  TARGET="${PACKAGE}"
  [[ -n "$VERSION" ]] && TARGET="${PACKAGE}@${VERSION}"
  info "Installing $TARGET (direct dependency)..."
  npm install --save-exact "$TARGET"
  UPGRADE_TYPE="direct"
  pass "Installed $TARGET"
else
  # Transitive dependency
  if [[ -z "$VERSION" ]]; then
    info "This is a transitive dependency."
    if [[ -n "$PARENT_PKG" ]]; then
      info "Consider upgrading the parent ($PARENT_PKG) instead:"
      info "  $0 $PARENT_PKG"
    else
      info "Identify the direct dependency that pulls in $PACKAGE and upgrade that instead."
    fi
    info "If you need to force a specific version, re-run with:"
    info "  $0 $PACKAGE <version>"
    echo
    info "Exiting without changes."
    exit 0
  fi

  info "Updating transitive dependency $PACKAGE@$VERSION in lockfile..."
  info "Running npm update to pull in the new version..."

  # Use npm install with a specific override to force the transitive version
  # First try npm update which may resolve it
  npm update "$PACKAGE" 2>/dev/null || true

  # Check if the version was updated
  CURRENT_VER="$(npm ls "$PACKAGE" --all --json 2>/dev/null \
    | jq -r --arg pkg "$PACKAGE" '
      [.. | objects | .dependencies? // empty | .[$pkg]? // empty
      | .version? // empty | select(length > 0)] | unique | join(",")
    ' 2>/dev/null || true)"

  if [[ "$CURRENT_VER" != "$VERSION" ]]; then
    info "npm update did not reach $VERSION (current: ${CURRENT_VER:-unknown})"
    info "Adding an override in package.json to force $PACKAGE@$VERSION..."
    # Back up package.json before modifying it
    cp package.json "$TMPDIR_WORK/package.json.bak"
    # Add overrides entry
    TMPJSON="$TMPDIR_WORK/package.json.tmp"
    jq --arg pkg "$PACKAGE" --arg ver "$VERSION" \
      '.overrides[$pkg] = $ver' package.json > "$TMPJSON"
    mv "$TMPJSON" package.json
    if ! npm install; then
      fail "npm install failed after adding override for $PACKAGE@$VERSION"
      cp "$TMPDIR_WORK/package.json.bak" package.json
      exit 1
    fi
    warn "Added overrides entry for $PACKAGE@$VERSION in package.json"
  fi

  UPGRADE_TYPE="transitive"
  info "Only package-lock.json should change for lockfile-only updates."
  info "If package.json was modified (overrides added), review carefully."
  pass "Updated $PACKAGE to target $VERSION"
fi

echo

# ---------------------------------------------------------------------------
# 5. Post-upgrade audit diff
# ---------------------------------------------------------------------------
info "=== Step 5: Post-upgrade audit diff ==="

npm audit --json > "$AUDIT_AFTER" 2>/dev/null || true

ADVISORIES_AFTER="$TMPDIR_WORK/advisories-after.txt"
extract_advisories "$AUDIT_AFTER" "$ADVISORIES_AFTER"

AFTER_COUNT="$(wc -l < "$ADVISORIES_AFTER" | tr -d ' ')"

# Compare advisory IDs
FIXED_ADVISORIES="$(comm -23 <(sort "$ADVISORIES_BEFORE") <(sort "$ADVISORIES_AFTER"))"
NEW_ADVISORIES="$(comm -13 <(sort "$ADVISORIES_BEFORE") <(sort "$ADVISORIES_AFTER"))"
UNCHANGED_ADVISORIES="$(comm -12 <(sort "$ADVISORIES_BEFORE") <(sort "$ADVISORIES_AFTER"))"

FIXED_COUNT="$(echo "$FIXED_ADVISORIES" | grep -c . || true)"
NEW_COUNT="$(echo "$NEW_ADVISORIES" | grep -c . || true)"
UNCHANGED_COUNT="$(echo "$UNCHANGED_ADVISORIES" | grep -c . || true)"

AUDIT_OK=true

if [[ "$FIXED_COUNT" -gt 0 ]]; then
  pass "Fixed $FIXED_COUNT advisory(ies):"
  echo "$FIXED_ADVISORIES" | sed 's/^/  /'
fi

if [[ "$NEW_COUNT" -gt 0 ]]; then
  fail "New $NEW_COUNT advisory(ies) introduced:"
  echo "$NEW_ADVISORIES" | sed 's/^/  /'
  warn "Investigate these new advisories before committing!"
  AUDIT_OK=false
fi

if [[ "$UNCHANGED_COUNT" -gt 0 ]]; then
  info "Unchanged: $UNCHANGED_COUNT advisory(ies) remain"
fi

info "Audit summary: before=$BEFORE_COUNT, after=$AFTER_COUNT, fixed=$FIXED_COUNT, new=$NEW_COUNT"
echo

# ---------------------------------------------------------------------------
# 6. Validation
# ---------------------------------------------------------------------------
info "=== Step 6: Validation ==="

BUILD_OK=false
TEST_OK=false

info "Running npm run build..."
if npm run build; then
  BUILD_OK=true
  pass "npm run build"
else
  fail "npm run build"
fi

echo

info "Running npm run test-unit..."
if npm run test-unit; then
  TEST_OK=true
  pass "npm run test-unit"
else
  fail "npm run test-unit"
fi

echo

# ---------------------------------------------------------------------------
# 7. Summary
# ---------------------------------------------------------------------------
info "=== Step 7: Summary ==="
echo
info "Package:     $PACKAGE"
[[ -n "$VERSION" ]] && info "Version:     $VERSION"
info "Type:        $UPGRADE_TYPE dependency"
echo
info "Audit diff:"
info "  Before:    $BEFORE_COUNT advisories"
info "  After:     $AFTER_COUNT advisories"
[[ "$FIXED_COUNT" -gt 0 ]] && pass "  Fixed:     $FIXED_COUNT"
[[ "$NEW_COUNT" -gt 0 ]]   && fail "  New:       $NEW_COUNT"
echo
info "Validation:"
$BUILD_OK && pass "  Build:     passed" || fail "  Build:     failed"
$TEST_OK  && pass "  Tests:     passed" || fail "  Tests:     failed"
echo

if $BUILD_OK && $TEST_OK && $AUDIT_OK; then
  pass "All checks passed. Review the diff and commit when ready:"
  echo "  git add package.json package-lock.json"
  echo "  git commit -m 'chore(deps): bump $PACKAGE${VERSION:+ to $VERSION}'"
else
  warn "Some checks did not pass. Review the output above before committing."
  $AUDIT_OK  || warn "  - New advisories were introduced"
  $BUILD_OK  || warn "  - Build failed"
  $TEST_OK   || warn "  - Tests failed"
  exit 1
fi
