@echo off
REM Test runner script for Flowchart Machine extension (Windows)

echo 🧪 Running Flowchart Machine Extension Tests
echo ==============================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root.
    exit /b 1
)

REM Function to run tests
:run_tests
set test_type=%1
set test_path=%2

echo.
echo 🔍 Running %test_type% tests...
echo ----------------------------------------

if "%test_type%"=="unit" (
    npm run test
) else if "%test_type%"=="lint" (
    npm run lint
) else if "%test_type%"=="compile" (
    npm run compile
) else if "%test_type%"=="all" (
    echo 📦 Compiling TypeScript...
    npm run compile
    
    echo 🔍 Running linter...
    npm run lint
    
    echo 🧪 Running tests...
    npm run test
) else (
    echo ❌ Unknown test type: %test_type%
    exit /b 1
)

if %errorlevel% equ 0 (
    echo ✅ %test_type% tests passed!
) else (
    echo ❌ %test_type% tests failed!
    exit /b 1
)
goto :eof

REM Function to show help
:show_help
echo Usage: %0 [OPTION]
echo.
echo Options:
echo   unit      Run unit tests only
echo   lint      Run linter only
echo   compile   Compile TypeScript only
echo   all       Run all checks (compile, lint, test)
echo   help      Show this help message
echo.
echo Examples:
echo   %0 unit      # Run only unit tests
echo   %0 all       # Run all checks
echo   %0           # Run all checks (default)
goto :eof

REM Main script logic
if "%1"=="" goto :all
if "%1"=="unit" goto :unit
if "%1"=="lint" goto :lint
if "%1"=="compile" goto :compile
if "%1"=="all" goto :all
if "%1"=="help" goto :show_help
if "%1"=="-h" goto :show_help
if "%1"=="--help" goto :show_help

echo ❌ Unknown option: %1
goto :show_help

:unit
call :run_tests "unit" "unit tests"
goto :end

:lint
call :run_tests "lint" "linter"
goto :end

:compile
call :run_tests "compile" "TypeScript compilation"
goto :end

:all
call :run_tests "all" "all checks"
goto :end

:end
echo.
echo 🎉 All tests completed successfully!
