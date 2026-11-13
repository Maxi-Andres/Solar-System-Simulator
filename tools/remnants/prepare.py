"""The supernova remnants' maps (web/public/remnants/): each picture -> its light on the sky.

    python tools/remnants/prepare.py [key ...]

Needs Python 3.11+, numpy, scipy and Pillow. Downloads its sources into tools/remnants/.cache/
(ignored by git) and writes the maps into web/public/remnants/; with keys, only those. The
recipe for each is remnants.json; what is done and why, web/public/remnants/CREDITS.md.

For each remnant, a 1024 x 1024 map, north up, east left, centred on Green's centre:

1. **Reprojected** from the picture's own astrometry -- the AVM a press image embeds, the WCS
   of a FITS file -- by the gnomonic projection both use; a wide picture smoothed first to the
   map's pixel.
2. **Sky taken off**: a low percentile of the frame, or of the pixels round each one
   (`localSky`) where the plates of a mosaic differ, or a quadratic surface through the sky
   round the remnant (`skyOutside`) where the picture's sky is a gradient; only over the
   picture's own data where it is set in a black frame (`footprint`).
3. **Stars taken out**: the faintest by a directional median -- a star is bright every way, a
   filament along itself; the rest where Gaia DR3 and Hipparcos put them, each one's size from
   its magnitude, fitted on the stars clear of the gas; filled from the light round them.
4. **Noise floor**, **faded out** past the remnant -- and inside the picture's own edge where
   it stops short (`edgeFadeArcmin`) -- **normalised**; a grey map where the
   picture is not in visible colours (the app colours it with the remnant's lines).

Cassiopeia A's 3D points (cas-a-points.bin) are DeLaney et al. 2010's surfaces, placed on the
sky by fitting them to its map (`cas_a_points`).
"""
import csv
import io
import json
import math
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage, signal

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'web' / 'public' / 'remnants'
CACHE = HERE / '.cache'
Image.MAX_IMAGE_PIXELS = 400_000_000
LUMA = np.array([0.2126, 0.7152, 0.0722])


# What each kind of source starts with: a busy server answers with a web page instead.
MAGIC = (b'SIMPLE  =', b'\xff\xd8', b'PK\x03\x04')


def fetch(url):
    """A source, downloaded once into the cache -- a real one: a busy server's page is retried."""
    CACHE.mkdir(exist_ok=True)
    name = urllib.parse.quote(url.split('://', 1)[1], safe='')[-150:]
    path = CACHE / name
    if path.exists() and not path.read_bytes()[:9].startswith(MAGIC):
        path.unlink()
    for attempt in range(6):
        if path.exists():
            return path
        request = urllib.request.Request(url, headers={'User-Agent': 'Solar-System-Simulator remnant maps'})
        data = urllib.request.urlopen(request, timeout=600).read()
        if data[:9].startswith(MAGIC):
            path.write_bytes(data)
        else:
            print('  not the file (%s), again in %d s' % (data[:80].decode('latin-1').strip().replace('\n', ' '), 30 * (attempt + 1)))
            time.sleep(30 * (attempt + 1))
    raise RuntimeError('could not fetch ' + url)


