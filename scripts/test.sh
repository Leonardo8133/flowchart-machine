#!/bin/bash

# Test runner script for Flowchart Machine extension

echo "🧪 Running Flowchart Machine Extension Tests"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Function to run tests
run_tests() {
    local test_type=$1
    local test_path=$2
    
    echo ""
    echo "🔍 Running $test_type tests..."
    echo "----------------------------------------"
    
    if [ "$test_type" = "unit" ]; then
        npm run test
    elif [ "$test_type" = "lint" ]; then
        npm run lint
    elif [ "$test_type" = "compile" ]; then
        npm run compile
    elif [ "$test_type" = "all" ]; then
        echo "📦 Compiling TypeScript..."
        npm run compile
        
        echo "🔍 Running linter..."
        npm run lint
        
        echo "🧪 Running tests..."
        npm run test
    else
        echo "❌ Unknown test type: $test_type"
        exit 1
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ $test_type tests passed!"
    else
        echo "❌ $test_type tests failed!"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  unit      Run unit tests only"
    echo "  lint      Run linter only"
    echo "  compile   Compile TypeScript only"
    echo "  all       Run all checks (compile, lint, test)"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unit      # Run only unit tests"
    echo "  $0 all       # Run all checks"
    echo "  $0           # Run all checks (default)"
}

# Main script logic
case "${1:-all}" in
    "unit")
        run_tests "unit" "unit tests"
        ;;
    "lint")
        run_tests "lint" "linter"
        ;;
    "compile")
        run_tests "compile" "TypeScript compilation"
        ;;
    "all"|"")
        run_tests "all" "all checks"
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "❌ Unknown option: $1"
        show_help
        exit 1
        ;;
esac

echo ""
echo "🎉 All tests completed successfully!"
