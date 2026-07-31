import {
  World,
  type Home,
  type ServiceKind,
  type UtilityKind
} from "./world";
import { interiorEntryPoint, isInteriorPositionValid } from "./interiors";

export type StabilityCheckpoint = {
  year: number;
  population: number;
  households: number;
  businesses: number;
  monthlyBalance: number;
  treasury: number;
  wellbeing: number;
  serviceStaffing: number;
  activeIncidents: number;
  activeUtilityFailures: number;
  minimumUtilityCondition: number;
  residentWellbeing: number;
  completedResidentActions: number;
  eventOccurrences: number;
  eventAttendance: number;
  snapshotBytes: number;
};

export type StabilityReport = {
  passed: boolean;
  years: number;
  stepMinutes: number;
  simulatedMinutes: number;
  durationMs: number;
  budgetPostings: number;
  starting: StabilityCheckpoint;
  yearly: StabilityCheckpoint[];
  final: StabilityCheckpoint;
  totals: {
    incidentsCreated: number;
    incidentsResolved: number;
    utilityFailuresCreated: number;
    utilityFailuresResolved: number;
  };
  peaks: {
    retainedIncidents: number;
    activeIncidents: number;
    retainedUtilityFailures: number;
    activeUtilityFailures: number;
    snapshotBytes: number;
  };
  failures: string[];
  warnings: string[];
  deterministicSignature: string;
};

const SERVICE_DEFINITIONS: Record<ServiceKind, {
  radius: number;
  monthlyCost: number;
  capacity: number;
  staffRequired: number;
}> = {
  power: { radius: 430, monthlyCost: 780_000, capacity: 65_000, staffRequired: 160 },
  water: { radius: 360, monthlyCost: 520_000, capacity: 72_000, staffRequired: 85 },
  sewage: { radius: 330, monthlyCost: 610_000, capacity: 68_000, staffRequired: 110 },
  waste: { radius: 240, monthlyCost: 470_000, capacity: 48_000, staffRequired: 95 },
  fire: { radius: 190, monthlyCost: 360_000, capacity: 18_000, staffRequired: 75 },
  health: { radius: 165, monthlyCost: 440_000, capacity: 12_000, staffRequired: 140 },
  school: { radius: 180, monthlyCost: 390_000, capacity: 8_000, staffRequired: 180 }
};

const SERVICE_POSITIONS: Record<ServiceKind, Array<[number, number]>> = {
  power: [[0, -250], [0, 250]],
  water: [[0, -250], [0, 250]],
  sewage: [[0, -270], [0, 270]],
  waste: [[0, -330], [0, 0], [0, 330]],
  fire: [[-75, -330], [75, -110], [-75, 110], [75, 330]],
  health: [[-75, -330], [75, -110], [-75, 110], [75, 330]],
  school: [[75, -330], [-75, -110], [75, 110], [-75, 330]]
};

const UTILITY_CAPACITY: Record<UtilityKind, number> = {
  power: 42_000,
  water: 54_000,
  sewage: 48_000,
  waste: 32_000
};

const VALID_RESIDENT_TRAITS = new Set([
  "outgoing",
  "homebody",
  "active",
  "creative",
  "organized",
  "empathetic"
]);
const VALID_CONVERSATION_INTENTS = new Set([
  "chat",
  "support",
  "joke",
  "confront",
  "apologize"
]);
const VALID_HOME_FLOOR_FINISHES = new Set(["oak", "tile", "concrete", "carpet"]);
const VALID_HOME_WALL_FINISHES = new Set(["warm-white", "sage", "clay", "slate"]);

