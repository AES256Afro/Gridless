# Gridless development roadmap

## One world, three scales

Gridless is one continuous game with three nested experiences:

1. **City Builder:** shape terrain, infrastructure, districts, services, economics, and regional growth.
2. **City Explorer:** enter the live city on foot, by vehicle, or by transit and experience its consequences at human scale.
3. **Home Simulator:** select a persistent lot, design its structure and interiors, furnish it, create a household, and simulate daily life.

A city lot is never a decorative placeholder. It can own a persistent home, rooms, objects, residents, finances, utilities, and history. Changes made at household scale contribute to neighborhood demand and city systems; city conditions affect household cost, travel, safety, services, and wellbeing.

The interface follows the same hierarchy. The persistent top switcher moves between City Builder, City Explorer, and Home Simulator. City Builder then narrows work into Build, Zones, Services, Mobility, Events, and diagnostic Views, with operation-specific settings revealed only when relevant. Explorer prioritizes place, movement, and nearby actions. Home Simulator prioritizes construction, furnishing, residents, needs, and relationships.

City Builder also provides a compact City Advisor. It ranks the three highest-value next actions from live roads, service coverage, staffing, outages, budget, congestion, wellbeing, and development state, explains the metric behind each recommendation, and opens the relevant tool or planning view when selected.

Zoning separates land use from development intensity. Every parcel can independently apply low, medium, or high intensity to residential, commercial, mixed, industrial, or civic use; capacity, construction, and regional building massing respond without changing the parcel geometry or imposing a grid.

Neighborhood Voices adds a human-scale diagnostic alongside the City Advisor. Every live district receives a deterministic pulse from its utility reliability, wellbeing, traffic, land value, park access, environmental exposure, jobs, outages, and policies. The most urgent representative voices appear first, and each card focuses its district and opens the matching evidence view.

## NYC as the flexible starting language

The default template borrows New York City’s useful planning logic without turning the project into a fixed replica:

- Long avenues establish readable north-south movement.
- Frequent cross streets create walkable blocks and many addressable lots.
- A Broadway-like diagonal produces irregular parcels and landmark intersections.
- A major central park anchors land value, recreation, tourism, and neighborhood identity.
- Waterfront edges create bridges, ferries, ports, flood risk, and premium frontage.
- Districts provide strong starting identities while remaining editable.

Later map import should use versioned public GIS data as an optional reference layer. Imported geometry must be simplified into playable road graphs and parcels, never treated as immutable scenery.

### Regional foundations

- **Chicago is live:** an editable lakefront, three river branches, service alleys, a strong orthogonal grid, Milwaukee diagonal, expressway, bus-priority State and Lake corridors, lakefront trail, neighborhood zoning, distinct parks and districts, local parking, State Street event, transit identity, and colder windier climate
- **Houston is live:** editable freeway loops, frontage roads, two bayous, three mapped floodplains, large parcels, industrial corridors, intentional unassigned land, low-density growth, Main Street transit, regional parking and event identity, and a warm wet climate
- **Seattle is live:** narrow developable land between sound and lake, Lake Union and ship-canal constraints, four mapped hill areas, three major bridge corridors, freeways without parcel frontage, compact urban villages, bicycle routes, 3rd Avenue transit, and a cool wet climate; ferries and seismic systems remain ahead
- **Portland is live:** compact blocks, Willamette and Columbia rivers, four bridge corridors, two bicycle greenways, transit-priority Burnside, neighborhood main streets and centers, three major parks, and a visible urban growth boundary; modeled light rail vehicles remain ahead

Every foundation must remain editable. Their value comes from distinct constraints and planning opportunities, not from locking the player into a replica.

### Home Simulator build order

- **Structure:** room drawing, up to four persistent floor levels, floor-aware rooms and furnishings, paid floor shells, placeable stair links, Explorer stair navigation, eight room purposes, selectable plans, persistent floor and wall finishes, and safe top-floor removal are live; manual doors, windows, roofs, split levels, and foundation choices remain ahead
- **Furnishing:** a categorized eight-object catalog, four persistent style swatches, resident ownership, purpose-aware one-click starter sets, priced placement, collision-aware rotation, selling, budget, and functional interactions are live; object variants, per-part recolors, free rotation, and snapping choices remain ahead
- **Households:** resident creator, seven life stages, caregiver lineage, inherited personality, relationships, aspirations, five branching career tracks, physical workplaces and daily tasks, dated life milestones, favorite styles and pastimes, persistent outfits, invitations, visible visitors, celebrations, bounded personal collections, object ownership, skills, needs, schedules, wages, daily expenses, household funds, and three discretionary purchases are live; household splits remain ahead
- **Guidance:** prioritized household wants are live for residents, beds, crowding, hygiene, meals, comfort, skill growth, relationship tension, and finances; five long-term resident aspirations are live, while player-pinned household goals remain ahead
- **Daily life:** autonomous choices, direct control, conversations, cooking, sleep, work, school, travel, celebrations, and emergencies
- **Neighborhood connection:** visitors, deliveries, local businesses, service quality, commute cost, noise, land value, weather, and community events

The project should grow through complete playable slices. “Massive” comes from streaming, aggregation, and level-of-detail systems, not from simulating every citizen at full fidelity all the time.

City and Home edits share a bounded 40-step Undo and Redo history. Visible buttons reflect availability, `Cmd/Ctrl+Z` undoes, `Cmd/Ctrl+Shift+Z` and `Ctrl+Y` redo, exact snapshots restore cross-system state, and a new edit after Undo safely starts a fresh branch.

