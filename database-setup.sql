-- Fantasy League Manager - Complete Database Setup
-- Run this file once to set up a new database from scratch
--
-- Usage: psql "your-supabase-connection-string" -f database-setup.sql

-- ============================================================================
-- TABLES
-- ============================================================================

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    current_season TEXT DEFAULT '2025',
    platform_type VARCHAR(20) DEFAULT 'manual' CHECK (platform_type IN ('manual', 'espn', 'yahoo', 'sleeper')),
    platform_league_id VARCHAR(100),
    auto_sync_enabled BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(20) DEFAULT 'none' CHECK (sync_status IN ('none', 'active', 'error', 'disabled')),
    platform_config JSONB,
    espn_league_id TEXT,
    espn_s2 TEXT,
    espn_swid TEXT,
    last_sync_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_leagues_platform_type ON leagues(platform_type);
CREATE INDEX IF NOT EXISTS idx_leagues_platform_league_id ON leagues(platform_league_id);
CREATE INDEX IF NOT EXISTS idx_leagues_sync_status ON leagues(sync_status);

-- League seasons configuration
CREATE TABLE IF NOT EXISTS league_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    playoff_start_week INTEGER DEFAULT 14,
    total_weeks INTEGER DEFAULT 17,
    playoff_spots INTEGER DEFAULT 6,
    divisions JSONB,
    prize_structure JSONB,
    final_winners JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_league_seasons_league_id ON league_seasons(league_id);
CREATE INDEX IF NOT EXISTS idx_league_seasons_season ON league_seasons(season);

-- League members
CREATE TABLE IF NOT EXISTS league_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    manager_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    season TEXT NOT NULL,
    division TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    payment_status TEXT DEFAULT 'pending',
    platform_team_id TEXT,
    espn_team_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id, manager_name, season)
);

CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_season ON league_members(season);
CREATE INDEX IF NOT EXISTS idx_league_members_division ON league_members(division);

-- Weekly scores
CREATE TABLE IF NOT EXISTS weekly_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES league_members(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    season TEXT NOT NULL,
    points DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id, member_id, week_number, season)
);

CREATE INDEX IF NOT EXISTS idx_weekly_scores_league_season ON weekly_scores(league_id, season);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_member_week ON weekly_scores(member_id, week_number);

-- Matchups
CREATE TABLE IF NOT EXISTS matchups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    team1_member_id UUID NOT NULL REFERENCES league_members(id) ON DELETE CASCADE,
    team2_member_id UUID NOT NULL REFERENCES league_members(id) ON DELETE CASCADE,
    winner_member_id UUID REFERENCES league_members(id) ON DELETE SET NULL,
    is_tie BOOLEAN DEFAULT FALSE,
    is_playoff BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matchups_league_season ON matchups(league_id, season);
CREATE INDEX IF NOT EXISTS idx_matchups_week ON matchups(week_number);

-- Playoff teams tracking
CREATE TABLE IF NOT EXISTS playoff_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES league_members(id) ON DELETE CASCADE,
    seed INTEGER,
    division_rank INTEGER,
    division TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id, season, member_id)
);

CREATE INDEX IF NOT EXISTS idx_playoff_teams_league_season ON playoff_teams(league_id, season);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_seasons_updated_at BEFORE UPDATE ON league_seasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Get season standings with all calculations
CREATE OR REPLACE FUNCTION get_season_standings(
    p_league_id TEXT,
    p_season TEXT,
    p_include_playoffs BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    member_id UUID,
    wins BIGINT,
    losses BIGINT,
    ties BIGINT,
    points_for DECIMAL,
    points_against DECIMAL,
    division TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH matchup_data AS (
        SELECT
            m.team1_member_id,
            m.team2_member_id,
            m.winner_member_id,
            m.is_tie,
            m.is_playoff,
            COALESCE((SELECT points FROM weekly_scores
                     WHERE member_id = m.team1_member_id
                     AND week_number = m.week_number
                     AND season = m.season
                     AND league_id = m.league_id), 0) as team1_score,
            COALESCE((SELECT points FROM weekly_scores
                     WHERE member_id = m.team2_member_id
                     AND week_number = m.week_number
                     AND season = m.season
                     AND league_id = m.league_id), 0) as team2_score
        FROM matchups m
        WHERE m.league_id = p_league_id
        AND m.season = p_season
        AND (p_include_playoffs = TRUE OR m.is_playoff = FALSE)
    )
    SELECT
        lm.id as member_id,
        COUNT(CASE WHEN md.winner_member_id = lm.id THEN 1 END) as wins,
        COUNT(CASE WHEN md.winner_member_id IS NOT NULL
                   AND md.winner_member_id != lm.id
                   AND md.is_tie = FALSE THEN 1 END) as losses,
        COUNT(CASE WHEN md.is_tie = TRUE THEN 1 END) as ties,
        COALESCE(SUM(CASE
            WHEN md.team1_member_id = lm.id THEN md.team1_score
            WHEN md.team2_member_id = lm.id THEN md.team2_score
        END), 0) as points_for,
        COALESCE(SUM(CASE
            WHEN md.team1_member_id = lm.id THEN md.team2_score
            WHEN md.team2_member_id = lm.id THEN md.team1_score
        END), 0) as points_against,
        lm.division
    FROM league_members lm
    LEFT JOIN matchup_data md ON (lm.id = md.team1_member_id OR lm.id = md.team2_member_id)
    WHERE lm.league_id = p_league_id
    AND lm.season = p_season
    AND lm.is_active = TRUE
    GROUP BY lm.id, lm.division;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Matchup results with calculated scores and winners
CREATE OR REPLACE VIEW matchup_results_with_scores AS
SELECT
    m.id,
    m.league_id,
    m.season,
    m.week_number,
    m.team1_member_id,
    m.team2_member_id,
    m.is_playoff,
    COALESCE(ws1.points, 0) as team1_score,
    COALESCE(ws2.points, 0) as team2_score,
    CASE
        WHEN ws1.points > ws2.points THEN m.team1_member_id
        WHEN ws2.points > ws1.points THEN m.team2_member_id
        ELSE NULL
    END as calculated_winner_member_id,
    CASE
        WHEN ws1.points = ws2.points AND ws1.points IS NOT NULL THEN TRUE
        ELSE FALSE
    END as calculated_is_tie
FROM matchups m
LEFT JOIN weekly_scores ws1 ON ws1.member_id = m.team1_member_id
    AND ws1.week_number = m.week_number
    AND ws1.season = m.season
    AND ws1.league_id = m.league_id
LEFT JOIN weekly_scores ws2 ON ws2.member_id = m.team2_member_id
    AND ws2.week_number = m.week_number
    AND ws2.season = m.season
    AND ws2.league_id = m.league_id;

-- ============================================================================
-- INITIAL DATA (Optional - Remove if not needed)
-- ============================================================================

-- You can add your initial league data here if needed
-- Example:
-- INSERT INTO leagues (id, name) VALUES ('my-league', 'My Fantasy League');

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
--
-- Next steps:
-- 1. Create your first league
-- 2. Add league members
-- 3. Configure league season settings
-- 4. Start adding weekly scores and matchups!
--
-- For automated ESPN imports, run: migrations/add-espn-sync-fields.sql
