# Death Star (I) — source model

- **Title:** Death Star - Star Wars
- **Author:** SebastianSosnowski — https://sketchfab.com/SebastianSosnowski
- **Source:** https://sketchfab.com/3d-models/death-star-star-wars-3d5f01485e9e4e8b9d995d7764341afe
- **Licence:** CC BY-NC-ND 4.0 — http://creativecommons.org/licenses/by-nc-nd/4.0/
  (as stated in each file's glTF `asset.extras`)
- **Downloaded:** 2026-11-27, from Sketchfab, by Maxi.

The same model, three downloads (geometry identical: 2 meshes, 33,447 triangles, 2 materials):

| File | Textures | Size |
| --- | --- | --- |
| `death-star-untextured.glb` | none | 1.4 MB |
| `death-star-textures-1k.glb` | 7 maps, 1024² | 4.2 MB |
| `death-star-textures-4k.glb` | 7 maps, 4096² | 34 MB |

Not published as they are: `build.mjs` here makes the app's asset,
`web/public/models/fiction/death-star.glb`, from the 4k file — its textures re-encoded as 2048-pixel
WebP and nothing else changed (a format change, which ND allows): 3.0 MB.

    npm install && node build.mjs death-star-textures-4k.glb ../../web/public/models/fiction/death-star.glb

**Licence notes** (settled 2026-11-27: the author is a friend of Maxi's and gave the model to the project; it is used unmodified and credited all the same):
- BY: the author must be credited wherever the model is shown (About / panel).
- NC: fine for this non-commercial project.
- ND: no adapted material may be shared. Re-encoding or compressing for the web is a format
  change (CC 4.0 §2(a)(4) allows that); simplifying the mesh, removing parts or changing its
  materials is an adaptation, which ND forbids publishing. Either ship it unmodified (bar format
  changes) or ask the author's permission.
