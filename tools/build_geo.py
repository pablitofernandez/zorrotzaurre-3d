"""Generate the app's geographic assets: ground textures, water masks, heights,
buildings (OSM + parcel plan), bridges, quay walls, trees and landmarks."""
import math, json, base64, hashlib, re
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
import build_ground as G
from geo_common import *

A = '../src/assets/'
OUT = '../src/data/geo.json'
H0 = G.H0
WATER_Y = -3.2

# ---------------------------------------------------------------- ground textures and masks
masks = {}
for name in ('near', 'mid', 'far'):
    img, mask, res = G.draw_layer(name)
    Image.fromarray(img).save(A + f'ground_{name}.jpg', quality=80, optimize=True, progressive=False)
    Image.fromarray(mask).save(A + f'water_{name}.png', optimize=True)
    masks[name] = (mask, res, G.LAYERS[name]['half'])
    print('layer', name, 'ok')


def mask_at(x, z):
    """1 if water, using the most detailed layer available."""
    out = np.zeros(np.shape(x), np.float32)
    done = np.zeros(np.shape(x), bool)
    for name in ('near', 'mid', 'far'):
        m, res, half = masks[name]
        i = ((np.asarray(x) + half) / res).astype(int)
        j = ((np.asarray(z) + half) / res).astype(int)
        ok = ~done & (i >= 0) & (j >= 0) & (i < m.shape[1]) & (j < m.shape[0])
        out[ok] = m[j[ok], i[ok]] / 255.0
        done |= ok
    return out


# ---------------------------------------------------------------- heights
GRIDS = {'mid': dict(half=2048, n=513), 'far': dict(half=8192, n=257)}
SITE = (13.0, 9.0)


def height_field(X, Z):
    h = G.DEMO.at_plan(X, Z) - H0
    r = np.hypot(X - SITE[0], Z - SITE[1])
    w = np.clip((420 - r) / 250, 0, 1)
    w = w * w * (3 - 2 * w)
    h = h * (1 - w)
    h = np.maximum(h, -1.0)
    wat = mask_at(X, Z) > 0.5
    wat = ndi.binary_erosion(wat, iterations=1) if wat.ndim == 2 else wat
    h = np.where(wat, np.minimum(h, WATER_Y - 3), h)
    return h


hf = {}
for name, g in GRIDS.items():
    cs = np.linspace(-g['half'], g['half'], g['n'])
    X, Z = np.meshgrid(cs, cs)
    h = height_field(X, Z)
    hf[name] = (h, g)
    v = np.clip(np.round((h + 100) * 50), 0, 65535).astype(np.uint32)
    rgb = np.stack([(v >> 8) & 255, v & 255, np.zeros_like(v)], -1).astype(np.uint8)
    Image.fromarray(rgb).save(A + f'height_{name}.png', optimize=True)
    print('heights', name, h.min(), h.max())


def terrain(x, z):
    """Bilinear sampling identical to the app's (mid grid, then far)."""
    x = np.asarray(x, float)
    z = np.asarray(z, float)
    out = np.zeros(x.shape)
    done = np.zeros(x.shape, bool)
    for name in ('mid', 'far'):
        h, g = hf[name]
        step = 2 * g['half'] / (g['n'] - 1)
        fx = (x + g['half']) / step
        fz = (z + g['half']) / step
        ok = ~done & (fx >= 0) & (fz >= 0) & (fx < g['n'] - 1) & (fz < g['n'] - 1)
        i, j = fx[ok].astype(int), fz[ok].astype(int)
        ax, az = fx[ok] - i, fz[ok] - j
        out[ok] = h[j, i] * (1 - ax) * (1 - az) + h[j, i + 1] * ax * (1 - az) + h[j + 1, i] * (1 - ax) * az + h[j + 1, i + 1] * ax * az
        done |= ok
    return out


