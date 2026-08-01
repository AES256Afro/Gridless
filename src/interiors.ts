import {
  HOME_FURNITURE_SIZE,
  homeFloorView,
  homeSharedWallSegments,
  type AccessibilityEntrance,
  type Home,
  type Lot,
  type Point2,
  type ResidentActionKind
} from "./world";

export type InteriorDoorway = {
  id?: string;
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

export type FurnitureInteraction = {
  action: ResidentActionKind;
  label: string;
  effect: string;
};

const FURNITURE_INTERACTIONS: Record<Home["furniture"][number]["kind"], FurnitureInteraction> = {
  bed: { action: "sleep", label: "Sleep", effect: "Restores energy and health" },
  sofa: { action: "relax", label: "Relax", effect: "Improves comfort and reduces stress" },
  table: { action: "eat", label: "Have a meal", effect: "Restores energy, comfort, and health" },
  plant: { action: "tend-plants", label: "Tend plant", effect: "Improves health, comfort, and calm" },
  desk: { action: "study", label: "Study", effect: "Builds creativity and practical skill" },
  bookcase: { action: "study", label: "Read", effect: "Builds creativity and practical skill" },
  fridge: { action: "eat", label: "Get a meal", effect: "Restores energy, comfort, and health" },
  shower: { action: "shower", label: "Take a shower", effect: "Improves health, comfort, and calm" }
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
  if (!homeFloorView(home, 0).rooms.length) {
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
  if (home.doors !== undefined) return home.doors.map(door => ({
    id: door.id,
    orientation: door.orientation,
    boundary: door.boundary,
    center: door.center,
    width: door.width,
    roomIds: door.roomIds
  }));
  return homeSharedWallSegments(home).map(wall => ({
    orientation: wall.orientation,
    boundary: wall.boundary,
    center: (wall.start + wall.end) / 2,
    width: Math.min(1.35, wall.end - wall.start - .2),
    roomIds: wall.roomIds
  }));
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

export function furnitureInteraction(
  kind: Home["furniture"][number]["kind"]
): FurnitureInteraction {
  return FURNITURE_INTERACTIONS[kind];
}

export function nearestInteriorFurniture(home: Home, point: Point2, maximumDistance = 2.6) {
  const room = interiorRoomAt(home, point);
  return home.furniture
    .filter(item => {
      const itemRoom = interiorRoomAt(home, item);
      return !room || !itemRoom || room.id === itemRoom.id;
    })
    .map(item => ({
      item,
      distance: Math.hypot(item.x - point.x, item.z - point.z),
      interaction: furnitureInteraction(item.kind)
    }))
    .filter(candidate => candidate.distance <= maximumDistance)
    .sort((first, second) => first.distance - second.distance)[0];
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
  const size = HOME_FURNITURE_SIZE[item.kind];
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
