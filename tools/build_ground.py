import math, json, gzip, base64, struct, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from geo_common import *

OUT_ASSETS = '../src/assets/'
OUT_DATA = '../src/data/'

near_el = load_osm('osm_near.json')
far_el = load_osm('osm_far.json')

LAYERS = {
    'near': dict(half=512, px=2048),
    'mid': dict(half=2048, px=2048),
    'far': dict(half=8192, px=1024),
}

# ---------------------------------------------------------------- OSM data collection
def is_water(t):
    return t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t.get('water') in ('river', 'canal')


def green_kind(t):
    lu, le, na = t.get('landuse'), t.get('leisure'), t.get('natural')
    if lu in ('forest',) or na in ('wood',):
        return 'forest'
    if na in ('scrub', 'heath'):
        return 'scrub'
    if lu in ('meadow', 'farmland', 'orchard', 'vineyard'):
        return 'meadow'
    if lu in ('grass', 'recreation_ground', 'village_green') or le in ('park', 'garden', 'playground', 'pitch', 'golf_course'):
        return 'park'
    return None


water_el = load_osm('osm_water.json')
water_polys = polygons(far_el, is_water) + polygons(near_el, is_water) + polygons(water_el, is_water)
coast = [way_xz(e['geometry']) for e in water_el if e['type'] == 'way' and e.get('tags', {}).get('natural') == 'coastline']
bridge_polys = [o for o, i, t, _ in polygons(water_el, lambda t: t.get('man_made') == 'bridge')]


