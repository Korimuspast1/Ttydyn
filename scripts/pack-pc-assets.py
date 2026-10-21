#!/usr/bin/env python3
"""Packs Vite dist/ web assets directly into C++ byte tables for single-file native PC .exe / Linux builds."""
import os

MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".svg": "image/svg+xml",
}

SKIP_EXTS = {".apk", ".exe", ".map"}


def guess_mime(rel_path: str) -> str:
    _, ext = os.path.splitext(rel_path.lower())
    return MIME_MAP.get(ext, "application/octet-stream")


def main() -> None:
    dist_dir = "dist"
    entries = []
    for root, _, files in sorted(os.walk(dist_dir)):
        for fn in sorted(files):
            _, ext = os.path.splitext(fn.lower())
            if ext in SKIP_EXTS:
                continue
            full = os.path.join(root, fn)
            rel = "/" + os.path.relpath(full, dist_dir).replace("\\", "/")
            with open(full, "rb") as f:
                data = f.read()
            entries.append((rel, guess_mime(rel), data))

    out_path = os.path.join("desktop", "generated_assets.hpp")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as out:
        out.write("#pragma once\n#include <cstddef>\n#include <cstdint>\n\n")
        out.write("struct EmbeddedAsset {\n  const char* path;\n  const char* mime;\n  const uint8_t* data;\n  size_t size;\n};\n\n")
        for idx, (rel, _, data) in enumerate(entries):
            out.write(f"// {rel} ({len(data)} bytes)\n")
            out.write(f"static const uint8_t ASSET_DATA_{idx}[] = {{\n  ")
            hex_chunks = [f"0x{b:02x}" for b in data]
            for line_start in range(0, len(hex_chunks), 24):
                out.write(", ".join(hex_chunks[line_start:line_start + 24]))
                if line_start + 24 < len(hex_chunks):
                    out.write(",\n  ")
            out.write("\n};\n\n")

        out.write(f"static const EmbeddedAsset EMBEDDED_ASSETS[{len(entries)}] = {{\n")
        for idx, (rel, mime, data) in enumerate(entries):
            out.write(f'  {{"{rel}", "{mime}", ASSET_DATA_{idx}, {len(data)}u}},\n')
        out.write("};\n")
        out.write(f"static const size_t EMBEDDED_ASSETS_COUNT = {len(entries)}u;\n")

    total = sum(len(d) for _, _, d in entries)
    print(f"Packed {len(entries)} files ({total} bytes) into {out_path}")


if __name__ == "__main__":
    main()
