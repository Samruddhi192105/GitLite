@echo off
set "PROJECT_ROOT=%~dp0"
pushd "%PROJECT_ROOT%frontend"
call npm run build:java
if errorlevel 1 (
  popd
  exit /b 1
)
popd
java -cp "%PROJECT_ROOT%frontend\.gitlite-classes" Main %*
