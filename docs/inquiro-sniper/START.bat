@echo off
echo ============================================================
echo  INQUIRO SNIPER - STARTUP
echo ============================================================

REM -- Always reinstall to ensure Windows-native binaries --
echo [1/3] Installing dependencies (native build required)...
IF EXIST node_modules (
  echo Removing old node_modules...
  rmdir /s /q node_modules
)
REM Must use CALL: npm is npm.cmd; without CALL the parent batch never resumes.
call npm install
IF ERRORLEVEL 1 (
  echo.
  echo ERROR: npm install failed.
  echo Make sure Node.js is installed: https://nodejs.org
  echo If better-sqlite3 fails, install Windows Build Tools:
  echo   npm install -g windows-build-tools
  pause
  exit /b 1
)

REM -- Run calibration check --
echo.
echo [2/3] Running scoring calibration...
node src/scrape.js --calibrate

REM -- SAM.gov: warn if key missing from OS env and project .env (dotenv) --
node -e "require('dotenv').config({ path: require('path').resolve('.env'), quiet: true }); process.exit(process.env.SAM_API_KEY ? 0 : 1)" 2>nul
IF ERRORLEVEL 1 (
  echo.
  echo  NOTE: SAM_API_KEY missing — SAM.gov will be skipped.
  echo  Copy .env.example to .env and set SAM_API_KEY=..., or set it in your environment.
  echo.
)

REM -- Start scheduler + dashboard --
echo [3/3] Starting dashboard and scheduler...
echo  Open: http://localhost:3000
echo.
node src/scheduler.js

pause
