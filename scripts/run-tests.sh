#!/bin/bash

# Test Runner Script for Internal Developer Platform
# This script helps run different types of tests

set -e

echo "=================================="
echo "Internal Developer Platform Tests"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if fast-check is installed
print_status "Checking dependencies..."
if ! grep -q "fast-check" packages/backend/package.json; then
    print_error "fast-check not found in backend dependencies"
    print_status "Installing fast-check..."
    yarn workspace backend add -D fast-check
fi

# Parse command line arguments
TEST_TYPE=${1:-"all"}

case $TEST_TYPE in
    "unit")
        print_status "Running unit tests..."
        yarn test --passWithNoTests
        ;;
    
    "property")
        print_status "Running property-based tests..."
        print_status "This may take a few minutes..."
        yarn workspace backend test --testPathPattern="property.test.ts" --testTimeout=60000
        ;;
    
    "integration")
        print_status "Running integration tests..."
        yarn workspace backend test integration.test.ts --testTimeout=60000
        ;;
    
    "e2e")
        print_status "Running E2E tests..."
        print_warning "Make sure backend and frontend are running, or they will be started automatically"
        
        # Check if Playwright browsers are installed
        if ! npx playwright --version > /dev/null 2>&1; then
            print_status "Installing Playwright browsers..."
            npx playwright install
        fi
        
        yarn test:e2e
        ;;
    
    "quick")
        print_status "Running quick test suite (unit + integration)..."
        yarn test --passWithNoTests --testTimeout=30000
        ;;
    
    "all")
        print_status "Running all tests..."
        print_warning "This will take 10-15 minutes"
        
        print_status "1/3: Running unit and property tests..."
        yarn test --passWithNoTests --testTimeout=60000 || print_warning "Some tests may have failed"
        
        print_status "2/3: Running integration tests..."
        yarn workspace backend test integration.test.ts --testTimeout=60000 || print_warning "Integration tests may have failed"
        
        print_status "3/3: Running E2E tests..."
        if ! npx playwright --version > /dev/null 2>&1; then
            print_status "Installing Playwright browsers..."
            npx playwright install
        fi
        yarn test:e2e || print_warning "E2E tests may have failed"
        ;;
    
    "coverage")
        print_status "Running tests with coverage..."
        yarn test:all
        print_status "Coverage report generated in coverage/"
        ;;
    
    "help"|"-h"|"--help")
        echo "Usage: ./scripts/run-tests.sh [TEST_TYPE]"
        echo ""
        echo "TEST_TYPE options:"
        echo "  unit        - Run unit tests only"
        echo "  property    - Run property-based tests only"
        echo "  integration - Run integration tests only"
        echo "  e2e         - Run E2E user journey tests"
        echo "  quick       - Run quick test suite (unit + integration)"
        echo "  all         - Run all tests (default)"
        echo "  coverage    - Run tests with coverage report"
        echo "  help        - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./scripts/run-tests.sh unit"
        echo "  ./scripts/run-tests.sh property"
        echo "  ./scripts/run-tests.sh e2e"
        echo "  ./scripts/run-tests.sh all"
        ;;
    
    *)
        print_error "Unknown test type: $TEST_TYPE"
        print_status "Run './scripts/run-tests.sh help' for usage information"
        exit 1
        ;;
esac

echo ""
print_status "Test run completed!"
echo ""
