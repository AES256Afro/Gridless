import { homeCirculation, homeSafetyAudit, type HomeSafetyIssue } from "./interiors";
import type { Home, HomeSpaceDeficit, World } from "./world";

export type HomeReadinessStatus = "Move-in ready" | "Nearly ready" | "Needs work" | "Unsafe";

export type HomeReadinessPriority = {
  kind: "safety" | "space" | "organization" | "energy" | "privacy" | "condition";
  severity: "advisory" | "important" | "critical";
  label: string;
  recommendation: string;
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
