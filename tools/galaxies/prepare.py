"""The galaxies' face-on maps (web/public/galaxies/): each disc's stars and dust, seen from above.

    python tools/galaxies/prepare.py [key ...]

Needs Python 3.11+, numpy, scipy and Pillow. Downloads its sources into tools/galaxies/.cache/
(ignored by git) and writes web/public/galaxies/<key>.png and <key>.json for each galaxy in
GALAXIES -- with keys, only those; what is done and why, web/public/galaxies/CREDITS.md.

A disc tipped i is seen as its face-on map squeezed along its minor axis by q, Hubble's
q^2 = cos^2 i + q0^2 sin^2 i for a sheet q0 as thick as it is long: undone, the map is what one
would see from above. For each of the map's points, (X along the major axis, Y towards the far
side) in pc:

    sky offset = X along the major axis  +  Y q towards the far side    (core/localGroup.ts galaxyAxes)

and through each picture's WCS to its pixel. A transparent disc so squeezed is 1 / q as bright
as face-on, so each map is that times q.

- **Old stars**: WISE 3.4 um (z0MGS, Leroy et al. 2019), which dust hardly dims: their light
  where they are. Foreground stars masked by z0MGS's own masks, and other galaxies on it
  (Andromeda's M32 and NGC 205), filled from round them; compact sources the masks missed taken
  out on the map (without_points). A bulge -- not a disc, drawn by the app as a body of its own
  -- fitted and taken off: a Sersic profile on the sky, its n, R_e and flattening free, with
  the disc's exponential, inside 3 kpc (bulge_shape).
- **Young stars**: their star formation, GALEX far-UV plus WISE 22 um for the UV the dust
  took (Leroy et al. 2008), in M_Sun / yr / kpc^2.
- **Dust**: as A_V face-on, magnitudes. Andromeda's from Marsh et al. 2018's PPMAP column
  density, H2 per cm^2, by Bohlin et al. 1978's gas to reddening; Triangulum's from z0MGS's
  dust surface density (Draine & Li 2007's model fitted to Herschel), by Draine et al. 2014's
  A_V = 0.74 Sigma_d / (10^5 M_Sun/kpc^2) less the 2.5 that model overpredicts (Dalcanton et
  al. 2015, who measured Andromeda's dust from its stars).

The Large Magellanic Cloud, nine degrees across the sky, is in neither z0MGS nor its dust maps:
its old stars from Spitzer's SAGE 3.6 um mosaic (Meixner et al. 2006) -- the mosaic's own
background taken off (without_background), and past its edge the disc's exponential of its
measured scale length (into_profile) -- its star formation from
SHASSA's H-alpha (Gaustad et al. 2001) and SAGE's 24 um for what the dust hides (Kennicutt et
al. 2009), its dust from Clark et al. 2023's surface density, calibrated so the Milky Way's
diffuse gas has 150 times the mass of its dust -- A_V by that and Bohlin et al.'s. Each only
where it was observed: past a map's edge nothing, rather than light made up.

Where the star formation is traced by H-alpha -- the LMC's -- it shows stars younger than some
10 Myr, still in the clouds they formed in; but most of the young population's V light is from
stars 10 to 100 Myr old, which have drifted from where they formed at some 10 km/s, a few hundred
pc. So that map is spread by a Gaussian of Galaxy.young_drift_pc, 200 pc, its total kept: a
star-forming region a knot of young stars round it, not a point. (The far-UV, Andromeda's and
Triangulum's, is from stars up to some 100 Myr old: already where they drifted to.)

And the LMC's ionised gas, which glows in its Balmer lines -- the pink of every photograph of its
HII regions, 30 Doradus first -- a map of its own, <key>-nebula.png: SHASSA's H-alpha face-on,
where the gas is (not spread), with H-beta's 1 / 2.86 of its energy on top (Case B, Osterbrock &
Ferland 2006), as V-band-equivalent light, L_Sun,V per pc^2 face-on -- the lines' energy over the
Sun's V luminosity, so the app draws it on the same exposure as the starlight.

The app turns these into light and opacity (<key>.json says how): the old stars normalised to
the disc's V luminosity, the young by their V light per unit star formation.

Each channel is encoded log10 between the bounds in <key>.json, 0 for none, in an 8-bit PNG:
R old stars, G star formation, B dust; the nebula alone in an 8-bit grey one, its bounds
<key>.json's nebula.bounds.

The Small Magellanic Cloud is no disc to deproject: torn by the LMC, it is deeper along our line
of sight than it is wide on the sky -- its Cepheids and RR Lyrae spread over some ten kpc in
distance, where it is three or four across. A face-on map of it would be a map of nothing. So its
maps are of the sky, as seen from Earth (projection 'sky'): the gnomonic plane about its centre,
N x N points G.half_deg either side, the column number growing to the east (so that the picture's
left is west, as the sky's is not) and the row number to the north; each value per pc^2 of sky
at G.distance_pc, Graczyk et al. 2020's 62.44 kpc. Its sources and their treatment are the LMC's
-- SAGE-SMC's 3.6 and 24 um (Gordon et al. 2011), SHASSA's H-alpha, Clark et al. 2023's dust --
with the Milky Way's globular clusters 47 Tucanae and NGC 362, in front of it, masked, and, past
the 24 um mosaic, the residuals SHASSA left of bright stars taken out (without_star_residuals).
Past Clark et al.'s map, no dust: it covers the body and the start of the Wing, and the dust
fades out at its edge rather than ending in a square (dust_faded).

And what the sky maps cannot say, how each place's light is spread in depth, from its stars
measured one by one: OGLE's RR Lyrae for the old stars (Jacyszyn-Dobrzeniecka et al. 2017) and
its classical Cepheids younger than 150 Myr for the young (Jacyszyn-Dobrzeniecka et al. 2016),
each star's distance from its period-luminosity relation. At each point of a coarse grid, the
mean distance and the intrinsic spread about it that best explain the stars round it, the
method's own scatter taken out -- measured where the same catalogue's stars lie in a galaxy
that is thin, the LMC (ogle_noise), not the tables' error column, a zero point common to every
star -- and the mean let change across the stars counted, so that a slope is not taken for
depth (depth_profile) -- the old stars' spread a Gaussian, the young's a Laplace, a sharp core
with long wings, as their stars show (depth_shape); the app spreads each sky point's light
along the line of sight by the profile of its place, the dust by the young stars'.
"""
import gzip
import json
import math
import warnings
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage, optimize, special

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'web' / 'public' / 'galaxies'
CACHE = HERE / '.cache'

Z0MGS = 'https://irsa.ipac.caltech.edu/data/WISE/z0MGS/images/'
Z0MGS_DUST = 'https://irsa.ipac.caltech.edu/data/Herschel/z0MGS_Dust/images/'
PPMAP = 'http://www.astro.cf.ac.uk/research/PPMAP_M31/'


class Galaxy:
    """A disc to map (core/localGroup.ts GIANTS): where it is, how it faces, how big its map.

    Or, projection 'sky', a galaxy mapped as seen from Earth: its major axis taken as east, its
    far side as north and its inclination as nothing, so that the face-on grid is the sky's
    tangent plane, X east and Y north, pc at distance_pc, half_deg either side."""

    def __init__(self, key, pgc, ngc, ra, dec, distance_pc, inclination, major_pa, near_pa, scale_length_pc,
                 half_pc, sfr_to_pc, bulge, overlapping, dust, sources='z0mgs', young_drift_pc=0.0,
                 projection='disc', half_deg=None, sage=None, shassa=None, foreground=(), bounds=None,
                 old_scale_pc=None, size=1024, depth_size=32):
        self.key, self.pgc, self.ngc = key, pgc, ngc
        self.ra, self.dec, self.distance_pc = ra, dec, distance_pc
        self.inclination, self.major_pa, self.far_pa = inclination, major_pa, near_pa + 180
        self.scale_length_pc = scale_length_pc
        # The old stars' measured exponential scale length, pc -- in the disc, or on the sky for a
        # galaxy mapped as seen from Earth: what a Magellanic Cloud's mosaic background is told
        # apart by, and its light carried on with past the mosaic's edge (without_background,
        # into_profile). The disc's own, unless given.
        self.old_scale_pc = old_scale_pc or scale_length_pc
        # The map's points each way (N), and the depth grid's (DEPTH_SIZE): set for each galaxy.
        self.size, self.depth_size = size, depth_size
        self.projection, self.half_deg = projection, half_deg
        if projection == 'sky':
            half_pc = distance_pc * math.radians(half_deg)
        self.half_pc, self.sfr_to_pc = half_pc, sfr_to_pc
        # The Magellanic Clouds' own surveys: SAGE's IRAC 3.6 um and MIPS 24 um mosaics, (cache
        # name, URL -- None for one downloaded by hand); SHASSA's field, the ring, degrees, where
        # the Milky Way's H-alpha in front is measured, position angles left out of it, and the
        # depth, dR, below nothing that marks a bright star's residual (without_star_residuals).
        self.sage, self.shassa = sage, shassa
        # The Milky Way's globular clusters in front of it: (name, RA, Dec, and the radius masked
        # in the starlight and in the star formation's bands, degrees).
        self.foreground = foreground
        self.bounds = BOUNDS if bounds is None else bounds
        # How far the young stars that make most of their V light, 10 to 100 Myr old, have drifted
        # from where they formed: a Gaussian's sigma, pc, over a star formation map that shows
        # only where they form (H-alpha); 0 for one that already shows them (the far-UV).
        self.young_drift_pc = young_drift_pc
        self.bulge, self.overlapping, self.dust, self.sources = bulge, overlapping, dust, sources
        # The dust's sheet and the young stars': the Milky Way's dust layer, 134.4 pc (Drimmel &
        # Spergel 2001), over the disc's scale length. (None for a galaxy mapped on the sky.)
        self.dust_flattening = 134.4 / scale_length_pc if scale_length_pc else 0.0


# Bounds of each channel's log10: old stars in WISE's MJy/sr face-on, star formation in
# M_Sun/yr/kpc^2, dust as A_V face-on.
BOUNDS = {
    'old': (-3.5, 0.5),
    'sfr': (-6.5, -1.0),
    'dust': (-3.5, 0.5),
}
# The SMC's, as seen from Earth: its old stars in IRAC's MJy/sr, at most some 0.3 once softened,
# down to where their exponential is under the glow's floor (SMC_OLD_SCALE_DEG); its star
# formation at most some 0.02 M_Sun/yr/kpc^2 once spread.
SMC_BOUNDS = {
    'old': (-4.5, 0.0),
    'sfr': (-6.5, -1.5),
    'dust': (-3.5, 0.5),
}

