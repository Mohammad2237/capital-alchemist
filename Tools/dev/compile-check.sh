#!/usr/bin/env bash
# Dev-only: compile check without a Unity licence. Usage (Git Bash): bash Tools/dev/compile-check.sh
# Recompiles the project's own assemblies using Unity's recorded compiler command lines,
# retargeted at the locally installed editor. No licence needed: this only runs Roslyn.
# Package references stay pointed at Library/Bee (already built); only our four outputs are redirected.
set -u
export MSYS_NO_PATHCONV=1
PROJ="$(cd "$(dirname "$0")/../.." && pwd -W)"
ED="${UNITY_EDITOR_DIR:-C:/Users/moham/Unity/Editors/6000.6.10f1/Editor}"
OUT="$PROJ/Temp/compile-check"
SRC="$PROJ/Library/Bee/artifacts/1900b0aE.dag"
DOTNET="$ED/Data/DotNetSdk/dotnet.exe"
CSC="$ED/Data/DotNetSdk/sdk/8.0.318/Roslyn/bincore/csc.dll"
DAG="Library/Bee/artifacts/1900b0aE.dag"
mkdir -p "$OUT"
cd "$PROJ"
status=0
for asm in Capital.Domain Assembly-CSharp Capital.Tests Assembly-CSharp-Editor; do
  rsp="$OUT/$asm.rsp"
  sed -E \
      -e "s#C:/Program Files/Unity/Hub/Editor/6000.6.10f1/Editor#$ED#g" \
      -e "s#$DAG/(Capital\.Domain|Assembly-CSharp|Capital\.Tests|Assembly-CSharp-Editor)((\.ref)?\.(dll|pdb|xml))#$OUT/\1\2#g" \
      -e '/UWP\.Extensions/d' \
      -e '/^\/additionalfile:/d' \
      "$SRC/$asm.rsp" > "$rsp"
  # Scripts added since Unity last compiled are not in the recorded command line: append them.
  case "$asm" in
    Assembly-CSharp) dir=Assets/Capital/Scripts ;;
    Assembly-CSharp-Editor) dir=Assets/Capital/Editor ;;
    *) dir= ;;
  esac
  if [ -n "$dir" ]; then
    for f in $dir/*.cs; do grep -qF "\"$f\"" "$rsp" || echo "\"$f\"" >> "$rsp"; done
  fi
  echo "=== $asm"
  if "$DOTNET" exec "$CSC" -noconfig "@$rsp" > "$OUT/$asm.log" 2>&1; then
    echo "OK  ($(grep -c 'warning CS' "$OUT/$asm.log") warnings)"
  else
    echo "FAILED"; grep -E 'error' "$OUT/$asm.log" | cut -c1-300 | head -30; status=1
  fi
done
exit $status
