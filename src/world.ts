import * as THREE from "three";
import { NYC_TEMPLATE, WORLD_TEMPLATES } from "./templates";
import { findRoadRoute, routeLength } from "./routing";
import {
  initialTransitLines,
  transitFleetSize,
  transitLineForRoad,
  transitStopsForLine
} from "./transit";

export type Point2 = { x: number; z: number };

export type Road = {
  id: string;
  points: Point2[];
  width: number;
  name?: string;
  class?: "street" | "avenue" | "arterial";
};

export type Area = {
  id: string;
  name: string;
  kind: "land" | "park" | "district";
  points: Point2[];
};

export type WorldTemplate = {
  id: "nyc" | "blank";
  name: string;
  description: string;
  roads: Road[];
  areas: Area[];
};

export type Lot = {
  id: string;
  roadId: string;
  center: Point2;
  rotation: number;
  width: number;
  depth: number;
  zone: Zone;
  constructionStartedAt?: number;
  constructionDuration?: number;
  households: number;
  businesses: number;
  householdMix: HouseholdMix;
  businessMix: BusinessMix;
  anchorBusiness?: AnchorBusiness;
  homeId?: string;
};

export type Zone = "unassigned" | "residential" | "commercial" | "mixed" | "industrial" | "civic";

export type HouseholdMix = {
  families: number;
  singles: number;
  shared: number;
  seniors: number;
};

export type BusinessSector = "retail" | "office" | "hospitality" | "industrial" | "community";

export type BusinessMix = Record<BusinessSector, number>;

export type AnchorBusiness = {
  name: string;
  sector: BusinessSector;
  jobs: number;
};

export type LotActivity = {
  population: number;
  atHome: number;
  atWorkOrSchool: number;
  outInCity: number;
  openBusinesses: number;
  activeJobs: number;
};

export type ResidentRole = "office" | "service" | "student" | "home";

export type ResidentTrait =
  | "outgoing"
  | "homebody"
  | "active"
  | "creative"
  | "organized"
  | "empathetic";

export type ConversationIntent = "chat" | "support" | "joke" | "confront" | "apologize";

export type SocialMemory = {
  intent: ConversationIntent;
  relationshipChange: number;
  tensionChange: number;
  occurredAt: number;
  initiatorResidentId: string;
};

export type ResidentActionKind = "sleep" | "eat" | "relax" | "socialize" | "tend-plants" | "idle";

export type ResidentAction = {
  kind: ResidentActionKind;
  startedAt: number;
  endsAt: number;
  targetFurnitureId?: string;
  partnerResidentId?: string;
  conversationIntent?: ConversationIntent;
  directed?: boolean;
  relationshipCredit?: boolean;
};

export type Resident = {
  id: string;
  name: string;
  age: "adult" | "child";
  role: ResidentRole;
  destinationLotId?: string;
  energy: number;
  social: number;
  comfort: number;
  health: number;
  stress: number;
  traits: ResidentTrait[];
  currentAction?: ResidentAction;
  lastActionKind?: ResidentActionKind;
  lastActionAt?: number;
  completedActions?: number;
  homePosition?: Point2;
};

export type ResidentRelationship = {
  residentIds: [string, string];
  score: number;
  conversations: number;
  lastInteractionAt?: number;
  lastIntent?: ConversationIntent;
  lastChange?: number;
  tension?: number;
  conflicts?: number;
  resolvedConflicts?: number;
  lastConflictAt?: number;
  lastReconciledAt?: number;
  memories?: SocialMemory[];
};

export type ResidentWellbeing = {
  score: number;
  label: "Thriving" | "Stable" | "Strained" | "Critical";
  homeQuality: number;
  utilityReliability: number;
  neighborhoodSupport: number;
  commuteBurden: number;
  pressure: string;
};

export type CommuteMode = "walk" | "car";

export type CommuteFlow = {
  id: string;
  originLotId: string;
  destinationLotId: string;
  travelers: number;
  mode: CommuteMode;
  route: Point2[];
  distance: number;
  travelMinutes: number;
  departMinute: number;
  returnMinute: number;
};

export type ActiveCommute = {
  flow: CommuteFlow;
  direction: "outbound" | "returning";
  progress: number;
};

export type ServiceKind = "power" | "water" | "sewage" | "waste" | "fire" | "health" | "school";

export type UtilityKind = "power" | "water" | "sewage" | "waste";

export type UtilityLine = {
  id: string;
  kind: UtilityKind;
  points: Point2[];
  capacity: number;
  condition: number;
};

export type CityService = {
  id: string;
  kind: ServiceKind;
  position: Point2;
  radius: number;
  monthlyCost: number;
  capacity: number;
  staffRequired: number;
};

export type ParkingKind = "curb" | "surface" | "garage";
export type CurbUse = "parking" | "loading" | "restricted" | "event";
export type CurbSchedule = "all-day" | "business-hours" | "rush-hours" | "evening";

export type ParkingFacility = {
  id: string;
  kind: ParkingKind;
  position: Point2;
  rotation: number;
  capacity: number;
  accessibleSpaces: number;
  occupied: number;
  hourlyRate: number;
  revenue: number;
  curbUse?: CurbUse;
  curbSchedule?: CurbSchedule;
  deliveriesWaiting?: number;
  deliveriesServed?: number;
  violations?: number;
  curbRevenue?: number;
};

export type AccessibilityTargetKind = "lot" | "park" | "transit";

export type AccessibilityEntrance = {
  id: string;
  targetKind: AccessibilityTargetKind;
  targetId: string;
  position: Point2;
  stepFree: boolean;
  doorWidth: number;
  tactileGuidance: boolean;
  automaticDoor: boolean;
};

export type AccessibilityDestinationKind = "home" | "business" | "park" | "transit" | "parking";

export type AccessibilityDestination = {
  id: string;
  kind: AccessibilityDestinationKind;
  sourceId: string;
  entranceId: string;
  name: string;
  position: Point2;
  usable: boolean;
};

export type PlayerVehicle = {
  position: Point2;
  heading: number;
  parkingId?: string;
};

export type TransitStop = {
  id: string;
  name: string;
  position: Point2;
  progress: number;
  waiting: number;
  boardings: number;
};

export type TransitLine = {
  id: string;
  roadId?: string;
  name: string;
  mode: "bus";
  color: number;
  route: Point2[];
  stops: TransitStop[];
  travelMinutes: number;
  headwayMinutes: number;
  fare: number;
  vehicleCapacity: number;
  ridership: number;
  fareRevenue: number;
};

export type CityEventKind = "concert" | "market" | "parade" | "sports";
export type CityEventTiming = "now" | "tonight" | "tomorrow";

export type CityEvent = {
  id: string;
  name: string;
  kind: CityEventKind;
  position: Point2;
  startAt: number;
  durationMinutes: number;
  intervalMinutes: number;
  capacity: number;
  cityFeePerAttendee: number;
  monthlyCost: number;
  occurrences: number;
  totalAttendance: number;
  revenue: number;
  lastProcessedOccurrence?: number;
  roadId?: string;
  closureRoadIds?: string[];
  temporaryTransitLineId?: string;
  temporaryTransitHeadwayMinutes?: number;
};

export const CITY_EVENT_DEFINITIONS: Record<CityEventKind, {
  label: string;
  nameSuffix: string;
  defaultStartMinute: number;
  durationMinutes: number;
  capacity: number;
  attendanceBase: number;
  populationShare: number;
  cityFeePerAttendee: number;
  monthlyCost: number;
  trafficImpact: number;
  transitShare: number;
  pedestrianShare: number;
  curbRadius: number;
}> = {
  concert: {
    label: "Outdoor concert",
    nameSuffix: "Live",
    defaultStartMinute: 19 * 60,
    durationMinutes: 240,
    capacity: 5_000,
    attendanceBase: 650,
    populationShare: .16,
    cityFeePerAttendee: 14,
    monthlyCost: 82_000,
    trafficImpact: .3,
    transitShare: .46,
    pedestrianShare: .72,
    curbRadius: 90
  },
  market: {
    label: "Street market",
    nameSuffix: "Night Market",
    defaultStartMinute: 18 * 60,
    durationMinutes: 300,
    capacity: 2_800,
    attendanceBase: 420,
    populationShare: .09,
    cityFeePerAttendee: 8,
    monthlyCost: 28_000,
    trafficImpact: .16,
    transitShare: .3,
    pedestrianShare: .82,
    curbRadius: 58
  },
  parade: {
    label: "City parade",
    nameSuffix: "Parade",
    defaultStartMinute: 11 * 60,
    durationMinutes: 180,
    capacity: 7_500,
    attendanceBase: 900,
    populationShare: .23,
    cityFeePerAttendee: 6,
    monthlyCost: 118_000,
    trafficImpact: .46,
    transitShare: .4,
    pedestrianShare: .9,
    curbRadius: 125
  },
  sports: {
    label: "City match",
    nameSuffix: "City Match",
    defaultStartMinute: 18 * 60,
    durationMinutes: 210,
    capacity: 12_000,
    attendanceBase: 1_100,
    populationShare: .32,
    cityFeePerAttendee: 12,
    monthlyCost: 145_000,
    trafficImpact: .58,
    transitShare: .62,
    pedestrianShare: .68,
    curbRadius: 105
  }
};

export type SimulationClock = {
  year: number;
  month: number;
  day: number;
  minute: number;
  treasury: number;
  elapsedMinutes: number;
};

export type IncidentKind = "fire" | "medical";

export type CityIncident = {
  id: string;
  kind: IncidentKind;
  lotId: string;
  startedAt: number;
  responderServiceId?: string;
  dispatchedAt?: number;
  arrivalAt?: number;
  resolvedAt?: number;
  route?: Point2[];
};

export type UtilityFailure = {
  id: string;
  kind: UtilityKind;
  targetType: "line" | "facility";
  targetId: string;
  position: Point2;
  startedAt: number;
  severity: number;
  crewServiceId?: string;
  dispatchedAt?: number;
  arrivalAt?: number;
  resolvedAt?: number;
  route?: Point2[];
  recoveryApplied?: boolean;
};

export type Home = {
  id: string;
  lotId: string;
  name: string;
  floors: number;
  rooms: Array<{ id: string; kind: string; x: number; z: number; width: number; depth: number }>;
  furniture: Array<{ id: string; kind: "sofa" | "table" | "bed" | "plant"; x: number; z: number; rotation: number }>;
  designBudget: number;
  designSpent: number;
  residents: Resident[];
  relationships: ResidentRelationship[];
};

export const HOME_BUILD_COSTS = {
  roomPerSquareMeter: 220,
  sofa: 1_400,
  table: 650,
  bed: 1_200,
  plant: 120
} as const;

export type SpatialChunk = {
  id: string;
  gridX: number;
  gridZ: number;
  size: number;
  center: Point2;
  lotIds: string[];
  roadIds: string[];
  households: number;
  businesses: number;
  population: number;
  jobs: number;
};

export type SpatialDetailTier = "agent" | "active" | "aggregate";

export type SpatialLodSummary = {
  agentChunks: number;
  activeChunks: number;
  aggregateChunks: number;
  agentPopulation: number;
  activePopulation: number;
  aggregatePopulation: number;
};

export type WorldSnapshot = {
  version: 1;
  templateId?: WorldTemplate["id"];
  roads: Road[];
  areas?: Area[];
  lots: Lot[];
  homes: Home[];
  services?: CityService[];
  utilities?: UtilityLine[];
  clock?: SimulationClock;
  serviceFunding?: number;
  incidents?: CityIncident[];
  utilityFailures?: UtilityFailure[];
  commuteFlows?: CommuteFlow[];
  parking?: ParkingFacility[];
  playerVehicle?: PlayerVehicle;
  transitLines?: TransitLine[];
  cityEvents?: CityEvent[];
  accessibilityEntrances?: AccessibilityEntrance[];
  spatialChunkSize?: number;
  spatialChunks?: SpatialChunk[];
};