The browser keeps manual saves separate from a debounced recovery snapshot. Every authored change, simulated day, and clean page exit refreshes the recovery copy. Recovering is itself undoable, while malformed or incompatible recovery data leaves the current city untouched.

A global field guide is available from every scale through the visible Help button or `?`. It groups controls by City Builder, City Explorer, and Home Simulator, documents shared history and recovery behavior, closes with `Esc` or the backdrop, and remains usable on narrow screens.

New cities expose a compact starter journey in City Builder. Its four goals read actual world state for zoning, services, Explorer entry, and meaningful home changes; unfinished goals open the correct scale and tool, completed goals become visibly quiet, and experienced players can dismiss the panel.

Player comfort settings persist separately from the city save. Reduced motion removes first-person camera sway, sprint lens changes, interface transitions, and animated precipitation while retaining weather lighting. High contrast strengthens HUD surfaces and active states. The same panel can restore or hide the starter journey.

The global activity center retains the latest 30 notices for the current play session instead of replacing history with each new message. Entries carry the saved simulation date and time, use text-only rendering for player-authored names, track unread updates, and can be cleared without changing the city.

Each world now has a player-editable city name in the Builder foundation controls. The name appears in the persistent HUD and browser title, accepts a bounded safe character set, resets with a new region template, and participates in snapshots, recovery, Undo, and Redo.

The foundation chooser now pairs each available template with a plain-language planning summary and preserves a pending choice through live simulation redraws until the player confirms the destructive reset. Chicago loads as New Lakeshore City with 30 editable routes, 698 developable parcels, four starting districts, two lakefront parks, three visible river branches, a regional zoning mix, Chicago-specific transit stops, parking, a State Street event, and deterministic winter climate. Expressway, trail, and service-alley geometry remains editable and traversable without generating unrealistic roadside parcels.

Houston loads as New Bayou City with 24 editable routes, 768 large-parcel frontages, a 610-style loop, two crossing freeways, paired frontage roads, two bayous, three visible floodplains, four districts, two parks, an industrial ship-channel pattern, 60 intentionally unassigned parcels, and region-specific transit, parking, event, and warm-climate behavior. The Environment planning view distinguishes outside, moderate, and high flood exposure. Risk does not lock development, but it creates an explicit seven- or fourteen-point land-value penalty so preserving floodplain space becomes a legible player tradeoff.

Seattle loads as New Sound City with 26 editable routes, 519 parcels, three internal water constraints, four mapped hill areas, three cross-water bridge corridors, two limited-access regional roads, a bicycle trail, five urban districts, two major parks, and region-specific transit, parking, event, and cool-wet climate behavior. The Environment view combines flood and terrain evidence: 69 parcels begin on steep ground and 55 on moderate slopes. Terrain remains editable, while four- and nine-point land-value pressure makes corridor alignment and open-space choices visible before a full elevation engine arrives.

Portland loads as New River City with 28 editable routes, 645 compact-block parcels, the Willamette and Columbia rivers, four cross-river main streets, two limited-access highways, two bicycle greenways, five neighborhood districts, three parks, and region-specific transit, parking, Rose Festival, and cool-rainy climate behavior. A visible urban growth boundary contains 528 starting parcels while 117 sit outside it. The exterior remains editable and begins largely unassigned, but carries ten points of land-value pressure so compact growth is a readable incentive rather than an invisible rule.

Home Simulator exposes the same authored identity for each property or household. Names use the bounded safe character set, remain attached to the exact city lot, enter the activity feed, and participate in snapshots, recovery, Undo, and Redo.

Help, Settings, and Resident Creator are pause-safe modal tasks. Opening the first modal remembers the exact simulation speed, every close path checks whether another modal remains, and the prior pause, normal, fast, or maximum speed returns only after the final modal closes.

Global keyboard routing now distinguishes gameplay from text entry and modal tasks. `Cmd/Ctrl+S` saves, `Alt+1/2/3` changes scale, backquote pauses or resumes the last active speed, and existing Help plus history shortcuts remain available without stealing movement, typing, or native text Undo from focused fields.

