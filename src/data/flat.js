// Type "C" flat – geometry measured on the floor plan (graphic scale 0-1-2-5 m).
// The same layout repeats on every residential floor of wing W1.
// Plan coordinate system (metres): X to the right (≈ east), Z downwards (≈ south).
// Plan north points towards -Z (slightly rotated to the left).

export const WALL_H = 2.75; // up to the underside of the slab above
export const CEIL_H = 2.6; // false ceiling
export const DOOR_H = 2.1;
export const WIN_HEAD = 2.45;

// Walls [x0, z0, x1, z1, type]  type: 'e' structure/facade, 'i' partition
export const WALLS = [
  // --- perimeter / structure
  [1.6, 0.03, 9.26, 0.3, 'e'],
  [1.6, 0.3, 2.4, 0.59, 'e'],
  [1.6, 0.59, 1.94, 1.07, 'e'],
  [1.6, 3.07, 1.94, 4.17, 'e'],
  [1.6, 5.77, 2.59, 7.1, 'e'],
  [2.26, 7.1, 2.59, 7.31, 'e'],
  [2.26, 8.5, 2.59, 8.97, 'e'],
  [2.45, 11.65, 2.59, 11.85, 'e'],
  [2.1, 13.02, 2.59, 14.12, 'e'],
  [2.59, 13.83, 9.53, 14.12, 'e'],
  [7.7, 13.57, 9.53, 13.83, 'e'],
  [9.05, 0.03, 9.26, 7.33, 'e'],
  [9.26, 7.33, 9.46, 7.54, 'e'],
  [10.38, 7.33, 10.8, 7.54, 'e'],
  [10.5, 7.54, 10.8, 9.39, 'e'],
  [9.53, 9.39, 10.8, 9.55, 'e'],
  [9.23, 9.39, 9.53, 11.9, 'e'],
  [9.23, 12.7, 9.53, 12.75, 'e'],
  [9.23, 12.75, 10.95, 13.08, 'e'],
  [10.68, 9.39, 10.95, 11.0, 'e'],
  [10.8, 7.54, 10.95, 9.39, 'e'],
  [9.53, 13.08, 10.95, 14.12, 'e'],
  // --- services (shafts)
  [7.55, 2.8, 9.05, 3.73, 'e'],
  [8.4, 6.13, 9.05, 7.0, 'e'],
  [8.17, 7.0, 9.26, 7.33, 'e'],
  // --- partitions
  [1.94, 3.17, 6.47, 3.27, 'i'],
  [6.36, 3.27, 6.47, 4.93, 'i'],
  [1.94, 5.87, 6.47, 5.98, 'i'],
  [6.36, 5.75, 6.47, 6.08, 'i'],
  [6.36, 6.9, 6.47, 8.73, 'i'],
  [2.59, 8.62, 6.47, 8.73, 'i'],
  [7.55, 0.3, 7.65, 1.95, 'i'],
  [7.55, 3.73, 7.65, 4.93, 'i'],
  [7.52, 5.8, 7.65, 7.0, 'i'],
  [7.52, 7.0, 8.4, 7.05, 'i'],
  [6.47, 4.67, 6.6, 4.77, 'i'],
  [7.4, 4.67, 7.55, 4.77, 'i'],
  [6.47, 7.44, 6.55, 7.54, 'i'],
  [7.4, 7.44, 9.26, 7.54, 'i'],
  [2.59, 11.71, 6.67, 11.82, 'i'],
  [7.55, 11.72, 9.23, 11.82, 'i'],
  [7.6, 12.74, 7.7, 13.57, 'i'],
];

// Lintels over door openings [x0,z0,x1,z1]
export const LINTELS = [
  [9.46, 7.33, 10.38, 7.54], // entrance door
  [6.55, 7.44, 7.4, 7.54], // bedroom-wing door
  [6.6, 4.67, 7.4, 4.77], // bedroom 1
  [6.36, 4.93, 6.47, 5.75], // bedroom 2
  [6.36, 6.08, 6.47, 6.9], // bedroom 3
  [7.55, 1.95, 7.65, 2.8], // bathroom 1
  [7.55, 4.93, 7.65, 5.8], // bathroom 2 (sliding)
  [6.67, 11.71, 7.55, 11.82], // kitchen
  [7.6, 11.82, 7.7, 12.74], // utility room
  [9.23, 11.9, 9.53, 12.7], // exit to drying area
];

// Exterior joinery. Glass on a constant-X plane (between x0 and x1).
// segs: [z0, z1, 'f' fixed | 'p' openable]
export const WINDOWS = [
  { x0: 1.88, x1: 1.94, segs: [[1.07, 2.07, 'f'], [2.07, 3.07, 'p']] },
  { x0: 1.88, x1: 1.94, segs: [[4.17, 4.97, 'f'], [4.97, 5.77, 'p']] },
  { x0: 2.52, x1: 2.59, segs: [[7.31, 8.4, 'p'], [8.4, 8.5, 'f']] },
  { x0: 2.52, x1: 2.59, segs: [[8.97, 9.87, 'p'], [9.87, 10.77, 'f'], [10.77, 11.65, 'f']] },
  { x0: 2.52, x1: 2.59, segs: [[11.85, 12.97, 'p'], [12.97, 13.02, 'f']] },
];

