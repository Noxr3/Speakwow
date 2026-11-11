# Speakwow brand assets

One mark, with a few purpose-built applications. The supplied 100×100 JPEG is
preserved in [`assets/brand/reference.jpeg`](../assets/brand/reference.jpeg).
[`symbol.svg`](../assets/brand/symbol.svg) is a clean, editable redraw of its
interlocking S ribbons, with smooth Bézier curves and balanced rotational symmetry.
It is a reconstruction, not a lossless recovery of the original design file.

The reference's green–teal background and white symbol remain the identity.
Compression noise and baked shadows are omitted so the mark stays clear at small
sizes. The UI's existing green action color and restrained white navigation mark
remain separate from the icon's background treatment.

## Choose the right asset

| Use | Asset | Treatment |
| --- | --- | --- |
| README, repository and documentation | [`logo.svg`](../apps/web/public/brand/logo.svg) | White mark on an opaque green–teal tile; visible on light and dark pages |
| Dark App navigation | [`mark-white.svg`](../apps/web/public/brand/mark-white.svg) | Transparent white symbol, next to the Speakwow wordmark |
| Light surfaces | [`mark-ink.svg`](../apps/web/public/brand/mark-ink.svg) | Transparent deep-green symbol |
| Large exports | [`icon.svg`](../apps/web/public/brand/icon.svg), [`1024px PNG`](../apps/web/public/brand/icon-1024.png) | Square, full-bleed, opaque background |
| Browser tabs | [`app/icon.svg`](../apps/web/app/icon.svg), [`favicon.ico`](../apps/web/app/favicon.ico) | Simplified solid-green background; ICO contains 16, 32 and 48px frames |
| Apple home-screen bookmark | [`apple-icon.png`](../apps/web/app/apple-icon.png) | 180×180, square and opaque; the system supplies the corner mask |
| Web app installation | [`manifest.ts`](../apps/web/app/manifest.ts) | 192/512px icons plus a separate 512px maskable icon |
| Social sharing | [`opengraph-image.tsx`](../apps/web/app/opengraph-image.tsx) | 1200×630 card with the icon, name and short product description |

The manifest supplies install metadata, not offline support. The maskable icon
keeps the symbol inside the central safe circle; it is intentionally smaller than
the ordinary icon. Do not use the rounded README tile as an Apple touch icon.

## Application rules

- Spell the name **Speakwow**. Keep the symbol and wordmark as separate elements;
  don't put tiny lettering into favicons.
- Use the white mark on dark surfaces and the ink mark on light surfaces. For an
  uncontrolled background, use the opaque brand tile.
- Keep the mark square. Never stretch it, crop the ribbons or apply CSS filters to
  manufacture a different logo. Keep at least one-quarter of a mark's width clear
  around a standalone mark; the App's 28px navigation mark has an 8px wordmark gap.
- Keep navigation quiet: one brand link at the top left with the accessible label
  “Speakwow home”. Its adjacent decorative image uses an empty `alt` to avoid repetition.
- Export at the target size from SVG. Upscaling the supplied JPEG does not restore
  missing detail. Retain sRGB for predictable browser rendering.
- Provide square, unmasked artwork for OS-managed icons. Rounded corners are an
  application treatment for the web/documentation tile, not part of the symbol.

These choices follow Apple's guidance on [app icons](https://developer.apple.com/design/human-interface-guidelines/app-icons):
prefer vector layers, recognizable simple shapes, consistent appearances, opaque
full-bleed backgrounds and system-applied masks. This repository ships web icons;
it does **not** claim native Icon Composer/Liquid Glass appearance support. The SVG
foreground can serve as a starting layer if a native app is added later.

## Rebuild and verify

Edit the master in `assets/brand/symbol.svg`, or the palette/export treatments in
`scripts/brand-assets.mjs`, then run from the repository root:

```bash
pnpm brand:generate
pnpm --filter @speakwow/web build
```

Generated assets are committed, so deployment does not need an extra generation
step. Do not edit exported PNGs individually. Check the README on both light and
dark backgrounds; inspect favicons at actual 16/32px sizes, the 28px navigation mark,
the 180px touch icon, and the maskable icon under circle and rounded-square masks.
Visit `/opengraph-image` and inspect the page's icon, manifest and social metadata.

Set `NEXT_PUBLIC_SITE_URL` when self-hosting. Share images read the bundled icon
rather than fetching a protected preview URL or a third-party font.
