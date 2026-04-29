@echo off
title Role Planner Installer - WARREN C.H.E
color 0A

echo.
echo  ============================================
echo   Role Planner v1.0.0
echo   by Eddie Warren / WARREN C.H.E
echo  ============================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Please run this installer as Administrator.
    echo  [!] Right-click the file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

:: Check Node.js is installed
echo  [1/5] Checking Node.js...
node -v >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Node.js not found. Please install it from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo        Node.js found.

:: Set install directory
set INSTALL_DIR=C:\Program Files\RolePlanner

echo  [2/5] Creating install directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
echo        Created: %INSTALL_DIR%

:: Copy files
echo  [3/5] Installing files...
xcopy /E /I /Y "%~dp0src" "%INSTALL_DIR%\src" >nul
copy /Y "%~dp0package.json" "%INSTALL_DIR%\package.json" >nul
copy /Y "%~dp0README.md" "%INSTALL_DIR%\README.md" >nul
copy /Y "%~dp0launch.bat" "%INSTALL_DIR%\launch.bat" >nul
echo        Files copied.

:: Install dependencies
echo  [4/5] Installing dependencies (this may take a minute)...
cd /d "%INSTALL_DIR%"
call npm install >nul 2>&1
echo        Dependencies installed.

:: Find electron path
set ELECTRON_PATH=%INSTALL_DIR%\node_modules\.bin\electron.cmd

:: Create desktop shortcut pointing to launch.bat via cmd
echo  [5/5] Creating shortcuts...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\Role Planner.lnk'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/c \"cd /d \"%INSTALL_DIR%\" && node_modules\.bin\electron .\"'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.WindowStyle = 7; $s.Description = 'Role Planner by WARREN C.H.E'; $s.Save()"

:: Create Start Menu shortcut
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Role Planner.lnk'); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/c \"cd /d \"%INSTALL_DIR%\" && node_modules\.bin\electron .\"'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.WindowStyle = 7; $s.Description = 'Role Planner by WARREN C.H.E'; $s.Save()"

echo        Desktop shortcut created.
echo        Start Menu entry created.

echo.
echo  ============================================
echo   Installation Complete!
echo   Role Planner has been installed to:
echo   %INSTALL_DIR%
echo.
echo   Launch from your Desktop shortcut
echo   or Start Menu
echo  ============================================
echo.

set /p LAUNCH=   Launch Role Planner now? (Y/N): 
if /i "%LAUNCH%"=="Y" (
    cd /d "%INSTALL_DIR%"
    start "" node_modules\.bin\electron .
)

echo.
echo   Thank you for using Role Planner - WARREN C.H.E
echo.
pause
