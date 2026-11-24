# Serves the web build locally for a quick test in a desktop browser: http://localhost:8080
# (Headsets need HTTPS for VR, so test VR on the published GitHub Pages link.)
$root = Join-Path (Split-Path -Parent $PSScriptRoot) "Builds\Web"
Write-Host "Serving $root at http://localhost:8080  (Ctrl+C to stop)"
python -m http.server 8080 --directory "$root"
