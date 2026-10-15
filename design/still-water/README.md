# Still-water artwork

`public/design-assets/still-water-1440.webp` (1440 × 650) and `public/design-assets/still-water-390.webp`
(390 × 950) are local, text-free backgrounds. Use them as decorative images.
They contain scenery only: no product cards, UI text, or card reflections.
The desktop buoy is at 84% across; the phone buoy is at 86%, beside the
upper card. Horizons are 237px and 183px from the top respectively.

The horizon and water source rectangles are extracted from the approved
`HERO-PICK.png` and `HERO-PICK-390.png` in the design evidence. Desktop
uses x500–1536, y445–652 for the horizon, extended at left by mirroring
its first 404 pixels. Phone uses x0–1024, y665–835. The water texture
uses the desktop's clear far-left strip x0–104, y620–1024. These rectangles
exclude all UI and card reflections. The sky is a paper-to-pearl gradient;
the water strip is stretched horizontally, recoloured and blended below
the horizon. No additional image generation or external image requests.

`paint-water.py` reproduces the two final files from these small source
WebPs with Python, Pillow and NumPy. The app's independent, faint vector
water band lives at `/brand/band.svg`.
