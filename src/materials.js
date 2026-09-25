import * as THREE from 'three';
import * as T from './textures.js';

export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    // building
    slab: std({ color: '#f1eee8', roughness: 0.7 }),
    facade: std({ map: T.facadeTexture(0), roughness: 0.55, metalness: 0.05 }),
    facadeB: std({ map: T.facadeTexture(1), roughness: 0.55, metalness: 0.05 }),
    core: std({ map: T.coreTexture(), roughness: 0.8 }),
    groundFloor: std({ map: T.groundFloorTexture(), roughness: 0.2, metalness: 0.3 }),
    railGlass: new THREE.MeshPhysicalMaterial({
      color: '#bfd6dc', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide,
    }),
    darkMetal: std({ color: '#3a3c3f', roughness: 0.4, metalness: 0.6 }),
    // surroundings
    paving: std({ map: T.pavingTexture(), roughness: 0.9 }),
    grass: std({ map: T.grassTexture(), roughness: 1 }),
    asphalt: std({ map: T.asphaltTexture(), roughness: 0.95 }),
    quay: std({ color: '#b9b2a4', roughness: 0.9 }),
    water: new THREE.MeshPhysicalMaterial({ color: '#2f5563', roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }),
    pool: new THREE.MeshPhysicalMaterial({ color: '#4fb5c9', roughness: 0.05, transparent: true, opacity: 0.9 }),
    trunk: std({ color: '#6b5440', roughness: 1 }),
    leaves: std({ color: '#5d7f3c', roughness: 0.9, flatShading: true }),
    leaves2: std({ color: '#76934a', roughness: 0.9, flatShading: true }),
    city: std({ map: T.cityTexture(), roughness: 0.8 }),
    cityWhite: std({ color: '#e9e7e2', roughness: 0.4, metalness: 0.1 }),
    hill: std({ color: '#5f7a4a', roughness: 1, flatShading: true }),
    rail: std({ color: '#8d9095', roughness: 0.3, metalness: 0.9 }),
    // unit
    wall: std({ color: '#ebe7e0', roughness: 0.9 }),
    wallExt: std({ color: '#5f6266', roughness: 0.7 }),
    ceiling: std({ color: '#fbfaf8', roughness: 0.95 }),
    floor: std({ map: T.porcelainTexture(), roughness: 0.35 }),
    terraceFloor: std({ map: T.outdoorTileTexture(), roughness: 0.8 }),
    bathTile: std({ map: T.bathTileTexture(), roughness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#d8e8ec', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0.0, depthWrite: false, side: THREE.DoubleSide,
    }),
    frame: std({ color: '#43464a', roughness: 0.45, metalness: 0.5 }),
    doorWhite: std({ color: '#f7f6f3', roughness: 0.5 }),
    entryDoor: std({ color: '#efece6', roughness: 0.45 }),
    lacquer: std({ color: '#f5f3ef', roughness: 0.35 }),
    kitchen: std({ color: '#e7e1d6', roughness: 0.4 }),
    counter: std({ color: '#ebe7e0', roughness: 0.25 }),
    steel: std({ color: '#c9ccce', roughness: 0.25, metalness: 0.9 }),
    black: std({ color: '#151617', roughness: 0.2, metalness: 0.3 }),
    porcelain: std({ color: '#ffffff', roughness: 0.15 }),
    mirror: std({ color: '#dfe7ea', roughness: 0.02, metalness: 1 }),
    wood: std({ map: T.woodTexture(), roughness: 0.6 }),
    woodDark: std({ map: T.woodTexture('#7a5a3e'), roughness: 0.6 }),
    sofa: std({ map: T.fabricTexture('#8a8d91'), roughness: 1 }),
    fabricBeige: std({ map: T.fabricTexture('#d9cfbf'), roughness: 1 }),
    fabricWhite: std({ map: T.fabricTexture('#f1efe9'), roughness: 1 }),
    fabricGrey: std({ map: T.fabricTexture('#9b9d9f'), roughness: 1 }),
    fabricBlue: std({ map: T.fabricTexture('#6d8394'), roughness: 1 }),
    rug: std({ map: T.rugTexture(), roughness: 1 }),
    red: std({ color: '#a8342c', roughness: 0.5, metalness: 0.2 }),
    plant: std({ color: '#4f7a3a', roughness: 0.8, flatShading: true }),
    pot: std({ color: '#cbbfae', roughness: 0.8 }),
    curtain: std({ color: '#efe9df', roughness: 1, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    lampWarm: std({ color: '#fff4dc', emissive: '#ffe6b0', emissiveIntensity: 0.0, roughness: 0.4 }),
    brass: std({ color: '#c9a060', roughness: 0.3, metalness: 0.9 }),
    screen: std({ color: '#0d0f11', roughness: 0.1, metalness: 0.5 }),
    liftDoor: std({ color: '#b9bcbf', roughness: 0.25, metalness: 0.9 }),
    landingFloor: std({ color: '#cbc5ba', roughness: 0.3 }),
    highlight: new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.22, depthWrite: false }),
  };
  M.floor.map.repeat.set(1, 1);
  return M;
}
