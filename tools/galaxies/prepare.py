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

The app turns these into light and opacity (<key>.json says how): the old stars normalised to
the disc's V luminosity, the young by their V light per unit star formation.

Each channel is encoded log10 between the bounds in <key>.json, 0 for none, in an 8-bit PNG:
R old stars, G star formation, B dust.
"""
import json
import math
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'web' / 'public' / 'galaxies'
CACHE = HERE / '.cache'

Z0MGS = 'https://irsa.ipac.caltech.edu/data/WISE/z0MGS/images/'
Z0MGS_DUST = 'https://irsa.ipac.caltech.edu/data/Herschel/z0MGS_Dust/images/'
PPMAP = 'http://www.astro.cf.ac.uk/research/PPMAP_M31/'


class Galaxy:
    """A disc to map (core/localGroup.ts GIANTS): where it is, how it faces, how big its map."""

    def __init__(self, key, pgc, ngc, ra, dec, distance_pc, inclination, major_pa, near_pa, scale_length_pc,
                 half_pc, sfr_to_pc, bulge, overlapping, dust):
        self.key, self.pgc, self.ngc = key, pgc, ngc
        self.ra, self.dec, self.distance_pc = ra, dec, distance_pc
        self.inclination, self.major_pa, self.far_pa = inclination, major_pa, near_pa + 180
        self.scale_length_pc = scale_length_pc
        self.half_pc, self.sfr_to_pc = half_pc, sfr_to_pc
        self.bulge, self.overlapping, self.dust = bulge, overlapping, dust
        # The dust's sheet and the young stars': the Milky Way's dust layer, 134.4 pc (Drimmel &
        # Spergel 2001), over the disc's scale length.
        self.dust_flattening = 134.4 / scale_length_pc


GALAXIES = {
    'm31': Galaxy('m31', 'PGC2557', '0224', (0 + 42 / 60 + 44.3 / 3600) * 15, 41 + 16 / 60 + 9 / 3600,
                  10 ** (1 + 24.407 / 5), 77.0, 38.0, 38.0 + 270, 5300.0,
                  half_pc=25_000.0, sfr_to_pc=22_000.0, bulge=True, overlapping=('M32', 'NGC205'), dust='ppmap'),
    'm33': Galaxy('m33', 'PGC5818', '0598', (1 + 33 / 60 + 50.9 / 3600) * 15, 30 + 39 / 60 + 37 / 3600,
                  10 ** (1 + 24.622 / 5), 52.0, 22.5, 22.5 + 270, 1600.0,
                  half_pc=12_000.0, sfr_to_pc=11_000.0, bulge=False, overlapping=(), dust='z0mgs'),
}
# The galaxy being mapped.
G = GALAXIES['m31']

# Each sheet's thickness over the disc's scale length: the old stars' (core/localGroup.ts
# DISC_FLATTENING).
OLD_FLATTENING = 1 / 7.3

# The map: N x N, G.half_pc either side of the centre.
N = 1024

# Bounds of each channel's log10: old stars in WISE's MJy/sr face-on, star formation in
# M_Sun/yr/kpc^2, dust as A_V face-on.
BOUNDS = {
    'old': (-3.5, 0.5),
    'sfr': (-6.5, -1.0),
    'dust': (-3.5, 0.5),
}

# A_V per unit of each dust source.
AV_PER_PPMAP = 2e20 / (5.8e21 / 3.1)   # 10^20 H2 per cm^2: 2 x 10^20 H over Bohlin et al.'s N_H per A_V
AV_PER_DUST_MSUN_PC2 = 7.4 / 2.5      # Draine et al. 2014 eq. 7 (0.74 per 10^5 M_Sun/kpc^2), over Dalcanton et al.'s 2.5


def fetch(url, name):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists() or path.read_bytes()[:9] != b'SIMPLE  =':
        print('  fetching', url)
        request = urllib.request.Request(url, headers={'User-Agent': 'Solar-System-Simulator galaxy maps'})
        path.write_bytes(urllib.request.urlopen(request, timeout=3600).read())
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


def pixel_of(wcs, ra, dec):
    """Sky positions -> a picture's pixel, 0-based (row, column)."""
    ra, dec = np.radians(ra), np.radians(dec)
    rar, decr = (math.radians(v) for v in wcs['ref'])
    cosc = math.sin(decr) * np.sin(dec) + math.cos(decr) * np.cos(dec) * np.cos(ra - rar)
    pxi = np.degrees(np.cos(dec) * np.sin(ra - rar) / cosc)
    peta = np.degrees((math.cos(decr) * np.sin(dec) - math.sin(decr) * np.cos(dec) * np.cos(ra - rar)) / cosc)
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
    median = ndimage.median_filter(face, size=(31, 9))
    noise = 1.4826 * np.median(np.abs(face - median)[face > 0])
    x, y, _ = face_on_grid(sq)
    bright = (face > 1.5 * median + 3 * noise) & (np.hypot(x, y * sq) > 0.4 * G.scale_length_pc)
    bright = ndimage.binary_dilation(bright, iterations=2)
    print(f'  {label}: {bright.mean() * 100:.2f} % of the map taken as compact sources')
    return np.where(bright, median, face)


