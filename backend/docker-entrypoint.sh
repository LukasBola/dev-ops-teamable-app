#!/bin/sh
set -e
node scripts/migrate.cjs up
exec node dist/index.js