The shared action bar reports save state independently from transient activity notices. It distinguishes pending recovery writes, protected snapshots, manual saves, successful loads, recovery loads, and missing save data with simulation-time confirmation where applicable.

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
- City Builder now separates residential, commercial, and industrial tax rates from 5% to 20%. Current receipts update immediately, while simulated household and business targets react over time to the relevant rate.
- The Economy workspace itemizes tax income, operating costs, district policies, debt service, and monthly balance instead of exposing only one treasury total.
- Players can issue up to three amortized ten-year municipal bonds at amount-specific interest rates, receive the infrastructure cash immediately, watch monthly principal fall, make extra $1 million repayments, and reverse financing choices through shared history.
- Lower Manhattan, Midtown, and Upper Manhattan support persistent recycling, school boost, heavy traffic ban, and small-business grant policies. Each has a visible monthly cost and local effect on wellbeing, land value, commercial growth, or freight access.
- Every developed parcel has a 0 to 100 land-value score from utilities, services, park access, road noise and congestion, zoning, tax pressure, and district policy. A dedicated planning view makes the result spatially legible.
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
- Every named resident has two persistent traits chosen from Outgoing, Homebody, Active, Creative, Organized, and Empathetic, plus a five-axis personality matrix for Cleanliness, Spontaneity, Sociability, Emotional intensity, and Activity.
- The household creator exposes all five axes as continuous 0 to 100 sliders with immediate profile feedback. Resident cards show the saved spectrum and role fit instead of reducing personality to a hidden modifier.
- The matrix shapes autonomous socializing, study, relaxation, self-care, plant care, idle behavior, compatibility, and career fit. Traits remain readable identity anchors while continuous axes create meaningful variation between residents who share a trait.
- Autonomous social choices rank available household members by relationship score, personality compatibility, and social need. The selected partner receives the matching action instead of appearing to socialize independently.
- Compatibility changes relationship growth, and both autonomous and directed conversations use the same paired action and relationship systems.
- Directed conversations offer Friendly Chat, Offer Support, Tell a Joke, and Confront. Each intent has its own duration, need effects, trait-sensitive relationship result, 3D feedback color, and persistent recent outcome.
- Confrontations add persistent relationship tension and conflict history. Apologies reduce tension, can mark a conflict repaired, and enter a bounded eight-memory relationship history with the initiating resident and outcome.
- Empathetic residents notice unresolved tension during autonomous partner ranking and can choose to make amends without direct player control.
- Repeated remembered outcomes form resident-specific social preferences. Positive chats, support, or jokes become familiar autonomous choices, difficult interactions become visible avoidances, and the Home Simulator resident card explains both the current preference and its evidence count.
- Repeated meals, sleep, relaxation, study, self-care, social time, plant care, and quiet breaks build a separate bounded activity preference from actual need gains, pastime matches, and owned-object use. Satisfying repeats raise future autonomy weight, unpleasant outcomes create visible avoidance, and each resident card explains the learned pattern.
- Every furniture object supports persistent classic, modern, and soft-edge design variants plus a safe custom color picker. Geometry and materials update immediately in the seamless home view without changing interaction behavior or charging the household twice.
- Named residents can move between built homes from their resident card. The move conserves household funds, preserves identity, career and skill progress, inventory, wardrobe, learned routines, and life milestones, safely closes old-home relationships and ownership, and records the new household chapter.
- Family moves expand a selected caregiver through linked dependents and co-caregivers, then move the complete unit atomically. Destination capacity and local care remain valid, proportional funds and resident collections follow the group, internal relationship history survives, old physical furniture is released, and every resident records the shared household chapter.
- Household actions build persistent Communication, Creativity, Wellness, or Practical skill points according to what the resident actually did. Office, service, and student roles gain relevant practice and career experience after each completed work or school day, progress through ten levels, and expose their title, strongest skill, and next-level progress in Home Simulator.
- Office and service career levels determine daily wages. Every household settles resident living costs, room maintenance, furnishing upkeep, and utility inefficiency once per day into a persistent household balance that stays separate from the build-mode design budget. The last income, expenses, and net result remain inspectable, while serious debt becomes a resident wellbeing pressure.
- Residents now move through Infant, Toddler, Child, Teen, Young Adult, Adult, and Elder stages on deterministic daily clocks. Each transition updates school, work, home, or mentor roles without replacing the resident or losing personality, skills, relationships, memories, or household position.
- Dependents can name up to two adult caregivers. New generations inherit a bounded blend of caregiver personality tendencies, begin with strong family relationships, retain an explicit generation number, and migrate safely from older saves that only stored adult or child.
- Family Legacy, Master a Craft, Community Pillar, Household Prosperity, and Creative Life aspirations progress from matching actions, promotions, positive household finances, life-stage milestones, and elder mentorship. Aspiration progress contributes visibly to resident wellbeing and persists with the shared world.
- Civic Planning, Enterprise, Hospitality, Care Services, and Creative Practice careers each define role, skill pair, wage curve, personality fit, and two specializations. Level-four residents choose a deterministic branch while their title, daily wage, skill growth, aspiration progress, and retirement remain stage-aware.
- Working-age residents retain a physical destination lot and complete one of three track-specific tasks per simulated workday. Personality fit, practiced skills, workplace-sector fit, and commute burden produce a bounded performance result with persistent shift history.
- Home Simulator exposes each resident's workplace, latest task, performance, and completed shifts. City Builder parcel inspection shows the named assigned roster and current attendance, while City Explorer recognizes nearby active workplaces and reports who is working on what.
- Every active workplace derives open businesses, on-shift coworkers, hourly customer demand, customers present, and service pressure from its sector, operating schedule, nearby population, transit access, congestion, and city events. Builder and Explorer render bounded worker and customer groups at the real parcel frontage, while all three scales explain the same live activity.
- Each occupied business parcel settles daily customer-backed revenue, payroll, operating costs, profit, and a persistent reserve. Sustained losses weaken future occupancy, and five loss days with no reserve deterministically close one establishment. City economy summaries and parcel inspection expose the same ledger and viability state.
- Each resident retains up to twelve dated life milestones for joining a household, entering a life stage, choosing a career branch, earning a promotion, fulfilling an aspiration, or adding a personal collection item. Home Simulator shows the three latest chapters, while Explorer and parcel context surface the newest event without creating an unbounded history.
- Residents author a favorite Natural, Light, Dark, or Colorful home style plus Reading, Gardening, Cooking, Social Time, or Quiet Comfort as a favorite pastime. Pastimes and owned personal items bias the same autonomous action scoring used by needs, traits, personality, schedules, and social memory.
- Residents also retain one of five outfit silhouettes and five coordinated palettes. The creator previews both, every Home card doubles as a live wardrobe, age-scaled 3D residents wear the saved choice, and named workers remain visually recognizable at their city workplace.
- Residents retain one of five editable daily rhythms. Early bird, steady, night owl, split shift, and flexible profiles generate recurring weekday and weekend work, school, outing, and sleep windows used by home autonomy, workplace attendance, career progress, and household wages.
- Households can invite guests to a shared dinner, game night, birthday celebration, or open house. Plans reserve household funds, reject schedule conflicts, retain a bounded history, activate visible visitors in the actual home, appear in Explorer context, and settle attendance into resident needs, relationship growth, host skill, and matching aspirations.
- Household funds can buy one of five unique personal collection items for each resident. These bounded inventories survive migration, improve a related skill, can advance a matching aspiration, and increase the resident's visible belonging satisfaction without consuming the separate home-design budget.
- Every furnishing can remain shared or belong to a named resident. Autonomous actions prefer owned objects of the required type, preferred style matches improve belonging, invalid owner links are removed during migration, and ownership follows the object through movement, rotation, floors, saves, and Undo or Redo.
- Household funds can buy meal delivery, creative supplies, or wellness care for a selected resident. Each purchase has distinct bounded need and skill effects, remains separate from design funds, records lifetime extra spending plus the latest purchase, participates in Undo and Redo, and refuses unaffordable transactions cleanly.
- Beds, tables, sofas, plants, desks, bookcases, fridges, and showers have functional simulation roles. Resident placement and poses in Home Simulator follow the active action and its target object.
- Homes can grow from one to four persistent stories. Each floor owns its rooms and furnishings, floor shells and stairs use the design budget, residents remember their current level, the editor isolates the active floor, and City Explorer uses nearby stairs to move through the same saved structure.
- Action scoring includes duration, need pressure, context, and a recency penalty so residents respond to their condition without repeating one activity forever.
- Active household activity, remaining time, completion history, and resulting need changes are visible in Home Simulator, City Explorer, and the City Builder parcel inspector.
- In-progress actions, targets, partners, timing, and completed-action counts persist through save and reload.
- `npm run test:stability` advances a fixed serviced NYC reference city for ten years in 14,400 six-hour steps, then repeats the full decade and requires an identical deterministic signature.
- The gate checks calendar and budget boundaries, resident needs, household and business cohorts, physical workplace references, task-track validity, work performance, bounded life-story histories, commute references, service and utility state, incident backlogs, save growth, finite numbers, and bounded population change.
- The verified baseline ends at 29,090 residents, 1,576 businesses, 74% city wellbeing, an 85% staffed service network, and a positive $2.26 million monthly balance.
- Across the baseline decade, 10,799 of 10,800 emergency incidents and 7,199 of 7,200 utility failures resolve before the cutoff. The remaining incident and failure are active events generated immediately before the final timestamp.
- The stability work removed redundant citywide population and staffing calculations from every lot-service evaluation, keeping the long-run gate practical while preserving the simulation result.

