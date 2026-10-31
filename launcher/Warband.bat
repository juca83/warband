@echo off
setlocal
title Warband Launcher

rem ================================================================
rem  Warband Launcher (Windows)
rem  - telecharge / met a jour le jeu depuis TON GitHub (juca83/warband)
rem  - puis ouvre la derniere version du jeu dans ton navigateur
rem  Pour changer de source, modifie REPO ou BRANCH ci-dessous.
rem ================================================================
set "REPO=https://github.com/juca83/warband.git"
set "BRANCH=main"
set "DEST=%LOCALAPPDATA%\Warband\warband"

echo.
echo   ===  WARBAND LAUNCHER  ===
echo   Source : %REPO%  (branche %BRANCH%)
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo   [!] Git n'est pas installe sur ce PC.
  echo       Installe "Git for Windows" ^(page ouverte dans ton navigateur^),
  echo       garde toutes les options par defaut, puis relance ce launcher.
  start "" "https://git-scm.com/download/win"
  pause
  exit /b 1
)

if not exist "%DEST%\.git" (
  echo   Premier lancement : telechargement du jeu...
  echo   ^(si une fenetre GitHub s'ouvre, connecte-toi avec ton compte^)
  if not exist "%LOCALAPPDATA%\Warband" mkdir "%LOCALAPPDATA%\Warband"
  git clone --branch "%BRANCH%" "%REPO%" "%DEST%"
  if errorlevel 1 (
    echo.
    echo   [!] Telechargement impossible. Verifie ta connexion internet
    echo       et que tu es bien connecte a ton compte GitHub.
    pause
    exit /b 1
  )
) else (
  echo   Recherche de mises a jour...
  git -C "%DEST%" remote set-url origin "%REPO%"
  git -C "%DEST%" fetch origin "%BRANCH%"
  if errorlevel 1 (
    echo   [!] Pas de connexion a GitHub : lancement de la version deja installee.
  ) else (
    git -C "%DEST%" checkout -q -f -B "%BRANCH%" "origin/%BRANCH%"
    echo   Jeu a jour.
  )
)

rem --- trouve le dossier de jeu le plus recent (Warband_Arena_vXX avec le plus grand XX)
set "GAME="
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "$d = Get-ChildItem -Directory -LiteralPath $env:DEST -Filter 'Warband_Arena_v*' | Where-Object { Test-Path (Join-Path $_.FullName 'index.html') } | Sort-Object { [int](($_.Name -replace '\D', '') + '0') } -Descending | Select-Object -First 1; if ($d) { $d.FullName }"`) do set "GAME=%%F"
if not defined GAME if exist "%DEST%\index.html" set "GAME=%DEST%"

if not defined GAME (
  echo   [!] Aucun dossier de jeu trouve dans %DEST%
  pause
  exit /b 1
)

echo   Lancement : %GAME%
start "" "%GAME%\index.html"
endlocal
exit /b 0
