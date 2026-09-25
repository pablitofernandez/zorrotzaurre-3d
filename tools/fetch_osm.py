import json, urllib.request, urllib.parse, sys
bbox = sys.argv[1]; out = sys.argv[2]; kind = sys.argv[3]
if kind == 'near':
    q = f"""[out:json][timeout:120];(way({bbox})["highway"];way({bbox})["building"];way({bbox})["natural"];way({bbox})["waterway"];relation({bbox})["natural"="water"];way({bbox})["landuse"];way({bbox})["leisure"];way({bbox})["bridge"];way({bbox})["railway"];way({bbox})["man_made"];relation({bbox})["building"];);out geom;"""
else:
    q = f"""[out:json][timeout:180];(way({bbox})["building"];relation({bbox})["building"];way({bbox})["natural"="water"];relation({bbox})["natural"="water"];way({bbox})["waterway"="riverbank"];way({bbox})["leisure"="park"];way({bbox})["landuse"~"grass|forest|meadow|recreation_ground"];way({bbox})["natural"~"wood|scrub"];way({bbox})["highway"~"motorway|trunk|primary|secondary|tertiary|residential|pedestrian"];);out geom;"""
req = urllib.request.Request((sys.argv[4] if len(sys.argv)>4 else 'https://overpass-api.de/api/interpreter'), data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'zorrotzaurre-3d/1.0', 'Accept': 'application/json'})
d = urllib.request.urlopen(req, timeout=300).read()
open(out, 'wb').write(d)
print(len(d), len(json.loads(d)['elements']))

