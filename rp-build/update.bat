@echo off
echo Role Planner — Update
echo =====================
cd /d "%~dp0"
echo Copying updated files...
xcopy /E /Y /I "%~dp0src" "%~dp0src" >nul 2>&1
echo Done. Please restart Role Planner.
pause
