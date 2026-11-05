"""The galaxies' face-on maps (web/public/galaxies/): each disc's stars and dust, seen from above.

    python tools/galaxies/prepare.py

Needs Python 3.11+, numpy, scipy and Pillow. Downloads its sources into tools/galaxies/.cache/
(ignored by git) and writes web/public/galaxies/m31.png and m31.json; what is done and why,
web/public/galaxies/CREDITS.md.

Andromeda is a disc tipped 77 degrees, so what is seen of it is its face-on map squeezed along
its minor axis by q, Hubble's q^2 = cos^2 i + q0^2 sin^2 i for a sheet q0 as thick as it is
long -- 0.262 for its old stars, 0.226 for its dust: undone, the map is what one would see from
above. For each of the map's points, (X along the major axis, Y towards the far side) in pc:

    sky offset = X along PA 38  +  Y q along PA 128     (core/localGroup.ts galaxyAxes)

and through each picture's WCS to its pixel. A transparent disc so squeezed is 1 / q as bright
as face-on, so each map is that times q.

- **Old stars**: WISE 3.4 um (z0MGS, Leroy et al. 2019), which dust hardly dims: their light
  where they are. Foreground stars masked by z0MGS's own masks, and the other galaxies on it
  (M32, NGC 205), filled from round them; compact sources the masks missed taken out on the
  map (without_points). The bulge -- not a disc, drawn by the app as a body of its own --
  fitted and taken off: a Sersic profile on the sky, its n, R_e and flattening free, with the
  disc's exponential, inside 3 kpc (bulge_shape).
- **Young stars**: their star formation, GALEX far-UV plus WISE 22 um for the UV the dust
  took (Leroy et al. 2008), in M_Sun / yr / kpc^2.
- **Dust**: Marsh et al. 2018's PPMAP column density from Herschel, H2 per cm^2.

The app turns these into light and opacity (m31.json says how): the old stars normalised to
the disc's V luminosity, the young by their V light per unit star formation, the dust by
Bohlin et al.'s A_V per hydrogen.

Each channel is encoded log10 between the bounds in m31.json, 0 for none, in an 8-bit PNG:
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

Z0MGS = 'https://irsa.ipac.caltech.edu/data/WISE/z0MGS/images/PGC2557/'
PPMAP = 'http://www.astro.cf.ac.uk/research/PPMAP_M31/'

# Andromeda (core/localGroup.ts GIANTS): its centre, distance, orientation, and its bulge.
RA0, DEC0 = (0 + 42 / 60 + 44.3 / 3600) * 15, 41 + 16 / 60 + 9 / 3600
DISTANCE_PC = 10 ** (1 + 24.407 / 5)
INCLINATION = 77.0
# Each sheet's thickness over the disc's scale length (core/localGroup.ts DISC_FLATTENING,
# faceOnScales): the old stars', and the dust's and the young stars' in it -- the Milky Way's
# dust layer, 134.4 pc (Drimmel & Spergel 2001).
OLD_FLATTENING = 1 / 7.3
DUST_FLATTENING = 134.4 / 5300
MAJOR_PA = 38.0
FAR_PA = 38.0 + 270 + 180
SCALE_LENGTH_PC = 5300.0

# The map: N x N, HALF_PC either side of the centre.
N = 1024
HALF_PC = 25_000.0

# Bounds of each channel's log10.
BOUNDS = {
    'old': (-3.5, 0.5),
    'sfr': (-6.5, -1.5),
    'dust': (-2.0, 1.0),
}


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
    for attempt in range(6):
        try:
            data = urllib.request.urlopen(request, timeout=300).read()
            if len(data) == last - first + 1:
                return data
        except OSError as error:
            print('  retrying a range:', error)
        time.sleep(5 * (attempt + 1))
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
    raw = get_range(url, 0, 2880 * 8 - 1)
    head, start = parse_header(raw)
    width, height = int(head['NAXIS1']), int(head['NAXIS2'])
    bpp = abs(int(head['BITPIX'])) // 8
    dtype = {-32: '>f4', -64: '>f8', 16: '>i2', 32: '>i4', 8: 'u1'}[int(head['BITPIX'])]
    wcs = wcs_of(head)
    # The disc's outline on the sky, and a margin for the smoothing.
    edge = np.linspace(-HALF_PC, HALF_PC, 64)
    xs = np.concatenate([edge, edge, np.full(64, -HALF_PC), np.full(64, HALF_PC)])
    ys = np.concatenate([np.full(64, -HALF_PC), np.full(64, HALF_PC), edge, edge])
    rows, cols = pixel_of(wcs, *sky_of_disc(xs, ys))
    margin = 40
    r0, r1 = max(0, int(rows.min()) - margin), min(height - 1, int(rows.max()) + margin)
    c0, c1 = max(0, int(cols.min()) - margin), min(width - 1, int(cols.max()) + margin)
    print(f'  {name}: rows {r0}-{r1}, columns {c0}-{c1} of {width} x {height}')
    # Whole rows, some 4 MB at a time and a dozen at once: a request takes the server a second
    # whatever its size, so rows one by one took an hour; the columns are cut out after.
    per_block = max(1, (4 << 20) // (width * bpp))
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
    INCLINATION: Hubble's q^2 = cos^2 i + q0^2 sin^2 i -- cos i for a thin one."""
    i = math.radians(INCLINATION)
    return math.sqrt(math.cos(i) ** 2 + flattening ** 2 * math.sin(i) ** 2)


