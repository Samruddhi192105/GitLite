@echo off
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%frontend"
call npm run build:java
if errorlevel 1 exit /b 1
cd /d "%PROJECT_ROOT%"
java -cp "%PROJECT_ROOT%frontend\.gitlite-classes" Main %*
