import json, urllib.request, urllib.parse
q = """[out:json][timeout:120];(node(43.18,-3.08,43.36,-2.82)["natural"="peak"]["name"];nwr(43.235,-3.00,43.30,-2.91)["name"~"San Mamés|Euskalduna|Guggenheim|Iberdrola|Universidad de Deusto|Deustuko Unibertsitatea|Zubizuri|Frank Gehry|Funicular de Artxanda|Artxanda|Kobetamendi|Bizkaia Arena|Torre Bizkaia|BEC|Isozaki|Hospital de Basurto|Basurtuko Ospitalea|Puente de Deusto|Deustuko zubia|Zorrotzaurre|Olabeaga|Bizkaia Aretoa|Museo de Bellas Artes|Arte Ederren|Rontegi|Mercado de la Ribera|Catedral|Kobeta|Bilbobus"]["name"];);out center tags;"""
req = urllib.request.Request('https://overpass.kumi.systems/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'zorrotzaurre-3d/1.0'})
d = json.loads(urllib.request.urlopen(req, timeout=200).read())
json.dump(d, open('osm_landmarks.json','w',encoding='utf8'), ensure_ascii=False)
for e in d['elements']:
    t=e['tags']; c=e.get('center',e)
    print(e['type'], round(c['lat'],5), round(c['lon'],5), t.get('name'), '|', t.get('ele',''), t.get('building',''), t.get('tourism',''), t.get('amenity',''), t.get('leisure',''), t.get('highway',''), t.get('bridge',''))
