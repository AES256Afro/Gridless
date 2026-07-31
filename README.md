# Gridless

A browser-first, realistic 3D city builder where city-scale planning and street-level exploration happen in the same world.

The experience operates at three connected scales: **City Builder → City Explorer → Home Simulator**. The city, streets, lots, homes, objects, and residents belong to one persistent world rather than separate game modes.

The default region uses a flexible New York City foundation: a Manhattan-inspired island, avenues, numbered cross streets, a Broadway diagonal, waterfront, central park, and district structure. It is a construction aid, not a locked map. Players can modify every road or start from a blank region.

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
- NYC-inspired region template with editable street hierarchy, districts, park, waterfront, and blank-region alternative
- Local street, avenue, and arterial construction plus parcel inspection and residential, commercial, mixed-use, industrial, and civic zoning
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
- Deterministic daily NYC weather with seasonal temperature, wind, rain, snow, visibility, wet surfaces, landscape color, and scale-aware precipitation across Builder and Explorer
- Opt-in procedural soundscapes generated in the browser, with quiet regional ambience in City Builder, traffic-responsive streets in City Explorer, sheltered room tone in Home Simulator, and weather plus day/night transitions across all three
- Persistent street-graph commutes with named resident workplaces, representative walking and driving groups, visible 3D travelers, congestion, and traffic-sensitive staffing and emergency response
- Persistent resident energy, social, comfort, health, and stress needs shaped by schedules, home design, utilities, neighborhood services, incidents, and commute burden
- Persistent two-trait resident personalities with visible social style, compatibility, trait-weighted activity choices, and save migration for existing households
- Household and city wellbeing visible across planning, street exploration, and Home Simulator, with local wellbeing feeding back into daily growth
- Degrading utility infrastructure with deterministic local outages, street-routed repair crews, traffic-sensitive restoration, affected-parcel consequences, and persistent recovery state
- Persistent autonomous household actions chosen from resident needs, schedules, available furniture, and who is home, with visible 3D behavior, progress, completed-action history, and direct need effects
- A repeatable ten-year NYC reference-city stability gate with yearly economy and wellbeing checkpoints, bounded incident histories, save-size limits, integrity checks, and a second full run that must produce the same signature
- Procedural city massing
- One-key transition between planning and first-person exploration, with continuous spline-generated curbs, sidewalks, road markings, and intersection-aware sidewalk entry
- Scale-aware street rendering: true intersections receive clean layered junction caps, while dense crosswalk, signal, window, and building-shadow detail is reserved for Explorer so the planning view remains legible without depth-fighting artifacts
- A focused City Builder command deck with Build, Zones, Services, Mobility, Events, and Views workspaces; each exposes only the relevant tools and settings instead of compressing the entire simulation into one toolbar
- A persistent `?` field guide that explains City Builder, City Explorer, Home Simulator, shared history, saves, and the most important controls without leaving the live world
- Live traffic, utilities, wellbeing, and development planning overlays derived from the same roads, commuter routes, service networks, households, and construction state used by the simulation
- Persistent 256-meter spatial chunks with exact road and lot membership, population/job aggregates, focus-driven agent, active, and aggregate tiers, live regional-detail diagnostics, save migration, and a large-region renderer cutoff
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
- First-person room traversal with exterior and connecting door openings, wall containment, furniture collision, warm interior lighting, and room-aware location readouts
- Selectable Home Simulator rooms with persistent Living Room, Bedroom, Kitchen, Bathroom, Study, Dining Room, Nursery, or Studio purposes; oak, tile, concrete, or carpet floors; warm white, sage, clay, or slate walls; area-based finish costs; protected final-room deletion; automatic furnishing cleanup; and partial refunds
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
- Persistent Communication, Creativity, Wellness, and Practical skills earned through household actions plus ten-level office, service, and student progression advanced by completed work or school days
- Persistent household funds with career-level daily wages, readable living and home-maintenance costs, daily net results, save migration, and financial-security feedback into resident wellbeing
- Household-funded meal delivery, creative supplies, and wellness care with immediate need and skill effects, persistent total discretionary spending, last-purchase history, affordability checks, and strict separation from the design budget
- Autonomous reconciliation attempts from empathetic residents when household tension remains unresolved
- Relationship-driven autonomous conversations that choose an available partner from familiarity, personality compatibility, and social need, then reserve both residents for the shared activity
- A live interaction prompt with keyboard intent selection, action effects, remaining duration, controlled-resident identity, and completed-action feedback
- Vehicle parking with low-speed checks, facility capacity, saved position and heading, garage collision, and pedestrian return to the sidewalk
- Persistent home entities and directly controlled resident positions attached to real city lots
- Room drawing with area-based construction costs, architectural walls and floors, a persistent $60,000 design budget, a categorized eight-object catalog, persistent Natural, Light, Dark, or Colorful furniture styles, room-contained furniture, green/red placement previews, click selection, cost-free moving, collision-aware 45-degree rotation, half-cost selling, and household residents
- A focused household creator for resident name, adult or child life stage, daily role, and exactly two behavior-shaping personality traits, with an eight-person household limit and immediate profile preview
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
