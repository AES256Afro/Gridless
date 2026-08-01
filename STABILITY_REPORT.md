# Ten-year stability report

Status: PASS

Deterministic signature: `847e9bbe`

Command:

```bash
npm run test:stability
```

## Scope

The gate creates a fixed NYC reference city with 296 lots, persistent editable road profiles, neutral tax policy, district-policy and municipal-debt state, eight persistent spatial chunks, 304 persistent accessibility entrances, priced parking, timed curb rules with hourly delivery and enforcement activity, a recurring named event with persistent road closures and temporary transit service, an editable frequency-controlled transit network with hourly passenger activity, complete municipal service types, connected utility networks, commute representatives, emergency response, utility repairs, and a furnished autonomous household with persistent floor assignments, personality, life stage, aspiration, caregiver lineage, skill-linked career track and branch, favorite style and pastime, bounded personal inventory, furniture ownership, belonging satisfaction, household finances, intent-aware conversations, bounded social memories, conflict and reconciliation state, and a clear enterable interior.

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
| Resident wellbeing | 73% | 86% |
| Completed resident actions | 0 | 14,398 |
| Event occurrences | 0 | 120 |
| Cumulative event attendance | 0 | 333,314 |
| Save snapshot | 338 KB | 352 KB |

The largest observed snapshot was 367,507 bytes.

## Load and recovery

Explorer regression coverage now serializes a changed city, makes a later edit, restores the earlier recovery snapshot, and verifies exact road identity, Undo availability, revision tracking, and safe rejection of malformed recovery data. The live browser keeps this recovery channel separate from the player's manual save.

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
- resident needs, functional-room scores, or home quality outside 0 to 100
- missing, undersized, duplicate, unreachable, invalidly assigned, or invalidly finished home rooms, invalid floor counts, duplicate or malformed stair links, invalid resident floor assignments, duplicate or unknown catalog furnishings, invalid furniture styles, invalid design budgets, overspending, invalid furniture rotation, furniture overlap, or furniture crossing room walls
- invalid or duplicate resident names, oversized households, invalid controlled-resident home positions, personality traits, resident action targets, conversation partners, conversation intents, social memories, tension, conflict or reconciliation history, recent relationship outcomes, relationship pairs, scores, conversation counts, or household purchase records
- non-finite or out-of-range learned resident social preferences derived from relationship memories
- non-integer or out-of-range resident skill points, career levels, or career experience
- unknown or out-of-range life stages, aging clocks, aspirations, aspiration progress, career tracks, career branches, generations, caregiver links, or stage-change timestamps
- unknown decor preferences or pastimes, duplicate or invalid personal items, out-of-range acquisition timestamps, dangling furniture owners, or invalid belonging scores
- non-integer, negative-income, negative-expense, out-of-range household balances, or invalid financial-security scores
- broken home, incident, failure, service, utility, or commute references
- missing or invalid saved city or home identity
- missing, non-finite, or out-of-range road profiles, widths, lane counts, speed policies, sidewalk widths, modeled capacities, or planning-view traffic pressure
- unsupported tax rates, missing district references, duplicate or unknown policies, invalid land values, oversized debt portfolios, duplicate bonds, or invalid balances, interest rates, payments, and remaining terms
- non-finite or out-of-range deterministic temperature, wind, precipitation, or visibility
- duplicate or invalid transit lines, names, source-road references, colors, stop counts, stops, routes, transfers, service frequencies, vehicle capacities, fares, queues, boardings, ridership, or revenue
- invalid parking prices, revenue, capacity, occupancy, or accessible-space counts
- invalid curb uses, schedules, delivery queues, completed-delivery counts, violations, or enforcement revenue
- duplicate or invalid named events, schedules, capacities, occurrence counts, attendance, costs, revenue, source roads, closure roads, temporary transit lines, or temporary headways
- duplicate spatial chunks, invalid chunk size, missing road references, duplicate or missing lot membership, or chunk population that differs from the city economy
- duplicate accessibility entrances, missing entrance targets, invalid clear widths, or non-finite entrance positions
- calendar or monthly-budget boundary errors
- runaway incident history, save size, population, or treasury behavior
- deterministic difference between the two complete runs

## Performance finding

The first attempt exposed redundant work in daily lot evaluation. Every lot and service combination independently recalculated citywide population and staffing. The simulation now calculates those shared values once per pass and reuses them. With tax, district-policy, municipal-debt, land-value, persistent road-profile, spatial-chunk, parking, curb, event, transit, entrance, household, personality, life-stage, aspiration, career, lineage, preference, inventory, ownership, relationship, identity, and recovery checks included, the latest complete deterministic gate took about 59 seconds for both decades on the development machine.

## Boundary

This report proves deterministic technical stability for the current fixed reference scenario. It does not prove that every player-built city is stable or that diagnosing a struggling city is fun. Those require more scenario coverage and playtesting.
