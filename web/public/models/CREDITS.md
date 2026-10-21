# Spacecraft model credits

3D models of the spacecraft, loaded lazily: a file is fetched only once its craft is a
few pixels across on screen. Nothing here is downloaded until you approach a craft.

Every file added here must be recorded below with its source and licence.
`web/src/scene/craftModels.test.ts` enforces that: an uncredited model fails the build.

## Licence

### NASA

The NASA models are from NASA 3D Resources and NASA's mission pages. NASA's media guidelines
(https://www.nasa.gov/nasa-brand-center/images-and-media/) say its 3D content — "texture
maps and polygon data in any format" — is "generally not subject to copyright in the
United States", and may be used for "computer graphical simulations and Internet Web
pages". **NASA should be acknowledged as the source**, which is what this file and the
About panel do. No NASA endorsement is implied, and no NASA insignia is used.

The Earth satellites' NASA models come from the same places and under the same
guidelines -- NASA 3D Resources and NASA's mission pages -- with four hosted elsewhere
by NASA. SDO's is only in the nasa/NASA-3D-Resources repository, whose README says its
assets "are free and without copyright". SMAP's and GRACE-FO's are NASA VTAD's, the team
that made the Voyager and Europa Clipper models, offered for download on JPL's mission
sites (smap.jpl.nasa.gov, gracefo.jpl.nasa.gov), which state no terms for 3D files --
JPL's image-use policy covers images and video only. GOES-R's is on its science.nasa.gov
mission page, which states no terms either and credits its labelled renderings, not the
file, to Lockheed Martin, GOES-R's builder. All four are used on NASA's media guidelines,
credited to NASA, and nobody was asked: the project owner's call to confirm. The
second-generation TDRS model on NASA 3D Resources is credited there "NASA/JPL/Eyes on the
Solar System", like the Eyes models below, but is published by 3D Resources itself, under
its rules.

### NASA's Eyes on the Solar System — six by written permission, two not yet

Six models come from NASA's Eyes on the Solar System, as its app loads them from
eyes.nasa.gov/assets/static/models/: Lucy, Psyche, IMAP, ESCAPADE (both probes), CAPSTONE
and Orion (Artemis I and II). They are credited **NASA/JPL-Caltech**. No licence or terms
are stated in them, on the page, or in the app, so the NASA's Eyes team was asked on
2026-10-08 whether they could be used "compressed, otherwise unchanged, served from the
site and credited 3D model: NASA/JPL-Caltech (NASA's Eyes)".

They were added on 2026-10-14, **before any answer**, under NASA's media guidelines above:
the project owner's choice, recorded here as it was made. The answer came by email on
2026-10-19, from Jason Craig of the NASA's Eyes team at JPL:

> Yes, you may use those models, as long as you continue to give credit to NASA.

The permission covers exactly the six models named in the request and nothing else Eyes
publishes; any other Eyes model needs asking again. Its one condition, credit to NASA, is
met where the models are used -- each craft's info panel names its model NASA's, and the
About panel says these six are NASA's, from Eyes -- and by this file. The request's own
terms are kept too: the files are compressed and otherwise unchanged (see below). Orion's
textures carry the NASA and ESA logos as the real spacecraft does; they are part of the
model and are not used as branding here.

Two more Eyes models were added on 2026-10-19, **outside that permission**: Hayabusa2
(JAXA's craft) and Danuri (KARI's), both NASA's models, from the same asset path. They
are used on the basis the six were first used on -- NASA's media guidelines, for a
non-commercial educational site, with NASA credited -- by the project owner's decision,
and credited the same way, **NASA/JPL-Caltech (NASA's Eyes)**. Written permission for
them is to be asked of the same team, in the thread of its first answer; this file will
record the answer either way, and the two come out if it is no. Neither JAXA nor KARI has published a model of
its craft, and neither was asked first.

### ESA — by written permission

ESA's models are used **by written permission only**: ESA's general terms forbid
redistributing them. The permission was given by email from ESA's Communication
Department (Image Distribution for Professionals): first, received 2026-10-09, for the
models of JUICE, Solar Orbiter, BepiColombo, Hera, Euclid and Gaia; then, received
2026-10-13, for **ESA's 3D models generally**, used to represent spacecraft and other
space-related objects in this open-source, non-commercial educational simulator. The
conditions of the two together:

- the models may be converted to glTF/GLB, compressed where necessary, and hosted on
  this project's site, **provided the original geometry is preserved and the models are
  not misrepresented** — so these files are converted and compressed, never simplified,
  and each stands for the craft it is a model of;
- the attribution **"3D models © ESA (European Space Agency)."** is shown wherever the
  models are used — the info panel of every craft drawn with one, and the About panel;
- any use for commercial purposes, or outside this project, needs ESA's separate
  authorization. These files are not covered by any licence this repository's code may
  carry;
- any copyright notice or licensing condition attached to an individual model is kept,
  and respected: see each row.

Three Earth satellites are drawn with ESA's models under the second permission, for
ESA's models generally: XMM-Newton and SMILE from the ESA SPICE Service's Cosmographia
packages (spiftp.esac.esa.int/data/SPICE/XMM/ and /SMILE/misc/cosmo/), which the SPICE
Service says are Sci-Fleet's models -- Sci-Fleet itself was unreachable on 2026-10-21 --
and CryoSat-2 from ESA's Visuals by Earth Online (visuals.earth.esa.int), whose own terms
forbid redistribution and derivative works without ESA's permission, which the second
permission is. They carry ESA's credit in the satellite's info panel and in About. The
SPICE Service asks its data to be cited by its datasets' DOIs; its table lists none for
XMM-Newton or SMILE (checked 2026-10-21), so they are cited by the package's URL.

The ESA SPICE Service also answered, received 2026-10-14: its models "are publicly
distributed", free to use, each cited by the DOI of its mission's SPICE kernel dataset.
Juice's and Hera's models here are assembled from SPICE parts, and their rows carry those
citations; the other ESA models come from Sci-Fleet, not SPICE.

## Files

| File | Craft drawn with it | Source |
|---|---|---|
| `voyager.glb` | Voyager 1, Voyager 2 | https://science.nasa.gov/resource/voyager-3d-model/ — `Voyager.glb`, credit NASA Visualization Technology Applications and Development (VTAD) |
| `pioneer.glb` | Pioneer 10, Pioneer 11 | NASA 3D Resources, `Pioneer 10.glb` — https://github.com/nasa/NASA-3D-Resources and https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/pioneer-10/Pioneer%2010.glb |
| `new-horizons.glb` | New Horizons | https://science.nasa.gov/resource/new-horizons-3d-model/ — `New_Horizons.glb`, credit NASA VTAD |
| `parker-solar-probe.glb` | Parker Solar Probe | https://science.nasa.gov/resource/parker-solar-probe-3d-model/ — `PSP.glb`, credit NASA VTAD |
| `jwst.glb` | James Webb Space Telescope | https://science.nasa.gov/3d-resources/james-webb-space-telescope-b/ — `James Webb Space Telescope (B).glb` |
| `europa-clipper.glb` | Europa Clipper | https://science.nasa.gov/resource/europa-clipper-3d-model/ — `clipper_spacecraft.glb`, credit NASA VTAD |
| `ace.glb` | ACE | https://science.nasa.gov/3d-resources/advanced-composition-explorer/ — `Advanced Composition Explorer.glb` |
| `dscovr.glb` | DSCOVR | https://science.nasa.gov/3d-resources/deep-space-climate-observatory-dscovr-triana/ — `Deep Space Climate Observatory (DSCOVR) (Triana).glb` |
| `soho.glb` | SOHO | NASA 3D Resources mirror, `3D Models/Solar and Heliospheric Observatory/Solar and Heliospheric Observatory.glb` (https://github.com/nasa/NASA-3D-Resources); its science.nasa.gov page carries printable files only |
| `roman.glb` | Roman Space Telescope | https://science.nasa.gov/3d-resources/nancy-grace-roman-space-telescope-b/ — `Nancy Grace Roman Space Telescope (B).glb` |
| `tess.glb` | TESS | https://science.nasa.gov/3d-resources/transiting-exoplanet-survey-satellite-tess-a/ — `Transiting Exoplanet Survey Satellite (TESS) (A).glb` |
| `stereo.glb` | STEREO-A | NASA 3D Resources mirror, `3D Models/Solar TErrestrial RElations Observatory (STEREO)/…(STEREO).glb` |
| `osiris-rex.glb` | OSIRIS-APEX | https://science.nasa.gov/3d-resources/origins-spectral-interpretation-resource-identification-and-security-regolith-explorer-osiris-rex/ — `OSIRIS-REx.glb` |
| `cassini.glb` | Cassini | https://science.nasa.gov/3d-resources/cassini-huygens-a/ — `Cassini-Huygens (A) (without Hyugens).glb` (NASA's spelling): the orbiter alone, as it flew after Huygens left in 2004 |
| `dawn.glb` | Dawn | https://science.nasa.gov/3d-resources/dawn/ — `Dawn.glb` |
| `kepler.glb` | Kepler | https://science.nasa.gov/3d-resources/kepler-a/ — `Kepler (A).glb` |
| `spitzer.glb` | Spitzer | https://science.nasa.gov/3d-resources/spitzer-space-telescope/ — `Spitzer Space Telescope.glb` |
| `wind.glb` | Wind | https://science.nasa.gov/3d-resources/wind/ — `Wind.glb` |
| `mro.glb` | Mars Reconnaissance Orbiter | https://science.nasa.gov/3d-resources/mars-reconnaissance-orbiter-mro-c/ — `Mars Reconnaissance Orbiter (MRO) (C).glb` |
| `maven.glb` | MAVEN | https://science.nasa.gov/3d-resources/mars-atmosphere-and-volatile-evolution-maven-b/ — `Mars Atmosphere and Volatile EvolutioN (MAVEN) (B).glb` |
| `odyssey.glb` | Mars Odyssey | https://science.nasa.gov/3d-resources/mars-odyssey/ — `Mars Odyssey.glb` |
| `lro.glb` | LRO | https://science.nasa.gov/3d-resources/lunar-reconnaissance-orbiter-b/ — `Lunar Reconnaissance Orbiter (B).glb` |
| `juno.glb` | Juno | https://science.nasa.gov/3d-resources/juno-a/ — `Juno (A).glb` |
| `themis.glb` | ARTEMIS P1, ARTEMIS P2 | https://science.nasa.gov/3d-resources/time-history-of-events-and-macroscale-interactions-during-substorms-themis/ — `…(THEMIS).glb`; one model for every THEMIS probe, two of which are ARTEMIS |
| `dart.glb` | DART | https://science.nasa.gov/3d-resources/double-asteroid-redirection-test-dart/ — the printable `Double Asteroid Redirection Test (DART).stl`, converted to GLB here (one mesh, flat grey; no textures exist) |
| `curiosity.glb` | Curiosity | https://science.nasa.gov/resource/curiosity-rover-3d-model/ — `24584_Curiosity_static.glb`, credit NASA/JPL-Caltech (no GLB of Curiosity is in NASA 3D Resources itself) |
| `perseverance.glb` | Perseverance | https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/ — `Mars 2020 Perseverance Rover.glb`, NASA/JPL; posed here, see below |
| `juice.glb` | Juice | **ESA, by permission.** ESA SPICE Cosmographia parts, https://spiftp.esac.esa.int/data/SPICE/JUICE/misc/cosmo/models/ — 34 `.3ds` parts assembled as `config/spacecraft_JUICE_arcs.json` places them, with `fk/juice_v46.tf`, `spk/juice_struct_v22.bsp` and the boom CKs; booms deployed. Sci-Fleet's own Juice is not to scale. Cited as the SPICE Service asks: *ESA SPICE Service, JUICE Operational SPICE Kernel Dataset, https://doi.org/10.5270/esa-ybmj68p* |
| `solar-orbiter.glb` | Solar Orbiter | **ESA, by permission.** ESA Sci-Fleet, https://scifleet.esa.int/downloads/solar_orbiter/solar_orbiter.fbx, converted |
| `bepicolombo.glb` | BepiColombo | **ESA, by permission.** ESA Sci-Fleet, https://scifleet.esa.int/downloads/bepi_mcs/bepi_mcs.fbx — the cruise stack (MTM, MPO, Mio in its sunshade), converted |
| `hera.glb` | Hera | **ESA, by permission.** ESA SPICE Cosmographia parts, https://spiftp.esac.esa.int/data/SPICE/HERA/misc/cosmo/models/3ds/ — 16 `.3ds` parts assembled as `config/spacecraft_hera_arcs.json` places them, with `fk/hera_v16.tf` and `spk/hera_struct_v02.bsp`. Not on Sci-Fleet. Cited as the SPICE Service asks: *ESA SPICE Service, Hera Operational SPICE Kernel Dataset, https://doi.org/10.57780/esa-k25x2cv* |
| `euclid.glb` | Euclid | **ESA, by permission.** ESA Sci-Fleet, https://scifleet.esa.int/downloads/euclid/euclid.fbx, converted; the FBX root's 116° presentation rotation removed |
| `gaia.glb` | Gaia | **ESA, by permission.** ESA Sci-Fleet, https://scifleet.esa.int/downloads/gaia/gaia.fbx, converted |
| `mars-express.glb` | Mars Express | **ESA, by permission.** ESA Sci-Fleet, https://scifleet.esa.int/downloads/mars_express/mars_express.fbx, converted; MARSIS deployed |
| `exomars-tgo.glb` | ExoMars TGO | **ESA, by permission.** ESA Sci-Fleet, https://scifleet.esa.int/downloads/trace_gas_orbiter/trace_gas_orbiter.fbx, converted (the orbiter alone; Schiaparelli separated in 2016) |
| `lucy.glb` | Lucy | **NASA/JPL-Caltech, from Eyes on the Solar System** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_lucy/lucy.gltf — packed as GLB |
| `psyche.glb` | Psyche | **NASA/JPL-Caltech, from Eyes on the Solar System** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_psyche/psyche.gltf — packed as GLB |
| `imap.glb` | IMAP | **NASA/JPL-Caltech, from Eyes on the Solar System** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_imap/imap.gltf — Draco decoded, KTX2 textures transcoded to JPEG/PNG |
| `escapade.glb` | ESCAPADE Blue, ESCAPADE Gold | **NASA/JPL-Caltech, from Eyes on the Solar System** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_escapade/escapade.gltf — one model for both probes, as in Eyes; Draco decoded, KTX2 transcoded |
| `capstone.glb` | CAPSTONE | **NASA/JPL-Caltech, from Eyes on the Solar System** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_capstone/capstone.gltf — packed as GLB |
| `orion.glb` | Artemis I, Artemis II | **NASA/JPL-Caltech, from Eyes on the Solar System** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_artemis/artemis_ii.gltf — Orion with its service module and four wings; Eyes' one model for both flights; Draco decoded, KTX2 transcoded |
| `hayabusa2.glb` | Hayabusa2 | **NASA/JPL-Caltech, from Eyes on the Solar System; not yet covered by the written permission** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_hayabusa_2/hayabusa_2.gltf — NASA's model of JAXA's craft; Draco decoded, KTX2 transcoded |
| `danuri.glb` | Danuri | **NASA/JPL-Caltech, from Eyes on the Solar System; not yet covered by the written permission** (see Licence). https://eyes.nasa.gov/assets/static/models/sc_danuri/danuri.gltf — NASA's model of KARI's craft; Draco decoded, KTX2 transcoded |
| `insight.glb` | InSight | https://science.nasa.gov/resource/insight-lander-3d-model/ — `24880_InSight_deployed.glb`, credit NASA/JPL-Caltech; lifted here, see below |

### Earth satellites

The named Earth satellites' models; `tools/src/satellites/looks.ts` gives each one's
scale, axes and pointing rule, with sources. Downloaded 2026-10-21.

| File | Satellites drawn with it | Source |
|---|---|---|
| `iss.glb` | International Space Station | https://science.nasa.gov/resource/international-space-station-3d-model/ — `ISS_stationary.glb`, credit NASA VTAD. About 2020's configuration: Pirs docked, before Nauka, Prichal and the roll-out arrays |
| `hubble.glb` | Hubble | https://science.nasa.gov/resource/hubble-space-telescope-3d-model/ — `Hubble.glb`, credit NASA VTAD (3D Resources' (A) is DigitalSpace Corporation's, and not used) |
| `chandra.glb` | Chandra | https://science.nasa.gov/3d-resources/chandra-x-ray-observatory/ — `Chandra X-ray Observatory.glb` |
| `xmm-newton.glb` | XMM-Newton | **ESA, by permission.** ESA SPICE Cosmographia, https://spiftp.esac.esa.int/data/SPICE/XMM/misc/cosmo/ — `xmm.obj`, `xmm.mtl`, `alb.png` (Sci-Fleet's model), converted |
| `swift.glb` | Swift | https://science.nasa.gov/3d-resources/swift/ — `Swift.glb` |
| `fermi.glb` | Fermi | https://science.nasa.gov/3d-resources/fermi-gamma-ray-large-area-space-telescope/ — `Fermi Gamma-ray Large Area Space Telescope.glb` |
| `sdo.glb` | Solar Dynamics Observatory | https://github.com/nasa/NASA-3D-Resources, `3D Models/Solar Dynamics Observatory/Solar Dynamics Observatory.glb` (its science.nasa.gov page has no file) |
| `mms.glb` | MMS 1, 2, 3 and 4 | https://science.nasa.gov/3d-resources/magnetospheric-multiscale-mms-b/ — `Magnetospheric Multiscale (MMS) (B).glb`; one model for the four, built alike |
| `smile.glb` | SMILE | **ESA, by permission.** ESA SPICE Cosmographia, https://spiftp.esac.esa.int/data/SPICE/SMILE/misc/cosmo/models/ — `smile.obj`, `smile.mtl`, `main.png`, `panel.png`, `mli.png`, converted |
| `terra.glb` | Terra | https://science.nasa.gov/3d-resources/terra/ — `Terra.glb`, untextured: the file points its two textures at TGA files outside it that NASA does not publish (see Processing) |
| `aqua.glb` | Aqua | https://science.nasa.gov/3d-resources/aqua-b/ — `Aqua (B).glb` |
| `aura.glb` | Aura | https://science.nasa.gov/3d-resources/aura-b/ — `Aura (B).glb` |
| `landsat-8.glb` | Landsat 8, Landsat 9 | https://science.nasa.gov/3d-resources/landsat-8/ — `Landsat 8.glb`; Landsat 9, "largely a copy of Landsat 8" (USGS), has a printable STL only |
| `grace-fo.glb` | GRACE-FO 1, GRACE-FO 2 | https://gracefo.jpl.nasa.gov/resources/86/grace-fo-3d-model — `GRACE-FO.glb`, credit NASA VTAD (see Licence) |
| `smap.glb` | SMAP | https://smap.jpl.nasa.gov/resources/99/smap-3d-model — `SMAP.glb`, credit NASA VTAD (see Licence) |
| `icesat-2.glb` | ICESat-2 | https://science.nasa.gov/3d-resources/ice-clouds-and-land-elevation-satellite-2-icesat-2-c/ — `…(ICESat-2) (C).glb`, the one of the three drawn at ICESat-2's published size |
| `oco-2.glb` | OCO-2 | https://science.nasa.gov/3d-resources/orbiting-carbon-observatory-oco-2/ — `Orbiting Carbon Observatory (OCO) 2.glb` |
| `gpm.glb` | GPM Core Observatory | https://science.nasa.gov/3d-resources/global-precipitation-measurement/ — `Global Precipitation Measurement.glb` |
| `sentinel-6.glb` | Sentinel-6 Michael Freilich, Sentinel-6B | https://science.nasa.gov/3d-resources/jason-continuity-of-service-sentinel-6/ — `Jason Continuity of Service (Sentinel-6).glb`; NASA's model, of "two identical satellites" |
| `cryosat-2.glb` | CryoSat-2 | **ESA, by permission.** ESA Visuals by Earth Online, https://visuals.earth.esa.int/models/high-res/Cryosat-transformed.glb, made for ESA by designdata.de |
| `suomi-npp.glb` | Suomi NPP, NOAA-20 | https://science.nasa.gov/3d-resources/suomi-national-polar-orbiting-partnership-suomi-npp/ — `…(Suomi NPP).glb`; NOAA-20's bus layout "is the same" (Ball), and NOAA publishes no model of it |
| `goes-r.glb` | GOES-16, 17, 18, 19 | https://science.nasa.gov/mission/goes-spacecraft-3d-model/ — `GOES-R.glb`, "GOES-R,S,T (does not contain CCOR)": GOES-19's coronagraph is not drawn (see Licence). 3D Resources' GOES model is of an earlier generation, and not used |
| `tdrs-gen1.glb` | TDRS-3, 5, 6, 7 | https://science.nasa.gov/3d-resources/tracking-and-data-relay-satellites-trds-e/ — `Tracking and Data Relay Satellites (TRDS) (E).glb` (NASA's spelling): TRW's first generation |
| `tdrs-gen2.glb` | TDRS-8, 11, 12, 13 | https://science.nasa.gov/3d-resources/tracking-and-data-relay-satellites-tdrs-b/ — `Tracking and Data Relay Satellites (TDRS) (B).glb`, credited NASA/JPL/Eyes on the Solar System: Boeing's second generation, whose 21 by 13 m it measures; the third is 21 m across too |

One model serves both Voyagers and Pioneer 10's serves Pioneer 11: each pair was built
alike, and no model of the second of either has been published.

Seven of the second batch's eleven are in arbitrary units, not metres -- ACE, DSCOVR,
SOHO, Roman, TESS, STEREO and OSIRIS-REx. They are scaled in the app by one published
dimension each; `SHAPES` and `MORE_SHAPES` in `tools/src/catalog.ts` give the factor and
where it comes from. NASA's Wind model draws the craft's 100 m wire antennas a few metres
long; at 0.38 mm thick they would not show at any length. DART's only NASA model is a
printable STL, converted to GLB with glTF-Transform's core library (positions and face
normals, welded) before the same compression.

Two of the Mars models were changed before compression, and nothing else about them.
Perseverance's file ships with its mast stowed and a demonstration animation that raises
it and then works the arm; every animated part was set to its pose at 3 s -- mast up, arm
still stowed, as the rover drives -- and the animations dropped. InSight's origin is at
its deck, 0.664 m above the lowest point, the seismometer it set on the ground; the whole
file was moved up by that, so it stands on the ground it is placed on.

ESA's six were converted with FBX2glTF (Sci-Fleet) or assembled from SPICE's `.3ds`
parts in the common frame their Cosmographia configuration and SPICE kernels define,
then compressed as above. Their geometry is ESA's, as the permission requires: nothing
was simplified, and each file has exactly its source's triangle count -- Juice 959,923,
Hera 479,908, Euclid 136,061, BepiColombo 111,536, Gaia 45,634, Mars Express 33,298,
TGO 27,288, Solar Orbiter 9,596.
The six from NASA's Eyes came as glTF, three with Draco geometry and KTX2 (Basis)
textures; those were decoded with three.js's own Basis transcoder to JPEG or PNG, then
compressed as above. All six keep every triangle: Lucy 60,829, Psyche 23,354, IMAP
66,405, ESCAPADE 30,818, CAPSTONE 5,025, Orion 112,517. Hayabusa2 and Danuri (downloaded
2026-10-19, both Draco and KTX2) went the same way and keep every triangle too, 207,891
and 66,949, every one within 0.07 mm of its source. An earlier count here said IMAP
had lost 104 to the vertex weld. It had not: `optimize`'s instancing pass draws a part
IMAP repeats as one GPU-instanced mesh (EXT_mesh_gpu_instancing), and that count took the
instances as one. Rechecked on 2026-10-19 against the decoded source, instances counted:
66,405 triangles in both, and every source triangle is in the file within 0.03 mm, the
16-bit position quantisation -- so IMAP was not re-exported.

Unused camera and sky nodes from the FBX scenes were dropped, identical vertices
welded, and the zero-length normals the converter left on degenerate triangles
replaced. Neither Sci-Fleet nor the SPICE packages state terms of their own for the
models; Sci-Fleet's footer points to ESA's general terms, which the permission above
lifts for these six.

## Not here

Five craft have no model here, because none may be used yet. Four are plain NO MODEL
boxes of their published dimensions; Aditya-L1 is its marker alone. Searched 2026-10-19,
first for an official model from each operator, then for any model whose licence
explicitly allows redistribution for non-commercial use -- CC BY, CC BY-SA, CC BY-NC(-SA)
or an explicit "free for non-commercial use" -- community models included, provided
their size matches the published one. A model with no licence stated, "all rights
reserved", or Sketchfab's Standard (store) licence is not used: that a site is
non-commercial grants nothing by itself. Searched: the operators' sites and archives,
NASA 3D Resources, NASA's Eyes, Sketchfab and Wikimedia Commons.

| Craft | Operator | What exists |
|---|---|---|
| Akatsuki | JAXA | None: JAXA publishes a papercraft and an origami model (akatsuki.isas.jaxa.jp/en/gallery/papercraft/), no 3D file; nothing on Sketchfab or Commons. |
| LICIACube | ASI | None from ASI or Argotec, its builder; none in NASA 3D Resources, Eyes, Sketchfab or Commons. |
| Hope | UAE Space Agency / MBRSC | None published (the mission site now redirects to space.gov.ae); none on Sketchfab or Commons. |
| Chandrayaan-2 | ISRO | None from ISRO. One community model under **CC BY 4.0**: "Chandrayaan-2 in flight configuration" by tashtego, https://sketchfab.com/3d-models/chandrayaan-2-in-flight-configuration-4d0017f2c5fb49bb9817601858106ddb (57,997 triangles, published 2019-08-29). Not yet used: Sketchfab gives the file only to a signed-in account, so it has not been downloaded or measured against ISRO's 3.2 x 5.8 x 2.1 m; and "in flight configuration", before 2019-09-02, probably carries the Vikram lander, which has to come off for the orbiter that is drawn -- a change CC BY allows, if stated. |
| Aditya-L1 | ISRO | None from ISRO; Sketchfab's four are Standard-licensed or state none. Nor are three dimensions published for a box: see `MORE_SHAPES` in `tools/src/catalog.ts`. |

Each operator is to be asked for permission; a model is added only once an answer or a
licence allows it, and recorded here with it.

Thirteen named Earth satellites are NO MODEL boxes of published dimensions; `looks.ts`
has every figure and source. Searched 2026-10-21 the same way: the operators' sites, NASA
3D Resources and its mirror, NASA's mission and JPL's sites, NASA SVS, ESA's Sci-Fleet,
SPICE and Visuals, CNES, NOAA, Sketchfab and Wikimedia Commons.

| Satellite | Operator | What exists |
|---|---|---|
| Tiangong | CMSA | None from CMSA. Sketchfab's are Standard-licensed, state no licence, or are of Tiangong-1; one CC BY upload of unknown provenance and configuration is not used. |
| NuSTAR, IXPE, IRIS, TIMED, PACE | NASA (IXPE with ASI) | None. IXPE's old nasa3d.arc.nasa.gov listing, an export-restricted file, is gone; PACE has a paper model only. |
| SWOT | NASA, CNES | A paper model (CNES); no 3D file. |
| Jason-3 | NOAA, EUMETSAT, CNES, NASA | None of its own. NASA's Jason-2 (OSTM) model measures 1.0 x 0.5 x 2.2 units against 1 x 1 x 3.7 m and a 9.7 m span: no one factor fits, so it does not stand in. |
| Sentinel-2A, 2B | ESA | None from ESA (not on Sci-Fleet, SPICE, Visuals or ESA's Sketchfab); store models only. |
| NOAA-21 | NOAA, NASA | None: NOAA has paper models. Its Northrop Grumman bus is not NOAA-20's, so Suomi NPP's model does not stand in. |
| Hinode | JAXA | NASA 3D Resources' Hinode (Solar-B) is 1.1 times as tall as it is wide where Hinode is 4 m on 1.6 m: not to scale, not used. |
| Envisat | ESA | ESA Visuals' model is not to scale -- its array 10.6 m long against 14 m, its ASAR 6.8 m against 10 m, while the array's width is the real 5 m -- and no uniform factor fits it, so it is not used. |

## Processing

Downloaded 2026-10-06 and compressed with glTF-Transform 4.5.1, two commands per file:

```
npx @gltf-transform/cli optimize <source>.glb mid.glb --simplify false --palette false --compress false --texture-compress webp --texture-size 1024
npx @gltf-transform/cli meshopt mid.glb <name>.glb --quantize-position 16 --quantize-normal 12
```

WebP textures at most 1024 px, then meshopt geometry compression with positions
quantised to 16 bits -- 0.3 mm across JWST's 21 m. **No simplification**: the first
pass used `optimize`'s defaults, which simplify the mesh and quantise positions to 14
bits, and JWST lost a third of its vertices to it. Only bitwise-identical vertices are
merged now. Every model's bounds were checked unchanged afterwards. 50 MB of sources
became 5.9 MB, most of it Europa Clipper (35.7 MB to 3.7 MB). The app decodes meshopt
with three.js's own decoder, fetched with the first model.

The Earth satellites' 24 files went the same way on 2026-10-21, and each keeps every
triangle of its source, checked file by file: ICESat-2 751,736, GPM 282,774, SDO 272,770,
the ISS 247,547, Fermi 172,788, MMS 157,842, Terra 117,120, GOES-R 93,121, Aura 86,821,
Landsat 85,364, SMAP 70,715, TDRS (first) 66,962, Aqua 49,401, OCO-2 41,004, Swift
38,032, Chandra 30,132, Sentinel-6 22,866, SMILE 22,843, Hubble 21,129, TDRS (second)
20,014, XMM-Newton 17,178, CryoSat-2 5,461, Suomi NPP 4,024 and GRACE-FO 3,652. The
sources' Draco geometry was decoded by glTF-Transform as it read them. Two needed one
step more. XMM-Newton's and SMILE's OBJ files were converted to GLB first with Cesium's
obj2gltf 3.2, triangles, normals and texture coordinates as the OBJ has them. Terra's GLB
names its two textures as TGA files in a `Terra.fbm` folder NASA does not publish; the
two dangling references were dropped, so Terra is drawn in its materials' own colours,
its geometry untouched. 125 MB of sources became 24.9 MB, 4.9 MB of it the ISS and 5.8 MB
ICESat-2's 751,736 triangles.

Units and axes are documented nowhere in the sources. Both were measured: see `SHAPES` in
`tools/src/catalog.ts`.
