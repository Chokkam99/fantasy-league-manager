#!/bin/bash
# Setup comprehensive testing framework for fantasy league manager

echo "Installing testing dependencies..."

# Install Jest and React Testing Library
npm install --save-dev jest @jest/environment-jsdom
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install --save-dev jest-environment-jsdom

# Install Supabase testing utilities
npm install --save-dev @supabase/supabase-js

# Install additional testing utilities
npm install --save-dev msw  # Mock Service Worker for API mocking
npm install --save-dev @types/jest

echo "Testing dependencies installed!"