#!/usr/bin/env python3
"""Generates multi-resolution crisp pixel-art WorldBox .ico for Windows .exe & favicon."""
import os
import struct
import zlib

PALETTE = {
    '.': (0, 0, 0, 0),
    'B': (19, 14, 11, 255),
    'O': (15, 58, 109, 255),
    'W': (36, 134, 214, 255),
    'S': (242, 214, 138, 255),
    'G': (72, 184, 78, 255),
    'D': (42, 128, 52, 255),
    'M': (112, 118, 130, 255),
    'L': (255, 102, 28, 255),
    'Y': (255, 216, 77, 255),
    'C': (255, 246, 184, 255),
}

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


def make_png_bytes(size: int) -> bytes:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        gy = (y * 16) // size
        row = GRID_16[gy]
        for x in range(size):
            gx = (x * 16) // size
            raw.extend(PALETTE[row[gx]])

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    out = bytearray(b"\x89PNG\r\n\x1a\n")
    out.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)))
    out.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    out.extend(chunk(b"IEND", b""))
    return bytes(out)


def write_ico(path: str, sizes: list[int]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    png_blobs = [make_png_bytes(sz) for sz in sizes]
    header = struct.pack("<HHH", 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries = bytearray()
    for sz, blob in zip(sizes, png_blobs):
        w_byte = 0 if sz >= 256 else sz
        h_byte = 0 if sz >= 256 else sz
        entries.extend(struct.pack("<BBBBHHII", w_byte, h_byte, 0, 0, 1, 32, len(blob), offset))
        offset += len(blob)

    with open(path, "wb") as f:
        f.write(header)
        f.write(entries)
        for blob in png_blobs:
            f.write(blob)


def main() -> None:
    write_ico(os.path.join("desktop", "worldbox.ico"), [16, 32, 48, 64, 256])
    write_ico(os.path.join("public", "favicon.ico"), [16, 32, 48])
    print("Generated crisp multi-size Windows .ico: desktop/worldbox.ico + public/favicon.ico")


if __name__ == "__main__":
    main()
