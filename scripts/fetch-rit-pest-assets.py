#!/usr/bin/env python3
"""Download and resize RIT pest PNG assets into assets/pests/."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LARGE_DIR = ROOT / 'assets' / 'pests' / 'large'
SMALL_DIR = ROOT / 'assets' / 'pests' / 'small'
MANIFEST_PATH = ROOT / 'assets' / 'pests' / 'manifest.json'

LARGE_WIDTH = 64
SMALL_WIDTH = 16

# Public-domain / CC0 sources (Wikimedia Commons and NIAID/NIH where noted).
ASSETS = {
    'mice': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Mouse_transparent_background.png',
    'rats': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Rattus_norvegicus_1.jpg',
    'moles': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Talpa_europaeaMHNT.jpg',
    'voles': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Microtus_pennsylvanicus.jpg',
    'tick': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Ixodes_scapularis.jpg',
    'mosquito': 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Aedes_aegypti.jpg',
    'carpenter-ant': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Camponotus_pennsylvanicus.jpg',
    'carpenter-bee': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Xylocopa_virginica.jpg',
    'cockroach': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Periplaneta_americana.jpg',
    'odorous-ant': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Tapinoma_sessile.jpg',
    'flea': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Pulex_irritans.jpg',
    'centipede': 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Scolopendra_heros.jpg',
    'pavement-ant': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Tetramorium_caespitum.jpg',
    'spider': 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Araneus_diadematus.jpg',
    'cricket': 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Gryllus_campestris.jpg',
    'wasp': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Vespula_germanica.jpg',
    'lady-beetle': 'https://upload.wikimedia.org/wikipedia/commons/5/51/Harmonia_axyridis.jpg',
    'silverfish': 'https://upload.wikimedia.org/wikipedia/commons/9/9f/Lepisma_saccharina.jpg',
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


def remove_near_white_background(img: Image.Image, threshold: int = 245) -> Image.Image:
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
    if img.width == 0 or img.height == 0:
        return img
    ratio = width / img.width
    height = max(1, round(img.height * ratio))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def fetch_image(url: str) -> Image.Image:
    response = requests.get(
        url,
        timeout=30,
        headers={'User-Agent': 'GreenShieldDashboard/1.0 (pest-asset-builder; contact@example.com)'},
    )
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content))


def save_asset(key: str, img: Image.Image) -> None:
    img = remove_near_white_background(img)
    img = trim_transparent(img)

    large = resize_to_width(img, LARGE_WIDTH)
    small = resize_to_width(img, SMALL_WIDTH)

    LARGE_DIR.mkdir(parents=True, exist_ok=True)
    SMALL_DIR.mkdir(parents=True, exist_ok=True)

    large.save(LARGE_DIR / f'{key}.png', format='PNG')
    small.save(SMALL_DIR / f'{key}.png', format='PNG')


def main() -> int:
    failures: list[str] = []
    for key, url in ASSETS.items():
        try:
            print(f'Fetching {key}...')
            save_asset(key, fetch_image(url))
        except Exception as exc:  # noqa: BLE001
            failures.append(f'{key}: {exc}')
            print(f'  failed: {exc}', file=sys.stderr)

    manifest = {
        'largeWidth': LARGE_WIDTH,
        'smallWidth': SMALL_WIDTH,
        'headers': HEADER_KEYS,
        'rows': ROW_KEYS,
        'addonSecondary': 'mosquito',
        'files': sorted(ASSETS.keys()),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    if failures:
        print('Failures:', failures, file=sys.stderr)
        return 1
    print(f'Wrote pest assets to {ROOT / "assets" / "pests"}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
