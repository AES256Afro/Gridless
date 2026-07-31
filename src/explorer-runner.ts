import {
  buildExplorerRoadPaths,
  explorerSurface,
  nearestRoadLocation,
  resolveExplorerMovement,
  sidewalkSpawn
} from "./explorer";
import {
  homeEntryStatus,
  furnitureInteraction,
  interiorDoorways,
  interiorEntryPoint,
  interiorExteriorDoorway,
  interiorRoomAt,
  isInteriorPositionValid,
  lotLocalToWorld,
  nearestInteriorFurniture,
  resolveInteriorMovement,
  worldToLotLocal
} from "./interiors";
import { detectStreetIntersections, trafficSignalState } from "./streets";
import { soundscapeProfile } from "./soundscape";
import { cityAdvisorActions } from "./advisor";
import { homeAdvisorActions } from "./home-advisor";
import { recordActivity } from "./activity";
import {
  assessAccessibleTrip,
  buildAccessibleRoute,
  nearestAccessibilityDestination,
  nearestParkingFacility
} from "./mobility";
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
  scheduledTransitFleet,
  transitFleetSize,
  scheduledTransitPose
} from "./transit";
import {
  World,
  type AccessibilityEntrance,
  type Area,
  type ConversationIntent,
  type Home,
  type Lot,
  type ParkingFacility,
  type Road
} from "./world";

let activityHistory: ReturnType<typeof recordActivity> = [];
for (let index = 0; index < 35; index++) {
  activityHistory = recordActivity(activityHistory, {
    text: `Update ${index}`,
    date: "Y1 JAN 1",
    time: String(index).padStart(2, "0")
  });
}
check(
  activityHistory.length === 30
    && activityHistory[0].text === "Update 34"
    && activityHistory.at(-1)?.text === "Update 5",
  "Activity history did not retain the newest bounded entries."
);
const activityLength = activityHistory.length;
activityHistory = recordActivity(activityHistory, {
  text: "Update 34",
  date: "Y1 JAN 2",
  time: "08:15"
});
check(
  activityHistory.length === activityLength
    && activityHistory[0].date === "Y1 JAN 2"
    && activityHistory[0].time === "08:15",
  "Repeated activity did not refresh its timestamp without duplicating the entry."
);
const authoredActivity = '<img src=x onerror="throw new Error()">';
activityHistory = recordActivity(activityHistory, { text: authoredActivity, date: "Y1 JAN 2", time: "08:16" });
check(activityHistory[0].text === authoredActivity, "Activity history altered player-authored text before safe DOM rendering.");

const weatherWorld = new World();
const matchingWeatherWorld = new World();
check(
  JSON.stringify(weatherWorld.weather()) === JSON.stringify(matchingWeatherWorld.weather()),
  "Weather was not deterministic for the same city date."
);
for (let month = 1; month <= 12; month++) {
  weatherWorld.clock.month = month;
  const weather = weatherWorld.weather();
  check(
    weather.temperatureC >= -20
      && weather.temperatureC <= 40
      && weather.windKph >= 0
      && weather.precipitation >= 0
      && weather.precipitation <= 1
      && weather.visibility > 0
      && weather.visibility <= 1,
    `Weather left its supported range in month ${month}.`
  );
}
const clearWeather = matchingWeatherWorld.weather();
const builderSound = soundscapeProfile("city", clearWeather, 12, .65);
const streetSound = soundscapeProfile("explore", clearWeather, 12, .65);
const homeSound = soundscapeProfile("home", clearWeather, 12, .65);
const rainyStreetSound = soundscapeProfile(
  "explore",
  { ...clearWeather, kind: "rain", label: "Rain", precipitation: .8 },
  12,
  .65
);
const nightStreetSound = soundscapeProfile("explore", clearWeather, 2, .65);
check(
  builderSound.label === "Regional"
    && streetSound.label === "Street"
    && homeSound.label === "Interior"
    && streetSound.urban > builderSound.urban
    && homeSound.room > 0,
  "Soundscape profiles did not distinguish Builder, Explorer, and Home scales."
);
check(
  rainyStreetSound.rain > streetSound.rain
    && nightStreetSound.urban < streetSound.urban,
  "Soundscape profiles did not respond to weather and time of day."
);
const blankCityAdvice = cityAdvisorActions({
  roads: 0,
  services: 0,
  coverage: 0,
  staffing: .85,
  utilityFailures: 0,
  congestion: 0,
  wellbeing: 0,
  monthlyBalance: 0
});
check(
  blankCityAdvice[0].id === "first-road" && blankCityAdvice.length <= 3,
  "City Advisor did not prioritize the first playable action for a blank region."
);
const pressuredCityAdvice = cityAdvisorActions({
  roads: 12,
  services: 2,
  coverage: .31,
  staffing: .62,
  utilityFailures: 2,
  congestion: .81,
  wellbeing: 44,
  monthlyBalance: -125_000
});
check(
  pressuredCityAdvice.map(action => action.id).join(",") === "utility-failure,service-coverage,service-staffing",
  "City Advisor did not rank urgent outages, coverage, and staffing ahead of lower-priority pressures."
);
const healthyCityAdvice = cityAdvisorActions({
  roads: 12,
  services: 9,
  coverage: .9,
  staffing: .85,
  utilityFailures: 0,
  congestion: .34,
  wellbeing: 78,
  monthlyBalance: 400_000
});
check(
  healthyCityAdvice.length === 1 && healthyCityAdvice[0].id === "growth",
  "City Advisor did not fall back to development review for a healthy city."
);
const emptyHomeAdvice = homeAdvisorActions({
  residents: [],
  furniture: [],
  roomCount: 1,
  householdFunds: 15_000,
  dailyNet: 0,
  highestTension: 0
});
check(
  emptyHomeAdvice.map(action => action.id).join(",") === "resident,shower,fridge",
  "Home Advisor did not create a clear first-household furnishing path."
);
const pressuredHomeAdvice = homeAdvisorActions({
  residents: [{
    energy: 54,
    comfort: 48,
    health: 65,
    stress: 58,
    traits: ["creative", "empathetic"]
  }, {
    energy: 60,
    comfort: 55,
    health: 72,
    stress: 50,
    traits: ["organized", "homebody"]
  }],
  furniture: [],
  roomCount: 1,
  householdFunds: 2_000,
  dailyNet: 20,
  highestTension: 50
});
check(
  pressuredHomeAdvice.map(action => action.id).join(",") === "bed,shower,social",
  "Home Advisor did not prioritize sleep, health, and relationship pressure."
);
const supportedHomeAdvice = homeAdvisorActions({
  residents: [{ energy: 82, comfort: 80, health: 84, stress: 20, traits: ["creative", "organized"] }],
  furniture: [
    { id: "bed", kind: "bed", x: 0, z: 0, rotation: 0 },
    { id: "shower", kind: "shower", x: 2, z: 0, rotation: 0 },
    { id: "fridge", kind: "fridge", x: -2, z: 0, rotation: 0 },
    { id: "sofa", kind: "sofa", x: 0, z: 2, rotation: 0 },
    { id: "desk", kind: "desk", x: 0, z: -2, rotation: 0 }
  ],
  roomCount: 2,
  householdFunds: 20_000,
  dailyNet: 120,
  highestTension: 0
});
check(supportedHomeAdvice.length === 0, "Home Advisor invented pressure for a supported healthy household.");

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

const historyWorld = new World();
const startingRoadCount = historyWorld.roads.length;
historyWorld.addRoad([{ x: 900, z: 900 }, { x: 950, z: 900 }], 9, "street");
const authoredRoadId = historyWorld.roads.at(-1)!.id;
check(
  historyWorld.roads.length === startingRoadCount + 1
    && historyWorld.canUndo()
    && !historyWorld.canRedo(),
  "A world edit did not enter the undo history."
);
check(
  historyWorld.undo()
    && historyWorld.roads.length === startingRoadCount
    && historyWorld.canRedo(),
  "Undo did not restore the prior world or expose redo."
);
check(
  historyWorld.redo()
    && historyWorld.roads.length === startingRoadCount + 1
    && historyWorld.roads.at(-1)!.id === authoredRoadId,
  "Redo did not restore the exact authored world state."
);
check(historyWorld.undo(), "History branch setup could not undo the restored road.");
historyWorld.addRoad([{ x: 900, z: 920 }, { x: 950, z: 920 }], 9, "street");
check(
  !historyWorld.canRedo() && !historyWorld.redo(),
  "A new edit after undo did not invalidate the abandoned redo branch."
);

