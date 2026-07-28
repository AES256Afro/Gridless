import {
  buildExplorerRoadPaths,
  explorerSurface,
  nearestRoadLocation,
  resolveExplorerMovement,
  sidewalkSpawn
} from "./explorer";
import { detectStreetIntersections, trafficSignalState } from "./streets";
import { buildAccessibleRoute, nearestParkingFacility } from "./mobility";
import { World, type Area, type Lot, type ParkingFacility, type Road } from "./world";

const road: Road = {
  id: "test-road",
  name: "Test Avenue",
  width: 10,
  points: [{ x: -40, z: 0 }, { x: 0, z: 8 }, { x: 40, z: 0 }]
};
const paths = buildExplorerRoadPaths([road], 4);
const nearest = nearestRoadLocation(paths, { x: 0, z: 9 });
check(Boolean(nearest), "Curved road lookup did not return a location.");
check(nearest!.roadName === "Test Avenue", "Road lookup lost the road name.");
check(nearest!.distance < 2, "Curved road lookup is too far from the visible spline.");

const spawn = sidewalkSpawn(paths, { x: 0, z: 20 });
const spawnLocation = nearestRoadLocation(paths, spawn);
check(explorerSurface(spawnLocation) === "Sidewalk", "Explorer entry did not land on a sidewalk.");

const crossingPaths = buildExplorerRoadPaths([
  road,
  {
    id: "cross-road",
    name: "Cross Street",
    width: 9,
    points: [{ x: 0, z: -35 }, { x: 0, z: 35 }]
  }
], 4);
const crossingSpawn = sidewalkSpawn(crossingPaths, { x: 0, z: 8 });
check(
  explorerSurface(nearestRoadLocation(crossingPaths, crossingSpawn)) === "Sidewalk",
  "Intersection-aware entry did not find a clear sidewalk."
);
const intersections = detectStreetIntersections(crossingPaths);
check(intersections.length === 1, `Expected one geometric intersection and found ${intersections.length}.`);
const signalStates = new Set(Array.from({ length: 90 }, (_, minute) =>
  trafficSignalState(intersections[0].id, minute)
));
check(signalStates.has("a-green") && signalStates.has("b-green") && signalStates.has("all-red"), "Traffic signal cycle is incomplete.");
const crossingNormal = { x: intersections[0].tangentA.z, z: -intersections[0].tangentA.x };
const crossingOffset = intersections[0].roadAWidth / 2 + 1.1;
const accessibleStart = {
  x: intersections[0].point.x + crossingNormal.x * crossingOffset,
  z: intersections[0].point.z + crossingNormal.z * crossingOffset
};
const accessibleEnd = {
  x: intersections[0].point.x - crossingNormal.x * crossingOffset,
  z: intersections[0].point.z - crossingNormal.z * crossingOffset
};
const accessibleRoute = buildAccessibleRoute(crossingPaths, intersections, accessibleStart, accessibleEnd);
check(Boolean(accessibleRoute), "Accessible sidewalk routing did not connect crossing streets.");
check(accessibleRoute!.rampedCrossings >= 1, "Accessible route did not use a ramped crossing.");

const land: Area = {
  id: "test-land",
  name: "Test land",
  kind: "land",
  points: [{ x: -50, z: -50 }, { x: 50, z: -50 }, { x: 50, z: 50 }, { x: -50, z: 50 }]
};
const lot: Lot = {
  id: "test-lot",
  roadId: road.id,
  center: { x: 12, z: 12 },
  rotation: Math.PI / 5,
  width: 16,
  depth: 18,
  zone: "residential",
  households: 1,
  businesses: 0,
  householdMix: { families: 0, singles: 1, shared: 0, seniors: 0 },
  businessMix: { retail: 0, office: 0, hospitality: 0, industrial: 0, community: 0 }
};
const garage: ParkingFacility = {
  id: "test-garage",
  kind: "garage",
  position: { x: -20, z: 15 },
  rotation: Math.PI / 6,
  capacity: 84,
  accessibleSpaces: 5,
  occupied: 36
};
const curbParking: ParkingFacility = {
  id: "test-curb",
  kind: "curb",
  position: { x: 1, z: 2 },
  rotation: 0,
  capacity: 2,
  accessibleSpaces: 1,
  occupied: 0
};
check(nearestParkingFacility([garage, curbParking], { x: 0, z: 0 })?.id === curbParking.id, "Nearest available parking lookup failed.");
const mobilityWorld = new World();
check(mobilityWorld.parking.length === 3, "NYC template did not create its initial curb parking.");
const placedParking = mobilityWorld.addParking("surface", { x: 24, z: -18 }, .4);
check(placedParking.capacity === 18 && placedParking.accessibleSpaces === 2, "Surface parking capacity is incorrect.");
check(mobilityWorld.parkPlayerVehicle(placedParking.id, placedParking.position, placedParking.rotation), "Player vehicle could not use available parking.");
check(mobilityWorld.snapshot().playerVehicle?.parkingId === placedParking.id, "Parked vehicle was not included in the world snapshot.");
const context = { landAreas: [land], lots: [lot], services: [], parking: [garage] };
const openMove = resolveExplorerMovement({ x: 0, z: 0 }, { x: 1, z: 1 }, context);
check(!openMove.blocked && openMove.position.x === 1 && openMove.position.z === 1, "Open walking movement was blocked.");
const buildingMove = resolveExplorerMovement({ x: 0, z: 12 }, { x: 12, z: 12 }, context);
check(buildingMove.blocked, "Building collision did not block the player.");
const waterMove = resolveExplorerMovement({ x: 45, z: 0 }, { x: 55, z: 0 }, context);
check(waterMove.blocked && waterMove.position.x <= 50, "Land boundary did not prevent walking into water.");
const garageMove = resolveExplorerMovement({ x: -20, z: 0 }, garage.position, context);
check(garageMove.blocked, "Garage collision did not block the player.");

console.log("Gridless Explorer movement checks: PASS");
console.log(JSON.stringify({
  roadSamples: paths[0].points.length,
  intersections: intersections.length,
  accessibleRouteMeters: Math.round(accessibleRoute!.distance),
  rampedCrossings: accessibleRoute!.rampedCrossings,
  sidewalkDistance: Number(spawnLocation!.distance.toFixed(2)),
  buildingCollision: buildingMove.blocked,
  garageCollision: garageMove.blocked,
  waterBoundary: waterMove.blocked
}, null, 2));

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
