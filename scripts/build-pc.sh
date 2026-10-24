#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ZIG_BIN="${ZIG_BIN:-/tmp/ziglang/ziglang/zig}"
if ! command -v "$ZIG_BIN" >/dev/null 2>&1; then
  echo "Installing portable ziglang cross-compiler into /tmp/ziglang..."
  python3 -m pip install --quiet --target /tmp/ziglang ziglang
  ZIG_BIN="/tmp/ziglang/ziglang/zig"
fi

echo "[1/5] Generating multi-resolution pixel .ico icon..."
python3 "$ROOT_DIR/scripts/generate-pc-icon.py"

echo "[2/5] Building clean web bundle (without recursive binaries in dist/)..."
rm -f "$ROOT_DIR/public/WorldBox-Sandbox.exe" "$ROOT_DIR/public/WorldBox-Sandbox.apk"
npm run build

echo "[3/5] Packing all game assets, shaders & offline fonts into C++ byte arrays..."
python3 "$ROOT_DIR/scripts/pack-pc-assets.py"

echo "[4/5] Compiling Windows 10/11 Native 64-bit Single-File .EXE (WorldBox-Sandbox.exe)..."
WORK_DIR="$(mktemp -d /tmp/wb-pc-build.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

"$ZIG_BIN" rc "$ROOT_DIR/desktop/worldbox.rc" "$WORK_DIR/worldbox.res"

"$ZIG_BIN" c++ \
  -target x86_64-windows-gnu \
  -std=c++17 \
  -O2 \
  -s \
  -static \
  -Wl,--subsystem,windows \
  "$ROOT_DIR/desktop/worldbox_pc.cpp" \
  "$WORK_DIR/worldbox.res" \
  -lws2_32 -lshell32 -ladvapi32 \
  -o "$ROOT_DIR/WorldBox-Sandbox.exe"

echo "[5/5] Compiling Linux 64-bit Static Portable Binary (WorldBox-Sandbox-Linux-x64)..."
"$ZIG_BIN" c++ \
  -target x86_64-linux-musl \
  -std=c++17 \
  -O2 \
  -s \
  -static \
  "$ROOT_DIR/desktop/worldbox_pc.cpp" \
  -pthread \
  -o "$ROOT_DIR/WorldBox-Sandbox-Linux-x64"

chmod +x "$ROOT_DIR/WorldBox-Sandbox-Linux-x64"

mkdir -p "$ROOT_DIR/public"
cp "$ROOT_DIR/WorldBox-Sandbox.exe" "$ROOT_DIR/public/WorldBox-Sandbox.exe"
if [ -f "$ROOT_DIR/WorldBox-Sandbox.apk" ]; then
  cp "$ROOT_DIR/WorldBox-Sandbox.apk" "$ROOT_DIR/public/WorldBox-Sandbox.apk"
fi

ls -lh "$ROOT_DIR/WorldBox-Sandbox.exe" "$ROOT_DIR/WorldBox-Sandbox-Linux-x64"
echo "SUCCESS: Built standalone single-file PC binaries!"
