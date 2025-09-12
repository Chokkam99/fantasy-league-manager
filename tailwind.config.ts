import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude's Color Theme - Fixed for better contrast
        claude: {
          primary: '#D97706',        // Warm orange (Claude's main brand color)
          'primary-dark': '#B45309', // Darker orange for pressed states
          secondary: '#92400E',      // Deep brown
          background: '#FFFFFF',     // Pure white background
          surface: '#FFFFFF',        // Pure white for cards
          text: '#1F2937',          // Dark gray for primary text (gray-800)
          'text-secondary': '#374151', // Medium gray for secondary text (gray-700) 
          'text-light': '#6B7280',     // Light gray for subtle text (gray-500)
          border: '#E5E7EB',        // Light gray for borders
          success: '#10B981',       // Green for success states
          error: '#EF4444',         // Red for errors
        },
        background: "#ffffff",      // Force white background
        foreground: "#1f2937",     // Force dark text
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;