# ---------------------------------------------------------------- buildings
LANDMARK_H = [
    # (lat, lon, height, name)
    (43.26689, -2.93941, 165, 'Torre Iberdrola'),
    (43.26875, -2.93125, 83, 'Torres Isozaki'),
    (43.26659, -2.94406, 52, 'Palacio Euskalduna'),
    (43.26413, -2.94994, 52, 'San Mamés'),
    (43.26856, -2.93382, 50, 'Guggenheim'),
    (43.29016, -2.98914, 98, 'Torre BEC'),
]
TYPE_H = {
    'house': 8, 'detached': 8, 'semidetached_house': 8, 'terrace': 10, 'bungalow': 5, 'farm': 8, 'garage': 3.5, 'garages': 3.5, 'shed': 3,
    'roof': 5, 'carport': 3, 'kiosk': 3, 'hut': 3, 'service': 4, 'industrial': 11, 'warehouse': 10, 'manufacture': 11, 'retail': 10,
    'commercial': 16, 'office': 22, 'church': 20, 'cathedral': 28, 'chapel': 9, 'school': 13, 'university': 18, 'college': 15,
    'hospital': 30, 'train_station': 14, 'transportation': 10, 'sports_hall': 14, 'sports_centre': 14, 'stadium': 45, 'hotel': 25,
    'public': 18, 'civic': 16, 'government': 20, 'greenhouse': 4, 'construction': 12, 'parking': 10, 'bridge': 0, 'ruins': 4,
}


def num(s):
    m = re.match(r'\s*([0-9]+(?:[.,][0-9]+)?)', str(s))
    return float(m.group(1).replace(',', '.')) if m else None


def bld_height(t, area, id_):
    if 'height' in t and num(t['height']):
        return num(t['height'])
    if 'building:levels' in t and num(t['building:levels']) is not None:
        return num(t['building:levels']) * 3.1 + 1.5 + (0.5 if t.get('roof:shape', 'flat') != 'flat' else 0)
    b = t.get('building', 'yes')
    if b in TYPE_H:
        return TYPE_H[b]
    rnd = int(hashlib.md5(str(id_).encode()).hexdigest()[:4], 16) / 65535
    if area < 60:
        return 4 + 3 * rnd
    if area < 180:
        return 8 + 8 * rnd
    return 15 + 12 * rnd


def area_of(p):
    x, z = p[:, 0], p[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(z, 1)) - np.dot(z, np.roll(x, 1)))


def simplify(p, eps):
    c = cv2.approxPolyDP(p.astype(np.float32).reshape(-1, 1, 2), eps, True).reshape(-1, 2)
    return c.astype(float)


def pip(pt, poly):
    return cv2.pointPolygonTest(poly.astype(np.float32).reshape(-1, 1, 2), (float(pt[0]), float(pt[1])), False) >= 0


lm_pts = [(np.array(ll2plan(lat, lon)), h, n) for lat, lon, h, n in LANDMARK_H]

# footprint of the detailed RD-15.1 model (building plan coordinates)
MODEL_BOX = (-1.2, -17.0, 28.0, 35.0)


def overlaps_model(p, frac=0.25):
    x0, z0, x1, z1 = MODEL_BOX
    xs = np.linspace(p[:, 0].min(), p[:, 0].max(), 24)
    zs = np.linspace(p[:, 1].min(), p[:, 1].max(), 24)
    XX, ZZ = np.meshgrid(xs, zs)
    poly = p.astype(np.float32).reshape(-1, 1, 2)
    inside = np.array([cv2.pointPolygonTest(poly, (float(a), float(b)), False) >= 0 for a, b in zip(XX.ravel(), ZZ.ravel())])
    inbox = (XX.ravel() > x0) & (XX.ravel() < x1) & (ZZ.ravel() > z0) & (ZZ.ravel() < z1)
    return inside.sum() > 0 and (inside & inbox).sum() / inside.sum() > frac