# The LMC's: its old stars a decade fainter than BOUNDS' -- its exponential, carried past Spitzer's
# edge, is under the glow's floor only some 12 kpc out, where it is 2e-4 of its centre's.
LMC_BOUNDS = {
    'old': (-4.5, 0.5),
    'sfr': BOUNDS['sfr'],
    'dust': BOUNDS['dust'],
}

SAGE_SMC = 'https://irsa.ipac.caltech.edu/data/SPITZER/SAGE-SMC/images/'

# The SMC's old stars' exponential scale length on the sky, degrees: Nidever et al. 2011 (ApJ 733,
# L10), its metal-poor giants counted from 3 to 7.5 degrees out, h_r 1.0 deg -- 1.09 kpc at 62.44.
SMC_OLD_SCALE_DEG = 1.0

GALAXIES = {
    'm31': Galaxy('m31', 'PGC2557', '0224', (0 + 42 / 60 + 44.3 / 3600) * 15, 41 + 16 / 60 + 9 / 3600,
                  10 ** (1 + 24.407 / 5), 77.0, 38.0, 38.0 + 270, 5300.0,
                  half_pc=25_000.0, sfr_to_pc=22_000.0, bulge=True, overlapping=('M32', 'NGC205'), dust='ppmap'),
    'm33': Galaxy('m33', 'PGC5818', '0598', (1 + 33 / 60 + 50.9 / 3600) * 15, 30 + 39 / 60 + 37 / 3600,
                  10 ** (1 + 24.622 / 5), 52.0, 22.5, 22.5 + 270, 1600.0,
                  half_pc=12_000.0, sfr_to_pc=11_000.0, bulge=False, overlapping=(), dust='z0mgs'),
    # 13 kpc either side: its disc's exponential, 1.4 kpc, at its centre about white (some 130
    # L_Sun,V per pc^2 against 142), is under the glow's floor, 1.5e-4 of white, only past 12 kpc --
    # so the map's round window, from 11 kpc, ends it where it already rounds to black. At 9 kpc
    # the window cut it at a hundredth of white, a grey disc's rim.
    'lmc': Galaxy('lmc', None, None, (5 + 23 / 60 + 34.5 / 3600) * 15, -(69 + 45 / 60 + 22 / 3600),
                  49_590.0, 34.0, 139.1, 139.1 - 90, 1400.0,
                  half_pc=13_000.0, sfr_to_pc=5_500.0, bulge=False, overlapping=(), dust='clark', sources='lmc',
                  young_drift_pc=200.0,
                  sage=(('SAGE_LMC_IRAC3.6_2_mosaic.fits', None), ('SAGE_LMC_MIPS24_E12.fits', None)),
                  shassa=('013', (5.5, 6.3), None, None), bounds=LMC_BOUNDS),
    # Seen from Earth, 8 degrees either side -- its bar, its Wing to the east, NGC 602 at its tip,
    # and its old stars' exponential, 1.0 degree, out to where it rounds to black: some 0.3 of
    # white at its centre, under the glow's floor only past 7.6 degrees (at 5 the window cut it at
    # a few thousandths, a rim);
    # star formation ending 4 degrees out, where the Bridge to the LMC begins. The Milky Way's
    # foreground H-alpha 4.5 to 6 degrees out, not towards the LMC: the Bridge's gas lies at
    # position angle 110 degrees, so 50 to 170 is left out. 47 Tuc and NGC 362 (Harris 1996, 2010
    # edition) masked in the starlight to their tidal radii, 42' and 10' -- 47 Tuc's still a fifth
    # above the SMC's at 40' -- and in H-alpha and at 24 um to where their continuum left a
    # residual, 10' and 5'.
    'smc': Galaxy('smc', None, None, (0 + 51 / 60) * 15, -(73 + 7 / 60 + 12 / 3600),
                  62_440.0, 0.0, 90.0, -180.0, None,
                  half_pc=None, sfr_to_pc=62_440.0 * math.radians(4.0), bulge=False, overlapping=(), dust='clark',
                  sources='smc', young_drift_pc=200.0, projection='sky', half_deg=8.0,
                  sage=(('SAGE_SMC_IRAC3.6_2_mosaic.fits',
                         SAGE_SMC + 'IRAC_10x6_2_mosaics/SAGE_SMC_IRAC3.6_2_mosaic.fits'),
                        ('SAGE_SMC_MIPS24_E012.fits', SAGE_SMC + 'MIPS/SAGE_SMC_MIPS24_E012.fits')),
                  shassa=('510', (4.5, 6.0), (50.0, 170.0), 500.0),
                  foreground=(('47 Tuc', (0 + 24 / 60 + 5.67 / 3600) * 15, -(72 + 4 / 60 + 52.6 / 3600),
                               42 / 60, 10 / 60),
                              ('NGC 362', (1 + 3 / 60 + 14.26 / 3600) * 15, -(70 + 50 / 60 + 55.6 / 3600),
                               10 / 60, 5 / 60)),
                  bounds=SMC_BOUNDS, old_scale_pc=62_440.0 * math.radians(SMC_OLD_SCALE_DEG),
                  # Its texels and its depth cells as they were 5 degrees either side: 0.0098 and
                  # 0.31 degrees (core/skyMap.ts reads a third of a degree as its large scale).
                  size=1640, depth_size=51),
}
# The galaxy being mapped.
G = GALAXIES['m31']

# Each sheet's thickness over the disc's scale length: the old stars' (core/localGroup.ts
# DISC_FLATTENING).
OLD_FLATTENING = 1 / 7.3

# The map: N x N, G.half_pc either side of the centre (G.size).
N = 1024

# A_V per unit of each dust source.
AV_PER_PPMAP = 2e20 / (5.8e21 / 3.1)   # 10^20 H2 per cm^2: 2 x 10^20 H over Bohlin et al.'s N_H per A_V
AV_PER_DUST_MSUN_PC2 = 7.4 / 2.5      # Draine et al. 2014 eq. 7 (0.74 per 10^5 M_Sun/kpc^2), over Dalcanton et al.'s 2.5
# Clark et al. 2023's dust, whose opacity makes the Milky Way's diffuse gas 150 times its dust:
# 150 M_Sun/pc^2 of gas, 1.36 of it per hydrogen mass, in H per cm^2, over Bohlin et al.'s.
AV_PER_DUST_MW150 = 150 * (1.98892e33 / 3.0857e18 ** 2) / (1.36 * 1.6735e-24) / (5.8e21 / 3.1)

SAGE = 'https://irsa.ipac.caltech.edu/data/SPITZER/SAGE/images/'
# Kennicutt et al. 2009 (ApJ 703, 1672) eq. 16, Kroupa's IMF: SFR = 5.5e-42 [L(Ha) + 0.020 nu L_nu(24)],
# erg/s. Per unit intensity, 4 pi I over a kpc^2: SHASSA's decirayleigh is 10^5 / 4 pi photons of
# 656.28 nm per cm^2 per s per sr; MIPS's MJy/sr times 24 um's frequency.
SFR_PER_ERG = 5.5e-42 * 4 * math.pi * 3.0857e21 ** 2
ERG_PER_DR = 1e5 / (4 * math.pi) * 6.62607e-27 * 2.99792458e10 / 656.28e-7   # erg/s/cm^2/sr
SFR_PER_DR = SFR_PER_ERG * ERG_PER_DR
SFR_PER_MIPS24 = SFR_PER_ERG * 0.020 * 1e-17 * 2.99792458e10 / 24e-4

# The Sun's V luminosity, erg/s: M_V 4.81 (Willmer 2018, ApJS 236, 47) at 10 pc, V = 0 being
# 3.631e-9 erg/s/cm^2/A (Bessell, Castelli & Plez 1998, A&A 333, 231, table A2) over the V band's
# 880 A (its FWHM, Binney & Merrifield 1998, Galactic Astronomy, table 2.1): 4.55e32.
L_SUN_V = 4 * math.pi * (10 * 3.0857e18) ** 2 * 3.631e-9 * 880 * 10 ** (-0.4 * 4.81)
# A decirayleigh of H-alpha face-on as Balmer light, L_Sun,V per pc^2: 4 pi I over a pc^2, with
# H-beta's energy on top, Case B's F(Ha) / F(Hb) = 2.86 (Osterbrock & Ferland 2006).
NEBULA_PER_DR = ERG_PER_DR * 4 * math.pi * 3.0857e18 ** 2 * (1 + 1 / 2.86) / L_SUN_V
NEBULA_BOUNDS = (-3.0, 3.0)

SHASSA = 'https://amundsen.swarthmore.edu/SHASSA/Images/'
CLARK = 'https://zenodo.org/api/records/7392275/files/'

# OGLE's classical Cepheids (Jacyszyn-Dobrzeniecka et al. 2016, AcA 66, 149, table 3) and RR
# Lyrae (Jacyszyn-Dobrzeniecka et al. 2017, AcA 67, 1, table 2), each with its distance.
OGLE_CEPHEIDS = 'https://ogle.astrouw.edu.pl/cont/4_main/str/3_dim_str/table3.dat'
OGLE_RR_LYRAE = 'https://ogle.astrouw.edu.pl/cont/4_main/str/3_dim_rrl/table2.dat'
# The depth grid: M x M points over the map's square; a star counted as near one by a Gaussian
# of DEPTH_NEAR_DEG -- at the SMC's middle, some 500 RR Lyrae or 200 young Cepheids, a spread
# measured to some 0.2 kpc -- widened where they are sparse until it holds DEPTH_STARS of them.
DEPTH_SIZE = 32
DEPTH_NEAR_DEG = 0.5
DEPTH_STARS = 50
# Where it had to widen to DEPTH_FAR_DEG -- no tracer within some two degrees -- the whole
# galaxy's profile, blended in smoothly from DEPTH_NEAR_DEG.
DEPTH_FAR_DEG = 2.0
# The method's own scatter, measured in the LMC's stars of the same table (ogle_noise): squares
# of NOISE_CELL_DEG with NOISE_STARS or more stars in them.
NOISE_CELL_DEG = 0.5
NOISE_STARS = 40
# Where Clark et al.'s dust map of the SMC ends: dropped within the first of these, degrees, of its
# edge (its streaks), faded in by the second (dust_faded).
DUST_EDGE_DEG = (0.3, 0.7)
# The young: Cepheids younger than this, Myr -- the age of the stars that give most of a young
# population's V light, 10 to 100 Myr, and a little over.
YOUNG_MYR = 150.0


def fetch(url, name):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    # A FITS file by its first card; a gzipped or text one by being there at all.
    fits = name.endswith('.fits')
    if not path.exists() or (fits and path.read_bytes()[:9] != b'SIMPLE  =') or path.stat().st_size == 0:
        print('  fetching', url)
        request = urllib.request.Request(url, headers={'User-Agent': 'Solar-System-Simulator galaxy maps'})
        path.write_bytes(urllib.request.urlopen(request, timeout=3600).read())
    return path


