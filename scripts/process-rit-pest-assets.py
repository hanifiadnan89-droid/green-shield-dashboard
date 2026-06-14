#!/usr/bin/env python3
"""Process generated pest source PNGs into bundled RIT PDF assets."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path('/opt/cursor/artifacts/assets')
LARGE_DIR = ROOT / 'assets' / 'pests' / 'large'
SMALL_DIR = ROOT / 'assets' / 'pests' / 'small'
MANIFEST_PATH = ROOT / 'assets' / 'pests' / 'manifest.json'

LARGE_WIDTH = 64
SMALL_WIDTH = 16

SOURCE_FILES = {
    'mice': 'mice-source.png',
    'rats': 'rats-source.png',
    'moles': 'moles-source.png',
    'voles': 'voles-source.png',
    'tick': 'tick-source.png',
    'mosquito': 'mosquito-source.png',
    'carpenter-ant': 'carpenter-ant-source.png',
    'carpenter-bee': 'carpenter-bee-source.png',
    'cockroach': 'cockroach-source.png',
    'odorous-ant': 'odorous-ant-source.png',
    'flea': 'flea-source.png',
    'centipede': 'centipede-source.png',
    'pavement-ant': 'pavement-ant-source.png',
    'spider': 'spider-source.png',
    'cricket': 'cricket-source.png',
    'wasp': 'wasp-source.png',
    'lady-beetle': 'lady-beetle-source.png',
    'silverfish': 'silverfish-source.png',
}

HEADER_KEYS = {
    'Mice': 'mice',
    'Rats': 'rats',
    'Moles': 'moles',
    'Voles': 'voles',
    'Add-ons': 'tick',
}

ROW_KEYS = {
    'Mice': 'mice',
    'Carpenter Ants': 'carpenter-ant',
    'Carpenter Bees': 'carpenter-bee',
    'Cockroaches': 'cockroach',
    'Rats': 'rats',
    'Odorous Ants': 'odorous-ant',
    'Fleas': 'flea',
    'Centi/Millipedes': 'centipede',
    'Moles': 'moles',
    'Pavement Ants': 'pavement-ant',
    'Spiders': 'spider',
    'Crickets/Earwigs': 'cricket',
    'Voles': 'voles',
    'Wasps': 'wasp',
    'Fall Invaders': 'lady-beetle',
    'Springtails/Silverfish': 'silverfish',
    'Ticks/Mosquitoes': 'tick',
}


def remove_near_white_background(img: Image.Image, threshold: int = 242) -> Image.Image:
    img = img.convert('RGBA')
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
    return img


def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def resize_to_width(img: Image.Image, width: int) -> Image.Image:
    ratio = width / img.width
    height = max(1, round(img.height * ratio))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def main() -> None:
    LARGE_DIR.mkdir(parents=True, exist_ok=True)
    SMALL_DIR.mkdir(parents=True, exist_ok=True)

    for key, filename in SOURCE_FILES.items():
        source = ARTIFACTS / filename
        if not source.exists():
            raise FileNotFoundError(f'Missing source image: {source}')
        img = Image.open(source)
        img = remove_near_white_background(img)
        img = trim_transparent(img)
        resize_to_width(img, LARGE_WIDTH).save(LARGE_DIR / f'{key}.png', format='PNG')
        resize_to_width(img, SMALL_WIDTH).save(SMALL_DIR / f'{key}.png', format='PNG')
        print('Processed', key)

    manifest = {
        'largeWidth': LARGE_WIDTH,
        'smallWidth': SMALL_WIDTH,
        'headers': HEADER_KEYS,
        'rows': ROW_KEYS,
        'addonSecondary': 'mosquito',
        'files': sorted(SOURCE_FILES.keys()),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('Wrote manifest to', MANIFEST_PATH)


if __name__ == '__main__':
    main()
