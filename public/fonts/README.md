# Buoy fonts

Every face is self-hosted WOFF2 under the SIL Open Font License 1.1; each
family's licence and copyright notice is the `OFL.txt` beside it. No page
makes a font request to a third party, and local fonts are never shipped.

- `inter/`: Inter, variable weight (100–900) and optical size (14–32), Latin and
  Latin Extended, from Fontsource's `@fontsource-variable/inter` 5.3.0
  (upstream https://github.com/rsms/inter). Buoy's brand face: the wordmark,
  every run-site heading (weight 860–900 with tight tracking; the browser
  picks the display cut at headline sizes) and body line, `/run`, the Lobby
  and sign-in.
- `caveat/`: Caveat, variable weight, Latin, from `@fontsource-variable/caveat`
  5.3.0 (upstream https://github.com/googlefonts/caveat). Only the hand-inked
  notes, stickies and "At risk" / "Renewed" labels in the run site's drawings.
- `plex-mono/`: IBM Plex Mono 400 and 500, Latin and Latin Extended, from
  `@fontsource/ibm-plex-mono` 5.3.0 (upstream https://github.com/IBM/plex).
  Commands, the terminal and the `/buoy` lookup.
- `spectral/` and `red-hat-text/`: Spectral 500 (Google Fonts v15) and Red Hat
  Text variable 400–700 (v19), the app's headings and text until the app takes
  the desk's look (upstream https://github.com/google/fonts/tree/main/ofl/spectral
  and https://github.com/google/fonts/tree/main/ofl/redhattext).

`fonts.css` declares every face once; Latin and Latin Extended are separate
unicode ranges, so English pages load only the Latin files. `public/rer-theme.css`
imports it, so every page that links the theme gets the faces.

The Spectral and Red Hat Text fallbacks (`Spectral Fallback`, `Red Hat Text
Fallback`) were measured with fontTools against macOS Georgia regular and
Arial regular/bold: size-adjust is the target advance-width sum over the
fallback's for the app's headings, labels and digits, and the vertical
overrides divide the target hhea ascent/descent by units-per-em and
size-adjust; line gaps are zero.
