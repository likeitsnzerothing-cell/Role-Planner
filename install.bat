@echo off
echo ============================================
echo  Role Planner — Install
echo  Warren Dev
echo ============================================
echo.
cd /d "%~dp0"
echo Installing dependencies...
npm install
if %errorlevel% neq 0 (
  echo ERROR: npm install failed. Make sure Node.js is installed.
  pause
  exit /b 1
)
echo.
echo Done! Run launch.bat to start Role Planner.
pause
