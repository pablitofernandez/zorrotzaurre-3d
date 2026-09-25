import json, math, sys
from PIL import Image, ImageDraw
S='prev_'  # preview images (ignored by git)
LAT0, LON0 = 43.267427, -2.956166
kx = 111320*math.cos(math.radians(LAT0)); ky = 110574
def en(p): return ((p['lon']-LON0)*kx, (p['lat']-LAT0)*ky)
d=json.load(open('osm_near.json',encoding='utf8'))['elements']
# params: anchor parcel px (ax,ay) <-> anchor EN (ae,an); m/px s; up bearing b (deg)
ax,ay,ae,an,s,b = map(float, sys.argv[1:7]); out=sys.argv[7]
br=math.radians(b)
ux,uy = math.sin(br), math.cos(br)      # up dir in EN
rx,ry = math.cos(br), -math.sin(br)     # right dir in EN
def P(e,n):
    de,dn=e-ae,n-an
    return (ax + (de*rx+dn*ry)/s, ay - (de*ux+dn*uy)/s)
img=Image.open('../../planoparcelas.png').convert('RGB')
ov=Image.new('RGBA',img.size,(0,0,0,0)); g=ImageDraw.Draw(ov)
for e in d:
    t=e.get('tags',{})
    gm=e.get('geometry')
    if not gm: continue
    pts=[P(*en(p)) for p in gm]
    if 'highway' in t and t['highway'] not in ('footway','service','cycleway','steps','path'):
        g.line(pts,fill=(0,0,255,255) if 'Galleteras' in t.get('name:es','') else (0,0,0,200),width=3)
    elif t.get('landuse')=='construction':
        g.line(pts+[pts[0]],fill=(255,0,255,255),width=2)
    elif 'building' in t:
        g.line(pts+[pts[0]],fill=(60,60,60,220),width=1)
img=Image.alpha_composite(img.convert('RGBA'),ov).convert('RGB')
img.crop((0,100,1920,1100)).save(S+out)
