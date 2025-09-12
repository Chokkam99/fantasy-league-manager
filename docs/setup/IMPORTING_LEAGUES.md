# Importing League Data Guide

This guide explains how to import historical fantasy league data into the Fantasy League Manager application.

## Overview

The application supports importing complete fantasy league seasons including:
- League configuration (fees, prizes, season settings)
- League members and their teams
- Weekly scoring data for all members
- Head-to-head matchup records (optional)
- Final standings and winner information

## What You Need

**📋 ESPN Fantasy Football PDF Scorecard** - This is the only file you need to import a complete historical season:

- Contains all manager names and team names
- Includes weekly scores for all 17 weeks (regular season + playoffs)  
- Shows head-to-head matchups and winners
- Available as PDF export from ESPN Fantasy Football

## Prerequisites

1. **Database Access**: You need access to the Supabase PostgreSQL database
2. **League UUID**: You must know the target league's UUID in the database
3. **Season Data**: Organized data including member names, weekly scores, and matchups

## Import Methods

### Method 1: Using SQL Templates (Recommended)

Use the provided SQL templates in `/scripts/templates/` and `/scripts/season-setup/`:

#### For New Leagues
- Use `/scripts/templates/create-new-league-template.sql` to create a brand new league
- Follow the step-by-step process to generate UUID and add members

#### For Historical Seasons (Recommended)
- Use `/scripts/setup/02-historical-import-corrected.sql` for ESPN PDF data (schema-corrected)
- Alternative: Use `/scripts/season-setup/import-historical-season-template.sql` for complex JSON import
- Replace all placeholder values with actual data from ESPN PDF
- League IDs are now name-based slugs (e.g., "Gridiron Gurus" → "gridiron-gurus")
- Follow the step-by-step validation process

### Method 2: Custom SQL Scripts

Create custom scripts following the examples in `/scripts/examples/gridiron-gurus/`

## Step-by-Step Import Process

### Step 1: Prepare Your Data

Organize your data in the following format:

```
Season: 2024
Entry Fee: $150
Weekly Prize: $25
Prize Structure:
- 1st Place: $500
- 2nd Place: $350  
- 3rd Place: $200
- Highest Points: $160

Members:
- Manager Name | Team Name
- John Smith | Smith's Squad
- Jane Doe | Doe's Dynasty
...

Weekly Scores:
Week 1:
- John Smith: 142.5
- Jane Doe: 138.2
...

Matchups (optional):
Week 1:
- John Smith (142.5) vs Jane Doe (138.2)
...
```

### Step 2: Choose Your Template

**For a new league:**
```sql
-- Use create-new-league-template.sql
-- Replace placeholders and run the script
```

**For adding a historical season:**
```sql  
-- Use import-league-template.sql
-- Replace placeholders with your data
```

### Step 3: Replace Placeholders

In your chosen template, replace these placeholders:

#### Required Placeholders:
- `YOUR_LEAGUE_NAME` → Your league's display name (e.g., `Gridiron Gurus`)
- `YOUR_LEAGUE_ID` → Name-based slug (e.g., `gridiron-gurus`)
- `SEASON_YEAR` or `YYYY` → Season year (e.g., `2024`)
- `FEE_AMOUNT` → Entry fee amount (e.g., `150` or `0` for no fee)
- `TOTAL_WEEKS` → Number of weeks (usually `17`)
- `WEEKLY_PRIZE_AMOUNT` → Weekly winner prize (e.g., `25` or `0`)
- `FIRST_PLACE_PRIZE` → 1st place prize (e.g., `500`)
- `SECOND_PLACE_PRIZE` → 2nd place prize (e.g., `350`)
- `THIRD_PLACE_PRIZE` → 3rd place prize (e.g., `200`)
- `HIGHEST_POINTS_PRIZE` → Total points leader prize (e.g., `160`)
- `DRAFT_FOOD_COST` → Draft party cost (e.g., `50` or `0`)

#### Member Data:
Replace the member template sections with your actual member data:
```sql
('LEAGUE_ID_HERE'::uuid, 'John Smith', 'Smith Squad', 'SEASON_YEAR', true, 'paid'),
('LEAGUE_ID_HERE'::uuid, 'Jane Doe', 'Doe Dynasty', 'SEASON_YEAR', true, 'paid'),
-- Continue for all members...
```

