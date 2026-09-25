import math, json
import numpy as np
from PIL import Image

LAT0, LON0 = 43.267427, -2.956166
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574
PHI = math.radians(16.0)  # bearing of "up" (-Z) in the building plan
AX, AZ = 13.4, 9.0  # anchor point in the plan (centre of RD-15.1)
AE, AN = -28.0, 7.0  # ... and its E/N position in metres
C, S = math.cos(PHI), math.sin(PHI)


def ll2en(lat, lon):
    return (np.asarray(lon) - LON0) * KX, (np.asarray(lat) - LAT0) * KY


def en2plan(e, n):
    de = np.asarray(e) - AE
    dn = np.asarray(n) - AN
    return AX + de * C - dn * S, AZ - (de * S + dn * C)


def plan2en(x, z):
    dx = np.asarray(x) - AX
    dz = np.asarray(z) - AZ
    return AE + dx * C - dz * S, AN - dx * S - dz * C


def ll2plan(lat, lon):
    return en2plan(*ll2en(lat, lon))


def en2ll(e, n):
    return LAT0 + np.asarray(n) / KY, LON0 + np.asarray(e) / KX


# --- parcel plan (px) <-> EN
PP_S = 0.34
PP_B = math.radians(19.5)


def pp2en(x, y):
    dx = (np.asarray(x) - 1468) * PP_S
    dy = -(np.asarray(y) - 432) * PP_S
    cb, sb = math.cos(PP_B), math.sin(PP_B)
    return 106 + dx * cb + dy * sb, -75 - dx * sb + dy * cb


def en2pp(e, n):
    de = np.asarray(e) - 106
    dn = np.asarray(n) + 75
    cb, sb = math.cos(PP_B), math.sin(PP_B)
    dx = de * cb - dn * sb
    dy = de * sb + dn * cb
    return 1468 + dx / PP_S, 432 - dy / PP_S


# --- DEM Terrarium
def _mosaic(z, x0, x1, y0, y1):
    rows = []
    for j in range(y0, y1 + 1):
        rows.append(np.concatenate([np.asarray(Image.open(f'dem/{z}_{i}_{j}.png').convert('RGB')).astype(np.float64) for i in range(x0, x1 + 1)], 1))
    a = np.concatenate(rows, 0)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


class DEM:
    def __init__(self):
        self.m15 = (_mosaic(15, 16112, 16116, 12005, 12009), 15, 16112, 12005)
        self.m13 = (_mosaic(13, 4026, 4030, 2999, 3003), 13, 4026, 2999)

    @staticmethod
    def _tile(lat, lon, z):
        n = 2 ** z
        x = (lon + 180) / 360 * n
        y = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n
        return x, y

    def _sample(self, m, lat, lon):
        a, z, tx, ty = m
        x, y = self._tile(lat, lon, z)
        px = (x - tx) * 256 - 0.5
        py = (y - ty) * 256 - 0.5
        H, W = a.shape
        inside = (px >= 0) & (py >= 0) & (px < W - 1) & (py < H - 1)
        px = np.clip(px, 0, W - 1.001)
        py = np.clip(py, 0, H - 1.001)
        i, j = px.astype(int), py.astype(int)
        fx, fy = px - i, py - j
        v = a[j, i] * (1 - fx) * (1 - fy) + a[j, i + 1] * fx * (1 - fy) + a[j + 1, i] * (1 - fx) * fy + a[j + 1, i + 1] * fx * fy
        return v, inside

    def at_plan(self, x, z):
        e, n = plan2en(x, z)
        lat, lon = en2ll(e, n)
        v13, _ = self._sample(self.m13, lat, lon)
        v15, ins = self._sample(self.m15, lat, lon)
        return np.where(ins, v15, v13)


def load_osm(fn):
    return json.load(open(fn, encoding='utf8'))['elements']


def way_xz(geom):
    lat = np.array([p['lat'] for p in geom])
    lon = np.array([p['lon'] for p in geom])
    return np.stack(ll2plan(lat, lon), 1)


def assemble_rings(ways):
    """Join way fragments (Nx2 point arrays) into closed rings."""
    segs = [w.tolist() for w in ways if len(w) >= 2]
    rings = []
    key = lambda p: (round(p[0], 2), round(p[1], 2))
    while segs:
        cur = segs.pop()
        changed = True
        while key(cur[0]) != key(cur[-1]) and changed:
            changed = False
            for i, s in enumerate(segs):
                if key(s[0]) == key(cur[-1]):
                    cur += s[1:]
                elif key(s[-1]) == key(cur[-1]):
                    cur += s[::-1][1:]
                elif key(s[-1]) == key(cur[0]):
                    cur = s + cur[1:]
                elif key(s[0]) == key(cur[0]):
                    cur = s[::-1] + cur[1:]
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(cur) >= 4:
            rings.append(np.array(cur))
    return rings


def polygons(elements, pred):
    """Return (outer_rings, inner_rings, tags, id) for closed ways and multipolygons matching pred(tags)."""
    out = []
    for e in elements:
        t = e.get('tags', {})
        if not pred(t):
            continue
        if e['type'] == 'way' and 'geometry' in e:
            g = way_xz(e['geometry'])
            if len(g) >= 4 and np.allclose(g[0], g[-1]):
                out.append(([g], [], t, e['id']))
        elif e['type'] == 'relation':
            outer = [way_xz(m['geometry']) for m in e.get('members', []) if m['type'] == 'way' and m.get('role') in ('outer', '') and m.get('geometry')]
            inner = [way_xz(m['geometry']) for m in e.get('members', []) if m['type'] == 'way' and m.get('role') == 'inner' and m.get('geometry')]
            out.append((assemble_rings(outer), assemble_rings(inner), t, e['id']))
    return out
