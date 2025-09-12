// Color constants for the fantasy league manager app
// Update these variables to easily change the entire app's color scheme

export const COLORS = {
  // Primary theme colors
  primary: {
    bg: 'bg-orange-500 text-white',
    bgHover: 'bg-orange-600 text-white',
    text: 'text-orange-600',
    textHover: 'text-orange-700',
    border: 'border-orange-200',
    light: 'bg-orange-50',
  },
  
  // Status colors
  success: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    textDark: 'text-green-800',
    bgDark: 'bg-green-600',
  },
  
  warning: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    textDark: 'text-yellow-800',
  },
  
  info: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    textDark: 'text-blue-800',
    bgLight: 'bg-blue-50',
  },
  
  error: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    textDark: 'text-red-800',
  },
  
  // Neutral colors
  neutral: {
    bg: 'bg-white',
    bgLight: 'bg-gray-50',
    bgDark: 'bg-gray-100',
    text: 'text-gray-900',
    textLight: 'text-gray-600',
    textSecondary: 'text-gray-500',
    border: 'border-gray-200',
    borderLight: 'border-gray-100',
  },
  
  // Prize-specific colors
  prizes: {
    weekly: {
      bg: 'bg-green-100',
      text: 'text-green-700',
    },
    firstPlace: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
    },
    secondPlace: {
      bg: 'bg-gray-100', 
      text: 'text-gray-800',
    },
    thirdPlace: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
    },
    highestPoints: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
    },
  },
  
  // Rank colors
  ranks: {
    first: 'bg-yellow-100 text-yellow-800',
    second: 'bg-gray-100 text-gray-800', 
    third: 'bg-orange-100 text-orange-800',
    other: 'bg-blue-50 text-blue-700',
  },
  
  // Payment status colors
  payment: {
    paid: 'bg-green-100 text-green-800 hover:bg-green-200',
    pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  },
}

// Helper function to get combined classes
export const getColorClasses = (category: keyof typeof COLORS, variant?: string): string | object => {
  const colorGroup = COLORS[category]
  if (!variant) return colorGroup
  return (colorGroup as Record<string, unknown>)[variant] || colorGroup
}

// CSS custom properties for dynamic theming (optional advanced feature)
export const CSS_VARIABLES = {
  '--color-primary': '#f97316', // orange-500
  '--color-primary-hover': '#ea580c', // orange-600
  '--color-success': '#22c55e', // green-500
  '--color-warning': '#eab308', // yellow-500
  '--color-error': '#ef4444', // red-500
  '--color-info': '#3b82f6', // blue-500
}