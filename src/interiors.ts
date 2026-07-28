import type { AccessibilityEntrance, Home, Lot, Point2 } from "./world";

export type InteriorDoorway = {
  orientation: "x" | "z";
  boundary: number;
  center: number;
  width: number;
  roomIds: [string, string];
};

export type InteriorExteriorDoorway = {
  orientation: "x" | "z";
  boundary: number;
  center: number;
  width: number;
  roomId: string;
};

export type InteriorEntryStatus = {
  allowed: boolean;
  reason: string;
};

const FURNITURE_SIZE: Record<Home["furniture"][number]["kind"], { width: number; depth: number }> = {
  sofa: { width: 2.2, depth: .85 },
  table: { width: 1.6, depth: 1.6 },
  bed: { width: 1.7, depth: 2.1 },
  plant: { width: .65, depth: .65 }
};

export function lotLocalToWorld(point: Point2, lot: Lot): Point2 {
  const cosine = Math.cos(lot.rotation);
  const sine = Math.sin(lot.rotation);
  return {
    x: lot.center.x + cosine * point.x + sine * point.z,
    z: lot.center.z - sine * point.x + cosine * point.z
  };
}

export function worldToLotLocal(point: Point2, lot: Lot): Point2 {
  const dx = point.x - lot.center.x;
  const dz = point.z - lot.center.z;
  const cosine = Math.cos(lot.rotation);
  const sine = Math.sin(lot.rotation);
  return {
    x: cosine * dx - sine * dz,
    z: sine * dx + cosine * dz
  };
}

export function homeEntryStatus(home: Home | undefined, entrance: AccessibilityEntrance | undefined): InteriorEntryStatus {
  if (!home) {
    return { allowed: false, reason: "Open this lot in Home Simulator to create an explorable home." };
  }
  if (!home.rooms.length) {
    return { allowed: false, reason: "Build at least one room in Home Simulator first." };
  }
  if (!entrance) {
    return { allowed: false, reason: "This home does not have a connected street entrance." };
  }
  if (!entrance.stepFree) {
    return { allowed: false, reason: "A step or curb blocks this home entrance." };
  }
  if (entrance.doorWidth < .9) {
    return { allowed: false, reason: `The ${entrance.doorWidth.toFixed(2)}m doorway is too narrow to enter.` };
  }
  return { allowed: true, reason: "The home entrance is usable." };
}

export function interiorDoorways(home: Home): InteriorDoorway[] {
  const doorways: InteriorDoorway[] = [];
  for (let firstIndex = 0; firstIndex < home.rooms.length; firstIndex++) {
    const first = home.rooms[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < home.rooms.length; secondIndex++) {
      const second = home.rooms[secondIndex];
      const firstLeft = first.x - first.width / 2;
      const firstRight = first.x + first.width / 2;
      const firstBack = first.z - first.depth / 2;
      const firstFront = first.z + first.depth / 2;
      const secondLeft = second.x - second.width / 2;
      const secondRight = second.x + second.width / 2;
      const secondBack = second.z - second.depth / 2;
      const secondFront = second.z + second.depth / 2;

      const zOverlapStart = Math.max(firstBack, secondBack);
      const zOverlapEnd = Math.min(firstFront, secondFront);
      const xBoundary = Math.abs(firstRight - secondLeft) <= .3
        ? (firstRight + secondLeft) / 2
        : Math.abs(secondRight - firstLeft) <= .3
          ? (secondRight + firstLeft) / 2
          : undefined;
      if (xBoundary !== undefined && zOverlapEnd - zOverlapStart >= 1.1) {
        doorways.push({
          orientation: "x",
          boundary: xBoundary,
          center: (zOverlapStart + zOverlapEnd) / 2,
          width: Math.min(1.35, zOverlapEnd - zOverlapStart - .2),
          roomIds: [first.id, second.id]
        });
      }

      const xOverlapStart = Math.max(firstLeft, secondLeft);
      const xOverlapEnd = Math.min(firstRight, secondRight);
      const zBoundary = Math.abs(firstFront - secondBack) <= .3
        ? (firstFront + secondBack) / 2
        : Math.abs(secondFront - firstBack) <= .3
          ? (secondFront + firstBack) / 2
          : undefined;
      if (zBoundary !== undefined && xOverlapEnd - xOverlapStart >= 1.1) {
        doorways.push({
          orientation: "z",
          boundary: zBoundary,
          center: (xOverlapStart + xOverlapEnd) / 2,
          width: Math.min(1.35, xOverlapEnd - xOverlapStart - .2),
          roomIds: [first.id, second.id]
        });
      }
    }
  }
  return doorways;
}

