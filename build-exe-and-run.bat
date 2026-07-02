@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo === DayZ IDE: build Windows EXE and run ===
echo Project: %CD%
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd was not found. Install Node.js first.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo ERROR: package.json was not found. Run this script from the project root.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing npm dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Repairing Electron install...
  pushd "node_modules\electron"
  call node install.js
  popd
  if errorlevel 1 (
    echo ERROR: Electron install repair failed.
    pause
    exit /b 1
  )
)

echo.
echo Bumping app version...
call npm.cmd version patch --no-git-tag-version
if errorlevel 1 (
  echo ERROR: App version bump failed.
  pause
  exit /b 1
)

if exist "dist" (
  echo.
  echo Removing old dist...
  rmdir /s /q "dist"
  if exist "dist" (
    echo ERROR: Could not remove old dist folder.
    pause
    exit /b 1
  )
)

echo.
echo Building installer and portable EXE...
call npm.cmd run electron:dist
if errorlevel 1 (
  echo ERROR: Electron build failed.
  pause
  exit /b 1
)

set "APP_EXE="

for /f "delims=" %%F in ('dir /b /a-d /o-d "dist\DayZ IDE *.exe" 2^>nul ^| findstr /v /i "Setup"') do (
  if not defined APP_EXE set "APP_EXE=%CD%\dist\%%F"
)

if not defined APP_EXE (
  if exist "dist\win-unpacked\DayZ IDE.exe" set "APP_EXE=%CD%\dist\win-unpacked\DayZ IDE.exe"
)

if not defined APP_EXE (
  echo ERROR: Built EXE was not found under dist.
  pause
  exit /b 1
)

echo.
echo Starting:
echo !APP_EXE!
start "" "!APP_EXE!"

echo.
echo Done.
exit /b 0
