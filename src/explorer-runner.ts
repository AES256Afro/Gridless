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
check(
  furniturePlacementWorld.addFurniture(interiorHome.id, "plant", -2, 1),
  "Home Simulator rejected furniture placed inside a room."
);
check(
  !furniturePlacementWorld.addFurniture(interiorHome.id, "plant", 20, 20),
  "Home Simulator allowed furniture outside every room."
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
  directControlWorld.clock.minute === 11 * 60 + 45
    && directControlWorld.residentStatus(directControlHome.residents[0]) === "Out in city",
  "Directed conversation did not finish cleanly across a normal schedule boundary."
);

function runConversationIntentProbe(intent: ConversationIntent) {
  const world = new World();
  const home = structuredClone(directControlBaseline);
  world.homes = [home];
  world.clock.minute = 20 * 60;
  world.setControlledResident("controlled-resident");
  const first = home.residents[0];
  const second = home.residents[1];
  const expectedChange = world.conversationRelationshipChange(first, second, intent, true);
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
  world.advanceMinutes({ chat: 60, support: 55, joke: 40, confront: 35 }[intent], 0);
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
    && confrontProbe.expectedChange < 0,
  "Confront did not create its intended relationship loss and stress tradeoff."
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
eventWorld.advanceMinutes(cityEvent.startAt, eventWorld.cityEconomy().monthlyBalance);
check(eventWorld.cityEventActiveAt(cityEvent), "Named city event did not activate on schedule.");
check(eventWorld.cityEventTrafficPressure() > 0, "Active city event did not add traffic pressure.");
check(
  eventWorld.curbEffectiveUse(eventCurb) === "event" && !eventWorld.parkingPermitted(eventCurb),
  "Active city event did not place its nearby curb under event control."
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
  concert.name.endsWith("Live") && eventWorld.cityEventActiveAt(concert),
  "Builder-created city event was not named or started with the selected timing."
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
    && eventSnapshot.revenue === cityEvent.revenue,
  "City event schedule, attendance, and revenue were not included in the world snapshot."
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
    && parkingEconomy.transitRidership === transitLine.ridership,
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
  accessibilityEntrances: mobilityWorld.accessibilityEntrances.length,
  accessibilityDestinations: accessibilityDestinations.length,
  upgradedEntrance: upgradeEntrance!.id,
  completeTripUsable: usableTrip.usable,
  blockedEntranceReported: blockedEntranceTrip.barriers[0],
  transitLine: transitLine.name,
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
  autonomousConversationPartner: autonomousSocialHome.residents[0].lastActionKind,
  compatibleRelationshipScore: autonomousRelationship?.score,
  autonomousRelationshipGain
}, null, 2));

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
