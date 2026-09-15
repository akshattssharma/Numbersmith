# World art

`starship.jpg`, `grove.jpg`, and `vault.jpg` are cropped from concept mockups
the product owner generated externally (not by this codebase) and supplied
for integration. They're used here as backdrop art for the three existing
worlds, with the company/background chrome cropped away.

If these are ever replaced with commissioned or licensed art, keep the same
filenames — `Play.tsx` references them directly — or update the `WORLD_ART`
map in `src/screens/Play.tsx`.

The companion (Lumie) used to be a cropped PNG here too; it's now an inline
SVG (`src/components/Lumie.tsx`), so there's no image asset for it anymore.
