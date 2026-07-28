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
- Curved road splines, intersections, generated lots, undo, and browser saves
- NYC-inspired region template with editable street hierarchy, districts, park, waterfront, and blank-region alternative
- Local street, avenue, and arterial construction plus parcel inspection and residential, commercial, mixed-use, industrial, and civic zoning
- Persistent power, water, fire, health, and school facilities with coverage radii, operating costs, municipal balance, and demand feedback
- Deterministic saved calendar with pause/speed controls plus drawable power, water, and sewage networks
- Sewage treatment and waste-transfer facilities with network-aware parcel coverage
- Service-capacity and staffing tradeoffs, staged building construction, and drawable waste-collection routes
- Deterministic fire and medical incidents with unresolved alerts, staffing-sensitive street-graph dispatch, routed vehicles, and saved incident state
- Finite capacity on every power, water, sewage, and waste network route
- Daily household moves, business openings, explicit jobs, workforce-limited staffing, and power-dependent service effectiveness
- Persistent household cohorts, business-sector mixes, named neighborhood anchor businesses, and parcel-level growth explanations
- Time-aware household routines, business operating hours, municipal shifts, responder availability, and occupied-building night lighting
- Persistent street-graph commutes with named resident workplaces, representative walking and driving groups, visible 3D travelers, congestion, and traffic-sensitive staffing and emergency response
- Persistent resident energy, social, comfort, health, and stress needs shaped by schedules, home design, utilities, neighborhood services, incidents, and commute burden
- Household and city wellbeing visible across planning, street exploration, and Home Simulator, with local wellbeing feeding back into daily growth
- Degrading utility infrastructure with deterministic local outages, street-routed repair crews, traffic-sensitive restoration, affected-parcel consequences, and persistent recovery state
- Persistent autonomous household actions chosen from resident needs, schedules, available furniture, and who is home, with visible 3D behavior, progress, completed-action history, and direct need effects
- A repeatable ten-year NYC reference-city stability gate with yearly economy and wellbeing checkpoints, bounded incident histories, save-size limits, integrity checks, and a second full run that must produce the same signature
- Procedural city massing
- One-key transition between planning and first-person exploration, with continuous spline-generated curbs, sidewalks, road markings, and intersection-aware sidewalk entry
- Grounded first-person acceleration, sprinting, jumping, head movement, shoreline limits, building collision, wall sliding, and a live location, surface, and pace readout
- Detected street intersections with zebra crossings, curb-ramp pads, and deterministic two-direction traffic signals
- A drivable street-level car with acceleration, braking, reverse, steering, handbrake, road-aware traction, collision, chase camera, and safe sidewalk exit
- Persistent curb bays, surface lots, and structured garages with capacity, occupancy, designated accessible spaces, undo, and browser-save support
- Accessibility-aware sidewalk routing to available parking, including marked crossings, paired curb ramps, visible street-level guidance, and distance reporting
- Vehicle parking with low-speed checks, facility capacity, saved position and heading, garage collision, and pedestrian return to the sidewalk
- Persistent home entities attached to real city lots
- Room drawing, architectural walls and floors, furniture placement, and household residents

This is a visual and interaction prototype with local persistence and a deterministic early economic simulation. The current reference scenario passes its automated ten-year stability gate; qualitative diagnosis and fun remain playtest questions.

## Product pillars

1. **Build anywhere:** Roads, parcels, buildings, parks, and utilities conform to terrain and geometry instead of tiles.
2. **A city, not a diorama:** Districts continue beyond the camera through chunk streaming and simulation levels of detail.
3. **Human scale:** Every planning decision can be experienced from the sidewalk.
4. **Believable systems:** Land value, travel time, jobs, housing, utilities, freight, and public services create visible consequences.
5. **Share the same place:** Players can invite others into a hosted city to walk, drive, build together, or simply inhabit it.

See [ROADMAP.md](./ROADMAP.md) for staged delivery.
