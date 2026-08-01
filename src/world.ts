import * as THREE from "three";
import { NYC_TEMPLATE, TEMPLATE_REGIONAL_CONFIGS, WORLD_TEMPLATES } from "./templates";
import { findRoadRoute, routeLength } from "./routing";
import {
  initialTransitLines,
  transitFleetSize,
  transitLineForRoad,
  transitStopsForLine
} from "./transit";

export type Point2 = { x: number; z: number };

export type RoadClass = "street" | "avenue" | "arterial";
export type RoadStructure = "surface" | "bridge" | "tunnel";

export type RoadProfile = {
  travelLanes: number;
  speedLimitKph: number;
  sidewalkWidth: number;
  bikeLanes: boolean;
  busLanes: boolean;
  median: boolean;
  curbParking: boolean;
  streetTrees: boolean;
};

export type Road = {
  id: string;
  points: Point2[];
  width: number;
  name?: string;
  class?: RoadClass;
  profile?: RoadProfile;
  structure?: RoadStructure;
  elevationMeters?: number;
  developable?: boolean;
};

export const ROAD_PROFILE_PRESETS: Record<RoadClass, RoadProfile> = {
  street: {
    travelLanes: 2,
    speedLimitKph: 30,
    sidewalkWidth: 2.2,
    bikeLanes: false,
    busLanes: false,
    median: false,
    curbParking: true,
    streetTrees: true
  },
  avenue: {
    travelLanes: 4,
    speedLimitKph: 40,
    sidewalkWidth: 3,
    bikeLanes: false,
    busLanes: false,
    median: false,
    curbParking: false,
    streetTrees: true
  },
  arterial: {
    travelLanes: 4,
    speedLimitKph: 50,
    sidewalkWidth: 3,
    bikeLanes: true,
    busLanes: false,
    median: true,
    curbParking: false,
    streetTrees: true
  }
};

export function normalizeRoadProfile(profile: Partial<RoadProfile> | undefined, roadClass: RoadClass = "street"): RoadProfile {
  const preset = ROAD_PROFILE_PRESETS[roadClass];
  return {
    travelLanes: Math.round(clamp(profile?.travelLanes ?? preset.travelLanes, 1, 8)),
    speedLimitKph: Math.round(clamp(profile?.speedLimitKph ?? preset.speedLimitKph, 20, 100) / 5) * 5,
    sidewalkWidth: Math.round(clamp(profile?.sidewalkWidth ?? preset.sidewalkWidth, 1.2, 6) * 10) / 10,
    bikeLanes: Boolean(profile?.bikeLanes ?? preset.bikeLanes),
    busLanes: Boolean(profile?.busLanes ?? preset.busLanes),
    median: Boolean(profile?.median ?? preset.median),
    curbParking: Boolean(profile?.curbParking ?? preset.curbParking),
    streetTrees: Boolean(profile?.streetTrees ?? preset.streetTrees)
  };
}

export function roadWidthForProfile(profile: RoadProfile) {
  return Math.max(4.2, Math.round((profile.travelLanes * 3 + (profile.curbParking ? 3 : 0) + (profile.bikeLanes ? 2 : 0) + (profile.median ? 2 : 0)) * 10) / 10);
}

export function roadCapacityForProfile(profile: RoadProfile, roadClass: RoadClass = "street") {
  const preset = ROAD_PROFILE_PRESETS[roadClass];
  const baseCapacity = roadClass === "arterial" ? 620 : roadClass === "avenue" ? 440 : 280;
  const designFactor = (candidate: RoadProfile) =>
    (candidate.bikeLanes ? .96 : 1)
    * (candidate.busLanes ? .88 : 1)
    * (candidate.median ? 1.03 : 1)
    * (candidate.curbParking ? .94 : 1);
  const speedFactor = Math.pow(profile.speedLimitKph / preset.speedLimitKph, .3);
  return Math.max(90, Math.round(
    baseCapacity
    * (profile.travelLanes / preset.travelLanes)
    * speedFactor
    * designFactor(profile) / designFactor(preset)
  ));
}

export function normalizeRoadStructure(structure: RoadStructure | undefined, elevationMeters: number | undefined) {
  const kind: RoadStructure = structure === "bridge" || structure === "tunnel" ? structure : "surface";
  const elevation = kind === "bridge"
    ? Math.round(clamp(elevationMeters ?? 8, 4, 16))
    : kind === "tunnel"
      ? Math.round(clamp(elevationMeters ?? -8, -16, -4))
      : 0;
  return { structure: kind, elevationMeters: elevation };
}

export function roadConstructionCost(
  points: Point2[],
  profile: RoadProfile,
  structure: RoadStructure = "surface",
  elevationMeters = 0
) {
  const length = routeLength(points);
  const featureCost = length * (
    (profile.bikeLanes ? 520 : 0)
    + (profile.busLanes ? 680 : 0)
    + (profile.median ? 760 : 0)
    + (profile.streetTrees ? 240 : 0)
  );
  const normalizedStructure = normalizeRoadStructure(structure, elevationMeters);
  const structureCost = normalizedStructure.structure === "bridge"
    ? length * roadWidthForProfile(profile) * (3_100 + normalizedStructure.elevationMeters * 90)
    : normalizedStructure.structure === "tunnel"
      ? length * roadWidthForProfile(profile) * (6_400 + Math.abs(normalizedStructure.elevationMeters) * 120)
      : 0;
  return Math.max(25_000, Math.round((length * roadWidthForProfile(profile) * 1_350 + featureCost + structureCost) / 1_000) * 1_000);
}

export type RoadConstructionImpact = {
  lengthMeters: number;
  cost: number;
  frontageLots: number;
  parcelConflicts: number;
  developedParcelConflicts: number;
  roadCrossings: number;
  gradeSeparatedCrossings: number;
  networkConnections: number;
  waterSections: number;
  accessible: boolean;
  affordable: boolean;
  canBuild: boolean;
  status: "ready" | "funding" | "parcel-conflict" | "water-conflict" | "incomplete";
};

export type RoadDrawingSnap = {
  point: Point2;
  kind: "free" | "endpoint" | "angle" | "tangent" | "parallel";
  distance: number;
  angleDegrees?: number;
  targetRoadId?: string;
  targetRoadName?: string;
};

function nearestPointOnSegment(point: Point2, start: Point2, end: Point2) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= .0001) return { x: start.x, z: start.z };
  const progress = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1);
  return { x: start.x + dx * progress, z: start.z + dz * progress };
}

export function snapRoadDrawingPoint(
  candidate: Point2,
  draftPoints: Point2[],
  roads: Road[],
  settings: {
    endpoints: boolean;
    angleLock: boolean;
    tangentGuide?: boolean;
    parallelGuide?: boolean;
    angleStepDegrees?: number;
    endpointDistance?: number;
    alignmentDistance?: number;
    alignmentToleranceDegrees?: number;
  }
): RoadDrawingSnap {
  const endpointDistance = clamp(settings.endpointDistance ?? 12, 2, 30);
  if (settings.endpoints) {
    const closest = roads
      .flatMap(road => [road.points[0], road.points[road.points.length - 1]].filter(Boolean).map(point => ({ road, point })))
      .map(entry => ({
        ...entry,
        distance: Math.hypot(entry.point.x - candidate.x, entry.point.z - candidate.z)
      }))
      .filter(entry => entry.distance <= endpointDistance)
      .sort((first, second) => first.distance - second.distance || first.road.id.localeCompare(second.road.id))[0];
    if (closest) {
      return {
        point: { x: closest.point.x, z: closest.point.z },
        kind: "endpoint",
        distance: closest.distance,
        targetRoadId: closest.road.id,
        targetRoadName: closest.road.name ?? "Unnamed road"
      };
    }
  }
  const previous = draftPoints[draftPoints.length - 1];
  const alignToAngle = (
    angle: number,
    kind: "tangent" | "parallel",
    road: Road,
    maximumDifference: number
  ): RoadDrawingSnap | undefined => {
    if (!previous) return undefined;
    const dx = candidate.x - previous.x;
    const dz = candidate.z - previous.z;
    const segmentLength = Math.hypot(dx, dz);
    if (segmentLength <= .5) return undefined;
    const candidateAngle = Math.atan2(dz, dx);
    const difference = Math.abs(Math.atan2(Math.sin(candidateAngle - angle), Math.cos(candidateAngle - angle)));
    if (difference > maximumDifference) return undefined;
    return {
      point: {
        x: Math.round((previous.x + Math.cos(angle) * segmentLength) * 100) / 100,
        z: Math.round((previous.z + Math.sin(angle) * segmentLength) * 100) / 100
      },
      kind,
      distance: segmentLength,
      angleDegrees: positiveModulo(Math.round(angle * 180 / Math.PI), 360),
      targetRoadId: road.id,
      targetRoadName: road.name ?? "Unnamed road"
    };
  };
  const alignmentDistance = clamp(settings.alignmentDistance ?? 24, 6, 60);
  const tolerance = clamp(settings.alignmentToleranceDegrees ?? 12, 3, 30) * Math.PI / 180;
  if (settings.tangentGuide && previous) {
    const tangent = roads
      .flatMap(road => {
        if (road.points.length < 2) return [];
        const start = road.points[0];
        const next = road.points[1];
        const end = road.points[road.points.length - 1];
        const beforeEnd = road.points[road.points.length - 2];
        return [
          { road, point: start, angle: Math.atan2(start.z - next.z, start.x - next.x) },
          { road, point: end, angle: Math.atan2(end.z - beforeEnd.z, end.x - beforeEnd.x) }
        ];
      })
      .map(entry => ({ ...entry, proximity: Math.hypot(entry.point.x - previous.x, entry.point.z - previous.z) }))
      .filter(entry => entry.proximity <= alignmentDistance)
      .sort((first, second) => first.proximity - second.proximity || first.road.id.localeCompare(second.road.id))
      .map(entry => alignToAngle(entry.angle, "tangent", entry.road, tolerance))
      .find((entry): entry is RoadDrawingSnap => Boolean(entry));
    if (tangent) return tangent;
  }
  if (settings.parallelGuide && previous) {
    const midpoint = { x: (previous.x + candidate.x) / 2, z: (previous.z + candidate.z) / 2 };
    const parallel = roads
      .flatMap(road => road.points.slice(1).map((point, index) => {
        const start = road.points[index];
        const projection = nearestPointOnSegment(midpoint, start, point);
        return {
          road,
          angle: Math.atan2(point.z - start.z, point.x - start.x),
          proximity: Math.hypot(projection.x - midpoint.x, projection.z - midpoint.z)
        };
      }))
      .filter(entry => entry.proximity <= alignmentDistance)
      .sort((first, second) => first.proximity - second.proximity || first.road.id.localeCompare(second.road.id))
      .flatMap(entry => [entry.angle, entry.angle + Math.PI].map(angle => ({ ...entry, angle })))
      .map(entry => alignToAngle(entry.angle, "parallel", entry.road, tolerance))
      .find((entry): entry is RoadDrawingSnap => Boolean(entry));
    if (parallel) return parallel;
  }
  if (settings.angleLock && previous) {
    const dx = candidate.x - previous.x;
    const dz = candidate.z - previous.z;
    const distance = Math.hypot(dx, dz);
    if (distance > .5) {
      const step = Math.PI / (180 / clamp(settings.angleStepDegrees ?? 15, 5, 90));
      const angle = Math.round(Math.atan2(dz, dx) / step) * step;
      const angleDegrees = positiveModulo(Math.round(angle * 180 / Math.PI), 360);
      return {
        point: {
          x: Math.round((previous.x + Math.cos(angle) * distance) * 100) / 100,
          z: Math.round((previous.z + Math.sin(angle) * distance) * 100) / 100
        },
        kind: "angle",
        distance,
        angleDegrees
      };
    }
  }
  return { point: { x: candidate.x, z: candidate.z }, kind: "free", distance: 0 };
}

function normalizeRoadRecord(road: Road): Road {
  const roadClass: RoadClass = road.class
    ?? (road.width >= 15 ? "arterial" : road.width >= 11 ? "avenue" : "street");
  const structure = normalizeRoadStructure(road.structure, road.elevationMeters);
  return {
    ...road,
    ...structure,
    developable: road.developable ?? (structure.structure === "surface" ? undefined : false),
    class: roadClass,
    width: Number.isFinite(road.width) && road.width >= 4 ? road.width : roadWidthForProfile(ROAD_PROFILE_PRESETS[roadClass]),
    profile: normalizeRoadProfile(road.profile, roadClass)
  };
}

export type Area = {
  id: string;
  name: string;
  kind: "land" | "park" | "water" | "floodplain" | "slope" | "growth-boundary" | "district";
  floodRisk?: "moderate" | "high";
  terrainSlope?: "moderate" | "steep";
  points: Point2[];
};

export type FloodRisk = "none" | "moderate" | "high";
export type TerrainSlope = "flat" | "moderate" | "steep";
export type GrowthBoundaryStatus = "inside" | "outside";

export type EnvironmentalQuality = {
  score: number;
  label: "Healthy" | "Fair" | "Strained" | "Unhealthy";
  airQuality: number;
  noiseLevel: number;
  groundPollution: number;
  sources: string[];
  mitigations: string[];
};

export type TaxCategory = "residential" | "commercial" | "industrial";

export type TaxPolicy = Record<TaxCategory, number>;

export type DistrictPolicy = "recycling" | "school-boost" | "heavy-traffic-ban" | "small-business-grants";

export type MunicipalBond = {
  id: string;
  originalPrincipal: number;
  balance: number;
  annualInterestRate: number;
  monthlyPayment: number;
  monthsRemaining: number;
  issuedAt: number;
};

export const DISTRICT_POLICY_DEFINITIONS: Record<DistrictPolicy, {
  label: string;
  monthlyCost: number;
  effect: string;
}> = {
  recycling: {
    label: "Mandatory recycling",
    monthlyCost: 55_000,
    effect: "Cleaner streets and stronger neighborhood value"
  },
  "school-boost": {
    label: "School boost",
    monthlyCost: 120_000,
    effect: "More education support and household wellbeing"
  },
  "heavy-traffic-ban": {
    label: "Heavy traffic ban",
    monthlyCost: 35_000,
    effect: "Less neighborhood noise with reduced freight access"
  },
  "small-business-grants": {
    label: "Small business grants",
    monthlyCost: 95_000,
    effect: "Higher commercial capacity and local land value"
  }
};

const SUPPORTED_TAX_RATES = [5, 8, 10, 12, 15, 18, 20];

function normalizeTaxRate(rate: number) {
  const bounded = clamp(rate, 5, 20);
  return SUPPORTED_TAX_RATES.reduce(
    (closest, candidate) => Math.abs(candidate - bounded) < Math.abs(closest - bounded) ? candidate : closest,
    10
  );
}

export type WorldTemplate = {
  id: "nyc" | "chicago" | "houston" | "seattle" | "portland" | "blank";
  name: string;
  description: string;
  roads: Road[];
  areas: Area[];
};

export type BusinessFinance = {
  lastRevenue: number;
  lastPayroll: number;
  lastOperatingCosts: number;
  lastProfit: number;
  operatingReserve: number;
  consecutiveLossDays: number;
  lastSettledAt: number;
  lastClosureAt?: number;
};

export type BusinessFinanceProjection = {
  dailyCustomers: number;
  revenue: number;
  payroll: number;
  operatingCosts: number;
  profit: number;
  margin: number;
};

export type Lot = {
  id: string;
  roadId: string;
  center: Point2;
  rotation: number;
  width: number;
  depth: number;
  zone: Zone;
  density?: LotDensity;
  constructionStartedAt?: number;
  constructionDuration?: number;
  households: number;
  businesses: number;
  householdMix: HouseholdMix;
  businessMix: BusinessMix;
  anchorBusiness?: AnchorBusiness;
  businessFinance?: BusinessFinance;
  homeId?: string;
};

export type Zone = "unassigned" | "residential" | "commercial" | "mixed" | "industrial" | "civic";
export type LotDensity = "low" | "medium" | "high";
export const LOT_DENSITY_MULTIPLIERS: Record<LotDensity, number> = { low: .45, medium: 1, high: 1.65 };

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

export type WorkplaceActivity = {
  sector: BusinessSector;
  openBusinesses: number;
  coworkersOnShift: number;
  namedWorkersAssigned: number;
  namedWorkersOnShift: number;
  hourlyCustomerDemand: number;
  customersPresent: number;
  servicePressure: number;
  label: "Closed" | "Crew only" | "Quiet" | "Steady" | "Busy" | "Crowded";
};

export type ResidentRole = "office" | "service" | "student" | "home";
export type ResidentLifeStage = "infant" | "toddler" | "child" | "teen" | "young-adult" | "adult" | "elder";
export type ResidentAspiration = "family" | "mastery" | "community" | "prosperity" | "creative";
export type ResidentCareerTrack = "civic" | "enterprise" | "hospitality" | "care" | "creative";
export type ResidentWorkTask =
  | "review-permits"
  | "coordinate-street-upgrade"
  | "inspect-service-coverage"
  | "analyze-operations"
  | "meet-clients"
  | "plan-expansion"
  | "prep-service"
  | "lead-shift"
  | "resolve-guest-issue"
  | "complete-rounds"
  | "coordinate-care"
  | "support-family"
  | "develop-commission"
  | "refine-portfolio"
  | "deliver-project";
export type ResidentMilestoneKind = "arrival" | "life-stage" | "promotion" | "career-branch" | "aspiration" | "collection" | "move";
export type ResidentMilestone = {
  id: string;
  kind: ResidentMilestoneKind;
  title: string;
  detail: string;
  occurredAt: number;
};
export type ResidentPastime = "reading" | "gardening" | "cooking" | "socializing" | "relaxing";
export type ResidentOutfitStyle = "casual" | "smart" | "formal" | "active" | "cozy";
export type ResidentOutfitPalette = "earth" | "ocean" | "sunset" | "mono" | "bright";
export type ResidentPersonalItemKind = "book-set" | "garden-kit" | "recipe-box" | "game-set" | "comfort-kit";

export type ResidentTrait =
  | "outgoing"
  | "homebody"
  | "active"
  | "creative"
  | "organized"
  | "empathetic";

export type ResidentPersonality = {
  cleanliness: number;
  spontaneity: number;
  sociability: number;
  emotionality: number;
  activity: number;
};

export type ResidentPersonalityAxis = keyof ResidentPersonality;

export type ConversationIntent = "chat" | "support" | "joke" | "confront" | "apologize";

export type SocialMemory = {
  intent: ConversationIntent;
  relationshipChange: number;
  tensionChange: number;
  occurredAt: number;
  initiatorResidentId: string;
};

export const RESIDENT_ACTION_KINDS = ["sleep", "eat", "relax", "study", "shower", "socialize", "care", "tend-plants", "idle"] as const;
export type ResidentActionKind = (typeof RESIDENT_ACTION_KINDS)[number];
export type ResidentRoutineProfile = "early-bird" | "steady" | "night-owl" | "split-shift" | "flexible";
export type ResidentActivityPreference = {
  action: ResidentActionKind;
  repetitions: number;
  satisfaction: number;
  lastAt: number;
};
export const MAX_RESIDENT_ACTIVITY_PREFERENCES = RESIDENT_ACTION_KINDS.length;
export type ResidentSkill = "communication" | "creativity" | "wellness" | "practical";
export type ResidentSkills = Record<ResidentSkill, number>;
export type ResidentPurchaseKind = "meal-delivery" | "creative-supplies" | "wellness-care";

export type ResidentPersonalItem = {
  id: string;
  kind: ResidentPersonalItemKind;
  acquiredAt: number;
};

export const RESIDENT_PURCHASES: Record<ResidentPurchaseKind, { label: string; cost: number; effect: string }> = {
  "meal-delivery": { label: "Order a meal", cost: 35, effect: "Energy, comfort, and practical skill" },
  "creative-supplies": { label: "Buy creative supplies", cost: 90, effect: "Creativity, comfort, and calm" },
  "wellness-care": { label: "Book wellness care", cost: 120, effect: "Health, wellness, and calm" }
};

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

export type ResidentDailySchedule = {
  profile: ResidentRoutineProfile;
  dayIndex: number;
  workingToday: boolean;
  wakeMinute: number;
  sleepMinute: number;
  workWindows: Array<{ start: number; end: number }>;
  outingWindows: Array<{ start: number; end: number }>;
};

export const RESIDENT_ROUTINE_DEFINITIONS: Record<ResidentRoutineProfile, {
  label: string;
  summary: string;
  wakeMinute: number;
  sleepMinute: number;
  shiftOffset: number;
}> = {
  "early-bird": { label: "Early bird", summary: "Starts early and winds down before the city quiets", wakeMinute: 5 * 60 + 30, sleepMinute: 21 * 60 + 30, shiftOffset: -60 },
  steady: { label: "Steady rhythm", summary: "Keeps a conventional workday and evening routine", wakeMinute: 7 * 60, sleepMinute: 22 * 60 + 30, shiftOffset: 0 },
  "night-owl": { label: "Night owl", summary: "Starts later and stays active after midnight", wakeMinute: 9 * 60 + 30, sleepMinute: 60, shiftOffset: 120 },
  "split-shift": { label: "Split shift", summary: "Works two recurring blocks with a long break between", wakeMinute: 6 * 60, sleepMinute: 23 * 60, shiftOffset: 0 },
  flexible: { label: "Flexible week", summary: "Uses a stable weekday pattern with one-hour start variation", wakeMinute: 7 * 60 + 30, sleepMinute: 23 * 60 + 30, shiftOffset: 0 }
};

export type Resident = {
  id: string;
  name: string;
  age: "adult" | "child";
  lifeStage?: ResidentLifeStage;
  lifeStageDays?: number;
  lifetimeDays?: number;
  lastLifeStageChangeAt?: number;
  role: ResidentRole;
  aspiration?: ResidentAspiration;
  aspirationProgress?: number;
  careerTrack?: ResidentCareerTrack;
  careerBranch?: string;
  generation?: number;
  caregiverIds?: string[];
  decorPreference?: HomeFurnitureStyle;
  favoritePastime?: ResidentPastime;
  outfitStyle?: ResidentOutfitStyle;
  outfitPalette?: ResidentOutfitPalette;
  routineProfile?: ResidentRoutineProfile;
  activityPreferences?: ResidentActivityPreference[];
  inventory?: ResidentPersonalItem[];
  destinationLotId?: string;
  energy: number;
  social: number;
  comfort: number;
  health: number;
  stress: number;
  traits: ResidentTrait[];
  personality?: ResidentPersonality;
  currentAction?: ResidentAction;
  lastActionKind?: ResidentActionKind;
  lastActionAt?: number;
  completedActions?: number;
  homePosition?: Point2;
  homeFloor?: number;
  skills?: ResidentSkills;
  careerLevel?: number;
  careerXp?: number;
  lastWorkTask?: ResidentWorkTask;
  workPerformance?: number;
  workDaysCompleted?: number;
  lastWorkDayAt?: number;
  milestones?: ResidentMilestone[];
};

export type ResidentProfile = Pick<Resident, "name" | "age" | "role" | "traits"> & {
  personality?: ResidentPersonality;
  lifeStage?: ResidentLifeStage;
  aspiration?: ResidentAspiration;
  careerTrack?: ResidentCareerTrack;
  caregiverIds?: string[];
  inheritPersonality?: boolean;
  decorPreference?: HomeFurnitureStyle;
  favoritePastime?: ResidentPastime;
  outfitStyle?: ResidentOutfitStyle;
  outfitPalette?: ResidentOutfitPalette;
  routineProfile?: ResidentRoutineProfile;
};

export const RESIDENT_LIFE_STAGES: ResidentLifeStage[] = [
  "infant", "toddler", "child", "teen", "young-adult", "adult", "elder"
];

export const RESIDENT_LIFE_STAGE_DEFINITIONS: Record<ResidentLifeStage, {
  label: string;
  durationDays?: number;
  summary: string;
}> = {
  infant: { label: "Infant", durationDays: 60, summary: "needs constant household care" },
  toddler: { label: "Toddler", durationDays: 180, summary: "learns through play and supervision" },
  child: { label: "Child", durationDays: 720, summary: "builds friendships, skills, and interests" },
  teen: { label: "Teen", durationDays: 540, summary: "forms identity and prepares for work" },
  "young-adult": { label: "Young adult", durationDays: 1_440, summary: "establishes an independent path" },
  adult: { label: "Adult", durationDays: 3_600, summary: "balances work, family, and long-term goals" },
  elder: { label: "Elder", summary: "carries experience and mentors the household" }
};

export const RESIDENT_ASPIRATION_DEFINITIONS: Record<ResidentAspiration, { label: string; summary: string }> = {
  family: { label: "Family legacy", summary: "build close bonds and guide the next generation" },
  mastery: { label: "Master a craft", summary: "grow skills and reach the top of a chosen path" },
  community: { label: "Community pillar", summary: "support others and strengthen neighborhood ties" },
  prosperity: { label: "Household prosperity", summary: "build lasting financial security" },
  creative: { label: "Creative life", summary: "turn imagination into a practiced vocation" }
};

export const RESIDENT_CAREER_TRACK_DEFINITIONS: Record<ResidentCareerTrack, {
  label: string;
  role: ResidentRole;
  primarySkills: [ResidentSkill, ResidentSkill];
  baseWage: number;
  wageStep: number;
  branches: [string, string];
}> = {
  civic: { label: "Civic planning", role: "office", primarySkills: ["communication", "practical"], baseWage: 185, wageStep: 45, branches: ["Urban systems", "Community design"] },
  enterprise: { label: "Enterprise", role: "office", primarySkills: ["communication", "creativity"], baseWage: 205, wageStep: 48, branches: ["Operations", "Strategy"] },
  hospitality: { label: "Hospitality", role: "service", primarySkills: ["practical", "communication"], baseWage: 145, wageStep: 34, branches: ["Culinary", "Guest experience"] },
  care: { label: "Care services", role: "service", primarySkills: ["wellness", "communication"], baseWage: 165, wageStep: 38, branches: ["Clinical care", "Community wellness"] },
  creative: { label: "Creative practice", role: "office", primarySkills: ["creativity", "communication"], baseWage: 110, wageStep: 31, branches: ["Studio artist", "Independent media"] }
};

export const RESIDENT_WORK_TASK_DEFINITIONS: Record<ResidentWorkTask, {
  label: string;
  track: ResidentCareerTrack;
}> = {
  "review-permits": { label: "Review development permits", track: "civic" },
  "coordinate-street-upgrade": { label: "Coordinate a street upgrade", track: "civic" },
  "inspect-service-coverage": { label: "Inspect service coverage", track: "civic" },
  "analyze-operations": { label: "Analyze business operations", track: "enterprise" },
  "meet-clients": { label: "Meet with clients", track: "enterprise" },
  "plan-expansion": { label: "Plan a business expansion", track: "enterprise" },
  "prep-service": { label: "Prepare for service", track: "hospitality" },
  "lead-shift": { label: "Lead the service shift", track: "hospitality" },
  "resolve-guest-issue": { label: "Resolve a guest issue", track: "hospitality" },
  "complete-rounds": { label: "Complete care rounds", track: "care" },
  "coordinate-care": { label: "Coordinate a care plan", track: "care" },
  "support-family": { label: "Support a local family", track: "care" },
  "develop-commission": { label: "Develop a client commission", track: "creative" },
  "refine-portfolio": { label: "Refine the studio portfolio", track: "creative" },
  "deliver-project": { label: "Deliver a creative project", track: "creative" }
};

const RESIDENT_WORK_TASKS_BY_TRACK: Record<ResidentCareerTrack, [ResidentWorkTask, ResidentWorkTask, ResidentWorkTask]> = {
  civic: ["review-permits", "coordinate-street-upgrade", "inspect-service-coverage"],
  enterprise: ["analyze-operations", "meet-clients", "plan-expansion"],
  hospitality: ["prep-service", "lead-shift", "resolve-guest-issue"],
  care: ["complete-rounds", "coordinate-care", "support-family"],
  creative: ["develop-commission", "refine-portfolio", "deliver-project"]
};

const CAREER_WORKPLACE_SECTORS: Record<ResidentCareerTrack, [BusinessSector, BusinessSector]> = {
  civic: ["community", "office"],
  enterprise: ["office", "industrial"],
  hospitality: ["hospitality", "retail"],
  care: ["community", "hospitality"],
  creative: ["retail", "office"]
};

export const RESIDENT_MILESTONE_KINDS: ResidentMilestoneKind[] = [
  "arrival", "life-stage", "promotion", "career-branch", "aspiration", "collection", "move"
];
export const MAX_RESIDENT_MILESTONES = 12;

export const RESIDENT_PASTIME_DEFINITIONS: Record<ResidentPastime, {
  label: string;
  summary: string;
  action: ResidentActionKind;
}> = {
  reading: { label: "Reading", summary: "settles in with books and focused study", action: "study" },
  gardening: { label: "Gardening", summary: "cares for plants and restorative spaces", action: "tend-plants" },
  cooking: { label: "Cooking", summary: "turns meals into a practiced household ritual", action: "eat" },
  socializing: { label: "Social time", summary: "seeks shared conversation and games", action: "socialize" },
  relaxing: { label: "Quiet comfort", summary: "values a calm place to decompress", action: "relax" }
};

export const RESIDENT_OUTFIT_DEFINITIONS: Record<ResidentOutfitStyle, {
  label: string;
  summary: string;
}> = {
  casual: { label: "Everyday casual", summary: "layered basics for ordinary city life" },
  smart: { label: "Smart tailored", summary: "clean lines that move between home and work" },
  formal: { label: "Formal", summary: "structured pieces for occasions and leadership" },
  active: { label: "Active", summary: "sporty layers built for constant motion" },
  cozy: { label: "Cozy", summary: "soft relaxed layers for comfort at home" }
};

export const RESIDENT_OUTFIT_PALETTES: Record<ResidentOutfitPalette, {
  label: string;
  primary: number;
  secondary: number;
  accent: number;
}> = {
  earth: { label: "Earth", primary: 0x78906d, secondary: 0xc59a68, accent: 0xe4cf9d },
  ocean: { label: "Ocean", primary: 0x4e7891, secondary: 0x89b4be, accent: 0xd7e8e5 },
  sunset: { label: "Sunset", primary: 0xb86855, secondary: 0xd89a6a, accent: 0xf1d092 },
  mono: { label: "Monochrome", primary: 0x4c5155, secondary: 0xaeb4b6, accent: 0xf0eee8 },
  bright: { label: "Bright", primary: 0x7d62b0, secondary: 0xd77696, accent: 0xf2c95d }
};

