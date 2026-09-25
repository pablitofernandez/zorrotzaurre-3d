# Zorrotzaurre 3D — RD‑15.1 block, Punta Sur (Bilbao)

Interactive 3D web app of the RD‑15.1 residential block on Zorrotzaurre island (Bilbao) placed in its real surroundings, with a walkable, furnished recreation of its type “C” flat. The C flats share the same layout on every residential floor, so the floor to visit can be chosen (floors 1–9).

The UI is in Spanish.

## Features

- **Three modes:** *Edificio* (orbit around the block), *Planta* (dollhouse cut‑away of the flat) and *Recorrer* (first‑person walk with collisions).
- **Floor selector:** pick the floor of the C flat from the 🏢 menu, with `PageUp` / `PageDown`, or with the `?planta=N` URL parameter.
- **Adjustable field of view** inside the flat (👁️ slider next to the minimap, or `-` / `+`), remembered between visits.
- **Real context:** about 6,600 OpenStreetMap buildings, the estuary and the Deusto canal, bridges, quays, trees and terrain relief. The block is georeferenced from the island's parcel plan to within about ±10 m and ±5°.
- **Future parcels:** RD‑8, 11, 12, 13, 14, 16 and 17 are shown as translucent volumes. RD‑13 and RD‑14 have at most 7 storeys; the other heights are estimates.
- **Views:** landmark labels are hidden when walls or neighbouring buildings block the line of sight.
- **Sun:** a time‑of‑day slider moves the sun and its shadows.
- **Accessible:** keyboard control, screen‑reader announcements (`V` describes the current view), focus management, and support for reduced motion and high contrast.
- **Mobile‑first on iPhone:** safe areas, a bottom tab bar, a touch joystick and gyroscope look.

## Controls (walk mode)

| Action | Keys |
| --- | --- |
| Move / turn | `W` `A` `S` `D` / arrows, `Q` `E` |
| Look up / down | `R` `F`, or drag / click to capture the mouse |
| Run | `Shift` |
| Modes / help | `1` `2` `3` / `H` |
| Floor up / down | `PageUp` / `PageDown` |
| Field of view | `-` / `+` |
| Toggle labels / describe view | `L` / `V` |

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # single self-contained dist/index.html (vite-plugin-singlefile)
```

GitHub Pages serves the `gh-pages` branch, which holds the built `index.html`. To publish a new version, run `npm run deploy`. It builds the app and force-pushes `dist/` to `gh-pages`.

### Source layout

| Path | Contents |
| --- | --- |
| `src/main.js` | Orchestration: scene, modes, UI, accessibility, render loop |
| `src/building.js` | Parametric RD‑15.1 block (wings, floors, roof) |
| `src/unit.js`, `src/furniture.js`, `src/data/flat.js` | The flat: walls, openings, rooms, furniture |
| `src/walk.js`, `src/minimap.js` | First‑person controls (keyboard, mouse, touch, gyro) and minimap |
| `src/geo.js` | Real‑world context renderer (terrain, water, buildings, bridges, labels) |
| `src/materials.js`, `src/textures.js`, `src/geometry.js`, `src/context.js` | Materials, procedural textures, geometry helpers, sky |
| `tools/` | Offline Python pipeline that generates `src/data/geo.json` and `src/assets/*` |

### Regenerating the geographic data (optional)

The generated data is committed, so this step is only needed to change it. It requires Python 3 with `numpy`, `opencv-python`, `Pillow` and `scipy`.

```bash
cd tools
python fetch_osm.py <south,west,north,east> osm_near.json near   # OpenStreetMap extracts (Overpass API)
python fetch_osm.py <south,west,north,east> osm_far.json far
python fetch_dem.py       # Terrarium elevation tiles -> dem/
python build_geo.py       # -> ../src/data/geo.json, ../src/assets/*
```

The pipeline also needs the island's parcel plan image. Place it at `../planoparcelas.png`, in the folder that contains the repository. It is not included in the repository.

## Credits

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL.
- Elevation: Mapzen Terrarium tiles (AWS Terrain Tiles).
- 3D engine: [three.js](https://threejs.org/).

This is an unofficial project. The block volume, flat layout and furniture are approximate recreations and not the developer's official models.

