import {
  buildExplorerRoadPaths,
  explorerSurface,
  nearestRoadLocation,
  resolveExplorerMovement,
  sidewalkSpawn
} from "./explorer";
import { detectStreetIntersections, trafficSignalState } from "./streets";
import { buildAccessibleRoute, nearestParkingFacility } from "./mobility";
import {
  trafficSignalAhead,
  trafficSignalApproaches,
  trafficSignalColor,
  trafficVehiclePose
} from "./traffic";
import {
  advanceTransitRide,
  beginTransitRide,
  nearestTransitStop,
  requestTransitAlight,
  scheduledTransitPose
} from "./transit";
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
const vehicleRoute = crossingPaths.find(path => path.roadId === road.id)!.points;
const signalApproaches = trafficSignalApproaches(vehicleRoute, intersections);
check(signalApproaches.length === 1, "Vehicle route did not identify its signalized intersection.");
const signalApproach = signalApproaches[0];
const redMinute = Array.from({ length: 90 }, (_, minute) => minute)
  .find(minute => trafficSignalColor(trafficSignalState(intersections[0].id, minute), signalApproach.axis) === "red");
const greenMinute = Array.from({ length: 90 }, (_, minute) => minute)
  .find(minute => trafficSignalColor(trafficSignalState(intersections[0].id, minute), signalApproach.axis) === "green");