The automated Milestone 1 stability gate is complete. Qualitative diagnosis playtesting continues as work moves into Milestone 2.

## Milestone 2: The explorable city

Goal: turn the simulation into a place players want to inhabit.

- Walking, driving, transit riding, interiors for selected building classes
- Traffic signals, parking, sidewalks, crossings, and accessibility
- Deterministic weather, seasons, day/night, lighting, scale-aware rain and snow, and opt-in procedural soundscapes with localized event, vehicle, transit, and emergency cues are live
- Named districts, roads, landmarks, businesses, and civic events
- Photo mode is live with location and weather metadata, adjustable lens, world-label cleanup, and a one-key clean capture view; guided city tours remain ahead

Exit gate: players can navigate across town without developer tools and can recognize districts from street-level character alone.

Current vertical slice:

- Every existing or player-drawn road spline generates a layered curb, continuous sidewalk, roadway, true-intersection junction surface, and dashed center marking. Road layers use distinct elevations and intersection caps instead of overlapping a disc at every curve point.
- The City Builder planning view uses a clean visual level of detail without dense crosswalk, signal, facade-window, or building-shadow aliasing. City Explorer restores those human-scale details at street level.
- Every city date produces deterministic clear, cloudy, rainy, or snowy weather with seasonal temperatures, wind, visibility, sky, fog, surface, water, and landscape changes. Builder uses a sparse regional precipitation field, Explorer restores street-scale flakes or rain streaks, and Home Simulator keeps the build surface unobstructed while preserving the shared conditions readout.
- Procedural soundscapes are opt-in and generated locally in the browser. Builder uses a quiet regional mix, Explorer responds to traffic and wind at street scale, Home Simulator uses a sheltered interior tone, precipitation adds its own texture, and nighttime reduces urban activity. Event crowds, nearby vehicles, transit, and emergency response add distance-aware procedural layers, while the sound control names the strongest current cue.
- City Builder can switch the shared world into traffic, utilities, wellbeing, and development evidence views. Road pressure follows representative commute routes, road class, live events, and closures; parcel views expose service reliability, human outcomes, and construction progress without creating a separate simulation.
- City Explorer finds a clear sidewalk near the selected lot or active street activity instead of dropping the player on a roadway or inside a building.
- Walking now uses acceleration and deceleration, realistic walk and sprint speeds, head movement, sprint field of view, and a grounded jump.
- Collision checks keep the player inside land boundaries, stop movement through oriented building footprints and municipal facilities, and preserve wall sliding where one movement axis remains clear.
- The street-level HUD reports the nearest named road, current sidewalk, roadway, frontage, park, or block surface, and standing, walking, sprinting, airborne, or blocked state.
- Pressing `O` enters Explorer photo mode from walking, driving, transit, or an interior. The mode suppresses planning and world labels, retains a compact place/time/weather card, adjusts the lens from 28° to 75° with bracket keys, and lets `H` remove the last overlay for a clean capture without interrupting the living simulation.
- Pointer-lock failure is handled without a runtime error, and clicking the city view retries mouse capture.
- Road crossings are generated from actual spline intersections, with zebra markings, curb-ramp pads, and signal poles on both street axes.
- Every road now owns a persistent editable profile for class, one to eight travel lanes, 20 to 80 km/h speed policy, 1.5m to 6m sidewalks, protected bike lanes, bus-priority lanes, medians, curb parking, and street trees.
- New roads show width, modeled vehicles-per-hour capacity, mobility tradeoffs, and live construction cost before commitment. Existing named roads can be selected and retrofitted for a separately priced, undoable treasury cost.
- Road drawing can snap exactly to existing network endpoints within 12 meters, lock a segment to a 15-degree bearing, continue the tangent of a curved-road endpoint, or align parallel to the nearest road segment. The live guide reports length, bearing, alignment target, and joined road, while duplicate points, Backspace revision, and Escape cancellation keep freeform drafting recoverable.
- Roads can be authored or retrofitted as surface streets, bridge decks from 4m to 16m, or tunnels from -4m to -16m. Structure-aware construction costs, bridge piers, tunnel portals, raised roadway materials, safe migration, and transit or commute vehicle height make the choice visible and persistent.
- Road capacity and whole-network congestion use the authored cross-section instead of class alone. Default migrated streets preserve the established reference-city traffic behavior.
- Builder and Explorer geometry now derives from the same saved profile: variable curb and sidewalk widths, lane dividers, protected cycling and bus bands, planted medians, curb-parking markings, and batched roadside trees.
- Older cities deterministically receive class-appropriate profiles, while save recovery preserves exact custom profiles, road class, width, capacity, and treasury effects.
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
- Every event binds to its source street, closes one to three nearby roads while active, blocks new player-vehicle entry, and adds delay only to commute routes that intersect the closure. Visible closure overlays and barriers expose the same operational state in Builder and Explorer.
- Event attendance adds deterministic traffic pressure to the same congestion model used by commuters, emergency response, utility repair, and household commute burden.
- Transit stops near active events receive added passenger demand based on attendance, event type, distance, frequency, fare, and accessibility. Event-driven riders contribute to queues, boardings, crowding, and fare revenue.
- The nearest saved transit line receives four- or six-minute temporary service during an active event. Effective headway changes waiting time, demand, crowding, the scheduled 3D fleet, and both Builder and Explorer guidance without overwriting the player's normal service plan.
- Active events render a named venue, crowd, event radius, operations-panel status, and Explorer context for drivers, pedestrians, and nearby transit stops.
- Monthly event fees and operating costs join the municipal budget, while completed occurrences retain cumulative attendance and revenue without creating unbounded event-history objects.
- The pedestrian graph follows both sides of every sampled road, connects corners, and crosses roadways only at detected intersections with paired curb ramps.
- Developed homes and businesses, parks, and transit stops receive persistent street-facing entrances with step-free state, clear width, tactile guidance, and automatic-door state.
- City Builder's accessibility tool distinguishes universal, usable, and blocked entrances and funds complete upgrades for homes and shops, parks, or transit stops.
- Pressing `R` in City Explorer cycles the nearest home, business, park, transit stop, and available parking destination. `Shift+R` hides the route.
- Complete-trip wayfinding reports connected sidewalk distance, ramped-crossing counts, final-entrance usability, and any remaining barrier instead of stopping its analysis at the curb.
- Home Simulator and the parcel inspector expose the same entrance condition used by street-level routing.
- City Explorer can enter a furnished home from its actual lot entrance with `F`. A stepped approach or doorway narrower than 0.9m blocks entry until City Builder funds the access upgrade.
- Entered homes use the persistent Home Simulator floor plan. Exterior openings and doorways between adjacent rooms are generated per floor, while saved stair links provide explicit vertical navigation.
- First-person interior movement stays inside room walls, slides along obstructions, collides with sofas, tables, beds, and plants, and reports the current room.
- Household members who are home remain visible at their active furniture targets, while the interior panel reports live actions, utility disruptions, and entrance quality.
- Home Simulator rejects furniture placed outside every room, and the Explorer regression gate verifies entry access, lot transforms, room transitions, wall containment, and furniture collision.
- Inspect mode selects either a furnishing or the room beneath it. Selected rooms expose persistent floor and wall finish palettes with surface-based pricing, visible budget impact, a protected final-room rule, automatic sale of exclusive furnishings, and a 25% structure refund on deletion.
- Every home now owns a persistent design budget. Room construction is priced by area, the furnishing catalog exposes item prices, purchases provide exact insufficient-funds feedback, and older saves receive safe budget defaults.
- Selected rooms can be assigned as Living Room, Bedroom, Kitchen, Bathroom, Study, Dining Room, Nursery, or Studio without changing their geometry or budget. The semantic purpose persists beside floor and wall finishes and prepares the plan for room-aware behavior.
- Home quality now measures five functional needs plus whether objects suit their room purpose. Bedrooms reward beds, Bathrooms showers, Kitchens fridges and tables, Studies desks and bookcases, and Living Rooms sofas, while mismatched placement remains legal for flexible builds.
- Furnish Room creates a deterministic starter set for the selected room purpose. It keeps valid existing objects, searches collision-safe positions and rotations, respects remaining design funds, commits the result as one undoable change, and clearly reports partial placement.
- Inspect mode selects a furnishing directly in the 3D home with a gold outline. The contextual toolbar can rotate it in 45-degree steps or sell it for a visible 50 percent refund, with selection, spending, and controls kept in sync after undo and redraw.
- Owned furniture can be moved without repurchase. Green and red footprint previews expose valid placement before committing, while rotated-corner and oriented-overlap checks prevent objects from crossing walls, stacking together, or rotating into an invalid layout.
- Selected furniture can switch between Natural, Light, Dark, and Colorful visual schemes without affecting the design budget. The contextual style control stays disabled until an object is selected, and older saves migrate to Natural.
- Selected furniture can be shared or assigned to any household member. Resident cards expose favorite pastime, decor preference, personal collection, owned furnishing count, and the resulting belonging satisfaction, while older saves receive deterministic preferences and no dangling owners.
- Home Advisor ranks up to three household wants from the current residents, layout, furniture, relationships, and finances. Actionable wants open the resident creator, room drawing, or exact catalog object instead of leaving the player to hunt through controls.
- Home Simulator resident cards distinguish who is home, away, or commuting. An available resident can be taken directly into first-person control when the entrance is usable.
- The household creator replaces one-click random residents with an authored name, seven life stages, career direction, aspiration, daily role, up to two caregivers, optional personality inheritance, exactly two identity traits, and five continuous personality axes. It previews the complete profile, automatically assigns dependent roles, prevents duplicate or unsafe names, and supports up to eight named residents per home.
- Pressing `C` inside cycles at-home residents and observer mode. Controlled resident positions persist with the home and their avatar does not duplicate the first-person player.
- Pressing `E` near a furnishing directs the controlled resident to sleep, eat, relax, tend plants, study, read, or shower. These actions use the existing durations, completion history, skills, and need effects rather than a separate interaction system.
- Pressing `E` near another household member opens a five-choice conversation menu. Keys `1` through `5` select Friendly Chat, Offer Support, Tell a Joke, Confront, or Apologize, while `Q`, `E`, or walking closes the menu.
- Both residents receive intent-specific social, calm, or stress effects. Friendly, supportive, and humorous choices can improve the shared relationship, while Confront deliberately risks relationship loss.
- Home Simulator shows every household relationship, its current label, score, tension state, conflict and repair counts, completed conversation count, most recent outcome, and three newest social memories. Resident cards identify each person's strongest connection.
- Conversation intent, state, partner references, relationship tension, bounded social memories, conflict and reconciliation history, recent outcomes, and relationship scores survive save and reload. Older saves generate deterministic relationship pairs for existing household members and normalize generic active conversations to Friendly Chat.
- Personality traits and all five matrix axes survive save and reload. Older residents receive two deterministic traits and a trait-informed deterministic matrix, while new residents receive exact authored values at creation.
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
- Transit operations supports up to eight road-following lines. Clicking a road creates or selects its line, the line selector changes the active route, and each route keeps independent frequency, fare, stop count, ridership, revenue, and color state.
- Players can give each line a unique 32-character identity. Stops within 55 meters of another route become transfer hubs automatically, receive a gold network ring, list their connecting lines, add transfer demand, and expose the same connection in Builder operations and Explorer stop guidance.
- Stop-count editing rebuilds four to ten evenly distributed curbside stops and their accessibility entrances. Removing a selected line preserves the rest of the network, while at least one route remains available.
- Scheduled 3D fleets render across every active line instead of only the first route.
- `npm run test:explorer` verifies road lookup, normalized planning-view road pressure, prioritized City Advisor recommendations and healthy-city fallback, closure severity, safe sidewalk entry, collisions, intersection and signal behavior, red-light stopping, green-light movement, directional lane separation, scale-aware soundscape profiles, weather and night audio response, parking capacity, pricing, demand response, turnover, revenue, persistence, price-aware selection, timed curb rules, legal-parking changes, loading demand, deliveries, curb enforcement and revenue, named event scheduling and recurrence, attendance, event-controlled curbs, traffic pressure, event transit demand, event finance and persistence, ramp-aware pedestrian routing, entrance generation, destination categories, complete-trip barrier reporting, funded upgrades, interior entry access, room doorways, rotated lot transforms, wall and furniture collision, all eight catalog objects, exact catalog debits, study and shower skill gains, home purchase debits, collision rejection, cost-free furniture moves, wall-safe 45-degree object rotation, half-cost selling, room finish costs and persistence, duplicate finish charge protection, final-room protection, room-removal furniture cleanup and refunds, over-budget rejection, design-budget persistence, authored resident profiles, exact personality matrices, invalid-axis rejection, deterministic legacy migration, matrix-weighted autonomy, compatibility and career fit, duplicate and unsafe name rejection, seven-stage role normalization, caregiver lineage, personality inheritance, aging transitions, aspiration progress, career branching, physical workplace assignment, career task validity, performance persistence, legacy workplace migration, decor and pastime preferences, inventory purchases, duplicate protection, object ownership, belonging feedback, direct resident selection, persistent home positions, nearby object selection, directed action completion, personality persistence, compatibility ranking, all five conversation intents and their need effects, conflict tension, apology repair, bounded social memories, autonomous reconciliation, persistent recent outcomes, paired autonomous conversations, shared need effects, transit generation, bidirectional fleets, unique line naming, transfer detection, connected-demand gain, frequency, fare demand, waiting time, ridership, revenue, boarding, stop requests, and alighting.

