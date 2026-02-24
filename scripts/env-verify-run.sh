#!/usr/bin/env bash
set -euo pipefail

node -v >/dev/null 2>&1 || { echo "node is required"; exit 1; }

# Use ts-node if available, otherwise try tsx, otherwise fail clearly.
if [ -x ./node_modules/.bin/ts-node ]; then
  ./node_modules/.bin/ts-node ./scripts/env-verify.ts
elif [ -x ./node_modules/.bin/tsx ]; then
  ./node_modules/.bin/tsx ./scripts/env-verify.ts
else
  echo "Missing ts-node or tsx. Install one of them as a devDependency to run env verification."
  exit 1
fi
