#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TOOLCHAIN_DIR="${ANDROID_TOOLCHAIN_DIR:-/tmp/android-toolchain}"
JAVA_HOME_DIR="${JAVA_HOME:-$TOOLCHAIN_DIR/jdk17}"
BUILD_TOOLS_DIR="${ANDROID_BUILD_TOOLS_DIR:-$TOOLCHAIN_DIR/sdk/build-tools/android-14}"
ANDROID_JAR="${ANDROID_PLATFORM_JAR:-$TOOLCHAIN_DIR/sdk/platforms/android-34/android.jar}"

export JAVA_HOME="$JAVA_HOME_DIR"
export PATH="$JAVA_HOME/bin:$BUILD_TOOLS_DIR:$PATH"

OUT_APK="$ROOT_DIR/WorldBox-Sandbox.apk"
WORK_DIR="$(mktemp -d /tmp/wb-apk-build.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "[1/7] Generating pixel launcher icons..."
python3 "$ROOT_DIR/scripts/generate-android-icons.py"

echo "[2/7] Building optimized production web bundle (Vite + TypeScript)..."
rm -f "$ROOT_DIR/public/WorldBox-Sandbox.apk"
npm run build

echo "[3/7] Compiling Android resources with aapt2..."
mkdir -p "$WORK_DIR/res_compiled" "$WORK_DIR/gen" "$WORK_DIR/classes" "$WORK_DIR/dex" "$WORK_DIR/assets_root/assets/www"
aapt2 compile --dir "$ROOT_DIR/android/src/main/res" -o "$WORK_DIR/res_compiled/resources.zip"

aapt2 link \
  -I "$ANDROID_JAR" \
  --manifest "$ROOT_DIR/android/src/main/AndroidManifest.xml" \
  --java "$WORK_DIR/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 35 \
  --version-name "3.5.0" \
  -o "$WORK_DIR/unaligned.apk" \
  "$WORK_DIR/res_compiled/resources.zip"

echo "[4/7] Compiling MainActivity.java + R.java with JDK 17..."
find "$ROOT_DIR/android/src/main/java" "$WORK_DIR/gen" -name "*.java" > "$WORK_DIR/sources.txt"
javac \
  -encoding UTF-8 \
  --release 11 \
  -classpath "$ANDROID_JAR" \
  -d "$WORK_DIR/classes" \
  @"$WORK_DIR/sources.txt"

echo "[5/7] Compiling bytecode to Dalvik/ART classes.dex with d8..."
find "$WORK_DIR/classes" -name "*.class" > "$WORK_DIR/classes.txt"
d8 \
  --min-api 24 \
  --lib "$ANDROID_JAR" \
  --output "$WORK_DIR/dex" \
  @"$WORK_DIR/classes.txt"

echo "[6/7] Packaging offline game assets + classes.dex & running zipalign..."
cp -r "$ROOT_DIR/dist/"* "$WORK_DIR/assets_root/assets/www/"
cp "$WORK_DIR/dex/classes.dex" "$WORK_DIR/assets_root/classes.dex"

(
  cd "$WORK_DIR/assets_root"
  zip -qr -n .png:.woff:.woff2 "$WORK_DIR/unaligned.apk" classes.dex assets
)

zipalign -f -p 4 "$WORK_DIR/unaligned.apk" "$WORK_DIR/aligned.apk"

echo "[7/7] Signing APK (v1 + v2 + v3 schemes) & verifying signature..."
KEYSTORE="$WORK_DIR/release-key.jks"
keytool -genkeypair \
  -keystore "$KEYSTORE" \
  -alias worldboxkey \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass worldbox123 \
  -keypass worldbox123 \
  -dname "CN=WorldBox Sandbox, OU=Mobile, O=Ttydyn, L=Vienna, ST=Vienna, C=AT" >/dev/null 2>&1

apksigner sign \
  --ks "$KEYSTORE" \
  --ks-key-alias worldboxkey \
  --ks-pass pass:worldbox123 \
  --key-pass pass:worldbox123 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$OUT_APK" \
  "$WORK_DIR/aligned.apk"

apksigner verify -v --print-certs "$OUT_APK"

mkdir -p "$ROOT_DIR/public"
cp "$OUT_APK" "$ROOT_DIR/public/WorldBox-Sandbox.apk"

echo "SUCCESS: Built & verified $OUT_APK ($(du -h "$OUT_APK" | cut -f1))"
