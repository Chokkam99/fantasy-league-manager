# Fantasy League Import Troubleshooting Guide

This guide helps resolve common issues encountered during league data imports.

## Quick Diagnosis

Run the validation script to identify issues:
```bash
psql "your-database-url" -f scripts/validation/validate-league-import.sql \
  -v league_id='your-league-id' -v season='your-season'
```

## Common Issues and Solutions

### 1. Regular Season Shows Wrong Game Count (❌ 6-8 games instead of 14)

**Symptoms:**
- Player participation showing incomplete win-loss records  
- Teams showing 6-8 regular season games instead of 14
- Missing weeks in matchup data

**Root Cause:** Incomplete import of regular season weeks 1-14

**Solution:**
```sql
-- Check which weeks are missing
SELECT generate_series(1,14) as week 
EXCEPT 
SELECT DISTINCT week_number FROM matchups 
WHERE league_id = 'your-league' AND season = 'your-season' 
AND week_number BETWEEN 1 AND 14
ORDER BY week;

-- Import missing weeks from ESPN PDF data
-- Follow the pattern from existing weeks
```

### 2. Playoff Toggle Shows Too Many Games (❌ 18+ games instead of 16-17)

**Symptoms:**
- Teams showing 18, 19, or 20+ total games
- Playoff toggle displaying incorrect counts
- Multiple matchups in same week for same team

**Root Cause:** Duplicate matchups or incorrect playoff structure

**Solution:**
```sql
-- Remove duplicate matchups
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY league_id, season, week_number, 
                     LEAST(team1_member_id, team2_member_id), 
                     GREATEST(team1_member_id, team2_member_id)
        ORDER BY id
    ) as rn
    FROM matchups 
    WHERE league_id = 'your-league' AND season = 'your-season'
)
DELETE FROM matchups WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

### 3. Matchup Winners Don't Match Scores (❌ Wrong standings)

**Symptoms:**
- Inconsistent standings calculations
- Winners showing opposite of actual scores
- Score mismatches between matchups and weekly_scores tables

**Root Cause:** Score entry errors or calculation mistakes

**Solution:**
```sql
-- Find score mismatches
SELECT m.week_number, t1.manager_name, 
       m.team1_score as matchup_score, ws1.points as weekly_score
FROM matchups m
JOIN league_members t1 ON m.team1_member_id = t1.id  
JOIN weekly_scores ws1 ON ws1.member_id = t1.id AND ws1.week_number = m.week_number
WHERE m.league_id = 'your-league' AND m.season = 'your-season'
  AND m.team1_score != ws1.points;

-- Fix by updating matchup scores to match weekly_scores
UPDATE matchups SET 
    team1_score = ws.points,
    winner_member_id = CASE 
        WHEN ws.points > team2_score THEN team1_member_id
        WHEN team2_score > ws.points THEN team2_member_id
        ELSE NULL
    END,
    is_tie = (ws.points = team2_score)
FROM weekly_scores ws
WHERE matchups.team1_member_id = ws.member_id 
  AND matchups.week_number = ws.week_number
  AND matchups.league_id = 'your-league' 
  AND matchups.season = 'your-season';
```

### 4. Player Participation History Shows Inaccurate Values

**Symptoms:**
- Wrong champion displayed  
- Incorrect playoff appearances
- Missing or wrong win-loss records

**Root Cause:** Incomplete matchup data or missing championship data

**Solution:**
```sql
-- Set correct championship winner
UPDATE league_seasons 
SET final_winners = jsonb_build_object(
    'champion', 'Champion Name',
    'runner_up', 'Runner-up Name',  
    'third_place', 'Third Place Name'
)
WHERE league_id = 'your-league' AND season = 'your-season';

-- Verify playoff seeding by regular season standings
WITH standings AS (
    SELECT lm.manager_name, COUNT(CASE WHEN m.winner_member_id = lm.id THEN 1 END) as wins,
           SUM(CASE WHEN m.team1_member_id = lm.id THEN m.team1_score ELSE m.team2_score END) as points
    FROM league_members lm
    LEFT JOIN matchups m ON (m.team1_member_id = lm.id OR m.team2_member_id = lm.id)
        AND m.week_number BETWEEN 1 AND 14
    WHERE lm.league_id = 'your-league' AND lm.season = 'your-season'
    GROUP BY lm.id, lm.manager_name
)
SELECT ROW_NUMBER() OVER (ORDER BY wins DESC, points DESC) as seed, 
       manager_name, wins, ROUND(points, 2) as points
FROM standings ORDER BY seed;
```

## Fantasy Football Structure Requirements

### Regular Season (Weeks 1-14)
- **14 games per team** (70 total matchups for 10-team league)
- **5 matchups per week** (10 teams ÷ 2 = 5 matchups)
- Each team plays every other team at least once

### Playoff Structure (Weeks 15-17)  
- **6 teams make playoffs** (seeds 1-6)
- **Top 2 seeds get BYE week 15** → play 2 playoff games (16 total)
- **Seeds 3-6 play week 15** → play 3 playoff games (17 total)  
- **Non-playoff teams** → play consolation games (17 total)

### Expected Game Counts
| Team Type | Regular Season | Playoff Games | Total Games |
|-----------|----------------|---------------|-------------|
| Top 2 Seeds | 14 | 2 | 16 |
| Other Teams | 14 | 3 | 17 |

## Validation Checklist

After fixing issues, verify:

- [ ] Each team has exactly 14 regular season games
- [ ] Total games are 16 (top 2 seeds) or 17 (all others)  
- [ ] No duplicate matchups in any week
- [ ] Matchup scores match weekly_scores table
- [ ] Championship winner is set correctly
- [ ] All playoff teams have proper bracket progression

## Prevention Tips

1. **Extract data systematically** - Go through ESPN PDF week by week
2. **Verify playoff structure** - Check that BYE week scores are included
3. **Cross-check scores** - Compare matchup results with weekly totals  
4. **Run validation early** - Test after importing each section
5. **Follow examples** - Use working scripts from `/scripts/examples/`

## Need Help?

1. Run the validation script: `/scripts/validation/validate-league-import.sql`
2. Check working examples: `/scripts/examples/gridiron-gurus/`
3. Review the main import guide: `/docs/setup/IMPORTING_LEAGUES.md`