buildings = []  # (pts Nx2, base, top, kind)  kind 0 = existing, 1 = new (parcel plan)
skipped_island = 0
for id_, (outer, inner, t) in G.bld_polys.items():
    for ring in outer:
        p = ring[:-1] if np.allclose(ring[0], ring[-1]) else ring
        if len(p) < 3:
            continue
        c = p.mean(0)
        d = np.hypot(*(c - np.array(SITE)))
        if max(abs(c[0]), abs(c[1])) > 8000:
            continue
        a = area_of(p)
        if a < (12 if d < 1500 else 60 if d < 4000 else 200):
            continue
        # on the new island, the parcel plan takes precedence
        if G.pp_sample(np.array([c[0]]), np.array([c[1]]))[0] in (1, 2, 3, 4, 5, 6, 7):
            skipped_island += 1
            continue
        if d < 60 and overlaps_model(p):
            continue
        h = bld_height(t, a, id_)
        for lp, lh, ln in lm_pts:
            if pip(lp, p):
                h = max(h, lh)
        if h <= 0.5:
            continue
        p = simplify(p, 0.5 if d < 1500 else 1.5 if d < 4000 else 4)
        if len(p) < 3:
            continue
        ts = terrain(p[:, 0], p[:, 1])
        base = ts.min() - 0.6
        top = terrain(np.array([c[0]]), np.array([c[1]]))[0] + h
        buildings.append((p, base, top, 0))
print('OSM buildings', len(buildings), 'skipped on the island', skipped_island)