Next systems are more detailed road-grade editing and metropolitan instancing built on the current simulation and render streams.

`npm run test:explorer` also verifies empty-home onboarding, pressured-household priorities, and the absence of invented wants in a fully supported healthy household.

Room-purpose regression coverage verifies cost-free editing, redundant-change rejection, and snapshot persistence alongside the existing finish and room-removal tests.

Functional-room regression coverage verifies full sleep, meal, hygiene, relaxation, and study completeness, 100% purpose alignment, mismatch detection, and the resulting home-quality difference.

One-click furnishing regression coverage verifies exact Living Room cost, correct catalog contents, purpose fit, wall and overlap safety, repeat idempotence, and budget-constrained rejection.

History regression coverage verifies edit capture, exact Undo, exact Redo, availability state, and redo-branch invalidation after a new edit.

Household-purchase regression coverage verifies exact fund debits, design-budget separation, meal, creativity, wellness, and calm effects, skill progress, spending-history persistence, and unaffordable-purchase rejection.

## Milestone 3: Metropolitan scale

Goal: support very large cities without sacrificing responsive play.

- World divided into streamable spatial chunks
- GPU instancing, occlusion, impostors, and geometry level of detail
- Simulation level of detail: agents nearby, statistical cohorts far away
- Hierarchical pathfinding across local road graphs and regional corridors
- Background simulation workers and fixed deterministic ticks
- Regional rail, highways, ports, airports, freight, and neighboring cities

