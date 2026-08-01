import { homeCirculation, homeSafetyAudit, type HomeSafetyIssue } from "./interiors";
import { HOME_FURNITURE_SIZE, homeEntityFloor, homeRoomLabel, type Home, type HomeMoveInGoalKind, type HomeRoom, type HomeSpaceDeficit, type World } from "./world";

export type HomeReadinessStatus = "Move-in ready" | "Nearly ready" | "Needs work" | "Unsafe";

export type HomeReadinessPriority = {
  kind: HomeMoveInGoalKind;
  severity: "advisory" | "important" | "critical";
  label: string;
  recommendation: string;
};

export type HomeMoveInGoal = {
  kind: HomeMoveInGoalKind;
  label: string;
  complete: boolean;
  detail: string;
};

export type HomeReadiness = {
  score: number;
  ready: boolean;
  status: HomeReadinessStatus;
  components: {
    safety: number;
    circulation: number;
    space: number;
    organization: number;
    energy: number;
    privacy: number;
    condition: number;
  };
  blockers: HomeReadinessPriority[];
  priorities: HomeReadinessPriority[];
  strengths: string[];
};

export type HomeMoveInAuthorization = {
  active: boolean;
  status: "Approved" | "Suspended" | "Not approved";
  approvedAt?: number;
  approvedScore?: number;
  reason: string;
};

export type RoomReadiness = {
  score: number;
  status: "Ready" | "Improve" | "Needs work" | "Unsafe";
  components: {
    purpose: number;
    access: number;
    daylight: number;
    condition: number;
    clearFloor: number;
    egress: number;
  };
  issues: string[];
  strengths: string[];
};

export type HomeInspection = {
  score: number;
  result: "Passed" | "Conditional" | "Failed";
  readyRooms: number;
  totalRooms: number;
  unsafeRooms: number;
  corrections: number;
  priority: string;
  summary: string;
};

const ROOM_PURPOSE_REQUIREMENTS: Record<string, { kinds: Home["furniture"][number]["kind"][]; recommendation: string }> = {
  "Living room": { kinds: ["sofa"], recommendation: "Add a sofa for household relaxation and social time." },
  Bedroom: { kinds: ["bed"], recommendation: "Add a bed so this room can support sleep and a resident claim." },
  Kitchen: { kinds: ["fridge"], recommendation: "Add a fridge so the room can support household meals." },
  Bathroom: { kinds: ["shower"], recommendation: "Add a shower so the room can support hygiene." },
  Study: { kinds: ["desk"], recommendation: "Add a desk so the room can support work and study." },
  "Dining room": { kinds: ["table"], recommendation: "Add a table so the household can share meals." },
  Nursery: { kinds: ["bed"], recommendation: "Add a bed so the nursery can support a young resident." },
  Studio: { kinds: ["bed", "desk"], recommendation: "Add a bed and desk so the studio supports both rest and work." }
};

