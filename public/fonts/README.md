# Buoy fonts

Self-hosted WOFF2 subsets from Google Fonts: Spectral v15, normal 500;
Red Hat Text v19, normal variable (declared 400–700). Latin and Latin Extended
are separate unicode subsets, so ordinary English loads only the Latin files.
Both families use SIL Open Font License 1.1; original notices are in each
family directory's OFL.txt. No runtime font service is used.

`fonts.css` owns only font-face declarations. Theme stacks should include
`Spectral Fallback` after Spectral and `Red Hat Text Fallback` after Red Hat Text.

Fallbacks were measured with fontTools against macOS Georgia regular and
Arial regular/bold: sum horizontal advance widths for the approved landing
headline, subhead, health/decision headings, account/notice/evidence labels,
UI actions, and digits 0–9, normalized by each font's units-per-em. Size-adjust
is target advance sum / fallback advance sum. Vertical overrides divide target
hhea ascent/descent by units-per-em and size-adjust; line gaps are zero.
Spectral hhea is 1059/-463/0 at UPEM 1000. Red Hat Text hhea is
1018/-305/0 at UPEM 1000 for all measured weights. Weight samples 400, 500,
600, 700 use the variable font's actual instantiated advances. Arial bold is
used for 600 and 700. Metrics minimize layout movement for this copy; they
cannot make every individual glyph identical. Local fonts are never shipped.

Source endpoints:
- https://fonts.googleapis.com/css2?family=Spectral:wght@500&display=swap
- https://fonts.googleapis.com/css2?family=Red+Hat+Text:wght@400..700&display=swap
- https://github.com/google/fonts/tree/main/ofl/spectral
- https://github.com/google/fonts/tree/main/ofl/redhattext