export type CityEconomy = {
  completedLots: number;
  households: number;
  businesses: number;
  population: number;
  privateJobs: number;
  publicJobs: number;
  jobs: number;
  openBusinesses: number;
  workersOnShift: number;
  monthlyRevenue: number;
  monthlyCosts: number;
  monthlyBalance: number;
  parkingRevenue: number;
  parkingCosts: number;
  transitRevenue: number;
  transitCosts: number;
  transitRidership: number;
  curbRevenue: number;
  curbCosts: number;
  curbDeliveries: number;
  curbViolations: number;
  eventRevenue: number;
  eventCosts: number;
  eventAttendance: number;
  activeEvents: number;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const RESIDENT_TRAITS: ResidentTrait[] = [
  "outgoing",
  "homebody",
  "active",
  "creative",
  "organized",
  "empathetic"
];

const RESIDENT_TRAIT_DETAILS: Record<ResidentTrait, { label: string; description: string }> = {
  outgoing: { label: "Outgoing", description: "seeks company" },
  homebody: { label: "Homebody", description: "recharges at home" },
  active: { label: "Active", description: "prefers hands-on activity" },
  creative: { label: "Creative", description: "chooses expressive downtime" },
  organized: { label: "Organized", description: "likes reliable routines" },
  empathetic: { label: "Empathetic", description: "builds bonds easily" }
};

export class World {
  templateId: WorldTemplate["id"] = "nyc";
  roads: Road[] = [];
  areas: Area[] = [];
  lots: Lot[] = [];
  homes: Home[] = [];
  services: CityService[] = [];
  utilities: UtilityLine[] = [];
  clock: SimulationClock = { year: 1, month: 1, day: 1, minute: 8 * 60, treasury: 25_000_000, elapsedMinutes: 0 };
  serviceFunding = .85;
  incidents: CityIncident[] = [];
  utilityFailures: UtilityFailure[] = [];
  commuteFlows: CommuteFlow[] = [];
  parking: ParkingFacility[] = [];
  playerVehicle?: PlayerVehicle;
  transitLines: TransitLine[] = [];
  cityEvents: CityEvent[] = [];
  accessibilityEntrances: AccessibilityEntrance[] = [];
  spatialChunkSize = 256;
  spatialChunks: SpatialChunk[] = [];
  lastDailyActivity = { households: 0, businesses: 0 };
  controlledResidentId?: string;
  private history: WorldSnapshot[] = [];

  constructor() {
    this.roads = clone(NYC_TEMPLATE.roads);
    this.areas = clone(NYC_TEMPLATE.areas);
    this.rebuildLots();
    this.parking = initialParking(this.roads);
    this.transitLines = initialTransitLines(this.roads);
    this.cityEvents = initialCityEvents(this.roads);
    this.rebuildAccessibilityEntrances();
  }

  snapshot(): WorldSnapshot {
    this.refreshSpatialChunks();
    return clone({
      version: 1,
      templateId: this.templateId,
      roads: this.roads,
      areas: this.areas,
      lots: this.lots,
      homes: this.homes,
      services: this.services,
      utilities: this.utilities,
      clock: this.clock,
      serviceFunding: this.serviceFunding,
      incidents: this.incidents,
      utilityFailures: this.utilityFailures,
      commuteFlows: this.commuteFlows,
      parking: this.parking,
      playerVehicle: this.playerVehicle,
      transitLines: this.transitLines,
      cityEvents: this.cityEvents,
      accessibilityEntrances: this.accessibilityEntrances,
      spatialChunkSize: this.spatialChunkSize,
      spatialChunks: this.spatialChunks
    });
  }

  refreshSpatialChunks() {
    const chunkSize = this.spatialChunkSize;
    const chunks = new Map<string, SpatialChunk>();
    const ensureChunk = (gridX: number, gridZ: number) => {
      const id = `chunk-${gridX}-${gridZ}`;
      let chunk = chunks.get(id);
      if (!chunk) {
        chunk = {
          id,
          gridX,
          gridZ,
          size: chunkSize,
          center: { x: (gridX + .5) * chunkSize, z: (gridZ + .5) * chunkSize },
          lotIds: [],
          roadIds: [],
          households: 0,
          businesses: 0,
          population: 0,
          jobs: 0
        };
        chunks.set(id, chunk);
      }
      return chunk;
    };
    const chunkAt = (point: Point2) => ensureChunk(
      Math.floor(point.x / chunkSize),
      Math.floor(point.z / chunkSize)
    );
    for (const lot of this.lots) {
      const chunk = chunkAt(lot.center);
      chunk.lotIds.push(lot.id);
      chunk.households += lot.households;
      chunk.businesses += lot.businesses;
      chunk.population += this.lotPopulation(lot);
      chunk.jobs += this.lotJobs(lot);
    }
    for (const road of this.roads) {
      const roadChunkIds = new Set<string>();
      for (let index = 0; index < road.points.length - 1; index++) {
        const start = road.points[index];
        const end = road.points[index + 1];
        const length = distance(start, end);
        const steps = Math.max(1, Math.ceil(length / (chunkSize / 2)));
        for (let step = 0; step <= steps; step++) {
          const progress = step / steps;
          roadChunkIds.add(chunkAt({
            x: start.x + (end.x - start.x) * progress,
            z: start.z + (end.z - start.z) * progress
          }).id);
        }
      }
      for (const chunkId of roadChunkIds) chunks.get(chunkId)?.roadIds.push(road.id);
    }
    this.spatialChunks = [...chunks.values()]
      .map(chunk => ({
        ...chunk,
        lotIds: chunk.lotIds.sort(),
        roadIds: [...new Set(chunk.roadIds)].sort()
      }))
      .sort((first, second) => first.gridZ - second.gridZ || first.gridX - second.gridX);
    return this.spatialChunks;
  }

  spatialDetailTier(chunk: SpatialChunk, focus: Point2): SpatialDetailTier {
    const distanceFromFocus = distance(chunk.center, focus);
    if (distanceFromFocus <= chunk.size * 1.35) return "agent";
    if (distanceFromFocus <= chunk.size * 3.4) return "active";
    return "aggregate";
  }

  spatialLodSummary(focus: Point2): SpatialLodSummary {
    this.refreshSpatialChunks();
    const summary: SpatialLodSummary = {
      agentChunks: 0,
      activeChunks: 0,
      aggregateChunks: 0,
      agentPopulation: 0,
      activePopulation: 0,
      aggregatePopulation: 0
    };
    for (const chunk of this.spatialChunks) {
      const tier = this.spatialDetailTier(chunk, focus);
      if (tier === "agent") {
        summary.agentChunks++;
        summary.agentPopulation += chunk.population;
      } else if (tier === "active") {
        summary.activeChunks++;
        summary.activePopulation += chunk.population;
      } else {
        summary.aggregateChunks++;
        summary.aggregatePopulation += chunk.population;
      }
    }
    return summary;
  }

  private checkpoint() {
    this.history.push(this.snapshot());
    if (this.history.length > 40) this.history.shift();
  }

  addRoad(points: Point2[], width = 10, roadClass: Road["class"] = "street") {
    if (points.length < 2) return;
    this.checkpoint();
    this.roads.push({ id: crypto.randomUUID(), points: clone(points), width, class: roadClass, name: `New ${roadClass}` });
    this.rebuildLots();
    if (!this.transitLines.length) this.transitLines = initialTransitLines(this.roads);
    this.rebuildAccessibilityEntrances();
  }

  zoneLot(lotId: string, zone: Zone) {
    const lot = this.lots.find(item => item.id === lotId);
    if (!lot || lot.zone === zone) return false;
    this.checkpoint();
    lot.zone = zone;
    lot.constructionStartedAt = this.clock.elapsedMinutes;
    lot.constructionDuration = 1440 + hashString(lot.id) % 2880;
    lot.households = 0;
    lot.businesses = 0;
    lot.householdMix = createHouseholdMix(0, hashString(lot.id));
    lot.businessMix = createBusinessMix(0, zone, hashString(lot.id));
    lot.anchorBusiness = undefined;
    this.rebuildCommutes();
    this.rebuildAccessibilityEntrances();
    return true;
  }

  addService(kind: ServiceKind, position: Point2) {
    const definitions: Record<ServiceKind, Pick<CityService, "radius" | "monthlyCost" | "capacity" | "staffRequired">> = {
      power: { radius: 430, monthlyCost: 780_000, capacity: 65_000, staffRequired: 160 },
      water: { radius: 360, monthlyCost: 520_000, capacity: 72_000, staffRequired: 85 },
      sewage: { radius: 330, monthlyCost: 610_000, capacity: 68_000, staffRequired: 110 },
      waste: { radius: 240, monthlyCost: 470_000, capacity: 48_000, staffRequired: 95 },
      fire: { radius: 190, monthlyCost: 360_000, capacity: 18_000, staffRequired: 75 },
      health: { radius: 165, monthlyCost: 440_000, capacity: 12_000, staffRequired: 140 },
      school: { radius: 180, monthlyCost: 390_000, capacity: 8_000, staffRequired: 180 }
    };
    this.checkpoint();
    this.services.push({ id: crypto.randomUUID(), kind, position: clone(position), ...definitions[kind] });
    this.dispatchWaitingIncidents(kind);
    if (kind === "power" || kind === "water" || kind === "sewage" || kind === "waste") {
      this.dispatchWaitingUtilityFailures(kind);
    }
  }

  addParking(kind: ParkingKind, position: Point2, rotation: number, hourlyRate = defaultParkingRate(kind)) {
    const definition = {
      curb: { capacity: 2, accessibleSpaces: 1 },
      surface: { capacity: 18, accessibleSpaces: 2 },
      garage: { capacity: 84, accessibleSpaces: 5 }
    }[kind];
    this.checkpoint();
    const facility: ParkingFacility = {
      id: crypto.randomUUID(),
      kind,
      position: clone(position),
      rotation,
      occupied: kind === "curb" ? 0 : Math.floor(definition.capacity * .42),
      hourlyRate: normalizeParkingRate(hourlyRate),
      revenue: 0,
      curbUse: kind === "curb" ? "parking" : undefined,
      curbSchedule: kind === "curb" ? "all-day" : undefined,
      deliveriesWaiting: kind === "curb" ? 0 : undefined,
      deliveriesServed: kind === "curb" ? 0 : undefined,
      violations: kind === "curb" ? 0 : undefined,
      curbRevenue: kind === "curb" ? 0 : undefined,
      ...definition
    };
    this.parking.push(facility);
    return facility;
  }

  addCurbZone(position: Point2, rotation: number, use: CurbUse, schedule: CurbSchedule) {
    const facility = this.addParking("curb", position, rotation, defaultParkingRate("curb"));
    facility.curbUse = use;
    facility.curbSchedule = schedule;
    return facility;
  }

  setParkingRate(parkingId: string, hourlyRate: number) {
    const facility = this.parking.find(item => item.id === parkingId);
    if (!facility) return false;
    const normalized = normalizeParkingRate(hourlyRate);
    if (facility.hourlyRate === normalized) return false;
    this.checkpoint();
    facility.hourlyRate = normalized;
    return true;
  }

  setCurbRule(parkingId: string, use: CurbUse, schedule: CurbSchedule) {
    const facility = this.parking.find(item => item.id === parkingId && item.kind === "curb");
    if (!facility) return false;
    if (facility.curbUse === use && facility.curbSchedule === schedule) return false;
    this.checkpoint();
    facility.curbUse = use;
    facility.curbSchedule = schedule;
    facility.deliveriesWaiting ??= 0;
    facility.deliveriesServed ??= 0;
    facility.violations ??= 0;
    facility.curbRevenue ??= 0;
    return true;
  }

  addCityEvent(kind: CityEventKind, position: Point2, timing: CityEventTiming) {
    const definition = CITY_EVENT_DEFINITIONS[kind];
    const startAt = this.cityEventStartForTiming(definition.defaultStartMinute, timing);
    const road = this.roads
      .map(item => ({ item, distance: distanceToPolyline(position, item.points) }))
      .sort((a, b) => a.distance - b.distance)[0]?.item;
    const placeName = road?.name ?? this.areas
      .filter(area => area.kind === "district")
      .map(area => ({ area, distance: distance(position, polygonCenter(area.points)) }))
      .sort((a, b) => a.distance - b.distance)[0]?.area.name
      ?? "Gridless";
    this.checkpoint();
    const event: CityEvent = {
      id: crypto.randomUUID(),
      name: `${placeName} ${definition.nameSuffix}`,
      kind,
      position: clone(position),
      startAt,
      durationMinutes: definition.durationMinutes,
      intervalMinutes: 30 * 24 * 60,
      capacity: definition.capacity,
      cityFeePerAttendee: definition.cityFeePerAttendee,
      monthlyCost: definition.monthlyCost,
      occurrences: 0,
      totalAttendance: 0,
      revenue: 0,
      roadId: road?.id,
      closureRoadIds: this.cityEventClosureRoadIds(position, kind),
      temporaryTransitLineId: this.nearestEventTransitLineId(position),
      temporaryTransitHeadwayMinutes: kind === "sports" || kind === "parade" ? 4 : 6
    };
    this.cityEvents.push(event);
    return event;
  }

  cityEventActiveAt(event: CityEvent, elapsedMinute = this.clock.elapsedMinutes) {
    if (elapsedMinute < event.startAt) return false;
    const phase = positiveModulo(elapsedMinute - event.startAt, event.intervalMinutes);
    return phase < event.durationMinutes;
  }

  activeCityEvents(elapsedMinute = this.clock.elapsedMinutes) {
    if (elapsedMinute < 0) return [];
    return this.cityEvents.filter(event => this.cityEventActiveAt(event, elapsedMinute));
  }

  cityEventOccurrence(event: CityEvent, elapsedMinute = this.clock.elapsedMinutes) {
    if (elapsedMinute < event.startAt) return -1;
    return Math.floor((elapsedMinute - event.startAt) / event.intervalMinutes);
  }

  cityEventExpectedAttendance(event: CityEvent, occurrence = Math.max(0, this.cityEventOccurrence(event))) {
    const definition = CITY_EVENT_DEFINITIONS[event.kind];
    const population = this.lots.reduce((total, lot) => total + this.lotPopulation(lot), 0);
    const variation = .88 + (hashString(`${event.id}:attendance:${occurrence}`) % 25) / 100;
    return Math.min(
      event.capacity,
      Math.max(1, Math.round((definition.attendanceBase + population * definition.populationShare) * variation))
    );
  }

  cityEventStatus(event: CityEvent) {
    const elapsed = this.clock.elapsedMinutes;
    if (this.cityEventActiveAt(event, elapsed)) {
      const occurrence = this.cityEventOccurrence(event, elapsed);
      const endAt = event.startAt + occurrence * event.intervalMinutes + event.durationMinutes;
      return `Active · ${Math.max(1, Math.ceil((endAt - elapsed) / 60))}h remaining`;
    }
    const nextStart = this.cityEventNextStart(event, elapsed);
    const minutes = Math.max(0, nextStart - elapsed);
    if (minutes < 24 * 60) return `Starts in ${Math.max(1, Math.ceil(minutes / 60))}h`;
    return `Starts in ${Math.ceil(minutes / (24 * 60))}d`;
  }

  cityEventTrafficPressure(elapsedMinute = this.clock.elapsedMinutes) {
    return clamp(this.activeCityEvents(elapsedMinute).reduce((total, event) => {
      const definition = CITY_EVENT_DEFINITIONS[event.kind];
      const attendance = this.cityEventExpectedAttendance(event, this.cityEventOccurrence(event, elapsedMinute));
      return total + definition.trafficImpact * attendance / Math.max(1, event.capacity);
    }, 0), 0, .72);
  }

  cityEventClosedRoads(elapsedMinute = this.clock.elapsedMinutes) {
    const roadIds = new Set(
      this.activeCityEvents(elapsedMinute).flatMap(event => event.closureRoadIds ?? [])
    );
    return this.roads.filter(road => roadIds.has(road.id));
  }

  cityEventRoadClosure(roadId: string, elapsedMinute = this.clock.elapsedMinutes) {
    return this.activeCityEvents(elapsedMinute).find(
      event => event.closureRoadIds?.includes(roadId)
    );
  }

  cityEventRouteClosurePenalty(route: Point2[], elapsedMinute = this.clock.elapsedMinutes) {
    if (route.length < 2) return 0;
    return this.cityEventClosedRoads(elapsedMinute).reduce((total, road) => {
      const intersects = route.some(point =>
        distanceToPolyline(point, road.points) <= road.width / 2 + 2
      );
      return total + (intersects ? 12 : 0);
    }, 0);
  }

  transitEffectiveHeadway(line: TransitLine, elapsedMinute = this.clock.elapsedMinutes) {
    return this.activeCityEvents(elapsedMinute)
      .filter(event => event.temporaryTransitLineId === line.id)
      .reduce(
        (headway, event) => Math.min(
          headway,
          Math.round(clamp(event.temporaryTransitHeadwayMinutes ?? headway, 4, 30))
        ),
        line.headwayMinutes
      );
  }

  transitActiveFleetSize(line: TransitLine, elapsedMinute = this.clock.elapsedMinutes) {
    return transitFleetSize({
      ...line,
      headwayMinutes: this.transitEffectiveHeadway(line, elapsedMinute)
    });
  }

  cityEventTransitDemand(position: Point2, elapsedMinute = this.clock.elapsedMinutes) {
    return this.activeCityEvents(elapsedMinute).reduce((total, event) => {
      const localDistance = distance(position, event.position);
      if (localDistance > 220) return total;
      const definition = CITY_EVENT_DEFINITIONS[event.kind];
      const attendance = this.cityEventExpectedAttendance(event, this.cityEventOccurrence(event, elapsedMinute));
      const hourlyArrivals = attendance * definition.transitShare / Math.max(1, event.durationMinutes / 60);
      return total + hourlyArrivals * (1 - localDistance / 220) / 6;
    }, 0);
  }

  cityEventCurbOverride(facility: ParkingFacility, elapsedMinute = this.clock.elapsedMinutes) {
    if (facility.kind !== "curb" || elapsedMinute < 0) return undefined;
    return this.activeCityEvents(elapsedMinute).find(event =>
      distance(event.position, facility.position) <= CITY_EVENT_DEFINITIONS[event.kind].curbRadius
    );
  }

  cityEventMonthlyProjection(event: CityEvent) {
    return Math.round(this.cityEventExpectedAttendance(event) * event.cityFeePerAttendee);
  }

  private cityEventClosureRoadIds(position: Point2, kind: CityEventKind) {
    const count = kind === "parade" || kind === "sports" ? 2 : 1;
    const radius = CITY_EVENT_DEFINITIONS[kind].curbRadius * 1.35;
    return this.roads
      .map(road => ({
        road,
        distance: distanceToPolyline(position, road.points)
      }))
      .filter(candidate => candidate.distance <= radius)
      .sort((first, second) => first.distance - second.distance)
      .slice(0, count)
      .map(candidate => candidate.road.id);
  }

  private nearestEventTransitLineId(position: Point2) {
    return this.transitLines
      .map(line => ({
        line,
        distance: Math.min(...line.stops.map(stop => distance(position, stop.position)))
      }))
      .sort((first, second) => first.distance - second.distance)[0]?.line.id;
  }

  private cityEventStartForTiming(defaultStartMinute: number, timing: CityEventTiming) {
    if (timing === "now") return this.clock.elapsedMinutes;
    if (timing === "tomorrow") {
      return this.clock.elapsedMinutes + (24 * 60 - this.clock.minute) + defaultStartMinute;
    }
    let delay = defaultStartMinute - this.clock.minute;
    if (delay <= 15) delay += 24 * 60;
    return this.clock.elapsedMinutes + delay;
  }

  private cityEventNextStart(event: CityEvent, elapsedMinute: number) {
    if (elapsedMinute <= event.startAt) return event.startAt;
    const occurrence = Math.floor((elapsedMinute - event.startAt) / event.intervalMinutes);
    const currentStart = event.startAt + occurrence * event.intervalMinutes;
    if (elapsedMinute < currentStart + event.durationMinutes) return currentStart;
    return currentStart + event.intervalMinutes;
  }

  curbRuleActive(facility: ParkingFacility, minute = this.clock.minute) {
    if (facility.kind !== "curb") return false;
    const hour = positiveModulo(minute, 24 * 60) / 60;
    const schedule = facility.curbSchedule ?? "all-day";
    if (schedule === "all-day") return true;
    if (schedule === "business-hours") return hour >= 7 && hour < 19;
    if (schedule === "rush-hours") return (hour >= 7 && hour < 10) || (hour >= 16 && hour < 19);
    return hour >= 17 && hour < 23;
  }

  curbEffectiveUse(
    facility: ParkingFacility,
    minute = this.clock.minute,
    elapsedMinute = this.clock.elapsedMinutes
  ): CurbUse {
    if (facility.kind !== "curb") return "parking";
    if (this.cityEventCurbOverride(facility, elapsedMinute)) return "event";
    return this.curbRuleActive(facility, minute) ? facility.curbUse ?? "parking" : "parking";
  }

  parkingPermitted(
    facility: ParkingFacility,
    minute = this.clock.minute,
    elapsedMinute = this.clock.elapsedMinutes
  ) {
    return facility.kind !== "curb" || this.curbEffectiveUse(facility, minute, elapsedMinute) === "parking";
  }

  curbLoadingDemand(facility: ParkingFacility, minute = this.clock.minute) {
    if (facility.kind !== "curb") return 0;
    const hour = positiveModulo(minute, 24 * 60) / 60;
    const timeFactor = hour >= 7 && hour < 11
      ? 1.25
      : hour >= 11 && hour < 19
        ? 1
        : hour >= 19 && hour < 23
          ? .42
          : .16;
    const localDemand = this.lots.reduce((total, lot) => {
      if (this.constructionProgress(lot) < 1) return total;
      const localDistance = distance(lot.center, facility.position);
      if (localDistance > 190) return total;
      const proximity = 1 - localDistance / 190;
      return total + proximity * (
        this.lotJobs(lot) * .00042
        + lot.businesses * .045
        + (lot.zone === "industrial" ? .38 : 0)
      );
    }, 0);
    return Math.max(0, localDemand * timeFactor);
  }

  curbMonthlyProjection(facility: ParkingFacility) {
    if (facility.kind !== "curb") return 0;
    const hourlyRevenue = [2, 8, 12, 17, 21].reduce((total, hour) => {
      const minute = hour * 60;
      const use = this.curbEffectiveUse(facility, minute, -1);
      const demand = this.curbLoadingDemand(facility, minute);
      if (use === "loading") return total + Math.min(demand, facility.capacity * 3) * 6;
      if (use === "restricted") return total + demand * .12 * 115;
      if (use === "event") return total + demand * .18 * 185;
      return total;
    }, 0) / 5;
    return Math.round(hourlyRevenue * 24 * 30);
  }

  curbMonthlyCost(facility: ParkingFacility) {
    if (facility.kind !== "curb") return 0;
    const use = facility.curbUse ?? "parking";
    return use === "event" ? 1_800 : use === "loading" ? 1_200 : use === "restricted" ? 900 : 450;
  }

  setTransitOperations(lineId: string, headwayMinutes: number, fare: number) {
    const line = this.transitLines.find(item => item.id === lineId);
    if (!line) return false;
    const headway = Math.round(clamp(headwayMinutes, 4, 30));
    const normalizedFare = Math.round(clamp(fare, 0, 10) * 4) / 4;
    if (line.headwayMinutes === headway && line.fare === normalizedFare) return false;
    this.checkpoint();
    line.headwayMinutes = headway;
    line.fare = normalizedFare;
    return true;
  }

  addTransitLine(roadId: string) {
    const road = this.roads.find(item => item.id === roadId);
    if (!road || road.points.length < 2 || this.transitLines.length >= 8) return undefined;
    const existing = this.transitLines.find(line => line.roadId === roadId);
    if (existing) return existing;
    this.checkpoint();
    const line = transitLineForRoad(road, this.transitLines.length);
    this.transitLines.push(line);
    this.rebuildAccessibilityEntrances();
    return line;
  }

  setTransitStopCount(lineId: string, stopCount: number) {
    const line = this.transitLines.find(item => item.id === lineId);
    if (!line) return false;
    const count = Math.round(clamp(stopCount, 4, 10));
    if (line.stops.length === count) return false;
    this.checkpoint();
    line.stops = transitStopsForLine(line, count);
    this.rebuildAccessibilityEntrances();
    return true;
  }

  removeTransitLine(lineId: string) {
    const index = this.transitLines.findIndex(item => item.id === lineId);
    if (index < 0 || this.transitLines.length <= 1) return false;
    this.checkpoint();
    this.transitLines.splice(index, 1);
    this.rebuildAccessibilityEntrances();
    return true;
  }

  transitStopDemand(
    line: TransitLine,
    stop: TransitStop,
    minute = this.clock.minute,
    elapsedMinute = this.clock.elapsedMinutes
  ) {
    const hour = positiveModulo(minute, 24 * 60) / 60;
    const timeFactor = hour >= 6 && hour < 10
      ? 1.34
      : hour >= 15 && hour < 19
        ? 1.42
        : hour >= 10 && hour < 22
          ? .88
          : .28;
    const localDemand = this.lots.reduce((total, lot) => {
      if (this.constructionProgress(lot) < 1) return total;
      const localDistance = distance(lot.center, stop.position);
      if (localDistance > 190) return total;
      const proximity = 1 - localDistance / 190;
      return total + proximity * (
        this.lotPopulation(lot) * .0042
        + this.lotJobs(lot) * .0031
        + lot.businesses * .12
      );
    }, 0);
    const effectiveHeadway = this.transitEffectiveHeadway(line, elapsedMinute);
    const frequencyFactor = clamp(1.34 - effectiveHeadway / 30, .42, 1.2);
    const fareFactor = clamp(1.2 - line.fare / 9, .48, 1.18);
    const entrance = this.accessibilityEntrances.find(
      item => item.targetKind === "transit" && item.targetId === stop.id
    );
    const accessFactor = entrance && this.entranceIsUsable(entrance) ? 1 : .72;
    const eventDemand = elapsedMinute < 0 ? 0 : this.cityEventTransitDemand(stop.position, elapsedMinute);
    return Math.max(0, (localDemand * timeFactor + eventDemand) * frequencyFactor * fareFactor * accessFactor);
  }

  transitLineDemand(
    line: TransitLine,
    minute = this.clock.minute,
    elapsedMinute = this.clock.elapsedMinutes
  ) {
    return line.stops.reduce(
      (total, stop) => total + this.transitStopDemand(line, stop, minute, elapsedMinute),
      0
    );
  }

  transitLineCrowding(line: TransitLine, minute = this.clock.minute) {
    const busesPerHour = 60 / Math.max(4, this.transitEffectiveHeadway(line));
    const averageOnboard = this.transitLineDemand(line, minute) * .42 / Math.max(.5, busesPerHour);
    return clamp(averageOnboard / Math.max(1, line.vehicleCapacity), 0, 1.5);
  }

  transitPassengerLoad(line: TransitLine, minute = this.clock.minute) {
    return Math.min(
      line.vehicleCapacity,
      Math.max(1, Math.round(line.vehicleCapacity * this.transitLineCrowding(line, minute)))
    );
  }

  transitAverageWait(line: TransitLine) {
    const effectiveHeadway = this.transitEffectiveHeadway(line);
    const baseWait = effectiveHeadway / 2;
    const waiting = line.stops.reduce((total, stop) => total + stop.waiting, 0);
    const hourlyCapacity = line.vehicleCapacity * 60 / Math.max(4, effectiveHeadway);
    return Math.min(
      effectiveHeadway * 2,
      baseWait + waiting / Math.max(1, hourlyCapacity) * effectiveHeadway
    );
  }

  transitMonthlyProjection(line: TransitLine) {
    const baseHourlyDemand = [2, 7, 9, 12, 17, 21].reduce(
      (total, hour) => total + this.transitLineDemand(line, hour * 60, -1),
      0
    ) / 6;
    const eventRides = this.cityEvents.reduce((total, event) => {
      const nearestStopDistance = Math.min(
        ...line.stops.map(stop => distance(stop.position, event.position))
      );
      const access = clamp(1 - nearestStopDistance / 320, 0, 1);
      return total
        + this.cityEventExpectedAttendance(event)
        * CITY_EVENT_DEFINITIONS[event.kind].transitShare
        * access;
    }, 0);
    return Math.round(baseHourlyDemand * 24 * 30 * line.fare * .82 + eventRides * line.fare);
  }

  transitMonthlyCost(line: TransitLine) {
    return transitFleetSize(line) * 32_000 + line.stops.length * 1_400;
  }

  boardTransitPassenger(lineId: string, stopId: string) {
    const line = this.transitLines.find(item => item.id === lineId);
    const stop = line?.stops.find(item => item.id === stopId);
    if (!line || !stop) return false;
    line.ridership += 1;
    line.fareRevenue = Math.round((line.fareRevenue + line.fare) * 100) / 100;
    stop.boardings += 1;
    stop.waiting = Math.max(0, stop.waiting - 1);
    return true;
  }

  entranceIsUsable(entrance: AccessibilityEntrance) {
    return entrance.stepFree && entrance.doorWidth >= .9;
  }

  entranceHasUniversalAccess(entrance: AccessibilityEntrance) {
    return this.entranceIsUsable(entrance)
      && entrance.tactileGuidance
      && (entrance.targetKind !== "lot" || entrance.automaticDoor);
  }

  accessibilityUpgradeCost(entrance: AccessibilityEntrance) {
    return entrance.targetKind === "lot" ? 45_000 : entrance.targetKind === "park" ? 70_000 : 25_000;
  }

  upgradeAccessibility(entranceId: string) {
    const entrance = this.accessibilityEntrances.find(item => item.id === entranceId);
    if (!entrance || this.entranceHasUniversalAccess(entrance)) return false;
    const cost = this.accessibilityUpgradeCost(entrance);
    if (this.clock.treasury < cost) return false;
    this.checkpoint();
    this.clock.treasury -= cost;
    entrance.stepFree = true;
    entrance.doorWidth = Math.max(1.35, entrance.doorWidth);
    entrance.tactileGuidance = true;
    entrance.automaticDoor = true;
    return true;
  }

  accessibilityDestinations(): AccessibilityDestination[] {
    const destinations: AccessibilityDestination[] = [];
    for (const entrance of this.accessibilityEntrances) {
      if (entrance.targetKind === "lot") {
        const lot = this.lots.find(item => item.id === entrance.targetId);
        if (!lot || lot.zone === "unassigned" || this.constructionProgress(lot) < 1) continue;
        const road = this.roads.find(item => item.id === lot.roadId)?.name ?? "Unnamed road";
        const address = `${100 + hashString(lot.id) % 900} ${road}`;
        const home = this.homes.find(item => item.lotId === lot.id);
        if (lot.households > 0 || home) {
          destinations.push({
            id: `access-destination-home-${lot.id}`,
            kind: "home",
            sourceId: lot.id,
            entranceId: entrance.id,
            name: home?.name && home.name !== "New household" ? home.name : `Homes at ${address}`,
            position: clone(entrance.position),
            usable: this.entranceIsUsable(entrance)
          });
        }
        if (lot.businesses > 0) {
          destinations.push({
            id: `access-destination-business-${lot.id}`,
            kind: "business",
            sourceId: lot.id,
            entranceId: entrance.id,
            name: lot.anchorBusiness?.name ?? `Businesses at ${address}`,
            position: clone(entrance.position),
            usable: this.entranceIsUsable(entrance)
          });
        }
      } else if (entrance.targetKind === "park") {
        const park = this.areas.find(item => item.id === entrance.targetId && item.kind === "park");
        if (!park) continue;
        destinations.push({
          id: `access-destination-park-${park.id}`,
          kind: "park",
          sourceId: park.id,
          entranceId: entrance.id,
          name: park.name,
          position: clone(entrance.position),
          usable: this.entranceIsUsable(entrance)
        });
      } else {
        const stop = this.transitLines.flatMap(line => line.stops).find(item => item.id === entrance.targetId);
        if (!stop) continue;
        destinations.push({
          id: `access-destination-transit-${stop.id}`,
          kind: "transit",
          sourceId: stop.id,
          entranceId: entrance.id,
          name: stop.name,
          position: clone(entrance.position),
          usable: this.entranceIsUsable(entrance)
        });
      }
    }
    return destinations;
  }

  parkingDemand(facility: ParkingFacility, minute = this.clock.minute) {
    if (!this.parkingPermitted(facility, minute)) return 0;
    const hour = positiveModulo(minute, 24 * 60) / 60;
    const localCapacity = Math.max(2, this.parking
      .filter(item => this.parkingPermitted(item, minute) && distance(item.position, facility.position) <= 180)
      .reduce((total, item) => total + item.capacity, 0));
    const demandUnits = this.lots.reduce((total, lot) => {
      if (this.constructionProgress(lot) < 1) return total;
      const localDistance = distance(lot.center, facility.position);
      if (localDistance > 180) return total;
      const proximity = 1 - localDistance / 180;
      const residentialFactor = hour < 7 || hour >= 18 ? .016 : .004;
      const jobFactor = hour >= 7 && hour < 19 ? .012 : .003;
      const businessFactor = hour >= 8 && hour < 22 ? .18 : .04;
      return total + proximity * (
        this.lotPopulation(lot) * residentialFactor
        + this.lotJobs(lot) * jobFactor
        + lot.businesses * businessFactor
      );
    }, 0);
    const baseDemand = 1 - Math.exp(-demandUnits / localCapacity);
    const standardRate = defaultParkingRate(facility.kind);
    const priceFactor = clamp(1.28 - facility.hourlyRate / Math.max(1, standardRate) * .34, .3, 1.24);
    const kindFactor = facility.kind === "curb" ? 1.08 : facility.kind === "surface" ? .92 : 1;
    const congestionFactor = .88 + this.congestionLevel() * .24;
    return clamp(.04 + baseDemand * priceFactor * kindFactor * congestionFactor, .04, .98);
  }

  parkingMonthlyProjection(facility: ParkingFacility) {
    const averageDemand = [2, 8, 12, 17, 21].reduce(
      (total, hour) => total + this.parkingDemand(facility, hour * 60),
      0
    ) / 5;
    return Math.round(facility.capacity * averageDemand * facility.hourlyRate * 24 * 30 * .55);
  }

  parkingMonthlyCost(facility: ParkingFacility) {
    const costPerSpace = facility.kind === "curb" ? 50 : facility.kind === "surface" ? 110 : 310;
    return facility.capacity * costPerSpace;
  }

  parkPlayerVehicle(parkingId: string, position: Point2, heading: number) {
    const facility = this.parking.find(item => item.id === parkingId);
    if (!facility || !this.parkingPermitted(facility) || facility.occupied >= facility.capacity) return false;
    if (this.playerVehicle?.parkingId && this.playerVehicle.parkingId !== parkingId) {
      const previous = this.parking.find(item => item.id === this.playerVehicle!.parkingId);
      if (previous) previous.occupied = Math.max(0, previous.occupied - 1);
    }
    if (this.playerVehicle?.parkingId !== parkingId) facility.occupied += 1;
    this.playerVehicle = { position: clone(position), heading, parkingId };
    return true;
  }

  releasePlayerVehicle(position: Point2, heading: number) {
    if (this.playerVehicle?.parkingId) {
      const facility = this.parking.find(item => item.id === this.playerVehicle!.parkingId);
      if (facility) facility.occupied = Math.max(0, facility.occupied - 1);
    }
    this.playerVehicle = { position: clone(position), heading };
  }

  rememberPlayerVehicle(position: Point2, heading: number) {
    this.playerVehicle = {
      position: clone(position),
      heading,
      parkingId: this.playerVehicle?.parkingId
    };
  }

  setServiceFunding(funding: number) {
    const normalized = Math.max(.55, Math.min(1, funding));
    if (normalized === this.serviceFunding) return false;
    this.checkpoint();
    this.serviceFunding = normalized;
    return true;
  }

  constructionProgress(lot: Lot) {
    if (lot.constructionStartedAt === undefined || !lot.constructionDuration) return 1;
    return Math.max(0, Math.min(1, (this.clock.elapsedMinutes - lot.constructionStartedAt) / lot.constructionDuration));
  }

  cityEconomy(): CityEconomy {
    const completedLots = this.lots.filter(lot => this.constructionProgress(lot) >= 1);
    const households = completedLots.reduce((total, lot) => total + lot.households, 0);
    const businesses = completedLots.reduce((total, lot) => total + lot.businesses, 0);
    const population = completedLots.reduce((total, lot) => total + this.lotPopulation(lot), 0);
    const privateJobs = completedLots.reduce((total, lot) => total + this.lotJobs(lot), 0);
    const publicJobs = Math.round(this.services.reduce((total, service) => total + service.staffRequired, 0) * this.serviceFunding);
    const activity = completedLots.reduce((total, lot) => {
      const current = this.lotActivity(lot);
      total.openBusinesses += current.openBusinesses;
      total.workersOnShift += current.activeJobs;
      return total;
    }, { openBusinesses: 0, workersOnShift: 0 });
    const workersOnShift = activity.workersOnShift + this.onDutyPublicJobs();
    const parkingRevenue = this.parking.reduce(
      (total, facility) => total + this.parkingMonthlyProjection(facility),
      0
    );
    const parkingCosts = this.parking.reduce(
      (total, facility) => total + this.parkingMonthlyCost(facility),
      0
    );
    const transitRevenue = this.transitLines.reduce(
      (total, line) => total + this.transitMonthlyProjection(line),
      0
    );
    const transitCosts = this.transitLines.reduce(
      (total, line) => total + this.transitMonthlyCost(line),
      0
    );
    const transitRidership = this.transitLines.reduce(
      (total, line) => total + line.ridership,
      0
    );
    const curbRevenue = this.parking.reduce(
      (total, facility) => total + this.curbMonthlyProjection(facility),
      0
    );
    const curbCosts = this.parking.reduce(
      (total, facility) => total + this.curbMonthlyCost(facility),
      0
    );
    const curbDeliveries = this.parking.reduce(
      (total, facility) => total + (facility.deliveriesServed ?? 0),
      0
    );
    const curbViolations = this.parking.reduce(
      (total, facility) => total + (facility.violations ?? 0),
      0
    );
    const eventRevenue = this.cityEvents.reduce(
      (total, event) => total + this.cityEventMonthlyProjection(event),
      0
    );
    const eventCosts = this.cityEvents.reduce(
      (total, event) => total + event.monthlyCost,
      0
    );
    const eventAttendance = this.cityEvents.reduce(
      (total, event) => total + event.totalAttendance,
      0
    );
    const activeEvents = this.activeCityEvents().length;
    const monthlyRevenue = population * 118
      + businesses * 4_800
      + parkingRevenue
      + transitRevenue
      + curbRevenue
      + eventRevenue;
    const monthlyCosts = this.services.reduce(
      (total, service) => total + service.monthlyCost * (.4 + this.serviceFunding * .6),
      0
    ) + parkingCosts + transitCosts + curbCosts + eventCosts;
    return {
      completedLots: completedLots.length,
      households,
      businesses,
      population,
      privateJobs,
      publicJobs,
      jobs: privateJobs + publicJobs,
      openBusinesses: activity.openBusinesses,
      workersOnShift,
      monthlyRevenue,
      monthlyCosts,
      monthlyBalance: monthlyRevenue - monthlyCosts,
      parkingRevenue,
      parkingCosts,
      transitRevenue,
      transitCosts,
      transitRidership,
      curbRevenue,
      curbCosts,
      curbDeliveries,
      curbViolations,
      eventRevenue,
      eventCosts,
      eventAttendance,
      activeEvents
    };
  }

  effectiveStaffing() {
    const workforce = this.lots.reduce((total, lot) => total + lot.households * 1.28, 0);
    const required = this.services.reduce((total, service) => total + service.staffRequired, 0);
    if (!required) return this.serviceFunding;
    return Math.min(this.serviceFunding, workforce / required);
  }

  lotPopulation(lot: Lot) {
    const modeled = Math.round(
      lot.householdMix.families * 3.2
      + lot.householdMix.singles * 1.08
      + lot.householdMix.shared * 2.45
      + lot.householdMix.seniors * 1.42
    );
    const explicitResidents = this.homes.find(home => home.lotId === lot.id)?.residents.length ?? 0;
    return Math.max(modeled, explicitResidents);
  }

  lotJobs(lot: Lot) {
    const seed = hashString(lot.id);
    return (Object.entries(lot.businessMix) as Array<[BusinessSector, number]>)
      .reduce((total, [sector, count]) => total + count * sectorJobs(sector, seed), 0);
  }

  lotActivity(lot: Lot): LotActivity {
    const hour = this.clock.minute / 60;
    const familyPeople = lot.householdMix.families * 3.2;
    const singlePeople = lot.householdMix.singles * 1.08;
    const sharedPeople = lot.householdMix.shared * 2.45;
    const seniorPeople = lot.householdMix.seniors * 1.42;
    const familyHomeShare = hour < 6 ? .95 : hour < 8 ? .78 : hour < 16 ? .35 : hour < 19 ? .62 : hour < 23 ? .86 : .96;
    const singleHomeShare = hour < 6 ? .92 : hour < 8 ? .7 : hour < 18 ? .28 : hour < 23 ? .64 : .9;
    const sharedHomeShare = hour < 6 ? .88 : hour < 9 ? .62 : hour < 17 ? .3 : hour < 23 ? .58 : .86;
    const seniorHomeShare = hour < 7 ? .96 : hour < 11 ? .76 : hour < 16 ? .68 : hour < 22 ? .84 : .96;
    const population = this.lotPopulation(lot);
    const atHome = Math.min(population, Math.round(
      familyPeople * familyHomeShare
      + singlePeople * singleHomeShare
      + sharedPeople * sharedHomeShare
      + seniorPeople * seniorHomeShare
    ));
    const away = Math.max(0, population - atHome);
    const commuteWindow = hour >= 7 && hour < 19;
    const atWorkOrSchool = commuteWindow ? Math.round(away * .82) : Math.round(away * .26);
    const outInCity = Math.max(0, away - atWorkOrSchool);
    const openBusinesses = (Object.entries(lot.businessMix) as Array<[BusinessSector, number]>)
      .reduce((total, [sector, count]) => total + openBusinessCount(count, sector, hour), 0);
    const seed = hashString(lot.id);
    const commuteStaffing = 1 - this.congestionLevel() * .22;
    const activeJobs = (Object.entries(lot.businessMix) as Array<[BusinessSector, number]>)
      .reduce((total, [sector, count]) => total + Math.round(count * sectorJobs(sector, seed) * sectorOperatingFactor(sector, hour)), 0);
    return { population, atHome, atWorkOrSchool, outInCity, openBusinesses, activeJobs: Math.round(activeJobs * commuteStaffing) };
  }

  serviceStaffing(kind: ServiceKind) {
    return this.effectiveStaffing() * serviceShiftFactor(kind, this.clock.minute / 60);
  }

  onDutyPublicJobs() {
    return Math.round(this.services.reduce((total, service) =>
      total + service.staffRequired * this.serviceStaffing(service.kind), 0
    ));
  }

  businessIsOpen(sector: BusinessSector) {
    return sectorOperatingFactor(sector, this.clock.minute / 60) > 0;
  }

  activeCommutes(): ActiveCommute[] {
    const minute = this.clock.minute;
    const travelMultiplier = 1 + this.congestionLevel() * 1.35;
    const active: ActiveCommute[] = [];
    for (const flow of this.commuteFlows) {
      const duration = flow.travelMinutes * travelMultiplier
        + this.cityEventRouteClosurePenalty(flow.route);
      const outbound = progressInWindow(minute, flow.departMinute, duration);
      if (outbound !== null) {
        active.push({ flow, direction: "outbound", progress: outbound });
        continue;
      }
      const returning = progressInWindow(minute, flow.returnMinute, duration);
      if (returning !== null) active.push({ flow, direction: "returning", progress: returning });
    }
    return active;
  }

  congestionLevel() {
    return clamp(
      this.commuteCongestionAt(this.clock.minute) + this.cityEventTrafficPressure(),
      0,
      1
    );
  }

  trafficMultiplier() {
    return 1 + this.congestionLevel() * 1.35;
  }

  estimatedCommuteMinutes(flow: CommuteFlow) {
    return Math.round(
      flow.travelMinutes * this.trafficMultiplier()
      + this.cityEventRouteClosurePenalty(flow.route)
    );
  }

  commuteForLot(lot: Lot) {
    return this.commuteFlows.find(flow => flow.originLotId === lot.id);
  }

  commuteForResident(resident: Home["residents"][number]) {
    const home = this.homes.find(item => item.residents.some(candidate => candidate.id === resident.id));
    if (!home || !resident.destinationLotId) return undefined;
    return this.commuteFlows.find(flow =>
      flow.originLotId === home.lotId && flow.destinationLotId === resident.destinationLotId
    );
  }

  residentDestinationName(resident: Home["residents"][number]) {
    const destination = this.lots.find(lot => lot.id === resident.destinationLotId);
    if (!destination) return resident.role === "home" ? "Home district" : "Unassigned workplace";
    if (destination.anchorBusiness) return destination.anchorBusiness.name;
    const road = this.roads.find(item => item.id === destination.roadId)?.name ?? "Unnamed road";
    return `${100 + hashString(destination.id) % 900} ${road}`;
  }

  residentStatus(resident: Home["residents"][number]) {
    const hour = this.clock.minute / 60;
    if (
      resident.currentAction?.directed
      && resident.currentAction.endsAt > this.clock.elapsedMinutes
    ) return "Home";
    const commute = this.commuteForResident(resident);
    if (commute && this.activeCommutes().some(active => active.flow.id === commute.id)) return "Commuting";
    if (resident.role === "student") return hour >= 8 && hour < 16 ? "At school" : hour >= 16 && hour < 18 ? "Out in city" : "Home";
    if (resident.role === "office") return hour >= 8 && hour < 18 ? "At work" : hour >= 18 && hour < 20 ? "Out in city" : "Home";
    if (resident.role === "service") return hour >= 6 && hour < 15 ? "At work" : hour >= 15 && hour < 17 ? "Out in city" : "Home";
    return hour >= 11 && hour < 14 ? "Out in city" : "Home";
  }

  activeResidentAction(resident: Resident) {
    const action = resident.currentAction;
    return action && action.endsAt > this.clock.elapsedMinutes ? action : undefined;
  }

  residentActionLabel(resident: Resident) {
    const action = this.activeResidentAction(resident);
    if (!action) return this.residentStatus(resident) === "Home" ? "Choosing next activity" : this.residentStatus(resident);
    if (action.kind === "socialize") {
      return {
        chat: "Having a friendly chat",
        support: "Sharing support",
        joke: "Telling a joke",
        confront: "Having a confrontation",
        apologize: "Making amends"
      }[action.conversationIntent ?? "chat"];
    }
    return {
      sleep: "Sleeping",
      eat: "Having a meal",
      relax: "Relaxing",
      "tend-plants": "Tending plants",
      idle: "Taking a breather"
    }[action.kind];
  }

  residentActionProgress(resident: Resident) {
    const action = this.activeResidentAction(resident);
    if (!action) return 0;
    return clamp(
      (this.clock.elapsedMinutes - action.startedAt) / Math.max(1, action.endsAt - action.startedAt),
      0,
      1
    );
  }

  residentActionTarget(home: Home, resident: Resident) {
    const action = this.activeResidentAction(resident);
    return action?.targetFurnitureId
      ? home.furniture.find(item => item.id === action.targetFurnitureId)
      : undefined;
  }

  relationshipBetween(home: Home, firstResidentId: string, secondResidentId: string) {
    const key = relationshipKey(firstResidentId, secondResidentId);
    return home.relationships.find(relationship =>
      relationshipKey(...relationship.residentIds) === key
    );
  }

  relationshipScore(home: Home, firstResidentId: string, secondResidentId: string) {
    return this.relationshipBetween(home, firstResidentId, secondResidentId)?.score
      ?? initialRelationshipScore(firstResidentId, secondResidentId);
  }

  relationshipLabel(score: number) {
    return score >= 80
      ? "Close"
      : score >= 60
        ? "Friends"
        : score >= 40
          ? "Familiar"
          : score >= 20
            ? "Strained"
            : "Conflict";
  }

  residentTraitLabel(trait: ResidentTrait) {
    return RESIDENT_TRAIT_DETAILS[trait].label;
  }

  residentPersonalitySummary(resident: Resident) {
    return resident.traits
      .map(trait => RESIDENT_TRAIT_DETAILS[trait].description)
      .join(" and ");
  }

  relationshipCompatibility(firstResident: Resident, secondResident: Resident) {
    return residentCompatibility(firstResident, secondResident);
  }

  compatibilityLabel(score: number) {
    return score >= 78
      ? "Natural match"
      : score >= 62
        ? "Good fit"
        : score >= 46
          ? "Mixed fit"
          : "Friction";
  }

  conversationIntentLabel(intent: ConversationIntent) {
    return {
      chat: "Friendly Chat",
      support: "Offer Support",
      joke: "Tell a Joke",
      confront: "Confront",
      apologize: "Apologize"
    }[intent];
  }

  conversationOutcomeLabel(change: number, intent?: ConversationIntent) {
    if (intent === "apologize") return change >= 6 ? "Reconciled" : "Amends";
    return change >= 8
      ? "Breakthrough"
      : change >= 4
        ? "Positive"
        : change > 0
          ? "Small gain"
          : change <= -9
            ? "Argument"
            : "Tense";
  }

  relationshipTensionLabel(tension: number) {
    return tension >= 70
      ? "Hostile"
      : tension >= 45
        ? "Conflict"
        : tension >= 20
          ? "Uneasy"
          : "Calm";
  }

  conversationRelationshipGain(
    firstResident: Resident,
    secondResident: Resident,
    directed: boolean
  ) {
    return this.conversationRelationshipChange(firstResident, secondResident, "chat", directed);
  }

  conversationRelationshipChange(
    firstResident: Resident,
    secondResident: Resident,
    intent: ConversationIntent,
    directed: boolean,
    tension = 0
  ) {
    const compatibility = this.relationshipCompatibility(firstResident, secondResident);
    if (!directed && intent !== "apologize") {
      return Math.round(clamp(3 + (compatibility - 50) / 12, 1, 8));
    }
    if (intent === "apologize") {
      const empathy = (firstResident.traits.includes("empathetic") ? 2 : 0)
        + (secondResident.traits.includes("empathetic") ? 1 : 0);
      const directionBonus = directed ? 2 : 0;
      return Math.round(clamp(
        3 + directionBonus + empathy + tension / 12 + (compatibility - 50) / 20,
        2,
        12
      ));
    }
    if (intent === "support") {
      const empathy = (firstResident.traits.includes("empathetic") ? 2 : 0)
        + (secondResident.traits.includes("empathetic") ? 1 : 0);
      return Math.round(clamp(7 + empathy + (compatibility - 50) / 15, 4, 12));
    }
    if (intent === "joke") {
      const humor = (firstResident.traits.includes("creative") ? 1 : 0)
        + (firstResident.traits.includes("outgoing") ? 1 : 0)
        + (secondResident.traits.includes("outgoing") ? 1 : 0);
      return Math.round(clamp(5 + humor + (compatibility - 50) / 16, 2, 11));
    }
    if (intent === "confront") {
      const empathy = (firstResident.traits.includes("empathetic") ? 2 : 0)
        + (secondResident.traits.includes("empathetic") ? 1 : 0);
      return Math.round(clamp(-9 + empathy + (compatibility - 50) / 18, -14, -3));
    }
    return Math.round(clamp(6 + (compatibility - 50) / 12, 4, 11));
  }

  strongestRelationship(home: Home, residentId: string) {
    return home.relationships
      .filter(relationship => relationship.residentIds.includes(residentId))
      .sort((a, b) => b.score - a.score)[0];
  }

  commandResidentFurnitureAction(homeId: string, residentId: string, furnitureId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (!home || !resident || !furniture) {
      return { ok: false, reason: "Resident or furniture is no longer available." };
    }
    if (this.residentStatus(resident) !== "Home") {
      return { ok: false, reason: `${resident.name} is currently ${this.residentStatus(resident).toLowerCase()}.` };
    }
    const interaction = {
      bed: { kind: "sleep" as const, duration: 90 },
      sofa: { kind: "relax" as const, duration: 75 },
      table: { kind: "eat" as const, duration: 45 },
      plant: { kind: "tend-plants" as const, duration: 45 }
    }[furniture.kind];
    this.checkpoint();
    resident.currentAction = {
      kind: interaction.kind,
      startedAt: this.clock.elapsedMinutes,
      endsAt: this.clock.elapsedMinutes + interaction.duration,
      targetFurnitureId: furniture.id,
      directed: true
    };
    return { ok: true, reason: `${resident.name} started ${this.residentActionLabel(resident).toLowerCase()}.` };
  }

  commandResidentConversation(
    homeId: string,
    residentId: string,
    partnerResidentId: string,
    intent: ConversationIntent = "chat"
  ) {
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    const partner = home?.residents.find(item => item.id === partnerResidentId);
    if (!home || !resident || !partner || resident.id === partner.id) {
      return { ok: false, reason: "Both residents must be available for a conversation." };
    }
    if (this.residentStatus(resident) !== "Home" || this.residentStatus(partner) !== "Home") {
      return { ok: false, reason: "Both residents need to be home before they can talk." };
    }
    this.checkpoint();
    const startedAt = this.clock.elapsedMinutes;
    const duration = {
      chat: 60,
      support: 55,
      joke: 40,
      confront: 35,
      apologize: 45
    }[intent];
    const endsAt = startedAt + duration;
    resident.currentAction = {
      kind: "socialize",
      startedAt,
      endsAt,
      partnerResidentId: partner.id,
      conversationIntent: intent,
      directed: true,
      relationshipCredit: true
    };
    partner.currentAction = {
      kind: "socialize",
      startedAt,
      endsAt,
      partnerResidentId: resident.id,
      conversationIntent: intent,
      directed: true
    };
    return {
      ok: true,
      reason: `${resident.name} chose ${this.conversationIntentLabel(intent).toLowerCase()} with ${partner.name}.`
    };
  }

  cancelResidentAction(homeId: string, residentId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    if (!resident?.currentAction) return false;
    this.checkpoint();
    const partnerResidentId = resident.currentAction.kind === "socialize"
      ? resident.currentAction.partnerResidentId
      : undefined;
    resident.currentAction = undefined;
    const partner = partnerResidentId
      ? home?.residents.find(item => item.id === partnerResidentId)
      : undefined;
    if (partner?.currentAction?.partnerResidentId === resident.id) partner.currentAction = undefined;
    return true;
  }

  setResidentHomePosition(homeId: string, residentId: string, position: Point2) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const resident = this.homes
      .find(item => item.id === homeId)
      ?.residents.find(item => item.id === residentId);
    if (!resident) return false;
    resident.homePosition = { x: position.x, z: position.z };
    return true;
  }

  setControlledResident(residentId?: string) {
    if (residentId && !this.homes.some(home => home.residents.some(resident => resident.id === residentId))) {
      return false;
    }
    this.controlledResidentId = residentId;
    return true;
  }

  homeQuality(home: Home) {
    const residentCount = Math.max(1, home.residents.length);
    const roomShare = Math.min(1, home.rooms.length / residentCount);
    const bedShare = Math.min(1, home.furniture.filter(item => item.kind === "bed").length / residentCount);
    const furnitureVariety = new Set(home.furniture.map(item => item.kind)).size / 4;
    const plants = Math.min(3, home.furniture.filter(item => item.kind === "plant").length);
    return Math.round(clamp(32 + roomShare * 24 + bedShare * 24 + furnitureVariety * 15 + plants * 2, 0, 100));
  }

  lotHasService(lot: Lot, kind: ServiceKind) {
    if (kind === "power" || kind === "water" || kind === "sewage" || kind === "waste") {
      const matchingLines = this.utilities.filter(utility => utility.kind === kind);
      const matchingSources = this.services.filter(service => service.kind === kind);
      if (!matchingSources.length) return false;
      if (!matchingLines.length) {
        return matchingSources.some(service =>
          Math.hypot(service.position.x - lot.center.x, service.position.z - lot.center.z) <= service.radius
        );
      }
      return matchingLines.some(line => {
        const connected = matchingSources.some(service =>
          line.points.some(point => Math.hypot(service.position.x - point.x, service.position.z - point.z) <= service.radius)
        );
        return connected && distanceToPolyline(lot.center, line.points) <= 64;
      });
    }
    return this.services.some(service =>
      service.kind === kind
      && Math.hypot(service.position.x - lot.center.x, service.position.z - lot.center.z) <= service.radius
    );
  }

  lotUtilityReliability(lot: Lot, totalPopulation?: number, effectiveStaffing?: number) {
    const utilities: UtilityKind[] = ["power", "water", "sewage", "waste"];
    return Math.round(average(utilities.map(kind =>
      this.lotServiceReliability(lot, kind, totalPopulation, effectiveStaffing)
    )));
  }

  lotNeighborhoodSupport(lot: Lot, totalPopulation?: number, effectiveStaffing?: number) {
    const localServices: ServiceKind[] = ["fire", "health", "school"];
    return Math.round(average(localServices.map(kind =>
      this.lotServiceReliability(lot, kind, totalPopulation, effectiveStaffing)
    )));
  }

  residentWellbeing(resident: Resident): ResidentWellbeing {
    const home = this.homes.find(item => item.residents.some(candidate => candidate.id === resident.id));
    const lot = home ? this.lots.find(item => item.id === home.lotId) : undefined;
    const homeQuality = home ? this.homeQuality(home) : 50;
    const totalPopulation = lot
      ? Math.max(1, this.lots.reduce((total, item) => total + this.lotPopulation(item), 0))
      : undefined;
    const effectiveStaffing = lot ? this.effectiveStaffing() : undefined;
    const utilityReliability = lot ? this.lotUtilityReliability(lot, totalPopulation, effectiveStaffing) : 50;
    const neighborhoodSupport = lot ? this.lotNeighborhoodSupport(lot, totalPopulation, effectiveStaffing) : 50;
    const commuteBurden = this.residentCommuteBurden(resident);
    const score = Math.round(clamp(
      resident.energy * .17
      + resident.social * .16
      + resident.comfort * .19
      + resident.health * .24
      + (100 - resident.stress) * .24,
      0,
      100
    ));
    const label = score >= 82 ? "Thriving" : score >= 64 ? "Stable" : score >= 44 ? "Strained" : "Critical";
    const pressureCandidates = [
      { value: 100 - utilityReliability, text: "Missing or unreliable utilities" },
      { value: commuteBurden, text: "Commute burden" },
      { value: 100 - homeQuality, text: "Crowded or under-furnished home" },
      { value: resident.stress, text: "High daily stress" },
      { value: 100 - resident.social, text: "Social isolation" },
      { value: 100 - neighborhoodSupport, text: "Limited neighborhood support" }
    ].sort((a, b) => b.value - a.value);
    return {
      score,
      label,
      homeQuality,
      utilityReliability,
      neighborhoodSupport,
      commuteBurden,
      pressure: pressureCandidates[0].value >= 34 ? pressureCandidates[0].text : "Needs are balanced"
    };
  }

  homeWellbeing(home: Home) {
    if (!home.residents.length) return this.homeQuality(home);
    return Math.round(average(home.residents.map(resident => this.residentWellbeing(resident).score)));
  }

  lotWellbeing(lot: Lot, totalPopulation?: number, effectiveStaffing?: number) {
    const home = this.homes.find(item => item.lotId === lot.id);
    if (home?.residents.length) return this.homeWellbeing(home);
    const utility = this.lotUtilityReliability(lot, totalPopulation, effectiveStaffing);
    const neighborhood = this.lotNeighborhoodSupport(lot, totalPopulation, effectiveStaffing);
    const commute = this.commuteForLot(lot);
    const commuteBurden = commute
      ? clamp((this.estimatedCommuteMinutes(commute) - 12) * 1.7 + this.congestionLevel() * 20, 0, 100)
      : 18;
    return Math.round(clamp(45 + utility * .23 + neighborhood * .18 - commuteBurden * .12, 0, 100));
  }

  cityWellbeing() {
    const occupied = this.lots.filter(lot => this.constructionProgress(lot) >= 1 && this.lotPopulation(lot) > 0);
    if (!occupied.length) return 0;
    const totalPopulation = Math.max(1, this.lots.reduce((total, lot) => total + this.lotPopulation(lot), 0));
    const effectiveStaffing = this.effectiveStaffing();
    const sample = occupied.length <= 160
      ? occupied
      : occupied.filter((_, index) => index % Math.ceil(occupied.length / 160) === 0);
    const weighted = sample.reduce((state, lot) => {
      const population = Math.max(1, this.lotPopulation(lot));
      state.score += this.lotWellbeing(lot, totalPopulation, effectiveStaffing) * population;
      state.population += population;
      return state;
    }, { score: 0, population: 0 });
    return Math.round(weighted.score / Math.max(1, weighted.population));
  }

  private commuteCongestionAt(minute: number) {
    const travelers = this.commuteFlows.reduce((total, flow) => {
      const morning = minute >= flow.departMinute && minute <= flow.departMinute + flow.travelMinutes * 2.35;
      const evening = minute >= flow.returnMinute && minute <= flow.returnMinute + flow.travelMinutes * 2.35;
      return total + (morning || evening ? flow.travelers : 0);
    }, 0);
    const networkCapacity = Math.max(280, this.roads.length * 16);
    return Math.min(1, travelers / networkCapacity);
  }

  addUtilityLine(kind: UtilityKind, points: Point2[]) {
    if (points.length < 2) return false;
    this.checkpoint();
    const capacity = { power: 42_000, water: 54_000, sewage: 48_000, waste: 32_000 }[kind];
    this.utilities.push({ id: crypto.randomUUID(), kind, points: clone(points), capacity, condition: 100 });
    return true;
  }

  advanceMinutes(minutes: number, monthlyBalance: number) {
    if (minutes <= 0) return false;
    let monthChanged = false;
    const previousElapsed = this.clock.elapsedMinutes;
    this.clock.minute += minutes;
    this.clock.elapsedMinutes += minutes;
    while (this.clock.minute >= 24 * 60) {
      this.clock.minute -= 24 * 60;
      this.clock.day += 1;
      this.simulateDailyEconomy();
      if (this.clock.day > 30) {
        this.clock.day = 1;
        this.clock.month += 1;
        this.clock.treasury += monthlyBalance;
        monthChanged = true;
        if (this.clock.month > 12) {
          this.clock.month = 1;
          this.clock.year += 1;
        }
      }
    }
    const firstBoundary = Math.floor(previousElapsed / 480) + 1;
    const lastBoundary = Math.floor(this.clock.elapsedMinutes / 480);
    for (let boundary = firstBoundary; boundary <= lastBoundary; boundary++) {
      this.createIncident(boundary * 480);
    }
    const firstUtilityBoundary = Math.floor(previousElapsed / 720) + 1;
    const lastUtilityBoundary = Math.floor(this.clock.elapsedMinutes / 720);
    for (let boundary = firstUtilityBoundary; boundary <= lastUtilityBoundary; boundary++) {
      this.createUtilityFailure(boundary * 720);
    }
    const firstParkingBoundary = Math.floor(previousElapsed / 60) + 1;
    const lastParkingBoundary = Math.floor(this.clock.elapsedMinutes / 60);
    for (let boundary = firstParkingBoundary; boundary <= lastParkingBoundary; boundary++) {
      this.updateParkingActivity(boundary * 60);
      this.updateCurbActivity(boundary * 60);
      this.updateTransitActivity(boundary * 60);
      this.updateCityEventActivity(boundary * 60);
    }
    this.incidents = this.incidents
      .filter(incident => incident.resolvedAt === undefined || this.clock.elapsedMinutes - incident.resolvedAt < 3 * 24 * 60)
      .slice(-24);
    this.completeUtilityRepairs();
    this.utilityFailures = this.utilityFailures
      .filter(failure => failure.resolvedAt === undefined || this.clock.elapsedMinutes - failure.resolvedAt < 5 * 24 * 60)
      .slice(-18);
    this.updateResidentActions();
    this.updateResidentNeeds(minutes);
    return monthChanged;
  }

  private updateParkingActivity(elapsedMinute: number) {
    const minuteOfDay = positiveModulo(8 * 60 + elapsedMinute, 24 * 60);
    for (const facility of this.parking) {
      const parkingAllowed = this.parkingPermitted(facility, minuteOfDay, elapsedMinute);
      if (parkingAllowed) {
        facility.revenue = Math.round((facility.revenue + facility.occupied * facility.hourlyRate) * 100) / 100;
      }
      const playerSpaces = this.playerVehicle?.parkingId === facility.id ? 1 : 0;
      const publicCapacity = Math.max(0, facility.capacity - playerSpaces);
      const currentPublic = Math.max(0, facility.occupied - playerSpaces);
      const variation = (hashString(`${facility.id}:${Math.floor(elapsedMinute / 60)}`) % 9 - 4) / 100;
      const target = parkingAllowed
        ? Math.round(publicCapacity * clamp(this.parkingDemand(facility, minuteOfDay) + variation, 0, 1))
        : 0;
      const nextPublic = Math.round(currentPublic * .55 + target * .45);
      facility.occupied = Math.round(clamp(nextPublic + playerSpaces, playerSpaces, facility.capacity));
    }
  }

  private updateCurbActivity(elapsedMinute: number) {
    const minuteOfDay = positiveModulo(8 * 60 + elapsedMinute, 24 * 60);
    for (const facility of this.parking.filter(item => item.kind === "curb")) {
      const use = this.curbEffectiveUse(facility, minuteOfDay, elapsedMinute);
      const playerSpaces = this.playerVehicle?.parkingId === facility.id ? 1 : 0;
      const waiting = Math.max(0, Math.round(facility.deliveriesWaiting ?? 0));
      const demand = this.curbLoadingDemand(facility, minuteOfDay);
      const variation = (hashString(`${facility.id}:curb:${Math.floor(elapsedMinute / 60)}`) % 21 - 10) / 100;
      const arrivals = Math.max(0, Math.round(demand * (1 + variation)));
      if (use === "loading") {
        const serviceCapacity = facility.capacity * 3;
        const queue = Math.min(80, waiting + arrivals);
        const served = Math.min(queue, serviceCapacity);
        facility.deliveriesWaiting = queue - served;
        facility.deliveriesServed = (facility.deliveriesServed ?? 0) + served;
        facility.curbRevenue = Math.round(((facility.curbRevenue ?? 0) + served * 6) * 100) / 100;
        facility.occupied = Math.min(facility.capacity, playerSpaces + Math.ceil(served / 3));
      } else if (use === "restricted" || use === "event") {
        const violationRate = use === "event" ? .28 : .18;
        const fine = use === "event" ? 185 : 115;
        const violations = Math.max(playerSpaces, Math.round(arrivals * violationRate));
        facility.violations = (facility.violations ?? 0) + violations;
        facility.curbRevenue = Math.round(((facility.curbRevenue ?? 0) + violations * fine) * 100) / 100;
        facility.deliveriesWaiting = Math.min(80, waiting + Math.round(arrivals * .65));
        facility.occupied = playerSpaces;
      } else {
        facility.deliveriesWaiting = Math.max(0, waiting - facility.capacity);
      }
    }
  }

  private updateTransitActivity(elapsedMinute: number) {
    const minuteOfDay = positiveModulo(8 * 60 + elapsedMinute, 24 * 60);
    for (const line of this.transitLines) {
      const hourlyThroughput = line.vehicleCapacity * (60 / Math.max(4, line.headwayMinutes)) * 2.2;
      const stopThroughput = Math.max(1, Math.floor(hourlyThroughput / Math.max(1, line.stops.length)));
      for (const stop of line.stops) {
        const variation = (hashString(`${line.id}:${stop.id}:${Math.floor(elapsedMinute / 60)}`) % 17 - 8) / 100;
        const arrivals = Math.max(
          0,
          Math.round(this.transitStopDemand(line, stop, minuteOfDay, elapsedMinute) * (1 + variation))
        );
        const queue = Math.min(line.vehicleCapacity * 12, stop.waiting + arrivals);
        const boarded = Math.min(queue, stopThroughput);
        stop.waiting = Math.max(0, queue - boarded);
        stop.boardings += boarded;
        line.ridership += boarded;
        line.fareRevenue = Math.round((line.fareRevenue + boarded * line.fare) * 100) / 100;
      }
    }
  }

  private updateCityEventActivity(elapsedMinute: number) {
    for (const event of this.activeCityEvents(elapsedMinute)) {
      const occurrence = this.cityEventOccurrence(event, elapsedMinute);
      if (event.lastProcessedOccurrence === occurrence) continue;
      const attendance = this.cityEventExpectedAttendance(event, occurrence);
      event.lastProcessedOccurrence = occurrence;
      event.occurrences += 1;
      event.totalAttendance += attendance;
      event.revenue = Math.round((event.revenue + attendance * event.cityFeePerAttendee) * 100) / 100;
    }
  }

  activeIncidents() {
    return this.incidents.filter(incident => incident.resolvedAt === undefined || incident.resolvedAt > this.clock.elapsedMinutes);
  }

  activeUtilityFailures(kind?: UtilityKind) {
    return this.utilityFailures.filter(failure =>
      (kind === undefined || failure.kind === kind)
      && (failure.resolvedAt === undefined || failure.resolvedAt > this.clock.elapsedMinutes)
    );
  }

  utilityFailureStatus(failure: UtilityFailure) {
    if (failure.resolvedAt !== undefined && failure.resolvedAt <= this.clock.elapsedMinutes) return "Service restored";
    if (failure.arrivalAt === undefined) return "Awaiting repair crew";
    if (this.clock.elapsedMinutes < failure.arrivalAt) {
      return `Crew en route · ${Math.max(1, Math.ceil(failure.arrivalAt - this.clock.elapsedMinutes))}m`;
    }
    return `Repair in progress · ${Math.max(1, Math.ceil((failure.resolvedAt ?? this.clock.elapsedMinutes) - this.clock.elapsedMinutes))}m`;
  }

  utilityFailuresForLot(lot: Lot) {
    return this.activeUtilityFailures().filter(failure => this.utilityFailureAffectsLot(failure, lot));
  }

  utilityFailureAffectedLots(failure: UtilityFailure) {
    return this.lots.filter(lot => this.utilityFailureAffectsLot(failure, lot)).length;
  }

  applyTemplate(id: WorldTemplate["id"]) {
    const template = WORLD_TEMPLATES[id];
    if (!template) return false;
    this.checkpoint();
    this.templateId = id;
    this.roads = clone(template.roads);
    this.areas = clone(template.areas);
    this.homes = [];
    this.services = [];
    this.utilities = [];
    this.clock = { year: 1, month: 1, day: 1, minute: 8 * 60, treasury: 25_000_000, elapsedMinutes: 0 };
    this.serviceFunding = .85;
    this.incidents = [];
    this.utilityFailures = [];
    this.commuteFlows = [];
    this.parking = initialParking(this.roads);
    this.playerVehicle = undefined;
    this.transitLines = initialTransitLines(this.roads);
    this.cityEvents = initialCityEvents(this.roads);
    this.lastDailyActivity = { households: 0, businesses: 0 };
    this.rebuildLots();
    this.rebuildAccessibilityEntrances();
    return true;
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.apply(previous);
    return true;
  }

  save() {
    localStorage.setItem("gridless-world-v1", JSON.stringify(this.snapshot()));
  }

  load() {
    const stored = localStorage.getItem("gridless-world-v1");
    if (!stored) return false;
    try {
      const parsed = JSON.parse(stored) as WorldSnapshot;
      if (parsed.version !== 1) return false;
      this.checkpoint();
      this.apply(parsed);
      this.controlledResidentId = undefined;
      return true;
    } catch {
      return false;
    }
  }

  ensureHome(lot: Lot) {
    let home = this.homes.find(item => item.lotId === lot.id);
    if (home) return home;
    this.checkpoint();
    home = {
      id: crypto.randomUUID(),
      lotId: lot.id,
      name: "New household",
      floors: 1,
      rooms: [{ id: crypto.randomUUID(), kind: "Living space", x: 0, z: 0, width: 7, depth: 6 }],
      furniture: [
        { id: crypto.randomUUID(), kind: "sofa", x: 0, z: 0, rotation: 0 },
        { id: crypto.randomUUID(), kind: "plant", x: 2.2, z: 1.8, rotation: 0 }
      ],
      designBudget: 60_000,
      designSpent: HOME_BUILD_COSTS.sofa + HOME_BUILD_COSTS.plant,
      residents: [],
      relationships: []
    };
    this.homes.push(home);
    lot.homeId = home.id;
    return home;
  }

  addRoom(homeId: string, room: Omit<Home["rooms"][number], "id">) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home || room.width < 2 || room.depth < 2) return false;
    const cost = Math.round(room.width * room.depth * HOME_BUILD_COSTS.roomPerSquareMeter);
    if (this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    home.rooms.push({ id: crypto.randomUUID(), ...clone(room) });
    home.designSpent += cost;
    return true;
  }

  addFurniture(homeId: string, kind: Home["furniture"][number]["kind"], x: number, z: number) {
    const home = this.homes.find(item => item.id === homeId);
    const size = {
      sofa: { width: 2.2, depth: .85 },
      table: { width: 1.6, depth: 1.6 },
      bed: { width: 1.7, depth: 2.1 },
      plant: { width: .65, depth: .65 }
    }[kind];
    const room = home?.rooms.find(item =>
      Math.abs(x - item.x) <= item.width / 2 - size.width / 2 - .1
      && Math.abs(z - item.z) <= item.depth / 2 - size.depth / 2 - .1
    );
    const cost = HOME_BUILD_COSTS[kind];
    if (!home || !room || this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    home.furniture.push({ id: crypto.randomUUID(), kind, x, z, rotation: 0 });
    home.designSpent += cost;
    return true;
  }

  homeRemainingBudget(home: Home) {
    return Math.max(0, home.designBudget - home.designSpent);
  }

  rotateFurniture(homeId: string, furnitureId: string, quarterTurns = 1) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (!home || !furniture) return false;
    this.checkpoint();
    furniture.rotation = positiveModulo(
      furniture.rotation + quarterTurns * Math.PI / 4,
      Math.PI * 2
    );
    return true;
  }

  removeFurniture(homeId: string, furnitureId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const index = home?.furniture.findIndex(item => item.id === furnitureId) ?? -1;
    if (!home || index < 0) return false;
    this.checkpoint();
    const [removed] = home.furniture.splice(index, 1);
    home.designSpent = Math.max(0, home.designSpent - Math.round(HOME_BUILD_COSTS[removed.kind] * .5));
    for (const resident of home.residents) {
      if (resident.currentAction?.targetFurnitureId === furnitureId) resident.currentAction = undefined;
    }
    return true;
  }

  addResident(homeId: string) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home) return false;
    this.checkpoint();
    const names = ["Avery", "Jordan", "Maya", "Theo", "Rowan", "Sofia", "Noah", "June"];
    const used = new Set(home.residents.map(resident => resident.name));
    const name = names.find(candidate => !used.has(candidate)) ?? `Resident ${home.residents.length + 1}`;
    const roles: ResidentRole[] = ["office", "service", "home"];
    const resident: Resident = {
      id: crypto.randomUUID(),
      name,
      age: "adult",
      role: roles[home.residents.length % roles.length],
      energy: 82,
      social: 68,
      comfort: 74,
      health: 84,
      stress: 24,
      traits: initialResidentTraits(`${home.id}-${name}-${home.residents.length}`),
      completedActions: 0
    };
    for (const existing of home.residents) {
      home.relationships.push({
        residentIds: orderedResidentIds(existing.id, resident.id),
        score: initialRelationshipScore(existing.id, resident.id),
        conversations: 0
      });
    }
    home.residents.push(resident);
    const lot = this.lots.find(item => item.id === home.lotId);
    if (lot && lot.households === 0) {
      lot.households = 1;
      lot.householdMix = createHouseholdMix(1, hashString(lot.id));
    }
    if (home.name === "New household") home.name = `${name}'s household`;
    this.rebuildCommutes();
    return true;
  }

  private apply(snapshot: WorldSnapshot) {
    this.templateId = snapshot.templateId ?? "nyc";
    this.spatialChunkSize = Math.round(clamp(snapshot.spatialChunkSize ?? 256, 128, 1024));
    this.roads = clone(snapshot.roads);
    this.areas = clone(snapshot.areas ?? NYC_TEMPLATE.areas);
    this.lots = clone(snapshot.lots).map(lot => {
      const zone = lot.zone ?? "unassigned";
      const seed = hashString(lot.id);
      const households = lot.households ?? initialHouseholds(zone, seed);
      const businesses = lot.businesses ?? initialBusinesses(zone, seed);
      return {
        ...lot,
        zone,
        households,
        businesses,
        householdMix: lot.householdMix ?? createHouseholdMix(households, seed),
        businessMix: lot.businessMix ?? createBusinessMix(businesses, zone, seed),
        anchorBusiness: businesses > 0 ? lot.anchorBusiness ?? createAnchorBusiness(lot.id, zone, businesses) : undefined
      };
    });
    this.homes = clone(snapshot.homes).map(home => {
      const residents = (home.residents ?? []).map((resident, index) => ({
        ...resident,
        role: resident.role ?? (resident.age === "child" ? "student" : index % 2 === 0 ? "office" : "service"),
        energy: clamp(resident.energy ?? 82, 0, 100),
        social: clamp(resident.social ?? 68, 0, 100),
        comfort: clamp(resident.comfort ?? 74, 0, 100),
        health: clamp(resident.health ?? 84, 0, 100),
        stress: clamp(resident.stress ?? 24, 0, 100),
        traits: normalizeResidentTraits(
          resident.traits,
          `${home.id}-${resident.id}-${resident.name}-${index}`
        ),
        currentAction: resident.currentAction
          ? {
              ...resident.currentAction,
              conversationIntent: resident.currentAction.kind === "socialize"
                ? normalizeConversationIntent(resident.currentAction.conversationIntent)
                : undefined
            }
          : undefined,
        completedActions: resident.completedActions ?? 0
      }));
      return {
        ...home,
        furniture: home.furniture ?? [],
        designBudget: Math.max(0, Math.round(home.designBudget ?? 60_000)),
        designSpent: Math.max(0, Math.round(
          home.designSpent
          ?? (home.furniture ?? []).reduce((total, item) => total + HOME_BUILD_COSTS[item.kind], 0)
        )),
        residents,
        relationships: normalizeRelationships(residents, home.relationships ?? [])
      };
    });
    this.services = clone(snapshot.services ?? []).map(service => ({
      ...service,
      capacity: service.capacity ?? legacyServiceCapacity(service.kind),
      staffRequired: service.staffRequired ?? legacyServiceStaff(service.kind)
    }));
    this.utilities = clone(snapshot.utilities ?? []);
    this.utilities = this.utilities.map(utility => ({
      ...utility,
      capacity: utility.capacity ?? { power: 42_000, water: 54_000, sewage: 48_000, waste: 32_000 }[utility.kind],
      condition: clamp(utility.condition ?? 100, 0, 100)
    }));
    this.clock = clone(snapshot.clock ?? { year: 1, month: 1, day: 1, minute: 8 * 60, treasury: 25_000_000, elapsedMinutes: 0 });
    this.clock.elapsedMinutes ??= 0;
    this.serviceFunding = snapshot.serviceFunding ?? .85;
    this.incidents = clone(snapshot.incidents ?? []);
    this.utilityFailures = clone(snapshot.utilityFailures ?? []);
    this.commuteFlows = clone(snapshot.commuteFlows ?? []);
    this.parking = clone(snapshot.parking ?? initialParking(this.roads)).map(facility => ({
      ...facility,
      hourlyRate: normalizeParkingRate(facility.hourlyRate ?? defaultParkingRate(facility.kind)),
      revenue: facility.revenue ?? 0,
      curbUse: facility.kind === "curb" ? facility.curbUse ?? "parking" : undefined,
      curbSchedule: facility.kind === "curb" ? facility.curbSchedule ?? "all-day" : undefined,
      deliveriesWaiting: facility.kind === "curb" ? Math.max(0, Math.round(facility.deliveriesWaiting ?? 0)) : undefined,
      deliveriesServed: facility.kind === "curb" ? Math.max(0, Math.round(facility.deliveriesServed ?? 0)) : undefined,
      violations: facility.kind === "curb" ? Math.max(0, Math.round(facility.violations ?? 0)) : undefined,
      curbRevenue: facility.kind === "curb" ? Math.max(0, facility.curbRevenue ?? 0) : undefined
    }));
    this.playerVehicle = snapshot.playerVehicle ? clone(snapshot.playerVehicle) : undefined;
    this.transitLines = clone(snapshot.transitLines ?? initialTransitLines(this.roads)).map(line => ({
      ...line,
      roadId: line.roadId
        ?? this.roads.find(road =>
          line.id === `transit-line-${road.id}`
          || line.id.startsWith(`transit-line-${road.id}-`)
        )?.id,
      headwayMinutes: Math.round(clamp(line.headwayMinutes ?? 10, 4, 30)),
      fare: Math.round(clamp(line.fare ?? 2.75, 0, 10) * 4) / 4,
      vehicleCapacity: Math.max(1, Math.round(line.vehicleCapacity ?? 48)),
      ridership: Math.max(0, Math.round(line.ridership ?? 0)),
      fareRevenue: Math.max(0, line.fareRevenue ?? 0),
      stops: line.stops.map(stop => ({
        ...stop,
        waiting: Math.max(0, Math.round(stop.waiting ?? 0)),
        boardings: Math.max(0, Math.round(stop.boardings ?? 0))
      }))
    }));
    this.cityEvents = clone(snapshot.cityEvents ?? initialCityEvents(this.roads)).map(event => {
      const kind = Object.prototype.hasOwnProperty.call(CITY_EVENT_DEFINITIONS, event.kind)
        ? event.kind
        : "market";
      const definition = CITY_EVENT_DEFINITIONS[kind];
      const road = this.roads
        .map(item => ({ item, distance: distanceToPolyline(event.position, item.points) }))
        .sort((first, second) => first.distance - second.distance)[0]?.item;
      const closureRoadIds = (event.closureRoadIds ?? [])
        .filter(roadId => this.roads.some(item => item.id === roadId));
      return {
        ...event,
        kind,
        durationMinutes: Math.max(60, Math.round(event.durationMinutes ?? definition.durationMinutes)),
        intervalMinutes: Math.max(24 * 60, Math.round(event.intervalMinutes ?? 30 * 24 * 60)),
        capacity: Math.max(1, Math.round(event.capacity ?? definition.capacity)),
        cityFeePerAttendee: Math.max(0, event.cityFeePerAttendee ?? definition.cityFeePerAttendee),
        monthlyCost: Math.max(0, event.monthlyCost ?? definition.monthlyCost),
        occurrences: Math.max(0, Math.round(event.occurrences ?? 0)),
        totalAttendance: Math.max(0, Math.round(event.totalAttendance ?? 0)),
        revenue: Math.max(0, event.revenue ?? 0),
        roadId: event.roadId && this.roads.some(item => item.id === event.roadId)
          ? event.roadId
          : road?.id,
        closureRoadIds: closureRoadIds.length
          ? closureRoadIds.slice(0, 3)
          : this.cityEventClosureRoadIds(event.position, kind),
        temporaryTransitLineId: event.temporaryTransitLineId
          && this.transitLines.some(line => line.id === event.temporaryTransitLineId)
          ? event.temporaryTransitLineId
          : this.nearestEventTransitLineId(event.position),
        temporaryTransitHeadwayMinutes: Math.round(clamp(
          event.temporaryTransitHeadwayMinutes ?? (kind === "sports" || kind === "parade" ? 4 : 6),
          4,
          15
        )),
        lastProcessedOccurrence: event.lastProcessedOccurrence === undefined
          ? undefined
          : Math.max(0, Math.round(event.lastProcessedOccurrence))
      };
    });
    this.accessibilityEntrances = clone(snapshot.accessibilityEntrances ?? []);
    for (const incident of this.incidents) {
      if (incident.route?.length || !incident.responderServiceId) continue;
      const responder = this.services.find(service => service.id === incident.responderServiceId);
      const lot = this.lots.find(item => item.id === incident.lotId);
      if (responder && lot) incident.route = findRoadRoute(this.roads, responder.position, lot.center);
    }
    for (const failure of this.utilityFailures) {
      if (failure.route?.length || !failure.crewServiceId) continue;
      const crew = this.services.find(service => service.id === failure.crewServiceId);
      if (crew) failure.route = findRoadRoute(this.roads, crew.position, failure.position);
    }
    this.completeUtilityRepairs();
    this.lastDailyActivity = { households: 0, businesses: 0 };
    this.rebuildCommutes();
    this.rebuildAccessibilityEntrances();
    this.refreshSpatialChunks();
  }

  private rebuildLots() {
    const existingHomes = new Map(this.lots.filter(l => l.homeId).map(l => [l.id, l.homeId]));
    const existingZones = new Map(this.lots.map(l => [l.id, l.zone]));
    const existingConstruction = new Map(this.lots.map(l => [l.id, {
      startedAt: l.constructionStartedAt,
      duration: l.constructionDuration
    }]));
    const existingActivity = new Map(this.lots.map(l => [l.id, {
      households: l.households,
      businesses: l.businesses,
      householdMix: l.householdMix,
      businessMix: l.businessMix,
      anchorBusiness: l.anchorBusiness
    }]));
    const lots: Lot[] = [];
    for (const road of this.roads) {
      const curve = new THREE.CatmullRomCurve3(road.points.map(p => new THREE.Vector3(p.x, 0, p.z)), false, "centripetal");
      const length = curve.getLength();
      const count = Math.max(1, Math.floor(length / 28));
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const center = curve.getPoint(t);
        const tangent = curve.getTangent(t).normalize();
        const rotation = Math.atan2(tangent.x, tangent.z);
        for (const side of [-1, 1]) {
          const offset = road.width / 2 + 10;
          const x = center.x + tangent.z * side * offset;
          const z = center.z - tangent.x * side * offset;
          if (this.areas.some(area => area.kind === "park" && pointInPolygon({ x, z }, area.points))) continue;
          if (lots.some(lot => Math.hypot(lot.center.x - x, lot.center.z - z) < 16)) continue;
          const id = `${road.id}-${i}-${side}`;
          const zone = existingZones.get(id) ?? (road.id.startsWith("nyc-") ? inferTemplateZone(this.templateId, x, z) : "unassigned");
          const seed = hashString(id);
          const households = existingActivity.get(id)?.households ?? initialHouseholds(zone, seed);
          const businesses = existingActivity.get(id)?.businesses ?? initialBusinesses(zone, seed);
          lots.push({
            id,
            roadId: road.id,
            center: { x, z },
            rotation,
            width: 16,
            depth: 18,
            zone,
            constructionStartedAt: existingConstruction.get(id)?.startedAt,
            constructionDuration: existingConstruction.get(id)?.duration,
            households,
            businesses,
            householdMix: existingActivity.get(id)?.householdMix ?? createHouseholdMix(households, seed),
            businessMix: existingActivity.get(id)?.businessMix ?? createBusinessMix(businesses, zone, seed),
            anchorBusiness: existingActivity.get(id)?.anchorBusiness ?? createAnchorBusiness(id, zone, businesses),
            homeId: existingHomes.get(id)
          });
        }
      }
    }
    this.lots = lots;
    this.rebuildCommutes();
    this.refreshSpatialChunks();
  }

  private rebuildCommutes() {
    const existing = new Map(this.commuteFlows.map(flow => [flow.originLotId, flow]));
    const destinations = this.lots
      .filter(lot => this.constructionProgress(lot) >= 1 && lot.businesses > 0 && this.lotJobs(lot) > 0)
      .sort((a, b) => hashString(a.id) - hashString(b.id));
    if (!destinations.length || !this.roads.length) {
      this.commuteFlows = [];
      return;
    }
    const origins = this.lots
      .filter(lot =>
        this.constructionProgress(lot) >= 1
        && lot.households > 0
        && (lot.zone === "residential" || lot.zone === "mixed")
      )
      .sort((a, b) => Number(Boolean(b.homeId)) - Number(Boolean(a.homeId)) || hashString(a.id) - hashString(b.id))
      .slice(0, 72);
    this.commuteFlows = origins.map(origin => {
      const seed = hashString(origin.id);
      let destination = destinations[seed % destinations.length];
      if (destination.id === origin.id && destinations.length > 1) {
        destination = destinations[(seed + 1) % destinations.length];
      }
      const previous = existing.get(origin.id);
      const route = previous?.destinationLotId === destination.id && previous.route.length > 1
        ? previous.route
        : findRoadRoute(this.roads, origin.center, destination.center);
      const distance = routeLength(route);
      const mode: CommuteMode = distance < 145 ? "walk" : "car";
      return {
        id: previous?.id ?? `commute-${origin.id}`,
        originLotId: origin.id,
        destinationLotId: destination.id,
        travelers: Math.min(28, Math.max(2, Math.round(origin.households * (.18 + seed % 11 / 100)))),
        mode,
        route,
        distance,
        travelMinutes: Math.max(7, Math.round(7 + distance * (mode === "walk" ? .11 : .052))),
        departMinute: 420 + seed % 96,
        returnMinute: 1005 + Math.floor(seed / 11) % 106
      };
    });
    const destinationIds = new Set(destinations.map(lot => lot.id));
    for (const home of this.homes) {
      const flow = this.commuteFlows.find(item => item.originLotId === home.lotId);
      for (const resident of home.residents) {
        if (resident.role === "home") {
          resident.destinationLotId = undefined;
          continue;
        }
        if (!resident.destinationLotId || !destinationIds.has(resident.destinationLotId)) {
          resident.destinationLotId = flow?.destinationLotId;
        }
      }
    }
  }

  private rebuildAccessibilityEntrances() {
    const existing = new Map(this.accessibilityEntrances.map(entrance => [entrance.id, entrance]));
    const entrances: AccessibilityEntrance[] = [];
    for (const lot of this.lots) {
      if (lot.zone === "unassigned") continue;
      const id = `access-lot-${lot.id}`;
      const previous = existing.get(id);
      const seed = hashString(id);
      const stepFree = seed % 4 !== 0;
      entrances.push({
        id,
        targetKind: "lot",
        targetId: lot.id,
        position: buildingEntrancePosition(lot, this.roads),
        stepFree: previous?.stepFree ?? stepFree,
        doorWidth: previous?.doorWidth ?? (stepFree ? 1.05 + seed % 3 * .15 : .72),
        tactileGuidance: previous?.tactileGuidance ?? seed % 3 !== 0,
        automaticDoor: previous?.automaticDoor ?? seed % 2 === 0
      });
    }
    for (const park of this.areas.filter(area => area.kind === "park")) {
      const id = `access-park-${park.id}`;
      const previous = existing.get(id);
      entrances.push({
        id,
        targetKind: "park",
        targetId: park.id,
        position: parkEntrancePosition(park, this.roads),
        stepFree: previous?.stepFree ?? true,
        doorWidth: previous?.doorWidth ?? 2.4,
        tactileGuidance: previous?.tactileGuidance ?? false,
        automaticDoor: true
      });
    }
    for (const stop of this.transitLines.flatMap(line => line.stops)) {
      const id = `access-transit-${stop.id}`;
      const previous = existing.get(id);
      const seed = hashString(id);
      const stepFree = seed % 5 !== 0;
      entrances.push({
        id,
        targetKind: "transit",
        targetId: stop.id,
        position: clone(stop.position),
        stepFree: previous?.stepFree ?? stepFree,
        doorWidth: previous?.doorWidth ?? (stepFree ? 1.8 : .75),
        tactileGuidance: previous?.tactileGuidance ?? seed % 3 !== 0,
        automaticDoor: true
      });
    }
    this.accessibilityEntrances = entrances;
  }

  private simulateDailyEconomy() {
    const activity = { households: 0, businesses: 0 };
    this.degradeUtilityInfrastructure();
    const effectiveStaffing = this.effectiveStaffing();
    const cityAttractiveness = Math.max(.18, Math.min(1, .24 + this.services.length * .032 + effectiveStaffing * .38 - this.activeIncidents().length * .025));
    const totalPopulation = Math.max(1, this.lots.reduce((total, lot) => total + this.lotPopulation(lot), 0));
    for (const lot of this.lots) {
      if (this.constructionProgress(lot) < 1) continue;
      const seed = hashString(lot.id);
      const localWellbeing = this.lotWellbeing(lot, totalPopulation, effectiveStaffing) / 100;
      const attractiveness = clamp(cityAttractiveness * .72 + localWellbeing * .28, .15, 1);
      const householdTarget = targetHouseholds(lot.zone, seed);
      if (lot.households < householdTarget) {
        const moves = Math.min(householdTarget - lot.households, Math.max(1, Math.floor(1 + attractiveness * 3)));
        lot.households += moves;
        activity.households += moves;
      } else if (lot.households > householdTarget) {
        const moves = Math.min(lot.households - householdTarget, 3);
        lot.households -= moves;
        activity.households -= moves;
      }

      const businessTarget = targetBusinesses(lot.zone, seed);
      if (lot.businesses < businessTarget && attractiveness > .38) {
        lot.businesses += 1;
        activity.businesses += 1;
      } else if (lot.businesses > businessTarget) {
        lot.businesses -= 1;
        activity.businesses -= 1;
      } else if (effectiveStaffing < .58 && lot.businesses > 0 && hashString(`${lot.id}-${this.clock.day}-${this.clock.month}`) % 29 === 0) {
        lot.businesses -= 1;
        activity.businesses -= 1;
      }
      lot.householdMix = createHouseholdMix(lot.households, seed);
      lot.businessMix = createBusinessMix(lot.businesses, lot.zone, seed);
      lot.anchorBusiness = lot.businesses > 0
        ? lot.anchorBusiness && lot.businessMix[lot.anchorBusiness.sector] > 0
          ? lot.anchorBusiness
          : createAnchorBusiness(lot.id, lot.zone, lot.businesses)
        : undefined;
    }
    this.lastDailyActivity = activity;
    this.rebuildCommutes();
  }

  private residentCommuteBurden(resident: Resident) {
    if (resident.role === "home") return 0;
    const flow = this.commuteForResident(resident);
    if (!flow) return 26;
    return Math.round(clamp(
      (this.estimatedCommuteMinutes(flow) - 12) * 1.7
      + this.congestionLevel() * 20
      + (flow.mode === "car" ? 5 : 0),
      0,
      100
    ));
  }

  private lotServiceReliability(
    lot: Lot,
    kind: ServiceKind,
    totalPopulation?: number,
    effectiveStaffing?: number
  ) {
    if (!this.lotHasService(lot, kind)) return 0;
    const sources = this.services.filter(service => service.kind === kind);
    const staffing = (effectiveStaffing ?? this.effectiveStaffing())
      * serviceShiftFactor(kind, this.clock.minute / 60);
    const population = totalPopulation
      ?? Math.max(1, this.lots.reduce((total, item) => total + this.lotPopulation(item), 0));
    const demand = kind === "school" ? population * .2 : population;
    const sourceCapacity = sources.reduce((total, service) => total + service.capacity * staffing, 0);
    let capacityFactor = clamp(sourceCapacity / Math.max(1, demand), 0, 1);
    let outageSeverity = 0;
    if (kind === "power" || kind === "water" || kind === "sewage" || kind === "waste") {
      const matchingLines = this.utilities.filter(utility => utility.kind === kind);
      if (matchingLines.length) {
        const lineCapacity = matchingLines.reduce((total, utility) => total + utility.capacity, 0);
        capacityFactor = Math.min(capacityFactor, clamp(lineCapacity / population, 0, 1));
        const localLines = matchingLines.filter(line => distanceToPolyline(lot.center, line.points) <= 64);
        if (localLines.length) {
          const conditionFactor = average(localLines.map(line => .45 + line.condition / 100 * .55));
          capacityFactor *= conditionFactor;
        }
      }
      outageSeverity = this.utilityFailuresForLot(lot)
        .filter(failure => failure.kind === kind)
        .reduce((highest, failure) => Math.max(highest, failure.severity), 0);
    }
    return Math.round(clamp((38 + capacityFactor * 62) * (1 - outageSeverity * .88), 0, 100));
  }

  private degradeUtilityInfrastructure() {
    const population = Math.max(1, this.lots.reduce((total, lot) => total + this.lotPopulation(lot), 0));
    for (const line of this.utilities) {
      const kindCapacity = this.utilities
        .filter(candidate => candidate.kind === line.kind)
        .reduce((total, candidate) => total + candidate.capacity, 0);
      const utilization = clamp(population / Math.max(1, kindCapacity), 0, 1.5);
      line.condition = clamp(line.condition - (.012 + utilization * .028), 20, 100);
    }
  }

  private utilityFailureAffectsLot(failure: UtilityFailure, lot: Lot) {
    if (!this.lotHasService(lot, failure.kind)) return false;
    if (failure.targetType === "line") {
      const line = this.utilities.find(item => item.id === failure.targetId);
      return Boolean(line && distanceToPolyline(lot.center, line.points) <= 64);
    }
    const facility = this.services.find(service => service.id === failure.targetId);
    if (!facility) return false;
    if (Math.hypot(facility.position.x - lot.center.x, facility.position.z - lot.center.z) <= facility.radius) return true;
    return this.utilities
      .filter(line => line.kind === failure.kind)
      .some(line => {
        const suppliedByFacility = line.points.some(point =>
          Math.hypot(facility.position.x - point.x, facility.position.z - point.z) <= facility.radius
        );
        return suppliedByFacility && distanceToPolyline(lot.center, line.points) <= 64;
      });
  }

  private createUtilityFailure(startedAt: number) {
    if (this.activeUtilityFailures().length >= 2) return;
    const utilityKinds: UtilityKind[] = ["power", "water", "sewage", "waste"];
    const lineTargets = this.utilities
      .filter(line => line.points.length > 1 && this.services.some(service => service.kind === line.kind))
      .map(line => ({ targetType: "line" as const, targetId: line.id, kind: line.kind }));
    const facilityTargets = this.services
      .filter(service => utilityKinds.includes(service.kind as UtilityKind))
      .map(service => ({ targetType: "facility" as const, targetId: service.id, kind: service.kind as UtilityKind }));
    const candidates = [...lineTargets, ...facilityTargets];
    if (!candidates.length) return;
    const seed = hashString(`utility-failure-${Math.floor(startedAt / 720)}`);
    let candidate = candidates[seed % candidates.length];
    for (let offset = 0; offset < candidates.length; offset++) {
      const next = candidates[(seed + offset) % candidates.length];
      const alreadyFailed = this.activeUtilityFailures().some(failure =>
        failure.targetType === next.targetType && failure.targetId === next.targetId
      );
      if (!alreadyFailed) {
        candidate = next;
        break;
      }
      if (offset === candidates.length - 1) return;
    }
    const position = candidate.targetType === "line"
      ? (() => {
        const line = this.utilities.find(item => item.id === candidate.targetId)!;
        return clone(line.points[1 + seed % Math.max(1, line.points.length - 1)]);
      })()
      : clone(this.services.find(service => service.id === candidate.targetId)!.position);
    const severity = .42 + seed % 37 / 100;
    const failure: UtilityFailure = {
      id: `utility-failure-${startedAt}-${candidate.targetId}`,
      kind: candidate.kind,
      targetType: candidate.targetType,
      targetId: candidate.targetId,
      position,
      startedAt,
      severity
    };
    if (candidate.targetType === "line") {
      const line = this.utilities.find(item => item.id === candidate.targetId);
      if (line) line.condition = clamp(line.condition - severity * 58, 18, 100);
    }
    this.utilityFailures.push(failure);
    this.assignUtilityCrew(failure, startedAt);
  }

  private dispatchWaitingUtilityFailures(kind: UtilityKind) {
    this.utilityFailures
      .filter(failure =>
        failure.kind === kind
        && failure.crewServiceId === undefined
        && (failure.resolvedAt === undefined || failure.resolvedAt > this.clock.elapsedMinutes)
      )
      .forEach(failure => this.assignUtilityCrew(failure, this.clock.elapsedMinutes));
  }

  private assignUtilityCrew(failure: UtilityFailure, dispatchedAt: number) {
    const crews = this.services.filter(service => service.kind === failure.kind);
    if (!crews.length) return;
    const dispatch = crews
      .map(crew => {
        const route = findRoadRoute(this.roads, crew.position, failure.position);
        return { crew, route, distance: routeLength(route) };
      })
      .reduce((nearest, candidate) => candidate.distance < nearest.distance ? candidate : nearest);
    const staffing = this.serviceStaffing(failure.kind);
    const travelMinutes = Math.round((10 + dispatch.distance * .24) * this.trafficMultiplier());
    const repairBase = { power: 180, water: 240, sewage: 300, waste: 150 }[failure.kind];
    const repairMinutes = Math.round(repairBase * (.72 + failure.severity) / (.45 + staffing * .55));
    failure.crewServiceId = dispatch.crew.id;
    failure.dispatchedAt = dispatchedAt;
    failure.arrivalAt = dispatchedAt + travelMinutes;
    failure.resolvedAt = failure.arrivalAt + repairMinutes;
    failure.route = dispatch.route;
  }

  private completeUtilityRepairs() {
    for (const failure of this.utilityFailures) {
      if (
        failure.recoveryApplied
        || failure.resolvedAt === undefined
        || failure.resolvedAt > this.clock.elapsedMinutes
      ) continue;
      if (failure.targetType === "line") {
        const line = this.utilities.find(item => item.id === failure.targetId);
        if (line) line.condition = Math.max(line.condition, 92 - failure.severity * 8);
      }
      failure.recoveryApplied = true;
    }
  }

  private updateResidentActions() {
    const now = this.clock.elapsedMinutes;
    for (const home of this.homes) {
      for (const resident of home.residents) {
        const current = resident.currentAction;
        if (current && current.endsAt <= now) {
          this.completeResidentAction(home, resident, current);
        }
        if (this.residentStatus(resident) !== "Home") {
          resident.currentAction = undefined;
        }
      }
      for (const resident of home.residents) {
        if (this.activeResidentAction(resident)) continue;
        if (this.residentStatus(resident) !== "Home") continue;
        if (resident.id === this.controlledResidentId) continue;
        const chosenAction = this.chooseResidentAction(home, resident);
        resident.currentAction = chosenAction;
        if (chosenAction.kind === "socialize" && chosenAction.partnerResidentId) {
          const partner = home.residents.find(item => item.id === chosenAction.partnerResidentId);
          if (partner && !partner.currentAction && partner.id !== this.controlledResidentId) {
            partner.currentAction = {
              kind: "socialize",
              startedAt: chosenAction.startedAt,
              endsAt: chosenAction.endsAt,
              targetFurnitureId: chosenAction.targetFurnitureId,
              partnerResidentId: resident.id,
              conversationIntent: chosenAction.conversationIntent
            };
          }
        }
      }
    }
  }

  private chooseResidentAction(home: Home, resident: Resident): ResidentAction {
    const now = this.clock.elapsedMinutes;
    const hour = this.clock.minute / 60;
    const sleepingHours = hour < 7 || hour >= 22;
    const availablePartnerMatch = home.residents
      .filter(candidate =>
        candidate.id !== resident.id
        && candidate.id !== this.controlledResidentId
        && this.residentStatus(candidate) === "Home"
        && !candidate.currentAction
      )
      .map(candidate => {
        const relationship = this.relationshipBetween(home, resident.id, candidate.id);
        const tension = relationship?.tension ?? 0;
        return {
          resident: candidate,
          relationship,
          tension,
          score:
            this.relationshipScore(home, resident.id, candidate.id) * .55
            + this.relationshipCompatibility(resident, candidate) * .45
            + (100 - candidate.social) * .12
            + tension * (resident.traits.includes("empathetic") ? .42 : .1)
            + hashString(`${resident.id}-${candidate.id}-${Math.floor(now / 60)}`) % 8
        };
      })
      .sort((first, second) => second.score - first.score)[0];
    const availablePartner = availablePartnerMatch?.resident;
    const autonomousConversationIntent: ConversationIntent =
      availablePartnerMatch
      && availablePartnerMatch.tension >= 25
      && (resident.traits.includes("empathetic") || availablePartnerMatch.tension >= 45)
        ? "apologize"
        : "chat";
    const furniture = {
      bed: home.furniture.find(item => item.kind === "bed"),
      sofa: home.furniture.find(item => item.kind === "sofa"),
      table: home.furniture.find(item => item.kind === "table"),
      plant: home.furniture.find(item => item.kind === "plant")
    };
    const candidates: Array<{
      kind: ResidentActionKind;
      score: number;
      targetFurnitureId?: string;
      partnerResidentId?: string;
    }> = [
      {
        kind: "sleep",
        score: (100 - resident.energy) * 1.25 + (sleepingHours ? 42 : 0) + (furniture.bed ? 16 : furniture.sofa ? 2 : -18),
        targetFurnitureId: furniture.bed?.id ?? furniture.sofa?.id
      },
      {
        kind: "eat",
        score: (resident.energy < 64 ? 30 : 12)
          + ([7, 8, 12, 13, 18, 19].includes(Math.floor(hour)) ? 28 : 0)
          + (furniture.table ? 12 : -8),
        targetFurnitureId: furniture.table?.id ?? furniture.sofa?.id
      },
      {
        kind: "relax",
        score: (100 - resident.comfort) * .92 + resident.stress * .62 + (furniture.sofa ? 15 : 0),
        targetFurnitureId: furniture.sofa?.id ?? furniture.bed?.id
      },
      {
        kind: "socialize",
        score: (100 - resident.social) * 1.08
          + (availablePartner ? 24 : -32)
          + (furniture.table || furniture.sofa ? 10 : 0)
          + (autonomousConversationIntent === "apologize" ? availablePartnerMatch?.tension ?? 0 : 0) * .45,
        targetFurnitureId: furniture.table?.id ?? furniture.sofa?.id,
        partnerResidentId: availablePartner?.id
      },
      {
        kind: "tend-plants",
        score: (100 - resident.health) * .52 + resident.stress * .48 + (furniture.plant ? 24 : -48),
        targetFurnitureId: furniture.plant?.id
      },
      { kind: "idle", score: 18 }
    ];
    for (const candidate of candidates) {
      candidate.score += hashString(`${resident.id}-${candidate.kind}-${Math.floor(now / 60)}`) % 9;
      candidate.score += residentActionTraitBonus(resident, candidate.kind);
      if (
        resident.lastActionKind === candidate.kind
        && resident.lastActionAt !== undefined
        && now - resident.lastActionAt < 180
      ) {
        candidate.score -= 36;
      }
    }
    const choice = candidates.sort((a, b) => b.score - a.score)[0];
    const duration = choice.kind === "sleep"
      ? sleepingHours ? 360 : 90
      : choice.kind === "eat" ? 45
        : choice.kind === "relax" ? 75
          : choice.kind === "socialize" ? autonomousConversationIntent === "apologize" ? 45 : 60
            : choice.kind === "tend-plants" ? 45 : 30;
    return {
      kind: choice.kind,
      startedAt: now,
      endsAt: now + duration,
      targetFurnitureId: choice.targetFurnitureId,
      partnerResidentId: choice.partnerResidentId,
      conversationIntent: choice.kind === "socialize" ? autonomousConversationIntent : undefined,
      relationshipCredit: choice.kind === "socialize" && Boolean(choice.partnerResidentId)
    };
  }

  private completeResidentAction(home: Home, resident: Resident, action: ResidentAction) {
    if (action.kind === "sleep") {
      resident.energy = clamp(resident.energy + 18, 0, 100);
      resident.health = clamp(resident.health + 3, 0, 100);
      resident.stress = clamp(resident.stress - 5, 0, 100);
    } else if (action.kind === "eat") {
      resident.energy = clamp(resident.energy + 8, 0, 100);
      resident.comfort = clamp(resident.comfort + 4, 0, 100);
      resident.health = clamp(resident.health + 2, 0, 100);
    } else if (action.kind === "relax") {
      resident.comfort = clamp(resident.comfort + 14, 0, 100);
      resident.stress = clamp(resident.stress - 12, 0, 100);
    } else if (action.kind === "socialize") {
      const intent = action.conversationIntent ?? "chat";
      const effects = {
        chat: { social: 20, stress: -6 },
        support: { social: 12, stress: action.relationshipCredit ? -8 : -16 },
        joke: { social: 16, stress: -10 },
        confront: { social: -6, stress: action.relationshipCredit ? 9 : 14 },
        apologize: { social: 8, stress: action.relationshipCredit ? -12 : -18 }
      }[intent];
      resident.social = clamp(resident.social + effects.social, 0, 100);
      resident.stress = clamp(resident.stress + effects.stress, 0, 100);
      if (action.relationshipCredit && action.partnerResidentId) {
        const relationship = this.relationshipBetween(home, resident.id, action.partnerResidentId);
        const partner = home.residents.find(item => item.id === action.partnerResidentId);
        if (relationship && partner) {
          const previousTension = relationship.tension ?? 0;
          const relationshipChange = this.conversationRelationshipChange(
            resident,
            partner,
            intent,
            Boolean(action.directed),
            previousTension
          );
          const tensionChange = {
            chat: -6,
            support: -12,
            joke: -8,
            confront: 30,
            apologize: -40
          }[intent];
          relationship.score = clamp(
            relationship.score + relationshipChange,
            0,
            100
          );
          relationship.tension = clamp(previousTension + tensionChange, 0, 100);
          relationship.conversations += 1;
          relationship.lastInteractionAt = action.endsAt;
          relationship.lastIntent = intent;
          relationship.lastChange = relationshipChange;
          if (intent === "confront") {
            relationship.conflicts = (relationship.conflicts ?? 0) + 1;
            relationship.lastConflictAt = action.endsAt;
          }
          if (
            intent === "apologize"
            && previousTension >= 20
            && relationship.tension < 20
          ) {
            relationship.resolvedConflicts = (relationship.resolvedConflicts ?? 0) + 1;
            relationship.lastReconciledAt = action.endsAt;
          }
          relationship.memories = [{
            intent,
            relationshipChange,
            tensionChange: relationship.tension - previousTension,
            occurredAt: action.endsAt,
            initiatorResidentId: resident.id
          }, ...(relationship.memories ?? [])].slice(0, 8);
        }
      }
    } else if (action.kind === "tend-plants") {
      resident.health = clamp(resident.health + 6, 0, 100);
      resident.comfort = clamp(resident.comfort + 5, 0, 100);
      resident.stress = clamp(resident.stress - 8, 0, 100);
    } else {
      resident.stress = clamp(resident.stress - 2, 0, 100);
    }
    resident.lastActionKind = action.kind;
    resident.lastActionAt = action.endsAt;
    resident.completedActions = (resident.completedActions ?? 0) + 1;
    resident.currentAction = undefined;
  }

  private updateResidentNeeds(minutes: number) {
    if (!this.homes.some(home => home.residents.length)) return;
    const hours = Math.max(0, minutes / 60);
    if (!hours) return;
    const hour = this.clock.minute / 60;
    const totalPopulation = Math.max(1, this.lots.reduce((total, lot) => total + this.lotPopulation(lot), 0));
    const effectiveStaffing = this.effectiveStaffing();
    for (const home of this.homes) {
      const lot = this.lots.find(item => item.id === home.lotId);
      if (!lot) continue;
      const homeQuality = this.homeQuality(home);
      const utility = this.lotUtilityReliability(lot, totalPopulation, effectiveStaffing);
      const neighborhood = this.lotNeighborhoodSupport(lot, totalPopulation, effectiveStaffing);
      const hasBed = home.furniture.some(item => item.kind === "bed");
      const hasSocialFurniture = home.furniture.some(item => item.kind === "sofa" || item.kind === "table");
      const incidentPressure = this.activeIncidents().some(incident => incident.lotId === lot.id) ? 28 : 0;
      for (const resident of home.residents) {
        const status = this.residentStatus(resident);
        const action = this.activeResidentAction(resident);
        const commuteBurden = this.residentCommuteBurden(resident);
        const sleepingHours = hour < 7 || hour >= 22;
        let energyTarget = status === "Home"
          ? sleepingHours ? hasBed ? 96 : 78 : 74
          : status === "Commuting" ? 46
            : status === "At work" || status === "At school" ? 57 : 64;
        let socialTarget = status === "Home"
          ? home.residents.length > 1 && hasSocialFurniture ? 86 : 58
          : status === "Out in city" ? 82
            : status === "At work" || status === "At school" ? 68 : 52;
        let comfortTarget = status === "Home"
          ? homeQuality * .62 + utility * .38
          : status === "Commuting" ? 46 : 64;
        let stressTarget = clamp(
          12
          + commuteBurden * .38
          + (100 - utility) * .29
          + (100 - homeQuality) * .16
          + incidentPressure
          + (status === "At work" || status === "At school" ? 7 : 0)
          + Math.max(0, 55 - resident.energy) * .3,
          0,
          100
        );
        let healthTarget = clamp(
          utility * .34
          + neighborhood * .28
          + (100 - stressTarget) * .25
          + resident.energy * .13,
          0,
          100
        );
        if (action?.kind === "sleep") {
          energyTarget = 100;
          healthTarget = clamp(healthTarget + 10, 0, 100);
          stressTarget = clamp(stressTarget - 18, 0, 100);
        } else if (action?.kind === "eat") {
          energyTarget = Math.max(energyTarget, 84);
          comfortTarget = Math.max(comfortTarget, 78);
          healthTarget = clamp(healthTarget + 7, 0, 100);
        } else if (action?.kind === "relax") {
          comfortTarget = 96;
          stressTarget = clamp(stressTarget - 28, 0, 100);
        } else if (action?.kind === "socialize") {
          socialTarget = 98;
          comfortTarget = Math.max(comfortTarget, 82);
          stressTarget = clamp(stressTarget - 18, 0, 100);
        } else if (action?.kind === "tend-plants") {
          healthTarget = clamp(healthTarget + 18, 0, 100);
          comfortTarget = Math.max(comfortTarget, 84);
          stressTarget = clamp(stressTarget - 24, 0, 100);
        }
        resident.energy = approach(resident.energy, energyTarget, hours, 3.5);
        resident.social = approach(resident.social, socialTarget, hours, 8);
        resident.comfort = approach(resident.comfort, comfortTarget, hours, 5);
        resident.stress = approach(resident.stress, stressTarget, hours, 6);
        resident.health = approach(resident.health, healthTarget, hours, 18);
      }
    }
  }

  private createIncident(startedAt: number) {
    if (!this.lots.length) return;
    const sequence = Math.floor(startedAt / 480);
    const lot = this.lots[hashString(`incident-${sequence}`) % this.lots.length];
    const incident: CityIncident = {
      id: `incident-${startedAt}-${lot.id}`,
      kind: sequence % 2 === 0 ? "fire" : "medical",
      lotId: lot.id,
      startedAt
    };
    this.incidents.push(incident);
    this.assignResponder(incident, startedAt);
  }

  private dispatchWaitingIncidents(kind: ServiceKind) {
    const incidentKind = kind === "fire" ? "fire" : kind === "health" ? "medical" : null;
    if (!incidentKind) return;
    this.incidents
      .filter(incident => incident.kind === incidentKind && incident.responderServiceId === undefined)
      .forEach(incident => this.assignResponder(incident, this.clock.elapsedMinutes));
  }

  private assignResponder(incident: CityIncident, dispatchedAt: number) {
    const lot = this.lots.find(item => item.id === incident.lotId);
    if (!lot) return;
    const serviceKind: ServiceKind = incident.kind === "fire" ? "fire" : "health";
    const candidates = this.services.filter(service => service.kind === serviceKind);
    if (!candidates.length) return;
    const dispatch = candidates
      .map(responder => {
        const route = findRoadRoute(this.roads, responder.position, lot.center);
        return { responder, route, distance: routeLength(route) };
      })
      .reduce((nearest, candidate) => candidate.distance < nearest.distance ? candidate : nearest);
    const { responder, route, distance } = dispatch;
    const responseMinutes = Math.round(
      (18 + distance * .55 / (.55 + this.serviceStaffing(serviceKind) * .45)) * this.trafficMultiplier()
    );
    incident.responderServiceId = responder.id;
    incident.dispatchedAt = dispatchedAt;
    incident.arrivalAt = dispatchedAt + responseMinutes;
    incident.resolvedAt = incident.arrivalAt + (incident.kind === "fire" ? 110 : 75);
    incident.route = route;
  }
}

