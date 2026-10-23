@echo off
:: ReLeaf — double-click this file to open the site in your browser
:: No npm or Node required. Uses the pre-built dist/ folder.

set HTMLFILE=%~dp0frontend\dist\index.html

:: Try Chrome first (needs --allow-file-access-from-files for ES modules)
set CHROME="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% (
    start "" %CHROME% --allow-file-access-from-files "%HTMLFILE%"
    goto done
)

:: Try Edge
set EDGE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist %EDGE% (
    start "" %EDGE% --allow-file-access-from-files "%HTMLFILE%"
    goto done
)

:: Fallback: open with default browser (may show blank page if it blocks modules)
start "" "%HTMLFILE%"

:done
echo ReLeaf opened! If you see a blank page, run open-releaf-server.bat instead.
