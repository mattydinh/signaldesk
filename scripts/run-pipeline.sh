#!/usr/bin/env bash
# Run the ML pipeline on your deployed app. Set CRON_SECRET (and optionally APP_URL) first.
# Example: CRON_SECRET='your-secret' ./scripts/run-pipeline.sh
# Or add CRON_SECRET to .env.local and run: source .env.local 2>/dev/null; ./scripts/run-pipeline.sh

set -e
APP_URL="${APP_URL:-https://signaldesk-chi.vercel.app}"
if [ -z "$CRON_SECRET" ]; then
  echo "Error: Set CRON_SECRET (e.g. export CRON_SECRET='your-secret' or add to .env.local)"
  exit 1
fi
curl -sS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/run-pipeline"
echo ""