def fetch_large(url, name, parts=16):
    """A big file -- SAGE's mosaics, most of a gigabyte -- by HTTP ranges, many at once, each
    retried (get_range); or by hand into the cache, url None."""
    path = CACHE / name
    if path.exists():
        return path
    if url is None:
        raise FileNotFoundError(f'{path}: download it into {CACHE} first')
    CACHE.mkdir(exist_ok=True)
    request = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Solar-System-Simulator galaxy maps'})
    size = int(urllib.request.urlopen(request, timeout=300).headers['Content-Length'])
    step = 16 << 20
    print(f'  fetching {url}: {size / 2 ** 20:.0f} MB')
    part = Path(str(path) + '.part')
    with open(part, 'wb') as f:
        f.truncate(size)

    def chunk(first):
        data = get_range(url, first, min(first + step, size) - 1)
        with open(part, 'r+b') as f:
            f.seek(first)
            f.write(data)

    with ThreadPoolExecutor(parts) as pool:
        list(pool.map(chunk, range(0, size, step)))
    part.rename(path)
    return path


def parse_header(raw):
    """A FITS header's cards, and where its data starts."""
    head = {}
    i = 0
    while True:
        if i + 80 > len(raw):
            return None, None
        card = raw[i:i + 80].decode('latin-1')
        i += 80
        key = card[:8].strip()
        if key == 'END':
            return head, math.ceil(i / 2880) * 2880
        if card[8:10] == '= ':
            value = card[10:].split('/')[0].strip()
            if value.startswith("'"):
                value = card[10:].split("'")[1].strip()
            else:
                try:
                    value = float(value)
                except ValueError:
                    pass
            head[key] = value


def wcs_of(head):
    if 'CD1_1' in head:
        cd = np.array([[head['CD1_1'], head.get('CD1_2', 0.0)], [head.get('CD2_1', 0.0), head['CD2_2']]])
    else:
        r = math.radians(head.get('CROTA2', 0.0))
        s1, s2 = head['CDELT1'], head['CDELT2']
        cd = np.array([[s1 * math.cos(r), -s2 * math.sin(r)], [s1 * math.sin(r), s2 * math.cos(r)]])
    return dict(ref=(head['CRVAL1'], head['CRVAL2']), pix=(head['CRPIX1'], head['CRPIX2']), cd=cd)


def get_range(url, first, last):
    request = urllib.request.Request(url, headers={'User-Agent': 'Solar-System-Simulator galaxy maps', 'Range': f'bytes={first}-{last}'})
    for attempt in range(15):
        try:
            data = urllib.request.urlopen(request, timeout=300).read()
            if len(data) == last - first + 1:
                return data
        except OSError as error:
            print('  retrying a range:', error)
        time.sleep(min(60, 5 * (attempt + 1)))
    raise RuntimeError(f'could not fetch {url} bytes {first}-{last}')


