# Project Structure

Fantasy League Manager is built with Next.js 15.5.2 using the App Router pattern and TypeScript.

## 📁 Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout component
│   ├── page.tsx           # Home page - league list
│   └── league/[id]/       # League-specific pages
│       ├── layout.tsx     # League layout
│       ├── page.tsx       # League home/dashboard
│       ├── players/       # Player management
│       ├── scores/        # Weekly scores
│       └── standings/     # League standings
├── components/            # Reusable React components
│   ├── CreateLeagueModal.tsx
│   ├── LeaguesList.tsx
│   ├── Standings.tsx
│   ├── WeeklyScores.tsx
│   └── ...
├── hooks/                 # Custom React hooks
│   └── useSeasonConfig.ts
├── lib/                   # Utilities and configurations
│   ├── supabase.ts       # Database client and types
│   ├── colors.ts         # UI color definitions
│   └── seasonUtils.ts    # Season-related utilities
└── ...
```

## 🏗️ Architecture Patterns

### **App Router (Next.js 15)**
- Server Components by default for better performance
- Client Components marked with `'use client'` directive
- Dynamic routing with `[id]` for league-specific pages
- Proper loading states and error boundaries

### **Database Layer**
- **Supabase** (PostgreSQL) for data storage
- **Real-time subscriptions** capability (not currently used)
- **RPC functions** for complex queries (`get_season_standings`)
- **Row Level Security** configured for multi-tenant access

### **State Management**
- React built-in state (`useState`, `useEffect`)
- Custom hooks for shared logic (`useSeasonConfig`)
- URL state management via Next.js routing
- Local storage for readonly mode persistence

### **Component Architecture**
- **Atomic design** principles
- **Props interfaces** for all components
- **Conditional rendering** based on readonly mode
- **Responsive design** with Tailwind CSS

## 🔧 Key Components

### **League Management**
- `LeaguesList.tsx` - Display all leagues
- `CreateLeagueModal.tsx` - New league creation
- `league/[id]/page.tsx` - League dashboard

### **Player Management**
- `players/page.tsx` - Player roster management
- `AddMemberModal.tsx` - Add new players
- `PlayerParticipationHistory.tsx` - Multi-season tracking

### **Scoring & Standings**
- `WeeklyScores.tsx` - Score input and management
- `Standings.tsx` - League standings calculation
- `get_season_standings` - Database function for complex standings

### **UI Components**
- `SeasonSelector.tsx` - Season switching
- `ShareButton.tsx` - League sharing functionality
- `SeasonBadges.tsx` - Visual season indicators

## 📊 Data Flow

1. **League Selection**: User selects league from home page
2. **Season Loading**: `useSeasonConfig` fetches season configuration
3. **Data Fetching**: Components fetch specific data (members, scores, etc.)
4. **State Updates**: UI updates based on loaded data
5. **User Actions**: CRUD operations sync to Supabase
6. **Real-time Updates**: Components refetch after mutations

## 🔐 Security & Access Control

### **Readonly Mode**
- URL-based activation (`?readonly=true`)
- localStorage persistence across sessions
- Navigation restrictions to prevent edit access
- Consistent UI state across all pages

### **Environment Variables**
- Database credentials in `.env.local` (excluded from Git)
- Public keys safe for frontend exposure
- Separate configs for development/production

## 🎨 Styling

### **Tailwind CSS**
- Utility-first CSS framework
- Custom color system in `colors.ts`
- Responsive design patterns
- Component-scoped styling

### **Color System**
- **Claude theme**: Primary blues and grays
- **Status colors**: Payment states, readonly indicators
- **Semantic colors**: Success, warning, error states

## 🗄️ Database Schema

### **Core Tables**
- `leagues` - League information
- `league_members` - Player rosters per season
- `league_seasons` - Season-specific configuration
- `weekly_scores` - Individual player scores
- `matchups` - Head-to-head matchups

### **Key Features**
- **Multi-season support**: Players can participate across multiple seasons
- **Flexible prize structures**: Configurable payouts per season  
- **Historical tracking**: Full season and player history
- **Complex standings**: Automated calculations via database functions

## 📱 User Experience

### **Responsive Design**
- Mobile-first approach
- Tablet and desktop layouts
- Touch-friendly interfaces
- Accessible navigation

### **Performance**
- Server-side rendering for initial load
- Client-side navigation for interactions
- Optimized database queries
- Lazy loading where appropriate

This architecture provides a scalable, maintainable foundation for fantasy league management with room for future enhancements like real-time updates, advanced analytics, and mobile applications.