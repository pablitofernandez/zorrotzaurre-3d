import json, math
from PIL import Image, ImageDraw, ImageFont
S='prev_'  # preview images (ignored by git)
LAT0, LON0 = 43.267427, -2.956166
kx = 111320*math.cos(math.radians(LAT0)); ky = 110574
def en(p): return ((p['lon']-LON0)*kx, (p['lat']-LAT0)*ky)
d=json.load(open('osm_near.json',encoding='utf8'))['elements']
W=1400; sc=4.0  # px/m -> 350 m window
img=Image.new('RGB',(W,W),'white'); g=ImageDraw.Draw(img)
def px(e,n): return (W/2+e*sc, W/2-n*sc)
f=ImageFont.load_default()
def geoms(e):
    if 'geometry' in e: yield e['geometry']
    for m in e.get('members',[]):
        if 'geometry' in m: yield m['geometry']
for e in d:
    t=e.get('tags',{})
    for gm in geoms(e):
        pts=[px(*en(p)) for p in gm if p]
        if len(pts)<2: continue
        if t.get('natural')=='water' or t.get('waterway') in ('riverbank','dock'):
            g.polygon(pts,fill=(170,200,230))
for e in d:
    t=e.get('tags',{})
    for gm in geoms(e):
        pts=[px(*en(p)) for p in gm if p]
        if len(pts)<2: continue
        if t.get('landuse')=='construction':
            g.polygon(pts,outline=(230,120,0),fill=(255,225,190)); g.text(pts[0],str(e['id'])[-4:],fill=(200,80,0),font=f)
        elif 'building' in t:
            g.polygon(pts,outline=(80,80,80),fill=(210,210,210) if t.get('construction')!='yes' else (255,200,200))
        elif 'highway' in t:
            col=(255,0,0) if 'Galleteras' in t.get('name:es','') else (120,120,120)
            g.line(pts,fill=col,width=3 if col[0]==255 else 1)
g.ellipse([W/2-5,W/2-5,W/2+5,W/2+5],fill='blue')
for i in range(-175,176,25):
    g.line([px(i,-175),px(i,175)],fill=(230,230,255)); g.line([px(-175,i),px(175,i)],fill=(230,230,255))
img.save(S+'osm_local.png')
