@echo off
title Role Planner Updater - WARREN C.H.E
color 0A

echo.
echo  ============================================
echo   Role Planner Updater
echo   by Eddie Warren / WARREN C.H.E
echo  ============================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Please run this updater as Administrator.
    echo  [!] Right-click the file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

set INSTALL_DIR=C:\Program Files\RolePlanner

:: Check app is installed
if not exist "%INSTALL_DIR%" (
    echo  [!] Role Planner is not installed.
    echo  [!] Please run install.bat first.
    echo.
    pause
    exit /b 1
)

:: Close app if running
echo  [1/4] Closing Role Planner if open...
taskkill /F /IM "electron.exe" >nul 2>&1
taskkill /F /IM "Role Planner.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
echo        Done.

:: Copy new files (preserves AppData so saved data is untouched)
echo  [2/4] Copying updated files...
xcopy /E /I /Y "%~dp0src" "%INSTALL_DIR%\src" >nul
copy /Y "%~dp0package.json" "%INSTALL_DIR%\package.json" >nul
echo        Files updated.

:: Install any new dependencies
echo  [3/4] Checking dependencies...
cd /d "%INSTALL_DIR%"
call npm install >nul 2>&1
echo        Done.

echo  [4/4] Update complete!

echo.
echo  ============================================
echo   Update Successful!
echo   Your data (roles, tasks, reminders)
echo   has been preserved.
echo  ============================================
echo.

set /p LAUNCH=   Launch Role Planner now? (Y/N): 
if /i "%LAUNCH%"=="Y" (
    start "" "%INSTALL_DIR%\launch.bat"
)

echo.
echo   Thank you for using Role Planner - WARREN C.H.E
echo.
pause
