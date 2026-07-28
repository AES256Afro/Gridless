import * as THREE from "three";
import { NYC_TEMPLATE, WORLD_TEMPLATES } from "./templates";
import { findRoadRoute, routeLength } from "./routing";
import { initialTransitLines } from "./transit";

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

export type ResidentActionKind = "sleep" | "eat" | "relax" | "socialize" | "tend-plants" | "idle";

export type ResidentAction = {
  kind: ResidentActionKind;
  startedAt: number;
  endsAt: number;
  targetFurnitureId?: string;
  partnerResidentId?: string;
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
  currentAction?: ResidentAction;
  lastActionKind?: ResidentActionKind;
  lastActionAt?: number;
  completedActions?: number;
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
};

export type TransitLine = {
  id: string;
  name: string;
  mode: "bus";
  color: number;
  route: Point2[];
  stops: TransitStop[];
  travelMinutes: number;
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
  residents: Resident[];
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
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

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
  lastDailyActivity = { households: 0, businesses: 0 };
  private history: WorldSnapshot[] = [];

  constructor() {
    this.roads = clone(NYC_TEMPLATE.roads);
    this.areas = clone(NYC_TEMPLATE.areas);
    this.rebuildLots();
    this.parking = initialParking(this.roads);
    this.transitLines = initialTransitLines(this.roads);
  }

  snapshot(): WorldSnapshot {
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
      transitLines: this.transitLines
    });
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
      ...definition
    };
    this.parking.push(facility);
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

  parkingDemand(facility: ParkingFacility, minute = this.clock.minute) {
    const hour = positiveModulo(minute, 24 * 60) / 60;
    const localCapacity = Math.max(2, this.parking
      .filter(item => distance(item.position, facility.position) <= 180)
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
    if (!facility || facility.occupied >= facility.capacity) return false;
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
    const monthlyRevenue = population * 118 + businesses * 4_800 + parkingRevenue;
    const monthlyCosts = this.services.reduce(
      (total, service) => total + service.monthlyCost * (.4 + this.serviceFunding * .6),
      0
    ) + parkingCosts;
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
      parkingCosts
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
    const travelMultiplier = 1 + this.commuteCongestionAt(minute) * 1.35;
    const active: ActiveCommute[] = [];
    for (const flow of this.commuteFlows) {
      const duration = flow.travelMinutes * travelMultiplier;
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
    return this.commuteCongestionAt(this.clock.minute);
  }

  trafficMultiplier() {
    return 1 + this.congestionLevel() * 1.35;
  }

  estimatedCommuteMinutes(flow: CommuteFlow) {
    return Math.round(flow.travelMinutes * this.trafficMultiplier());
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
    return {
      sleep: "Sleeping",
      eat: "Having a meal",
      relax: "Relaxing",
      socialize: "Socializing",
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
      facility.revenue = Math.round((facility.revenue + facility.occupied * facility.hourlyRate) * 100) / 100;
      const playerSpaces = this.playerVehicle?.parkingId === facility.id ? 1 : 0;
      const publicCapacity = Math.max(0, facility.capacity - playerSpaces);
      const currentPublic = Math.max(0, facility.occupied - playerSpaces);
      const variation = (hashString(`${facility.id}:${Math.floor(elapsedMinute / 60)}`) % 9 - 4) / 100;
      const target = Math.round(publicCapacity * clamp(this.parkingDemand(facility, minuteOfDay) + variation, 0, 1));
      const nextPublic = Math.round(currentPublic * .55 + target * .45);
      facility.occupied = Math.round(clamp(nextPublic + playerSpaces, playerSpaces, facility.capacity));
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
    this.lastDailyActivity = { households: 0, businesses: 0 };
    this.rebuildLots();
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
      residents: []
    };
    this.homes.push(home);
    lot.homeId = home.id;
    return home;
  }

  addRoom(homeId: string, room: Omit<Home["rooms"][number], "id">) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home || room.width < 2 || room.depth < 2) return false;
    this.checkpoint();
    home.rooms.push({ id: crypto.randomUUID(), ...clone(room) });
    return true;
  }

  addFurniture(homeId: string, kind: Home["furniture"][number]["kind"], x: number, z: number) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home) return false;
    this.checkpoint();
    home.furniture.push({ id: crypto.randomUUID(), kind, x, z, rotation: 0 });
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
    home.residents.push({
      id: crypto.randomUUID(),
      name,
      age: "adult",
      role: roles[home.residents.length % roles.length],
      energy: 82,
      social: 68,
      comfort: 74,
      health: 84,
      stress: 24,
      completedActions: 0
    });
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
    this.homes = clone(snapshot.homes).map(home => ({
      ...home,
      furniture: home.furniture ?? [],
      residents: (home.residents ?? []).map((resident, index) => ({
        ...resident,
        role: resident.role ?? (resident.age === "child" ? "student" : index % 2 === 0 ? "office" : "service"),
        energy: clamp(resident.energy ?? 82, 0, 100),
        social: clamp(resident.social ?? 68, 0, 100),
        comfort: clamp(resident.comfort ?? 74, 0, 100),
        health: clamp(resident.health ?? 84, 0, 100),
        stress: clamp(resident.stress ?? 24, 0, 100),
        completedActions: resident.completedActions ?? 0
      }))
    }));
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
      revenue: facility.revenue ?? 0
    }));
    this.playerVehicle = snapshot.playerVehicle ? clone(snapshot.playerVehicle) : undefined;
    this.transitLines = clone(snapshot.transitLines ?? initialTransitLines(this.roads));
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
          this.completeResidentAction(resident, current);
        }
        if (this.residentStatus(resident) !== "Home") {
          resident.currentAction = undefined;
          continue;
        }
        if (this.activeResidentAction(resident)) continue;
        resident.currentAction = this.chooseResidentAction(home, resident);
      }
    }
  }

  private chooseResidentAction(home: Home, resident: Resident): ResidentAction {
    const now = this.clock.elapsedMinutes;
    const hour = this.clock.minute / 60;
    const sleepingHours = hour < 7 || hour >= 22;
    const availablePartner = home.residents.find(candidate =>
      candidate.id !== resident.id && this.residentStatus(candidate) === "Home"
    );
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
        score: (100 - resident.social) * 1.08 + (availablePartner ? 24 : -32) + (furniture.table || furniture.sofa ? 10 : 0),
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
          : choice.kind === "socialize" ? 60
            : choice.kind === "tend-plants" ? 45 : 30;
    return {
      kind: choice.kind,
      startedAt: now,
      endsAt: now + duration,
      targetFurnitureId: choice.targetFurnitureId,
      partnerResidentId: choice.partnerResidentId
    };
  }

  private completeResidentAction(resident: Resident, action: ResidentAction) {
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
      resident.social = clamp(resident.social + 20, 0, 100);
      resident.stress = clamp(resident.stress - 6, 0, 100);
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function distance(a: Point2, b: Point2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
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
      revenue: 0
    }];
  });
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
