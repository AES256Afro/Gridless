import type { WorldTemplate, Zone } from "./world";

export type ArchitectureRoofStyle = "crown" | "cornice" | "mechanical" | "green" | "pitched" | "flat";

export type BuildingArchitecture = {
  regionLabel: string;
  widthScale: number;
  depthScale: number;
  heightScale: number;
  facadeColor: number;
  trimColor: number;
  podiumScale: number;
  roofStyle: ArchitectureRoofStyle;
  roofHeight: number;
};

type ArchitectureKit = {
  label: string;
  width: readonly [number, number];
  depth: readonly [number, number];
  height: readonly [number, number];
  facades: readonly number[];
  trims: readonly number[];
  roofs: readonly ArchitectureRoofStyle[];
  podium: readonly [number, number];
};

const ARCHITECTURE_KITS: Record<WorldTemplate["id"], ArchitectureKit> = {
  nyc: {
    label: "New York masonry",
    width: [.48, .62],
    depth: [.54, .66],
    height: [1.08, 1.34],
    facades: [0xa49382, 0xb5aa97, 0x8d7567, 0xc1b9a6, 0x766b66],
    trims: [0xd0c5ae, 0x584f49, 0x8b7c6d],
    roofs: ["crown", "cornice", "flat"],
    podium: [.94, 1.04]
  },
  chicago: {
    label: "Chicago stone and brick",
    width: [.59, .72],
    depth: [.57, .69],
    height: [.96, 1.18],
    facades: [0x8e8276, 0x9b7462, 0xaaa49a, 0x706f70, 0xb0a68e],
    trims: [0xd0c8b7, 0x55595a, 0x826e5c],
    roofs: ["cornice", "mechanical", "flat"],
    podium: [1.02, 1.12]
  },
  houston: {
    label: "Houston glass and concrete",
    width: [.68, .82],
    depth: [.62, .77],
    height: [.76, .98],
    facades: [0x8298a0, 0x9ca8aa, 0xb4afa3, 0x70878e, 0xc0b79f],
    trims: [0xd1d5d2, 0x667176, 0xb5aa93],
    roofs: ["mechanical", "flat"],
    podium: [1.04, 1.16]
  },
  seattle: {
    label: "Seattle glass and green roof",
    width: [.51, .64],
    depth: [.52, .65],
    height: [.91, 1.14],
    facades: [0x718a92, 0x839ba0, 0x9aa5a2, 0x657981, 0x8e9288],
    trims: [0xc7d1ce, 0x4f6265, 0x72836d],
    roofs: ["green", "mechanical", "crown"],
    podium: [.95, 1.07]
  },
  portland: {
    label: "Portland brick and timber",
    width: [.57, .7],
    depth: [.55, .68],
    height: [.67, .88],
    facades: [0x9b725d, 0xaa8268, 0x8a8170, 0xb09a7c, 0x796b5e],
    trims: [0xdecda9, 0x5d5043, 0x788466],
    roofs: ["pitched", "green", "cornice"],
    podium: [.97, 1.08]
  },
  blank: {
    label: "Flexible contemporary",
    width: [.55, .7],
    depth: [.54, .69],
    height: [.88, 1.08],
    facades: [0x9d9b91, 0x89989b, 0xa49382, 0x8f897f],
    trims: [0xd1cec3, 0x5f6666, 0x82766a],
    roofs: ["flat", "mechanical", "green"],
    podium: [.98, 1.08]
  }
};

const ZONE_HEIGHT: Record<Zone, number> = {
  unassigned: 1,
  residential: .82,
  commercial: 1.12,
  mixed: 1.02,
  industrial: .72,
  civic: .94
};

function interpolate(range: readonly [number, number], value: number) {
  return range[0] + (range[1] - range[0]) * value;
}

function unit(seed: number, salt: number) {
  const value = Math.imul((seed ^ salt) >>> 0, 2654435761) >>> 0;
  return value / 0xffffffff;
}

export function buildingArchitecture(
  templateId: WorldTemplate["id"],
  zone: Zone,
  seed: number
): BuildingArchitecture {
  const kit = ARCHITECTURE_KITS[templateId] ?? ARCHITECTURE_KITS.blank;
  const facadeIndex = Math.floor(unit(seed, 0x71f4a3) * kit.facades.length) % kit.facades.length;
  const trimIndex = Math.floor(unit(seed, 0x9e3779) * kit.trims.length) % kit.trims.length;
  const roofIndex = Math.floor(unit(seed, 0x4f1bbc) * kit.roofs.length) % kit.roofs.length;
  return {
    regionLabel: kit.label,
    widthScale: interpolate(kit.width, unit(seed, 0x1f123b)),
    depthScale: interpolate(kit.depth, unit(seed, 0x55aa19)),
    heightScale: interpolate(kit.height, unit(seed, 0x6c8e9f)) * ZONE_HEIGHT[zone],
    facadeColor: kit.facades[facadeIndex],
    trimColor: kit.trims[trimIndex],
    podiumScale: interpolate(kit.podium, unit(seed, 0x2a51d7)),
    roofStyle: kit.roofs[roofIndex],
    roofHeight: .45 + unit(seed, 0x345678) * 1.15
  };
}
