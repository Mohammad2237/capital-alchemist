# Builds the browser version (WebGL + WebXR) into Builds/Web and copies it to docs/ for GitHub Pages.
# Usage: powershell -ExecutionPolicy Bypass -File Tools/build-web.ps1
param([string]$Editor = "")
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_find-editor.ps1")
if (-not $Editor) { $Editor = Find-CapitalEditor }
$root = Split-Path -Parent $PSScriptRoot
$p = Start-Process $Editor -ArgumentList @("-batchmode", "-quit", "-projectPath", "`"$root`"", "-buildTarget", "WebGL", "-executeMethod", "CapitalBuilder.BuildWeb", "-logFile", "`"$root\Evidence\web-build.log`"") -PassThru -Wait
Get-Content (Join-Path $root "Evidence\web-build.txt")
if ($p.ExitCode -ne 0) { throw "Web build failed. See Evidence/web-build.log" }
$docs = Join-Path $root "docs"
if (Test-Path $docs) { Remove-Item -Recurse -Force $docs }
Copy-Item -Recurse (Join-Path $root "Builds\Web") $docs
New-Item -ItemType File -Force (Join-Path $docs ".nojekyll") | Out-Null
Write-Host "Copied to docs/. Commit and push, then GitHub Pages serves it."