export function interiorExteriorDoorway(home: Home, preferred: Point2): InteriorExteriorDoorway | undefined {
  const candidates = home.rooms.flatMap(room => {
    const horizontalMinimum = room.x - room.width / 2 + .7;
    const horizontalMaximum = room.x + room.width / 2 - .7;
    const verticalMinimum = room.z - room.depth / 2 + .7;
    const verticalMaximum = room.z + room.depth / 2 - .7;
    return [
      {
        orientation: "z" as const,
        boundary: room.z - room.depth / 2,
        center: clamp(preferred.x, horizontalMinimum, horizontalMaximum),
        width: Math.min(1.2, room.width - .4),
        roomId: room.id
      },
      {
        orientation: "z" as const,
        boundary: room.z + room.depth / 2,
        center: clamp(preferred.x, horizontalMinimum, horizontalMaximum),
        width: Math.min(1.2, room.width - .4),
        roomId: room.id
      },
      {
        orientation: "x" as const,
        boundary: room.x - room.width / 2,
        center: clamp(preferred.z, verticalMinimum, verticalMaximum),
        width: Math.min(1.2, room.depth - .4),
        roomId: room.id
      },
      {
        orientation: "x" as const,
        boundary: room.x + room.width / 2,
        center: clamp(preferred.z, verticalMinimum, verticalMaximum),
        width: Math.min(1.2, room.depth - .4),
        roomId: room.id
      }
    ];
  });
  return candidates.sort((first, second) => {
    const firstPoint = first.orientation === "x"
      ? { x: first.boundary, z: first.center }
      : { x: first.center, z: first.boundary };
    const secondPoint = second.orientation === "x"
      ? { x: second.boundary, z: second.center }
      : { x: second.center, z: second.boundary };
    return distance(firstPoint, preferred) - distance(secondPoint, preferred);
  })[0];
}

export function interiorRoomAt(home: Home, point: Point2) {
  return home.rooms.find(room =>
    Math.abs(point.x - room.x) <= room.width / 2
    && Math.abs(point.z - room.z) <= room.depth / 2
  );
}

export function isInteriorPositionValid(home: Home, point: Point2, playerRadius = .34) {
  const insideRoom = home.rooms.some(room =>
    Math.abs(point.x - room.x) <= room.width / 2 - playerRadius
    && Math.abs(point.z - room.z) <= room.depth / 2 - playerRadius
  );
  const insideDoorway = interiorDoorways(home).some(doorway => {
    if (doorway.orientation === "x") {
      return Math.abs(point.x - doorway.boundary) <= playerRadius + .22
        && Math.abs(point.z - doorway.center) <= doorway.width / 2 - .05;
    }
    return Math.abs(point.z - doorway.boundary) <= playerRadius + .22
      && Math.abs(point.x - doorway.center) <= doorway.width / 2 - .05;
  });
  if (!insideRoom && !insideDoorway) return false;
  return !home.furniture.some(item => pointInsideFurniture(point, item, playerRadius));
}

export function resolveInteriorMovement(
  home: Home,
  current: Point2,
  candidate: Point2,
  playerRadius = .34
) {
  if (isInteriorPositionValid(home, candidate, playerRadius)) {
    return { position: candidate, blocked: false };
  }
  const xOnly = { x: candidate.x, z: current.z };
  if (isInteriorPositionValid(home, xOnly, playerRadius)) {
    return { position: xOnly, blocked: true };
  }
  const zOnly = { x: current.x, z: candidate.z };
  if (isInteriorPositionValid(home, zOnly, playerRadius)) {
    return { position: zOnly, blocked: true };
  }
  return { position: { ...current }, blocked: true };
}

export function interiorEntryPoint(home: Home, preferred?: Point2, playerRadius = .34): Point2 | undefined {
  if (!home.rooms.length) return undefined;
  const candidates = home.rooms.flatMap(room => {
    const inset = playerRadius + .24;
    const minimumX = room.x - room.width / 2 + inset;
    const maximumX = room.x + room.width / 2 - inset;
    const minimumZ = room.z - room.depth / 2 + inset;
    const maximumZ = room.z + room.depth / 2 - inset;
    const target = preferred ?? { x: room.x, z: maximumZ };
    return [
      { x: clamp(target.x, minimumX, maximumX), z: clamp(target.z, minimumZ, maximumZ) },
      { x: room.x, z: maximumZ },
      { x: room.x, z: minimumZ },
      { x: minimumX, z: room.z },
      { x: maximumX, z: room.z },
      { x: room.x, z: room.z }
    ];
  });
  candidates.sort((a, b) => preferred
    ? distance(a, preferred) - distance(b, preferred)
    : distance(a, { x: 0, z: 0 }) - distance(b, { x: 0, z: 0 })
  );
  for (const candidate of candidates) {
    if (isInteriorPositionValid(home, candidate, playerRadius)) return candidate;
    for (let ring = .5; ring <= 2; ring += .5) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const offset = {
          x: candidate.x + Math.cos(angle) * ring,
          z: candidate.z + Math.sin(angle) * ring
        };
        if (isInteriorPositionValid(home, offset, playerRadius)) return offset;
      }
    }
  }
  return undefined;
}

function pointInsideFurniture(
  point: Point2,
  item: Home["furniture"][number],
  playerRadius: number
) {
  const size = FURNITURE_SIZE[item.kind];
  const dx = point.x - item.x;
  const dz = point.z - item.z;
  const cosine = Math.cos(item.rotation);
  const sine = Math.sin(item.rotation);
  const localX = cosine * dx - sine * dz;
  const localZ = sine * dx + cosine * dz;
  return Math.abs(localX) < size.width / 2 + playerRadius
    && Math.abs(localZ) < size.depth / 2 + playerRadius;
}

function distance(first: Point2, second: Point2) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