const recoveryWorld = new World();
const recoveryRevision = recoveryWorld.changeRevision();
recoveryWorld.addRoad([{ x: 900, z: 940 }, { x: 950, z: 940 }], 9, "street");
const recoveryRoadId = recoveryWorld.roads.at(-1)!.id;
const recoverySnapshot = recoveryWorld.serialize();
check(
  recoveryWorld.changeRevision() > recoveryRevision,
  "A recoverable world edit did not advance the change revision."
);
recoveryWorld.addRoad([{ x: 900, z: 960 }, { x: 950, z: 960 }], 9, "street");
const revisionBeforeRestore = recoveryWorld.changeRevision();
check(recoveryWorld.restore(recoverySnapshot), "A valid recovery snapshot could not be restored.");
check(
  recoveryWorld.roads.length === startingRoadCount + 1
    && recoveryWorld.roads.at(-1)!.id === recoveryRoadId
    && recoveryWorld.canUndo()
    && recoveryWorld.changeRevision() > revisionBeforeRestore,
  "Recovery did not restore the exact saved edit as an undoable state."
);
const roadsBeforeInvalidRecovery = recoveryWorld.roads.length;
check(
  !recoveryWorld.restore("not valid json") && recoveryWorld.roads.length === roadsBeforeInvalidRecovery,
  "Invalid recovery data changed the live world."
);

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
const usableTrip = assessAccessibleTrip(crossingPaths, intersections, accessibleStart, {
  position: accessibleEnd,
  usable: true
});
const blockedEntranceTrip = assessAccessibleTrip(crossingPaths, intersections, accessibleStart, {
  position: accessibleEnd,
  usable: false
});
check(usableTrip.usable, "Step-free destination did not produce a usable complete trip.");
check(
  !blockedEntranceTrip.usable && blockedEntranceTrip.barriers.includes("Entrance is not step-free"),
  "Entrance barrier was not reported in the complete-trip assessment."
);

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
const interiorHome: Home = {
  id: "interior-home",
  lotId: lot.id,
  name: "Explorer test home",
  floors: 1,
  rooms: [
    { id: "living-room", kind: "Living room", x: 0, z: 0, width: 8, depth: 6 },
    { id: "bedroom", kind: "Bedroom", x: 6, z: 0, width: 4, depth: 6 }
  ],
  furniture: [
    { id: "interior-table", kind: "table", x: 0, z: 0, rotation: 0 },
    { id: "interior-bed", kind: "bed", x: 6, z: 1, rotation: Math.PI / 2 }
  ],
  designBudget: 60_000,
  designSpent: 2_000,
  residents: [],
  relationships: []
};
const usableHomeEntrance: AccessibilityEntrance = {
  id: "interior-entrance",
  targetKind: "lot",
  targetId: lot.id,
  position: lot.center,
  stepFree: true,
  doorWidth: 1.05,
  tactileGuidance: true,
  automaticDoor: false
};
const entryStatus = homeEntryStatus(interiorHome, usableHomeEntrance);
check(entryStatus.allowed, "A furnished home with a usable entrance was not enterable.");
check(
  !homeEntryStatus(interiorHome, { ...usableHomeEntrance, stepFree: false }).allowed,
  "A stepped home entrance incorrectly allowed interior entry."
);
check(
  !homeEntryStatus(interiorHome, { ...usableHomeEntrance, doorWidth: .78 }).allowed,
  "A narrow home entrance incorrectly allowed interior entry."
);
const interiorEntry = interiorEntryPoint(interiorHome, { x: -10, z: 0 });
check(Boolean(interiorEntry), "Interior entry did not find a clear floor position.");
check(isInteriorPositionValid(interiorHome, interiorEntry!), "Interior entry landed inside a wall or furnishing.");
check(interiorRoomAt(interiorHome, interiorEntry!)?.id === "living-room", "Interior entry selected the wrong room.");
check(interiorDoorways(interiorHome).length === 1, "Adjacent rooms did not create one connecting doorway.");
check(
  interiorExteriorDoorway(interiorHome, { x: -12, z: 0 })?.roomId === "living-room",
  "The street-facing opening was not assigned to the nearest exterior room wall."
);
const doorwayMove = resolveInteriorMovement(interiorHome, { x: 3.5, z: 0 }, { x: 4.5, z: 0 });
check(!doorwayMove.blocked && doorwayMove.position.x === 4.5, "The player could not walk through a connecting doorway.");
const furnitureMove = resolveInteriorMovement(interiorHome, { x: -2, z: 0 }, { x: 0, z: 0 });
check(furnitureMove.blocked && furnitureMove.position.x !== 0, "Furniture did not block interior walking.");
const wallMove = resolveInteriorMovement(interiorHome, { x: -3, z: 2 }, { x: -5, z: 2 });
check(wallMove.blocked && wallMove.position.x >= -4, "Room walls did not contain interior walking.");
const transformedInteriorPoint = lotLocalToWorld({ x: 2.25, z: -1.5 }, lot);
const restoredInteriorPoint = worldToLotLocal(transformedInteriorPoint, lot);
check(
  Math.hypot(restoredInteriorPoint.x - 2.25, restoredInteriorPoint.z + 1.5) < .0001,
  "Home interior coordinates did not survive the lot rotation transform."
);
const furniturePlacementWorld = new World();
furniturePlacementWorld.homes = [structuredClone(interiorHome)];
const designBudgetBeforePlacement = furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]);
check(
  furniturePlacementWorld.addFurniture(interiorHome.id, "plant", -2, 1),
  "Home Simulator rejected furniture placed inside a room."
);
const placedPlant = furniturePlacementWorld.homes[0].furniture.find(item =>
  item.kind === "plant" && item.x === -2 && item.z === 1
);
check(Boolean(placedPlant), "Home Simulator did not persist newly placed furniture.");
check(
  !furniturePlacementWorld.addFurniture(interiorHome.id, "plant", -2, 1),
  "Home Simulator allowed furnishings to overlap."
);
check(
  furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0])
    === designBudgetBeforePlacement - 120,
  "Furniture placement did not debit the home design budget."
);
check(
  furniturePlacementWorld.moveFurniture(interiorHome.id, placedPlant!.id, -2, -1)
    && placedPlant!.x === -2
    && placedPlant!.z === -1,
  "Selected furniture could not move to a valid position."
);
check(
  !furniturePlacementWorld.moveFurniture(interiorHome.id, placedPlant!.id, 0, 0),
  "Selected furniture moved through another furnishing."
);
check(
  furniturePlacementWorld.rotateFurniture(interiorHome.id, placedPlant!.id)
    && placedPlant!.rotation === Math.PI / 4,
  "Selected furniture did not rotate by 45 degrees."
);
check(
  furniturePlacementWorld.removeFurniture(interiorHome.id, placedPlant!.id)
    && !furniturePlacementWorld.homes[0].furniture.some(item => item.id === placedPlant!.id),
  "Selling selected furniture did not remove it from the home."
);
check(
  furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0])
    === designBudgetBeforePlacement - 60,
  "Selling furniture did not return the expected 50 percent refund."
);
const rotationGuardWorld = new World();
const rotationGuardHome: Home = {
  ...structuredClone(interiorHome),
  id: "rotation-guard-home",
  rooms: [{ id: "rotation-guard-room", kind: "Bedroom", x: 0, z: 0, width: 2.4, depth: 2.4 }],
  furniture: [{ id: "rotation-guard-bed", kind: "bed", x: 0, z: 0, rotation: 0 }]
};
rotationGuardWorld.homes = [rotationGuardHome];
check(
  !rotationGuardWorld.rotateFurniture(rotationGuardHome.id, "rotation-guard-bed")
    && rotationGuardHome.furniture[0].rotation === 0,
  "Furniture rotated through a room wall."
);
check(
  !furniturePlacementWorld.addFurniture(interiorHome.id, "plant", 20, 20),
  "Home Simulator allowed furniture outside every room."
);
const designBudgetBeforeRoom = furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]);
check(
  furniturePlacementWorld.addRoom(interiorHome.id, {
    kind: "Studio",
    x: 0,
    z: 8,
    width: 3,
    depth: 4
  }),
  "Home Simulator rejected an affordable valid room."
);
check(
  furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0])
    === designBudgetBeforeRoom - 2_640,
  "Room construction did not debit its area-based cost."
);
const studio = furniturePlacementWorld.homes[0].rooms.find(room => room.kind === "Studio")!;
const budgetBeforeFinishes = furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]);
check(
  furniturePlacementWorld.setRoomFloorFinish(interiorHome.id, studio.id, "tile")
    && furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]) === budgetBeforeFinishes - 780,
  "Room floor customization did not persist or debit its area-based cost."
);
const budgetBeforeWalls = furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]);
check(
  furniturePlacementWorld.setRoomWallFinish(interiorHome.id, studio.id, "sage")
    && furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]) === budgetBeforeWalls - 314,
  "Room wall customization did not persist or debit its surface cost."
);
const budgetAfterFinishes = furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]);
check(
  !furniturePlacementWorld.setRoomFloorFinish(interiorHome.id, studio.id, "tile")
    && furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]) === budgetAfterFinishes,
  "Reapplying a room finish charged the design budget twice."
);
check(
  furniturePlacementWorld.setRoomKind(interiorHome.id, studio.id, "Study")
    && studio.kind === "Study"
    && furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]) === budgetAfterFinishes,
  "Room purpose editing did not persist as a cost-free semantic change."
);
check(
  !furniturePlacementWorld.setRoomKind(interiorHome.id, studio.id, "Study"),
  "Reapplying a room purpose created a redundant world change."
);
check(
  furniturePlacementWorld.snapshot().homes[0].rooms.find(room => room.id === studio.id)?.floorFinish === "tile"
    && furniturePlacementWorld.snapshot().homes[0].rooms.find(room => room.id === studio.id)?.kind === "Study",
  "Room finishes or purpose were omitted from the world snapshot."
);
check(
  furniturePlacementWorld.addFurniture(interiorHome.id, "plant", studio.x, studio.z),
  "Home Simulator could not furnish a newly drawn room."
);
const studioPlant = furniturePlacementWorld.homes[0].furniture.find(item => item.x === studio.x && item.z === studio.z)!;
const budgetBeforeRoomRemoval = furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]);
check(
  furniturePlacementWorld.removeRoom(interiorHome.id, studio.id)
    && !furniturePlacementWorld.homes[0].rooms.some(room => room.id === studio.id)
    && !furniturePlacementWorld.homes[0].furniture.some(item => item.id === studioPlant.id)
    && furniturePlacementWorld.homeRemainingBudget(furniturePlacementWorld.homes[0]) === budgetBeforeRoomRemoval + 720,
  "Room deletion did not remove exclusive furniture and return the expected partial refund."
);
const finalRoomWorld = new World();
const finalRoomHome = structuredClone(interiorHome);
finalRoomHome.id = "final-room-home";
finalRoomHome.rooms = [finalRoomHome.rooms[0]];
finalRoomWorld.homes = [finalRoomHome];
check(
  !finalRoomWorld.removeRoom(finalRoomHome.id, finalRoomHome.rooms[0].id),
  "Home Simulator allowed deletion of the final room."
);
furniturePlacementWorld.homes[0].designSpent = furniturePlacementWorld.homes[0].designBudget - 100;
check(
  !furniturePlacementWorld.addFurniture(interiorHome.id, "bed", 0, 0),
  "Home Simulator allowed an over-budget furniture purchase."
);
check(
  !furniturePlacementWorld.addRoom(interiorHome.id, {
    kind: "Unaffordable room",
    x: 0,
    z: 14,
    width: 3,
    depth: 4
  }),
  "Home Simulator allowed over-budget room construction."
);
check(
  furniturePlacementWorld.snapshot().homes[0].designBudget === 60_000,
  "Home design budget was omitted from the world snapshot."
);
const catalogWorld = new World();
const catalogHome: Home = {
  ...structuredClone(interiorHome),
  id: "catalog-home",
  rooms: [{ id: "catalog-room", kind: "Studio", x: 0, z: 0, width: 12, depth: 12 }],
  furniture: [],
  designSpent: 0,
  residents: [{
    id: "catalog-resident",
    name: "Casey",
    age: "adult",
    role: "home",
    energy: 58,
    social: 60,
    comfort: 50,
    health: 70,
    stress: 48,
    traits: ["creative", "organized"],
    completedActions: 0
  }],
  relationships: []
};
catalogWorld.homes = [catalogHome];
catalogWorld.clock.minute = 20 * 60;
check(
  catalogWorld.addFurniture(catalogHome.id, "desk", -3, -3)
    && catalogWorld.addFurniture(catalogHome.id, "bookcase", 3, -3)
    && catalogWorld.addFurniture(catalogHome.id, "fridge", -3, 3)
    && catalogWorld.addFurniture(catalogHome.id, "shower", 3, 3),
  "The expanded object catalog could not place its study, kitchen, and bathroom objects."
);
check(
  catalogWorld.homeRemainingBudget(catalogHome) === 60_000 - 4_370,
  "Expanded catalog purchases did not debit the exact design budget."
);
const catalogDesk = catalogHome.furniture.find(item => item.kind === "desk")!;
const budgetBeforeStyle = catalogWorld.homeRemainingBudget(catalogHome);
check(
  catalogWorld.setFurnitureStyle(catalogHome.id, catalogDesk.id, "colorful")
    && catalogDesk.style === "colorful"
    && catalogWorld.homeRemainingBudget(catalogHome) === budgetBeforeStyle,
  "Furniture style customization did not persist as a cost-free cosmetic change."
);
check(
  !catalogWorld.setFurnitureStyle(catalogHome.id, catalogDesk.id, "colorful"),
  "Reapplying the selected furniture style created a redundant world change."
);
check(
  furnitureInteraction("desk").action === "study"
    && furnitureInteraction("bookcase").action === "study"
    && furnitureInteraction("fridge").action === "eat"
    && furnitureInteraction("shower").action === "shower",
  "Expanded catalog objects did not expose their expected resident interactions."
);
check(catalogWorld.setControlledResident("catalog-resident"), "Catalog resident could not enter direct control.");
check(
  catalogWorld.commandResidentFurnitureAction(catalogHome.id, "catalog-resident", catalogDesk.id).ok
    && catalogHome.residents[0].currentAction?.kind === "study",
  "The desk did not start a directed study action."
);
catalogWorld.advanceMinutes(75, 0);
check(
  catalogHome.residents[0].lastActionKind === "study"
    && catalogWorld.residentSkills(catalogHome.residents[0]).creativity === 4
    && catalogWorld.residentSkills(catalogHome.residents[0]).practical === 1,
  "Study did not complete or build the expected persistent skills."
);
const catalogShower = catalogHome.furniture.find(item => item.kind === "shower")!;
const wellnessBeforeShower = catalogWorld.residentSkills(catalogHome.residents[0]).wellness;
check(
  catalogWorld.commandResidentFurnitureAction(catalogHome.id, "catalog-resident", catalogShower.id).ok
    && catalogHome.residents[0].currentAction?.kind === "shower",
  "The shower did not start a directed hygiene action."
);
catalogWorld.advanceMinutes(35, 0);
check(
  catalogHome.residents[0].lastActionKind === "shower"
    && catalogWorld.residentSkills(catalogHome.residents[0]).wellness === wellnessBeforeShower + 3,
  "Showering did not complete or build wellness skill."
);
check(
  catalogWorld.snapshot().homes[0].furniture.some(item => item.kind === "fridge")
    && catalogWorld.snapshot().homes[0].furniture.find(item => item.id === catalogDesk.id)?.style === "colorful",
  "Expanded catalog furniture or its selected style was omitted from the world snapshot."
);
const functionalRoomHome: Home = {
  ...structuredClone(interiorHome),
  id: "functional-room-home",
  rooms: [
    { id: "bedroom-purpose", kind: "Bedroom", x: -10, z: 0, width: 4, depth: 4 },
    { id: "bathroom-purpose", kind: "Bathroom", x: -5, z: 0, width: 4, depth: 4 },
    { id: "kitchen-purpose", kind: "Kitchen", x: 0, z: 0, width: 4, depth: 4 },
    { id: "living-purpose", kind: "Living room", x: 5, z: 0, width: 4, depth: 4 },
    { id: "study-purpose", kind: "Study", x: 10, z: 0, width: 4, depth: 4 }
  ],
  furniture: [
    { id: "purpose-bed", kind: "bed", x: -10, z: 0, rotation: 0 },
    { id: "purpose-shower", kind: "shower", x: -5, z: 0, rotation: 0 },
    { id: "purpose-fridge", kind: "fridge", x: 0, z: 0, rotation: 0 },
    { id: "purpose-sofa", kind: "sofa", x: 5, z: 0, rotation: 0 },
    { id: "purpose-desk", kind: "desk", x: 10, z: 0, rotation: 0 }
  ],
  residents: [],
  relationships: []
};
const mismatchedRoomHome = structuredClone(functionalRoomHome);
mismatchedRoomHome.id = "mismatched-room-home";
mismatchedRoomHome.rooms.forEach(room => { room.kind = "Living room"; });
const functionalRooms = catalogWorld.homeFunctionality(functionalRoomHome);
const mismatchedRooms = catalogWorld.homeFunctionality(mismatchedRoomHome);
check(
  functionalRooms.completeness === 100
    && functionalRooms.alignment === 100
    && catalogWorld.furniturePurposeFit(functionalRoomHome, functionalRoomHome.furniture[1]) === true,
  "Complete purpose-matched rooms did not receive full functional credit."
);
check(
  mismatchedRooms.completeness === 100
    && mismatchedRooms.alignment < functionalRooms.alignment
    && catalogWorld.furniturePurposeFit(mismatchedRoomHome, mismatchedRoomHome.furniture[1]) === false
    && catalogWorld.homeQuality(mismatchedRoomHome) < catalogWorld.homeQuality(functionalRoomHome),
  "Object room mismatch did not reduce semantic alignment and home quality."
);
const autoFurnishWorld = new World();
const autoFurnishHome: Home = {
  ...structuredClone(interiorHome),
  id: "auto-furnish-home",
  rooms: [{ id: "auto-living-room", kind: "Living room", x: 0, z: 0, width: 8, depth: 8 }],
  furniture: [],
  designSpent: 0,
  residents: [],
  relationships: []
};
autoFurnishWorld.homes = [autoFurnishHome];
const autoFurnishResult = autoFurnishWorld.autoFurnishRoom(autoFurnishHome.id, "auto-living-room");
check(
  autoFurnishResult.placed === 3
    && autoFurnishResult.spent === 2_170
    && autoFurnishResult.skipped === 0
    && autoFurnishHome.furniture.map(item => item.kind).sort().join(",") === "plant,sofa,table",
  "One-click furnishing did not place the complete Living room starter set at exact cost."
);
check(
  autoFurnishHome.furniture.every(item =>
    autoFurnishWorld.canPlaceFurniture(autoFurnishHome, item.kind, item.x, item.z, item.rotation, item.id)
    && autoFurnishWorld.furniturePurposeFit(autoFurnishHome, item) === true
  ),
  "One-click furnishing placed an overlapping, wall-crossing, or purpose-mismatched object."
);
const repeatedAutoFurnish = autoFurnishWorld.autoFurnishRoom(autoFurnishHome.id, "auto-living-room");
check(
  repeatedAutoFurnish.placed === 0
    && repeatedAutoFurnish.spent === 0
    && autoFurnishHome.designSpent === 2_170,
  "Repeated one-click furnishing duplicated objects or charged the budget twice."
);
const constrainedAutoHome = structuredClone(autoFurnishHome);
constrainedAutoHome.id = "constrained-auto-home";
constrainedAutoHome.furniture = [];
constrainedAutoHome.designSpent = constrainedAutoHome.designBudget - 100;
autoFurnishWorld.homes = [constrainedAutoHome];
check(
  autoFurnishWorld.autoFurnishRoom(constrainedAutoHome.id, "auto-living-room").placed === 0
    && constrainedAutoHome.furniture.length === 0,
  "One-click furnishing exceeded the remaining design budget."
);
const purchaseWorld = new World();
const purchaseHome: Home = {
  ...structuredClone(interiorHome),
  id: "purchase-home",
  householdFunds: 500,
  discretionarySpent: 0,
  residents: [{
    id: "purchase-resident",
    name: "Riley",
    age: "adult",
    role: "home",
    energy: 50,
    social: 60,
    comfort: 50,
    health: 60,
    stress: 55,
    traits: ["creative", "active"],
    completedActions: 0
  }],
  relationships: []
};
purchaseWorld.homes = [purchaseHome];
const purchaseDesignBudget = purchaseWorld.homeRemainingBudget(purchaseHome);
check(
  purchaseWorld.purchaseForResident(purchaseHome.id, "purchase-resident", "meal-delivery").ok
    && purchaseWorld.homeHouseholdFunds(purchaseHome) === 465
    && purchaseWorld.homeRemainingBudget(purchaseHome) === purchaseDesignBudget
    && purchaseHome.residents[0].energy === 62
    && purchaseWorld.residentSkills(purchaseHome.residents[0]).practical === 1,
  "Meal delivery did not debit household funds separately or apply resident effects."
);
check(
  purchaseWorld.purchaseForResident(purchaseHome.id, "purchase-resident", "creative-supplies").ok
    && purchaseHome.discretionarySpent === 125
    && purchaseHome.residents[0].stress === 45
    && purchaseWorld.residentSkills(purchaseHome.residents[0]).creativity === 5,
  "Creative supplies did not persist spending, calm, and skill effects."
);
check(
  purchaseWorld.purchaseForResident(purchaseHome.id, "purchase-resident", "wellness-care").ok
    && purchaseHome.residents[0].health === 71
    && purchaseHome.residents[0].stress === 31
    && purchaseWorld.residentSkills(purchaseHome.residents[0]).wellness === 4,
  "Wellness care did not apply health, calm, and skill effects."
);
const purchaseSnapshot = purchaseWorld.snapshot().homes[0];
check(
  purchaseSnapshot.discretionarySpent === 245
    && purchaseSnapshot.lastPurchase?.kind === "wellness-care"
    && purchaseSnapshot.lastPurchase?.cost === 120,
  "Household discretionary spending history was omitted from the snapshot."
);
purchaseHome.householdFunds = 20;
const healthBeforeRejectedPurchase = purchaseHome.residents[0].health;
check(
  !purchaseWorld.purchaseForResident(purchaseHome.id, "purchase-resident", "wellness-care").ok
    && purchaseHome.residents[0].health === healthBeforeRejectedPurchase,
  "An unaffordable household purchase changed resident state."
);
const residentCreatorWorld = new World();
const residentCreatorHome = structuredClone(interiorHome);
residentCreatorHome.id = "resident-creator-home";
residentCreatorHome.name = "New household";
residentCreatorWorld.homes = [residentCreatorHome];
check(
  residentCreatorWorld.addResident(residentCreatorHome.id, {
    name: "Morgan Lee",
    age: "adult",
    role: "office",
    traits: ["creative", "organized"]
  }),
  "Resident creator rejected a valid authored profile."
);
check(
  residentCreatorHome.residents[0].name === "Morgan Lee"
    && residentCreatorHome.residents[0].role === "office"
    && residentCreatorHome.residents[0].traits.join(",") === "creative,organized"
    && residentCreatorHome.name === "Morgan Lee's household",
  "Resident creator did not preserve the authored profile or household name."
);
check(
  !residentCreatorWorld.addResident(residentCreatorHome.id, {
    name: "morgan lee",
    age: "adult",
    role: "home",
    traits: ["active", "homebody"]
  }),
  "Resident creator allowed a duplicate case-insensitive name."
);
check(
  !residentCreatorWorld.addResident(residentCreatorHome.id, {
    name: "<script>",
    age: "adult",
    role: "home",
    traits: ["active", "homebody"]
  }),
  "Resident creator accepted unsafe name markup."
);
check(
  !residentCreatorWorld.addResident(residentCreatorHome.id, {
    name: "Taylor",
    age: "adult",
    role: "home",
    traits: ["active"]
  }),
  "Resident creator accepted a profile without exactly two traits."
);
check(
  residentCreatorWorld.addResident(residentCreatorHome.id, {
    name: "Riley",
    age: "child",
    role: "service",
    traits: ["outgoing", "empathetic"]
  })
    && residentCreatorHome.residents[1].role === "student"
    && residentCreatorHome.relationships.length === 1,
  "Child profile did not normalize to student or create a household relationship."
);
check(
  residentCreatorWorld.snapshot().homes[0].residents[0].traits.join(",") === "creative,organized",
  "Authored resident profile was omitted from the world snapshot."
);
residentCreatorHome.residents[0].careerXp = 38;
residentCreatorWorld.advanceMinutes(24 * 60, 0);
check(
  residentCreatorWorld.residentCareerLevel(residentCreatorHome.residents[0]) === 2
    && residentCreatorWorld.residentCareerTitle(residentCreatorHome.residents[0]) === "Associate"
    && residentCreatorWorld.residentSkills(residentCreatorHome.residents[0]).communication === 1
    && residentCreatorHome.lastDailyIncome === 280
    && residentCreatorHome.lastDailyExpenses === 132
    && residentCreatorWorld.homeHouseholdFunds(residentCreatorHome) === 15_148,
  "A completed workday did not advance career skills or settle household finances."
);
check(
  residentCreatorWorld.snapshot().homes[0].householdFunds === 15_148,
  "Household finances were omitted from the world snapshot."
);
residentCreatorHome.householdFunds = -50_000;
residentCreatorHome.lastDailyIncome = 0;
residentCreatorHome.lastDailyExpenses = 200;
check(
  residentCreatorWorld.residentWellbeing(residentCreatorHome.residents[0]).pressure === "Household financial pressure",
  "Household debt did not feed back into resident wellbeing pressure."
);
const directControlWorld = new World();
const directControlHome = structuredClone(interiorHome);
directControlHome.residents = [{
  id: "controlled-resident",
  name: "Avery",
  age: "adult",
  role: "home",
  energy: 50,
  social: 50,
  comfort: 50,
  health: 70,
  stress: 45,
  traits: ["outgoing", "empathetic"],
  completedActions: 0
}, {
  id: "conversation-partner",
  name: "Jordan",
  age: "adult",
  role: "home",
  energy: 62,
  social: 40,
  comfort: 65,
  health: 76,
  stress: 38,
  traits: ["creative", "empathetic"],
  completedActions: 0,
  homePosition: { x: -.5, z: 0 }
}];
directControlHome.relationships = [{
  residentIds: ["controlled-resident", "conversation-partner"],
  score: 55,
  conversations: 0
}];
const directControlBaseline = structuredClone(directControlHome);
directControlWorld.homes = [directControlHome];
check(
  furnitureInteraction("table").action === "eat",
  "Table interaction did not map to the meal action."
);
const nearbyTable = nearestInteriorFurniture(directControlHome, { x: -2, z: 0 }, 2.5);
check(nearbyTable?.item.kind === "table", "Direct control did not find the nearby table.");
check(directControlWorld.setControlledResident("controlled-resident"), "Resident could not enter direct-control state.");
check(
  directControlWorld.setResidentHomePosition(directControlHome.id, "controlled-resident", { x: -2, z: 0 }),
  "Controlled resident position was not accepted."
);
const directedMeal = directControlWorld.commandResidentFurnitureAction(
  directControlHome.id,
  "controlled-resident",
  nearbyTable!.item.id
);
check(directedMeal.ok, "Controlled resident could not start a furniture interaction.");
check(
  Boolean(
    directControlHome.residents[0].currentAction?.kind === "eat"
      && directControlHome.residents[0].currentAction?.directed
  ),
  "Furniture interaction did not create a directed persistent action."
);
check(
  directControlWorld.snapshot().homes[0].residents[0].homePosition?.x === -2,
  "Controlled resident position was not included in the world snapshot."
);
directControlWorld.advanceMinutes(45, 0);
check(
  directControlHome.residents[0].lastActionKind === "eat"
    && directControlHome.residents[0].completedActions === 1
    && directControlHome.residents[0].energy === 58,
  "Directed meal did not complete through the shared resident need system."
);
directControlWorld.clock.minute = 10 * 60 + 45;
const directedRelationshipGain = directControlWorld.conversationRelationshipGain(
  directControlHome.residents[0],
  directControlHome.residents[1],
  true
);
const directedConversation = directControlWorld.commandResidentConversation(
  directControlHome.id,
  "controlled-resident",
  "conversation-partner",
  "chat"
);
check(directedConversation.ok, "Nearby residents could not start a directed conversation.");
check(
  directControlHome.residents.every(resident =>
    resident.currentAction?.kind === "socialize"
      && resident.currentAction?.directed
      && resident.currentAction?.conversationIntent === "chat"
      && Boolean(resident.currentAction?.partnerResidentId)
  ),
  "Conversation did not create paired resident actions."
);
directControlWorld.advanceMinutes(60, 0);
const completedRelationship = directControlWorld.relationshipBetween(
  directControlHome,
  "controlled-resident",
  "conversation-partner"
);
check(
  completedRelationship?.score === 55 + directedRelationshipGain
    && completedRelationship.conversations === 1
    && completedRelationship.lastInteractionAt === directControlWorld.clock.elapsedMinutes,
  "Completed conversation did not improve and persist the household relationship."
);
check(
  directControlHome.residents[0].social === 70
    && directControlHome.residents[1].social === 60
    && directControlHome.residents[0].lastActionKind === "socialize"
    && directControlHome.residents[1].lastActionKind === "socialize",
  "Conversation did not apply social need effects to both residents."
);
check(
  completedRelationship?.lastIntent === "chat"
    && completedRelationship.lastChange === directedRelationshipGain,
  "Completed conversation did not persist its intent and relationship outcome."
);
check(
  directControlWorld.residentSkills(directControlHome.residents[0]).communication === 2
    && directControlWorld.residentSkills(directControlHome.residents[0]).practical === 2
    && directControlWorld.residentSkills(directControlHome.residents[1]).communication === 2,
  "Completed household actions did not build persistent resident skills."
);
check(
  directControlWorld.snapshot().homes[0].residents[0].skills?.communication === 2,
  "Resident skill progress was omitted from the world snapshot."
);
check(
  directControlWorld.clock.minute === 11 * 60 + 45
    && directControlWorld.residentStatus(directControlHome.residents[0]) === "Out in city",
  "Directed conversation did not finish cleanly across a normal schedule boundary."
);

