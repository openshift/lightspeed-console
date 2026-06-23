#!/usr/bin/env bash
# Shows `npm list` output for each release branch.
# Usage: ./list-dependencies.sh <pkg>... [npm-list-flags]
#   e.g. ./list-dependencies.sh webpack-cli
#        ./list-dependencies.sh --omit=dev webpack-cli typescript

set -eo pipefail

has_pkg=false
for arg in "$@"; do
  [[ "$arg" != -* ]] && has_pkg=true
done

if ! $has_pkg; then
  echo "Usage: $0 <package-name>... [npm-list-flags]" >&2
  echo "At least one package name is required." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run_npm_list() {
  local branch="$1"
  local dir="$2"
  shift 2

  echo "========================================"
  echo "  $branch"
  echo "========================================"

  if [ ! -d "$dir/node_modules" ] \
     || [ "$dir/package-lock.json" -nt "$dir/node_modules" ]; then
    echo "(installing dependencies...)"
    (cd "$dir" && npm ci --ignore-scripts --no-audit --no-fund --quiet)
  fi

  (cd "$dir" && npm list "$@")
  echo
}

run_npm_list "main"          "$REPO_ROOT"               "$@"
run_npm_list "release-4.19"  "$REPO_ROOT/branches/4-19" "$@"
run_npm_list "pattern-fly-5" "$REPO_ROOT/branches/pf5"  "$@"
