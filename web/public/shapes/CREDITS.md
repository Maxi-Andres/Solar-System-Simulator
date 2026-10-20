# Shape model credits

The real shapes of the small bodies spacecraft have visited, from the mission teams'
own archives, and the maps draped on two of them, Bennu and Ryugu. Loaded lazily: a file is fetched only
once its body is a few pixels across on screen, exactly as a craft's model is.

Every file added here must be recorded below with its source and licence.
`web/src/scene/shapeModels.test.ts` enforces that: an uncredited file fails the build.

## Licence

### NASA: OSIRIS-REx, DART, New Horizons, Lucy

Bennu's, Didymos's, Arrokoth's and Donaldjohanson's models come from NASA's Planetary
Data System and NAIF's SPICE archives. The OSIRIS-REx bundles' DataCite records say:
"This is a work of the U.S. Government and is not subject to copyright protection in the
United States", and give the licence as **Creative Commons Zero v1.0 Universal**
(orex.altimetry, doi:10.26033/pzcf-qs69). The DART, New Horizons and Lucy products state
no licence of their own; PDS holdings are public data, and PDS asks only to be cited,
by the most specific DOI there is (https://pds.nasa.gov/datastandards/citing/) — which
each row does. Bennu's map is the USGS-hosted mosaic, "Use constraints: public domain;
please cite authors".

### JAXA: Hayabusa2

Ryugu's model and map are ISAS/JAXA's, under the **ISAS data policy**
(https://www.isas.jaxa.jp/en/researchers/data-policy/), read 2026-10-20:

> In principle, open data can be used free of charge, either for commercial or
> non-commercial purposes. They may be copied, forwarded or modified. […] When using
> data, please indicate origin of the data as "ISAS/JAXA". […] When the data are
> modified, please indicate the fact that the data were modified, and describe what kind
> of modification was made.

The policy follows the Government of Japan Standard Terms of Use 2.0 and is "compatible
with Creative Commons BY 4.0"; the Hayabusa2 SPICE bundle's DOI record lists all three.
The origin is shown as **ISAS/JAXA** in Ryugu's info panel and in About; the map's
images are the ONC team's, credited as JAXA asks for its ONC images: *JAXA, University of
Tokyo, Kochi University, Rikkyo University, Nagoya University, Chiba Institute of
Technology, Meiji University, Aizu University, AIST*. What was modified is said in each
row and under Processing below.

These are science data from DARTS, under the data policy above — not material from
JAXA's websites, whose separate terms of use forbid modifying it.

## Files

| File | Body | Product and source | Licence |
|---|---|---|---|
| `bennu.glb` | Bennu | OSIRIS-REx Altimetry Working Group, global shape model **SPO v54** (SPC + OLA lidar) at 3.17 m, `g_03170mm_spo_obj_0000n00000_v054.obj`, 196,608 facets — https://sbnarchive.psi.edu/pds4/orex/orex.altimetry/data_derived_altimetry_global_models/global_digital_terrain_models/SPOv54/ — Daly, Barnouin, Espiritu, Lauretta, orex.altimetry bundle, doi:10.26033/pzcf-qs69; Barnouin et al., Nat. Geosci. 12, 247 (2019); Daly et al., Sci. Adv. 6, eabd3649 (2020). The bundle says "USE SPOv54 FOR SCIENTIFIC ANALYSIS"; the 3.1 M-facet level of the same model is 225 MB | US Government work, CC0 1.0 |
| `ryugu.glb` | Ryugu | Hayabusa2 SPC shape model **v20200323**, 200k level (196,608 plates), `ryugu_shape_spc_200k_v20200323.bds` — https://data.darts.isas.jaxa.jp/pub/pds4/data/hyb2/hyb2_spice/spice_kernels/dsk/ — Murakami, Yamamoto, Ishihara, Crombie, Hayabusa2 SPICE Kernel Archive Bundle v1.0, doi:10.17597/isas.darts/hyb2-00600; Watanabe et al., Science 364, 268 (2019). **Modified**: read out of the DSK to vertices and plates, unchanged, then converted and compressed as below; texture coordinates added | ISAS/JAXA, ISAS data policy (CC BY 4.0 compatible) |
| `ryugu.jpg` | Ryugu | Hayabusa2 ONC **v-band normal albedo map**, `v-band_Normal_albedo_map.tif`, 3600 × 1800, 0.1°/px — https://data.darts.isas.jaxa.jp/pub/hayabusa2/map_product/05_ONC_Normal_Albedo_v-band/ (described at https://jlpeda.jaxa.jp/product/archive/detail_02/) — Yokota et al., PSJ 2, 177 (2021), doi:10.3847/PSJ/ac14ba. **Modified**: the 2.1% of pixels with no data, near the poles, filled by diffusion from their edges; each albedo divided by the map's maximum, 0.0822, and stored through the sRGB curve as 8-bit greyscale JPEG (quality 90), so the texture decodes back to a value proportional to albedo | ISAS/JAXA, ISAS data policy (CC BY 4.0 compatible); images JAXA, University of Tokyo & collaborators |
| `bennu.jpg` | Bennu | OSIRIS-REx OCAMS **global PAN mosaic** on shape v28, Minnaert-corrected to 30° phase, 5 cm/px (Bennett et al., Icarus 357, 113690, 2021, doi:10.1016/j.icarus.2020.113690), the USGS 8-bit GeoTIFF `Bennu_global_FB34_FB56_ShapeV28_GndControl_MinnaertPhase30_PAN_8bit.tif`, 31,417 × 15,709 — https://astrogeology.usgs.gov/search/map/bennu_osiris_rex_ocams_global_pan_mosaic_5cm (archived in PDS orex.image_processing, doi:10.26033/2xn1-t489). Area-averaged over its mapped pixels to 2048 × 1024; the 0.1% with no data filled by diffusion from their edges; the 8-bit values, taken as linear in reflectance, stored through the sRGB curve as greyscale JPEG (quality 88) | Public domain (USGS: "please cite authors") |
| `didymos.glb` | Didymos | DART Science Operations Center, **didymos_model_v003** at 4.66 m, `didymos_g_4657mm_spc_obj_0000n00000_v003.obj`, 196,608 facets — https://pds-smallbodies.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/ — Daly, Barnouin, Ernst, Nair, Espiritu, Waller, doi:10.26007/bm57-x327; Daly et al., Nature 616, 443 (2023). The 3.1 M-facet level is 221 MB | PDS public data, cited by DOI |
| `arrokoth.glb` | Arrokoth | New Horizons, **Porter et al. 2024** shape model, `arrokoth_porter_2024_v01.obj`, 40,960 facets, the one resolution published — https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived:arrokoth_shapemodel_porter2024-v1.0/ — urn:nasa:pds:nh_derived:arrokoth_shapemodel_porter2024; Porter et al., "The Shape of (486958) Arrokoth" (submitted to PSJ). Its own texture coordinates, for an albedo map in a projection of its own, are not used | PDS public data, cited by URN |
| `donaldjohanson.glb` | Donaldjohanson | Lucy, DLR (Mottola, Preusker), `lcy_donj_k548_iso20m_v10.bds`, 547,996 plates at 20 m, the one resolution published, the model Marchi et al., Science 392, 1291 (2026), doi:10.1126/science.aec0503, point to — https://naif.jpl.nasa.gov/pub/naif/pds/pds4/lucy/lucy_spice/spice_kernels/dsk/ — urn:nasa:pds:lucy.spice:spice_kernels:dsk_lcy_donj_k548_iso20m_v10.bds. Read out of the DSK to vertices and plates, unchanged | PDS public data, cited by URN |

Each body is turned by the PCK its model was published with; which one, and why, is
written above each body in `tools/src/smallBodies.ts`.

## Not here

- **Dinkinesh** and **Selam**: no shape model has been released. Levison et al., Nature
  629, 1015 (2024), made one from Lucy's L'LORRI images but archived none; Lucy's SPICE
  archive has no DSK for either, and NAIF's Dinkinesh PCK carries placeholder values
  (pole at RA 0, Dec +90, "per project convention"). Searched 2026-10-20.
- **Dimorphos**: DART's model v004 exists (196,608 facets, doi:10.26007/0nss-vd15), but
  Dimorphos is not a body in this catalog yet — JPL Horizons has its ephemeris only from
  2026-07-02 to 2027-06-30. When it is added, its model goes here.
- **A map of Didymos, Arrokoth or Donaldjohanson**: none global. DART saw one side of Didymos; Porter's Arrokoth map and Lucy's images
  cover the imaged half only.

## Processing

Each model was converted from its archive's form to a GLB with glTF-Transform 4.5.1's
core library — positions in kilometres, in the body-fixed frame, exactly as published;
vertex normals, area-weighted from the facets; and, where a map is drawn, texture
coordinates from each vertex's own planetocentric latitude and longitude (u east from
the map's left edge, the vertices of facets that straddle it duplicated at u + 1; v = 1
at the north pole). The OSIRIS-REx OBJs carry 1,540 unreferenced duplicate vertices,
which their own headers point out; they were dropped. **No facet was removed, merged or
moved**: every file holds exactly its source's facet count, checked by the test. Then:

```
npx @gltf-transform/cli meshopt <name>-raw.glb <name>.glb --quantize-position 16 --quantize-normal 12 --quantize-texcoord 16
```

meshopt compression with positions quantised to 16 bits: 9 mm across Bennu's 565 m,
2.2 cm across Didymos, 0.14 m across Donaldjohanson, 0.53 m across Arrokoth's 34.5 km —
each well under its model's own facet size. The models are to scale, at their true size.