function runConversationIntentProbe(intent: ConversationIntent, initialTension = 0) {
  const world = new World();
  const home = structuredClone(directControlBaseline);
  home.relationships[0].tension = initialTension;
  home.relationships[0].conflicts = initialTension > 0 ? 1 : 0;
  world.homes = [home];
  world.clock.minute = 20 * 60;
  world.setControlledResident("controlled-resident");
  const first = home.residents[0];
  const second = home.residents[1];
  const expectedChange = world.conversationRelationshipChange(
    first,
    second,
    intent,
    true,
    initialTension
  );
  const started = world.commandResidentConversation(
    home.id,
    first.id,
    second.id,
    intent
  );
  check(started.ok, `${world.conversationIntentLabel(intent)} could not start.`);
  check(
    home.residents.every(resident => resident.currentAction?.conversationIntent === intent),
    `${world.conversationIntentLabel(intent)} was not attached to both paired actions.`
  );
  world.advanceMinutes({ chat: 60, support: 55, joke: 40, confront: 35, apologize: 45 }[intent], 0);
  return {
    first,
    second,
    relationship: world.relationshipBetween(home, first.id, second.id),
    expectedChange
  };
}

const supportProbe = runConversationIntentProbe("support");
check(
  supportProbe.first.social === 62
    && supportProbe.first.stress === 37
    && supportProbe.second.social === 52
    && supportProbe.second.stress === 22
    && supportProbe.relationship?.lastIntent === "support"
    && supportProbe.relationship.lastChange === supportProbe.expectedChange,
  "Offer Support did not apply its distinct social, calm, and relationship effects."
);
const jokeProbe = runConversationIntentProbe("joke");
check(
  jokeProbe.first.social === 66
    && jokeProbe.first.stress === 35
    && jokeProbe.second.social === 56
    && jokeProbe.second.stress === 28
    && jokeProbe.relationship?.lastIntent === "joke"
    && jokeProbe.relationship.lastChange === jokeProbe.expectedChange,
  "Tell a Joke did not apply its distinct social, calm, and relationship effects."
);
const confrontProbe = runConversationIntentProbe("confront");
check(
  confrontProbe.first.social === 44
    && confrontProbe.first.stress === 54
    && confrontProbe.second.social === 34
    && confrontProbe.second.stress === 52
    && confrontProbe.relationship?.score === 55 + confrontProbe.expectedChange
    && confrontProbe.relationship.lastIntent === "confront"
    && confrontProbe.relationship.lastChange === confrontProbe.expectedChange
    && confrontProbe.relationship.tension === 30
    && confrontProbe.relationship.conflicts === 1
    && confrontProbe.relationship.memories?.[0].intent === "confront"
    && confrontProbe.relationship.memories[0].tensionChange === 30
    && confrontProbe.expectedChange < 0,
  "Confront did not create its intended relationship loss and stress tradeoff."
);
const apologyProbe = runConversationIntentProbe("apologize", 55);
check(
  apologyProbe.first.social === 58
    && apologyProbe.first.stress === 33
    && apologyProbe.second.social === 48
    && apologyProbe.second.stress === 20
    && apologyProbe.relationship?.score === 55 + apologyProbe.expectedChange
    && apologyProbe.relationship.lastIntent === "apologize"
    && apologyProbe.relationship.lastChange === apologyProbe.expectedChange
    && apologyProbe.relationship.tension === 15
    && apologyProbe.relationship.conflicts === 1
    && apologyProbe.relationship.resolvedConflicts === 1
    && apologyProbe.relationship.lastReconciledAt !== undefined
    && apologyProbe.relationship.memories?.[0].intent === "apologize"
    && apologyProbe.relationship.memories[0].tensionChange === -40,
  "Apologize did not repair tension, preserve conflict history, and record reconciliation."
);
const autonomousRepairWorld = new World();
const autonomousRepairHome = structuredClone(directControlBaseline);
autonomousRepairHome.residents[0].social = 8;
autonomousRepairHome.residents[0].stress = 18;
autonomousRepairHome.relationships[0].tension = 55;
autonomousRepairHome.relationships[0].conflicts = 1;
autonomousRepairWorld.homes = [autonomousRepairHome];
autonomousRepairWorld.clock.minute = 20 * 60;
const autonomousApologyGain = autonomousRepairWorld.conversationRelationshipChange(
  autonomousRepairHome.residents[0],
  autonomousRepairHome.residents[1],
  "apologize",
  false,
  55
);
autonomousRepairWorld.advanceMinutes(1, 0);
check(
  autonomousRepairHome.residents[0].currentAction?.kind === "socialize"
    && autonomousRepairHome.residents[0].currentAction?.conversationIntent === "apologize"
    && autonomousRepairHome.residents[1].currentAction?.conversationIntent === "apologize",
  "An empathetic resident did not autonomously attempt to repair a tense relationship."
);
autonomousRepairWorld.setControlledResident("controlled-resident");
autonomousRepairWorld.advanceMinutes(45, 0);
const autonomouslyRepairedRelationship = autonomousRepairWorld.relationshipBetween(
  autonomousRepairHome,
  "controlled-resident",
  "conversation-partner"
);
check(
  autonomouslyRepairedRelationship?.score === 55 + autonomousApologyGain
    && autonomouslyRepairedRelationship.tension === 15
    && autonomouslyRepairedRelationship.resolvedConflicts === 1
    && autonomouslyRepairedRelationship.memories?.[0].intent === "apologize",
  "Autonomous apology did not complete through the shared reconciliation system."
);
check(
  directControlWorld.snapshot().homes[0].relationships[0].score === 55 + directedRelationshipGain,
  "Household relationship was not included in the world snapshot."
);
const autonomousSocialWorld = new World();
const autonomousSocialHome = structuredClone(interiorHome);
autonomousSocialHome.residents = [{
  id: "autonomous-outgoing",
  name: "Maya",
  age: "adult",
  role: "home",
  energy: 88,
  social: 8,
  comfort: 84,
  health: 86,
  stress: 18,
  traits: ["outgoing", "empathetic"],
  completedActions: 0
}, {
  id: "compatible-partner",
  name: "Sofia",
  age: "adult",
  role: "home",
  energy: 84,
  social: 56,
  comfort: 80,
  health: 82,
  stress: 20,
  traits: ["outgoing", "empathetic"],
  completedActions: 0
}, {
  id: "mismatched-partner",
  name: "Theo",
  age: "adult",
  role: "home",
  energy: 84,
  social: 56,
  comfort: 80,
  health: 82,
  stress: 20,
  traits: ["homebody", "organized"],
  completedActions: 0
}];
autonomousSocialHome.relationships = [{
  residentIds: ["autonomous-outgoing", "compatible-partner"],
  score: 72,
  conversations: 0
}, {
  residentIds: ["autonomous-outgoing", "mismatched-partner"],
  score: 72,
  conversations: 0
}, {
  residentIds: ["compatible-partner", "mismatched-partner"],
  score: 52,
  conversations: 0
}];
autonomousSocialWorld.homes = [autonomousSocialHome];
autonomousSocialWorld.clock.minute = 20 * 60;
autonomousSocialWorld.advanceMinutes(1, 0);
check(
  autonomousSocialHome.residents[0].currentAction?.kind === "socialize"
    && autonomousSocialHome.residents[0].currentAction?.partnerResidentId === "compatible-partner"
    && autonomousSocialHome.residents[0].currentAction?.conversationIntent === "chat"
    && autonomousSocialHome.residents[1].currentAction?.partnerResidentId === "autonomous-outgoing",
  "Outgoing resident did not reserve the more compatible autonomous conversation partner."
);
check(
  autonomousSocialWorld.relationshipCompatibility(
    autonomousSocialHome.residents[0],
    autonomousSocialHome.residents[1]
  ) > autonomousSocialWorld.relationshipCompatibility(
    autonomousSocialHome.residents[0],
    autonomousSocialHome.residents[2]
  ),
  "Personality compatibility did not distinguish a natural match from a mismatched pair."
);
const autonomousRelationshipGain = autonomousSocialWorld.conversationRelationshipGain(
  autonomousSocialHome.residents[0],
  autonomousSocialHome.residents[1],
  false
);
autonomousSocialWorld.setControlledResident("autonomous-outgoing");
autonomousSocialWorld.advanceMinutes(60, 0);
const autonomousRelationship = autonomousSocialWorld.relationshipBetween(
  autonomousSocialHome,
  "autonomous-outgoing",
  "compatible-partner"
);
check(
  autonomousRelationship?.score === 72 + autonomousRelationshipGain
    && autonomousRelationship.conversations === 1
    && autonomousSocialHome.residents[0].lastActionKind === "socialize"
    && autonomousSocialHome.residents[1].lastActionKind === "socialize",
  "Paired autonomous conversation did not complete through the relationship system."
);
check(
  autonomousSocialWorld.snapshot().homes[0].residents[0].traits.join(",") === "outgoing,empathetic",
  "Resident personality traits were not included in the world snapshot."
);
const learnedPreferenceWorld = new World();
const learnedPreferenceHome = structuredClone(autonomousSocialHome);
learnedPreferenceHome.id = "learned-preference-home";
learnedPreferenceHome.residents.forEach(resident => {
  resident.currentAction = undefined;
  resident.lastActionAt = undefined;
});
learnedPreferenceHome.residents[0].social = 4;
learnedPreferenceHome.relationships[0].memories = [{
  intent: "support",
  relationshipChange: 11,
  tensionChange: -12,
  occurredAt: 200,
  initiatorResidentId: "autonomous-outgoing"
}, {
  intent: "support",
  relationshipChange: 9,
  tensionChange: -10,
  occurredAt: 140,
  initiatorResidentId: "autonomous-outgoing"
}, {
  intent: "confront",
  relationshipChange: -5,
  tensionChange: 30,
  occurredAt: 80,
  initiatorResidentId: "autonomous-outgoing"
}];
learnedPreferenceWorld.homes = [learnedPreferenceHome];
learnedPreferenceWorld.clock.minute = 20 * 60;
const learnedPreference = learnedPreferenceWorld.residentLearnedPreferences(
  learnedPreferenceHome,
  learnedPreferenceHome.residents[0]
);
check(
  learnedPreference.preferredIntent === "support"
    && learnedPreference.avoidedIntent === "confront"
    && learnedPreference.evidenceCount === 3
    && learnedPreferenceWorld.residentPreferenceSummary(
      learnedPreferenceHome,
      learnedPreferenceHome.residents[0]
    ).includes("Prefers Offer Support"),
  "Repeated social memories did not form a readable resident preference."
);
learnedPreferenceWorld.advanceMinutes(1, 0);
check(
  learnedPreferenceHome.residents[0].currentAction?.kind === "socialize"
    && learnedPreferenceHome.residents[0].currentAction?.conversationIntent === "support",
  "A learned social preference did not influence autonomous conversation choice."
);
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
const spatialChunks = mobilityWorld.refreshSpatialChunks();
const chunkLotIds = spatialChunks.flatMap(chunk => chunk.lotIds);
check(spatialChunks.length > 1, "NYC template did not divide into multiple spatial chunks.");
check(
  new Set(chunkLotIds).size === mobilityWorld.lots.length
    && chunkLotIds.length === mobilityWorld.lots.length,
  "Spatial chunks did not assign every lot exactly once."
);
check(
  spatialChunks.reduce((total, chunk) => total + chunk.population, 0)
    === mobilityWorld.cityEconomy().population,
  "Spatial chunk population aggregates did not match the city economy."
);
const nearSpatialLod = mobilityWorld.spatialLodSummary({ x: 0, z: 0 });
const farSpatialLod = mobilityWorld.spatialLodSummary({ x: 1_000_000, z: 1_000_000 });
check(
  nearSpatialLod.agentChunks > 0
    && farSpatialLod.aggregateChunks === spatialChunks.length
    && farSpatialLod.aggregatePopulation === mobilityWorld.cityEconomy().population,
  "Spatial LOD did not switch between focused agent detail and distant aggregates."
);
const spatialSnapshot = mobilityWorld.snapshot();
check(
  spatialSnapshot.spatialChunkSize === 256
    && spatialSnapshot.spatialChunks?.length === spatialChunks.length
    && spatialSnapshot.spatialChunks.flatMap(chunk => chunk.lotIds).length === mobilityWorld.lots.length,
  "Spatial chunk metadata was not persisted in the world snapshot."
);
const curbWorld = new World();
const managedCurb = curbWorld.parking.find(item => item.kind === "curb")!;
check(
  curbWorld.parking.some(item => item.curbUse === "loading")
    && curbWorld.parking.some(item => item.curbUse === "event"),
  "NYC template did not create loading and event curb rules."
);
check(
  curbWorld.setCurbRule(managedCurb.id, "loading", "business-hours"),
  "Curb facility could not receive a timed loading rule."
);
check(
  curbWorld.curbEffectiveUse(managedCurb, 2 * 60) === "parking"
    && curbWorld.curbEffectiveUse(managedCurb, 8 * 60) === "loading",
  "Business-hours curb rule did not return to flexible parking off hours."
);
check(
  curbWorld.setCurbRule(managedCurb.id, "loading", "all-day"),
  "Curb facility could not be converted to all-day loading."
);
check(curbWorld.curbRuleActive(managedCurb, 2 * 60), "All-day curb rule was not active overnight.");
check(
  curbWorld.curbEffectiveUse(managedCurb, 8 * 60) === "loading"
    && !curbWorld.parkingPermitted(managedCurb, 8 * 60),
  "Active loading rule did not disallow public parking."
);
check(curbWorld.curbLoadingDemand(managedCurb, 8 * 60) > 0, "Curb loading demand did not respond to nearby businesses.");
curbWorld.advanceMinutes(60, curbWorld.cityEconomy().monthlyBalance);
check(
  (managedCurb.deliveriesServed ?? 0) > 0 && (managedCurb.curbRevenue ?? 0) > 0,
  "Hourly curb simulation did not serve deliveries or collect loading revenue."
);
check(
  curbWorld.setCurbRule(managedCurb.id, "event", "all-day"),
  "Curb facility could not be converted to a special-event restriction."
);
check(
  !curbWorld.parkPlayerVehicle(managedCurb.id, managedCurb.position, managedCurb.rotation),
  "Player vehicle parked inside an active special-event restriction."
);
const curbViolationsBefore = managedCurb.violations ?? 0;
curbWorld.advanceMinutes(180, curbWorld.cityEconomy().monthlyBalance);
check(
  (managedCurb.violations ?? 0) > curbViolationsBefore,
  "Special-event curb enforcement did not record violations."
);
const curbEconomy = curbWorld.cityEconomy();
check(
  curbEconomy.curbRevenue > 0
    && curbEconomy.curbCosts > 0
    && curbEconomy.curbDeliveries >= (managedCurb.deliveriesServed ?? 0)
    && curbEconomy.curbViolations >= (managedCurb.violations ?? 0),
  "Curb operations were not included in the city economy."
);
const curbSnapshot = curbWorld.snapshot().parking?.find(item => item.id === managedCurb.id);
check(
  curbSnapshot?.curbUse === "event"
    && curbSnapshot.curbSchedule === "all-day"
    && curbSnapshot.deliveriesServed === managedCurb.deliveriesServed
    && curbSnapshot.violations === managedCurb.violations,
  "Curb rules, deliveries, and enforcement were not included in the world snapshot."
);
const eventWorld = new World();
check(eventWorld.cityEvents.length === 1, "NYC template did not create its named city event.");
const cityEvent = eventWorld.cityEvents[0];
const eventCurb = eventWorld.addCurbZone(cityEvent.position, 0, "parking", "all-day");
const eventLine = eventWorld.transitLines[0];
const eventStop = [...eventLine.stops].sort((a, b) =>
  Math.hypot(a.position.x - cityEvent.position.x, a.position.z - cityEvent.position.z)
  - Math.hypot(b.position.x - cityEvent.position.x, b.position.z - cityEvent.position.z)
)[0];
const transitDemandWithoutEvent = eventWorld.transitStopDemand(eventLine, eventStop, 18 * 60, -1);
check(!eventWorld.cityEventActiveAt(cityEvent), "Template city event started before its scheduled time.");
check(eventWorld.parkingPermitted(eventCurb), "Scheduled city event restricted its curb before starting.");
check(
  cityEvent.roadId === eventLine.roadId
    && Boolean(cityEvent.closureRoadIds?.includes(eventLine.roadId ?? ""))
    && cityEvent.temporaryTransitLineId === eventLine.id,
  "Template city event did not bind its road closure and temporary transit service."
);
check(
  eventWorld.transitEffectiveHeadway(eventLine) === eventLine.headwayMinutes,
  "Scheduled temporary transit service started before its event."
);
eventWorld.advanceMinutes(cityEvent.startAt, eventWorld.cityEconomy().monthlyBalance);
check(eventWorld.cityEventActiveAt(cityEvent), "Named city event did not activate on schedule.");
check(eventWorld.cityEventTrafficPressure() > 0, "Active city event did not add traffic pressure.");
check(
  eventWorld.cityEventClosedRoads().some(road => road.id === cityEvent.roadId)
    && eventWorld.cityEventRoadClosure(cityEvent.roadId ?? "")?.id === cityEvent.id
    && eventWorld.cityEventRouteClosurePenalty(eventLine.route) >= 12,
  "Active city event did not close its road or delay intersecting routes."
);
check(
  eventWorld.transitEffectiveHeadway(eventLine) === cityEvent.temporaryTransitHeadwayMinutes
    && eventWorld.transitActiveFleetSize(eventLine) > transitFleetSize(eventLine),
  "Active city event did not add temporary transit frequency and vehicles."
);
check(
  eventWorld.curbEffectiveUse(eventCurb) === "event" && !eventWorld.parkingPermitted(eventCurb),
  "Active city event did not place its nearby curb under event control."
);
const closedEventRoad = eventWorld.roads.find(road => cityEvent.closureRoadIds?.includes(road.id));
check(
  Boolean(closedEventRoad && eventWorld.roadTrafficPressure(closedEventRoad) === 1),
  "Traffic planning pressure did not mark an active road closure as severe."
);
check(
  eventWorld.roads.every(road => {
    const pressure = eventWorld.roadTrafficPressure(road);
    return Number.isFinite(pressure) && pressure >= 0 && pressure <= 1;
  }),
  "Traffic planning pressure left its normalized zero-to-one range."
);
const transitDemandWithEvent = eventWorld.transitStopDemand(
  eventLine,
  eventStop,
  eventWorld.clock.minute,
  eventWorld.clock.elapsedMinutes
);
check(
  transitDemandWithEvent > transitDemandWithoutEvent,
  "Active city event did not increase nearby transit demand."
);
check(
  cityEvent.occurrences === 1 && cityEvent.totalAttendance > 0 && cityEvent.revenue > 0,
  "City event occurrence did not record attendance and revenue."
);
const recurringEventPressure = eventWorld.cityEventTrafficPressure();
const recurringEventEconomy = eventWorld.cityEconomy();
check(
  eventWorld.cityEventActiveAt(cityEvent, cityEvent.startAt + cityEvent.intervalMinutes + 1),
  "Recurring city event did not reactivate in the next monthly interval."
);
const concert = eventWorld.addCityEvent("concert", cityEvent.position, "now");
check(
  concert.name.endsWith("Live")
    && eventWorld.cityEventActiveAt(concert)
    && Boolean(concert.roadId)
    && Boolean(concert.closureRoadIds?.length)
    && Boolean(concert.temporaryTransitLineId),
  "Builder-created city event was not named, activated, or connected to street operations."
);
const eventEconomy = eventWorld.cityEconomy();
check(
  eventEconomy.eventRevenue > 0
    && eventEconomy.eventCosts > 0
    && eventEconomy.eventAttendance === cityEvent.totalAttendance
    && eventEconomy.activeEvents === 2,
  "Named city events were not included in the city economy."
);
const eventSnapshot = eventWorld.snapshot().cityEvents?.find(item => item.id === cityEvent.id);
check(
  eventSnapshot?.kind === "market"
    && eventSnapshot.occurrences === cityEvent.occurrences
    && eventSnapshot.totalAttendance === cityEvent.totalAttendance
    && eventSnapshot.revenue === cityEvent.revenue
    && eventSnapshot.roadId === cityEvent.roadId
    && eventSnapshot.closureRoadIds?.join(",") === cityEvent.closureRoadIds?.join(",")
    && eventSnapshot.temporaryTransitLineId === cityEvent.temporaryTransitLineId
    && eventSnapshot.temporaryTransitHeadwayMinutes === cityEvent.temporaryTransitHeadwayMinutes,
  "City event schedule, operations, attendance, and revenue were not included in the world snapshot."
);
check(
  eventWorld.transitEffectiveHeadway(
    eventLine,
    cityEvent.startAt + cityEvent.durationMinutes + 1
  ) === eventLine.headwayMinutes
    && !eventWorld.cityEventRoadClosure(
      cityEvent.roadId ?? "",
      cityEvent.startAt + cityEvent.durationMinutes + 1
    ),
  "Road closure or temporary transit service continued after the city event ended."
);
const zonedLots = mobilityWorld.lots.filter(item => item.zone !== "unassigned");
const lotEntrances = mobilityWorld.accessibilityEntrances.filter(item => item.targetKind === "lot");
check(lotEntrances.length === zonedLots.length, "Every developed parcel did not receive a street entrance.");
check(
  mobilityWorld.accessibilityEntrances.some(item => item.targetKind === "park")
    && mobilityWorld.accessibilityEntrances.some(item => item.targetKind === "transit"),
  "Park and transit entrances were not generated."
);
const accessibilityDestinations = mobilityWorld.accessibilityDestinations();
for (const kind of ["home", "business", "park", "transit"] as const) {
  check(
    accessibilityDestinations.some(destination => destination.kind === kind),
    `${kind} accessibility destination was not generated.`
  );
}
const nearestHome = nearestAccessibilityDestination(accessibilityDestinations, { x: 0, z: 0 }, "home");
check(nearestHome?.destination.kind === "home", "Destination lookup did not respect the requested category.");
const upgradeEntrance = mobilityWorld.accessibilityEntrances.find(
  entrance => !mobilityWorld.entranceHasUniversalAccess(entrance)
);
check(Boolean(upgradeEntrance), "Accessibility upgrade test could not find an incomplete entrance.");
const upgradeCost = mobilityWorld.accessibilityUpgradeCost(upgradeEntrance!);
const treasuryBeforeUpgrade = mobilityWorld.clock.treasury;
check(mobilityWorld.upgradeAccessibility(upgradeEntrance!.id), "Accessibility entrance could not be upgraded.");
check(
  mobilityWorld.entranceHasUniversalAccess(upgradeEntrance!)
    && mobilityWorld.clock.treasury === treasuryBeforeUpgrade - upgradeCost,
  "Accessibility upgrade did not install full access or charge the treasury."
);
check(
  Boolean(mobilityWorld.snapshot().accessibilityEntrances?.find(
    item => item.id === upgradeEntrance!.id
  )?.tactileGuidance),
  "Accessibility entrance improvements were not included in the world snapshot."
);
const transitLine = mobilityWorld.transitLines[0];
check(transitLine.route.length >= 8, "Transit line route geometry is incomplete.");
check(transitLine.stops.length >= 4, "Transit line did not create enough curbside stops.");
check(
  transitLine.headwayMinutes === 10
    && transitLine.fare === 2.75
    && transitLine.vehicleCapacity === 48,
  "Transit line did not receive its default operating plan."
);
const transitDemandBeforeTransfer = mobilityWorld.transitLineDemand(transitLine, 8 * 60, -1);
const secondaryTransitRoad = mobilityWorld.roads.find(
  road => road.id !== transitLine.roadId && road.points.length > 1
);
const secondaryTransitLine = secondaryTransitRoad
  ? mobilityWorld.addTransitLine(secondaryTransitRoad.id)
  : undefined;
