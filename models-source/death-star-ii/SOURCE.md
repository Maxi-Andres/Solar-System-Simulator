# Death Star II — source model

- **Title:** Death Star II
- **Author:** N8 — https://sketchfab.com/nathanmlange
- **Source:** https://sketchfab.com/3d-models/death-star-ii-17ccca0dbb6b4e338fa999202f9e6685
- **Licence:** CC BY 4.0 — http://creativecommons.org/licenses/by/4.0/
  (as stated in each file's glTF `asset.extras`)
- **Downloaded:** 2026-11-27, from Sketchfab, by Maxi.

The same model, two downloads (geometry identical: 12 meshes, 12,214 triangles, 11 materials):

| File | Textures | Size |
| --- | --- | --- |
| `death-star-ii-textures-1k.glb` | 14 maps, 1024² | 22 MB |
| `death-star-ii-textures-4k.glb` | 14 maps, 2048²–4096² | 133 MB |

Not published as they are: `../death-star/build.mjs` makes the app's asset,
`web/public/models/fiction/death-star-ii.glb`, from the 4k file (kept locally, see Git below) — its
textures re-encoded as 2048-pixel WebP at quality 70: 8.8 MB. The app also lifts its darkest
material factors when drawing it (`scene/fiction/looks/deathStar.ts`, `baseFloor`): an adaptation,
said in its About page as CC BY asks.

    node ../death-star/build.mjs death-star-ii-textures-4k.glb ../../web/public/models/fiction/death-star-ii.glb 2048 70

**Licence notes:**
- BY: the author must be credited wherever the model is shown (About / panel), with the licence
  and a note of any changes made. Adapting it (simplifying, recompressing, re-materialing) is allowed.
- **Git:** `death-star-ii-textures-4k.glb` is 133 MB, over GitHub's 100 MB per-file limit — a push
  with it committed is refused. Keep it out of git (or use Git LFS).
