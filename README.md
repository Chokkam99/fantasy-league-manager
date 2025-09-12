# Fantasy League Manager

A modern, full-featured web application for managing fantasy football leagues with multi-season support, player tracking, and comprehensive standings management.

![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

## ✨ Features

### 🏆 **League Management**
- Create and manage multiple fantasy leagues
- Multi-season support with historical data
- Configurable league settings and prize structures
- Season-specific member management

### 👥 **Player Management**
- Add/remove players from leagues
- Track player participation across multiple seasons
- Payment status tracking (paid/pending)
- Player history and performance analytics

### 📊 **Scoring & Standings**
- Weekly score input and management
- Automated standings calculations
- Playoff toggle for regular/postseason view
- Prize distribution tracking with weekly winners

### 🔗 **Sharing & Access Control**
- **View-only mode** for league sharing
- Readonly links with restricted navigation
- Season switching in shared leagues
- Mobile-responsive design

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (free tier available)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/fantasy-league-manager.git
cd fantasy-league-manager
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. **Set up the database**
   - Create a new Supabase project
   - Run the SQL scripts in `/scripts/schema/` to create tables
   - Run the functions in `/scripts/functions/` to set up stored procedures

5. **Start the development server**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application.

## 🏗️ Tech Stack

- **Framework**: Next.js 15.5.2 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4
- **Deployment**: Vercel (recommended)

## 📖 Documentation

- [**📚 Full Documentation**](./docs/) - Comprehensive guides and documentation
- [**🏗️ Project Structure**](./docs/development/PROJECT_STRUCTURE.md) - Architecture overview
- [**⚙️ Claude Code Config**](./CLAUDE.md) - Development commands and setup
- [**📊 Database Scripts**](./scripts/) - SQL schema and utilities
- [**🛠️ Utility Tools**](./tools/) - Database management scripts

## 🔧 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production  
npm run start    # Start production server
npm run lint     # Run ESLint
npm run typecheck # Run TypeScript checks
```

## 🗄️ Database Schema

The application uses PostgreSQL via Supabase with the following core tables:

- **`leagues`** - League information and settings
- **`league_seasons`** - Season-specific configuration  
- **`league_members`** - Player rosters per season
- **`weekly_scores`** - Individual player weekly scores
- **`matchups`** - Head-to-head game results

Key features include:
- Multi-season player tracking
- Automated standings calculations via `get_season_standings()` function
- Flexible prize structure configuration
- Historical data preservation

## 🎯 Key Features

### **Multi-Season Support**
Each league supports multiple seasons with independent:
- Player rosters and payment tracking
- Prize structures and league fees  
- Standings and scoring history
- Configuration settings

### **Readonly Mode** 
Share leagues with view-only access:
- URL-based activation (`?readonly=true`)
- Restricted navigation and editing
- Season switching enabled
- Persistent across browser sessions

### **Automated Standings**
Complex standings calculations include:
- Win/loss records from matchups
- Total points and weekly rankings  
- Prize distributions and winners
- Playoff vs. regular season views

### **Prize Management**
- Weekly high-scorer prizes
- Season-end payouts (1st, 2nd, 3rd)
- Highest points for season bonus
- Configurable prize structures per season

## 🚀 Deployment

The easiest way to deploy is via Vercel:

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on every push

For detailed deployment instructions, see the [documentation](./docs/).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- Create an issue for bug reports
- Check discussions for questions
- Review documentation for architecture details

---

**Built with ❤️ using Next.js, TypeScript, and Supabase**