check(
  Boolean(
    secondaryTransitLine
      && mobilityWorld.transitLines.length === 2
      && secondaryTransitLine.roadId === secondaryTransitRoad?.id
      && secondaryTransitLine.route.length >= 8
      && secondaryTransitLine.stops.length >= 4
      && secondaryTransitLine.color !== transitLine.color
  ),
  "Additional transit line did not receive its own road route, stops, identity, and color."
);
const transitTransfers = mobilityWorld.transitTransfersForLine(transitLine);
check(
  Boolean(
    secondaryTransitLine
      && transitTransfers.some(transfer => transfer.lineId === secondaryTransitLine.id && transfer.distance <= 55)
      && mobilityWorld.transitLineDemand(transitLine, 8 * 60, -1) > transitDemandBeforeTransfer
  ),
  "Intersecting transit routes did not create a transfer or increase connected demand."
);
check(
  Boolean(
    secondaryTransitLine
      && mobilityWorld.setTransitLineName(secondaryTransitLine.id, "Crosstown Connector")
      && secondaryTransitLine.name === "Crosstown Connector"
      && mobilityWorld.transitTransfersForLine(transitLine)[0]?.lineName === "Crosstown Connector"
  ),
  "Transit line renaming did not update transfer identity."
);
check(
  Boolean(
    secondaryTransitLine
      && !mobilityWorld.setTransitLineName(secondaryTransitLine.id, transitLine.name)
      && !mobilityWorld.setTransitLineName(secondaryTransitLine.id, "<script>")
  ),
  "Transit line naming allowed a duplicate or unsafe name."
);
check(
  secondaryTransitRoad
    ? mobilityWorld.addTransitLine(secondaryTransitRoad.id)?.id === secondaryTransitLine?.id
      && mobilityWorld.transitLines.length === 2
    : false,
  "Selecting a road with an existing transit line created a duplicate."
);
check(
  Boolean(
    secondaryTransitLine
      && mobilityWorld.setTransitStopCount(secondaryTransitLine.id, 10)
      && secondaryTransitLine.stops.length === 10
      && secondaryTransitLine.stops.every((stop, index) =>
        stop.progress >= .039
        && stop.progress <= .961
        && stop.id.endsWith(`stop-${index + 1}`)
      )
  ),
  "Transit stop-count editing did not rebuild the selected line."
);
check(
  Boolean(
    secondaryTransitLine
      && mobilityWorld.setTransitOperations(secondaryTransitLine.id, 18, 0)
      && secondaryTransitLine.headwayMinutes === 18
      && secondaryTransitLine.fare === 0
  ),
  "Selected-line frequency and fare editing did not persist independently."
);
const removableTransitRoad = mobilityWorld.roads.find(
  road => !mobilityWorld.transitLines.some(line => line.roadId === road.id) && road.points.length > 1
);
const removableTransitLine = removableTransitRoad
  ? mobilityWorld.addTransitLine(removableTransitRoad.id)
  : undefined;
