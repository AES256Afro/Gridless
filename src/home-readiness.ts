import { homeCirculation, homeSafetyAudit, type HomeSafetyIssue } from "./interiors";
import type { Home, HomeMoveInGoalKind, HomeSpaceDeficit, World } from "./world";

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
