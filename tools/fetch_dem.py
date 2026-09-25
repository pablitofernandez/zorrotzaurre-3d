import math, urllib.request, os, concurrent.futures as cf
LAT0, LON0 = 43.267427, -2.956166
def tile(lat,lon,z):
    n=2**z; x=(lon+180)/360*n; y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n; return x,y
jobs=[]
for z,r in [(13,2),(15,2)]:
    x,y=tile(LAT0,LON0,z); print(z,x,y)
    for i in range(int(x)-r,int(x)+r+1):
        for j in range(int(y)-r,int(y)+r+1): jobs.append((z,i,j))
def get(a):
    z,i,j=a; fn=f'dem/{z}_{i}_{j}.png'
    if not os.path.exists(fn):
        urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{i}/{j}.png',fn)
    return fn
with cf.ThreadPoolExecutor(8) as ex: print(len(list(ex.map(get,jobs))))