check(
  Boolean(
    removableTransitLine
      && mobilityWorld.removeTransitLine(removableTransitLine.id)
      && !mobilityWorld.transitLines.some(line => line.id === removableTransitLine.id)
      && mobilityWorld.transitLines.length === 2
  ),
  "Transit line removal did not preserve the rest of the network."
);
check(
  mobilityWorld.transitLines.every(line =>
    line.stops.every(stop =>
      mobilityWorld.accessibilityEntrances.some(
        entrance => entrance.targetKind === "transit" && entrance.targetId === stop.id
      )
    )
  ),
  "Transit network edits did not rebuild accessibility entrances for every stop."
);
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
check(mobilityWorld.setTransitOperations(transitLine.id, 18, 2.75), "Basic transit service could not be selected.");
const basicFleetSize = transitFleetSize(transitLine);
const basicWait = mobilityWorld.transitAverageWait(transitLine);
const basicDemand = mobilityWorld.transitLineDemand(transitLine, 8 * 60);
check(mobilityWorld.setTransitOperations(transitLine.id, 6, 2.75), "Rapid transit service could not be selected.");
const rapidFleetSize = transitFleetSize(transitLine);
const rapidWait = mobilityWorld.transitAverageWait(transitLine);
const rapidDemand = mobilityWorld.transitLineDemand(transitLine, 8 * 60);
check(rapidFleetSize > basicFleetSize, "More frequent transit did not require a larger active fleet.");
check(rapidWait < basicWait, "More frequent transit did not reduce average waiting time.");
check(rapidDemand > basicDemand, "More frequent transit did not increase passenger demand.");
const rapidFleet = scheduledTransitFleet(transitLine, mobilityWorld.clock.elapsedMinutes);
check(rapidFleet.length === rapidFleetSize, "Scheduled transit fleet did not match the operating plan.");
check(
  rapidFleet.length < 2
    || Math.hypot(
      rapidFleet[0].pose.point.x - rapidFleet[1].pose.point.x,
      rapidFleet[0].pose.point.z - rapidFleet[1].pose.point.z
    ) > 1,
  "Active transit vehicles were not separated along the route."
);
check(mobilityWorld.setTransitOperations(transitLine.id, 6, 4), "Premium transit fare could not be selected.");
const premiumTransitDemand = mobilityWorld.transitLineDemand(transitLine, 8 * 60);
check(mobilityWorld.setTransitOperations(transitLine.id, 6, 0), "Fare-free transit could not be selected.");
const freeTransitDemand = mobilityWorld.transitLineDemand(transitLine, 8 * 60);
check(freeTransitDemand > premiumTransitDemand, "Lower transit fares did not increase passenger demand.");
check(mobilityWorld.setTransitOperations(transitLine.id, 10, 2.75), "Transit operating plan could not be reset.");
const startedTransitRide = beginTransitRide(transitLine, transitLine.stops[0].id, 35);
check(Boolean(startedTransitRide), "Transit ride could not begin at a valid stop.");
check(startedTransitRide?.passengers === 35, "Transit ride did not preserve its passenger load.");
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
const transitRidershipBefore = transitLine.ridership;
const transitFareRevenueBefore = transitLine.fareRevenue;
mobilityWorld.advanceMinutes(60, mobilityWorld.cityEconomy().monthlyBalance);
check(placedParking.revenue > parkingRevenueBefore, "Occupied parking did not collect hourly revenue.");
check(placedParking.occupied >= 0 && placedParking.occupied <= placedParking.capacity, "Parking turnover exceeded capacity bounds.");
check(transitLine.ridership > transitRidershipBefore, "Hourly transit simulation did not board passengers.");
check(transitLine.fareRevenue > transitFareRevenueBefore, "Hourly transit simulation did not collect fares.");
check(
  transitLine.stops.every(stop => stop.waiting >= 0 && stop.boardings >= 0),
  "Transit queues or stop boardings left their valid bounds."
);
const parkingEconomy = mobilityWorld.cityEconomy();
check(parkingEconomy.parkingRevenue > 0, "Parking pricing did not contribute projected municipal revenue.");
check(
  parkingEconomy.transitRevenue > 0
    && parkingEconomy.transitCosts > 0
    && parkingEconomy.transitRidership === mobilityWorld.transitLines.reduce(
      (total, line) => total + line.ridership,
      0
    ),
  "Transit operations were not included in the city economy."
);
const parkingSnapshot = mobilityWorld.snapshot().parking?.find(item => item.id === placedParking.id);
check(parkingSnapshot?.hourlyRate === 4 && parkingSnapshot.revenue === placedParking.revenue, "Parking price and revenue were not included in the world snapshot.");
const transitSnapshot = mobilityWorld.snapshot().transitLines?.find(item => item.id === transitLine.id);
check(
  transitSnapshot?.headwayMinutes === 10
    && transitSnapshot.fare === 2.75
    && transitSnapshot.ridership === transitLine.ridership
    && transitSnapshot.stops.some(stop => stop.boardings > 0),
  "Transit frequency, fares, ridership, and stop activity were not included in the world snapshot."
);
const secondaryTransitSnapshot = mobilityWorld.snapshot().transitLines?.find(
  item => item.id === secondaryTransitLine?.id
);
check(
  secondaryTransitSnapshot?.roadId === secondaryTransitRoad?.id
    && secondaryTransitSnapshot?.name === "Crosstown Connector"
    && secondaryTransitSnapshot?.stops.length === 10
    && secondaryTransitSnapshot?.headwayMinutes === 18
    && secondaryTransitSnapshot?.fare === 0,
  "Additional transit line geometry and independent operations were not included in the world snapshot."
);
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
  spatialChunks: spatialChunks.length,
  agentDetailChunks: nearSpatialLod.agentChunks,
  farAggregatePopulation: farSpatialLod.aggregatePopulation,
  accessibleRouteMeters: Math.round(accessibleRoute!.distance),
  rampedCrossings: accessibleRoute!.rampedCrossings,
  accessibilityEntrances: mobilityWorld.accessibilityEntrances.length,
  accessibilityDestinations: accessibilityDestinations.length,
  upgradedEntrance: upgradeEntrance!.id,
  completeTripUsable: usableTrip.usable,
  blockedEntranceReported: blockedEntranceTrip.barriers[0],
  transitLine: transitLine.name,
  transitLines: mobilityWorld.transitLines.length,
  secondaryTransitLine: secondaryTransitLine?.name,
  secondaryTransitStops: secondaryTransitLine?.stops.length,
  transitStops: transitLine.stops.length,
  transitFleet: transitFleetSize(transitLine),
  transitRidership: transitLine.ridership,
  transitFareRevenue: transitLine.fareRevenue,
  transitAverageWait: Number(mobilityWorld.transitAverageWait(transitLine).toFixed(2)),
  transitCrowding: Number(mobilityWorld.transitLineCrowding(transitLine).toFixed(2)),
  transitAlight: arrivedTransitStop,
  parkingMarketDemand: Number(marketDemand.toFixed(2)),
  parkingPremiumDemand: Number(premiumDemand.toFixed(2)),
  parkingHourlyRevenue: placedParking.revenue,
  parkingMonthlyRevenue: parkingEconomy.parkingRevenue,
  curbDeliveries: managedCurb.deliveriesServed,
  curbViolations: managedCurb.violations,
  curbMonthlyRevenue: curbEconomy.curbRevenue,
  cityEvent: cityEvent.name,
  cityEventAttendance: cityEvent.totalAttendance,
  cityEventTrafficPressure: Number(recurringEventPressure.toFixed(2)),
  cityEventTransitDemand: Number(transitDemandWithEvent.toFixed(2)),
  cityEventMonthlyNet: recurringEventEconomy.eventRevenue - recurringEventEconomy.eventCosts,
  sidewalkDistance: Number(spawnLocation!.distance.toFixed(2)),
  buildingCollision: buildingMove.blocked,
  garageCollision: garageMove.blocked,
  waterBoundary: waterMove.blocked,
  interiorEntry: interiorEntry,
  interiorDoorways: interiorDoorways(interiorHome).length,
  interiorFurnitureCollision: furnitureMove.blocked,
  interiorWallCollision: wallMove.blocked,
  interiorAccessGate: entryStatus.allowed,
  directResidentAction: directControlHome.residents[0].lastActionKind,
  directedActionsCompleted: directControlHome.residents[0].completedActions,
  controlledResidentEnergy: directControlHome.residents[0].energy,
  conversationPartnerSocial: directControlHome.residents[1].social,
  relationshipScore: completedRelationship?.score,
  directedRelationshipGain,
  completedConversations: completedRelationship?.conversations,
  supportRelationshipChange: supportProbe.expectedChange,
  jokeRelationshipChange: jokeProbe.expectedChange,
  confrontRelationshipChange: confrontProbe.expectedChange,
  confrontStress: confrontProbe.first.stress,
  apologyRelationshipChange: apologyProbe.expectedChange,
  repairedTension: apologyProbe.relationship?.tension,
  resolvedConflicts: apologyProbe.relationship?.resolvedConflicts,
  autonomousApologyGain,
  autonomousRepairedTension: autonomouslyRepairedRelationship?.tension,
  autonomousConversationPartner: autonomousSocialHome.residents[0].lastActionKind,
  compatibleRelationshipScore: autonomousRelationship?.score,
  autonomousRelationshipGain
}, null, 2));

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
