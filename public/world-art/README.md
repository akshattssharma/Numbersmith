# World art

`starship.jpg`, `grove.jpg`, `vault.jpg`, and `lumie.png` are cropped from
concept mockups the product owner generated externally (not by this codebase)
and supplied for integration. They're used here as backdrop art for the three
existing worlds and as the single companion character (Lumie), with the
company/background chrome cropped away and, for Lumie, the dark background
keyed to transparency by luminance threshold so it composites over any world.

If these are ever replaced with commissioned or licensed art, keep the same
filenames — `Play.tsx` and `Lumie.tsx` reference them directly — or update the
`WORLD_ART` map in `src/screens/Play.tsx` and the path in
`src/components/Lumie.tsx`.
