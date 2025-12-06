# Fantasy League Manager

A modern web application for managing fantasy football leagues with multi-season support, automated ESPN score imports, and comprehensive standings tracking.

![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

## Features

- **Multi-League Management** - Track multiple fantasy leagues and seasons
- **Automated ESPN Imports** - Scheduled weekly score imports (Tuesdays 3 AM)
- **Division Support** - Organize teams into divisions with playoff seeding
- **Prize Tracking** - Configure and track season prizes and weekly winners
- **Readonly Sharing** - Share league standings with view-only access
- **Mobile Responsive** - Works great on all devices

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Supabase account (free tier available)
- Vercel account (optional, for deployment)

### 2. Setup Database

```bash
# Run the database setup script in your Supabase SQL Editor
psql "your-supabase-connection-string" -f database-setup.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Automated ESPN Imports

Enable automated weekly score imports from ESPN:

```bash
# 1. Generate CRON_SECRET
./scripts/setup-cron.sh

# 2. Configure your leagues in database
UPDATE leagues
SET espn_league_id = 'YOUR_ESPN_LEAGUE_ID',
    sync_status = 'active'
WHERE id = 'your-league-id';

# 3. Deploy to Vercel (cron runs Tuesdays at 3 AM Phoenix time)
git push origin main
```

**Testing locally:**
```bash
npm run dev
./scripts/test-cron.sh
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_ADMIN_PASSWORD`
   - `CRON_SECRET` (for automated imports)
4. Deploy!

Vercel will automatically configure the cron job from `vercel.json`.

## Project Structure

```
├── src/
│   ├── app/                 # Next.js app router pages
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utilities and configs
├── database-setup.sql       # Complete DB schema
├── migrations/             # Database migrations
├── scripts/                # Helper scripts
└── vercel.json             # Cron job configuration
```

## Key Features Explained

### Multi-Season Support
- Track multiple seasons per league
- Independent rosters, prizes, and settings per season
- Historical data preservation

### Automated Score Imports
- Weekly ESPN score imports (Tuesdays 3 AM)
- Automatic matchup creation
- Error tracking and notifications

### Division Standings
- Organize teams into divisions
- Division winners + wild card playoff spots
- Automatic playoff seed calculation

### Prize Management
- Weekly high scorer prizes
- Season-end payouts (1st, 2nd, 3rd, 4th)
- Highest/lowest weekly score bonuses
- Configurable prize structures

## Configuration

### League Setup
```sql
-- Create a league
INSERT INTO leagues (id, name) VALUES ('my-league', 'My Fantasy League');

-- Configure season
INSERT INTO league_seasons (league_id, season, playoff_start_week, prize_structure)
VALUES ('my-league', '2025', 14, '{"first": 500, "second": 300, "third": 150, "fourth": 50}'::jsonb);

-- Add members
INSERT INTO league_members (league_id, season, manager_name, team_name, division)
VALUES ('my-league', '2025', 'John Doe', 'The Champions', 'East');
```

### ESPN Integration
```sql
-- For public leagues
UPDATE leagues
SET espn_league_id = '123456',
    sync_status = 'active'
WHERE id = 'my-league';

-- For private leagues (add cookies)
UPDATE leagues
SET espn_league_id = '123456',
    espn_s2 = 'your-espn-s2-cookie',
    espn_swid = 'your-swid-cookie',
    sync_status = 'active'
WHERE id = 'my-league';
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
npm run test         # Run tests
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Supabase)
- **Styling:** Tailwind CSS 4
- **Deployment:** Vercel
- **Testing:** Jest + React Testing Library

## Known Issues & Roadmap

### Security (High Priority)
- **Admin Authentication**: Currently client-side only. Password visible in browser DevTools.
  - TODO: Implement proper server-side authentication with JWT/sessions

### Improvements
- React hooks dependency warnings in some components
- Test files have TypeScript errors (don't affect production)

## Support

- Create an issue for bug reports
- Check existing issues for solutions
- Review `database-setup.sql` for schema reference

## License

MIT License - Built with ❤️ for fantasy football commissioners

---

**Made by Rithvik Chokkam**
