# Integration Tests

This directory contains comprehensive integration tests for the Fantasy League Manager application. These tests verify end-to-end functionality across multiple layers of the application.

## Test Categories

### 1. League Management Integration Tests (`league-management.integration.test.ts`)

**Purpose**: Test complete league lifecycle workflows including creation, member management, and data integrity.

**Test Coverage**:
- League creation and setup
- Season configuration
- Member management across seasons
- Weekly score imports and calculations
- Matchup creation and result calculation
- Season transitions and data continuity
- Error handling and constraint validation

**Key Scenarios**:
- Creating a new league with complete setup
- Importing weekly scores and calculating standings
- Managing matchups and determining winners
- Handling multi-season member continuity
- Validating database constraints and foreign keys

### 2. API Endpoints Integration Tests (`api-endpoints.integration.test.ts`)

**Purpose**: Test API layer functionality including data fetching, mutations, and error handling.

**Test Coverage**:
- League data fetching and transformation
- Score management API operations
- Matchup management workflows
- Season configuration updates
- Authentication and authorization
- Error handling and validation
- Performance and rate limiting considerations

**Key Scenarios**:
- Handling league data requests with proper structure validation
- Processing batch score imports with validation
- Managing matchup creation and result calculations
- Configuring season settings and playoff structures
- Validating request formats and constraints
- Testing concurrent operations and data consistency

### 3. UI Workflows Integration Tests (`ui-workflows.integration.test.tsx`)

**Purpose**: Test user interface interactions and complete user workflows.

**Test Coverage**:
- League creation and management workflows
- Score entry and form validation
- Navigation and routing behavior
- Responsive design and mobile interactions
- Error states and loading states
- Real-time data synchronization

**Key Scenarios**:
- Complete league creation form workflow with validation
- Member management with inline editing capabilities
- Weekly score entry with validation and error handling
- Season navigation with URL updates and data loading
- Responsive navigation behavior across device sizes
- Network error handling with retry mechanisms

## Test Configuration

### Integration Test Configuration (`jest.integration.config.js`)

**Features**:
- Extended test timeout (30 seconds) for complex workflows
- Dedicated coverage collection for integration scenarios
- Custom environment setup for Supabase integration
- Module name mapping for clean imports

### Global Setup and Teardown

**Setup (`jest.integration.setup.js`)**:
- Environment variable configuration
- Test data cleanup before test runs
- Supabase client initialization

**Teardown (`jest.integration.teardown.js`)**:
- Cleanup of test data after completion
- Database state restoration

## Running Integration Tests

### Command Options

```bash
# Run all integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Run integration tests with coverage report
npm run test:integration:coverage

# Run both unit and integration tests
npm run test:all
```

### Individual Test Files

```bash
# Run specific integration test file
npx jest src/__tests__/integration/league-management.integration.test.ts

# Run with verbose output
npx jest src/__tests__/integration/ --verbose

# Run with coverage for integration tests only
npx jest src/__tests__/integration/ --coverage
```

## Test Data Management

### Test League IDs
- `test-league-integration` - League management tests
- `test-api-league` - API endpoint tests  
- `test-ui-league` - UI workflow tests

### Data Isolation
- Each test suite uses unique identifiers
- Automatic cleanup before and after test runs
- Database state restoration between test executions

### Mock Data Patterns
- Consistent member names and team structures
- Realistic score distributions (100-200 point range)
- Proper season year formats (YYYY)
- Valid playoff configurations

## Environment Requirements

### Database Setup
- Supabase instance with proper schema
- Test environment variables configured
- Database functions (`get_season_standings`) available

### Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key # For admin operations
```

## Test Patterns and Best Practices

### 1. Test Structure
```typescript
describe('Feature Integration Tests', () => {
  beforeAll(async () => {
    // Setup test environment
  })

  afterAll(async () => {
    // Cleanup test data
  })

  describe('Specific Workflow', () => {
    test('should handle complete workflow', async () => {
      // Arrange: Set up test data
      // Act: Execute workflow
      // Assert: Verify results and side effects
    })
  })
})
```

### 2. Async Testing
- Use `waitFor` for async operations
- Proper timeout handling for database operations
- Error boundary testing for failed operations

### 3. Data Validation
- Verify database state changes
- Check API response structures
- Validate UI state updates

### 4. Error Simulation
- Network failure scenarios
- Database constraint violations
- Invalid input handling

## Coverage Goals

### Minimum Coverage Targets
- **Branches**: 60%
- **Functions**: 60%
- **Lines**: 60%
- **Statements**: 60%

### Focus Areas
- Critical user workflows (league creation, score management)
- Data integrity operations (imports, calculations)
- Error handling and recovery
- Cross-component interactions

## Debugging Integration Tests

### Common Issues

1. **Database Connection Failures**
   - Verify environment variables
   - Check Supabase instance availability
   - Ensure proper permissions

2. **Test Data Conflicts**
   - Check for duplicate test league IDs
   - Verify cleanup operations
   - Review test isolation

3. **Timeout Issues**
   - Increase test timeout for complex operations
   - Check for hanging promises
   - Verify async/await usage

### Debug Tools

```bash
# Run with debug output
DEBUG=* npm run test:integration

# Run single test with verbose output
npx jest --testNamePattern="specific test" --verbose

# Check test coverage details
npm run test:integration:coverage
```

## CI/CD Integration

### GitHub Actions Configuration
```yaml
- name: Run Integration Tests
  run: npm run test:integration
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Pre-deployment Checks
- All integration tests must pass
- Coverage thresholds must be met
- No test data leakage to production

## Maintenance

### Regular Tasks
- Update test data when schema changes
- Review and update mock patterns
- Verify environment variable usage
- Check test execution times

### Adding New Tests
1. Follow existing naming conventions
2. Use appropriate test league IDs
3. Include proper cleanup
4. Document test scenarios
5. Update coverage expectations

## Related Documentation

- **Unit Tests**: `src/components/__tests__/`, `src/lib/__tests__/`
- **API Documentation**: `/docs/TECHNICAL_DOCUMENTATION.md`
- **Database Schema**: `/scripts/schema/`
- **Setup Guide**: `/docs/USER_GUIDE.md`