# ---- parcel plan buildings (class 7 components)
cls7 = (G.pp_cls == 7).astype(np.uint8)
cls7 = cv2.morphologyEx(cls7, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
cnts, _ = cv2.findContours(cls7, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
rd152 = None
n_plan_blds = 0
# heights (ground floor 4.20 m + 3.05 m per floor + ~1 m parapet)
lvl = lambda n: 4.2 + (n - 1) * 3.05
H_BLOCK = lvl(10) + 0.3  # ground floor + 9 floors, like RD-15.1
# future development parcels: translucent volume
# (centroid in parcel-plan pixels -> parcel, number of floors)
GHOSTS = {
    (695, 287): ('RD-13', 7), (783, 308): ('RD-14', 7), (887, 322): ('RD-14', 7),
    (1356, 372): ('RD-16', 10), (1651, 393): ('RD-17', 10),
    (603, 501): ('RD-11', 10), (724, 514): ('RD-11', 10),
    (903, 542): ('RD-12', 10), (1127, 542): ('RD-12', 10),
    (1646, 582): ('RD-8', 10),
}
parcels = {}
for c in cnts:
    if cv2.contourArea(c) < 250:
        continue
    pc = c.reshape(-1, 2).mean(0)
    ghost = next((v for k, v in GHOSTS.items() if math.hypot(k[0] - pc[0], k[1] - pc[1]) < 25), None)
    c = cv2.approxPolyDP(c, 2.0, True).reshape(-1, 2).astype(float)
    e, n = pp2en(c[:, 0], c[:, 1])
    X, Z = en2plan(e, n)
    p = np.stack([X, Z], 1)
    if overlaps_model(p, 0.2):
        continue
    cen = p.mean(0)
    top = H_BLOCK
    if 28 < cen[0] < 100 and abs(cen[1] - SITE[1]) < 45:
        rd152 = [round(float(cen[0]), 1), round(float(cen[1]), 1)]
    kind = 1
    if ghost:
        name, floors = ghost
        top = lvl(floors) + 0.5  # floors = 7 storeys (ground + 6) -> ~23 m
        kind = 2
        a = area_of(p)
        acc = parcels.setdefault(name, [0.0, 0.0, 0.0, top])
        acc[0] += cen[0] * a; acc[1] += cen[1] * a; acc[2] += a
    buildings.append((p, -0.6, top, kind))
    n_plan_blds += 1
print('parcel plan buildings', n_plan_blds, 'RD-15.2 at', rd152)
parcel_labels = [[k, round(v[0] / v[2], 1), round(v[3] + 3, 1), round(v[1] / v[2], 1), int(round((v[3] - 0.5 - 4.2) / 3.05)) + 1] for k, v in parcels.items()]
print('translucent parcels', parcel_labels)

# ---- encoding: per building [n, base_dm, top_dm, kind] + points in quarter metres
meta, pts = [], []
for p, base, top, kind in buildings:
    q = np.round(p * 4).astype(np.int32)
    if np.abs(q).max() > 32767:
        continue
    meta += [len(q), int(round(base * 10)), int(round(top * 10)), kind]
    pts.append(q.astype(np.int16).ravel())
pts = np.concatenate(pts).astype('<i2')
meta = np.array(meta, '<i2')

# ---------------------------------------------------------------- bridges
bridges = []  # [width, y, x0,z0,x1,z1,...]
for src in (G.near_el, G.far_el):
    for e in src:
        t = e.get('tags', {})
        if e['type'] != 'way' or t.get('bridge') in (None, 'no') or 'geometry' not in e:
            continue
        hw = t.get('highway')
        if hw not in G.ROAD_W and t.get('railway') not in ('rail', 'light_rail', 'tram'):
            continue
        p = way_xz(e['geometry'])
        if np.abs(p).max() > 7000:
            continue
        L = np.hypot(*np.diff(p, axis=0).T).sum()
        if L < 15:
            continue
        w = G.ROAD_W.get(hw, 8)
        if np.hypot(*(p.mean(0) - np.array(SITE))) > 2500 and w < 6:
            continue
        ends = terrain(p[[0, -1], 0], p[[0, -1], 1])
        y = float(max(ends.max(), 0.3)) + 0.2
        bridges.append([round(w, 1), round(y, 2)] + [round(float(v), 1) for v in p.ravel()])
bridges_poly = []
for o in G.bridge_polys:
    for r in o:
        p = r[:-1]
        if np.abs(p).max() > 7000:
            continue
        ts = terrain(p[:, 0], p[:, 1])
        land = mask_at(p[:, 0], p[:, 1]) < 0.5
        y = float(np.max(ts[land])) if land.any() else 0.5
        bridges_poly.append([round(max(y, 0.3) + 0.25, 2)] + [round(float(v), 1) for v in p.ravel()])
print('bridges', len(bridges), len(bridges_poly))

# ---------------------------------------------------------------- quay walls (water edges)
walls = []
for name, eps in (('near', 1.0), ('mid', 1.0)):
    m, res, half = masks[name]
    cn, _ = cv2.findContours((m > 128).astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for c in cn:
        if len(c) < 4:
            continue
        c = cv2.approxPolyDP(c, eps, True).reshape(-1, 2).astype(float)
        p = (c + 0.5) * res - half
        if name == 'mid':
            # avoid duplicating the stretch already covered by the near layer
            inn = (np.abs(p[:, 0]) < 500) & (np.abs(p[:, 1]) < 500)
            if inn.all():
                continue
        # drop bbox edges
        edge = (np.abs(p[:, 0]) > half - 2 * res) | (np.abs(p[:, 1]) > half - 2 * res)
        p = p[~edge]
        if len(p) < 2:
            continue
        walls.append([round(float(v), 1) for v in np.vstack([p, p[:1]]).ravel()])
print('quay walls', len(walls), sum(len(w) for w in walls) // 2)

# ---------------------------------------------------------------- trees from the plan (circular symbols)
trees = []
raw = G.pp_med.astype(int)
sat = raw.max(2) - raw.min(2)
cand = (sat > 90).astype(np.uint8)
n_l, lab, stats, cents = cv2.connectedComponentsWithStats(cand)
for k in range(1, n_l):
    x, y, w, h, a = stats[k]
    if 7 <= w <= 24 and 7 <= h <= 24 and 0.6 < w / h < 1.6 and a > 0.55 * w * h:
        cx, cy = cents[k]
        if G.pp_cls[int(cy), int(cx)] == 0 and not (0 < G.pp_cls[int(cy), int(cx)]):
            pass
        if cy < 140 or (cy > 950 and cx > 1440):
            continue
        e, n = pp2en(cx, cy)
        X, Z = en2plan(e, n)
        if overlaps_model(np.array([[X - 1, Z - 1], [X + 1, Z - 1], [X + 1, Z + 1], [X - 1, Z + 1]]), 0.5):
            continue
        trees.append([round(float(X), 1), round(float(Z), 1)])
print('trees', len(trees))

# ---------------------------------------------------------------- landmarks (labels)
LANDMARKS = [
    ('San Mamés', 43.26413, -2.94994, 50, 1),
    ('Palacio Euskalduna', 43.26659, -2.94406, 40, 1),
    ('Torre Iberdrola', 43.26689, -2.93941, 165, 1),
    ('Guggenheim', 43.26856, -2.93382, 45, 1),
    ('Universidad de Deusto', 43.27083, -2.93884, 30, 1),
    ('Puente Frank Gehry', 43.26745, -2.95420, 12, 1),
    ('Puente Euskalduna', 43.26720, -2.94740, 14, 0),
    ('Hospital de Basurto', 43.26150, -2.95260, 30, 0),
    ('Olabeaga', 43.26430, -2.95680, 20, 0),
    ('Kobetamendi', 43.25540, -2.96170, 8, 1),
    ('Monte Artxanda', 43.27870, -2.92570, 8, 1),
    ('Funicular de Artxanda', 43.27406, -2.92017, 10, 0),
    ('Abando', 43.26001, -2.92833, 25, 0),
    ('Casco Viejo', 43.25740, -2.92360, 20, 0),
    ('Pagasarri', 43.22270, -2.92950, 8, 1),
    ('Ganekogorta', 43.20450, -2.95560, 8, 1),
    ('Torre BEC · Barakaldo', 43.29016, -2.98914, 98, 0),
    ('Canal de Deusto', 43.26960, -2.95300, 4, 0),
    ('Ría de Bilbao', 43.26300, -2.96250, 4, 0),
    ('Zorrotza', 43.27400, -2.97000, 20, 0),
    ('San Ignacio', 43.27900, -2.95700, 25, 0),
    ('Deusto', 43.27250, -2.94700, 25, 0),
    ('Monte Avril', 43.28030, -2.90750, 8, 0),
]
labels = []
for name, lat, lon, dh, major in LANDMARKS:
    X, Z = ll2plan(lat, lon)
    y = float(terrain(np.array([X]), np.array([Z]))[0]) if max(abs(X), abs(Z)) < 8000 else G.DEMO.at_plan(np.array([X]), np.array([Z]))[0] - H0
    labels.append([name, round(float(X), 1), round(max(float(y), 0) + dh, 1), round(float(Z), 1), major])

# true bearing (degrees) from the flat centre
flat_center = np.array([4.0, 8.0])
for l in labels:
    e, n = plan2en(l[1], l[3])
    fe, fn = plan2en(*flat_center)
    l.append(round(math.degrees(math.atan2(e - fe, n - fn)) % 360))
    l.append(round(math.hypot(e - fe, n - fn)))

geo = {
    'north': round(math.degrees(PHI), 2),
    'waterY': WATER_Y,
    'grids': {k: {'half': g['half'], 'n': g['n']} for k, g in GRIDS.items()},
    'layers': {k: {'half': v['half']} for k, v in G.LAYERS.items()},
    'rd152': rd152,
    'meta': base64.b64encode(meta.tobytes()).decode(),
    'pts': base64.b64encode(pts.tobytes()).decode(),
    'bridges': bridges,
    'bridgePolys': bridges_poly,
    'walls': walls,
    'trees': trees,
    'labels': labels,
    'parcels': parcel_labels,
}
s = json.dumps(geo, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w', encoding='utf8').write(s)
print('geo.json', len(s) // 1024, 'KB')