#### Weekly Scores:
Replace score data in the VALUES clause:
```sql
(1, 'John Smith', 142.5),  -- Week 1
(1, 'Jane Doe', 138.2),    -- Week 1
(2, 'John Smith', 156.8),  -- Week 2
(2, 'Jane Doe', 134.1),    -- Week 2
-- Continue for all weeks and members...
```

#### Matchup Data (Optional):
If you want to track head-to-head records:
```sql
(1, 'John Smith', 'Jane Doe', 142.5, 138.2),  -- Week 1 matchup
(1, 'Player3', 'Player4', 145.1, 132.9),      -- Week 1 matchup  
-- Continue for all matchups...
```

### Step 4: Execute the Script

1. **Open Supabase SQL Editor**
   - Navigate to your Supabase project dashboard
   - Go to SQL Editor
   - Create a new query

2. **Paste and Execute**
   - Copy your completed script 
   - Paste it into the SQL Editor
   - Click "Run" to execute

3. **Verify Results**
   - The script includes verification queries at the end
   - Check that all data was inserted correctly
   - Look for any error messages

### Step 5: Test in Application

1. Navigate to your league in the web application
2. Check that the season appears in the season selector
3. Verify all members are listed with correct payment status
4. Review weekly scores for accuracy
5. Check standings calculations and prize assignments

## Critical Import Guidelines ⚠️

### Playoff Structure Requirements

**Fantasy Football Standard Structure:**
- **Regular Season**: Weeks 1-14 (14 games per team)
- **Playoffs**: Weeks 15-17 (6 teams make playoffs)
- **Top 2 Seeds**: Get BYE week 15 → play 2 playoff games (16 total games)
- **Other 8 Teams**: Play all 3 playoff weeks → play 3 playoff games (17 total games)
- **Consolation Games**: Teams not in playoffs still play during weeks 15-17

### Common Playoff Import Errors

1. **Missing BYE Week Scores** 
   - BYE week scores are often listed separately in PDF
   - ALL teams have scores even if not playing matchups

2. **Duplicate Matchups**
   - Check for duplicate entries when importing multiple weeks at once
   - Use `ROW_NUMBER()` window functions to remove duplicates

3. **Wrong Game Counts**
   - Each team should have exactly 14 regular season games
   - Playoff toggle should show 16-17 total games (not 18+)
   - Include consolation games for eliminated teams

4. **Matchup vs Weekly_Scores Mismatches**
   - Verify scores match between `matchups` and `weekly_scores` tables
   - Matchup winners should be calculated from actual scores

## Data Validation Checklist

### Pre-Import Validation
Before running your import script, verify:

- [ ] **League UUID** is correct and exists in database
- [ ] **Season year** is unique for this league  
- [ ] **Member names** are spelled consistently across all sections
- [ ] **Weekly scores** include all members for all weeks (including BYE weeks in playoffs)
- [ ] **Playoff weeks (15-17)** have scores for ALL teams, not just matchup participants
- [ ] **Prize amounts** add up correctly with fee structure
- [ ] **Matchup data** (if included) covers all weeks and members

### Post-Import Validation
After importing, run these essential checks:

```sql
-- 1. Verify each team has exactly 14 regular season games
WITH team_regular_season AS (
    SELECT 
        lm.manager_name,
        COUNT(CASE WHEN m.team1_member_id = lm.id OR m.team2_member_id = lm.id THEN 1 END) as games
    FROM league_members lm
    LEFT JOIN matchups m ON (m.team1_member_id = lm.id OR m.team2_member_id = lm.id)
        AND m.week_number BETWEEN 1 AND 14
        AND m.league_id = 'YOUR_LEAGUE_ID' AND m.season = 'YOUR_SEASON'
    WHERE lm.league_id = 'YOUR_LEAGUE_ID' AND lm.season = 'YOUR_SEASON'
    GROUP BY lm.id, lm.manager_name
)
SELECT manager_name, games, 
       CASE WHEN games = 14 THEN '✅' ELSE '❌' END as status
FROM team_regular_season ORDER BY games;

-- 2. Verify playoff game counts (should be 16-17 total games)
WITH team_total_games AS (
    SELECT 
        lm.manager_name,
        COUNT(CASE WHEN m.team1_member_id = lm.id OR m.team2_member_id = lm.id THEN 1 END) as total_games
    FROM league_members lm
    LEFT JOIN matchups m ON (m.team1_member_id = lm.id OR m.team2_member_id = lm.id)
        AND m.league_id = 'YOUR_LEAGUE_ID' AND m.season = 'YOUR_SEASON'
    WHERE lm.league_id = 'YOUR_LEAGUE_ID' AND lm.season = 'YOUR_SEASON'
    GROUP BY lm.id, lm.manager_name
)
SELECT manager_name, total_games,
       CASE WHEN total_games BETWEEN 16 AND 17 THEN '✅' ELSE '❌' END as status
FROM team_total_games ORDER BY total_games;

-- 3. Check for duplicate matchups
SELECT week_number, COUNT(*) as matchups,
       CASE WHEN week_number BETWEEN 1 AND 14 THEN 5 ELSE 'varies' END as expected
FROM matchups 
WHERE league_id = 'YOUR_LEAGUE_ID' AND season = 'YOUR_SEASON'
GROUP BY week_number ORDER BY week_number;
```

## Common Issues and Solutions

### Issue: "ON CONFLICT" errors
**Solution**: Use generic `ON CONFLICT DO NOTHING` instead of specifying constraints

### Issue: Member name mismatches
**Solution**: Ensure exact spelling consistency between league_members insert and weekly_scores/matchups sections

### Issue: Missing season configuration
**Solution**: Always insert league_seasons record before member/score data

### Issue: Incorrect UUID format
**Solution**: Ensure UUIDs include `::uuid` casting and are properly quoted

### Issue: Score data type errors  
**Solution**: Ensure all scores are numeric (not strings) and use decimal format (e.g., `142.5` not `"142.5"`)

### Issue: Duplicate matchups creating wrong game counts
**Symptoms**: Teams showing 18+ total games, multiple identical matchups in same week
**Solution**: Remove duplicates using window functions:
```sql
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY league_id, season, week_number, 
                     LEAST(team1_member_id, team2_member_id), 
                     GREATEST(team1_member_id, team2_member_id)
        ORDER BY id
    ) as rn
    FROM matchups WHERE league_id = 'YOUR_LEAGUE' AND season = 'YOUR_SEASON'
)
DELETE FROM matchups WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

### Issue: Incomplete regular season (showing 6-8 games instead of 14)
**Symptoms**: Player participation showing wrong win-loss records
**Solution**: Import all regular season weeks (1-14), not just playoff weeks. Each team needs exactly 14 regular season games.

### Issue: Wrong playoff structure (too many or too few games)  
**Symptoms**: Playoff toggle showing incorrect game counts
**Solution**: Follow standard fantasy structure:
- Top 2 seeds: BYE week 15 → 2 playoff games (16 total)
- Other teams: All 3 playoff weeks → 3 playoff games (17 total)
- Include consolation games for eliminated teams

### Issue: Matchup scores don't match weekly_scores table
**Symptoms**: Inconsistent standings, wrong winners calculated
**Solution**: Verify and correct score mismatches:
```sql
-- Find mismatches between matchups and weekly_scores
SELECT m.week_number, t1.manager_name, m.team1_score as matchup_score, ws1.points as weekly_score
FROM matchups m
JOIN league_members t1 ON m.team1_member_id = t1.id  
JOIN weekly_scores ws1 ON ws1.member_id = t1.id AND ws1.week_number = m.week_number
WHERE m.league_id = 'YOUR_LEAGUE' AND m.season = 'YOUR_SEASON'
  AND m.team1_score != ws1.points;