def fetch_cutout(url, name):
    """Of a z0MGS image -- nine degrees of sky, a gigabyte -- only the rows and columns the disc
    covers, by HTTP ranges, a row at a time and many at once: cached as .npy with its WCS."""
    CACHE.mkdir(exist_ok=True)
    npy, meta = CACHE / (name + '.npy'), CACHE / (name + '.json')
    if npy.exists() and meta.exists():
        info = json.loads(meta.read_text())
        info['cd'] = np.array(info['cd'])
        return np.load(npy), info
    whole = CACHE / (name + '.fits')
    if whole.exists():
        # Downloaded whole: some servers hang on ranges of a small file and not on the file.
        data, wcs, head = read_fits(whole)
        info = dict(ref=wcs['ref'], pix=wcs['pix'], cd=wcs['cd'].tolist(), unit=head.get('BUNIT', ''))
        np.save(npy, data)
        meta.write_text(json.dumps(info))
        info['cd'] = np.array(info['cd'])
        return data, info
    raw = get_range(url, 0, 2880 * 8 - 1)
    head, start = parse_header(raw)
    width, height = int(head['NAXIS1']), int(head['NAXIS2'])
    bpp = abs(int(head['BITPIX'])) // 8
    dtype = {-32: '>f4', -64: '>f8', 16: '>i2', 32: '>i4', 8: 'u1'}[int(head['BITPIX'])]
    wcs = wcs_of(head)
    # The disc's outline on the sky, and a margin for the smoothing.
    edge = np.linspace(-G.half_pc, G.half_pc, 64)
    xs = np.concatenate([edge, edge, np.full(64, -G.half_pc), np.full(64, G.half_pc)])
    ys = np.concatenate([np.full(64, -G.half_pc), np.full(64, G.half_pc), edge, edge])
    rows, cols = pixel_of(wcs, *sky_of_disc(xs, ys))
    margin = 40
    r0, r1 = max(0, int(rows.min()) - margin), min(height - 1, int(rows.max()) + margin)
    c0, c1 = max(0, int(cols.min()) - margin), min(width - 1, int(cols.max()) + margin)
    print(f'  {name}: rows {r0}-{r1}, columns {c0}-{c1} of {width} x {height}')
    # Whole rows, some 2 MB at a time and a dozen at once: a request takes the server a second
    # whatever its size, so rows one by one took an hour; the columns are cut out after.
    per_block = max(1, (2 << 20) // (width * bpp))
    blocks = [(r, min(r + per_block, r1 + 1)) for r in range(r0, r1 + 1, per_block)]

    def block(rows):
        first = start + rows[0] * width * bpp
        raw = get_range(url, first, first + (rows[1] - rows[0]) * width * bpp - 1)
        return np.frombuffer(raw, dtype=dtype).reshape(rows[1] - rows[0], width)[:, c0:c1 + 1].astype(np.float64)

    with ThreadPoolExecutor(12) as pool:
        data = np.concatenate(list(pool.map(block, blocks)))
    data = data * head.get('BSCALE', 1.0) + head.get('BZERO', 0.0)
    info = dict(ref=wcs['ref'], pix=(wcs['pix'][0] - c0, wcs['pix'][1] - r0), cd=wcs['cd'].tolist(), unit=head.get('BUNIT', ''))
    np.save(npy, data)
    meta.write_text(json.dumps(info))
    info['cd'] = np.array(info['cd'])
    return data, info


def read_extension(path, extname):
    """A multi-extension FITS file's image by its EXTNAME, and its celestial WCS."""
    raw = Path(path).read_bytes()
    pos = 0
    while pos < len(raw):
        head, start = parse_header(raw[pos:pos + 2880 * 40])
        width, height = int(head['NAXIS1']), int(head['NAXIS2'])
        bpp = abs(int(head['BITPIX'])) // 8
        # Its errors are cubes: their extra axes count too.
        planes = math.prod(int(head[f'NAXIS{k}']) for k in range(3, int(head['NAXIS']) + 1))
        if head.get('EXTNAME') == extname:
            dtype = {-32: '>f4', -64: '>f8'}[int(head['BITPIX'])]
            data = np.frombuffer(raw, dtype=dtype, count=width * height, offset=pos + start).reshape(height, width)
            return data.astype(np.float64), wcs_of(head)
        pos += start + math.ceil(width * height * planes * bpp / 2880) * 2880
    raise ValueError(f'{path}: no {extname}')


def read_fits(path):
    """A FITS image's first HDU and its celestial WCS (TAN: CD, or CDELT and CROTA2)."""
    raw = Path(path).read_bytes()
    head = {}
    i = 0
    while True:
        if i >= len(raw):
            raise ValueError(f'{path}: no END card -- not a FITS file')
        card = raw[i:i + 80].decode('latin-1')
        i += 80
        key = card[:8].strip()
        if key == 'END':
            break
        if card[8:10] == '= ':
            value = card[10:].split('/')[0].strip()
            if value.startswith("'"):
                value = card[10:].split("'")[1].strip()
            else:
                try:
                    value = float(value)
                except ValueError:
                    pass
            head[key] = value
    start = math.ceil(i / 2880) * 2880
    w, h = int(head['NAXIS1']), int(head['NAXIS2'])
    dtype = {-32: '>f4', -64: '>f8', 16: '>i2', 32: '>i4', 8: 'u1'}[int(head['BITPIX'])]
    data = np.frombuffer(raw, dtype=dtype, count=w * h, offset=start).reshape(h, w).astype(np.float64)
    if 'BLANK' in head:
        data[data == head['BLANK']] = np.nan
    data = data * head.get('BSCALE', 1.0) + head.get('BZERO', 0.0)
    if 'CD1_1' in head:
        cd = np.array([[head['CD1_1'], head.get('CD1_2', 0.0)], [head.get('CD2_1', 0.0), head['CD2_2']]])
    else:
        r = math.radians(head.get('CROTA2', 0.0))
        s1, s2 = head['CDELT1'], head['CDELT2']
        cd = np.array([[s1 * math.cos(r), -s2 * math.sin(r)], [s1 * math.sin(r), s2 * math.cos(r)]])
    return data, dict(ref=(head['CRVAL1'], head['CRVAL2']), pix=(head['CRPIX1'], head['CRPIX2']), cd=cd), head


def unit(pa):
    """A position angle's direction on the sky, (east, north)."""
    a = math.radians(pa)
    return math.sin(a), math.cos(a)


def squeeze(flattening):
    """How much shorter a disc of this thickness looks along its minor axis than its major, tipped
    G.inclination: Hubble's q^2 = cos^2 i + q0^2 sin^2 i -- cos i for a thin one."""
    i = math.radians(G.inclination)
    return math.sqrt(math.cos(i) ** 2 + flattening ** 2 * math.sin(i) ** 2)


def sky_of_disc(x_pc, y_pc, sq=None):
    """A point of the disc, pc along its major axis and towards its far side -> RA, Dec, degrees."""
    ce = squeeze(G.dust_flattening) if sq is None else sq
    me, mn = unit(G.major_pa)
    fe, fn = unit(G.far_pa)
    east = (x_pc * me + y_pc * ce * fe) / G.distance_pc
    north = (x_pc * mn + y_pc * ce * fn) / G.distance_pc
    # Inverse gnomonic about the centre.
    ra0, dec0 = math.radians(G.ra), math.radians(G.dec)
    r = np.hypot(east, north)
    c = np.arctan(r)
    with np.errstate(invalid='ignore', divide='ignore'):
        dec = np.arcsin(np.cos(c) * math.sin(dec0) + np.where(r > 0, north * np.sin(c) * math.cos(dec0) / r, 0))
        ra = ra0 + np.arctan2(east * np.sin(c), r * math.cos(dec0) * np.cos(c) - north * math.sin(dec0) * np.sin(c))
    return np.degrees(ra), np.degrees(dec)


def gnomonic(ra, dec, ref):
    """Sky positions -> the tangent plane about ref (RA, Dec), degrees east and north."""
    ra, dec = np.radians(ra), np.radians(dec)
    rar, decr = (math.radians(v) for v in ref)
    cosc = math.sin(decr) * np.sin(dec) + math.cos(decr) * np.cos(dec) * np.cos(ra - rar)
    pxi = np.degrees(np.cos(dec) * np.sin(ra - rar) / cosc)
    peta = np.degrees((math.cos(decr) * np.sin(dec) - math.sin(decr) * np.cos(dec) * np.cos(ra - rar)) / cosc)
    return pxi, peta


def pixel_of(wcs, ra, dec):
    """Sky positions -> a picture's pixel, 0-based (row, column)."""
    pxi, peta = gnomonic(ra, dec, wcs['ref'])
    inv = np.linalg.inv(wcs['cd'])
    col = wcs['pix'][0] - 1 + inv[0, 0] * pxi + inv[0, 1] * peta
    row = wcs['pix'][1] - 1 + inv[1, 0] * pxi + inv[1, 1] * peta
    return row, col


def filled(data, bad):
    """Masked pixels filled from round them: a normalised convolution, widening until all are."""
    data = np.where(bad, 0.0, data)
    weight = (~bad).astype(np.float64)
    out = data.copy()
    todo = bad.copy()
    sigma = 2.0
    while todo.any() and sigma < 256:
        num = ndimage.gaussian_filter(data, sigma)
        den = ndimage.gaussian_filter(weight, sigma)
        ok = todo & (den > 0.2)
        out[ok] = num[ok] / den[ok]
        todo &= ~ok
        sigma *= 2
    return out


def resample(data, wcs, sq):
    """A picture onto the face-on grid, deprojected: bilinear, 0 off the picture."""
    j, i = np.mgrid[0:N, 0:N].astype(np.float64)
    x = ((i + 0.5) / N * 2 - 1) * G.half_pc
    y = ((j + 0.5) / N * 2 - 1) * G.half_pc
    ra, dec = sky_of_disc(x, y, sq)
    row, col = pixel_of(wcs, ra, dec)
    inside = (row >= 0) & (row <= data.shape[0] - 1) & (col >= 0) & (col <= data.shape[1] - 1)
    out = ndimage.map_coordinates(data, [row, col], order=1, mode='constant', cval=0.0)
    return np.where(inside, out, 0.0) * sq, inside


SOURCES = ['w1_gauss7p5', 'w1_gauss7p5_stars', 'fuv_gauss15', 'fuv_gauss15_stars', 'w4_gauss15', 'w4_gauss15_stars']


LOCAL_GROUP = HERE.parent.parent / 'web' / 'public' / 'data' / 'local-group.json'

# Leroy et al. 2008 (AJ 136, 2782), eq. D11: star formation, M_Sun/yr/kpc^2, from FUV and 24 um in MJy/sr.
SFR_PER_FUV = 8.1e-2
SFR_PER_24UM = 3.2e-3


def face_on_grid(sq):
    """The map's points, pc along the major axis (X) and towards the far side (Y), and each
    one's distance from the centre on the sky, pc."""
    j, i = np.mgrid[0:N, 0:N].astype(np.float64)
    x = ((i + 0.5) / N * 2 - 1) * G.half_pc
    y = ((j + 0.5) / N * 2 - 1) * G.half_pc
    return x, y, np.hypot(x, y * sq)


def other_galaxies(shape, wcs):
    """Galaxies on the disc as seen from here -- Andromeda's M32 and NGC 205: four half-light
    radii about each."""
    catalog = json.loads(LOCAL_GROUP.read_text())
    bad = np.zeros(shape, bool)
    rows, cols = np.ogrid[0:shape[0], 0:shape[1]]
    for name in G.overlapping:
        k = catalog['catalogueName'].index(name)
        row, col = pixel_of(wcs, catalog['raDeg'][k], catalog['decDeg'][k])
        radius_deg = 4 * catalog['halfLightArcmin'][k] / 60
        radius_px = radius_deg / abs(wcs['cd'][1, 1])
        bad |= (rows - row) ** 2 + (cols - col) ** 2 < radius_px ** 2
        print(f'  {name} masked: {radius_deg * 60:.1f} arcmin about it')
    return bad


def face_on(name, maps, sq):
    """A picture deprojected onto the map, its foreground stars and the other galaxies masked
    and filled from round them on the map."""
    data, wcs = maps[name]
    stars, _ = maps[name + '_stars']
    bad = (stars > 0) | other_galaxies(data.shape, wcs) | ~np.isfinite(data)
    good = (~bad).astype(np.float64)
    value, inside = resample(np.where(bad, 0.0, np.nan_to_num(data)), wcs, sq)
    weight, _ = resample(good, wcs, sq)
    weight /= sq
    hole = inside & (weight < 0.5)
    print(f'  {name}: {bad.mean() * 100:.1f} % of the picture masked, {hole.mean() * 100:.1f} % of the map filled')
    with np.errstate(divide='ignore', invalid='ignore'):
        value = np.where(weight > 0, value / np.maximum(weight, 1e-9), 0.0)
    return filled(value, hole) * inside


def without_points(face, sq, label):
    """Compact sources taken out of the old stars' map: foreground stars the masks missed and star
    clusters, each drawn out along Y by the deprojection, which as a column through the disc's
    thickness would be a streak across it from any side. Where the map stands out by half again
    above its median over 1.5 kpc in Y and 450 pc in X, and by three times the noise, the median
    instead -- outside the bulge, whose middle is sharp of its own."""
    # As long along Y as the deprojection draws a source out: 9 texels across, 9 / q along.
    median = ndimage.median_filter(face, size=(int(9 / sq) | 1, 9))
    noise = 1.4826 * np.median(np.abs(face - median)[face > 0])
    x, y, _ = face_on_grid(sq)
    bright = face > 1.5 * median + 3 * noise
    if G.bulge:
        bright &= np.hypot(x, y * sq) > 0.4 * G.scale_length_pc
    bright = ndimage.binary_dilation(bright, iterations=2)
    print(f'  {label}: {bright.mean() * 100:.2f} % of the map taken as compact sources')
    return np.where(bright, median, face)


def unmatched_points(fuv, w4, sq):
    """Compact sources in one of the two star formation bands with nothing in the other, taken
    out: a star in front is bright in the far-UV and next to nothing at 22 um, a galaxy behind the
    reverse, where a star-forming region shows in both -- its young stars and the dust they warm."""
    def excess(face):
        median = ndimage.median_filter(face, size=(int(9 / sq) | 1, 9))
        noise = 1.4826 * np.median(np.abs(face - median)[face > 0])
        return median, face > 1.5 * median + 3 * noise, face > 1.2 * median + 2 * noise
    fuv_median, fuv_compact, fuv_any = excess(fuv)
    w4_median, w4_compact, w4_any = excess(w4)
    near = lambda mask: ndimage.binary_dilation(mask, iterations=3)
    fuv_alone = ndimage.binary_dilation(fuv_compact & ~near(w4_any), iterations=2)
    w4_alone = ndimage.binary_dilation(w4_compact & ~near(fuv_any), iterations=2)
    print(f'  far-UV alone {fuv_alone.mean() * 100:.2f} %, 22 um alone {w4_alone.mean() * 100:.2f} % of the map taken out')
    return np.where(fuv_alone, fuv_median, fuv), np.where(w4_alone, w4_median, w4)


def softened(face, label):
    """A map softened to the resolution its Y has -- a texel and a half across X, one along Y; on
    the sky, a texel each way -- and faded out below twice its noise, measured where there is no
    disc: the map's corners."""
    face = ndimage.gaussian_filter(face, 1.0 if G.projection == 'sky' else (1.0, 1.5))
    x, y, _ = face_on_grid(1.0)
    corners = (np.hypot(x, y) > 0.96 * G.half_pc) & (face != 0)
    if corners.sum() < 1000:
        # A map whose data stop short of its corners: its outermost tenth instead.
        r = np.hypot(x, y)
        corners = (face != 0) & (r > np.percentile(r[face != 0], 90))
    noise = 1.4826 * np.median(np.abs(face[corners] - np.median(face[corners])))
    print(f'  {label}: noise {noise:.3g}, faded out below {2 * noise:.3g}')
    return face * np.clip((face - noise) / noise, 0, 1)


def sersic(r, n, re):
    b = 2 * n - 1 / 3 + 0.009876 / n
    return np.exp(-b * ((np.maximum(r, 1.0) / re) ** (1 / n) - 1))


def bulge_shape(face, sq, label):
    """The bulge's shape in the old stars: a Sersic profile on the sky -- its n, R_e and flattening
    q along the minor axis free, as Andromeda's boxy bulge is no sphere -- fitted with the disc's
    exponential where the bulge is most of the light, inside 3 kpc on the sky."""
    x, y, _ = face_on_grid(sq)
    minor = y * sq
    r_disc = np.hypot(x, y)
    region = (np.hypot(x, minor) < 3000) & (np.hypot(x, minor) > 100) & (face > 0)
    data = face[region]
    disc = np.exp(-r_disc[region] / G.scale_length_pc) / data
    best = None
    for n in np.arange(1.0, 6.01, 0.25):
        for re in np.arange(300.0, 3001.0, 100.0):
            for q in np.arange(0.5, 1.001, 0.05):
                bulge = sersic(np.hypot(x[region], minor[region] / q), n, re) * sq / data
                (amp_b, amp_d), *_ = np.linalg.lstsq(np.stack([bulge, disc], 1), np.ones_like(data), rcond=None)
                if amp_b <= 0 or amp_d <= 0:
                    continue
                misfit = np.mean((1 - amp_b * bulge - amp_d * disc) ** 2)
                if best is None or misfit < best[0]:
                    best = (misfit, n, re, q)
    _, n, re, q = best
    print(f'  {label} bulge: n {n:.2f}, R_e {re:.0f} pc, q {q:.2f}, misfit {best[0] ** 0.5 * 100:.1f} %')

    def shape(sq2):
        gx, gy, _ = face_on_grid(sq2)
        return sersic(np.hypot(gx, gy * sq2 / q), n, re) * sq2

    return shape


def without_bulge(face, shape, sq, label):
    """The bulge, of the old stars' shape, fitted with the disc inside 3 kpc and taken off."""
    x, y, _ = face_on_grid(sq)
    r_disc = np.hypot(x, y)
    bulge = shape(sq)
    disc = np.exp(-r_disc / G.scale_length_pc)
    near = (np.hypot(x, y * sq) < 3000) & (face > 0)
    w = 1 / face[near]
    a, b = np.linalg.lstsq(np.stack([bulge[near] * w, disc[near] * w], 1), np.ones(near.sum()), rcond=None)[0]
    print(f'  {label}: bulge {a:.4g} at R_e, disc {b:.4g} at its centre')
    return np.maximum(face - max(a, 0) * bulge, 0.0)


def encode(face_on, bounds):
    """log10 between the bounds into codes 1-255; nothing, or less than the lower bound, 0."""
    lo, hi = bounds
    with np.errstate(divide='ignore', invalid='ignore'):
        log = np.log10(face_on)
    code = np.where(np.isfinite(log) & (log >= lo), np.round(1 + np.clip((log - lo) / (hi - lo), 0, 1) * 254), 0)
    # The rim nothing, so that the texture's edge, clamped, is nothing too.
    code[:2, :] = code[-2:, :] = code[:, :2] = code[:, -2:] = 0
    return code.astype(np.uint8)


def decode(code, bounds):
    lo, hi = bounds
    return np.where(code > 0, 10 ** (lo + (code.astype(np.float64) - 1) / 254 * (hi - lo)), 0.0)


def binned(path, factor):
    """A big FITS image read a band of rows at a time and averaged factor by factor, blank pixels
    left out; its WCS scaled to match. Cached as .npy beside it."""
    npy, meta = Path(str(path) + f'.bin{factor}.npy'), Path(str(path) + f'.bin{factor}.json')
    if npy.exists() and meta.exists():
        info = json.loads(meta.read_text())
        info['cd'] = np.array(info['cd'])
        return np.load(npy), info
    with open(path, 'rb') as f:
        head, start = parse_header(f.read(2880 * 40))
    width, height = int(head['NAXIS1']), int(head['NAXIS2'])
    dtype = {-32: '>f4', -64: '>f8'}[int(head['BITPIX'])]
    image = np.memmap(path, dtype=dtype, mode='r', offset=start, shape=(height, width))
    w2, h2 = width // factor, height // factor
    out = np.empty((h2, w2))
    band = 64
    for r in range(0, h2, band):
        rows = min(band, h2 - r)
        block = np.array(image[r * factor:(r + rows) * factor, :w2 * factor], dtype=np.float64)
        block[block == 0] = np.nan
        with np.errstate(invalid='ignore'), warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)
            out[r:r + rows] = np.nanmean(block.reshape(rows, factor, w2, factor), axis=(1, 3))
    wcs = wcs_of(head)
    info = dict(ref=wcs['ref'], pix=((wcs['pix'][0] - 0.5) / factor + 0.5, (wcs['pix'][1] - 0.5) / factor + 0.5),
                cd=(wcs['cd'] * factor).tolist())
    np.save(npy, out)
    meta.write_text(json.dumps(info))
    info['cd'] = np.array(info['cd'])
    return out, info