export const RESIDENT_PERSONAL_ITEM_DEFINITIONS: Record<ResidentPersonalItemKind, {
  label: string;
  cost: number;
  pastime: ResidentPastime;
  skill: ResidentSkill;
  aspiration: ResidentAspiration;
}> = {
  "book-set": { label: "Personal book set", cost: 80, pastime: "reading", skill: "creativity", aspiration: "mastery" },
  "garden-kit": { label: "Garden kit", cost: 110, pastime: "gardening", skill: "wellness", aspiration: "community" },
  "recipe-box": { label: "Recipe box", cost: 95, pastime: "cooking", skill: "practical", aspiration: "prosperity" },
  "game-set": { label: "Tabletop game set", cost: 75, pastime: "socializing", skill: "communication", aspiration: "family" },
  "comfort-kit": { label: "Comfort collection", cost: 90, pastime: "relaxing", skill: "wellness", aspiration: "creative" }
};

const CAREER_TRACK_PERSONALITY_TARGETS: Record<ResidentCareerTrack, ResidentPersonality> = {
  civic: { cleanliness: 72, spontaneity: 42, sociability: 62, emotionality: 38, activity: 48 },
  enterprise: { cleanliness: 68, spontaneity: 58, sociability: 72, emotionality: 46, activity: 58 },
  hospitality: { cleanliness: 58, spontaneity: 72, sociability: 78, emotionality: 54, activity: 76 },
  care: { cleanliness: 66, spontaneity: 48, sociability: 72, emotionality: 62, activity: 60 },
  creative: { cleanliness: 42, spontaneity: 78, sociability: 48, emotionality: 68, activity: 52 }
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

export type RelationshipImpression = {
  kind: "unformed" | "steady" | "warmth" | "loyalty" | "wariness" | "resentment";
  label: string;
  strength: number;
  outcomeBias: number;
  partnerBias: number;
  summary: string;
};

export type ResidentWellbeing = {
  score: number;
  label: "Thriving" | "Stable" | "Strained" | "Critical";
  homeQuality: number;
  utilityReliability: number;
  neighborhoodSupport: number;
  commuteBurden: number;
  financialSecurity: number;
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

export type TransitTransfer = {
  lineId: string;
  lineName: string;
  stopId: string;
  otherStopId: string;
  distance: number;
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

export type Season = "winter" | "spring" | "summer" | "autumn";
export type WeatherKind = "clear" | "cloudy" | "rain" | "snow";

export type WeatherState = {
  kind: WeatherKind;
  season: Season;
  label: string;
  temperatureC: number;
  windKph: number;
  precipitation: number;
  visibility: number;
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

export type HomeFloorFinish = "oak" | "tile" | "concrete" | "carpet";
export type HomeWallFinish = "warm-white" | "sage" | "clay" | "slate";
export type HomeFurnitureStyle = "natural" | "light" | "dark" | "colorful";
export const HOME_FURNITURE_VARIANTS = ["classic", "modern", "soft"] as const;
export type HomeFurnitureVariant = typeof HOME_FURNITURE_VARIANTS[number];
export type HouseholdGatheringKind = "dinner" | "game-night" | "birthday" | "open-house";
export type HouseholdGathering = {
  id: string;
  kind: HouseholdGatheringKind;
  hostResidentId: string;
  startAt: number;
  durationMinutes: number;
  guestCount: number;
  cost: number;
  completedAt?: number;
  attendance?: number;
  relationshipGain?: number;
};
export const HOME_ROOM_KINDS = ["Living room", "Bedroom", "Kitchen", "Bathroom", "Study", "Dining room", "Nursery", "Studio"] as const;
export type HomeRoomKind = typeof HOME_ROOM_KINDS[number];

export type HomeRoom = {
  id: string;
  kind: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  floorFinish?: HomeFloorFinish;
  wallFinish?: HomeWallFinish;
  floor?: number;
  condition?: number;
  lastRenovatedAt?: number;
  assignedResidentIds?: string[];
};

export type HomeStair = {
  id: string;
  x: number;
  z: number;
  rotation: number;
  fromFloor: number;
  toFloor: number;
};

export type HomeWindowGlazing = "clear" | "privacy";

export type HomeWindow = {
  id: string;
  roomId: string;
  floor: number;
  orientation: "x" | "z";
  side: "negative" | "positive";
  boundary: number;
  center: number;
  width: number;
  glazing: HomeWindowGlazing;
};

export type HomeDoorWidth = "standard" | "wide";

export type HomeDoor = {
  id: string;
  roomIds: [string, string];
  floor: number;
  orientation: "x" | "z";
  boundary: number;
  center: number;
  width: number;
  widthKind: HomeDoorWidth;
};

export type HomeRoofStyle = "gable" | "hip" | "flat" | "green";
export type HomeFoundationStyle = "slab" | "crawlspace" | "raised";

export type Home = {
  id: string;
  lotId: string;
  name: string;
  floors: number;
  rooms: HomeRoom[];
  furniture: Array<{ id: string; kind: "sofa" | "table" | "bed" | "plant" | "desk" | "bookcase" | "fridge" | "shower"; x: number; z: number; rotation: number; style?: HomeFurnitureStyle; variant?: HomeFurnitureVariant; tint?: string; floor?: number; ownerResidentId?: string; condition?: number; lastRepairedAt?: number }>;
  stairs?: HomeStair[];
  windows?: HomeWindow[];
  doors?: HomeDoor[];
  roofStyle?: HomeRoofStyle;
  roofColor?: string;
  foundationStyle?: HomeFoundationStyle;
  designBudget: number;
  designSpent: number;
  householdFunds?: number;
  lastDailyIncome?: number;
  lastDailyExpenses?: number;
  lastDailyUtilityCost?: number;
  discretionarySpent?: number;
  lastPurchase?: { kind: ResidentPurchaseKind; residentId: string; cost: number; at: number };
  gatherings?: HouseholdGathering[];
  residents: Resident[];
  relationships: ResidentRelationship[];
};

export type HomeExteriorWall = {
  orientation: "x" | "z";
  boundary: number;
  start: number;
  end: number;
  side: "negative" | "positive";
};

export function homeRoomExteriorWalls(home: Home, room: HomeRoom): HomeExteriorWall[] {
  const candidates: HomeExteriorWall[] = [
    { orientation: "z", boundary: room.z - room.depth / 2, start: room.x - room.width / 2, end: room.x + room.width / 2, side: "negative" },
    { orientation: "z", boundary: room.z + room.depth / 2, start: room.x - room.width / 2, end: room.x + room.width / 2, side: "positive" },
    { orientation: "x", boundary: room.x - room.width / 2, start: room.z - room.depth / 2, end: room.z + room.depth / 2, side: "negative" },
    { orientation: "x", boundary: room.x + room.width / 2, start: room.z - room.depth / 2, end: room.z + room.depth / 2, side: "positive" }
  ];
  const sameFloorRooms = home.rooms.filter(candidate => candidate.id !== room.id && homeEntityFloor(candidate) === homeEntityFloor(room));
  return candidates.flatMap(wall => {
    const covered = sameFloorRooms.flatMap(candidate => {
      const candidateBoundaries = wall.orientation === "z"
        ? [candidate.z - candidate.depth / 2, candidate.z + candidate.depth / 2]
        : [candidate.x - candidate.width / 2, candidate.x + candidate.width / 2];
      if (!candidateBoundaries.some(boundary => Math.abs(boundary - wall.boundary) < .12)) return [];
      const candidateStart = wall.orientation === "z" ? candidate.x - candidate.width / 2 : candidate.z - candidate.depth / 2;
      const candidateEnd = wall.orientation === "z" ? candidate.x + candidate.width / 2 : candidate.z + candidate.depth / 2;
      const start = Math.max(wall.start, candidateStart);
      const end = Math.min(wall.end, candidateEnd);
      return end - start > .2 ? [{ start, end }] : [];
    }).sort((a, b) => a.start - b.start);
    let segments = [{ start: wall.start, end: wall.end }];
    for (const interval of covered) {
      segments = segments.flatMap(segment => {
        if (interval.end <= segment.start || interval.start >= segment.end) return [segment];
        const result: Array<{ start: number; end: number }> = [];
        if (interval.start - segment.start > .2) result.push({ start: segment.start, end: interval.start });
        if (segment.end - interval.end > .2) result.push({ start: interval.end, end: segment.end });
        return result;
      });
    }
    return segments.map(segment => ({ ...wall, ...segment }));
  });
}

export type HomeSharedWall = {
  orientation: "x" | "z";
  boundary: number;
  start: number;
  end: number;
  roomIds: [string, string];
  floor: number;
};

export function homeSharedWallSegments(home: Home): HomeSharedWall[] {
  const walls: HomeSharedWall[] = [];
  for (let firstIndex = 0; firstIndex < home.rooms.length; firstIndex += 1) {
    const first = home.rooms[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < home.rooms.length; secondIndex += 1) {
      const second = home.rooms[secondIndex];
      const floor = homeEntityFloor(first);
      if (floor !== homeEntityFloor(second)) continue;
      const firstLeft = first.x - first.width / 2;
      const firstRight = first.x + first.width / 2;
      const firstBack = first.z - first.depth / 2;
      const firstFront = first.z + first.depth / 2;
      const secondLeft = second.x - second.width / 2;
      const secondRight = second.x + second.width / 2;
      const secondBack = second.z - second.depth / 2;
      const secondFront = second.z + second.depth / 2;
      const zStart = Math.max(firstBack, secondBack);
      const zEnd = Math.min(firstFront, secondFront);
      const xBoundary = Math.abs(firstRight - secondLeft) <= .3
        ? (firstRight + secondLeft) / 2
        : Math.abs(secondRight - firstLeft) <= .3
          ? (secondRight + firstLeft) / 2
          : undefined;
      if (xBoundary !== undefined && zEnd - zStart >= 1.1) {
        walls.push({ orientation: "x", boundary: xBoundary, start: zStart, end: zEnd, roomIds: [first.id, second.id], floor });
      }
      const xStart = Math.max(firstLeft, secondLeft);
      const xEnd = Math.min(firstRight, secondRight);
      const zBoundary = Math.abs(firstFront - secondBack) <= .3
        ? (firstFront + secondBack) / 2
        : Math.abs(secondFront - firstBack) <= .3
          ? (secondFront + firstBack) / 2
          : undefined;
      if (zBoundary !== undefined && xEnd - xStart >= 1.1) {
        walls.push({ orientation: "z", boundary: zBoundary, start: xStart, end: xEnd, roomIds: [first.id, second.id], floor });
      }
    }
  }
  return walls;
}

export const HOME_BUILD_COSTS = {
  roomPerSquareMeter: 220,
  floorShell: 12_000,
  stairs: 4_800,
  window: 900,
  privacyGlazing: 200,
  door: 1_400,
  wideDoor: 400,
  roof: 2_800,
  greenRoof: 2_200,
  foundation: 4_000,
  crawlspaceFoundation: 2_500,
  raisedFoundation: 6_000,
  sofa: 1_400,
  table: 650,
  bed: 1_200,
  plant: 120,
  desk: 900,
  bookcase: 720,
  fridge: 1_100,
  shower: 1_650
} as const;

export function defaultHomeRoofStyle(templateId: WorldTemplate["id"]): HomeRoofStyle {
  if (templateId === "houston" || templateId === "nyc" || templateId === "blank") return "flat";
  if (templateId === "seattle") return "green";
  if (templateId === "portland") return "gable";
  return "hip";
}

export function defaultHomeRoofColor(templateId: WorldTemplate["id"]) {
  return {
    nyc: "#5e5148",
    chicago: "#4f5960",
    houston: "#b8b2a5",
    seattle: "#587052",
    portland: "#6c4c3d",
    blank: "#625044"
  }[templateId];
}

export function defaultHomeFoundationStyle(templateId: WorldTemplate["id"]): HomeFoundationStyle {
  if (templateId === "houston") return "raised";
  if (templateId === "seattle" || templateId === "portland") return "crawlspace";
  return "slab";
}

export const HOUSEHOLD_GATHERING_DEFINITIONS: Record<HouseholdGatheringKind, {
  label: string;
  summary: string;
  cost: number;
  durationMinutes: number;
  baseGuests: number;
  relationshipGain: number;
}> = {
  dinner: { label: "Shared dinner", summary: "a hosted meal with close friends", cost: 140, durationMinutes: 120, baseGuests: 3, relationshipGain: 5 },
  "game-night": { label: "Game night", summary: "a playful evening built around conversation", cost: 90, durationMinutes: 150, baseGuests: 4, relationshipGain: 6 },
  birthday: { label: "Birthday celebration", summary: "a milestone gathering for the whole household", cost: 220, durationMinutes: 180, baseGuests: 6, relationshipGain: 8 },
  "open-house": { label: "Open house", summary: "a larger neighborhood welcome", cost: 320, durationMinutes: 210, baseGuests: 8, relationshipGain: 4 }
};

export const MAX_HOUSEHOLD_GATHERINGS = 8;

export const MAX_HOME_FLOORS = 4;

export function homeEntityFloor(entity: { floor?: number }) {
  return Math.max(0, Math.round(entity.floor ?? 0));
}

export function homeFloorView(home: Home, floor: number): Home {
  const normalizedFloor = Math.max(0, Math.min(home.floors - 1, Math.round(floor)));
  return {
    ...home,
    rooms: home.rooms.filter(room => homeEntityFloor(room) === normalizedFloor),
    furniture: home.furniture.filter(item => homeEntityFloor(item) === normalizedFloor),
    stairs: (home.stairs ?? []).filter(stair => stair.fromFloor === normalizedFloor || stair.toFloor === normalizedFloor),
    windows: home.windows?.filter(window => window.floor === normalizedFloor),
    doors: home.doors?.filter(door => door.floor === normalizedFloor),
    residents: home.residents.filter(resident => Math.max(0, Math.round(resident.homeFloor ?? 0)) === normalizedFloor)
  };
}

export const HOME_FINISH_COSTS = {
  floor: { oak: 55, tile: 65, concrete: 32, carpet: 38 },
  wall: { "warm-white": 5, sage: 8, clay: 10, slate: 12 }
} as const;

export const HOME_FURNITURE_SIZE: Record<Home["furniture"][number]["kind"], { width: number; depth: number }> = {
  sofa: { width: 2.2, depth: .85 },
  table: { width: 1.6, depth: 1.6 },
  bed: { width: 1.7, depth: 2.1 },
  plant: { width: .65, depth: .65 },
  desk: { width: 1.6, depth: .75 },
  bookcase: { width: 1.2, depth: .38 },
  fridge: { width: .9, depth: .78 },
  shower: { width: 1.05, depth: 1.05 }
};

const HOME_FURNITURE_PURPOSES: Record<Home["furniture"][number]["kind"], readonly HomeRoomKind[] | "any"> = {
  sofa: ["Living room", "Studio"],
  table: ["Dining room", "Kitchen", "Living room"],
  bed: ["Bedroom", "Nursery", "Studio"],
  plant: "any",
  desk: ["Study", "Bedroom", "Studio"],
  bookcase: ["Study", "Living room", "Bedroom", "Studio"],
  fridge: ["Kitchen"],
  shower: ["Bathroom"]
};

const HOME_ROOM_STARTER_SETS: Record<HomeRoomKind, readonly Home["furniture"][number]["kind"][]> = {
  "Living room": ["sofa", "table", "plant"],
  Bedroom: ["bed", "bookcase"],
  Kitchen: ["fridge", "table"],
  Bathroom: ["shower", "plant"],
  Study: ["desk", "bookcase", "plant"],
  "Dining room": ["table", "plant"],
  Nursery: ["bed", "bookcase", "plant"],
  Studio: ["sofa", "bed", "desk"]
};

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

export type SpatialRenderPlan = {
  agentChunks: SpatialChunk[];
  activeChunks: SpatialChunk[];
  aggregateChunks: SpatialChunk[];
  detailedLotIds: string[];
  detailedRoadIds: string[];
  aggregateLotCount: number;
};

export type WorldSnapshot = {
  version: 1;
  cityName?: string;
  templateId?: WorldTemplate["id"];
  roads: Road[];
  areas?: Area[];
  lots: Lot[];
  homes: Home[];
  services?: CityService[];
  utilities?: UtilityLine[];
  clock?: SimulationClock;
  serviceFunding?: number;
  taxPolicy?: TaxPolicy;
  districtPolicies?: Record<string, DistrictPolicy[]>;
  municipalBonds?: MunicipalBond[];
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
  privateSectorRevenue: number;
  privateSectorProfit: number;
  monthlyRevenue: number;
  monthlyCosts: number;
  monthlyBalance: number;
  residentialTaxRevenue: number;
  commercialTaxRevenue: number;
  industrialTaxRevenue: number;
  districtPolicyCosts: number;
  debtPayments: number;
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

export const RESIDENT_PERSONALITY_AXES: ResidentPersonalityAxis[] = [
  "cleanliness",
  "spontaneity",
  "sociability",
  "emotionality",
  "activity"
];

const RESIDENT_PERSONALITY_LABELS: Record<ResidentPersonalityAxis, string> = {
  cleanliness: "Cleanliness",
  spontaneity: "Spontaneity",
  sociability: "Sociability",
  emotionality: "Emotional intensity",
  activity: "Activity"
};

export class World {
  cityName = "New Gridless City";
  templateId: WorldTemplate["id"] = "nyc";
  roads: Road[] = [];
  areas: Area[] = [];
  lots: Lot[] = [];
  homes: Home[] = [];
  services: CityService[] = [];
  utilities: UtilityLine[] = [];
  clock: SimulationClock = { year: 1, month: 1, day: 1, minute: 8 * 60, treasury: 25_000_000, elapsedMinutes: 0 };
  serviceFunding = .85;
  taxPolicy: TaxPolicy = { residential: 10, commercial: 10, industrial: 10 };
  districtPolicies: Record<string, DistrictPolicy[]> = {};
  municipalBonds: MunicipalBond[] = [];
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
  private future: WorldSnapshot[] = [];
  private revision = 0;

  constructor() {
    this.roads = clone(NYC_TEMPLATE.roads).map(normalizeRoadRecord);
    this.areas = clone(NYC_TEMPLATE.areas);
    this.rebuildLots();
    this.parking = initialParking(this.roads);
    this.transitLines = initialTransitLines(this.roads);
    this.cityEvents = initialCityEvents(this.roads);
    this.rebuildAccessibilityEntrances();
  }

  weather(): WeatherState {
    const { year, month, day } = this.clock;
    const season: Season = month === 12 || month <= 2
      ? "winter"
      : month <= 5
        ? "spring"
        : month <= 8
          ? "summer"
          : "autumn";
    const climate = TEMPLATE_REGIONAL_CONFIGS[this.templateId].climate;
    const seed = hashString(this.templateId === "nyc"
      ? `weather:${year}:${month}:${day}`
      : `weather:${this.templateId}:${year}:${month}:${day}`);
    const roll = seed % 100;
    const wetThreshold = climate.wetThreshold[season];
    const kind: WeatherKind = season === "winter" && roll < climate.snowThreshold
      ? "snow"
      : roll < wetThreshold
        ? "rain"
        : roll < wetThreshold + 27
          ? "cloudy"
          : "clear";
    const monthlyTemperature = climate.monthlyTemperature[month - 1];
    const temperatureC = monthlyTemperature + Math.floor(seed / 101) % 9 - 4;
    const precipitation = kind === "rain" ? .72 + (seed % 19) / 100 : kind === "snow" ? .58 + (seed % 17) / 100 : 0;
    const visibility = kind === "rain" ? .58 : kind === "snow" ? .66 : kind === "cloudy" ? .82 : 1;
    const labels: Record<WeatherKind, string> = {
      clear: "Clear",
      cloudy: "Cloudy",
      rain: "Rain",
      snow: "Snow"
    };
    return {
      kind,
      season,
      label: labels[kind],
      temperatureC,
      windKph: climate.windBase + Math.floor(seed / 17) % 27,
      precipitation,
      visibility
    };
  }

  snapshot(): WorldSnapshot {
    this.refreshSpatialChunks();
    return clone({
      version: 1,
      cityName: this.cityName,
      templateId: this.templateId,
      roads: this.roads,
      areas: this.areas,
      lots: this.lots,
      homes: this.homes,
      services: this.services,
      utilities: this.utilities,
      clock: this.clock,
      serviceFunding: this.serviceFunding,
      taxPolicy: this.taxPolicy,
      districtPolicies: this.districtPolicies,
      municipalBonds: this.municipalBonds,
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

  spatialRenderPlan(focus: Point2): SpatialRenderPlan {
    this.refreshSpatialChunks();
    const agentChunks: SpatialChunk[] = [];
    const activeChunks: SpatialChunk[] = [];
    const aggregateChunks: SpatialChunk[] = [];
    for (const chunk of this.spatialChunks) {
      const tier = this.spatialDetailTier(chunk, focus);
      if (tier === "agent") agentChunks.push(chunk);
      else if (tier === "active") activeChunks.push(chunk);
      else aggregateChunks.push(chunk);
    }
    const detailedChunks = [...agentChunks, ...activeChunks];
    return {
      agentChunks,
      activeChunks,
      aggregateChunks,
      detailedLotIds: [...new Set(detailedChunks.flatMap(chunk => chunk.lotIds))].sort(),
      detailedRoadIds: [...new Set(detailedChunks.flatMap(chunk => chunk.roadIds))].sort(),
      aggregateLotCount: aggregateChunks.reduce((total, chunk) => total + chunk.lotIds.length, 0)
    };
  }

  private checkpoint() {
    this.history.push(this.snapshot());
    if (this.history.length > 40) this.history.shift();
    this.future = [];
    this.revision++;
  }

  roadProfile(road: Road) {
    return normalizeRoadProfile(road.profile, road.class ?? "street");
  }

  roadCapacity(road: Road) {
    return roadCapacityForProfile(this.roadProfile(road), road.class ?? "street");
  }

  roadStructure(road: Road) {
    return normalizeRoadStructure(road.structure, road.elevationMeters);
  }

  roadConstructionImpact(
    points: Point2[],
    authoredProfile: Partial<RoadProfile>,
    authoredStructure: RoadStructure = "surface",
    authoredElevationMeters = 0
  ): RoadConstructionImpact {
    const profile = normalizeRoadProfile(authoredProfile);
    const structure = normalizeRoadStructure(authoredStructure, authoredElevationMeters);
    const lengthMeters = Math.round(routeLength(points));
    const cost = roadConstructionCost(points, profile, structure.structure, structure.elevationMeters);
    if (points.length < 2) {
      return {
        lengthMeters,
        cost,
        frontageLots: 0,
        parcelConflicts: 0,
        developedParcelConflicts: 0,
        roadCrossings: 0,
        gradeSeparatedCrossings: 0,
        networkConnections: 0,
        waterSections: 0,
        accessible: false,
        affordable: this.clock.treasury >= cost,
        canBuild: false,
        status: "incomplete"
      };
    }
    const width = roadWidthForProfile(profile);
    const parcelConflicts = this.lots.filter(lot =>
      distanceToPolyline(lot.center, points) < width / 2 + Math.min(lot.width, lot.depth) * .32
    );
    const developedParcelConflicts = parcelConflicts.filter(lot =>
      lot.zone !== "unassigned" || lot.households > 0 || lot.businesses > 0 || Boolean(lot.homeId)
    ).length;
    const waterAreas = this.areas.filter(area => area.kind === "water");
    const waterSections = points.slice(0, -1).filter((point, index) => {
      const next = points[index + 1];
      const sampleCount = Math.max(2, Math.ceil(Math.hypot(next.x - point.x, next.z - point.z) / 10));
      const samples = Array.from({ length: sampleCount + 1 }, (_, sampleIndex) => ({
        x: point.x + (next.x - point.x) * sampleIndex / sampleCount,
        z: point.z + (next.z - point.z) * sampleIndex / sampleCount
      }));
      return samples.some(sample => waterAreas.some(area => pointInPolygon(sample, area.points)));
    }).length;
    let frontageLots = 0;
    if (structure.structure === "surface") {
      const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(point.x, 0, point.z)), false, "centripetal");
      const count = Math.max(1, Math.floor(curve.getLength() / 28));
      const candidates: Point2[] = [];
      for (let index = 1; index < count; index += 1) {
        const progress = index / count;
        const center = curve.getPoint(progress);
        const tangent = curve.getTangent(progress).normalize();
        for (const side of [-1, 1]) {
          const offset = width / 2 + 10;
          const candidate = {
            x: center.x + tangent.z * side * offset,
            z: center.z - tangent.x * side * offset
          };
          if (this.areas.some(area => (area.kind === "park" || area.kind === "water") && pointInPolygon(candidate, area.points))) continue;
          if (this.lots.some(lot => Math.hypot(lot.center.x - candidate.x, lot.center.z - candidate.z) < 16)) continue;
          if (candidates.some(existing => Math.hypot(existing.x - candidate.x, existing.z - candidate.z) < 16)) continue;
          candidates.push(candidate);
        }
      }
      frontageLots = candidates.length;
    }
    const crossingRoads = this.roads.filter(road => polylinesCross(points, road.points));
    const sameLevel = (road: Road) => {
      const roadStructure = this.roadStructure(road);
      return roadStructure.structure === structure.structure
        && Math.abs(roadStructure.elevationMeters - structure.elevationMeters) < 1;
    };
    const roadCrossings = crossingRoads.filter(sameLevel).length;
    const gradeSeparatedCrossings = crossingRoads.length - roadCrossings;
    const networkConnections = points.filter(point => this.roads.some(road =>
      sameLevel(road) && distanceToPolyline(point, road.points) <= 12
    )).length;
    const affordable = this.clock.treasury >= cost;
    const waterConflict = structure.structure === "surface" && waterSections > 0;
    const status: RoadConstructionImpact["status"] = parcelConflicts.length
      ? "parcel-conflict"
      : waterConflict
        ? "water-conflict"
        : !affordable
          ? "funding"
          : "ready";
    return {
      lengthMeters,
      cost,
      frontageLots,
      parcelConflicts: parcelConflicts.length,
      developedParcelConflicts,
      roadCrossings,
      gradeSeparatedCrossings,
      networkConnections,
      waterSections,
      accessible: structure.structure === "surface" && profile.sidewalkWidth >= 1.5,
      affordable,
      canBuild: status === "ready",
      status
    };
  }

  addRoad(
    points: Point2[],
    width = 10,
    roadClass: RoadClass = "street",
    authoredProfile?: Partial<RoadProfile>,
    authoredStructure: RoadStructure = "surface",
    authoredElevationMeters = 0
  ) {
    if (points.length < 2) return false;
    const profile = normalizeRoadProfile(authoredProfile, roadClass);
    const structure = normalizeRoadStructure(authoredStructure, authoredElevationMeters);
    const impact = this.roadConstructionImpact(points, profile, structure.structure, structure.elevationMeters);
    const constructionCost = impact.cost;
    if (!impact.canBuild) return false;
    this.checkpoint();
    this.clock.treasury -= constructionCost;
    this.roads.push({
      id: crypto.randomUUID(),
      points: clone(points),
      width: authoredProfile ? roadWidthForProfile(profile) : width,
      class: roadClass,
      profile,
      ...structure,
      developable: structure.structure === "surface",
      name: `New ${roadClass}`
    });
    this.rebuildLots();
    if (!this.transitLines.length) this.transitLines = initialTransitLines(this.roads);
    this.rebuildAccessibilityEntrances();
    return true;
  }

  updateRoadProfile(
    roadId: string,
    authoredProfile: Partial<RoadProfile>,
    authoredClass?: RoadClass,
    authoredStructure?: RoadStructure,
    authoredElevationMeters?: number
  ) {
    const road = this.roads.find(candidate => candidate.id === roadId);
    if (!road) return { ok: false, cost: 0, reason: "Choose a road to update" };
    const roadClass = authoredClass ?? road.class ?? "street";
    const profile = normalizeRoadProfile(authoredProfile, roadClass);
    const structure = normalizeRoadStructure(authoredStructure ?? road.structure, authoredElevationMeters ?? road.elevationMeters);
    const currentStructure = this.roadStructure(road);
    const unchanged = roadClass === (road.class ?? "street")
      && JSON.stringify(profile) === JSON.stringify(this.roadProfile(road))
      && structure.structure === currentStructure.structure
      && structure.elevationMeters === currentStructure.elevationMeters;
    if (unchanged) return { ok: false, cost: 0, reason: "That road already uses this profile" };
    const upgradeCost = Math.max(25_000, Math.round(roadConstructionCost(road.points, profile, structure.structure, structure.elevationMeters) * .35 / 1_000) * 1_000);
    if (this.clock.treasury < upgradeCost) {
      return { ok: false, cost: upgradeCost, reason: `This retrofit needs $${upgradeCost.toLocaleString()}` };
    }
    this.checkpoint();
    this.clock.treasury -= upgradeCost;
    road.class = roadClass;
    road.profile = profile;
    road.structure = structure.structure;
    road.elevationMeters = structure.elevationMeters;
    road.width = roadWidthForProfile(profile);
    const hasExistingFrontage = this.lots.some(lot => lot.roadId === road.id);
    const wasDevelopable = road.developable !== false;
    if (structure.structure === "surface") road.developable = true;
    else if (!hasExistingFrontage) road.developable = false;
    if (wasDevelopable !== (road.developable !== false)) this.rebuildLots();
    this.rebuildAccessibilityEntrances();
    return { ok: true, cost: upgradeCost, reason: `${road.name ?? "Road"} profile updated` };
  }

  lotDensity(lot: Lot): LotDensity {
    return lot.density === "low" || lot.density === "high" ? lot.density : "medium";
  }

  lotDevelopmentCapacity(lot: Lot) {
    const density = this.lotDensity(lot);
    return {
      density,
      households: Math.round(targetHouseholds(lot.zone, hashString(lot.id), density)),
      businesses: Math.round(targetBusinesses(lot.zone, hashString(lot.id), density))
    };
  }

  zoneLot(lotId: string, zone: Zone, density?: LotDensity) {
    const lot = this.lots.find(item => item.id === lotId);
    if (!lot) return false;
    const nextDensity = density === "low" || density === "high" ? density : "medium";
    if (lot.zone === zone && this.lotDensity(lot) === nextDensity) return false;
    this.checkpoint();
    lot.zone = zone;
    lot.density = nextDensity;
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
    const scheduledHeadway = this.activeCityEvents(elapsedMinute)
      .filter(event => event.temporaryTransitLineId === line.id)
      .reduce(
        (headway, event) => Math.min(
          headway,
          Math.round(clamp(event.temporaryTransitHeadwayMinutes ?? headway, 4, 30))
        ),
        line.headwayMinutes
      );
    const sourceRoad = this.roads.find(road => road.id === line.roadId);
    return sourceRoad && this.roadProfile(sourceRoad).busLanes
      ? Math.max(4, Math.round(scheduledHeadway * .84))
      : scheduledHeadway;
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

  setTransitLineName(lineId: string, requestedName: string) {
    const line = this.transitLines.find(item => item.id === lineId);
    if (!line) return false;
    const name = requestedName.trim().replace(/\s+/g, " ").slice(0, 32);
    if (
      !name
      || !/^[\p{L}\p{M}\p{N} &'().-]+$/u.test(name)
      || this.transitLines.some(item => item.id !== lineId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
      || line.name === name
    ) return false;
    this.checkpoint();
    line.name = name;
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

  transitTransfersAtStop(line: TransitLine, stop: TransitStop, maximumDistance = 55): TransitTransfer[] {
    return this.transitLines
      .filter(otherLine => otherLine.id !== line.id)
      .map(otherLine => {
        const closest = otherLine.stops
          .map(otherStop => ({
            otherStop,
            distance: distance(stop.position, otherStop.position)
          }))
          .sort((first, second) => first.distance - second.distance)[0];
        return closest && closest.distance <= maximumDistance
          ? {
              lineId: otherLine.id,
              lineName: otherLine.name,
              stopId: stop.id,
              otherStopId: closest.otherStop.id,
              distance: closest.distance
            }
          : undefined;
      })
      .filter((transfer): transfer is TransitTransfer => Boolean(transfer));
  }

  transitTransfersForLine(line: TransitLine, maximumDistance = 55) {
    const closestByLine = new Map<string, TransitTransfer>();
    for (const stop of line.stops) {
      for (const transfer of this.transitTransfersAtStop(line, stop, maximumDistance)) {
        const previous = closestByLine.get(transfer.lineId);
        if (!previous || transfer.distance < previous.distance) closestByLine.set(transfer.lineId, transfer);
      }
    }
    return [...closestByLine.values()].sort((first, second) => first.distance - second.distance);
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
    const transferFactor = 1 + Math.min(.48, this.transitTransfersAtStop(line, stop).length * .16);
    return Math.max(0, (localDemand * timeFactor + eventDemand) * frequencyFactor * fareFactor * accessFactor * transferFactor);
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

  setTaxRate(category: TaxCategory, rate: number) {
    if (!(["residential", "commercial", "industrial"] as TaxCategory[]).includes(category)) return false;
    const normalized = normalizeTaxRate(rate);
    if (this.taxPolicy[category] === normalized) return false;
    this.checkpoint();
    this.taxPolicy[category] = normalized;
    return true;
  }

  districtForLot(lot: Lot) {
    return this.areas.find(area => area.kind === "district" && pointInPolygon(lot.center, area.points));
  }

  lotFloodRisk(lot: Lot): FloodRisk {
    const floodplains = this.areas.filter(area =>
      area.kind === "floodplain" && pointInPolygon(lot.center, area.points)
    );
    if (floodplains.some(area => area.floodRisk === "high")) return "high";
    if (floodplains.length) return "moderate";
    return "none";
  }

  lotFloodRiskScore(lot: Lot) {
    const risk = this.lotFloodRisk(lot);
    return risk === "high" ? 1 : risk === "moderate" ? .55 : 0;
  }

  lotTerrainSlope(lot: Lot): TerrainSlope {
    const slopes = this.areas.filter(area => area.kind === "slope" && pointInPolygon(lot.center, area.points));
    if (slopes.some(area => area.terrainSlope === "steep")) return "steep";
    if (slopes.length) return "moderate";
    return "flat";
  }

  lotTerrainSlopeScore(lot: Lot) {
    const slope = this.lotTerrainSlope(lot);
    return slope === "steep" ? .85 : slope === "moderate" ? .45 : 0;
  }

  lotEnvironmentalConstraintScore(lot: Lot) {
    return Math.max(
      this.lotFloodRiskScore(lot),
      this.lotTerrainSlopeScore(lot),
      this.lotGrowthBoundaryStatus(lot) === "outside" ? .7 : 0
    );
  }

  lotEnvironmentalQuality(lot: Lot): EnvironmentalQuality {
    const road = this.roads.find(candidate => candidate.id === lot.roadId);
    const profile = road ? this.roadProfile(road) : ROAD_PROFILE_PRESETS.street;
    const traffic = road ? this.roadTrafficPressure(road) : 0;
    const policies = this.districtPoliciesForLot(lot);
    const industrialPressure = clamp(this.lots.reduce((total, candidate) => {
      if (candidate.zone !== "industrial" || this.constructionProgress(candidate) < 1) return total;
      const proximity = clamp(1 - distance(lot.center, candidate.center) / 190, 0, 1);
      return total + proximity * (.08 + Math.min(.24, candidate.businesses / 70));
    }, 0), 0, 1);
    const facilityPressure = clamp(this.services.reduce((total, service) => {
      if (service.kind !== "waste" && service.kind !== "sewage" && service.kind !== "power") return total;
      const proximity = clamp(1 - distance(lot.center, service.position) / 240, 0, 1);
      const intensity = service.kind === "waste" ? .32 : service.kind === "sewage" ? .27 : .18;
      return total + proximity * intensity;
    }, 0), 0, 1);
    const parkDistance = this.areas
      .filter(area => area.kind === "park")
      .reduce((closest, park) => Math.min(closest, distance(lot.center, polygonCenter(park.points))), Number.POSITIVE_INFINITY);
    const parkBuffer = Number.isFinite(parkDistance) ? clamp(1 - parkDistance / 340, 0, 1) : 0;
    const treeBuffer = profile.streetTrees ? .16 : 0;
    const freightRelief = policies.includes("heavy-traffic-ban") ? .2 : 0;
    const recyclingRelief = policies.includes("recycling") ? .22 : 0;
    const noiseLevel = Math.round(clamp(
      traffic * 68
      + Math.max(0, profile.speedLimitKph - 20) * .6
      + industrialPressure * 24
      - freightRelief * 100
      - treeBuffer * 24,
      0,
      100
    ));
    const groundPollution = Math.round(clamp(
      industrialPressure * 62
      + facilityPressure * 48
      - recyclingRelief * 100
      - parkBuffer * 10,
      0,
      100
    ));
    const airQuality = Math.round(clamp(
      100
      - traffic * 38
      - industrialPressure * 34
      - facilityPressure * 18
      + treeBuffer * 42
      + parkBuffer * 9
      + freightRelief * 32,
      0,
      100
    ));
    const score = Math.round(clamp(
      airQuality * .4 + (100 - noiseLevel) * .35 + (100 - groundPollution) * .25,
      0,
      100
    ));
    const sources = [
      traffic >= .55 || profile.speedLimitKph >= 60 ? "road traffic" : undefined,
      industrialPressure >= .16 ? "nearby industry" : undefined,
      facilityPressure >= .12 ? "municipal processing" : undefined
    ].filter((source): source is string => Boolean(source));
    const mitigations = [
      profile.streetTrees ? "street trees" : undefined,
      parkBuffer >= .3 ? "park buffer" : undefined,
      policies.includes("heavy-traffic-ban") ? "heavy traffic ban" : undefined,
      policies.includes("recycling") ? "recycling policy" : undefined
    ].filter((mitigation): mitigation is string => Boolean(mitigation));
    return {
      score,
      label: score >= 78 ? "Healthy" : score >= 60 ? "Fair" : score >= 42 ? "Strained" : "Unhealthy",
      airQuality,
      noiseLevel,
      groundPollution,
      sources,
      mitigations
    };
  }

  lotGrowthBoundaryStatus(lot: Lot): GrowthBoundaryStatus {
    const boundary = this.areas.find(area => area.kind === "growth-boundary");
    if (!boundary) return "inside";
    return pointInPolygon(lot.center, boundary.points) ? "inside" : "outside";
  }

  districtPoliciesForLot(lot: Lot) {
    const district = this.districtForLot(lot);
    return district ? this.districtPolicies[district.id] ?? [] : [];
  }

  setDistrictPolicy(areaId: string, policy: DistrictPolicy, enabled: boolean) {
    const district = this.areas.find(area => area.id === areaId && area.kind === "district");
    if (!district || !DISTRICT_POLICY_DEFINITIONS[policy]) return false;
    const current = this.districtPolicies[areaId] ?? [];
    const hasPolicy = current.includes(policy);
    if (hasPolicy === enabled) return false;
    this.checkpoint();
    const next = enabled
      ? [...current, policy]
      : current.filter(candidate => candidate !== policy);
    if (next.length) this.districtPolicies[areaId] = next;
    else delete this.districtPolicies[areaId];
    return true;
  }

  districtPolicyMonthlyCost() {
    return Object.values(this.districtPolicies).reduce(
      (total, policies) => total + policies.reduce(
        (districtTotal, policy) => districtTotal + DISTRICT_POLICY_DEFINITIONS[policy].monthlyCost,
        0
      ),
      0
    );
  }

  issueMunicipalBond(amount: number) {
    const supportedAmounts = [5_000_000, 15_000_000, 40_000_000];
    if (!supportedAmounts.includes(amount) || this.municipalBonds.length >= 3) return undefined;
    const annualInterestRate = amount >= 40_000_000 ? .062 : amount >= 15_000_000 ? .052 : .044;
    const monthsRemaining = 120;
    const monthlyRate = annualInterestRate / 12;
    const monthlyPayment = Math.round(amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -monthsRemaining)));
    this.checkpoint();
    const bond: MunicipalBond = {
      id: crypto.randomUUID(),
      originalPrincipal: amount,
      balance: amount,
      annualInterestRate,
      monthlyPayment,
      monthsRemaining,
      issuedAt: this.clock.elapsedMinutes
    };
    this.municipalBonds.push(bond);
    this.clock.treasury += amount;
    return bond;
  }

  repayMunicipalDebt(amount: number) {
    const payment = Math.round(Math.max(0, amount));
    const totalDebt = this.municipalBonds.reduce((total, bond) => total + bond.balance, 0);
    if (!payment || payment > this.clock.treasury || !totalDebt) return false;
    this.checkpoint();
    this.clock.treasury -= Math.min(payment, totalDebt);
    let remaining = Math.min(payment, totalDebt);
    for (const bond of this.municipalBonds) {
      const applied = Math.min(remaining, bond.balance);
      bond.balance = Math.max(0, bond.balance - applied);
      remaining -= applied;
      if (remaining <= 0) break;
    }
    this.municipalBonds = this.municipalBonds.filter(bond => bond.balance > 0);
    return true;
  }

  municipalDebtPayment() {
    return this.municipalBonds.reduce((total, bond) => total + Math.min(
      bond.monthlyPayment,
      bond.balance * (1 + bond.annualInterestRate / 12)
    ), 0);
  }

  taxRateForLot(lot: Lot) {
    if (lot.zone === "industrial") return this.taxPolicy.industrial;
    if (lot.zone === "commercial" || lot.zone === "civic") return this.taxPolicy.commercial;
    if (lot.zone === "mixed") return (this.taxPolicy.residential + this.taxPolicy.commercial) / 2;
    return this.taxPolicy.residential;
  }

  lotLandValue(lot: Lot, totalPopulation?: number, effectiveStaffing?: number) {
    const population = totalPopulation ?? Math.max(1, this.lots.reduce((total, candidate) => total + this.lotPopulation(candidate), 0));
    const staffing = effectiveStaffing ?? this.effectiveStaffing();
    const utility = this.lotUtilityReliability(lot, population, staffing);
    const neighborhood = this.lotNeighborhoodSupport(lot, population, staffing);
    const parkDistance = this.areas
      .filter(area => area.kind === "park")
      .reduce((closest, park) => Math.min(closest, distance(lot.center, polygonCenter(park.points))), Number.POSITIVE_INFINITY);
    const parkAccess = Number.isFinite(parkDistance) ? clamp(1 - parkDistance / 420, 0, 1) : 0;
    const road = this.roads.find(candidate => candidate.id === lot.roadId);
    const traffic = road ? this.roadTrafficPressure(road) : 0;
    const roadProfile = road ? this.roadProfile(road) : ROAD_PROFILE_PRESETS.street;
    const noise = clamp((roadProfile.speedLimitKph - 20) / 80 + traffic * .65, 0, 1);
    const policies = this.districtPoliciesForLot(lot);
    const policyBonus = (policies.includes("recycling") ? 3 : 0)
      + (policies.includes("school-boost") ? 5 : 0)
      + (policies.includes("heavy-traffic-ban") ? 4 : 0)
      + (policies.includes("small-business-grants") ? 3 : 0);
    const taxPenalty = Math.max(0, this.taxRateForLot(lot) - 10) * 1.4;
    const industrialPenalty = lot.zone === "industrial" ? 11 : 0;
    const floodRisk = this.lotFloodRisk(lot);
    const floodRiskPenalty = floodRisk === "high" ? 14 : floodRisk === "moderate" ? 7 : 0;
    const terrainSlope = this.lotTerrainSlope(lot);
    const terrainPenalty = terrainSlope === "steep" ? 9 : terrainSlope === "moderate" ? 4 : 0;
    const growthBoundaryPenalty = this.lotGrowthBoundaryStatus(lot) === "outside" ? 10 : 0;
    return Math.round(clamp(
      22
      + utility * .22
      + neighborhood * .25
      + parkAccess * 22
      - noise * 14
      - taxPenalty
      - industrialPenalty
      - floodRiskPenalty
      - terrainPenalty
      - growthBoundaryPenalty
      + policyBonus,
      0,
      100
    ));
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
    const privateSector = completedLots.reduce((totals, lot) => {
      if (!lot.businesses) return totals;
      totals.revenue += lot.businessFinance?.lastRevenue ?? 0;
      totals.profit += lot.businessFinance?.lastProfit ?? 0;
      return totals;
    }, { revenue: 0, profit: 0 });
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
    const industrialBusinesses = completedLots
      .filter(lot => lot.zone === "industrial")
      .reduce((total, lot) => total + lot.businesses, 0);
    const commercialBusinesses = Math.max(0, businesses - industrialBusinesses);
    const residentialTaxRevenue = Math.round(population * 118 * this.taxPolicy.residential / 10);
    const commercialTaxRevenue = Math.round(commercialBusinesses * 4_800 * this.taxPolicy.commercial / 10);
    const industrialTaxRevenue = Math.round(industrialBusinesses * 4_800 * this.taxPolicy.industrial / 10);
    const districtPolicyCosts = this.districtPolicyMonthlyCost();
    const debtPayments = Math.round(this.municipalDebtPayment());
    const monthlyRevenue = residentialTaxRevenue
      + commercialTaxRevenue
      + industrialTaxRevenue
      + parkingRevenue
      + transitRevenue
      + curbRevenue
      + eventRevenue;
    const monthlyCosts = this.services.reduce(
      (total, service) => total + service.monthlyCost * (.4 + this.serviceFunding * .6),
      0
    ) + parkingCosts + transitCosts + curbCosts + eventCosts + districtPolicyCosts + debtPayments;
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
      privateSectorRevenue: Math.round(privateSector.revenue),
      privateSectorProfit: Math.round(privateSector.profit),
      monthlyRevenue,
      monthlyCosts,
      monthlyBalance: monthlyRevenue - monthlyCosts,
      residentialTaxRevenue,
      commercialTaxRevenue,
      industrialTaxRevenue,
      districtPolicyCosts,
      debtPayments,
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

  workplaceSector(lot: Lot): BusinessSector {
    if (lot.anchorBusiness?.sector) return lot.anchorBusiness.sector;
    return (Object.entries(lot.businessMix) as Array<[BusinessSector, number]>)
      .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]?.[0] ?? "office";
  }

  businessFinance(lot: Lot): BusinessFinance {
    return normalizeBusinessFinance(lot.businessFinance, lot.businesses, this.clock.elapsedMinutes);
  }

  businessFinanceProjection(
    lot: Lot,
    totalPopulation = Math.max(1, this.lots.reduce((total, candidate) => total + this.lotPopulation(candidate), 0)),
    effectiveStaffing = this.effectiveStaffing(),
    districtPolicies = this.districtPoliciesForLot(lot),
    activeEvents = this.activeCityEvents()
  ): BusinessFinanceProjection {
    if (!lot.businesses) {
      return { dailyCustomers: 0, revenue: 0, payroll: 0, operatingCosts: 0, profit: 0, margin: 0 };
    }
    const seed = hashString(lot.id);
    const sectorRevenue: Record<BusinessSector, number> = {
      retail: 3_400,
      office: 8_200,
      hospitality: 4_800,
      industrial: 8_800,
      community: 3_500
    };
    const sectorPayroll: Record<BusinessSector, number> = {
      retail: 145,
      office: 175,
      hospitality: 150,
      industrial: 185,
      community: 155
    };
    const sectorOperating: Record<BusinessSector, number> = {
      retail: 650,
      office: 1_300,
      hospitality: 1_000,
      industrial: 1_800,
      community: 500
    };
    const sectorCustomers: Record<BusinessSector, number> = {
      retail: 74,
      office: 18,
      hospitality: 92,
      industrial: 7,
      community: 48
    };
    let baseRevenue = 0;
    let payroll = 0;
    let operatingCosts = 0;
    let dailyCustomers = 0;
    for (const [sector, count] of Object.entries(lot.businessMix) as Array<[BusinessSector, number]>) {
      baseRevenue += count * sectorRevenue[sector];
      payroll += count * sectorJobs(sector, seed) * sectorPayroll[sector];
      operatingCosts += count * sectorOperating[sector];
      dailyCustomers += count * sectorCustomers[sector];
    }
    const primarySector = this.workplaceSector(lot);
    const modeledJobs = this.lotJobs(lot);
    const anchorJobs = lot.anchorBusiness?.jobs ?? 0;
    if (anchorJobs > modeledJobs) payroll += (anchorJobs - modeledJobs) * sectorPayroll[primarySector];
    const localPopulation = this.lotPopulation(lot);
    const demandFactor = clamp(.82 + totalPopulation / 140_000 + localPopulation / 900, .72, 1.34);
    const staffingFactor = clamp(.68 + effectiveStaffing * .36, .72, 1.05);
    const grantFactor = districtPolicies.includes("small-business-grants") ? 1.08 : 1;
    const freightFactor = districtPolicies.includes("heavy-traffic-ban") && primarySector === "industrial" ? .88 : 1;
    const eventFactor = 1 + activeEvents.reduce((boost, event) => {
      const proximity = clamp(1 - distance(event.position, lot.center) / 260, 0, 1);
      return boost + proximity * .12;
    }, 0);
    const revenue = Math.max(0, Math.round(baseRevenue * demandFactor * staffingFactor * grantFactor * freightFactor * eventFactor));
    dailyCustomers = Math.max(0, Math.round(dailyCustomers * demandFactor * eventFactor));
    const taxRate = this.taxRateForLot(lot);
    operatingCosts = Math.max(0, Math.round(operatingCosts + revenue * taxRate / 1_000));
    payroll = Math.max(0, Math.round(payroll));
    const profit = revenue - payroll - operatingCosts;
    return {
      dailyCustomers,
      revenue,
      payroll,
      operatingCosts,
      profit,
      margin: revenue ? Math.round(profit / revenue * 1_000) / 10 : 0
    };
  }

  businessProfitMargin(lot: Lot) {
    const finance = this.businessFinance(lot);
    return finance.lastRevenue ? Math.round(finance.lastProfit / finance.lastRevenue * 1_000) / 10 : 0;
  }

  businessViabilityLabel(lot: Lot) {
    const finance = this.businessFinance(lot);
    if (!lot.businesses) return "Vacant";
    if (!finance.lastSettledAt) return "New";
    const margin = this.businessProfitMargin(lot);
    if (finance.consecutiveLossDays >= 3) return "Loss-making";
    if (margin < 4 || finance.operatingReserve < lot.businesses * 1_500) return "Fragile";
    if (margin >= 18 && finance.operatingReserve >= lot.businesses * 7_500) return "Strong";
    return "Stable";
  }

  workplaceActivity(lot: Lot, minute = this.clock.minute): WorkplaceActivity {
    const sector = this.workplaceSector(lot);
    const hour = minute / 60;
    const openBusinesses = (Object.entries(lot.businessMix) as Array<[BusinessSector, number]>)
      .reduce((total, [businessSector, count]) => total + openBusinessCount(count, businessSector, hour), 0);
    const seed = hashString(lot.id);
    const commuteStaffing = 1 - this.congestionLevel() * .22;
    const coworkersOnShift = Math.round((Object.entries(lot.businessMix) as Array<[BusinessSector, number]>)
      .reduce((total, [businessSector, count]) => total + count * sectorJobs(businessSector, seed) * sectorOperatingFactor(businessSector, hour), 0)
      * commuteStaffing);
    const assigned = this.residentsAssignedToWorkplace(lot.id);
    const namedWorkersOnShift = assigned.filter(({ resident }) => {
      if (resident.currentAction?.directed && resident.currentAction.endsAt > this.clock.elapsedMinutes) return false;
      return this.residentStatusAt(resident, minute) === "At work";
    }).length;
    const nearbyPopulation = this.lots.reduce((total, candidate) => {
      const proximity = clamp(1 - distance(lot.center, candidate.center) / 180, 0, 1);
      return total + this.lotPopulation(candidate) * proximity;
    }, 0);
    const transitAccess = this.transitLines.some(line => line.stops.some(stop => distance(stop.position, lot.center) <= 110)) ? 1.18 : 1;
    const eventDemand = this.activeCityEvents().reduce((total, event) => {
      const proximity = clamp(1 - distance(event.position, lot.center) / 240, 0, 1);
      return total + this.cityEventExpectedAttendance(event) * proximity * .035;
    }, 0);
    const sectorDemand = {
      retail: .095,
      office: .018,
      hospitality: .13,
      industrial: .008,
      community: .052
    }[sector];
    const accessFactor = transitAccess * (1 - this.congestionLevel() * .24);
    const hourlyCustomerDemand = openBusinesses
      ? Math.max(0, Math.round((openBusinesses * 4 + nearbyPopulation * sectorDemand + eventDemand) * accessFactor))
      : 0;
    const dwellFactor = { retail: .42, office: .18, hospitality: .58, industrial: .12, community: .46 }[sector];
    const customersPresent = Math.round(hourlyCustomerDemand * dwellFactor);
    const servicePressure = Math.round(clamp(
      (coworkersOnShift + customersPresent) / Math.max(1, this.lotJobs(lot) * .7 + openBusinesses * 10) * 100,
      0,
      100
    ));
    const label: WorkplaceActivity["label"] = openBusinesses === 0
      ? "Closed"
      : customersPresent === 0 && coworkersOnShift > 0
        ? "Crew only"
        : servicePressure >= 86
          ? "Crowded"
          : servicePressure >= 68
            ? "Busy"
            : servicePressure >= 38
              ? "Steady"
              : "Quiet";
    return {
      sector,
      openBusinesses,
      coworkersOnShift,
      namedWorkersAssigned: assigned.length,
      namedWorkersOnShift,
      hourlyCustomerDemand,
      customersPresent,
      servicePressure,
      label
    };
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

  roadTrafficPressure(road: Road) {
    if (this.cityEventRoadClosure(road.id)) return 1;
    const routedTravelers = this.commuteFlows.reduce((total, flow) => {
      const usesRoad = flow.route.some(point => distanceToPolyline(point, road.points) <= road.width / 2 + 5);
      return usesRoad ? total + flow.travelers : total;
    }, 0);
    const classCapacity = this.roadCapacity(road);
    const eventPressure = this.activeCityEvents().some(event => event.roadId === road.id)
      ? this.cityEventTrafficPressure() * .45
      : 0;
    return clamp(
      routedTravelers / classCapacity
      + this.congestionLevel() * .32
      + eventPressure,
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

  residentWorkplaceLot(resident: Resident) {
    return this.lots.find(lot => lot.id === resident.destinationLotId);
  }

  residentsAssignedToWorkplace(lotId: string) {
    return this.homes.flatMap(home => home.residents
      .filter(resident => resident.destinationLotId === lotId)
      .map(resident => ({ home, resident }))
    );
  }

  residentsAtWorkplace(lotId: string) {
    return this.residentsAssignedToWorkplace(lotId)
      .filter(({ resident }) => this.residentStatus(resident) === "At work");
  }

  residentWorkplaceFit(resident: Resident) {
    const workplace = this.residentWorkplaceLot(resident);
    if (!workplace) return 0;
    const sector = workplace.anchorBusiness?.sector;
    if (!sector) return workplace.businesses > 0 ? 55 : 0;
    const preferred = CAREER_WORKPLACE_SECTORS[this.residentCareerTrack(resident)];
    return sector === preferred[0] ? 100 : sector === preferred[1] ? 82 : 52;
  }

  residentWorkTaskLabel(resident: Resident) {
    return resident.lastWorkTask
      ? RESIDENT_WORK_TASK_DEFINITIONS[resident.lastWorkTask]?.label ?? "Work task unavailable"
      : "First shift not completed";
  }

  residentWorkPerformance(resident: Resident) {
    return Math.round(clamp(resident.workPerformance ?? 0, 0, 100));
  }

  residentMilestones(resident: Resident) {
    return [...(resident.milestones ?? [])]
      .sort((first, second) => second.occurredAt - first.occurredAt || second.id.localeCompare(first.id));
  }

  residentMilestoneDate(milestone: ResidentMilestone) {
    const elapsedDays = Math.max(0, Math.floor((milestone.occurredAt + 8 * 60) / 1_440));
    const year = Math.floor(elapsedDays / 360) + 1;
    const dayOfYear = elapsedDays % 360;
    const month = Math.floor(dayOfYear / 30) + 1;
    const day = dayOfYear % 30 + 1;
    return `Y${year} M${month} D${day}`;
  }

  private recordResidentMilestone(
    resident: Resident,
    kind: ResidentMilestoneKind,
    title: string,
    detail: string,
    occurredAt = this.clock.elapsedMinutes
  ) {
    const savedTitle = safeResidentMilestoneText(title, "Life milestone", 64);
    const savedDetail = safeResidentMilestoneText(detail, "A new chapter began.", 140);
    const savedAt = Math.max(0, Math.round(occurredAt));
    const existing = resident.milestones ?? [];
    if (existing.some(milestone => milestone.kind === kind && milestone.title === savedTitle && milestone.occurredAt === savedAt)) return;
    resident.milestones = [{
      id: `milestone-${resident.id}-${kind}-${savedAt}-${hashString(savedTitle)}`,
      kind,
      title: savedTitle,
      detail: savedDetail,
      occurredAt: savedAt
    }, ...existing]
      .sort((first, second) => second.occurredAt - first.occurredAt || second.id.localeCompare(first.id))
      .slice(0, MAX_RESIDENT_MILESTONES);
  }

  private increaseResidentAspiration(resident: Resident, amount: number) {
    const before = this.residentAspirationProgress(resident);
    resident.aspirationProgress = Math.min(100, before + Math.max(0, Math.round(amount)));
    if (before < 100 && resident.aspirationProgress === 100) {
      const label = this.residentAspirationLabel(resident);
      this.recordResidentMilestone(
        resident,
        "aspiration",
        `${label} fulfilled`,
        `${resident.name} completed a defining long-term aspiration.`
      );
    }
  }

  residentRoutineProfile(resident: Resident) {
    return normalizeResidentRoutineProfile(resident.routineProfile, resident);
  }

  residentDailySchedule(resident: Resident, elapsedMinute = this.clock.elapsedMinutes): ResidentDailySchedule {
    const profile = this.residentRoutineProfile(resident);
    const definition = RESIDENT_ROUTINE_DEFINITIONS[profile];
    const dayIndex = Math.floor(Math.max(0, elapsedMinute) / 1_440) % 7;
    const workingToday = resident.role !== "home" && dayIndex < 5;
    const baseWindow = resident.role === "student"
      ? { start: 8 * 60, end: 16 * 60 }
      : resident.role === "office"
        ? { start: 8 * 60, end: 18 * 60 }
        : resident.role === "service"
          ? { start: 6 * 60, end: 15 * 60 }
          : undefined;
    const flexibleOffset = profile === "flexible"
      ? (hashString(`${resident.id}:routine:${dayIndex}`) % 3 - 1) * 60
      : 0;
    const shiftOffset = definition.shiftOffset + flexibleOffset;
    const workWindows: Array<{ start: number; end: number }> = [];
    if (workingToday && baseWindow) {
      const start = Math.round(clamp(baseWindow.start + shiftOffset, 4 * 60, 13 * 60));
      const duration = profile === "flexible"
        ? Math.max(6 * 60, baseWindow.end - baseWindow.start - 60)
        : baseWindow.end - baseWindow.start;
      if (profile === "split-shift") {
        const firstDuration = Math.round(duration / 2);
        const secondStart = Math.min(21 * 60, start + firstDuration + 5 * 60);
        workWindows.push(
          { start, end: start + firstDuration },
          { start: secondStart, end: Math.min(23 * 60 + 30, secondStart + duration - firstDuration) }
        );
      } else {
        workWindows.push({ start, end: Math.min(23 * 60 + 30, start + duration) });
      }
    }
    const lastWorkEnd = workWindows.at(-1)?.end;
    const outingStart = lastWorkEnd !== undefined
      ? Math.min(22 * 60 + 30, lastWorkEnd + 30)
      : profile === "early-bird"
        ? 9 * 60
        : profile === "night-owl"
          ? 14 * 60
          : profile === "split-shift"
            ? 12 * 60
            : 11 * 60 + flexibleOffset;
    const outingDuration = lastWorkEnd !== undefined ? 90 : 180;
    return {
      profile,
      dayIndex,
      workingToday,
      wakeMinute: definition.wakeMinute,
      sleepMinute: definition.sleepMinute,
      workWindows,
      outingWindows: [{ start: Math.max(0, outingStart), end: Math.min(23 * 60 + 59, outingStart + outingDuration) }]
    };
  }

  residentRoutineSummary(resident: Resident) {
    const schedule = this.residentDailySchedule(resident);
    const definition = RESIDENT_ROUTINE_DEFINITIONS[schedule.profile];
    const outing = schedule.outingWindows
      .map(window => `${formatRoutineMinute(window.start)}-${formatRoutineMinute(window.end)}`)
      .join(" + ");
    if (resident.role === "home") {
      return `${definition.label} · Out ${outing} · sleep ${formatRoutineMinute(schedule.sleepMinute)}-${formatRoutineMinute(schedule.wakeMinute)}`;
    }
    const work = schedule.workWindows.length
      ? schedule.workWindows.map(window => `${formatRoutineMinute(window.start)}-${formatRoutineMinute(window.end)}`).join(" + ")
      : schedule.workingToday ? "No assigned shift" : "Day off";
    return `${definition.label} · ${resident.role === "student" ? "School" : "Work"} ${work} · sleep ${formatRoutineMinute(schedule.sleepMinute)}-${formatRoutineMinute(schedule.wakeMinute)}`;
  }

  residentIsScheduledAsleep(resident: Resident, minute = this.clock.minute) {
    const schedule = this.residentDailySchedule(resident);
    return minuteInWrappedWindow(minute, schedule.sleepMinute, schedule.wakeMinute);
  }

  setResidentRoutine(homeId: string, residentId: string, profile: ResidentRoutineProfile) {
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    if (!home || !resident || !RESIDENT_ROUTINE_DEFINITIONS[profile] || this.residentRoutineProfile(resident) === profile) return false;
    this.checkpoint();
    resident.routineProfile = profile;
    if (!resident.currentAction?.directed) resident.currentAction = undefined;
    return true;
  }

  residentStatus(resident: Home["residents"][number]) {
    return this.residentStatusAt(resident, this.clock.minute);
  }

  residentStatusAt(resident: Home["residents"][number], minute: number) {
    if (
      resident.currentAction?.directed
      && resident.currentAction.endsAt > this.clock.elapsedMinutes
    ) return "Home";
    const dayStart = Math.floor(this.clock.elapsedMinutes / 1_440) * 1_440;
    const schedule = this.residentDailySchedule(resident, dayStart + minute);
    const commute = this.commuteForResident(resident);
    if (schedule.workingToday && minute === this.clock.minute && commute && this.activeCommutes().some(active => active.flow.id === commute.id)) return "Commuting";
    if (schedule.workWindows.some(window => minute >= window.start && minute < window.end)) {
      return resident.role === "student" ? "At school" : "At work";
    }
    if (schedule.outingWindows.some(window => minute >= window.start && minute < window.end)) return "Out in city";
    return "Home";
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
    if (action.kind === "care") return "Caring for a dependent";
    return {
      sleep: "Sleeping",
      eat: "Having a meal",
      relax: "Relaxing",
      study: "Studying",
      shower: "Taking a shower",
      care: "Caring for a dependent",
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

  relationshipImpression(relationship: ResidentRelationship): RelationshipImpression {
    const memories = relationship.memories ?? [];
    if (!memories.length) {
      return {
        kind: "unformed",
        label: "First impression",
        strength: 0,
        outcomeBias: 0,
        partnerBias: 0,
        summary: "Shared history is still forming"
      };
    }
    const strength = Math.round(clamp(memories.reduce((total, memory, index) => {
      const recency = Math.max(.45, 1 - index * .08);
      const tensionRelief = -memory.tensionChange * .18;
      const intentWeight = memory.intent === "support" || memory.intent === "apologize"
        ? 1.12
        : memory.intent === "confront"
          ? 1.18
          : 1;
      return total + (memory.relationshipChange * intentWeight + tensionRelief) * recency;
    }, 0), -100, 100));
    const tension = relationship.tension ?? 0;
    const kind: RelationshipImpression["kind"] = strength >= 20
      ? "loyalty"
      : strength >= 7
        ? "warmth"
        : strength <= -9 || tension >= 50
          ? "resentment"
          : strength <= -3 || tension >= 20
            ? "wariness"
            : "steady";
    const presentation: Record<RelationshipImpression["kind"], { label: string; summary: string }> = {
      unformed: { label: "First impression", summary: "Shared history is still forming" },
      steady: { label: "Steady", summary: "Good and difficult moments feel balanced" },
      warmth: { label: "Warmth", summary: "Supportive moments make future conversation easier" },
      loyalty: { label: "Loyalty", summary: "Repeated support and repair built durable trust" },
      wariness: { label: "Wariness", summary: "Recent friction makes conversation more cautious" },
      resentment: { label: "Resentment", summary: "Conflict still shapes how future words are received" }
    };
    return {
      kind,
      label: presentation[kind].label,
      strength,
      outcomeBias: Math.round(clamp(strength / 8, -3, 3)),
      partnerBias: Math.round(clamp(strength * .4, -10, 10)),
      summary: presentation[kind].summary
    };
  }

  residentTraitLabel(trait: ResidentTrait) {
    return RESIDENT_TRAIT_DETAILS[trait].label;
  }

  residentTraitDescription(trait: ResidentTrait) {
    return RESIDENT_TRAIT_DETAILS[trait].description;
  }

  residentPersonality(resident: Resident) {
    return normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  }

  residentPersonalityAxisLabel(axis: ResidentPersonalityAxis) {
    return RESIDENT_PERSONALITY_LABELS[axis];
  }

  residentPersonalityAxisDescription(axis: ResidentPersonalityAxis, value: number) {
    const low: Record<ResidentPersonalityAxis, string> = {
      cleanliness: "comfortable with clutter",
      spontaneity: "prefers a plan",
      sociability: "protects quiet time",
      emotionality: "emotionally steady",
      activity: "enjoys a slower pace"
    };
    const high: Record<ResidentPersonalityAxis, string> = {
      cleanliness: "keeps spaces orderly",
      spontaneity: "welcomes surprises",
      sociability: "seeks frequent company",
      emotionality: "feels events intensely",
      activity: "needs regular movement"
    };
    if (value <= 38) return low[axis];
    if (value >= 62) return high[axis];
    return "adapts to the situation";
  }

  residentPersonalitySummary(resident: Resident) {
    const personality = this.residentPersonality(resident);
    const strongest = RESIDENT_PERSONALITY_AXES
      .map(axis => ({ axis, distance: Math.abs(personality[axis] - 50), value: personality[axis] }))
      .sort((first, second) => second.distance - first.distance || first.axis.localeCompare(second.axis))
      .slice(0, 2);
    if (!strongest.length || strongest[0].distance < 12) return "balanced across the personality matrix";
    return strongest
      .map(entry => this.residentPersonalityAxisDescription(entry.axis, entry.value))
      .join(" and ");
  }

  residentCareerFit(resident: Resident) {
    const personality = this.residentPersonality(resident);
    const target = CAREER_TRACK_PERSONALITY_TARGETS[this.residentCareerTrack(resident)];
    const fit = RESIDENT_PERSONALITY_AXES.reduce(
      (total, axis) => total + 100 - Math.abs(personality[axis] - target[axis]),
      0
    ) / RESIDENT_PERSONALITY_AXES.length;
    return Math.round(clamp(fit, 0, 100));
  }

  residentLifeStage(resident: Resident) {
    return normalizeResidentLifeStage(resident.lifeStage, resident.age);
  }

  residentLifeStageLabel(resident: Resident) {
    return RESIDENT_LIFE_STAGE_DEFINITIONS[this.residentLifeStage(resident)].label;
  }

  residentLifeStageProgress(resident: Resident) {
    const definition = RESIDENT_LIFE_STAGE_DEFINITIONS[this.residentLifeStage(resident)];
    return definition.durationDays
      ? clamp((resident.lifeStageDays ?? 0) / definition.durationDays, 0, 1)
      : 1;
  }

  residentAspiration(resident: Resident) {
    return normalizeResidentAspiration(resident.aspiration, resident);
  }

  residentAspirationLabel(resident: Resident) {
    return RESIDENT_ASPIRATION_DEFINITIONS[this.residentAspiration(resident)].label;
  }

  residentAspirationProgress(resident: Resident) {
    return Math.round(clamp(resident.aspirationProgress ?? 0, 0, 100));
  }

  residentCareerTrack(resident: Resident) {
    return normalizeResidentCareerTrack(resident.careerTrack, resident);
  }

  residentCareerTrackLabel(resident: Resident) {
    return RESIDENT_CAREER_TRACK_DEFINITIONS[this.residentCareerTrack(resident)].label;
  }

  residentCareerBranchLabel(resident: Resident) {
    return resident.careerBranch ?? (this.residentCareerLevel(resident) >= 4 ? "Branch pending" : "Foundation path");
  }

  residentDecorPreference(resident: Resident) {
    return normalizeResidentDecorPreference(resident.decorPreference, resident);
  }

  residentDecorPreferenceLabel(resident: Resident) {
    const style = this.residentDecorPreference(resident);
    return `${style[0].toUpperCase()}${style.slice(1)}`;
  }

  residentFavoritePastime(resident: Resident) {
    return normalizeResidentPastime(resident.favoritePastime, resident);
  }

  residentFavoritePastimeLabel(resident: Resident) {
    return RESIDENT_PASTIME_DEFINITIONS[this.residentFavoritePastime(resident)].label;
  }

  residentOutfitStyle(resident: Resident) {
    return normalizeResidentOutfitStyle(resident.outfitStyle, resident);
  }

  residentOutfitPalette(resident: Resident) {
    return normalizeResidentOutfitPalette(resident.outfitPalette, resident);
  }

  residentOutfitLabel(resident: Resident) {
    const style = RESIDENT_OUTFIT_DEFINITIONS[this.residentOutfitStyle(resident)].label;
    const palette = RESIDENT_OUTFIT_PALETTES[this.residentOutfitPalette(resident)].label;
    return `${style} · ${palette}`;
  }

  residentOutfitColors(resident: Resident) {
    return RESIDENT_OUTFIT_PALETTES[this.residentOutfitPalette(resident)];
  }

  residentPersonalItems(resident: Resident) {
    return resident.inventory ?? [];
  }

  residentOwnedFurniture(home: Home, resident: Resident) {
    return home.furniture.filter(item => item.ownerResidentId === resident.id);
  }

  residentOwnershipSatisfaction(home: Home | undefined, resident: Resident) {
    if (!home) return 50;
    const owned = this.residentOwnedFurniture(home, resident);
    const inventory = this.residentPersonalItems(resident);
    const preferredStyle = this.residentDecorPreference(resident);
    const matchingStyles = owned.filter(item => (item.style ?? "natural") === preferredStyle).length;
    return Math.round(clamp(
      35
      + Math.min(30, owned.length * 15)
      + Math.min(20, inventory.length * 5)
      + (owned.length ? matchingStyles / owned.length * 15 : 0),
      0,
      100
    ));
  }

  residentActionPersonalityInfluence(resident: Resident, action: ResidentActionKind) {
    return residentActionPersonalityBonus(resident, action);
  }

  residentSkills(resident: Resident): ResidentSkills {
    return normalizeResidentSkills(resident.skills);
  }

  residentSkillLabel(skill: ResidentSkill) {
    return {
      communication: "Communication",
      creativity: "Creativity",
      wellness: "Wellness",
      practical: "Practical"
    }[skill];
  }

  residentSkillLevel(resident: Resident, skill: ResidentSkill) {
    return Math.min(10, Math.floor(this.residentSkills(resident)[skill] / 10));
  }

  residentCareerLevel(resident: Resident) {
    return Math.round(clamp(resident.careerLevel ?? 1, 1, 10));
  }

  residentCareerTitle(resident: Resident) {
    const level = this.residentCareerLevel(resident);
    const stage = this.residentLifeStage(resident);
    if (stage === "infant" || stage === "toddler") return RESIDENT_LIFE_STAGE_DEFINITIONS[stage].label;
    if (resident.role === "student") return `${stage === "teen" ? "Secondary" : "Primary"} student · Level ${level}`;
    if (stage === "elder" && resident.role === "home") return "Household mentor";
    const track = RESIDENT_CAREER_TRACK_DEFINITIONS[this.residentCareerTrack(resident)];
    const rank = level <= 2 ? "Apprentice" : level <= 3 ? "Practitioner" : level <= 5 ? "Specialist" : level <= 7 ? "Lead" : level <= 9 ? "Director" : "Master";
    return `${rank} · ${resident.careerBranch ?? track.label}`;
  }

  residentCareerProgress(resident: Resident) {
    if (["infant", "toddler"].includes(this.residentLifeStage(resident)) || resident.role === "student" || this.residentCareerLevel(resident) >= 10) return this.residentCareerLevel(resident) >= 10 ? 1 : 0;
    return clamp((resident.careerXp ?? 0) / (this.residentCareerLevel(resident) * 40), 0, 1);
  }

  residentDailyWage(resident: Resident) {
    const stage = this.residentLifeStage(resident);
    if (resident.role === "student" || stage === "infant" || stage === "toddler" || stage === "child" || stage === "teen" || stage === "elder") return 0;
    const level = this.residentCareerLevel(resident);
    const track = RESIDENT_CAREER_TRACK_DEFINITIONS[this.residentCareerTrack(resident)];
    return track.baseWage + level * track.wageStep;
  }

  residentTopSkill(resident: Resident) {
    const skills = this.residentSkills(resident);
    return (Object.entries(skills) as Array<[ResidentSkill, number]>)
      .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0];
  }

  residentLearnedPreferences(home: Home, resident: Resident) {
    const scores: Record<ConversationIntent, number> = {
      chat: 0,
      support: 0,
      joke: 0,
      confront: 0,
      apologize: 0
    };
    let evidenceCount = 0;
    for (const relationship of home.relationships) {
      if (!relationship.residentIds.includes(resident.id)) continue;
      for (const [index, memory] of (relationship.memories ?? []).entries()) {
        const perspective = memory.initiatorResidentId === resident.id ? 1 : .72;
        const recency = Math.max(.55, 1 - index * .08);
        const outcome = memory.relationshipChange - Math.max(0, memory.tensionChange) * .28;
        scores[memory.intent] += outcome * perspective * recency;
        evidenceCount += 1;
      }
    }
    const preferredEntry = (["chat", "support", "joke"] as ConversationIntent[])
      .map(intent => ({ intent, score: scores[intent] }))
      .sort((first, second) => second.score - first.score)[0];
    const avoidedEntry = (Object.entries(scores) as Array<[ConversationIntent, number]>)
      .sort((first, second) => first[1] - second[1])[0];
    const positive = Object.values(scores).reduce((total, score) => total + Math.max(0, score), 0);
    const negative = Object.values(scores).reduce((total, score) => total + Math.min(0, score), 0);
    return {
      preferredIntent: preferredEntry?.score >= 6 ? preferredEntry.intent : undefined,
      preferredScore: Math.round(preferredEntry?.score ?? 0),
      avoidedIntent: avoidedEntry?.[1] <= -6 ? avoidedEntry[0] : undefined,
      avoidedScore: Math.round(avoidedEntry?.[1] ?? 0),
      socialBias: Math.round(clamp((positive + negative) / 5, -12, 18)),
      evidenceCount
    };
  }

  residentPreferenceSummary(home: Home, resident: Resident) {
    const preference = this.residentLearnedPreferences(home, resident);
    if (!preference.evidenceCount) return "Still discovering social preferences";
    const preferred = preference.preferredIntent
      ? `Prefers ${this.conversationIntentLabel(preference.preferredIntent)}`
      : "Social style still forming";
    const avoided = preference.avoidedIntent
      ? ` · avoids ${this.conversationIntentLabel(preference.avoidedIntent)}`
      : "";
    return `${preferred}${avoided} · ${preference.evidenceCount} remembered ${preference.evidenceCount === 1 ? "moment" : "moments"}`;
  }

  residentActivityPreferences(resident: Resident) {
    return normalizeResidentActivityPreferences(resident.activityPreferences, this.clock.elapsedMinutes);
  }

  residentActivityPreferenceBias(resident: Resident, action: ResidentActionKind) {
    const preference = this.residentActivityPreferences(resident).find(item => item.action === action);
    if (!preference) return 0;
    return Math.round(clamp(preference.satisfaction * .22 + Math.min(10, preference.repetitions) * .8, -18, 24));
  }

  residentActivityLabel(action: ResidentActionKind) {
    return {
      sleep: "Sleeping",
      eat: "Shared meals",
      relax: "Relaxing",
      study: "Studying",
      shower: "Self-care",
      socialize: "Social time",
      care: "Childcare",
      "tend-plants": "Plant care",
      idle: "Quiet breaks"
    }[action];
  }

  residentActivityPreferenceSummary(resident: Resident) {
    const preferences = this.residentActivityPreferences(resident);
    const preferred = preferences
      .filter(item => item.repetitions >= 2 && item.satisfaction >= 18)
      .sort((first, second) => second.satisfaction - first.satisfaction || second.repetitions - first.repetitions)[0];
    const avoided = preferences
      .filter(item => item.satisfaction <= -8)
      .sort((first, second) => first.satisfaction - second.satisfaction)[0];
    if (!preferred && !avoided) return "Personal routine preferences are still forming";
    const preferredCopy = preferred
      ? `Returns to ${this.residentActivityLabel(preferred.action).toLowerCase()} after ${preferred.repetitions} satisfying repeats`
      : "No favorite routine yet";
    const avoidedCopy = avoided
      ? ` · avoids ${this.residentActivityLabel(avoided.action).toLowerCase()}`
      : "";
    return `${preferredCopy}${avoidedCopy}`;
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
    tension = 0,
    history?: ResidentRelationship
  ) {
    const compatibility = this.relationshipCompatibility(firstResident, secondResident);
    const impressionBias = history ? this.relationshipImpression(history).outcomeBias : 0;
    if (!directed && intent !== "apologize") {
      return Math.round(clamp(3 + (compatibility - 50) / 12 + impressionBias, 1, 8));
    }
    if (intent === "apologize") {
      const empathy = (firstResident.traits.includes("empathetic") ? 2 : 0)
        + (secondResident.traits.includes("empathetic") ? 1 : 0);
      const directionBonus = directed ? 2 : 0;
      return Math.round(clamp(
        3 + directionBonus + empathy + tension / 12 + (compatibility - 50) / 20 + impressionBias,
        2,
        12
      ));
    }
    if (intent === "support") {
      const empathy = (firstResident.traits.includes("empathetic") ? 2 : 0)
        + (secondResident.traits.includes("empathetic") ? 1 : 0);
      return Math.round(clamp(7 + empathy + (compatibility - 50) / 15 + impressionBias, 3, 12));
    }
    if (intent === "joke") {
      const humor = (firstResident.traits.includes("creative") ? 1 : 0)
        + (firstResident.traits.includes("outgoing") ? 1 : 0)
        + (secondResident.traits.includes("outgoing") ? 1 : 0);
      return Math.round(clamp(5 + humor + (compatibility - 50) / 16 + impressionBias, 1, 11));
    }
    if (intent === "confront") {
      const empathy = (firstResident.traits.includes("empathetic") ? 2 : 0)
        + (secondResident.traits.includes("empathetic") ? 1 : 0);
      return Math.round(clamp(-9 + empathy + (compatibility - 50) / 18 + impressionBias, -14, -2));
    }
    return Math.round(clamp(6 + (compatibility - 50) / 12 + impressionBias, 2, 11));
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
      plant: { kind: "tend-plants" as const, duration: 45 },
      desk: { kind: "study" as const, duration: 75 },
      bookcase: { kind: "study" as const, duration: 60 },
      fridge: { kind: "eat" as const, duration: 35 },
      shower: { kind: "shower" as const, duration: 35 }
    }[furniture.kind];
    this.checkpoint();
    resident.homeFloor = homeEntityFloor(furniture);
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
    partner.homeFloor = resident.homeFloor;
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

  caregivingPriority(home: Home, caregiver: Resident) {
    return home.residents
      .filter(resident =>
        (resident.caregiverIds ?? []).includes(caregiver.id)
        && ["infant", "toddler", "child"].includes(this.residentLifeStage(resident))
        && this.residentStatus(resident) === "Home"
      )
      .map(resident => ({
        resident,
        need: Math.round(
          (100 - resident.comfort)
          + (100 - resident.social)
          + (100 - resident.health) * .75
          + (100 - resident.energy) * .35
          + resident.stress * .35
        )
      }))
      .sort((first, second) => second.need - first.need || first.resident.id.localeCompare(second.resident.id))[0];
  }

  commandResidentCare(homeId: string, caregiverId: string, dependentId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const caregiver = home?.residents.find(item => item.id === caregiverId);
    const dependent = home?.residents.find(item => item.id === dependentId);
    if (!home || !caregiver || !dependent || !(dependent.caregiverIds ?? []).includes(caregiver.id)) {
      return { ok: false, reason: "Choose a linked caregiver and dependent." };
    }
    if (!["infant", "toddler", "child"].includes(this.residentLifeStage(dependent))) {
      return { ok: false, reason: `${dependent.name} no longer needs a childcare action.` };
    }
    if (this.residentStatus(caregiver) !== "Home" || this.residentStatus(dependent) !== "Home") {
      return { ok: false, reason: "The caregiver and dependent both need to be home." };
    }
    if (this.activeResidentAction(caregiver)) {
      return { ok: false, reason: `${caregiver.name} is already busy.` };
    }
    this.checkpoint();
    caregiver.homeFloor = dependent.homeFloor ?? caregiver.homeFloor ?? 0;
    caregiver.currentAction = {
      kind: "care",
      startedAt: this.clock.elapsedMinutes,
      endsAt: this.clock.elapsedMinutes + 45,
      partnerResidentId: dependent.id,
      directed: true,
      relationshipCredit: true
    };
    return { ok: true, reason: `${caregiver.name} started caring for ${dependent.name}.` };
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

  setResidentHomePosition(homeId: string, residentId: string, position: Point2, floor?: number) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    if (!home || !resident || (floor !== undefined && (!Number.isInteger(floor) || floor < 0 || floor >= home.floors))) return false;
    resident.homePosition = { x: position.x, z: position.z };
    if (floor !== undefined) resident.homeFloor = Math.max(0, Math.round(floor));
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
    const furnitureVariety = Math.min(1, new Set(home.furniture.map(item => item.kind)).size / 8);
    const plants = Math.min(3, home.furniture.filter(item => item.kind === "plant").length);
    const functionality = this.homeFunctionality(home);
    const conditionPenalty = (100 - this.homeCondition(home)) * .24;
    const daylightPenalty = (100 - this.homeDaylight(home)) * .08;
    return Math.round(clamp(
      30
      + roomShare * 22
      + bedShare * 24
      + functionality.completeness / 100 * 15
      + functionality.alignment / 100 * 5
      + furnitureVariety * 7
      + plants * 2
      + (home.residents.length ? this.homePrivacy(home) / 100 * 6 : 0)
      - conditionPenalty
      - daylightPenalty,
      0,
      100
    ));
  }

  roomDaylight(home: Home, room: HomeRoom) {
    if (home.windows !== undefined) {
      const exposure = home.windows
        .filter(window => window.roomId === room.id && window.floor === homeEntityFloor(room))
        .reduce((total, window) => total + window.width * (window.glazing === "privacy" ? .62 : 1), 0);
      return Math.round(clamp(18 + exposure * 25, 18, 100));
    }
    const exteriorLength = homeRoomExteriorWalls(home, room)
      .reduce((total, wall) => total + wall.end - wall.start, 0);
    const perimeter = Math.max(1, (room.width + room.depth) * 2);
    return Math.round(clamp(18 + exteriorLength / perimeter * 82, 18, 100));
  }

  homeDaylight(home: Home) {
    return Math.round(average(home.rooms.map(room => this.roomDaylight(home, room))));
  }

  furniturePurposeFit(home: Home, furniture: Home["furniture"][number]) {
    const room = home.rooms.find(candidate =>
      homeEntityFloor(candidate) === homeEntityFloor(furniture)
      && Math.abs(furniture.x - candidate.x) <= candidate.width / 2
      && Math.abs(furniture.z - candidate.z) <= candidate.depth / 2
    );
    const purposes = HOME_FURNITURE_PURPOSES[furniture.kind];
    if (!room || purposes === "any") return true;
    if (!HOME_ROOM_KINDS.includes(room.kind as HomeRoomKind)) return undefined;
    return purposes.includes(room.kind as HomeRoomKind);
  }

  homeFunctionality(home: Home) {
    const available = [
      home.furniture.some(item => item.kind === "bed"),
      home.furniture.some(item => item.kind === "table" || item.kind === "fridge"),
      home.furniture.some(item => item.kind === "shower"),
      home.furniture.some(item => item.kind === "sofa"),
      home.furniture.some(item => item.kind === "desk" || item.kind === "bookcase")
    ].filter(Boolean).length;
    const functionalFurniture = home.furniture.filter(item => item.kind !== "plant");
    const alignmentPoints = functionalFurniture.reduce((total, furniture) => {
      const fit = this.furniturePurposeFit(home, furniture);
      return total + (fit === true ? 1 : fit === undefined ? .5 : 0);
    }, 0);
    const completeness = available / 5 * 100;
    const alignment = functionalFurniture.length ? alignmentPoints / functionalFurniture.length * 100 : 0;
    return {
      completeness: Math.round(completeness),
      alignment: Math.round(alignment),
      score: Math.round(completeness * .72 + alignment * .28)
    };
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
    const financialSecurity = home ? this.homeFinancialSecurity(home) : 50;
    const aspirationProgress = this.residentAspirationProgress(resident);
    const ownershipSatisfaction = this.residentOwnershipSatisfaction(home, resident);
    const dependent = ["infant", "toddler", "child", "teen"].includes(this.residentLifeStage(resident));
    const hasCaregiver = !dependent || Boolean(home && (resident.caregiverIds ?? []).some(id => home.residents.some(candidate => candidate.id === id)));
    const score = Math.round(clamp(
      resident.energy * .15
      + resident.social * .14
      + resident.comfort * .13
      + resident.health * .22
      + (100 - resident.stress) * .16
      + financialSecurity * .1
      + aspirationProgress * .06
      + ownershipSatisfaction * .04
      + (hasCaregiver ? 0 : -8),
      0,
      100
    ));
    const label = score >= 82 ? "Thriving" : score >= 64 ? "Stable" : score >= 44 ? "Strained" : "Critical";
    const pressureCandidates = [
      { value: 100 - utilityReliability, text: "Missing or unreliable utilities" },
      { value: commuteBurden, text: "Commute burden" },
      { value: 100 - homeQuality, text: "Crowded or under-furnished home" },
      { value: home ? (100 - this.homeDaylight(home)) * .5 : 0, text: "Home needs more daylight" },
      { value: resident.stress, text: "High daily stress" },
      { value: 100 - financialSecurity, text: "Household financial pressure" },
      { value: hasCaregiver ? 0 : 78, text: "Needs a household caregiver" },
      { value: (100 - aspirationProgress) * .48, text: `${this.residentAspirationLabel(resident)} needs progress` },
      { value: (100 - ownershipSatisfaction) * .5, text: "Needs a personal corner and belongings" },
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
      financialSecurity,
      pressure: pressureCandidates[0].value >= 34 ? pressureCandidates[0].text : "Needs are balanced"
    };
  }

  homeWellbeing(home: Home) {
    if (!home.residents.length) return this.homeQuality(home);
    return Math.round(average(home.residents.map(resident => this.residentWellbeing(resident).score)));
  }

  lotWellbeing(lot: Lot, totalPopulation?: number, effectiveStaffing?: number) {
    const home = this.homes.find(item => item.lotId === lot.id);
    const policies = this.districtPoliciesForLot(lot);
    const policyBonus = (policies.includes("school-boost") ? 4 : 0)
      + (policies.includes("recycling") ? 2 : 0)
      + (policies.includes("heavy-traffic-ban") ? 2 : 0);
    if (home?.residents.length) return Math.round(clamp(this.homeWellbeing(home) + policyBonus, 0, 100));
    const utility = this.lotUtilityReliability(lot, totalPopulation, effectiveStaffing);
    const neighborhood = this.lotNeighborhoodSupport(lot, totalPopulation, effectiveStaffing);
    const commute = this.commuteForLot(lot);
    const commuteBurden = commute
      ? clamp((this.estimatedCommuteMinutes(commute) - 12) * 1.7 + this.congestionLevel() * 20, 0, 100)
      : 18;
    return Math.round(clamp(45 + utility * .23 + neighborhood * .18 - commuteBurden * .12 + policyBonus, 0, 100));
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
    const baselineCapacity = this.roads.reduce((total, road) => {
      const roadClass = road.class ?? "street";
      return total + roadCapacityForProfile(ROAD_PROFILE_PRESETS[roadClass], roadClass);
    }, 0);
    const designedCapacity = this.roads.reduce((total, road) => total + this.roadCapacity(road), 0);
    const capacityFactor = baselineCapacity > 0 ? designedCapacity / baselineCapacity : 1;
    const networkCapacity = Math.max(280, this.roads.length * 16 * capacityFactor);
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
        this.settleMunicipalDebt();
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
    this.completeHouseholdGatherings(previousElapsed);
    return monthChanged;
  }

  private settleMunicipalDebt() {
    for (const bond of this.municipalBonds) {
      const interest = bond.balance * bond.annualInterestRate / 12;
      const payment = Math.min(bond.monthlyPayment, bond.balance + interest);
      bond.balance = Math.max(0, bond.balance - Math.max(0, payment - interest));
      bond.monthsRemaining = Math.max(0, bond.monthsRemaining - 1);
    }
    this.municipalBonds = this.municipalBonds.filter(bond => bond.balance >= 1 && bond.monthsRemaining > 0);
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
    this.cityName = TEMPLATE_REGIONAL_CONFIGS[id].defaultCityName;
    this.templateId = id;
    this.roads = clone(template.roads).map(normalizeRoadRecord);
    this.areas = clone(template.areas);
    this.homes = [];
    this.services = [];
    this.utilities = [];
    this.clock = { year: 1, month: 1, day: 1, minute: 8 * 60, treasury: 25_000_000, elapsedMinutes: 0 };
    this.serviceFunding = .85;
    this.taxPolicy = { residential: 10, commercial: 10, industrial: 10 };
    this.districtPolicies = {};
    this.municipalBonds = [];
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
    this.future.push(this.snapshot());
    if (this.future.length > 40) this.future.shift();
    this.apply(previous);
    this.revision++;
    return true;
  }

  redo() {
    const next = this.future.pop();
    if (!next) return false;
    this.history.push(this.snapshot());
    if (this.history.length > 40) this.history.shift();
    this.apply(next);
    this.revision++;
    return true;
  }

  canUndo() {
    return this.history.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  setCityName(value: string) {
    const name = value.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 40 || !/^[\p{L}\p{N} .'-]+$/u.test(name)) return false;
    if (name === this.cityName) return true;
    this.checkpoint();
    this.cityName = name;
    return true;
  }

  setHomeName(homeId: string, value: string) {
    const home = this.homes.find(item => item.id === homeId);
    const name = value.trim().replace(/\s+/g, " ");
    if (!home || name.length < 2 || name.length > 40 || !/^[\p{L}\p{N} .'-]+$/u.test(name)) return false;
    if (name === home.name) return true;
    this.checkpoint();
    home.name = name;
    return true;
  }

  moveResidentToHome(sourceHomeId: string, residentId: string, destinationHomeId: string) {
    const source = this.homes.find(home => home.id === sourceHomeId);
    const destination = this.homes.find(home => home.id === destinationHomeId);
    const resident = source?.residents.find(item => item.id === residentId);
    if (!source || !destination || source.id === destination.id || !resident) {
      return { ok: false, reason: "Choose a resident and a different household.", transferred: 0 };
    }
    if (destination.residents.length >= 8) {
      return { ok: false, reason: `${destination.name} already has eight residents.`, transferred: 0 };
    }
    const dependent = source.residents.find(candidate =>
      candidate.id !== resident.id
      && (candidate.caregiverIds ?? []).includes(resident.id)
      && ["infant", "toddler", "child", "teen"].includes(this.residentLifeStage(candidate))
    );
    if (dependent) {
      return { ok: false, reason: `${resident.name} must arrange care for ${dependent.name} before moving.`, transferred: 0 };
    }
    const sourceFunds = this.homeHouseholdFunds(source);
    const destinationFunds = this.homeHouseholdFunds(destination);
    const transfer = Math.min(
      10_000,
      Math.max(0, Math.floor(sourceFunds / Math.max(1, source.residents.length))),
      Math.max(0, 10_000_000 - destinationFunds)
    );
    const partnerId = resident.currentAction?.partnerResidentId;
    this.checkpoint();
    if (partnerId) {
      const partner = source.residents.find(candidate => candidate.id === partnerId);
      if (partner?.currentAction?.partnerResidentId === resident.id) partner.currentAction = undefined;
    }
    resident.currentAction = undefined;
    resident.homeFloor = 0;
    const destinationRoom = destination.rooms.find(room => homeEntityFloor(room) === 0) ?? destination.rooms[0];
    resident.homePosition = destinationRoom ? { x: destinationRoom.x, z: destinationRoom.z } : { x: 0, z: 0 };
    resident.caregiverIds = (resident.caregiverIds ?? []).filter(id => destination.residents.some(candidate => candidate.id === id));
    source.residents = source.residents.filter(candidate => candidate.id !== resident.id);
    source.relationships = source.relationships.filter(relationship => !relationship.residentIds.includes(resident.id));
    source.gatherings = (source.gatherings ?? []).filter(gathering => gathering.hostResidentId !== resident.id);
    if (source.lastPurchase?.residentId === resident.id) source.lastPurchase = undefined;
    for (const furniture of source.furniture) {
      if (furniture.ownerResidentId === resident.id) furniture.ownerResidentId = undefined;
    }
    for (const room of source.rooms) {
      room.assignedResidentIds = (room.assignedResidentIds ?? []).filter(id => id !== resident.id);
    }
    for (const remainingResident of source.residents) {
      remainingResident.caregiverIds = (remainingResident.caregiverIds ?? []).filter(id => id !== resident.id);
    }
    destination.residents.push(resident);
    destination.relationships = normalizeRelationships(destination.residents, destination.relationships);
    source.householdFunds = sourceFunds - transfer;
    destination.householdFunds = destinationFunds + transfer;
    this.recordResidentMilestone(
      resident,
      "move",
      `Moved to ${destination.name}`,
      `${resident.name} left ${source.name} and began a new household chapter.`
    );
    return {
      ok: true,
      reason: `${resident.name} moved to ${destination.name} with ${transfer ? `$${transfer.toLocaleString("en-US")}` : "no household funds"}.`,
      transferred: transfer
    };
  }

  familyMoveResidentIds(sourceHomeId: string, residentId: string) {
    const source = this.homes.find(home => home.id === sourceHomeId);
    if (!source?.residents.some(resident => resident.id === residentId)) return [];
    const movingIds = new Set([residentId]);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const dependent of source.residents) {
        if (
          !["infant", "toddler", "child", "teen"].includes(this.residentLifeStage(dependent))
          || !(dependent.caregiverIds ?? []).some(id => movingIds.has(id))
        ) continue;
        if (!movingIds.has(dependent.id)) {
          movingIds.add(dependent.id);
          expanded = true;
        }
        for (const caregiverId of dependent.caregiverIds ?? []) {
          if (!source.residents.some(resident => resident.id === caregiverId) || movingIds.has(caregiverId)) continue;
          movingIds.add(caregiverId);
          expanded = true;
        }
      }
    }
    return source.residents.filter(resident => movingIds.has(resident.id)).map(resident => resident.id);
  }

  moveHouseholdGroup(sourceHomeId: string, residentIds: string[], destinationHomeId: string) {
    const source = this.homes.find(home => home.id === sourceHomeId);
    const destination = this.homes.find(home => home.id === destinationHomeId);
    const uniqueIds = [...new Set(residentIds)];
    const movingIds = new Set(uniqueIds);
    const movingResidents = source?.residents.filter(resident => movingIds.has(resident.id)) ?? [];
    if (
      !source
      || !destination
      || source.id === destination.id
      || uniqueIds.length < 2
      || movingResidents.length !== uniqueIds.length
    ) {
      return { ok: false, reason: "Choose a linked family group and a different household.", transferred: 0, residentIds: [] as string[] };
    }
    if (destination.residents.length + movingResidents.length > 8) {
      return { ok: false, reason: `${destination.name} cannot hold that family group.`, transferred: 0, residentIds: [] as string[] };
    }
    const remainingResidents = source.residents.filter(resident => !movingIds.has(resident.id));
    const futureDestinationResidents = [...destination.residents, ...movingResidents];
    const hasLocalCaregiver = (resident: Resident, residents: Resident[]) =>
      !["infant", "toddler", "child", "teen"].includes(this.residentLifeStage(resident))
      || (resident.caregiverIds ?? []).some(id => residents.some(candidate => candidate.id === id));
    const unsupported = [...remainingResidents, ...movingResidents].find(resident =>
      !hasLocalCaregiver(resident, movingIds.has(resident.id) ? futureDestinationResidents : remainingResidents)
    );
    if (unsupported) {
      return { ok: false, reason: `${unsupported.name} needs a caregiver in the same household.`, transferred: 0, residentIds: [] as string[] };
    }
    const sourceFunds = this.homeHouseholdFunds(source);
    const destinationFunds = this.homeHouseholdFunds(destination);
    const transfer = Math.min(
      50_000,
      Math.max(0, Math.floor(sourceFunds * movingResidents.length / Math.max(1, source.residents.length))),
      Math.max(0, 10_000_000 - destinationFunds)
    );
    const preservedRelationships = source.relationships.filter(relationship =>
      relationship.residentIds.every(id => movingIds.has(id))
    );
    this.checkpoint();
    for (const resident of source.residents) {
      if (movingIds.has(resident.id) || (resident.currentAction?.partnerResidentId && movingIds.has(resident.currentAction.partnerResidentId))) {
        resident.currentAction = undefined;
      }
    }
    const destinationRoom = destination.rooms.find(room => homeEntityFloor(room) === 0) ?? destination.rooms[0];
    for (const resident of movingResidents) {
      resident.currentAction = undefined;
      resident.homeFloor = 0;
      resident.homePosition = destinationRoom ? { x: destinationRoom.x, z: destinationRoom.z } : { x: 0, z: 0 };
      resident.caregiverIds = (resident.caregiverIds ?? []).filter(id => futureDestinationResidents.some(candidate => candidate.id === id));
      this.recordResidentMilestone(
        resident,
        "move",
        `Family move to ${destination.name}`,
        `${resident.name} began a new household chapter with ${movingResidents.length - 1} family member${movingResidents.length === 2 ? "" : "s"}.`
      );
    }
    for (const resident of remainingResidents) {
      resident.caregiverIds = (resident.caregiverIds ?? []).filter(id => remainingResidents.some(candidate => candidate.id === id));
    }
    for (const furniture of source.furniture) {
      if (furniture.ownerResidentId && movingIds.has(furniture.ownerResidentId)) furniture.ownerResidentId = undefined;
    }
    for (const room of source.rooms) {
      room.assignedResidentIds = (room.assignedResidentIds ?? []).filter(id => !movingIds.has(id));
    }
    source.residents = remainingResidents;
    source.relationships = normalizeRelationships(remainingResidents, source.relationships);
    source.gatherings = (source.gatherings ?? []).filter(gathering => !movingIds.has(gathering.hostResidentId));
    if (source.lastPurchase?.residentId && movingIds.has(source.lastPurchase.residentId)) source.lastPurchase = undefined;
    destination.residents.push(...movingResidents);
    destination.relationships = normalizeRelationships(
      destination.residents,
      [...destination.relationships, ...preservedRelationships]
    );
    source.householdFunds = sourceFunds - transfer;
    destination.householdFunds = destinationFunds + transfer;
    return {
      ok: true,
      reason: `${movingResidents.length} family members moved to ${destination.name} with ${transfer ? `$${transfer.toLocaleString("en-US")}` : "no household funds"}.`,
      transferred: transfer,
      residentIds: uniqueIds
    };
  }

  changeRevision() {
    return this.revision;
  }

  serialize() {
    return JSON.stringify(this.snapshot());
  }

  restore(serialized: string) {
    try {
      const parsed = JSON.parse(serialized) as WorldSnapshot;
      if (parsed.version !== 1) return false;
      this.checkpoint();
      this.apply(parsed);
      this.controlledResidentId = undefined;
      return true;
    } catch {
      return false;
    }
  }

  save() {
    localStorage.setItem("gridless-world-v1", this.serialize());
  }

  load() {
    const stored = localStorage.getItem("gridless-world-v1");
    if (!stored) return false;
    return this.restore(stored);
  }

  saveAutosave() {
    localStorage.setItem("gridless-autosave-v1", this.serialize());
  }

  loadAutosave() {
    const stored = localStorage.getItem("gridless-autosave-v1");
    return stored ? this.restore(stored) : false;
  }

  hasAutosave() {
    return Boolean(localStorage.getItem("gridless-autosave-v1"));
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
      rooms: [{ id: crypto.randomUUID(), kind: "Living space", x: 0, z: 0, width: 7, depth: 6, floorFinish: "oak", wallFinish: "warm-white", floor: 0, condition: 100 }],
      furniture: [
        { id: crypto.randomUUID(), kind: "sofa", x: 0, z: 0, rotation: 0, style: "natural", floor: 0, condition: 100 },
        { id: crypto.randomUUID(), kind: "plant", x: 2.2, z: 1.8, rotation: 0, style: "natural", floor: 0, condition: 100 }
      ],
      stairs: [],
      roofStyle: defaultHomeRoofStyle(this.templateId),
      roofColor: defaultHomeRoofColor(this.templateId),
      foundationStyle: defaultHomeFoundationStyle(this.templateId),
      designBudget: 60_000,
      designSpent: HOME_BUILD_COSTS.sofa + HOME_BUILD_COSTS.plant,
      householdFunds: 15_000,
      lastDailyIncome: 0,
      lastDailyExpenses: 0,
      lastDailyUtilityCost: 0,
      discretionarySpent: 0,
      residents: [],
      relationships: []
    };
    this.homes.push(home);
    lot.homeId = home.id;
    return home;
  }

  addRoom(homeId: string, room: Omit<Home["rooms"][number], "id">) {
    const home = this.homes.find(item => item.id === homeId);
    const floor = Math.round(room.floor ?? 0);
    if (!home || room.width < 2 || room.depth < 2 || !Number.isInteger(floor) || floor < 0 || floor >= home.floors) return false;
    const cost = Math.round(room.width * room.depth * HOME_BUILD_COSTS.roomPerSquareMeter);
    if (this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    home.rooms.push({ id: crypto.randomUUID(), floorFinish: "oak", wallFinish: "warm-white", ...clone(room), floor, condition: 100 });
    home.designSpent += cost;
    return true;
  }

  setRoomFloorFinish(homeId: string, roomId: string, finish: HomeFloorFinish) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    if (!home || !room || (room.floorFinish ?? "oak") === finish) return false;
    const cost = Math.round(room.width * room.depth * HOME_FINISH_COSTS.floor[finish]);
    if (this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    room.floorFinish = finish;
    room.condition = 100;
    room.lastRenovatedAt = this.clock.elapsedMinutes;
    home.designSpent += cost;
    return true;
  }

  setRoomWallFinish(homeId: string, roomId: string, finish: HomeWallFinish) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    if (!home || !room || (room.wallFinish ?? "warm-white") === finish) return false;
    const wallArea = (room.width + room.depth) * 2 * 2.8;
    const cost = Math.round(wallArea * HOME_FINISH_COSTS.wall[finish]);
    if (this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    room.wallFinish = finish;
    room.condition = 100;
    room.lastRenovatedAt = this.clock.elapsedMinutes;
    home.designSpent += cost;
    return true;
  }

  setRoomKind(homeId: string, roomId: string, kind: HomeRoomKind) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    if (!home || !room || room.kind === kind || !HOME_ROOM_KINDS.includes(kind)) return false;
    this.checkpoint();
    room.kind = kind;
    if (kind !== "Bedroom" && kind !== "Nursery" && kind !== "Studio") room.assignedResidentIds = [];
    return true;
  }

  roomResidentCapacity(home: Home, room: HomeRoom) {
    if (room.kind !== "Bedroom" && room.kind !== "Nursery" && room.kind !== "Studio") return 0;
    return home.furniture.filter(item =>
      item.kind === "bed"
      && homeEntityFloor(item) === homeEntityFloor(room)
      && Math.abs(item.x - room.x) <= room.width / 2
      && Math.abs(item.z - room.z) <= room.depth / 2
    ).length;
  }

  assignResidentRoom(homeId: string, roomId: string, residentId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    const resident = home?.residents.find(item => item.id === residentId);
    if (!home || !room || !resident) return false;
    const capacity = this.roomResidentCapacity(home, room);
    const assigned = room.assignedResidentIds ?? [];
    if (!capacity || (!assigned.includes(residentId) && assigned.length >= capacity)) return false;
    if (assigned.includes(residentId)) return true;
    this.checkpoint();
    for (const candidate of home.rooms) {
      candidate.assignedResidentIds = (candidate.assignedResidentIds ?? []).filter(id => id !== residentId);
    }
    room.assignedResidentIds = [...(room.assignedResidentIds ?? []), residentId];
    resident.homeFloor = homeEntityFloor(room);
    return true;
  }

  unassignResidentRoom(homeId: string, residentId: string) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home || !home.rooms.some(room => (room.assignedResidentIds ?? []).includes(residentId))) return false;
    this.checkpoint();
    for (const room of home.rooms) room.assignedResidentIds = (room.assignedResidentIds ?? []).filter(id => id !== residentId);
    return true;
  }

  clearRoomAssignments(homeId: string, roomId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    if (!home || !room?.assignedResidentIds?.length) return false;
    this.checkpoint();
    room.assignedResidentIds = [];
    return true;
  }

  residentRoom(home: Home, residentId: string) {
    return home.rooms.find(room => (room.assignedResidentIds ?? []).includes(residentId));
  }

  homePrivacy(home: Home) {
    if (!home.residents.length) return 100;
    return Math.round(average(home.residents.map(resident => {
      const room = this.residentRoom(home, resident.id);
      if (!room) return 25;
      const occupants = (room.assignedResidentIds ?? []).length;
      if (occupants <= 1) return 100;
      const stage = this.residentLifeStage(resident);
      return stage === "infant" || stage === "toddler" || stage === "child" ? 85 : 65;
    })));
  }

  autoFurnishRoom(homeId: string, roomId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    const roomKind = room?.kind as HomeRoomKind | undefined;
    if (!home || !room || !roomKind || !HOME_ROOM_KINDS.includes(roomKind)) {
      return { placed: 0, spent: 0, skipped: 0 };
    }
    const planned: Home["furniture"] = [];
    let spent = 0;
    let skipped = 0;
    const starterSet = HOME_ROOM_STARTER_SETS[roomKind];
    const roomFloor = homeEntityFloor(room);
    const existingKinds = new Set(home.furniture
      .filter(item =>
        homeEntityFloor(item) === roomFloor
        &&
        Math.abs(item.x - room.x) <= room.width / 2
        && Math.abs(item.z - room.z) <= room.depth / 2
      )
      .map(item => item.kind));
    const candidates: Point2[] = [];
    for (let x = room.x - room.width / 2 + .5; x <= room.x + room.width / 2 - .5; x += .5) {
      for (let z = room.z - room.depth / 2 + .5; z <= room.z + room.depth / 2 - .5; z += .5) {
        candidates.push({ x, z });
      }
    }
    candidates.sort((first, second) =>
      distance(second, room) - distance(first, room)
      || first.x - second.x
      || first.z - second.z
    );
    for (const kind of starterSet) {
      if (existingKinds.has(kind)) continue;
      if (this.homeRemainingBudget(home) - spent < HOME_BUILD_COSTS[kind]) {
        skipped++;
        continue;
      }
      const workingHome: Home = { ...home, furniture: [...home.furniture, ...planned] };
      let placement: Home["furniture"][number] | undefined;
      for (const rotation of [0, Math.PI / 2]) {
        const point = candidates.find(candidate =>
          this.canPlaceFurniture(workingHome, kind, candidate.x, candidate.z, rotation, undefined, roomFloor)
        );
        if (point) {
          placement = { id: crypto.randomUUID(), kind, x: point.x, z: point.z, rotation, style: "natural", floor: roomFloor, condition: 100 };
          break;
        }
      }
      if (!placement) {
        skipped++;
        continue;
      }
      planned.push(placement);
      existingKinds.add(kind);
      spent += HOME_BUILD_COSTS[kind];
    }
    if (!planned.length) return { placed: 0, spent: 0, skipped };
    this.checkpoint();
    home.furniture.push(...planned);
    home.designSpent += spent;
    return { placed: planned.length, spent, skipped };
  }

  removeRoom(homeId: string, roomId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    if (!home || !room || home.rooms.filter(candidate => homeEntityFloor(candidate) === homeEntityFloor(room)).length <= 1) return false;
    const remainingRooms = home.rooms.filter(item => item.id !== roomId);
    const roomFloor = homeEntityFloor(room);
    const remainingStairs = (home.stairs ?? []).filter(stair => {
      const corners = rectangleCorners(stair.x, stair.z, 2, 4, stair.rotation);
      return [stair.fromFloor, stair.toFloor].every(floor => remainingRooms.some(candidate =>
        homeEntityFloor(candidate) === floor
        && corners.every(corner =>
          Math.abs(corner.x - candidate.x) <= candidate.width / 2 - .1
          && Math.abs(corner.z - candidate.z) <= candidate.depth / 2 - .1
        )
      ));
    });
    const removedStairCount = (home.stairs ?? []).length - remainingStairs.length;
    const removedFurniture = home.furniture.filter(item => {
      const insideRemoved = homeEntityFloor(item) === roomFloor
        && Math.abs(item.x - room.x) <= room.width / 2
        && Math.abs(item.z - room.z) <= room.depth / 2;
      const insideRemaining = remainingRooms.some(candidate =>
        homeEntityFloor(candidate) === roomFloor
        && Math.abs(item.x - candidate.x) <= candidate.width / 2
        && Math.abs(item.z - candidate.z) <= candidate.depth / 2
      );
      return insideRemoved && !insideRemaining;
    });
    const removedFurnitureIds = new Set(removedFurniture.map(item => item.id));
    const removedWindows = (home.windows ?? []).filter(window => window.roomId === roomId);
    const removedDoors = (home.doors ?? []).filter(door => door.roomIds.includes(roomId));
    const refund = Math.round(room.width * room.depth * HOME_BUILD_COSTS.roomPerSquareMeter * .25)
      + removedFurniture.reduce((total, item) => total + Math.round(HOME_BUILD_COSTS[item.kind] * .5), 0)
      + removedWindows.reduce((total, window) => total + Math.round(this.homeWindowCost(window.glazing) * .5), 0)
      + removedDoors.reduce((total, door) => total + Math.round(this.homeDoorCost(door.widthKind) * .5), 0)
      + Math.round(removedStairCount * HOME_BUILD_COSTS.stairs * .5);
    this.checkpoint();
    home.rooms = remainingRooms;
    home.furniture = home.furniture.filter(item => !removedFurnitureIds.has(item.id));
    home.stairs = remainingStairs;
    if (home.windows !== undefined) home.windows = home.windows.filter(window => window.roomId !== roomId);
    if (home.doors !== undefined) home.doors = home.doors.filter(door => !door.roomIds.includes(roomId));
    home.designSpent = Math.max(0, home.designSpent - refund);
    for (const resident of home.residents) {
      if (resident.currentAction?.targetFurnitureId && removedFurnitureIds.has(resident.currentAction.targetFurnitureId)) {
        resident.currentAction = undefined;
      }
    }
    return true;
  }

  addFurniture(homeId: string, kind: Home["furniture"][number]["kind"], x: number, z: number, floor = 0) {
    const home = this.homes.find(item => item.id === homeId);
    const cost = HOME_BUILD_COSTS[kind];
    if (!home || !Number.isInteger(floor) || floor < 0 || floor >= home.floors || !this.canPlaceFurniture(home, kind, x, z, 0, undefined, floor) || this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    home.furniture.push({ id: crypto.randomUUID(), kind, x, z, rotation: 0, style: "natural", floor, condition: 100 });
    home.designSpent += cost;
    return true;
  }

  addHomeFloor(homeId: string) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home || home.floors >= MAX_HOME_FLOORS || this.homeRemainingBudget(home) < HOME_BUILD_COSTS.floorShell) return false;
    this.checkpoint();
    home.floors += 1;
    home.designSpent += HOME_BUILD_COSTS.floorShell;
    return true;
  }

  removeTopHomeFloor(homeId: string) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home || home.floors <= 1) return false;
    const floor = home.floors - 1;
    const removedRooms = home.rooms.filter(room => homeEntityFloor(room) === floor);
    const removedFurniture = home.furniture.filter(item => homeEntityFloor(item) === floor);
    const removedFurnitureIds = new Set(removedFurniture.map(item => item.id));
    const removedStairCount = (home.stairs ?? []).filter(stair => stair.fromFloor === floor - 1 && stair.toFloor === floor).length;
    const removedWindows = (home.windows ?? []).filter(window => window.floor === floor);
    const removedDoors = (home.doors ?? []).filter(door => door.floor === floor);
    const removedRoomCost = removedRooms.reduce((total, room) => total + room.width * room.depth * HOME_BUILD_COSTS.roomPerSquareMeter, 0);
    const removedFurnitureCost = removedFurniture.reduce((total, item) => total + HOME_BUILD_COSTS[item.kind], 0);
    const removedWindowCost = removedWindows.reduce((total, window) => total + this.homeWindowCost(window.glazing), 0);
    const removedDoorCost = removedDoors.reduce((total, door) => total + this.homeDoorCost(door.widthKind), 0);
    const refund = Math.round(HOME_BUILD_COSTS.floorShell * .35 + removedRoomCost * .25 + removedFurnitureCost * .5 + removedWindowCost * .5 + removedDoorCost * .5 + removedStairCount * HOME_BUILD_COSTS.stairs * .5);
    this.checkpoint();
    home.rooms = home.rooms.filter(room => homeEntityFloor(room) !== floor);
    home.furniture = home.furniture.filter(item => homeEntityFloor(item) !== floor);
    home.stairs = (home.stairs ?? []).filter(stair => stair.fromFloor !== floor - 1 && stair.toFloor !== floor);
    if (home.windows !== undefined) home.windows = home.windows.filter(window => window.floor !== floor);
    if (home.doors !== undefined) home.doors = home.doors.filter(door => door.floor !== floor);
    home.floors -= 1;
    home.designSpent = Math.max(0, home.designSpent - refund);
    for (const resident of home.residents) {
      if ((resident.homeFloor ?? 0) >= home.floors) resident.homeFloor = home.floors - 1;
      if (resident.currentAction?.targetFurnitureId && removedFurnitureIds.has(resident.currentAction.targetFurnitureId)) {
        resident.currentAction = undefined;
      }
    }
    return true;
  }

  addStairs(homeId: string, fromFloor: number, x: number, z: number, rotation = 0) {
    const home = this.homes.find(item => item.id === homeId);
    const normalizedFloor = Math.round(fromFloor);
    const stairCorners = rectangleCorners(x, z, 2, 4, rotation);
    const contains = (floor: number) => home?.rooms.some(room =>
      homeEntityFloor(room) === floor
      && stairCorners.every(corner =>
        Math.abs(corner.x - room.x) <= room.width / 2 - .1
        && Math.abs(corner.z - room.z) <= room.depth / 2 - .1
      )
    );
    if (
      !home
      || normalizedFloor < 0
      || normalizedFloor >= home.floors - 1
      || !contains(normalizedFloor)
      || !contains(normalizedFloor + 1)
      || this.homeRemainingBudget(home) < HOME_BUILD_COSTS.stairs
      || (home.stairs ?? []).some(stair => stair.fromFloor === normalizedFloor)
    ) return false;
    this.checkpoint();
    home.stairs ??= [];
    home.stairs.push({ id: crypto.randomUUID(), x, z, rotation, fromFloor: normalizedFloor, toFloor: normalizedFloor + 1 });
    home.designSpent += HOME_BUILD_COSTS.stairs;
    return true;
  }

  homeWindowCost(glazing: HomeWindowGlazing) {
    return HOME_BUILD_COSTS.window + (glazing === "privacy" ? HOME_BUILD_COSTS.privacyGlazing : 0);
  }

  previewHomeWindow(home: Home, point: Point2, floor = 0, glazing: HomeWindowGlazing = "clear") {
    const width = 1.3;
    const candidates = home.rooms
      .filter(room => homeEntityFloor(room) === floor)
      .flatMap(room => homeRoomExteriorWalls(home, room).flatMap(wall => {
        if (wall.end - wall.start < width + .3) return [];
        const along = wall.orientation === "z" ? point.x : point.z;
        const perpendicular = wall.orientation === "z" ? point.z : point.x;
        const center = clamp(along, wall.start + width / 2 + .1, wall.end - width / 2 - .1);
        return [{
          roomId: room.id,
          floor,
          orientation: wall.orientation,
          side: wall.side,
          boundary: wall.boundary,
          center,
          width,
          glazing,
          distance: Math.hypot(perpendicular - wall.boundary, along - center)
        }];
      }))
      .sort((first, second) => first.distance - second.distance);
    const candidate = candidates[0];
    if (!candidate || candidate.distance > 1.25) return undefined;
    const overlaps = (home.windows ?? []).some(window =>
      window.floor === floor
      && window.orientation === candidate.orientation
      && Math.abs(window.boundary - candidate.boundary) < .15
      && Math.abs(window.center - candidate.center) < (window.width + candidate.width) / 2 + .18
    );
    if (overlaps) return undefined;
    const { distance: _distance, ...placement } = candidate;
    return placement;
  }

  addHomeWindow(homeId: string, point: Point2, floor = 0, glazing: HomeWindowGlazing = "clear") {
    const home = this.homes.find(item => item.id === homeId);
    const cost = this.homeWindowCost(glazing);
    const placement = home && this.previewHomeWindow(home, point, floor, glazing);
    if (!home || !placement || this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    home.windows ??= [];
    home.windows.push({ id: crypto.randomUUID(), ...placement });
    home.designSpent += cost;
    return true;
  }

  removeHomeWindow(homeId: string, windowId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const window = home?.windows?.find(item => item.id === windowId);
    if (!home || !window) return false;
    this.checkpoint();
    home.windows = home.windows!.filter(item => item.id !== windowId);
    home.designSpent = Math.max(0, home.designSpent - Math.round(this.homeWindowCost(window.glazing) * .5));
    return true;
  }

  homeDoorCost(widthKind: HomeDoorWidth) {
    return HOME_BUILD_COSTS.door + (widthKind === "wide" ? HOME_BUILD_COSTS.wideDoor : 0);
  }

  previewHomeDoor(home: Home, point: Point2, floor = 0, widthKind: HomeDoorWidth = "standard") {
    const width = widthKind === "wide" ? 1.35 : .95;
    const candidates = homeSharedWallSegments(home)
      .filter(wall => wall.floor === floor && wall.end - wall.start >= width + .3)
      .map(wall => {
        const along = wall.orientation === "z" ? point.x : point.z;
        const perpendicular = wall.orientation === "z" ? point.z : point.x;
        const center = clamp(along, wall.start + width / 2 + .1, wall.end - width / 2 - .1);
        return {
          roomIds: wall.roomIds,
          floor,
          orientation: wall.orientation,
          boundary: wall.boundary,
          center,
          width,
          widthKind,
          distance: Math.hypot(perpendicular - wall.boundary, along - center)
        };
      })
      .sort((first, second) => first.distance - second.distance);
    const candidate = candidates[0];
    if (!candidate || candidate.distance > 1.25) return undefined;
    const overlaps = (home.doors ?? []).some(door =>
      door.floor === floor
      && door.orientation === candidate.orientation
      && Math.abs(door.boundary - candidate.boundary) < .15
      && Math.abs(door.center - candidate.center) < (door.width + candidate.width) / 2 + .18
    );
    if (overlaps) return undefined;
    const { distance: _distance, ...placement } = candidate;
    return placement;
  }

  addHomeDoor(homeId: string, point: Point2, floor = 0, widthKind: HomeDoorWidth = "standard") {
    const home = this.homes.find(item => item.id === homeId);
    const cost = this.homeDoorCost(widthKind);
    const placement = home && this.previewHomeDoor(home, point, floor, widthKind);
    if (!home || !placement || this.homeRemainingBudget(home) < cost) return false;
    this.checkpoint();
    home.doors ??= [];
    home.doors.push({ id: crypto.randomUUID(), ...placement });
    home.designSpent += cost;
    return true;
  }

  removeHomeDoor(homeId: string, doorId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const door = home?.doors?.find(item => item.id === doorId);
    if (!home || !door) return false;
    this.checkpoint();
    home.doors = home.doors!.filter(item => item.id !== doorId);
    home.designSpent = Math.max(0, home.designSpent - Math.round(this.homeDoorCost(door.widthKind) * .5));
    return true;
  }

  homeRoofCost(style: HomeRoofStyle) {
    return HOME_BUILD_COSTS.roof + (style === "green" ? HOME_BUILD_COSTS.greenRoof : 0);
  }

  setHomeRoof(homeId: string, style: HomeRoofStyle, color: string) {
    const home = this.homes.find(item => item.id === homeId);
    const normalizedColor = /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : undefined;
    const styles: HomeRoofStyle[] = ["gable", "hip", "flat", "green"];
    const cost = this.homeRoofCost(style);
    if (
      !home
      || !styles.includes(style)
      || !normalizedColor
      || ((home.roofStyle ?? defaultHomeRoofStyle(this.templateId)) === style
        && (home.roofColor ?? defaultHomeRoofColor(this.templateId)) === normalizedColor)
      || this.homeRemainingBudget(home) < cost
    ) return false;
    this.checkpoint();
    home.roofStyle = style;
    home.roofColor = normalizedColor;
    home.designSpent += cost;
    return true;
  }

  homeFoundationCost(style: HomeFoundationStyle) {
    return HOME_BUILD_COSTS.foundation
      + (style === "crawlspace" ? HOME_BUILD_COSTS.crawlspaceFoundation : style === "raised" ? HOME_BUILD_COSTS.raisedFoundation : 0);
  }

  homeFoundationPerformance(home: Home) {
    const style = home.foundationStyle ?? defaultHomeFoundationStyle(this.templateId);
    const protection = style === "raised" ? .85 : style === "crawlspace" ? .45 : 0;
    const lot = this.lots.find(candidate => candidate.id === home.lotId);
    const rawRisk = lot ? this.lotFloodRiskScore(lot) : 0;
    const residualExposure = Math.round(rawRisk * (1 - protection) * 100);
    return {
      style,
      protection: Math.round(protection * 100),
      residualExposure,
      floodRisk: lot ? this.lotFloodRisk(lot) : "none" as FloodRisk
    };
  }

  setHomeFoundation(homeId: string, style: HomeFoundationStyle) {
    const home = this.homes.find(item => item.id === homeId);
    const styles: HomeFoundationStyle[] = ["slab", "crawlspace", "raised"];
    const cost = this.homeFoundationCost(style);
    if (
      !home
      || !styles.includes(style)
      || (home.foundationStyle ?? defaultHomeFoundationStyle(this.templateId)) === style
      || this.homeRemainingBudget(home) < cost
    ) return false;
    this.checkpoint();
    home.foundationStyle = style;
    home.designSpent += cost;
    return true;
  }

  setFurnitureStyle(homeId: string, furnitureId: string, style: HomeFurnitureStyle) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (!home || !furniture || furniture.style === style) return false;
    this.checkpoint();
    furniture.style = style;
    return true;
  }

  setFurnitureVariant(homeId: string, furnitureId: string, variant: HomeFurnitureVariant) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (!home || !furniture || !HOME_FURNITURE_VARIANTS.includes(variant) || (furniture.variant ?? "classic") === variant) return false;
    this.checkpoint();
    furniture.variant = variant;
    return true;
  }

  setFurnitureTint(homeId: string, furnitureId: string, tint: string) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    const normalizedTint = normalizeFurnitureTint(tint);
    if (!home || !furniture || !normalizedTint || furniture.tint === normalizedTint) return false;
    this.checkpoint();
    furniture.tint = normalizedTint;
    return true;
  }

  setFurnitureOwner(homeId: string, furnitureId: string, residentId?: string) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (!home || !furniture || (residentId && !home.residents.some(resident => resident.id === residentId))) return false;
    const normalizedOwner = residentId || undefined;
    if (furniture.ownerResidentId === normalizedOwner) return false;
    this.checkpoint();
    furniture.ownerResidentId = normalizedOwner;
    return true;
  }

  setResidentOutfit(
    homeId: string,
    residentId: string,
    style: ResidentOutfitStyle,
    palette: ResidentOutfitPalette
  ) {
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    if (!home || !resident || !RESIDENT_OUTFIT_DEFINITIONS[style] || !RESIDENT_OUTFIT_PALETTES[palette]) return false;
    if (this.residentOutfitStyle(resident) === style && this.residentOutfitPalette(resident) === palette) return false;
    this.checkpoint();
    resident.outfitStyle = style;
    resident.outfitPalette = palette;
    return true;
  }

  canPlaceFurniture(
    home: Home,
    kind: Home["furniture"][number]["kind"],
    x: number,
    z: number,
    rotation: number,
    ignoreFurnitureId?: string,
    floor = 0
  ) {
    const candidate = { kind, x, z, rotation };
    const corners = furnitureCorners(candidate);
    const containingRoom = home.rooms.find(room => homeEntityFloor(room) === floor && corners.every(corner =>
      Math.abs(corner.x - room.x) <= room.width / 2 - .1
      && Math.abs(corner.z - room.z) <= room.depth / 2 - .1
    ));
    if (!containingRoom) return false;
    return !home.furniture.some(item =>
      homeEntityFloor(item) === floor && item.id !== ignoreFurnitureId && furnitureRectanglesOverlap(candidate, item, .08)
    );
  }

  moveFurniture(homeId: string, furnitureId: string, x: number, z: number) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (
      !home
      || !furniture
      || !this.canPlaceFurniture(home, furniture.kind, x, z, furniture.rotation, furniture.id, homeEntityFloor(furniture))
    ) return false;
    this.checkpoint();
    furniture.x = x;
    furniture.z = z;
    return true;
  }

  homeRemainingBudget(home: Home) {
    return Math.max(0, home.designBudget - home.designSpent);
  }

  homeHouseholdFunds(home: Home) {
    return Math.round(home.householdFunds ?? 15_000);
  }

  homeDailyNet(home: Home) {
    return Math.round((home.lastDailyIncome ?? 0) - (home.lastDailyExpenses ?? 0));
  }

  homeFinancialSecurity(home: Home) {
    const funds = this.homeHouseholdFunds(home);
    const dailyNet = this.homeDailyNet(home);
    return Math.round(clamp(48 + funds / 420 + dailyNet * .1, 0, 100));
  }

  homeEnergyPerformance(home: Home) {
    const weather = this.weather();
    const area = Math.max(1, home.rooms.reduce((total, room) => total + room.width * room.depth, 0));
    const daylight = this.homeDaylight(home);
    const roofStyle = home.roofStyle ?? defaultHomeRoofStyle(this.templateId);
    const foundationStyle = home.foundationStyle ?? defaultHomeFoundationStyle(this.templateId);
    const roofHeatingFactor = roofStyle === "green" ? .76 : roofStyle === "gable" || roofStyle === "hip" ? .9 : 1;
    const roofCoolingFactor = roofStyle === "green" ? .58 : roofStyle === "gable" || roofStyle === "hip" ? .86 : 1;
    const foundationFactor = foundationStyle === "crawlspace" ? .88 : foundationStyle === "raised" ? .94 : 1;
    const authoredWindowWidth = (home.windows ?? []).reduce((total, window) => total + window.width, 0);
    const privacyWidth = (home.windows ?? []).filter(window => window.glazing === "privacy").reduce((total, window) => total + window.width, 0);
    const windowFactor = 1 + authoredWindowWidth / area * .42 - privacyWidth / area * .12;
    const heating = Math.max(0, 18 - weather.temperatureC) * area * .035 * roofHeatingFactor * foundationFactor * windowFactor;
    const cooling = Math.max(0, weather.temperatureC - 23) * area * .045 * roofCoolingFactor * windowFactor;
    const lighting = (100 - daylight) / 100 * home.rooms.length * 3.8;
    const base = home.rooms.length * 2.4 + home.residents.length * 1.5;
    const dailyKwh = Math.round((base + heating + cooling + lighting) * 10) / 10;
    const dailyCost = Math.max(1, Math.round(dailyKwh * .18));
    const intensity = dailyKwh / area;
    const score = Math.round(clamp(100 - intensity * 38 + daylight * .18 + (roofStyle === "green" ? 8 : 0), 0, 100));
    const benefits = [
      roofStyle === "green" ? "planted roof reduces seasonal load" : undefined,
      daylight >= 70 ? "strong daylight reduces lighting demand" : undefined,
      privacyWidth > 0 ? "privacy glazing moderates solar gain" : undefined,
      foundationStyle === "crawlspace" ? "crawlspace moderates ground transfer" : undefined
    ].filter((benefit): benefit is string => Boolean(benefit));
    return { score, dailyKwh, dailyCost, heating: Math.round(heating * 10) / 10, cooling: Math.round(cooling * 10) / 10, lighting: Math.round(lighting * 10) / 10, benefits };
  }

  roomCondition(room: HomeRoom) {
    return Math.round(clamp(room.condition ?? 100, 0, 100));
  }

  furnitureCondition(furniture: Home["furniture"][number]) {
    return Math.round(clamp(furniture.condition ?? 100, 0, 100));
  }

  homeCondition(home: Home) {
    const roomCondition = average(home.rooms.map(room => this.roomCondition(room)));
    const furnitureCondition = home.furniture.length
      ? average(home.furniture.map(item => this.furnitureCondition(item)))
      : 100;
    return Math.round(roomCondition * .58 + furnitureCondition * .42);
  }

  homeConditionLabel(condition: number) {
    return condition >= 90 ? "Pristine" : condition >= 72 ? "Good" : condition >= 48 ? "Worn" : "Poor";
  }

  furnitureRepairCost(furniture: Home["furniture"][number]) {
    const wear = 1 - this.furnitureCondition(furniture) / 100;
    return wear <= 0 ? 0 : Math.max(25, Math.round(HOME_BUILD_COSTS[furniture.kind] * .42 * wear));
  }

  roomRenovationCost(room: HomeRoom) {
    const wear = 1 - this.roomCondition(room) / 100;
    return wear <= 0 ? 0 : Math.max(150, Math.round(room.width * room.depth * 24 * wear));
  }

  repairFurniture(homeId: string, furnitureId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (!home || !furniture) return { ok: false, cost: 0, reason: "That furnishing is unavailable" };
    const cost = this.furnitureRepairCost(furniture);
    if (!cost) return { ok: false, cost: 0, reason: "That furnishing is already pristine" };
    if (this.homeHouseholdFunds(home) < cost) {
      return { ok: false, cost, reason: `This repair needs $${cost}. The household has $${this.homeHouseholdFunds(home)}.` };
    }
    this.checkpoint();
    home.householdFunds = this.homeHouseholdFunds(home) - cost;
    furniture.condition = 100;
    furniture.lastRepairedAt = this.clock.elapsedMinutes;
    return { ok: true, cost, reason: `${furniture.kind} repaired` };
  }

  renovateRoom(homeId: string, roomId: string) {
    const home = this.homes.find(item => item.id === homeId);
    const room = home?.rooms.find(item => item.id === roomId);
    if (!home || !room) return { ok: false, cost: 0, reason: "That room is unavailable" };
    const cost = this.roomRenovationCost(room);
    if (!cost) return { ok: false, cost: 0, reason: "That room is already pristine" };
    if (this.homeHouseholdFunds(home) < cost) {
      return { ok: false, cost, reason: `This renovation needs $${cost}. The household has $${this.homeHouseholdFunds(home)}.` };
    }
    this.checkpoint();
    home.householdFunds = this.homeHouseholdFunds(home) - cost;
    room.condition = 100;
    room.lastRenovatedAt = this.clock.elapsedMinutes;
    return { ok: true, cost, reason: `${room.kind} renovated` };
  }

  householdGatherings(home: Home) {
    return [...(home.gatherings ?? [])].sort((first, second) => second.startAt - first.startAt);
  }

  activeHouseholdGathering(home: Home, elapsedMinute = this.clock.elapsedMinutes) {
    return (home.gatherings ?? []).find(gathering =>
      gathering.completedAt === undefined
      && elapsedMinute >= gathering.startAt
      && elapsedMinute < gathering.startAt + gathering.durationMinutes
    );
  }

  householdGatheringLabel(gathering: HouseholdGathering) {
    return HOUSEHOLD_GATHERING_DEFINITIONS[gathering.kind].label;
  }

  householdGatheringDate(gathering: HouseholdGathering) {
    const absoluteMinutes = Math.max(0, gathering.startAt + 8 * 60);
    const elapsedDays = Math.floor(absoluteMinutes / 1_440);
    const year = Math.floor(elapsedDays / 360) + 1;
    const dayOfYear = elapsedDays % 360;
    const month = Math.floor(dayOfYear / 30) + 1;
    const day = dayOfYear % 30 + 1;
    const minuteOfDay = positiveModulo(absoluteMinutes, 1_440);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    return `Y${year} M${month} D${day} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  householdGatheringStatus(gathering: HouseholdGathering) {
    if (gathering.completedAt !== undefined) return `${gathering.attendance ?? 0} attended · +${gathering.relationshipGain ?? 0} relationships`;
    if (this.clock.elapsedMinutes >= gathering.startAt) {
      return `In progress · ${Math.max(1, Math.ceil(gathering.startAt + gathering.durationMinutes - this.clock.elapsedMinutes))}m left`;
    }
    const minutes = Math.max(1, Math.ceil(gathering.startAt - this.clock.elapsedMinutes));
    return minutes < 120 ? `Starts in ${minutes}m` : `Starts in ${Math.round(minutes / 60)}h`;
  }

  scheduleHouseholdGathering(
    homeId: string,
    hostResidentId: string,
    kind: HouseholdGatheringKind,
    delayMinutes: number
  ) {
    const home = this.homes.find(item => item.id === homeId);
    const host = home?.residents.find(resident => resident.id === hostResidentId);
    const definition = HOUSEHOLD_GATHERING_DEFINITIONS[kind];
    if (!home || !host || !definition) return { ok: false, reason: "That gathering is unavailable" };
    const delay = Math.round(clamp(delayMinutes, 30, 7 * 24 * 60));
    const startAt = this.clock.elapsedMinutes + delay;
    const endAt = startAt + definition.durationMinutes;
    const overlaps = (home.gatherings ?? []).some(gathering =>
      gathering.completedAt === undefined
      && startAt < gathering.startAt + gathering.durationMinutes + 30
      && endAt + 30 > gathering.startAt
    );
    if (overlaps) return { ok: false, reason: "That household already has a gathering near this time" };
    if (this.homeHouseholdFunds(home) < definition.cost) {
      return { ok: false, reason: `${definition.label} needs $${definition.cost}. The household has $${this.homeHouseholdFunds(home)}.` };
    }
    this.checkpoint();
    const quality = this.homeQuality(home);
    const sociability = this.residentPersonality(host).sociability;
    const guestCount = Math.round(clamp(definition.baseGuests + quality / 22 + sociability / 28, 2, 14));
    const gathering: HouseholdGathering = {
      id: crypto.randomUUID(),
      kind,
      hostResidentId,
      startAt,
      durationMinutes: definition.durationMinutes,
      guestCount,
      cost: definition.cost
    };
    home.householdFunds = this.homeHouseholdFunds(home) - definition.cost;
    home.discretionarySpent = Math.max(0, Math.round(home.discretionarySpent ?? 0)) + definition.cost;
    home.gatherings = [...(home.gatherings ?? []), gathering]
      .sort((first, second) => first.startAt - second.startAt)
      .slice(-MAX_HOUSEHOLD_GATHERINGS);
    return { ok: true, reason: `${definition.label} scheduled with ${guestCount} invited guests`, gathering };
  }

  private completeHouseholdGatherings(previousElapsedMinute: number) {
    for (const home of this.homes) {
      for (const gathering of home.gatherings ?? []) {
        const endsAt = gathering.startAt + gathering.durationMinutes;
        if (gathering.completedAt !== undefined || endsAt > this.clock.elapsedMinutes || endsAt <= previousElapsedMinute) continue;
        const definition = HOUSEHOLD_GATHERING_DEFINITIONS[gathering.kind];
        const attendance = Math.max(home.residents.length, gathering.guestCount + home.residents.length);
        gathering.completedAt = endsAt;
        gathering.attendance = attendance;
        gathering.relationshipGain = definition.relationshipGain;
        for (const resident of home.residents) {
          resident.social = clamp(resident.social + 18, 0, 100);
          resident.comfort = clamp(resident.comfort + (gathering.kind === "dinner" ? 10 : 6), 0, 100);
          resident.stress = clamp(resident.stress - (gathering.kind === "birthday" ? 14 : 9), 0, 100);
          if (resident.id === gathering.hostResidentId) {
            resident.skills = normalizeResidentSkills(resident.skills);
            resident.skills.communication = clamp(resident.skills.communication + 3, 0, 100);
            if (this.residentAspiration(resident) === "family" || this.residentAspiration(resident) === "community") {
              this.increaseResidentAspiration(resident, 4);
            }
          }
        }
        for (const relationship of home.relationships) {
          relationship.score = clamp(relationship.score + definition.relationshipGain, 0, 100);
          relationship.lastInteractionAt = endsAt;
        }
      }
      home.gatherings = (home.gatherings ?? []).slice(-MAX_HOUSEHOLD_GATHERINGS);
    }
  }

  purchaseForResident(homeId: string, residentId: string, kind: ResidentPurchaseKind) {
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    const purchase = RESIDENT_PURCHASES[kind];
    if (!home || !resident || !purchase) return { ok: false, reason: "That purchase is unavailable" };
    if (this.homeHouseholdFunds(home) < purchase.cost) {
      return { ok: false, reason: `${purchase.label} needs $${purchase.cost}. The household has $${this.homeHouseholdFunds(home)}.` };
    }
    this.checkpoint();
    home.householdFunds = this.homeHouseholdFunds(home) - purchase.cost;
    home.discretionarySpent = Math.max(0, Math.round(home.discretionarySpent ?? 0)) + purchase.cost;
    home.lastPurchase = { kind, residentId, cost: purchase.cost, at: this.clock.elapsedMinutes };
    const skills = this.residentSkills(resident);
    if (kind === "meal-delivery") {
      resident.energy = clamp(resident.energy + 12, 0, 100);
      resident.comfort = clamp(resident.comfort + 5, 0, 100);
      resident.health = clamp(resident.health + 1, 0, 100);
      skills.practical = clamp(skills.practical + 1, 0, 100);
    } else if (kind === "creative-supplies") {
      resident.comfort = clamp(resident.comfort + 8, 0, 100);
      resident.stress = clamp(resident.stress - 10, 0, 100);
      skills.creativity = clamp(skills.creativity + 5, 0, 100);
    } else {
      resident.health = clamp(resident.health + 10, 0, 100);
      resident.comfort = clamp(resident.comfort + 6, 0, 100);
      resident.stress = clamp(resident.stress - 14, 0, 100);
      skills.wellness = clamp(skills.wellness + 4, 0, 100);
    }
    resident.skills = skills;
    return { ok: true, reason: `${purchase.label} for ${resident.name} · $${purchase.cost}` };
  }

  buyResidentPersonalItem(homeId: string, residentId: string, kind: ResidentPersonalItemKind) {
    const home = this.homes.find(item => item.id === homeId);
    const resident = home?.residents.find(item => item.id === residentId);
    const definition = RESIDENT_PERSONAL_ITEM_DEFINITIONS[kind];
    if (!home || !resident || !definition) return { ok: false, reason: "That personal item is unavailable" };
    if (this.residentPersonalItems(resident).some(item => item.kind === kind)) {
      return { ok: false, reason: `${resident.name} already owns ${definition.label.toLowerCase()}.` };
    }
    if (this.homeHouseholdFunds(home) < definition.cost) {
      return { ok: false, reason: `${definition.label} needs $${definition.cost}. The household has $${this.homeHouseholdFunds(home)}.` };
    }
    this.checkpoint();
    home.householdFunds = this.homeHouseholdFunds(home) - definition.cost;
    home.discretionarySpent = Math.max(0, Math.round(home.discretionarySpent ?? 0)) + definition.cost;
    resident.inventory = [...this.residentPersonalItems(resident), {
      id: crypto.randomUUID(),
      kind,
      acquiredAt: this.clock.elapsedMinutes
    }];
    resident.skills = normalizeResidentSkills(resident.skills);
    resident.skills[definition.skill] = clamp(resident.skills[definition.skill] + 3, 0, 100);
    resident.comfort = clamp(resident.comfort + 5, 0, 100);
    if (this.residentAspiration(resident) === definition.aspiration) {
      this.increaseResidentAspiration(resident, 5);
    }
    this.recordResidentMilestone(
      resident,
      "collection",
      `Collected ${definition.label}`,
      `${resident.name} added a personal item connected to ${this.residentFavoritePastimeLabel(resident).toLowerCase()}.`
    );
    return { ok: true, reason: `${definition.label} added to ${resident.name}'s personal collection · $${definition.cost}` };
  }

  rotateFurniture(homeId: string, furnitureId: string, quarterTurns = 1) {
    const home = this.homes.find(item => item.id === homeId);
    const furniture = home?.furniture.find(item => item.id === furnitureId);
    if (!home || !furniture) return false;
    const rotation = positiveModulo(
      furniture.rotation + quarterTurns * Math.PI / 4,
      Math.PI * 2
    );
    if (!this.canPlaceFurniture(home, furniture.kind, furniture.x, furniture.z, rotation, furniture.id, homeEntityFloor(furniture))) return false;
    this.checkpoint();
    furniture.rotation = rotation;
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

  addResident(homeId: string, profile?: ResidentProfile) {
    const home = this.homes.find(item => item.id === homeId);
    if (!home || home.residents.length >= 8) return false;
    const names = ["Avery", "Jordan", "Maya", "Theo", "Rowan", "Sofia", "Noah", "June"];
    const used = new Set(home.residents.map(resident => resident.name));
    const fallbackName = names.find(candidate => !used.has(candidate)) ?? `Resident ${home.residents.length + 1}`;
    const name = (profile?.name ?? fallbackName).trim().replace(/\s+/g, " ").slice(0, 24);
    const normalizedName = name.toLocaleLowerCase();
    if (
      !name
      || !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(name)
      || home.residents.some(resident => resident.name.toLocaleLowerCase() === normalizedName)
    ) return false;
    const authoredTraits = profile?.traits;
    if (
      authoredTraits
      && (
        authoredTraits.length !== 2
        || new Set(authoredTraits).size !== 2
        || authoredTraits.some(trait => !RESIDENT_TRAITS.includes(trait))
      )
    ) return false;
    if (profile?.personality && !isValidResidentPersonality(profile.personality)) return false;
    if (profile?.lifeStage && !RESIDENT_LIFE_STAGES.includes(profile.lifeStage)) return false;
    if (profile?.aspiration && !RESIDENT_ASPIRATION_DEFINITIONS[profile.aspiration]) return false;
    if (profile?.careerTrack && !RESIDENT_CAREER_TRACK_DEFINITIONS[profile.careerTrack]) return false;
    if (profile?.decorPreference && !(["natural", "light", "dark", "colorful"] as HomeFurnitureStyle[]).includes(profile.decorPreference)) return false;
    if (profile?.favoritePastime && !RESIDENT_PASTIME_DEFINITIONS[profile.favoritePastime]) return false;
    if (profile?.outfitStyle && !RESIDENT_OUTFIT_DEFINITIONS[profile.outfitStyle]) return false;
    if (profile?.outfitPalette && !RESIDENT_OUTFIT_PALETTES[profile.outfitPalette]) return false;
    if (profile?.routineProfile && !RESIDENT_ROUTINE_DEFINITIONS[profile.routineProfile]) return false;
    const caregiverIds = [...new Set(profile?.caregiverIds ?? [])];
    if (caregiverIds.length > 2) return false;
    const caregivers = caregiverIds.map(id => home.residents.find(resident => resident.id === id)).filter((resident): resident is Resident => Boolean(resident));
    if (caregiverIds.length !== caregivers.length || caregivers.some(caregiver => ["infant", "toddler", "child", "teen"].includes(this.residentLifeStage(caregiver)))) return false;
    this.checkpoint();
    const roles: ResidentRole[] = ["office", "service", "home"];
    const lifeStage = normalizeResidentLifeStage(profile?.lifeStage, profile?.age ?? "adult");
    const age = lifeStageAge(lifeStage);
    const role = lifeStage === "infant" || lifeStage === "toddler" || lifeStage === "elder"
      ? "home"
      : lifeStage === "child" || lifeStage === "teen"
        ? "student"
        : profile?.careerTrack
          ? RESIDENT_CAREER_TRACK_DEFINITIONS[profile.careerTrack].role
          : profile?.role ?? roles[home.residents.length % roles.length];
    const residentTraits = authoredTraits ? [...authoredTraits] : initialResidentTraits(`${home.id}-${name}-${home.residents.length}`);
    const inheritedPersonality = profile?.inheritPersonality
      ? blendCaregiverPersonality(caregivers, `${home.id}-${name}-${home.residents.length}`)
      : undefined;
    const generation = caregivers.length
      ? Math.max(...caregivers.map(caregiver => caregiver.generation ?? 1)) + 1
      : 1;
    const resident: Resident = {
      id: crypto.randomUUID(),
      name,
      age,
      lifeStage,
      lifeStageDays: 0,
      lifetimeDays: 0,
      role,
      aspiration: profile?.aspiration,
      aspirationProgress: 0,
      careerTrack: profile?.careerTrack,
      generation,
      caregiverIds,
      decorPreference: profile?.decorPreference,
      favoritePastime: profile?.favoritePastime,
      outfitStyle: profile?.outfitStyle,
      outfitPalette: profile?.outfitPalette,
      routineProfile: profile?.routineProfile,
      inventory: [],
      activityPreferences: [],
      energy: 82,
      social: 68,
      comfort: 74,
      health: 84,
      stress: 24,
      traits: residentTraits,
      personality: normalizeResidentPersonality(
        inheritedPersonality ?? profile?.personality,
        residentTraits,
        `${home.id}-${name}-${home.residents.length}`
      ),
      completedActions: 0,
      skills: normalizeResidentSkills(undefined),
      careerLevel: 1,
      careerXp: 0
    };
    resident.aspiration = normalizeResidentAspiration(resident.aspiration, resident);
    resident.careerTrack = normalizeResidentCareerTrack(resident.careerTrack, resident);
    resident.decorPreference = normalizeResidentDecorPreference(resident.decorPreference, resident);
    resident.favoritePastime = normalizeResidentPastime(resident.favoritePastime, resident);
    resident.outfitStyle = normalizeResidentOutfitStyle(resident.outfitStyle, resident);
    resident.outfitPalette = normalizeResidentOutfitPalette(resident.outfitPalette, resident);
    resident.routineProfile = normalizeResidentRoutineProfile(resident.routineProfile, resident);
    this.recordResidentMilestone(
      resident,
      "arrival",
      "Joined the household",
      `${resident.name}'s story began in ${home.name === "New household" ? "a new household" : home.name}.`
    );
    for (const existing of home.residents) {
      home.relationships.push({
        residentIds: orderedResidentIds(existing.id, resident.id),
        score: caregiverIds.includes(existing.id) ? 78 : initialRelationshipScore(existing.id, resident.id),
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
    const savedElapsedMinutes = Math.max(0, Math.round(snapshot.clock?.elapsedMinutes ?? 0));
    const savedCityName = snapshot.cityName?.trim().replace(/\s+/g, " ") ?? "New Gridless City";
    this.cityName = savedCityName.length >= 2
      && savedCityName.length <= 40
      && /^[\p{L}\p{N} .'-]+$/u.test(savedCityName)
      ? savedCityName
      : "New Gridless City";
    const savedTemplateId = snapshot.templateId;
    this.templateId = savedTemplateId && Object.prototype.hasOwnProperty.call(WORLD_TEMPLATES, savedTemplateId)
      ? savedTemplateId
      : "nyc";
    this.spatialChunkSize = Math.round(clamp(snapshot.spatialChunkSize ?? 256, 128, 1024));
    this.roads = clone(snapshot.roads).map(normalizeRoadRecord);
    this.areas = clone(snapshot.areas ?? WORLD_TEMPLATES[this.templateId].areas);
    this.lots = clone(snapshot.lots).map(lot => {
      const zone = lot.zone ?? "unassigned";
      const seed = hashString(lot.id);
      const households = lot.households ?? initialHouseholds(zone, seed);
      const businesses = lot.businesses ?? initialBusinesses(zone, seed);
      return {
        ...lot,
        zone,
        density: lot.density === "low" || lot.density === "high" ? lot.density : "medium",
        households,
        businesses,
        householdMix: lot.householdMix ?? createHouseholdMix(households, seed),
        businessMix: lot.businessMix ?? createBusinessMix(businesses, zone, seed),
        anchorBusiness: businesses > 0 ? lot.anchorBusiness ?? createAnchorBusiness(lot.id, zone, businesses) : undefined,
        businessFinance: normalizeBusinessFinance(lot.businessFinance, businesses, savedElapsedMinutes)
      };
    });
    this.homes = clone(snapshot.homes).map(home => {
      const savedHomeName = home.name?.trim().replace(/\s+/g, " ") ?? "New household";
      const normalizedFloors = Math.round(clamp(home.floors ?? 1, 1, MAX_HOME_FLOORS));
      const residents = (home.residents ?? []).map((resident, index) => {
        const seed = `${home.id}-${resident.id}-${resident.name}-${index}`;
        const traits = normalizeResidentTraits(resident.traits, seed);
        const lifeStage = normalizeResidentLifeStage(resident.lifeStage, resident.age);
        const lifeStageDuration = RESIDENT_LIFE_STAGE_DEFINITIONS[lifeStage].durationDays;
        const role = lifeStage === "infant" || lifeStage === "toddler" || lifeStage === "elder"
          ? "home"
          : lifeStage === "child" || lifeStage === "teen"
            ? "student"
            : resident.role ?? (index % 2 === 0 ? "office" : "service");
        const personality = normalizeResidentPersonality(resident.personality, traits, seed);
        const normalizedResident: Resident = {
          ...resident,
          age: lifeStageAge(lifeStage),
          lifeStage,
          lifeStageDays: Math.round(clamp(resident.lifeStageDays ?? 0, 0, lifeStageDuration ? lifeStageDuration - 1 : 10_000_000)),
          lifetimeDays: Math.max(0, Math.round(resident.lifetimeDays ?? 0)),
          lastLifeStageChangeAt: resident.lastLifeStageChangeAt === undefined
            ? undefined
            : Math.round(clamp(resident.lastLifeStageChangeAt, 0, savedElapsedMinutes)),
          role,
          energy: clamp(resident.energy ?? 82, 0, 100),
          social: clamp(resident.social ?? 68, 0, 100),
          comfort: clamp(resident.comfort ?? 74, 0, 100),
          health: clamp(resident.health ?? 84, 0, 100),
          stress: clamp(resident.stress ?? 24, 0, 100),
          traits,
          personality,
          currentAction: resident.currentAction
            && RESIDENT_ACTION_KINDS.includes(resident.currentAction.kind)
            ? {
                ...resident.currentAction,
                conversationIntent: resident.currentAction.kind === "socialize"
                  ? normalizeConversationIntent(resident.currentAction.conversationIntent)
                  : undefined
              }
            : undefined,
          completedActions: resident.completedActions ?? 0,
          skills: normalizeResidentSkills(resident.skills),
          careerLevel: Math.round(clamp(resident.careerLevel ?? 1, 1, 10)),
          careerXp: Math.max(0, Math.round(resident.careerXp ?? 0)),
          generation: Math.round(clamp(resident.generation ?? 1, 1, 100)),
          caregiverIds: [...new Set(resident.caregiverIds ?? [])].slice(0, 2),
          inventory: normalizeResidentInventory(resident.inventory, resident.id, savedElapsedMinutes),
          activityPreferences: normalizeResidentActivityPreferences(resident.activityPreferences, savedElapsedMinutes),
          milestones: normalizeResidentMilestones(resident.milestones, resident.id, resident.name, savedElapsedMinutes),
          homeFloor: Math.round(clamp(resident.homeFloor ?? 0, 0, normalizedFloors - 1))
        };
        normalizedResident.aspiration = normalizeResidentAspiration(resident.aspiration, normalizedResident);
        normalizedResident.aspirationProgress = Math.round(clamp(resident.aspirationProgress ?? 0, 0, 100));
        normalizedResident.careerTrack = normalizeResidentCareerTrack(resident.careerTrack, normalizedResident);
        normalizedResident.decorPreference = normalizeResidentDecorPreference(resident.decorPreference, normalizedResident);
        normalizedResident.favoritePastime = normalizeResidentPastime(resident.favoritePastime, normalizedResident);
        normalizedResident.outfitStyle = normalizeResidentOutfitStyle(resident.outfitStyle, normalizedResident);
        normalizedResident.outfitPalette = normalizeResidentOutfitPalette(resident.outfitPalette, normalizedResident);
        normalizedResident.routineProfile = normalizeResidentRoutineProfile(resident.routineProfile, normalizedResident);
        if (lifeStage === "young-adult" || lifeStage === "adult") {
          normalizedResident.role = RESIDENT_CAREER_TRACK_DEFINITIONS[normalizedResident.careerTrack].role;
        }
        const availableBranches = RESIDENT_CAREER_TRACK_DEFINITIONS[normalizedResident.careerTrack].branches;
        normalizedResident.careerBranch = resident.careerBranch && availableBranches.includes(resident.careerBranch)
          ? resident.careerBranch
          : undefined;
        const workTask = resident.lastWorkTask
          ? RESIDENT_WORK_TASK_DEFINITIONS[resident.lastWorkTask]
          : undefined;
        normalizedResident.lastWorkTask = workTask?.track === normalizedResident.careerTrack
          ? resident.lastWorkTask
          : undefined;
        normalizedResident.workPerformance = normalizedResident.lastWorkTask
          ? Math.round(clamp(resident.workPerformance ?? 0, 0, 100))
          : undefined;
        normalizedResident.workDaysCompleted = Math.max(0, Math.round(resident.workDaysCompleted ?? 0));
        normalizedResident.lastWorkDayAt = resident.lastWorkDayAt === undefined
          ? undefined
          : Math.round(clamp(resident.lastWorkDayAt, 0, savedElapsedMinutes));
        return normalizedResident;
      });
      const residentIds = new Set(residents.map(resident => resident.id));
      residents.forEach(resident => {
        resident.caregiverIds = (resident.caregiverIds ?? []).filter(id => {
          const caregiver = residents.find(candidate => candidate.id === id);
          return id !== resident.id
            && Boolean(caregiver)
            && ["young-adult", "adult", "elder"].includes(normalizeResidentLifeStage(caregiver!.lifeStage, caregiver!.age));
        });
        if (
          !resident.caregiverIds.length
          && ["infant", "toddler", "child", "teen"].includes(normalizeResidentLifeStage(resident.lifeStage, resident.age))
        ) {
          resident.caregiverIds = residents
            .filter(candidate => candidate.id !== resident.id && ["young-adult", "adult", "elder"].includes(normalizeResidentLifeStage(candidate.lifeStage, candidate.age)))
            .slice(0, 2)
            .map(candidate => candidate.id);
          if (resident.caregiverIds.length) {
            resident.generation = Math.max(...resident.caregiverIds.map(id => residents.find(candidate => candidate.id === id)?.generation ?? 1)) + 1;
          }
        }
      });
      const relationships = normalizeRelationships(residents, home.relationships ?? []);
      for (const resident of residents) {
        for (const caregiverId of resident.caregiverIds ?? []) {
          const relationship = relationships.find(candidate => candidate.residentIds.includes(resident.id) && candidate.residentIds.includes(caregiverId));
          if (relationship) relationship.score = Math.max(78, relationship.score);
        }
      }
      const roomFloorById = new Map((home.rooms ?? []).map(room => [
        room.id,
        Math.round(clamp(room.floor ?? 0, 0, normalizedFloors - 1))
      ]));
      const assignedRoomResidentIds = new Set<string>();
      return {
        ...home,
        name: savedHomeName.length >= 2
          && savedHomeName.length <= 40
          && /^[\p{L}\p{N} .'-]+$/u.test(savedHomeName)
          ? savedHomeName
          : "New household",
        floors: normalizedFloors,
        rooms: (home.rooms ?? []).map(room => ({
          ...room,
          floor: Math.round(clamp(room.floor ?? 0, 0, normalizedFloors - 1)),
          floorFinish: room.floorFinish ?? "oak",
          wallFinish: room.wallFinish ?? "warm-white",
          condition: clamp(room.condition ?? 100, 0, 100),
          assignedResidentIds: [...new Set(room.assignedResidentIds ?? [])].filter(id => {
            if (!residentIds.has(id) || assignedRoomResidentIds.has(id)) return false;
            assignedRoomResidentIds.add(id);
            return true;
          }),
          lastRenovatedAt: room.lastRenovatedAt === undefined
            ? undefined
            : Math.round(clamp(room.lastRenovatedAt, 0, savedElapsedMinutes))
        })),
        furniture: (home.furniture ?? []).map(item => ({
          ...item,
          floor: Math.round(clamp(item.floor ?? 0, 0, normalizedFloors - 1)),
          style: normalizeHomeFurnitureStyle(item.style),
          variant: normalizeHomeFurnitureVariant(item.variant),
          tint: normalizeFurnitureTint(item.tint),
          ownerResidentId: item.ownerResidentId && residentIds.has(item.ownerResidentId) ? item.ownerResidentId : undefined,
          condition: clamp(item.condition ?? 100, 0, 100),
          lastRepairedAt: item.lastRepairedAt === undefined
            ? undefined
            : Math.round(clamp(item.lastRepairedAt, 0, savedElapsedMinutes))
        })),
        stairs: (home.stairs ?? []).filter(stair =>
          Number.isFinite(stair.x)
          && Number.isFinite(stair.z)
          && Number.isFinite(stair.rotation)
          && Number.isInteger(stair.fromFloor)
          && stair.fromFloor >= 0
          && stair.toFloor === stair.fromFloor + 1
          && stair.toFloor < normalizedFloors
        ),
        windows: home.windows === undefined
          ? undefined
          : home.windows.filter(window =>
              roomFloorById.get(window.roomId) === window.floor
              && (window.orientation === "x" || window.orientation === "z")
              && (window.side === "negative" || window.side === "positive")
              && Number.isFinite(window.boundary)
              && Number.isFinite(window.center)
              && Number.isFinite(window.width)
              && window.width >= .6
              && window.width <= 3
              && (window.glazing === "clear" || window.glazing === "privacy")
            ).map(window => ({ ...window, width: clamp(window.width, .6, 3) })),
        doors: home.doors === undefined
          ? undefined
          : home.doors.filter(door =>
              door.roomIds.length === 2
              && door.roomIds[0] !== door.roomIds[1]
              && door.roomIds.every(roomId => roomFloorById.get(roomId) === door.floor)
              && (door.orientation === "x" || door.orientation === "z")
              && Number.isFinite(door.boundary)
              && Number.isFinite(door.center)
              && (door.widthKind === "standard" || door.widthKind === "wide")
            ).map(door => ({ ...door, width: door.widthKind === "wide" ? 1.35 : .95 })),
        roofStyle: home.roofStyle === "gable" || home.roofStyle === "hip" || home.roofStyle === "flat" || home.roofStyle === "green"
          ? home.roofStyle
          : defaultHomeRoofStyle(this.templateId),
        roofColor: /^#[0-9a-f]{6}$/i.test(home.roofColor ?? "")
          ? home.roofColor!.toLowerCase()
          : defaultHomeRoofColor(this.templateId),
        foundationStyle: home.foundationStyle === "crawlspace" || home.foundationStyle === "raised"
          ? home.foundationStyle
          : home.foundationStyle === "slab" ? "slab" : defaultHomeFoundationStyle(this.templateId),
        designBudget: Math.max(0, Math.round(home.designBudget ?? 60_000)),
        designSpent: Math.max(0, Math.round(
          home.designSpent
          ?? (home.furniture ?? []).reduce((total, item) => total + HOME_BUILD_COSTS[item.kind], 0)
            + (home.windows ?? []).reduce((total, window) => total + this.homeWindowCost(window.glazing), 0)
            + (home.doors ?? []).reduce((total, door) => total + this.homeDoorCost(door.widthKind), 0)
            + (home.roofStyle ? this.homeRoofCost(home.roofStyle) : 0)
            + (home.foundationStyle ? this.homeFoundationCost(home.foundationStyle) : 0)
        )),
        householdFunds: Math.round(clamp(home.householdFunds ?? 15_000, -100_000, 10_000_000)),
        lastDailyIncome: Math.max(0, Math.round(home.lastDailyIncome ?? 0)),
        lastDailyExpenses: Math.max(0, Math.round(home.lastDailyExpenses ?? 0)),
        lastDailyUtilityCost: Math.max(0, Math.round(home.lastDailyUtilityCost ?? 0)),
        discretionarySpent: Math.max(0, Math.round(home.discretionarySpent ?? 0)),
        lastPurchase: home.lastPurchase && RESIDENT_PURCHASES[home.lastPurchase.kind]
          ? {
              ...home.lastPurchase,
              cost: RESIDENT_PURCHASES[home.lastPurchase.kind].cost,
              at: Math.max(0, Math.round(home.lastPurchase.at ?? 0))
            }
          : undefined,
        gatherings: normalizeHouseholdGatherings(home.gatherings, residentIds, savedElapsedMinutes),
        residents,
        relationships
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
    this.clock.elapsedMinutes = savedElapsedMinutes;
    this.serviceFunding = snapshot.serviceFunding ?? .85;
    this.taxPolicy = {
      residential: normalizeTaxRate(snapshot.taxPolicy?.residential ?? 10),
      commercial: normalizeTaxRate(snapshot.taxPolicy?.commercial ?? 10),
      industrial: normalizeTaxRate(snapshot.taxPolicy?.industrial ?? 10)
    };
    const districtIds = new Set(this.areas.filter(area => area.kind === "district").map(area => area.id));
    this.districtPolicies = Object.fromEntries(
      Object.entries(snapshot.districtPolicies ?? {})
        .filter(([areaId]) => districtIds.has(areaId))
        .map(([areaId, policies]) => [
          areaId,
          Array.isArray(policies)
            ? [...new Set(policies)].filter(policy => Boolean(DISTRICT_POLICY_DEFINITIONS[policy]))
            : []
        ])
        .filter(([, policies]) => policies.length)
    );
    this.municipalBonds = clone(Array.isArray(snapshot.municipalBonds) ? snapshot.municipalBonds : [])
      .filter(bond =>
        typeof bond.id === "string"
        && bond.id.length > 0
        && Number.isFinite(bond.originalPrincipal)
        && bond.originalPrincipal > 0
        && Number.isFinite(bond.balance)
        && bond.balance > 0
        && Number.isFinite(bond.annualInterestRate)
        && bond.annualInterestRate > 0
        && bond.annualInterestRate <= .15
        && Number.isFinite(bond.monthlyPayment)
        && bond.monthlyPayment > 0
        && Number.isInteger(bond.monthsRemaining)
        && bond.monthsRemaining > 0
        && bond.monthsRemaining <= 360
      )
      .slice(0, 3);
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
    const existingDensities = new Map(this.lots.map(l => [l.id, this.lotDensity(l)]));
    const existingConstruction = new Map(this.lots.map(l => [l.id, {
      startedAt: l.constructionStartedAt,
      duration: l.constructionDuration
    }]));
    const existingActivity = new Map(this.lots.map(l => [l.id, {
      households: l.households,
      businesses: l.businesses,
      householdMix: l.householdMix,
      businessMix: l.businessMix,
      anchorBusiness: l.anchorBusiness,
      businessFinance: l.businessFinance
    }]));
    const lots: Lot[] = [];
    for (const road of this.roads) {
      if (road.developable === false) continue;
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
          if (this.areas.some(area => (area.kind === "park" || area.kind === "water") && pointInPolygon({ x, z }, area.points))) continue;
          if (lots.some(lot => Math.hypot(lot.center.x - x, lot.center.z - z) < 16)) continue;
          const id = `${road.id}-${i}-${side}`;
          const isTemplateRoad = road.id.startsWith(`${this.templateId}-`);
          const zone = existingZones.get(id) ?? (isTemplateRoad ? inferTemplateZone(this.templateId, x, z) : "unassigned");
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
            density: existingDensities.get(id) ?? "medium",
            constructionStartedAt: existingConstruction.get(id)?.startedAt,
            constructionDuration: existingConstruction.get(id)?.duration,
            households,
            businesses,
            householdMix: existingActivity.get(id)?.householdMix ?? createHouseholdMix(households, seed),
            businessMix: existingActivity.get(id)?.businessMix ?? createBusinessMix(businesses, zone, seed),
            anchorBusiness: existingActivity.get(id)?.anchorBusiness ?? createAnchorBusiness(id, zone, businesses),
            businessFinance: existingActivity.get(id)?.businessFinance,
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
    const activeEvents = this.activeCityEvents();
    for (const lot of this.lots) {
      if (this.constructionProgress(lot) < 1) continue;
      const seed = hashString(lot.id);
      const localWellbeing = this.lotWellbeing(lot, totalPopulation, effectiveStaffing) / 100;
      const attractiveness = clamp(cityAttractiveness * .72 + localWellbeing * .28, .15, 1);
      const householdTaxFactor = clamp(1 - (this.taxPolicy.residential - 10) * .025, .72, 1.12);
      const businessTaxRate = lot.zone === "industrial" ? this.taxPolicy.industrial : this.taxPolicy.commercial;
      const businessTaxFactor = clamp(1 - (businessTaxRate - 10) * .025, .72, 1.12);
      const policies = this.districtPoliciesForLot(lot);
      const density = this.lotDensity(lot);
      const householdTarget = Math.round(targetHouseholds(lot.zone, seed, density) * householdTaxFactor);
      if (lot.households < householdTarget) {
        const moves = Math.min(householdTarget - lot.households, Math.max(1, Math.floor(1 + attractiveness * 3)));
        lot.households += moves;
        activity.households += moves;
      } else if (lot.households > householdTarget) {
        const moves = Math.min(lot.households - householdTarget, 3);
        lot.households -= moves;
        activity.households -= moves;
      }

      const priorBusinessFinance = this.businessFinance(lot);
      const priorMargin = priorBusinessFinance.lastRevenue
        ? priorBusinessFinance.lastProfit / priorBusinessFinance.lastRevenue
        : 0;
      const viabilityFactor = priorBusinessFinance.lastSettledAt
        ? clamp(1 + priorMargin * .18 - priorBusinessFinance.consecutiveLossDays * .025, .72, 1.12)
        : 1;
      const grantFactor = policies.includes("small-business-grants") ? 1.14 : 1;
      const freightFactor = policies.includes("heavy-traffic-ban") && lot.zone === "industrial" ? .82 : 1;
      const businessTarget = Math.round(targetBusinesses(lot.zone, seed, density) * businessTaxFactor * grantFactor * freightFactor * viabilityFactor);
      const businessesBeforeGrowth = lot.businesses;
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
      if (lot.businesses > businessesBeforeGrowth) {
        lot.businessFinance = {
          ...priorBusinessFinance,
          operatingReserve: priorBusinessFinance.operatingReserve + (lot.businesses - businessesBeforeGrowth) * 5_000
        };
      }
      if (lot.businesses > 0) {
        activity.businesses -= this.settleBusinessFinance(lot, totalPopulation, effectiveStaffing, policies, activeEvents);
      }
    }
    this.advanceResidentLives();
    this.advanceResidentCareers();
    this.settleHouseholdFinances(totalPopulation, effectiveStaffing);
    this.lastDailyActivity = activity;
    this.rebuildCommutes();
  }

  private settleBusinessFinance(
    lot: Lot,
    totalPopulation: number,
    effectiveStaffing: number,
    policies: DistrictPolicy[],
    activeEvents: CityEvent[]
  ) {
    const current = this.businessFinance(lot);
    const projection = this.businessFinanceProjection(lot, totalPopulation, effectiveStaffing, policies, activeEvents);
    const consecutiveLossDays = projection.profit < 0 ? current.consecutiveLossDays + 1 : 0;
    const operatingReserve = Math.round(clamp(current.operatingReserve + projection.profit, 0, 100_000_000));
    lot.businessFinance = {
      lastRevenue: projection.revenue,
      lastPayroll: projection.payroll,
      lastOperatingCosts: projection.operatingCosts,
      lastProfit: projection.profit,
      operatingReserve,
      consecutiveLossDays,
      lastSettledAt: this.clock.elapsedMinutes,
      lastClosureAt: current.lastClosureAt
    };
    if (lot.businesses <= 0 || operatingReserve > 0 || consecutiveLossDays < 5) return 0;
    lot.businesses -= 1;
    lot.businessMix = createBusinessMix(lot.businesses, lot.zone, hashString(lot.id));
    lot.anchorBusiness = lot.businesses > 0
      ? lot.anchorBusiness && lot.businessMix[lot.anchorBusiness.sector] > 0
        ? lot.anchorBusiness
        : createAnchorBusiness(lot.id, lot.zone, lot.businesses)
      : undefined;
    lot.businessFinance = {
      ...lot.businessFinance,
      operatingReserve: lot.businesses > 0 ? 2_000 : 0,
      consecutiveLossDays: 0,
      lastClosureAt: this.clock.elapsedMinutes
    };
    return 1;
  }

  private advanceResidentLives() {
    for (const home of this.homes) {
      for (const resident of home.residents) {
        let stage = this.residentLifeStage(resident);
        resident.lifeStage = stage;
        resident.lifeStageDays = Math.max(0, Math.round(resident.lifeStageDays ?? 0)) + 1;
        resident.lifetimeDays = Math.max(0, Math.round(resident.lifetimeDays ?? 0)) + 1;
        const duration = RESIDENT_LIFE_STAGE_DEFINITIONS[stage].durationDays;
        if (!duration || resident.lifeStageDays < duration) continue;
        const nextStage = nextResidentLifeStage(stage);
        if (!nextStage) continue;
        resident.lifeStageDays -= duration;
        resident.lifeStage = nextStage;
        resident.age = lifeStageAge(nextStage);
        resident.lastLifeStageChangeAt = this.clock.elapsedMinutes;
        stage = nextStage;
        if (stage === "toddler") resident.role = "home";
        if (stage === "child" || stage === "teen") resident.role = "student";
        if (stage === "young-adult") {
          resident.careerTrack = normalizeResidentCareerTrack(resident.careerTrack, resident);
          resident.role = RESIDENT_CAREER_TRACK_DEFINITIONS[resident.careerTrack].role;
          resident.careerLevel = Math.max(1, resident.careerLevel ?? 1);
          resident.careerXp = Math.max(0, resident.careerXp ?? 0);
        }
        if (stage === "elder") {
          resident.role = "home";
          resident.currentAction = undefined;
        }
        this.recordResidentMilestone(
          resident,
          "life-stage",
          `Became ${RESIDENT_LIFE_STAGE_DEFINITIONS[stage].label.toLowerCase()}`,
          `${resident.name} began a new life stage in ${home.name}.`
        );
        if (this.residentAspiration(resident) === "family") {
          this.increaseResidentAspiration(resident, 10);
        }
      }
    }
  }

  private advanceResidentCareers() {
    for (const home of this.homes) {
      for (const resident of home.residents) {
        const stage = this.residentLifeStage(resident);
        if (resident.role === "student" || stage === "infant" || stage === "toddler" || stage === "child" || stage === "teen" || stage === "elder") continue;
        if (!this.residentDailySchedule(resident, Math.max(0, this.clock.elapsedMinutes - 1)).workingToday) continue;
        resident.skills = normalizeResidentSkills(resident.skills);
        resident.careerTrack = normalizeResidentCareerTrack(resident.careerTrack, resident);
        const career = RESIDENT_CAREER_TRACK_DEFINITIONS[resident.careerTrack];
        const primarySkills: ResidentSkill[] = [...career.primarySkills];
        for (const skill of primarySkills) {
          resident.skills[skill] = clamp(resident.skills[skill] + 1, 0, 100);
        }
        const startingLevel = this.residentCareerLevel(resident);
        let level = startingLevel;
        const skillAverage = primarySkills.reduce((total, skill) => total + resident.skills![skill], 0) / primarySkills.length;
        const workplace = this.residentWorkplaceLot(resident);
        if (workplace && workplace.businesses > 0) {
          const tasks = RESIDENT_WORK_TASKS_BY_TRACK[resident.careerTrack];
          const day = Math.floor(this.clock.elapsedMinutes / 1_440);
          resident.lastWorkTask = tasks[hashString(`${resident.id}:${resident.careerBranch ?? "foundation"}:${day}`) % tasks.length];
          resident.workPerformance = Math.round(clamp(
            this.residentCareerFit(resident) * .42
            + skillAverage * .28
            + this.residentWorkplaceFit(resident) * .22
            + (100 - this.residentCommuteBurden(resident)) * .08,
            0,
            100
          ));
          resident.workDaysCompleted = Math.max(0, Math.round(resident.workDaysCompleted ?? 0)) + 1;
          resident.lastWorkDayAt = this.clock.elapsedMinutes;
        }
        let xp = Math.max(0, resident.careerXp ?? 0) + 4 + Math.floor(skillAverage / 25);
        while (level < 10 && xp >= level * 40) {
          xp -= level * 40;
          level += 1;
        }
        resident.careerLevel = level;
        resident.careerXp = level >= 10 ? 0 : xp;
        if (level >= 4 && !resident.careerBranch) {
          const personality = this.residentPersonality(resident);
          const branchIndex = (resident.skills[career.primarySkills[1]] + personality.spontaneity + hashString(resident.id)) % 2;
          resident.careerBranch = career.branches[branchIndex < 1 ? 0 : 1];
          this.recordResidentMilestone(
            resident,
            "career-branch",
            `Chose ${resident.careerBranch}`,
            `${resident.name} committed to a specialization in ${career.label}.`
          );
        }
        if (level > startingLevel) {
          this.recordResidentMilestone(
            resident,
            "promotion",
            `Promoted to ${this.residentCareerTitle(resident)}`,
            `${resident.name} reached career level ${level} after ${resident.workDaysCompleted ?? 0} completed shifts.`
          );
          const aspiration = this.residentAspiration(resident);
          if (aspiration === "mastery" || aspiration === "prosperity" || (aspiration === "creative" && resident.careerTrack === "creative")) {
            this.increaseResidentAspiration(resident, (level - startingLevel) * 10);
          }
        }
      }
    }
  }

  private settleHouseholdFinances(totalPopulation: number, effectiveStaffing: number) {
    for (const home of this.homes) {
      this.degradeHomeCondition(home);
      const lot = this.lots.find(item => item.id === home.lotId);
      const utilityReliability = lot
        ? this.lotUtilityReliability(lot, totalPopulation, effectiveStaffing)
        : 50;
      const income = home.residents.reduce((total, resident) => {
        const workedToday = this.residentDailySchedule(resident, Math.max(0, this.clock.elapsedMinutes - 1)).workingToday;
        return total + (workedToday ? this.residentDailyWage(resident) : 0);
      }, 0);
      const energy = this.homeEnergyPerformance(home);
      const expenses = Math.round(
        home.residents.length * 32
        + home.rooms.length * (home.residents.length ? 12 : 4)
        + home.furniture.length * 2
        + energy.dailyCost
        + Math.max(0, 100 - utilityReliability) * .8
      );
      home.lastDailyIncome = income;
      home.lastDailyExpenses = expenses;
      home.lastDailyUtilityCost = energy.dailyCost;
      home.householdFunds = Math.round(clamp(this.homeHouseholdFunds(home) + income - expenses, -100_000, 10_000_000));
      for (const resident of home.residents) {
        if ((resident.lifetimeDays ?? 0) % 7 !== 0) continue;
        const aspiration = this.residentAspiration(resident);
        if (aspiration === "prosperity" && income > expenses) {
          this.increaseResidentAspiration(resident, 2);
        }
        const mentoring = this.residentLifeStage(resident) === "elder"
          && home.residents.some(candidate => ["toddler", "child", "teen", "young-adult"].includes(this.residentLifeStage(candidate)));
        if (mentoring && (aspiration === "family" || aspiration === "community")) {
          this.increaseResidentAspiration(resident, 2);
        }
      }
    }
  }

  private degradeHomeCondition(home: Home) {
    const occupiedWear = home.residents.length * .003;
    const floodWear = this.homeFoundationPerformance(home).residualExposure / 100 * .02;
    for (const room of home.rooms) {
      room.condition = clamp((room.condition ?? 100) - (.014 + occupiedWear + floodWear), 25, 100);
    }
    for (const furniture of home.furniture) {
      furniture.condition = clamp((furniture.condition ?? 100) - (.008 + home.residents.length * .002), 20, 100);
    }
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
        const targetFurniture = chosenAction.targetFurnitureId
          ? home.furniture.find(item => item.id === chosenAction.targetFurnitureId)
          : undefined;
        if (targetFurniture) resident.homeFloor = homeEntityFloor(targetFurniture);
        if (chosenAction.kind === "socialize" && chosenAction.partnerResidentId) {
          const partner = home.residents.find(item => item.id === chosenAction.partnerResidentId);
          if (partner && !partner.currentAction && partner.id !== this.controlledResidentId) {
            partner.homeFloor = resident.homeFloor;
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
    const sleepingHours = this.residentIsScheduledAsleep(resident, this.clock.minute);
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
        const impression = relationship ? this.relationshipImpression(relationship) : undefined;
        return {
          resident: candidate,
          relationship,
          impression,
          tension,
          score:
            this.relationshipScore(home, resident.id, candidate.id) * .55
            + this.relationshipCompatibility(resident, candidate) * .45
            + (100 - candidate.social) * .12
            + (impression?.partnerBias ?? 0)
            + tension * (resident.traits.includes("empathetic") ? .42 : .1)
            + hashString(`${resident.id}-${candidate.id}-${Math.floor(now / 60)}`) % 8
        };
      })
      .sort((first, second) => second.score - first.score)[0];
    const availablePartner = availablePartnerMatch?.resident;
    const careMatch = this.caregivingPriority(home, resident);
    const learnedPreference = this.residentLearnedPreferences(home, resident);
    const autonomousConversationIntent: ConversationIntent =
      availablePartnerMatch
      && (availablePartnerMatch.tension >= 25 || availablePartnerMatch.impression?.kind === "resentment")
      && (resident.traits.includes("empathetic") || availablePartnerMatch.tension >= 45)
        ? "apologize"
        : learnedPreference.preferredIntent ?? "chat";
    const preferredFurniture = (kind: Home["furniture"][number]["kind"]) =>
      home.furniture.find(item => item.kind === kind && item.ownerResidentId === resident.id)
      ?? home.furniture.find(item => item.kind === kind);
    const furniture = {
      bed: preferredFurniture("bed"),
      sofa: preferredFurniture("sofa"),
      table: preferredFurniture("table"),
      plant: preferredFurniture("plant"),
      desk: preferredFurniture("desk"),
      bookcase: preferredFurniture("bookcase"),
      fridge: preferredFurniture("fridge"),
      shower: preferredFurniture("shower")
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
          + (furniture.table || furniture.fridge ? 12 : -8),
        targetFurnitureId: furniture.table?.id ?? furniture.fridge?.id ?? furniture.sofa?.id
      },
      {
        kind: "relax",
        score: (100 - resident.comfort) * .92 + resident.stress * .62 + (furniture.sofa ? 15 : 0),
        targetFurnitureId: furniture.sofa?.id ?? furniture.bed?.id
      },
      {
        kind: "study",
        score: (100 - resident.comfort) * .28
          + (100 - this.residentSkills(resident).creativity) * .04
          + (furniture.desk || furniture.bookcase ? 24 : -48),
        targetFurnitureId: furniture.desk?.id ?? furniture.bookcase?.id
      },
      {
        kind: "shower",
        score: (100 - resident.health) * .5
          + (100 - resident.comfort) * .4
          + resident.stress * .25
          + (furniture.shower ? 24 : -48),
        targetFurnitureId: furniture.shower?.id
      },
      {
        kind: "socialize",
        score: (100 - resident.social) * 1.08
          + (availablePartner ? 24 : -32)
          + (furniture.table || furniture.sofa ? 10 : 0)
          + learnedPreference.socialBias
          + (autonomousConversationIntent === "apologize" ? availablePartnerMatch?.tension ?? 0 : 0) * .45,
        targetFurnitureId: furniture.table?.id ?? furniture.sofa?.id,
        partnerResidentId: availablePartner?.id
      },
      {
        kind: "care",
        score: careMatch
          ? Math.max(14, (careMatch.need - 34) * 1.08)
          : -60,
        partnerResidentId: careMatch?.resident.id
      },
      {
        kind: "tend-plants",
        score: (100 - resident.health) * .52 + resident.stress * .48 + (furniture.plant ? 24 : -48),
        targetFurnitureId: furniture.plant?.id
      },
      { kind: "idle", score: 18 }
    ];
    const favoriteAction = RESIDENT_PASTIME_DEFINITIONS[this.residentFavoritePastime(resident)].action;
    const inventoryActions = new Set(this.residentPersonalItems(resident).map(item =>
      RESIDENT_PASTIME_DEFINITIONS[RESIDENT_PERSONAL_ITEM_DEFINITIONS[item.kind].pastime].action
    ));
    for (const candidate of candidates) {
      candidate.score += hashString(`${resident.id}-${candidate.kind}-${Math.floor(now / 60)}`) % 9;
      candidate.score += residentActionTraitBonus(resident, candidate.kind);
      candidate.score += residentActionPersonalityBonus(resident, candidate.kind);
      candidate.score += this.residentActivityPreferenceBias(resident, candidate.kind);
      if (candidate.kind === favoriteAction) candidate.score += 16;
      if (inventoryActions.has(candidate.kind)) candidate.score += 6;
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
          : choice.kind === "study" ? 60
            : choice.kind === "shower" ? 35
              : choice.kind === "socialize" ? autonomousConversationIntent === "apologize" ? 45 : 60
                : choice.kind === "care" ? 45
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
    const needScoreBefore = resident.energy + resident.social + resident.comfort + resident.health + (100 - resident.stress);
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
    } else if (action.kind === "study") {
      resident.comfort = clamp(resident.comfort + 5, 0, 100);
      resident.stress = clamp(resident.stress - 3, 0, 100);
    } else if (action.kind === "shower") {
      resident.comfort = clamp(resident.comfort + 12, 0, 100);
      resident.health = clamp(resident.health + 5, 0, 100);
      resident.stress = clamp(resident.stress - 8, 0, 100);
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
            previousTension,
            relationship
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
    } else if (action.kind === "care") {
      const dependent = action.partnerResidentId
        ? home.residents.find(item => item.id === action.partnerResidentId)
        : undefined;
      resident.social = clamp(resident.social + 8, 0, 100);
      resident.comfort = clamp(resident.comfort + 3, 0, 100);
      resident.stress = clamp(resident.stress + (resident.traits.includes("empathetic") ? -2 : 2), 0, 100);
      if (dependent && (dependent.caregiverIds ?? []).includes(resident.id)) {
        dependent.energy = clamp(dependent.energy + 6, 0, 100);
        dependent.social = clamp(dependent.social + 18, 0, 100);
        dependent.comfort = clamp(dependent.comfort + 20, 0, 100);
        dependent.health = clamp(dependent.health + 5, 0, 100);
        dependent.stress = clamp(dependent.stress - 12, 0, 100);
        const relationship = this.relationshipBetween(home, resident.id, dependent.id);
        if (relationship) {
          const previousTension = relationship.tension ?? 0;
          const relationshipChange = Math.round(clamp(
            4
            + (resident.traits.includes("empathetic") ? 2 : 0)
            + (this.relationshipCompatibility(resident, dependent) - 50) / 20,
            3,
            8
          ));
          relationship.score = clamp(relationship.score + relationshipChange, 0, 100);
          relationship.tension = clamp(previousTension - 8, 0, 100);
          relationship.memories = [{
            intent: "support" as const,
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
    resident.skills = normalizeResidentSkills(resident.skills);
    for (const [skill, gain] of Object.entries(residentActionSkillGains(action)) as Array<[ResidentSkill, number]>) {
      resident.skills[skill] = clamp(resident.skills[skill] + gain, 0, 100);
    }
    const aspiration = this.residentAspiration(resident);
    const aspirationGain = aspiration === "family" && (action.kind === "socialize" || action.kind === "care")
      ? 4
      : aspiration === "community" && (action.kind === "socialize" || action.kind === "tend-plants")
        ? 3
        : aspiration === "mastery" && action.kind === "study"
          ? 4
          : aspiration === "creative" && (action.kind === "study" || action.kind === "tend-plants")
            ? 4
            : 0;
    if (aspirationGain) {
      this.increaseResidentAspiration(resident, aspirationGain);
    }
    const needScoreAfter = resident.energy + resident.social + resident.comfort + resident.health + (100 - resident.stress);
    const favoriteAction = RESIDENT_PASTIME_DEFINITIONS[this.residentFavoritePastime(resident)].action;
    const targetFurniture = action.targetFurnitureId
      ? home.furniture.find(item => item.id === action.targetFurnitureId)
      : undefined;
    const targetCondition = targetFurniture ? this.furnitureCondition(targetFurniture) : 100;
    const satisfaction = Math.round(clamp(
      (needScoreAfter - needScoreBefore) / 2
      + (favoriteAction === action.kind && action.conversationIntent !== "confront" ? 4 : 0)
      + (targetFurniture?.ownerResidentId === resident.id ? 3 : 0)
      - (100 - targetCondition) * .035
      - (action.kind === "socialize" && action.conversationIntent === "confront" ? 4 : 0)
      - (action.kind === "idle" ? 3 : 0),
      -30,
      30
    ));
    this.rememberResidentActivity(resident, action.kind, satisfaction, action.endsAt);
    if (targetFurniture) {
      const useWear = targetFurniture.kind === "shower" || targetFurniture.kind === "fridge"
        ? .32
        : targetFurniture.kind === "bed"
          ? .18
          : .12;
      targetFurniture.condition = clamp((targetFurniture.condition ?? 100) - useWear, 20, 100);
    }
    resident.lastActionKind = action.kind;
    resident.lastActionAt = action.endsAt;
    resident.completedActions = (resident.completedActions ?? 0) + 1;
    resident.currentAction = undefined;
  }

  private rememberResidentActivity(
    resident: Resident,
    action: ResidentActionKind,
    satisfaction: number,
    lastAt: number
  ) {
    const preferences = this.residentActivityPreferences(resident);
    const existing = preferences.find(item => item.action === action);
    const next: ResidentActivityPreference = {
      action,
      repetitions: Math.min(10_000, (existing?.repetitions ?? 0) + 1),
      satisfaction: Math.round(clamp((existing?.satisfaction ?? 0) + satisfaction, -100, 100)),
      lastAt: Math.max(0, Math.round(lastAt))
    };
    resident.activityPreferences = [next, ...preferences.filter(item => item.action !== action)]
      .sort((first, second) => second.lastAt - first.lastAt || first.action.localeCompare(second.action))
      .slice(0, MAX_RESIDENT_ACTIVITY_PREFERENCES);
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
        const sleepingHours = this.residentIsScheduledAsleep(resident, this.clock.minute);
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
        } else if (action?.kind === "study") {
          comfortTarget = Math.max(comfortTarget, 78);
          stressTarget = clamp(stressTarget - 8, 0, 100);
        } else if (action?.kind === "shower") {
          comfortTarget = 96;
          healthTarget = clamp(healthTarget + 12, 0, 100);
          stressTarget = clamp(stressTarget - 20, 0, 100);
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

function personalityFromTraits(traits: ResidentTrait[], seed: string): ResidentPersonality {
  const personality: ResidentPersonality = {
    cleanliness: 50,
    spontaneity: 50,
    sociability: 50,
    emotionality: 50,
    activity: 50
  };
  const influence: Record<ResidentTrait, Partial<Record<ResidentPersonalityAxis, number>>> = {
    outgoing: { sociability: 28, spontaneity: 10 },
    homebody: { sociability: -24, activity: -12, cleanliness: 8 },
    active: { activity: 30, spontaneity: 6 },
    creative: { spontaneity: 24, cleanliness: -8, emotionality: 8 },
    organized: { cleanliness: 30, spontaneity: -22, emotionality: -6 },
    empathetic: { sociability: 8, emotionality: -10 }
  };
  for (const trait of traits) {
    for (const [axis, value] of Object.entries(influence[trait]) as Array<[ResidentPersonalityAxis, number]>) {
      personality[axis] += value;
    }
  }
  for (const axis of RESIDENT_PERSONALITY_AXES) {
    const variation = hashString(`${seed}-${axis}`) % 11 - 5;
    personality[axis] = Math.round(clamp(personality[axis] + variation, 0, 100));
  }
  return personality;
}

function normalizeResidentPersonality(
  personality: Partial<ResidentPersonality> | undefined,
  traits: ResidentTrait[],
  seed: string
): ResidentPersonality {
  const fallback = personalityFromTraits(traits, seed);
  return {
    cleanliness: Math.round(clamp(Number.isFinite(personality?.cleanliness) ? personality!.cleanliness! : fallback.cleanliness, 0, 100)),
    spontaneity: Math.round(clamp(Number.isFinite(personality?.spontaneity) ? personality!.spontaneity! : fallback.spontaneity, 0, 100)),
    sociability: Math.round(clamp(Number.isFinite(personality?.sociability) ? personality!.sociability! : fallback.sociability, 0, 100)),
    emotionality: Math.round(clamp(Number.isFinite(personality?.emotionality) ? personality!.emotionality! : fallback.emotionality, 0, 100)),
    activity: Math.round(clamp(Number.isFinite(personality?.activity) ? personality!.activity! : fallback.activity, 0, 100))
  };
}

function isValidResidentPersonality(personality: ResidentPersonality | undefined) {
  return Boolean(personality && RESIDENT_PERSONALITY_AXES.every(axis =>
    Number.isInteger(personality[axis]) && personality[axis] >= 0 && personality[axis] <= 100
  ));
}

function normalizeResidentSkills(skills: Partial<ResidentSkills> | undefined): ResidentSkills {
  return {
    communication: clamp(Math.round(skills?.communication ?? 0), 0, 100),
    creativity: clamp(Math.round(skills?.creativity ?? 0), 0, 100),
    wellness: clamp(Math.round(skills?.wellness ?? 0), 0, 100),
    practical: clamp(Math.round(skills?.practical ?? 0), 0, 100)
  };
}

function residentActionSkillGains(action: ResidentAction): Partial<ResidentSkills> {
  if (action.kind === "sleep") return { wellness: 2 };
  if (action.kind === "eat") return { practical: 2, wellness: 1 };
  if (action.kind === "relax") return { wellness: 2, creativity: 1 };
  if (action.kind === "study") return { creativity: 4, practical: 1 };
  if (action.kind === "shower") return { wellness: 3 };
  if (action.kind === "tend-plants") return { practical: 3, wellness: 1 };
  if (action.kind === "care") return { communication: 2, wellness: 2, practical: 2 };
  if (action.kind === "socialize") {
    if (action.conversationIntent === "joke") return { communication: 2, creativity: 2 };
    if (action.conversationIntent === "support" || action.conversationIntent === "apologize") return { communication: 3, wellness: 1 };
    if (action.conversationIntent === "confront") return { communication: 1 };
    return { communication: 2 };
  }
  return {};
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
  const firstPersonality = normalizeResidentPersonality(firstResident.personality, firstResident.traits, firstResident.id);
  const secondPersonality = normalizeResidentPersonality(secondResident.personality, secondResident.traits, secondResident.id);
  const matrixSimilarity = RESIDENT_PERSONALITY_AXES.reduce(
    (total, axis) => total + 100 - Math.abs(firstPersonality[axis] - secondPersonality[axis]),
    0
  ) / RESIDENT_PERSONALITY_AXES.length;
  const emotionalBalance = 100 - Math.max(0, firstPersonality.emotionality + secondPersonality.emotionality - 130) * .55;
  return Math.round(clamp(score * .45 + matrixSimilarity * .45 + emotionalBalance * .1, 25, 95));
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
    } else if (trait === "empathetic" && action === "care") {
      bonus += 22;
    }
  }
  return bonus;
}

function residentActionPersonalityBonus(resident: Resident, action: ResidentActionKind) {
  let bonus = 0;
  const personality = normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  if (action === "socialize") bonus += (personality.sociability - 50) * .52;
  if (action === "care") bonus += (personality.emotionality - 50) * .18 + (personality.cleanliness - 50) * .12;
  if (action === "study") bonus += (personality.cleanliness - 50) * .18 - (personality.spontaneity - 50) * .08;
  if (action === "tend-plants") bonus += (personality.activity - 50) * .34 + (personality.cleanliness - 50) * .12;
  if (action === "relax") bonus += (personality.emotionality - 50) * .2 - (personality.activity - 50) * .12;
  if (action === "idle") bonus -= (personality.activity - 50) * .22;
  if (action === "eat" || action === "shower") bonus += (personality.cleanliness - 50) * .12;
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

function normalizeHomeFurnitureStyle(style: HomeFurnitureStyle | undefined): HomeFurnitureStyle {
  return style === "light" || style === "dark" || style === "colorful" ? style : "natural";
}

function normalizeHomeFurnitureVariant(variant: HomeFurnitureVariant | undefined): HomeFurnitureVariant {
  return variant && HOME_FURNITURE_VARIANTS.includes(variant) ? variant : "classic";
}

function normalizeFurnitureTint(tint: string | undefined) {
  return typeof tint === "string" && /^#[0-9a-f]{6}$/i.test(tint) ? tint.toLowerCase() : undefined;
}

function normalizeResidentLifeStage(stage: ResidentLifeStage | undefined, age: Resident["age"]): ResidentLifeStage {
  return stage && RESIDENT_LIFE_STAGES.includes(stage) ? stage : age === "child" ? "child" : "adult";
}

function normalizeResidentRoutineProfile(
  profile: ResidentRoutineProfile | undefined,
  resident: Pick<Resident, "id" | "role" | "age" | "lifeStage" | "traits" | "personality">
): ResidentRoutineProfile {
  if (profile && RESIDENT_ROUTINE_DEFINITIONS[profile]) return profile;
  const stage = normalizeResidentLifeStage(resident.lifeStage, resident.age);
  const personality = normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  if (stage === "infant" || stage === "toddler" || stage === "child") return "steady";
  if (stage === "teen" || resident.traits.includes("creative") || personality.spontaneity >= 74) return "night-owl";
  if (resident.role === "service" && hashString(`${resident.id}:routine`) % 5 === 0) return "split-shift";
  if (resident.traits.includes("organized") || personality.cleanliness >= 72 || personality.activity >= 76) return "early-bird";
  if (personality.spontaneity >= 58) return "flexible";
  return "steady";
}

function formatRoutineMinute(minute: number) {
  const normalized = ((Math.round(minute) % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function minuteInWrappedWindow(minute: number, start: number, end: number) {
  const normalized = ((minute % 1_440) + 1_440) % 1_440;
  return start <= end ? normalized >= start && normalized < end : normalized >= start || normalized < end;
}

function lifeStageAge(stage: ResidentLifeStage): Resident["age"] {
  return stage === "infant" || stage === "toddler" || stage === "child" || stage === "teen" ? "child" : "adult";
}

function normalizeResidentAspiration(aspiration: ResidentAspiration | undefined, resident: Pick<Resident, "id" | "traits" | "personality">): ResidentAspiration {
  if (aspiration && RESIDENT_ASPIRATION_DEFINITIONS[aspiration]) return aspiration;
  const traits = new Set(resident.traits);
  const personality = normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  if (traits.has("creative") || personality.spontaneity >= 72) return "creative";
  if (traits.has("empathetic") || personality.sociability >= 72) return "community";
  if (traits.has("organized") || personality.cleanliness >= 72) return "mastery";
  if (traits.has("homebody")) return "family";
  return hashString(`${resident.id}:aspiration`) % 2 ? "prosperity" : "family";
}

function normalizeResidentCareerTrack(track: ResidentCareerTrack | undefined, resident: Pick<Resident, "id" | "role" | "traits" | "personality">): ResidentCareerTrack {
  if (track && RESIDENT_CAREER_TRACK_DEFINITIONS[track]) return track;
  const personality = normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  if (resident.role === "service") return personality.emotionality >= 58 ? "care" : "hospitality";
  if (resident.role === "home") return "creative";
  if (resident.role === "office") return personality.spontaneity >= 58 ? "enterprise" : "civic";
  return resident.traits.includes("creative") && personality.spontaneity >= 65 ? "creative" : "civic";
}

function normalizeResidentDecorPreference(style: HomeFurnitureStyle | undefined, resident: Pick<Resident, "id" | "traits" | "personality">): HomeFurnitureStyle {
  if (style === "light" || style === "dark" || style === "colorful" || style === "natural") return style;
  const personality = normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  if (resident.traits.includes("creative") || personality.spontaneity >= 74) return "colorful";
  if (resident.traits.includes("organized") || personality.cleanliness >= 72) return "light";
  if (personality.emotionality <= 32 && personality.sociability <= 42) return "dark";
  return "natural";
}

function normalizeResidentPastime(pastime: ResidentPastime | undefined, resident: Pick<Resident, "id" | "traits" | "personality">): ResidentPastime {
  if (pastime && RESIDENT_PASTIME_DEFINITIONS[pastime]) return pastime;
  const personality = normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  if (resident.traits.includes("outgoing") || personality.sociability >= 72) return "socializing";
  if (resident.traits.includes("active") || personality.activity >= 72) return "gardening";
  if (resident.traits.includes("organized") || personality.cleanliness >= 72) return "cooking";
  if (resident.traits.includes("homebody") || personality.emotionality >= 72) return "relaxing";
  return hashString(`${resident.id}:pastime`) % 2 ? "reading" : "gardening";
}

function normalizeResidentOutfitStyle(
  style: ResidentOutfitStyle | undefined,
  resident: Pick<Resident, "id" | "traits" | "personality" | "role" | "careerTrack" | "lifeStage" | "age">
): ResidentOutfitStyle {
  if (style && RESIDENT_OUTFIT_DEFINITIONS[style]) return style;
  const stage = normalizeResidentLifeStage(resident.lifeStage, resident.age);
  const personality = normalizeResidentPersonality(resident.personality, resident.traits, resident.id);
  if (stage === "infant" || stage === "toddler" || resident.traits.includes("homebody")) return "cozy";
  if (resident.traits.includes("active") || personality.activity >= 72) return "active";
  if (resident.role === "office" || resident.careerTrack === "enterprise" || resident.careerTrack === "civic") return "smart";
  if (resident.traits.includes("organized") && personality.cleanliness >= 76) return "formal";
  return "casual";
}

function normalizeResidentOutfitPalette(
  palette: ResidentOutfitPalette | undefined,
  resident: Pick<Resident, "id" | "traits" | "personality" | "decorPreference">
): ResidentOutfitPalette {
  if (palette && RESIDENT_OUTFIT_PALETTES[palette]) return palette;
  const preference = normalizeResidentDecorPreference(resident.decorPreference, resident);
  if (preference === "natural") return "earth";
  if (preference === "dark") return "mono";
  if (preference === "colorful") return "bright";
  return hashString(`${resident.id}:outfit-palette`) % 2 ? "ocean" : "sunset";
}

function normalizeResidentInventory(
  inventory: ResidentPersonalItem[] | undefined,
  residentId: string,
  elapsedMinutes: number
): ResidentPersonalItem[] {
  const normalized: ResidentPersonalItem[] = [];
  const seenKinds = new Set<ResidentPersonalItemKind>();
  const seenIds = new Set<string>();
  for (const [index, item] of (Array.isArray(inventory) ? inventory : []).entries()) {
    if (!item || !RESIDENT_PERSONAL_ITEM_DEFINITIONS[item.kind] || seenKinds.has(item.kind)) continue;
    seenKinds.add(item.kind);
    const savedId = typeof item.id === "string" && item.id.length > 0 ? item.id : undefined;
    const id = savedId && !seenIds.has(savedId) ? savedId : `${residentId}-${item.kind}-${index}`;
    seenIds.add(id);
    normalized.push({
      id,
      kind: item.kind,
      acquiredAt: Math.round(clamp(item.acquiredAt ?? 0, 0, elapsedMinutes))
    });
  }
  return normalized;
}

function normalizeResidentActivityPreferences(
  preferences: ResidentActivityPreference[] | undefined,
  elapsedMinutes: number
): ResidentActivityPreference[] {
  const supported = new Set<ResidentActionKind>(RESIDENT_ACTION_KINDS);
  const seen = new Set<ResidentActionKind>();
  const normalized: ResidentActivityPreference[] = [];
  for (const item of Array.isArray(preferences) ? preferences : []) {
    if (!item || !supported.has(item.action) || seen.has(item.action)) continue;
    seen.add(item.action);
    normalized.push({
      action: item.action,
      repetitions: Math.round(clamp(Number.isFinite(item.repetitions) ? item.repetitions : 1, 1, 10_000)),
      satisfaction: Math.round(clamp(Number.isFinite(item.satisfaction) ? item.satisfaction : 0, -100, 100)),
      lastAt: Math.round(clamp(Number.isFinite(item.lastAt) ? item.lastAt : 0, 0, elapsedMinutes))
    });
  }
  return normalized
    .sort((first, second) => second.lastAt - first.lastAt || first.action.localeCompare(second.action))
    .slice(0, MAX_RESIDENT_ACTIVITY_PREFERENCES);
}

function normalizeHouseholdGatherings(
  gatherings: HouseholdGathering[] | undefined,
  residentIds: Set<string>,
  elapsedMinutes: number
): HouseholdGathering[] {
  const normalized: HouseholdGathering[] = [];
  const seenIds = new Set<string>();
  for (const [index, gathering] of (Array.isArray(gatherings) ? gatherings : []).entries()) {
    const definition = gathering && HOUSEHOLD_GATHERING_DEFINITIONS[gathering.kind];
    if (!definition || !residentIds.has(gathering.hostResidentId)) continue;
    const startAt = Math.round(clamp(gathering.startAt ?? 0, 0, elapsedMinutes + 7 * 24 * 60));
    const id = typeof gathering.id === "string" && gathering.id && !seenIds.has(gathering.id)
      ? gathering.id
      : `gathering-${gathering.hostResidentId}-${startAt}-${index}`;
    seenIds.add(id);
    const endsAt = startAt + definition.durationMinutes;
    const completed = gathering.completedAt !== undefined && endsAt <= elapsedMinutes;
    normalized.push({
      id,
      kind: gathering.kind,
      hostResidentId: gathering.hostResidentId,
      startAt,
      durationMinutes: definition.durationMinutes,
      guestCount: Math.round(clamp(gathering.guestCount ?? definition.baseGuests, 2, 14)),
      cost: definition.cost,
      completedAt: completed ? endsAt : undefined,
      attendance: completed ? Math.round(clamp(gathering.attendance ?? gathering.guestCount, 1, 30)) : undefined,
      relationshipGain: completed ? definition.relationshipGain : undefined
    });
  }
  return normalized.sort((first, second) => first.startAt - second.startAt).slice(-MAX_HOUSEHOLD_GATHERINGS);
}

function safeResidentMilestoneText(value: unknown, fallback: string, maximumLength: number) {
  if (typeof value !== "string") return fallback;
  const safe = value.replace(/[<>&]/g, "").trim().replace(/\s+/g, " ").slice(0, maximumLength);
  return safe || fallback;
}

function normalizeResidentMilestones(
  milestones: ResidentMilestone[] | undefined,
  residentId: string,
  residentName: string,
  elapsedMinutes: number
): ResidentMilestone[] {
  const normalized: ResidentMilestone[] = [];
  const usedIds = new Set<string>();
  for (const [index, milestone] of (Array.isArray(milestones) ? milestones : []).entries()) {
    if (!milestone || !RESIDENT_MILESTONE_KINDS.includes(milestone.kind)) continue;
    const occurredAt = Math.round(clamp(milestone.occurredAt ?? 0, 0, elapsedMinutes));
    const title = safeResidentMilestoneText(milestone.title, "Life milestone", 64);
    const detail = safeResidentMilestoneText(milestone.detail, "A new chapter began.", 140);
    const savedId = typeof milestone.id === "string" && milestone.id.length > 0 && milestone.id.length <= 160
      ? milestone.id
      : undefined;
    const id = savedId && !usedIds.has(savedId)
      ? savedId
      : `milestone-${residentId}-${milestone.kind}-${occurredAt}-${hashString(`${title}:${index}`)}`;
    usedIds.add(id);
    normalized.push({ id, kind: milestone.kind, title, detail, occurredAt });
  }
  if (!normalized.length) {
    normalized.push({
      id: `milestone-${residentId}-arrival-0-${hashString(residentName)}`,
      kind: "arrival",
      title: "Joined the household",
      detail: `${safeResidentMilestoneText(residentName, "This resident", 24)}'s saved household story began here.`,
      occurredAt: 0
    });
  }
  return normalized
    .sort((first, second) => second.occurredAt - first.occurredAt || second.id.localeCompare(first.id))
    .slice(0, MAX_RESIDENT_MILESTONES);
}

function nextResidentLifeStage(stage: ResidentLifeStage): ResidentLifeStage | undefined {
  const index = RESIDENT_LIFE_STAGES.indexOf(stage);
  return index >= 0 && index < RESIDENT_LIFE_STAGES.length - 1 ? RESIDENT_LIFE_STAGES[index + 1] : undefined;
}

function blendCaregiverPersonality(caregivers: Resident[], seed: string): ResidentPersonality | undefined {
  if (!caregivers.length) return undefined;
  const blended = Object.fromEntries(RESIDENT_PERSONALITY_AXES.map(axis => {
    const average = caregivers.reduce((total, caregiver) => total + normalizeResidentPersonality(caregiver.personality, caregiver.traits, caregiver.id)[axis], 0) / caregivers.length;
    const variation = hashString(`${seed}:${axis}`) % 15 - 7;
    return [axis, Math.round(clamp(average + variation, 0, 100))];
  })) as ResidentPersonality;
  return blended;
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

type FurnitureRectangle = Pick<Home["furniture"][number], "kind" | "x" | "z" | "rotation">;

function furnitureCorners(item: FurnitureRectangle) {
  const size = HOME_FURNITURE_SIZE[item.kind];
  return rectangleCorners(item.x, item.z, size.width, size.depth, item.rotation);
}

function rectangleCorners(x: number, z: number, width: number, depth: number, rotation: number) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    { x: -width / 2, z: -depth / 2 },
    { x: width / 2, z: -depth / 2 },
    { x: width / 2, z: depth / 2 },
    { x: -width / 2, z: depth / 2 }
  ].map(point => ({
    x: x + cosine * point.x + sine * point.z,
    z: z - sine * point.x + cosine * point.z
  }));
}

function furnitureRectanglesOverlap(first: FurnitureRectangle, second: FurnitureRectangle, padding = 0) {
  const firstSize = HOME_FURNITURE_SIZE[first.kind];
  const secondSize = HOME_FURNITURE_SIZE[second.kind];
  const firstAxes = [
    { x: Math.cos(first.rotation), z: -Math.sin(first.rotation) },
    { x: Math.sin(first.rotation), z: Math.cos(first.rotation) }
  ];
  const secondAxes = [
    { x: Math.cos(second.rotation), z: -Math.sin(second.rotation) },
    { x: Math.sin(second.rotation), z: Math.cos(second.rotation) }
  ];
  const centerDelta = { x: second.x - first.x, z: second.z - first.z };
  return [...firstAxes, ...secondAxes].every(axis => {
    const distanceBetweenCenters = Math.abs(centerDelta.x * axis.x + centerDelta.z * axis.z);
    const firstRadius = firstSize.width / 2 * Math.abs(axis.x * firstAxes[0].x + axis.z * firstAxes[0].z)
      + firstSize.depth / 2 * Math.abs(axis.x * firstAxes[1].x + axis.z * firstAxes[1].z);
    const secondRadius = secondSize.width / 2 * Math.abs(axis.x * secondAxes[0].x + axis.z * secondAxes[0].z)
      + secondSize.depth / 2 * Math.abs(axis.x * secondAxes[1].x + axis.z * secondAxes[1].z);
    return distanceBetweenCenters < firstRadius + secondRadius + padding;
  });
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

function polylinesCross(first: Point2[], second: Point2[]) {
  for (let firstIndex = 0; firstIndex < first.length - 1; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < second.length - 1; secondIndex += 1) {
      if (segmentsCross(first[firstIndex], first[firstIndex + 1], second[secondIndex], second[secondIndex + 1])) return true;
    }
  }
  return false;
}

function segmentsCross(a: Point2, b: Point2, c: Point2, d: Point2) {
  const cross = (first: Point2, second: Point2, third: Point2) =>
    (second.x - first.x) * (third.z - first.z) - (second.z - first.z) * (third.x - first.x);
  const onSegment = (start: Point2, point: Point2, end: Point2) =>
    point.x >= Math.min(start.x, end.x) - .001
    && point.x <= Math.max(start.x, end.x) + .001
    && point.z >= Math.min(start.z, end.z) - .001
    && point.z <= Math.max(start.z, end.z) + .001;
  const firstC = cross(a, b, c);
  const firstD = cross(a, b, d);
  const secondA = cross(c, d, a);
  const secondB = cross(c, d, b);
  if (Math.abs(firstC) < .001 && onSegment(a, c, b)) return true;
  if (Math.abs(firstD) < .001 && onSegment(a, d, b)) return true;
  if (Math.abs(secondA) < .001 && onSegment(c, a, d)) return true;
  if (Math.abs(secondB) < .001 && onSegment(c, b, d)) return true;
  return (firstC > 0) !== (firstD > 0) && (secondA > 0) !== (secondB > 0);
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

function targetHouseholds(zone: Zone, seed: number, density: LotDensity = "medium") {
  if (zone === "residential") return (28 + seed % 76) * LOT_DENSITY_MULTIPLIERS[density];
  if (zone === "mixed") return (20 + seed % 90) * LOT_DENSITY_MULTIPLIERS[density];
  return 0;
}

function targetBusinesses(zone: Zone, seed: number, density: LotDensity = "medium") {
  const multiplier = LOT_DENSITY_MULTIPLIERS[density];
  if (zone === "commercial") return (3 + seed % 14) * multiplier;
  if (zone === "mixed") return (2 + seed % 9) * multiplier;
  if (zone === "industrial") return (2 + seed % 8) * multiplier;
  if (zone === "civic") return Math.max(1, multiplier);
  return 0;
}

function initialHouseholds(zone: Zone, seed: number) {
  return Math.floor(targetHouseholds(zone, seed) * .64);
}

function initialBusinesses(zone: Zone, seed: number) {
  return Math.floor(targetBusinesses(zone, seed) * .7);
}

function normalizeBusinessFinance(
  finance: Partial<BusinessFinance> | undefined,
  businesses: number,
  elapsedMinutes: number
): BusinessFinance {
  const boundedInteger = (value: number | undefined, fallback: number, minimum: number, maximum: number) =>
    Math.round(clamp(Number.isFinite(value) ? value! : fallback, minimum, maximum));
  const lastClosureAt = Number.isFinite(finance?.lastClosureAt)
    ? boundedInteger(finance?.lastClosureAt, 0, 0, elapsedMinutes)
    : undefined;
  const lastRevenue = boundedInteger(finance?.lastRevenue, 0, 0, 100_000_000);
  const lastPayroll = boundedInteger(finance?.lastPayroll, 0, 0, 100_000_000);
  const lastOperatingCosts = boundedInteger(finance?.lastOperatingCosts, 0, 0, 100_000_000);
  return {
    lastRevenue,
    lastPayroll,
    lastOperatingCosts,
    lastProfit: lastRevenue - lastPayroll - lastOperatingCosts,
    operatingReserve: boundedInteger(finance?.operatingReserve, businesses * 5_000, 0, 100_000_000),
    consecutiveLossDays: boundedInteger(finance?.consecutiveLossDays, 0, 0, 3_650),
    lastSettledAt: boundedInteger(finance?.lastSettledAt, 0, 0, elapsedMinutes),
    lastClosureAt
  };
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
  if (templateId === "houston") {
    if (Math.abs(x) < 115 && z > -90 && z < 135) return "commercial";
    if (x > 205 && Math.abs(z) < 210) return "industrial";
    if (x < -330 && (z < -220 || z > 255)) return "unassigned";
    if (Math.abs(x) < 155 && z < -130 && z > -340) return "mixed";
    if (Math.abs(z) < 190) return "mixed";
    return "residential";
  }
  if (templateId === "seattle") {
    if (x > -195 && x < 35 && z > -205 && z < 45) return "commercial";
    if (z < -250 && x < -150) return "industrial";
    if ((x > -25 && x < 175 && z > -90 && z < 175) || (z > 225 && Math.abs(x) < 230)) return "mixed";
    return "residential";
  }
  if (templateId === "portland") {
    if (Math.abs(x) > 405 || z < -365 || z > 370) return "unassigned";
    if (x > -255 && x < -55 && z > -225 && z < 55) return "commercial";
    if (x > 35 && x < 245 && z > -100 && z < 180) return "industrial";
    if ((x > 55 && z > 210) || (x > 45 && z < -55 && z > -270) || (x < -55 && Math.abs(z) < 225)) return "mixed";
    return "residential";
  }
  if (templateId === "chicago") {
    if (x > -105 && x < 70 && z > -95 && z < 65) return "commercial";
    if ((x < -230 && Math.abs(z) < 105) || (z < -245 && x < -120)) return "industrial";
    if (x > -175 && z > -145 && z < 145) return "mixed";
    if (x > 35 && z > -200) return "mixed";
    return "residential";
  }
  if (z < -245) return Math.abs(x) < 78 ? "mixed" : "commercial";
  if (z < 72) return Math.abs(x) < 62 ? "commercial" : "mixed";
  if (z > 315) return "residential";
  return "residential";
}

function templateIdForRoads(roads: Road[]): WorldTemplate["id"] {
  return (Object.keys(TEMPLATE_REGIONAL_CONFIGS) as WorldTemplate["id"][]).find(templateId => {
    const transitRoadId = TEMPLATE_REGIONAL_CONFIGS[templateId].transit?.roadId;
    return transitRoadId && roads.some(road => road.id === transitRoadId);
  }) ?? "blank";
}

function initialCityEvents(roads: Road[]): CityEvent[] {
  const config = TEMPLATE_REGIONAL_CONFIGS[templateIdForRoads(roads)].event;
  if (!config) return [];
  const road = roads.find(item => item.id === config.roadId);
  if (!road?.points.length) return [];
  const definition = CITY_EVENT_DEFINITIONS[config.kind];
  const position = clone(road.points[Math.floor(road.points.length / 2)]);
  return [{
    id: config.id,
    name: config.name,
    kind: config.kind,
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
  const preferredRoadIds = TEMPLATE_REGIONAL_CONFIGS[templateIdForRoads(roads)].parkingRoadIds;
  const fallbackRoadIds = roads
    .filter(road => road.points.length > 1)
    .sort((first, second) => routeLength(second.points) - routeLength(first.points))
    .map(road => road.id);
  const selectedRoadIds = [...new Set([...preferredRoadIds, ...fallbackRoadIds])]
    .filter(roadId => roads.some(road => road.id === roadId))
    .slice(0, 3);
  const choices = selectedRoadIds.map((roadId, index) => ({
    roadId,
    progress: [.24, .52, .76][index],
    side: index % 2 ? 1 : -1
  }));
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
