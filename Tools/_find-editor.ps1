# Shared helper: returns the first Unity 6000.6.10f1 (or 6000.3.29f1 LTS) editor found on this machine.
function Find-CapitalEditor {
    $candidates = @(
        "$env:USERPROFILE\Unity\Editors\6000.6.10f1\Editor\Unity.exe",
        "C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe",
        "C:\Program Files\Unity\Hub\Editor\6000.3.29f1\Editor\Unity.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    throw "No Unity editor found. Install 6000.6.10f1 or pass -Editor <path to Unity.exe>."
}
