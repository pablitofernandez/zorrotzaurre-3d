import json, math
import numpy as np
from PIL import Image
LAT0, LON0 = 43.267427, -2.956166
kx = 111320*math.cos(math.radians(LAT0)); ky = 110574
d=json.load(open('osm_near.json',encoding='utf8'))['elements']
img=np.asarray(Image.open('../../planoparcelas.png').convert('RGB')).astype(int)
H,W,_=img.shape
r,g,b=img[...,0],img[...,1],img[...,2]
mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b)
grey=((mx-mn)<18)&(mx>95)&(mx<205)
# dilate a bit
from scipy.ndimage import binary_dilation
grey=binary_dilation(grey,iterations=2)
pts=[]
for e in d:
    t=e.get('tags',{})
    if t.get('highway') in ('primary','secondary','tertiary','residential','living_street','unclassified') and 'bridge' not in t:
        gm=e['geometry']
        for a,bq in zip(gm,gm[1:]):
            e0,n0=(a['lon']-LON0)*kx,(a['lat']-LAT0)*ky
            e1,n1=(bq['lon']-LON0)*kx,(bq['lat']-LAT0)*ky
            L=math.hypot(e1-e0,n1-n0); k=max(1,int(L/2))
            for i in range(k):
                pts.append((e0+(e1-e0)*i/k,n0+(n1-n0)*i/k))
P=np.array(pts)
def score(ax,ay,s,bdeg):
    br=math.radians(bdeg)
    ux,uy=math.sin(br),math.cos(br); rx,ry=math.cos(br),-math.sin(br)
    de=P[:,0]-106; dn=P[:,1]+75
    x=ax+(de*rx+dn*ry)/s; y=ay-(de*ux+dn*uy)/s
    m=(x>=0)&(x<W)&(y>=150)&(y<1000)
    if m.sum()<200: return 0,0
    return grey[y[m].astype(int),x[m].astype(int)].mean(), m.sum()
best=(0,)
for s in np.arange(0.28,0.46,0.01):
  for bd in np.arange(14,36,1.0):
    for ax in range(1400,1560,8):
      for ay in range(400,540,8):
        sc,n=score(ax,ay,s,bd)
        if sc>best[0]: best=(sc,n,ax,ay,s,bd)
print(best)
sc,n,ax,ay,s,bd=best
for s2 in np.arange(s-0.01,s+0.011,0.0025):
  for bd2 in np.arange(bd-1,bd+1.01,0.25):
    for ax2 in range(ax-8,ax+9,2):
      for ay2 in range(ay-8,ay+9,2):
        sc2,n2=score(ax2,ay2,s2,bd2)
        if sc2>best[0]: best=(sc2,n2,ax2,ay2,s2,bd2)
print(best)
