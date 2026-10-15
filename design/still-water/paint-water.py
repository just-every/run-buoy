"""Compose water-only approved-image crops into responsive, text-free artwork.

Run from this directory with Python, Pillow and NumPy. No model or network call.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent


def scene(width, height, mobile=False):
    horizon = 183 if mobile else 237
    rows = np.arange(height)[:, None, None]
    progress = np.clip(rows / horizon, 0, 1)
    sky = np.array([251, 250, 247]) * (1 - progress) + np.array([223, 227, 229]) * progress
    pixels = np.broadcast_to(sky, (height, width, 3)).copy()

    # Actual calm water pixels, sampled with a slowly varying perspective.
    texture = np.array(Image.open(ROOT / 'water-texture.webp').resize((width, height - horizon), Image.Resampling.LANCZOS))
    for y in range(horizon, height):
        depth = (y - horizon) / (height - horizon)
        ripples = texture[y - horizon].astype(float)
        mean = ripples.mean(axis=0)
        colour = np.array([213, 222, 227]) * (1 - depth) + np.array([168, 188, 202]) * depth
        pixels[y] = colour + (ripples - mean) * (.7 + .3 * depth)
    canvas = Image.fromarray(np.uint8(np.clip(pixels, 0, 255)))

    # These source rectangles contain scenery only. Keep the marker at 84%.
    if mobile:
        crop = Image.open(ROOT / 'horizon-mobile.webp').convert('RGB')
        band = crop.resize((width, round(crop.height * width / crop.width)), Image.Resampling.LANCZOS)
        top = 149
        feather_top, feather_bottom = 12, 17
    else:
        crop = Image.open(ROOT / 'horizon-desktop.webp').convert('RGB')
        band = Image.new('RGB', (1440, crop.height))
        band.paste(ImageOps.mirror(crop.crop((0, 0, 404, crop.height))), (0, 0))
        band.paste(crop, (404, 0))
        top = 115
        feather_top, feather_bottom = 45, 42
    mask = np.full((band.height, band.width), 255, dtype=np.uint8)
    for y in range(band.height):
        alpha = min(1, y / feather_top, (band.height - y - 1) / feather_bottom)
        mask[y] = round(max(0, alpha) * 255)
    canvas.paste(band, (0, top), Image.fromarray(mask))
    canvas.save(ROOT.parent.parent / 'public' / 'design-assets' / f'still-water-{width}.webp', quality=92, method=6)


if __name__ == '__main__':
    scene(1440, 650)
    scene(390, 950, mobile=True)