export function createStabilityScenario() {
  const world = new World();
  world.serviceFunding = .85;
  world.services = (Object.entries(SERVICE_POSITIONS) as Array<[ServiceKind, Array<[number, number]>]>)
    .flatMap(([kind, positions]) => positions.map(([x, z], index) => ({
      id: `stability-${kind}-${index + 1}`,
      kind,
      position: { x, z },
      ...SERVICE_DEFINITIONS[kind]
    })));

  const utilityPoints = Array.from({ length: 10 }, (_, index) => {
    const z = -450 + index * 100;
    const leftToRight = index % 2 === 0;
    return leftToRight
      ? [{ x: -170, z }, { x: 170, z }]
      : [{ x: 170, z }, { x: -170, z }];
  }).flat();
  const utilityKinds: UtilityKind[] = ["power", "water", "sewage", "waste"];
  world.utilities = utilityKinds.map(kind => ({
    id: `stability-${kind}-network`,
    kind,
    points: utilityPoints.map(point => ({ ...point })),
    capacity: UTILITY_CAPACITY[kind],
    condition: 100
  }));

  const homeLot = world.lots.find(lot => lot.zone === "residential")
    ?? world.lots.find(lot => lot.zone === "mixed")
    ?? world.lots[0];
  if (!homeLot) throw new Error("The stability scenario requires at least one city lot.");
  const home: Home = {
    id: "stability-home",
    lotId: homeLot.id,
    name: "Stability household",
    floors: 1,
    rooms: [{ id: "stability-room", kind: "Living space", x: 0, z: 0, width: 8, depth: 7 }],
    furniture: [
      { id: "stability-sofa", kind: "sofa", x: -1.5, z: 0, rotation: 0 },
      { id: "stability-table", kind: "table", x: 1.5, z: 0, rotation: 0 },
      { id: "stability-bed", kind: "bed", x: -1.5, z: 2, rotation: 0 },
      { id: "stability-plant", kind: "plant", x: 2.5, z: 2, rotation: 0 }
    ],
    designBudget: 60_000,
    designSpent: 3_370,
    residents: [{
      id: "stability-resident",
      name: "Avery",
      age: "adult",
      role: "home",
      energy: 82,
      social: 68,
      comfort: 74,
      health: 84,
      stress: 24,
      traits: ["organized", "homebody"],
      completedActions: 0
    }],
    relationships: []
  };
  homeLot.homeId = home.id;
  world.homes = [home];
  return world;
}