def face_on_observed(data, wcs, sq, label):
    """A picture deprojected onto the map where it was observed, and nothing past its edge."""
    valid = np.isfinite(data)
    value, inside = resample(np.where(valid, data, 0.0), wcs, sq)
    weight, _ = resample(valid.astype(np.float64), wcs, sq)
    weight /= sq
    seen = inside & (weight > 0.5)
    print(f'  {label}: observed over {seen.mean() * 100:.0f} % of the map')
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.where(seen, value / np.maximum(weight, 1e-9), 0.0)


def shassa_halpha():
    """SHASSA's field G.shassa (the LMC's 013, the SMC's 510): continuum-subtracted H-alpha,
    decirayleighs, less the Milky Way's own H-alpha in front, its median over a ring well outside
    the galaxy, degrees from its centre -- leaving out position angles towards anything else
    that shines in H-alpha (the SMC's Bridge to the LMC)."""
    field, (inner, outer), avoid, _ = G.shassa
    plain = CACHE / f'shassa_{field}.fl.fits'
    if not plain.exists():
        packed = fetch(f'{SHASSA}{field}.fl.fits.gz', f'shassa_{field}.fl.fits.gz')
        plain.write_bytes(gzip.decompress(packed.read_bytes()))
    data, wcs, _ = read_fits(plain)
    row, col = pixel_of(wcs, G.ra, G.dec)
    rows, cols = np.mgrid[0:data.shape[0], 0:data.shape[1]]
    deg = np.hypot(rows - row, cols - col) * abs(np.linalg.det(wcs['cd'])) ** 0.5
    ring = (deg > inner) & (deg < outer) & np.isfinite(data)
    if avoid:
        east, north = np.einsum('ij,jkl->ikl', wcs['cd'], np.array([cols - col, rows - row]))
        pa = np.degrees(np.arctan2(east, north)) % 360
        ring &= (pa < avoid[0]) | (pa > avoid[1])
    foreground = float(np.median(data[ring]))
    print(f'  H-alpha: the Milky Way in front {foreground:.1f} dR, taken off')
    return data - foreground, wcs


def without_background(face, seen, label):
    """A mosaic's own background taken off the old stars where it was observed: SAGE's 3.6 um
    mosaics keep a level of their own under the galaxy -- the zodiacal light, which at 3.6 um and
    near the south ecliptic pole the Clouds lie by is far from nothing, less what was taken off
    tile by tile. It shows as a floor the galaxy's light stops falling into: the SMC's medians,
    in rings, fall from the centre to some 3.7 kpc and then stay at 0.0035 MJy/sr out to 5.4 --
    where the giants Nidever et al. counted fall another e^-1.5 -- and the floor, carried on past
    the mosaic's edge and drawn on the screen's own curve, was a grey disc 5 degrees across.

    So the medians of the observed map in rings 150 pc wide, from one scale length out (inside it
    the bar and the arms are no exponential), fitted as A e^(-r / h) + b, h the galaxy's measured
    scale length (G.old_scale_pc): b, the floor, is taken off where it was observed. What is left
    under nothing is noise about it, and softened() fades it out."""
    x, y, _ = face_on_grid(1.0)
    r = np.hypot(x, y)
    h = G.old_scale_pc
    edges = np.arange(h, r[seen].max(), 150.0)
    rings, medians = [], []
    for inner, outer in zip(edges[:-1], edges[1:]):
        ring = seen & (r >= inner) & (r < outer)
        if ring.sum() > 200:
            rings.append(0.5 * (inner + outer))
            medians.append(np.median(face[ring]))
    rings, medians = np.array(rings), np.array(medians)
    (amplitude, floor), *_ = np.linalg.lstsq(np.c_[np.exp(-rings / h), np.ones_like(rings)], medians, rcond=None)
    print(f'  {label}: its background {floor:.4g}, fitted with the measured scale length {h:.0f} pc '
          f'over {rings.min():.0f}-{rings.max():.0f} pc, taken off -- {floor / amplitude * 100:.2f} % of '
          f'the profile at its centre')
    return np.where(seen, face - floor, 0.0)


def without_corner_level(face, seen, label):
    """A z0MGS map's own level where the galaxy is not: its median in the map's corners, past
    0.96 of its half-width, taken off where it was observed. Triangulum's 3.4 um map settles at
    -0.0018 MJy/sr there, its background taken off a little too deep; Andromeda's at nothing.
    (Not fitted as the Clouds' is: Andromeda's outskirts fall faster than its disc's exponential,
    and a fit with it reads that as a floor below nothing.)"""
    x, y, _ = face_on_grid(1.0)
    corners = seen & (np.hypot(x, y) > 0.96 * G.half_pc)
    level = float(np.median(face[corners])) if corners.sum() > 1000 else 0.0
    print(f'  {label}: its level in the corners {level:.4g}, taken off')
    return np.where(seen, face - level, 0.0)


