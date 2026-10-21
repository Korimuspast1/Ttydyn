#!/usr/bin/env python3
"""Builds standalone single-file Windows 64-bit .EXE, Linux x64 binary & offline Portable HTML for Zomboid 2.5D v6.0.0."""
import base64
import glob
import json
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

    # Dark olive WorldBox gold-framed tactical square
    for y in range(2, 30):
        for x in range(2, 30):
            border = x in (2, 29) or y in (2, 29)
            inner_gold = x in (3, 28) or y in (3, 28)
            if border:
                set_px(x, y, 18, 16, 14, 255)
            elif inner_gold:
                set_px(x, y, 232, 185, 72, 255)
            else:
                set_px(x, y, 34, 48, 38, 255)

    # Pixel zombie face with glowing red eyes & blood splatter
    for y in range(7, 25):
        for x in range(9, 23):
            edge = x in (9, 22) or y in (7, 24)
            if edge:
                set_px(x, y, 16, 18, 16)
            else:
                set_px(x, y, 108, 146, 98)

    for y in range(6, 11):
        for x in range(9, 23):
            if (x + y) % 3 != 0:
                set_px(x, y, 36, 40, 38)

    for ex in (12, 13, 18, 19):
        set_px(ex, 13, 235, 45, 58)
        set_px(ex, 14, 180, 20, 30)

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
    print("[1/4] Building clean Vite v6.0.0 production bundle (with all 21 real studio SFX)...")
    subprocess.run(["npm", "run", "build"], cwd=SIM_DIR, check=True)

    mime_map = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".mp3": "audio/mpeg",
        ".png": "image/png",
        ".ico": "image/x-icon",
    }

    # Assemble 100% single-file offline HTML (Zomboid-Knox-Portable.html) WITH all 21 SFX inlined as Data URIs!
    print("[2/4] Creating 100% single-file offline HTML with embedded studio SFX (Zomboid-Knox-Portable.html)...")
    css_file = glob.glob(os.path.join(DIST_DIR, "assets", "*.css"))[0]
    js_file = glob.glob(os.path.join(DIST_DIR, "assets", "*.js"))[0]
    with open(css_file, "r", encoding="utf-8") as f:
        css_code = f.read()
    with open(js_file, "r", encoding="utf-8") as f:
        js_code = f.read()

    sfx_data_map = {}
    sfx_dir = os.path.join(DIST_DIR, "sfx")
    for fn in sorted(os.listdir(sfx_dir)):
        full = os.path.join(sfx_dir, fn)
        _, ext = os.path.splitext(fn.lower())
        mime = mime_map.get(ext, "audio/wav")
        with open(full, "rb") as sf:
            b64 = base64.b64encode(sf.read()).decode("ascii")
        sfx_data_map[f"./sfx/{fn}"] = f"data:{mime};base64,{b64}"

    inline_sfx_shim = f"""
    const __INLINE_SFX__ = {json.dumps(sfx_data_map)};
    const __ origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {{
      if (typeof input === 'string' && __INLINE_SFX__[input]) {{
        return __origFetch(__INLINE_SFX__[input], init);
      }}
      return __origFetch(input, init);
    }};
    const __OrigAudio = window.Audio;
    window.Audio = function(src) {{
      return new __OrigAudio(src && __INLINE_SFX__[src] ? __INLINE_SFX__[src] : src);
    }};
    """.replace("__ origFetch", "__origFetch")

    single_html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Zomboid × WorldBox 2.5D v6.0.0 — Округ Нокс (Standalone Offline Edition)</title>
  <style>{css_code}</style>
</head>
<body>
  <div id="app"></div>
  <script>{inline_sfx_shim}</script>
  <script type="module">{js_code}</script>
</body>
</html>
"""
    portable_html_path = os.path.join(REPO_ROOT, "Zomboid-Knox-Portable.html")
    with open(portable_html_path, "w", encoding="utf-8") as f:
        f.write(single_html)

    # Compile Single-File Native Windows 64-bit .EXE + Linux x64 Binary with all 36 dist assets + 21 real SFX baked inside!
    print("[3/4] Compiling native single-file Windows 64-bit .EXE (Zomboid-Knox-PC.exe) & Linux x64 binary...")
    zig_bin = ensure_zig()
    with tempfile.TemporaryDirectory(prefix="zomboid_pc_") as tmp:
        desk_dir = os.path.join(tmp, "desktop")
        os.makedirs(desk_dir, exist_ok=True)
        for fname in ("worldbox_pc.cpp", "worldbox.manifest", "worldbox.rc"):
            shutil.copy2(os.path.join(REPO_ROOT, "desktop", fname), os.path.join(desk_dir, fname))

        cpp_path = os.path.join(desk_dir, "worldbox_pc.cpp")
        with open(cpp_path, "r", encoding="utf-8") as f:
            cpp_src = f.read()
        cpp_src = cpp_src.replace("WorldBox Sandbox", "Zomboid × WorldBox 2.5D v6.0")
        cpp_src = cpp_src.replace("worldbox-sandbox", "zomboid-knox-v6")
        with open(cpp_path, "w", encoding="utf-8") as f:
            f.write(cpp_src)

        build_pixel_icon(os.path.join(desk_dir, "worldbox.ico"))

        entries = []
        for root, _, files in sorted(os.walk(DIST_DIR)):
            for fn in sorted(files):
                full = os.path.join(root, fn)
                rel = "/" + os.path.relpath(full, DIST_DIR).replace("\\", "/")
                _, ext = os.path.splitext(fn.lower())
                with open(full, "rb") as f:
                    entries.append((rel, mime_map.get(ext, "application/octet-stream"), f.read()))

        hpp_path = os.path.join(desk_dir, "generated_assets.hpp")
        with open(hpp_path, "w", encoding="utf-8") as out:
            out.write("#pragma once\n#include <cstddef>\n#include <cstdint>\n\n")
            out.write("struct EmbeddedAsset { const char* path; const char* mime; const uint8_t* data; size_t size; };\n\n")
            for idx, (rel, _, data) in enumerate(entries):
                out.write(f"static const uint8_t ASSET_DATA_{idx}[] = {{\n  ")
                hex_chunks = [f"0x{b:02x}" for b in data]
                for line_start in range(0, len(hex_chunks), 32):
                    out.write(", ".join(hex_chunks[line_start : line_start + 32]))
                    if line_start + 32 < len(hex_chunks):
                        out.write(",\n  ")
                out.write("\n};\n\n")
            out.write(f"static const EmbeddedAsset EMBEDDED_ASSETS[{len(entries)}] = {{\n")
            for idx, (rel, mime, data) in enumerate(entries):
                out.write(f'  {{"{rel}", "{mime}", ASSET_DATA_{idx}, {len(data)}u}},\n')
            out.write("};\n")
            out.write(f"static const size_t EMBEDDED_ASSETS_COUNT = {len(entries)}u;\n")

        res_path = os.path.join(tmp, "zomboid.res")
        subprocess.run([zig_bin, "rc", "desktop/worldbox.rc", res_path], cwd=tmp, check=True)

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

    print("[4/4] Built standalone single-file PC binaries successfully:")
    for p in (exe_out, linux_out, portable_html_path):
        print(f"  {os.path.basename(p)}: {os.path.getsize(p):,} bytes")


if __name__ == "__main__":
    main()
