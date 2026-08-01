import type { Home, Resident } from "./world";

export type HomeAdvisorInput = {
  residents: Array<Pick<Resident, "energy" | "comfort" | "health" | "stress" | "traits">>;
  furniture: Home["furniture"];
  roomCount: number;
  householdFunds: number;
  dailyNet: number;
  highestTension: number;
};

export type HomeAdvisorAction = {
  id: string;
  title: string;
  detail: string;
  action: "resident" | "room" | "catalog" | "social" | "finances";
  furnitureKind?: Home["furniture"][number]["kind"];
  priority: number;
};

export function homeAdvisorActions(input: HomeAdvisorInput): HomeAdvisorAction[] {
  const actions: HomeAdvisorAction[] = [];
  const count = input.residents.length;
  const kinds = new Set(input.furniture.map(item => item.kind));
  const average = (field: "energy" | "comfort" | "health" | "stress") => count
    ? input.residents.reduce((total, resident) => total + resident[field], 0) / count
    : 100;
  if (!count) {
    actions.push({
      id: "resident",
      title: "Create the household",
      detail: "Residents turn this floor plan into a daily-life simulation.",
      action: "resident",
      priority: 100
    });
  }
  const beds = input.furniture.filter(item => item.kind === "bed").length;
  if (count > beds) {
    actions.push({
      id: "bed",
      title: `Add ${count - beds} more bed${count - beds === 1 ? "" : "s"}`,
      detail: `${count} residents currently share ${beds} dedicated sleeping spaces.`,
      action: "catalog",
      furnitureKind: "bed",
      priority: 96
    });
  }
  if (count > input.roomCount * 2) {
    actions.push({
      id: "room",
      title: "Create more living space",
      detail: `${count} residents across ${input.roomCount} rooms is reducing home quality.`,
      action: "room",
      priority: 91
    });
  }
  if (!kinds.has("shower")) {
    actions.push({
      id: "shower",
      title: "Add a bathroom shower",
      detail: count && average("health") < 80 ? "Household health is low and hygiene has no dedicated object." : "Unlock hygiene, comfort, and wellness activity.",
      action: "catalog",
      furnitureKind: "shower",
      priority: count && average("health") < 80 ? 89 : 62
    });
  }
  if (!kinds.has("fridge")) {
    actions.push({
      id: "fridge",
      title: "Add a kitchen fridge",
      detail: count && average("energy") < 65 ? "Low household energy makes reliable meals urgent." : "Unlock a second reliable meal interaction.",
      action: "catalog",
      furnitureKind: "fridge",
      priority: count && average("energy") < 65 ? 86 : 58
    });
  }
  if (!kinds.has("sofa") && count && (average("comfort") < 70 || average("stress") > 45)) {
    actions.push({
      id: "sofa",
      title: "Create a place to relax",
      detail: "Low comfort or elevated stress makes shared relaxation valuable.",
      action: "catalog",
      furnitureKind: "sofa",
      priority: 83
    });
  }
  if (
    count
    && input.residents.some(resident => resident.traits.includes("creative"))
    && !kinds.has("desk")
    && !kinds.has("bookcase")
  ) {
    actions.push({
      id: "study",
      title: "Support a creative resident",
      detail: "A desk or bookcase unlocks study and persistent skill growth.",
      action: "catalog",
      furnitureKind: "desk",
      priority: 77
    });
  }
  if (input.highestTension >= 35) {
    actions.push({
      id: "social",
      title: "Repair household tension",
      detail: `${Math.round(input.highestTension)}% tension calls for support or an apology in direct control.`,
      action: "social",
      priority: 88
    });
  }
  if (input.householdFunds < 0 || input.dailyNet < 0) {
    actions.push({
      id: "finances",
      title: "Review household finances",
      detail: `${input.dailyNet < 0 ? "Daily costs exceed wages." : "Household debt is reducing wellbeing."}`,
      action: "finances",
      priority: input.householdFunds < -5_000 ? 87 : 72
    });
  }
  return actions
    .sort((first, second) => second.priority - first.priority || first.id.localeCompare(second.id))
    .slice(0, 3);
}
