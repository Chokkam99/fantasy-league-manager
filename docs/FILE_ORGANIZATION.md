# File Organization and Git Strategy

This document outlines the project's file organization strategy and what gets committed to version control vs. what stays local.

## 📂 Directory Structure

### `/docs/` - Documentation
**Committed to Git:**
- ✅ `USER_GUIDE.md` - End-user implementation guide
- ✅ `TECHNICAL_DOCUMENTATION.md` - Comprehensive technical docs
- ✅ `setup/IMPORTING_LEAGUES.md` - League import guide
- ✅ `development/` - Development guides
- ✅ `troubleshooting/` - Common issues and solutions

**Local Only (Ignored):**
- 🚫 `CLAUDE_CONTEXT.md` - AI-specific context and patterns

### `/test/` - Test Infrastructure
**Committed to Git:**
- ✅ `integration/` - Integration test configuration and setup files
  - ✅ `jest.integration.config.js` - Jest configuration for integration tests
  - ✅ `jest.integration.setup.js` - Global test setup
  - ✅ `jest.integration.teardown.js` - Global test cleanup
  - ✅ `jest.integration.setup.test.js` - Test environment setup

### `/src/` - Application Source Code
**Committed to Git:**
- ✅ All source files including:
  - ✅ `components/` - React components
  - ✅ `lib/` - Utility libraries
  - ✅ `hooks/` - Custom React hooks
  - ✅ `app/` - Next.js app router pages
  - ✅ `__tests__/` - All test files (unit and integration)

### `/scripts/` - Database Scripts  
**Local Only (All Ignored):**
- 🚫 **Entire `/scripts/` directory** - Contains database schemas, functions, templates, and any real/sample data
- 🚫 All SQL files, setup scripts, examples, and archives

### `/data/` - Data Files
**Local Only (All Ignored):**
- 🚫 `historical-seasons/**/*.pdf` - Season PDF files
- 🚫 `historical-seasons/**/*.sql` - SQL imports with real data
- 🚫 `corrections/` - Data correction scripts

### Root Level Files
**Committed to Git:**
- ✅ `package.json` - Updated with new test scripts
- ✅ `.gitignore` - Updated with proper ignore rules
- ✅ All standard Next.js configuration files

**Local Only (Ignored):**
- 🚫 `CLAUDE.md` - Contains credentials and AI instructions
- 🚫 `.claude/` - Claude Code configuration directory

## 🔒 Security and Privacy Strategy

### What Gets Pushed to Repository
1. **User Documentation** - Helps other developers understand and use the system
2. **Technical Documentation** - Architecture, APIs, development workflows  
3. **Test Infrastructure** - Ensures code quality and functionality
4. **Source Code** - All application logic and components

### What Stays Local
1. **All Database Scripts** - Schema, functions, imports, templates (entire `/scripts/` directory)
2. **All Data Files** - PDFs, SQL imports, league information (entire `/data/` directory)
3. **AI-Specific Documentation** - Claude context, patterns, and instructions
4. **Credentials and Configuration** - Database passwords, API keys

## 📋 Git Ignore Rules

### Simple and Secure Ignore Patterns
```gitignore
# Ignore entire directories with sensitive data
scripts/
data/

# AI/Claude-specific documentation (keep local)
docs/CLAUDE_CONTEXT.md
.claude/
CLAUDE.md

# Standard Next.js and environment ignores
.env*
.next/
node_modules/
coverage/
```

## 🚀 Benefits of This Strategy

### For Open Source Sharing
- ✅ Complete technical documentation for new contributors
- ✅ Working test infrastructure for validation
- ✅ User guides for adoption
- ✅ Clean application source code

### For Maximum Privacy and Security
- 🔒 **Zero database content** - No schemas, functions, or data exposed
- 🔒 **Zero league data** - No member names, scores, or league information
- 🔒 **Zero credentials** - No database passwords, API keys, or configuration
- 🔒 **Zero AI context** - No Claude-specific instructions or patterns

### For Development Efficiency
- 🛠️ Local AI context preserved for continued development
- 🛠️ Real data available locally for testing
- 🛠️ Historical scripts available for debugging
- 🛠️ Proper separation of concerns

## 📝 Usage Guidelines

### For Developers
1. **Adding New Documentation**: User and technical docs go in `/docs/`, AI-specific docs stay local
2. **Database Scripts**: Schema and functions are shared, data imports stay local
3. **Test Files**: All tests go in appropriate `__tests__/` directories and get committed
4. **Configuration**: App config is shared, credentials and AI config stay local

### For Contributors
1. **Clone Repository**: Gets all necessary documentation and clean scripts
2. **Set Up Environment**: Follow `USER_GUIDE.md` for setup instructions
3. **Run Tests**: Use `npm run test:all` to verify functionality
4. **Contribute**: Follow patterns in `TECHNICAL_DOCUMENTATION.md`

### For League Administrators
1. **Local Setup**: Import your real data using templates in `/scripts/templates/`
2. **Data Privacy**: Your league data stays on your machine
3. **Updates**: Pull repository updates without losing your local data
4. **Backup**: Your local `.env` and `data/` directories contain all customizations

## 🔄 Maintenance

### Regular Tasks
- Review `.gitignore` when adding new file types
- Update documentation when making significant changes
- Verify sensitive data doesn't accidentally get committed
- Keep AI context documentation updated locally

### Adding New Features
- User-facing features should include documentation updates
- Database changes should include schema updates
- New test categories should follow existing patterns
- Configuration changes should be documented

---

*This file organization strategy ensures that the project can be shared openly while maintaining privacy and security for sensitive data and AI-specific configurations.*