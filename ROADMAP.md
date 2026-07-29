# Gridless development roadmap

## One world, three scales

Gridless is one continuous game with three nested experiences:

1. **City Builder:** shape terrain, infrastructure, districts, services, economics, and regional growth.
2. **City Explorer:** enter the live city on foot, by vehicle, or by transit and experience its consequences at human scale.
3. **Home Simulator:** select a persistent lot, design its structure and interiors, furnish it, create a household, and simulate daily life.

A city lot is never a decorative placeholder. It can own a persistent home, rooms, objects, residents, finances, utilities, and history. Changes made at household scale contribute to neighborhood demand and city systems; city conditions affect household cost, travel, safety, services, and wellbeing.

## NYC as the flexible starting language

The default template borrows New York City’s useful planning logic without turning the project into a fixed replica:

- Long avenues establish readable north-south movement.
- Frequent cross streets create walkable blocks and many addressable lots.
- A Broadway-like diagonal produces irregular parcels and landmark intersections.
- A major central park anchors land value, recreation, tourism, and neighborhood identity.
- Waterfront edges create bridges, ferries, ports, flood risk, and premium frontage.
- Districts provide strong starting identities while remaining editable.

Later map import should use versioned public GIS data as an optional reference layer. Imported geometry must be simplified into playable road graphs and parcels, never treated as immutable scenery.

### Planned regional foundations

- **Chicago:** lakefront, river branches, rail corridors, alleys, boulevards, strong orthogonal grid, elevated transit, and neighborhood commercial streets
- **Houston:** freeway loops, frontage roads, bayous, floodplains, large parcels, industrial corridors, low-density growth, and flexible land-use patterns
- **Seattle:** steep terrain, Puget Sound, Lake Washington, ferries, bridges, constrained corridors, dense urban villages, and seismic risk
- **Portland:** compact blocks, Willamette and Columbia rivers, bridges, light rail, bicycle networks, neighborhood main streets, and an urban-growth boundary

Every foundation must remain editable. Their value comes from distinct constraints and planning opportunities, not from locking the player into a replica.

### Home Simulator build order

- **Structure:** room drawing, walls, floors, multiple stories, doors, windows, roofs, stairs, and foundations
- **Furnishing:** object catalog, snapping, free rotation, recolors, object interactions, inventories, and build budget
- **Households:** resident creator, relationships, personalities, skills, needs, schedules, careers, and household finances
- **Daily life:** autonomous choices, direct control, conversations, cooking, sleep, work, school, travel, celebrations, and emergencies
- **Neighborhood connection:** visitors, deliveries, local businesses, service quality, commute cost, noise, land value, weather, and community events

The project should grow through complete playable slices. “Massive” comes from streaming, aggregation, and level-of-detail systems, not from simulating every citizen at full fidelity all the time.

## Milestone 0: City-shaping prototype

Goal: make laying out a place feel good.

- Curved road splines with width, grade, intersections, and undo
- Terrain sculpting and water
- Parcel generation from road boundaries
- Procedural building massing
- Planning camera and street-level controller
- Deterministic local save format
- Road hierarchy and parcel zoning with immediate development feedback

Exit gate: a player can create, save, reload, and walk through a distinctive 1 km² town without broken parcels or roads.

## Milestone 1: The living neighborhood

Goal: prove that construction decisions produce understandable consequences.

- Residential, commercial, industrial, civic, and mixed-use demand
- Households, jobs, business occupancy, taxes, and municipal budget
- Power, water, sewage, waste, fire, health, education, and safety
- Vehicle and pedestrian routes generated from the road graph
- Construction phases instead of instant building appearance
- Heat maps and inspectable cause-and-effect explanations

Exit gate: a stable 10,000-person city can run for ten simulated years and remain fun to diagnose.

Current vertical slice:

