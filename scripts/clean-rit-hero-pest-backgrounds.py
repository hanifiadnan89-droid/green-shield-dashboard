#!/usr/bin/env python3
"""Remove backgrounds from the four RIT hero rodent PNGs on main.

Only edits mice/rats/moles/voles in assets/pests/large/.
Preserves each file's exact pixel dimensions (no trim, no resize, no recenter).
Does not touch PDF layout code.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LARGE_DIR = ROOT / 'assets' / 'pests' / 'large'
HERO_KEYS = ('mice', 'rats', 'moles', 'voles')


def is_background_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a == 0:
        return True

    min_c = min(r, g, b)
    max_c = max(r, g, b)
    saturation = max_c - min_c
    luminance = (r + g + b) / 3

    if max_c <= 20:
        return True

    if max_c <= 45 and a < 255:
        return True

    if luminance >= 168 and saturation <= 34:
        return True

    if min_c >= 172 and saturation <= 26:
        return True

    if abs(r - g) <= 10 and abs(g - b) <= 10 and min_c >= 175:
        return True

    if a < 252 and luminance >= 105 and saturation <= 55:
        return True

    return False


def flood_remove_background(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    width, height = img.size
    pixels = img.load()
    background = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if background[y][x]:
            return
        if is_background_pixel(*pixels[x, y]):
            background[y][x] = True
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

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


def touches_exterior(pixels, width: int, height: int, x: int, y: int) -> bool:
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if not (0 <= nx < width and 0 <= ny < height):
            return True
        if pixels[nx, ny][3] == 0:
            return True
    return False


def defringe_halos(img: Image.Image, passes: int = 16) -> Image.Image:
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
                if not touches_exterior(pixels, width, height, x, y):
                    continue
                if is_background_pixel(r, g, b, a):
                    to_clear.append((x, y))

        if not to_clear:
            break
        for x, y in to_clear:
            pixels[x, y] = (0, 0, 0, 0)

    return img


def flatten_to_white(img: Image.Image) -> Image.Image:
    """Opaque white background — blends into the white PDF (no alpha checkerboard)."""
    white_bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
    return Image.alpha_composite(white_bg, img)


def scrub_near_white_edges(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    width, height = img.size
    pixels = img.load()

    def scrubbable(r: int, g: int, b: int, a: int) -> bool:
        if a == 0:
            return True
        min_c = min(r, g, b)
        max_c = max(r, g, b)
        return min_c >= 198 and (max_c - min_c) <= 40

    background = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if background[y][x]:
            return
        r, g, b, a = pixels[x, y]
        if a == 255 and r >= 250 and g >= 250 and b >= 250:
            background[y][x] = True
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not background[ny][nx]:
                if scrubbable(*pixels[nx, ny]):
                    background[ny][nx] = True
                    queue.append((nx, ny))

    for y in range(height):
        for x in range(width):
            if background[y][x]:
                pixels[x, y] = (255, 255, 255, 255)

    return img


def clean_in_place(path: Path) -> None:
    original_size = Image.open(path).size
    img = Image.open(path).convert('RGBA')
    if img.size != original_size:
        raise ValueError(f'Unexpected size for {path}')

    img = flood_remove_background(img)
    img = defringe_halos(img)
    img = flatten_to_white(img)
    img = scrub_near_white_edges(img)

    if img.size != original_size:
        raise ValueError(f'Size changed for {path}')

    img.save(path, format='PNG', optimize=True)
    print(f'Cleaned {path.name}: {original_size[0]}x{original_size[1]} (unchanged)')


def main() -> None:
    for key in HERO_KEYS:
        clean_in_place(LARGE_DIR / f'{key}.png')


if __name__ == '__main__':
    main()
