# Fantasy League Database Scripts

This directory contains organized database scripts for managing fantasy football leagues.

## Directory Structure

```
scripts/
├── schema/                     # Initial database setup (run once)
│   ├── 01-create-tables.sql           # Basic table creation
│   ├── 02-create-league-seasons.sql   # League seasons table  
│   ├── 03-create-matchups.sql          # Matchups table + triggers
│   └── 04-add-playoff-columns.sql      # Playoff enhancements
├── functions/                  # Database functions & utilities
│   ├── standings-functions.sql         # get_season_standings, etc.
│   ├── matchup-functions.sql          # Matchup utility functions
│   └── playoff-functions.sql          # Championship winner detection
├── season-setup/              # Annual season setup templates
│   ├── new-season-template.sql        # Parameterized season setup
│   └── import-matchups-template.sql   # Matchup import template
└── archive/                   # Deprecated/historical scripts
    ├── 2024-specific/          # 2024 season specific imports
    ├── one-time-migrations/    # Database migrations/cleanups
    └── sample-data/            # Sample data generation scripts
```

## Usage Instructions

### Initial Database Setup (One-time)
Run these scripts in order for a fresh database:

1. `schema/01-create-tables.sql` - Creates basic tables
2. `schema/02-create-league-seasons.sql` - Creates season configuration table
3. `schema/03-create-matchups.sql` - Creates matchups table with triggers
4. `schema/04-add-playoff-columns.sql` - Adds playoff detection features
5. `functions/standings-functions.sql` - Installs standings calculation functions
6. `functions/matchup-functions.sql` - Installs matchup utility functions
7. `functions/playoff-functions.sql` - Installs championship detection functions

### Annual Season Setup Workflow

Each year, follow this process to set up a new season:

1. **Configure New Season**
   - Edit `season-setup/new-season-template.sql`
   - Update league name, season year, and prize structure
   - Run the script to create the season configuration

2. **Add League Members**
   - Manually add members through the web interface, or
   - Create a custom import script based on your data format

3. **Import Matchup Schedule**
   - Edit `season-setup/import-matchups-template.sql`
   - Replace the sample matchup data with your actual schedule
   - Ensure manager names exactly match those in league_members table
   - Run the script to import all matchups

4. **Season Operation**
   - Enter weekly scores through the web interface
   - Matchup results will be calculated automatically
   - Championship games will be detected automatically for medal display

### Key Features

- **Automatic Playoff Detection**: Scripts automatically mark playoff weeks and championship games
- **Flexible Prize Structure**: Each season can have different fee amounts and payouts
- **Championship Winner Detection**: Winners are automatically determined from championship game results
- **Template-Based Setup**: Reusable templates for consistent season setup

### Database Functions Available

After running the setup scripts, these functions will be available:

- `get_season_standings(league_id, season, include_playoffs)` - Calculate standings with playoff toggle
- `get_playoff_winners(league_id, season)` - Get championship results
- `mark_championship_games(league_id, season)` - Mark championship/3rd place games
- `get_weekly_winners(league_id, season, week)` - Get weekly top scorers

### Archive Directory

The `archive/` directory contains historical scripts that are no longer needed for regular operation but are preserved for reference:

- **2024-specific/**: Scripts used specifically for importing 2024 season data
- **one-time-migrations/**: Database cleanup and migration scripts that were run once
- **sample-data/**: Scripts for generating sample/test data during development

These archived scripts should not be deleted as they provide historical context for how data was imported and managed in previous seasons.