def sky_of_disc(x_pc, y_pc, sq=None):
    """A point of the disc, pc along its major axis and towards its far side -> RA, Dec, degrees."""
    ce = squeeze(DUST_FLATTENING) if sq is None else sq
    me, mn = unit(MAJOR_PA)
    fe, fn = unit(FAR_PA)
    east = (x_pc * me + y_pc * ce * fe) / DISTANCE_PC
    north = (x_pc * mn + y_pc * ce * fn) / DISTANCE_PC
    # Inverse gnomonic about the centre.
    ra0, dec0 = math.radians(RA0), math.radians(DEC0)
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
    x = ((i + 0.5) / N * 2 - 1) * HALF_PC
    y = ((j + 0.5) / N * 2 - 1) * HALF_PC
    ra, dec = sky_of_disc(x, y, sq)
    row, col = pixel_of(wcs, ra, dec)
    inside = (row >= 0) & (row <= data.shape[0] - 1) & (col >= 0) & (col <= data.shape[1] - 1)
    out = ndimage.map_coordinates(data, [row, col], order=1, mode='constant', cval=0.0)
    return np.where(inside, out, 0.0) * sq, inside


SOURCES = [
    'PGC2557_w1_gauss7p5', 'PGC2557_w1_gauss7p5_stars', 'PGC2557_gauss7p5_galaxies',
    'PGC2557_fuv_gauss15', 'PGC2557_fuv_gauss15_stars', 'PGC2557_w4_gauss15', 'PGC2557_w4_gauss15_stars',
]


LOCAL_GROUP = HERE.parent.parent / 'web' / 'public' / 'data' / 'local-group.json'

# Leroy et al. 2008 (AJ 136, 2782), eq. D11: star formation, M_Sun/yr/kpc^2, from FUV and 24 um in MJy/sr.
SFR_PER_FUV = 8.1e-2
SFR_PER_24UM = 3.2e-3
# Where the star formation map ends, pc: 22 kpc, past the outer ring at 15 (Draine et al. 2014).
SFR_TO_PC = 22_000.0


def face_on_grid(sq):
    """The map's points, pc along the major axis (X) and towards the far side (Y), and each
    one's distance from the centre on the sky, pc."""
    j, i = np.mgrid[0:N, 0:N].astype(np.float64)
    x = ((i + 0.5) / N * 2 - 1) * HALF_PC
    y = ((j + 0.5) / N * 2 - 1) * HALF_PC
    return x, y, np.hypot(x, y * sq)


