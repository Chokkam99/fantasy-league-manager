const nextJest = require('next/jest')
const path = require('path')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: path.resolve(__dirname, '../../'),
})

// Custom Jest configuration for integration tests
const integrationConfig = {
  displayName: 'Integration Tests',
  rootDir: path.resolve(__dirname, '../../'),
  testMatch: [
    '<rootDir>/src/__tests__/integration/**/*.test.{js,jsx,ts,tsx}'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/integration/jest.integration.setup.test.js'],
  testEnvironment: 'jsdom',
  
  // Integration test specific configuration
  testTimeout: 30000, // Longer timeout for integration tests
  
  // Environment variables for integration tests
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },

  // Collect coverage from integration test files
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/components/__tests__/**',
    '!src/lib/__tests__/**',
    '!src/hooks/__tests__/**'
  ],

  // Coverage thresholds for integration tests
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },

  // Module name mapping for integration tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },

  // Setup for Supabase integration tests
  globalSetup: '<rootDir>/test/integration/jest.integration.setup.js',
  globalTeardown: '<rootDir>/test/integration/jest.integration.teardown.js'
}

// Export the Jest configuration
module.exports = createJestConfig(integrationConfig)