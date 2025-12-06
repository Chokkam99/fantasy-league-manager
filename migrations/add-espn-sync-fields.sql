-- Add ESPN integration and sync tracking fields to leagues table
-- Run this migration in your Supabase SQL Editor

ALTER TABLE leagues
ADD COLUMN IF NOT EXISTS espn_league_id TEXT,
ADD COLUMN IF NOT EXISTS espn_s2 TEXT,
ADD COLUMN IF NOT EXISTS espn_swid TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'inactive' CHECK (sync_status IN ('inactive', 'active', 'error', 'paused')),
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Create index for faster cron job queries
CREATE INDEX IF NOT EXISTS idx_leagues_sync_status ON leagues(sync_status);

-- Add helpful comments
COMMENT ON COLUMN leagues.espn_league_id IS 'ESPN league ID for API integration';
COMMENT ON COLUMN leagues.espn_s2 IS 'ESPN authentication cookie (espn_s2) for private leagues';
COMMENT ON COLUMN leagues.espn_swid IS 'ESPN authentication cookie (SWID) for private leagues';
COMMENT ON COLUMN leagues.sync_status IS 'Status of automated sync: inactive, active, error, or paused';
COMMENT ON COLUMN leagues.last_sync_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN leagues.last_sync_error IS 'Error message from last failed sync attempt';
