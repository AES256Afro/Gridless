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
  DISTRICT_POLICY_DEFINITIONS,
  HOME_BUILD_COSTS,
  MAX_HOME_FLOORS,
  RESIDENT_CAREER_TRACK_DEFINITIONS,
  RESIDENT_LIFE_STAGE_DEFINITIONS,
  RESIDENT_PERSONALITY_AXES,
  RESIDENT_WORK_TASK_DEFINITIONS,
  ROAD_PROFILE_PRESETS,
  World,
  homeEntityFloor,
  homeFloorView,
  homeRoomExteriorWalls,
  roadConstructionCost,
  roadWidthForProfile,
  snapRoadDrawingPoint,
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
const eventStreetSound = soundscapeProfile("explore", clearWeather, 12, .65, { crowd: .9 });
const drivingStreetSound = soundscapeProfile("explore", clearWeather, 12, .65, { vehicle: .75 });
const transitStreetSound = soundscapeProfile("explore", clearWeather, 12, .65, { transit: .8 });
const emergencyStreetSound = soundscapeProfile("explore", clearWeather, 12, .65, { emergency: 1 });
const shelteredEmergencySound = soundscapeProfile("home", clearWeather, 12, .65, { emergency: 1 });
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
check(
  eventStreetSound.focus === "Event crowd"
    && eventStreetSound.crowd > streetSound.crowd
    && drivingStreetSound.focus === "Vehicle"
    && drivingStreetSound.vehicle > streetSound.vehicle
    && transitStreetSound.focus === "Transit"
    && transitStreetSound.transit > streetSound.transit
    && emergencyStreetSound.focus === "Emergency response"
    && emergencyStreetSound.emergency > shelteredEmergencySound.emergency,
  "Localized soundscape cues did not distinguish events, vehicles, transit, emergency response, and sheltered interiors."
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

const endpointSnap = snapRoadDrawingPoint(
  { x: 38, z: 3 },
  [{ x: 80, z: 80 }],
  [road],
  { endpoints: true, angleLock: true, endpointDistance: 12 }
);
const angleSnap = snapRoadDrawingPoint(
  { x: 19, z: 7 },
  [{ x: 0, z: 0 }],
  [],
  { endpoints: true, angleLock: true, angleStepDegrees: 15 }
);
const freeSnap = snapRoadDrawingPoint(
  { x: 19, z: 7 },
  [{ x: 0, z: 0 }],
  [road],
  { endpoints: false, angleLock: false }
);
const tangentSnap = snapRoadDrawingPoint(
  { x: 60, z: -3 },
  [{ x: 40, z: 0 }],
  [road],
  { endpoints: false, angleLock: false, tangentGuide: true, alignmentDistance: 18, alignmentToleranceDegrees: 12 }
);
const parallelSnap = snapRoadDrawingPoint(
  { x: 20, z: 18 },
  [{ x: -10, z: 20 }],
  [road],
  { endpoints: false, angleLock: false, parallelGuide: true, alignmentDistance: 28, alignmentToleranceDegrees: 12 }
);
check(
  endpointSnap.kind === "endpoint"
    && endpointSnap.point.x === 40
    && endpointSnap.point.z === 0
    && endpointSnap.targetRoadId === road.id,
  "Road drawing did not prioritize an exact nearby network endpoint."
);
check(
  angleSnap.kind === "angle"
    && angleSnap.angleDegrees === 15
    && Math.abs(Math.hypot(angleSnap.point.x, angleSnap.point.z) - Math.hypot(19, 7)) < .02
    && freeSnap.kind === "free"
    && freeSnap.point.x === 19
    && freeSnap.point.z === 7,
  "Optional road angle locking did not preserve segment length or release cleanly."
);
check(
  tangentSnap.kind === "tangent"
    && tangentSnap.targetRoadId === road.id
    && tangentSnap.angleDegrees === 349
    && Math.abs(Math.hypot(tangentSnap.point.x - 40, tangentSnap.point.z) - Math.hypot(20, -3)) < .02,
  "Road tangent guidance did not extend a curved road endpoint while preserving the drawn segment length."
);
check(
  parallelSnap.kind === "parallel"
    && parallelSnap.targetRoadId === road.id
    && parallelSnap.angleDegrees === 349
    && Math.abs(Math.hypot(parallelSnap.point.x + 10, parallelSnap.point.z - 20) - Math.hypot(30, -2)) < .02,
  "Road parallel guidance did not match a nearby curved-road segment while preserving the drawn length."
);

const profiledWorld = new World();
check(
  profiledWorld.roads.every(candidate => {
    const profile = profiledWorld.roadProfile(candidate);
    return profile.travelLanes >= 1
      && profile.speedLimitKph >= 20
      && profile.sidewalkWidth >= 1.2;
  }),
  "Template roads did not receive valid road profile defaults."
);
const legacyRoadSnapshot = JSON.parse(profiledWorld.serialize());
for (const legacyRoad of legacyRoadSnapshot.roads) delete legacyRoad.profile;
check(profiledWorld.restore(JSON.stringify(legacyRoadSnapshot)), "A legacy road snapshot could not be restored.");
check(
  profiledWorld.roads.every(candidate => Boolean(candidate.profile)),
  "Legacy road migration did not add persistent road profiles."
);

const authoredProfile = {
  ...ROAD_PROFILE_PRESETS.avenue,
  travelLanes: 6,
  speedLimitKph: 60,
  bikeLanes: true,
  busLanes: true,
  median: true,
  curbParking: false,
  sidewalkWidth: 4
};
const profileRoadPoints = [{ x: 900, z: 820 }, { x: 990, z: 820 }];
const profileTreasuryBefore = profiledWorld.clock.treasury;
const profileConstructionCost = roadConstructionCost(profileRoadPoints, authoredProfile);
check(
  profiledWorld.addRoad(profileRoadPoints, 12, "avenue", authoredProfile),
  "A funded custom road profile could not be built."
);
const authoredRoad = profiledWorld.roads.at(-1)!;
const authoredRoadLot = profiledWorld.lots.find(candidate => candidate.roadId === authoredRoad.id)!;
const authoredRoadHome = profiledWorld.ensureHome(authoredRoadLot);
check(
  authoredRoad.width === roadWidthForProfile(authoredProfile)
    && authoredRoad.profile?.travelLanes === 6
    && authoredRoad.profile.busLanes
    && profiledWorld.clock.treasury === profileTreasuryBefore - profileConstructionCost,
  "Custom road construction did not persist its geometry, features, and treasury cost."
);
const profileCapacityBefore = profiledWorld.roadCapacity(authoredRoad);
const retrofit = profiledWorld.updateRoadProfile(authoredRoad.id, {
  ...authoredProfile,
  travelLanes: 2,
  speedLimitKph: 30,
  busLanes: false,
  median: false
}, "street");
check(
  retrofit.ok
    && retrofit.cost > 0
    && profiledWorld.roadCapacity(authoredRoad) < profileCapacityBefore
    && profiledWorld.lots.some(candidate => candidate.id === authoredRoadLot.id)
    && profiledWorld.homes.some(candidate => candidate.id === authoredRoadHome.id && candidate.lotId === authoredRoadLot.id),
  "Road profile retrofit did not update capacity, charge its cost, and preserve its developed parcel."
);
const profiledSnapshot = profiledWorld.serialize();
check(profiledWorld.restore(profiledSnapshot), "A city with custom road profiles could not be restored.");
const restoredProfileRoad = profiledWorld.roads.find(candidate => candidate.id === authoredRoad.id);
check(
  restoredProfileRoad?.profile?.travelLanes === 2
    && restoredProfileRoad.class === "street",
  "Road profile persistence lost a retrofitted road design."
);
const structureWorld = new World();
structureWorld.applyTemplate("blank");
structureWorld.clock.treasury = 100_000_000;
const structurePoints = [{ x: -40, z: 0 }, { x: 40, z: 0 }];
const structureProfile = ROAD_PROFILE_PRESETS.avenue;
const surfaceStructureCost = roadConstructionCost(structurePoints, structureProfile, "surface", 0);
const bridgeStructureCost = roadConstructionCost(structurePoints, structureProfile, "bridge", 8);
const tunnelStructureCost = roadConstructionCost(structurePoints, structureProfile, "tunnel", -12);
const clearRoadImpact = structureWorld.roadConstructionImpact(structurePoints, structureProfile, "surface", 0);
check(
  clearRoadImpact.status === "ready"
    && clearRoadImpact.canBuild
    && clearRoadImpact.frontageLots === 2
    && clearRoadImpact.accessible
    && clearRoadImpact.cost === surfaceStructureCost,
  "A clear funded surface road did not produce an accurate build impact preview."
);
check(
  surfaceStructureCost < bridgeStructureCost
    && bridgeStructureCost < tunnelStructureCost
    && structureWorld.addRoad(structurePoints, 12, "avenue", structureProfile, "bridge", 8),
  "Road structure costs did not distinguish surface, bridge, and tunnel construction."
);
const bridgeRoad = structureWorld.roads[0];
const separatedCrossingImpact = structureWorld.roadConstructionImpact(
  [{ x: 0, z: -40 }, { x: 0, z: 40 }],
  structureProfile,
  "surface",
  0
);
check(
  structureWorld.roadStructure(bridgeRoad).structure === "bridge"
    && structureWorld.roadStructure(bridgeRoad).elevationMeters === 8
    && bridgeRoad.developable === false
    && structureWorld.lots.every(lot => lot.roadId !== bridgeRoad.id),
  "Bridge construction did not retain its safe persistent deck height or suppress ground-level frontage."
);
check(
  separatedCrossingImpact.roadCrossings === 0
    && separatedCrossingImpact.gradeSeparatedCrossings === 1
    && separatedCrossingImpact.networkConnections === 0,
  "Road impact preview connected grade-separated structures into an at-grade network."
);
const restoredStructureWorld = new World();
check(
  restoredStructureWorld.restore(structureWorld.serialize())
    && restoredStructureWorld.roadStructure(restoredStructureWorld.roads[0]).structure === "bridge"
    && restoredStructureWorld.roadStructure(restoredStructureWorld.roads[0]).elevationMeters === 8,
  "Road structure and elevation did not survive save and restore."
);
const tunnelRetrofit = structureWorld.updateRoadProfile(bridgeRoad.id, structureProfile, "avenue", "tunnel", -12);
check(
  tunnelRetrofit.ok
    && structureWorld.roadStructure(bridgeRoad).structure === "tunnel"
    && structureWorld.roadStructure(bridgeRoad).elevationMeters === -12,
  "A funded bridge-to-tunnel retrofit did not update the persistent road structure."
);
const unsafeStructureSnapshot = JSON.parse(structureWorld.serialize());
unsafeStructureSnapshot.roads[0].structure = "skyway";
unsafeStructureSnapshot.roads[0].elevationMeters = 999;
const migratedStructureWorld = new World();
check(
  migratedStructureWorld.restore(JSON.stringify(unsafeStructureSnapshot))
    && migratedStructureWorld.roadStructure(migratedStructureWorld.roads[0]).structure === "surface"
    && migratedStructureWorld.roadStructure(migratedStructureWorld.roads[0]).elevationMeters === 0,
  "Unsafe legacy road structure values did not migrate to a surface road."
);
const priorityLine = profiledWorld.addTransitLine(authoredRoad.id)!;
const unprioritizedHeadway = profiledWorld.transitEffectiveHeadway(priorityLine);
const priorityRetrofit = profiledWorld.updateRoadProfile(authoredRoad.id, {
  ...profiledWorld.roadProfile(restoredProfileRoad!),
  busLanes: true
});
check(
  priorityRetrofit.ok
    && profiledWorld.transitEffectiveHeadway(priorityLine) < unprioritizedHeadway,
  "A bus-priority road profile did not improve effective transit frequency."
);

const capacityWorld = new World();
capacityWorld.applyTemplate("blank");
const narrowProfile = { ...ROAD_PROFILE_PRESETS.street, travelLanes: 1, curbParking: false };
const wideProfile = { ...ROAD_PROFILE_PRESETS.arterial, travelLanes: 8, speedLimitKph: 80, bikeLanes: false, median: false };
capacityWorld.addRoad([{ x: -120, z: -20 }, { x: 120, z: -20 }], 3, "street", narrowProfile);
capacityWorld.addRoad([{ x: -120, z: 20 }, { x: 120, z: 20 }], 24, "arterial", wideProfile);
const narrowRoad = capacityWorld.roads[0];
const wideRoad = capacityWorld.roads[1];
const conflictLot = capacityWorld.lots.find(candidate => candidate.roadId === narrowRoad.id)!;
const conflictPoints = [
  { x: conflictLot.center.x - 24, z: conflictLot.center.z },
  { x: conflictLot.center.x + 24, z: conflictLot.center.z }
];
const conflictingRoadImpact = capacityWorld.roadConstructionImpact(conflictPoints, narrowProfile, "surface", 0);
const roadCountBeforeRejectedImpact = capacityWorld.roads.length;
check(
  conflictingRoadImpact.status === "parcel-conflict"
    && conflictingRoadImpact.parcelConflicts > 0
    && !conflictingRoadImpact.canBuild
    && !capacityWorld.addRoad(conflictPoints, 9, "street", narrowProfile)
    && capacityWorld.roads.length === roadCountBeforeRejectedImpact,
  "Parcel conflicts were not reported and rejected before road construction."
);
const waterImpactWorld = new World();
waterImpactWorld.applyTemplate("blank");
waterImpactWorld.areas.push({
  id: "impact-water",
  name: "Impact water",
  kind: "water",
  points: [{ x: -12, z: -12 }, { x: 12, z: -12 }, { x: 12, z: 12 }, { x: -12, z: 12 }]
});
const waterImpactPoints = [{ x: -30, z: 0 }, { x: 30, z: 0 }];
const surfaceWaterImpact = waterImpactWorld.roadConstructionImpact(waterImpactPoints, narrowProfile, "surface", 0);
const bridgeWaterImpact = waterImpactWorld.roadConstructionImpact(waterImpactPoints, narrowProfile, "bridge", 8);
check(
  surfaceWaterImpact.status === "water-conflict"
    && !surfaceWaterImpact.canBuild
    && bridgeWaterImpact.status === "ready"
    && bridgeWaterImpact.canBuild
    && !bridgeWaterImpact.accessible,
  "Water impact preview did not require grade separation or report frontage accessibility."
);
capacityWorld.commuteFlows = [{
  id: "road-profile-flow",
  originLotId: "profile-origin",
  destinationLotId: "profile-destination",
  travelers: 180,
  mode: "car",
  route: [{ x: -100, z: -20 }, { x: 100, z: -20 }],
  distance: 200,
  travelMinutes: 12,
  departMinute: 480,
  returnMinute: 1020
}];
const narrowPressure = capacityWorld.roadTrafficPressure(narrowRoad);
capacityWorld.commuteFlows[0].route = [{ x: -100, z: 20 }, { x: 100, z: 20 }];
const widePressure = capacityWorld.roadTrafficPressure(wideRoad);
check(
  narrowPressure > widePressure,
  "Additional road lanes and speed capacity did not reduce pressure for equal traffic."
);

const governanceWorld = new World();
const defaultGovernanceEconomy = governanceWorld.cityEconomy();
check(
  governanceWorld.taxPolicy.residential === 10
    && governanceWorld.taxPolicy.commercial === 10
    && governanceWorld.taxPolicy.industrial === 10
    && defaultGovernanceEconomy.debtPayments === 0
    && defaultGovernanceEconomy.districtPolicyCosts === 0,
  "A new city did not receive neutral tax, debt, and district-policy defaults."
);
const legacyGovernanceSnapshot = JSON.parse(governanceWorld.serialize());
delete legacyGovernanceSnapshot.taxPolicy;
delete legacyGovernanceSnapshot.districtPolicies;
delete legacyGovernanceSnapshot.municipalBonds;
check(governanceWorld.restore(JSON.stringify(legacyGovernanceSnapshot)), "A legacy governance snapshot could not be restored.");
check(
  governanceWorld.taxPolicy.residential === 10
    && Object.keys(governanceWorld.districtPolicies).length === 0
    && governanceWorld.municipalBonds.length === 0,
  "Legacy governance migration did not restore safe economic defaults."
);

const lowTaxWorld = new World();
const highTaxWorld = new World();
check(lowTaxWorld.setTaxRate("residential", 5), "A supported low residential tax rate was rejected.");
check(highTaxWorld.setTaxRate("residential", 20), "A supported high residential tax rate was rejected.");
check(
  highTaxWorld.cityEconomy().residentialTaxRevenue === lowTaxWorld.cityEconomy().residentialTaxRevenue * 4,
  "Residential tax policy did not scale current tax revenue."
);
lowTaxWorld.advanceMinutes(30 * 24 * 60, lowTaxWorld.cityEconomy().monthlyBalance);
highTaxWorld.advanceMinutes(30 * 24 * 60, highTaxWorld.cityEconomy().monthlyBalance);
check(
  lowTaxWorld.cityEconomy().households > highTaxWorld.cityEconomy().households,
  "Tax pressure did not change household demand over a simulated month."
);

const policyWorld = new World();
const policyLot = policyWorld.lots.find(candidate => Boolean(policyWorld.districtForLot(candidate)))!;
const policyDistrict = policyWorld.districtForLot(policyLot)!;
const landValueBeforePolicy = policyWorld.lotLandValue(policyLot);
const wellbeingBeforePolicy = policyWorld.lotWellbeing(policyLot);
check(
  policyWorld.setDistrictPolicy(policyDistrict.id, "school-boost", true)
    && policyWorld.setDistrictPolicy(policyDistrict.id, "recycling", true)
    && !policyWorld.setDistrictPolicy(policyDistrict.id, "recycling", true),
  "District policies did not enable idempotently."
);
check(
  policyWorld.districtPolicyMonthlyCost()
    === DISTRICT_POLICY_DEFINITIONS["school-boost"].monthlyCost + DISTRICT_POLICY_DEFINITIONS.recycling.monthlyCost
    && policyWorld.lotLandValue(policyLot) > landValueBeforePolicy
    && policyWorld.lotWellbeing(policyLot) > wellbeingBeforePolicy,
  "District policy did not connect its recurring cost to land value and wellbeing."
);
const policySnapshot = policyWorld.serialize();
check(policyWorld.restore(policySnapshot), "A city with district policy could not be restored.");
check(
  policyWorld.districtPolicies[policyDistrict.id]?.includes("school-boost")
    && policyWorld.districtPolicies[policyDistrict.id]?.includes("recycling"),
  "District policy persistence lost an enabled policy."
);

const debtWorld = new World();
const treasuryBeforeBond = debtWorld.clock.treasury;
const bond = debtWorld.issueMunicipalBond(5_000_000);
check(
  Boolean(bond)
    && debtWorld.clock.treasury === treasuryBeforeBond + 5_000_000
    && debtWorld.cityEconomy().debtPayments === bond!.monthlyPayment,
  "Municipal bond issuance did not add cash and monthly debt service."
);
const bondBalanceBeforeMonth = bond!.balance;
debtWorld.advanceMinutes(30 * 24 * 60, debtWorld.cityEconomy().monthlyBalance);
check(
  bond!.balance < bondBalanceBeforeMonth
    && bond!.monthsRemaining === 119,
  "Monthly bond settlement did not reduce principal and remaining term."
);
const debtBeforeExtraPayment = bond!.balance;
check(
  debtWorld.repayMunicipalDebt(1_000_000)
    && bond!.balance === debtBeforeExtraPayment - 1_000_000,
  "Extra municipal debt repayment did not reduce principal exactly."
);
const debtSnapshot = debtWorld.serialize();
check(debtWorld.restore(debtSnapshot), "A city with municipal debt could not be restored.");
check(
  debtWorld.municipalBonds.length === 1
    && debtWorld.municipalBonds[0].monthsRemaining === 119,
  "Municipal debt persistence lost its balance or repayment term."
);

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

const identityWorld = new World();
const identityRevision = identityWorld.changeRevision();
check(!identityWorld.setCityName("<script>"), "City identity accepted unsafe markup characters.");
check(identityWorld.setCityName("Harbor Commons"), "A valid city name was rejected.");
check(
  identityWorld.cityName === "Harbor Commons" && identityWorld.changeRevision() > identityRevision,
  "City identity did not update as a tracked world edit."
);
const namedCitySnapshot = identityWorld.serialize();
check(identityWorld.setCityName("Second Name"), "City identity could not be changed a second time.");
check(identityWorld.restore(namedCitySnapshot) && identityWorld.cityName === "Harbor Commons", "Recovery lost the saved city identity.");
check(identityWorld.undo() && identityWorld.cityName === "Second Name", "Undo did not restore the city identity from before recovery.");
check(identityWorld.redo() && identityWorld.cityName === "Harbor Commons", "Redo did not restore the recovered city identity.");
check(identityWorld.applyTemplate("blank") && identityWorld.cityName === "Untitled Region", "A blank template did not reset city identity.");

const chicagoWorld = new World();
check(
  chicagoWorld.applyTemplate("chicago")
    && chicagoWorld.cityName === "New Lakeshore City"
    && chicagoWorld.templateId === "chicago",
  "The Chicago foundation did not reset world and city identity."
);
const chicagoStateStreet = chicagoWorld.roads.find(road => road.id === "chicago-state")!;
const chicagoLakeStreet = chicagoWorld.roads.find(road => road.id === "chicago-lake")!;
check(
  chicagoWorld.roads.length === 30
    && chicagoStateStreet.points.every(point => point.x === chicagoStateStreet.points[0].x)
    && chicagoLakeStreet.points.every(point => point.z === chicagoLakeStreet.points[0].z)
    && chicagoWorld.areas.filter(area => area.kind === "water").length === 3
    && chicagoWorld.areas.filter(area => area.kind === "park").length === 2
    && chicagoWorld.areas.filter(area => area.kind === "district").length === 4,
  "The Chicago foundation lost its grid, river branches, lakefront parks, or districts."
);
check(
  chicagoWorld.lots.length > 500
    && chicagoWorld.lots.every(lot => chicagoWorld.roads.find(road => road.id === lot.roadId)?.developable !== false)
    && new Set(chicagoWorld.lots.map(lot => lot.zone)).has("industrial")
    && new Set(chicagoWorld.lots.map(lot => lot.zone)).has("commercial")
    && new Set(chicagoWorld.lots.map(lot => lot.zone)).has("mixed")
    && new Set(chicagoWorld.lots.map(lot => lot.zone)).has("residential"),
  "Chicago parcels ignored developable streets or failed to create a useful regional zoning mix."
);
check(
  chicagoStateStreet.profile?.busLanes === true
    && chicagoWorld.roads.find(road => road.id === "chicago-kennedy")?.profile?.speedLimitKph === 80
    && chicagoWorld.roads.find(road => road.id === "chicago-lakefront-trail")?.profile?.bikeLanes === true,
  "Chicago street hierarchy lost its transit, expressway, or lakefront trail profile."
);
check(
  chicagoWorld.transitLines[0]?.name === "State Street Connector C1"
    && chicagoWorld.transitLines[0].stops.some(stop => stop.name === "The Loop")
    && chicagoWorld.parking.length === 3
    && chicagoWorld.cityEvents[0]?.name === "State Street Arts Walk",
  "The Chicago foundation did not seed its local transit, parking, and public-realm activity."
);
const chicagoWeather = chicagoWorld.weather();
const matchingChicagoWorld = new World();
matchingChicagoWorld.applyTemplate("chicago");
check(
  chicagoWeather.windKph >= 12
    && chicagoWeather.temperatureC < matchingWeatherWorld.weather().temperatureC
    && JSON.stringify(chicagoWeather) === JSON.stringify(matchingChicagoWorld.weather()),
  "Chicago climate was not colder, windier, and deterministic on the reference winter date."
);
const restoredChicagoWorld = new World();
check(
  restoredChicagoWorld.restore(chicagoWorld.serialize())
    && restoredChicagoWorld.templateId === "chicago"
    && restoredChicagoWorld.roads.some(road => road.id === "chicago-milwaukee")
    && restoredChicagoWorld.areas.some(area => area.kind === "water" && area.name === "Main Branch"),
  "Chicago regional identity or geometry was lost during persistence."
);
const legacyChicagoSnapshot = JSON.parse(chicagoWorld.serialize());
delete legacyChicagoSnapshot.areas;
check(
  restoredChicagoWorld.restore(JSON.stringify(legacyChicagoSnapshot))
    && restoredChicagoWorld.areas.some(area => area.kind === "water" && area.name === "Main Branch"),
  "A legacy Chicago save without area geometry did not recover its regional terrain."
);

const houstonWorld = new World();
check(
  houstonWorld.applyTemplate("houston")
    && houstonWorld.cityName === "New Bayou City"
    && houstonWorld.templateId === "houston",
  "The Houston foundation did not reset world and city identity."
);
check(
  houstonWorld.roads.length === 24
    && houstonWorld.areas.filter(area => area.kind === "water").length === 2
    && houstonWorld.areas.filter(area => area.kind === "floodplain").length === 3
    && houstonWorld.areas.filter(area => area.kind === "park").length === 2
    && houstonWorld.areas.filter(area => area.kind === "district").length === 4,
  "The Houston foundation lost its bayous, floodplains, parks, districts, or road structure."
);
const houstonI10 = houstonWorld.roads.find(road => road.id === "houston-i10")!;
const houstonFrontage = houstonWorld.roads.find(road => road.id === "houston-i10-frontage-1")!;
check(
  houstonI10.developable === false
    && houstonI10.profile?.travelLanes === 8
    && houstonI10.profile.speedLimitKph === 100
    && houstonFrontage.developable !== false
    && houstonFrontage.profile?.travelLanes === 3
    && !houstonWorld.lots.some(lot => lot.roadId === houstonI10.id)
    && houstonWorld.lots.some(lot => lot.roadId === houstonFrontage.id),
  "Houston freeway and frontage-road hierarchy did not control profiles and parcel access."
);
const houstonRiskCounts = { none: 0, moderate: 0, high: 0 };
houstonWorld.lots.forEach(lot => houstonRiskCounts[houstonWorld.lotFloodRisk(lot)] += 1);
const houstonZones = new Set(houstonWorld.lots.map(lot => lot.zone));
check(
  houstonWorld.lots.length > 700
    && houstonRiskCounts.none > 0
    && houstonRiskCounts.moderate > 0
    && houstonRiskCounts.high > 0
    && houstonZones.has("unassigned")
    && houstonZones.has("residential")
    && houstonZones.has("commercial")
    && houstonZones.has("mixed")
    && houstonZones.has("industrial"),
  "Houston did not create large parcels, flexible land use, or three distinct flood-exposure states."
);
const houstonSafeLot = houstonWorld.lots.find(lot => houstonWorld.lotFloodRisk(lot) === "none")!;
const houstonSafeLandValue = houstonWorld.lotLandValue(houstonSafeLot);
houstonWorld.areas.push({
  id: "test-high-risk",
  name: "Test floodplain",
  kind: "floodplain",
  floodRisk: "high",
  points: [
    { x: houstonSafeLot.center.x - 2, z: houstonSafeLot.center.z - 2 },
    { x: houstonSafeLot.center.x + 2, z: houstonSafeLot.center.z - 2 },
    { x: houstonSafeLot.center.x + 2, z: houstonSafeLot.center.z + 2 },
    { x: houstonSafeLot.center.x - 2, z: houstonSafeLot.center.z + 2 }
  ]
});
check(
  houstonWorld.lotFloodRisk(houstonSafeLot) === "high"
    && houstonWorld.lotLandValue(houstonSafeLot) === Math.max(0, houstonSafeLandValue - 14),
  "High flood exposure did not apply its explicit land-value pressure."
);
houstonWorld.areas.pop();
check(
  houstonWorld.transitLines[0]?.name === "Main Street Rapid H1"
    && houstonWorld.transitLines[0].stops.some(stop => stop.name === "Downtown")
    && houstonWorld.parking.length === 3
    && houstonWorld.cityEvents[0]?.name === "Buffalo Bayou Festival"
    && houstonWorld.cityEvents[0].kind === "concert",
  "The Houston foundation did not seed its local transit, parking, and bayou event."
);
const houstonWeather = houstonWorld.weather();
const matchingHoustonWorld = new World();
matchingHoustonWorld.applyTemplate("houston");
check(
  houstonWeather.temperatureC > matchingWeatherWorld.weather().temperatureC
    && houstonWeather.kind !== "snow"
    && JSON.stringify(houstonWeather) === JSON.stringify(matchingHoustonWorld.weather()),
  "Houston climate was not warmer, snow-free, and deterministic on the reference winter date."
);
const restoredHoustonWorld = new World();
check(
  restoredHoustonWorld.restore(houstonWorld.serialize())
    && restoredHoustonWorld.templateId === "houston"
    && restoredHoustonWorld.roads.some(road => road.id === "houston-loop-610")
    && restoredHoustonWorld.areas.some(area => area.kind === "floodplain" && area.floodRisk === "high"),
  "Houston regional identity, freeway geometry, or floodplain evidence was lost during persistence."
);
const legacyHoustonSnapshot = JSON.parse(houstonWorld.serialize());
delete legacyHoustonSnapshot.areas;
check(
  restoredHoustonWorld.restore(JSON.stringify(legacyHoustonSnapshot))
    && restoredHoustonWorld.areas.some(area => area.kind === "water" && area.name === "Buffalo Bayou"),
  "A legacy Houston save without area geometry did not recover its regional terrain."
);

const seattleWorld = new World();
check(
  seattleWorld.applyTemplate("seattle")
    && seattleWorld.cityName === "New Sound City"
    && seattleWorld.templateId === "seattle",
  "The Seattle foundation did not reset world and city identity."
);
check(
  seattleWorld.roads.length === 26
    && seattleWorld.areas.filter(area => area.kind === "water").length === 3
    && seattleWorld.areas.filter(area => area.kind === "slope").length === 4
    && seattleWorld.areas.filter(area => area.kind === "park").length === 2
    && seattleWorld.areas.filter(area => area.kind === "district").length === 5,
  "The Seattle foundation lost its water constraints, slopes, parks, districts, or road structure."
);
const seattleI5 = seattleWorld.roads.find(road => road.id === "seattle-i5")!;
const seattleBridge = seattleWorld.roads.find(road => road.id === "seattle-520-bridge")!;
const seattleThird = seattleWorld.roads.find(road => road.id === "seattle-third")!;
check(
  seattleI5.developable === false
    && seattleI5.profile?.travelLanes === 6
    && seattleI5.profile.speedLimitKph === 90
    && seattleBridge.developable === false
    && seattleBridge.profile?.bikeLanes === true
    && seattleThird.profile?.busLanes === true
    && !seattleWorld.lots.some(lot => lot.roadId === seattleI5.id || lot.roadId === seattleBridge.id),
  "Seattle freeway, bridge, bicycle, and bus-priority profiles did not preserve constrained access."
);
const seattleSlopeCounts = { flat: 0, moderate: 0, steep: 0 };
seattleWorld.lots.forEach(lot => seattleSlopeCounts[seattleWorld.lotTerrainSlope(lot)] += 1);
const seattleZones = new Set(seattleWorld.lots.map(lot => lot.zone));
check(
  seattleWorld.lots.length > 500
    && seattleSlopeCounts.flat > 0
    && seattleSlopeCounts.moderate > 0
    && seattleSlopeCounts.steep > 0
    && seattleZones.has("residential")
    && seattleZones.has("commercial")
    && seattleZones.has("mixed")
    && seattleZones.has("industrial"),
  "Seattle did not create constrained developable land, three slope states, and an urban-village zoning mix."
);
const seattleFlatLot = seattleWorld.lots.find(lot => seattleWorld.lotTerrainSlope(lot) === "flat")!;
const seattleFlatLandValue = seattleWorld.lotLandValue(seattleFlatLot);
seattleWorld.areas.push({
  id: "test-steep-slope",
  name: "Test steep slope",
  kind: "slope",
  terrainSlope: "steep",
  points: [
    { x: seattleFlatLot.center.x - 2, z: seattleFlatLot.center.z - 2 },
    { x: seattleFlatLot.center.x + 2, z: seattleFlatLot.center.z - 2 },
    { x: seattleFlatLot.center.x + 2, z: seattleFlatLot.center.z + 2 },
    { x: seattleFlatLot.center.x - 2, z: seattleFlatLot.center.z + 2 }
  ]
});
check(
  seattleWorld.lotTerrainSlope(seattleFlatLot) === "steep"
    && seattleWorld.lotLandValue(seattleFlatLot) === Math.max(0, seattleFlatLandValue - 9),
  "Steep terrain did not apply its explicit land-value pressure."
);
seattleWorld.areas.pop();
check(
  seattleWorld.transitLines[0]?.name === "3rd Avenue Rapid S1"
    && seattleWorld.transitLines[0].stops.some(stop => stop.name === "Downtown")
    && seattleWorld.parking.length === 3
    && seattleWorld.cityEvents[0]?.name === "Seattle Waterfront Music Walk",
  "The Seattle foundation did not seed its local transit, parking, and waterfront event."
);
const seattleWeather = seattleWorld.weather();
const matchingSeattleWorld = new World();
matchingSeattleWorld.applyTemplate("seattle");
check(
  seattleWeather.temperatureC < houstonWeather.temperatureC
    && seattleWeather.visibility <= 1
    && JSON.stringify(seattleWeather) === JSON.stringify(matchingSeattleWorld.weather()),
  "Seattle climate was not cooler and deterministic on the reference winter date."
);
const restoredSeattleWorld = new World();
check(
  restoredSeattleWorld.restore(seattleWorld.serialize())
    && restoredSeattleWorld.templateId === "seattle"
    && restoredSeattleWorld.roads.some(road => road.id === "seattle-i90-bridge")
    && restoredSeattleWorld.areas.some(area => area.kind === "slope" && area.terrainSlope === "steep"),
  "Seattle regional identity, bridge geometry, or slope evidence was lost during persistence."
);
const legacySeattleSnapshot = JSON.parse(seattleWorld.serialize());
delete legacySeattleSnapshot.areas;
check(
  restoredSeattleWorld.restore(JSON.stringify(legacySeattleSnapshot))
    && restoredSeattleWorld.areas.some(area => area.kind === "water" && area.name === "Lake Washington"),
  "A legacy Seattle save without area geometry did not recover its regional terrain."
);

const portlandWorld = new World();
check(
  portlandWorld.applyTemplate("portland")
    && portlandWorld.cityName === "New River City"
    && portlandWorld.templateId === "portland",
  "The Portland foundation did not reset world and city identity."
);
check(
  portlandWorld.roads.length === 28
    && portlandWorld.areas.filter(area => area.kind === "water").length === 2
    && portlandWorld.areas.filter(area => area.kind === "growth-boundary").length === 1
    && portlandWorld.areas.filter(area => area.kind === "park").length === 3
    && portlandWorld.areas.filter(area => area.kind === "district").length === 5,
  "The Portland foundation lost its rivers, growth boundary, parks, districts, or compact street structure."
);
const portlandI5 = portlandWorld.roads.find(road => road.id === "portland-i5")!;
const portlandBurnside = portlandWorld.roads.find(road => road.id === "portland-burnside")!;
const portlandGreenway = portlandWorld.roads.find(road => road.id === "portland-willamette-greenway")!;
check(
  portlandI5.developable === false
    && portlandI5.profile?.travelLanes === 6
    && portlandI5.profile.speedLimitKph === 90
    && portlandBurnside.profile?.busLanes === true
    && portlandBurnside.profile.bikeLanes === true
    && portlandGreenway.developable === false
    && portlandGreenway.profile?.bikeLanes === true
    && !portlandWorld.lots.some(lot => lot.roadId === portlandI5.id || lot.roadId === portlandGreenway.id),
  "Portland freeway, transit-priority main street, and bicycle greenway profiles lost their access rules."
);
const portlandBoundaryCounts = { inside: 0, outside: 0 };
portlandWorld.lots.forEach(lot => portlandBoundaryCounts[portlandWorld.lotGrowthBoundaryStatus(lot)] += 1);
const portlandZones = new Set(portlandWorld.lots.map(lot => lot.zone));
check(
  portlandWorld.lots.length > 600
    && portlandBoundaryCounts.inside > 0
    && portlandBoundaryCounts.outside > 0
    && portlandZones.has("unassigned")
    && portlandZones.has("residential")
    && portlandZones.has("commercial")
    && portlandZones.has("mixed")
    && portlandZones.has("industrial"),
  "Portland did not create compact parcels, inside and outside boundary states, and neighborhood zoning variety."
);
const portlandOutsideLot = portlandWorld.lots.find(lot => portlandWorld.lotGrowthBoundaryStatus(lot) === "outside")!;
const portlandOutsideValue = portlandWorld.lotLandValue(portlandOutsideLot);
const portlandBoundaryAreaIndex = portlandWorld.areas.findIndex(area => area.kind === "growth-boundary");
const [portlandBoundaryArea] = portlandWorld.areas.splice(portlandBoundaryAreaIndex, 1);
const portlandUnconstrainedValue = portlandWorld.lotLandValue(portlandOutsideLot);
check(
  portlandWorld.lotGrowthBoundaryStatus(portlandOutsideLot) === "inside"
    && portlandOutsideValue === Math.max(0, portlandUnconstrainedValue - 10),
  "Development beyond the Portland growth boundary did not receive its explicit land-value pressure."
);
portlandWorld.areas.splice(portlandBoundaryAreaIndex, 0, portlandBoundaryArea);
check(
  portlandWorld.transitLines[0]?.name === "Burnside Crosstown P1"
    && portlandWorld.transitLines[0].stops.some(stop => stop.name === "Downtown")
    && portlandWorld.parking.length === 3
    && portlandWorld.cityEvents[0]?.name === "Waterfront Rose Festival"
    && portlandWorld.cityEvents[0].kind === "parade",
  "The Portland foundation did not seed its local transit, parking, and waterfront event."
);
const portlandWeather = portlandWorld.weather();
const matchingPortlandWorld = new World();
matchingPortlandWorld.applyTemplate("portland");
check(
  portlandWeather.kind === "rain"
    && portlandWeather.temperatureC < houstonWeather.temperatureC
    && JSON.stringify(portlandWeather) === JSON.stringify(matchingPortlandWorld.weather()),
  "Portland climate was not cool, rainy, and deterministic on the reference winter date."
);
const restoredPortlandWorld = new World();
check(
  restoredPortlandWorld.restore(portlandWorld.serialize())
    && restoredPortlandWorld.templateId === "portland"
    && restoredPortlandWorld.roads.some(road => road.id === "portland-i84")
    && restoredPortlandWorld.areas.some(area => area.kind === "growth-boundary"),
  "Portland regional identity, freeway geometry, or growth boundary was lost during persistence."
);
const legacyPortlandSnapshot = JSON.parse(portlandWorld.serialize());
delete legacyPortlandSnapshot.areas;
check(
  restoredPortlandWorld.restore(JSON.stringify(legacyPortlandSnapshot))
    && restoredPortlandWorld.areas.some(area => area.kind === "water" && area.name === "Willamette River"),
  "A legacy Portland save without area geometry did not recover its regional terrain."
);

const householdIdentityWorld = new World();
const householdIdentityHome = householdIdentityWorld.ensureHome(householdIdentityWorld.lots[0]);
check(!householdIdentityWorld.setHomeName(householdIdentityHome.id, "<home>"), "Home identity accepted unsafe markup characters.");
check(householdIdentityWorld.setHomeName(householdIdentityHome.id, "The Rivera Home"), "A valid home identity was rejected.");
const householdIdentitySnapshot = householdIdentityWorld.serialize();
check(householdIdentityWorld.setHomeName(householdIdentityHome.id, "Temporary Name"), "Home identity could not be changed twice.");
check(
  householdIdentityWorld.restore(householdIdentitySnapshot)
    && householdIdentityWorld.homes[0].name === "The Rivera Home",
  "Recovery lost the saved home identity."
);
check(householdIdentityWorld.undo() && householdIdentityWorld.homes[0].name === "Temporary Name", "Undo did not restore home identity.");
check(householdIdentityWorld.redo() && householdIdentityWorld.homes[0].name === "The Rivera Home", "Redo did not restore home identity.");
const unsafeIdentitySnapshot = JSON.parse(householdIdentityWorld.serialize());
unsafeIdentitySnapshot.cityName = "<unsafe city>";
unsafeIdentitySnapshot.templateId = "unsafe-template";
unsafeIdentitySnapshot.homes[0].name = "<unsafe home>";
check(householdIdentityWorld.restore(JSON.stringify(unsafeIdentitySnapshot)), "Legacy identity migration snapshot could not load.");
check(
  householdIdentityWorld.cityName === "New Gridless City"
    && householdIdentityWorld.templateId === "nyc"
    && householdIdentityWorld.homes[0].name === "New household",
  "Loaded identity migration retained unsafe city, template, or home text."
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
const interiorExteriorWalls = interiorHome.rooms.flatMap(room => homeRoomExteriorWalls(interiorHome, room));
check(
  interiorExteriorWalls.length === 6,
  "Shared interior walls incorrectly received exterior window eligibility."
);
check(
  furniturePlacementWorld.homeDaylight(furniturePlacementWorld.homes[0]) === 79
    && furniturePlacementWorld.homes[0].rooms.every(room =>
      furniturePlacementWorld.roomDaylight(furniturePlacementWorld.homes[0], room) >= 18
      && furniturePlacementWorld.roomDaylight(furniturePlacementWorld.homes[0], room) <= 100
    ),
  "Exterior wall exposure did not produce bounded deterministic home daylight."
);
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
const maintenanceHome = furniturePlacementWorld.homes[0];
const repairTable = maintenanceHome.furniture.find(item => item.id === "interior-table")!;
repairTable.condition = 40;
studio.condition = 50;
maintenanceHome.householdFunds = 0;
const expectedFurnitureRepair = furniturePlacementWorld.furnitureRepairCost(repairTable);
const expectedRoomRenovation = furniturePlacementWorld.roomRenovationCost(studio);
check(
  !furniturePlacementWorld.repairFurniture(maintenanceHome.id, repairTable.id).ok
    && furniturePlacementWorld.furnitureCondition(repairTable) === 40,
  "An unaffordable furniture repair changed the furnishing or household funds."
);
maintenanceHome.householdFunds = 10_000;
check(
  expectedFurnitureRepair === 164
    && furniturePlacementWorld.repairFurniture(maintenanceHome.id, repairTable.id).ok
    && furniturePlacementWorld.furnitureCondition(repairTable) === 100
    && furniturePlacementWorld.homeHouseholdFunds(maintenanceHome) === 10_000 - expectedFurnitureRepair,
  "Furniture repair did not restore condition or debit the exact household cost."
);
check(
  expectedRoomRenovation === 150
    && furniturePlacementWorld.renovateRoom(maintenanceHome.id, studio.id).ok
    && furniturePlacementWorld.roomCondition(studio) === 100
    && furniturePlacementWorld.homeHouseholdFunds(maintenanceHome) === 10_000 - expectedFurnitureRepair - expectedRoomRenovation,
  "Room renovation did not restore condition or debit the exact household cost."
);
furniturePlacementWorld.advanceMinutes(90 * 24 * 60, 0);
check(
  furniturePlacementWorld.furnitureCondition(repairTable) < 100
    && furniturePlacementWorld.roomCondition(studio) < 100
    && furniturePlacementWorld.homeCondition(maintenanceHome) < 100,
  "Daily occupancy and furnishing use did not create persistent home wear."
);
const wornHomeSnapshot = furniturePlacementWorld.serialize();
const restoredWornHomeWorld = new World();
check(
  restoredWornHomeWorld.restore(wornHomeSnapshot)
    && restoredWornHomeWorld.homeCondition(restoredWornHomeWorld.homes[0]) === furniturePlacementWorld.homeCondition(maintenanceHome),
  "Room and furniture condition did not survive save and restore."
);
const legacyConditionSnapshot = JSON.parse(wornHomeSnapshot);
delete legacyConditionSnapshot.homes[0].rooms[0].condition;
legacyConditionSnapshot.homes[0].furniture[0].condition = 500;
const migratedConditionWorld = new World();
check(
  migratedConditionWorld.restore(JSON.stringify(legacyConditionSnapshot))
    && migratedConditionWorld.roomCondition(migratedConditionWorld.homes[0].rooms[0]) === 100
    && migratedConditionWorld.furnitureCondition(migratedConditionWorld.homes[0].furniture[0]) === 100,
  "Legacy or unsafe home condition values did not migrate into the supported range."
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
const multiFloorWorld = new World();
const multiFloorHome: Home = {
  ...structuredClone(interiorHome),
  id: "multi-floor-home",
  designSpent: 2_000,
  stairs: []
};
multiFloorWorld.homes = [multiFloorHome];
const beforeFloorShell = multiFloorWorld.homeRemainingBudget(multiFloorHome);
check(
  multiFloorWorld.addHomeFloor(multiFloorHome.id)
    && multiFloorHome.floors === 2
    && multiFloorWorld.homeRemainingBudget(multiFloorHome) === beforeFloorShell - HOME_BUILD_COSTS.floorShell,
  "A second floor shell was not added at its exact persistent cost."
);
check(
  multiFloorWorld.addRoom(multiFloorHome.id, {
    kind: "Bedroom",
    x: 0,
    z: 0,
    width: 8,
    depth: 6,
    floor: 1
  }),
  "Home Simulator rejected a valid upper-floor room."
);
check(
  multiFloorWorld.addFurniture(multiFloorHome.id, "plant", -2, 1, 1)
    && multiFloorWorld.addFurniture(multiFloorHome.id, "plant", -2, 1, 0),
  "Floor-aware furnishing incorrectly treated matching coordinates on separate floors as overlap."
);
check(
  multiFloorWorld.addStairs(multiFloorHome.id, 0, 2, 0)
    && !multiFloorWorld.addStairs(multiFloorHome.id, 1, 2, 0)
    && !multiFloorWorld.addStairs(multiFloorHome.id, 0, 2, 0),
  "Stairs did not enforce one valid adjacent-floor connection."
);
const groundFloorView = homeFloorView(multiFloorHome, 0);
const upperFloorView = homeFloorView(multiFloorHome, 1);
check(
  groundFloorView.rooms.length === 2
    && upperFloorView.rooms.length === 1
    && groundFloorView.furniture.every(item => homeEntityFloor(item) === 0)
    && upperFloorView.furniture.every(item => homeEntityFloor(item) === 1)
    && groundFloorView.stairs?.length === 1
    && upperFloorView.stairs?.length === 1,
  "Per-floor home views leaked rooms, furnishings, or stair links between levels."
);
const restoredMultiFloorWorld = new World();
check(
  restoredMultiFloorWorld.restore(multiFloorWorld.serialize())
    && restoredMultiFloorWorld.homes[0].floors === 2
    && restoredMultiFloorWorld.homes[0].stairs?.length === 1
    && restoredMultiFloorWorld.homes[0].rooms.some(room => homeEntityFloor(room) === 1),
  "Multi-floor home structure did not survive save and restore."
);
const legacyFloorSnapshot = JSON.parse(multiFloorWorld.serialize()) as ReturnType<World["snapshot"]>;
legacyFloorSnapshot.homes[0].floors = undefined as unknown as number;
legacyFloorSnapshot.homes[0].rooms.forEach(room => { delete room.floor; });
legacyFloorSnapshot.homes[0].furniture.forEach(item => { delete item.floor; });
delete legacyFloorSnapshot.homes[0].stairs;
const legacyFloorWorld = new World();
check(
  legacyFloorWorld.restore(JSON.stringify(legacyFloorSnapshot))
    && legacyFloorWorld.homes[0].floors === 1
    && legacyFloorWorld.homes[0].rooms.every(room => homeEntityFloor(room) === 0)
    && legacyFloorWorld.homes[0].furniture.every(item => homeEntityFloor(item) === 0),
  "Legacy single-floor homes did not migrate safely to Floor 1."
);
check(
  !Array.from({ length: MAX_HOME_FLOORS }, () => multiFloorWorld.addHomeFloor(multiFloorHome.id)).every(Boolean)
    && multiFloorHome.floors === MAX_HOME_FLOORS,
  "Home floor construction did not enforce the supported vertical limit."
);
check(
  multiFloorWorld.removeTopHomeFloor(multiFloorHome.id)
    && multiFloorHome.floors === MAX_HOME_FLOORS - 1,
  "Top-floor removal did not reduce the persistent home structure."
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
  catalogWorld.setFurnitureVariant(catalogHome.id, catalogDesk.id, "modern")
    && catalogWorld.setFurnitureTint(catalogHome.id, catalogDesk.id, "#7C3AED")
    && catalogDesk.variant === "modern"
    && catalogDesk.tint === "#7c3aed"
    && catalogWorld.homeRemainingBudget(catalogHome) === budgetBeforeStyle,
  "Furniture design and custom color did not persist as cost-free cosmetic choices."
);
check(
  !catalogWorld.setFurnitureVariant(catalogHome.id, catalogDesk.id, "modern")
    && !catalogWorld.setFurnitureTint(catalogHome.id, catalogDesk.id, "#7c3aed")
    && !catalogWorld.setFurnitureTint(catalogHome.id, catalogDesk.id, "purple"),
  "Furniture customization accepted a redundant or unsafe value."
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
    && catalogWorld.snapshot().homes[0].furniture.find(item => item.id === catalogDesk.id)?.style === "colorful"
    && catalogWorld.snapshot().homes[0].furniture.find(item => item.id === catalogDesk.id)?.variant === "modern"
    && catalogWorld.snapshot().homes[0].furniture.find(item => item.id === catalogDesk.id)?.tint === "#7c3aed",
  "Expanded catalog furniture or its cosmetic choices were omitted from the world snapshot."
);
const restoredCatalogWorld = new World();
check(
  restoredCatalogWorld.restore(catalogWorld.serialize())
    && restoredCatalogWorld.homes[0].furniture.find(item => item.id === catalogDesk.id)?.variant === "modern"
    && restoredCatalogWorld.homes[0].furniture.find(item => item.id === catalogDesk.id)?.tint === "#7c3aed",
  "Furniture design and custom color did not survive save and restore."
);
const unsafeCatalogSnapshot = catalogWorld.snapshot();
const unsafeCatalogFurniture = unsafeCatalogSnapshot.homes[0].furniture[0] as { variant?: string; tint?: string };
unsafeCatalogFurniture.variant = "ornate";
unsafeCatalogFurniture.tint = "javascript:paint";
const migratedCatalogWorld = new World();
check(
  migratedCatalogWorld.restore(JSON.stringify(unsafeCatalogSnapshot))
    && migratedCatalogWorld.homes[0].furniture[0].variant === "classic"
    && migratedCatalogWorld.homes[0].furniture[0].tint === undefined,
  "Unsafe legacy furniture customization did not migrate to safe defaults."
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
    traits: ["creative", "organized"],
    aspiration: "mastery",
    careerTrack: "civic",
    decorPreference: "dark",
    favoritePastime: "reading",
    outfitStyle: "formal",
    outfitPalette: "sunset",
    personality: {
      cleanliness: 88,
      spontaneity: 34,
      sociability: 62,
      emotionality: 28,
      activity: 57
    }
  }),
  "Resident creator rejected a valid authored profile."
);
check(
  residentCreatorHome.residents[0].name === "Morgan Lee"
    && residentCreatorHome.residents[0].role === "office"
    && residentCreatorHome.residents[0].traits.join(",") === "creative,organized"
    && residentCreatorHome.residents[0].personality?.cleanliness === 88
    && residentCreatorHome.residents[0].personality?.emotionality === 28
    && residentCreatorWorld.residentDecorPreference(residentCreatorHome.residents[0]) === "dark"
    && residentCreatorWorld.residentFavoritePastime(residentCreatorHome.residents[0]) === "reading"
    && residentCreatorWorld.residentOutfitStyle(residentCreatorHome.residents[0]) === "formal"
    && residentCreatorWorld.residentOutfitPalette(residentCreatorHome.residents[0]) === "sunset"
    && residentCreatorWorld.residentMilestones(residentCreatorHome.residents[0])[0]?.kind === "arrival"
    && residentCreatorHome.name === "Morgan Lee's household",
  "Resident creator did not preserve the authored profile or household name."
);
check(
  residentCreatorWorld.setResidentOutfit(residentCreatorHome.id, residentCreatorHome.residents[0].id, "active", "ocean")
    && residentCreatorWorld.residentOutfitLabel(residentCreatorHome.residents[0]) === "Active · Ocean"
    && residentCreatorWorld.setResidentOutfit(residentCreatorHome.id, residentCreatorHome.residents[0].id, "formal", "sunset")
    && residentCreatorWorld.residentOutfitLabel(residentCreatorHome.residents[0]) === "Formal · Sunset",
  "Resident wardrobe changes did not update the persistent profile."
);
const personalWorld = new World();
const personalHome = structuredClone(residentCreatorHome);
personalHome.id = "personal-home";
personalHome.householdFunds = 15_000;
personalHome.discretionarySpent = 0;
personalWorld.homes = [personalHome];
const personalResident = personalHome.residents[0];
check(
  personalWorld.addFurniture(personalHome.id, "plant", -2, 1),
  "Resident belongings fixture could not place its owned pastime furnishing."
);
const personalFurniture = personalHome.furniture.find(item => item.kind === "plant")!;
const initialOwnershipSatisfaction = personalWorld.residentOwnershipSatisfaction(personalHome, personalResident);
check(
  personalWorld.buyResidentPersonalItem(personalHome.id, personalResident.id, "book-set").ok
    && personalWorld.homeHouseholdFunds(personalHome) === 14_920
    && personalHome.discretionarySpent === 80
    && personalResident.inventory?.[0].kind === "book-set"
    && personalWorld.residentSkills(personalResident).creativity === 3
    && personalWorld.residentAspirationProgress(personalResident) === 5
    && personalWorld.residentMilestones(personalResident)[0]?.kind === "collection",
  "A personal collection purchase did not debit funds or update inventory, skills, and aspiration."
);
check(
  !personalWorld.buyResidentPersonalItem(personalHome.id, personalResident.id, "book-set").ok
    && personalResident.inventory?.length === 1
    && personalWorld.homeHouseholdFunds(personalHome) === 14_920,
  "A duplicate personal item was purchased or charged twice."
);
check(
  !personalWorld.setFurnitureOwner(personalHome.id, personalFurniture.id, "missing-resident")
    && personalWorld.setFurnitureOwner(personalHome.id, personalFurniture.id, personalResident.id)
    && personalWorld.setFurnitureStyle(personalHome.id, personalFurniture.id, "dark")
    && personalWorld.residentOwnedFurniture(personalHome, personalResident).length === 1
    && personalWorld.residentOwnershipSatisfaction(personalHome, personalResident) > initialOwnershipSatisfaction,
  "Furniture ownership, preferred style, or belonging satisfaction did not update correctly."
);
personalWorld.clock.minute = 20 * 60;
personalResident.favoritePastime = "gardening";
personalResident.energy = 100;
personalResident.social = 100;
personalResident.comfort = 100;
personalResident.health = 80;
personalResident.stress = 50;
personalWorld.advanceMinutes(1, 0);
check(
  personalResident.currentAction?.kind === "tend-plants"
    && personalResident.currentAction.targetFurnitureId === personalFurniture.id,
  "Favorite-pastime autonomy did not prefer the resident's owned matching furnishing."
);
personalResident.favoritePastime = "reading";
const restoredPersonalWorld = new World();
check(
  restoredPersonalWorld.restore(personalWorld.serialize())
    && restoredPersonalWorld.homes[0].furniture.find(item => item.id === personalFurniture.id)?.ownerResidentId === personalResident.id
    && restoredPersonalWorld.homes[0].residents[0].inventory?.[0].kind === "book-set"
    && restoredPersonalWorld.residentDecorPreference(restoredPersonalWorld.homes[0].residents[0]) === "dark"
    && restoredPersonalWorld.residentFavoritePastime(restoredPersonalWorld.homes[0].residents[0]) === "reading"
    && restoredPersonalWorld.residentOutfitStyle(restoredPersonalWorld.homes[0].residents[0]) === "formal"
    && restoredPersonalWorld.residentOutfitPalette(restoredPersonalWorld.homes[0].residents[0]) === "sunset"
    && restoredPersonalWorld.residentMilestones(restoredPersonalWorld.homes[0].residents[0])[0]?.kind === "collection",
  "Personal preferences, inventory, milestone, or furniture ownership was lost during persistence."
);
const gatheringWorld = new World();
const gatheringHome = structuredClone(interiorHome);
gatheringHome.id = "gathering-home";
gatheringHome.name = "Gathering household";
gatheringHome.residents = [];
gatheringHome.relationships = [];
gatheringHome.gatherings = [];
gatheringHome.householdFunds = 1_000;
gatheringHome.discretionarySpent = 0;
gatheringWorld.homes = [gatheringHome];
check(
  gatheringWorld.addResident(gatheringHome.id, { name: "Host", age: "adult", role: "home", traits: ["outgoing", "empathetic"] })
    && gatheringWorld.addResident(gatheringHome.id, { name: "Friend", age: "adult", role: "home", traits: ["creative", "homebody"] }),
  "Household gathering fixture could not create its host household."
);
const gatheringRelationshipBefore = gatheringHome.relationships[0].score;
const gatheringSocialBefore = gatheringHome.residents[0].social;
const scheduledDinner = gatheringWorld.scheduleHouseholdGathering(gatheringHome.id, gatheringHome.residents[0].id, "dinner", 60);
check(
  scheduledDinner.ok
    && scheduledDinner.gathering?.guestCount !== undefined
    && scheduledDinner.gathering.guestCount >= 2
    && scheduledDinner.gathering.guestCount <= 14
    && gatheringWorld.homeHouseholdFunds(gatheringHome) === 860
    && !gatheringWorld.scheduleHouseholdGathering(gatheringHome.id, gatheringHome.residents[0].id, "game-night", 90).ok,
  "Gathering invitations did not debit funds, bound guest count, or prevent overlapping plans."
);
gatheringWorld.advanceMinutes(90, 0);
check(
  gatheringWorld.activeHouseholdGathering(gatheringHome)?.kind === "dinner"
    && gatheringWorld.householdGatheringStatus(scheduledDinner.gathering!).includes("In progress"),
  "Scheduled visitors did not become active during the gathering window."
);
gatheringWorld.advanceMinutes(100, 0);
check(
  scheduledDinner.gathering?.completedAt !== undefined
    && scheduledDinner.gathering.attendance === scheduledDinner.gathering.guestCount + gatheringHome.residents.length
    && gatheringHome.relationships[0].score >= Math.min(100, gatheringRelationshipBefore + 5)
    && gatheringHome.residents[0].social > gatheringSocialBefore
    && gatheringWorld.residentSkills(gatheringHome.residents[0]).communication >= 3,
  "A completed household gathering did not preserve attendance, needs, relationships, and host growth."
);
const futureGathering = gatheringWorld.scheduleHouseholdGathering(gatheringHome.id, gatheringHome.residents[1].id, "game-night", 1_440);
const restoredGatheringWorld = new World();
check(
  futureGathering.ok
    && restoredGatheringWorld.restore(gatheringWorld.serialize())
    && restoredGatheringWorld.householdGatherings(restoredGatheringWorld.homes[0]).length === 2
    && restoredGatheringWorld.householdGatherings(restoredGatheringWorld.homes[0]).some(gathering => gathering.kind === "game-night" && gathering.completedAt === undefined),
  "Completed and upcoming household gatherings did not survive persistence."
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
  !residentCreatorWorld.addResident(residentCreatorHome.id, {
    name: "Invalid Matrix",
    age: "adult",
    role: "home",
    traits: ["active", "creative"],
    personality: {
      cleanliness: 50,
      spontaneity: 50,
      sociability: 101,
      emotionality: 50,
      activity: 50
    }
  }),
  "Resident creator accepted a personality axis outside 0 to 100."
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
check(
  residentCreatorWorld.snapshot().homes[0].residents[0].personality?.cleanliness === 88,
  "Authored personality matrix was omitted from the world snapshot."
);
const personalityPeer = {
  ...structuredClone(residentCreatorHome.residents[0]),
  id: "personality-peer",
  personality: { cleanliness: 82, spontaneity: 39, sociability: 65, emotionality: 33, activity: 53 }
};
const personalityOpposite = {
  ...structuredClone(residentCreatorHome.residents[0]),
  id: "personality-opposite",
  personality: { cleanliness: 8, spontaneity: 94, sociability: 4, emotionality: 96, activity: 2 }
};
check(
  residentCreatorWorld.relationshipCompatibility(residentCreatorHome.residents[0], personalityPeer)
    > residentCreatorWorld.relationshipCompatibility(residentCreatorHome.residents[0], personalityOpposite),
  "Personality-matrix similarity did not influence resident compatibility."
);
check(
  residentCreatorWorld.residentActionPersonalityInfluence(personalityPeer, "socialize")
    > residentCreatorWorld.residentActionPersonalityInfluence(personalityOpposite, "socialize"),
  "Sociability did not influence autonomous social priority."
);
check(
  residentCreatorWorld.residentCareerFit(residentCreatorHome.residents[0])
    > residentCreatorWorld.residentCareerFit(personalityOpposite),
  "The personality matrix did not influence career fit."
);
const legacyPersonalitySnapshot = residentCreatorWorld.snapshot();
const legacyPersonalityResident = legacyPersonalitySnapshot.homes[0].residents[0];
delete legacyPersonalityResident.personality;
delete legacyPersonalityResident.decorPreference;
delete legacyPersonalityResident.favoritePastime;
delete legacyPersonalityResident.outfitStyle;
delete legacyPersonalityResident.outfitPalette;
legacyPersonalityResident.inventory = [
  { id: "legacy-books", kind: "book-set", acquiredAt: 99_999 },
  { id: "duplicate-books", kind: "book-set", acquiredAt: 99_999 },
  { id: "legacy-books", kind: "garden-kit", acquiredAt: 99_999 }
];
legacyPersonalitySnapshot.homes[0].furniture[0].ownerResidentId = "missing-resident";
const personalityMigrationWorld = new World();
check(
  personalityMigrationWorld.restore(JSON.stringify(legacyPersonalitySnapshot))
    && personalityMigrationWorld.snapshot().homes[0].residents[0].personality !== undefined
    && Object.values(personalityMigrationWorld.snapshot().homes[0].residents[0].personality!).every(value =>
      Number.isInteger(value) && value >= 0 && value <= 100
    )
    && personalityMigrationWorld.residentDecorPreference(personalityMigrationWorld.homes[0].residents[0]) === "colorful"
    && personalityMigrationWorld.residentFavoritePastime(personalityMigrationWorld.homes[0].residents[0]) === "cooking"
    && personalityMigrationWorld.residentOutfitStyle(personalityMigrationWorld.homes[0].residents[0]) === "smart"
    && personalityMigrationWorld.residentOutfitPalette(personalityMigrationWorld.homes[0].residents[0]) === "bright"
    && personalityMigrationWorld.homes[0].residents[0].inventory?.length === 2
    && new Set(personalityMigrationWorld.homes[0].residents[0].inventory?.map(item => item.id)).size === 2
    && personalityMigrationWorld.homes[0].residents[0].inventory?.[0].acquiredAt === 0
    && personalityMigrationWorld.homes[0].furniture[0].ownerResidentId === undefined,
  "A legacy resident did not receive safe personality, preference, outfit, inventory, and ownership migration."
);
residentCreatorHome.residents[0].careerXp = 38;
residentCreatorWorld.advanceMinutes(24 * 60, 0);
check(
  residentCreatorWorld.residentCareerLevel(residentCreatorHome.residents[0]) === 2
    && residentCreatorWorld.residentCareerTitle(residentCreatorHome.residents[0]) === "Apprentice · Civic planning"
    && residentCreatorWorld.residentSkills(residentCreatorHome.residents[0]).communication === 1
    && residentCreatorHome.lastDailyIncome === 275
    && residentCreatorHome.lastDailyExpenses === 132
    && residentCreatorWorld.homeHouseholdFunds(residentCreatorHome) === 15_143,
  "A completed workday did not advance career skills or settle household finances."
);
check(
  residentCreatorWorld.snapshot().homes[0].householdFunds === 15_143,
  "Household finances were omitted from the world snapshot."
);

const lifeCycleWorld = new World();
const lifeCycleHome = structuredClone(interiorHome);
lifeCycleHome.id = "life-cycle-home";
lifeCycleHome.lotId = lifeCycleWorld.lots.find(item => item.zone === "residential" || item.zone === "mixed")?.id ?? lifeCycleWorld.lots[0].id;
lifeCycleHome.name = "Generational household";
lifeCycleHome.residents = [];
lifeCycleHome.relationships = [];
lifeCycleHome.householdFunds = 15_000;
lifeCycleWorld.homes = [lifeCycleHome];
check(
  lifeCycleWorld.addResident(lifeCycleHome.id, {
    name: "Samira",
    age: "adult",
    lifeStage: "adult",
    role: "office",
    traits: ["organized", "empathetic"],
    aspiration: "mastery",
    careerTrack: "civic",
    personality: { cleanliness: 84, spontaneity: 34, sociability: 68, emotionality: 46, activity: 58 }
  })
    && lifeCycleWorld.addResident(lifeCycleHome.id, {
      name: "Devon",
      age: "adult",
      lifeStage: "young-adult",
      role: "home",
      traits: ["creative", "outgoing"],
      aspiration: "creative",
      careerTrack: "creative",
      personality: { cleanliness: 38, spontaneity: 88, sociability: 72, emotionality: 66, activity: 52 }
    }),
  "The resident creator rejected a valid multigenerational household foundation."
);
const samira = lifeCycleHome.residents[0];
const devon = lifeCycleHome.residents[1];
check(
  lifeCycleWorld.addResident(lifeCycleHome.id, {
    name: "Kai",
    age: "child",
    lifeStage: "infant",
    role: "home",
    traits: ["empathetic", "creative"],
    aspiration: "family",
    caregiverIds: [samira.id, devon.id],
    inheritPersonality: true
  }),
  "The resident creator rejected a valid dependent with caregivers."
);
const kai = lifeCycleHome.residents[2];
const inheritedPersonality = lifeCycleWorld.residentPersonality(kai);
check(
  !lifeCycleWorld.addResident(lifeCycleHome.id, {
    name: "Invalid Lineage",
    age: "child",
    lifeStage: "toddler",
    role: "home",
    traits: ["active", "homebody"],
    caregiverIds: [kai.id]
  }),
  "A dependent resident was accepted as another dependent's caregiver."
);
check(
  lifeCycleWorld.addResident(lifeCycleHome.id, {
    name: "Rosa",
    age: "adult",
    lifeStage: "elder",
    role: "service",
    traits: ["homebody", "empathetic"],
    aspiration: "community",
    careerTrack: "care"
  })
    && lifeCycleHome.residents[3].role === "home"
    && lifeCycleWorld.residentCareerTitle(lifeCycleHome.residents[3]) === "Household mentor"
    && lifeCycleWorld.residentDailyWage(lifeCycleHome.residents[3]) === 0,
  "An elder profile did not normalize to a retired household mentor."
);
check(
  kai.generation === 2
    && kai.caregiverIds?.join(",") === `${samira.id},${devon.id}`
    && lifeCycleWorld.relationshipBetween(lifeCycleHome, samira.id, kai.id)?.score === 78
    && lifeCycleWorld.relationshipBetween(lifeCycleHome, devon.id, kai.id)?.score === 78
    && RESIDENT_PERSONALITY_AXES.every(axis =>
      Math.abs(inheritedPersonality[axis] - Math.round((lifeCycleWorld.residentPersonality(samira)[axis] + lifeCycleWorld.residentPersonality(devon)[axis]) / 2)) <= 7
    ),
  "Caregiver lineage did not establish generation, bonds, or blended personality."
);
samira.careerLevel = 3;
samira.careerXp = 119;
samira.aspirationProgress = 96;
kai.lifeStageDays = RESIDENT_LIFE_STAGE_DEFINITIONS.infant.durationDays! - 1;
lifeCycleWorld.advanceMinutes(24 * 60, 0);
check(
  lifeCycleWorld.residentLifeStage(kai) === "toddler"
    && kai.role === "home"
    && kai.lifeStageDays === 0
    && kai.lifetimeDays === 1
    && lifeCycleWorld.residentAspirationProgress(kai) === 10,
  "The daily simulation did not advance a resident life stage and family aspiration."
);
check(
  lifeCycleWorld.residentCareerLevel(samira) === 4
    && RESIDENT_CAREER_TRACK_DEFINITIONS.civic.branches.includes(samira.careerBranch!)
    && lifeCycleWorld.residentAspirationProgress(samira) === 100,
  "Career progression did not unlock a deterministic branch or advance mastery."
);
const samiraWorkplace = lifeCycleWorld.residentWorkplaceLot(samira);
const devonWorkplace = lifeCycleWorld.residentWorkplaceLot(devon);
check(
  Boolean(samiraWorkplace)
    && Boolean(devonWorkplace)
    && samira.workDaysCompleted === 1
    && devon.workDaysCompleted === 1
    && RESIDENT_WORK_TASK_DEFINITIONS[samira.lastWorkTask!].track === "civic"
    && RESIDENT_WORK_TASK_DEFINITIONS[devon.lastWorkTask!].track === "creative"
    && lifeCycleWorld.residentWorkPerformance(samira) >= 0
    && lifeCycleWorld.residentWorkPerformance(samira) <= 100
    && lifeCycleWorld.residentsAssignedToWorkplace(samiraWorkplace!.id).some(({ resident }) => resident.id === samira.id),
  "A completed workday did not create a valid physical workplace task and performance record."
);
const noonWorkplaceActivity = lifeCycleWorld.workplaceActivity(samiraWorkplace!, 12 * 60);
const retailProbe = {
  ...structuredClone(samiraWorkplace!),
  id: "retail-activity-probe",
  businesses: 10,
  businessMix: { retail: 10, office: 0, hospitality: 0, industrial: 0, community: 0 },
  anchorBusiness: { name: "Activity Market", sector: "retail" as const, jobs: 18 }
};
const industrialProbe = {
  ...structuredClone(samiraWorkplace!),
  id: "industrial-activity-probe",
  businesses: 10,
  businessMix: { retail: 0, office: 0, hospitality: 0, industrial: 10, community: 0 },
  anchorBusiness: { name: "Activity Works", sector: "industrial" as const, jobs: 26 }
};
const openRetailActivity = lifeCycleWorld.workplaceActivity(retailProbe, 12 * 60);
const closedRetailActivity = lifeCycleWorld.workplaceActivity(retailProbe, 3 * 60);
const industrialActivity = lifeCycleWorld.workplaceActivity(industrialProbe, 12 * 60);
check(
  noonWorkplaceActivity.namedWorkersAssigned >= 1
    && noonWorkplaceActivity.namedWorkersOnShift >= 1
    && noonWorkplaceActivity.coworkersOnShift > 0
    && openRetailActivity.customersPresent > 0
    && openRetailActivity.hourlyCustomerDemand > industrialActivity.hourlyCustomerDemand
    && closedRetailActivity.openBusinesses === 0
    && closedRetailActivity.customersPresent === 0
    && closedRetailActivity.label === "Closed"
    && openRetailActivity.servicePressure >= 0
    && openRetailActivity.servicePressure <= 100,
  "Workplace coworkers or sector, schedule, and customer activity did not respond deterministically."
);
const retailFinanceProjection = lifeCycleWorld.businessFinanceProjection(retailProbe);
const overloadedRetailProbe = {
  ...retailProbe,
  id: "overloaded-retail-finance-probe",
  anchorBusiness: { ...retailProbe.anchorBusiness, jobs: 10_000 }
};
const overloadedFinanceProjection = lifeCycleWorld.businessFinanceProjection(overloadedRetailProbe);
const settledWorkplaceFinance = lifeCycleWorld.businessFinance(samiraWorkplace!);
check(
  retailFinanceProjection.dailyCustomers > 0
    && retailFinanceProjection.revenue > 0
    && retailFinanceProjection.payroll > 0
    && retailFinanceProjection.operatingCosts > 0
    && retailFinanceProjection.profit === retailFinanceProjection.revenue - retailFinanceProjection.payroll - retailFinanceProjection.operatingCosts
    && retailFinanceProjection.profit > overloadedFinanceProjection.profit
    && overloadedFinanceProjection.profit < 0
    && settledWorkplaceFinance.lastSettledAt === lifeCycleWorld.clock.elapsedMinutes
    && lifeCycleWorld.cityEconomy().privateSectorRevenue > 0,
  "Daily customer demand did not produce coherent persistent business revenue, payroll, costs, and profit."
);
const viabilityWorld = new World();
const failingBusinessLot = viabilityWorld.lots.find(lot => lot.businesses > 0 && viabilityWorld.constructionProgress(lot) >= 1)!;
const failingSector = viabilityWorld.workplaceSector(failingBusinessLot);
failingBusinessLot.anchorBusiness = { name: "Overextended Works", sector: failingSector, jobs: 100_000 };
failingBusinessLot.businessFinance = {
  lastRevenue: 1,
  lastPayroll: 2,
  lastOperatingCosts: 0,
  lastProfit: -1,
  operatingReserve: 0,
  consecutiveLossDays: 4,
  lastSettledAt: 0
};
viabilityWorld.advanceMinutes(24 * 60, 0);
const failedFinance = viabilityWorld.businessFinance(failingBusinessLot);
check(
  failedFinance.lastClosureAt === viabilityWorld.clock.elapsedMinutes
    && failedFinance.consecutiveLossDays === 0
    && failedFinance.lastProfit < 0
    && viabilityWorld.businessViabilityLabel(failingBusinessLot) !== "Loss-making",
  "An exhausted five-day business loss streak did not close one establishment and reset its recovery state."
);
const restoredViabilityWorld = new World();
check(
  restoredViabilityWorld.restore(viabilityWorld.serialize())
    && JSON.stringify(restoredViabilityWorld.lots.find(lot => lot.id === failingBusinessLot.id)?.businessFinance)
      === JSON.stringify(failingBusinessLot.businessFinance),
  "Business finance, reserves, or closure history did not survive save and restore."
);
const legacyViabilitySnapshot = JSON.parse(viabilityWorld.serialize());
for (const lot of legacyViabilitySnapshot.lots) delete lot.businessFinance;
const migratedViabilityWorld = new World();
check(
  migratedViabilityWorld.restore(JSON.stringify(legacyViabilitySnapshot))
    && migratedViabilityWorld.lots.every(lot => lot.businessFinance?.operatingReserve === lot.businesses * 5_000),
  "Legacy lots did not receive safe business finance reserves during migration."
);
const earlyRoutineProbe = { ...structuredClone(samira), currentAction: undefined, routineProfile: "early-bird" as const };
const nightRoutineProbe = { ...structuredClone(samira), currentAction: undefined, routineProfile: "night-owl" as const };
const splitRoutineProbe = { ...structuredClone(samira), currentAction: undefined, routineProfile: "split-shift" as const };
const flexibleRoutineProbe = { ...structuredClone(samira), currentAction: undefined, routineProfile: "flexible" as const };
const earlySchedule = lifeCycleWorld.residentDailySchedule(earlyRoutineProbe, 2 * 1_440);
const nightSchedule = lifeCycleWorld.residentDailySchedule(nightRoutineProbe, 2 * 1_440);
const splitSchedule = lifeCycleWorld.residentDailySchedule(splitRoutineProbe, 2 * 1_440);
const flexibleMonday = lifeCycleWorld.residentDailySchedule(flexibleRoutineProbe, 0);
const flexibleNextMonday = lifeCycleWorld.residentDailySchedule(flexibleRoutineProbe, 7 * 1_440);
const weekendSchedule = lifeCycleWorld.residentDailySchedule(nightRoutineProbe, 5 * 1_440);
check(
  earlySchedule.workWindows[0].start === 7 * 60
    && nightSchedule.workWindows[0].start === 10 * 60
    && splitSchedule.workWindows.length === 2
    && splitSchedule.workWindows[0].end < splitSchedule.workWindows[1].start
    && JSON.stringify(flexibleMonday.workWindows) === JSON.stringify(flexibleNextMonday.workWindows)
    && !weekendSchedule.workingToday
    && weekendSchedule.workWindows.length === 0
    && lifeCycleWorld.residentStatusAt(earlyRoutineProbe, 7 * 60 + 30) === "At work"
    && lifeCycleWorld.residentStatusAt(nightRoutineProbe, 7 * 60 + 30) === "Home"
    && lifeCycleWorld.residentIsScheduledAsleep(earlyRoutineProbe, 22 * 60)
    && !lifeCycleWorld.residentIsScheduledAsleep(nightRoutineProbe, 22 * 60)
    && lifeCycleWorld.residentIsScheduledAsleep(nightRoutineProbe, 2 * 60),
  "Resident routines did not produce recurring early, late, split, flexible, sleep, and weekend schedules."
);
check(
  lifeCycleWorld.setResidentRoutine(lifeCycleHome.id, samira.id, "night-owl")
    && lifeCycleWorld.residentRoutineProfile(samira) === "night-owl"
    && lifeCycleWorld.residentRoutineSummary(samira).includes("Night owl")
    && !lifeCycleWorld.setResidentRoutine(lifeCycleHome.id, samira.id, "night-owl"),
  "The household editor did not persist a valid resident routine or reject a no-op change."
);
check(
  lifeCycleWorld.residentMilestones(samira).some(milestone => milestone.kind === "promotion")
    && lifeCycleWorld.residentMilestones(samira).some(milestone => milestone.kind === "career-branch")
    && lifeCycleWorld.residentMilestones(samira).some(milestone => milestone.kind === "aspiration")
    && lifeCycleWorld.residentMilestones(kai).some(milestone => milestone.kind === "life-stage")
    && lifeCycleWorld.residentMilestoneDate(lifeCycleWorld.residentMilestones(kai).find(milestone => milestone.kind === "life-stage")!) === "Y1 M1 D2"
    && lifeCycleWorld.residentMilestones(samira).every(milestone => !/[<>&]/.test(`${milestone.title}${milestone.detail}`)),
  "Career, aspiration, and birthday events did not become safe resident life milestones."
);
lifeCycleWorld.clock.minute = 20 * 60;
const familyProgressBeforeConversation = lifeCycleWorld.residentAspirationProgress(kai);
check(
  lifeCycleWorld.commandResidentConversation(lifeCycleHome.id, kai.id, samira.id, "support").ok,
  "A dependent could not begin a directed family conversation while home."
);
lifeCycleWorld.advanceMinutes(60, 0);
check(
  lifeCycleWorld.residentAspirationProgress(kai) === familyProgressBeforeConversation + 4,
  "A completed family interaction did not advance the resident aspiration."
);
const restoredLifeCycleWorld = new World();
check(
  restoredLifeCycleWorld.restore(lifeCycleWorld.serialize())
    && restoredLifeCycleWorld.homes[0].residents[2].generation === 2
    && restoredLifeCycleWorld.homes[0].residents[2].caregiverIds?.length === 2
    && restoredLifeCycleWorld.homes[0].residents[0].careerBranch === samira.careerBranch
    && restoredLifeCycleWorld.homes[0].residents[0].lastWorkTask === samira.lastWorkTask
    && restoredLifeCycleWorld.homes[0].residents[0].workPerformance === samira.workPerformance
    && restoredLifeCycleWorld.homes[0].residents[0].workDaysCompleted === 1
    && restoredLifeCycleWorld.residentRoutineProfile(restoredLifeCycleWorld.homes[0].residents[0]) === "night-owl"
    && restoredLifeCycleWorld.residentMilestones(restoredLifeCycleWorld.homes[0].residents[0]).some(milestone => milestone.kind === "promotion")
    && restoredLifeCycleWorld.residentMilestones(restoredLifeCycleWorld.homes[0].residents[2]).some(milestone => milestone.kind === "life-stage")
    && restoredLifeCycleWorld.residentAspirationProgress(restoredLifeCycleWorld.homes[0].residents[2]) === familyProgressBeforeConversation + 4,
  "Life stage, lineage, career, workplace, or aspiration state was lost during persistence."
);
const legacyLifeSnapshot = lifeCycleWorld.snapshot();
const legacyWorker = legacyLifeSnapshot.homes[0].residents[0];
legacyWorker.lastWorkTask = "prep-service";
legacyWorker.workPerformance = 999;
legacyWorker.workDaysCompleted = -4;
legacyWorker.lastWorkDayAt = lifeCycleWorld.clock.elapsedMinutes + 9_999;
const legacyDependent = legacyLifeSnapshot.homes[0].residents[2];
delete legacyDependent.lifeStage;
delete legacyDependent.generation;
delete legacyDependent.caregiverIds;
delete legacyDependent.aspiration;
delete legacyDependent.careerTrack;
delete legacyDependent.milestones;
delete legacyDependent.routineProfile;
legacyDependent.lifeStageDays = 9_999;
legacyDependent.lastLifeStageChangeAt = lifeCycleWorld.clock.elapsedMinutes + 9_999;
const migratedLifeWorld = new World();
const migratedLifeRestored = migratedLifeWorld.restore(JSON.stringify(legacyLifeSnapshot));
const migratedDependent = migratedLifeWorld.homes[0]?.residents[2];
const migratedWorker = migratedLifeWorld.homes[0]?.residents[0];
check(
  migratedLifeRestored
    && migratedLifeWorld.residentLifeStage(migratedDependent) === "child"
    && migratedDependent.lifeStageDays === RESIDENT_LIFE_STAGE_DEFINITIONS.child.durationDays! - 1
    && (migratedDependent.lastLifeStageChangeAt ?? 0) <= migratedLifeWorld.clock.elapsedMinutes
    && migratedDependent.generation === 2
    && migratedDependent.caregiverIds?.length === 2
    && migratedLifeWorld.residentMilestones(migratedDependent)[0]?.kind === "arrival"
    && migratedLifeWorld.residentMilestones(migratedDependent)[0]?.occurredAt === 0
    && migratedLifeWorld.residentRoutineProfile(migratedDependent) === "steady"
    && migratedWorker.lastWorkTask === undefined
    && migratedWorker.workPerformance === undefined
    && migratedWorker.workDaysCompleted === 0
    && (migratedWorker.lastWorkDayAt ?? 0) <= migratedLifeWorld.clock.elapsedMinutes
    && migratedLifeWorld.relationshipBetween(migratedLifeWorld.homes[0], migratedDependent.id, migratedDependent.caregiverIds[0])!.score >= 78,
  "Legacy resident life-stage, caregiver, or workplace fields did not receive safe migration."
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
const recurringPreferenceWorld = new World();
const recurringPreferenceHome = structuredClone(directControlBaseline);
recurringPreferenceWorld.homes = [recurringPreferenceHome];
recurringPreferenceWorld.clock.minute = 7 * 60;
recurringPreferenceWorld.setControlledResident("controlled-resident");
recurringPreferenceWorld.setResidentHomePosition(recurringPreferenceHome.id, "controlled-resident", { x: -2, z: 0 });
const recurringTable = recurringPreferenceHome.furniture.find(item => item.kind === "table")!;
for (let repetition = 0; repetition < 3; repetition++) {
  check(
    recurringPreferenceWorld.commandResidentFurnitureAction(
      recurringPreferenceHome.id,
      "controlled-resident",
      recurringTable.id
    ).ok,
    "A repeated meal could not start while learning an activity preference."
  );
  recurringPreferenceWorld.advanceMinutes(45, 0);
}
const recurringResident = recurringPreferenceHome.residents[0];
const mealPreference = recurringPreferenceWorld.residentActivityPreferences(recurringResident)
  .find(preference => preference.action === "eat");
check(
  mealPreference?.repetitions === 3
    && mealPreference.satisfaction >= 18
    && recurringPreferenceWorld.residentActivityPreferenceBias(recurringResident, "eat") > 0
    && recurringPreferenceWorld.residentActivityPreferenceSummary(recurringResident).includes("Returns to shared meals"),
  "Repeated satisfying activities did not become a bounded, explainable autonomy preference."
);
const restoredPreferenceWorld = new World();
check(
  restoredPreferenceWorld.restore(recurringPreferenceWorld.serialize())
    && JSON.stringify(restoredPreferenceWorld.residentActivityPreferences(restoredPreferenceWorld.homes[0].residents[0]))
      === JSON.stringify(recurringPreferenceWorld.residentActivityPreferences(recurringResident)),
  "Learned resident activity preferences did not survive save and restore."
);
const corruptedPreferenceSnapshot = recurringPreferenceWorld.snapshot();
corruptedPreferenceSnapshot.homes[0].residents[0].activityPreferences = [
  { action: "eat", repetitions: 99_999, satisfaction: 999, lastAt: recurringPreferenceWorld.clock.elapsedMinutes + 999 },
  { action: "eat", repetitions: 2, satisfaction: 4, lastAt: 0 }
];
const migratedPreferenceWorld = new World();
check(
  migratedPreferenceWorld.restore(JSON.stringify(corruptedPreferenceSnapshot))
    && migratedPreferenceWorld.residentActivityPreferences(migratedPreferenceWorld.homes[0].residents[0]).length === 1
    && migratedPreferenceWorld.residentActivityPreferences(migratedPreferenceWorld.homes[0].residents[0])[0].repetitions === 10_000
    && migratedPreferenceWorld.residentActivityPreferences(migratedPreferenceWorld.homes[0].residents[0])[0].satisfaction === 100
    && migratedPreferenceWorld.residentActivityPreferences(migratedPreferenceWorld.homes[0].residents[0])[0].lastAt === migratedPreferenceWorld.clock.elapsedMinutes,
  "Legacy activity preferences did not receive bounded duplicate-safe migration."
);
const movingResident = recurringPreferenceHome.residents[0];
movingResident.outfitStyle = "formal";
movingResident.outfitPalette = "sunset";
movingResident.routineProfile = "night-owl";
movingResident.inventory = [{ id: "moving-books", kind: "book-set", acquiredAt: 0 }];
movingResident.skills = { communication: 12, creativity: 18, wellness: 6, practical: 9 };
const ownedMovingFurniture = recurringPreferenceHome.furniture[0];
ownedMovingFurniture.ownerResidentId = movingResident.id;
recurringPreferenceHome.householdFunds = 12_000;
const moveDestination: Home = {
  ...structuredClone(recurringPreferenceHome),
  id: "move-destination-home",
  lotId: "move-destination-lot",
  name: "River House",
  furniture: [],
  residents: [],
  relationships: [],
  gatherings: [],
  householdFunds: 1_000
};
recurringPreferenceWorld.homes.push(moveDestination);
const dependentMoveProbe = recurringPreferenceHome.residents[1];
const dependentOriginalStage = dependentMoveProbe.lifeStage;
const dependentOriginalCaregivers = dependentMoveProbe.caregiverIds;
dependentMoveProbe.lifeStage = "child";
dependentMoveProbe.caregiverIds = [movingResident.id];
check(
  !recurringPreferenceWorld.moveResidentToHome(recurringPreferenceHome.id, movingResident.id, moveDestination.id).ok
    && recurringPreferenceHome.residents.includes(movingResident)
    && !moveDestination.residents.length,
  "A caregiver moved away while an active dependent remained in the old household."
);
dependentMoveProbe.lifeStage = dependentOriginalStage;
dependentMoveProbe.caregiverIds = dependentOriginalCaregivers;
const movingIdentity = JSON.stringify({
  id: movingResident.id,
  skills: movingResident.skills,
  inventory: movingResident.inventory,
  outfitStyle: movingResident.outfitStyle,
  outfitPalette: movingResident.outfitPalette,
  routineProfile: movingResident.routineProfile,
  activityPreferences: movingResident.activityPreferences
});
const moveResult = recurringPreferenceWorld.moveResidentToHome(
  recurringPreferenceHome.id,
  movingResident.id,
  moveDestination.id
);
const movedResident = moveDestination.residents.find(resident => resident.id === movingResident.id)!;
check(
  moveResult.ok
    && moveResult.transferred === 6_000
    && recurringPreferenceHome.householdFunds === 6_000
    && moveDestination.householdFunds === 7_000
    && !recurringPreferenceHome.residents.some(resident => resident.id === movingResident.id)
    && !recurringPreferenceHome.relationships.some(relationship => relationship.residentIds.includes(movingResident.id))
    && ownedMovingFurniture.ownerResidentId === undefined
    && JSON.stringify({
      id: movedResident.id,
      skills: movedResident.skills,
      inventory: movedResident.inventory,
      outfitStyle: movedResident.outfitStyle,
      outfitPalette: movedResident.outfitPalette,
      routineProfile: movedResident.routineProfile,
      activityPreferences: movedResident.activityPreferences
    }) === movingIdentity
    && recurringPreferenceWorld.residentMilestones(movedResident)[0]?.kind === "move",
  "Household move did not conserve funds, release the old room, or preserve the resident's identity and history."
);
const restoredMoveWorld = new World();
check(
  restoredMoveWorld.restore(recurringPreferenceWorld.serialize())
    && restoredMoveWorld.homes.find(home => home.id === moveDestination.id)?.residents[0]?.id === movingResident.id
    && restoredMoveWorld.residentMilestones(restoredMoveWorld.homes.find(home => home.id === moveDestination.id)!.residents[0])[0]?.kind === "move",
  "A moved resident or their new household chapter did not survive save and restore."
);
check(
  !recurringPreferenceWorld.moveResidentToHome(recurringPreferenceHome.id, "missing-resident", moveDestination.id).ok,
  "Household move accepted a resident who was not in the source home."
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
    world,
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
const confrontActivityPreference = confrontProbe.first.activityPreferences?.find(preference => preference.action === "socialize");
check(
  (confrontActivityPreference?.satisfaction ?? 0) <= -8
    && confrontProbe.world.residentActivityPreferenceBias(confrontProbe.first, "socialize") < 0
    && confrontProbe.world.residentActivityPreferenceSummary(confrontProbe.first).includes("avoids social time"),
  "A repeated-routine memory did not retain and explain an unsatisfying social activity."
);
const resentfulImpression = confrontProbe.world.relationshipImpression(confrontProbe.relationship!);
const supportWithoutHistory = confrontProbe.world.conversationRelationshipChange(
  confrontProbe.first,
  confrontProbe.second,
  "support",
  true,
  confrontProbe.relationship!.tension
);
const supportThroughResentment = confrontProbe.world.conversationRelationshipChange(
  confrontProbe.first,
  confrontProbe.second,
  "support",
  true,
  confrontProbe.relationship!.tension,
  confrontProbe.relationship!
);
check(
  resentfulImpression.kind === "resentment"
    && resentfulImpression.outcomeBias < 0
    && supportThroughResentment < supportWithoutHistory,
  "A remembered confrontation did not create lasting resentment or shape the next conversation."
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
const warmImpression = learnedPreferenceWorld.relationshipImpression(learnedPreferenceHome.relationships[0]);
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
check(
  warmImpression.kind === "warmth"
    && warmImpression.strength === 16
    && warmImpression.outcomeBias === 2
    && warmImpression.partnerBias > 0,
  "Repeated supportive memories did not form a bounded relationship-specific impression."
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
const nearSpatialRenderPlan = mobilityWorld.spatialRenderPlan({ x: 0, z: 0 });
const farSpatialRenderPlan = mobilityWorld.spatialRenderPlan({ x: 1_000_000, z: 1_000_000 });
check(
  nearSpatialLod.agentChunks > 0
    && farSpatialLod.aggregateChunks === spatialChunks.length
    && farSpatialLod.aggregatePopulation === mobilityWorld.cityEconomy().population,
  "Spatial LOD did not switch between focused agent detail and distant aggregates."
);
check(
  new Set([
    ...nearSpatialRenderPlan.detailedLotIds,
    ...nearSpatialRenderPlan.aggregateChunks.flatMap(chunk => chunk.lotIds)
  ]).size === mobilityWorld.lots.length
    && farSpatialRenderPlan.detailedLotIds.length === 0
    && farSpatialRenderPlan.aggregateLotCount === mobilityWorld.lots.length
    && farSpatialRenderPlan.aggregateChunks.length === spatialChunks.length,
  "The metropolitan render plan did not partition every lot between detailed and aggregate streams."
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
  localizedSoundCue: emergencyStreetSound.focus,
  shelteredEmergencyLevel: shelteredEmergencySound.emergency,
  roadSamples: paths[0].points.length,
  roadEndpointSnap: endpointSnap.targetRoadName,
  roadAngleSnap: angleSnap.angleDegrees,
  roadTangentSnap: tangentSnap.angleDegrees,
  roadParallelSnap: parallelSnap.angleDegrees,
  bridgeElevation: restoredStructureWorld.roadStructure(restoredStructureWorld.roads[0]).elevationMeters,
  tunnelElevation: structureWorld.roadStructure(bridgeRoad).elevationMeters,
  bridgeCost: bridgeStructureCost,
  tunnelCost: tunnelStructureCost,
  roadImpactFrontage: clearRoadImpact.frontageLots,
  roadImpactParcelConflicts: conflictingRoadImpact.parcelConflicts,
  roadImpactWaterSections: surfaceWaterImpact.waterSections,
  roadImpactSeparatedCrossings: separatedCrossingImpact.gradeSeparatedCrossings,
  intersections: intersections.length,
  redSignalStop: stoppedTraffic.stopped,
  greenSignalMovement: !movingTraffic.stopped,
  directionalLaneSeparation: Number(
    Math.hypot(outboundLane.point.x - returningLane.point.x, outboundLane.point.z - returningLane.point.z).toFixed(2)
  ),
  spatialChunks: spatialChunks.length,
  agentDetailChunks: nearSpatialLod.agentChunks,
  farAggregatePopulation: farSpatialLod.aggregatePopulation,
  streamedDetailedLots: nearSpatialRenderPlan.detailedLotIds.length,
  streamedAggregateLots: farSpatialRenderPlan.aggregateLotCount,
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
  homeExteriorWalls: interiorExteriorWalls.length,
  homeDaylight: furniturePlacementWorld.homeDaylight(furniturePlacementWorld.homes[0]),
  interiorFurnitureCollision: furnitureMove.blocked,
  furnitureVariant: catalogDesk.variant,
  furnitureTint: catalogDesk.tint,
  homeCondition: furniturePlacementWorld.homeCondition(maintenanceHome),
  furnitureRepairCost: expectedFurnitureRepair,
  roomRenovationCost: expectedRoomRenovation,
  interiorWallCollision: wallMove.blocked,
  interiorAccessGate: entryStatus.allowed,
  multiFloorHomeFloors: restoredMultiFloorWorld.homes[0].floors,
  multiFloorStairs: restoredMultiFloorWorld.homes[0].stairs?.length,
  legacyHomeFloorMigration: legacyFloorWorld.homes[0].floors,
  lifeStageTransition: lifeCycleWorld.residentLifeStage(kai),
  householdGeneration: kai.generation,
  caregiverCount: kai.caregiverIds?.length,
  inheritedPersonality: inheritedPersonality.cleanliness,
  careerBranch: samira.careerBranch,
  careerWorkplace: samiraWorkplace?.anchorBusiness?.name,
  careerWorkTask: samira.lastWorkTask,
  careerPerformance: samira.workPerformance,
  completedWorkShifts: samira.workDaysCompleted,
  workplaceCoworkers: noonWorkplaceActivity.coworkersOnShift,
  workplaceCustomers: openRetailActivity.customersPresent,
  workplaceCustomerDemand: openRetailActivity.hourlyCustomerDemand,
  closedWorkplaceLabel: closedRetailActivity.label,
  businessDailyRevenue: retailFinanceProjection.revenue,
  businessDailyProfit: retailFinanceProjection.profit,
  businessClosureAt: failedFinance.lastClosureAt,
  privateSectorProfit: lifeCycleWorld.cityEconomy().privateSectorProfit,
  residentRoutine: lifeCycleWorld.residentRoutineProfile(samira),
  residentRoutineSummary: lifeCycleWorld.residentRoutineSummary(samira),
  splitShiftWindows: splitSchedule.workWindows.length,
  weekendWorkWindows: weekendSchedule.workWindows.length,
  learnedActivity: mealPreference?.action,
  learnedActivityRepeats: mealPreference?.repetitions,
  learnedActivityBias: recurringPreferenceWorld.residentActivityPreferenceBias(recurringResident, "eat"),
  avoidedActivity: confrontActivityPreference?.action,
  warmRelationshipImpression: warmImpression.label,
  resentfulRelationshipImpression: resentfulImpression.label,
  movedResidentHome: moveDestination.name,
  movedResidentFunds: moveResult.transferred,
  movedResidentMilestone: recurringPreferenceWorld.residentMilestones(movedResident)[0]?.kind,
  lifeMilestones: lifeCycleWorld.residentMilestones(samira).map(milestone => milestone.kind),
  latestMilestone: lifeCycleWorld.residentMilestones(samira)[0]?.title,
  familyAspirationProgress: lifeCycleWorld.residentAspirationProgress(kai),
  personalInventory: personalResident.inventory?.map(item => item.kind),
  ownedFurniture: personalWorld.residentOwnedFurniture(personalHome, personalResident).length,
  belongingSatisfaction: personalWorld.residentOwnershipSatisfaction(personalHome, personalResident),
  residentOutfit: personalWorld.residentOutfitLabel(personalResident),
  householdGathering: gatheringWorld.householdGatheringLabel(scheduledDinner.gathering!),
  gatheringVisitors: scheduledDinner.gathering?.guestCount,
  gatheringAttendance: scheduledDinner.gathering?.attendance,
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
