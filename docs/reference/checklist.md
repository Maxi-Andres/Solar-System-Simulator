# Checklist: the log map's labels

Every object labelled on [observable-universe-log-map.jpg](observable-universe-log-map.jpg)
(see [README.md](README.md)), bottom to top, and whether the simulator holds it. The map is
the least the simulator should hold; this list says how far it is. Keep it up to date when
an object is added. After the map's labels come the labels that have aged, and what a realism-first
simulator should hold that the map does not show ("Beyond the map").

- `[x]` in the app: drawn at its real place and findable, and where it is.
- `[~]` partly: what is there and what is not.
- `[ ]` missing, with the roadmap phase it belongs to: **Solar System**, **stars**,
  **Milky Way**, **G2** (Local Volume and Virgo, in progress: the UNGC and EVCC catalogues,
  which bring M51, M63, M64, M81, M82, M101, M104 and the Virgo Cluster), **G3** (Laniakea:
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

## Near Earth and the atmosphere (to about 1,000 km)

- [~] Ground level: Earth is a textured globe with a Rayleigh atmosphere; no relief, no
  ground-level view.
- [ ] Ozone layer: the atmosphere has no ozone (`web/src/scene/atmosphere.ts` lists it as
  left out). Solar System.
- [ ] Commercial airplanes. Solar System.
- [ ] High-altitude balloon. Solar System.
- [ ] Meteor: no meteors or showers (their parent comets 55P and 109P are bodies). Solar
  System.
- [ ] Auroras. Solar System.

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
- [ ] Kordylewski cloud (Earth-Moon L4): disputed (see README). Solar System.
- [ ] Kordylewski cloud (Earth-Moon L5): as above. Solar System.
- [x] LRO: body, in lunar orbit.
- [x] Chandrayaan-2: body, in lunar orbit.
- [x] 2015 TB145: belt.
- [x] 433 Eros: belt.
- [ ] Queqiao: Solar System.
- [~] THEMIS: its two outer probes are here as ARTEMIS P1 and P2, about the Moon; THEMIS A,
  D and E, still in Earth orbit, are not.
- [ ] Earth-Moon L2: not marked, and nothing there is drawn (Queqiao is missing). Solar
  System.
- [ ] Chang'e 5 (its orbiter's extended mission): Solar System.
- [ ] Spektr-RG: Solar System.
- [~] Sun-Earth L2: the point is not marked; JWST, Gaia and Euclid there are.
- [x] Gaia: body (Horizons -139479).
- [x] JWST: body, `James Webb Space Telescope`.
- [x] WIND: body, `Wind`.
- [x] SOHO: body.
- [ ] LISA Pathfinder: Solar System.
- [~] Sun-Earth L1: the point is not marked; SOHO, ACE, Wind, DSCOVR, Aditya-L1 and IMAP
  there are.
- [x] DSCOVR: body.
- [x] ACE: body.
- [x] Itokawa: belt, `25143 Itokawa`.
- [ ] Herschel Space Observatory: Solar System.
- [ ] Planck: Solar System.
- [ ] WMAP: Solar System.

## Near the Earth's orbit (to about 0.1 AU)

- [ ] Tesla Roadster: left out on purpose for now, its Horizons object being the upper stage
  with the car on it, of unpublished size (`catalog.ts`). Solar System.
