# Color Theme Guide

This document explains how to easily customize the fantasy league manager's color scheme.

## Quick Start

To change the entire app's colors, edit the constants in `/src/lib/colors.ts`:

```typescript
export const COLORS = {
  primary: {
    bg: 'bg-orange-500',        // Main background color
    bgHover: 'bg-orange-600',   // Hover state
    text: 'text-orange-600',    // Text color
    // ... more variants
  },
  // ... other color categories
}
```

## Color Categories

### 1. **Primary Theme** (`COLORS.primary`)
- Main brand colors used throughout the app
- Buttons, links, highlights
- **Current:** Orange theme

### 2. **Status Colors** (`COLORS.success`, `COLORS.warning`, `COLORS.info`, `COLORS.error`)
- Success: Green (payments, wins, positive actions)
- Warning: Yellow (pending states, cautions)
- Info: Blue (informational content)
- Error: Red (errors, failures)

### 3. **Prize Colors** (`COLORS.prizes`)
- `weekly`: Green badges for weekly wins (W1, W2, etc.)
- `firstPlace`: Yellow/Gold for 1st place winners
- `secondPlace`: Gray/Silver for 2nd place
- `thirdPlace`: Orange/Bronze for 3rd place
- `highestPoints`: Blue for "Highest Points For" award

### 4. **Rank Colors** (`COLORS.ranks`)
- Circular rank badges in standings table
- Different colors for 1st, 2nd, 3rd, and other positions

### 5. **Payment Status** (`COLORS.payment`)
- `paid`: Green styling for paid members
- `pending`: Yellow styling for pending payments

## Easy Color Schemes

### Blue Theme
Replace the primary colors with:
```typescript
primary: {
  bg: 'bg-blue-500',
  bgHover: 'bg-blue-600',
  text: 'text-blue-600',
  textHover: 'text-blue-700',
  border: 'border-blue-200',
  light: 'bg-blue-50',
},
```

### Purple Theme
```typescript
primary: {
  bg: 'bg-purple-500',
  bgHover: 'bg-purple-600',
  text: 'text-purple-600',
  textHover: 'text-purple-700',
  border: 'border-purple-200',
  light: 'bg-purple-50',
},
```

### Green Theme
```typescript
primary: {
  bg: 'bg-green-500',
  bgHover: 'bg-green-600',
  text: 'text-green-600',
  textHover: 'text-green-700',
  border: 'border-green-200',
  light: 'bg-green-50',
},
```

## Usage in Components

Components import and use the colors like this:

```typescript
import { COLORS } from '@/lib/colors'

// Example: Rank badge
<span className={`${
  team.rank === 1 ? COLORS.ranks.first :
  team.rank === 2 ? COLORS.ranks.second :
  team.rank === 3 ? COLORS.ranks.third :
  COLORS.ranks.other
}`}>
  {team.rank}
</span>

// Example: Prize badge
<span className={`${COLORS.prizes.weekly.bg} ${COLORS.prizes.weekly.text}`}>
  W{week}
</span>
```

## Files Using Colors

Currently updated to use color constants:
- `/src/app/league/[id]/standings/page.tsx` - Detailed standings
- `/src/components/Standings.tsx` - Quick standings
- `/src/app/league/[id]/page.tsx` - Main league page

## Advanced Customization

For more complex theming needs, you can:

1. **Add new color categories** to `COLORS` object
2. **Create theme variants** by duplicating the entire `COLORS` object
3. **Use CSS custom properties** (see `CSS_VARIABLES` in colors.ts)

## Tailwind CSS Colors

The system uses Tailwind CSS classes. Available color scales:
- `50` (lightest) to `950` (darkest)
- Example: `bg-blue-100`, `text-blue-700`, `border-blue-300`

Common Tailwind colors: `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `gray`

## Quick Reference

| Element | Current Color | Change In |
|---------|---------------|-----------|
| Primary buttons | Orange | `COLORS.primary` |
| Weekly win badges | Green | `COLORS.prizes.weekly` |
| 1st place badge | Yellow/Gold | `COLORS.prizes.firstPlace` |
| Payment status | Green/Yellow | `COLORS.payment` |
| Rank circles | Multi-color | `COLORS.ranks` |

Simply update the values in `/src/lib/colors.ts` and the entire app theme will change instantly!