- Power, water, fire, health, and school buildings persist in the city save.
- Coverage is calculated against real parcels and visualized while placing services.
- Monthly tax revenue and facility operating costs produce an immediate municipal balance.
- Residential, commercial, and industrial demand explains whether jobs or missing services are shaping growth.
- A deterministic calendar advances in whole simulation minutes with pause, normal, fast, and maximum speeds.
- Power lines, water mains, and sewage pipes use editable point paths and persist in city saves.
- Utility parcels require a matching facility and nearby connected network geometry once a network exists.
- Sewage treatment and waste transfer extend the municipal service model.
- Every municipal facility has finite capacity, and lean, standard, or full staffing changes usable capacity and monthly cost.
- Rezoning starts a clock-driven construction project. Population and jobs arrive only after development completes.
- Waste depots can use explicit collection routes instead of serving an entire radius automatically.
- Deterministic fire and medical calls are generated by simulation time and retained in the city save.
- Fire engines and medical units dispatch from the nearest matching facility, then follow the sampled street graph. Response time reflects routed distance and effective staffing.
- Active calls show incident beacons, street-following response paths, moving vehicles, arrival status, and unresolved coverage gaps.
- Every utility route now has explicit resident capacity that can saturate independently of its source facility.
- Completed residential and mixed-use development gains or loses explicit households on daily ticks.
- Businesses open and close in completed commercial, mixed-use, industrial, and civic development.
- Private business jobs and municipal jobs are explicit. The available resident workforce limits the selected staffing policy.
- Power generation and distribution reliability now cascades into the effective capacity of water, sewage, waste, fire, health, school, and other city services.
- Parcels retain family, single, shared, and senior household cohorts rather than only a population estimate.
- Businesses retain retail, office, hospitality, industrial, and community-sector profiles with sector-specific employment.
- Occupied business parcels receive a stable named neighborhood anchor that persists in the city save.
- The parcel inspector explains household and business composition, jobs, construction state, service connections, incidents, and the strongest current growth constraint.
- Household cohorts now move between home, work or school, and other city activity across the simulated day.
- Business sectors use distinct operating hours, so open storefronts and active private jobs change with time.
- Utilities, waste, fire, health, and schools use distinct shift coverage. Effective capacity and emergency response reflect the workers currently on duty.
- Named Home Simulator residents receive persistent roles and visible Home, At work, At school, or Out in city statuses.
- Occupied buildings gain time-aware emissive lighting, connecting the schedule simulation to the 3D city view.
- Up to 72 representative household commute flows preserve metropolitan scalability while prioritizing player-built homes.
- Homes receive persistent workplace links and named residents retain their destination across save and reload.
- Morning and evening travelers follow the same sampled street graph used by emergency responders.
- Walking and driving groups appear in both City Builder and City Explorer, with street-level entry spawning beside active traffic when possible.
- Peak congestion stretches commute duration, reduces on-time business staffing, and delays emergency response.
- The parcel inspector shows mode, distance, estimated duration, group size, destination, and current travel direction.
- Named residents now carry persistent energy, social, comfort, health, and stress needs that progress with simulation time.
- Needs use stable target-seeking updates tied to each resident's current Home, Commuting, At work, At school, or Out in city routine.
- Room count, beds, furniture variety, and plants produce an explicit home-quality score rather than remaining purely decorative.
- Utility reliability, fire, health, school support, active emergencies, crowding, and commute burden shape individual wellbeing.
- Household wellbeing feeds back into daily parcel attractiveness and population growth, connecting Home Simulator decisions to City Builder outcomes.
- City Builder shows population-weighted wellbeing and parcel-level causes, City Explorer follows the selected resident's current condition, and Home Simulator exposes individual need meters and visible state colors.
- Older saves migrate into the expanded resident model, and every need plus its derived consequences survives save and reload.
- Power, water, sewage, and waste lines now retain a persistent condition score that degrades gradually under daily use.
- Deterministic utility failures can strike a connected network segment or source facility, with severity controlling the reliability loss.
- Matching municipal repair crews dispatch from the nearest facility, follow the street graph, experience traffic delay, work on site, and restore service automatically.
- Active outages reduce parcel utility reliability, citywide effective capacity, resident comfort and health targets, wellbeing, and neighborhood growth.
- City Operations shows the failed network, crew state, remaining time, and affected-parcel count alongside fire and medical calls.
- Failed lines, repair routes, moving utility trucks, outage markers, darkened powered buildings, parcel warnings, Home Simulator disruption cards, and City Explorer context expose the same event at every scale.
- Utility conditions, failures, crew routes, timing, severity, and recovery state persist through save and reload, while completed repairs restore line condition.
- Residents at home autonomously choose sleep, meals, relaxation, socializing, plant care, or idle time from their current needs, the time of day, household presence, and available furniture.
- Every named resident has two persistent traits chosen from Outgoing, Homebody, Active, Creative, Organized, and Empathetic. Traits change action scoring and make household routines diverge.
- Autonomous social choices rank available household members by relationship score, personality compatibility, and social need. The selected partner receives the matching action instead of appearing to socialize independently.
- Compatibility changes relationship growth, and both autonomous and directed conversations use the same paired action and relationship systems.
- Directed conversations offer Friendly Chat, Offer Support, Tell a Joke, and Confront. Each intent has its own duration, need effects, trait-sensitive relationship result, 3D feedback color, and persistent recent outcome.
- Beds, tables, sofas, and plants now have functional simulation roles. Resident placement and poses in Home Simulator follow the active action and its target object.
- Action scoring includes duration, need pressure, context, and a recency penalty so residents respond to their condition without repeating one activity forever.
- Active household activity, remaining time, completion history, and resulting need changes are visible in Home Simulator, City Explorer, and the City Builder parcel inspector.
- In-progress actions, targets, partners, timing, and completed-action counts persist through save and reload.
- `npm run test:stability` advances a fixed serviced NYC reference city for ten years in 14,400 six-hour steps, then repeats the full decade and requires an identical deterministic signature.
- The gate checks calendar and budget boundaries, resident needs, household and business cohorts, commute references, service and utility state, incident backlogs, save growth, finite numbers, and bounded population change.
- The verified baseline ends at 29,090 residents, 1,576 businesses, 74% city wellbeing, an 85% staffed service network, and a positive $1.92 million monthly balance.
- Across the baseline decade, 10,799 of 10,800 emergency incidents and 7,199 of 7,200 utility failures resolve before the cutoff. The remaining incident and failure are active events generated immediately before the final timestamp.
- The stability work removed redundant citywide population and staffing calculations from every lot-service evaluation, keeping the long-run gate practical while preserving the simulation result.

