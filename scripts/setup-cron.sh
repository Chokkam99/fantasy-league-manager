#!/bin/bash
# Setup script for automated score import
set -e

echo "🏈 Fantasy League Manager - Automated Score Import Setup"
echo "=========================================================="

# Generate CRON_SECRET if not exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Please create one first."
    exit 1
fi

if ! grep -q "CRON_SECRET=" .env; then
    echo "🔐 Generating secure CRON_SECRET..."
    CRON_SECRET=$(openssl rand -base64 32)
    echo "" >> .env
    echo "# Cron Job Security" >> .env
    echo "CRON_SECRET=${CRON_SECRET}" >> .env
    echo "✅ CRON_SECRET added to .env"
else
    echo "✅ CRON_SECRET already exists in .env"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Add CRON_SECRET to Vercel environment variables"
echo "2. Deploy to Vercel"
echo "3. Configure your leagues in the database:"
echo "   UPDATE leagues SET espn_league_id='YOUR_ESPN_ID', sync_status='active' WHERE id='league-id';"
echo ""