def other_galaxies(shape, wcs):
    """M32 and NGC 205, which lie on Andromeda's disc on the sky: four half-light radii about each."""
    catalog = json.loads(LOCAL_GROUP.read_text())
    bad = np.zeros(shape, bool)
    rows, cols = np.ogrid[0:shape[0], 0:shape[1]]
    for name in ('M32', 'NGC205'):
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
    bright = (face > 1.5 * median + 3 * noise) & (np.hypot(x, y * sq) > 2000)
    bright = ndimage.binary_dilation(bright, iterations=2)
    print(f'  {label}: {bright.mean() * 100:.2f} % of the map taken as compact sources')
    return np.where(bright, median, face)


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
    disc = np.exp(-r_disc[region] / SCALE_LENGTH_PC) / data
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
    disc = np.exp(-r_disc / SCALE_LENGTH_PC)
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


def main():
    maps = {name: fetch_cutout(Z0MGS + name + '.fits', name) for name in SOURCES}
    maps = {name: (data, {k: v for k, v in info.items() if k != 'unit'}) for name, (data, info) in maps.items()}

    print('old stars')
    old_sq, thin_sq = squeeze(OLD_FLATTENING), squeeze(DUST_FLATTENING)
    print(f'  squeezed to {old_sq:.3f} on the sky, the dust and young stars to {thin_sq:.3f}')
    w1 = without_points(face_on('PGC2557_w1_gauss7p5', maps, old_sq), old_sq, 'W1')
    shape = bulge_shape(w1, old_sq, 'W1')
    old = without_bulge(w1, shape, old_sq, 'W1')

    print('star formation')
    # The bulge's old stars shine in the far-UV and its dust at 22 um too: neither is star formation.
    fuv = without_bulge(face_on('PGC2557_fuv_gauss15', maps, thin_sq), shape, thin_sq, 'FUV')
    w4 = without_bulge(face_on('PGC2557_w4_gauss15', maps, thin_sq), shape, thin_sq, 'W4')
    # Past the outer ring, what the far-UV shows is foreground stars the masks missed, each drawn
    # out along the minor axis by the deprojection: none of it, from SFR_TO_PC out.
    x, y, _ = face_on_grid(thin_sq)
    r_disc = np.hypot(x, y)
    taper = np.clip((SFR_TO_PC - r_disc) / 2000, 0, 1)
    sfr = (SFR_PER_FUV * fuv + SFR_PER_24UM * w4) * taper * taper * (3 - 2 * taper)

    print('dust')
    dust_data, dust_wcs, _ = read_fits(fetch(PPMAP + 'm31_cdens_05sig.fits', 'm31_cdens_05sig.fits'))
    dust = resample(np.where(np.isfinite(dust_data) & (dust_data > 0), dust_data, 0.0), dust_wcs, thin_sq)[0]
    # Its noise, drawn out along Y, softened to a texel or so each way.
    dust = ndimage.gaussian_filter(dust, (1.5, 0.75))

    codes = [encode(old, BOUNDS['old']), encode(sfr, BOUNDS['sfr']), encode(dust, BOUNDS['dust'])]
    pixel_pc2 = (2 * HALF_PC / N) ** 2
    meta = dict(
        size=N,
        halfPc=HALF_PC,
        bounds=BOUNDS,
        oldSum=float(decode(codes[0], BOUNDS['old']).sum() * pixel_pc2),
        sfrSum=float(decode(codes[1], BOUNDS['sfr']).sum() * pixel_pc2 / 1e6),
    )
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.stack(codes, -1), 'RGB').save(OUT / 'm31.png', optimize=True)
    (OUT / 'm31.json').write_text(json.dumps(meta, indent=2) + '\n')
    for label, channel, bounds in zip(('old', 'sfr', 'dust'), (old, sfr, dust), BOUNDS.values()):
        positive = channel[channel > 0]
        print(f'  {label}: 1/50/99/99.9 % {np.percentile(positive, [1, 50, 99, 99.9])}, bounds {bounds}, '
              f'below {np.mean(positive < 10 ** bounds[0]) * 100:.1f} %, above {np.mean(positive > 10 ** bounds[1]) * 100:.2f} %')
    print('  total star formation', meta['sfrSum'], 'M_Sun/yr; written', OUT / 'm31.png')


if __name__ == '__main__':
    main()
