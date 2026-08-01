export type NeighborhoodPulseInput = {
  districtId: string;
  districtName: string;
  population: number;
  jobs: number;
  wellbeing: number;
  utilityReliability: number;
  trafficPressure: number;
  landValue: number;
  parkAccess: number;
  environmentalExposure: number;
  activeOutages: number;
  policyCount: number;
};

export type NeighborhoodPulse = NeighborhoodPulseInput & {
  score: number;
  status: "critical" | "watch" | "positive";
  voice: string;
  headline: string;
  message: string;
  actionLabel: string;
  focusView: "traffic" | "utilities" | "wellbeing" | "land-value" | "environment" | "development";
  priority: number;
};

type Concern = {
  priority: number;
  voice: string;
  headline: string;
  message: string;
  actionLabel: string;
  focusView: NeighborhoodPulse["focusView"];
};

function bounded(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export function neighborhoodPulse(input: NeighborhoodPulseInput): NeighborhoodPulse {
  const wellbeing = bounded(input.wellbeing);
  const utility = bounded(input.utilityReliability);
  const traffic = bounded(input.trafficPressure * 100);
  const landValue = bounded(input.landValue);
  const parkAccess = bounded(input.parkAccess);
  const exposure = bounded(input.environmentalExposure);
  const jobAccess = input.population > 0 ? bounded(input.jobs / input.population * 180) : 100;
  const concerns: Concern[] = [
    {
      priority: 100 - utility + Math.min(35, input.activeOutages * 12),
      voice: "Household voice",
      headline: input.activeOutages ? "Basic services are failing" : "Utilities feel unreliable",
      message: input.activeOutages
        ? `${input.activeOutages} active outage${input.activeOutages === 1 ? " is" : "s are"} disrupting daily life here.`
        : `Utility reliability is ${Math.round(utility)}%, and residents are noticing interruptions.`,
      actionLabel: "Inspect utilities",
      focusView: "utilities"
    },
    {
      priority: 100 - wellbeing,
      voice: "Community voice",
      headline: "Daily life feels strained",
      message: `Neighborhood wellbeing is ${Math.round(wellbeing)}%. Local needs are not keeping pace with growth.`,
      actionLabel: "Inspect wellbeing",
      focusView: "wellbeing"
    },
    {
      priority: traffic,
      voice: "Commuter voice",
      headline: "Trips are taking too long",
      message: `Nearby corridors average ${Math.round(traffic)}% traffic pressure during the current simulation period.`,
      actionLabel: "Inspect traffic",
      focusView: "traffic"
    },
    {
      priority: (100 - parkAccess) * .72,
      voice: "Family voice",
      headline: "We need nearby green space",
      message: `Only ${Math.round(parkAccess)}% of local parcels have convenient park access.`,
      actionLabel: "Inspect wellbeing",
      focusView: "wellbeing"
    },
    {
      priority: exposure * .9,
      voice: "Neighbor voice",
      headline: "Environmental risk feels close",
      message: `${Math.round(exposure)}% of local parcels face mapped flood, slope, or growth-boundary pressure.`,
      actionLabel: "Inspect environment",
      focusView: "environment"
    },
    {
      priority: (100 - landValue) * .58,
      voice: "Local business voice",
      headline: "The block needs investment",
      message: `Average land value is ${Math.round(landValue)}/100 despite ${input.policyCount} active district polic${input.policyCount === 1 ? "y" : "ies"}.`,
      actionLabel: "Inspect land value",
      focusView: "land-value"
    },
    {
      priority: (100 - jobAccess) * .62,
      voice: "Worker voice",
      headline: "Jobs are too far from home",
      message: `${input.jobs.toLocaleString()} local jobs serve ${input.population.toLocaleString()} residents.`,
      actionLabel: "Inspect development",
      focusView: "development"
    }
  ];
  const leading = concerns.sort((first, second) => second.priority - first.priority)[0];
  const score = Math.round(
    wellbeing * .28
    + utility * .22
    + (100 - traffic) * .15
    + landValue * .13
    + parkAccess * .1
    + (100 - exposure) * .07
    + jobAccess * .05
  );
  const status = leading.priority >= 62 || score < 48
    ? "critical"
    : leading.priority >= 36 || score < 68
      ? "watch"
      : "positive";
  if (status === "positive") {
    return {
      ...input,
      score,
      status,
      priority: 100 - score,
      voice: "Neighborhood voice",
      headline: "This district feels supported",
      message: `${Math.round(wellbeing)}% wellbeing, ${Math.round(utility)}% utility reliability, and manageable local pressure are reinforcing confidence.`,
      actionLabel: "Inspect wellbeing",
      focusView: "wellbeing"
    };
  }
  return { ...input, score, status, ...leading };
}
