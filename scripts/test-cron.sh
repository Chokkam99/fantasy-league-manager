#!/bin/bash
# Test script for the cron job endpoint
set -e

# Get CRON_SECRET from .env
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

CRON_SECRET=$(grep CRON_SECRET .env | cut -d '=' -f2 | tr -d ' ')

if [ -z "$CRON_SECRET" ]; then
    echo "❌ Error: CRON_SECRET not found in .env"
    exit 1
fi

# Use provided URL or default to localhost
URL="${1:-http://localhost:3000}/api/cron/import-weekly-scores"

echo "🧪 Testing cron endpoint: $URL"

# Make request
curl -s -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "$URL"

echo ""
echo "✅ Test complete"