The automated Milestone 1 stability gate is complete. Qualitative diagnosis playtesting continues as work moves into Milestone 2.

## Milestone 2: The explorable city

Goal: turn the simulation into a place players want to inhabit.

- Walking, driving, transit riding, interiors for selected building classes
- Traffic signals, parking, sidewalks, crossings, and accessibility
- Weather, seasons, day/night, lighting, soundscapes, and ambience
- Named districts, roads, landmarks, businesses, and civic events
- Photo mode and guided city tours

Exit gate: players can navigate across town without developer tools and can recognize districts from street-level character alone.

Current vertical slice:

- Every existing or player-drawn road spline generates a layered curb, continuous sidewalk, roadway, junction surface, and dashed center marking.
- City Explorer finds a clear sidewalk near the selected lot or active street activity instead of dropping the player on a roadway or inside a building.
- Walking now uses acceleration and deceleration, realistic walk and sprint speeds, head movement, sprint field of view, and a grounded jump.
- Collision checks keep the player inside land boundaries, stop movement through oriented building footprints and municipal facilities, and preserve wall sliding where one movement axis remains clear.
- The street-level HUD reports the nearest named road, current sidewalk, roadway, frontage, park, or block surface, and standing, walking, sprinting, airborne, or blocked state.
- Pointer-lock failure is handled without a runtime error, and clicking the city view retries mouse capture.
- Road crossings are generated from actual spline intersections, with zebra markings, curb-ramp pads, and signal poles on both street axes.
- Traffic signals follow a deterministic two-direction cycle with green, yellow, and all-red clearance phases.
- City Explorer can enter a road-aligned vehicle, accelerate, brake, reverse, steer, handbrake, collide with the built world, leave the roadway with reduced traction, and return safely to a nearby sidewalk.
- Driving uses a dedicated chase camera and live speed and road-surface readout. The vehicle retains its parked position and heading in the world save.
- City Builder places persistent road-aligned curb bays, surface lots, and structured garages with explicit total capacity, live occupancy, and designated accessible spaces.
- City Explorer can park at a nearby facility at low speed. Entering the vehicle releases its occupied space and parking in a full facility is rejected.
- Curb bays, surface lots, and garages now have distinct default hourly prices, operating costs, demand profiles, and projected municipal revenue.
- Parking demand responds to nearby residents, jobs, open businesses, time of day, congestion, facility type, local supply, and the player-selected price.
- Deterministic hourly turnover changes occupancy and collects persistent revenue while reserving the player's occupied space until the vehicle leaves.
- City Builder can apply free, economy, market, premium, or event pricing to existing facilities and sees live occupancy, demand pressure, and projected monthly net results above each facility.
- City Explorer reports nearby price and availability while driving, walking, following accessible wayfinding, and completing a parking action.
- Available-parking selection weighs walking distance, hourly price, and current occupancy instead of treating all open spaces as interchangeable.
- City Builder can convert curb bays into flexible parking, commercial loading, no-parking restrictions, or special-event control with all-day, business-hour, rush-hour, or evening schedules.
- Curb rules activate against the simulation clock. Inactive timed rules return the space to flexible parking, while active loading, restrictions, and events remove the curb from parking and accessibility destination selection.
- Deterministic hourly curb operations generate commercial deliveries, queue blocked vehicles, serve loading demand, record violations, collect loading fees and fines, and contribute operating costs and projected revenue to the municipal budget.
- Active curb uses receive distinct street markings, delivery vans, restriction cones, schedule-aware Builder labels, and Explorer guidance for walking, driving, and attempted parking.
- Older saves receive safe flexible-parking curb defaults, while new NYC foundations include parking, business-hour loading, and evening event examples.
- The NYC foundation includes a recurring Broadway Night Market, and City Builder can schedule named street markets, outdoor concerts, parades, or city matches to start now, at their next natural event time, or tomorrow.
- Each event persists its location, recurring monthly schedule, capacity, expected and cumulative attendance, city fees, costs, occurrence count, and revenue. Older saves receive a safe NYC event default without invalidating their existing city state.
- Active events place nearby curbs under temporary event control without overwriting the player's underlying curb rules. Parking and accessible-destination selection react to the temporary restriction automatically.
- Event attendance adds deterministic traffic pressure to the same congestion model used by commuters, emergency response, utility repair, and household commute burden.
- Transit stops near active events receive added passenger demand based on attendance, event type, distance, frequency, fare, and accessibility. Event-driven riders contribute to queues, boardings, crowding, and fare revenue.
- Active events render a named venue, crowd, event radius, operations-panel status, and Explorer context for drivers, pedestrians, and nearby transit stops.
- Monthly event fees and operating costs join the municipal budget, while completed occurrences retain cumulative attendance and revenue without creating unbounded event-history objects.
- The pedestrian graph follows both sides of every sampled road, connects corners, and crosses roadways only at detected intersections with paired curb ramps.
- Developed homes and businesses, parks, and transit stops receive persistent street-facing entrances with step-free state, clear width, tactile guidance, and automatic-door state.
- City Builder's accessibility tool distinguishes universal, usable, and blocked entrances and funds complete upgrades for homes and shops, parks, or transit stops.
- Pressing `R` in City Explorer cycles the nearest home, business, park, transit stop, and available parking destination. `Shift+R` hides the route.
- Complete-trip wayfinding reports connected sidewalk distance, ramped-crossing counts, final-entrance usability, and any remaining barrier instead of stopping its analysis at the curb.
- Home Simulator and the parcel inspector expose the same entrance condition used by street-level routing.
- City Explorer can enter a furnished home from its actual lot entrance with `F`. A stepped approach or doorway narrower than 0.9m blocks entry until City Builder funds the access upgrade.
- Entered homes use the persistent Home Simulator floor plan. Exterior openings and doorways between adjacent rooms are generated from that plan.
- First-person interior movement stays inside room walls, slides along obstructions, collides with sofas, tables, beds, and plants, and reports the current room.
- Household members who are home remain visible at their active furniture targets, while the interior panel reports live actions, utility disruptions, and entrance quality.
- Home Simulator rejects furniture placed outside every room, and the Explorer regression gate verifies entry access, lot transforms, room transitions, wall containment, and furniture collision.
- Home Simulator resident cards distinguish who is home, away, or commuting. An available resident can be taken directly into first-person control when the entrance is usable.
- Pressing `C` inside cycles at-home residents and observer mode. Controlled resident positions persist with the home and their avatar does not duplicate the first-person player.
- Pressing `E` near a furnishing directs the controlled resident to sleep, eat, relax, or tend plants. These actions use the existing durations, completion history, and need effects rather than a separate interaction system.
- Pressing `E` near another household member opens a four-choice conversation menu. Keys `1` through `4` select Friendly Chat, Offer Support, Tell a Joke, or Confront, while `Q`, `E`, or walking closes the menu.
- Both residents receive intent-specific social, calm, or stress effects. Friendly, supportive, and humorous choices can improve the shared relationship, while Confront deliberately risks relationship loss.
- Home Simulator shows every household relationship, its current label, score, completed conversation count, and most recent intent and outcome. Resident cards identify each person's strongest connection.
- Conversation intent, state, partner references, relationship history, recent outcomes, and relationship scores survive save and reload. Older saves generate deterministic relationship pairs for existing household members and normalize generic active conversations to Friendly Chat.
- Personality traits survive save and reload. Older residents receive two deterministic traits, while new residents receive their personality at creation.
- Home Simulator resident cards show personality chips and behavioral summaries. Relationship rows and the Explorer interaction prompt expose Natural match, Good fit, Mixed fit, or Friction compatibility.
- Walking cancels the current directed activity, while controlled residents remain exempt from autonomous action selection until control ends.
- The interior interaction prompt reports the nearby action and its need effect, and the Explorer and Home Simulator panels report action progress and completion.
- Garages participate in Explorer collision rather than behaving like decorative scenery.
- Representative commuter cars occupy separate right-hand lanes in each direction instead of stacking on the road centerline.
- AI traffic identifies signalized intersections along its actual route, holds behind the stop line during red and all-red phases, proceeds on yellow and green, and illuminates brake lights while stopped.
- The City Explorer driving HUD reports the color and distance of the next signal ahead.
- The NYC foundation generates a persistent Broadway Local B1 bus line with seven named curbside stops attached to the actual arterial geometry.
- Service frequency determines the active bus fleet. Every vehicle follows a deterministic two-direction schedule, reverses at its terminals, and remains in the same 3D city used by traffic, pedestrians, and construction.
- City Builder can choose basic, frequent, or rapid service and a fare-free, standard, or premium policy. Those choices change fleet size, average wait, passenger demand, crowding, operating cost, and projected monthly revenue.
- Deterministic hourly operations generate passengers, process stop queues against available service, count stop boardings, and persist cumulative ridership and fare revenue.
- City Explorer enters near the closest stop to its selected district or active commute. Stop context reports frequency, waiting passengers, average wait, fare, crowding, and access. Pressing `T` boards with the live passenger load, pressing it again requests the next stop, and arrival returns the player to a safe sidewalk position.
- Transit line geometry, stop names, route progress, service plan, queues, boardings, ridership, and fare revenue persist in the world snapshot. Older saves receive safe operating defaults.
- `npm run test:explorer` verifies road lookup, safe sidewalk entry, collisions, intersection and signal behavior, red-light stopping, green-light movement, directional lane separation, parking capacity, pricing, demand response, turnover, revenue, persistence, price-aware selection, timed curb rules, legal-parking changes, loading demand, deliveries, curb enforcement and revenue, named event scheduling and recurrence, attendance, event-controlled curbs, traffic pressure, event transit demand, event finance and persistence, ramp-aware pedestrian routing, entrance generation, destination categories, complete-trip barrier reporting, funded upgrades, interior entry access, room doorways, rotated lot transforms, wall and furniture collision, direct resident selection, persistent home positions, nearby object selection, directed action completion, personality persistence, compatibility ranking, all four conversation intents and their need effects, persistent recent outcomes, paired autonomous conversations, shared need effects, transit generation, bidirectional fleets, frequency, fare demand, waiting time, ridership, revenue, boarding, stop requests, and alighting.

