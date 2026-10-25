# Buoy fonts

Every face is self-hosted WOFF2 under the SIL Open Font License 1.1; each
family's licence and copyright notice is the `OFL.txt` beside it. No page
makes a font request to a third party, and local fonts are never shipped.

- `inter/`: Inter, variable weight (100–900) and optical size (14–32), Latin and
  Latin Extended, from Fontsource's `@fontsource-variable/inter` 5.3.0
  (upstream https://github.com/rsms/inter). Buoy's brand face: the wordmark,
  every run-site heading (weight 860–900 with tight tracking; the browser
  picks the display cut at headline sizes) and body line, `/run`, the Lobby,
  sign-in, setup and every app screen.
- `caveat/`: Caveat, variable weight, Latin, from `@fontsource-variable/caveat`
  5.3.0 (upstream https://github.com/googlefonts/caveat). Only the hand-inked
  notes, stickies and "At risk" / "Renewed" labels in the run site's drawings
  and the renewal sticky on the app's open runway band.
- `plex-mono/`: IBM Plex Mono 400 and 500, Latin and Latin Extended, from
  `@fontsource/ibm-plex-mono` 5.3.0 (upstream https://github.com/IBM/plex).
  Commands, the terminal and the `/buoy` lookup.
`fonts.css` declares every face, then Buoy's tokens and the rules that dress
Base's pages; `public/rer-theme.css`, the theme rer's reader takes, repeats the
faces so the installer serves them (change both). Latin and Latin Extended are
separate unicode ranges, so English pages load only the Latin files.
