# Builds the Windows 64-bit player from the three enabled scenes.
# Usage: powershell -ExecutionPolicy Bypass -File Tools/build-windows.ps1
param(
    [string]$Editor = ""
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_find-editor.ps1")
if (-not $Editor) { $Editor = Find-CapitalEditor }
$root = Split-Path -Parent $PSScriptRoot
$evidence = Join-Path $root "Evidence"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$log = Join-Path $evidence "windows-build.log"
if (-not (Test-Path $Editor)) { throw "Unity editor not found: $Editor" }
$args = @(
    "-batchmode", "-quit",
    "-projectPath", "`"$root`"",
    "-executeMethod", "CapitalBuilder.BuildWindows",
    "-logFile", "`"$log`""
)
$p = Start-Process $Editor -ArgumentList $args -PassThru -Wait
$summary = Join-Path $evidence "windows-build.txt"
if (Test-Path $summary) { Get-Content $summary }
else { "No build summary written. See $log" }
exit $p.ExitCode