Exit gate: a one-million-person region maintains target frame and simulation rates on the minimum supported machine.

Current foundation:

- The world is deterministically partitioned into persistent 256-meter spatial chunks. Every lot belongs to exactly one chunk, road segments register with every chunk they cross, and chunk aggregates retain households, businesses, population, and jobs.
- Each chunk resolves to agent, active, or aggregate detail from the current Builder focus, Explorer position, or Home lot. The live HUD reports active-detail residents and aggregate chunk counts.
- The renderer consumes an explicit deterministic stream plan at every scale. Agent chunks keep full lots, street details, and building windows; active chunks retain real parcel shells; aggregate chunks replace individual buildings with population and job-weighted low-poly massing. Selected neighborhoods are promoted so direct editing never targets an impostor.
- Completed City Builder building shells use one GPU-instanced batch with per-instance transforms and colors. Parcel planes remain individually selectable, construction sites remain explicit, and Explorer plus Home retain human-scale geometry.
- Chunk size and metadata persist in snapshots. Older saves rebuild valid metadata from their existing roads and lots, while the stability gate verifies unique membership, references, and population reconciliation.
- `npm run test:explorer` verifies the eight-chunk NYC reference, exact lot membership, aggregate population equality, focus-to-distance tier changes, lossless render-plan partitioning, distant massing inputs, and snapshot persistence.
- The same regression gate verifies Chicago identity, exact grid and water features, developable-road parcel rules, four-way zoning mix, road-profile hierarchy, local transit, parking, event, deterministic climate, and save restoration.
- Houston regression coverage verifies freeway and frontage-road access rules, large parcels, flexible zoning, three flood-exposure states, land-value pressure, bayous, transit, parking, event identity, warm deterministic climate, and legacy terrain restoration.
- Seattle regression coverage verifies constrained water geometry, no-frontage freeways and bridges, transit and bicycle priority, three slope states, terrain land-value pressure, urban-village zoning, regional transit and events, cool deterministic climate, and legacy terrain restoration.
- Portland regression coverage verifies two-river geometry, bridge corridors, compact parcels, freeway and greenway access rules, inside and outside growth-boundary states, boundary land-value pressure, neighborhood zoning, regional transit and events, rainy deterministic climate, and legacy terrain restoration.

