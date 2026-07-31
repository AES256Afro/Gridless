export type CityAdvisorInput = {
  roads: number;
  services: number;
  coverage: number;
  staffing: number;
  utilityFailures: number;
  congestion: number;
  wellbeing: number;
  monthlyBalance: number;
};

export type CityAdvisorAction = {
  id: string;
  title: string;
  detail: string;
  group: "build" | "services" | "mobility" | "views";
  tool?: "road" | "service" | "utility";
  view?: "traffic" | "utilities" | "wellbeing" | "development";
  priority: number;
};

export function cityAdvisorActions(input: CityAdvisorInput): CityAdvisorAction[] {
  const actions: CityAdvisorAction[] = [];
  if (!input.roads) {
    actions.push({
      id: "first-road",
      title: "Draw the first street",
      detail: "Roads create the parcel network that every other system needs.",
      group: "build",
      tool: "road",
      priority: 100
    });
  }
  if (input.utilityFailures > 0) {
    actions.push({
      id: "utility-failure",
      title: `Restore ${input.utilityFailures} utility outage${input.utilityFailures === 1 ? "" : "s"}`,
      detail: "Active outages reduce health, comfort, growth, and effective capacity.",
      group: "views",
      view: "utilities",
      priority: 96
    });
  }
  if (input.roads > 0 && (input.services === 0 || input.coverage < .55)) {
    actions.push({
      id: "service-coverage",
      title: input.services === 0 ? "Place essential services" : "Close service gaps",
      detail: `${Math.round(input.coverage * 100)}% combined coverage is constraining neighborhood support.`,
      group: "services",
      tool: "service",
      priority: 90
    });
  }
  if (input.services > 0 && input.staffing < .7) {
    actions.push({
      id: "service-staffing",
      title: "Strengthen service staffing",
      detail: `${Math.round(input.staffing * 100)}% effective staffing is slowing city response.`,
      group: "services",
      tool: "service",
      priority: 84
    });
  }
  if (input.monthlyBalance < 0) {
    actions.push({
      id: "budget",
      title: "Protect the monthly budget",
      detail: `The city is losing $${Math.round(Math.abs(input.monthlyBalance)).toLocaleString("en-US")} each month.`,
      group: "views",
      view: "development",
      priority: 82
    });
  }
  if (input.congestion > .62) {
    actions.push({
      id: "traffic",
      title: "Relieve traffic pressure",
      detail: `${Math.round(input.congestion * 100)}% congestion is affecting trips and service response.`,
      group: "views",
      view: "traffic",
      priority: 78
    });
  }
  if (input.wellbeing > 0 && input.wellbeing < 60) {
    actions.push({
      id: "wellbeing",
      title: "Investigate low wellbeing",
      detail: `${Math.round(input.wellbeing)}% wellbeing reflects local utilities, services, travel, and finances.`,
      group: "views",
      view: "wellbeing",
      priority: 74
    });
  }
  actions.push({
    id: "growth",
    title: "Review development capacity",
    detail: "Compare parcel demand, construction, population, and available jobs.",
    group: "views",
    view: "development",
    priority: 20
  });
  return actions
    .sort((first, second) => second.priority - first.priority || first.id.localeCompare(second.id))
    .slice(0, 3);
}
