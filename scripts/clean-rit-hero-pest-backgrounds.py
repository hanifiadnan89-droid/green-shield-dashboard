#!/usr/bin/env python3
"""One-time cleanup for RIT hero rodent PNG backgrounds (mice/rats/moles/voles).

Removes checkerboard / near-gray edge-connected background via flood fill from
image borders, then lightly defringes halos. Re-exports at the existing bundled
large-asset dimensions so PDF placement stays unchanged.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path('/opt/cursor/artifacts/assets')
LARGE_DIR = ROOT / 'assets' / 'pests' / 'large'

HERO_KEYS = ('mice', 'rats', 'moles', 'voles')
LARGE_WIDTH = 72


def is_background_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a == 0:
        return True

    min_c = min(r, g, b)
    max_c = max(r, g, b)
    saturation = max_c - min_c
    luminance = (r + g + b) / 3

    # Checkerboard / studio backdrop: near-white or neutral light gray.
    if luminance >= 175 and saturation <= 28:
        return True

    # Common checkerboard tones (e.g. 192/255, 204/255 pairs).
    if (
        184 <= r <= 255
        and 184 <= g <= 255
        and 184 <= b <= 255
        and saturation <= 20
    ):
        return True

    # Semi-transparent fringe left from poor matting.
    if a < 250 and luminance >= 135 and saturation <= 42:
        return True

    return False


def flood_remove_background(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    width, height = img.size
    pixels = img.load()
    background = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if background[y][x]:
            return
        if is_background_pixel(*pixels[x, y]):
            background[y][x] = True
            queue.append((x, y))

    for x in range(width):
        try_seed(x, 0)
        try_seed(x, height - 1)
    for y in range(height):
        try_seed(0, y)
        try_seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not background[ny][nx]:
                if is_background_pixel(*pixels[nx, ny]):
                    background[ny][nx] = True
                    queue.append((nx, ny))

    for y in range(height):
        for x in range(width):
            if background[y][x]:
                pixels[x, y] = (0, 0, 0, 0)

    return img


def defringe_halos(img: Image.Image, passes: int = 5) -> Image.Image:
    img = img.convert('RGBA')
    width, height = img.size
    pixels = img.load()

    for _ in range(passes):
        to_clear: list[tuple[int, int]] = []
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                touches_transparent = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < width and 0 <= ny < height and pixels[nx, ny][3] == 0:
                        touches_transparent = True
                        break
                if not touches_transparent:
                    continue

                min_c = min(r, g, b)
                max_c = max(r, g, b)
                saturation = max_c - min_c
                luminance = (r + g + b) / 3

                if luminance >= 205 and saturation <= 24:
                    to_clear.append((x, y))
                elif a < 245 and luminance >= 125 and saturation <= 48:
                    to_clear.append((x, y))

        if not to_clear:
            break
        for x, y in to_clear:
            pixels[x, y] = (0, 0, 0, 0)

    return img


def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def resize_to_width(img: Image.Image, width: int) -> Image.Image:
    ratio = width / img.width
    height = max(1, round(img.height * ratio))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def fit_to_canvas(img: Image.Image, canvas_size: tuple[int, int]) -> Image.Image:
    canvas = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    x = (canvas_size[0] - img.width) // 2
    y = (canvas_size[1] - img.height) // 2
    canvas.paste(img, (x, y), img)
    return canvas


def process_hero(key: str) -> None:
    out_path = LARGE_DIR / f'{key}.png'
    if not out_path.exists():
        raise FileNotFoundError(f'Missing bundled asset: {out_path}')

    target_size = Image.open(out_path).size
    source_path = ARTIFACTS / f'{key}-source.png'
    if not source_path.exists():
        raise FileNotFoundError(f'Missing source image: {source_path}')

    img = Image.open(source_path)
    img = flood_remove_background(img)
    img = defringe_halos(img)
    img = trim_transparent(img)
    img = resize_to_width(img, LARGE_WIDTH)
    img = fit_to_canvas(img, target_size)
    img.save(out_path, format='PNG')
    print(f'Cleaned {key}: {target_size[0]}x{target_size[1]} -> {out_path}')


def main() -> None:
    for key in HERO_KEYS:
        process_hero(key)


if __name__ == '__main__':
    main()
