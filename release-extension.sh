#!/usr/bin/env bash
# This script increments the version number in the manifest.json and trigger a new release.

if [ -z "$1" ]; then
  echo "Usage: $0 (major|minor|patch)"
  exit 1
fi

SCRIPT_DIR="$(cd -P -- "$(dirname -- "$(command -v -- "$0")")" && pwd -P)"

cd "$SCRIPT_DIR/extension" || exit 1
npm version "$1" | xargs -I% sh -c 'git commit package.json package-lock.json -m "bump version to %" && git tag "%" -m "release %"'
