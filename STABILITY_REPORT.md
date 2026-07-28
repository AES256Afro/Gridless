# Ten-year stability report

Status: PASS

Deterministic signature: `69becee3`

Command:

```bash
npm run test:stability
```

## Scope

The gate creates a fixed NYC reference city with 296 lots, 304 persistent accessibility entrances, priced parking, timed curb rules with hourly delivery and enforcement activity, a recurring named event with attendance and cross-system demand, frequency-controlled transit with hourly passenger activity, complete municipal service types, connected utility networks, commute representatives, emergency response, utility repairs, and a furnished autonomous household.

Each run advances ten 360-day simulation years in 14,400 six-hour steps. It posts 120 monthly budgets and captures an exact anniversary checkpoint after each year. The runner then creates the scenario again, repeats the entire decade, and requires the same signature.

## Result

| Metric | Start | Year 11 |
| --- | ---: | ---: |
| Population | 18,401 | 29,090 |
| Households | 8,230 | 13,016 |
| Businesses | 1,012 | 1,576 |
| Monthly balance | -$1.87m | +$2.26m |
| Treasury | $25.00m | $292.22m |
| City wellbeing | 78% | 74% |
| Service staffing | 85% | 85% |
| Resident wellbeing | 77% | 86% |
| Completed resident actions | 0 | 14,399 |
| Event occurrences | 0 | 120 |
| Cumulative event attendance | 0 | 333,314 |
| Save snapshot | 333 KB | 347 KB |

The largest observed snapshot was 354,317 bytes.

## Load and recovery

| System | Created | Resolved by cutoff | Peak active |
| --- | ---: | ---: | ---: |
| Fire and medical incidents | 10,800 | 10,799 | 1 |
| Utility failures | 7,200 | 7,199 | 2 |

One emergency and one utility failure were still active because they were generated immediately before the final simulation timestamp. Retained history stayed bounded at 10 incidents and 12 utility failures.

The lowest utility condition at the cutoff was 86.17%. Commute representatives remained within the 72-flow simulation limit.

## Integrity checks

The run found no:

- non-finite simulation values
- negative household or business counts
- cohort or sector sum mismatches
- resident needs outside 0 to 100
- broken home, incident, failure, service, utility, or commute references
- duplicate or invalid transit lines, stops, routes, service frequencies, vehicle capacities, fares, queues, boardings, ridership, or revenue
- invalid parking prices, revenue, capacity, occupancy, or accessible-space counts
- invalid curb uses, schedules, delivery queues, completed-delivery counts, violations, or enforcement revenue
- duplicate or invalid named events, schedules, capacities, occurrence counts, attendance, costs, or revenue
- duplicate accessibility entrances, missing entrance targets, invalid clear widths, or non-finite entrance positions
- calendar or monthly-budget boundary errors
- runaway incident history, save size, population, or treasury behavior
- deterministic difference between the two complete runs

## Performance finding

The first attempt exposed redundant work in daily lot evaluation. Every lot and service combination independently recalculated citywide population and staffing. The simulation now calculates those shared values once per pass and reuses them. With deterministic hourly parking turnover, curb scheduling, delivery and enforcement activity, named event attendance and demand, transit passenger operations, and the saved entrance layer included, the first complete decade took about 58 seconds on the development machine. The default deterministic gate took about 103 seconds because it runs the decade twice.

## Boundary

This report proves deterministic technical stability for the current fixed reference scenario. It does not prove that every player-built city is stable or that diagnosing a struggling city is fun. Those require more scenario coverage and playtesting.