export function assessRoomReadiness(world: World, home: Home, room: HomeRoom): RoomReadiness {
  const floor = homeEntityFloor(room);
  const furniture = home.furniture.filter(item =>
    homeEntityFloor(item) === floor
    && Math.abs(item.x - room.x) <= room.width / 2
    && Math.abs(item.z - room.z) <= room.depth / 2
  );
  const requirement = ROOM_PURPOSE_REQUIREMENTS[room.kind];
  const presentKinds = new Set(furniture.map(item => item.kind));
  const purpose = requirement
    ? Math.round(requirement.kinds.filter(kind => presentKinds.has(kind)).length / requirement.kinds.length * 100)
    : 100;
  const circulation = homeCirculation(home);
  const access = circulation.unreachableRoomIds.includes(room.id) ? 0 : 100;
  const daylight = world.roomDaylight(home, room);
  const condition = world.roomCondition(room);
  const roomArea = Math.max(1, room.width * room.depth);
  const occupiedArea = furniture.reduce((total, item) => {
    const size = HOME_FURNITURE_SIZE[item.kind];
    return total + size.width * size.depth;
  }, 0);
  const clearFloor = Math.round(Math.max(0, 1 - occupiedArea / roomArea) * 100);
  const sleeping = room.kind === "Bedroom" || room.kind === "Nursery" || room.kind === "Studio";
  const missingEgress = homeSafetyAudit(home).issues.some(issue => issue.kind === "sleep-egress" && issue.roomIds.includes(room.id));
  const egress = sleeping && missingEgress ? 0 : 100;
  const score = Math.round(
    purpose * .3 + access * .22 + daylight * .13 + condition * .13 + clearFloor * .1 + egress * .12
  );
  const issues = [
    access === 0 ? "Connect this room to the home entry with an interior doorway." : undefined,
    egress === 0 ? "Add an escape window at least 0.9m wide." : undefined,
    purpose < 100 ? requirement?.recommendation : undefined,
    daylight < 45 ? "Add or enlarge an exterior window to improve daylight." : undefined,
    clearFloor < 62 ? "Move or remove furnishings to restore a clear walking path." : undefined,
    condition < 72 ? "Renovate the room before relying on it every day." : undefined
  ].filter((issue): issue is string => Boolean(issue));
  const status = access === 0 || egress === 0
    ? "Unsafe"
    : score >= 82 && !issues.length
      ? "Ready"
      : score >= 68
        ? "Improve"
        : "Needs work";
  const strengths = [
    purpose === 100 ? `${homeRoomLabel(room)} supports its purpose` : undefined,
    access === 100 ? "Connected to the exit path" : undefined,
    daylight >= 70 ? "Strong daylight" : undefined,
    clearFloor >= 75 ? "Comfortable clear floor" : undefined,
    condition >= 90 ? "Excellent condition" : undefined
  ].filter((strength): strength is string => Boolean(strength));
  return { score, status, components: { purpose, access, daylight, condition, clearFloor, egress }, issues, strengths };
}

export function nextRoomReadinessIssue(world: World, home: Home, afterRoomId?: string) {
  const statusOrder: Record<RoomReadiness["status"], number> = { Unsafe: 0, "Needs work": 1, Improve: 2, Ready: 3 };
  const issues = home.rooms
    .map(room => ({ room, readiness: assessRoomReadiness(world, home, room) }))
    .filter(item => item.readiness.status !== "Ready")
    .sort((first, second) =>
      statusOrder[first.readiness.status] - statusOrder[second.readiness.status]
      || first.readiness.score - second.readiness.score
      || first.room.id.localeCompare(second.room.id)
    );
  if (!issues.length) return undefined;
  const currentIndex = issues.findIndex(item => item.room.id === afterRoomId);
  return issues[(currentIndex + 1) % issues.length];
}

export function inspectHome(world: World, home: Home): HomeInspection {
  const readiness = assessHomeReadiness(world, home);
  const rooms = home.rooms.map(room => ({ room, readiness: assessRoomReadiness(world, home, room) }));
  const readyRooms = rooms.filter(item => item.readiness.status === "Ready").length;
  const unsafeRooms = rooms.filter(item => item.readiness.status === "Unsafe").length;
  const roomScore = rooms.length
    ? rooms.reduce((total, item) => total + item.readiness.score, 0) / rooms.length
    : 0;
  const score = Math.round(readiness.score * .6 + roomScore * .4);
  const roomIssues = rooms.flatMap(item => item.readiness.issues);
  const corrections = new Set([...readiness.priorities.map(item => item.recommendation), ...roomIssues]).size;
  const nextRoom = nextRoomReadinessIssue(world, home);
  const priority = readiness.blockers[0]?.recommendation
    ?? nextRoom?.readiness.issues[0]
    ?? readiness.priorities[0]?.recommendation
    ?? "No corrective work remains.";
  const result = !readiness.ready || unsafeRooms ? "Failed" : readyRooms === rooms.length ? "Passed" : "Conditional";
  const summary = result === "Passed"
    ? `${home.name} passes at ${score}% with ${readyRooms} of ${rooms.length} rooms ready.`
    : result === "Conditional"
      ? `${home.name} is move-in ready, but ${rooms.length - readyRooms} room${rooms.length - readyRooms === 1 ? " needs" : "s need"} improvement.`
      : `${home.name} fails inspection with ${unsafeRooms} unsafe room${unsafeRooms === 1 ? "" : "s"} and ${corrections} correction${corrections === 1 ? "" : "s"}.`;
  return { score, result, readyRooms, totalRooms: rooms.length, unsafeRooms, corrections, priority, summary };
}

