import { runStabilityTest } from "./stability";

const first = runStabilityTest(10, 360);
const repeat = runStabilityTest(10, 360);
if (first.deterministicSignature !== repeat.deterministicSignature) {
  throw new Error(
    `Determinism failed: ${first.deterministicSignature} did not match ${repeat.deterministicSignature}.`
  );
}

const rows = first.yearly.map(checkpoint => ({
  year: `Y${checkpoint.year}`,
  population: checkpoint.population,
  businesses: checkpoint.businesses,
  wellbeing: `${checkpoint.wellbeing}%`,
  monthlyBalance: Math.round(checkpoint.monthlyBalance),
  treasury: Math.round(checkpoint.treasury),
  residentActions: checkpoint.completedResidentActions,
  workShifts: checkpoint.completedWorkDays,
  workPerformance: `${checkpoint.averageWorkPerformance}%`,
  milestones: checkpoint.residentMilestones,
  eventVisits: checkpoint.eventAttendance
}));

console.log(`Gridless ten-year stability gate: ${first.passed ? "PASS" : "FAIL"}`);
console.log(`Deterministic signature: ${first.deterministicSignature}`);
console.table(rows);
console.log(JSON.stringify({
  durationMs: first.durationMs,
  totals: first.totals,
  peaks: first.peaks,
  final: first.final,
  warnings: first.warnings,
  failures: first.failures
}, null, 2));

if (!first.passed) {
  throw new Error(`Stability gate failed:\n${first.failures.map(failure => `- ${failure}`).join("\n")}`);
}
