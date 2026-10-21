#!/usr/bin/env python3
"""Generates crisp nearest-neighbor 16x16 pixel-art WorldBox launcher PNG icons across Android DPIs."""
import os
import struct
import zlib

PALETTE = {
    '.': (0, 0, 0, 0),
    'B': (19, 14, 11, 255),      # 1px crisp dark outline
    'O': (15, 58, 109, 255),     # deep ocean
    'W': (36, 134, 214, 255),    # coastal turquoise water
    'S': (242, 214, 138, 255),   # golden beach sand
    'G': (72, 184, 78, 255),     # lush island grass
    'D': (42, 128, 52, 255),     # forest shadow
    'M': (112, 118, 130, 255),   # stone mountain
    'L': (255, 102, 28, 255),    # volcano lava
    'Y': (255, 216, 77, 255),    # golden god crown / glow
    'C': (255, 246, 184, 255),   # bright highlight
}

# 16x16 crisp pixel WorldBox island + erupting volcano + golden crown
GRID_16 = [
    "..BBBBBBBBBBBB..",
    ".BOOOOOOOOOOOOB.",
    "BOOWWWWWWWWWWOOB",
    "BOWWWYWWYWWYWWOB",
    "BOWWWYYYYYYYWWOB",
    "BOWWWCCCCCCCWWOB",
    "BOWWSSGGGGSSWWOB",
    "BOWSSGGLLGGSSWOB",
    "BOWSGGMLLMGGSWOB",
    "BOWSGGMMMMGGSWOB",
    "BOWSDGGGGGGDSWOB",
    "BOWSSDDDDDDSSWOB",
    "BOWWSSSSSSSSWWOB",
    "BOOWWWWWWWWWWOOB",
    ".BOOOOOOOOOOOOB.",
    "..BBBBBBBBBBBB..",
]


def write_png(path: str, size: int) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0 (None)
        gy = (y * 16) // size
        row = GRID_16[gy]
        for x in range(size):
            gx = (x * 16) // size
            r, g, b, a = PALETTE[row[gx]]
            raw.extend((r, g, b, a))

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png.extend(chunk(b"IHDR", ihdr))
    png.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    png.extend(chunk(b"IEND", b""))

    with open(path, "wb") as f:
        f.write(png)


def main() -> None:
    base = os.path.join("android", "src", "main", "res")
    sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, px in sizes.items():
        write_png(os.path.join(base, folder, "ic_launcher.png"), px)
    print("Generated pixel-art Android launcher icons:", sizes)


if __name__ == "__main__":
    main()
