# Scattered pencil background and liquid glass

Generated using the built-in image-generation tool.

The current revision's prompt and equation sources are in [diverse-pencil-equations.md](diverse-pencil-equations.md).

Current asset: `dist/assets/scattered-pencil-evolution-equations.webp` (1254 × 1254, optimized WebP). The preceding `dist/assets/scattered-pencil-caricatures.webp`, `dist/assets/scattered-pencil-science.webp`, and earlier artwork files remain intact.

The current background adds flagellated and dividing bacteria, a bacteriophage, more varied protein and bot caricatures, and handwritten Fisher and Price equations. It retains thick gray and dark-green pencil strokes with minimal shading. The wallpaper is another 20% smaller at each breakpoint: 652.4928 px minimum desktop width / 55.296 vw, 580.608 px tablet, and 497.664 px mobile. It is displayed at 25% opacity with multiply blending over a solid soft forest-green background (`#d8e5dd`). A stable hash of each route varies both horizontal and vertical position without layout shifts or client-side reshuffling. The drawings are conceptual rather than validated biological diagrams.

`dist/atmosphere.css` provides the site-wide wallpaper and glass surfaces. Every top-level content section has a glass surface, as do the homepage copy, caption, navigation and footer. Existing cards and forms use the same finish. Backdrop-filter support enables translucent gradients and soft blur; unsupported browsers receive a more opaque surface. Reduced-transparency preferences and print output use opaque backgrounds.

The wallpaper tiles continuously in both directions across the full page, with no fixed-width artwork column. It moves at 50% of the content's scroll speed. `dist/site.js` updates its background offset once per animation frame using a passive scroll listener, including when a saved scroll position is restored. Reduced-motion preferences disable parallax; without JavaScript, the background scrolls normally.

## Original fine-pencil generation prompt

Use case: stylized-concept.
Asset type: seamless, repeating all-over pencil wallpaper for a sophisticated evolutionary-science website, square 2048 x 2048.
Primary request: randomly scattered viruses, proteins, B-cells, T-cells, financial market plots, and AI bots, ALL in LIGHT GRAY graphite pencil.
Draw about eighteen separate small motifs, three variations of each of these six subjects, scattered casually across the WHOLE square with irregular positions, sizes and gentle rotations. No rows, no columns, no grid layout, no central focus. Most space is blank: approximately 70 percent open white background between motifs.
Subjects:
- recognizable viral particles, some spherical with sparse surface spikes, some faceted capsids;
- folded protein ribbon structures with small alpha helices and beta sheets;
- B lymphocytes as round cells with visible Y-shaped antibody receptors on their surface and a softly indicated large nucleus;
- T lymphocytes as round slightly irregular cells with shorter surface receptor complexes and softly suggested nuclei; include one small T-cell-to-target-cell contact sketch;
- small standalone financial-market plots with understated axes, candlesticks and gently fluctuating price curves, no words or numbers;
- small elegant AI robot heads and compact robotic forms with a few circuit-like or neural-network details, technical rather than childish.
Style: hand-drawn LIGHT GRAY pencil only. Confident contours and delicate soft graphite shading, visible pencil grain, precise but relaxed scientific sketchbook quality. All marks pale silver-gray, never black, no green, no other color. White blank paper background, perfectly uniform and without vignetting or paper grain outside the drawings. No labels, no letters, no equations, no logos, no watermark.
Composition: an irregular, well-spaced scattering of individual recognizable drawings with no connecting lines between motifs. A few motifs can cross the image edges only if the opposite edges match perfectly for seamless tiling. Otherwise leave a narrow clean white edge so there are no chopped objects. Balance all six subjects across the full square; do not place them only on one side. This is background artwork, not a webpage mockup.

## Current coarse-caricature edit prompt

Reference image: `dist/assets/scattered-pencil-science.webp`. Edited with the built-in image-generation tool and saved as `dist/assets/scattered-pencil-caricatures.webp`.

Edit the attached scientific pencil wallpaper into a new MUCH SPARSER version with a radically coarser drawing style.
Asset: square website background wallpaper, same square format.
Keep the same six subject families: viruses, folded proteins, B-cells, T-cells, small financial market charts, and AI bots. Reduce the composition to ONLY 10 isolated drawings in the whole square, unevenly and randomly scattered. Use two virus caricatures, two loose protein-ribbon caricatures, one B-cell with a few Y-shaped receptors, one T-cell with short receptors, two minimalist financial chart sketches, and two simple angular AI-bot heads. The cells are scientific caricatures, not smiling faces.
Style: VERY LARGE THICK HEAVY PENCIL STROKES, coarse confident rough gestures, visible granular pencil marks and broken edges, each motif made with a small number of bold strokes. Simplify details drastically. No fine engraving, no photorealistic anatomy, no delicate thin contours. Mostly hollow shapes, MINIMAL SHADING OR NONE. No tonal gradients, no gray-filled modeled surfaces, no hatching. Use only gray graphite and DARK FOREST GREEN colored pencil (#355e52), distributed naturally across the motifs. White background, absolutely uniform with no vignette or paper texture outside strokes. No text, labels, letters, numbers or watermark.
Each drawing should occupy about 12–17 percent of the square's width (roughly the same relative size as individual drawings in the reference); the website will enlarge the entire image by 1.5 afterward. Make the reduced count and the space BETWEEN drawings create the sparsity. At least 80 percent open white space.
Layout: deliberately irregular, random-feeling, with large uneven empty regions. Vary positions, mild rotations and proportions; do not arrange in evenly spaced rows or columns. Keep all motifs at least 4 percent away from the image edges, no clipping. No connecting branches between objects, no central illustration, no background grid. Distribute drawings across the whole square so this can repeat vertically as a quiet spacious wallpaper.