// Door leaves (open position): plan rectangle [x0,z0,x1,z1]
export const DOOR_LEAVES = [
  { r: [10.36, 7.54, 10.42, 8.46], entry: true },
  { r: [6.56, 7.54, 6.61, 8.34] },
  { r: [7.38, 3.87, 7.43, 4.67] },
  { r: [5.56, 5.7, 6.36, 5.75] },
  { r: [5.56, 6.08, 6.36, 6.13] },
  { r: [7.65, 2.72, 8.45, 2.77] },
  { r: [7.45, 11.82, 7.5, 12.62], glass: true },
  { r: [7.7, 11.87, 8.5, 11.92] },
];

// Terrace, dividers and louvers
export const TERRACE = {
  floor: [
    [0.15, 0.8, 1.9, 7.1],
    [0.15, 7.1, 2.55, 13.25],
  ],
  railing: [0.12, 0.8, 0.24, 13.25],
  dividers: [
    [0.12, 0.72, 1.6, 0.8],
    [0.12, 13.25, 2.1, 13.33],
  ],
};
export const LOUVERS = [10.8, 11.0, 10.9, 12.75];

// Floor landing (common area)
export const LANDING = {
  floor: [9.26, 0.3, 10.9, 7.33],
  walls: [
    [9.26, 0.03, 10.9, 0.3],
    [10.8, 7.33, 10.9, 7.54],
  ],
  lifts: [
    [1.3, 2.3],
    [2.9, 3.9],
  ],
  stairDoor: [5.2, 6.2],
};

// Rooms: name, area, rectangles (for labels, minimap and detection)
export const ROOMS = [
  { id: 'd1', name: 'Dormitorio 1', area: 17.63, rects: [[1.94, 0.3, 7.55, 3.17], [6.47, 3.17, 7.55, 4.72]], label: [4.2, 1.9], spawn: [4.3, 2.7] },
  { id: 'b1', name: 'Baño 1', area: 3.16, rects: [[7.65, 0.3, 9.05, 2.8]], label: [8.3, 1.9], spawn: [8.0, 2.3] },
  { id: 'd2', name: 'Dormitorio 2', area: 11.52, rects: [[1.94, 3.27, 6.36, 5.87]], label: [3.9, 4.6], spawn: [5.2, 5.4] },
  { id: 'b2', name: 'Baño 2', area: 3.79, rects: [[7.65, 3.73, 9.05, 6.13], [7.65, 6.13, 8.4, 7.0]], label: [8.2, 5.4], spawn: [8.0, 5.3] },
  { id: 'pa', name: 'Pasillo', area: 3.12, rects: [[6.47, 4.72, 7.52, 7.5]], label: [7.0, 6.1], spawn: [7.0, 6.9] },
  { id: 'd3', name: 'Dormitorio 3', area: 10.04, rects: [[2.59, 5.98, 6.36, 8.62]], label: [4.5, 7.2], spawn: [5.4, 6.9] },
  { id: 've', name: 'Vestíbulo', area: 2.36, rects: [[9.27, 7.54, 10.5, 9.39], [7.47, 8.18, 9.27, 9.39]], label: [9.9, 8.7], spawn: [9.9, 8.1] },
  { id: 'sa', name: 'Salón comedor', area: 23.23, rects: [[2.59, 8.73, 9.23, 11.71], [6.47, 7.5, 7.47, 8.73]], label: [5.6, 10.2], spawn: [8.6, 9.1] },
  { id: 'co', name: 'Cocina', area: 10.07, rects: [[2.59, 11.82, 7.6, 13.83]], label: [4.8, 12.6], spawn: [7.0, 12.4] },
  { id: 'la', name: 'Lavadero', area: 2.62, rects: [[7.7, 11.82, 9.23, 13.57]], label: [8.4, 12.5], spawn: [8.2, 12.4] },
  { id: 'te', name: 'Tendedero', area: 0.0, rects: [[9.53, 9.55, 10.68, 12.75]], label: [10.1, 11.2], spawn: [10.0, 12.3] },
  { id: 'tz', name: 'Terraza', area: 19.76, rects: [[0.24, 0.8, 1.88, 7.1], [0.24, 7.1, 2.52, 13.25]], label: [1.1, 9.6], spawn: [1.4, 9.4] },
  { id: 'rl', name: 'Rellano', area: null, rects: [[9.26, 0.3, 10.9, 7.33]], label: [10.1, 5.2], spawn: [9.9, 6.2] },
];

export const UNIT_BOUNDS = [0.15, 0.03, 10.95, 14.12];
export const INTERIOR_BOUNDS = [1.6, 0.03, 10.9, 14.12];

export function roomAt(x, z) {
  for (const r of ROOMS) {
    for (const [x0, z0, x1, z1] of r.rects) {
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return r;
    }
  }
  return null;
}
