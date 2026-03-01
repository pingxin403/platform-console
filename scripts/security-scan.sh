#!/bin/bash

# Security Vulnerability Scanning Script
# 
# This script runs comprehensive security scans on the Internal Developer Platform
# including dependency vulnerability scanning, license compliance, and security best practices.

set -e

echo "========================================="
echo "Security Vulnerability Scanning"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in CI
CI_MODE=${CI:-false}

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "success")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "warning")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "error")
            echo -e "${RED}✗${NC} $message"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

# Function to run npm audit
run_npm_audit() {
    echo "1. Running npm audit..."
    echo "-----------------------------------"
    
    if npm audit --audit-level=moderate; then
        print_status "success" "npm audit passed - no moderate or higher vulnerabilities found"
        return 0
    else
        print_status "error" "npm audit failed - vulnerabilities found"
        echo ""
        echo "Run 'npm audit fix' to automatically fix vulnerabilities"
        echo "Run 'npm audit fix --force' to fix breaking changes"
        return 1
    fi
}

# Function to check for outdated dependencies
check_outdated() {
    echo ""
    echo "2. Checking for outdated dependencies..."
    echo "-----------------------------------"
    
    if npm outdated; then
        print_status "warning" "Some dependencies are outdated"
        echo "Run 'npm update' to update dependencies"
    else
        print_status "success" "All dependencies are up to date"
    fi
}

# Function to check for security best practices
check_security_config() {
    echo ""
    echo "3. Checking security configuration..."
    echo "-----------------------------------"
    
    local issues=0
    
    # Check for required environment variables in .env.example
    if [ -f ".env.example" ]; then
        print_status "success" "Found .env.example file"
        
        # Check for encryption key
        if grep -q "ENCRYPTION_MASTER_KEY" .env.example; then
            print_status "success" "ENCRYPTION_MASTER_KEY documented"
        else
            print_status "warning" "ENCRYPTION_MASTER_KEY not documented in .env.example"
            issues=$((issues + 1))
        fi
        
        # Check for backend secret
        if grep -q "BACKEND_SECRET" .env.example; then
            print_status "success" "BACKEND_SECRET documented"
        else
            print_status "warning" "BACKEND_SECRET not documented in .env.example"
            issues=$((issues + 1))
        fi
    else
        print_status "warning" ".env.example file not found"
        issues=$((issues + 1))
    fi
    
    # Check for security hardening documentation
    if [ -f "packages/backend/src/plugins/common/SECURITY_HARDENING.md" ]; then
        print_status "success" "Security hardening documentation found"
    else
        print_status "warning" "Security hardening documentation not found"
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        print_status "success" "Security configuration checks passed"
        return 0
    else
        print_status "warning" "Security configuration has $issues issue(s)"
        return 1
    fi
}

# Function to check for sensitive data in code
check_sensitive_data() {
    echo ""
    echo "4. Checking for sensitive data in code..."
    echo "-----------------------------------"
    
    local issues=0
    
    # Check for hardcoded passwords
    if git grep -i "password.*=.*['\"]" -- '*.ts' '*.js' '*.tsx' '*.jsx' | grep -v "test" | grep -v "example" | grep -v "placeholder"; then
        print_status "error" "Potential hardcoded passwords found"
        issues=$((issues + 1))
    fi
    
    # Check for hardcoded API keys
    if git grep -i "api[_-]key.*=.*['\"]" -- '*.ts' '*.js' '*.tsx' '*.jsx' | grep -v "test" | grep -v "example" | grep -v "placeholder"; then
        print_status "error" "Potential hardcoded API keys found"
        issues=$((issues + 1))
    fi
    
    # Check for hardcoded tokens
    if git grep -i "token.*=.*['\"]" -- '*.ts' '*.js' '*.tsx' '*.jsx' | grep -v "test" | grep -v "example" | grep -v "placeholder" | grep -v "Bearer"; then
        print_status "error" "Potential hardcoded tokens found"
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        print_status "success" "No sensitive data found in code"
        return 0
    else
        print_status "error" "Found $issues potential sensitive data issue(s)"
        return 1
    fi
}

# Function to generate security report
generate_report() {
    echo ""
    echo "5. Generating security report..."
    echo "-----------------------------------"
    
    local report_file="security-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Security Scan Report"
        echo "===================="
        echo "Date: $(date)"
        echo "Repository: $(git remote get-url origin 2>/dev/null || echo 'Unknown')"
        echo "Branch: $(git branch --show-current 2>/dev/null || echo 'Unknown')"
        echo "Commit: $(git rev-parse HEAD 2>/dev/null || echo 'Unknown')"
        echo ""
        echo "npm audit results:"
        npm audit --json 2>/dev/null || echo "npm audit failed"
        echo ""
        echo "Outdated dependencies:"
        npm outdated --json 2>/dev/null || echo "No outdated dependencies"
    } > "$report_file"
    
    print_status "success" "Security report generated: $report_file"
}

# Main execution
main() {
    local exit_code=0
    
    # Run all checks
    run_npm_audit || exit_code=1
    check_outdated || true  # Don't fail on outdated dependencies
    check_security_config || true  # Don't fail on config issues
    check_sensitive_data || exit_code=1
    
    # Generate report
    if [ "$CI_MODE" = "true" ]; then
        generate_report
    fi
    
    echo ""
    echo "========================================="
    if [ $exit_code -eq 0 ]; then
        print_status "success" "Security scan completed successfully"
    else
        print_status "error" "Security scan completed with errors"
    fi
    echo "========================================="
    
    exit $exit_code
}

# Run main function
main
