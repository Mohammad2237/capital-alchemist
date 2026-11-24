# Runs the EditMode test suite (finance acceptance + guards) headlessly.
# Usage: powershell -ExecutionPolicy Bypass -File Tools/run-editmode-tests.ps1
#        powershell -ExecutionPolicy Bypass -File Tools/run-editmode-tests.ps1 -Editor "C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe"
param(
    [string]$Editor = ""
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_find-editor.ps1")
if (-not $Editor) { $Editor = Find-CapitalEditor }
$root = Split-Path -Parent $PSScriptRoot
$evidence = Join-Path $root "Evidence"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$xml = Join-Path $evidence "editmode.xml"
$log = Join-Path $evidence "tests.log"
if (-not (Test-Path $Editor)) { throw "Unity editor not found: $Editor" }
$args = @(
    "-batchmode", "-projectPath", "`"$root`"",
    "-runTests", "-testPlatform", "EditMode",
    "-testResults", "`"$xml`"",
    "-logFile", "`"$log`""
)
$p = Start-Process $Editor -ArgumentList $args -PassThru -Wait
if (Test-Path $xml) {
    [xml]$r = Get-Content $xml
    $run = $r.'test-run'
    "EditMode: {0} passed, {1} failed, {2} skipped ({3} total)" -f $run.passed, $run.failed, $run.skipped, $run.total
} else {
    "No test results written. See $log"
}
exit $p.ExitCode