Next systems are additional editable transit lines, district-scale event routing with road closures and temporary transit service, and deeper resident memories that influence future social choices.

## Milestone 3: Metropolitan scale

Goal: support very large cities without sacrificing responsive play.

- World divided into streamable spatial chunks
- GPU instancing, occlusion, impostors, and geometry level of detail
- Simulation level of detail: agents nearby, statistical cohorts far away
- Hierarchical pathfinding across local road graphs and regional corridors
- Background simulation workers and fixed deterministic ticks
- Regional rail, highways, ports, airports, freight, and neighboring cities

Exit gate: a one-million-person region maintains target frame and simulation rates on the minimum supported machine.

## Milestone 4: Players jump in

Goal: make invitations frictionless while protecting the host’s city.

- Join links and guest streaming around a host-selected spawn
- Host, planner, builder, resident, and visitor permissions
- Cooperative construction proposals with preview and approval
- Synchronized vehicles, avatars, weather, and construction events
- Versioned server-authoritative saves and recovery snapshots
- Moderation, reporting, rate limits, and private-city controls

Exit gate: four players can build and explore for an hour through a join link without save divergence.

## Architecture boundaries

- **Simulation core:** deterministic TypeScript or Rust/Wasm with no rendering dependencies
- **World model:** versioned entities and components serialized by spatial chunk
- **Transport graph:** roads and paths are continuous graphs, never visual meshes as source-of-truth
- **Renderer:** consumes read-only snapshots and may drop detail without changing simulation
- **Networking:** authoritative host/server transmits commands and snapshots, not raw scene objects
- **Tools/UI:** all construction uses reversible commands so undo, multiplayer proposals, and replay share one model

## Non-goals for the first playable release

- Every building interior
- Fully simulated lives for every distant citizen
- Planet-scale terrain
- MMO-scale concurrency
- Photorealism at the cost of legibility or stable performance
