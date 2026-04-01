@echo off
chcp 65001 >nul
REM Artillery Load Test Quick Start (Windows)
REM Target: https://babpleAlpha.slowflowsoft.com

setlocal enabledelayedexpansion

echo ================================================================
echo    Babple Artillery Load Test Quick Start
echo    Target: https://babpleAlpha.slowflowsoft.com
echo ================================================================
echo.

cd /d %~dp0

REM Step 1: Node.js Check
echo [Step 1] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

where npx >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npx is not found.
    echo Please reinstall Node.js.
    pause
    exit /b 1
)

echo Node.js: OK
echo.

REM Step 2: Artillery Installation Check
echo [Step 2] Checking Artillery installation...
if not exist "node_modules\artillery" (
    echo Artillery not found. Installing...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install Artillery.
        pause
        exit /b 1
    )
) else (
    echo Artillery: OK
)
echo.

REM Step 3: Environment Check
echo [Step 3] Checking environment...
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo Please create .env file with:
    echo   BASE_URL=https://babpleAlpha.slowflowsoft.com/api
    echo   TEST_EMAIL=dog026@naver.com
    echo   TEST_PASSWORD=Qwer1234!
    pause
    exit /b 1
)

REM Check AUTH_TOKEN
findstr /C:"AUTH_TOKEN=" .env | findstr /V /C:"AUTH_TOKEN=$" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] AUTH_TOKEN not found or empty.
    echo Getting token...
    powershell -ExecutionPolicy Bypass -File scripts\get-token.ps1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to get token.
        pause
        exit /b 1
    )
) else (
    echo Environment: OK
)
echo.

REM Step 4: Test Selection
:menu
echo [Step 4] Select test to run:
echo ----------------------------------------------------------------
echo  1. Feed Load Test          (5min, 1500 req, Basic)
echo  2. Recipe Detail Test      (4min, 500 req, Medium)
echo  3. Recipe Upload Test      (3min, 400 req, Creates Data!)
echo  4. Mixed Scenario          (12min, 4000 req, Recommended)
echo  5. Quick Test              (1min, Quick Check)
echo  6. Get New Token           (Update AUTH_TOKEN)
echo  7. View Last Report        (Open HTML Report)
echo  8. Exit
echo ----------------------------------------------------------------
echo.
set /p choice="Select (1-8): "

if "%choice%"=="1" goto :test_feed
if "%choice%"=="2" goto :test_detail
if "%choice%"=="3" goto :test_upload
if "%choice%"=="4" goto :test_mixed
if "%choice%"=="5" goto :test_quick
if "%choice%"=="6" goto :get_token
if "%choice%"=="7" goto :view_report
if "%choice%"=="8" goto :end
echo [ERROR] Invalid choice!
echo.
goto :menu

:test_feed
echo.
echo ================================================================
echo  Running Feed Load Test...
echo  Target: GET /api/recipes/feed
echo  Duration: ~5 minutes
echo  Expected: ~1500 requests
echo  Note: Rate limit (429) may occur after ~200 requests
echo ================================================================
echo.
call npm run test:feed
goto :done

:test_detail
echo.
echo ================================================================
echo  Running Recipe Detail Load Test...
echo  Target: GET /api/recipes/:id
echo  Duration: ~4 minutes
echo  Expected: ~500 requests
echo ================================================================
echo.
call npm run test:detail
goto :done

:test_upload
echo.
echo ================================================================
echo  WARNING: This will create actual data on the server!
echo  Test recipes will have title starting with "부하 테스트"
echo ================================================================
set /p confirm="Continue? (Y/N): "
if /i "%confirm%" NEQ "Y" (
    echo Test cancelled.
    echo.
    goto :menu
)
echo.
echo Running Recipe Upload Load Test...
call npm run test:upload
goto :done

:test_mixed
echo.
echo ================================================================
echo  Running Mixed Scenario Load Test...
echo  Simulating: Morning/Lunch/Dinner/Evening traffic
echo  Duration: ~12 minutes
echo  Expected: ~4000 requests
echo ================================================================
echo.
call npm run test:mixed
goto :done

:test_quick
echo.
echo ================================================================
echo  Running Quick Test...
echo  10 virtual users x 60 requests = 600 requests
echo  Duration: ~1 minute
echo ================================================================
echo.
for /f "tokens=2 delims==" %%a in ('findstr "AUTH_TOKEN=" .env') do set TOKEN=%%a
npx artillery quick --count 10 --num 60 https://babpleAlpha.slowflowsoft.com/api/recipes/feed -H "Authorization: Bearer %TOKEN%"
goto :done

:get_token
echo.
powershell -ExecutionPolicy Bypass -File scripts\get-token.ps1
echo.
goto :menu

:view_report
echo.
echo Opening latest report...
for /f %%i in ('dir /b /od results\*.json 2^>nul') do set LATEST=%%i
if defined LATEST (
    npx artillery report results\%LATEST%
) else (
    echo [ERROR] No test results found.
    echo Please run a test first.
)
echo.
goto :menu

:done
echo.
echo ================================================================
echo    Test Completed!
echo ================================================================
echo.
echo Generate HTML report:
echo    npm run report
echo.
echo Get new token:
echo    npm run token
echo.
echo See README.md for detailed guide.
echo.
set /p again="Run another test? (Y/N): "
if /i "%again%"=="Y" (
    echo.
    goto :menu
)

:end
echo.
echo Thank you for using Artillery Load Test!
echo.
pause
