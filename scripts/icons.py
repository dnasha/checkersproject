"""Render our original geometric app icon without external image dependencies."""
import struct
import zlib
from pathlib import Path

def inside(x, y, points):
    result = False
    previous = points[-1]
    for point in points:
        x1, y1 = previous
        x2, y2 = point
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            result = not result
        previous = point
    return result

def chunk(tag, data):
    return struct.pack('!I', len(data)) + tag + data + struct.pack('!I', zlib.crc32(tag + data))

for size in (192, 512):
    rows = bytearray()
    for py in range(size):
        rows.append(0)
        for px in range(size):
            x, y = (px + .5) * 192 / size, (py + .5) * 192 / size
            color = (39, 76, 64)
            if (x - 96) ** 2 + (y - 104) ** 2 < 58 ** 2:
                color = (184, 151, 98)
            if (x - 96) ** 2 + (y - 96) ** 2 < 58 ** 2:
                color = (242, 229, 201)
                if 41.5 ** 2 < (x - 96) ** 2 + (y - 96) ** 2 < 44.5 ** 2:
                    color = (184, 151, 98)
            if inside(x, y, [(66,106),(61,75),(84,89),(96,63),(108,89),(131,75),(126,106)]) or 68 <= x <= 124 and 113.5 <= y <= 118.5:
                color = (39, 76, 64)
            rows.extend(color)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')
    Path(f'public/icon-{size}.png').write_bytes(png)