check(redMinute !== undefined && greenMinute !== undefined, "Vehicle traffic test could not find red and green phases.");
const requestedTrafficProgress = Math.min(signalApproach.clearProgress, signalApproach.stopProgress + .015);
const stoppedTraffic = trafficVehiclePose(vehicleRoute, requestedTrafficProgress, intersections, redMinute!, 2.1);
const movingTraffic = trafficVehiclePose(vehicleRoute, requestedTrafficProgress, intersections, greenMinute!, 2.1);
check(stoppedTraffic.stopped, "AI vehicle did not stop at a red signal.");
check(stoppedTraffic.progress <= signalApproach.stopProgress, "AI vehicle crossed its red-signal stop line.");
check(!movingTraffic.stopped && movingTraffic.progress === requestedTrafficProgress, "AI vehicle did not resume on green.");
const approachingPose = trafficVehiclePose(
  vehicleRoute,
  Math.max(0, signalApproach.stopProgress - .04),
  [],
  redMinute!,
  0
);
const signalAhead = trafficSignalAhead(
  approachingPose.point,
  approachingPose.tangent,
  intersections,
  redMinute!
);
check(signalAhead?.color === "red", "Explorer vehicle did not detect the red signal ahead.");
const outboundLane = trafficVehiclePose(vehicleRoute, .08, [], greenMinute!, 2.1);
const returningLane = trafficVehiclePose([...vehicleRoute].reverse(), .92, [], greenMinute!, 2.1);
check(
  Math.hypot(outboundLane.point.x - returningLane.point.x, outboundLane.point.z - returningLane.point.z) > 3.5,
  "Opposing AI traffic did not occupy separate directional lanes."
);
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
  occupied: 36,
  hourlyRate: 4,
  revenue: 0
};
const curbParking: ParkingFacility = {
  id: "test-curb",
  kind: "curb",
  position: { x: 1, z: 2 },
  rotation: 0,
  capacity: 2,
  accessibleSpaces: 1,
  occupied: 0,
  hourlyRate: 6,
  revenue: 0
};
check(nearestParkingFacility([garage, curbParking], { x: 0, z: 0 })?.id === curbParking.id, "Nearest available parking lookup failed.");
const premiumParking = { ...curbParking, id: "premium-curb", position: { x: 5, z: 0 }, hourlyRate: 10 };
const economyParking = { ...curbParking, id: "economy-curb", position: { x: 5, z: 0 }, hourlyRate: 2 };
check(
  nearestParkingFacility([premiumParking, economyParking], { x: 0, z: 0 })?.id === economyParking.id,
  "Parking choice did not prefer the lower-priced facility at equal distance and occupancy."
);
const mobilityWorld = new World();
check(mobilityWorld.parking.length === 3, "NYC template did not create its initial curb parking.");
check(mobilityWorld.transitLines.length === 1, "NYC template did not create its initial transit line.");
const transitLine = mobilityWorld.transitLines[0];
check(transitLine.route.length >= 8, "Transit line route geometry is incomplete.");
check(transitLine.stops.length >= 4, "Transit line did not create enough curbside stops.");
check(
  mobilityWorld.snapshot().transitLines?.[0].stops.length === transitLine.stops.length,
  "Transit line and stops were not included in the world snapshot."
);
const nearestStop = nearestTransitStop(mobilityWorld.transitLines, transitLine.stops[0].position, 1);
check(nearestStop?.stop.id === transitLine.stops[0].id, "Nearest transit stop lookup failed.");
const outboundBus = scheduledTransitPose(transitLine, transitLine.travelMinutes * .25);
const returningBus = scheduledTransitPose(
  transitLine,
  transitLine.travelMinutes + .75 + transitLine.travelMinutes * .25
);
check(
  outboundBus.tangent.x * returningBus.tangent.x + outboundBus.tangent.z * returningBus.tangent.z < -.9,
  "Scheduled transit did not reverse direction for its return trip."
);
const startedTransitRide = beginTransitRide(transitLine, transitLine.stops[0].id);
check(Boolean(startedTransitRide), "Transit ride could not begin at a valid stop.");
let transitRide = requestTransitAlight(startedTransitRide!, transitLine);
check(
  transitRide.alightStopId === transitLine.stops[1].id,
  "Transit ride did not request the next stop in its direction of travel."
);
let arrivedTransitStop: string | undefined;
for (let index = 0; index < 1000 && !arrivedTransitStop; index++) {
  const advanced = advanceTransitRide(transitRide, transitLine, 10);
  transitRide = advanced.ride;
  arrivedTransitStop = advanced.arrivedStop?.id;
}
check(
  arrivedTransitStop === transitLine.stops[1].id,
  "Transit ride did not alight at its requested stop."
);
const placedParking = mobilityWorld.addParking("surface", { x: 24, z: -18 }, .4);
check(placedParking.capacity === 18 && placedParking.accessibleSpaces === 2, "Surface parking capacity is incorrect.");
check(placedParking.hourlyRate === 2, "Surface parking did not receive its default hourly rate.");
const marketDemand = mobilityWorld.parkingDemand(placedParking, 12 * 60);
check(mobilityWorld.setParkingRate(placedParking.id, 10), "Parking hourly rate could not be changed.");
const premiumDemand = mobilityWorld.parkingDemand(placedParking, 12 * 60);
check(premiumDemand < marketDemand, "Higher parking price did not reduce modeled demand.");
check(mobilityWorld.setParkingRate(placedParking.id, 4), "Parking rate could not be reset for turnover testing.");
const parkingRevenueBefore = placedParking.revenue;
mobilityWorld.advanceMinutes(60, mobilityWorld.cityEconomy().monthlyBalance);
check(placedParking.revenue > parkingRevenueBefore, "Occupied parking did not collect hourly revenue.");
check(placedParking.occupied >= 0 && placedParking.occupied <= placedParking.capacity, "Parking turnover exceeded capacity bounds.");
const parkingEconomy = mobilityWorld.cityEconomy();
check(parkingEconomy.parkingRevenue > 0, "Parking pricing did not contribute projected municipal revenue.");
const parkingSnapshot = mobilityWorld.snapshot().parking?.find(item => item.id === placedParking.id);
check(parkingSnapshot?.hourlyRate === 4 && parkingSnapshot.revenue === placedParking.revenue, "Parking price and revenue were not included in the world snapshot.");
check(mobilityWorld.parkPlayerVehicle(placedParking.id, placedParking.position, placedParking.rotation), "Player vehicle could not use available parking.");
check(mobilityWorld.snapshot().playerVehicle?.parkingId === placedParking.id, "Parked vehicle was not included in the world snapshot.");
mobilityWorld.advanceMinutes(60, parkingEconomy.monthlyBalance);
check(placedParking.occupied >= 1, "Hourly turnover did not preserve the player's occupied parking space.");
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
  redSignalStop: stoppedTraffic.stopped,
  greenSignalMovement: !movingTraffic.stopped,
  directionalLaneSeparation: Number(
    Math.hypot(outboundLane.point.x - returningLane.point.x, outboundLane.point.z - returningLane.point.z).toFixed(2)
  ),
  accessibleRouteMeters: Math.round(accessibleRoute!.distance),
  rampedCrossings: accessibleRoute!.rampedCrossings,
  transitLine: transitLine.name,
  transitStops: transitLine.stops.length,
  transitAlight: arrivedTransitStop,
  parkingMarketDemand: Number(marketDemand.toFixed(2)),
  parkingPremiumDemand: Number(premiumDemand.toFixed(2)),
  parkingHourlyRevenue: placedParking.revenue,
  parkingMonthlyRevenue: parkingEconomy.parkingRevenue,
  sidewalkDistance: Number(spawnLocation!.distance.toFixed(2)),
  buildingCollision: buildingMove.blocked,
  garageCollision: garageMove.blocked,
  waterBoundary: waterMove.blocked
}, null, 2));

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