Next scale systems are instanced facade and prop batches, occlusion, hierarchical inter-chunk pathfinding, deterministic background workers, and real million-population performance budgets.

## Milestone 4: Players jump in

Goal: make invitations frictionless while protecting the host’s city.

- Join links and guest streaming around a host-selected spawn
- Host, planner, builder, resident, and visitor permissions
- Cooperative construction proposals with preview and approval
- Synchronized vehicles, avatars, weather, and construction events
- Versioned server-authoritative saves and recovery snapshots
- Moderation, reporting, rate limits, and private-city controls

Exit gate: four players can build and explore for an hour through a join link without save divergence.

## Golden quality targets

These are the highest-value next slices for reaching the clarity of Cities: Skylines and the intimacy of The Sims or Paralives without losing the shared Gridless world.

### P0: Roads that feel authored

- [Complete] Exact endpoint snapping, optional 15-degree angle locking, tangent continuation, parallel alignment, live target, length, and bearing feedback, duplicate protection, Backspace revision, and Escape cancellation are live without a tile grid.
- [Complete] Support lane count, medians, bike lanes, bus lanes, sidewalks, trees, parking, and speed policy as editable persistent road profiles.
- [In progress] Surface, bridge, and tunnel levels, costs, supports, portals, retrofits, and migration are live; per-point elevation handles, slope validation, roundabouts, and safe intersection rebuilding remain ahead.
- [In progress] Live pre-build impact cards report construction cost, new frontage, network crossings and connections, parcel clearance, water exposure, accessibility, and funding, while commit-time guards reject parcel conflicts and surface roads through water; explicit demolition choices and traffic forecasts remain ahead.