def tap(query, name):
    """A query to ESA's Gaia archive (asynchronous: the big ones time out otherwise), cached."""
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        body = urllib.parse.urlencode({'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'PHASE': 'RUN', 'QUERY': query}).encode()
        job = urllib.request.urlopen('https://gea.esac.esa.int/tap-server/tap/async', body, timeout=120).geturl()
        while True:
            phase = urllib.request.urlopen(job + '/phase', timeout=120).read().decode().strip()
            if phase in ('COMPLETED', 'ERROR', 'ABORTED'):
                break
            time.sleep(5)
        if phase != 'COMPLETED':
            raise RuntimeError('star query ' + phase)
        path.write_bytes(urllib.request.urlopen(job + '/results/result', timeout=600).read())
    return [list(map(float, row)) for row in list(csv.reader(open(path)))[1:] if all(row)]


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
    return np.nan_to_num(data), dict(ref=(head['CRVAL1'], head['CRVAL2']), pix=(head['CRPIX1'], head['CRPIX2']), cd=cd)


def encode(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)


def make(key, spec):
    N = spec['size']
    half = spec['halfArcmin'] / 60.0
    src = spec['source']

    # The map's grid: x to the west (east on the left), y north up; inverse gnomonic about the centre.
    ra0, dec0 = (math.radians(v) for v in spec['centre'])
    j, i = np.mgrid[0:N, 0:N].astype(np.float64)
    east = -((i + 0.5) / N * 2 - 1) * half
    north = (1 - (j + 0.5) / N * 2) * half
    xi = np.radians(east)
    eta = np.radians(north)
    r = np.hypot(xi, eta)
    c = np.arctan(r)
    with np.errstate(invalid='ignore', divide='ignore'):
        dec = np.arcsin(np.cos(c) * math.sin(dec0) + np.where(r > 0, eta * np.sin(c) * math.cos(dec0) / r, 0))
        ra = ra0 + np.arctan2(xi * np.sin(c), r * math.cos(dec0) * np.cos(c) - eta * math.sin(dec0) * np.sin(c))

    def on_map(sra, sdec):
        """Sky positions, degrees -> the map's pixel coordinates."""
        sra, sdec = np.radians(sra), np.radians(sdec)
        cosc = math.sin(dec0) * np.sin(sdec) + math.cos(dec0) * np.cos(sdec) * np.cos(sra - ra0)
        se = np.degrees(np.cos(sdec) * np.sin(sra - ra0) / cosc)
        sn = np.degrees((math.cos(dec0) * np.sin(sdec) - math.sin(dec0) * np.cos(sdec) * np.cos(sra - ra0)) / cosc)
        return (-se / half + 1) / 2 * N - 0.5, (1 - sn / half) / 2 * N - 0.5

    def pixel_of(wcs):
        """Each map pixel's place in a picture, FITS 1-based, y up."""
        rar, decr = (math.radians(v) for v in wcs['ref'])
        cosc = math.sin(decr) * np.sin(dec) + math.cos(decr) * np.cos(dec) * np.cos(ra - rar)
        pxi = np.degrees(np.cos(dec) * np.sin(ra - rar) / cosc)
        peta = np.degrees((math.cos(decr) * np.sin(dec) - math.sin(decr) * np.cos(dec) * np.cos(ra - rar)) / cosc)
        inv = np.linalg.inv(wcs['cd'])
        return wcs['pix'][0] + inv[0, 0] * pxi + inv[0, 1] * peta, wcs['pix'][1] + inv[1, 0] * pxi + inv[1, 1] * peta

    def sample(data, row, col, step):
        h, w = data.shape
        inside = (col >= 0) & (col <= w - 1) & (row >= 0) & (row <= h - 1)
        # A wide picture onto a smaller grid: smoothed first to the grid's pixel, so nothing aliases.
        data = ndimage.gaussian_filter(data, 0.5 * step) if step > 1.5 else data
        return ndimage.map_coordinates(data, [row, col], order=1, mode='constant', cval=0), inside

    if src['kind'] == 'avm':
        img = Image.open(fetch(src['image'])).convert('RGB')
        W, _ = img.size
        rw, rh = src['refDim']
        k = W / rw  # the file may be a resampled copy of the reference dimensions
        arr = np.asarray(img, dtype=np.float32) / 255.0
        lin = np.where(arr <= 0.04045, arr / 12.92, ((arr + 0.055) / 1.055) ** 2.4)
        if 'cd' in src:
            cd = np.array(src['cd'])
        else:
            rho = math.radians(src['rotationDeg'])
            s1, s2 = src['scale']
            cd = np.array([[s1 * math.cos(rho), -s2 * math.sin(rho)], [s1 * math.sin(rho), s2 * math.cos(rho)]])
        px, py = pixel_of(dict(ref=src['refValue'], pix=src['refPixel'], cd=cd))
        step = (2 * half / N) / (abs(np.linalg.det(cd)) ** 0.5 / k)
        out = np.zeros((N, N, 3))
        for ch in range(3):
            out[..., ch], inside = sample(lin[..., ch], (rh - py) * k, (px - 1) * k, step)  # JPEG rows run down
    else:
        def band(urls):
            total, inside_all = None, None
            for url in urls:
                data, wcs = read_fits(fetch(url))
                px, py = pixel_of(wcs)
                layer, inside = sample(data, py - 1, px - 1, (2 * half / N) / abs(np.linalg.det(wcs['cd'])) ** 0.5)
                total = layer if total is None else total + layer
                inside_all = inside if inside_all is None else inside_all & inside
            return total, inside_all

        if src['kind'] == 'fits-mono':
            grey, inside = band(src['files'])
            out = np.repeat(grey[..., None], 3, -1)
        else:
            red, inside = band(src['red'])
            blue, inside_blue = band(src['blue'])
            inside &= inside_blue
            # Two plates, red and blue: the green between them.
            out = np.stack([red, 0.5 * (red + blue), blue], -1)

    # The picture's own data, not its file's frame: a press image set square on a black field
    # (Kepler's, Hubble's field turned within it) counted that black as sky -- its low percentile
    # nothing, its noise nothing -- and the field's own sky and faint stars were kept, a square of
    # them. Where it holds light -- three display steps -- its holes closed, its rim's ringing left
    # out.
    if spec.get('footprint'):
        lum0 = out @ LUMA
        data = ndimage.binary_fill_holes(ndimage.binary_closing(lum0 > 3 / 255 / 12.92, iterations=4))
        inside = inside & ndimage.binary_erosion(data, iterations=4)
        print('  the picture covers %.0f%% of the map' % (inside.mean() * 100))

    # Sky background: a low percentile of the frame's own pixels, each channel -- or, where the
    # picture is a mosaic of plates whose skies differ, of the pixels round each one -- or, where
    # its sky is a gradient and the remnant fills most of it (the Crab's: red to one side, green
    # in a corner), a quadratic surface through the low percentiles of the sky round the remnant,
    # outside the ellipse `skyOutside` [semi-axes, arcmin, and the long one's position angle].
    if 'skyOutside' in spec:
        a_, b_, pa_ = spec['skyOutside']
        p_ = math.radians(pa_)
        u = (east * math.sin(p_) + north * math.cos(p_)) * 60
        v = (east * math.cos(p_) - north * math.sin(p_)) * 60
        sky = inside & ((u / a_) ** 2 + (v / b_) ** 2 > 1)
        B = 32
        rows, cols, levels = [], [], []
        for y0 in range(0, N, B):
            for x0 in range(0, N, B):
                block = sky[y0:y0 + B, x0:x0 + B]
                if block.mean() > 0.5:
                    rows.append(y0 + B / 2)
                    cols.append(x0 + B / 2)
                    levels.append(np.percentile(out[y0:y0 + B, x0:x0 + B][block], 20, axis=0))
        terms = lambda x, y: [np.ones_like(x), x, y, x * x, x * y, y * y]
        design = np.stack(terms(np.array(cols) / N - 0.5, np.array(rows) / N - 0.5), -1)
        coef, *_ = np.linalg.lstsq(design, np.array(levels), rcond=None)
        plane = np.stack(terms(i / N - 0.5, j / N - 0.5), -1) @ coef
        print('  sky: a quadratic surface through %d patches of it round the remnant, from %s to %s' % (
            len(rows), np.round(plane[inside].min(0) * 255, 2), np.round(plane[inside].max(0) * 255, 2)))
        out = np.clip(out - plane, 0, None)
    elif spec.get('localSky'):
        box = spec['localSky']
        for ch in range(3):
            small = ndimage.zoom(out[..., ch], 0.25, order=1)
            bg = ndimage.gaussian_filter(ndimage.percentile_filter(small, 20, size=max(3, box // 4)), box / 16)
            out[..., ch] -= ndimage.zoom(bg, N / small.shape[0], order=1)
        out = np.clip(out, 0, None)
    else:
        out = np.clip(out - np.percentile(out[inside], 20, axis=0), 0, None)
    # A survey whose noise is finer than its light (ROSAT's, SHASSA's): smoothed a little.
    if 'smooth' in spec:
        for ch in range(3):
            out[..., ch] = ndimage.gaussian_filter(out[..., ch], spec['smooth'])

    # The faintest stars, a pixel or two across: a star is bright in every direction, a filament
    # along itself, so the most a pixel can be is the brightest of the medians along four lines.
    if spec.get('pointStars', True):
        L = spec.get('lineLength', 7)
        lines = [np.ones((1, L)), np.ones((L, 1)), np.eye(L), np.fliplr(np.eye(L))]
        for ch in range(3):
            along = np.max([ndimage.median_filter(out[..., ch], footprint=fp.astype(bool)) for fp in lines], axis=0)
            out[..., ch] = np.minimum(out[..., ch], along)

    lum = out @ LUMA
    back = ndimage.median_filter(lum, size=41)
    res = lum - back
    # A star seen against what is right round it -- a filament under it too.
    near = lum - ndimage.median_filter(lum, size=9)
    noise = 1.4826 * np.median(np.abs(res[inside] - np.median(res[inside]))) + 1e-12
    mask = np.zeros_like(lum, bool)
    angles = np.linspace(0, 2 * np.pi, 16, endpoint=False)
    stars = 0
    whites = []
    circle = "1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',%f,%f,%f))" % (spec['centre'][0], spec['centre'][1], spec['halfArcmin'] * 1.45 / 60)
    bright = "SELECT ra, dec, hp_mag FROM public.hipparcos_newreduction WHERE hp_mag < 7 AND " + circle

    # Stars where Gaia DR3 puts them, and Hipparcos for the brightest, which Gaia misses.
    if 'gaiaLimit' in spec:
        cat = np.array(tap("SELECT ra, dec, phot_g_mean_mag FROM gaiadr3.gaia_source WHERE phot_g_mean_mag < %g AND %s" % (spec['gaiaLimit'], circle), key + '.gaia.csv')
                       + tap(bright, key + '.hip.csv'))
        cat = cat[np.argsort(cat[:, 2])]
        sx, sy = on_map(cat[:, 0], cat[:, 1])
        maxr = spec.get('maxStar', 60)
        spikes = spec.get('spikes')
        backc = np.stack([ndimage.median_filter(out[..., ch], size=41) for ch in range(3)], -1) if spec.get('balance') == 'stars' else None

        def profile(x, y, peak):
            for rr in range(1, maxr):
                vals = [res[int(round(y + rr * np.sin(a))), int(round(x + rr * np.cos(a)))] for a in angles
                        if 0 <= int(round(y + rr * np.sin(a))) < N and 0 <= int(round(x + rr * np.cos(a))) < N]
                if not vals or np.median(vals) < max(2 * noise, 0.03 * peak):
                    return rr
            return maxr

        def around(field, xi_, yi_):
            return field[max(0, yi_ - 1):yi_ + 2, max(0, xi_ - 1):xi_ + 2].max()

        # A star's size is its brightness's: measured on the stars in the dark between the
        # filaments, log size against magnitude fitted, and that size given to every star -- one
        # on a filament too, whose own profile the filament would stretch.
        placed, measured = [], []
        for x, y, g in zip(sx, sy, cat[:, 2]):
            if not (0 <= x < N and 0 <= y < N):
                continue
            xi_, yi_ = min(N - 1, int(round(x))), min(N - 1, int(round(y)))
            peak = around(res, xi_, yi_)
            placed.append((x, y, g, peak, around(near, xi_, yi_)))
            if peak > 5 * noise and back[yi_, xi_] < 2 * noise:
                measured.append((g, profile(x, y, peak)))
        measured = np.array(measured)
        bx, by = [], []
        for lo in np.arange(np.floor(measured[:, 0].min()), measured[:, 0].max() + 0.5, 0.5):
            sel = (measured[:, 0] >= lo) & (measured[:, 0] < lo + 0.5)
            if sel.sum() >= 3:
                bx.append(lo + 0.25)
                by.append(np.percentile(measured[sel, 1], 80))
        slope, icpt = np.polyfit(bx, np.log(by), 1)
        print('  star size %.2f px at G %g, x%.2f a magnitude, from %d stars' % (math.exp(icpt + slope * bx[0]), bx[0], math.exp(slope), len(measured)))
        for x, y, g, peak, above in placed:
            size = min(maxr, max(1.0, math.exp(icpt + slope * g)))
            if g < bx[0]:
                # Brighter than any star measured: its own profile, which no filament outshines.
                size = max(size, profile(x, y, peak))
            # A faint one only where it shows: not above what is round it, it is not there to take out.
            if size < 4 and above < 3 * noise:
                continue
            xi_, yi_ = min(N - 1, int(round(x))), min(N - 1, int(round(y)))
            stars += 1
            if backc is not None and 2 <= size <= 6 and back[yi_, xi_] < 2 * noise:
                whites.append(out[yi_, xi_] - backc[yi_, xi_])
            rad = size + 0.5 if size < 4 else 1.7 * size + 1
            R = int(math.ceil(rad * (4 if spikes and size > 4 else 1)))
            y0, y1, x0, x1 = max(0, yi_ - R), min(N, yi_ + R + 1), max(0, xi_ - R), min(N, xi_ + R + 1)
            yy, xx = np.ogrid[y0:y1, x0:x1]
            disc = (yy - y) ** 2 + (xx - x) ** 2 <= rad * rad
            if spikes and size > 4:
                # A Hubble picture's diffraction spikes, along its detector's axes.
                for a in spikes:
                    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
                    u = (xx - x) * ca + (yy - y) * sa
                    v = -(xx - x) * sa + (yy - y) * ca
                    w = 1.5 + 0.15 * size
                    disc = disc | ((np.abs(u) <= R) & (np.abs(v) <= w)) | ((np.abs(v) <= R) & (np.abs(u) <= w))
            mask[y0:y1, x0:x1] |= disc

    # A survey with its stars subtracted already (SHASSA's continuum-subtracted H-alpha) keeps
    # what the brightest leave behind: Hipparcos's, a fixed disc each.
    if 'brightRadius' in spec:
        for sra, sdec, hp in tap(bright, key + '.hip.csv'):
            x, y = on_map(sra, sdec)
            rad = spec['brightRadius'] * (1 + 0.25 * max(0, 5 - hp))
            yy, xx = np.ogrid[0:N, 0:N]
            mask |= (yy - y) ** 2 + (xx - x) ** 2 <= rad * rad
            stars += 1

    # Filled from the light round each star, the narrowest ring of it that has enough pixels.
    keep = (~mask).astype(np.float64)
    fill = np.zeros_like(out)
    for sigma in (12, 4, 1.5):
        den = ndimage.gaussian_filter(keep, sigma)
        for ch in range(3):
            num = ndimage.gaussian_filter(out[..., ch] * keep, sigma)
            layer = np.where(den > 1e-3, num / np.maximum(den, 1e-3), 0)
            fill[..., ch] = layer if sigma == 12 else np.where(den > 0.2, layer, fill[..., ch])
    out[mask] = fill[mask]
    if whites:
        # The stars' mean colour made white: a photographic plate's sensitivity is not the eye's.
        w = np.median(np.array(whites), axis=0)
        out = out * (w.max() / np.maximum(w, 1e-9))[None, None, :]

    # A star whose halo outreaches the fit, by hand: [ra, dec, radius arcmin].
    for sra, sdec, srad in spec.get('masks', []):
        d = np.degrees(np.arccos(np.clip(np.sin(dec) * math.sin(math.radians(sdec)) + np.cos(dec) * math.cos(math.radians(sdec)) * np.cos(ra - math.radians(sra)), -1, 1))) * 60
        hole = d < srad
        keep = (~hole).astype(np.float64)
        den = ndimage.gaussian_filter(keep, 20)
        for ch in range(3):
            out[..., ch] = np.where(hole, ndimage.gaussian_filter(out[..., ch] * keep, 20) / np.maximum(den, 1e-3), out[..., ch])

    # Line light over a field of stars too faint for Gaia: their light is white, the gas's is
    # coloured, so the grey part of each pixel -- its faintest channel -- taken out.
    if 'whiteOut' in spec:
        out = np.clip(out - spec['whiteOut'] * out.min(axis=-1, keepdims=True), 0, None)

    # The noise left in the dark between the filaments: a soft floor a few of its deviations up.
    if 'floor' in spec:
        lum = out @ LUMA
        t = spec['floor'] * 1.4826 * np.median(np.abs(lum[inside] - np.median(lum[inside])))
        out *= (np.clip(lum - t, 0, None) / np.maximum(lum, 1e-12))[..., None]

    # Only the remnant: a soft edge at maskArcmin from the centre.
    dist = np.hypot(east, north) * 60
    edge = np.clip((spec['maskArcmin'] * 1.15 - dist) / (spec['maskArcmin'] * 0.15), 0, 1)
    out *= (edge * edge * (3 - 2 * edge))[..., None]
    # And where the picture or the map ends short of that, faded to nothing over `edgeFadeArcmin`
    # inside the end: its straight side never shows.
    if 'edgeFadeArcmin' in spec:
        held = inside.copy()
        held[0, :] = held[-1, :] = held[:, 0] = held[:, -1] = False
        ramp = np.clip(ndimage.distance_transform_edt(held) * (2 * spec['halfArcmin'] / N) / spec['edgeFadeArcmin'], 0, 1)
        out *= (ramp * ramp * (3 - 2 * ramp))[..., None]
    out[~inside] = 0

    # Its bright end at `level`, then a power for a picture that was not linear.
    if 'level' in spec:
        top = np.percentile((out @ LUMA)[dist < spec['maskArcmin']], 99.7)
        out = np.clip(out / max(top, 1e-12), 0, None) ** spec.get('stretch', 1.0) * spec['level']

    pixels = (np.clip(encode(out @ LUMA if spec.get('mono') else out), 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(pixels, 'L' if spec.get('mono') else 'RGB').save(OUT / spec['out'])

    # A pulsar wind nebula's synchrotron share: its colour the median of the bluest tenth of the
    # bright pixels at its middle; each pixel's share the most of that colour it holds.
    if spec.get('continuum'):
        core = (dist < spec['maskArcmin'] * 0.5) & (out.sum(-1) > np.percentile(out.sum(-1), 70))
        blue = out[core]
        ratio = blue[:, 2] / np.maximum(blue[:, 0], 1e-6)
        S = np.median(blue[ratio >= np.percentile(ratio, 90)], axis=0)
        S = S / S.max()
        share = np.min(out / S[None, None, :], axis=-1)
        Image.fromarray((np.clip(encode(share), 0, 1) * 255 + 0.5).astype(np.uint8), 'L').save(OUT / spec['continuum'])
        print('  synchrotron colour', S.round(4).tolist(), '(supernovaRemnants.ts)')
    print('  %s: %d stars taken out, %.0f%% of the map covered' % (spec['out'], stars, 100 * inside.mean()))


def cas_a_points(spec):
    """
    DeLaney et al. 2010's surfaces of Cassiopeia A as points in its sky frame -- east, north,
    away from Earth, arcminutes from Green's centre -- 16-bit integers of 1/4096 arcminute.

    The surfaces (ASCII VTK) are Spitzer's [Ar II] and [Si II] -- the ejecta's main shell, where
    the optical knots are -- the outer optical knots and the jets. Their x is east, z north and y
    towards Earth (the south-east Fe-K lobe, blueshifted, has y > 0). Their scale and their
    offset on the sky are fitted here: projected, smoothed, and cross-correlated with the map.
    The depth is about the shell's own centre, a sphere fitted to it.
    """
    archive = zipfile.ZipFile(fetch(spec['url']))

    def surface(name):
        member = next(n for n in archive.namelist() if n.endswith(name + '-ascii.vtk'))
        toks = archive.read(member).decode('latin-1').split()
        i = toks.index('POINTS')
        n = int(toks[i + 1])
        return np.array(toks[i + 3:i + 3 + 3 * n], float).reshape(-1, 3)

    P = np.concatenate([surface(n) for n in spec['surfaces']])
    shell = np.concatenate([surface(n) for n in spec['shell']])
    centre = np.linalg.lstsq(np.c_[2 * shell, np.ones(len(shell))], (shell ** 2).sum(1), rcond=None)[0][:3]

    picture = np.asarray(Image.open(OUT / spec['map']).convert('L'), float) / 255
    N = picture.shape[0]
    half = spec['halfArcmin'] * 60
    small = 4
    pix = 2 * half / N * small
    target = ndimage.zoom(ndimage.gaussian_filter(picture ** 2.2, 6), 1 / small)
    target = (target - target.mean()) / target.std()
    M = target.shape[0]
    best = None
    for scale in np.arange(3.3, 4.0, 0.02):
        h, _, _ = np.histogram2d((half - P[:, 2] * scale) / pix, (half - P[:, 0] * scale) / pix, bins=M, range=[[0, M], [0, M]])
        h = ndimage.gaussian_filter(h, 1.5)
        h = (h - h.mean()) / (h.std() + 1e-9)
        cc = signal.fftconvolve(target, h[::-1, ::-1], mode='same') / target.size
        k = np.unravel_index(cc.argmax(), cc.shape)
        if best is None or cc.max() > best[0]:
            best = (cc.max(), scale, (M // 2 - k[1]) * pix, (M // 2 - k[0]) * pix)
    corr, scale, de, dn = best
    print('  fitted: %.2f arcsec a unit, offset %.1f" east %.1f" north, correlation %.2f' % (scale, de, dn, corr))
    sky = np.stack([P[:, 0] * scale + de, P[:, 2] * scale + dn, -(P[:, 1] - centre[1]) * scale], -1) / 60
    pick = np.random.default_rng(1).choice(len(P), size=min(spec['count'], len(P)), replace=False)
    np.round(sky[pick] * 4096).astype('<i2').tofile(OUT / spec['out'])
    print('  %s: %d points' % (spec['out'], len(pick)))


def main(keys):
    recipes = json.loads((HERE / 'remnants.json').read_text(encoding='utf-8'))
    for key, spec in recipes.items():
        if key.startswith('_') or (keys and key not in keys):
            continue
        print(key)
        if spec.get('kind') == 'points':
            cas_a_points(spec)
        else:
            make(key, spec)


if __name__ == '__main__':
    main(sys.argv[1:])
