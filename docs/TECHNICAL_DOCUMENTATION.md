# Fantasy League Manager - Technical Documentation

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 15.5.2 with App Router, React 18, TypeScript
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Testing**: Jest with React Testing Library
- **Build**: Turbopack for development, standard Next.js build for production

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── league/[id]/       # Dynamic league pages
│   └── globals.css        # Global styles
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and configurations
│   ├── espn/             # ESPN API integration
│   ├── platform/         # Platform abstraction layer
│   └── supabase.ts       # Database client
├── data/                  # Static data and imports
├── docs/                  # Documentation
└── scripts/              # Database and utility scripts
```

## Database Schema

### Core Tables

#### `leagues`
- Primary entity representing a fantasy league
- Contains basic league information and settings
- References: `league_members`, `league_seasons`

#### `league_members`
- Individual participants in a league for a specific season
- Includes team names, divisions, and status
- Key for all score and matchup relationships

#### `league_seasons`
- Season-specific configuration (playoff spots, prize structure)
- Contains final winners and special prize recipients
- Links to league and provides season metadata

#### `weekly_scores`
- Individual player scores for each week
- Core data for standings calculations
- Supports playoff week flagging

#### `matchups`
- Week-by-week team pairings
- References two league members (team1, team2)
- No score data (calculated from weekly_scores)

### Views and Functions

#### `matchup_results_with_scores`
- **Purpose**: Automatically calculates matchup winners from weekly scores
- **Logic**: Joins matchups with weekly_scores to determine outcomes
- **Usage**: Preferred over direct matchups table queries

#### `get_season_standings(league_id, season, include_playoffs)`
- **Purpose**: Comprehensive standings calculation with wins/losses
- **Returns**: Wins, losses, ties, points, games played, weekly wins
- **Performance**: Optimized for complex standings logic

## API Architecture

### ESPN Integration
- **Proxy Pattern**: `/api/espn` route bypasses CORS restrictions
- **Authentication**: Supports both public and authenticated ESPN leagues
- **Data Mapping**: Robust name matching between ESPN and database records
- **Error Handling**: Graceful fallbacks for private leagues

### Platform Abstraction
- **Interface**: `PlatformImportService` for extensible platform support
- **Current Implementations**: ESPN (Yahoo, Sleeper ready for future)
- **Import Process**: Preview → Validate → Import workflow

## Component Architecture

### Page Components
- **Server Components**: Used for initial data loading where possible
- **Client Components**: Interactive features with `'use client'` directive
- **Dynamic Routing**: `[id]` patterns for league-specific pages

### Custom Hooks
- **`useSeasonConfig`**: Season-specific settings and metadata
- **`useTeamRecords`**: Win/loss calculations with caching
- **Performance**: Memoization and proper dependency management

### State Management
- **Local State**: React useState for component-specific data
- **URL State**: Season selection persisted in URL parameters
- **Database State**: Supabase real-time subscriptions where needed

## Data Flow

### Standings Calculation
1. **Data Sources**: `weekly_scores` + `matchup_results_with_scores`
2. **RPC Function**: `get_season_standings` for win/loss calculations
3. **Client Processing**: Prize calculations and ranking
4. **Rendering**: Optimized with useMemo for performance

### Score Management
1. **Input Validation**: Client-side number validation
2. **Upsert Operations**: Safe database updates with conflict resolution
3. **Trigger Updates**: Automatic matchup result calculations
4. **Error Handling**: User-friendly error messages with retry logic

### Season Switching
1. **URL Updates**: `router.replace()` for navigation
2. **Data Refresh**: Parallel fetching of season-specific data
3. **Loading States**: Prevents UI flicker during transitions
4. **Caching**: Efficient re-use of unchanged data

## Security & Performance

### Authentication
- **Admin Auth**: Environment variable based authentication
- **Read-only Mode**: URL parameter for public access
- **Route Protection**: Admin-only features properly gated

### Database Security
- **RLS Policies**: Row-level security on all tables
- **Parameterized Queries**: SQL injection prevention
- **Type Safety**: TypeScript interfaces for database operations

### Performance Optimizations
- **RPC Functions**: Complex calculations moved to database
- **Memoization**: React.useMemo and useCallback where appropriate
- **Parallel Loading**: Concurrent data fetching where possible
- **Static Generation**: Pre-rendered pages where applicable

## Testing Strategy

### Unit Tests
- **Components**: React Testing Library for component behavior
- **Utilities**: Jest for pure function testing
- **Hooks**: Custom hook testing with renderHook
- **Coverage**: Focus on critical business logic

### Integration Tests
- **Database**: Schema validation and function testing
- **API Routes**: End-to-end API testing
- **User Flows**: Multi-component interaction testing

### Testing Setup
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode for development
npm run test:coverage    # Generate coverage report
```

## Development Workflow

### Local Development
```bash
npm run dev              # Start development server
npm run build            # Production build
npm run lint             # ESLint checking
npm run typecheck        # TypeScript validation
```

### Database Development
```bash
# Supabase connection for local development
PGPASSWORD=xxx psql "postgresql://..." -c "SELECT * FROM leagues;"
```

### Code Standards
- **TypeScript Strict Mode**: No implicit any types
- **ESLint Configuration**: React and Next.js best practices
- **Prettier Integration**: Consistent code formatting
- **Git Hooks**: Pre-commit linting and type checking

## Deployment

### Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ADMIN_PASSWORD=your_admin_password
```

### Build Process
1. **TypeScript Compilation**: Strict type checking
2. **Next.js Build**: Static generation and optimization
3. **Asset Optimization**: Automatic image and bundle optimization
4. **Deployment**: Vercel, Netlify, or custom hosting

### Production Considerations
- **Database Connection Pooling**: Configured in Supabase
- **CDN Integration**: Static assets served via CDN
- **Error Monitoring**: Production error tracking
- **Performance Monitoring**: Core Web Vitals tracking

## Troubleshooting

### Common Issues

#### Build Errors
- **TypeScript Errors**: Check for implicit any types
- **Import Errors**: Verify file paths and exports
- **Environment Variables**: Ensure all required vars are set

#### Database Issues
- **Connection Problems**: Check Supabase credentials
- **RPC Function Errors**: Verify function signatures match calls
- **Permission Issues**: Check RLS policies and user roles

#### Performance Issues
- **Large Dataset Handling**: Use pagination for large leagues
- **Memory Leaks**: Proper cleanup in useEffect hooks
- **Slow Queries**: Monitor and optimize database queries

### Debug Tools
- **React DevTools**: Component tree and state inspection
- **Next.js DevTools**: Performance and bundle analysis
- **Database Logs**: Supabase dashboard query monitoring
- **Network Tab**: API request and response inspection

## Contributing

### Code Review Checklist
- [ ] TypeScript types properly defined
- [ ] Tests added for new features
- [ ] Documentation updated
- [ ] Performance impact considered
- [ ] Error handling implemented
- [ ] Mobile responsiveness verified

### Development Guidelines
1. **Follow existing patterns**: Maintain consistency with current codebase
2. **Write tests first**: TDD approach for new features
3. **Document complex logic**: Clear comments for business rules
4. **Performance conscious**: Consider impact of changes
5. **User experience**: Test from end-user perspective

---

*Last Updated: December 2024*
*Version: 1.0.0*