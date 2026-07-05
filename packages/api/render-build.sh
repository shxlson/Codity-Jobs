#!/usr/bin/env bash
set -e

# Install all dependencies
npm install

# Build the shared package first (API depends on it)
cd packages/shared
npm install
npx tsc --transpile-only 2>/dev/null || npx ts-node --version  # just ensure ts is available
npx tsc
cd ../..

echo "Build complete — shared package compiled successfully"