Exit gate: a player can reproduce a recognizable real neighborhood street pattern, then walk and drive every edited junction without visual seams or route breaks.

### P0: A complete home shell

- [Complete] Rooms and furnishings retain bounded persistent condition, age through occupancy and object use, visibly fade in 3D, influence home quality and resident satisfaction, and can be repaired or renovated from household funds.
- [In progress] Foundations, floor levels, walls, automatic interior and exterior doorways, stairs, procedural exterior windows, cutaway roofs, privacy glazing, and bounded daylight consequences are live; manual wall, doorway, window, and roof editing remains ahead.
- Add copy, multi-select, eyedropper, room duplication, search, favorites, recolors, and object variants.
- Preserve valid traversal, furniture clearance, daylight, privacy, accessibility, and construction cost through every edit.

Exit gate: a player can build a distinctive two-story home, furnish it efficiently, and traverse every finished space from its actual city entrance.

### P0: Lives with continuity

- [Complete] Add favorite home styles and pastimes, bounded personal collections, resident-owned furnishings, preferred-object autonomy, and belonging feedback.
- [Complete] Add persistent outfit silhouettes and palettes, creator and live wardrobe controls, age-scaled 3D presentation, and safe migration.
- [Complete] Five persistent resident rhythm profiles drive weekday, weekend, work, school, outing, and sleep timing across all three scales, while bounded outcome memories create explainable preferred and avoided routines that shape autonomy.
- [Complete] Add bounded dated life milestones for household arrivals, birthdays, career branches, promotions, fulfilled aspirations, and personal collections, with safe migration and cross-scale presentation.
- [Complete] Add seven life stages, caregiver lineage, generational personality inheritance, long-term aspirations, and persistent continuity through aging.
- [Complete] Expand career progression into five skill-linked tracks with deterministic specialization branches, wages, personality fit, and aspiration feedback.
- [Complete] Career branches use physical city workplaces, named rosters, active attendance, track-specific tasks, performance history, visible coworker and customer agents, live service pressure, and persistent customer-backed business ledgers across all three scales.
- [Complete] Add persistent invitations, four gathering types, visible visitors, schedule conflicts, celebration outcomes, and cross-scale context.
- [Complete] Derive lasting relationship-specific Warmth, Loyalty, Wariness, and Resentment from bounded social memories, then use those impressions in autonomous partner choice and future conversation outcomes.
- [In progress] Directed and autonomous childcare, linked-dependent need recovery, caregiver skill growth, family-bond memories, and individual household moves are live; whole-household splits remain ahead.

Exit gate: one household can be followed for a full in-game year with understandable goals, meaningful choices, and no continuity loss between home and city.

### P1: A city with visual identity

- Build region-aware architectural kits, procedural facades, storefronts, street furniture, landscaping, terrain, shoreline, and seasonal material variation.
- Regional architectural kits are live for NYC, Chicago, Houston, Seattle, and Portland. Deterministic parcel massing now varies footprint, height, facade and trim palette, podium proportion, and roof language by foundation while retaining one instanced city mesh; nearby Explorer buildings add their regional cornices, crowns, mechanical caps, pitched roofs, or green roofs at street scale.
- Give districts readable design rules without forcing identical buildings or sacrificing player overrides.
- Keep Builder colors diagnostic, Explorer materials grounded, and Home details warm and tactile.

Environmental health is now calculated per parcel from live road pressure and speed, nearby industry and municipal processing, plus park and street-tree buffers. The Pollution view separates air quality, noise, and ground pollution, while parcel inspection names sources and mitigation from recycling or heavy-traffic policy.

Exit gate: screenshots from five districts are immediately distinguishable at skyline, street, and room scales.

### P1: Metropolitan performance

- Move buildings and repeated props to instanced batches, add occlusion and impostors, and stream chunk assets independently from simulation state.
- Move deterministic background ticks and path queries into workers with fixed budgets and profiling overlays.
- Establish minimum-machine budgets for frame time, memory, save size, loading, and simulation tick duration.

Exit gate: the one-million-person reference region meets its published budgets for a continuous 30-minute Builder and Explorer session.

### P1: Regional foundations

- [Complete] Add Chicago as a data-driven terrain, climate, street-hierarchy, transit, zoning, parking, and event profile.
- [Complete] Add Houston as a data-driven terrain, climate, floodplain, street-hierarchy, transit, zoning, parking, and event profile.
- [Complete] Add Seattle as a data-driven water-constraint, climate, slope, bridge, street-hierarchy, transit, zoning, parking, and event profile.
- [Complete] Add Portland as a data-driven river, climate, growth-boundary, bridge, street-hierarchy, bicycle, transit-priority, zoning, parking, and event profile.
- Add region-specific architecture and economy modifiers plus modeled ferries, elevated rail, and light-rail vehicles to the five live foundations.
- Keep every foundation flexible: players can erase, extend, remix, or combine regional rules.

Exit gate: each foundation creates a recognizably different planning problem while using the same tested world systems and save format.

### P2: Shared cities

- Make the current command history the basis for proposals, permissions, replay, conflict resolution, and authoritative multiplayer saves.
- Let guests enter as planners, builders, residents, or visitors through a link with explicit privacy and moderation controls.

Exit gate: four players can build, travel, and inhabit one city for an hour with deterministic recovery and no divergent world state.

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