```

## Examples

See complete working examples in `/scripts/examples/gridiron-gurus/`:
- `import-gridiron-2023-data.sql` - League with no fees/prizes
- `complete-gridiron-2024-data.sql` - Standard league with full prize structure
- `import-gridiron-2023-data.sql` - Historical season import

## Advanced Features

### Importing Playoff Data
If your league has playoff brackets, use the playoff-specific columns in matchups table:
- `is_playoff_game`
- `playoff_round`
- `playoff_seed_1` 
- `playoff_seed_2`

### Bulk Data Migration
For migrating multiple seasons at once, create separate scripts for each season and run them sequentially.

### Data Validation Queries
Use these queries to validate your import:

```sql
-- Verify season totals
SELECT 
    lm.manager_name,
    count(ws.id) as weeks_played,
    sum(ws.points) as total_points,
    avg(ws.points) as avg_points
FROM league_members lm
LEFT JOIN weekly_scores ws ON lm.id = ws.member_id 
WHERE lm.league_id = 'YOUR_LEAGUE_ID' AND lm.season = 'YOUR_SEASON'
GROUP BY lm.id, lm.manager_name
ORDER BY total_points DESC;

-- Verify matchup winners
SELECT 
    week_number,
    count(*) as matchups,
    sum(case when winner_member_id is not null then 1 else 0 end) as with_winners,
    sum(case when is_tie then 1 else 0 end) as ties
FROM matchups 
WHERE league_id = 'YOUR_LEAGUE_ID' AND season = 'YOUR_SEASON'
GROUP BY week_number
ORDER BY week_number;
```

## Recent Best Practices (December 2024)

### Use RPC Functions for Validation
Always use the `get_season_standings` RPC function to verify standings after import:

```sql
-- Verify standings calculation
SELECT member_id, manager_name, wins, losses, points_for 
FROM get_season_standings('your-league-id', '2024', false)
ORDER BY wins DESC, points_for DESC;
```

### Safe Data Update Patterns
Use upsert operations for data safety:

```sql
-- GOOD: Upsert with conflict resolution
INSERT INTO weekly_scores (league_id, season, week_number, member_id, points)
VALUES /* your data */
ON CONFLICT (league_id, season, week_number, member_id) 
DO UPDATE SET points = EXCLUDED.points;

-- BAD: Delete then insert (can lose data)
DELETE FROM weekly_scores WHERE league_id = 'your-league' AND season = '2024';
INSERT INTO weekly_scores VALUES /* your data */;
```

### Database Schema Updates
Recent schema improvements include:

1. **Matchup Results View**: Use `matchup_results_with_scores` view instead of direct `matchups` table queries
2. **RPC Functions**: Prefer database functions for complex calculations
3. **Trigger Safety**: Updated triggers handle edge cases better

### ESPN Integration
For current seasons, consider using the ESPN integration:

1. Set up ESPN integration in the UI
2. Use automatic import for current season data
3. Manual import only needed for historical seasons

## Known Issues & Workarounds

### Database Trigger Issues
If score saving fails with trigger errors:

```sql
-- Temporarily disable trigger if needed
DROP TRIGGER IF EXISTS update_matchup_results_trigger ON weekly_scores;

-- Import your data

-- Re-enable trigger
CREATE TRIGGER update_matchup_results_trigger
    AFTER INSERT OR UPDATE OR DELETE ON weekly_scores
    FOR EACH ROW EXECUTE FUNCTION update_matchup_results();
```

### Large Dataset Performance
For leagues with many seasons:

1. Import one season at a time
2. Use batch inserts (500 records max per statement)
3. Monitor database performance during import

### Division Configuration
When importing leagues with divisions:

```sql
-- Example division structure in league_seasons
UPDATE league_seasons 
SET divisions = '{
  "divisions": ["East", "West"],
  "division_config": {
    "East": ["Player1", "Player2", "Player3"],
    "West": ["Player4", "Player5", "Player6"]
  }
}'::jsonb
WHERE league_id = 'your-league' AND season = '2024';
```

## Support

If you encounter issues during import:
1. Check the verification queries in your script output
2. Review error messages for specific constraint violations  
3. Use the validation queries above to identify data inconsistencies
4. Refer to working examples in the `/scripts/examples/` directory
5. Test RPC functions with `get_season_standings` for validation
6. Use `matchup_results_with_scores` view for matchup-related queries

For technical support, refer to:
- `/docs/TECHNICAL_DOCUMENTATION.md` for architecture details
- `/docs/CLAUDE_CONTEXT.md` for development patterns
- `/CLAUDE.md` for essential commands and configuration