def above_noise(face, seen):
    """How far a map stands above its noise, 0 to 1, smoothly: its light smoothed over 8 texels
    against the scatter of each texel about its neighbours' median, that scatter's median over
    blocks of 8 a little smoothed -- nothing below 1.5 times the noise, all of it from 5."""
    resid = np.abs(face - ndimage.median_filter(face, 9))
    # (Texels at nothing left out: a map clipped at nothing, as Andromeda's is once its bulge is
    # taken off, would read as noiseless where half of it is.)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)
        blocks = np.nanmedian(np.where(seen & (face != 0), resid, np.nan).reshape(N // 8, 8, N // 8, 8)
                              .transpose(0, 2, 1, 3).reshape(N // 8, N // 8, 64), axis=-1)
    blocks = np.where(np.isfinite(blocks), blocks, np.nanmedian(blocks))
    noise = 1.4826 * ndimage.zoom(ndimage.median_filter(blocks, 5), 8, order=1)
    signal = ndimage.gaussian_filter(np.where(seen, face, 0.0), 8)
    t = np.clip((signal / np.maximum(noise, 1e-12) - 1.5) / (5 - 1.5), 0, 1)
    return t


def into_profile(face, seen, sq, label, carry_on=True):
    """The old stars' map carried into the disc's exponential, of its measured scale length
    (G.old_scale_pc), wherever the map stops telling the galaxy from its noise: past the edge of
    what was observed, and in the outskirts where the light is down in the noise -- blended
    across both by a weight, so neither the observed edge nor any rim shows.

    Or, `carry_on` false, faded to nothing there instead: Andromeda's and Triangulum's maps hold
    their discs out to where their light is lost in the noise, and before it each already falls
    faster than its exponential -- Andromeda's past 12 kpc as if its scale length were 3 kpc, not
    5.3 -- so no light is carried on past what was measured; only the noise goes, a smooth fade and not each
    texel cut at a level of its own, which left the noise's peaks as streaks.

    The weight: the map's own light, smoothed, against its noise -- the scatter of each texel
    about its neighbours' median, its median over a kiloparsec or so -- nothing below 1.5 times
    the noise, all of it from 5; and inside the observed area, rising over its outer 1000 pc. The
    exponential's height matched to the map where the weight is halfway, the two the same there.

    Drawn on the screen's curve, as the glows are, what lay in the noise showed: Triangulum's
    3.4 um noise drawn out along its minor axis by the deprojection, a field of streaks round it;
    the Clouds' edges, a square with a rim. Fitted to the observed outer half once, the slope came
    out 2.35 kpc for the SMC, twice what its giants measure: the mosaic's floor and the Bridge to
    the east held it up."""
    x, y, _ = face_on_grid(sq)
    r = np.hypot(x, y)
    pixel_pc = 2 * G.half_pc / N
    model = np.exp(-r / G.old_scale_pc)
    t = above_noise(face, seen)
    inside = np.clip(ndimage.distance_transform_edt(seen) * pixel_pc / 1000.0, 0, 1)
    weight = t * t * (3 - 2 * t) * inside * inside * (3 - 2 * inside)
    if not carry_on:
        kept = weight > 0.5
        print(f'  {label}: faded out where the map is down in its noise -- kept over {kept.mean() * 100:.0f} % of it, '
              f'out to {np.percentile(r[kept], 99):.0f} pc')
        into_profile.weight = weight
        return weight * face
    band = seen & (weight > 0.3) & (weight < 0.7)
    if band.sum() < 100:
        band = seen & (weight > 0.1) & (weight < 0.9)
    model *= np.median(face[band]) / np.median(model[band])
    shown = weight > 0.5
    print(f'  {label}: into its exponential of scale length {G.old_scale_pc:.0f} pc where the map is down '
          f'in its noise or not observed -- the map kept over {shown.mean() * 100:.0f} % of it, out to '
          f'{np.percentile(r[shown], 99):.0f} pc')
    return weight * face + (1 - weight) * model


def without_foreground(face, label, starlight):
    """The Milky Way's globular clusters in front of the galaxy (G.foreground) taken as not
    observed: in the starlight, into_profile fills them with the galaxy's own; in the star
    formation's bands, nothing is there."""
    if not G.foreground:
        return face
    x, y, _ = face_on_grid(1.0)
    bad = np.zeros(face.shape, bool)
    for name, ra, dec, *radii in G.foreground:
        east, north = (math.radians(v) * G.distance_pc for v in gnomonic(ra, dec, (G.ra, G.dec)))
        bad |= np.hypot(x - east, y - north) < math.radians(radii[0 if starlight else 1]) * G.distance_pc
    names = ', '.join(f[0] for f in G.foreground)
    print(f'  {label}: {names} masked, {(bad & (face != 0)).mean() * 100:.2f} % of the map')
    return np.where(bad, 0.0, face)


def without_star_residuals(ha, seen24, depth):
    """SHASSA's bright stars, whose continuum it took off a little out of place, each left as a
    dipole: thousands of dR below nothing beside as many above -- where an HII region is never
    below nothing. Where 24 um was not observed, so that unmatched_points cannot tell a star from
    a star-forming region, H-alpha deeper than depth below nothing, and 3' round it, taken as not
    observed. (In the SMC, 24 um covers all its star formation: past it, these are the Milky
    Way's stars.)"""
    star = ndimage.binary_dilation(ha < -depth, iterations=5) & ~seen24
    print(f'  H-alpha: {ndimage.label((ha < -depth) & ~seen24)[1]} residuals of bright stars, '
          f'{star.mean() * 100:.2f} % of the map taken out')
    return np.where(star, 0.0, ha)


def magellanic_maps(old_sq, thin_sq):
    """A Magellanic Cloud's old stars, star formation and nebulae, from its own surveys.

    The nebulae: its ionised gas, which glows in its Balmer lines -- the pink of every photograph
    of its HII regions. SHASSA's H-alpha face-on as the star formation has it (the Milky Way's in
    front taken off, the compact sources with nothing at 24 um taken out), where the gas is,
    before finish() spreads the star formation by the young stars' drift; in L_Sun,V per pc^2,
    NEBULA_PER_DR: 4 pi I over a pc^2, H-beta's 1 / 2.86 of H-alpha's energy on top (Case B), over
    the Sun's V luminosity, so that it is drawn on the same exposure as the stars."""
    (irac_name, irac_url), (mips_name, mips_url) = G.sage
    print('old stars')
    irac, irac_wcs = binned(fetch_large(irac_url, irac_name), 5)
    old = face_on_observed(irac, irac_wcs, old_sq, 'IRAC 3.6 um')
    old = without_background(old, old != 0, 'IRAC')
    old = without_foreground(old, 'IRAC', True)
    seen = old != 0
    old = without_points(old, old_sq, 'IRAC')
    old = softened(into_profile(old, seen, old_sq, 'old stars'), 'old stars')
    print('star formation')
    ha, ha_wcs = shassa_halpha()
    mips, mips_wcs = binned(fetch_large(mips_url, mips_name), 5)
    ha = without_foreground(face_on_observed(ha, ha_wcs, thin_sq, 'H-alpha'), 'H-alpha', False)
    mips = without_foreground(face_on_observed(mips, mips_wcs, thin_sq, 'MIPS 24 um'), 'MIPS', False)
    if G.shassa[3]:
        ha = without_star_residuals(ha, mips != 0, G.shassa[3])
    ha, mips = np.maximum(ha, 0.0), np.maximum(mips, 0.0)
    # A source in one band with nothing in the other only where both were observed.
    both = ndimage.binary_erosion(mips > 0, iterations=5)
    ha_clean, mips = unmatched_points(ha, mips, thin_sq)
    ha = np.where(both, ha_clean, ha)
    return old, SFR_PER_DR * ha + SFR_PER_MIPS24 * mips, NEBULA_PER_DR * ha


def dust_map(thin_sq):
    """The dust, as A_V face-on."""
    if G.dust == 'ppmap':
        data, wcs, _ = read_fits(fetch(PPMAP + 'm31_cdens_05sig.fits', 'm31_cdens_05sig.fits'))
        av = np.where(np.isfinite(data) & (data > 0), data, 0.0) * AV_PER_PPMAP
    elif G.dust == 'clark':
        name = f'{G.key.upper()}_SED_Mass.fits'
        data, wcs, _ = read_fits(fetch(f'{CLARK}{name}/content', name))
        av = np.where(np.isfinite(data) & (data > 0), data, 0.0) * AV_PER_DUST_MW150
        if G.projection == 'sky':
            # Its dust mass, M_Sun/pc^2 over its pixels' pc^2 at the distance it was made for.
            pixel_pc = math.radians(abs(wcs['cd'][1, 1])) * G.distance_pc
            print(f'  Clark et al.: {np.nansum(np.where(data > 0, data, 0.0)) * pixel_pc ** 2:.3g} M_Sun of dust in all')
    else:
        name = f'ngc{G.ngc}_dustparameters_conv250.fits'
        data, wcs = read_extension(fetch(f'{Z0MGS_DUST}ngc{G.ngc}/{name}', name), 'LOGSIGD')
        av = np.where(np.isfinite(data), 10.0 ** np.nan_to_num(data, nan=-99.0), 0.0) * AV_PER_DUST_MSUN_PC2
    dust = resample(av, wcs, thin_sq)[0]
    # Its noise, drawn out along Y, softened to a texel or so each way; on the sky, not drawn out.
    dust = ndimage.gaussian_filter(dust, 0.75 if G.projection == 'sky' else (1.5, 0.75))
    if G.dust == 'clark':
        dust = dust_faded(dust, np.isfinite(data), wcs, 1.0 if G.projection == 'sky' else thin_sq)
    return dust


def dust_faded(dust, observed, wcs, sq):
    """A dust map that covers only part of the galaxy -- Clark et al.'s of the SMC, its body and
    the start of its Wing, some 4.3 x 4.9 degrees; of the LMC, Spitzer's square -- faded to nothing
    towards the edge of where it was observed, rather than ending in a square that a volume would
    show from every side. Past it, no dust: unlike the old stars there is no profile of it to carry
    on honestly. The fit's outermost DUST_EDGE_DEG[0], where the far-infrared is faint and its rows
    come out as streaks, dropped; then a smooth ramp to the whole map by DUST_EDGE_DEG[1] inside the
    edge. Where it was observed: its finite pixels, gaps of a few closed. (The LMC's streaks, A_V
    twice the disc's within a degree of the edge, were a dark mottled band along its square once
    the faint light round it showed.)"""
    footprint = ndimage.binary_fill_holes(ndimage.binary_closing(observed, iterations=6))
    seen = resample(footprint.astype(np.float64), wcs, sq)[0] / sq > 0.5
    # A map pixel's size, degrees: on the sky; or for a disc, its parsecs at the galaxy's distance.
    pixel_deg = 2 * G.half_deg / N if G.projection == 'sky' else math.degrees(2 * G.half_pc / N / G.distance_pc)
    inside = ndimage.distance_transform_edt(seen) * pixel_deg
    ramp = np.clip((inside - DUST_EDGE_DEG[0]) / (DUST_EDGE_DEG[1] - DUST_EDGE_DEG[0]), 0, 1)
    faded = dust * ramp * ramp * (3 - 2 * ramp)
    pixel_pc2 = (2 * G.half_pc / N) ** 2 / AV_PER_DUST_MW150
    print(f'  dust faded at its edge: {dust.sum() * pixel_pc2:.3g} -> {faded.sum() * pixel_pc2:.3g} M_Sun, '
          f'{(1 - faded.sum() / dust.sum()) * 100:.1f} % lost')
    return faded


def sexagesimal(text, scale):
    """'hh:mm:ss.s' (scale 15) or '-dd:mm:ss' (scale 1) -> degrees."""
    sign = -1 if text.startswith('-') else 1
    a, b, c = (float(v) for v in text.lstrip('+-').split(':'))
    return sign * scale * (a + b / 60 + c / 3600)


def ogle_stars(url, name, ages, where=None, ref=None):
    """An OGLE table's stars of a galaxy (its location column, G.key in capitals unless where
    says another): each one's place on the tangent plane about ref (G's centre unless given),
    degrees east and north, its distance and the table's error of it, kpc, and, ages True, its
    age, Myr."""
    rows = []
    for line in fetch(url, name).read_text(encoding='latin-1').splitlines():
        p = line.split()
        if not p or p[0] != (where or G.key.upper()):
            continue
        # Its RA the first column with colons: the Cepheids' table has a pulsation mode the RR
        # Lyrae's has not, the RR Lyrae's two metallicity columns the Cepheids' has not.
        k = next(i for i, v in enumerate(p) if ':' in v)
        rows.append((sexagesimal(p[k], 15), sexagesimal(p[k + 1], 1), float(p[k + 2]), float(p[k + 3]),
                     float(p[17]) if ages else math.nan))
    ra, dec, d, e, age = np.array(rows).T
    x, y = gnomonic(ra, dec, ref or (G.ra, G.dec))
    return x, y, d, e, age


def ogle_noise(url, name, ages):
    """How far an OGLE table's distances scatter where the stars do not, in distance modulus:
    the method's own scatter, which is not depth. Its error column is not it: there it is the
    OGLE-IV photometry's zero point, 0.02 mag in I and in V, through the Wesenheit index I - 1.55
    (V - I) -- 0.060 mag, the same for every Cepheid to 0.0002 and every RR Lyrae to 0.003 (the
    RR Lyrae's metallicity's error with it), a calibration shared by the stars round a place
    that does not spread them -- and it leaves out what does: the period-luminosity relation's
    own width, each star's photometry and, for the RR Lyrae, its photometric metallicity. So it
    is measured, in the same table's LMC stars, a disc seen 25 to 35 degrees from face-on: in
    each square of NOISE_CELL_DEG holding NOISE_STARS or more, the scatter of their distance
    moduli about a plane, the LMC's tilt and warp across it taken out, clipped at three times
    it; the median of the squares'. Its young disc is some 0.1 to 0.3 kpc thick, 0.01 mag, so
    for the Cepheids it is all but the method's: 0.068 mag. Its old stars have a depth of their
    own, so for the RR Lyrae, 0.10 mag, it is at most the method's: the SMC's old stars' depth
    found with it, if anything, a little short of theirs. (Checked against the 264 SMC RR Lyrae
    in Muraveva et al. 2018's VMC table, distances from Ks alone: what the two disagree by puts
    0.061 mag of OGLE's distances' scatter in OGLE alone, the least it can be.)"""
    lmc = GALAXIES['lmc']
    x, y, d, _, _ = ogle_stars(url, name, ages, where='LMC', ref=(lmc.ra, lmc.dec))
    mu = 5 * np.log10(d * 100)
    i, j = np.floor(x / NOISE_CELL_DEG).astype(int), np.floor(y / NOISE_CELL_DEG).astype(int)
    scatter = []
    for cell in set(zip(i, j)):
        inside = (i == cell[0]) & (j == cell[1])
        if inside.sum() < NOISE_STARS:
            continue
        a = np.stack([np.ones(inside.sum()), x[inside], y[inside]], 1)
        r = mu[inside] - a @ np.linalg.lstsq(a, mu[inside], rcond=None)[0]
        keep = np.ones(len(r), bool)
        for _ in range(10):
            new = np.abs(r - r[keep].mean()) < 3 * r[keep].std()
            if (new == keep).all():
                break
            keep = new
        scatter.append(r[keep].std())
    noise = float(np.median(scatter))
    print(f'  {name}: in the LMC, {len(scatter)} squares of {NOISE_STARS} stars or more scatter by {noise:.3f} mag '
          f'(10-90 %: {np.percentile(scatter, 10):.3f}-{np.percentile(scatter, 90):.3f}) about their plane')
    return noise


SIGMA_GRID = np.arange(0.0, 15.001, 0.05)
# How far from the plane, in total widths (the spread's and the method's in quadrature), a star
# is still counted, by the profile's shape: a Gaussian's 99.7 %, three; a Laplace's tails are
# its own, and clipped at three they are taken for strays -- at five, where the shape found no
# longer changes (it does not from five to eight).
DEPTH_CLIP = {'gaussian': 3.0, 'laplace': 5.0}


def gaussian_nll(r, e, w, s):
    """Minus the log likelihood of residuals r about the plane, each scattered by e and counted
    by w, for a Gaussian spread of standard deviation s."""
    var = s * s + e * e
    return 0.5 * float((w * (np.log(2 * math.pi * var) + r * r / var)).sum())


def laplace_nll(r, e, w, s):
    """The same for a Laplace spread of standard deviation s, scale b = s / sqrt 2, convolved
    with each star's Gaussian scatter e: in closed form, e^(a^2 / 2) / 2b [e^(r/b) Phi(-r/e - a)
    + e^(-r/b) Phi(r/e - a)], a = e / b."""
    b = max(s, 1e-3) / math.sqrt(2)
    a = e / b
    log = (a * a / 2 - math.log(2 * b)
           + np.logaddexp(r / b + special.log_ndtr(-r / e - a), -r / b + special.log_ndtr(r / e - a)))
    return -float((w * log).sum())


def best_spread(nll, r, e, w):
    """The standard deviation, kpc, between 0.02 and 15, that best explains the residuals."""
    res = optimize.minimize_scalar(lambda ls: nll(r, e, w, math.exp(ls)), bounds=(math.log(0.02), math.log(15.0)),
                                   method='bounded', options=dict(xatol=1e-4))
    return math.exp(res.x)


def depth_fit(x, y, d, e, w, shape='gaussian', residuals=False):
    """The mean distance mu and intrinsic spread sigma, a standard deviation, that best explain
    stars at distances d, each scattered by the method by e, kpc: the maximum of their
    likelihood, each counted by its weight w, d about mu + gx x + gy y by a Gaussian of sigma, or
    by a Laplace (shape), convolved with the Gaussian of e -- the mean let change across them,
    as a plane in their places x and y on the sky about their weighted centroid, so that mu is
    the mean distance where they are and a mean that changes across them is not taken for
    depth. The plane is the Gaussian's: for each sigma the weighted least squares one, sigma
    found on a grid of it, 0 to 15 kpc, then refined; a Laplace's spread is then the best for
    the stars about that plane. Clipped: stars more than DEPTH_CLIP total widths from the plane
    left out, and the fit made again, until none change -- a star of the Milky Way's halo or of
    the Bridge behind does not widen it. With residuals, also each kept star's distance from the
    plane, its e and its w."""
    keep = w > 0
    x = x - (w * x).sum() / w.sum()
    y = y - (w * y).sum() / w.sum()
    a_all = np.stack([np.ones_like(x), x, y])
    for _ in range(10):
        ww, dd, ee, aa = w[keep], d[keep], e[keep], a_all[:, keep]
        sigma = SIGMA_GRID
        for _ in range(2):
            var = sigma[:, None] ** 2 + ee ** 2
            c = ww / var
            normal = np.einsum('sn,in,jn->sij', c, aa, aa) + 1e-9 * np.eye(3)
            plane = np.linalg.solve(normal, np.einsum('sn,in,n->si', c, aa, dd)[..., None])[..., 0]
            nll = (ww * (np.log(var) + (dd - plane @ aa) ** 2 / var)).sum(1)
            best = int(np.argmin(nll))
            s, coef = sigma[best], plane[best]
            sigma = np.linspace(max(0.0, s - 0.05), s + 0.05, 101)
        if shape == 'laplace':
            s = best_spread(laplace_nll, dd - coef @ aa, ee, ww)
        new = (w > 0) & (np.abs(d - coef @ a_all) < DEPTH_CLIP[shape] * np.sqrt(s * s + e * e))
        if (new == keep).all():
            break
        keep = new
    if residuals:
        return float(coef[0]), float(s), int(keep.sum()), (d - coef @ a_all)[keep], e[keep], w[keep]
    return float(coef[0]), float(s), int(keep.sum())


def depth_shape(x, y, d, e, label):
    """The shape of a population's spread along the line of sight, the same everywhere: a
    Gaussian or a Laplace, whichever explains the stars of the squares of two grid steps holding
    30 or more better -- each square's own plane and spread, the stars within the Laplace's
    clip of it for both, so that neither is judged on stars the other left out. The two have
    closed forms the app draws exactly (core/skyMap.ts). A generalized normal, e^-|x|^beta, its
    beta fitted across the squares, puts the young Cepheids at beta 1.0, a Laplace, and the RR
    Lyrae at 2.0, a Gaussian: the young lie in a sharp core along each line of sight, with long
    wings, the old evenly about their mean."""
    step = 2 * G.half_deg / DEPTH_SIZE
    i = np.floor((x + G.half_deg) / (2 * step)).astype(int)
    j = np.floor((y + G.half_deg) / (2 * step)).astype(int)
    better = []
    for cell in set(zip(i, j)):
        inside = (i == cell[0]) & (j == cell[1])
        if inside.sum() < 30:
            continue
        *_, r, ee, ww = depth_fit(x, y, d, e, inside.astype(np.float64), 'laplace', residuals=True)
        g = gaussian_nll(r, ee, ww, best_spread(gaussian_nll, r, ee, ww))
        lap = laplace_nll(r, ee, ww, best_spread(laplace_nll, r, ee, ww))
        better.append(g - lap)
    better = np.array(better)
    shape = 'laplace' if better.sum() > 0 else 'gaussian'
    print(f'  {label}: a Laplace explains its {len(better)} squares better than a Gaussian by {better.sum():.1f} in '
          f'log likelihood ({(better > 0).sum()} of them): its spread {shape}')
    return shape


def depth_profile(x, y, d, e, label):
    """The depth of the galaxy's stars of one kind over the depth grid: at each of its M x M
    points, the mean distance and the intrinsic spread about it, kpc (depth_fit) -- of the stars
    round it, each counted by a Gaussian of its distance on the sky, DEPTH_NEAR_DEG, widened where
    they are sparse until it holds DEPTH_STARS; where it had to widen far, to DEPTH_FAR_DEG, the
    whole galaxy's instead, blended in smoothly: its mean distance, and the spread typical of a
    place in it -- not the whole galaxy's, which its mean's changing across the sky widens. The
    stars of each square of two grid steps fitted too, alone, where they are 30 or more: that
    typical spread is their median, and the spread is kept within what they find -- their 5th
    to 95th percentiles: the least a place's stars resolve, where they cannot tell a depth from
    the method's scatter, the 5th. Every fit of the population's own shape (depth_shape)."""
    shape = depth_shape(x, y, d, e, label)
    m = DEPTH_SIZE
    step = 2 * G.half_deg / m
    centres = ((np.arange(m) + 0.5) / m * 2 - 1) * G.half_deg
    whole = depth_fit(x, y, d, e, np.ones_like(d), shape)
    print(f'  {label}: {len(d)} stars; the whole galaxy {whole[0]:.2f} kpc, spread {whole[1]:.2f} kpc '
          f'({whole[2]} kept)')
    i = np.floor((x + G.half_deg) / (2 * step)).astype(int)
    j = np.floor((y + G.half_deg) / (2 * step)).astype(int)
    cells = []
    for cj in range(m // 2):
        for ci in range(m // 2):
            inside = (i == ci) & (j == cj)
            if inside.sum() >= 30:
                cells.append(((ci + 0.5) * 2 * step - G.half_deg, (cj + 0.5) * 2 * step - G.half_deg,
                              *depth_fit(x, y, d, e, inside.astype(np.float64), shape)))
    cells = np.array(cells)
    lo, typical, hi = np.percentile(cells[:, 3], [5, 50, 95])
    # The mean's gradient over the squares, each counted by its stars: a plane.
    a = np.stack([np.ones(len(cells)), cells[:, 0], cells[:, 1]], 1) * np.sqrt(cells[:, 4])[:, None]
    _, east, north = np.linalg.lstsq(a, cells[:, 2] * np.sqrt(cells[:, 4]), rcond=None)[0]
    print(f'  {label}: {len(cells)} squares of 30 stars or more; spread {np.median(cells[:, 3]):.2f} kpc '
          f'(5-95 %: {lo:.2f}-{hi:.2f}), mean {cells[:, 2].min():.1f}-{cells[:, 2].max():.1f} kpc, '
          f'farther by {math.hypot(east, north):.2f} kpc/deg towards position angle '
          f'{math.degrees(math.atan2(east, north)) % 360:.0f}')
    mean, spread = np.empty(m * m), np.empty(m * m)
    for k in range(m * m):
        r2 = (x - centres[k % m]) ** 2 + (y - centres[k // m]) ** 2
        holds = lambda h: np.exp(-r2 / (2 * h * h)).sum()
        h = DEPTH_NEAR_DEG
        if holds(h) < DEPTH_STARS:
            lo_h, hi_h = h, 30.0
            for _ in range(40):
                h = 0.5 * (lo_h + hi_h)
                lo_h, hi_h = (h, hi_h) if holds(h) < DEPTH_STARS else (lo_h, h)
            h = hi_h
        w = np.exp(-r2 / (2 * h * h))
        w[w < 1e-3] = 0.0
        mu, s, _ = depth_fit(x, y, d, e, w, shape)
        t = np.clip((h - DEPTH_NEAR_DEG) / (DEPTH_FAR_DEG - DEPTH_NEAR_DEG), 0, 1)
        t = t * t * (3 - 2 * t)
        mean[k] = (1 - t) * mu + t * whole[0]
        spread[k] = (1 - t) * s + t * typical
    spread = np.clip(spread, lo, hi)
    middle = [(m // 2 - 1) * m + m // 2 - 1, (m // 2 - 1) * m + m // 2, m // 2 * m + m // 2 - 1, m // 2 * m + m // 2]
    print(f'  {label}: at the centre {mean[middle].mean():.2f} kpc, spread {spread[middle].mean():.2f}; '
          f'over the grid mean {mean.min():.2f}-{mean.max():.2f}, spread {spread.min():.2f}-{spread.max():.2f} kpc')
    return dict(shape=shape, meanKpc=[round(float(v), 3) for v in mean], sigmaKpc=[round(float(v), 3) for v in spread])


def depth_grids():
    """The old stars' depth, from OGLE's RR Lyrae, and the young's, from its classical Cepheids
    younger than YOUNG_MYR (depth_profile). Each catalogue's distances rest on its own
    period-luminosity relation, and the two disagree by some 4 kpc at the SMC; so each is scaled
    to G.distance_pc, the eclipsing binaries' (Graczyk et al. 2020), by the median of all its
    stars within a degree of the centre -- a zero point in distance modulus, a factor in
    distance. Each star's distance scattered by the method's own scatter in distance modulus
    (ogle_noise), that share of it. The young Cepheids keep their offset from the older ones of
    the same catalogue: nearer by some 2.6 kpc."""
    out = dict(size=DEPTH_SIZE, halfDeg=G.half_deg)
    for kind, url, name, ages in (('old', OGLE_RR_LYRAE, 'ogle_rr_lyrae_table2.dat', False),
                                  ('young', OGLE_CEPHEIDS, 'ogle_cepheids_table3.dat', True)):
        x, y, d, table_e, age = ogle_stars(url, name, ages)
        scale = G.distance_pc / 1000 / np.median(d[np.hypot(x, y) < 1.0])
        noise = ogle_noise(url, name, ages)
        print(f'  {name}: its distances times {scale:.4f}; their error column {np.median(5 / math.log(10) * table_e / d):.3f} mag '
              f'(a zero point, not used), the method\'s scatter {noise:.3f} mag')
        d = d * scale
        e = noise * math.log(10) / 5 * d
        if ages:
            young = age < YOUNG_MYR
            print(f'  Cepheids younger than {YOUNG_MYR:.0f} Myr {np.median(d[young & (np.hypot(x, y) < 1.0)]):.2f} kpc '
                  f'within a degree of the centre, older {np.median(d[~young & (np.hypot(x, y) < 1.0)]):.2f}')
            x, y, d, e = x[young], y[young], d[young], e[young]
        out[kind] = depth_profile(x, y, d, e, f'{kind} ({"Cepheids" if ages else "RR Lyrae"})')
    return out


def make(galaxy):
    global G, N, DEPTH_SIZE
    G = galaxy
    N, DEPTH_SIZE = G.size, G.depth_size
    print(f'== {G.key}')
    old_sq, thin_sq = squeeze(OLD_FLATTENING), squeeze(G.dust_flattening)
    if G.projection == 'sky':
        print(f'  as seen from Earth, {G.half_deg} degrees either side of its centre')
    else:
        print(f'  squeezed to {old_sq:.3f} on the sky, the dust and young stars to {thin_sq:.3f}')
    if G.sources in ('lmc', 'smc'):
        old, sfr, nebula = magellanic_maps(old_sq, thin_sq)
        finish(old, sfr, thin_sq, nebula)
        return
    maps = {name: fetch_cutout(f'{Z0MGS}{G.pgc}/{G.pgc}_{name}.fits', f'{G.pgc}_{name}') for name in SOURCES}
    maps = {name: (data, {k: v for k, v in info.items() if k != 'unit'}) for name, (data, info) in maps.items()}

    print('old stars')
    w1 = without_points(face_on('w1_gauss7p5', maps, old_sq), old_sq, 'W1')
    shape = bulge_shape(w1, old_sq, 'W1') if G.bulge else None
    old = without_bulge(w1, shape, old_sq, 'W1') if shape else w1
    old = without_corner_level(old, w1 != 0, 'W1')
    old = softened(into_profile(old, w1 != 0, old_sq, 'old stars', carry_on=False), 'old stars')
    disc = into_profile.weight

    print('star formation')
    # A bulge's old stars shine in the far-UV and its dust at 22 um too: neither is star formation.
    fuv = face_on('fuv_gauss15', maps, thin_sq)
    w4 = face_on('w4_gauss15', maps, thin_sq)
    if shape:
        fuv = without_bulge(fuv, shape, thin_sq, 'FUV')
        w4 = without_bulge(w4, shape, thin_sq, 'W4')
    fuv, w4 = unmatched_points(fuv, w4, thin_sq)
    # Faded out with the old stars' disc where that is lost in its noise (into_profile): stars
    # form within the disc, and past it, cut texel by texel at a level, the bands' noise peaks
    # were blue specks round it.
    finish(old, (SFR_PER_FUV * fuv + SFR_PER_24UM * w4) * disc, thin_sq)


def finish(old, sfr, thin_sq, nebula=None):
    """The star formation softened, ended past the disc and, where it shows only where stars form,
    spread by the young stars' drift; the dust; the nebulae, if any, softened and ended as the star
    formation, not spread -- the gas is where it is; and the maps written."""
    # Past the disc, what the far-UV shows is foreground stars the masks missed, each drawn out
    # along the minor axis by the deprojection, and H-alpha the Milky Way's own: none of it, from
    # G.sfr_to_pc out.
    x, y, _ = face_on_grid(thin_sq)
    r_disc = np.hypot(x, y)
    taper = np.clip((G.sfr_to_pc - r_disc) / (0.08 * G.half_pc), 0, 1)
    sfr = softened(sfr, 'star formation') * taper * taper * (3 - 2 * taper)
    if G.young_drift_pc:
        # Spread, its total kept: it ends well inside the map, so none is lost past its edge.
        before = sfr.sum()
        sfr = ndimage.gaussian_filter(sfr, G.young_drift_pc / (2 * G.half_pc / N))
        print(f'  star formation spread by {G.young_drift_pc:.0f} pc: its total {before * (2 * G.half_pc / N) ** 2 / 1e6:.6g} '
              f'-> {sfr.sum() * (2 * G.half_pc / N) ** 2 / 1e6:.6g} M_Sun/yr')
    if nebula is not None:
        nebula = softened(nebula, 'nebulae') * taper * taper * (3 - 2 * taper)

    print('dust')
    dust = dust_map(thin_sq)

    # A round window, to nothing just inside the map's edge: a disc does not end in a square.
    r = np.hypot(*face_on_grid(1.0)[:2])
    window = np.clip((0.98 * G.half_pc - r) / (0.13 * G.half_pc), 0, 1)
    window = window * window * (3 - 2 * window)
    old, sfr, dust = old * window, sfr * window, dust * window

    bounds = G.bounds
    codes = [encode(old, bounds['old']), encode(sfr, bounds['sfr']), encode(dust, bounds['dust'])]
    pixel_pc2 = (2 * G.half_pc / N) ** 2
    if G.projection == 'sky':
        meta = dict(
            projection='sky',
            size=N,
            halfDeg=G.half_deg,
            centre=[round(G.ra, 6), round(G.dec, 6)],
            referencePc=round(G.distance_pc),
        )
    else:
        meta = dict(size=N, halfPc=G.half_pc)
    meta.update(
        bounds=bounds,
        oldSum=float(decode(codes[0], bounds['old']).sum() * pixel_pc2),
        sfrSum=float(decode(codes[1], bounds['sfr']).sum() * pixel_pc2 / 1e6),
    )
    OUT.mkdir(parents=True, exist_ok=True)
    channels = [('old', old, bounds['old']), ('sfr', sfr, bounds['sfr']), ('dust', dust, bounds['dust'])]
    if nebula is not None:
        nebula = nebula * window
        meta['nebula'] = dict(bounds=list(NEBULA_BOUNDS))
        Image.fromarray(encode(nebula, NEBULA_BOUNDS), 'L').save(OUT / f'{G.key}-nebula.png', optimize=True)
        channels.append(('nebula', nebula, NEBULA_BOUNDS))
    if G.projection == 'sky':
        print('depth')
        meta['depth'] = depth_grids()
    Image.fromarray(np.stack(codes, -1), 'RGB').save(OUT / f'{G.key}.png', optimize=True)
    (OUT / f'{G.key}.json').write_text(json.dumps(meta, indent=2) + '\n')
    for label, channel, bounds in channels:
        positive = channel[channel > 0]
        print(f'  {label}: 1/50/99/99.9 % {np.percentile(positive, [1, 50, 99, 99.9])}, at most {positive.max():.3g}, bounds {bounds}, '
              f'below {np.mean(positive < 10 ** bounds[0]) * 100:.1f} %, above {np.mean(positive > 10 ** bounds[1]) * 100:.2f} %')
    print('  total star formation', meta['sfrSum'], 'M_Sun/yr; written', OUT / f'{G.key}.png')
    if nebula is not None:
        # H-alpha alone, 4 pi I over the map, erg/s; its brightest point, 30 Doradus.
        print(f'  nebulae: H-alpha {nebula.sum() * pixel_pc2 * L_SUN_V / (1 + 1 / 2.86):.3g} erg/s in all, '
              f'at most {nebula.max():.4g} L_Sun,V/pc^2 face-on (L_Sun,V {L_SUN_V:.4g} erg/s)')
    if G.projection == 'sky':
        print(f'  dust: {decode(codes[2], G.bounds["dust"]).sum() * pixel_pc2 / AV_PER_DUST_MW150:.3g} M_Sun in the map')


def main():
    for key in sys.argv[1:] or GALAXIES:
        make(GALAXIES[key])


if __name__ == '__main__':
    main()
