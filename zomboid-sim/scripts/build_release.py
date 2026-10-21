#!/usr/bin/env python3
"""Builds standalone single-file deliverables for Project Zomboid: Knox County 2.5D."""
import glob
import os
import shutil
import struct
import subprocess
import tempfile

REPO_ROOT = "/home/user/Ttydyn"
SIM_DIR = os.path.join(REPO_ROOT, "zomboid-sim")
DIST_DIR = os.path.join(SIM_DIR, "dist")


def ensure_zig() -> str:
    zig_bin = "/tmp/ziglang/ziglang/zig"
    if not os.path.exists(zig_bin):
        subprocess.run(
            ["python3", "-m", "pip", "install", "--quiet", "--target", "/tmp/ziglang", "ziglang"],
            check=True,
        )
    return zig_bin


def build_pixel_icon(path: str) -> None:
    """Generates a crisp 32x32 32-bit RGBA Windows .ico pixel icon (Zombie + Biohazard Shield)."""
    w, h = 32, 32
    pixels = bytearray(w * h * 4)

    def set_px(x: int, y: int, r: int, g: int, b: int, a: int = 255) -> None:
        if 0 <= x < w and 0 <= y < h:
            inv_y = (h - 1 - y)
            off = (inv_y * w + x) * 4
            pixels[off : off + 4] = bytes((b, g, r, a))

    # Dark olive tactical background rounded square
    for y in range(2, 30):
        for x in range(2, 30):
            edge = x in (2, 29) or y in (2, 29)
            set_px(x, y, 20 if edge else 34, 24 if edge else 48, 22 if edge else 38, 255)

    # Pixel zombie face with glowing red eyes & blood splatter
    for y in range(7, 25):
        for x in range(9, 23):
            edge = x in (9, 22) or y in (7, 24)
            if edge:
                set_px(x, y, 16, 18, 16)
            else:
                set_px(x, y, 108, 146, 98)

    # Torn dark hair
    for y in range(6, 11):
        for x in range(9, 23):
            if (x + y) % 3 != 0:
                set_px(x, y, 36, 40, 38)

    # Glowing crimson eyes
    for ex in (12, 13, 18, 19):
        set_px(ex, 13, 235, 45, 58)
        set_px(ex, 14, 180, 20, 30)

    # Blood mouth & chin stain
    for x in range(12, 20):
        set_px(x, 19, 42, 16, 18)
        if x % 2 == 0:
            set_px(x, 20, 210, 28, 38)
    set_px(13, 21, 210, 28, 38)
    set_px(17, 22, 185, 22, 32)

    and_mask = bytes((w // 8) * h)
    bih = struct.pack("<IIIHHIIIIII", 40, w, h * 2, 1, 32, 0, len(pixels) + len(and_mask), 0, 0, 0, 0)
    img_data = bih + bytes(pixels) + and_mask
    ico_hdr = struct.pack("<HHH", 0, 1, 1)
    ico_entry = struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(img_data), 22)
    with open(path, "wb") as f:
        f.write(ico_hdr + ico_entry + img_data)


def main() -> None:
    pub_exe = os.path.join(SIM_DIR, "public", "Zomboid-Knox-PC.exe")
    if os.path.exists(pub_exe):
        os.remove(pub_exe)

    print("[1/5] Building clean Vite production bundle...")
    subprocess.run(["npm", "run", "build"], cwd=SIM_DIR, check=True)

    # Assemble 100% single-file offline HTML (Zomboid-Knox-Portable.html)
    print("[2/5] Creating 100% single-file offline HTML (Zomboid-Knox-Portable.html)...")
    css_file = glob.glob(os.path.join(DIST_DIR, "assets", "*.css"))[0]
    js_file = glob.glob(os.path.join(DIST_DIR, "assets", "*.js"))[0]
    with open(css_file, "r", encoding="utf-8") as f:
        css_code = f.read()
    with open(js_file, "r", encoding="utf-8") as f:
        js_code = f.read()

    single_html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Project Zomboid: Округ Нокс 2.5D — Симулятор Города и Эпидемии</title>
  <style>{css_code}</style>
</head>
<body>
  <div id="app"></div>
  <script type="module">{js_code}</script>
</body>
</html>
"""
    portable_html_path = os.path.join(REPO_ROOT, "Zomboid-Knox-Portable.html")
    with open(portable_html_path, "w", encoding="utf-8") as f:
        f.write(single_html)

    # Compile Single-File Native Windows .EXE + Linux x64 Binary using worldbox_pc.cpp runtime
    print("[3/5] Packing Zomboid 2.5D assets & compiling native Windows x64 + Linux x64 binaries...")
    zig_bin = ensure_zig()
    with tempfile.TemporaryDirectory(prefix="zomboid_pc_") as tmp:
        for fname in ("worldbox_pc.cpp", "worldbox.manifest", "worldbox.rc"):
            shutil.copy2(os.path.join(REPO_ROOT, "desktop", fname), os.path.join(tmp, fname))

        # Customize window title & app metadata specifically for Project Zomboid 2.5D!
        cpp_path = os.path.join(tmp, "worldbox_pc.cpp")
        with open(cpp_path, "r", encoding="utf-8") as f:
            cpp_src = f.read()
        cpp_src = cpp_src.replace("WorldBox Sandbox", "Project Zomboid: Округ Нокс 2.5D")
        cpp_src = cpp_src.replace("worldbox-sandbox", "zomboid-knox-25d")
        with open(cpp_path, "w", encoding="utf-8") as f:
            f.write(cpp_src)

        build_pixel_icon(os.path.join(tmp, "worldbox.ico"))

        # Generate embedded assets table from zomboid-sim/dist
        entries = []
        mime_map = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".woff2": "font/woff2",
            ".woff": "font/woff",
        }
        for root, _, files in sorted(os.walk(DIST_DIR)):
            for fn in sorted(files):
                full = os.path.join(root, fn)
                rel = "/" + os.path.relpath(full, DIST_DIR).replace("\\", "/")
                _, ext = os.path.splitext(fn.lower())
                with open(full, "rb") as f:
                    entries.append((rel, mime_map.get(ext, "application/octet-stream"), f.read()))

        hpp_path = os.path.join(tmp, "generated_assets.hpp")
        with open(hpp_path, "w", encoding="utf-8") as out:
            out.write("#pragma once\n#include <cstddef>\n#include <cstdint>\n\n")
            out.write("struct EmbeddedAsset { const char* path; const char* mime; const uint8_t* data; size_t size; };\n\n")
            for idx, (rel, _, data) in enumerate(entries):
                out.write(f"static const uint8_t ASSET_DATA_{idx}[] = {{\n  ")
                hex_chunks = [f"0x{b:02x}" for b in data]
                out.write(", ".join(hex_chunks))
                out.write("\n};\n\n")
            out.write(f"static const EmbeddedAsset EMBEDDED_ASSETS[{len(entries)}] = {{\n")
            for idx, (rel, mime, data) in enumerate(entries):
                out.write(f'  {{"{rel}", "{mime}", ASSET_DATA_{idx}, {len(data)}u}},\n')
            out.write("};\n")
            out.write(f"static const size_t EMBEDDED_ASSETS_COUNT = {len(entries)}u;\n")

        res_path = os.path.join(tmp, "zomboid.res")
        subprocess.run([zig_bin, "rc", os.path.join(tmp, "worldbox.rc"), res_path], check=True)

        exe_out = os.path.join(REPO_ROOT, "Zomboid-Knox-PC.exe")
        linux_out = os.path.join(REPO_ROOT, "Zomboid-Knox-Linux-x64")

        subprocess.run(
            [
                zig_bin, "c++", "-target", "x86_64-windows-gnu", "-std=c++17", "-O2", "-s", "-static",
                "-Wl,--subsystem,windows", cpp_path, res_path,
                "-lws2_32", "-lshell32", "-ladvapi32", "-o", exe_out,
            ],
            check=True,
        )

        subprocess.run(
            [
                zig_bin, "c++", "-target", "x86_64-linux-musl", "-std=c++17", "-O2", "-s", "-static",
                cpp_path, "-pthread", "-o", linux_out,
            ],
            check=True,
        )
        os.chmod(linux_out, 0o755)

    print("[4/5] Copying Zomboid-Knox-PC.exe into zomboid-sim/public/ for instant browser download...")
    os.makedirs(os.path.join(SIM_DIR, "public"), exist_ok=True)
    shutil.copy2(exe_out, pub_exe)
    subprocess.run(["npm", "run", "build"], cwd=SIM_DIR, check=True)

    print("[5/5] Summary of standalone artifacts:")
    for p in (exe_out, linux_out, portable_html_path):
        print(f"  {os.path.basename(p)}: {os.path.getsize(p):,} bytes")


if __name__ == "__main__":
    main()