export function runStabilityTest(years = 10, stepMinutes = 60): StabilityReport {
  if (!Number.isInteger(years) || years < 1) throw new Error("Stability years must be a positive integer.");
  if (!Number.isInteger(stepMinutes) || stepMinutes < 1 || 1440 % stepMinutes !== 0) {
    throw new Error("The stability step must be a positive whole-minute divisor of one day.");
  }

  const started = performance.now();
  const world = createStabilityScenario();
  const starting = checkpoint(world);
  const targetMinutes = years * 12 * 30 * 24 * 60;
  const targetElapsed = world.clock.elapsedMinutes + targetMinutes;
  const incidentIds = new Set<string>();
  const resolvedIncidentIds = new Set<string>();
  const failureIds = new Set<string>();
  const resolvedFailureIds = new Set<string>();
  const yearly: StabilityCheckpoint[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  let monthlyBalance = world.cityEconomy().monthlyBalance;
  let budgetPostings = 0;
  const yearMinutes = 12 * 30 * 24 * 60;
  let nextCheckpointElapsed = world.clock.elapsedMinutes + yearMinutes;
  const peaks = {
    retainedIncidents: 0,
    activeIncidents: 0,
    retainedUtilityFailures: 0,
    activeUtilityFailures: 0,
    snapshotBytes: starting.snapshotBytes
  };

  while (world.clock.elapsedMinutes < targetElapsed) {
    const remaining = targetElapsed - world.clock.elapsedMinutes;
    const monthChanged = world.advanceMinutes(Math.min(stepMinutes, remaining), monthlyBalance);
    if (monthChanged) {
      budgetPostings += 1;
      monthlyBalance = world.cityEconomy().monthlyBalance;
    }

    for (const incident of world.incidents) {
      incidentIds.add(incident.id);
      if (incident.resolvedAt !== undefined && incident.resolvedAt <= world.clock.elapsedMinutes) {
        resolvedIncidentIds.add(incident.id);
      }
    }
    for (const failure of world.utilityFailures) {
      failureIds.add(failure.id);
      if (failure.resolvedAt !== undefined && failure.resolvedAt <= world.clock.elapsedMinutes) {
        resolvedFailureIds.add(failure.id);
      }
    }
    peaks.retainedIncidents = Math.max(peaks.retainedIncidents, world.incidents.length);
    peaks.activeIncidents = Math.max(peaks.activeIncidents, world.activeIncidents().length);
    peaks.retainedUtilityFailures = Math.max(peaks.retainedUtilityFailures, world.utilityFailures.length);
    peaks.activeUtilityFailures = Math.max(peaks.activeUtilityFailures, world.activeUtilityFailures().length);

    if (world.clock.elapsedMinutes >= nextCheckpointElapsed) {
      const current = checkpoint(world);
      yearly.push(current);
      peaks.snapshotBytes = Math.max(peaks.snapshotBytes, current.snapshotBytes);
      failures.push(...integrityFailures(world).map(issue => `Y${world.clock.year}: ${issue}`));
      nextCheckpointElapsed += yearMinutes;
    }
  }

  for (const incident of world.incidents) {
    if (incident.resolvedAt !== undefined && incident.resolvedAt <= world.clock.elapsedMinutes) {
      resolvedIncidentIds.add(incident.id);
    }
  }
  for (const failure of world.utilityFailures) {
    if (failure.resolvedAt !== undefined && failure.resolvedAt <= world.clock.elapsedMinutes) {
      resolvedFailureIds.add(failure.id);
    }
  }

  const final = checkpoint(world);
  const expectedBudgetPostings = years * 12;
  const expectedYear = starting.year + years;
  if (world.clock.year !== expectedYear || world.clock.month !== 1 || world.clock.day !== 1 || world.clock.minute !== 8 * 60) {
    failures.push(`Calendar ended at Y${world.clock.year} M${world.clock.month} D${world.clock.day} ${world.clock.minute}m instead of Y${expectedYear} M1 D1 480m.`);
  }
  if (budgetPostings !== expectedBudgetPostings) {
    failures.push(`Posted ${budgetPostings} monthly budgets instead of ${expectedBudgetPostings}.`);
  }
  if (yearly.length !== years) failures.push(`Captured ${yearly.length} yearly checkpoints instead of ${years}.`);
  if (final.population < 10_000) failures.push(`Final population ${final.population} is below the 10,000-resident gate.`);
  if (final.population < starting.population * .7 || final.population > starting.population * 2.2) {
    failures.push(`Population drifted from ${starting.population} to ${final.population}, outside the bounded growth range.`);
  }
  if (final.businesses <= 0) failures.push("The city ended without any active businesses.");
  if (final.wellbeing < 50) failures.push(`Final city wellbeing ${final.wellbeing}% is below the 50% stability floor.`);
  if (!Number.isFinite(final.treasury) || final.treasury < -250_000_000) {
    failures.push(`Treasury ended at ${formatMoney(final.treasury)}, below the stability reserve floor.`);
  }
  if (incidentIds.size && resolvedIncidentIds.size / incidentIds.size < .99) {
    failures.push(`Only ${resolvedIncidentIds.size} of ${incidentIds.size} incidents resolved.`);
  }
  if (failureIds.size && resolvedFailureIds.size / failureIds.size < .99) {
    failures.push(`Only ${resolvedFailureIds.size} of ${failureIds.size} utility failures resolved.`);
  }
  if (peaks.activeIncidents > 6) failures.push(`Active incident backlog peaked at ${peaks.activeIncidents}.`);
  if (peaks.activeUtilityFailures > 2) failures.push(`Active utility failures peaked at ${peaks.activeUtilityFailures}.`);
  if (peaks.snapshotBytes > 2_000_000) failures.push(`Snapshot size reached ${peaks.snapshotBytes.toLocaleString()} bytes.`);
  for (let index = 1; index < yearly.length; index++) {
    const previous = yearly[index - 1].population;
    const current = yearly[index].population;
    if (current < previous * .82) failures.push(`Population fell more than 18% between Y${yearly[index - 1].year} and Y${yearly[index].year}.`);
  }
  failures.push(...integrityFailures(world).map(issue => `Final: ${issue}`));

  if (final.monthlyBalance < 0) warnings.push(`The final monthly balance is ${formatMoney(final.monthlyBalance)}.`);
  if (final.minimumUtilityCondition < 50) warnings.push(`Minimum utility condition ended at ${final.minimumUtilityCondition.toFixed(1)}%.`);
  if (final.wellbeing < 64) warnings.push(`City wellbeing ended in the strained range at ${final.wellbeing}%.`);

  const totals = {
    incidentsCreated: incidentIds.size,
    incidentsResolved: resolvedIncidentIds.size,
    utilityFailuresCreated: failureIds.size,
    utilityFailuresResolved: resolvedFailureIds.size
  };
  const signatureSource = JSON.stringify({
    years,
    stepMinutes,
    budgetPostings,
    starting,
    yearly,
    final,
    totals,
    peaks,
    failures,
    warnings
  });
  const deterministicSignature = stableHash(signatureSource);
  return {
    passed: failures.length === 0,
    years,
    stepMinutes,
    simulatedMinutes: targetMinutes,
    durationMs: Math.round(performance.now() - started),
    budgetPostings,
    starting,
    yearly,
    final,
    totals,
    peaks,
    failures: unique(failures),
    warnings: unique(warnings),
    deterministicSignature
  };
}

function checkpoint(world: World): StabilityCheckpoint {
  const economy = world.cityEconomy();
  const residents = world.homes.flatMap(home => home.residents);
  const snapshotBytes = JSON.stringify(world.snapshot()).length;
  return {
    year: world.clock.year,
    population: economy.population,
    households: economy.households,
    businesses: economy.businesses,
    monthlyBalance: economy.monthlyBalance,
    treasury: world.clock.treasury,
    wellbeing: world.cityWellbeing(),
    serviceStaffing: Math.round(world.effectiveStaffing() * 1_000) / 1_000,
    activeIncidents: world.activeIncidents().length,
    activeUtilityFailures: world.activeUtilityFailures().length,
    minimumUtilityCondition: world.utilities.length
      ? Math.min(...world.utilities.map(utility => utility.condition))
      : 100,
    residentWellbeing: residents.length
      ? Math.round(residents.reduce((total, resident) => total + world.residentWellbeing(resident).score, 0) / residents.length)
      : 0,
    completedResidentActions: residents.reduce((total, resident) => total + (resident.completedActions ?? 0), 0),
    eventOccurrences: world.cityEvents.reduce((total, event) => total + event.occurrences, 0),
    eventAttendance: economy.eventAttendance,
    snapshotBytes
  };
}

function integrityFailures(world: World) {
  const failures: string[] = [];
  findNonFinite(world.snapshot(), "snapshot", failures);
  if (world.incidents.length > 24) failures.push(`Retained incident history grew to ${world.incidents.length}.`);
  if (world.utilityFailures.length > 18) failures.push(`Retained utility-failure history grew to ${world.utilityFailures.length}.`);
  if (world.commuteFlows.length > 72) failures.push(`Commute representative set grew to ${world.commuteFlows.length}.`);
  if (world.transitLines.length > 8) failures.push(`Transit line set grew to ${world.transitLines.length}.`);
  if (world.cityEvents.length > 32) failures.push(`City event schedule grew to ${world.cityEvents.length}.`);
  if (world.clock.month < 1 || world.clock.month > 12 || world.clock.day < 1 || world.clock.day > 30) {
    failures.push("Calendar fields are outside their valid ranges.");
  }
  const weather = world.weather();
  if (
    !Number.isFinite(weather.temperatureC)
    || !Number.isFinite(weather.windKph)
    || weather.precipitation < 0
    || weather.precipitation > 1
    || weather.visibility <= 0
    || weather.visibility > 1
  ) {
    failures.push("Weather state is outside its valid ranges.");
  }

  const roadIds = new Set(world.roads.map(road => road.id));
  const lotIds = new Set(world.lots.map(lot => lot.id));
  const areaIds = new Set(world.areas.map(area => area.id));
  const serviceIds = new Set(world.services.map(service => service.id));
  const utilityIds = new Set(world.utilities.map(utility => utility.id));
  const transitLineIds = new Set(world.transitLines.map(line => line.id));
  const transitLineNames = new Set(world.transitLines.map(line => line.name.toLocaleLowerCase()));
  const transitStopIds = new Set(world.transitLines.flatMap(line => line.stops.map(stop => stop.id)));
  const cityEventIds = new Set(world.cityEvents.map(event => event.id));
  const accessibilityEntranceIds = new Set(world.accessibilityEntrances.map(entrance => entrance.id));
  if (lotIds.size !== world.lots.length) failures.push("Duplicate lot IDs were found.");
  if (serviceIds.size !== world.services.length) failures.push("Duplicate service IDs were found.");
  if (utilityIds.size !== world.utilities.length) failures.push("Duplicate utility IDs were found.");
  if (transitLineIds.size !== world.transitLines.length) failures.push("Duplicate transit line IDs were found.");
  if (transitLineNames.size !== world.transitLines.length) failures.push("Duplicate transit line names were found.");
  if (transitStopIds.size !== world.transitLines.flatMap(line => line.stops).length) {
    failures.push("Duplicate transit stop IDs were found.");
  }
  if (cityEventIds.size !== world.cityEvents.length) failures.push("Duplicate city event IDs were found.");
  if (accessibilityEntranceIds.size !== world.accessibilityEntrances.length) {
    failures.push("Duplicate accessibility entrance IDs were found.");
  }
  for (const road of world.roads) {
    const pressure = world.roadTrafficPressure(road);
    if (!Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
      failures.push(`Road ${road.id} has invalid planning-view traffic pressure.`);
    }
  }
  const spatialChunkIds = new Set(world.spatialChunks.map(chunk => chunk.id));
  const spatialLotIds = world.spatialChunks.flatMap(chunk => chunk.lotIds);
  const spatialPopulation = world.spatialChunks.reduce((total, chunk) => total + chunk.population, 0);
  if (world.spatialChunkSize < 128 || world.spatialChunkSize > 1024) {
    failures.push("Spatial chunk size is outside its supported range.");
  }
  if (spatialChunkIds.size !== world.spatialChunks.length) failures.push("Duplicate spatial chunk IDs were found.");
  if (
    spatialLotIds.length !== world.lots.length
    || new Set(spatialLotIds).size !== world.lots.length
    || spatialLotIds.some(lotId => !lotIds.has(lotId))
  ) {
    failures.push("Spatial chunks do not contain every lot exactly once.");
  }
  if (world.spatialChunks.some(chunk => chunk.roadIds.some(roadId => !roadIds.has(roadId)))) {
    failures.push("Spatial chunks contain missing road references.");
  }
  if (spatialPopulation !== world.cityEconomy().population) {
    failures.push("Spatial chunk population does not match the city economy.");
  }

  for (const lot of world.lots) {
    if (!Number.isInteger(lot.households) || lot.households < 0) failures.push(`Lot ${lot.id} has invalid household count.`);
    if (!Number.isInteger(lot.businesses) || lot.businesses < 0) failures.push(`Lot ${lot.id} has invalid business count.`);
    const householdMix = Object.values(lot.householdMix).reduce((total, value) => total + value, 0);
    const businessMix = Object.values(lot.businessMix).reduce((total, value) => total + value, 0);
    if (householdMix !== lot.households) failures.push(`Lot ${lot.id} household cohorts do not sum to the household count.`);
    if (businessMix !== lot.businesses) failures.push(`Lot ${lot.id} business sectors do not sum to the business count.`);
  }
  for (const home of world.homes) {
    if (!lotIds.has(home.lotId)) failures.push(`Home ${home.id} points to a missing lot.`);
    if (!home.rooms.length) failures.push(`Home ${home.id} has no interior rooms.`);
    if (!Number.isInteger(home.designBudget) || home.designBudget <= 0) failures.push(`Home ${home.id} has an invalid design budget.`);
    if (!Number.isInteger(home.designSpent) || home.designSpent < 0 || home.designSpent > home.designBudget) {
      failures.push(`Home ${home.id} has invalid design spending.`);
    }
    if (!interiorEntryPoint(home)) failures.push(`Home ${home.id} has no clear interior entry position.`);
    const roomIds = new Set(home.rooms.map(room => room.id));
    const furnitureIds = new Set(home.furniture.map(item => item.id));
    const residentIds = new Set(home.residents.map(resident => resident.id));
    const residentNames = new Set(home.residents.map(resident => resident.name.toLocaleLowerCase()));
    const relationshipKeys = new Set<string>();
    if (roomIds.size !== home.rooms.length) failures.push(`Home ${home.id} has duplicate room IDs.`);
    if (furnitureIds.size !== home.furniture.length) failures.push(`Home ${home.id} has duplicate furniture IDs.`);
    if (residentIds.size !== home.residents.length) failures.push(`Home ${home.id} has duplicate resident IDs.`);
    if (residentNames.size !== home.residents.length) failures.push(`Home ${home.id} has duplicate resident names.`);
    if (home.residents.length > 8) failures.push(`Home ${home.id} exceeds the supported eight named residents.`);
    for (const room of home.rooms) {
      if (room.width < 2 || room.depth < 2) failures.push(`Room ${room.id} is smaller than the supported 2m minimum.`);
      if (!VALID_HOME_FLOOR_FINISHES.has(room.floorFinish ?? "oak")) failures.push(`Room ${room.id} has an invalid floor finish.`);
      if (!VALID_HOME_WALL_FINISHES.has(room.wallFinish ?? "warm-white")) failures.push(`Room ${room.id} has an invalid wall finish.`);
    }
    for (const item of home.furniture) {
      if (!Number.isFinite(item.rotation) || item.rotation < 0 || item.rotation >= Math.PI * 2) {
        failures.push(`Furniture ${item.id} has an invalid rotation.`);
      }
      if (!world.canPlaceFurniture(home, item.kind, item.x, item.z, item.rotation, item.id)) {
        failures.push(`Furniture ${item.id} overlaps a wall or furnishing in home ${home.id}.`);
      }
    }
    for (const resident of home.residents) {
      if (!resident.name || resident.name.length > 24 || !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(resident.name)) {
        failures.push(`Resident ${resident.id} has an invalid display name.`);
      }
      if (
        resident.traits.length !== 2
        || new Set(resident.traits).size !== resident.traits.length
        || resident.traits.some(trait => !VALID_RESIDENT_TRAITS.has(trait))
      ) {
        failures.push(`Resident ${resident.id} has invalid personality traits.`);
      }
      const preference = world.residentLearnedPreferences(home, resident);
      if (
        !Number.isFinite(preference.preferredScore)
        || !Number.isFinite(preference.avoidedScore)
        || preference.socialBias < -12
        || preference.socialBias > 18
        || preference.evidenceCount < 0
      ) {
        failures.push(`Resident ${resident.id} has invalid learned social preferences.`);
      }
      const skills = world.residentSkills(resident);
      if (Object.values(skills).some(value => !Number.isInteger(value) || value < 0 || value > 100)) {
        failures.push(`Resident ${resident.id} has invalid skill progress.`);
      }
      const careerLevel = world.residentCareerLevel(resident);
      if (
        !Number.isInteger(careerLevel)
        || careerLevel < 1
        || careerLevel > 10
        || !Number.isFinite(resident.careerXp ?? 0)
        || (resident.careerXp ?? 0) < 0
        || (careerLevel < 10 && (resident.careerXp ?? 0) >= careerLevel * 40)
      ) {
        failures.push(`Resident ${resident.id} has invalid career progress.`);
      }
      if (resident.homePosition && !isInteriorPositionValid(home, resident.homePosition)) {
        failures.push(`Resident ${resident.id} has an invalid saved home position.`);
      }
      if (
        resident.currentAction?.targetFurnitureId
        && !home.furniture.some(item => item.id === resident.currentAction!.targetFurnitureId)
      ) {
        failures.push(`Resident ${resident.id} action points to missing furniture.`);
      }
      if (
        resident.currentAction?.partnerResidentId
        && (
          resident.currentAction.partnerResidentId === resident.id
          || !residentIds.has(resident.currentAction.partnerResidentId)
        )
      ) {
        failures.push(`Resident ${resident.id} action points to an invalid conversation partner.`);
      }
      if (
        resident.currentAction?.conversationIntent
        && (
          resident.currentAction.kind !== "socialize"
          || !VALID_CONVERSATION_INTENTS.has(resident.currentAction.conversationIntent)
        )
      ) {
        failures.push(`Resident ${resident.id} has an invalid conversation intent.`);
      }
      if (
        resident.currentAction?.kind === "socialize"
        && resident.currentAction.partnerResidentId
        && !resident.currentAction.conversationIntent
      ) {
        failures.push(`Resident ${resident.id} paired conversation is missing an intent.`);
      }
      for (const [name, value] of Object.entries({
        energy: resident.energy,
        social: resident.social,
        comfort: resident.comfort,
        health: resident.health,
        stress: resident.stress
      })) {
        if (value < 0 || value > 100) failures.push(`Resident ${resident.id} has ${name} outside 0 to 100.`);
      }
    }
    for (const relationship of home.relationships) {
      const [firstResidentId, secondResidentId] = [...relationship.residentIds].sort();
      const key = `${firstResidentId}:${secondResidentId}`;
      if (
        firstResidentId === secondResidentId
        || !residentIds.has(firstResidentId)
        || !residentIds.has(secondResidentId)
      ) {
        failures.push(`Home ${home.id} has a relationship with invalid residents.`);
      }
      if (relationshipKeys.has(key)) failures.push(`Home ${home.id} has duplicate relationship pairs.`);
      relationshipKeys.add(key);
      if (relationship.score < 0 || relationship.score > 100) {
        failures.push(`Home ${home.id} has a relationship score outside 0 to 100.`);
      }
      if (!Number.isInteger(relationship.conversations) || relationship.conversations < 0) {
        failures.push(`Home ${home.id} has an invalid completed conversation count.`);
      }
      if (
        relationship.lastIntent
        && !VALID_CONVERSATION_INTENTS.has(relationship.lastIntent)
      ) {
        failures.push(`Home ${home.id} has an invalid recent conversation intent.`);
      }
      if (
        relationship.lastChange !== undefined
        && (
          !Number.isInteger(relationship.lastChange)
          || relationship.lastChange < -14
          || relationship.lastChange > 12
          || !relationship.lastIntent
        )
      ) {
        failures.push(`Home ${home.id} has an invalid recent relationship outcome.`);
      }
      if (relationship.lastIntent && relationship.lastChange === undefined) {
        failures.push(`Home ${home.id} recent conversation is missing its relationship outcome.`);
      }
      if (
        !Number.isInteger(relationship.tension ?? 0)
        || (relationship.tension ?? 0) < 0
        || (relationship.tension ?? 0) > 100
      ) {
        failures.push(`Home ${home.id} has relationship tension outside 0 to 100.`);
      }
      if (
        !Number.isInteger(relationship.conflicts ?? 0)
        || (relationship.conflicts ?? 0) < 0
        || !Number.isInteger(relationship.resolvedConflicts ?? 0)
        || (relationship.resolvedConflicts ?? 0) < 0
        || (relationship.resolvedConflicts ?? 0) > (relationship.conflicts ?? 0)
      ) {
        failures.push(`Home ${home.id} has invalid conflict or reconciliation history.`);
      }
      if ((relationship.memories?.length ?? 0) > 8) {
        failures.push(`Home ${home.id} retained more than eight social memories for one relationship.`);
      }
      for (const memory of relationship.memories ?? []) {
        if (
          !VALID_CONVERSATION_INTENTS.has(memory.intent)
          || !residentIds.has(memory.initiatorResidentId)
          || !Number.isInteger(memory.relationshipChange)
          || memory.relationshipChange < -14
          || memory.relationshipChange > 12
          || !Number.isInteger(memory.tensionChange)
          || memory.tensionChange < -40
          || memory.tensionChange > 30
          || !Number.isFinite(memory.occurredAt)
          || memory.occurredAt < 0
        ) {
          failures.push(`Home ${home.id} has an invalid social memory.`);
        }
      }
    }
  }
  for (const utility of world.utilities) {
    if (utility.condition < 0 || utility.condition > 100) failures.push(`Utility ${utility.id} condition is outside 0 to 100.`);
    if (utility.capacity <= 0 || utility.points.length < 2) failures.push(`Utility ${utility.id} has invalid network geometry or capacity.`);
  }
  for (const incident of world.incidents) {
    if (!lotIds.has(incident.lotId)) failures.push(`Incident ${incident.id} points to a missing lot.`);
    if (incident.responderServiceId && !serviceIds.has(incident.responderServiceId)) failures.push(`Incident ${incident.id} points to a missing responder.`);
  }
  for (const failure of world.utilityFailures) {
    const targets = failure.targetType === "line" ? utilityIds : serviceIds;
    if (!targets.has(failure.targetId)) failures.push(`Utility failure ${failure.id} points to a missing target.`);
    if (failure.crewServiceId && !serviceIds.has(failure.crewServiceId)) failures.push(`Utility failure ${failure.id} points to a missing crew.`);
  }
  for (const commute of world.commuteFlows) {
    if (!lotIds.has(commute.originLotId) || !lotIds.has(commute.destinationLotId)) failures.push(`Commute ${commute.id} points to a missing lot.`);
    if (commute.route.length < 2 || commute.distance < 0 || commute.travelMinutes <= 0) failures.push(`Commute ${commute.id} has invalid routing data.`);
  }
  for (const line of world.transitLines) {
    if (!line.name || line.name.length > 32 || !/^[\p{L}\p{M}\p{N} &'().-]+$/u.test(line.name)) {
      failures.push(`Transit line ${line.id} has an invalid display name.`);
    }
    if (
      line.route.length < 2
      || line.stops.length < 4
      || line.stops.length > 10
      || line.travelMinutes <= 0
    ) {
      failures.push(`Transit line ${line.id} has invalid route, stop, or schedule data.`);
    }
    if (line.roadId && !roadIds.has(line.roadId)) {
      failures.push(`Transit line ${line.id} points to a missing road.`);
    }
    if (!Number.isInteger(line.color) || line.color < 0 || line.color > 0xffffff) {
      failures.push(`Transit line ${line.id} has an invalid display color.`);
    }
    if (line.headwayMinutes < 4 || line.headwayMinutes > 30 || line.vehicleCapacity <= 0) {
      failures.push(`Transit line ${line.id} has invalid frequency or vehicle capacity.`);
    }
    if (line.fare < 0 || line.fare > 10 || line.ridership < 0 || line.fareRevenue < 0) {
      failures.push(`Transit line ${line.id} has invalid fare or ridership data.`);
    }
    for (const stop of line.stops) {
      if (stop.progress < 0 || stop.progress > 1) failures.push(`Transit stop ${stop.id} has invalid route progress.`);
      if (
        stop.waiting < 0
        || stop.boardings < 0
        || !Number.isInteger(stop.waiting)
        || !Number.isInteger(stop.boardings)
      ) {
        failures.push(`Transit stop ${stop.id} has invalid queue or boarding data.`);
      }
    }
    for (const transfer of world.transitTransfersForLine(line)) {
      const otherLine = world.transitLines.find(item => item.id === transfer.lineId);
      if (!otherLine || transfer.distance > 55 || !otherLine.stops.some(stop => stop.id === transfer.otherStopId)) {
        failures.push(`Transit line ${line.id} has an invalid transfer connection.`);
      }
    }
  }
  for (const event of world.cityEvents) {
    if (!["concert", "market", "parade", "sports"].includes(event.kind)) {
      failures.push(`City event ${event.id} has an invalid event kind.`);
    }
    if (
      event.durationMinutes < 60
      || event.intervalMinutes < 24 * 60
      || event.capacity <= 0
      || event.cityFeePerAttendee < 0
      || event.monthlyCost < 0
      || event.revenue < 0
    ) {
      failures.push(`City event ${event.id} has invalid scheduling or financial data.`);
    }
    if (
      event.occurrences < 0
      || event.totalAttendance < 0
      || !Number.isInteger(event.occurrences)
      || !Number.isInteger(event.totalAttendance)
      || (event.lastProcessedOccurrence !== undefined && !Number.isInteger(event.lastProcessedOccurrence))
    ) {
      failures.push(`City event ${event.id} has invalid occurrence or attendance data.`);
    }
    if (!event.roadId || !roadIds.has(event.roadId)) {
      failures.push(`City event ${event.id} points to a missing source road.`);
    }
    if (
      !event.closureRoadIds?.length
      || event.closureRoadIds.length > 3
      || event.closureRoadIds.some(roadId => !roadIds.has(roadId))
    ) {
      failures.push(`City event ${event.id} has invalid road closures.`);
    }
    if (!event.temporaryTransitLineId || !transitLineIds.has(event.temporaryTransitLineId)) {
      failures.push(`City event ${event.id} points to a missing temporary transit line.`);
    }
    if (
      !Number.isInteger(event.temporaryTransitHeadwayMinutes)
      || (event.temporaryTransitHeadwayMinutes ?? 0) < 4
      || (event.temporaryTransitHeadwayMinutes ?? 0) > 15
    ) {
      failures.push(`City event ${event.id} has an invalid temporary transit headway.`);
    }
  }
  for (const facility of world.parking) {
    if (facility.capacity <= 0 || facility.occupied < 0 || facility.occupied > facility.capacity) {
      failures.push(`Parking facility ${facility.id} has invalid capacity or occupancy.`);
    }
    if (facility.accessibleSpaces < 0 || facility.accessibleSpaces > facility.capacity) {
      failures.push(`Parking facility ${facility.id} has invalid accessible-space capacity.`);
    }
    if (facility.hourlyRate < 0 || facility.hourlyRate > 25 || facility.revenue < 0) {
      failures.push(`Parking facility ${facility.id} has invalid pricing or revenue data.`);
    }
    if (facility.kind === "curb") {
      if (
        !["parking", "loading", "restricted", "event"].includes(facility.curbUse ?? "")
        || !["all-day", "business-hours", "rush-hours", "evening"].includes(facility.curbSchedule ?? "")
      ) {
        failures.push(`Curb facility ${facility.id} has an invalid use or schedule.`);
      }
      if (
        (facility.deliveriesWaiting ?? -1) < 0
        || (facility.deliveriesServed ?? -1) < 0
        || (facility.violations ?? -1) < 0
        || (facility.curbRevenue ?? -1) < 0
        || !Number.isInteger(facility.deliveriesWaiting)
        || !Number.isInteger(facility.deliveriesServed)
        || !Number.isInteger(facility.violations)
      ) {
        failures.push(`Curb facility ${facility.id} has invalid delivery or enforcement data.`);
      }
    }
  }
  for (const entrance of world.accessibilityEntrances) {
    const targetExists = entrance.targetKind === "lot"
      ? lotIds.has(entrance.targetId)
      : entrance.targetKind === "park"
        ? areaIds.has(entrance.targetId)
        : transitStopIds.has(entrance.targetId);
    if (!targetExists) failures.push(`Accessibility entrance ${entrance.id} points to a missing target.`);
    if (entrance.doorWidth < .6 || entrance.doorWidth > 4) {
      failures.push(`Accessibility entrance ${entrance.id} has invalid clear width.`);
    }
  }
  return unique(failures);
}

function findNonFinite(value: unknown, path: string, failures: string[]) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    failures.push(`${path} contains a non-finite number.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findNonFinite(item, `${path}[${index}]`, failures));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) findNonFinite(item, `${path}.${key}`, failures);
  }
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${(Math.abs(value) / 1_000_000).toFixed(2)}m`;
}
