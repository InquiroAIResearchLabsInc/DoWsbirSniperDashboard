@echo off
echo ============================================================
echo  INQUIRO SNIPER - FIRST SCRAPE (run this after START.bat)
echo ============================================================
echo.
echo This will scrape all sources and populate the database.
echo Expect 2-5 minutes for full run.
echo.

node -e "require('dotenv').config({ path: require('path').resolve('.env'), quiet: true }); process.exit(process.env.SAM_API_KEY ? 0 : 1)" 2>nul
IF ERRORLEVEL 1 (
  echo NOTE: SAM_API_KEY missing — SAM.gov will be skipped.
  echo Copy .env.example to .env and set SAM_API_KEY=..., or in Git Bash: export SAM_API_KEY=...
  echo.
)

node src/scrape.js --all

echo.
echo Done! Open http://localhost:3000 to view results.
pause
