# Scripts Directory Guide

## Essential Scripts for Database Setup

### 📊 Database Schema (Required)
These scripts create the core database structure and should be run in order:

```bash
scripts/schema/
├── 01-create-tables.sql           # Core tables (leagues, members, scores)
├── 02-create-league-seasons.sql   # Season configuration table
├── 03-create-matchups.sql         # Matchups table
├── 04-add-playoff-columns.sql     # Playoff-specific columns
├── 05-add-final-winners.sql       # Season winners tracking
├── 06-create-views.sql            # matchup_results_with_scores view
└── 08-create-functions.sql        # get_season_standings RPC function
```

### 🔧 Database Functions (Required)
Core database functions that power the application:

```bash
scripts/functions/
├── get-season-standings.sql       # Main standings calculation
├── update-matchup-results.sql     # Trigger function for score updates
└── calculate-playoff-teams.sql    # Playoff seeding logic
```

### 🏗️ Initial Setup (Required)
Complete database setup for new installations:

```bash
scripts/setup/
├── complete-database-setup.sql   # Run this for fresh database setup
└── 02-historical-import-corrected.sql  # Template for importing historical data
```

## Data Import Templates

### 📋 League Templates (Use These)
Ready-to-use templates for importing league data:

```bash
scripts/templates/
├── create-new-league-template.sql     # Template for brand new league
├── import-league-template.sql         # Template for adding historical season
├── import-season-template.sql         # Template for single season import
└── import-matchups-template.sql       # Template for importing matchup schedules
```

### 📖 Season Setup Guides
Step-by-step guides and workflows:

```bash
scripts/season-setup/
├── README.md                          # Season setup overview
├── historical-import-workflow.md      # Complete import workflow
├── data-collection-worksheet.md       # Data organization guide
└── import-historical-season-template.sql  # Advanced import template
```

## Working Examples

### 🏈 Couchball Football League Examples
Real examples from the couchball-football league:

```bash
scripts/examples/couchball-football/
├── import-2021-season.sql    # Complete 2021 season data
├── import-2022-season.sql    # Complete 2022 season data
├── import-2023-season.sql    # Complete 2023 season data
└── README.md                 # Notes about this league's structure
```

### 🏆 Gridiron Gurus Examples (Historical)
Examples from the gridiron-gurus league:

```bash
scripts/examples/gridiron-gurus/
├── import-gridiron-2023-data.sql      # 2023 season import
├── complete-gridiron-2024-data.sql    # 2024 with full prizes
└── README.md                          # League-specific notes
```

## Validation & Maintenance

### ✅ Validation Scripts
Use these to verify data integrity after imports:

```bash
scripts/validation/
├── validate-season-data.sql         # Comprehensive season validation
├── check-matchup-integrity.sql      # Verify matchup data consistency
└── standings-verification.sql       # Validate standings calculations
```

### 🔧 Maintenance Scripts
Occasional maintenance and fixes:

```bash
scripts/fixes/
├── fix-duplicate-matchups.sql       # Remove duplicate matchup entries
├── fix-gridiron-2024-matchup-winners.sql  # Fix specific data issues
└── update-score-triggers.sql        # Update trigger functions
```

## Archive (Reference Only)

### 📦 Archived Scripts
Historical scripts kept for reference but not actively maintained:

```bash
scripts/archive/
├── 2024-specific/              # Old 2024-specific imports
├── one-time-migrations/        # Historical database migrations  
└── sample-data/               # Sample/test data (not real league data)
```

## Quick Start Guide

### For New Database Setup
1. Run scripts in `schema/` directory in numerical order (01, 02, 03, etc.)
2. Run `functions/` scripts to create database functions
3. Optionally run `setup/complete-database-setup.sql` for full setup

### For Importing Historical League Data
1. Use `templates/create-new-league-template.sql` for new league
2. Or use `templates/import-league-template.sql` for adding to existing league
3. Follow the guide in `season-setup/historical-import-workflow.md`
4. Validate with scripts in `validation/`

### For Reference and Examples
1. Check `examples/` for working real-world imports
2. Use `couchball-football/` examples for most recent patterns
3. Refer to `gridiron-gurus/` for historical examples

## Best Practices

### When Using These Scripts

1. **Always Backup First**: Create database backup before running import scripts
2. **Test with Sample Data**: Use templates and modify with your data
3. **Validate After Import**: Run validation scripts to check data integrity
4. **Follow Naming Conventions**: Use consistent league IDs and naming
5. **Check Examples**: Look at working examples before creating new scripts

### Script Naming Convention
- `01-`, `02-`, etc. = Order-dependent scripts (run in sequence)
- `create-` = Scripts that create new structures
- `import-` = Scripts that import data
- `fix-` = Scripts that fix specific issues
- `validate-` = Scripts that check data integrity

### Database Safety
- Use `ON CONFLICT` clauses for safe upserts
- Test scripts on copy of data first
- Use transactions for multi-step operations
- Validate results with provided validation scripts

---

*For detailed usage instructions, see `/docs/setup/IMPORTING_LEAGUES.md`*
*For technical details, see `/docs/TECHNICAL_DOCUMENTATION.md`*