def unmatched_points(fuv, w4, sq):
    """Compact sources in one of the two star formation bands with nothing in the other, taken
    out: a star in front is bright in the far-UV and next to nothing at 22 um, a galaxy behind the
    reverse, where a star-forming region shows in both -- its young stars and the dust they warm."""
    def excess(face):
        median = ndimage.median_filter(face, size=(31, 9))
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
    """A map softened to the resolution its Y has -- a texel and a half across X, one along Y --
    and faded out below twice its noise, measured where there is no disc: the map's corners."""
    face = ndimage.gaussian_filter(face, (1.0, 1.5))
    x, y, _ = face_on_grid(1.0)
    corners = (np.hypot(x, y) > 0.96 * G.half_pc) & (face != 0)
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


def dust_map(thin_sq):
    """The dust, as A_V face-on."""
    if G.dust == 'ppmap':
        data, wcs, _ = read_fits(fetch(PPMAP + 'm31_cdens_05sig.fits', 'm31_cdens_05sig.fits'))
        av = np.where(np.isfinite(data) & (data > 0), data, 0.0) * AV_PER_PPMAP
    else:
        name = f'ngc{G.ngc}_dustparameters_conv250.fits'
        data, wcs = read_extension(fetch(f'{Z0MGS_DUST}ngc{G.ngc}/{name}', name), 'LOGSIGD')
        av = np.where(np.isfinite(data), 10.0 ** np.nan_to_num(data, nan=-99.0), 0.0) * AV_PER_DUST_MSUN_PC2
    dust = resample(av, wcs, thin_sq)[0]
    # Its noise, drawn out along Y, softened to a texel or so each way.
    return ndimage.gaussian_filter(dust, (1.5, 0.75))


def make(galaxy):
    global G
    G = galaxy
    print(f'== {G.key}')
    maps = {name: fetch_cutout(f'{Z0MGS}{G.pgc}/{G.pgc}_{name}.fits', f'{G.pgc}_{name}') for name in SOURCES}
    maps = {name: (data, {k: v for k, v in info.items() if k != 'unit'}) for name, (data, info) in maps.items()}

    print('old stars')
    old_sq, thin_sq = squeeze(OLD_FLATTENING), squeeze(G.dust_flattening)
    print(f'  squeezed to {old_sq:.3f} on the sky, the dust and young stars to {thin_sq:.3f}')
    w1 = without_points(face_on('w1_gauss7p5', maps, old_sq), old_sq, 'W1')
    shape = bulge_shape(w1, old_sq, 'W1') if G.bulge else None
    old = softened(without_bulge(w1, shape, old_sq, 'W1') if shape else w1, 'old stars')

    print('star formation')
    # A bulge's old stars shine in the far-UV and its dust at 22 um too: neither is star formation.
    fuv = face_on('fuv_gauss15', maps, thin_sq)
    w4 = face_on('w4_gauss15', maps, thin_sq)
    if shape:
        fuv = without_bulge(fuv, shape, thin_sq, 'FUV')
        w4 = without_bulge(w4, shape, thin_sq, 'W4')
    fuv, w4 = unmatched_points(fuv, w4, thin_sq)
    # Past the disc, what the far-UV shows is foreground stars the masks missed, each drawn out
    # along the minor axis by the deprojection: none of it, from G.sfr_to_pc out.
    x, y, _ = face_on_grid(thin_sq)
    r_disc = np.hypot(x, y)
    taper = np.clip((G.sfr_to_pc - r_disc) / (0.08 * G.half_pc), 0, 1)
    sfr = softened(SFR_PER_FUV * fuv + SFR_PER_24UM * w4, 'star formation') * taper * taper * (3 - 2 * taper)

    print('dust')
    dust = dust_map(thin_sq)

    codes = [encode(old, BOUNDS['old']), encode(sfr, BOUNDS['sfr']), encode(dust, BOUNDS['dust'])]
    pixel_pc2 = (2 * G.half_pc / N) ** 2
    meta = dict(
        size=N,
        halfPc=G.half_pc,
        bounds=BOUNDS,
        oldSum=float(decode(codes[0], BOUNDS['old']).sum() * pixel_pc2),
        sfrSum=float(decode(codes[1], BOUNDS['sfr']).sum() * pixel_pc2 / 1e6),
    )
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.stack(codes, -1), 'RGB').save(OUT / f'{G.key}.png', optimize=True)
    (OUT / f'{G.key}.json').write_text(json.dumps(meta, indent=2) + '\n')
    for label, channel, bounds in zip(('old', 'sfr', 'dust'), (old, sfr, dust), BOUNDS.values()):
        positive = channel[channel > 0]
        print(f'  {label}: 1/50/99/99.9 % {np.percentile(positive, [1, 50, 99, 99.9])}, bounds {bounds}, '
              f'below {np.mean(positive < 10 ** bounds[0]) * 100:.1f} %, above {np.mean(positive > 10 ** bounds[1]) * 100:.2f} %')
    print('  total star formation', meta['sfrSum'], 'M_Sun/yr; written', OUT / f'{G.key}.png')


def main():
    for key in sys.argv[1:] or GALAXIES:
        make(GALAXIES[key])


if __name__ == '__main__':
    main()
