# Checklist: the log map's labels

Every object labelled on [observable-universe-log-map.jpg](observable-universe-log-map.jpg)
(see [README.md](README.md)), bottom to top, and whether the simulator holds it. The map is
the least the simulator should hold; this list says how far it is. Keep it up to date when
an object is added. After the map's labels come the labels that have aged, and what a realism-first
simulator should hold that the map does not show ("Beyond the map").

- `[x]` in the app: drawn at its real place and findable, and where it is.
- `[~]` partly: what is there and what is not.
- `[ ]` missing, with the roadmap phase it belongs to: **Solar System**, **stars**,
  **Milky Way**, **G2** (Local Volume and Virgo: the UNGC and EVCC catalogues, which brought
  M51, M63, M64, M81, M82, M101, M104 and the Virgo Cluster), **G3** (Laniakea:
  clusters, superclusters and voids out to about 1-2 billion light years) or **G4** (the
  observable universe: record-holders, the cosmic web, the CMB).

Where things come from:

- **Bodies** (planets, moons, named asteroids and comets, spacecraft): `tools/src/catalog.ts`,
  `tools/src/smallBodies.ts`, `tools/src/famousComets.ts`, `tools/src/moons/smallMoons.ts`,
  JPL Horizons.
- **Belt**: every asteroid, centaur and trans-Neptunian object in JPL's Small-Body Database
  (`tools/src/belt/`, `data/belt/`), a point on its orbit. Searchable by `belt/names.json`:
  the IAU-named, every near-Earth object, every centaur and TNO.
- **Earth satellites**: CelesTrak (`tools/src/satellites/`), the named ones with models in
  `named.ts`, the rest as points (`satellites/bulk.bin`, searchable by name).