export function recordCurrentHomeInspection(world: World, home: Home) {
  const inspection = inspectHome(world, home);
  const ok = world.recordHomeInspection(home.id, {
    score: inspection.score,
    result: inspection.result,
    readyRooms: inspection.readyRooms,
    totalRooms: inspection.totalRooms,
    corrections: inspection.corrections
  });
  return {
    ok,
    inspection,
    reason: ok ? `${inspection.result} inspection recorded at ${inspection.score}%.` : "This inspection result is already recorded for the current time."
  };
}

export function homeInspectionTrend(home: Home) {
  const records = home.inspections ?? [];
  const latest = records.at(-1);
  const previous = records.at(-2);
  const delta = latest && previous ? latest.score - previous.score : 0;
  const direction = records.length < 2 ? "Not enough history" : delta > 0 ? "Improving" : delta < 0 ? "Declining" : "Steady";
  return {
    records: records.length,
    latest,
    delta,
    direction,
    bestScore: records.length ? Math.max(...records.map(record => record.score)) : undefined,
    failedToPassed: records.some(record => record.result === "Failed") && records.some(record => record.result === "Passed")
  };
}

function safetyPriority(issue: HomeSafetyIssue): HomeReadinessPriority {
  return {
    kind: "safety",
    severity: issue.severity,
    label: issue.label,
    recommendation: issue.recommendation
  };
}

function spacePriority(deficit: HomeSpaceDeficit): HomeReadinessPriority {
  return {
    kind: "space",
    severity: deficit.severity,
    label: deficit.label,
    recommendation: deficit.recommendation
  };
}

export function assessHomeReadiness(world: World, home: Home): HomeReadiness {
  const safety = homeSafetyAudit(home);
  const circulation = homeCirculation(home);
  const space = world.homeSpacePlan(home);
  const organization = world.homeOrganization(home);
  const energy = world.homeEnergyPerformance(home);
  const privacy = home.residents.length ? world.homePrivacy(home) : 100;
  const condition = world.homeCondition(home);
  const components = {
    safety: safety.score,
    circulation: circulation.score,
    space: space.score,
    organization: organization.score,
    energy: energy.score,
    privacy,
    condition
  };
  const score = Math.round(
    components.safety * .22
    + components.circulation * .16
    + components.space * .18
    + components.organization * .12
    + components.energy * .12
    + components.privacy * .1
    + components.condition * .1
  );
  const safetyPriorities = safety.issues.map(safetyPriority);
  const spacePriorities = space.deficits.map(spacePriority);
  const priorities: HomeReadinessPriority[] = [...safetyPriorities, ...spacePriorities];
  if (organization.score < 88) priorities.push({
    kind: "organization",
    severity: organization.score < 45 ? "critical" : organization.score < 68 ? "important" : "advisory",
    label: `${organization.looseItems} loose item${organization.looseItems === 1 ? "" : "s"} and ${organization.clearFloorShare}% clear floor`,
    recommendation: organization.recommendation
  });
  if (energy.score < 70) priorities.push({
    kind: "energy",
    severity: energy.score < 45 ? "important" : "advisory",
    label: `${energy.score}% energy performance at ${energy.dailyKwh.toFixed(1)} kWh per day`,
    recommendation: "Improve daylight, roof performance, or foundation insulation before move-in."
  });
  if (home.residents.length && privacy < 65) priorities.push({
    kind: "privacy",
    severity: privacy < 40 ? "important" : "advisory",
    label: `${privacy}% bedroom privacy`,
    recommendation: "Assign residents to bed-backed Bedrooms, Nurseries, or Studios with fewer occupants."
  });
  if (condition < 72) priorities.push({
    kind: "condition",
    severity: condition < 48 ? "important" : "advisory",
    label: `${condition}% home condition`,
    recommendation: "Renovate worn rooms and repair damaged furnishings before move-in."
  });
  const severityOrder = { critical: 0, important: 1, advisory: 2 } as const;
  priorities.sort((first, second) => severityOrder[first.severity] - severityOrder[second.severity]);
  const blockers = priorities.filter(priority =>
    priority.severity === "critical"
    || priority.kind === "safety" && priority.severity === "important"
  );
  const status: HomeReadinessStatus = safety.issues.some(issue => issue.severity === "critical")
    ? "Unsafe"
    : blockers.length
      ? "Needs work"
      : score >= 82
        ? "Move-in ready"
        : score >= 70
          ? "Nearly ready"
          : "Needs work";
  const strengths = [
    safety.score >= 90 ? "Safe egress" : undefined,
    circulation.score === 100 ? "Connected rooms" : undefined,
    space.score >= 90 ? "Household capacity covered" : undefined,
    organization.score >= 88 ? "Storage organized" : undefined,
    energy.score >= 80 ? "Efficient shell" : undefined,
    privacy >= 85 ? "Strong bedroom privacy" : undefined,
    condition >= 90 ? "Excellent condition" : undefined
  ].filter((strength): strength is string => Boolean(strength));
  return {
    score,
    ready: status === "Move-in ready",
    status,
    components,
    blockers,
    priorities,
    strengths
  };
}

