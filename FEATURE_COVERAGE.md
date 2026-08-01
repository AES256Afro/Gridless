# Competitive feature coverage

This ledger maps the city-building and life-simulation briefs to the current Gridless prototype. “Live” means the feature has executable simulation or interaction coverage. “Partial” means a useful foundation exists, but the complete player-facing system remains ahead. “Planned” means the roadmap names the boundary and the current build does not claim it.

## City Builder

| Brief area | Status | Current Gridless evidence | Next depth target |
| --- | --- | --- | --- |
| Freeform roads | Live | Curved multi-point roads, endpoint, angle, tangent, and parallel guides, configurable lanes and features, surface, bridge, tunnel, pricing, impact previews, and traffic geometry | Stacked interchange editing and lane-level turn controls |
| Zoning and growth | Live | Road-frontage residential, commercial, industrial, and mixed use with low, medium, and high intensity, demand, parcel capacity, and business viability | Organic redevelopment, abandonment, and historical building retention |
| Utilities | Live | Physical power, water, sewage, and waste networks with facilities, failures, maintenance, condition, and service consequences | Terrain-aware water tables, flow direction, and generation portfolios |
| Public services | Live | Police, fire, clinic, school, park, and processing coverage, staffing, response routing, incidents, and costs | Education tiers, death care, and specialized emergency fleets |
| District policy | Live | Named districts, tax and service policies, heavy-traffic restrictions, recycling, school support, and live fiscal or environmental effects | Resource specializations and broader local ordinance combinations |
| Traffic and transit | Live | Agent traffic, signals, congestion, parking, curb management, buses, routes, stops, fares, frequency, transfers, ridership, and event service | Metro, rail, freight, ferry, airport, and bicycle network operations |
| Economy | Live | Tax rates, funding, debt, bonds, service costs, parking, transit, events, household money, wages, and persistent business ledgers | Deeper trade, imports, exports, investments, and price transmission |
| Citizen feedback | Live | Neighborhood pulse, advisor priorities, resident status, wellbeing causes, and parcel-level environmental evidence | Broader civic conversations, petitions, and political tradeoffs |
| Environment and disasters | Partial | Weather, seasons, day and night, environmental health, incidents, utility failures, shelter effects, and recovery | Terrain disasters, evacuation planning, and persistent rebuilding scars |
| Landscaping and water | Planned | Regional terrain and shorelines are data-driven starting foundations | Player terraforming, canals, dams, forests, and dynamic water physics |
| Industry supply chains | Partial | Physical workplaces, customers, profitability, closures, traffic access, and industrial parcels | Extract, process, manufacture, freight, inventory, and retail chains |
| Tourism and events | Live | Recurring markets, festivals, concerts, sports events, attendance, temporary transit, road closure, curb, revenue, and costs | Hotels, attractions, visitor itineraries, and destination branding |
| Modding and sharing | Planned | Deterministic data-oriented world boundaries and versioned saves provide a foundation | Supported asset, map, scripting, and sharing formats |
| Regional progression | Partial | NYC, Chicago, Houston, Seattle, and Portland foundations with distinct constraints, architecture, climate, roads, transit, zoning, parking, and events | Player-facing unlock progression and region-specific late-game networks |

## City Explorer

| Brief area | Status | Current Gridless evidence | Next depth target |
| --- | --- | --- | --- |
| Seamless movement | Live | Continuous walking and driving between city streets, parcels, parking, transit, and persistent homes without changing world state | Bicycles, accessible elevators, and more enterable public buildings |
| Physical consequences | Live | Collision, water boundaries, sidewalks, crossings, entrances, accessibility barriers, congestion, incidents, businesses, and residents are shared with Builder | Denser pedestrian behavior and richer street-level interactions |
| Transit experience | Live | Stop selection, vehicle schedules, boarding, next-stop requests, alighting, waiting, crowding, and fares use the city network | Rail interiors, transfers as player journeys, ferries, and stations |
| Metropolitan scale | Partial | Spatial chunks, render plans, agent-detail levels, aggregate populations, batching, and deterministic ten-year stability | Independent asset streaming, occlusion, impostors, and published hardware budgets |

## Home Simulator and life simulation

| Brief area | Status | Current Gridless evidence | Next depth target |
| --- | --- | --- | --- |
| Freeform home building | Live | Floor-aware free room footprints, authored windows, interior doors, stairs, roofs, foundations, finishes, exact prices, previews, Undo, and Redo | Angled walls, curved rooms, split levels, pools, and individually scalable objects |
| Furnishing and style | Live | Search, categories, favorites, room starter sets, collision previews, multi-select, variants, tint, ownership, duplication, repair, and sale | Surface placement, vertical adjustment, material swatches, and gallery presets |
| Architectural feedback | Live | Circulation, safety, egress, space, privacy, organization, energy, room readiness, issue navigation, inspections, and persistent trends | Code presets, accessibility profiles, and renovation project scheduling |
| Character creation | Partial | Name, seven life stages, role, career direction, aspiration, traits, personality axes, decor, pastime, caregivers, wardrobe, and profile preview | Body, face, voice, pronoun, identity, and layered clothing morph tools |
| Personality and autonomy | Live | Multi-axis personality, needs, routines, preferences learned from outcomes, skills, aspirations, directed actions, and bounded autonomy | More activities, emotional expression, and long-horizon personal planning |
| Social memory | Live | Compatibility, relationship history, impressions, warmth, loyalty, wariness, resentment, conflict, apology, reconciliation, and social preferences | Romance, attraction, boundaries, breakup, cohabitation, and social circles |
| Generations | Live | Infant through elder stages, caregivers, childcare, inherited personality, family moves, milestones, and persistent continuity | Reproduction, deeper childhood development, mentoring, inheritance, and death |
| Careers and businesses | Live | Physical workplaces, branches, tasks, performance, coworkers, customers, progression, wages, business viability, and closures | Freelance contracts, home businesses, craft sales, investments, and property rental |
| Weather and maintenance | Live | Shared weather and seasonal time, climate-aware energy, room and object wear, repair, renovation, and household costs | Outdoor reactions, gardens, snow clearing, clothing wetness, and material aging visuals |
| Emergent household stories | Live | Gatherings, moves, purchases, belongings, wardrobes, room claims, move-in goals, approval, first night, milestones, and inspection history | Household responsibilities, calendars, vacations, secrets, and longer narrative arcs |
| Creation sharing and mods | Planned | Persistent, versioned home and resident data are prerequisites already in place | Room, lot, resident, career, event, and behavior sharing with safe mod APIs |

## Quality gates

- `npm run build` must pass.
- `npm run test:explorer` must pass focused city, explorer, home, resident, save, and migration checks.
- `npm run test:stability` must pass the deterministic ten-year reference scenario.
- The working branch must be clean and synchronized before a milestone is handed off.
- Browser interaction is recorded separately from automated proof because a build pass does not prove rendered UI behavior.

