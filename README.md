# Gridless

A browser-first, realistic 3D city builder where city-scale planning and street-level exploration happen in the same world.

The experience operates at three connected scales: **City Builder → City Explorer → Home Simulator**. The city, streets, lots, homes, objects, and residents belong to one persistent world rather than separate game modes.

The default region uses a flexible New York City foundation. Chicago adds a lakefront grid and river branches. Houston adds bayous, floodplains, freeway loops, and large parcels. Seattle adds sound and lake constraints, bridges, and mapped hills. Portland adds compact blocks, two rivers, bicycle greenways, neighborhood centers, and an urban growth boundary. These are construction aids rather than locked maps. Players can modify every road or start from a blank region.

## Run the prototype

```bash
npm install
npm run dev
```

Run the deterministic ten-year simulation gate:

```bash
npm run test:stability
```

The current vertical slice proves:

- A navigable 3D city at realistic human and urban scales
- Freeform road placement without a tile grid
- Curved road splines, intersections, generated lots, 40-step Undo and Redo history, manual browser saves, and crash-safe autosave recovery
- Editable NYC, Chicago, Houston, Seattle, and Portland regional foundations with distinct geometry, street hierarchy, zoning, transit, parking, events, climate, districts, parks, waterfront, floodplain, steep-terrain, and growth-boundary constraints, plus a blank-region alternative
- A persistent road designer for local streets, avenues, and arterials with one to eight travel lanes, speed limits, variable sidewalks, protected cycling, bus priority, medians, curb parking, and street trees
- Optional exact endpoint, 15-degree, tangent, and parallel road drawing guides with live segment length, bearing, target feedback, duplicate-point protection, point removal, and draft canceling without introducing a tile grid
- Persistent surface, bridge, and tunnel construction with safe 4m to 16m levels, structure-aware costs, bridge supports, tunnel portals, immediate 3D previews, retrofits, and legacy migration
- Profile-aware road construction and retrofit costs, treasury checks, capacity and congestion consequences, live previews, exact Undo and Redo, and deterministic legacy-save migration
- Clean profile-driven street geometry with distinct lane markings, bike and bus bands, planted medians, variable sidewalk edges, and instanced street trees in both Builder and Explorer
- A city-economy workspace with separate residential, commercial, and industrial tax rates, immediate revenue and demand feedback, district policy operations, and undoable ten-year municipal bonds
- Named-district recycling, school support, heavy-traffic bans, and small-business grants with explicit recurring costs plus local wellbeing, land-value, commercial-capacity, and freight-access effects
- A live land-value planning view derived from utilities, neighborhood services, parks, road speed and traffic noise, zoning, tax pressure, and district policy
- A regional Environment view with visible floodplains, moderate and steep terrain, an urban growth boundary, parcel exposure counts, editable constraint-bearing development, and explicit land-value pressure
- A local environmental-health model and Pollution view combining live traffic, road speed, industry, waste, sewage, air quality, noise, and ground pollution with visible mitigation from parks, street trees, recycling, and heavy-traffic policy
- Neighborhood Voices that translate live district utilities, wellbeing, traffic, land value, park access, environmental exposure, jobs, outages, and policies into prioritized resident feedback with one-click district focus and evidence views
- Parcel inspection and residential, commercial, mixed-use, industrial, and civic zoning
- Independent low, medium, and high zoning intensity for every non-grid parcel, with ordered household and business capacity plus matching regional building height and footprint changes
- Legible vertical mixed use with intensity-aware commercial podium floors, residential floors above, separate lobby and storefront access, a batched Builder podium, and street-level Explorer glazing and canopies
- A prioritized City Advisor that explains the strongest current pressure and opens the matching build tool or diagnostic view for roads, services, staffing, outages, budget, congestion, wellbeing, or growth
- Persistent power, water, fire, health, and school facilities with coverage radii, operating costs, municipal balance, and demand feedback
- Deterministic saved calendar with pause/speed controls plus drawable power, water, and sewage networks
- Sewage treatment and waste-transfer facilities with network-aware parcel coverage
- Service-capacity and staffing tradeoffs, staged building construction, and drawable waste-collection routes
- Deterministic fire and medical incidents with unresolved alerts, staffing-sensitive street-graph dispatch, routed vehicles, and saved incident state
- Finite capacity on every power, water, sewage, and waste network route
- Daily household moves, business openings, explicit jobs, workforce-limited staffing, and power-dependent service effectiveness
- Persistent household cohorts, business-sector mixes, named neighborhood anchor businesses, and parcel-level growth explanations
- Time-aware household routines, business operating hours, municipal shifts, responder availability, and occupied-building night lighting
- Deterministic region-aware NYC, Chicago, Houston, Seattle, and Portland weather with distinct seasonal temperature, wind, rain, snow, visibility, wet surfaces, landscape color, and scale-aware precipitation across Builder and Explorer
- Opt-in procedural soundscapes generated in the browser, with quiet regional ambience in City Builder, traffic-responsive streets in City Explorer, sheltered room tone in Home Simulator, weather plus day/night transitions, and distance-aware event crowds, vehicles, transit, and emergency response across all three
- Persistent street-graph commutes with named resident workplaces, representative walking and driving groups, visible 3D travelers, congestion, and traffic-sensitive staffing and emergency response
- Persistent resident energy, social, comfort, health, and stress needs shaped by schedules, home design, utilities, neighborhood services, incidents, and commute burden
- Five editable resident rhythms with recurring weekday, weekend, early, late, split-shift, flexible, outing, and sleep windows shared by home autonomy, workplace attendance, career credit, and household wages
- Persistent two-trait resident identities plus editable Cleanliness, Spontaneity, Sociability, Emotional intensity, and Activity axes, with visible personality spectra, matrix-weighted autonomy, compatibility, career fit, and deterministic save migration
- Seven persistent life stages from Infant through Elder with deterministic daily aging, stage-aware school and work roles, caregiver lineage, generation numbers, inherited personality blends, family bonds, and legacy-save migration
- Directed and autonomous childcare that prioritizes linked dependents by need, visibly occupies the caregiver, restores dependent wellbeing, builds caregiver skills and family aspiration, and records supportive family memories
- Bounded resident life stories that remember household arrivals, birthdays, career specializations, promotions, fulfilled aspirations, and personal collections with dated Home Simulator timelines and cross-scale context
- Five long-term aspirations that progress through relationships, skill practice, career success, household prosperity, aging milestones, and elder mentorship
- Five skill-linked career tracks with distinct roles and wages, deterministic specialization branches at level four, personality fit, ten career levels, and stage-aware retirement
- Physical career workplaces with deterministic track-specific daily tasks, sector and commute-aware performance, completed-shift history, persistent assignments, Builder rosters, Explorer street context, and Home Simulator career evidence
- Schedule, sector, nearby population, transit, congestion, and event-aware workplace activity with visible named workers, coworkers, and customers plus parcel-level service pressure
- Persistent daily business ledgers that turn customer demand into revenue, payroll, operating costs, profit, reserves, multi-day loss pressure, deterministic closures, and parcel growth feedback
- Persistent favorite home styles and pastimes, unique five-item personal collections, resident-owned furnishings, preferred-object autonomy, and a visible belonging score that rewards matching personal space
- Persistent resident wardrobes with five silhouettes, five color palettes, creator controls, live Home editing, age-scaled 3D avatars, named-worker continuity in Explorer, and deterministic legacy migration
- Persistent household invitations with four gathering types, bounded guest lists, visible 3D visitors, scheduling conflicts, household costs, relationship and need outcomes, Explorer context, and legacy-safe histories
- Lasting relationship impressions derived from bounded social memories, with readable Warmth, Loyalty, Wariness, and Resentment states that shape partner choice and future conversation outcomes across Home Simulator and City Explorer
- Household and city wellbeing visible across planning, street exploration, and Home Simulator, with local wellbeing feeding back into daily growth
- Degrading utility infrastructure with deterministic local outages, street-routed repair crews, traffic-sensitive restoration, affected-parcel consequences, and persistent recovery state
- Persistent autonomous household actions chosen from resident needs, schedules, available furniture, and who is home, with visible 3D behavior, progress, completed-action history, and direct need effects
- A repeatable ten-year NYC reference-city stability gate with yearly economy and wellbeing checkpoints, bounded incident histories, save-size limits, integrity checks, and a second full run that must produce the same signature
- Region-aware procedural city massing with deterministic local proportions, facade palettes, podiums, cornices, crowns, mechanical caps, pitched roofs, and green roofs for NYC, Chicago, Houston, Seattle, and Portland
- One-key transition between planning and first-person exploration, with continuous spline-generated curbs, sidewalks, road markings, and intersection-aware sidewalk entry
- Scale-aware street rendering: true intersections receive clean layered junction caps, while dense crosswalk, signal, window, and building-shadow detail is reserved for Explorer so the planning view remains legible without depth-fighting artifacts
- Authoritative road build-impact previews with live cost, frontage yield, network connections, crossings, parcel clearance, water exposure, accessibility, funding state, and commit-time protection against parcel or surface-water conflicts
- A focused City Builder command deck with Build, Zones, Services, Mobility, Events, and Views workspaces; each exposes only the relevant tools and settings instead of compressing the entire simulation into one toolbar
- A persistent `?` field guide that explains City Builder, City Explorer, Home Simulator, shared history, saves, and the most important controls without leaving the live world
- A live four-step starter journey that recognizes zoning, municipal service, street exploration, and meaningful home edits, then routes unfinished goals directly to the right scale and tool
- Persistent player-comfort settings for reduced camera and weather motion, higher-contrast interface surfaces, and restoring or hiding the starter journey
- A session activity center that keeps the latest 30 city, travel, household, save, recovery, and warning messages with simulation timestamps, unread state, safe player-name rendering, and clear controls
- A player-editable city name reflected in the HUD and browser title, with validation, templates, saves, recovery, and exact Undo and Redo support
- Player-editable home and household names in Home Simulator with safe validation, saved identity, activity feedback, and exact Undo and Redo support
- Pause-safe Help, Settings, and Resident Creator modals that restore the exact prior simulation speed on every close path, including `Esc` and backdrop dismissal
- Input-safe global shortcuts for manual save, mode switching, pause and resume, Help, Undo, and Redo, while focused text fields retain native typing and text Undo behavior
- Visible save-state feedback for pending recovery writes, protected recovery snapshots, manual saves, manual loads, and recovered worlds
- Live traffic, utilities, wellbeing, and development planning overlays derived from the same roads, commuter routes, service networks, households, and construction state used by the simulation
- Persistent 256-meter spatial chunks with exact road and lot membership, population/job aggregates, focus-driven agent, active, and aggregate tiers, selected-neighborhood promotion, low-poly distant massing, live stream diagnostics, and save migration
- GPU-instanced City Builder building shells with per-building position, scale, rotation, and planning color, while parcel selection, construction sites, Home Simulator, and City Explorer keep their individual interaction geometry
- Grounded first-person acceleration, sprinting, jumping, head movement, shoreline limits, building collision, wall sliding, and a live location, surface, and pace readout
- Explorer photo mode with clean scene composition, automatic world-label suppression, live location/time/weather metadata, adjustable 28° to 75° field of view, and a completely hideable capture HUD
- Detected street intersections with zebra crossings, curb-ramp pads, and deterministic two-direction traffic signals
- Right-hand AI traffic lanes with red-light stopping, green-light movement, visible brake lights, and signal-ahead guidance while driving
- A drivable street-level car with acceleration, braking, reverse, steering, handbrake, road-aware traction, collision, chase camera, and safe sidewalk exit
- A persistent Broadway Local B1 bus line with seven named curbside stops, frequency-driven active fleets, passenger demand, stop queues, crowding, fares, ridership revenue, stop-side Explorer entry, and `T` controls for boarding, requesting the next stop, and alighting
- A player-editable transit network with up to eight road-following lines, line selection, click-to-create routes, independent frequency and fare policies, four to ten regenerated stops, distinct colors, network-wide vehicle rendering, and safe line removal
- Player-authored transit line names plus proximity-derived transfer hubs, gold-ring network visualization, transfer-aware stop demand, Builder connection summaries, and street-level transfer guidance
- Persistent curb bays, surface lots, and structured garages with capacity, occupancy, designated accessible spaces, undo, and browser-save support
- Player-controlled hourly parking prices with time-aware local demand, deterministic turnover, persistent revenue, operating costs, projected monthly net results, and price-aware facility selection
- Programmable curb space with flexible parking, commercial loading, rush-hour restrictions, and evening event control, plus timed schedules, delivery queues, enforcement, fines, and street-level guidance
- Persistent named city events with recurring schedules, attendance, visible crowds, event-controlled curbs, named road closures, route-specific commute delay, closure barriers, temporary service on the nearest transit line, municipal revenue, and Builder-to-Explorer context
- Accessibility-aware sidewalk routing to available parking, including marked crossings, paired curb ramps, visible street-level guidance, and distance reporting
- Persistent street-facing entrances for homes, businesses, parks, and transit stops with step-free access, clear width, tactile guidance, automatic-door state, and saved upgrades
- City-funded accessibility upgrades plus complete-trip Explorer routing that cycles destination types and reports sidewalk, crossing, and final-entrance barriers
- Enterable Home Simulator interiors reached from their actual City Explorer street entrances with `F`, using the same step-free and clear-width access gate as city wayfinding
- Persistent one-to-four-story homes with floor-specific rooms and furnishings, paid floor shells, placeable adjacent-floor stairs, safe top-floor removal, resident floor memory, and `E` stair navigation in City Explorer
- First-person room traversal with the exact player-authored connecting doorways, standard or wide clear widths, immediate traversal consequences, wall containment, furniture collision, warm interior lighting, and room-aware location readouts
- Live whole-home circulation diagnostics with a room-and-stair connectivity graph, unreachable-space warnings, wide-access opening share, a bounded score, and the same evidence in the build toolbar and parcel inspector
- Persistent player-authored gable, hip, flat, and planted roofs with custom color, explicit construction cost, city-specific default migration, cutaway Home Simulator previews, parcel evidence, and the same silhouette visible from City Explorer
- Persistent slab, ventilated crawlspace, and raised-pier foundations with city-specific defaults, explicit construction cost, 0%, 45%, or 85% flood protection, residual-exposure wear consequences, parcel evidence, and matching Home Simulator and Explorer geometry
- Climate-aware home energy performance combining live regional weather, floor area, roof form, foundation, authored glazing, daylight, and occupancy into heating, cooling, lighting, daily kWh, an efficiency score, design benefits, and a real household utility expense
- Persistent resident bedroom and nursery claims with bed-capacity enforcement, one-room-per-resident reassignment, private and shared-room privacy outcomes, home-quality consequences, atomic clearing, move-safe cleanup, restore migration, and room-level assignment controls
- Resident-specific personal-room fit combining claimed purpose, privacy, daylight, condition, decor preference, personal inventory, and owned furnishings into an explained score that influences wellbeing and appears on both room and resident cards
- One-click deterministic smart room assignment that matches every resident against life-stage purpose, physical bed capacity, decor preference, owned belongings, daylight, condition, and privacy, then applies the whole result as one Undo-safe household edit
- Resident-led room personalization that converts every furnishing in a claimed room to the resident's preferred decor, clears conflicting custom tints, records personal ownership, charges one affordable household-funded cost, and improves explained room fit in one Undo-safe action
- Household space planning that measures physical bed, hygiene, work-surface, social-seat, and floor-area capacity against the actual residents, scores the plan, and turns shortfalls into life-stage-aware Home Simulator recommendations
- Whole-home safety and egress auditing that combines ground-floor entry, authored room circulation, stair continuity, sleeping-room escape windows, furniture clearance, and mobility-sensitive residents into a bounded score with exact correction guidance
- Procedural home roofs plus player-authored exterior-wall windows with wall snapping, clear or privacy glazing, placement cost, selection and removal refunds, deterministic room daylight, home-quality consequences, safe legacy-save migration, and the same openings visible in Home Simulator and Explorer
- Selectable Home Simulator rooms with persistent Living Room, Bedroom, Kitchen, Bathroom, Study, Dining Room, Nursery, or Studio purposes; oak, tile, concrete, or carpet floors; warm white, sage, clay, or slate walls; area-based finish costs; protected final-room deletion; automatic furnishing cleanup; and partial refunds
- One-click room duplication that finds the nearest valid adjacent space, preserves purpose, dimensions, finishes, and fitting furnishings, clears personal claims and ownership, charges the exact combined build cost, and treats the entire copy as one Undo-safe edit
- Functional-room scoring across sleep, meals, hygiene, relaxation, and study, with visible room-purpose alignment that rewards sensible layouts without blocking unconventional object placement
- Deterministic one-click starter furnishing for every room purpose, with exact pricing, existing-object recognition, wall and overlap safety, and graceful partial placement when space or design budget is limited
- Builder-wide Redo after Undo through visible controls, `Cmd/Ctrl+Shift+Z`, or `Ctrl+Y`, with exact state restoration and safe branch invalidation after a new edit
- Live household activity and utility-disruption context inside the same persistent furnished home
- Direct household control from resident cards or the interior `C` control, with persistent in-home positions and observer switching
- Proximity-based `E` interactions for sleeping in beds, relaxing on sofas, eating at tables or fridges, tending plants, studying at desks or bookcases, and showering through the same need-changing action system used by autonomous residents
- Proximity conversations between household members with a four-choice intent menu: Friendly Chat, Offer Support, Tell a Joke, or Confront
- Intent-specific paired actions with distinct social, calm, stress, duration, personality, and relationship effects plus a persistent recent-outcome history
- Persistent bounded social memories with tension, conflict counts, repaired-conflict counts, initiator history, and contextual Apologize actions
- Emergent resident social preferences derived from repeated remembered outcomes, with visible preferred and avoided conversation styles plus preference-weighted autonomous choices
- Bounded resident activity preferences learned from repeated need outcomes, favorite pastimes, and owned-object use, with explainable favorite or avoided routines that feed future autonomous choices
- Persistent furniture design variants and a safe full-color tint picker, with classic, modern, and soft-edge geometry rendered directly in the seamless home view
- Persistent room and furnishing condition with occupancy and use-driven wear, visible material fading, household-funded repair and renovation, affordability checks, condition-sensitive home quality, and safe legacy migration
- Resident household moves between built homes, preserving identity, skills, inventory, wardrobe, learned routines, and life history while conserving transferred funds and safely releasing old-home ownership
- Atomic family moves that keep linked caregivers and dependents together, validate destination capacity and care before changing state, transfer a proportional share of funds, and preserve internal relationships, portable collections, and shared life history
- Persistent Communication, Creativity, Wellness, and Practical skills earned through household actions plus ten-level office, service, and student progression advanced by completed work or school days
- Persistent household funds with career-level daily wages, readable living and home-maintenance costs, daily net results, personal-collection spending, save migration, and financial-security feedback into resident wellbeing
- Household-funded meal delivery, creative supplies, and wellness care with immediate need and skill effects, persistent total discretionary spending, last-purchase history, affordability checks, and strict separation from the design budget
- Autonomous reconciliation attempts from empathetic residents when household tension remains unresolved
- Relationship-driven autonomous conversations that choose an available partner from familiarity, personality compatibility, and social need, then reserve both residents for the shared activity
- A live interaction prompt with keyboard intent selection, action effects, remaining duration, controlled-resident identity, and completed-action feedback
- Vehicle parking with low-speed checks, facility capacity, saved position and heading, garage collision, and pedestrian return to the sidewalk
- Persistent home entities and directly controlled resident positions attached to real city lots
- Floor-aware room drawing with area-based construction costs, architectural walls and floors, a persistent $60,000 design budget, a categorized eight-object catalog, persistent Natural, Light, Dark, or Colorful furniture styles, resident ownership, room-contained furniture, green/red placement previews, click selection, cost-free moving, collision-aware 45-degree rotation, half-cost selling, and household residents
- A focused household creator for resident name, seven life stages, career direction, aspiration, favorite home style, pastime, daily role, caregivers, inherited personality, and exactly two behavior-shaping traits, with an eight-person household limit and immediate profile preview
- A contextual Home Advisor that turns resident needs, bed and room capacity, missing functional objects, creative traits, relationship tension, and finances into three prioritized household wants with direct build actions

This is a visual and interaction prototype with local persistence and a deterministic early economic simulation. The current reference scenario passes its automated ten-year stability gate; qualitative diagnosis and fun remain playtest questions.

## Product pillars

1. **Build anywhere:** Roads, parcels, buildings, parks, and utilities conform to terrain and geometry instead of tiles.
2. **A city, not a diorama:** Districts continue beyond the camera through chunk streaming and simulation levels of detail.
3. **Human scale:** Every planning decision can be experienced from the sidewalk.
4. **Believable systems:** Land value, travel time, jobs, housing, utilities, freight, and public services create visible consequences.
5. **Share the same place:** Players can invite others into a hosted city to walk, drive, build together, or simply inhabit it.

See [ROADMAP.md](./ROADMAP.md) for staged delivery.

## Hosting

The production build can run on bigBox in a hardened, loopback-only Docker container and publish through Cloudflare Tunnel without taking ports 80 or 443 from Pi-hole. See [DEPLOY_BIGBOX.md](./DEPLOY_BIGBOX.md).