- **Stars**: the sky to V 8 (Hipparcos and Tycho-2, `stars.json`) and the stars in 3D
  (`stars3d/`: Gaia's 100 pc census plus every sky star with a parallax at S/N 5), named
  through `stars3d/names.json` (`tools/src/stars/wgsn.ts`, `nearbySystems.ts`).
- **Milky Way**: the model (`web/src/core/milkyWay.ts`), globular clusters
  (`globular-clusters.json`, Baumgardt and Harris), supernova remnants, pulsars.
- **Local Group**: McConnachie's catalogue (`local-group.json`) and the giants in
  `web/src/core/localGroup.ts`.
- **Local Volume and Virgo**: the UNGC and the EVCC (`local-volume.json`,
  `tools/src/localVolume/`), drawn by `web/src/core/localVolume.ts`.
- **Laniakea and beyond** (G3): Cosmicflows-4 and the 2MASS Redshift Survey's 86,899 galaxies,
  the CF4 watersheds and the named clusters, superclusters, basins, voids and walls
  (`laniakea/`, `tools/src/laniakea/`), drawn by `web/src/core/laniakea.ts` and
  `web/src/scene/Laniakea.tsx`; the structures are bodies, found by search.
- **The observable universe** (G4): the record-holders, bodies with their redshifts and papers
  (`web/src/core/recordHolders.ts`), placed in Planck 2018's cosmology (`web/src/core/cosmology.ts`);
  the CMB's last-scattering sphere with Planck's map (`tools/src/cmb/`, `web/public/cmb/`); the cosmic web,
  the SDSS main sample's and BOSS's galaxies and Tempel et al.'s and Malavasi et al.'s filaments
  (`cosmic-web/`, `tools/src/cosmicWeb/`), drawn by `web/src/core/cosmicWeb.ts` and `web/src/scene/CosmicWeb.tsx`.

## Near Earth and the atmosphere (to about 1,000 km)

- [~] Ground level: Earth is a textured globe with a Rayleigh atmosphere; no relief, no
  ground-level view.
- [x] Ozone layer: Chappuis-band absorption in the atmosphere (`web/src/scene/atmosphere.ts`),
  Serdyuchenko et al.'s cross-sections, 300 DU on Bruneton's 10–25–40 km profile, on the sunward
  and view paths of the sky, the ground and the clouds. Solar System.
- [ ] Commercial airplanes. Solar System.
- [ ] High-altitude balloon. Solar System.
- [~] Meteor showers: Meteor Showers layer (`web/src/core/meteorShowers.ts`), thirteen major
  showers from IMO's 2026 working list and the IAU MDC: each crossing a body, the stream's mean
  orbit computed from radiant and speed, Earth's path through it. Not yet: single meteors; a
  radiant marked on the sky from Earth. Solar System.
- [x] Auroras: Auroras layer (`web/src/core/aurora.ts`), NOAA SWPC's OVATION Prime forecast
  fetched live, the green line's glow on the night side, only within an hour of the forecast.
  Solar System.

## Earth orbit (to about 100,000 km)

- [x] Starlink: about 10,800 Starlinks, CelesTrak `starlink` group.
- [x] GPS: the NAVSTARs, CelesTrak `gnss` group.
- [x] Hisaki: `HISAKI (SPRINT-A)`, a CelesTrak point.
- [x] Hubble: named, with model (`satellites/named.ts`).
- [x] Fermi: named, with model.
- [x] Tiangong S.S.: named `Tiangong`, with model.
- [x] I.S.S.: named `International Space Station`, with model.
- [ ] WISE: re-entered on 2 November 2024, so in no current element set; it would need its
  last orbit as an ended craft. Solar System.
- [x] Geostationary satellites: CelesTrak `geo` group (about 570).
- [ ] Kalpana-1 (METSAT-1, NORAD 27525): retired in a graveyard orbit, in none of the
  CelesTrak groups fetched. Solar System.
- [x] Elektro-L: Elektro-L 2 to 5, CelesTrak points (Elektro-L 1 is not in the groups).
- [x] MSG-3: `METEOSAT-10 (MSG-3)`, a CelesTrak point.
- [x] GOES-15: `EWS-G2 (GOES 15)`, a CelesTrak point (now the US Space Force's).
- [x] Apophis: body (`smallBodies.ts`).
- [x] 2001 WN5: belt, `153814 (2001 WN5)`.
- [x] TESS: body (Horizons -95).
- [x] Chandra: named, with model.
- [x] XMM-Newton: named, with model.

## The Moon and the Lagrange points (to about 1.5 million km)

- [x] Moon: body.
- [ ] Kordylewski cloud (Earth-Moon L4): disputed (see README); the point itself is marked,
  `Earth–Moon L4`, its panel naming the cloud as reported and disputed. Solar System.
- [ ] Kordylewski cloud (Earth-Moon L5): as above. Solar System.
- [x] LRO: body, in lunar orbit.
- [x] Chandrayaan-2: body, in lunar orbit.
- [x] 2015 TB145: belt.
- [x] 433 Eros: belt.
- [ ] Queqiao: not in JPL Horizons (checked 2026-11-16), so no trajectory to draw. Solar System.
- [~] THEMIS: its two outer probes are here as ARTEMIS P1 and P2, about the Moon; THEMIS A,
  D and E, still in Earth orbit, are not.
- [x] Earth-Moon L2: marked, `Earth–Moon L2` (Lagrange Points layer, `web/src/core/lagrange.ts`),
  computed at each instant; Queqiao, there, is missing.
- [ ] Chang'e 5 (its orbiter's extended mission): not in JPL Horizons. Solar System.
- [ ] Spektr-RG: not in JPL Horizons (its -557 is Spektr-R, RadioAstron). Solar System.
- [x] Sun-Earth L2: marked, `Sun–Earth L2`; JWST, Gaia and Euclid are bodies.
- [x] Gaia: body (Horizons -139479).
- [x] JWST: body, `James Webb Space Telescope`.
- [x] WIND: body, `Wind`.
- [x] SOHO: body.
- [x] LISA Pathfinder: body, ESA's trajectory to 2017-06-30, where JPL's ends.
- [x] Sun-Earth L1: marked, `Sun–Earth L1`; SOHO, ACE, Wind, DSCOVR, Aditya-L1, IMAP,
  SWFO-L1 and Carruthers are bodies.
- [x] DSCOVR: body.
- [x] ACE: body.
- [x] Itokawa: belt, `25143 Itokawa`.
- [x] Herschel Space Observatory: body, about the Sun since leaving L2 in 2013 (ESA's
  prediction to 2050, Horizons -486).
- [x] Planck: body, likewise (Horizons -489).
- [ ] WMAP: in Horizons, but its trajectory ends on 2009-04-07, before the window. Solar System.

## Near the Earth's orbit (to about 0.1 AU)

- [ ] Tesla Roadster: left out on purpose for now, its Horizons object being the upper stage
  with the car on it, of unpublished size (`catalog.ts`). Solar System.
- [x] 2010 TK7: belt, `706765 (2010 TK7)`.
- [x] 2020 XL5: belt, `614689 (2020 XL5)`.
- [x] STEREO A: body, `STEREO-A`.
- [x] STEREO B: body, `STEREO-B`: silent since 2016, JPL's prediction to 2024-10-26, with a
  1.6 million km seam where the 2023 prediction takes over.
- [x] Spitzer: body.
- [x] Kamoʻoalewa: belt, `469219 Kamo`oalewa`.
- [x] Lucy: body.
- [x] Sun-Earth L5: marked, `Sun–Earth L5`; nothing known there.
- [x] Sun-Earth L4 (Earth trojans): marked, `Sun–Earth L4`; its trojans 2010 TK7 and
  2020 XL5 are in the belt.
- [ ] IKAROS: not in JPL Horizons. Solar System.
- [x] Parker Solar Probe: body.
- [x] 1685 Toro: belt.

## The inner Solar System (to about 1 AU)

- [x] Solar Orbiter: body.
- [x] Hale-Bopp: body, `C/1995 O1 (Hale-Bopp)`.
- [x] Halley's comet: body, `1P/Halley`.
- [x] Bepi: body, `BepiColombo`.
- [x] Mercury: body.
- [x] Sun: body.
- [x] Venus: body.
- [ ] Chang'e 2: not in JPL Horizons. Solar System.
- [x] 2002 VE68: belt, as `524522 Zoozve` (named in 2024); its designation is searchable.
- [x] Akatsuki: body.
- [~] Mars trojans: in the belt (5261 Eureka and the rest), but not set apart as trojans.
- [x] Mars: body.
- [x] Phobos: body.
- [x] Deimos: body.
- [x] Cruithne: belt, `3753 Cruithne`.

## The asteroid belt and Jupiter (to about 5 AU)

- [x] Ganymed: belt, `1036 Ganymed`.
- [x] Amor: belt, `1221 Amor`.
- [x] Hygiea: belt, `10 Hygiea`.
- [x] Asteroid belt: about 1.39 million main-belt asteroids, of 1.58 million in the belt.
- [x] Ceres: body.
- [x] Pallas: body.
- [x] Vesta: body.
- [x] Jupiter trojans: belt class TJN, its own layer (`Jupiter Trojans`, both camps).
- [x] Jupiter greeks: the same class, the L4 camp.
- [x] Europa: body.
- [x] Ganymede: body.
- [x] Io: body.
- [x] Jupiter: body.
- [x] Callisto (the map's "Calisto"): body.
- [x] Kaʻepaokaʻawela: belt, `514107 Ka`epaoka`awela`.

## Saturn to Neptune, and the centaurs (to about 30 AU)

- [x] Tethys: body.
- [x] Dione: body.
- [x] Saturn: body.
- [x] Rhea: body.
- [x] Titan: body.
- [x] Iapetus: body.
- [x] Chiron: belt, `2060 Chiron`.
- [x] Pholus: belt, `5145 Pholus`.
- [x] Amycus: belt, `55576 Amycus`.
- [x] Elatus: belt, `31824 Elatus`.
- [x] Hidalgo: belt, `944 Hidalgo`.
- [x] Chariklo: belt, `10199 Chariklo` (a point; its rings are not drawn).
- [x] Hylonome: belt, `10370 Hylonome`.
- [x] 2011 QF99 (Uranus trojan): belt, `687170 (2011 QF99)`.
- [x] Umbriel: body.
- [x] Oberon: body.
- [x] Uranus: body.
- [x] Ariel: body.
- [x] Titania: body.
- [x] Triton: body.
- [~] Neptune trojans: in the belt (385571 Otrera and the rest, class TNO), not set apart.
- [x] ʻOumuamua: body, `1I/ʻOumuamua (A/2017 U1)`, on its hyperbola (`farBodies.ts`); a marker,
  its size unmeasured.
- [x] Neptune: body.

## The Kuiper belt and the heliosphere (to about 1,000 AU)

- [x] Orcus: body (`farBodies.ts`).
- [x] Vanth (Orcus's moon): small moon (`small-moons/orcus.json`, `moons/minorPlanetMoons.ts`).
- [x] Pluto: body.
- [x] Charon: body.
- [x] Nix: small moon (`small-moons/pluto.json`).
- [x] Hydra: small moon.
- [x] Kuiper belt: about 7,300 trans-Neptunian objects, belt class TNO.
- [x] Makemake: body.
- [x] Haumea: body.
- [x] Hiʻiaka (Haumea's moon): small moon (`small-moons/haumea.json`).
- [x] Namaka (Haumea's moon): small moon.
- [x] Actaea (Salacia's moon): small moon (`small-moons/salacia.json`).
- [x] Salacia: body.
- [x] Eris: body.
- [x] Dysnomia (Eris's moon): small moon (`small-moons/eris.json`).
- [x] Arrokoth: body.
- [x] New Horizons: body.
- [x] Pioneer 11: body.
- [x] Pioneer 10: body.
- [x] Voyager 2: body.
- [x] Voyager 1: body.
- [x] Termination shock: Heliosphere layer (`web/src/core/heliosphere.ts`): the Voyagers'
  two crossings, measured, and Parker's sphere through them, modelled.
- [x] Heliopause: the Voyagers' two crossings, measured, and Parker's surface fitted to them,
  turned to the interstellar wind, its tail fading where it is not known.
- [x] Gonggong: body (`farBodies.ts`).
- [x] Sedna: body.

The big trans-Neptunians (Orcus, Salacia, Quaoar, Varuna, Ixion, Gonggong, Sedna) are bodies
of their measured size, JPL's integrated paths (`tools/src/farBodies.ts`); the belt leaves
them out.

## The Oort cloud (to about 100,000 AU)

- [x] Oort cloud: Heliosphere layer, `Oort cloud`: inferred, never seen, drawn as an even glow
  from 2,000 AU (the inner, Hills cloud) to 20,000 and on to 100,000 AU.

## The nearest stars (to about 10 pc)

- [x] Proxima Centauri: 3D star, named.
- [x] Alpha Centauri A: 3D star, named `Rigil Kentaurus` (its IAU name).
- [x] Alpha Centauri B: 3D star, named `Toliman`.
- [x] Barnard's Star: 3D star, named.
- [x] Luhman 16: a mark, Notable Stars layer (`web/src/core/notableStars.ts`), by Lazorenko &
  Sahlmann 2018's parallax; Gaia has no five-parameter solution for it.
- [x] Sirius: 3D star, named, with Sirius B and their orbit (`web/src/core/sirius.ts`).
- [x] Procyon: 3D star, named; Procyon B a mark at its place (Notable Stars), its orbit not drawn.
- [x] Luyten 726-8: 3D stars, `Luyten 726-8 A` and `B` (BL Cet and UV Cet).
- [x] Wolf 359: 3D star, named.
- [x] Lalande 21185: 3D star, named.
- [x] WISE 0855-0714: a mark, Notable Stars, by Kirkpatrick et al. 2021's parallax.
- [x] 61 Cygni: 3D stars, `61 Cygni A` and `B`.
- [x] Ran (Epsilon Eridani): 3D star, named.
- [x] Gacrux: 3D star, named.
- [x] Acrux: 3D star, named.
- [x] Rigel: 3D star, named (265 pc, by its Hipparcos parallax).
- [x] Achernar: 3D star, named.

## Bright stars and nebulae (to about 1 kpc)

- [x] Vega: 3D star, named.
- [x] Capella: 3D star, named.
- [x] Arcturus: 3D star, named.
- [x] Antares: 3D star, named.
- [x] Tau Ceti: 3D star, named.
- [x] Betelgeuse: 3D star, named.
- [x] Canopus: 3D star, named.
- [x] Pollux: 3D star, named.
- [x] Aldebaran: 3D star, named.
- [~] Pleiades: its bright stars are 3D stars by their Hipparcos parallaxes, Alcyone, Maia,
  Electra and the rest named; the cluster is not an object and has no label.
- [x] Van Maanen's Star: 3D star, named.
- [x] UY Scuti: a mark, Notable Stars, by its Gaia DR3 parallax (1.87 kpc).
- [x] Horsehead Nebula: Nebulae layer (`web/src/core/nebulae.ts`), a volume: IC 434's glow and
  the dark pillar in front, at σ Orionis's distance; its shape an estimate.
- [x] Ring Nebula: Nebulae, its published triaxial shell (O'Dell et al. 2013).
- [x] Omega Nebula (M17): Nebulae, a volume of its WISE size (shape an estimate).
- [x] Eagle Nebula (M16): Nebulae, a volume of its WISE size; its pillars not drawn as such.
- [~] Eta Carinae: on the sky only, a V 6.5 Hipparcos star left at infinity (its parallax
  is too poor to place it), unnamed. Stars / Milky Way.
- [x] Carina Nebula: Nebulae, a volume of its WISE size at 2.35 kpc (Göppl & Preibisch 2022).
- [x] Perseus Arm: one of the Milky Way model's arms (Reid et al. 2019), labelled; the
  Galactic Bar labelled too.

## The Milky Way and its satellites (to about 100 kpc)

- [x] Milky Way Galaxy: the model (`web/src/core/milkyWay.ts`), with Sgr A* and the nuclear
  star cluster.
- [x] M4 star cluster: globular cluster `NGC 6121`, also found as M4.
- [x] NGC 6397: globular cluster.
- [ ] Koposov 2: in neither Baumgardt's nor Harris's list as read. Milky Way.
- [x] Terzan 1: globular cluster `Ter 1`.
- [x] Omega Centauri: globular cluster `NGC 5139`.
- [x] M80: globular cluster `NGC 6093`.
- [x] NGC 2419: globular cluster.
- [x] LMC: `Large Magellanic Cloud`, Local Group.
- [x] SMC: `Small Magellanic Cloud`, Local Group.

## The Local Group (to about 1 Mpc)

- [x] Andromeda Galaxy: M31, drawn by the app itself (`localGroup.ts` GIANTS).
- [x] M32: Local Group (`NGC 221` among its names).
- [x] M110: Local Group, `NGC 205`.
- [x] Triangulum: `Triangulum Galaxy` (M33).

## Nearby galaxies (to about 200 Mpc)

- [x] Nearby galaxies: the Local Group's 145 (McConnachie's 144 and M31), the Local Volume's 764 (UNGC) and the Virgo Cluster's 999 (EVCC).
- [x] Hoag's Object: not in Cosmicflows-4 or 2MRS, so a mark at NED's place and redshift (CMB frame, CF4's H0), `Hoag’s Object` (`web/src/core/famousGalaxies.ts`).
- [x] NGC 1300: Laniakea's catalogue, `NGC 1300`.
- [x] Sunflower Galaxy (M63): Local Volume, `M63`.
- [x] Black Eye (M64): Local Volume, `M64`.
- [x] Sombrero (M104): Local Volume, `M104`.
- [x] Mayall's Object: a mark at NED's place and redshift, `Mayall’s Object` (Arp 148, `web/src/core/famousGalaxies.ts`).
- [x] Whirlpool (M51): Local Volume, `M51`.
- [x] Bode's Galaxy (M81): Local Volume, `M81`.
- [x] Cartwheel Galaxy: a mark at NED's place and redshift, `Cartwheel Galaxy` (`ESO 350-40`, `web/src/core/famousGalaxies.ts`).
- [x] Pinwheel Galaxy (M101): Local Volume, `M101`.
- [x] Cigar Galaxy (M82): Local Volume, `M82`.
- [x] Tadpole Galaxy: Laniakea's catalogue, `UGC 10214`.
- [x] Virgo Cluster: the EVCC's certain members, on the breadcrumb (`Virgo Cluster`, framed on M87).

## Clusters, superclusters and voids (to about 1,000 Mpc)

- [x] Superclusters of galaxies: Einasto et al.'s eleven named here, and the CF4 watershed basins (Laniakea, Shapley, Perseus-Pisces, Hercules, Lepus, Apus), each outlined in its own hue in the Basins of Attraction layer, a chip each.
- [x] Fornax Cluster: a structure, its galaxies drawn.
- [x] Shapley Supercluster: a structure, with Abell 3558 and Abell 3571; its basins the Basins of Attraction layer's Shapley chips (the galaxies' reconstruction's, and the groups' that takes Laniakea in).
- [x] KBC Void: a void about us to z 0.07 (Keenan et al. 2013), its panel `[disputed]`, its shell and mark only while chosen (`tools/src/laniakea/landmarks.ts` paperVoids; in laniakea.json from the next data build).
- [x] Hydra Cluster: a structure (`Abell 1060`).
- [~] Pavo-Indus Supercluster: the Pavo II Cluster in it drawn and named; the supercluster not named.
- [x] Northern Local Supervoid: the `Hercules Void` (Tully et al. 2019), an outline.
- [x] Centaurus Cluster: a structure (`Abell 3526`).
- [x] Horologium Supercluster: `Horologium-Reticulum Supercluster`.
- [x] Coma Wall: the `CfA2 Great Wall`, drawn as a line through the Coma Cluster's declination.
- [ ] Sculptor Wall: not in G3's landmarks; the Sculptor Supercluster is. G3. Left out: its sources disagree where it is (Fairall's wall at z 0.03 in the southern slices; MSCC 33, the Sculptor superclusters, at z 0.11), and none gives a span to draw.
- [x] Southern Local Supervoid: the `Sculptor Void` (Tully et al. 2019), an outline.
- [x] Giant Void: a void, a sphere 300 Mpc across at z 0.11 toward Canes Venatici (Kopylov & Kopylova 2002; `tools/src/laniakea/landmarks.ts` paperVoids, from the next data build).
- [x] Leo Supercluster: a structure.
- [x] Walls and filaments: the CfA2 and Sloan Great Walls as lines; the filaments of Tempel et al. 2014 (SDSS main sample, to z 0.155) and Malavasi et al. 2020 (BOSS North, z 0.15-0.75) as threads, the Filaments layer (`cosmic-web/filaments.bin`, `web/src/scene/CosmicWeb.tsx`).
- [x] Caelum Supercluster: Einasto et al. 1997's candidate 59, its panel `[candidate]` (`tools/src/laniakea/landmarks.ts` SUPERCLUSTERS, from the next data build).
- [x] Sloan Great Wall: a structure, drawn as a line (Gott et al. 2005).
- [x] Corona Borealis Supercluster: a structure.
- [x] ASASSN-15lh, "brightest supernova": a record-holder (`web/src/core/recordHolders.ts`), z 0.2326, its panel saying it may be a tidal disruption.
- [~] Boötes Void: the CF4 repeller near it (`Near the Bootes Void repeller`); the void not outlined.
- [x] Pandora's Cluster (Abell 2744): a record-holder, z 0.308.
- [x] Bullet Cluster: a record-holder, z 0.296.
- [x] Saraswati Supercluster: a record-holder, z 0.28, marked at Abell 2631, its centre.
- [x] Giant GRB Ring: a far landmark at its nine bursts' mean, z 0.822, a ring of 1,720 Mpc, its record `[claim]` (`web/src/core/farLandmarks.ts`).
- [x] El Gordo Cluster: a record-holder, z 0.870.
- [x] Cosmic web of galaxies: the SDSS main sample's and BOSS DR12's 1.8 million galaxies to z 0.95, in the surveys' wedges, the SDSS Galaxies layer (`cosmic-web/galaxies-*.bin`, `web/src/scene/CosmicWeb.tsx`); their filaments, the Filaments layer.

## The far universe

- [x] Hercules-Corona Borealis Great Wall: a far landmark, a mark at z 1.85 in Hercules and Corona Borealis (its papers give no centre), its record `[claim]`, Christian 2020's doubt in its note.
- [x] Clowes-Campusano LQG: a far landmark (`web/src/core/farLandmarks.ts`), `Clowes–Campusano LQG`, at its 34
  quasars' mean place and redshift (z 1.28), a ring of its size; the Observable Universe layer.
- [x] Huge-LQG: a far landmark, `Huge-LQG`, z 1.27, a ring of its size, its panel saying it is a claim (Nadathur 2013).
- [x] U1.11 LQG: a far landmark, `U1.11`, z 1.11, a ring of its size.
- [x] J0313-1806, most distant known quasar (z = 7.64): a record-holder, z 7.6423; EUCL J1729+6410, z 7.77, the record now, beside it.
- [x] GRB 090429B, most distant gamma-ray burst: a record-holder at its photometric z 9.4, said so; GRB 090423, z 8.26 spectroscopic, beside it.
- [x] HD1, "most distant known galaxy": a record-holder at z 4.0, where its JWST spectrum puts it,
  its panel giving the z 13 claim; MoM-z14 (z 14.44) and JADES-GS-z14-0 (z 14.1796) beside it.
- [x] Tonantzintla 618, "most massive black hole": a record-holder, z 2.219, its mass said to be an estimate.
- [x] Earendel (the map's "Ereandel"), most distant single star: a record-holder at its galaxy's z 5.926, its panel saying it may be a cluster.
- [x] Farthest visible galaxies: MoM-z14, JADES-GS-z14-0, GN-z11 and UHZ1 as record-holders; the deep fields they
  were found in (HUDF, JADES, COSMOS-Web, SMACS 0723) as beams out to their farthest confirmed galaxies.
- [ ] Unreachable (the cosmic event horizon): stated in the About (16.6 billion ly), not drawn. G4.
- [x] Cosmic microwave background: the last-scattering sphere, Planck's 2018 map, from far outside (`web/src/scene/cmb.ts`).
- [ ] Big Bang: G4.

## Labels on the map that have aged

Researched on 2026-11-12. A claim marked *(unverified)* was not checked against a source.

- **HD1** is not at z ≈ 13.3. JWST and ALMA found it to be a galaxy at z ≈ 4 (Harikane et al. 2024, arXiv 2406.18352).
  - The spectroscopic distance record is **MoM-z14, z = 14.44** (Naidu et al. 2025), with JADES-GS-z14-0 next at z = 14.32.
- **J0313-1806**, z = 7.64, is no longer the most distant quasar. **EUCL J172902.75+641018.1, z = 7.77**, found by Euclid and confirmed with Keck, overtook it (ESA, July 2026).
- **Earendel** (z ≈ 6.2) may be a lensed star cluster rather than a single star [disputed] (Pascale et al. 2025, ApJL).
- **ASASSN-15lh** is more likely a tidal disruption around a spinning black hole than a supernova (Leloudas et al. 2016, Nat. Astron.).
- **GRB 090429B**'s z ≈ 9.4 is photometric. The farthest gamma-ray burst with a spectroscopic redshift is GRB 090423, z = 8.2.
- **TON 618**'s 66 billion M☉ is an old estimate from its broad lines; it is about 4 × 10¹⁰ M☉ and uncertain.
  - A rival with a more direct mass is the Cosmic Horseshoe's black hole, 3.6 × 10¹⁰ M☉, measured by lensing and stellar dynamics (2025).
- **UY Scuti** is no longer the largest known star: its radius is about 750–900 R☉ at Gaia's distance. The record is uncertain:
  - Stephenson 2-18 is about 2,150 R☉, but its distance is uncertain;
  - WOH G64 has shrunk since 2014 (Muñoz-Sánchez et al. 2026).
- **Gaia** is no longer at L2. It was retired and passivated on 2025-03-27, and now orbits the Sun.
- **Disputed large structures:** the Hercules–Corona Borealis Great Wall, the Giant GRB Ring, the Huge-LQG, U1.11 and the Clowes–Campusano LQG are claims; Nadathur (2013) found that such groupings arise by chance. The KBC void is disputed too.
- **Laniakea** may be part of the Shapley basin (Valade et al. 2024, Nat. Astron., Cosmicflows-4). Show it as a basin that is only probable.
- **Milky Way–Andromeda merger:** about a 50 % chance within 10 Gyr once M33 and the LMC are counted (Sawala et al. 2025).
- **Kamo'oalewa** has been reached by Tianwen-2 (mid-2026). Samples are due back in 2027.

## Beyond the map

What the map does not show but a realism-first simulator should. These are unchecked against the app until each is worked on.

### Near Earth
- [~] Kármán line (100 km): Magnetosphere layer. Not yet: Armstrong limit (19 km), noctilucent clouds (~83 km), sprites and jets, the ionosphere's layers, altitude records (X-15, SR-71, Eustace's jump)
- [~] Van Allen belts, magnetopause (~10 R⊕), bow shock: Magnetosphere layer, standard models (`web/src/core/magnetosphere.ts`). Not yet: plasmasphere, magnetotail, geocorona (~630,000 km), Earth's umbra and Hill sphere
- [x] SWFO-L1 at Sun–Earth L1: body, `SOLAR-1 (SWFO-L1)` (Horizons -231, to 2028-04-21), a marker since its size is unpublished; with it the Carruthers Geocorona Observatory (-171, to 2028-03-19), a box of its published size. Roman on its way to L2: body (Horizons -211), launched 2026-08-30 11:26 UTC (its Horizons summary). The other L1 and L2 craft are in the app.
- [x] Observatories in Earth orbit: Swift, NuSTAR, IXPE named, with model or box; TESS body (Horizons -95); XRISM, Einstein Probe, SVOM, SPHEREx and PUNCH's four CelesTrak points (`XRISM`, `EINSTEIN PROBE`, `SVOM`, `SPHEREX (MIDEX 9)`, `PUNCH-NFI (SMEX 15A)`, `PUNCH-WFI 1-3`)
- [x] Earth's companions: quasi-moon 2025 PN7, mini-moon 2024 PT5: bodies on JPL's vectors (`earthCompanions.ts`, `DES=2025 PN7;`, `DES=2024 PT5;`), markers (size unmeasured); the panel says what each is
- [~] Craft at the Moon: Danuri, CAPSTONE (in the near-rectilinear halo orbit planned for the Gateway) and Artemis II's trajectory (April 2026) are bodies. Not yet: the Gateway's own orbit (not launched, nothing in Horizons); Queqiao-2 (not in Horizons, rechecked 2026-11-17)
- [x] Landing sites on the Moon: Apollo, Chang'e 4/5/6, Chandrayaan-3, SLIM, Blue Ghost 1: Landing Sites layer (`web/src/core/landingSites.ts`), LROC's measured positions, with Surveyor 1, Lunokhod 1 and 2, Chang'e 3; and on Mars Viking 1 and 2, Pathfinder, Spirit, Opportunity, Phoenix, Tianwen-1's lander. Not yet: Luna 9 (not in LROC's table); Zhurong's last stop (unpublished)

### Inner Solar System
- [ ] The Sun's layers and its Alfvén surface; the zodiacal dust cloud; the heliospheric current sheet
- [ ] Mars orbiters and rovers: MRO, MAVEN, Mars Express, Odyssey, TGO, Hope, Tianwen-1, Perseverance, Curiosity, Zhurong, ESCAPADE
- [~] Craft on the way: Psyche, Europa Clipper, JUICE, Hera, OSIRIS-APEX, Hayabusa2#, BepiColombo (into Mercury orbit 2026-11-21; Horizons' MPO trajectory runs to 2027-04-10) are bodies. Not yet: Tianwen-2 (not in Horizons, rechecked 2026-11-17)
- [ ] Asteroids: Bennu, Ryugu, Didymos–Dimorphos, 2024 YR4, Toutatis, Phaethon, 16 Psyche, Dinkinesh–Selam, Donaldjohanson, Ida–Dactyl, Gaspra, Lutetia, Šteins, Mathilde; the Kirkwood gaps and the Hildas
- [ ] Lucy's Trojan targets: Eurybates, Polymele, Leucus, Orus, Patroclus–Menoetius
- [ ] Comets: Tsuchinshan–ATLAS, 12P/Pons–Brooks, 67P, Shoemaker–Levy 9 (historic)
- [x] Interstellar objects: 2I/Borisov, 3I/ATLAS (2025): bodies on their hyperbolas (`famousComets.ts`), with 1I/ʻOumuamua

### Outer Solar System
- [~] Kerberos, Styx (small moons); Quaoar, with Weywot; Varuna, Ixion (bodies). Not yet: Quaoar's rings, whose plane has no published pole in the form the app turns rings by
- [x] The farthest objects seen: 2018 VG18 "Farout", 2018 AG37 "FarFarOut": bodies, markers (size unmeasured)
- [x] Sednoids: 2012 VP113, Leleākūhonua, 2023 KQ14; 2017 OF201: bodies, markers (size unmeasured)
- [ ] Planet Nine, as a region where it might be [hypothetical]
- [~] The heliosphere: the Hills cloud (inner Oort cloud, inferred); the heliotail drawn fading, its extent unknown. Not yet: IBEX ribbon, hydrogen wall; the Sun's gravitational focus (≥ 550 AU)
- [~] The Local Interstellar Cloud: Local Interstellar Medium layer, Linsky et al. 2019's shape. Not the G-cloud: only its outline on the sky is published
- [x] Stellar flybys: Scholz's Star (0.333 pc, 80,500 years ago; Dupuy et al. 2019, Mamajek et al. 2015's 70,000 the first) a Notable Stars mark, `Scholz’s Star`; Gliese 710 (0.052 pc in 1.29 Myr, Gaia DR3) a 3D star, named `Gliese 710` from the next data build (`tools/src/stars/nearbySystems.ts`). Both beyond the clock: each one's path drawn as a computed straight line, dashed, with the Notable Stars; the published approaches in the panel (`web/src/core/stellarFlybys.ts`)

### Nearby stars and planets
- [x] Barnard's Star's four planets (2025), from Basant et al. (`planetarySystems.ts`); α Cen A's candidate S1 [uncertain]: `Alpha Centauri A S1 (candidate)`, on one of Beichman, Sanghi et al.'s fitted orbits, said so (`alphaCenAPlanets.ts`); ε Ind Ab, GJ 251 c, HD 20794 d: from the NASA Exoplanet Archive, gone to by their stars
- [x] Ross 128, 154, 248; Gliese 1061; Teegarden's Star; Kapteyn's Star; YZ Ceti; Gliese 581, Gliese 667C: 3D stars, named; their planets from the Archive when gone to (Ross 128 b; GJ 1061, Teegarden's, YZ Ceti and GJ 581 three each; GJ 667 C five, three disputed; Kapteyn c disputed). Ross 154 and 248 have none
- [x] Bright stars: Polaris, Deneb, Altair, Spica, Regulus, Fomalhaut, Mira, Algol, Castor, Orion's Belt: catalogue stars with their measured facts and disputed distances in the panel (`web/src/core/brightStars.ts`), Fomalhaut a disc of its size; Alnilam placed at Orion OB1b's 384 pc, Alnitak at Hummel et al.'s 387 pc, Mintaka at δ Ori C's Gaia 381 pc (build3d.ts OVERRIDES). Not drawn: companions (none a catalogue star of its own), Fomalhaut's ring
- [x] Compact objects: Procyon B, 40 Eridani B (Notable Stars marks); RX J1856.5-3754, PSR J0437-4715 (Pulsars layer)
- [~] Planetary systems: all below from the NASA Exoplanet Archive, gone to by search (51 Peg curated; Kepler-90, the Archive's KOI-351, found by its name). Not yet: rogue planets, which the Archive does not list
  - firsts: 51 Peg, PSR B1257+12;
  - TRAPPIST-1;
  - Kepler: Kepler-16, -186, -452, -90; HD 110067;
  - TOI-700, LHS 1140, Gliese 12;
  - K2-18 [disputed];
  - hot planets: 55 Cnc e, WASP-39, -121, KELT-9, WASP-12;
  - imaged: HR 8799, β Pic, PDS 70, 2M1207, TWA 7, 14 Her;
  - WD 1856+534; rogue planets
- [x] The Hyades; the Ursa Major moving group: Notable Stars marks at their centres, framed by their extent (`web/src/core/stellarGroups.ts`); gone to, their named members are made star bodies, marked and named

### The Milky Way near us
- [~] The Local Bubble (Pelgrims et al. 2020's wall); the Radcliffe Wave (Konietzka et al. 2024's model and clouds): Local Interstellar Medium layer. Not the Gould Belt
- [x] Interstellar features: Loop I [disputed], the Orion–Eridanus superbubble, Barnard's Loop, the Coalsack, ρ Oph, Taurus, Barnard 68, Cygnus X: Interstellar Clouds layer (`web/src/core/interstellarClouds.ts`), each a mark and a ring of its size at its Gaia-dust, VLBA or published distance; dashed where assumed or disputed (Loop I, Barnard 68, Barnard's Loop). Their dust is not drawn
- [~] Star-forming regions: the Orion Nebula M42, Lagoon, Trifid, Rosette (Nebulae layer, volumes; also the Eagle, Omega, Carina, Horsehead, Tarantula). Not yet: the Orion molecular clouds, North America, Heart and Soul, NGC 3603, Westerlund 2
- [~] Planetary nebulae: Helix, Dumbbell, Cat's Eye, Southern Ring (Nebulae layer, their published shapes; the Owl a Messier mark). Not yet: Butterfly, Red Rectangle, Boomerang
- [ ] Remnants: Crab, Cassiopeia A, Tycho, Kepler, SN 1006, Vela, the Veil, SN 1987A (check which are in the remnant catalogue)
- [~] Extreme stars, Notable Stars marks, all but μ Cep, ρ Cas and WR 104, whose parallaxes give no distance:
  - massive: R136a1, VY CMa, μ Cep, ρ Cas, the Pistol Star, P Cyg, AG Car;
  - Wolf–Rayet: WR 104, WR 140;
  - young clusters: Westerlund 1, Arches, Quintuplet;
  - oldest and most metal-poor: HD 140283, SMSS J0313-6708;
  - odd: Przybylski's Star, Tabby's Star, T CrB
- [x] Stellar black holes: Gaia BH1, BH3, Cygnus X-1 (drawn to scale); Gaia BH2, A0620-00, V404 Cyg, GRS 1915+105, SS 433 (Notable Stars marks)
- [~] Magnetars and notable pulsars: SGR 1806-20, PSR B1919+21, B1913+16, J0737-3039, J1748-2446ad, J0952-0607 in the Pulsars layer (ATNF, McGill). Not SGR 1935+2154, which the catalogues give no distance; the long-period transients not checked

### The Milky Way's structure
- [~] Sgr A*'s shadow and the star S2 on its GRAVITY orbit (`blackHoles.ts`). Not the Central Molecular Zone
- [~] The bar, labelled `Galactic Bar`; each spiral arm by name (Norma, Scutum–Centaurus, Sagittarius–Carina, the Local Arm or Orion spur, Perseus, Outer, 3-kpc). Not the X-shaped bulge, the warp or the flare
- [x] The Fermi and eROSITA bubbles: faint shells, their outlines measured, their depth modelled (`galacticBubbles.ts`)
- [~] Halo: the Sagittarius stream, GD-1, Palomar 5's tails, the Monoceros Ring and 114 more streams (Stellar Streams layer, galstreams). Not Gaia-Enceladus, Kraken, Sequoia or the Helmi streams (groups in velocity, not tracks), nor TriAnd (no track in galstreams)
- [x] The Magellanic Stream, Bridge and Leading Arm (mapped on the sky; no distance along them is measured): their H I tracks, dashed, at the Clouds' distance, said so; high-velocity clouds (Smith Cloud, Complex C, Complex A): Interstellar Clouds layer; hypervelocity stars (S5-HVS1): a Notable Stars mark, its path back to Sgr A* dashed (`web/src/core/hypervelocity.ts`)
- [x] The Sun's galactic orbit (one turn, 238 Myr, computed in gala's MilkyWayPotential from the measured start); the dark halo's R200, 218 kpc (Cautun et al. 2020), a model: the Sun's Galactic Orbit layer, off by default (`web/src/core/galacticOrbit.ts`)
- [~] Every Messier object: 108 of 110 drawn and found by number (`messier.ts`); M24 (a star cloud at every distance) and M76 (no distance) not. Not the Caldwell catalogue
- [x] ω Cen's intermediate-mass black hole (Häberle et al. 2024): a Notable Stars mark at the cluster's centre

### Local Group
- [x] M31's Giant Stellar Stream: Conn et al. 2016's 19 fields, each at its measured distance, in the Stellar Streams layer (`m31Stream.ts`); Andromeda XXXVI (Sakowska et al. 2026), at Andromeda's distance, its own not measured
- [x] The NGC 3109 / Antlia–Sextans group (a row in its six members' panels); the zero-velocity surface, the Local Sheet and the "Council of Giants" (its ring, and a row in its twelve's panels): the Local Structure layer, computed, off at first (`localStructure.ts`)
- [~] The LMC's Tarantula Nebula (Nebulae layer) and R136a1 (a mark). Not SN 1987A

### Local Volume (G2)
- [x] NGC 253, NGC 55, NGC 300, NGC 7793; NGC 3077, the Holmberg galaxies (NGC 55 and NGC 300 from McConnachie's catalogue)
- [~] Cen A's jets and lobes; M83; NGC 4945; Circinus: the galaxies drawn (`NGC 5128`, `Circinus Galaxy`), not the jets and lobes
- [x] Maffei 1, Maffei 2, IC 342, Dwingeloo 1
- [~] M94 and Cloud-9, a starless dark cloud (2025): M94 drawn, not Cloud-9
- [~] The Local Void; the Leo Triplet; the M96 group; NGC 1052-DF2/DF4 [disputed]: the M96 group and M66 drawn, the Local Void outlined (G3); not the triplet as one, nor DF2/DF4

### Virgo to Laniakea (G2/G3)
- [~] M87 and M87*'s shadow and jet; Markarian's Chain; M84, M86, M49, M60: the galaxies drawn, the giant ellipticals by their own Sérsic fits; not M87*'s shadow or jet, nor the chain named
- [~] The Local Supercluster; the Great Attractor; the Norma cluster; the Vela supercluster: the Great Attractor and the Norma Cluster; not the Local Supercluster named, nor Vela
- [~] Clusters: Perseus and NGC 1275; Ophiuchus; Abell 1689; Abell 2029 and IC 1101; Abell 2218: Perseus, NGC 1275 and Ophiuchus; not the rest
- [~] Superclusters and walls: Perseus–Pisces, Pisces–Cetus, Hercules, the CfA2 Great Wall, the South Pole Wall: all but the South Pole Wall
- [~] The Dipole Repeller; Ho'oleilana; Quipu (2025): the Dipole Repeller (with the Cold Spot Repeller, one CF4 basin); not Ho'oleilana or Quipu
- [~] Galaxies: the Antennae, Stephan's Quintet, Arp 220, Malin 1, NGC 4993 (GW170817): NGC 4038, NGC 7317 and NGC 7319, NGC 4993; not NGC 4039, the rest of the quintet, Arp 220 or Malin 1
- [x] Supernovae: SN 2023ixf, SN 2011fe, SN 2014J: Notable Stars marks at their hosts' distances, marked at every date, found and type, peak and lesson in the panel
- [x] The flow of galaxies: the Cosmicflows-4 velocity field's streamlines (Courtois et al. 2023): 53, coloured by the basin each ends in, Laniakea's 18 in its gold (`laniakea/flows.bin`, `tools/src/laniakea/flows.ts`, the Flow Lines layer); Laniakea's basin filled; "You are here" past 370 Mpc
- [x] The walls as their galaxies: the Sloan and CfA2 Great Walls' galaxies tinted, by their papers' spans on the sky and an estimated depth

### The far universe (G4)
- [~] Clusters: Phoenix (PSZ2 G339.63-69.34) and MACS J0717 (PSZ2 G180.25+21.03) are among the 1,088 Planck SZ
  clusters drawn as rings (SZ Clusters layer, `quasars/sz-clusters.bin`), not named or searchable; not Abell 370 or the Musket Ball
- [x] Protoclusters: Spiderweb, SPT2349-56, Hyperion; the BOSS Great Wall: far landmarks (`web/src/core/farLandmarks.ts`), Hyperion and the BGW rings of their sizes
- [x] The Giant Arc, the Big Ring [disputed]: far landmarks at z 0.802, the arc a mark at its central cluster, the ring a ring of 400 Mpc, each `[disputed]` (Sawala & Teeriaho 2025)
- [~] Quasars and supermassive black holes: SDSS DR16Q's 749,742 quasars to z 7.02, in the SDSS's wedges, the Quasars
  layer (`quasars/quasars-*.bin`, `web/src/scene/Quasars.tsx`); 3C 273 a record-holder; not OJ 287, Phoenix A,
  Holmberg 15A, the Cosmic Horseshoe
- [~] Transients: GRB 221009A "the BOAT" a record-holder; not GW150914, GW231123, Swift J1644+57, fast radio bursts
- [~] Deep fields: the Hubble Ultra Deep Field, SMACS 0723, JADES (GOODS-S) and COSMOS-Web as far landmarks
  (`web/src/core/farLandmarks.ts`), each a beam as wide as the field out to its farthest galaxy with a spectrum;
  not the Hubble Deep Field (1995) or CEERS
- [~] The distance record and its runners-up: MoM-z14 (the record), JADES-GS-z14-0, GN-z11, UHZ1,
  EUCL J1729+6410 (the farthest quasar), GRB 090423 and GRB 250314A are record-holders; not yet:
  - CAPERS-LRD-z9 and the little red dots;
  - the lensed star Icarus (no position found); LAP1
- [~] Epochs as shells: the last-scattering surface drawn; not reionisation, cosmic dawn, the dark ages

### Cosmology
- [x] The CMB dipole (the Sun's 370 km/s); the Cold Spot and the Eridanus supervoid [disputed]: the dipole a beam from the Sun to its hot pole on the wall, the Cold Spot a 5° circle on the map's cold patch (`web/src/core/farLandmarks.test.ts`), the supervoid a ring at z 0.22, its record `[disputed]`
- [~] The Hubble sphere (14.5 Gly), the event horizon (16.6 Gly), the particle horizon (46.2 Gly): in the About, Planck 2018; the camera zooms out past the last; none drawn
- [x] The cosmology the app uses, stated, given the Hubble tension: Planck 2018 past Laniakea, Cosmicflows-4's H0 within it (`web/src/core/cosmology.ts`, About)

## Summary

As of 13 November 2026, 244 labels:

| Status | Count |
| --- | --- |
| `[x]` in the app | 180 |
| `[~]` partly | 12 |
| `[ ]` missing | 52 |

Missing, by phase: Solar System 31, stars 3, Milky Way 6, G2 0, G3 7, G4 5.

The counts are the map's labels only, not "Beyond the map".