function hashString(value: string) {
  return [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function orderedResidentIds(firstResidentId: string, secondResidentId: string): [string, string] {
  return firstResidentId.localeCompare(secondResidentId) <= 0
    ? [firstResidentId, secondResidentId]
    : [secondResidentId, firstResidentId];
}

function relationshipKey(firstResidentId: string, secondResidentId: string) {
  return orderedResidentIds(firstResidentId, secondResidentId).join(":");
}

function initialRelationshipScore(firstResidentId: string, secondResidentId: string) {
  return 45 + hashString(relationshipKey(firstResidentId, secondResidentId)) % 16;
}

function initialResidentTraits(seed: string): ResidentTrait[] {
  const firstIndex = hashString(`${seed}-primary`) % RESIDENT_TRAITS.length;
  let secondIndex = hashString(`${seed}-secondary`) % RESIDENT_TRAITS.length;
  if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % RESIDENT_TRAITS.length;
  return [RESIDENT_TRAITS[firstIndex], RESIDENT_TRAITS[secondIndex]];
}

function normalizeResidentTraits(traits: ResidentTrait[] | undefined, seed: string) {
  const normalized = [...new Set((traits ?? []).filter(
    (trait): trait is ResidentTrait => RESIDENT_TRAITS.includes(trait)
  ))].slice(0, 2);
  for (const fallback of initialResidentTraits(seed)) {
    if (normalized.length >= 2) break;
    if (!normalized.includes(fallback)) normalized.push(fallback);
  }
  if (normalized.length < 2) {
    normalized.push(RESIDENT_TRAITS.find(trait => !normalized.includes(trait)) ?? "empathetic");
  }
  return normalized;
}

function residentCompatibility(firstResident: Resident, secondResident: Resident) {
  const firstTraits = new Set(firstResident.traits);
  const secondTraits = new Set(secondResident.traits);
  const sharedTraits = firstResident.traits.filter(trait => secondTraits.has(trait)).length;
  let score = 48 + sharedTraits * 18;
  if (firstTraits.has("empathetic")) score += 4;
  if (secondTraits.has("empathetic")) score += 4;
  if (firstTraits.has("outgoing") && secondTraits.has("outgoing")) score += 6;
  if (firstTraits.has("homebody") && secondTraits.has("homebody")) score += 6;
  if (
    (firstTraits.has("active") && secondTraits.has("organized"))
    || (firstTraits.has("organized") && secondTraits.has("active"))
  ) score += 5;
  if (
    (firstTraits.has("creative") && secondTraits.has("empathetic"))
    || (firstTraits.has("empathetic") && secondTraits.has("creative"))
  ) score += 6;
  if (
    (firstTraits.has("outgoing") && secondTraits.has("homebody"))
    || (firstTraits.has("homebody") && secondTraits.has("outgoing"))
  ) score -= 10;
  if (
    (firstTraits.has("active") && secondTraits.has("homebody"))
    || (firstTraits.has("homebody") && secondTraits.has("active"))
  ) score -= 4;
  return Math.round(clamp(score, 25, 95));
}

function residentActionTraitBonus(resident: Resident, action: ResidentActionKind) {
  let bonus = 0;
  for (const trait of resident.traits) {
    if (trait === "outgoing") {
      if (action === "socialize") bonus += 26;
      if (action === "idle") bonus -= 4;
    } else if (trait === "homebody") {
      if (action === "relax") bonus += 18;
      if (action === "sleep") bonus += 8;
      if (action === "socialize") bonus -= 3;
    } else if (trait === "active") {
      if (action === "tend-plants") bonus += 18;
      if (action === "idle") bonus -= 7;
      if (action === "relax") bonus -= 2;
    } else if (trait === "creative") {
      if (action === "relax" || action === "tend-plants") bonus += 10;
    } else if (trait === "organized") {
      if (action === "eat") bonus += 12;
      if (action === "tend-plants") bonus += 8;
      if (action === "sleep") bonus += 4;
    } else if (trait === "empathetic" && action === "socialize") {
      bonus += 18;
    }
  }
  return bonus;
}

function normalizeConversationIntent(intent: ConversationIntent | undefined): ConversationIntent {
  return intent === "support"
    || intent === "joke"
    || intent === "confront"
    || intent === "apologize"
    ? intent
    : "chat";
}

function normalizeRelationships(
  residents: Resident[],
  relationships: ResidentRelationship[]
): ResidentRelationship[] {
  const residentIds = new Set(residents.map(resident => resident.id));
  const normalized = new Map<string, ResidentRelationship>();
  for (const relationship of relationships) {
    const [firstResidentId, secondResidentId] = orderedResidentIds(...relationship.residentIds);
    if (
      firstResidentId === secondResidentId
      || !residentIds.has(firstResidentId)
      || !residentIds.has(secondResidentId)
    ) continue;
    normalized.set(relationshipKey(firstResidentId, secondResidentId), {
      residentIds: [firstResidentId, secondResidentId],
      score: clamp(
        relationship.score ?? initialRelationshipScore(firstResidentId, secondResidentId),
        0,
        100
      ),
      conversations: Math.max(0, Math.floor(relationship.conversations ?? 0)),
      lastInteractionAt: relationship.lastInteractionAt,
      lastIntent: relationship.lastIntent
        ? normalizeConversationIntent(relationship.lastIntent)
        : undefined,
      lastChange: Number.isFinite(relationship.lastChange)
        ? clamp(Math.round(relationship.lastChange!), -14, 12)
        : undefined,
      tension: clamp(Math.round(relationship.tension ?? 0), 0, 100),
      conflicts: Math.max(0, Math.floor(relationship.conflicts ?? 0)),
      resolvedConflicts: Math.max(0, Math.floor(relationship.resolvedConflicts ?? 0)),
      lastConflictAt: relationship.lastConflictAt,
      lastReconciledAt: relationship.lastReconciledAt,
      memories: (relationship.memories ?? [])
        .filter(memory =>
          residentIds.has(memory.initiatorResidentId)
          && Number.isFinite(memory.occurredAt)
          && Number.isFinite(memory.relationshipChange)
          && Number.isFinite(memory.tensionChange)
        )
        .slice(0, 8)
        .map(memory => ({
          intent: normalizeConversationIntent(memory.intent),
          relationshipChange: clamp(Math.round(memory.relationshipChange), -14, 12),
          tensionChange: clamp(Math.round(memory.tensionChange), -40, 30),
          occurredAt: Math.max(0, memory.occurredAt),
          initiatorResidentId: memory.initiatorResidentId
        }))
    });
  }
  for (let firstIndex = 0; firstIndex < residents.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < residents.length; secondIndex += 1) {
      const residentPair = orderedResidentIds(residents[firstIndex].id, residents[secondIndex].id);
      const key = relationshipKey(...residentPair);
      if (!normalized.has(key)) {
        normalized.set(key, {
          residentIds: residentPair,
          score: initialRelationshipScore(...residentPair),
          conversations: 0
        });
      }
    }
  }
  return [...normalized.values()];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function distance(a: Point2, b: Point2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function polygonCenter(points: Point2[]) {
  if (!points.length) return { x: 0, z: 0 };
  return points.reduce(
    (total, point) => ({ x: total.x + point.x / points.length, z: total.z + point.z / points.length }),
    { x: 0, z: 0 }
  );
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function defaultParkingRate(kind: ParkingKind) {
  return kind === "curb" ? 6 : kind === "surface" ? 2 : 4;
}

function normalizeParkingRate(hourlyRate: number) {
  return Math.round(clamp(hourlyRate, 0, 25) * 4) / 4;
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function approach(current: number, target: number, elapsedHours: number, responseHours: number) {
  const response = 1 - Math.exp(-elapsedHours / Math.max(.1, responseHours));
  return clamp(current + (target - current) * response, 0, 100);
}

function distanceToPolyline(point: Point2, points: Point2[]) {
  let distance = Infinity;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const progress = lengthSquared
      ? clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared, 0, 1)
      : 0;
    distance = Math.min(distance, Math.hypot(point.x - (a.x + progress * dx), point.z - (a.z + progress * dz)));
  }
  return distance;
}

function progressInWindow(minute: number, start: number, duration: number) {
  if (minute < start || minute > start + duration) return null;
  return Math.max(0, Math.min(1, (minute - start) / Math.max(1, duration)));
}

function legacyServiceCapacity(kind: ServiceKind) {
  return {
    power: 65_000,
    water: 72_000,
    sewage: 68_000,
    waste: 48_000,
    fire: 18_000,
    health: 12_000,
    school: 8_000
  }[kind];
}

function legacyServiceStaff(kind: ServiceKind) {
  return { power: 160, water: 85, sewage: 110, waste: 95, fire: 75, health: 140, school: 180 }[kind];
}

function targetHouseholds(zone: Zone, seed: number) {
  if (zone === "residential") return 28 + seed % 76;
  if (zone === "mixed") return 20 + seed % 90;
  return 0;
}

function targetBusinesses(zone: Zone, seed: number) {
  if (zone === "commercial") return 3 + seed % 14;
  if (zone === "mixed") return 2 + seed % 9;
  if (zone === "industrial") return 2 + seed % 8;
  if (zone === "civic") return 1;
  return 0;
}

function initialHouseholds(zone: Zone, seed: number) {
  return Math.floor(targetHouseholds(zone, seed) * .64);
}

function initialBusinesses(zone: Zone, seed: number) {
  return Math.floor(targetBusinesses(zone, seed) * .7);
}

function createHouseholdMix(total: number, seed: number): HouseholdMix {
  const mix: HouseholdMix = { families: 0, singles: 0, shared: 0, seniors: 0 };
  const pattern: Array<keyof HouseholdMix> = ["families", "singles", "families", "shared", "singles", "families", "seniors", "shared", "families", "singles"];
  for (let index = 0; index < total; index++) {
    mix[pattern[(index + seed) % pattern.length]] += 1;
  }
  return mix;
}

function createBusinessMix(total: number, zone: Zone, seed: number): BusinessMix {
  const mix: BusinessMix = { retail: 0, office: 0, hospitality: 0, industrial: 0, community: 0 };
  const pattern: Record<Zone, BusinessSector[]> = {
    unassigned: ["community"],
    residential: ["retail", "community"],
    commercial: ["retail", "office", "hospitality", "office", "retail"],
    mixed: ["retail", "office", "hospitality", "community", "retail"],
    industrial: ["industrial", "industrial", "office", "community"],
    civic: ["community", "community", "office"]
  };
  const sectors = pattern[zone];
  for (let index = 0; index < total; index++) {
    mix[sectors[(index + seed) % sectors.length]] += 1;
  }
  return mix;
}

function createAnchorBusiness(lotId: string, zone: Zone, businesses: number): AnchorBusiness | undefined {
  if (!businesses) return undefined;
  const seed = hashString(lotId);
  const mix = createBusinessMix(businesses, zone, seed);
  const activeSectors = (Object.entries(mix) as Array<[BusinessSector, number]>)
    .filter(([, count]) => count > 0)
    .map(([sector]) => sector);
  const sector = activeSectors[seed % activeSectors.length];
  const names: Record<BusinessSector, [string[], string[]]> = {
    retail: [["Canal", "Orchard", "Hudson", "Mercer", "Harbor"], ["Market", "Books", "Goods", "Grocer", "Supply"]],
    office: [["Northline", "Civic", "Foundry", "Broadway", "Union"], ["Studio", "Partners", "Design", "Analytics", "Works"]],
    hospitality: [["Lantern", "Juniper", "Parkside", "Mariner", "Terrace"], ["Cafe", "Kitchen", "Hotel", "House", "Table"]],
    industrial: [["Ironwood", "Riverside", "Metro", "Atlas", "Red Hook"], ["Fabrication", "Logistics", "Machine", "Works", "Freight"]],
    community: [["Common", "Neighborhood", "Corner", "Bridge", "Open Door"], ["Clinic", "Co-op", "Center", "Workshop", "Collective"]]
  };
  const [prefixes, suffixes] = names[sector];
  return {
    name: `${prefixes[seed % prefixes.length]} ${suffixes[Math.floor(seed / 7) % suffixes.length]}`,
    sector,
    jobs: sectorJobs(sector, seed)
  };
}

function sectorJobs(sector: BusinessSector, seed: number) {
  const base = { retail: 11, office: 27, hospitality: 16, industrial: 24, community: 13 }[sector];
  return base + seed % 7;
}

function sectorOperatingFactor(sector: BusinessSector, hour: number) {
  if (sector === "retail") return hour >= 8 && hour < 22 ? 1 : 0;
  if (sector === "office") return hour >= 7 && hour < 19 ? 1 : 0;
  if (sector === "hospitality") return hour >= 6 || hour < 2 ? 1 : 0;
  if (sector === "industrial") return hour >= 6 && hour < 22 ? 1 : .65;
  return hour >= 7 && hour < 20 ? 1 : 0;
}

function openBusinessCount(count: number, sector: BusinessSector, hour: number) {
  const factor = sectorOperatingFactor(sector, hour);
  if (!count || !factor) return 0;
  return Math.min(count, Math.max(1, Math.round(count * factor)));
}

function serviceShiftFactor(kind: ServiceKind, hour: number) {
  if (kind === "fire") return 1;
  if (kind === "health") return hour < 6 ? .78 : hour < 20 ? 1 : .88;
  if (kind === "school") return hour >= 8 && hour < 16 ? 1 : hour >= 6 && hour < 19 ? .58 : .16;
  if (kind === "waste") return hour < 5 ? .38 : hour < 8 ? .82 : hour < 18 ? 1 : .55;
  return hour < 6 ? .82 : hour < 22 ? 1 : .9;
}

function inferTemplateZone(templateId: WorldTemplate["id"], x: number, z: number): Zone {
  if (templateId === "blank") return "unassigned";
  if (z < -245) return Math.abs(x) < 78 ? "mixed" : "commercial";
  if (z < 72) return Math.abs(x) < 62 ? "commercial" : "mixed";
  if (z > 315) return "residential";
  return "residential";
}

function initialCityEvents(roads: Road[]): CityEvent[] {
  const road = roads.find(item => item.id === "nyc-broadway");
  if (!road?.points.length) return [];
  const definition = CITY_EVENT_DEFINITIONS.market;
  const position = clone(road.points[Math.floor(road.points.length / 2)]);
  return [{
    id: "template-event-broadway-market",
    name: "Broadway Night Market",
    kind: "market",
    position,
    startAt: 10 * 60,
    durationMinutes: definition.durationMinutes,
    intervalMinutes: 30 * 24 * 60,
    capacity: definition.capacity,
    cityFeePerAttendee: definition.cityFeePerAttendee,
    monthlyCost: definition.monthlyCost,
    occurrences: 0,
    totalAttendance: 0,
    revenue: 0,
    roadId: road.id,
    closureRoadIds: [road.id],
    temporaryTransitLineId: `transit-line-${road.id}`,
    temporaryTransitHeadwayMinutes: 6
  }];
}

function initialParking(roads: Road[]): ParkingFacility[] {
  const choices = [
    { roadId: "nyc-avenue-1", progress: .24, side: -1 },
    { roadId: "nyc-avenue-3", progress: .52, side: 1 },
    { roadId: "nyc-avenue-5", progress: .76, side: -1 }
  ];
  return choices.flatMap((choice, index) => {
    const road = roads.find(item => item.id === choice.roadId);
    if (!road || road.points.length < 2) return [];
    const segmentLengths = road.points.slice(0, -1).map((point, pointIndex) =>
      Math.hypot(road.points[pointIndex + 1].x - point.x, road.points[pointIndex + 1].z - point.z)
    );
    const totalLength = segmentLengths.reduce((total, length) => total + length, 0);
    let remaining = totalLength * choice.progress;
    let segment = 0;
    while (segment < segmentLengths.length - 1 && remaining > segmentLengths[segment]) {
      remaining -= segmentLengths[segment];
      segment += 1;
    }
    const start = road.points[segment];
    const end = road.points[segment + 1];
    const segmentLength = segmentLengths[segment] || 1;
    const t = Math.min(1, remaining / segmentLength);
    const tangent = { x: (end.x - start.x) / segmentLength, z: (end.z - start.z) / segmentLength };
    const normal = { x: tangent.z, z: -tangent.x };
    const offset = Math.max(1.6, road.width / 2 - 1.35) * choice.side;
    return [{
      id: `template-parking-${index + 1}`,
      kind: "curb" as const,
      position: {
        x: start.x + (end.x - start.x) * t + normal.x * offset,
        z: start.z + (end.z - start.z) * t + normal.z * offset
      },
      rotation: Math.atan2(-tangent.x, -tangent.z),
      capacity: 2,
      accessibleSpaces: 1,
      occupied: index % 2,
      hourlyRate: defaultParkingRate("curb"),
      revenue: 0,
      curbUse: (["parking", "loading", "event"] as CurbUse[])[index],
      curbSchedule: (["all-day", "business-hours", "evening"] as CurbSchedule[])[index],
      deliveriesWaiting: 0,
      deliveriesServed: 0,
      violations: 0,
      curbRevenue: 0
    }];
  });
}

function buildingEntrancePosition(lot: Lot, roads: Road[]) {
  const road = roads.find(item => item.id === lot.roadId);
  const roadPoint = road ? closestPointOnPolyline(road.points, lot.center) : undefined;
  if (!roadPoint) return clone(lot.center);
  const dx = roadPoint.x - lot.center.x;
  const dz = roadPoint.z - lot.center.z;
  const length = Math.hypot(dx, dz) || 1;
  const facadeDistance = lot.width * .31 + .72;
  return {
    x: lot.center.x + dx / length * facadeDistance,
    z: lot.center.z + dz / length * facadeDistance
  };
}

function parkEntrancePosition(area: Area, roads: Road[]) {
  const boundaryPoints = area.points.flatMap((point, index) => {
    const next = area.points[(index + 1) % area.points.length];
    return [
      point,
      { x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 }
    ];
  });
  const roadPoints = roads.flatMap(road => road.points);
  if (!boundaryPoints.length || !roadPoints.length) {
    return area.points[0] ? clone(area.points[0]) : { x: 0, z: 0 };
  }
  return boundaryPoints
    .map(point => ({
      point,
      distance: roadPoints.reduce(
        (closest, roadPoint) => Math.min(closest, distance(point, roadPoint)),
        Infinity
      )
    }))
    .sort((a, b) => a.distance - b.distance)[0].point;
}

function closestPointOnPolyline(points: Point2[], target: Point2) {
  let closest: Point2 | undefined;
  let closestDistance = Infinity;
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (!lengthSquared) continue;
    const progress = clamp(
      ((target.x - start.x) * dx + (target.z - start.z) * dz) / lengthSquared,
      0,
      1
    );
    const point = {
      x: start.x + dx * progress,
      z: start.z + dz * progress
    };
    const candidateDistance = distance(point, target);
    if (candidateDistance < closestDistance) {
      closest = point;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}

function pointInPolygon(point: Point2, polygon: Point2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = (a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