export function homeMoveInAuthorization(world: World, home: Home): HomeMoveInAuthorization {
  const readiness = assessHomeReadiness(world, home);
  const recorded = home.moveInApprovedAt !== undefined && home.moveInApprovedScore !== undefined;
  if (!recorded) return {
    active: false,
    status: "Not approved",
    reason: readiness.ready ? "The home is ready for a player move-in decision." : readiness.blockers[0]?.recommendation ?? "Resolve the move-in checklist first."
  };
  if (!readiness.ready) return {
    active: false,
    status: "Suspended",
    approvedAt: home.moveInApprovedAt,
    approvedScore: home.moveInApprovedScore,
    reason: readiness.blockers[0]?.recommendation ?? "The home no longer meets move-in readiness."
  };
  return {
    active: true,
    status: "Approved",
    approvedAt: home.moveInApprovedAt,
    approvedScore: home.moveInApprovedScore,
    reason: `Approved at ${home.moveInApprovedScore}% readiness and still clear of move-in blockers.`
  };
}

export function approveHomeMoveIn(world: World, home: Home) {
  const readiness = assessHomeReadiness(world, home);
  if (!readiness.ready) return {
    ok: false,
    readiness,
    reason: readiness.blockers[0]?.recommendation ?? `The home is ${readiness.status.toLowerCase()} at ${readiness.score}%.`
  };
  if (!world.recordHomeMoveInApproval(home.id, readiness.score)) return {
    ok: false,
    readiness,
    reason: "Move-in approval is already current."
  };
  return { ok: true, readiness, reason: `${home.name} approved for move-in at ${readiness.score}% readiness.` };
}

const HOME_GOAL_LABELS: Record<HomeMoveInGoalKind, string> = {
  safety: "Resolve safety and egress",
  space: "Cover household capacity",
  organization: "Organize storage and clear floor",
  energy: "Improve energy performance",
  privacy: "Provide bedroom privacy",
  condition: "Restore home condition"
};

export function homeMoveInGoals(world: World, home: Home): HomeMoveInGoal[] {
  const readiness = assessHomeReadiness(world, home);
  return (home.moveInGoalKinds ?? []).map(kind => {
    const active = readiness.priorities.find(priority => priority.kind === kind);
    return {
      kind,
      label: HOME_GOAL_LABELS[kind],
      complete: !active,
      detail: active?.recommendation ?? "Completed from the live home plan."
    };
  });
}

export function pinSuggestedHomeMoveInGoals(world: World, home: Home) {
  const readiness = assessHomeReadiness(world, home);
  const kinds = [...new Set(readiness.priorities.map(priority => priority.kind))].slice(0, 3);
  if (!kinds.length) return { ok: false, reason: "The move-in checklist has no remaining priorities.", kinds };
  if (!world.setHomeMoveInGoals(home.id, kinds)) return { ok: false, reason: "These move-in goals are already pinned.", kinds };
  return { ok: true, reason: `${kinds.length} move-in goal${kinds.length === 1 ? "" : "s"} pinned from live home evidence.`, kinds };
}

export function beginApprovedHomeFirstNight(world: World, home: Home) {
  const authorization = homeMoveInAuthorization(world, home);
  if (!authorization.active) return {
    ok: false,
    residents: 0,
    comfortGain: 0,
    reason: authorization.status === "Suspended" ? authorization.reason : "Approve this ready home before beginning the first night."
  };
  return world.beginHomeFirstNight(home.id);
}