def coast_mask(n, x0, res):
    """Estuary water from coastlines (water lies to the right of the way direction)."""
    bar = np.zeros((n, n), np.uint8)
    for c in coast:
        cv2.polylines(bar, [to_px(c, x0, res)], False, 1, 1, shift=2)
    bar = cv2.dilate(bar, np.ones((2, 2), np.uint8))
    # clip to the downloaded bbox (the coastline continues beyond it)
    lat, lon = np.array([43.2385, 43.2385, 43.2965, 43.2965]), np.array([-2.9960, -2.9165, -2.9165, -2.9960])
    bb = np.stack(ll2plan(lat, lon), 1)
    inside = np.zeros((n, n), np.uint8)
    fill(inside, [bb], 1, x0, res)
    bar[inside == 0] = 1
    cv2.polylines(bar, [to_px(np.vstack([bb, bb[:1]]), x0, res)], False, 1, 2, shift=2)
    lab, nl = ndi.label(bar == 0)
    votes = np.zeros(nl + 1)
    for c in coast:
        d = np.diff(c, axis=0)
        L = np.hypot(d[:, 0], d[:, 1]) + 1e-9
        nrm = np.stack([-d[:, 1], d[:, 0]], 1) / L[:, None]  # left side in X-right/Z-down top-view coords
        mid = (c[:-1] + c[1:]) / 2
        off = max(3 * res, 2.0)
        # In plan view (X right, Z down) the geographic "right" of the travel direction is -nrm
        for sgn, v in ((1, 1), (-1, -1)):
            p = mid + sgn * nrm * off
            px = ((p - x0) / res).astype(int)
            ok = (px[:, 0] >= 0) & (px[:, 1] >= 0) & (px[:, 0] < n) & (px[:, 1] < n)
            ids = lab[px[ok, 1], px[ok, 0]]
            np.add.at(votes, ids, v)
    votes[0] = 0
    water = votes[lab] > 0
    water = water | (cv2.dilate(water.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (bar > 0))
    return (water * 255).astype(np.uint8)
green_polys = [(o, i, t, id_) for (o, i, t, id_) in polygons(far_el, lambda t: green_kind(t) is not None) + polygons(near_el, lambda t: green_kind(t) is not None)]
bld_polys = {}
for src in (far_el, near_el):
    for o, i, t, id_ in polygons(src, lambda t: 'building' in t and t.get('building') not in ('no',) and t.get('location') != 'underground' and not str(t.get('layer', '0')).startswith('-')):
        bld_polys[id_] = (o, i, t)
print('water', len(water_polys), 'green', len(green_polys), 'buildings', len(bld_polys))

ROAD_W = {
    'motorway': 16, 'trunk': 14, 'primary': 13, 'secondary': 11, 'tertiary': 9, 'motorway_link': 7, 'trunk_link': 7, 'primary_link': 7,
    'secondary_link': 7, 'tertiary_link': 7, 'residential': 7, 'unclassified': 6, 'living_street': 6, 'service': 4, 'pedestrian': 6,
    'footway': 2.5, 'cycleway': 2.5, 'path': 1.5, 'steps': 2,
}
roads = {}
for src in (far_el, near_el):
    for e in src:
        t = e.get('tags', {})
        hw = t.get('highway')
        if e['type'] == 'way' and hw in ROAD_W and 'geometry' in e and t.get('tunnel') not in ('yes', 'building_passage') and t.get('area') != 'yes':
            roads[e['id']] = (way_xz(e['geometry']), hw, t)
rails = []
for e in near_el:
    t = e.get('tags', {})
    if e['type'] == 'way' and t.get('railway') in ('rail', 'light_rail', 'tram', 'subway') and 'geometry' in e and t.get('tunnel') != 'yes':
        rails.append((way_xz(e['geometry']), t.get('railway'), t))
print('roads', len(roads), 'rails', len(rails))

# ---------------------------------------------------------------- parcel plan (future of the island)
pp = np.asarray(Image.open('../../planoparcelas.png').convert('RGB'))
pp_med = cv2.medianBlur(pp, 5)
PPH, PPW, _ = pp.shape


def classify_pp(rgb):
    r, g, b = [rgb[..., k].astype(int) for k in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    cls = np.zeros(r.shape, np.uint8)  # 0 = no data
    grey = (mx - mn < 20) & (mx > 120) & (mx < 215)
    cls[grey] = 1  # roadway
    cls[(r > 235) & (g > 225) & (b > 190) & (b < 235) & (mx - mn > 12)] = 2  # beige sidewalk
    cls[(g > r + 25) & (g > b + 25)] = 3  # green (lawn / green parcel)
    cls[(b > r + 60) & (b > 200)] = 4  # blue (parcels)
    cls[(r > 200) & (r > b + 60) & (g < 200)] = 5  # orange (parcels)
    cls[(r > 200) & (g < 60) & (b < 60)] = 6  # red (bike lane / trees)
    dark = ((b > 200) & (g < 130) & (r < 40)) | ((r > 230) & (g < 125) & (g > 80) & (b < 30)) | ((g > 230) & (r < 30) & (b < 30))
    cls[dark] = 7  # building
    return cls


pp_cls = classify_pp(pp_med)
# outside the drawn area: legend and compass
pp_cls[950:1230, 1440:1770] = 0
pp_cls[1100:1220, 180:300] = 0
pp_cls[:140, :] = 0
# labels and logos (dark text): fill with the nearest neighbouring class
_mx = pp_med.max(2).astype(int)
_txt = cv2.dilate((_mx < 140).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
_src = (pp_cls > 0) & ~_txt
_, (iy, ix) = ndi.distance_transform_edt(~_src, return_indices=True)
_dist = ndi.distance_transform_edt(~_src)
_fillable = _txt & (_dist < 14)
pp_cls[_fillable] = pp_cls[iy[_fillable], ix[_fillable]]


def pp_sample(X, Z):
    e, n = plan2en(X, Z)
    x, y = en2pp(e, n)
    xi, yi = np.round(x).astype(int), np.round(y).astype(int)
    ok = (xi >= 0) & (yi >= 0) & (xi < PPW) & (yi < PPH)
    cls = np.zeros(X.shape, np.uint8)
    cls[ok] = pp_cls[yi[ok], xi[ok]]
    return cls


# ---------------------------------------------------------------- rasterisation
PAL = {
    'urban': (178, 172, 162), 'rural': (106, 128, 80), 'park': (118, 146, 84), 'forest': (70, 94, 56), 'scrub': (104, 120, 78),
    'meadow': (134, 152, 92), 'water': (52, 80, 92), 'road': (92, 94, 97), 'path': (186, 180, 168), 'bld': (140, 136, 130),
    'rail': (118, 110, 100), 'sidewalk': (205, 198, 186), 'patio': (164, 172, 140), 'bike': (150, 96, 84),
}


def to_px(pts, x0, res):
    return np.round((pts - x0) / res * 4).astype(np.int32)  # shift = 2


def fill(img, rings, color, x0, res):
    if not rings:
        return
    cv2.fillPoly(img, [to_px(r, x0, res) for r in rings], color, lineType=cv2.LINE_AA, shift=2)


DEMO = DEM()
H0 = float(DEMO.at_plan(np.array([13.0]), np.array([9.0]))[0])


def water_mask(n, x0, res):
    mask = np.zeros((n, n), np.uint8)
    for o, i, t, _ in water_polys:
        fill(mask, o, 255, x0, res)
    for o, i, t, _ in water_polys:
        fill(mask, i, 0, x0, res)
    return np.maximum(mask, coast_mask(n, x0, res))


def draw_layer(name):
    L = LAYERS[name]
    half, n = L['half'], L['px']
    res = 2 * half / n
    x0 = -half
    img = np.zeros((n, n, 3), np.uint8)
    cs = (np.arange(n) + 0.5) * res + x0
    X, Z = np.meshgrid(cs, cs)
    elev = DEMO.at_plan(X, Z) - H0
    # urban density -> urban / rural blend
    dens = np.zeros((n, n), np.float32)
    for o, i, t in bld_polys.values():
        fill(dens, o, 1.0, x0, res)
    sig = max(1.0, 45 / res)
    dens = cv2.GaussianBlur(dens, (0, 0), sig)
    u = np.clip(dens * 3.0, 0, 1)[..., None]
    r = np.clip((elev - 18) / 45, 0, 1)[..., None]
    low = np.array([152, 150, 134], np.float32)
    base = low * (1 - r) + np.array(PAL['rural'], np.float32) * r
    base = base * (1 - u) + np.array(PAL['urban'], np.float32) * u
    rng = np.random.default_rng(1)
    noise = cv2.GaussianBlur(rng.normal(0, 1, (n, n)).astype(np.float32), (0, 0), 2.0)
    noise /= noise.std() + 1e-6
    base *= (1 + 0.035 * noise)[..., None]
    img[:] = np.clip(base, 0, 255).astype(np.uint8)
    for kind in ('meadow', 'park', 'scrub', 'forest'):
        rings_o = [r for o, i, t, _ in green_polys if green_kind(t) == kind for r in o]
        fill(img, rings_o, PAL[kind], x0, res)
    # roads
    for pts, hw, t in sorted(roads.values(), key=lambda r: ROAD_W[r[1]]):
        w = ROAD_W[hw]
        if w / res < 0.6:
            continue
        col = PAL['path'] if hw in ('pedestrian', 'footway', 'cycleway', 'path', 'steps') else PAL['road']
        cv2.polylines(img, [to_px(pts, x0, res)], False, col, max(1, int(round(w / res))), lineType=cv2.LINE_AA, shift=2)
    for pts, kind, t in rails:
        cv2.polylines(img, [to_px(pts, x0, res)], False, PAL['rail'], max(1, int(round(3 / res))), lineType=cv2.LINE_AA, shift=2)
    for o, i, t in bld_polys.values():
        fill(img, o, PAL['bld'], x0, res)
    # water (mask); the far layer is computed at higher resolution so the estuary isn't lost
    if name == 'far':
        mask = cv2.resize(water_mask(n * 4, x0, res / 4), (n, n), interpolation=cv2.INTER_AREA)
    else:
        mask = water_mask(n, x0, res)
    # future island (parcel plan)
    if name in ('near', 'mid'):
        cls = pp_sample(X, Z)
        cls[mask > 128] = 0
        colors = {1: PAL['road'], 2: PAL['sidewalk'], 3: PAL['park'], 4: PAL['patio'], 5: PAL['patio'], 6: PAL['bike'], 7: PAL['bld']}
        for k, col in colors.items():
            sel = cls == k
            img[sel] = (np.array(col) * (1 + 0.04 * noise[sel][:, None])).clip(0, 255)
    gy, gx = np.gradient(elev, res)
    shade = np.clip(1 + (-gx * 0.55 + gy * 0.55) * 0.5, 0.8, 1.15)
    img = np.clip(img * shade[..., None], 0, 255).astype(np.uint8)
    img[mask > 128] = PAL['water']
    return img, mask, res


if __name__ == '__main__':
    for name in ('near', 'mid', 'far'):
        img, mask, res = draw_layer(name)
        Image.fromarray(img).save(f'prev_{name}.png')
        np.save(f'mask_{name}.npy', mask)
        print(name, res)
