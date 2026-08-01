import {
  HOME_FURNITURE_SIZE,
  homeFloorView,
  homeRoomExteriorWalls,
  homeRoomLabel,
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

export type HomeCirculation = {
  connected: boolean;
  reachableRoomIds: string[];
  unreachableRoomIds: string[];
  doorwayCount: number;
  wideDoorwayCount: number;
  accessibleWidthShare: number;
  score: number;
  summary: string;
};

export type HomeSafetyIssue = {
  kind: "entry" | "circulation" | "stairs" | "sleep-egress" | "clearance" | "accessible-egress";
  severity: "advisory" | "important" | "critical";
  label: string;
  recommendation: string;
  roomIds: string[];
};

export type HomeSafetyAudit = {
  score: number;
  safe: boolean;
  egressCoverage: number;
  circulationScore: number;
  clearanceShare: number;
  issues: HomeSafetyIssue[];
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

export function homeCirculation(home: Home): HomeCirculation {
  const roomIds = new Set(home.rooms.map(room => room.id));
  const graph = new Map([...roomIds].map(id => [id, new Set<string>()]));
  const doorways = interiorDoorways(home);
  for (const doorway of doorways) {
    const [first, second] = doorway.roomIds;
    if (!graph.has(first) || !graph.has(second)) continue;
    graph.get(first)!.add(second);
    graph.get(second)!.add(first);
  }
  const roomAtFloorPoint = (floor: number, point: Point2) => home.rooms.find(room =>
    Math.round(room.floor ?? 0) === floor
    && Math.abs(point.x - room.x) <= room.width / 2
    && Math.abs(point.z - room.z) <= room.depth / 2
  );
  for (const stair of home.stairs ?? []) {
    const lower = roomAtFloorPoint(stair.fromFloor, stair);
    const upper = roomAtFloorPoint(stair.toFloor, stair);
    if (!lower || !upper) continue;
    graph.get(lower.id)?.add(upper.id);
    graph.get(upper.id)?.add(lower.id);
  }
  const root = home.rooms.find(room => Math.round(room.floor ?? 0) === 0) ?? home.rooms[0];
  const reachable = new Set<string>();
  const queue = root ? [root.id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const neighbor of graph.get(id) ?? []) if (!reachable.has(neighbor)) queue.push(neighbor);
  }
  const unreachableRoomIds = home.rooms.map(room => room.id).filter(id => !reachable.has(id));
  const wideDoorwayCount = doorways.filter(doorway => doorway.width >= 1.2).length;
  const accessibleWidthShare = doorways.length
    ? Math.round(wideDoorwayCount / doorways.length * 100)
    : home.rooms.length <= 1 ? 100 : 0;
  const reachableShare = home.rooms.length ? reachable.size / home.rooms.length : 1;
  const score = Math.round(reachableShare * 70 + accessibleWidthShare / 100 * 30);
  const connected = unreachableRoomIds.length === 0;
  return {
    connected,
    reachableRoomIds: [...reachable],
    unreachableRoomIds,
    doorwayCount: doorways.length,
    wideDoorwayCount,
    accessibleWidthShare,
    score,
    summary: connected
      ? `${reachable.size} of ${home.rooms.length} rooms connected · ${accessibleWidthShare}% wide-access openings`
      : `${unreachableRoomIds.length} unreachable room${unreachableRoomIds.length === 1 ? "" : "s"} · ${accessibleWidthShare}% wide-access openings`
  };
}

export function homeSafetyAudit(home: Home): HomeSafetyAudit {
  const circulation = homeCirculation(home);
  const issues: HomeSafetyIssue[] = [];
  const groundFloorRooms = home.rooms.filter(room => Math.round(room.floor ?? 0) === 0);
  if (!groundFloorRooms.length) issues.push({
    kind: "entry",
    severity: "critical",
    label: "No ground-floor entry room",
    recommendation: "Add a ground-floor room connected to the street entrance.",
    roomIds: []
  });
  if (circulation.unreachableRoomIds.length) issues.push({
    kind: "circulation",
    severity: "critical",
    label: `${home.rooms.filter(room => circulation.unreachableRoomIds.includes(room.id)).map(homeRoomLabel).join(", ")} ${circulation.unreachableRoomIds.length === 1 ? "is" : "are"} cut off from the exit path`,
    recommendation: "Add interior doorways until every room connects to the ground-floor entry.",
    roomIds: circulation.unreachableRoomIds
  });
  const missingStairLinks = Math.max(0, home.floors - 1 - (home.stairs ?? []).length);
  if (missingStairLinks) issues.push({
    kind: "stairs",
    severity: "critical",
    label: `${missingStairLinks} floor transition${missingStairLinks === 1 ? "" : "s"} lack stairs`,
    recommendation: "Add stairs between every occupied floor before residents move upstairs.",
    roomIds: home.rooms.filter(room => Math.round(room.floor ?? 0) > 0).map(room => room.id)
  });
  const sleepingRooms = home.rooms.filter(room => room.kind === "Bedroom" || room.kind === "Nursery" || room.kind === "Studio");
  const sleepingRoomsWithWindow = sleepingRooms.filter(room => home.windows === undefined
    ? homeRoomExteriorWalls(home, room).some(wall => wall.end - wall.start >= 1)
    : home.windows.some(window => window.roomId === room.id && window.width >= .9));
  const sleepingWithoutEgress = sleepingRooms.filter(room => !sleepingRoomsWithWindow.includes(room));
  const sleepingWithoutEgressNames = sleepingWithoutEgress.map(homeRoomLabel);
  const sleepingWithoutEgressLabel = sleepingWithoutEgressNames.length <= 1
    ? sleepingWithoutEgressNames[0] ?? "Sleeping room"
    : `${sleepingWithoutEgressNames.slice(0, -1).join(", ")} and ${sleepingWithoutEgressNames.at(-1)}`;
  if (sleepingWithoutEgress.length) issues.push({
    kind: "sleep-egress",
    severity: "important",
    label: `${sleepingWithoutEgressLabel} ${sleepingWithoutEgress.length === 1 ? "has" : "have"} no usable escape window`,
    recommendation: "Add a window at least 0.9m wide to every Bedroom, Nursery, and Studio.",
    roomIds: sleepingWithoutEgress.map(room => room.id)
  });
  const totalRoomArea = Math.max(1, home.rooms.reduce((total, room) => total + room.width * room.depth, 0));
  const furnitureArea = home.furniture.reduce((total, item) => {
    const size = HOME_FURNITURE_SIZE[item.kind];
    return total + size.width * size.depth;
  }, 0);
  const clearanceShare = Math.round(Math.max(0, 1 - furnitureArea / totalRoomArea) * 100);
  if (clearanceShare < 62) issues.push({
    kind: "clearance",
    severity: clearanceShare < 50 ? "critical" : "important",
    label: `Only ${clearanceShare}% of floor area remains clear`,
    recommendation: "Move or remove furnishings to keep continuous walking and emergency paths clear.",
    roomIds: home.rooms.map(room => room.id)
  });
  const hasMobilitySensitiveResident = home.residents.some(resident => {
    const stage = resident.lifeStage ?? (resident.age === "child" ? "child" : "adult");
    return stage === "infant" || stage === "toddler" || stage === "child" || stage === "elder";
  });
  if (hasMobilitySensitiveResident && circulation.doorwayCount > 0 && circulation.accessibleWidthShare < 100) issues.push({
    kind: "accessible-egress",
    severity: "advisory",
    label: "Some household escape routes use standard-width openings",
    recommendation: "Upgrade interior doorways to wide openings for children, elders, and assisted evacuation.",
    roomIds: home.rooms.map(room => room.id)
  });
  const egressCoverage = sleepingRooms.length ? Math.round(sleepingRoomsWithWindow.length / sleepingRooms.length * 100) : 100;
  const penalty = issues.reduce((total, issue) => total + (issue.severity === "critical" ? 25 : issue.severity === "important" ? 12 : 6), 0);
  const score = Math.round(Math.max(0, Math.min(100,
    100 - penalty - Math.max(0, 70 - circulation.score) * .2 - Math.max(0, 62 - clearanceShare) * .2
  )));
  return {
    score,
    safe: !issues.some(issue => issue.severity === "critical" || issue.severity === "important"),
    egressCoverage,
    circulationScore: circulation.score,
    clearanceShare,
    issues
  };
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