- [x] 2010 TK7: belt, `706765 (2010 TK7)`.
- [x] 2020 XL5: belt, `614689 (2020 XL5)`.
- [x] STEREO A: body, `STEREO-A`.
- [ ] STEREO B: contact lost in 2014; not a body. Solar System.
- [x] Spitzer: body.
- [x] Kamoʻoalewa: belt, `469219 Kamo`oalewa`.
- [x] Lucy: body.
- [ ] Sun-Earth L5: not marked, nothing there. Solar System.
- [~] Sun-Earth L4 (Earth trojans): the point is not marked; its trojans 2010 TK7 and
  2020 XL5 are in the belt.
- [ ] IKAROS: Solar System.
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
- [ ] Chang'e 2: Solar System.
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
- [ ] ʻOumuamua: on a hyperbola, which the belt drops; not a body either
  (`famousComets.ts` says so). Solar System.
- [x] Neptune: body.

## The Kuiper belt and the heliosphere (to about 1,000 AU)

- [x] Orcus: belt, `90482 Orcus`.
- [ ] Vanth (Orcus's moon): Solar System.
- [x] Pluto: body.
- [x] Charon: body.
- [x] Nix: small moon (`small-moons/pluto.json`).
- [x] Hydra: small moon.
- [x] Kuiper belt: about 7,300 trans-Neptunian objects, belt class TNO.
- [x] Makemake: body.
- [x] Haumea: body.
- [ ] Hiʻiaka (Haumea's moon): Solar System.
- [ ] Namaka (Haumea's moon): Solar System.
- [ ] Actaea (Salacia's moon): Solar System.
- [x] Salacia: belt, `120347 Salacia`.
- [x] Eris: body.
- [ ] Dysnomia (Eris's moon): its mass is in Eris's GM, but it is not drawn. Solar System.
- [x] Arrokoth: body.
- [x] New Horizons: body.
- [x] Pioneer 11: body.
- [x] Pioneer 10: body.
- [x] Voyager 2: body.
- [x] Voyager 1: body.
- [ ] Termination shock: Solar System.
- [ ] Heliopause: Solar System.
- [x] Gonggong: belt, `225088 Gonggong`.
- [x] Sedna: belt, `90377 Sedna`.

The big trans-Neptunians in the belt (Orcus, Salacia, Gonggong, Sedna) are points with
their orbits, not bodies of their size as Eris and Makemake are.

## The Oort cloud (to about 100,000 AU)

- [ ] Oort cloud: Solar System.

## The nearest stars (to about 10 pc)

- [x] Proxima Centauri: 3D star, named.
- [x] Alpha Centauri A: 3D star, named `Rigil Kentaurus` (its IAU name).
- [x] Alpha Centauri B: 3D star, named `Toliman`.
- [x] Barnard's Star: 3D star, named.
- [ ] Luhman 16: a brown dwarf with no five-parameter solution in Gaia DR3, so not in the
  catalogue (`nearbySystems.ts` says so). Stars.
- [x] Sirius: 3D star, named, with Sirius B and their orbit (`web/src/core/sirius.ts`).
- [x] Procyon: 3D star, named (Procyon B, not measured by Gaia, is not drawn).
- [x] Luyten 726-8: 3D stars, `Luyten 726-8 A` and `B` (BL Cet and UV Cet).
- [x] Wolf 359: 3D star, named.
- [x] Lalande 21185: 3D star, named.
- [ ] WISE 0855-0714: a brown dwarf, missing from Gaia as Luhman 16 is. Stars.
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
- [ ] UY Scuti: fainter than the sky's V 8 and far beyond the 3D census. Stars.
- [ ] Horsehead Nebula: no nebulae yet (they must be 3D volumes, not photos). Milky Way.
- [ ] Ring Nebula: Milky Way.
- [ ] Omega Nebula (M17): Milky Way.
- [ ] Eagle Nebula (M16): Milky Way.
- [~] Eta Carinae: on the sky only, a V 6.5 Hipparcos star left at infinity (its parallax
  is too poor to place it), unnamed. Stars / Milky Way.
- [ ] Carina Nebula: Milky Way.
- [x] Perseus Arm: one of the Milky Way model's arms (Reid et al. 2019), labelled.

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

- [~] Nearby galaxies: the Local Group's 145 (McConnachie's 144 and M31) are drawn; the Local Volume's are G2.
- [ ] Hoag's Object: G3.
- [ ] NGC 1300: about 19 Mpc, past the UNGC's 11 Mpc and not in Virgo. G3.
- [ ] Sunflower Galaxy (M63): G2.
- [ ] Black Eye (M64): G2.
- [ ] Sombrero (M104): G2.
- [ ] Mayall's Object: G3.
- [ ] Whirlpool (M51): G2.
- [ ] Bode's Galaxy (M81): G2.
- [ ] Cartwheel Galaxy: G3.
- [ ] Pinwheel Galaxy (M101): G2.
- [ ] Cigar Galaxy (M82): G2.
- [ ] Tadpole Galaxy: G3.
- [ ] Virgo Cluster: G2 (EVCC).

## Clusters, superclusters and voids (to about 1,000 Mpc)

- [ ] Superclusters of galaxies: G3.
- [ ] Fornax Cluster: G3.
- [ ] Shapley Supercluster: G3.
- [ ] KBC Void: G3.
- [ ] Hydra Cluster: G3.
- [ ] Pavo-Indus Supercluster: G3.
- [ ] Northern Local Supervoid: G3.
- [ ] Centaurus Cluster: G3.
- [ ] Horologium Supercluster: G3.
- [ ] Coma Wall: G3.
- [ ] Sculptor Wall: G3.
- [ ] Southern Local Supervoid: G3.
- [ ] Giant Void: G3.
- [ ] Leo Supercluster: G3.
- [ ] Walls and filaments: G3.
- [ ] Caelum Supercluster: G3.
- [ ] Sloan Great Wall: G3.
- [ ] Corona Borealis Supercluster: G3.
- [ ] ASASSN-15lh, "brightest supernova": maybe not a supernova (see README). G4.
- [ ] Boötes Void: G3.
- [ ] Pandora's Cluster (Abell 2744): z = 0.31, past G3's reach. G4.
- [ ] Bullet Cluster: z = 0.30. G4.
- [ ] Saraswati Supercluster: z = 0.28. G4.
- [ ] Giant GRB Ring: a claim (see README). G4.
- [ ] El Gordo Cluster: z = 0.87. G4.
- [ ] Cosmic web of galaxies: G4.

## The far universe

- [ ] Hercules-Corona Borealis Great Wall: a claim. G4.
- [ ] Clowes-Campusano LQG: G4.
- [ ] Huge-LQG: a claim. G4.
- [ ] U1.11 LQG: G4.
- [ ] J0313-1806, most distant known quasar (z = 7.64): G4.
- [ ] GRB 090429B, most distant gamma-ray burst: its z of about 9.4 is photometric. G4.
- [ ] HD1, "most distant known galaxy": an unconfirmed candidate; the confirmed record is
  MoM-z14 (z = 14.44), before it JADES-GS-z14-0. G4, with the confirmed ones.
- [ ] Tonantzintla 618, "most massive black hole": an estimate, not a measured record. G4.
- [ ] Earendel (the map's "Ereandel"), most distant single star (z of about 6.2): G4.
- [ ] Farthest visible galaxies: G4.
- [ ] Unreachable (the cosmic event horizon): G4.
- [ ] Cosmic microwave background: G4.
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
- [ ] Kármán line (100 km), Armstrong limit (19 km), noctilucent clouds (~83 km), sprites and jets, the ionosphere's layers, altitude records (X-15, SR-71, Eustace's jump)
- [ ] Van Allen belts, plasmasphere, magnetopause (~10 R⊕), bow shock, magnetotail, geocorona (~630,000 km), Earth's umbra and Hill sphere
- [ ] SWFO-L1 at Sun–Earth L1; Roman on its way to L2 (launched 2026-08-30 *(unverified)*). The other L1 and L2 craft are in the app.
- [ ] Observatories in Earth orbit: Swift, NuSTAR, TESS, IXPE, XRISM, Einstein Probe, SVOM, SPHEREx, PUNCH
- [ ] Earth's companions: quasi-moon 2025 PN7, mini-moon 2024 PT5
- [ ] Craft at the Moon: the Gateway's orbit, Danuri, Queqiao-2, CAPSTONE; Artemis II's trajectory (April 2026)
- [ ] Landing sites on the Moon: Apollo, Chang'e 4/5/6, Chandrayaan-3, SLIM, Blue Ghost 1

### Inner Solar System
- [ ] The Sun's layers and its Alfvén surface; the zodiacal dust cloud; the heliospheric current sheet
- [ ] Mars orbiters and rovers: MRO, MAVEN, Mars Express, Odyssey, TGO, Hope, Tianwen-1, Perseverance, Curiosity, Zhurong, ESCAPADE
- [ ] Craft on the way: Psyche, Europa Clipper, JUICE, Hera, OSIRIS-APEX, Hayabusa2#, Tianwen-2, BepiColombo (into Mercury orbit 2026-11-21)
- [ ] Asteroids: Bennu, Ryugu, Didymos–Dimorphos, 2024 YR4, Toutatis, Phaethon, 16 Psyche, Dinkinesh–Selam, Donaldjohanson, Ida–Dactyl, Gaspra, Lutetia, Šteins, Mathilde; the Kirkwood gaps and the Hildas
- [ ] Lucy's Trojan targets: Eurybates, Polymele, Leucus, Orus, Patroclus–Menoetius
- [ ] Comets: Tsuchinshan–ATLAS, 12P/Pons–Brooks, 67P, Shoemaker–Levy 9 (historic)
- [ ] Interstellar objects: 2I/Borisov, 3I/ATLAS (2025)

### Outer Solar System
- [ ] Kerberos, Styx; Quaoar and its rings; Varuna, Ixion
- [ ] The farthest objects seen: 2018 VG18 "Farout", 2018 AG37 "FarFarOut"
- [ ] Sednoids: 2012 VP113, Leleākūhonua, 2023 KQ14; 2017 OF201
- [ ] Planet Nine, as a region where it might be [hypothetical]
- [ ] The heliosphere: IBEX ribbon, hydrogen wall, heliotail; the Sun's gravitational focus (≥ 550 AU); the Hills cloud
- [ ] The Local Interstellar Cloud and the G-cloud
- [ ] Stellar flybys: Scholz's Star (70,000 years ago), Gliese 710 (in 1.3 Myr)

### Nearby stars and planets
- [ ] Barnard's Star's four planets (2025); α Cen A's candidate planet S1 [uncertain]; ε Ind Ab; GJ 251 c; HD 20794 d
- [ ] Ross 128, 154, 248; Gliese 1061; Teegarden's Star; Kapteyn's Star; YZ Ceti; Gliese 581, Gliese 667C
- [ ] Bright stars: Polaris, Deneb, Altair, Spica, Regulus, Fomalhaut, Mira, Algol, Castor, Orion's Belt
- [ ] Compact objects: Procyon B, 40 Eridani B, RX J1856.5-3754, PSR J0437-4715
- [ ] Planetary systems:
  - firsts: 51 Peg, PSR B1257+12;
  - TRAPPIST-1;
  - Kepler: Kepler-16, -186, -452, -90; HD 110067;
  - TOI-700, LHS 1140, Gliese 12;
  - K2-18 [disputed];
  - hot planets: 55 Cnc e, WASP-39, -121, KELT-9, WASP-12;
  - imaged: HR 8799, β Pic, PDS 70, 2M1207, TWA 7, 14 Her;
  - WD 1856+534; rogue planets
- [ ] The Hyades; the Ursa Major moving group

### The Milky Way near us
- [ ] The Local Bubble; the Radcliffe Wave; the Gould Belt (now read as a projection)
- [ ] Interstellar features: Loop I, the Orion–Eridanus superbubble, Barnard's Loop, the Coalsack, ρ Oph, Taurus, Barnard 68, Cygnus X
- [ ] Star-forming regions: the Orion Nebula M42 and the Orion molecular clouds; Lagoon, Trifid, Rosette, North America, Heart and Soul, NGC 3603, Westerlund 2
- [ ] Planetary nebulae: Helix, Dumbbell, Cat's Eye, Southern Ring, Butterfly, Red Rectangle, Boomerang
- [ ] Remnants: Crab, Cassiopeia A, Tycho, Kepler, SN 1006, Vela, the Veil, SN 1987A (check which are in the remnant catalogue)
- [ ] Extreme stars:
  - massive: R136a1, VY CMa, μ Cep, ρ Cas, the Pistol Star, P Cyg, AG Car;
  - Wolf–Rayet: WR 104, WR 140;
  - young clusters: Westerlund 1, Arches, Quintuplet;
  - oldest and most metal-poor: HD 140283, SMSS J0313-6708;
  - odd: Przybylski's Star, Tabby's Star, T CrB
- [ ] Stellar black holes: Gaia BH1, BH2, BH3, Cygnus X-1, A0620-00, V404 Cyg, GRS 1915+105, SS 433
- [ ] Magnetars and notable pulsars: SGR 1806-20, SGR 1935+2154, long-period transients, PSR B1919+21, B1913+16, J0737-3039, J1748-2446ad, J0952-0607

### The Milky Way's structure
- [ ] Sgr A*'s EHT shadow and the star S2; the Central Molecular Zone
- [ ] The bar and the X-shaped bulge; each spiral arm by name (Norma, Scutum–Centaurus, Sagittarius–Carina, Orion spur, Outer, 3-kpc); the warp and flare
- [ ] The Fermi and eROSITA bubbles
- [ ] Halo: Gaia-Enceladus, the Sagittarius dwarf and its stream, Kraken, Sequoia, the Helmi streams, GD-1, Palomar 5's tails, Monoceros, TriAnd
- [ ] The Magellanic Stream, Bridge and Leading Arm; high-velocity clouds (Smith Cloud, Complex C); hypervelocity stars (S5-HVS1)
- [ ] The Sun's galactic orbit; the dark halo's virial radius
- [ ] Every Messier object (110), and the Caldwell catalogue for the south
- [ ] ω Cen's intermediate-mass black hole (Häberle et al. 2024)

### Local Group
- [ ] M31's Giant Stellar Stream; Andromeda XXXVI (2026)
- [ ] The NGC 3109 / Antlia–Sextans group; the zero-velocity surface; the Local Sheet; the "Council of Giants"
- [ ] The LMC's Tarantula Nebula, R136 and SN 1987A

### Local Volume (G2)
- [ ] NGC 253, NGC 55, NGC 300, NGC 7793; NGC 3077, the Holmberg galaxies
- [ ] Cen A's jets and lobes; M83; NGC 4945; Circinus
- [ ] Maffei 1, Maffei 2, IC 342, Dwingeloo 1
- [ ] M94 and Cloud-9, a starless dark cloud (2025)
- [ ] The Local Void; the Leo Triplet; the M96 group; NGC 1052-DF2/DF4 [disputed]

### Virgo to Laniakea (G2/G3)
- [ ] M87 and M87*'s shadow and jet; Markarian's Chain; M84, M86, M49, M60
- [ ] The Local Supercluster; the Great Attractor; the Norma cluster; the Vela supercluster
- [ ] Clusters: Perseus and NGC 1275; Ophiuchus; Abell 1689; Abell 2029 and IC 1101; Abell 2218
- [ ] Superclusters and walls: Perseus–Pisces, Pisces–Cetus, Hercules, the CfA2 Great Wall, the South Pole Wall
- [ ] The Dipole Repeller; Ho'oleilana; Quipu (2025)
- [ ] Galaxies: the Antennae, Stephan's Quintet, Arp 220, Malin 1, NGC 4993 (GW170817)
- [ ] Supernovae: SN 2023ixf, SN 2011fe, SN 2014J

### The far universe (G4)
- [ ] Clusters: Phoenix, Abell 370, MACS J0717, the Musket Ball
- [ ] Protoclusters: Spiderweb, SPT2349-56, Hyperion; the BOSS Great Wall
- [ ] The Giant Arc, the Big Ring [disputed]
- [ ] Quasars and supermassive black holes: 3C 273, OJ 287, Phoenix A, Holmberg 15A, the Cosmic Horseshoe
- [ ] Transients: GW150914, GW231123, GRB 221009A "the BOAT", Swift J1644+57, fast radio bursts
- [ ] Deep fields: Hubble's Deep and Ultra Deep Fields, SMACS 0723, JADES, CEERS, COSMOS-Web
- [ ] The distance record and its runners-up:
  - MoM-z14 (the record), JADES-GS-z14-0, GN-z11, UHZ1;
  - CAPERS-LRD-z9 and the little red dots;
  - EUCL J1729+6410 (the farthest quasar);
  - GRB 090423, GRB 250314A;
  - the lensed star Icarus; LAP1
- [ ] Epochs as shells: reionisation, cosmic dawn, the dark ages, the last-scattering surface

### Cosmology
- [ ] The CMB dipole (the Sun's 370 km/s); the Cold Spot and the Eridanus supervoid [disputed]
- [ ] The Hubble sphere (~14.4 Gly), the event horizon (~16.5 Gly), the particle horizon (~46.5 Gly)
- [ ] The cosmology the app uses, stated, given the Hubble tension

## Summary

As of 12 November 2026, 244 labels:

| Status | Count |
| --- | --- |
| `[x]` in the app | 142 |
| `[~]` partly | 10 |
| `[ ]` missing | 92 |

Missing, by phase: Solar System 31, stars 3, Milky Way 6, G2 8, G3 24, G4 20.

The counts are the map's labels only, not "Beyond the map".
