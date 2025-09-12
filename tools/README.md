# Fantasy League Manager Tools

This directory contains utility scripts and tools for database management and data processing.

## 🛠️ Database Utilities (`database-utils/`)

### JavaScript Tools
- `import-via-supabase.js` - Import league data directly via Supabase client
- `validate-import-data.js` - Validate league data before import
- `insert-2024-data.js` - 2024-specific data insertion script

### Usage
These tools require Node.js and the project dependencies:

```bash
# Install dependencies
npm install

# Run a utility (example)
node tools/database-utils/validate-import-data.js
```

## 🔧 Environment Setup
These tools use the same environment configuration as the main application:
- Requires `.env` file with Supabase configuration
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📝 Adding New Tools
When adding new utility tools:
1. Place database-related utilities in `database-utils/`
2. Create new subdirectories for different tool categories as needed
3. Update this README with new tool descriptions
4. Include usage examples and requirements