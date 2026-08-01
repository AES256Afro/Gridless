import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ProceduralSoundscape, soundscapeProfile } from "./soundscape";
import { buildingArchitecture, type BuildingArchitecture } from "./architecture";
import { neighborhoodPulse, type NeighborhoodPulse } from "./neighborhood";
import { buildingProgram, type BuildingProgram } from "./building-program";
import { cityAdvisorActions } from "./advisor";
import { homeAdvisorActions } from "./home-advisor";
import { recordActivity, type ActivityEntry } from "./activity";
import { WORLD_TEMPLATES } from "./templates";
import {
  CITY_EVENT_DEFINITIONS,
  DISTRICT_POLICY_DEFINITIONS,
  HOME_BUILD_COSTS,
  HOME_FINISH_COSTS,
  HOME_FURNITURE_SIZE,
  HOME_FURNITURE_VARIANTS,
  HOME_ROOM_KINDS,
  HOUSEHOLD_GATHERING_DEFINITIONS,
  MAX_HOME_FLOORS,
  ROAD_PROFILE_PRESETS,
  RESIDENT_PERSONALITY_AXES,
  RESIDENT_ASPIRATION_DEFINITIONS,
  RESIDENT_CAREER_TRACK_DEFINITIONS,
  RESIDENT_LIFE_STAGE_DEFINITIONS,
  RESIDENT_LIFE_STAGES,
  RESIDENT_OUTFIT_DEFINITIONS,
  RESIDENT_OUTFIT_PALETTES,
  RESIDENT_PASTIME_DEFINITIONS,
  RESIDENT_PERSONAL_ITEM_DEFINITIONS,
  RESIDENT_PURCHASES,
  RESIDENT_ROUTINE_DEFINITIONS,
  normalizeRoadProfile,
  normalizeRoadStructure,
  defaultHomeRoofColor,
  defaultHomeRoofStyle,
  defaultHomeFoundationStyle,
  homeEntityFloor,
  homeFloorView,
  homeRoomExteriorWalls,
  roadCapacityForProfile,
  roadConstructionCost,
  snapRoadDrawingPoint,
  roadWidthForProfile,
  type AccessibilityDestination,
  type AccessibilityDestinationKind,
  type AccessibilityEntrance,
  type CityEventKind,
  type CityEventTiming,
  type CityService,
  type ConversationIntent,
  type CurbSchedule,
  type CurbUse,
  type DistrictPolicy,
  type Home,
  type HomeFloorFinish,
  type HomeFoundationStyle,
  type HomeDoorWidth,
  type HomeFurnitureStyle,
  type HomeFurnitureVariant,
  type HomeRoomKind,
  type HomeRoofStyle,
  type HomeWindowGlazing,
  type HomeWallFinish,
  type HouseholdGatheringKind,
  type Lot,
  type LotDensity,
  type ParkingFacility,
  type ParkingKind,
  type Point2,
  type Road,
  type RoadClass,
  type RoadProfile,
  type RoadStructure,
  type RoadDrawingSnap,
  type Resident,
  type ResidentRole,
  type ResidentAspiration,
  type ResidentCareerTrack,
  type ResidentLifeStage,
  type ResidentOutfitPalette,
  type ResidentOutfitStyle,
  type ResidentPastime,
  type ResidentPersonalItemKind,
  type ResidentPersonality,
  type ResidentPurchaseKind,
  type ResidentRoutineProfile,
  type ResidentTrait,
  type ServiceKind,
  type SpatialChunk,
  type TaxCategory,
  type UtilityKind,
  type WeatherState,
  type Zone,
  World
} from "./world";
import {
  buildExplorerRoadPaths,
  explorerSurface,
  isExplorerPositionValid,
  nearestRoadLocation,
  pointInPolygon,
  resolveExplorerMovement,
  sidewalkSpawn,
  type ExplorerRoadPath
} from "./explorer";
import {
  homeEntryStatus,
  homeCirculation,
  homeSafetyAudit,
  interiorDoorways,
  interiorEntryPoint,
  interiorExteriorDoorway,
  interiorRoomAt,
  isInteriorPositionValid,
  lotLocalToWorld,
  nearestInteriorFurniture,
  resolveInteriorMovement,
  worldToLotLocal
} from "./interiors";
import {
  detectStreetIntersections,
  trafficSignalState,
  type StreetIntersection
} from "./streets";
import {
  assessAccessibleTrip,
  nearestAccessibilityDestination,
  nearestParkingFacility
} from "./mobility";
import {
  trafficSignalAhead,
  trafficSignalColor,
  trafficVehiclePose
} from "./traffic";
import {
  advanceTransitRide,
  beginTransitRide,
  nearestTransitStop,
  requestTransitAlight,
  scheduledTransitFleet,
  transitFleetSize,
  transitPoseAtProgress,
  type TransitRide,
  type TransitVehiclePose
} from "./transit";

type Mode = "city" | "explore" | "home";
type HomeFurnitureKind = Home["furniture"][number]["kind"];
type HomeTool = "select" | "room" | "stairs" | "window" | "door" | HomeFurnitureKind;
type CityTool = "road" | "inspect" | "service" | "utility" | "parking" | "curb" | "event" | "transit" | "access" | Exclude<Zone, "unassigned">;
type CityToolGroup = "build" | "zone" | "services" | "mobility" | "economy" | "events" | "views";
type CityView = "normal" | "traffic" | "utilities" | "wellbeing" | "development" | "land-value" | "environment" | "pollution" | "voices";
const HOME_FURNITURE_KINDS: HomeFurnitureKind[] = ["sofa", "table", "bed", "plant", "desk", "bookcase", "fridge", "shower"];
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const isHomeFurnitureKind = (value: string): value is HomeFurnitureKind => HOME_FURNITURE_KINDS.includes(value as HomeFurnitureKind);
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="hud">
    <div class="brand"><div class="eyebrow">A living city sandbox</div><h1>Gridless</h1><div class="city-name" id="city-name-label">New Gridless City</div><div class="lod-status" id="lod-status">Preparing region detail</div></div>
    <button class="help-trigger" id="help-open" type="button" aria-label="Open controls guide"><kbd>?</kbd><span>Help</span></button>
    <button class="settings-trigger" id="settings-open" type="button" aria-label="Open interface settings"><span>Settings</span></button>
    <button class="activity-trigger" id="activity-open" type="button" aria-label="Open activity center"><span>Activity</span><b id="activity-count" hidden>0</b></button>
    <div class="simulation-controls">
      <div><span id="sim-date">Y1 · JAN 1</span><strong id="sim-time">08:00</strong><small id="sim-weather">Clear · 0°C</small></div>
      <button data-speed="0" aria-label="Pause simulation">Ⅱ</button>
      <button data-speed="12" class="active" aria-label="Normal simulation speed">▶</button>
      <button data-speed="72" aria-label="Fast simulation speed">▶▶</button>
      <button data-speed="360" aria-label="Maximum simulation speed">▶▶▶</button>
    </div>
    <div class="incident-panel" id="incident-panel">
      <div class="eyebrow">CITY OPERATIONS</div>
      <strong id="incident-title">All clear</strong>
      <div id="incident-list"></div>
    </div>
    <nav class="mode-switcher">
      <button data-mode="city" class="active" title="Plan roads, zoning, services, mobility, and city policy"><span>01</span> City Builder</button>
      <button data-mode="explore" title="Walk, drive, ride transit, and experience the city at street level"><span>02</span> City Explorer</button>
      <button data-mode="home" title="Build rooms, furnish a home, and guide a household"><span>03</span> Home Simulator</button>
    </nav>
    <div class="stats">
      <div class="stat"><span>Population</span><strong id="population">0</strong></div>
      <div class="stat"><span>Monthly balance</span><strong id="funds">$0</strong></div>
      <div class="stat"><span>Lots</span><strong id="lot-count">0</strong></div>
      <div class="stat"><span>Services</span><strong id="coverage">0%</strong></div>
      <div class="stat"><span>Mobility</span><strong id="mobility">Quiet</strong></div>
      <div class="stat"><span>Wellbeing</span><strong id="wellbeing">0%</strong></div>
    </div>
    <section class="starter-journey" id="starter-journey" aria-label="Starter journey">
      <header><div><span>STARTER JOURNEY</span><strong id="starter-progress">0 of 4 complete</strong></div><button id="starter-dismiss" type="button" aria-label="Hide starter journey">×</button></header>
      <div id="starter-steps"></div>
    </section>
    <div class="panel">
      <div class="eyebrow" id="panel-kicker">CITY BUILDER</div>
      <h2 id="panel-title">Draw a curved road</h2>
      <p id="panel-copy">Click several points across open ground, then press Enter to build. Lots form automatically along the road.</p>
      <div class="controls" id="controls">
        <kbd>Click</kbd><span>Add a curve point</span>
        <kbd>Enter</kbd><span>Finish road</span>
        <kbd>⌘ Z</kbd><span>Undo construction</span>
      </div>
      <div class="parcel-details" id="parcel-details"></div>
      <div class="demand" id="demand">
        <div><span>Residential</span><i><b id="demand-r"></b></i></div>
        <div><span>Commercial</span><i><b id="demand-c"></b></i></div>
        <div><span>Industrial</span><i><b id="demand-i"></b></i></div>
        <small id="demand-reason">Demand responds to homes, jobs, and services.</small>
        <small id="economy-summary">Households and businesses update each day.</small>
      </div>
      <section class="city-advisor" id="city-advisor" aria-label="City Advisor">
        <div class="eyebrow">CITY ADVISOR · NEXT ACTIONS</div>
        <div id="city-advisor-actions"></div>
      </section>
      <section class="neighborhood-voices" id="neighborhood-voices" aria-label="Neighborhood voices" hidden></section>
    </div>
    <div class="actionbar">
      <button id="undo">Undo</button><button id="redo">Redo</button><button id="save">Save city</button><button id="load">Load city</button><button id="recover-autosave" disabled>Recover autosave</button>
      <button id="sound-toggle" type="button" aria-pressed="false">Sound off</button>
      <select id="staffing-policy" aria-label="Service staffing">
        <option value="0.65">Lean staff · 65%</option>
        <option value="0.85" selected>Standard staff · 85%</option>
        <option value="1">Full staff · 100%</option>
      </select>
      <span id="notice" aria-live="polite">World ready</span>
      <span id="save-status" data-state="idle">Recovery starts after first edit</span>
    </div>
    <div class="city-tools">
      <div>
        <div class="eyebrow">REGION FOUNDATION</div>
        <strong>Start structured, change anything</strong>
        <small id="region-foundation-summary">Manhattan-inspired density, waterfront, park, and diagonal street logic.</small>
      </div>
      <input id="city-name-input" aria-label="City name" maxlength="40" value="New Gridless City">
      <button id="rename-city" type="button">Rename</button>
      <select id="template-select" aria-label="Region template">
        <option value="nyc">New York City foundation</option>
        <option value="chicago">Chicago foundation</option>
        <option value="houston">Houston foundation</option>
        <option value="seattle">Seattle foundation</option>
        <option value="portland">Portland foundation</option>
        <option value="blank">Blank region</option>
      </select>
      <button id="apply-template">Start new region</button>
    </div>
    <div class="city-build-tools" aria-label="City building tools">
      <div class="city-tool-categories" role="tablist" aria-label="City tool categories">
        <button data-city-tool-group="build" class="active" role="tab">Build</button>
        <button data-city-tool-group="zone" role="tab">Zones</button>
        <button data-city-tool-group="services" role="tab">Services</button>
        <button data-city-tool-group="mobility" role="tab">Mobility</button>
        <button data-city-tool-group="economy" role="tab">Economy</button>
        <button data-city-tool-group="events" role="tab">Events</button>
        <button data-city-tool-group="views" role="tab">Views</button>
      </div>
      <div class="city-tool-options active" data-city-group-panel="build">
        <div class="city-tool-actions">
          <button data-city-tool="road" class="active">Road designer</button>
          <button data-city-tool="inspect">Inspect parcels</button>
        </div>
        <div class="city-tool-settings road-profile-settings active" data-city-tool-settings="road">
          <select id="road-target" aria-label="Road profile target"><option value="">New road</option></select>
          <select id="road-class" aria-label="Road class">
            <option value="street">Local street</option>
            <option value="avenue">Avenue</option>
            <option value="arterial">Arterial</option>
          </select>
          <select id="road-lanes" aria-label="Travel lanes">
            <option value="1">1 lane</option><option value="2" selected>2 lanes</option><option value="3">3 lanes</option>
            <option value="4">4 lanes</option><option value="5">5 lanes</option><option value="6">6 lanes</option>
            <option value="7">7 lanes</option><option value="8">8 lanes</option>
          </select>
          <select id="road-speed" aria-label="Speed limit">
            <option value="20">20 km/h</option><option value="30" selected>30 km/h</option><option value="40">40 km/h</option>
            <option value="50">50 km/h</option><option value="60">60 km/h</option><option value="80">80 km/h</option>
          </select>
          <select id="road-sidewalk" aria-label="Sidewalk width">
            <option value="1.5">1.5m walks</option><option value="2.2" selected>2.2m walks</option>
            <option value="3">3m walks</option><option value="4">4m walks</option><option value="6">6m walks</option>
          </select>
          <select id="road-structure" aria-label="Road structure">
            <option value="surface" selected>Surface road</option>
            <option value="bridge">Bridge</option>
            <option value="tunnel">Tunnel</option>
          </select>
          <select id="road-elevation" aria-label="Road elevation" disabled><option value="0">Ground level</option></select>
          <div class="road-profile-toggles" aria-label="Road features">
            <button type="button" data-road-feature="bikeLanes" aria-pressed="false">Bike</button>
            <button type="button" data-road-feature="busLanes" aria-pressed="false">Bus</button>
            <button type="button" data-road-feature="median" aria-pressed="false">Median</button>
            <button type="button" data-road-feature="curbParking" aria-pressed="true" class="active">Parking</button>
            <button type="button" data-road-feature="streetTrees" aria-pressed="true" class="active">Trees</button>
          </div>
          <div class="road-drawing-aids" aria-label="Road drawing aids">
            <button type="button" id="road-snap-endpoints" aria-pressed="true" class="active">Snap ends</button>
            <button type="button" id="road-angle-lock" aria-pressed="false">15° lock</button>
            <button type="button" id="road-tangent-guide" aria-pressed="false">Tangent</button>
            <button type="button" id="road-parallel-guide" aria-pressed="false">Parallel</button>
            <output id="road-snap-status">Endpoint snap · free angle · free curve</output>
          </div>
          <output id="road-profile-summary" aria-live="polite"></output>
          <section id="road-impact-preview" class="road-impact-preview" aria-live="polite" hidden></section>
          <button type="button" id="apply-road-profile" disabled>Apply profile</button>
        </div>
      </div>
      <div class="city-tool-options" data-city-group-panel="zone">
        <span class="tool-label">Paint zone</span>
        <select id="zone-density" aria-label="Zoning intensity">
          <option value="low">Low intensity</option>
          <option value="medium" selected>Medium intensity</option>
          <option value="high">High intensity</option>
        </select>
        <button data-city-tool="residential">Residential</button>
        <button data-city-tool="commercial">Commercial</button>
        <button data-city-tool="mixed">Mixed use</button>
        <button data-city-tool="industrial">Industrial</button>
        <button data-city-tool="civic">Civic</button>
      </div>
      <div class="city-tool-options" data-city-group-panel="services">
        <button data-city-tool="service">Place service</button>
        <select id="service-kind" aria-label="Municipal service">
          <option value="power">Power plant · $780k/mo</option>
          <option value="water">Water tower · $520k/mo</option>
          <option value="sewage">Sewage plant · $610k/mo</option>
          <option value="waste">Waste depot · $470k/mo</option>
          <option value="fire">Fire station · $360k/mo</option>
          <option value="health">Health clinic · $440k/mo</option>
          <option value="school">Public school · $390k/mo</option>
        </select>
        <button data-city-tool="utility">Draw utility</button>
        <select id="utility-kind" aria-label="Utility network">
          <option value="power">Power line</option>
          <option value="water">Water main</option>
          <option value="sewage">Sewage pipe</option>
          <option value="waste">Waste collection route</option>
        </select>
        <button data-city-tool="access">Improve access</button>
      </div>
      <div class="city-tool-options" data-city-group-panel="mobility">
        <div class="city-tool-actions">
          <button data-city-tool="parking">Parking</button>
          <button data-city-tool="curb">Curbs</button>
          <button data-city-tool="transit">Transit</button>
        </div>
        <div class="city-tool-settings active" data-city-tool-settings="parking">
          <select id="parking-kind" aria-label="Parking type">
            <option value="curb">Curb bay · 2 spaces</option>
            <option value="surface">Surface lot · 18 spaces</option>
            <option value="garage">Garage · 84 spaces</option>
          </select>
          <select id="parking-price" aria-label="Parking hourly price">
            <option value="0">Free parking</option>
            <option value="2">Economy · $2/hr</option>
            <option value="4">Market · $4/hr</option>
            <option value="6" selected>Premium · $6/hr</option>
            <option value="10">Event · $10/hr</option>
          </select>
        </div>
        <div class="city-tool-settings" data-city-tool-settings="curb">
          <select id="curb-use" aria-label="Curb use">
            <option value="parking">Flexible parking</option>
            <option value="loading">Commercial loading</option>
            <option value="restricted">No parking</option>
            <option value="event">Special event</option>
          </select>
          <select id="curb-schedule" aria-label="Curb schedule">
            <option value="all-day">All day</option>
            <option value="business-hours" selected>Business hours · 7–19</option>
            <option value="rush-hours">Rush hours · 7–10 / 16–19</option>
            <option value="evening">Evening event · 17–23</option>
          </select>
        </div>
        <div class="city-tool-settings" data-city-tool-settings="transit">
          <select id="transit-line" aria-label="Selected transit line"></select>
          <input id="transit-name" aria-label="Transit line name" maxlength="32" placeholder="Line name">
          <button id="transit-rename" type="button">Rename</button>
          <select id="transit-frequency" aria-label="Transit service frequency">
            <option value="18">Basic service · 18m</option>
            <option value="10" selected>Frequent service · 10m</option>
            <option value="6">Rapid service · 6m</option>
          </select>
          <select id="transit-fare" aria-label="Transit fare">
            <option value="0">Fare-free</option>
            <option value="2.75" selected>Standard fare · $2.75</option>
            <option value="4">Premium fare · $4</option>
          </select>
          <select id="transit-stops" aria-label="Transit stop count">
            <option value="4">4 stops</option>
            <option value="5">5 stops</option>
            <option value="6">6 stops</option>
            <option value="7">7 stops</option>
            <option value="8">8 stops</option>
            <option value="9">9 stops</option>
            <option value="10">10 stops</option>
          </select>
          <button id="transit-remove" type="button">Remove line</button>
        </div>
      </div>
      <div class="city-tool-options economy-options" data-city-group-panel="economy">
        <span class="tool-label">Taxes</span>
        <select id="tax-residential" aria-label="Residential tax rate">
          <option value="5">Homes 5%</option><option value="8">Homes 8%</option><option value="10" selected>Homes 10%</option>
          <option value="12">Homes 12%</option><option value="15">Homes 15%</option><option value="18">Homes 18%</option><option value="20">Homes 20%</option>
        </select>
        <select id="tax-commercial" aria-label="Commercial tax rate">
          <option value="5">Shops 5%</option><option value="8">Shops 8%</option><option value="10" selected>Shops 10%</option>
          <option value="12">Shops 12%</option><option value="15">Shops 15%</option><option value="18">Shops 18%</option><option value="20">Shops 20%</option>
        </select>
        <select id="tax-industrial" aria-label="Industrial tax rate">
          <option value="5">Industry 5%</option><option value="8">Industry 8%</option><option value="10" selected>Industry 10%</option>
          <option value="12">Industry 12%</option><option value="15">Industry 15%</option><option value="18">Industry 18%</option><option value="20">Industry 20%</option>
        </select>
        <span class="tool-label">District</span>
        <select id="district-policy-area" aria-label="Policy district"></select>
        <select id="district-policy-kind" aria-label="District policy">
          <option value="recycling">Recycling</option><option value="school-boost">School boost</option>
          <option value="heavy-traffic-ban">Heavy traffic ban</option><option value="small-business-grants">Business grants</option>
        </select>
        <button type="button" id="district-policy-toggle">Enable policy</button>
        <span class="tool-label">Bonds</span>
        <select id="municipal-bond" aria-label="Municipal bond">
          <option value="5000000">$5m · 4.4%</option><option value="15000000">$15m · 5.2%</option><option value="40000000">$40m · 6.2%</option>
        </select>
        <button type="button" id="issue-bond">Issue bond</button>
        <button type="button" id="repay-bond">Repay $1m</button>
        <output id="economy-policy-summary" aria-live="polite"></output>
      </div>
      <div class="city-tool-options" data-city-group-panel="events">
        <button data-city-tool="event">Plan city event</button>
        <select id="event-kind" aria-label="City event type">
          <option value="market">Street market</option>
          <option value="concert">Outdoor concert</option>
          <option value="parade">City parade</option>
          <option value="sports">City match</option>
        </select>
        <select id="event-timing" aria-label="City event timing">
          <option value="now">Start now</option>
          <option value="tonight" selected>Next event time</option>
          <option value="tomorrow">Tomorrow</option>
        </select>
      </div>
      <div class="city-tool-options city-view-options" data-city-group-panel="views">
        <button data-city-view="normal" class="active">City</button>
        <button data-city-view="traffic">Traffic</button>
        <button data-city-view="utilities">Utilities</button>
        <button data-city-view="wellbeing">Wellbeing</button>
        <button data-city-view="land-value">Land value</button>
        <button data-city-view="environment">Environment</button>
        <button data-city-view="pollution">Pollution</button>
        <button data-city-view="development">Development</button>
        <button data-city-view="voices">Voices</button>
        <div class="city-view-legend" id="city-view-legend"><i></i><span>Natural city colors</span></div>
      </div>
    </div>
    <div class="home-tools" aria-label="Home building tools">
      <button data-home-tool="select" class="active">Inspect</button>
      <button data-home-tool="room">Draw room</button>
      <select id="home-floor" aria-label="Active home floor"><option value="0">Floor 1</option></select>
      <button id="add-home-floor" type="button">+ Floor · $12k</button>
      <button id="remove-home-floor" type="button" disabled>Remove top</button>
      <button data-home-tool="stairs">Place stairs · $4.8k</button>
      <button data-home-tool="window">Place window · $900</button>
      <select id="home-window-glazing" aria-label="Window glazing">
        <option value="clear">Clear glass</option>
        <option value="privacy">Privacy glass · +$200</option>
      </select>
      <button id="remove-home-window" type="button" disabled>Remove window</button>
      <button data-home-tool="door">Place doorway · $1.4k</button>
      <select id="home-door-width" aria-label="Interior doorway width">
        <option value="standard">Standard · 0.95m</option>
        <option value="wide">Wide access · 1.35m · +$400</option>
      </select>
      <button id="remove-home-door" type="button" disabled>Remove doorway</button>
      <select id="home-roof-style" aria-label="Home roof style">
        <option value="gable">Gable roof · $2.8k</option>
        <option value="hip">Hip roof · $2.8k</option>
        <option value="flat">Flat roof · $2.8k</option>
        <option value="green">Planted roof · $5k</option>
      </select>
      <input id="home-roof-color" type="color" aria-label="Roof color" title="Roof color" value="#625044">
      <button id="apply-home-roof" type="button">Apply roof</button>
      <select id="home-foundation-style" aria-label="Home foundation style">
        <option value="slab">Slab · $4k</option>
        <option value="crawlspace">Crawlspace · $6.5k</option>
        <option value="raised">Raised · $10k</option>
      </select>
      <button id="apply-home-foundation" type="button">Apply foundation</button>
      <div class="tool-divider"></div>
      <select id="home-catalog" aria-label="Home object catalog">
        <optgroup label="Living">
          <option value="sofa">Sofa · $1.4k</option>
          <option value="table">Dining table · $650</option>
        </optgroup>
        <optgroup label="Bedroom">
          <option value="bed">Bed · $1.2k</option>
        </optgroup>
        <optgroup label="Study">
          <option value="desk">Desk · $900</option>
          <option value="bookcase">Bookcase · $720</option>
        </optgroup>
        <optgroup label="Kitchen">
          <option value="fridge">Fridge · $1.1k</option>
        </optgroup>
        <optgroup label="Bathroom">
          <option value="shower">Shower · $1.65k</option>
        </optgroup>
        <optgroup label="Decor">
          <option value="plant">Plant · $120</option>
        </optgroup>
      </select>
      <button id="place-catalog-item">Place sofa</button>
      <div class="tool-divider"></div>
      <button id="move-furniture" disabled>Move</button>
      <button id="rotate-furniture" disabled>Rotate 45°</button>
      <select id="furniture-style" aria-label="Selected furniture style" disabled>
        <option value="natural">Natural</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="colorful">Colorful</option>
      </select>
      <select id="furniture-variant" aria-label="Selected furniture design" disabled>
        <option value="classic">Classic</option>
        <option value="modern">Modern</option>
        <option value="soft">Soft edge</option>
      </select>
      <input id="furniture-tint" type="color" aria-label="Selected furniture custom color" title="Custom furniture color" value="#9a7654" disabled>
      <select id="furniture-owner" aria-label="Selected furniture owner" disabled>
        <option value="">Shared household</option>
      </select>
      <button id="sell-furniture" disabled>Sell</button>
      <button id="repair-furniture" disabled>Repair</button>
      <div class="tool-divider"></div>
      <button id="add-resident">+ Resident</button>
      <button id="auto-assign-rooms" type="button">Smart assign rooms</button>
      <input id="home-name-input" aria-label="Home or household name" maxlength="40" value="New household">
      <button id="rename-home" type="button">Rename home</button>
      <div class="home-budget" id="home-budget">Design budget unavailable</div>
      <div class="home-budget" id="home-circulation">Circulation unavailable</div>
      <div class="home-budget" id="home-energy">Energy unavailable</div>
      <div class="home-budget" id="home-privacy">Privacy unavailable</div>
      <div class="home-budget" id="home-space-plan">Space plan unavailable</div>
      <div class="home-budget" id="home-safety">Safety audit unavailable</div>
      <div class="household-summary" id="household-summary">No residents yet</div>
    </div>
    <div class="room-editor" id="room-editor" aria-label="Selected room finishes">
      <strong id="room-editor-title">Room selected</strong>
      <label>Purpose<select id="room-kind">
        ${HOME_ROOM_KINDS.map(kind => `<option value="${kind}">${kind}</option>`).join("")}
      </select></label>
      <label>Floor<select id="room-floor-finish">
        <option value="oak">Oak · $55/m²</option>
        <option value="tile">Tile · $65/m²</option>
        <option value="concrete">Concrete · $32/m²</option>
        <option value="carpet">Carpet · $38/m²</option>
      </select></label>
      <label>Walls<select id="room-wall-finish">
        <option value="warm-white">Warm white · $5/m²</option>
        <option value="sage">Sage · $8/m²</option>
        <option value="clay">Clay · $10/m²</option>
        <option value="slate">Slate · $12/m²</option>
      </select></label>
      <span id="room-condition">Pristine · 100%</span>
      <label>Room claim<select id="room-resident-claim"><option value="">Clear room claims</option></select></label>
      <span id="room-claim-status">No resident claim</span>
      <button id="assign-room-resident">Assign room</button>
      <button id="renovate-room">Renovate</button>
      <button id="furnish-room">Furnish room</button>
      <button id="delete-room">Delete room</button>
    </div>
    <div class="resident-creator" id="resident-creator" role="dialog" aria-modal="true" aria-labelledby="resident-creator-title" hidden>
      <form id="resident-creator-form">
        <header>
          <div><span>HOUSEHOLD CREATOR</span><h2 id="resident-creator-title">Create a resident</h2></div>
          <button type="button" id="resident-creator-close" aria-label="Close resident creator">×</button>
        </header>
        <label class="resident-field">Name<input id="resident-name" maxlength="24" autocomplete="off" required></label>
        <div class="resident-field-row">
          <label class="resident-field">Life stage<select id="resident-age">${RESIDENT_LIFE_STAGES.map(stage => `<option value="${stage}" ${stage === "adult" ? "selected" : ""}>${RESIDENT_LIFE_STAGE_DEFINITIONS[stage].label}</option>`).join("")}</select></label>
          <label class="resident-field">Daily role<select id="resident-role"><option value="office">Office worker</option><option value="service">Service worker</option><option value="student">Student</option><option value="home">Home-based</option></select></label>
        </div>
        <div class="resident-field-row">
          <label class="resident-field">Career direction<select id="resident-career-track">${(Object.entries(RESIDENT_CAREER_TRACK_DEFINITIONS) as Array<[ResidentCareerTrack, (typeof RESIDENT_CAREER_TRACK_DEFINITIONS)[ResidentCareerTrack]]>).map(([track, definition]) => `<option value="${track}">${definition.label}</option>`).join("")}</select></label>
          <label class="resident-field">Long-term aspiration<select id="resident-aspiration">${(Object.entries(RESIDENT_ASPIRATION_DEFINITIONS) as Array<[ResidentAspiration, (typeof RESIDENT_ASPIRATION_DEFINITIONS)[ResidentAspiration]]>).map(([aspiration, definition]) => `<option value="${aspiration}">${definition.label}</option>`).join("")}</select></label>
        </div>
        <div class="resident-field-row">
          <label class="resident-field">Favorite home style<select id="resident-decor-preference"><option value="natural">Natural</option><option value="light">Light</option><option value="dark">Dark</option><option value="colorful">Colorful</option></select></label>
          <label class="resident-field">Favorite pastime<select id="resident-favorite-pastime">${(Object.entries(RESIDENT_PASTIME_DEFINITIONS) as Array<[ResidentPastime, (typeof RESIDENT_PASTIME_DEFINITIONS)[ResidentPastime]]>).map(([pastime, definition]) => `<option value="${pastime}">${definition.label}</option>`).join("")}</select></label>
        </div>
        <div class="resident-field-row">
          <label class="resident-field">Everyday outfit<select id="resident-outfit-style">${(Object.entries(RESIDENT_OUTFIT_DEFINITIONS) as Array<[ResidentOutfitStyle, (typeof RESIDENT_OUTFIT_DEFINITIONS)[ResidentOutfitStyle]]>).map(([style, definition]) => `<option value="${style}">${definition.label}</option>`).join("")}</select></label>
          <label class="resident-field">Color palette<select id="resident-outfit-palette">${(Object.entries(RESIDENT_OUTFIT_PALETTES) as Array<[ResidentOutfitPalette, (typeof RESIDENT_OUTFIT_PALETTES)[ResidentOutfitPalette]]>).map(([palette, definition]) => `<option value="${palette}">${definition.label}</option>`).join("")}</select></label>
        </div>
        <div class="resident-field-row">
          <label class="resident-field">Daily rhythm<select id="resident-routine-profile">${(Object.entries(RESIDENT_ROUTINE_DEFINITIONS) as Array<[ResidentRoutineProfile, (typeof RESIDENT_ROUTINE_DEFINITIONS)[ResidentRoutineProfile]]>).map(([profile, definition]) => `<option value="${profile}" ${profile === "steady" ? "selected" : ""}>${definition.label}</option>`).join("")}</select></label>
        </div>
        <fieldset class="resident-caregiver-fields" id="resident-caregiver-fields" hidden>
          <legend>Generational continuity</legend>
          <div class="resident-field-row">
            <label class="resident-field">Caregiver one<select id="resident-caregiver-a"><option value="">None</option></select></label>
            <label class="resident-field">Caregiver two<select id="resident-caregiver-b"><option value="">None</option></select></label>
          </div>
          <label class="resident-inheritance"><input type="checkbox" id="resident-inherit-personality" checked><span><strong>Blend caregiver tendencies</strong><small>Personality axes inherit a blended baseline with individual variation.</small></span></label>
        </fieldset>
        <fieldset>
          <legend>Choose exactly two personality traits</legend>
          <div class="resident-trait-picker">
            <label><input type="checkbox" value="outgoing"><span><strong>Outgoing</strong><small>Seeks company</small></span></label>
            <label><input type="checkbox" value="homebody"><span><strong>Homebody</strong><small>Recharges at home</small></span></label>
            <label><input type="checkbox" value="active"><span><strong>Active</strong><small>Prefers hands-on activity</small></span></label>
            <label><input type="checkbox" value="creative"><span><strong>Creative</strong><small>Chooses expressive downtime</small></span></label>
            <label><input type="checkbox" value="organized"><span><strong>Organized</strong><small>Likes reliable routines</small></span></label>
            <label><input type="checkbox" value="empathetic"><span><strong>Empathetic</strong><small>Builds bonds easily</small></span></label>
          </div>
        </fieldset>
        <fieldset class="resident-personality-editor">
          <legend>Shape their personality matrix</legend>
          <label><span>Cleanliness<small>Cluttered</small></span><input type="range" min="0" max="100" value="50" data-personality-axis="cleanliness"><output>50</output><small>Orderly</small></label>
          <label><span>Spontaneity<small>Planned</small></span><input type="range" min="0" max="100" value="50" data-personality-axis="spontaneity"><output>50</output><small>Spontaneous</small></label>
          <label><span>Sociability<small>Reserved</small></span><input type="range" min="0" max="100" value="50" data-personality-axis="sociability"><output>50</output><small>Social</small></label>
          <label><span>Emotional intensity<small>Steady</small></span><input type="range" min="0" max="100" value="50" data-personality-axis="emotionality"><output>50</output><small>Intense</small></label>
          <label><span>Activity<small>Unhurried</small></span><input type="range" min="0" max="100" value="50" data-personality-axis="activity"><output>50</output><small>Energetic</small></label>
        </fieldset>
        <div class="resident-profile-preview"><span>PROFILE PREVIEW</span><strong id="resident-preview-name">New resident</strong><p id="resident-preview-copy">Adult · Office worker · Choose two traits</p><p id="resident-preview-personality">Balanced personality matrix</p><div class="resident-outfit-preview"><i id="resident-outfit-primary"></i><i id="resident-outfit-secondary"></i><i id="resident-outfit-accent"></i><small id="resident-preview-outfit">Everyday casual · Earth</small></div></div>
        <div class="resident-creator-actions"><button type="button" id="resident-creator-cancel">Cancel</button><button type="submit" class="primary">Add to household</button></div>
      </form>
    </div>
    <div class="controls-guide" id="controls-guide" role="dialog" aria-modal="true" aria-labelledby="controls-guide-title" hidden>
      <section>
        <header>
          <div><span>GRIDLESS FIELD GUIDE</span><h2 id="controls-guide-title">One city, three ways to play</h2><p>Plan the region, experience it at street level, then shape the lives inside its homes. Every scale edits the same persistent world.</p></div>
          <button type="button" id="help-close" aria-label="Close controls guide">×</button>
        </header>
        <div class="controls-guide-grid">
          <article><b>01</b><h3>City Builder</h3><p>Shape roads and parcels, fund services, tune mobility, and diagnose the city through live overlays.</p><dl><dt>Click</dt><dd>Place or select</dd><dt>Enter</dt><dd>Finish a road or network</dd><dt>Views</dt><dd>Traffic, utilities, wellbeing, growth</dd></dl></article>
          <article><b>02</b><h3>City Explorer</h3><p>Walk, drive, ride transit, follow accessible routes, and enter homes from their real street entrances.</p><dl><dt>W A S D</dt><dd>Move or drive</dd><dt>Shift / Space</dt><dd>Sprint / jump</dd><dt>E / T / F</dt><dd>Vehicle / transit / home</dd><dt>R / O</dt><dd>Route / photo mode</dd></dl></article>
          <article><b>03</b><h3>Home Simulator</h3><p>Draw rooms, choose their purpose and finishes, furnish around real collisions, and guide a household.</p><dl><dt>Select</dt><dd>Edit a room or object</dd><dt>Click</dt><dd>Place or move</dd><dt>R</dt><dd>Rotate selected furniture</dd><dt>C / E</dt><dd>Choose resident / interact</dd></dl></article>
        </div>
        <footer><span><kbd>⌘/Ctrl Z</kbd> Undo</span><span><kbd>⌘/Ctrl S</kbd> Save</span><span><kbd>Alt 1/2/3</kbd> Change scale</span><span><kbd>Backquote</kbd> Pause or resume</span><span><kbd>?</kbd> This guide</span><span><kbd>Esc</kbd> Close or step back</span><small>Text fields keep their native typing and Undo controls. Help, Settings, and Resident Creator pause time and restore your exact prior speed. Autosave recovery protects the latest world state separately.</small></footer>
      </section>
    </div>
    <div class="preferences-panel" id="preferences-panel" role="dialog" aria-modal="true" aria-labelledby="preferences-title" hidden>
      <section>
        <header><div><span>PLAYER COMFORT</span><h2 id="preferences-title">Interface settings</h2></div><button type="button" id="settings-close" aria-label="Close interface settings">×</button></header>
        <label><input type="checkbox" id="preference-reduced-motion"><span><strong>Reduced motion</strong><small>Removes walking camera sway, sprint lens changes, and animated precipitation.</small></span></label>
        <label><input type="checkbox" id="preference-high-contrast"><span><strong>High contrast interface</strong><small>Strengthens panel surfaces, boundaries, and active control states.</small></span></label>
        <label><input type="checkbox" id="preference-starter"><span><strong>Show starter journey</strong><small>Restores the four guided first-play goals in City Builder.</small></span></label>
        <p>These preferences are stored only in this browser.</p>
      </section>
    </div>
    <aside class="activity-center" id="activity-center" role="dialog" aria-labelledby="activity-title" hidden>
      <header><div><span>CITY AND HOUSEHOLD</span><h2 id="activity-title">Recent activity</h2></div><button type="button" id="activity-close" aria-label="Close activity center">×</button></header>
      <div id="activity-list"></div>
      <button type="button" id="activity-clear">Clear activity</button>
    </aside>
    <div class="explorer-status" aria-label="Explorer movement status">
      <div><span>Location</span><strong id="explorer-location">City streets</strong></div>
      <div><span>Surface</span><strong id="explorer-surface">Sidewalk</strong></div>
      <div><span>Movement</span><strong id="explorer-pace">Standing</strong></div>
    </div>
    <div class="interaction-prompt" id="interaction-prompt" aria-live="polite">
      <kbd>C</kbd><span>Choose a resident to control</span>
    </div>
    <div class="photo-mode-panel" id="photo-mode-panel">
      <span>PHOTO MODE</span>
      <strong id="photo-location">City streets</strong>
      <small id="photo-conditions">Clear · 08:00</small>
      <div><kbd>[</kbd><kbd>]</kbd> Lens <b id="photo-lens">55mm</b> · <kbd>H</kbd> Hide UI · <kbd>O</kbd> Exit</div>
    </div>
    <div class="crosshair"></div>
  </div>`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8c9cb);
scene.fog = new THREE.FogExp2(0xb8c9cb, 0.00052);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .25, 2400);
camera.position.set(520, 650, 850);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 0, 0);
orbit.maxPolarAngle = Math.PI * .47;
orbit.minDistance = 22;
orbit.maxDistance = 1200;
const hemisphere = new THREE.HemisphereLight(0xe8f2f5, 0x586752, 2.25);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xfff0d1, 3.2);
sun.position.set(-180, 260, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -300;
sun.shadow.camera.right = sun.shadow.camera.top = 300;
sun.shadow.bias = -.00015;
sun.shadow.normalBias = .08;
scene.add(sun);

const rainParticleCount = 320;
const rainPositions = new Float32Array(rainParticleCount * 6);
for (let index = 0; index < rainParticleCount; index++) {
  const offset = index * 6;
  const x = ((index * 73) % 997) / 997 * 180 - 90;
  const y = ((index * 151) % 991) / 991 * 160 - 70;
  const z = ((index * 211) % 983) / 983 * 180 - 90;
  rainPositions.set([x, y, z, x + .35, y - 3.6, z + .15], offset);
}
const rainGeometry = new THREE.BufferGeometry();
rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
const rainField = new THREE.LineSegments(
  rainGeometry,
  new THREE.LineBasicMaterial({ color: 0xa9d4df, transparent: true, opacity: .34, depthWrite: false })
);
rainField.visible = false;
rainField.frustumCulled = false;
scene.add(rainField);

const snowParticleCount = 460;
const snowPositions = new Float32Array(snowParticleCount * 3);
for (let index = 0; index < snowParticleCount; index++) {
  snowPositions.set([
    ((index * 83) % 997) / 997 * 180 - 90,
    ((index * 137) % 991) / 991 * 160 - 70,
    ((index * 223) % 983) / 983 * 180 - 90
  ], index * 3);
}
const snowGeometry = new THREE.BufferGeometry();
snowGeometry.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
const snowField = new THREE.Points(
  snowGeometry,
  new THREE.PointsMaterial({ color: 0xf4f7f3, size: .7, transparent: true, opacity: .78, depthWrite: false })
);
snowField.visible = false;
snowField.frustumCulled = false;
scene.add(snowField);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
ground.rotation.x = -Math.PI / 2;
const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x6e919b, roughness: .62, metalness: .08, side: THREE.DoubleSide });
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(1800, 1800),
  waterMaterial
);
water.rotation.x = -Math.PI / 2;
water.position.y = -.35;
water.receiveShadow = true;
scene.add(water);
scene.add(ground);
const terrainGroup = new THREE.Group();
const worldGroup = new THREE.Group();
const previewGroup = new THREE.Group();
const homeGroup = new THREE.Group();
const incidentGroup = new THREE.Group();
const commuteGroup = new THREE.Group();
const workplaceActivityGroup = new THREE.Group();
const streetFurnitureGroup = new THREE.Group();
const accessibilityGroup = new THREE.Group();
const accessibleRouteGroup = new THREE.Group();
const transitGroup = new THREE.Group();
const cityEventGroup = new THREE.Group();
const explorerVehicleGroup = createExplorerVehicle();
const transitVehicleGroup = createTransitVehicle();
const transitFleetGroup = new THREE.Group();
scene.add(
  terrainGroup,
  worldGroup,
  streetFurnitureGroup,
  accessibilityGroup,
  accessibleRouteGroup,
  transitGroup,
  cityEventGroup,
  previewGroup,
  homeGroup,
  incidentGroup,
  commuteGroup,
  workplaceActivityGroup,
  explorerVehicleGroup,
  transitVehicleGroup,
  transitFleetGroup
);
const world = new World();
let pendingTemplateId: keyof typeof WORLD_TEMPLATES = world.templateId;
const soundscape = new ProceduralSoundscape();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const keys = new Set<string>();
let mode: Mode = "city";
let draft: Point2[] = [];
let lastRoadSnap: RoadDrawingSnap | null = null;
let selectedLot: Lot | null = null;
let selectedTransitLineId: string | null = world.transitLines[0]?.id ?? null;
let cityTool: CityTool = "road";
let cityToolGroup: CityToolGroup = "build";
let cityView: CityView = "normal";
let roadTargetKey = "";
let districtOptionKey = "";
let homeTool: HomeTool = "select";
let homeFloor = 0;
let explorerInteriorFloor = 0;
let homeDraft: Point2 | null = null;
let selectedFurnitureId: string | null = null;
let selectedRoomId: string | null = null;
let selectedHomeWindowId: string | null = null;
let selectedHomeDoorId: string | null = null;
let movingFurnitureId: string | null = null;
let homePreviewPoint: Point2 | null = null;
let yaw = Math.PI;
let pitch = 0;
let simulationSpeed = 12;
let lastNonZeroSimulationSpeed = 12;
let modalResumeSpeed: number | null = null;
let simulationAccumulator = 0;
let lastMonthlyBalance = 0;
let lastHomeActionSignature = "";
let lastAutosaveRevision = world.changeRevision();
let autosaveTimer = 0;
type UiPreferences = { reducedMotion: boolean; highContrast: boolean; showStarterJourney: boolean };
function loadUiPreferences(): UiPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem("gridless-ui-preferences-v1") ?? "{}") as Partial<UiPreferences>;
    return {
      reducedMotion: saved.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches,
      highContrast: saved.highContrast ?? false,
      showStarterJourney: saved.showStarterJourney ?? true
    };
  } catch {
    return { reducedMotion: false, highContrast: false, showStarterJourney: true };
  }
}
let uiPreferences = loadUiPreferences();
let starterJourneyDismissed = !uiPreferences.showStarterJourney;
let activityLog: ActivityEntry[] = [];
let unreadActivity = 0;
let explorerRoadPaths: ExplorerRoadPath[] = [];
let streetIntersections: StreetIntersection[] = [];
let explorerRoadKey = "";
let lastSignalMinute = -1;
const explorerVelocity = new THREE.Vector3();
let explorerVerticalOffset = 0;
let explorerVerticalVelocity = 0;
let explorerGrounded = true;
let explorerStepPhase = 0;
let explorerBlocked = false;
let explorerDriving = false;
let explorerVehicleParked = false;
let explorerVehicleSpeed = 0;
let explorerVehicleHeading = 0;
let explorerInteriorHomeId: string | null = null;
let explorerExteriorReturn: { position: Point2; yaw: number } | null = null;
let controlledResidentId: string | null = null;
let pendingConversationPartnerId: string | null = null;
let accessibleRouteSummary: {
  destinationId: string;
  destinationKind: AccessibilityDestinationKind;
  destinationName: string;
  sourceId: string;
  entranceId?: string;
  distance?: number;
  rampedCrossings: number;
  usable: boolean;
  barriers: string[];
} | null = null;
let accessibilityKindIndex = -1;
let transitRide: TransitRide | null = null;
let activeTransitVehicle: TransitRide | null = null;
let photoMode = false;
let photoHudVisible = true;
let photoFov = 55;
let soundscapeSyncAccumulator = 0;
let spatialStreamSyncAccumulator = 0;
let renderedSpatialTierSignature = "";
let cityBuildingBatchCount = 0;

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x303533, roughness: .94 });
const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xb7b4aa, roughness: .98 });
const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x777b74, roughness: 1 });
const bikeLaneMaterial = new THREE.MeshStandardMaterial({ color: 0x416f58, roughness: .96 });
const busLaneMaterial = new THREE.MeshStandardMaterial({ color: 0x704541, roughness: .96 });
const medianMaterial = new THREE.MeshStandardMaterial({ color: 0x718666, roughness: 1 });
const lotMaterial = new THREE.MeshBasicMaterial({ color: 0xb9d69a, transparent: true, opacity: .22, side: THREE.DoubleSide });
const lotSelectedMaterial = new THREE.MeshBasicMaterial({ color: 0xf6d773, transparent: true, opacity: .58, side: THREE.DoubleSide });
const zoneLotMaterials: Record<Zone, THREE.MeshBasicMaterial> = {
  unassigned: lotMaterial,
  residential: new THREE.MeshBasicMaterial({ color: 0x8fc788, transparent: true, opacity: .3, side: THREE.DoubleSide }),
  commercial: new THREE.MeshBasicMaterial({ color: 0x6daacb, transparent: true, opacity: .32, side: THREE.DoubleSide }),
  mixed: new THREE.MeshBasicMaterial({ color: 0xc69aca, transparent: true, opacity: .32, side: THREE.DoubleSide }),
  industrial: new THREE.MeshBasicMaterial({ color: 0xd29c63, transparent: true, opacity: .34, side: THREE.DoubleSide }),
  civic: new THREE.MeshBasicMaterial({ color: 0xe3cd72, transparent: true, opacity: .35, side: THREE.DoubleSide })
};
const zoneBuildingColors: Record<Zone, number> = {
  unassigned: 0xa8afb0,
  residential: 0xb7ad9b,
  commercial: 0x8fa6ad,
  mixed: 0xb0a2ac,
  industrial: 0x928b79,
  civic: 0xb88c72
};
const homeFloorColors: Record<HomeFloorFinish, number> = {
  oak: 0xe2d6bd,
  tile: 0xc9d4d2,
  concrete: 0xa9aeab,
  carpet: 0xb6aa9d
};
const homeWallColors: Record<HomeWallFinish, number> = {
  "warm-white": 0xf2eee3,
  sage: 0xa8b8a0,
  clay: 0xc39578,
  slate: 0x778184
};
const windowTexture = createWindowTexture();

function createWindowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 192;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 12; row++) {
    for (let column = 0; column < 6; column++) {
      if ((row * 7 + column * 11) % 5 === 0) continue;
      context.fillStyle = (row + column) % 4 === 0 ? "rgba(255,224,163,.62)" : "rgba(244,193,111,.88)";
      context.fillRect(5 + column * 15, 5 + row * 15, 7, 6);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function createExplorerVehicle() {
  const vehicle = new THREE.Group();
  vehicle.visible = false;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, .72, 3.8),
    new THREE.MeshStandardMaterial({ color: 0x3f6f86, roughness: .62, metalness: .12 })
  );
  body.position.y = .72;
  body.castShadow = body.receiveShadow = true;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, .72, 1.75),
    new THREE.MeshStandardMaterial({ color: 0xaec2c7, roughness: .35, metalness: .18 })
  );
  cabin.position.set(0, 1.33, .2);
  cabin.castShadow = true;
  vehicle.add(body, cabin);
  for (const x of [-.86, .86]) {
    for (const z of [-1.15, 1.15]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(.34, .34, .22, 14),
        new THREE.MeshStandardMaterial({ color: 0x202321, roughness: .9 })
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, .43, z);
      vehicle.add(wheel);
    }
  }
  for (const x of [-.52, .52]) {
    const headlight = new THREE.Mesh(
      new THREE.BoxGeometry(.28, .2, .08),
      new THREE.MeshBasicMaterial({ color: 0xfff0b4 })
    );
    headlight.position.set(x, .78, -1.94);
    vehicle.add(headlight);
  }
  return vehicle;
}

function createTransitVehicle() {
  const vehicle = new THREE.Group();
  vehicle.visible = false;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2d79a7, roughness: .58, metalness: .1 });
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9d5db,
    emissive: 0x263b43,
    emissiveIntensity: .32,
    roughness: .3,
    metalness: .15
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.45, 7.6), bodyMaterial);
  body.position.y = 1.05;
  body.castShadow = body.receiveShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.28, 1.18, 6.9), windowMaterial);
  cabin.position.set(0, 2.25, -.1);
  cabin.castShadow = true;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.34, .18, 7.15),
    new THREE.MeshStandardMaterial({ color: 0xe6e5dc, roughness: .76 })
  );
  roof.position.set(0, 2.93, -.1);
  const destination = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, .34, .06),
    new THREE.MeshBasicMaterial({ color: 0xf0c75c })
  );
  destination.position.set(0, 2.48, -3.58);
  vehicle.add(body, cabin, roof, destination);
  for (const x of [-1.2, 1.2]) {
    for (const z of [-2.45, 2.45]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(.43, .43, .28, 16),
        new THREE.MeshStandardMaterial({ color: 0x202321, roughness: .92 })
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, .56, z);
      vehicle.add(wheel);
    }
  }
  return vehicle;
}

function ribbon(points: Point2[], width: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, .12, p.z)), false, "centripetal");
  const samples = curve.getSpacedPoints(Math.max(8, Math.ceil(curve.getLength() / 3)));
  const positions: number[] = [];
  const indices: number[] = [];
  samples.forEach((point, i) => {
    const tangent = curve.getTangent(i / (samples.length - 1)).normalize();
    positions.push(point.x + tangent.z * width / 2, point.y, point.z - tangent.x * width / 2);
    positions.push(point.x - tangent.z * width / 2, point.y, point.z + tangent.x * width / 2);
    if (i < samples.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function roadCenterLine(road: Road) {
  const curve = new THREE.CatmullRomCurve3(
    road.points.map(point => new THREE.Vector3(point.x, .335, point.z)),
    false,
    "centripetal"
  );
  const geometry = new THREE.BufferGeometry().setFromPoints(
    curve.getSpacedPoints(Math.max(8, Math.ceil(curve.getLength() / 3)))
  );
  const material = new THREE.LineDashedMaterial({
    color: road.class === "arterial" ? 0xe4cf73 : 0xc9c4a8,
    dashSize: road.class === "street" ? 1.8 : 3.2,
    gapSize: road.class === "street" ? 4.6 : 3.4,
    transparent: true,
    opacity: road.class === "street" ? .34 : .68
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

function roadOffsetPoints(road: Road, offset: number) {
  const curve = new THREE.CatmullRomCurve3(
    road.points.map(point => new THREE.Vector3(point.x, 0, point.z)),
    false,
    "centripetal"
  );
  return curve.getSpacedPoints(Math.max(8, Math.ceil(curve.getLength() / 5))).map((point, index, points) => {
    const tangent = curve.getTangent(index / Math.max(1, points.length - 1)).normalize();
    return { x: point.x + tangent.z * offset, z: point.z - tangent.x * offset };
  });
}

function roadOffsetRibbon(road: Road, offset: number, width: number, material: THREE.Material) {
  const band = ribbon(roadOffsetPoints(road, offset), width, material);
  band.position.y = .19;
  return band;
}

function roadOffsetLine(road: Road, offset: number, color = 0xd8d7c9, opacity = .62) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    roadOffsetPoints(road, offset).map(point => new THREE.Vector3(point.x, .35, point.z))
  );
  const material = new THREE.LineDashedMaterial({
    color,
    dashSize: 2.2,
    gapSize: 3.8,
    transparent: true,
    opacity
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

function roadProfileGeometry(road: Road) {
  const group = new THREE.Group();
  const profile = world.roadProfile(road);
  const edgeOffset = Math.max(0, road.width / 2 - .85);
  if (profile.busLanes) {
    const offset = Math.max(0, road.width / 2 - 1.55 - (profile.bikeLanes ? 1.35 : 0));
    group.add(roadOffsetRibbon(road, offset, 2.55, busLaneMaterial));
    if (profile.travelLanes > 1) group.add(roadOffsetRibbon(road, -offset, 2.55, busLaneMaterial));
  }
  if (profile.bikeLanes) {
    group.add(roadOffsetRibbon(road, edgeOffset, 1.25, bikeLaneMaterial));
    if (profile.travelLanes > 1) group.add(roadOffsetRibbon(road, -edgeOffset, 1.25, bikeLaneMaterial));
  }
  if (profile.median) {
    const median = ribbon(road.points, 1.35, medianMaterial);
    median.position.y = .205;
    group.add(median);
  } else {
    group.add(roadCenterLine(road));
  }
  for (let divider = 1; divider < profile.travelLanes; divider++) {
    const offset = (divider - profile.travelLanes / 2) * 3;
    if (Math.abs(offset) < .2) continue;
    if (Math.abs(offset) > road.width / 2 - .5) continue;
    group.add(roadOffsetLine(road, offset));
  }
  if (profile.curbParking) {
    const parkingOffset = Math.max(0, road.width / 2 - 1.45);
    group.add(roadOffsetLine(road, parkingOffset, 0xe4e1d1, .42));
    if (profile.travelLanes > 1) group.add(roadOffsetLine(road, -parkingOffset, 0xe4e1d1, .42));
  }
  return group;
}

function roadTreeGeometry(roads: Road[]) {
  const positions: Array<{ x: number; z: number }> = [];
  for (const road of roads) {
    const profile = world.roadProfile(road);
    if (!profile.streetTrees) continue;
    const curve = new THREE.CatmullRomCurve3(
      road.points.map(point => new THREE.Vector3(point.x, 0, point.z)),
      false,
      "centripetal"
    );
    const count = Math.min(24, Math.max(2, Math.floor(curve.getLength() / 34)));
    for (let index = 1; index < count; index++) {
      const progress = index / count;
      const point = curve.getPoint(progress);
      const tangent = curve.getTangent(progress).normalize();
      const offset = road.width / 2 + profile.sidewalkWidth * .62;
      for (const side of [-1, 1]) {
        positions.push({
          x: point.x + tangent.z * offset * side,
          z: point.z - tangent.x * offset * side
        });
      }
    }
  }
  const group = new THREE.Group();
  if (!positions.length) return group;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.16, .22, 2.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x695441, roughness: 1 }),
    positions.length
  );
  const canopies = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.05, 1),
    new THREE.MeshStandardMaterial({ color: 0x607c59, roughness: 1 }),
    positions.length
  );
  const transform = new THREE.Object3D();
  positions.forEach((position, index) => {
    transform.position.set(position.x, 1.3, position.z);
    transform.updateMatrix();
    trunks.setMatrixAt(index, transform.matrix);
    transform.position.y = 3;
    const scale = .82 + (index % 5) * .055;
    transform.scale.setScalar(scale);
    transform.updateMatrix();
    canopies.setMatrixAt(index, transform.matrix);
    transform.scale.setScalar(1);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  group.add(trunks, canopies);
  return group;
}

function roadStructureGeometry(road: Road) {
  const group = new THREE.Group();
  const structure = world.roadStructure(road);
  if (structure.structure === "bridge") {
    const curve = new THREE.CatmullRomCurve3(
      road.points.map(point => new THREE.Vector3(point.x, 0, point.z)),
      false,
      "centripetal"
    );
    const supportCount = Math.max(1, Math.floor(curve.getLength() / 32));
    const concrete = new THREE.MeshStandardMaterial({ color: 0x7f8582, roughness: .9 });
    for (let index = 1; index <= supportCount; index += 1) {
      const point = curve.getPoint(index / (supportCount + 1));
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(.72, .95, structure.elevationMeters, 12),
        concrete
      );
      pillar.position.set(point.x, structure.elevationMeters / 2, point.z);
      pillar.castShadow = pillar.receiveShadow = true;
      group.add(pillar);
    }
  } else if (structure.structure === "tunnel") {
    const portalMaterial = new THREE.MeshStandardMaterial({ color: 0x555b58, roughness: .92 });
    for (const [index, point] of [road.points[0], road.points[road.points.length - 1]].entries()) {
      const neighbor = index === 0 ? road.points[1] : road.points[road.points.length - 2];
      const portal = new THREE.Group();
      portal.position.set(point.x, 0, point.z);
      portal.rotation.y = Math.atan2(neighbor.x - point.x, neighbor.z - point.z);
      const left = new THREE.Mesh(new THREE.BoxGeometry(.75, 3.8, 1.2), portalMaterial);
      const right = left.clone();
      left.position.set(-road.width / 2 - .38, 1.9, 0);
      right.position.set(road.width / 2 + .38, 1.9, 0);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(road.width + 1.5, .75, 1.2), portalMaterial);
      lintel.position.y = 3.45;
      portal.add(left, right, lintel);
      portal.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true; });
      group.add(portal);
    }
  }
  return group;
}

function rebuildExplorerRoadNavigation() {
  const key = world.roads
    .map(road => `${road.id}:${road.width}:${road.structure ?? "surface"}:${road.elevationMeters ?? 0}:${JSON.stringify(road.profile)}:${road.points.map(point => `${point.x.toFixed(2)},${point.z.toFixed(2)}`).join(";")}`)
    .join("|");
  if (key === explorerRoadKey) return;
  explorerRoadKey = key;
  explorerRoadPaths = buildExplorerRoadPaths(world.roads);
  const surfaceRoadIds = new Set(world.roads.filter(road => world.roadStructure(road).structure === "surface").map(road => road.id));
  streetIntersections = detectStreetIntersections(explorerRoadPaths.filter(path => surfaceRoadIds.has(path.roadId)));
  lastSignalMinute = -1;
  renderStreetFurniture();
}

function renderStreetFurniture() {
  streetFurnitureGroup.clear();
  streetFurnitureGroup.visible = mode === "explore";
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xf3efe3 });
  const rampMaterial = new THREE.MeshStandardMaterial({ color: 0xd1c5a7, roughness: 1 });
  for (const intersection of streetIntersections) {
    addCrossingSurface(intersection, intersection.tangentA, intersection.roadAWidth, "a", stripeMaterial, rampMaterial);
    addCrossingSurface(intersection, intersection.tangentB, intersection.roadBWidth, "b", stripeMaterial, rampMaterial);
  }
  updateTrafficSignals(true);
}

function addCrossingSurface(
  intersection: StreetIntersection,
  tangent: Point2,
  roadWidth: number,
  axis: "a" | "b",
  stripeMaterial: THREE.Material,
  rampMaterial: THREE.Material
) {
  const rotation = Math.atan2(tangent.x, tangent.z);
  for (let stripe = -3; stripe <= 3; stripe++) {
    const offset = stripe * .72;
    const crossing = new THREE.Mesh(
      new THREE.BoxGeometry(roadWidth * .84, .025, .38),
      stripeMaterial
    );
    crossing.position.set(
      intersection.point.x + tangent.x * offset,
      .355,
      intersection.point.z + tangent.z * offset
    );
    crossing.rotation.y = rotation;
    streetFurnitureGroup.add(crossing);
  }
  const normal = { x: tangent.z, z: -tangent.x };
  for (const side of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.9, .1, 1.55), rampMaterial);
    ramp.position.set(
      intersection.point.x + normal.x * side * (roadWidth / 2 + 1.25),
      .275,
      intersection.point.z + normal.z * side * (roadWidth / 2 + 1.25)
    );
    ramp.rotation.y = rotation;
    streetFurnitureGroup.add(ramp);
    addTrafficSignal(
      {
        x: intersection.point.x + normal.x * side * (roadWidth / 2 + 2.25),
        z: intersection.point.z + normal.z * side * (roadWidth / 2 + 2.25)
      },
      intersection,
      axis
    );
  }
}

function addTrafficSignal(position: Point2, intersection: StreetIntersection, axis: "a" | "b") {
  const signal = new THREE.Group();
  signal.position.set(position.x, .18, position.z);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(.09, .13, 4.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x545b57, roughness: .72, metalness: .28 })
  );
  pole.position.y = 2.2;
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(.62, 1.55, .52),
    new THREE.MeshStandardMaterial({ color: 0x202724, roughness: .78 })
  );
  housing.position.y = 4.2;
  signal.add(pole, housing);
  ([
    ["red", 4.65, 0xd94d43],
    ["yellow", 4.2, 0xe1b64f],
    ["green", 3.75, 0x5fc077]
  ] as const).forEach(([color, y, value]) => {
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(.17, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x17201b, emissive: 0x000000, emissiveIntensity: 0 })
    );
    lens.position.set(0, y, -.28);
    lens.userData.signalIntersection = intersection.id;
    lens.userData.signalAxis = axis;
    lens.userData.signalColor = color;
    lens.userData.signalValue = value;
    signal.add(lens);
  });
  streetFurnitureGroup.add(signal);
}

function updateTrafficSignals(force = false) {
  const minute = Math.floor(world.clock.elapsedMinutes);
  if (!force && minute === lastSignalMinute) return;
  lastSignalMinute = minute;
  const states = new Map(streetIntersections.map(intersection => [
    intersection.id,
    trafficSignalState(intersection.id, minute)
  ]));
  streetFurnitureGroup.traverse(object => {
    const mesh = object as THREE.Mesh;
    const intersectionId = mesh.userData.signalIntersection as string | undefined;
    if (!intersectionId || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
    const axis = mesh.userData.signalAxis as "a" | "b";
    const color = mesh.userData.signalColor as "red" | "yellow" | "green";
    const state = states.get(intersectionId) ?? "all-red";
    const activeColor = trafficSignalColor(state, axis);
    const active = color === activeColor;
    const value = mesh.userData.signalValue as number;
    mesh.material.color.setHex(active ? value : 0x17201b);
    mesh.material.emissive.setHex(active ? value : 0x000000);
    mesh.material.emissiveIntensity = active ? 1.8 : 0;
  });
}

function renderTransitInfrastructure() {
  transitGroup.clear();
  for (const line of world.transitLines) {
    if (line.route.length < 2) continue;
    const selected = line.id === selectedTransitLineId;
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(
      line.route.map(point => new THREE.Vector3(point.x, .34, point.z))
    );
    const route = new THREE.Line(
      routeGeometry,
      new THREE.LineBasicMaterial({
        color: line.color,
        transparent: true,
        opacity: mode === "city" && cityTool === "transit" ? selected ? .92 : .3 : .48
      })
    );
    transitGroup.add(route);
    for (const stop of line.stops) {
      const marker = new THREE.Group();
      marker.position.set(stop.position.x, .18, stop.position.z);
      const queueColor = stop.waiting >= line.vehicleCapacity
        ? 0xd9664f
        : stop.waiting >= line.vehicleCapacity * .45
          ? 0xe4ac57
          : line.color;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(.07, .1, 2.7, 8),
        new THREE.MeshStandardMaterial({ color: 0x4f5753, roughness: .72, metalness: .2 })
      );
      pole.position.y = 1.35;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(.65, .82, .14),
        new THREE.MeshStandardMaterial({ color: line.color, roughness: .62 })
      );
      sign.position.y = 2.55;
      const platform = new THREE.Mesh(
        new THREE.RingGeometry(.7, 1.02, 24),
        new THREE.MeshBasicMaterial({ color: queueColor, transparent: true, opacity: .68, side: THREE.DoubleSide })
      );
      platform.rotation.x = -Math.PI / 2;
      platform.position.y = .05;
      marker.add(pole, sign, platform);
      const transfers = world.transitTransfersAtStop(line, stop);
      if (transfers.length) {
        const transferRing = new THREE.Mesh(
          new THREE.RingGeometry(1.15, 1.36, 28),
          new THREE.MeshBasicMaterial({ color: 0xf0d980, transparent: true, opacity: .9, side: THREE.DoubleSide })
        );
        transferRing.rotation.x = -Math.PI / 2;
        transferRing.position.y = .07;
        marker.add(transferRing);
      }
      if (mode === "city" && cityTool === "transit" && selected) {
        const transferCopy = transfers.length ? ` · transfer ${transfers.map(transfer => transfer.lineName).join(" + ")}` : "";
        const label = makeLabel(`${stop.name} · ${stop.waiting} waiting${transferCopy}`);
        label.position.y = 5.1;
        label.scale.set(32, 5.5, 1);
        marker.add(label);
      }
      marker.userData.transitStopId = stop.id;
      transitGroup.add(marker);
    }
    if (mode === "city" && cityTool === "transit") {
      const midpoint = line.route[Math.floor(line.route.length / 2)];
      const projectedNet = world.transitMonthlyProjection(line) - world.transitMonthlyCost(line);
      const transfers = world.transitTransfersForLine(line);
      const label = makeLabel(
        `${selected ? "SELECTED · " : ""}${line.name} · every ${world.transitEffectiveHeadway(line)}m${world.transitEffectiveHeadway(line) < line.headwayMinutes ? " event service" : ""} · ${line.stops.length} stops · ${transfers.length} transfers · ${world.transitActiveFleetSize(line)} buses · ${transitFarePolicyLabel(line.fare)} · ${transitCrowdingLabel(world.transitLineCrowding(line))} · ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}`
      );
      label.position.set(midpoint.x, 10, midpoint.z);
      label.scale.set(110, 9, 1);
      transitGroup.add(label);
    }
  }
}

function entranceAccessLabel(entrance: AccessibilityEntrance) {
  if (world.entranceHasUniversalAccess(entrance)) return "Universal access";
  if (world.entranceIsUsable(entrance)) return "Step-free, upgrade available";
  return "Entrance barrier";
}

function entranceDestinationName(entrance: AccessibilityEntrance) {
  return world.accessibilityDestinations().find(destination => destination.entranceId === entrance.id)?.name
    ?? (entrance.targetKind === "park" ? "Park entrance" : entrance.targetKind === "transit" ? "Transit stop" : "Building entrance");
}

function closestAccessibilityEntrance(point: Point2, maximumDistance: number) {
  return world.accessibilityEntrances
    .map(entrance => ({
      entrance,
      distance: Math.hypot(entrance.position.x - point.x, entrance.position.z - point.z)
    }))
    .filter(candidate => candidate.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance)[0];
}

function renderAccessibilityEntrances() {
  accessibilityGroup.clear();
  const visible = mode === "explore" || mode === "city" && cityTool === "access";
  accessibilityGroup.visible = visible;
  if (!visible) return;
  const cityFocus = mode === "city" && cityTool === "access";
  for (const entrance of world.accessibilityEntrances) {
    const universal = world.entranceHasUniversalAccess(entrance);
    const usable = world.entranceIsUsable(entrance);
    const color = universal ? 0x54c995 : usable ? 0x6caed1 : 0xe49b56;
    const marker = new THREE.Group();
    marker.position.set(entrance.position.x, .2, entrance.position.z);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(cityFocus ? 2.8 : .72, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: cityFocus ? .92 : .66,
        side: THREE.DoubleSide
      })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = .06;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(cityFocus ? 3.4 : .94, cityFocus ? .18 : .08, 8, 24),
      new THREE.MeshBasicMaterial({ color })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .08;
    const hitTarget = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 5, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitTarget.position.y = 2.5;
    marker.add(pad, ring, hitTarget);
    if (cityFocus) {
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(.14, .22, 4.4, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 })
      );
      beacon.position.y = 2.25;
      const indicator = new THREE.Mesh(
        new THREE.OctahedronGeometry(.72),
        new THREE.MeshBasicMaterial({ color })
      );
      indicator.position.y = 4.8;
      marker.add(beacon, indicator);
    }
    marker.traverse(object => {
      object.userData.accessibilityEntranceId = entrance.id;
    });
    accessibilityGroup.add(marker);
  }
}

function placeTransitVehicle(vehicle: THREE.Object3D, pose: TransitVehiclePose) {
  const location = nearestRoadLocation(explorerRoadPaths, pose.point);
  const road = location ? world.roads.find(candidate => candidate.id === location.roadId) : undefined;
  const elevation = road ? world.roadStructure(road).elevationMeters : 0;
  vehicle.position.set(pose.point.x, elevation + .18, pose.point.z);
  vehicle.rotation.y = Math.atan2(-pose.tangent.x, -pose.tangent.z);
  vehicle.visible = true;
}

function ensureTransitFleet(count: number) {
  while (transitFleetGroup.children.length < count) {
    transitFleetGroup.add(createTransitVehicle());
  }
  while (transitFleetGroup.children.length > count) {
    transitFleetGroup.remove(transitFleetGroup.children[transitFleetGroup.children.length - 1]);
  }
}

function updateTransitVehicle(dt: number) {
  const preferredLineId = transitRide?.lineId ?? activeTransitVehicle?.lineId;
  const line = world.transitLines.find(item => item.id === preferredLineId) ?? world.transitLines[0];
  if (!line) {
    transitRide = null;
    activeTransitVehicle = null;
    transitVehicleGroup.visible = false;
    ensureTransitFleet(0);
    return;
  }
  if (activeTransitVehicle && activeTransitVehicle.lineId !== line.id) activeTransitVehicle = null;
  if (transitRide && transitRide.lineId !== line.id) transitRide = null;

  let pose: TransitVehiclePose | undefined;
  let arrivedStop: ReturnType<typeof advanceTransitRide>["arrivedStop"];
  if (transitRide) {
    const advanced = advanceTransitRide(transitRide, line, dt * 12);
    transitRide = advanced.ride;
    activeTransitVehicle = { ...advanced.ride, alightStopId: undefined };
    arrivedStop = advanced.arrivedStop;
    pose = transitPoseAtProgress(line, advanced.ride.progress, advanced.ride.direction, 2.5);
  } else if (activeTransitVehicle) {
    const advanced = advanceTransitRide(activeTransitVehicle, line, dt * 12);
    activeTransitVehicle = { ...advanced.ride, alightStopId: undefined };
    pose = transitPoseAtProgress(line, advanced.ride.progress, advanced.ride.direction, 2.5);
  }
  transitVehicleGroup.visible = Boolean(pose);
  if (pose) placeTransitVehicle(transitVehicleGroup, pose);

  const backgroundFleet = world.transitLines.flatMap(transitLine => {
    const effectiveLine = {
      ...transitLine,
      headwayMinutes: world.transitEffectiveHeadway(transitLine)
    };
    const fleet = scheduledTransitFleet(
      effectiveLine,
      world.clock.elapsedMinutes + simulationAccumulator,
      2.5
    );
    return activeTransitVehicle?.lineId === transitLine.id ? fleet.slice(1) : fleet;
  });
  ensureTransitFleet(backgroundFleet.length);
  backgroundFleet.forEach((vehicle, index) => {
    placeTransitVehicle(transitFleetGroup.children[index], vehicle.pose);
  });

  if (arrivedStop && pose) {
    completeTransitAlight(arrivedStop, pose);
    return;
  }
  if (!transitRide || mode !== "explore" || !pose) return;
  const desiredCamera = new THREE.Vector3(
    pose.point.x - pose.tangent.x * 12,
    6.4,
    pose.point.z - pose.tangent.z * 12
  );
  camera.position.lerp(desiredCamera, 1 - Math.exp(-5.5 * Math.max(dt, .001)));
  camera.lookAt(
    pose.point.x + pose.tangent.x * 7,
    1.65,
    pose.point.z + pose.tangent.z * 7
  );
  const nextFov = THREE.MathUtils.damp(camera.fov, photoMode ? photoFov : 59, 5, dt);
  if (Math.abs(nextFov - camera.fov) > .001) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
  updateExplorerMovementStatus(12);
}

function toggleTransitRide() {
  if (mode !== "explore" || explorerDriving) return;
  if (transitRide) {
    const line = world.transitLines.find(item => item.id === transitRide!.lineId);
    if (!line) return;
    const requested = requestTransitAlight(transitRide, line);
    transitRide = requested;
    activeTransitVehicle = { ...requested, alightStopId: undefined };
    const stop = line.stops.find(item => item.id === requested.alightStopId);
    updateExplorerContext();
    notice(stop ? `Stop requested: ${stop.name}` : "Stop requested");
    return;
  }
  const nearest = nearestTransitStop(
    world.transitLines,
    { x: camera.position.x, z: camera.position.z },
    14
  );
  if (!nearest) {
    notice("Move closer to a marked bus stop");
    return;
  }
  const passengerLoad = world.transitPassengerLoad(nearest.line);
  const ride = beginTransitRide(nearest.line, nearest.stop.id, passengerLoad);
  if (!ride) return;
  world.boardTransitPassenger(nearest.line.id, nearest.stop.id);
  transitRide = ride;
  activeTransitVehicle = { ...ride };
  clearAccessibleRoute();
  explorerVelocity.set(0, 0, 0);
  explorerVerticalOffset = 0;
  explorerVerticalVelocity = 0;
  explorerGrounded = true;
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  setPanel(
    "CITY TRANSIT",
    nearest.line.name,
    `Boarded at ${nearest.stop.name} with ${transitFarePolicyLabel(nearest.line.fare)}. ${ride.passengers}/${nearest.line.vehicleCapacity} passengers are aboard. Press T to request the next stop.`,
    "T|Request next stop;Esc|Return to City Builder"
  );
  updateTransitVehicle(0);
  updateExplorerContext();
  notice(`Boarded ${nearest.line.name} · ${ride.passengers}/${nearest.line.vehicleCapacity} aboard`);
}

function completeTransitAlight(stop: NonNullable<ReturnType<typeof advanceTransitRide>["arrivedStop"]>, pose: TransitVehiclePose) {
  transitRide = null;
  const spawn = findExplorerSpawn(stop.position);
  camera.position.set(spawn.x, 1.82, spawn.z);
  yaw = Math.atan2(-pose.tangent.x, -pose.tangent.z);
  pitch = -.05;
  camera.fov = photoMode ? photoFov : 55;
  camera.updateProjectionMatrix();
  requestExplorerPointerLock();
  setPanel(
    "CITY EXPLORER",
    `Arrived at ${stop.name}`,
    "You are back on the sidewalk. The bus continues along its route through the city.",
    "WASD|Walk;Mouse|Look;Shift|Sprint;Space|Jump;F|Enter home;T|Ride transit;E|Drive;R|Accessible route;Esc|Return"
  );
  updateExplorerMovementStatus(0);
  updateExplorerContext();
  notice(`Arrived at ${stop.name}`);
}

function explorerCollisionContext(playerRadius = .46) {
  return {
    landAreas: world.areas,
    lots: world.lots,
    services: world.services,
    parking: world.parking,
    playerRadius
  };
}

function findExplorerSpawn(preferred: Point2) {
  const context = explorerCollisionContext();
  const primary = sidewalkSpawn(
    explorerRoadPaths,
    preferred,
    2.2,
    candidate => isExplorerPositionValid(candidate, context)
  );
  if (isExplorerPositionValid(primary, context)) return primary;
  const nearest = nearestRoadLocation(explorerRoadPaths, preferred);
  if (!nearest) return preferred;
  const normal = { x: nearest.tangent.z, z: -nearest.tangent.x };
  const offset = nearest.width / 2 + 1.15;
  const alternative = {
    x: nearest.point.x - normal.x * offset * (nearest.signedDistance < 0 ? -1 : 1),
    z: nearest.point.z - normal.z * offset * (nearest.signedDistance < 0 ? -1 : 1)
  };
  return isExplorerPositionValid(alternative, context) ? alternative : primary;
}

function setInteriorSceneVisibility(inside: boolean) {
  water.visible = !inside;
  terrainGroup.visible = !inside;
  worldGroup.visible = !inside;
  streetFurnitureGroup.visible = !inside && mode === "explore";
  accessibilityGroup.visible = !inside && mode === "explore";
  accessibleRouteGroup.visible = !inside;
  transitGroup.visible = !inside;
  cityEventGroup.visible = !inside;
  previewGroup.visible = !inside;
  incidentGroup.visible = !inside;
  commuteGroup.visible = !inside;
  explorerVehicleGroup.visible = !inside && explorerVehicleParked;
  transitVehicleGroup.visible = !inside && Boolean(transitRide);
  transitFleetGroup.visible = !inside;
  homeGroup.visible = inside || mode === "home";
  syncSoundscape();
}

function toggleHomeInterior() {
  if (mode !== "explore" || explorerDriving || transitRide) return;
  const activeInterior = currentExplorerInterior();
  if (activeInterior) {
    const entrance = world.accessibilityEntrances.find(
      item => item.targetKind === "lot" && item.targetId === activeInterior.lot.id
    );
    const fallback = entrance?.position ?? activeInterior.lot.center;
    const exit = explorerExteriorReturn?.position ?? findExplorerSpawn(fallback);
    explorerInteriorHomeId = null;
    explorerInteriorFloor = 0;
    pendingConversationPartnerId = null;
    selectedLot = activeInterior.lot;
    world.setControlledResident();
    updateInteriorInteractionPrompt();
    setInteriorSceneVisibility(false);
    renderWorld();
    camera.position.set(exit.x, 1.82, exit.z);
    yaw = explorerExteriorReturn?.yaw ?? activeInterior.lot.rotation + Math.PI;
    pitch = -.05;
    explorerExteriorReturn = null;
    explorerVelocity.set(0, 0, 0);
    setPanel(
      "CITY EXPLORER",
      `Outside ${activeInterior.home.name}`,
      "You have returned to the street entrance. The home remains connected to this lot and its household simulation.",
      "WASD|Walk;Mouse|Look;F|Enter home;T|Ride transit;E|Drive;R|Accessible route;Esc|Return"
    );
    updateExplorerMovementStatus(0);
    updateExplorerContext();
    requestExplorerPointerLock();
    notice(`Exited ${activeInterior.home.name}`);
    return;
  }

  const playerPosition = { x: camera.position.x, z: camera.position.z };
  const nearby = world.accessibilityEntrances
    .filter(entrance => entrance.targetKind === "lot")
    .map(entrance => ({
      entrance,
      distance: Math.hypot(entrance.position.x - playerPosition.x, entrance.position.z - playerPosition.z)
    }))
    .filter(candidate => candidate.distance <= 6)
    .sort((first, second) => first.distance - second.distance)[0];
  if (!nearby) {
    notice("Move closer to a home entrance to enter");
    return;
  }
  const lot = world.lots.find(item => item.id === nearby.entrance.targetId);
  const home = lot ? world.homes.find(item => item.lotId === lot.id) : undefined;
  const status = homeEntryStatus(home, nearby.entrance);
  if (!status.allowed || !lot || !home) {
    notice(status.reason);
    updateExplorerContext();
    return;
  }
  const preferred = worldToLotLocal(nearby.entrance.position, lot);
  explorerExteriorReturn = {
    position: { x: camera.position.x, z: camera.position.z },
    yaw
  };
  explorerInteriorHomeId = home.id;
  pendingConversationPartnerId = null;
  selectedLot = lot;
  let selectedResident = controlledResidentId
    ? home.residents.find(resident => resident.id === controlledResidentId)
    : undefined;
  if (!selectedResident || world.residentStatus(selectedResident) !== "Home") {
    controlledResidentId = null;
    selectedResident = undefined;
  }
  explorerInteriorFloor = selectedResident ? Math.max(0, Math.min(home.floors - 1, Math.round(selectedResident.homeFloor ?? 0))) : 0;
  const floorHome = homeFloorView(home, explorerInteriorFloor);
  const entry = interiorEntryPoint(floorHome, explorerInteriorFloor === 0 ? preferred : undefined);
  if (!entry) {
    explorerInteriorHomeId = null;
    notice(`Floor ${explorerInteriorFloor + 1} has no clear place to enter`);
    return;
  }
  world.setControlledResident(controlledResidentId ?? undefined);
  clearAccessibleRoute();
  setInteriorSceneVisibility(true);
  renderHome();
  const controlledPosition = selectedResident && controlledResidentId
    ? residentInteriorPosition(floorHome, selectedResident, home.residents.indexOf(selectedResident))
    : entry;
  if (selectedResident && controlledResidentId) {
    world.setResidentHomePosition(home.id, selectedResident.id, controlledPosition, explorerInteriorFloor);
  }
  const worldEntry = lotLocalToWorld(controlledPosition, lot);
  camera.position.set(worldEntry.x, 2.02, worldEntry.z);
  const towardCenter = {
    x: lot.center.x - worldEntry.x,
    z: lot.center.z - worldEntry.z
  };
  yaw = Math.atan2(-towardCenter.x, -towardCenter.z);
  pitch = -.04;
  explorerVelocity.set(0, 0, 0);
  explorerVerticalOffset = 0;
  explorerVerticalVelocity = 0;
  explorerGrounded = true;
  setPanel(
    "HOME INTERIOR",
    home.name,
    "Choose a resident, walk them through the rooms, talk with household members, and use the furniture designed in Home Simulator. Household needs and city conditions continue while you are inside.",
    "C|Choose resident;WASD|Walk;Mouse|Look;E|Talk or interact;F|Exit home;Esc|Return to City Builder"
  );
  updateExplorerMovementStatus(0);
  updateExplorerContext();
  updateInteriorInteractionPrompt();
  requestExplorerPointerLock();
  notice(`Entered ${home.name}`);
}

function requestExplorerPointerLock() {
  if (document.pointerLockElement === renderer.domElement) return;
  renderer.domElement.requestPointerLock().catch(() => {
    notice("Click the city view to capture the mouse");
  });
}

function parkingVehiclePose(facility: ParkingFacility) {
  if (facility.kind !== "garage") {
    return { position: facility.position, heading: facility.rotation };
  }
  const forward = {
    x: -Math.sin(facility.rotation),
    z: -Math.cos(facility.rotation)
  };
  return {
    position: {
      x: facility.position.x - forward.x * 13.2,
      z: facility.position.z - forward.z * 13.2
    },
    heading: facility.rotation
  };
}

function clearAccessibleRoute() {
  accessibleRouteSummary = null;
  accessibleRouteGroup.clear();
}

const accessibilityKindOrder: AccessibilityDestinationKind[] = [
  "home",
  "business",
  "park",
  "transit",
  "parking"
];

function accessibilityKindLabel(kind: AccessibilityDestinationKind) {
  return {
    home: "home",
    business: "business",
    park: "park",
    transit: "transit stop",
    parking: "parking"
  }[kind];
}

function accessibleDestinationCandidates(): AccessibilityDestination[] {
  const destinations = world.accessibilityDestinations();
  for (const facility of world.parking) {
    if (
      facility.accessibleSpaces <= 0
      || facility.occupied >= facility.capacity
      || !world.parkingPermitted(facility)
    ) continue;
    const pose = parkingVehiclePose(facility);
    const position = sidewalkSpawn(
      explorerRoadPaths,
      pose.position,
      2.2,
      candidate => isExplorerPositionValid(candidate, explorerCollisionContext())
    );
    destinations.push({
      id: `access-destination-parking-${facility.id}`,
      kind: "parking",
      sourceId: facility.id,
      entranceId: "",
      name: parkingKindLabel(facility.kind),
      position,
      usable: true
    });
  }
  return destinations;
}

function toggleAccessibleRoute() {
  if (mode !== "explore" || explorerDriving || transitRide) return;
  const start = { x: camera.position.x, z: camera.position.z };
  const destinations = accessibleDestinationCandidates();
  if (!destinations.length) {
    notice("Build a home, business, park, transit stop, or parking facility before planning a route");
    return;
  }

  let destination: AccessibilityDestination | undefined;
  if (!accessibleRouteSummary && selectedLot) {
    destination = destinations.find(item =>
      item.sourceId === selectedLot!.id && (item.kind === "home" || item.kind === "business")
    );
    if (destination) accessibilityKindIndex = accessibilityKindOrder.indexOf(destination.kind);
  }
  if (!destination) {
    for (let offset = 1; offset <= accessibilityKindOrder.length; offset++) {
      const index = (accessibilityKindIndex + offset + accessibilityKindOrder.length) % accessibilityKindOrder.length;
      const candidate = nearestAccessibilityDestination(destinations, start, accessibilityKindOrder[index]);
      if (!candidate) continue;
      accessibilityKindIndex = index;
      destination = candidate.destination;
      break;
    }
  }
  if (!destination) return;

  const assessment = assessAccessibleTrip(explorerRoadPaths, streetIntersections, start, destination);
  const route = assessment.route;
  const entrance = destination.entranceId
    ? world.accessibilityEntrances.find(item => item.id === destination!.entranceId)
    : undefined;
  const barriers = [...assessment.barriers];
  if (entrance && !entrance.tactileGuidance) barriers.push("No tactile guidance");

  clearAccessibleRoute();
  accessibleRouteSummary = {
    destinationId: destination.id,
    destinationKind: destination.kind,
    destinationName: destination.name,
    sourceId: destination.sourceId,
    entranceId: destination.entranceId || undefined,
    distance: route?.distance,
    rampedCrossings: route?.rampedCrossings ?? 0,
    usable: assessment.usable,
    barriers
  };
  if (route && route.points.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(
      route.points.map(point => new THREE.Vector3(point.x, .42, point.z)),
      false,
      "centripetal"
    );
    const routeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(12, route.points.length * 2), .14, 7, false),
      new THREE.MeshBasicMaterial({
        color: assessment.usable ? 0x62d3ce : 0xe19a4e,
        transparent: true,
        opacity: .92
      })
    );
    accessibleRouteGroup.add(routeMesh);
  }
  const target = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.75, 32),
    new THREE.MeshBasicMaterial({
      color: assessment.usable ? 0x8aeee5 : 0xf1ac5d,
      side: THREE.DoubleSide
    })
  );
  target.rotation.x = -Math.PI / 2;
  target.position.set(destination.position.x, .46, destination.position.z);
  accessibleRouteGroup.add(target);
  updateExplorerContext();
  notice(
    assessment.usable
      ? `Usable route to ${destination.name} · ${Math.round(route!.distance)}m`
      : `Route review: ${barriers.join(" · ")}`
  );
}

function parkExplorerVehicle() {
  if (!explorerDriving) return;
  if (Math.abs(explorerVehicleSpeed) > 2.2) {
    notice("Slow below 8 km/h before parking");
    return;
  }
  const position = {
    x: explorerVehicleGroup.position.x,
    z: explorerVehicleGroup.position.z
  };
  const facility = nearestParkingFacility(
    world.parking.filter(item => world.parkingPermitted(item)),
    position,
    18
  );
  if (!facility) {
    const restrictedCurb = closestCurbFacility(position, 18);
    notice(
      restrictedCurb && !world.parkingPermitted(restrictedCurb.facility)
        ? `${curbUseLabel(world.curbEffectiveUse(restrictedCurb.facility))} is active here. Parking is prohibited.`
        : "Move closer to an available parking bay or garage"
    );
    return;
  }
  const pose = parkingVehiclePose(facility);
  if (!world.parkPlayerVehicle(facility.id, pose.position, pose.heading)) {
    notice("That parking facility is full");
    return;
  }
  explorerVehicleGroup.position.set(pose.position.x, .16, pose.position.z);
  explorerVehicleGroup.rotation.y = pose.heading;
  explorerVehicleHeading = pose.heading;
  explorerVehicleSpeed = 0;
  explorerDriving = false;
  explorerVehicleParked = true;
  const exit = findExplorerSpawn(pose.position);
  camera.position.set(exit.x, 1.82, exit.z);
  yaw = pose.heading;
  pitch = -.05;
  setPanel(
    "CITY EXPLORER",
    "Vehicle parked",
    `${parkingKindLabel(facility.kind)} charges ${formatParkingRate(facility.hourlyRate)} and has ${facility.capacity - facility.occupied} spaces available. ${parkingPressureLabel(facility)}. ${facility.accessibleSpaces} spaces are designated accessible.`,
    "WASD|Walk;Mouse|Look;Shift|Sprint;Space|Jump;F|Enter home;T|Ride transit;E|Drive;R|Accessible route;Esc|Return"
  );
  updateExplorerMovementStatus(0);
  notice(`Parked in ${parkingKindLabel(facility.kind).toLowerCase()} · ${formatParkingRate(facility.hourlyRate)}`);
}

function toggleExplorerVehicle() {
  if (mode !== "explore" || transitRide) return;
  if (explorerDriving) {
    explorerDriving = false;
    explorerVehicleSpeed = 0;
    const exit = findExplorerSpawn({
      x: explorerVehicleGroup.position.x,
      z: explorerVehicleGroup.position.z
    });
    camera.position.set(exit.x, 1.82, exit.z);
    yaw = explorerVehicleHeading;
    pitch = -.05;
    world.rememberPlayerVehicle({
      x: explorerVehicleGroup.position.x,
      z: explorerVehicleGroup.position.z
    }, explorerVehicleHeading);
    requestExplorerPointerLock();
    setPanel(
      "CITY EXPLORER",
      "Walk the living city",
      "Follow continuous sidewalks, cross the roadway, enter parks, and move around the same buildings created in City Builder.",
      "WASD|Walk;Mouse|Look;Shift|Sprint;Space|Jump;F|Enter home;T|Ride transit;E|Drive;R|Accessible route;O|Photo mode;Esc|Return"
    );
    updateExplorerContext();
    notice("Vehicle parked. Returned to the sidewalk");
    return;
  }

  const player = { x: camera.position.x, z: camera.position.z };
  const parkedDistance = Math.hypot(
    explorerVehicleGroup.position.x - player.x,
    explorerVehicleGroup.position.z - player.z
  );
  if (!explorerVehicleParked || parkedDistance > 12) {
    const road = nearestRoadLocation(explorerRoadPaths, player);
    if (!road) {
      notice("Build a road before entering a vehicle");
      return;
    }
    const cameraForward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const direction = cameraForward.x * road.tangent.x + cameraForward.z * road.tangent.z < 0
      ? { x: -road.tangent.x, z: -road.tangent.z }
      : road.tangent;
    explorerVehicleHeading = Math.atan2(-direction.x, -direction.z);
    explorerVehicleGroup.position.set(road.point.x, .16, road.point.z);
    explorerVehicleGroup.rotation.y = explorerVehicleHeading;
    explorerVehicleParked = true;
  }
  explorerDriving = true;
  explorerVehicleSpeed = 0;
  clearAccessibleRoute();
  world.releasePlayerVehicle({
    x: explorerVehicleGroup.position.x,
    z: explorerVehicleGroup.position.z
  }, explorerVehicleHeading);
  explorerVehicleGroup.visible = true;
  explorerVelocity.set(0, 0, 0);
  setPanel(
    "CITY EXPLORER",
    "Driving the city",
    "Drive the same freeform road network used by commuters and emergency crews. Leaving the roadway slows the vehicle, while buildings and shorelines remain solid.",
    "W / S|Accelerate / brake;A / D|Steer;Space|Handbrake;P|Park;E|Exit to sidewalk;Esc|Return"
  );
  notice("Vehicle ready");
}

function updateExplorerMovementStatus(speed: number) {
  if (mode !== "explore") return;
  const interior = currentExplorerInterior();
  if (interior) {
    const floorHome = homeFloorView(interior.home, explorerInteriorFloor);
    const local = worldToLotLocal(
      { x: camera.position.x, z: camera.position.z },
      interior.lot
    );
    const room = interiorRoomAt(floorHome, local);
    const pace = explorerBlocked && speed < .4
      ? "Blocked"
      : speed < .35
        ? "Standing"
        : speed < 6.2
          ? "Walking"
          : "Moving quickly";
    const controlled = controlledInteriorResident();
    document.querySelector("#explorer-location")!.textContent = `${controlled?.resident.name ?? interior.home.name} · Floor ${explorerInteriorFloor + 1}`;
    document.querySelector("#explorer-surface")!.textContent = room?.kind ?? `Floor ${explorerInteriorFloor + 1} landing`;
    document.querySelector("#explorer-pace")!.textContent = pace;
    updateInteriorInteractionPrompt();
    return;
  }
  const position = transitRide
    ? { x: transitVehicleGroup.position.x, z: transitVehicleGroup.position.z }
    : explorerDriving
      ? { x: explorerVehicleGroup.position.x, z: explorerVehicleGroup.position.z }
      : { x: camera.position.x, z: camera.position.z };
  const roadLocation = nearestRoadLocation(explorerRoadPaths, position);
  const park = world.areas.find(area => area.kind === "park" && pointInPolygon(position, area.points));
  const district = world.areas.find(area => area.kind === "district" && pointInPolygon(position, area.points));
  const surface = explorerSurface(roadLocation);
  const onRoad = Boolean(roadLocation && roadLocation.distance <= roadLocation.width / 2 + 1.2);
  const surfaceLabel = transitRide
    ? "Public transit"
    : explorerDriving
      ? onRoad ? "Roadway" : "Off road"
      : park && surface === "City block" ? "Park path" : surface;
  const nearbyRoad = roadLocation && roadLocation.distance <= roadLocation.width / 2 + 14;
  const transitLine = transitRide
    ? world.transitLines.find(line => line.id === transitRide!.lineId)
    : undefined;
  const location = transitLine?.name ?? (nearbyRoad ? roadLocation.roadName : park?.name ?? district?.name ?? "City block");
  const pace = transitRide
    ? `Riding bus · ${transitRide.passengers} aboard`
    : explorerDriving
      ? `Driving ${Math.round(Math.abs(explorerVehicleSpeed) * 3.6)} km/h`
      : !explorerGrounded
        ? "Airborne"
        : explorerBlocked && speed < .4
          ? "Blocked"
          : speed < .35
            ? "Standing"
            : speed < 6.2
              ? "Walking"
              : "Sprinting";
  document.querySelector("#explorer-location")!.textContent = location;
  document.querySelector("#explorer-surface")!.textContent = surfaceLabel;
  document.querySelector("#explorer-pace")!.textContent = pace;
}

function updateExplorerVehicle(dt: number) {
  const accelerating = keys.has("KeyW");
  const braking = keys.has("KeyS");
  if (accelerating) explorerVehicleSpeed += 10.5 * dt;
  else if (braking) explorerVehicleSpeed += explorerVehicleSpeed > 0 ? -18 * dt : -6.5 * dt;
  else explorerVehicleSpeed = THREE.MathUtils.damp(explorerVehicleSpeed, 0, 1.15, dt);
  if (keys.has("Space")) explorerVehicleSpeed = THREE.MathUtils.damp(explorerVehicleSpeed, 0, 8, dt);
  explorerVehicleSpeed = THREE.MathUtils.clamp(explorerVehicleSpeed, -7, 28);

  const steering = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
  if (steering && Math.abs(explorerVehicleSpeed) > .12) {
    const direction = explorerVehicleSpeed >= 0 ? 1 : -1;
    const authority = THREE.MathUtils.clamp(Math.abs(explorerVehicleSpeed) / 7, .22, 1);
    explorerVehicleHeading += steering * direction * authority * 1.42 * dt;
  }
  const forward = {
    x: -Math.sin(explorerVehicleHeading),
    z: -Math.cos(explorerVehicleHeading)
  };
  const current = {
    x: explorerVehicleGroup.position.x,
    z: explorerVehicleGroup.position.z
  };
  const candidate = {
    x: current.x + forward.x * explorerVehicleSpeed * dt,
    z: current.z + forward.z * explorerVehicleSpeed * dt
  };
  const currentRoad = nearestRoadLocation(explorerRoadPaths, current);
  const candidateRoad = nearestRoadLocation(explorerRoadPaths, candidate);
  const enteringClosedRoad = Boolean(
    candidateRoad
    && candidateRoad.distance <= candidateRoad.width / 2 + 1.2
    && world.cityEventRoadClosure(candidateRoad.roadId)
    && currentRoad?.roadId !== candidateRoad.roadId
  );
  const movement = enteringClosedRoad
    ? { position: current, blocked: true }
    : resolveExplorerMovement(current, candidate, explorerCollisionContext(1.35));
  explorerBlocked = movement.blocked;
  if (movement.blocked && Math.hypot(
    movement.position.x - candidate.x,
    movement.position.z - candidate.z
  ) > .08) {
    explorerVehicleSpeed = 0;
  }
  if (enteringClosedRoad) explorerVehicleSpeed = 0;
  explorerVehicleGroup.position.set(movement.position.x, .16, movement.position.z);
  explorerVehicleGroup.rotation.y = explorerVehicleHeading;

  const roadLocation = nearestRoadLocation(explorerRoadPaths, movement.position);
  const offRoad = !roadLocation || roadLocation.distance > roadLocation.width / 2 + 1.2;
  if (offRoad) explorerVehicleSpeed = THREE.MathUtils.damp(explorerVehicleSpeed, 0, 2.1, dt);

  const desiredCamera = new THREE.Vector3(
    movement.position.x - forward.x * 7.4,
    4.7,
    movement.position.z - forward.z * 7.4
  );
  camera.position.lerp(desiredCamera, 1 - Math.exp(-6.5 * dt));
  camera.lookAt(
    movement.position.x + forward.x * 4,
    1.05,
    movement.position.z + forward.z * 4
  );
  const targetFov = photoMode ? photoFov : 57 + Math.min(7, Math.abs(explorerVehicleSpeed) * .22);
  const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 5, dt);
  if (Math.abs(nextFov - camera.fov) > .001) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
  updateExplorerMovementStatus(Math.abs(explorerVehicleSpeed));
}

function planningHeatColor(healthyScore: number) {
  const score = THREE.MathUtils.clamp(healthyScore, 0, 1);
  if (score <= .5) return new THREE.Color(0xd95f52).lerp(new THREE.Color(0xe8c96a), score * 2).getHex();
  return new THREE.Color(0xe8c96a).lerp(new THREE.Color(0x68b77c), (score - .5) * 2).getHex();
}

function lotPlanningValue(
  lot: Lot,
  view: CityView,
  totalPopulation: number,
  effectiveStaffing: number,
  roadTraffic: Map<string, number>
) {
  if (view === "traffic") {
    return roadTraffic.get(lot.roadId) ?? 0;
  }
  if (view === "utilities") return world.lotUtilityReliability(lot, totalPopulation, effectiveStaffing) / 100;
  if (view === "wellbeing") return world.lotWellbeing(lot, totalPopulation, effectiveStaffing) / 100;
  if (view === "voices") return world.lotWellbeing(lot, totalPopulation, effectiveStaffing) / 100;
  if (view === "land-value") return world.lotLandValue(lot, totalPopulation, effectiveStaffing) / 100;
  if (view === "pollution") return world.lotEnvironmentalQuality(lot).score / 100;
  if (view === "environment") return 1 - world.lotEnvironmentalConstraintScore(lot);
  if (view === "development") return lot.zone === "unassigned" ? 0 : world.constructionProgress(lot);
  return 1;
}

function lotPlanningColor(view: CityView, value: number) {
  if (view === "traffic") return 0x66716a;
  if (view === "development") {
    if (value >= 1) return 0x70b4d0;
    return new THREE.Color(0x66716a).lerp(new THREE.Color(0xd7a956), Math.max(.18, value)).getHex();
  }
  return planningHeatColor(value);
}

function trafficPlanningMaterial(pressure: number) {
  const color = planningHeatColor(1 - pressure);
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .08, roughness: .9 });
}

function syncSoundscape() {
  const focus = worldRenderFocus();
  const averageTrafficPressure = world.roads.length
    ? world.roads.reduce((total, road) => total + world.roadTrafficPressure(road), 0) / world.roads.length
    : 0;
  const nearestRoad = nearestRoadLocation(explorerRoadPaths, focus);
  const localRoad = nearestRoad ? world.roads.find(road => road.id === nearestRoad.roadId) : undefined;
  const trafficPressure = mode === "city" || !localRoad
    ? averageTrafficPressure
    : world.roadTrafficPressure(localRoad);
  const sheltered = mode === "home" || Boolean(explorerInteriorHomeId);
  const eventRange = mode === "city" ? 520 : sheltered ? 180 : 190;
  const nearbyEvent = closestActiveCityEvent(focus, eventRange);
  const crowd = nearbyEvent ? 1 - nearbyEvent.distance / eventRange : 0;
  const transitPositions = [transitVehicleGroup, ...transitFleetGroup.children]
    .filter(vehicle => vehicle.visible);
  const transitDistance = transitPositions.length
    ? Math.min(...transitPositions.map(vehicle => Math.hypot(vehicle.position.x - focus.x, vehicle.position.z - focus.z)))
    : Number.POSITIVE_INFINITY;
  const transit = transitRide ? 1 : Math.max(0, 1 - transitDistance / (mode === "city" ? 360 : 75));
  const emergencyRange = mode === "city" ? 560 : sheltered ? 180 : 160;
  const emergencyDistance = world.activeIncidents()
    .map(incident => world.lots.find(lot => lot.id === incident.lotId))
    .filter((lot): lot is Lot => Boolean(lot))
    .reduce((nearest, lot) => Math.min(nearest, Math.hypot(lot.center.x - focus.x, lot.center.z - focus.z)), Number.POSITIVE_INFINITY);
  const emergency = Math.max(0, 1 - emergencyDistance / emergencyRange);
  const profile = soundscapeProfile(
    explorerInteriorHomeId ? "home" : mode,
    world.weather(),
    world.clock.minute / 60,
    trafficPressure,
    {
      crowd,
      vehicle: explorerDriving ? Math.min(1, Math.abs(explorerVehicleSpeed) * 3.6 / 80) : 0,
      transit,
      emergency
    }
  );
  soundscape.update(profile);
  const button = document.querySelector<HTMLButtonElement>("#sound-toggle");
  if (button) {
    button.textContent = soundscape.enabled ? `Sound on · ${profile.label}${profile.focus === "Ambient" ? "" : ` · ${profile.focus}`}` : "Sound off";
    button.setAttribute("aria-pressed", String(soundscape.enabled));
  }
  return profile;
}

function applyUiPreferences() {
  document.body.classList.toggle("reduced-motion", uiPreferences.reducedMotion);
  document.body.classList.toggle("high-contrast", uiPreferences.highContrast);
  document.querySelector<HTMLInputElement>("#preference-reduced-motion")!.checked = uiPreferences.reducedMotion;
  document.querySelector<HTMLInputElement>("#preference-high-contrast")!.checked = uiPreferences.highContrast;
  document.querySelector<HTMLInputElement>("#preference-starter")!.checked = uiPreferences.showStarterJourney;
}

function syncSimulationSpeedControls() {
  document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.speed) === simulationSpeed);
  });
}

function pauseForModal() {
  if (modalResumeSpeed === null) modalResumeSpeed = simulationSpeed;
  simulationSpeed = 0;
  syncSimulationSpeedControls();
}

function resumeAfterModal() {
  const modalOpen = ["#controls-guide", "#preferences-panel", "#resident-creator"]
    .some(selector => !document.querySelector<HTMLElement>(selector)!.hidden);
  if (modalOpen || modalResumeSpeed === null) return;
  simulationSpeed = modalResumeSpeed;
  modalResumeSpeed = null;
  syncSimulationSpeedControls();
}

function saveUiPreferences() {
  localStorage.setItem("gridless-ui-preferences-v1", JSON.stringify(uiPreferences));
  applyUiPreferences();
}

applyUiPreferences();

function renderStarterJourney() {
  const panel = document.querySelector<HTMLElement>("#starter-journey");
  if (!panel) return;
  panel.classList.toggle("dismissed", starterJourneyDismissed);
  const steps = [
    {
      id: "zone",
      label: "Shape a neighborhood",
      detail: "Zone at least one parcel",
      complete: world.lots.some(lot => lot.zone !== "unassigned")
    },
    {
      id: "service",
      label: "Support city life",
      detail: "Place a municipal service",
      complete: world.services.length > 0
    },
    {
      id: "explore",
      label: "Walk your streets",
      detail: "Enter City Explorer",
      complete: localStorage.getItem("gridless-starter-explored") === "1"
    },
    {
      id: "home",
      label: "Make a home personal",
      detail: "Add a room, object, or resident",
      complete: world.homes.some(home => home.rooms.length > 1 || home.furniture.length > 0 || home.residents.length > 0)
    }
  ];
  const complete = steps.filter(step => step.complete).length;
  document.querySelector("#starter-progress")!.textContent = complete === steps.length ? "Journey complete" : `${complete} of ${steps.length} complete`;
  document.querySelector("#starter-steps")!.innerHTML = steps.map((step, index) => `
    <button data-starter-step="${step.id}" class="${step.complete ? "complete" : ""}" ${step.complete ? "disabled" : ""}>
      <i>${step.complete ? "✓" : index + 1}</i><span><strong>${step.label}</strong><small>${step.complete ? "Complete" : step.detail}</small></span>
    </button>
  `).join("");
}

function renderWorld() {
  syncSoundscape();
  updateHistoryControls();
  scheduleAutosave();
  renderStarterJourney();
  document.querySelector("#city-name-label")!.textContent = world.cityName;
  syncRoadTargetOptions();
  updateRoadProfileSummary();
  syncEconomyControls();
  const cityNameInput = document.querySelector<HTMLInputElement>("#city-name-input")!;
  if (document.activeElement !== cityNameInput) cityNameInput.value = world.cityName;
  const templateSelect = document.querySelector<HTMLSelectElement>("#template-select")!;
  templateSelect.value = pendingTemplateId;
  document.querySelector("#region-foundation-summary")!.textContent = WORLD_TEMPLATES[pendingTemplateId].description;
  document.title = `${world.cityName} · Gridless`;
  if (selectedLot) selectedLot = world.lots.find(lot => lot.id === selectedLot!.id) ?? null;
  if (!explorerDriving && world.playerVehicle) {
    explorerVehicleGroup.position.set(world.playerVehicle.position.x, .16, world.playerVehicle.position.z);
    explorerVehicleGroup.rotation.y = world.playerVehicle.heading;
    explorerVehicleHeading = world.playerVehicle.heading;
    explorerVehicleParked = true;
    explorerVehicleGroup.visible = mode === "explore";
  }
  rebuildExplorerRoadNavigation();
  renderTransitInfrastructure();
  renderTerrain();
  worldGroup.clear();
  const renderFocus = worldRenderFocus();
  const activeCityView: CityView = mode === "city" ? cityView : "normal";
  const totalPopulation = Math.max(1, world.cityEconomy().population);
  const effectiveStaffing = world.effectiveStaffing();
  const roadTraffic = new Map(activeCityView === "traffic"
    ? world.roads.map(road => [road.id, world.roadTrafficPressure(road)] as const)
    : []);
  const spatialRenderPlan = world.spatialRenderPlan(renderFocus);
  renderedSpatialTierSignature = spatialTierSignature(renderFocus);
  const detailedLotIds = new Set(spatialRenderPlan.detailedLotIds);
  const agentLotIds = new Set(spatialRenderPlan.agentChunks.flatMap(chunk => chunk.lotIds));
  const detailedRoadIds = new Set(spatialRenderPlan.detailedRoadIds);
  let aggregateChunks = spatialRenderPlan.aggregateChunks;
  if (selectedLot) {
    const selectedChunk = aggregateChunks.find(chunk => chunk.lotIds.includes(selectedLot!.id));
    if (selectedChunk) {
      selectedChunk.lotIds.forEach(id => detailedLotIds.add(id));
      selectedChunk.roadIds.forEach(id => detailedRoadIds.add(id));
      aggregateChunks = aggregateChunks.filter(chunk => chunk.id !== selectedChunk.id);
    }
  }
  for (const road of world.roads) {
    const profile = world.roadProfile(road);
    const elevation = world.roadStructure(road).elevationMeters;
    const curb = ribbon(road.points, road.width + profile.sidewalkWidth * 2 + 1.2, curbMaterial);
    curb.position.y = elevation;
    worldGroup.add(curb);
    const sidewalk = ribbon(road.points, road.width + profile.sidewalkWidth * 2, sidewalkMaterial);
    sidewalk.position.y = elevation + .08;
    worldGroup.add(sidewalk);
  }
  for (const road of world.roads) {
    const elevation = world.roadStructure(road).elevationMeters;
    const activeRoadMaterial = activeCityView === "traffic"
      ? trafficPlanningMaterial(roadTraffic.get(road.id) ?? 0)
      : roadMaterial;
    const roadway = ribbon(road.points, road.width, activeRoadMaterial);
    roadway.position.y = elevation + (road.class === "arterial" ? .166 : road.class === "avenue" ? .163 : .16);
    worldGroup.add(roadway);
    if (activeCityView === "normal" && detailedRoadIds.has(road.id)) {
      const details = roadProfileGeometry(road);
      details.position.y = elevation;
      worldGroup.add(details, roadStructureGeometry(road));
    }
  }
  if (activeCityView === "normal") {
    worldGroup.add(roadTreeGeometry(world.roads.filter(road => detailedRoadIds.has(road.id) && world.roadStructure(road).structure === "surface")));
  }
  for (const intersection of streetIntersections) {
    const width = Math.max(intersection.roadAWidth, intersection.roadBWidth);
    const roadA = world.roads.find(road => road.id === intersection.roadAId);
    const roadB = world.roads.find(road => road.id === intersection.roadBId);
    const sidewalkWidth = Math.max(
      roadA ? world.roadProfile(roadA).sidewalkWidth : 2.2,
      roadB ? world.roadProfile(roadB).sidewalkWidth : 2.2
    );
    const curbJunction = new THREE.Mesh(
      new THREE.CircleGeometry((width + sidewalkWidth * 2 + 1.2) * .56, 32),
      curbMaterial
    );
    curbJunction.rotation.x = -Math.PI / 2;
    curbJunction.position.set(intersection.point.x, .15, intersection.point.z);
    worldGroup.add(curbJunction);
    const sidewalkJunction = new THREE.Mesh(
      new THREE.CircleGeometry((width + sidewalkWidth * 2) * .56, 32),
      sidewalkMaterial
    );
    sidewalkJunction.rotation.x = -Math.PI / 2;
    sidewalkJunction.position.set(intersection.point.x, .23, intersection.point.z);
    worldGroup.add(sidewalkJunction);
    const junctionPressure = activeCityView === "traffic"
      ? Math.max(
          roadTraffic.get(intersection.roadAId) ?? 0,
          roadTraffic.get(intersection.roadBId) ?? 0
        )
      : 0;
    const roadwayJunction = new THREE.Mesh(
      new THREE.CircleGeometry(width * .56, 32),
      activeCityView === "traffic" ? trafficPlanningMaterial(junctionPressure) : roadMaterial
    );
    roadwayJunction.rotation.x = -Math.PI / 2;
    roadwayJunction.position.set(intersection.point.x, .31, intersection.point.z);
    worldGroup.add(roadwayJunction);
  }
  for (const utility of world.utilities) {
    const failure = world.activeUtilityFailures(utility.kind).find(item =>
      item.targetType === "line" && item.targetId === utility.id
    );
    const material = new THREE.MeshBasicMaterial({
      color: failure ? 0xf06e54 : utilityColor(utility.kind),
      transparent: true,
      opacity: failure ? .92 : mode === "city" && cityTool === "utility" ? .95 : .32 + utility.condition / 100 * .14,
      depthWrite: false
    });
    const network = ribbon(utility.points, utility.kind === "power" ? 1.4 : 2.2, material);
    network.position.y = utility.kind === "power" ? .45 : .08;
    worldGroup.add(network);
    if (utility.kind === "power") {
      utility.points.forEach(point => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0x55544b }));
        pole.position.set(point.x, 2.75, point.z);
        worldGroup.add(pole);
      });
    }
  }
  for (const service of world.services) {
    if (mode === "city" && cityTool === "service") {
      const coverage = new THREE.Mesh(
        new THREE.CircleGeometry(service.radius, 64),
        new THREE.MeshBasicMaterial({ color: serviceColor(service.kind), transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide })
      );
      coverage.rotation.x = -Math.PI / 2;
      coverage.position.set(service.position.x, .24, service.position.z);
      worldGroup.add(coverage);
    }
    worldGroup.add(createServiceBuilding(service));
  }
  for (const facility of world.parking) {
    worldGroup.add(createParkingFacility(facility));
  }
  for (const chunk of aggregateChunks) {
    worldGroup.add(createAggregateChunkMassing(chunk, activeCityView));
  }
  const cityBuildingInstances: Array<{ lot: Lot; height: number; width: number; depth: number; color: number }> = [];
  const cityMixedUsePodiums: Array<{ lot: Lot; height: number; width: number; depth: number; color: number }> = [];
  for (const lot of world.lots) {
    if (!detailedLotIds.has(lot.id)) continue;
    const planningValue = lotPlanningValue(lot, activeCityView, totalPopulation, effectiveStaffing, roadTraffic);
    const planningColor = lotPlanningColor(activeCityView, planningValue);
    const planningMaterial = activeCityView === "normal"
      ? zoneLotMaterials[lot.zone]
      : new THREE.MeshBasicMaterial({ color: planningColor, transparent: true, opacity: .76, side: THREE.DoubleSide });
    const lotMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(lot.width, lot.depth),
      lot.id === selectedLot?.id ? lotSelectedMaterial : planningMaterial
    );
    lotMesh.rotation.set(-Math.PI / 2, 0, lot.rotation);
    lotMesh.position.set(lot.center.x, .105, lot.center.z);
    lotMesh.userData.lotId = lot.id;
    worldGroup.add(lotMesh);
    if (mode === "city" && cityTool === "inspect" && lot.id === selectedLot?.id) {
      const summary = makeLabel(`${world.lotPopulation(lot)} residents · ${world.lotJobs(lot)} jobs`);
      summary.position.set(lot.center.x, zoneBuildingHeight(lot.zone, hash(lot.id)) + 9, lot.center.z);
      summary.scale.set(46, 8.5, 1);
      worldGroup.add(summary);
    }
    if (lot.zone === "unassigned") continue;
    const seed = hash(lot.id);
    const lotHome = lot.homeId ? world.homes.find(home => home.id === lot.homeId) : undefined;
    const architecture = buildingArchitecture(world.templateId, lot.zone, seed);
    const density = world.lotDensity(lot);
    const densityFootprint = density === "low" ? .84 : density === "high" ? 1.08 : 1;
    const densityHeight = density === "low" ? .62 : density === "high" ? 1.55 : 1;
    const buildingWidth = lot.width * (lotHome ? .62 : Math.min(.88, architecture.widthScale * densityFootprint));
    const buildingDepth = lot.depth * (lotHome ? .58 : Math.min(.84, architecture.depthScale * densityFootprint));
    const fullHeight = lotHome
      ? Math.max(3.6, lotHome.floors * 3.2 + .4)
      : zoneBuildingHeight(lot.zone, seed) * architecture.heightScale * densityHeight;
    const program = buildingProgram(lot.zone, density, lot.households, lot.businesses, fullHeight);
    const progress = world.constructionProgress(lot);
    const height = fullHeight * (.12 + progress * .88);
    if (mode === "home" && lot.id === selectedLot?.id) continue;
    const activity = world.lotActivity(lot);
    const powerOutage = world.utilityFailuresForLot(lot).some(failure => failure.kind === "power");
    const hour = world.clock.minute / 60;
    const darkness = hour < 6 ? 1 : hour < 8 ? (8 - hour) / 2 : hour < 18 ? 0 : hour < 21 ? (hour - 18) / 3 : 1;
    const occupiedShare = lot.zone === "residential" || lot.zone === "mixed"
      ? activity.atHome / Math.max(1, activity.population)
      : activity.openBusinesses / Math.max(1, lot.businesses);
    const shellColor = activeCityView === "normal"
      ? progress < 1 ? 0xc5a25f : lotHome ? zoneBuildingColors[lot.zone] : architecture.facadeColor
      : planningColor;
    if (mode === "city" && progress >= 1) {
      cityBuildingInstances.push({ lot, height, width: buildingWidth, depth: buildingDepth, color: shellColor });
      if (!lotHome && lot.zone === "mixed") {
        cityMixedUsePodiums.push({
          lot,
          height: Math.min(height, program.podiumHeight),
          width: buildingWidth * 1.04,
          depth: buildingDepth * 1.04,
          color: architecture.trimColor
        });
      }
    } else {
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(buildingWidth, height, buildingDepth),
        new THREE.MeshStandardMaterial({
          color: shellColor,
          emissive: activeCityView === "normal"
            ? progress < 1 || occupiedShare <= 0 || powerOutage ? 0x000000 : 0x2e2415
            : planningColor,
          emissiveIntensity: activeCityView === "normal" ? progress < 1 || powerOutage ? 0 : darkness * occupiedShare * .12 : .08,
          roughness: .8
        })
      );
      shell.position.set(lot.center.x, height / 2, lot.center.z);
      shell.rotation.y = lot.rotation;
      shell.castShadow = shell.receiveShadow = mode !== "city";
      worldGroup.add(shell);
      if (progress >= 1 && mode !== "city" && agentLotIds.has(lot.id)) {
        addBuildingWindows(lot, height, buildingWidth, buildingDepth, darkness, occupiedShare);
        if (!lotHome) {
          worldGroup.add(createArchitectureDetails(lot, height, buildingWidth, buildingDepth, architecture));
          if (lot.zone === "mixed") worldGroup.add(createBuildingProgramDetails(lot, buildingWidth, buildingDepth, program));
        }
      }
      if (lotHome && progress >= 1 && mode === "explore") {
        const foundation = createHomeFoundation(
          lot.width * .7,
          lot.depth * .66,
          lotHome.foundationStyle ?? defaultHomeFoundationStyle(world.templateId)
        );
        foundation.position.set(lot.center.x, 0, lot.center.z);
        foundation.rotation.y = lot.rotation;
        worldGroup.add(foundation);
        const roof = createHomeRoof(
          lot.width * .68,
          lot.depth * .64,
          lotHome.roofColor ?? defaultHomeRoofColor(world.templateId),
          false,
          lotHome.roofStyle ?? defaultHomeRoofStyle(world.templateId)
        );
        roof.position.set(lot.center.x, height + .66, lot.center.z);
        roof.rotation.y = lot.rotation;
        worldGroup.add(roof);
      }
    }
    if (progress < 1) {
      const scaffold = new THREE.Mesh(
        new THREE.BoxGeometry(lot.width * .72, fullHeight, lot.depth * .68),
        new THREE.MeshBasicMaterial({ color: 0xe8d6a1, wireframe: true, transparent: true, opacity: .48 })
      );
      scaffold.position.set(lot.center.x, fullHeight / 2, lot.center.z);
      scaffold.rotation.y = lot.rotation;
      worldGroup.add(scaffold);
    }
  }
  const cityBuildingBatch = createCityBuildingBatch(cityBuildingInstances);
  cityBuildingBatchCount = cityBuildingBatch?.count ?? 0;
  if (cityBuildingBatch) worldGroup.add(cityBuildingBatch);
  const cityMixedUseBatch = createCityBuildingBatch(cityMixedUsePodiums);
  if (cityMixedUseBatch) {
    cityMixedUseBatch.userData.cityMixedUsePodiums = true;
    worldGroup.add(cityMixedUseBatch);
  }
  renderAccessibilityEntrances();
  renderCityEvents();
  document.querySelector("#lot-count")!.textContent = String(world.lots.length);
  updateCityStats(spatialRenderPlan);
  updateClockDisplay();
  renderHome();
  renderIncidents();
  if (mode === "city" && cityToolGroup === "views") {
    updateCityViewPanel();
  } else if (mode === "city" && cityToolGroup === "economy") {
    updateEconomyPanel();
  } else if (mode === "city" && (
    cityTool === "inspect"
    || cityTool === "transit"
    || cityTool === "curb"
    || cityTool === "event"
  )) {
    updateCityToolPanel(cityTool === "inspect" ? selectedLot ?? undefined : undefined);
  }
  if (currentExplorerInterior()) setInteriorSceneVisibility(true);
}

function addBuildingWindows(lot: Lot, height: number, buildingWidth: number, buildingDepth: number, darkness: number, occupiedShare: number) {
  if (height < 4 || darkness < .05 || occupiedShare <= 0) return;
  const material = new THREE.MeshBasicMaterial({
    map: windowTexture,
    color: 0xffd58b,
    transparent: true,
    opacity: darkness * (.24 + occupiedShare * .58),
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const facadeHeight = Math.max(2, height * .7);
  const frontPosition = localToWorld({ x: 0, z: buildingDepth / 2 + .03 }, lot);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(buildingWidth * .82, facadeHeight), material);
  front.position.set(frontPosition.x, height * .52, frontPosition.z);
  front.rotation.y = lot.rotation;
  worldGroup.add(front);

  const sidePosition = localToWorld({ x: buildingWidth / 2 + .03, z: 0 }, lot);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(buildingDepth * .8, facadeHeight), material);
  side.position.set(sidePosition.x, height * .52, sidePosition.z);
  side.rotation.y = lot.rotation + Math.PI / 2;
  worldGroup.add(side);
}

function createArchitectureDetails(
  lot: Lot,
  height: number,
  buildingWidth: number,
  buildingDepth: number,
  architecture: BuildingArchitecture
) {
  const group = new THREE.Group();
  group.position.set(lot.center.x, 0, lot.center.z);
  group.rotation.y = lot.rotation;
  group.userData.architectureRegion = architecture.regionLabel;
  group.userData.roofStyle = architecture.roofStyle;
  const trimMaterial = new THREE.MeshStandardMaterial({ color: architecture.trimColor, roughness: .78 });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: architecture.roofStyle === "green" ? 0x60795a : architecture.trimColor,
    roughness: .86
  });
  const podiumHeight = Math.min(2.2, Math.max(.7, height * .12));
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(buildingWidth * architecture.podiumScale, podiumHeight, buildingDepth * architecture.podiumScale),
    trimMaterial
  );
  podium.position.y = podiumHeight / 2;
  group.add(podium);

  if (architecture.roofStyle === "cornice" || architecture.roofStyle === "crown") {
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth * 1.06, .3, buildingDepth * 1.06),
      trimMaterial
    );
    cornice.position.y = height - .12;
    group.add(cornice);
  }
  if (architecture.roofStyle === "pitched") {
    const roof = createHomeRoof(buildingWidth * .98, buildingDepth * .98, architecture.trimColor);
    roof.position.y = height + architecture.roofHeight * .45;
    roof.rotation.y = Math.PI / 4;
    roof.scale.y = Math.max(.5, architecture.roofHeight * .72);
    group.add(roof);
  } else {
    const roofScale = architecture.roofStyle === "crown" ? .58 : architecture.roofStyle === "mechanical" ? .42 : .86;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth * roofScale, architecture.roofHeight, buildingDepth * roofScale),
      roofMaterial
    );
    roof.position.y = height + architecture.roofHeight / 2;
    group.add(roof);
  }
  return group;
}

function createBuildingProgramDetails(
  lot: Lot,
  buildingWidth: number,
  buildingDepth: number,
  program: BuildingProgram
) {
  const group = new THREE.Group();
  group.position.set(lot.center.x, 0, lot.center.z);
  group.rotation.y = lot.rotation;
  group.userData.buildingProgram = program.label;
  const glazing = new THREE.Mesh(
    new THREE.PlaneGeometry(buildingWidth * .82, Math.max(1.8, program.podiumHeight * .7)),
    new THREE.MeshStandardMaterial({ color: 0x58727a, emissive: 0x253d43, emissiveIntensity: .18, metalness: .22, roughness: .3 })
  );
  glazing.position.set(0, Math.max(1.2, program.podiumHeight * .43), buildingDepth / 2 + .055);
  group.add(glazing);
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(buildingWidth * .88, .16, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x4d5d52, roughness: .72 })
  );
  canopy.position.set(0, Math.max(2.3, program.podiumHeight * .72), buildingDepth / 2 + .48);
  group.add(canopy);
  const lobby = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1.1, buildingWidth * .12), 2.25, .12),
    new THREE.MeshStandardMaterial({ color: 0xd5c9ae, roughness: .55 })
  );
  lobby.position.set(-buildingWidth * .34, 1.13, buildingDepth / 2 + .09);
  group.add(lobby);
  return group;
}

function serviceColor(kind: ServiceKind) {
  return {
    power: 0xe3c95f,
    water: 0x69aed2,
    sewage: 0x7e8065,
    waste: 0x9b795b,
    fire: 0xd9634f,
    health: 0x74c8ad,
    school: 0xb792d1
  }[kind];
}

function createServiceBuilding(service: CityService) {
  const group = new THREE.Group();
  group.position.set(service.position.x, .2, service.position.z);
  const color = serviceColor(service.kind);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(service.kind === "school" ? 14 : 10, service.kind === "water" ? 3 : 6, service.kind === "school" ? 9 : 8),
    new THREE.MeshStandardMaterial({ color, roughness: .78 })
  );
  base.position.y = service.kind === "water" ? 1.5 : 3;
  base.castShadow = base.receiveShadow = true;
  group.add(base);
  if (service.kind === "water") {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 4, 20), new THREE.MeshStandardMaterial({ color: 0xb5cbd2, metalness: .35, roughness: .55 }));
    tower.position.y = 9;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, 6, 12), new THREE.MeshStandardMaterial({ color: 0x7d8c8f }));
    stem.position.y = 5;
    group.add(stem, tower);
  } else if (service.kind === "power") {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 14, 16), new THREE.MeshStandardMaterial({ color: 0x6f7470 }));
    stack.position.set(2.5, 9, 0);
    group.add(stack);
  } else if (service.kind === "sewage" || service.kind === "waste") {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 2.4, 20),
      new THREE.MeshStandardMaterial({ color: service.kind === "sewage" ? 0x768473 : 0x806a58, roughness: .82 })
    );
    tank.position.set(0, 5.2, 0);
    group.add(tank);
  } else {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(service.kind === "fire" ? 4 : 1, 1, service.kind === "fire" ? 1 : 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    marker.position.y = 6.3;
    group.add(marker);
    if (service.kind !== "fire") {
      const markerCross = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      markerCross.position.y = 6.3;
      group.add(markerCross);
    }
  }
  return group;
}

function parkingKindLabel(kind: ParkingKind) {
  return kind === "curb" ? "Curb parking" : kind === "surface" ? "Surface parking lot" : "Parking garage";
}

function closestParkingFacility(point: Point2, maximumDistance: number) {
  return world.parking
    .filter(facility => world.parkingPermitted(facility))
    .map(facility => ({
      facility,
      distance: Math.hypot(facility.position.x - point.x, facility.position.z - point.z)
    }))
    .filter(candidate => candidate.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance)[0];
}

function closestActiveWorkplace(point: Point2, maximumDistance: number) {
  return world.lots
    .map(lot => ({
      lot,
      workers: world.residentsAtWorkplace(lot.id),
      activity: world.workplaceActivity(lot),
      distance: Math.hypot(lot.center.x - point.x, lot.center.z - point.z)
    }))
    .filter(candidate =>
      candidate.lot.businesses > 0
      && candidate.distance <= maximumDistance
      && (candidate.activity.coworkersOnShift > 0 || candidate.activity.customersPresent > 0)
    )
    .sort((first, second) => first.distance - second.distance)[0];
}

function closestCurbFacility(point: Point2, maximumDistance: number) {
  return world.parking
    .filter(facility => facility.kind === "curb")
    .map(facility => ({
      facility,
      distance: Math.hypot(facility.position.x - point.x, facility.position.z - point.z)
    }))
    .filter(candidate => candidate.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance)[0];
}

function closestActiveCityEvent(point: Point2, maximumDistance: number) {
  return world.activeCityEvents()
    .map(event => ({
      event,
      distance: Math.hypot(event.position.x - point.x, event.position.z - point.z)
    }))
    .filter(candidate => candidate.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance)[0];
}

function formatParkingRate(hourlyRate: number) {
  return hourlyRate > 0 ? `$${hourlyRate.toFixed(hourlyRate % 1 ? 2 : 0)}/hr` : "Free";
}

function parkingPressureLabel(facility: ParkingFacility) {
  const demand = world.parkingDemand(facility);
  return demand >= .86 ? "Very high demand" : demand >= .66 ? "High demand" : demand >= .4 ? "Balanced demand" : "Low demand";
}

function curbUseLabel(use: CurbUse) {
  return use === "parking"
    ? "Flexible parking"
    : use === "loading"
      ? "Commercial loading"
      : use === "restricted"
        ? "No parking"
        : "Special event";
}

function curbScheduleLabel(schedule: CurbSchedule) {
  return schedule === "all-day"
    ? "all day"
    : schedule === "business-hours"
      ? "7:00–19:00"
      : schedule === "rush-hours"
        ? "7:00–10:00 and 16:00–19:00"
        : "17:00–23:00";
}

function curbStatusLabel(facility: ParkingFacility) {
  const event = world.cityEventCurbOverride(facility);
  if (event) return `Event control · ${event.name}`;
  const configured = facility.curbUse ?? "parking";
  const effective = world.curbEffectiveUse(facility);
  return effective === configured
    ? `${curbUseLabel(effective)} active`
    : `Flexible parking now · ${curbUseLabel(configured)} ${curbScheduleLabel(facility.curbSchedule ?? "all-day")}`;
}

function curbUseColor(use: CurbUse) {
  return use === "parking" ? 0x397eb6 : use === "loading" ? 0xe4b44f : use === "restricted" ? 0xd05b4d : 0x9b6bc4;
}

function formatTransitFare(fare: number) {
  return fare > 0 ? `$${fare.toFixed(2)}` : "fare-free";
}

function transitFarePolicyLabel(fare: number) {
  return fare > 0 ? `${formatTransitFare(fare)} fare` : "fare-free";
}

function transitCrowdingLabel(crowding: number) {
  return crowding >= 1 ? "At capacity" : crowding >= .78 ? "Crowded" : crowding >= .48 ? "Busy" : "Seats available";
}

function formatParkingMonthly(value: number) {
  return value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(2)}m/mo`
    : value >= 100_000
    ? `$${(value / 1_000).toFixed(0)}k/mo`
    : `$${(value / 1_000).toFixed(1)}k/mo`;
}

function createParkingFacility(facility: ParkingFacility) {
  const group = new THREE.Group();
  group.position.set(facility.position.x, .19, facility.position.z);
  group.rotation.y = facility.rotation;
  group.userData.parkingId = facility.id;
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x343a38, roughness: .96 });
  const stripe = new THREE.MeshBasicMaterial({ color: 0xf0ead7 });
  const accessible = new THREE.MeshBasicMaterial({ color: 0x397eb6 });

  if (facility.kind === "curb") {
    const effectiveUse = world.curbEffectiveUse(facility);
    const curbColor = curbUseColor(effectiveUse);
    const curbStripe = new THREE.MeshBasicMaterial({ color: curbColor });
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 6.4), asphalt);
    bay.rotation.x = -Math.PI / 2;
    bay.position.y = .07;
    group.add(bay);
    for (const z of [-3.1, 3.1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.8, .05, .16), curbStripe);
      edge.position.set(0, .1, z);
      group.add(edge);
    }
    const useMark = new THREE.Mesh(
      new THREE.PlaneGeometry(effectiveUse === "parking" ? 1.2 : 1.7, effectiveUse === "parking" ? 1.2 : 3.2),
      new THREE.MeshBasicMaterial({ color: curbColor, transparent: true, opacity: .82 })
    );
    useMark.rotation.x = -Math.PI / 2;
    useMark.position.set(0, .105, effectiveUse === "parking" ? 1.7 : 0);
    group.add(useMark);
    if (effectiveUse === "loading" && facility.occupied > 0) {
      const van = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 1.75, 4.6),
        new THREE.MeshStandardMaterial({ color: 0xe9e5d8, roughness: .7 })
      );
      van.position.y = 1;
      van.castShadow = true;
      group.add(van);
    }
    if (effectiveUse === "restricted" || effectiveUse === "event") {
      for (const z of [-2.4, -.8, .8, 2.4]) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(.24, .72, 10),
          new THREE.MeshBasicMaterial({ color: curbColor })
        );
        cone.position.set(0, .42, z);
        group.add(cone);
      }
    }
  } else if (facility.kind === "surface") {
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(18, 22), asphalt);
    lot.rotation.x = -Math.PI / 2;
    lot.position.y = .08;
    group.add(lot);
    for (const side of [-1, 1]) {
      for (let space = -2; space <= 2; space++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(.1, .035, 5.3), stripe);
        line.position.set(space * 3.25, .11, side * 7.5);
        group.add(line);
      }
    }
    const accessMark = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.8), accessible);
    accessMark.rotation.x = -Math.PI / 2;
    accessMark.position.set(-5.8, .115, -7.5);
    group.add(accessMark);
  } else {
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(18, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0x707978, roughness: .82, metalness: .08 })
    );
    building.position.y = 5;
    building.castShadow = building.receiveShadow = true;
    group.add(building);
    for (const level of [2.3, 5.2, 8.1]) {
      const opening = new THREE.Mesh(
        new THREE.BoxGeometry(18.05, 1.15, 22.05),
        new THREE.MeshBasicMaterial({ color: 0x252c2b })
      );
      opening.position.y = level;
      group.add(opening);
    }
    const entrance = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 3.2, .22),
      new THREE.MeshBasicMaterial({ color: 0x151b1a })
    );
    entrance.position.set(0, 1.7, -11.12);
    group.add(entrance);
    const accessSign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, .18), accessible);
    accessSign.position.set(-6.3, 6.7, -11.2);
    group.add(accessSign);
  }

  if (mode === "city" && cityTool === "parking") {
    const projectedRevenue = world.parkingMonthlyProjection(facility);
    const projectedNet = projectedRevenue - world.parkingMonthlyCost(facility);
    const label = makeLabel(
      facility.kind === "curb" && !world.parkingPermitted(facility)
        ? `${parkingKindLabel(facility.kind)} · unavailable · ${curbStatusLabel(facility)}`
        : `${parkingKindLabel(facility.kind)} · ${formatParkingRate(facility.hourlyRate)} · ${facility.occupied}/${facility.capacity} occupied · ${parkingPressureLabel(facility)} · ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}`
    );
    label.position.y = facility.kind === "garage" ? 14 : 4.2;
    label.scale.set(82, 8, 1);
    group.add(label);
  }
  if (mode === "city" && cityTool === "curb" && facility.kind === "curb") {
    const projectedNet = world.curbMonthlyProjection(facility) - world.curbMonthlyCost(facility);
    const label = makeLabel(
      `${curbStatusLabel(facility)} · ${curbScheduleLabel(facility.curbSchedule ?? "all-day")} · ${world.curbLoadingDemand(facility).toFixed(1)} deliveries/h · ${facility.deliveriesWaiting ?? 0} waiting · ${facility.deliveriesServed ?? 0} served · ${facility.violations ?? 0} violations · ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}`
    );
    label.position.y = 5.3;
    label.scale.set(112, 8, 1);
    group.add(label);
  }
  group.traverse(object => {
    object.userData.parkingId = facility.id;
  });
  return group;
}

function zoneBuildingHeight(zone: Zone, seed: number) {
  if (zone === "residential") return 6 + seed % 18;
  if (zone === "commercial") return 24 + seed % 68;
  if (zone === "mixed") return 14 + seed % 46;
  if (zone === "industrial") return 5 + seed % 8;
  if (zone === "civic") return 10 + seed % 22;
  return 5 + seed % 25;
}

function worldRenderFocus(): Point2 {
  if (mode === "explore") return { x: camera.position.x, z: camera.position.z };
  if (mode === "home" && selectedLot) return { ...selectedLot.center };
  return { x: orbit.target.x, z: orbit.target.z };
}

function spatialTierSignature(focus: Point2) {
  return `${mode}:${selectedLot?.id ?? ""}:${world.spatialChunks
    .map(chunk => `${chunk.id}:${world.spatialDetailTier(chunk, focus)}`)
    .join("|")}`;
}

function spatialChunkLabel(chunk: SpatialChunk) {
  return `${chunk.id.replace("chunk-", "")} · ${chunk.population.toLocaleString()} residents`;
}

function createAggregateChunkMassing(chunk: SpatialChunk, view: CityView) {
  const group = new THREE.Group();
  group.userData.spatialChunkId = chunk.id;
  group.userData.spatialTier = "aggregate";
  if (!chunk.lotIds.length || chunk.population + chunk.jobs <= 0) return group;
  const density = Math.min(1, (chunk.population + chunk.jobs) / Math.max(1, chunk.lotIds.length * 85));
  const height = THREE.MathUtils.clamp(7 + Math.log2(1 + chunk.population + chunk.jobs) * 2.45, 9, 42);
  const normalColor = chunk.businesses > chunk.households * .22 ? 0x8294a0 : 0x87947d;
  const color = view === "normal" ? normalColor : planningHeatColor(.45 + density * .42);
  const material = new THREE.MeshStandardMaterial({ color, roughness: .94, flatShading: true });
  const blockCount = Math.min(4, Math.max(1, Math.ceil(chunk.lotIds.length / 30)));
  const offsets = [
    [-.21, -.21], [.21, -.21], [-.21, .21], [.21, .21]
  ];
  for (let index = 0; index < blockCount; index++) {
    const blockHeight = height * (.7 + index * .1);
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(chunk.size * .32, blockHeight, chunk.size * .32),
      material
    );
    block.position.set(
      chunk.center.x + offsets[index][0] * chunk.size,
      blockHeight / 2,
      chunk.center.z + offsets[index][1] * chunk.size
    );
    group.add(block);
  }
  return group;
}

function createCityBuildingBatch(records: Array<{ lot: Lot; height: number; width: number; depth: number; color: number }>) {
  if (!records.length) return undefined;
  const batch = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .82, vertexColors: true }),
    records.length
  );
  const transform = new THREE.Object3D();
  records.forEach((record, index) => {
    transform.position.set(record.lot.center.x, record.height / 2, record.lot.center.z);
    transform.rotation.set(0, record.lot.rotation, 0);
    transform.scale.set(record.width, record.height, record.depth);
    transform.updateMatrix();
    batch.setMatrixAt(index, transform.matrix);
    batch.setColorAt(index, new THREE.Color(record.color));
  });
  batch.instanceMatrix.needsUpdate = true;
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
  batch.userData.cityBuildingBatch = true;
  batch.userData.instanceCount = records.length;
  return batch;
}

function updateCityStats(renderPlan = world.spatialRenderPlan(worldRenderFocus())) {
  const {
    households,
    businesses,
    population,
    jobs,
    openBusinesses,
    workersOnShift,
    privateSectorRevenue,
    privateSectorProfit,
    monthlyBalance: balance,
    residentialTaxRevenue,
    commercialTaxRevenue,
    industrialTaxRevenue,
    districtPolicyCosts,
    debtPayments,
    parkingRevenue,
    parkingCosts,
    transitRevenue,
    transitCosts,
    transitRidership,
    curbRevenue,
    curbCosts,
    curbDeliveries,
    curbViolations,
    eventRevenue,
    eventCosts,
    eventAttendance,
    activeEvents
  } = world.cityEconomy();
  document.querySelector("#population")!.textContent = population.toLocaleString();
  lastMonthlyBalance = balance;
  document.querySelector("#funds")!.textContent = `${balance >= 0 ? "+" : "-"}$${(Math.abs(balance) / 1_000_000).toFixed(2)}m`;
  const required: ServiceKind[] = ["power", "water", "sewage", "waste", "fire", "health", "school"];
  const coverage = world.lots.length
    ? required.reduce((total, kind) => {
      const spatialCoverage = world.lots.filter(lot => isLotCovered(lot, kind)).length / world.lots.length;
      return total + spatialCoverage * serviceCapacityFactor(kind, population) * utilityCapacityFactor(kind, population);
    }, 0) / required.length
    : 0;
  const utilityOutages = world.activeUtilityFailures().length;
  document.querySelector("#coverage")!.textContent = utilityOutages
    ? `${Math.round(coverage * 100)}% · ${utilityOutages} out`
    : `${Math.round(coverage * 100)}%`;
  const activeCommuters = world.activeCommutes().reduce((total, commute) => total + commute.flow.travelers, 0);
  const congestion = Math.round(world.congestionLevel() * 100);
  document.querySelector("#mobility")!.textContent = activeEvents
    ? `${congestion}% · ${activeEvents} event${activeEvents === 1 ? "" : "s"}`
    : activeCommuters
      ? `${congestion}% · ${activeCommuters.toLocaleString()}`
      : "Quiet";
  const wellbeing = world.cityWellbeing();
  document.querySelector("#wellbeing")!.textContent = wellbeing
    ? `${wellbeing}% · ${wellbeingLabel(wellbeing)}`
    : "No residents";
  const totalChunks = renderPlan.agentChunks.length + renderPlan.activeChunks.length + renderPlan.aggregateChunks.length;
  const activePopulation = [...renderPlan.agentChunks, ...renderPlan.activeChunks]
    .reduce((total, chunk) => total + chunk.population, 0);
  const representativeChunk = renderPlan.agentChunks[0]
    ?? world.spatialChunks[0];
  const lodStatus = document.querySelector<HTMLElement>("#lod-status")!;
  lodStatus.textContent = `${totalChunks} streamed chunks · ${renderPlan.agentChunks.length} agent · ${renderPlan.activeChunks.length} active · ${renderPlan.aggregateChunks.length} massed${mode === "city" ? ` · ${cityBuildingBatchCount} batched` : ""}`;
  lodStatus.title = representativeChunk
    ? `Focused chunk ${spatialChunkLabel(representativeChunk)} · ${activePopulation.toLocaleString()} residents in active detail`
    : "No populated spatial chunks";

  const completedLots = world.lots.filter(lot => world.constructionProgress(lot) >= 1);
  const customersPresent = completedLots.reduce((total, lot) => total + world.workplaceActivity(lot).customersPresent, 0);
  const residentialLots = completedLots.filter(lot => lot.zone === "residential" || lot.zone === "mixed").length;
  const commercialLots = completedLots.filter(lot => lot.zone === "commercial" || lot.zone === "mixed").length;
  const industrialLots = completedLots.filter(lot => lot.zone === "industrial").length;
  const demandR = clampDemand(45 + (jobs - population * .42) / 450 - residentialLots * .08 + coverage * 24);
  const demandC = clampDemand(32 + population / 680 - commercialLots * .16);
  const demandI = clampDemand(30 + commercialLots * .09 - industrialLots * .8);
  setDemandBar("demand-r", demandR);
  setDemandBar("demand-c", demandC);
  setDemandBar("demand-i", demandI);
  const activeConstruction = world.lots.filter(lot => world.constructionProgress(lot) < 1).length;
  document.querySelector("#demand-reason")!.textContent = activeConstruction
    ? `${activeConstruction} development ${activeConstruction === 1 ? "project is" : "projects are"} under construction.`
    : powerReliability(population) < .75
      ? "Power constraints are reducing the effectiveness of city services."
      : world.effectiveStaffing() < world.serviceFunding * .9
        ? "Workforce shortages are limiting staffed service capacity."
    : coverage < .35
      ? "Housing demand is constrained by limited staffed service capacity."
      : jobs > population * .55
        ? "Available jobs are increasing demand for nearby housing."
        : "Demand reflects current households, jobs, and available land.";
  document.querySelector("#economy-summary")!.textContent =
    `${households.toLocaleString()} households · ${openBusinesses.toLocaleString()}/${businesses.toLocaleString()} businesses open · ${workersOnShift.toLocaleString()}/${jobs.toLocaleString()} jobs on shift · ${customersPresent.toLocaleString()} customers present · private sector ${formatHomeCurrency(privateSectorRevenue)}/day revenue, ${formatSignedHomeCurrency(privateSectorProfit)}/day profit · taxes ${formatParkingMonthly(residentialTaxRevenue + commercialTaxRevenue + industrialTaxRevenue)} · policies -${formatParkingMonthly(districtPolicyCosts)} · debt -${formatParkingMonthly(debtPayments)} · parking ${parkingRevenue - parkingCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(parkingRevenue - parkingCosts))} · curb ${curbRevenue - curbCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(curbRevenue - curbCosts))} · ${curbDeliveries.toLocaleString()} deliveries · ${curbViolations.toLocaleString()} violations · transit ${transitRevenue - transitCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(transitRevenue - transitCosts))} · ${transitRidership.toLocaleString()} rides · events ${eventRevenue - eventCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(eventRevenue - eventCosts))} · ${eventAttendance.toLocaleString()} visits`;
  (document.querySelector("#staffing-policy") as HTMLSelectElement).value = String(world.serviceFunding);
  updateCityAdvisor({
    roads: world.roads.length,
    services: world.services.length,
    coverage,
    staffing: world.effectiveStaffing(),
    utilityFailures: utilityOutages,
    congestion: congestion / 100,
    wellbeing,
    monthlyBalance: balance
  });
  syncTransitControls();
}

function updateCityAdvisor(input: Parameters<typeof cityAdvisorActions>[0]) {
  document.querySelector("#city-advisor-actions")!.innerHTML = cityAdvisorActions(input)
    .map(action => `
      <button type="button" data-advisor-group="${action.group}" ${action.tool ? `data-advisor-tool="${action.tool}"` : ""} ${action.view ? `data-advisor-view="${action.view}"` : ""}>
        <strong>${action.title}</strong>
        <span>${action.detail}</span>
      </button>
    `)
    .join("");
}

function serviceCapacityFactor(kind: ServiceKind, population: number) {
  const demand = kind === "school" ? Math.max(1, population * .2) : Math.max(1, population);
  const capacity = world.services
    .filter(service => service.kind === kind)
    .reduce((total, service) => total + service.capacity * world.serviceStaffing(kind), 0);
  const baseCapacity = Math.min(1, capacity / demand);
  if (kind === "power") return baseCapacity;
  return baseCapacity * (.3 + powerReliability(population) * .7);
}

function powerReliability(population: number) {
  const generation = world.services
    .filter(service => service.kind === "power")
    .reduce((total, service) => total + service.capacity * world.serviceStaffing("power"), 0);
  if (!generation) return .3;
  return Math.min(1, generation / Math.max(1, population)) * utilityCapacityFactor("power", population);
}

function utilityCapacityFactor(kind: ServiceKind, population: number) {
  if (kind !== "power" && kind !== "water" && kind !== "sewage" && kind !== "waste") return 1;
  const lines = world.utilities.filter(utility => utility.kind === kind);
  if (!lines.length) return 1;
  const capacity = lines.reduce((total, utility) => total + utility.capacity, 0);
  const condition = lines.reduce((total, utility) => total + utility.condition, 0) / lines.length / 100;
  const outageSeverity = world.activeUtilityFailures(kind)
    .reduce((highest, failure) => Math.max(highest, failure.severity), 0);
  return Math.min(1, capacity / Math.max(1, population))
    * (.62 + condition * .38)
    * (1 - outageSeverity * .42);
}

function updateClockDisplay() {
  const { year, month, day, minute } = world.clock;
  const weather = world.weather();
  const hours = Math.floor(minute / 60);
  const minutes = Math.floor(minute % 60);
  document.querySelector("#sim-date")!.textContent = `Y${year} · ${MONTH_NAMES[month - 1]} ${day}`;
  document.querySelector("#sim-time")!.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  document.querySelector("#sim-weather")!.textContent = `${weather.label} · ${weather.temperatureC}°C · ${weather.windKph} km/h`;
  updatePhotoModePanel();
  const daylight = Math.max(0, Math.sin((hours + minutes / 60 - 6) / 12 * Math.PI));
  const weatherLight = weather.kind === "rain" ? .55 : weather.kind === "cloudy" ? .72 : weather.kind === "snow" ? .82 : 1;
  sun.intensity = (.38 + daylight * 2.82) * weatherLight;
  hemisphere.intensity = (.58 + daylight * 1.67) * (.78 + weatherLight * .22);
  const night = new THREE.Color(0x172532);
  const dayColor = new THREE.Color(
    weather.kind === "rain" ? 0x788b92
      : weather.kind === "cloudy" ? 0x98a7a8
        : weather.kind === "snow" ? 0xc6d1d2
          : 0xb8c9cb
  );
  const sky = night.clone().lerp(dayColor, .18 + daylight * .82);
  scene.background = sky;
  if (scene.fog instanceof THREE.FogExp2) {
    scene.fog.color.copy(sky);
    scene.fog.density = .00052 + (1 - weather.visibility) * .00115;
  }
  const precipitationVisible = !uiPreferences.reducedMotion && mode !== "home" && !explorerInteriorHomeId;
  rainField.visible = weather.kind === "rain" && precipitationVisible;
  snowField.visible = weather.kind === "snow" && precipitationVisible;
  roadMaterial.color.set(weather.kind === "rain" ? 0x252d2e : weather.kind === "snow" ? 0x3b4140 : 0x303533);
  roadMaterial.roughness = weather.kind === "rain" ? .72 : .94;
  sidewalkMaterial.color.set(weather.kind === "snow" ? 0xc5c9c2 : weather.kind === "rain" ? 0x9da39f : 0xb7b4aa);
  waterMaterial.color.set(weather.kind === "rain" ? 0x587782 : weather.kind === "snow" ? 0x819aa1 : 0x6e919b);
  renderIncidents();
  renderCommutes();
  renderWorkplaceActivity();
  updateTrafficSignals();
  if (mode === "explore") updateExplorerContext();
  if (mode === "home" || explorerInteriorHomeId) {
    const home = mode === "home" ? currentHome() : currentExplorerInterior()?.home;
    const signature = home
      ? home.residents.map(resident =>
        `${resident.id}:${world.activeResidentAction(resident)?.kind ?? world.residentStatus(resident)}:${Math.floor(world.residentActionProgress(resident) * 10)}:${world.residentWellbeing(resident).score}`
      ).join("|")
      : "";
    if (signature !== lastHomeActionSignature) renderHome();
  }
}

function clampDemand(value: number) {
  return Math.max(4, Math.min(96, Math.round(value)));
}

function setDemandBar(id: string, value: number) {
  (document.querySelector(`#${id}`) as HTMLElement).style.width = `${value}%`;
}

function isLotCovered(lot: Lot, kind: ServiceKind) {
  return world.lotHasService(lot, kind);
}

function renderTerrain() {
  terrainGroup.clear();
  const weather = world.weather();
  const seasonalParkColor = weather.kind === "snow"
    ? 0xc9d1c8
    : weather.season === "winter"
      ? 0x71806b
      : weather.season === "spring"
        ? 0x5d8053
        : weather.season === "summer"
          ? 0x4f7549
          : 0x806f48;
  const seasonalLandColor = weather.kind === "snow" ? 0xaeb8a8 : weather.season === "autumn" ? 0x8d9270 : 0x819773;
  for (const area of world.areas) {
    if (area.kind === "district") {
      const center = area.points.reduce((sum, point) => ({ x: sum.x + point.x / area.points.length, z: sum.z + point.z / area.points.length }), { x: 0, z: 0 });
      const label = makeLabel(area.name);
      label.position.set(center.x, 12, center.z);
      terrainGroup.add(label);
      continue;
    }
    if (area.kind === "growth-boundary") {
      const boundary = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(area.points.map(point => new THREE.Vector3(point.x, .18, point.z))),
        new THREE.LineBasicMaterial({
          color: cityView === "environment" ? 0xf0d980 : 0xb8c88c,
          transparent: true,
          opacity: cityView === "environment" ? .95 : .48
        })
      );
      terrainGroup.add(boundary);
      const center = area.points.reduce((sum, point) => ({ x: sum.x + point.x / area.points.length, z: sum.z + point.z / area.points.length }), { x: 0, z: 0 });
      const label = makeLabel(area.name);
      label.position.set(center.x, 8, Math.max(...area.points.map(point => point.z)) - 12);
      terrainGroup.add(label);
      continue;
    }
    const shape = new THREE.Shape();
    area.points.forEach((point, index) => index === 0 ? shape.moveTo(point.x, point.z) : shape.lineTo(point.x, point.z));
    shape.closePath();
    const areaMaterial = area.kind === "water"
      ? waterMaterial
      : area.kind === "floodplain" || area.kind === "slope"
        ? new THREE.MeshStandardMaterial({
            color: area.kind === "slope"
              ? area.terrainSlope === "steep" ? 0xb27655 : 0xaa9662
              : area.floodRisk === "high" ? 0x5c89a1 : 0x789c9d,
            transparent: true,
            opacity: cityView === "environment" ? .48 : .18,
            roughness: .76,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        : new THREE.MeshStandardMaterial({
            color: area.kind === "park" ? seasonalParkColor : seasonalLandColor,
            roughness: 1,
            side: THREE.DoubleSide
          });
    const surface = new THREE.Mesh(new THREE.ShapeGeometry(shape), areaMaterial);
    surface.rotation.x = Math.PI / 2;
    surface.position.y = area.kind === "park" ? .08 : area.kind === "floodplain" || area.kind === "slope" ? .045 : area.kind === "water" ? .02 : -.02;
    surface.receiveShadow = true;
    terrainGroup.add(surface);
    if (area.kind === "park") {
      const center = area.points.reduce((sum, point) => ({ x: sum.x + point.x / area.points.length, z: sum.z + point.z / area.points.length }), { x: 0, z: 0 });
      const label = makeLabel(area.name);
      label.position.set(center.x, 9, center.z);
      terrainGroup.add(label);
    }
  }
}

function renderIncidents() {
  incidentGroup.clear();
  const active = world.activeIncidents();
  const utilityFailures = world.activeUtilityFailures();
  const activeEvents = world.activeCityEvents();
  const panel = document.querySelector("#incident-panel")!;
  const activeOperations = active.length + utilityFailures.length + activeEvents.length;
  panel.classList.toggle("visible", activeOperations > 0);
  document.querySelector("#incident-title")!.textContent = activeOperations
    ? `${active.length} ${active.length === 1 ? "call" : "calls"} · ${utilityFailures.length} ${utilityFailures.length === 1 ? "repair" : "repairs"} · ${activeEvents.length} ${activeEvents.length === 1 ? "event" : "events"}`
    : "All clear";
  const entries: string[] = [];
  for (const event of activeEvents.slice(0, 2)) {
    entries.push(
      `<div class="city-event-operation"><b>EVENT</b><span>${event.name}</span><small>${world.cityEventExpectedAttendance(event).toLocaleString()} attending · ${Math.round(world.cityEventTrafficPressure() * 100)}% city event traffic pressure</small></div>`
    );
  }
  for (const incident of active.slice(0, utilityFailures.length ? 2 : 4)) {
    const lot = world.lots.find(item => item.id === incident.lotId);
    if (!lot) continue;
    const roadName = world.roads.find(road => road.id === lot.roadId)?.name ?? "Unnamed road";
    const responder = world.services.find(service => service.id === incident.responderServiceId);
    let status = incident.kind === "fire" ? "No fire unit available" : "No medical unit available";
    if (responder && incident.arrivalAt !== undefined && incident.dispatchedAt !== undefined) {
      status = world.clock.elapsedMinutes < incident.arrivalAt
        ? `${incident.kind === "fire" ? "Engine" : "Medic"} en route via streets · ${Math.max(1, Math.ceil(incident.arrivalAt - world.clock.elapsedMinutes))}m`
        : `Crews on scene · ${Math.max(1, Math.ceil((incident.resolvedAt ?? world.clock.elapsedMinutes) - world.clock.elapsedMinutes))}m`;
      const routePoints = incident.route?.length
        ? incident.route
        : [responder.position, lot.center];
      const route = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(routePoints.map(point => new THREE.Vector3(point.x, 1.2, point.z))),
        new THREE.LineDashedMaterial({ color: incident.kind === "fire" ? 0xf07158 : 0x74c8ad, dashSize: 4, gapSize: 2 })
      );
      route.computeLineDistances();
      incidentGroup.add(route);
      const travelProgress = Math.max(0, Math.min(1, (world.clock.elapsedMinutes - incident.dispatchedAt) / Math.max(1, incident.arrivalAt - incident.dispatchedAt)));
      const vehicle = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, .8, 2.4),
        new THREE.MeshStandardMaterial({
          color: incident.kind === "fire" ? 0xd84e3c : 0xf2f2ec,
          emissive: incident.kind === "fire" ? 0x3b0703 : 0x0b2722
        })
      );
      const vehiclePoint = pointAlongRoute(routePoints, travelProgress);
      vehicle.position.set(vehiclePoint.x, .8, vehiclePoint.z);
      incidentGroup.add(vehicle);
    }
    const beacon = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, .45, 8, 28),
      new THREE.MeshBasicMaterial({ color: incident.kind === "fire" ? 0xff5f45 : 0x65e0c2 })
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.set(lot.center.x, 4.5, lot.center.z);
    incidentGroup.add(beacon);
    entries.push(`<div><b>${incident.kind === "fire" ? "FIRE" : "MEDICAL"}</b><span>${roadName}</span><small>${status}</small></div>`);
  }
  for (const failure of utilityFailures.slice(0, 3)) {
    const road = world.roads
      .map(item => ({ item, distance: distanceToPolylineForDisplay(failure.position, item.points) }))
      .sort((a, b) => a.distance - b.distance)[0]?.item;
    const roadName = road?.name ?? "Utility network";
    const crew = world.services.find(service => service.id === failure.crewServiceId);
    const routePoints = failure.route?.length
      ? failure.route
      : crew ? [crew.position, failure.position] : [failure.position];
    if (crew && failure.arrivalAt !== undefined && failure.dispatchedAt !== undefined && routePoints.length > 1) {
      const route = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(routePoints.map(point => new THREE.Vector3(point.x, 1.05, point.z))),
        new THREE.LineDashedMaterial({ color: 0xf0bd58, dashSize: 3, gapSize: 1.5, transparent: true, opacity: .88 })
      );
      route.computeLineDistances();
      incidentGroup.add(route);
      const travelProgress = Math.max(0, Math.min(1,
        (world.clock.elapsedMinutes - failure.dispatchedAt) / Math.max(1, failure.arrivalAt - failure.dispatchedAt)
      ));
      const truck = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, .85, 2.5),
        new THREE.MeshStandardMaterial({ color: 0xe5b33f, emissive: 0x2f2105, emissiveIntensity: .35 })
      );
      const truckPoint = pointAlongRoute(routePoints, travelProgress);
      truck.position.set(truckPoint.x, .85, truckPoint.z);
      incidentGroup.add(truck);
    }
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.45, 0),
      new THREE.MeshBasicMaterial({ color: 0xff8d5d })
    );
    marker.position.set(failure.position.x, 5.2, failure.position.z);
    incidentGroup.add(marker);
    const beacon = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, .38, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xf0bd58 })
    );
    beacon.rotation.x = Math.PI / 2;
    beacon.position.set(failure.position.x, 3.8, failure.position.z);
    incidentGroup.add(beacon);
    entries.push(
      `<div class="utility-operation"><b>${failure.kind.toUpperCase()}</b><span>${roadName}</span><small>${world.utilityFailureStatus(failure)} · ${world.utilityFailureAffectedLots(failure)} affected parcels</small></div>`
    );
  }
  document.querySelector("#incident-list")!.innerHTML = entries.join("");
}

function distanceToPolylineForDisplay(point: Point2, points: Point2[]) {
  let distance = Infinity;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const progress = lengthSquared
      ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared))
      : 0;
    distance = Math.min(distance, Math.hypot(point.x - (a.x + progress * dx), point.z - (a.z + progress * dz)));
  }
  return distance;
}

function renderCommutes() {
  commuteGroup.clear();
  const selectedFlow = selectedLot && mode === "city" && cityTool === "inspect"
    ? world.commuteForLot(selectedLot)
    : undefined;
  if (selectedFlow) {
    const route = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(selectedFlow.route.map(point => new THREE.Vector3(point.x, .72, point.z))),
      new THREE.LineDashedMaterial({ color: 0x72b9d6, dashSize: 3, gapSize: 1.7, transparent: true, opacity: .8 })
    );
    route.computeLineDistances();
    commuteGroup.add(route);
  }

  world.activeCommutes().slice(0, 48).forEach((active, index) => {
    const points = active.direction === "outbound" ? active.flow.route : [...active.flow.route].reverse();
    if (index < 14) {
      const trace = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(point.x, .55, point.z))),
        new THREE.LineBasicMaterial({ color: 0x84abc0, transparent: true, opacity: .13 })
      );
      commuteGroup.add(trace);
    }
    const centerPoint = pointAlongRoute(points, active.progress);
    const roadLocation = nearestRoadLocation(explorerRoadPaths, centerPoint);
    const closure = roadLocation && roadLocation.distance <= roadLocation.width / 2 + 1.2
      ? world.cityEventRoadClosure(roadLocation.roadId)
      : undefined;
    const laneOffset = roadLocation
      ? Math.max(1.8, Math.min(3.3, roadLocation.width * .22))
      : 2.1;
    const vehiclePose = active.flow.mode === "car"
      ? trafficVehiclePose(points, active.progress, streetIntersections, world.clock.elapsedMinutes, laneOffset)
      : undefined;
    const point = vehiclePose?.point ?? centerPoint;
    const next = vehiclePose
      ? {
          x: point.x + vehiclePose.tangent.x,
          z: point.z + vehiclePose.tangent.z
        }
      : pointAlongRoute(points, Math.min(1, active.progress + .015));
    const traveler = new THREE.Group();
    if (active.flow.mode === "car") {
      const palette = [0x4d7185, 0x9c6658, 0x8d845d, 0x5d7566, 0x6e657c];
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, .55, 2.25),
        new THREE.MeshStandardMaterial({ color: palette[hash(active.flow.id) % palette.length], roughness: .72 })
      );
      body.position.y = .48;
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(.92, .42, 1.05),
        new THREE.MeshStandardMaterial({ color: 0xb6c3c2, roughness: .5, metalness: .12 })
      );
      roof.position.set(0, .88, -.08);
      traveler.add(body, roof);
      for (const x of [-.42, .42]) {
        const brakeLight = new THREE.Mesh(
          new THREE.BoxGeometry(.18, .13, .06),
          new THREE.MeshBasicMaterial({ color: vehiclePose?.stopped || closure ? 0xff3b2f : 0x69251f })
        );
        brakeLight.position.set(x, .58, 1.14);
        traveler.add(brakeLight);
      }
    } else {
      const person = new THREE.Mesh(
        new THREE.CapsuleGeometry(.2, .58, 3, 7),
        new THREE.MeshStandardMaterial({ color: 0x647f72 })
      );
      person.position.y = .75;
      traveler.add(person);
    }
    const travelRoad = roadLocation ? world.roads.find(candidate => candidate.id === roadLocation.roadId) : undefined;
    const travelElevation = travelRoad ? world.roadStructure(travelRoad).elevationMeters : 0;
    traveler.position.set(point.x, travelElevation + .18, point.z);
    traveler.rotation.y = Math.atan2(next.x - point.x, next.z - point.z);
    traveler.userData.stoppedForSignal = vehiclePose?.stopped ?? false;
    traveler.userData.stoppedForClosure = Boolean(closure);
    traveler.scale.setScalar(active.flow.mode === "car" ? 1 : 1.15);
    commuteGroup.add(traveler);
  });
}

function createWorkplacePerson(color: number, role: "named" | "coworker" | "customer", resident?: Resident) {
  if (role === "named" && resident) return createResidentFigure(resident, true);
  const person = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(.2, .56, 3, 7),
    new THREE.MeshStandardMaterial({ color, roughness: .82 })
  );
  body.position.y = .72;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(.19, 10, 8),
    new THREE.MeshStandardMaterial({ color: role === "named" ? 0xd2a778 : 0xbd9470, roughness: .86 })
  );
  head.position.y = 1.36;
  person.add(body, head);
  person.userData.workplaceRole = role;
  return person;
}

function renderWorkplaceActivity() {
  workplaceActivityGroup.clear();
  if (mode === "home" || explorerInteriorHomeId) return;
  const focus = worldRenderFocus();
  const maximumDistance = mode === "explore" ? 150 : 460;
  const maximumLots = mode === "explore" ? 28 : 42;
  const sectorColors = {
    retail: 0xd69a64,
    office: 0x7192ad,
    hospitality: 0xb783aa,
    industrial: 0x8b8974,
    community: 0x78a98b
  };
  const candidates = world.lots
    .filter(lot => lot.businesses > 0 && world.constructionProgress(lot) >= 1)
    .map(lot => ({
      lot,
      activity: world.workplaceActivity(lot),
      distance: Math.hypot(lot.center.x - focus.x, lot.center.z - focus.z)
    }))
    .filter(candidate =>
      candidate.distance <= maximumDistance
      && (candidate.activity.coworkersOnShift > 0 || candidate.activity.customersPresent > 0)
    )
    .sort((first, second) => first.distance - second.distance)
    .slice(0, maximumLots);
  for (const { lot, activity } of candidates) {
    const namedResidents = world.residentsAtWorkplace(lot.id).map(entry => entry.resident);
    const namedCount = Math.min(activity.namedWorkersOnShift, mode === "explore" ? 2 : 1);
    const coworkerCount = Math.min(mode === "explore" ? 3 : 1, Math.ceil(activity.coworkersOnShift / 18));
    const customerCount = Math.min(mode === "explore" ? 4 : 1, Math.ceil(activity.customersPresent / 12));
    const people: Array<{ role: "named" | "coworker" | "customer"; resident?: Resident }> = [
      ...Array.from({ length: namedCount }, (_, index) => ({ role: "named" as const, resident: namedResidents[index] })),
      ...Array.from({ length: coworkerCount }, () => ({ role: "coworker" as const })),
      ...Array.from({ length: customerCount }, () => ({ role: "customer" as const }))
    ];
    people.forEach(({ role, resident }, index) => {
      const seed = hash(`${lot.id}:${role}:${index}`);
      const spacing = people.length <= 1 ? 0 : (index / (people.length - 1) - .5) * Math.min(lot.width * .64, 8);
      const movement = Math.sin(world.clock.elapsedMinutes * .018 + seed) * .42;
      const local = {
        x: spacing + movement,
        z: lot.depth / 2 + 1.45 + (seed % 3) * .42
      };
      const position = localToWorld(local, lot);
      const color = role === "named" ? 0xe6c75f : role === "coworker" ? 0x63849a : sectorColors[activity.sector];
      const person = createWorkplacePerson(color, role, resident);
      person.position.set(position.x, .22, position.z);
      person.rotation.y = lot.rotation + (role === "customer" ? Math.PI : 0);
      person.userData.workplaceLotId = lot.id;
      workplaceActivityGroup.add(person);
    });
    if (mode === "city" && cityTool === "inspect" && selectedLot?.id === lot.id) {
      const label = makeLabel(`${activity.label} · ${activity.coworkersOnShift} coworkers · ${activity.customersPresent} customers`);
      label.position.set(lot.center.x, 13, lot.center.z);
      label.scale.set(54, 9, 1);
      workplaceActivityGroup.add(label);
    }
  }
}

function renderCityEvents() {
  cityEventGroup.clear();
  for (const event of world.cityEvents) {
    const active = world.cityEventActiveAt(event);
    if (!active && !(mode === "city" && cityTool === "event")) continue;
    const color = cityEventColor(event.kind);
    const group = new THREE.Group();
    group.position.set(event.position.x, .24, event.position.z);
    const radius = active ? 14 : 8;
    const beacon = new THREE.Mesh(
      new THREE.RingGeometry(radius - .8, radius, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: active ? .72 : .34,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    beacon.rotation.x = -Math.PI / 2;
    group.add(beacon);
    const venue = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 5.2, active ? 1.2 : .45, 20),
      new THREE.MeshStandardMaterial({ color, roughness: .7, emissive: color, emissiveIntensity: active ? .18 : .04 })
    );
    venue.position.y = active ? .6 : .22;
    group.add(venue);
    if (active) {
      for (const roadId of event.closureRoadIds ?? []) {
        const road = world.roads.find(item => item.id === roadId);
        if (!road) continue;
        const closureSurface = ribbon(
          road.points,
          Math.max(2.2, road.width * .2),
          new THREE.MeshBasicMaterial({
            color: 0xe4673f,
            transparent: true,
            opacity: .82,
            depthWrite: false
          })
        );
        closureSurface.position.y = .24;
        cityEventGroup.add(closureSurface);
        const nearest = nearestRoadLocation(
          explorerRoadPaths.filter(path => path.roadId === roadId),
          event.position
        );
        if (!nearest) continue;
        const barrier = new THREE.Group();
        barrier.position.set(nearest.point.x, .38, nearest.point.z);
        barrier.rotation.y = Math.atan2(nearest.tangent.x, nearest.tangent.z);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(4, road.width * .72), .48, .32),
          new THREE.MeshStandardMaterial({ color: 0xf0e5ce, roughness: .75 })
        );
        rail.position.y = .9;
        barrier.add(rail);
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(.28, 1.6, .34),
            new THREE.MeshStandardMaterial({ color: 0xe4673f, roughness: .8 })
          );
          post.position.set(side * Math.max(1.6, road.width * .3), .55, 0);
          barrier.add(post);
        }
        cityEventGroup.add(barrier);
      }
    }
    const attendance = world.cityEventExpectedAttendance(event);
    if (active) {
      const pedestrianDemand = attendance * CITY_EVENT_DEFINITIONS[event.kind].pedestrianShare;
      const crowdCount = Math.min(58, Math.max(12, Math.round(pedestrianDemand / 95)));
      for (let index = 0; index < crowdCount; index++) {
        const seed = hash(`${event.id}:crowd:${index}`);
        const angle = seed % 628 / 100;
        const distance = 5.5 + (Math.floor(seed / 7) % 850) / 100;
        const person = new THREE.Mesh(
          new THREE.CapsuleGeometry(.16, .45, 2, 5),
          new THREE.MeshStandardMaterial({
            color: [0x4f776c, 0x7f695d, 0x6c6685, 0x9a8056, 0x4f6980][seed % 5],
            roughness: .9
          })
        );
        person.position.set(Math.cos(angle) * distance, .68, Math.sin(angle) * distance);
        group.add(person);
      }
    }
    const temporaryLine = world.transitLines.find(line => line.id === event.temporaryTransitLineId);
    const operationCopy = active
      ? `${event.closureRoadIds?.length ?? 0} road ${(event.closureRoadIds?.length ?? 0) === 1 ? "closure" : "closures"}${temporaryLine ? ` · ${temporaryLine.name} every ${world.transitEffectiveHeadway(temporaryLine)}m` : ""}`
      : world.cityEventStatus(event);
    const label = makeLabel(`${event.name} · ${active ? `${attendance.toLocaleString()} attending · ${operationCopy}` : operationCopy}`);
    label.position.y = active ? 9.2 : 5.6;
    label.scale.set(96, 11, 1);
    group.add(label);
    group.traverse(object => {
      object.userData.cityEventId = event.id;
    });
    cityEventGroup.add(group);
  }
}

function pointAlongRoute(points: Point2[], progress: number) {
  if (points.length < 2) return points[0] ?? { x: 0, z: 0 };
  const lengths = points.slice(0, -1).map((point, index) =>
    Math.hypot(points[index + 1].x - point.x, points[index + 1].z - point.z)
  );
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = total * Math.max(0, Math.min(1, progress));
  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index]) {
      const amount = lengths[index] ? remaining / lengths[index] : 0;
      return {
        x: THREE.MathUtils.lerp(points[index].x, points[index + 1].x, amount),
        z: THREE.MathUtils.lerp(points[index].z, points[index + 1].z, amount)
      };
    }
    remaining -= lengths[index];
  }
  return points[points.length - 1];
}

function makeLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(16, 24, 19, .78)";
  context.beginPath();
  context.roundRect(5, 5, 502, 86, 18);
  context.fill();
  context.font = "600 30px DM Sans";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#edf3eb";
  context.fillText(text, 256, 49);
  const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(75, 14, 1);
  sprite.userData.worldLabel = true;
  sprite.visible = !photoMode;
  return sprite;
}

function hash(value: string) {
  return [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function renderDraft() {
  previewGroup.clear();
  const draftRoad = cityTool === "road" ? currentRoadConfig() : undefined;
  const previewElevation = draftRoad?.structure === "tunnel" ? .35 : draftRoad?.elevationMeters ?? 0;
  if (draft.length > 1) {
    const utility = cityTool === "utility" ? currentUtilityKind() : null;
    const preview = ribbon(
      draft,
      utility ? 2.5 : draftRoad!.width,
      new THREE.MeshBasicMaterial({ color: utility ? utilityColor(utility) : draftRoad?.structure === "tunnel" ? 0x6da9c8 : 0xe8cb68, transparent: true, opacity: draftRoad?.structure === "tunnel" ? .46 : .78 })
    );
    preview.position.y = previewElevation;
    previewGroup.add(preview);
  }
  for (const [index, point] of draft.entries()) {
    const activeSnapKind = cityTool === "road" && index === draft.length - 1 ? lastRoadSnap?.kind : undefined;
    const isGuided = activeSnapKind && activeSnapKind !== "free";
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(isGuided ? 2.1 : 1.5),
      new THREE.MeshBasicMaterial({ color: activeSnapKind === "endpoint" ? 0x73c68b : activeSnapKind === "tangent" || activeSnapKind === "parallel" ? 0x6da9c8 : 0xffe07b })
    );
    marker.position.set(point.x, previewElevation + 1.5, point.z);
    previewGroup.add(marker);
  }
  if (cityTool === "road" && draft.length > 1) {
    const from = draft[draft.length - 2];
    const to = draft[draft.length - 1];
    const length = Math.round(Math.hypot(to.x - from.x, to.z - from.z));
    const angle = Math.round((Math.atan2(to.z - from.z, to.x - from.x) * 180 / Math.PI + 360) % 360);
    const alignment = lastRoadSnap?.kind === "endpoint"
      ? ` · joins ${lastRoadSnap.targetRoadName}`
      : lastRoadSnap?.kind === "angle"
        ? " · angle locked"
        : lastRoadSnap?.kind === "tangent"
          ? ` · tangent to ${lastRoadSnap.targetRoadName}`
          : lastRoadSnap?.kind === "parallel"
            ? ` · parallel to ${lastRoadSnap.targetRoadName}`
        : "";
    const structureLabel = draftRoad?.structure === "bridge" ? ` · bridge +${draftRoad.elevationMeters}m` : draftRoad?.structure === "tunnel" ? ` · tunnel ${draftRoad.elevationMeters}m` : "";
    const guide = makeLabel(`${length}m · ${angle}°${structureLabel}${alignment}`);
    guide.position.set((from.x + to.x) / 2, previewElevation + 7, (from.z + to.z) / 2);
    guide.scale.set(56, 9, 1);
    previewGroup.add(guide);
  }
  if (mode === "home" && selectedLot && homeDraft) {
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(.55, .8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffdf72, side: THREE.DoubleSide })
    );
    const position = localToWorld(homeDraft, selectedLot);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(position.x, .3, position.z);
    previewGroup.add(marker);
  }
  if (mode === "home" && selectedLot && homePreviewPoint) {
    const home = currentHome();
    const movingItem = home?.furniture.find(item => item.id === movingFurnitureId);
    const kind = movingItem?.kind ?? (isHomeFurnitureKind(homeTool) ? homeTool : null);
    if (home && homeTool === "door") {
      const widthKind = (document.querySelector("#home-door-width") as HTMLSelectElement).value as HomeDoorWidth;
      const placement = world.previewHomeDoor(home, homePreviewPoint, homeFloor, widthKind);
      const cost = world.homeDoorCost(widthKind);
      const valid = Boolean(placement) && world.homeRemainingBudget(home) >= cost;
      const localPosition = placement
        ? {
            x: placement.orientation === "z" ? placement.center : placement.boundary,
            z: placement.orientation === "z" ? placement.boundary : placement.center
          }
        : homePreviewPoint;
      const preview = new THREE.Mesh(
        new THREE.BoxGeometry(placement?.width ?? (widthKind === "wide" ? 1.35 : .95), 2.18, .1),
        new THREE.MeshBasicMaterial({ color: valid ? 0x73c68b : 0xd96c5f, transparent: true, opacity: .5, depthWrite: false })
      );
      const worldPosition = localToWorld(localPosition, selectedLot);
      preview.position.set(worldPosition.x, 1.31, worldPosition.z);
      preview.rotation.y = selectedLot.rotation + (placement?.orientation === "x" ? Math.PI / 2 : 0);
      previewGroup.add(preview);
    } else if (home && homeTool === "window") {
      const glazing = (document.querySelector("#home-window-glazing") as HTMLSelectElement).value as HomeWindowGlazing;
      const placement = world.previewHomeWindow(home, homePreviewPoint, homeFloor, glazing);
      const cost = world.homeWindowCost(glazing);
      const valid = Boolean(placement) && world.homeRemainingBudget(home) >= cost;
      const localPosition = placement
        ? {
            x: placement.orientation === "z" ? placement.center : placement.boundary + (placement.side === "negative" ? -.11 : .11),
            z: placement.orientation === "z" ? placement.boundary + (placement.side === "negative" ? -.11 : .11) : placement.center
          }
        : homePreviewPoint;
      const preview = new THREE.Mesh(
        new THREE.BoxGeometry(placement?.width ?? 1.3, 1.1, .08),
        new THREE.MeshBasicMaterial({ color: valid ? 0x73c68b : 0xd96c5f, transparent: true, opacity: .7, depthWrite: false })
      );
      const worldPosition = localToWorld(localPosition, selectedLot);
      preview.position.set(worldPosition.x, 1.88, worldPosition.z);
      preview.rotation.y = selectedLot.rotation + (placement?.orientation === "x" ? Math.PI / 2 : 0);
      previewGroup.add(preview);
    } else if (home && kind) {
      const rotation = movingItem?.rotation ?? 0;
      const activeFloor = movingItem ? homeEntityFloor(movingItem) : homeFloor;
      const valid = world.canPlaceFurniture(home, kind, homePreviewPoint.x, homePreviewPoint.z, rotation, movingItem?.id, activeFloor);
      const size = HOME_FURNITURE_SIZE[kind];
      const footprint = new THREE.Mesh(
        new THREE.BoxGeometry(size.width, .06, size.depth),
        new THREE.MeshBasicMaterial({
          color: valid ? 0x73c68b : 0xd96c5f,
          transparent: true,
          opacity: .58,
          depthWrite: false
        })
      );
      const worldPosition = localToWorld(homePreviewPoint, selectedLot);
      footprint.position.set(worldPosition.x, .42, worldPosition.z);
      footprint.rotation.y = selectedLot.rotation + rotation;
      previewGroup.add(footprint);
    } else if (home && homeTool === "stairs") {
      const valid = homeFloor < home.floors - 1
        && homeFloorView(home, homeFloor).rooms.some(room => Math.abs(homePreviewPoint!.x - room.x) <= room.width / 2 - 1.1 && Math.abs(homePreviewPoint!.z - room.z) <= room.depth / 2 - 2.1)
        && homeFloorView(home, homeFloor + 1).rooms.some(room => Math.abs(homePreviewPoint!.x - room.x) <= room.width / 2 - 1.1 && Math.abs(homePreviewPoint!.z - room.z) <= room.depth / 2 - 2.1);
      const footprint = new THREE.Mesh(
        new THREE.BoxGeometry(2, .08, 4),
        new THREE.MeshBasicMaterial({ color: valid ? 0x73c68b : 0xd96c5f, transparent: true, opacity: .58, depthWrite: false })
      );
      const worldPosition = localToWorld(homePreviewPoint, selectedLot);
      footprint.position.set(worldPosition.x, .42, worldPosition.z);
      footprint.rotation.y = selectedLot.rotation;
      previewGroup.add(footprint);
    }
  }
  updateRoadImpactPreview();
}

function updateRoadImpactPreview() {
  const preview = document.querySelector<HTMLElement>("#road-impact-preview");
  if (!preview) return;
  const targetId = (document.querySelector("#road-target") as HTMLSelectElement).value;
  if (cityTool !== "road" || targetId || draft.length < 2) {
    preview.hidden = true;
    preview.replaceChildren();
    return;
  }
  const road = currentRoadConfig();
  const impact = world.roadConstructionImpact(draft, road.profile, road.structure, road.elevationMeters);
  const statusCopy = impact.status === "ready"
    ? "Ready to build"
    : impact.status === "funding"
      ? "Needs funding"
      : impact.status === "parcel-conflict"
        ? "Reroute around parcels"
        : impact.status === "water-conflict"
          ? "Use a bridge or tunnel"
          : "Add another point";
  const accessCopy = impact.accessible
    ? `${road.profile.sidewalkWidth}m continuous sidewalks`
    : road.structure === "surface"
      ? "Sidewalk width below accessible target"
      : "No surface frontage or sidewalk access";
  preview.classList.toggle("blocked", !impact.canBuild);
  preview.hidden = false;
  preview.innerHTML = `
    <header><span>BUILD IMPACT</span><strong>${statusCopy}</strong></header>
    <div><span>Capital cost</span><strong>$${impact.cost.toLocaleString()}</strong></div>
    <div><span>New frontage</span><strong>${impact.frontageLots} parcels</strong></div>
    <div><span>Network</span><strong>${impact.networkConnections} connections · ${impact.roadCrossings} at grade${impact.gradeSeparatedCrossings ? ` · ${impact.gradeSeparatedCrossings} separated` : ""}</strong></div>
    <div><span>Parcel clearance</span><strong>${impact.parcelConflicts ? `${impact.parcelConflicts} conflicts${impact.developedParcelConflicts ? ` · ${impact.developedParcelConflicts} developed` : ""}` : "Clear"}</strong></div>
    <div><span>Accessibility</span><strong>${accessCopy}</strong></div>
    ${impact.waterSections ? `<div><span>Water</span><strong>${impact.waterSections} route sections</strong></div>` : ""}
  `;
}

function currentRoadConfig() {
  const roadClass = (document.querySelector("#road-class") as HTMLSelectElement).value as RoadClass;
  const profile = normalizeRoadProfile({
    travelLanes: Number((document.querySelector("#road-lanes") as HTMLSelectElement).value),
    speedLimitKph: Number((document.querySelector("#road-speed") as HTMLSelectElement).value),
    sidewalkWidth: Number((document.querySelector("#road-sidewalk") as HTMLSelectElement).value),
    bikeLanes: roadFeatureEnabled("bikeLanes"),
    busLanes: roadFeatureEnabled("busLanes"),
    median: roadFeatureEnabled("median"),
    curbParking: roadFeatureEnabled("curbParking"),
    streetTrees: roadFeatureEnabled("streetTrees")
  }, roadClass);
  const structure = normalizeRoadStructure(
    (document.querySelector("#road-structure") as HTMLSelectElement).value as RoadStructure,
    Number((document.querySelector("#road-elevation") as HTMLSelectElement).value)
  );
  return {
    class: roadClass,
    profile,
    width: roadWidthForProfile(profile),
    ...structure
  };
}

function roadDrawingAidEnabled(id: "road-snap-endpoints" | "road-angle-lock" | "road-tangent-guide" | "road-parallel-guide") {
  return document.querySelector<HTMLButtonElement>(`#${id}`)?.getAttribute("aria-pressed") === "true";
}

function updateRoadDrawingAidStatus() {
  const status = document.querySelector<HTMLOutputElement>("#road-snap-status");
  if (!status) return;
  const endpointCopy = roadDrawingAidEnabled("road-snap-endpoints") ? "Endpoint snap" : "Free endpoints";
  const angleCopy = roadDrawingAidEnabled("road-angle-lock") ? "15° angle lock" : "free angle";
  const curveCopy = [
    roadDrawingAidEnabled("road-tangent-guide") ? "tangent" : "",
    roadDrawingAidEnabled("road-parallel-guide") ? "parallel" : ""
  ].filter(Boolean).join(" + ") || "free curve";
  const liveCopy = lastRoadSnap?.kind === "endpoint"
    ? ` · joined ${lastRoadSnap.targetRoadName}`
    : lastRoadSnap?.kind === "angle"
      ? ` · aligned ${lastRoadSnap.angleDegrees}°`
      : lastRoadSnap?.kind === "tangent"
        ? ` · tangent to ${lastRoadSnap.targetRoadName}`
        : lastRoadSnap?.kind === "parallel"
          ? ` · parallel to ${lastRoadSnap.targetRoadName}`
      : "";
  status.textContent = `${endpointCopy} · ${angleCopy} · ${curveCopy}${liveCopy}`;
}

function roadFeatureEnabled(feature: keyof RoadProfile) {
  return document.querySelector<HTMLButtonElement>(`[data-road-feature="${feature}"]`)?.getAttribute("aria-pressed") === "true";
}

function setRoadFeature(feature: keyof RoadProfile, enabled: boolean) {
  const button = document.querySelector<HTMLButtonElement>(`[data-road-feature="${feature}"]`);
  if (!button) return;
  button.setAttribute("aria-pressed", String(enabled));
  button.classList.toggle("active", enabled);
}

function syncRoadElevationOptions(structure: RoadStructure, selectedElevation?: number) {
  const elevation = document.querySelector<HTMLSelectElement>("#road-elevation")!;
  const options = structure === "bridge"
    ? [4, 8, 12, 16].map(value => new Option(`Bridge +${value}m`, String(value)))
    : structure === "tunnel"
      ? [-4, -8, -12, -16].map(value => new Option(`Tunnel ${value}m`, String(value)))
      : [new Option("Ground level", "0")];
  elevation.replaceChildren(...options);
  elevation.disabled = structure === "surface";
  const fallback = structure === "bridge" ? 8 : structure === "tunnel" ? -8 : 0;
  const normalized = normalizeRoadStructure(structure, selectedElevation ?? fallback);
  elevation.value = String(normalized.elevationMeters);
}

function setRoadProfileControls(profile: RoadProfile, roadClass: RoadClass, structure: RoadStructure = "surface", elevationMeters = 0) {
  (document.querySelector("#road-class") as HTMLSelectElement).value = roadClass;
  (document.querySelector("#road-lanes") as HTMLSelectElement).value = String(profile.travelLanes);
  (document.querySelector("#road-speed") as HTMLSelectElement).value = String(profile.speedLimitKph);
  (document.querySelector("#road-sidewalk") as HTMLSelectElement).value = String(profile.sidewalkWidth);
  setRoadFeature("bikeLanes", profile.bikeLanes);
  setRoadFeature("busLanes", profile.busLanes);
  setRoadFeature("median", profile.median);
  setRoadFeature("curbParking", profile.curbParking);
  setRoadFeature("streetTrees", profile.streetTrees);
  (document.querySelector("#road-structure") as HTMLSelectElement).value = structure;
  syncRoadElevationOptions(structure, elevationMeters);
  renderDraft();
  updateRoadProfileSummary();
}

function syncRoadTargetOptions() {
  const target = document.querySelector<HTMLSelectElement>("#road-target")!;
  const key = world.roads.map(road => `${road.id}:${road.name ?? ""}:${road.class ?? "street"}:${road.structure ?? "surface"}:${road.elevationMeters ?? 0}:${JSON.stringify(road.profile)}`).join("|");
  if (key !== roadTargetKey) {
    const previous = target.value;
    target.replaceChildren(
      new Option("New road", ""),
      ...world.roads.map(road => new Option(road.name ?? "Unnamed road", road.id))
    );
    target.value = world.roads.some(road => road.id === previous) ? previous : "";
    roadTargetKey = key;
    const selectedRoad = world.roads.find(road => road.id === target.value);
    if (selectedRoad) {
      const structure = world.roadStructure(selectedRoad);
      setRoadProfileControls(world.roadProfile(selectedRoad), selectedRoad.class ?? "street", structure.structure, structure.elevationMeters);
    }
  }
  document.querySelector<HTMLButtonElement>("#apply-road-profile")!.disabled = !target.value;
}

function roadProfileEffects(profile: RoadProfile) {
  const effects = [
    profile.busLanes ? "transit priority" : "general traffic",
    profile.bikeLanes ? "protected cycling" : "mixed cycling",
    profile.streetTrees ? "shade" : "open verge",
    profile.curbParking ? "curb parking" : "clear curb"
  ];
  return effects.join(" · ");
}

function updateRoadProfileSummary() {
  const summary = document.querySelector<HTMLOutputElement>("#road-profile-summary");
  if (!summary) return;
  const road = currentRoadConfig();
  const targetId = (document.querySelector("#road-target") as HTMLSelectElement).value;
  const targetRoad = world.roads.find(candidate => candidate.id === targetId);
  const pricedPoints = targetRoad?.points ?? draft;
  const rawCost = pricedPoints.length > 1
    ? roadConstructionCost(pricedPoints, road.profile, road.structure, road.elevationMeters)
    : 0;
  const cost = targetRoad ? Math.max(25_000, Math.round(rawCost * .35 / 1_000) * 1_000) : rawCost;
  const structureCopy = road.structure === "bridge"
    ? `Bridge +${road.elevationMeters}m`
    : road.structure === "tunnel"
      ? `Tunnel ${road.elevationMeters}m`
      : "Surface";
  summary.textContent = `${road.width}m · ${structureCopy} · ${roadCapacityForProfile(road.profile, road.class).toLocaleString()} veh/h${cost ? ` · $${cost.toLocaleString()}` : " · draw to price"} · ${roadProfileEffects(road.profile)}`;
}

function currentDistrictPolicy() {
  return (document.querySelector("#district-policy-kind") as HTMLSelectElement).value as DistrictPolicy;
}

function currentZoneDensity() {
  return (document.querySelector("#zone-density") as HTMLSelectElement).value as LotDensity;
}

function currentPolicyDistrictId() {
  return (document.querySelector("#district-policy-area") as HTMLSelectElement).value;
}

function syncEconomyControls() {
  (Object.keys(world.taxPolicy) as TaxCategory[]).forEach(category => {
    (document.querySelector(`#tax-${category}`) as HTMLSelectElement).value = String(world.taxPolicy[category]);
  });
  const districtSelect = document.querySelector<HTMLSelectElement>("#district-policy-area")!;
  const districts = world.areas.filter(area => area.kind === "district");
  const key = districts.map(area => `${area.id}:${area.name}`).join("|");
  if (key !== districtOptionKey) {
    const previous = districtSelect.value;
    districtSelect.replaceChildren(...districts.map(area => new Option(area.name, area.id)));
    districtSelect.value = districts.some(area => area.id === previous) ? previous : districts[0]?.id ?? "";
    districtOptionKey = key;
  }
  const policy = currentDistrictPolicy();
  const districtId = currentPolicyDistrictId();
  const enabled = Boolean(districtId && world.districtPolicies[districtId]?.includes(policy));
  const toggle = document.querySelector<HTMLButtonElement>("#district-policy-toggle")!;
  toggle.textContent = enabled ? "Disable policy" : "Enable policy";
  toggle.classList.toggle("active", enabled);
  toggle.disabled = !districtId;
  const debt = world.municipalBonds.reduce((total, bond) => total + bond.balance, 0);
  const economy = world.cityEconomy();
  document.querySelector<HTMLOutputElement>("#economy-policy-summary")!.textContent =
    `${world.municipalBonds.length}/3 bonds · $${(debt / 1_000_000).toFixed(1)}m debt · $${Math.round(economy.debtPayments / 1_000).toLocaleString()}k/mo debt service · $${Math.round(economy.districtPolicyCosts / 1_000).toLocaleString()}k/mo policies`;
  document.querySelector<HTMLButtonElement>("#issue-bond")!.disabled = world.municipalBonds.length >= 3;
  document.querySelector<HTMLButtonElement>("#repay-bond")!.disabled = debt <= 0 || world.clock.treasury < 1_000_000;
}

function updateEconomyPanel() {
  syncEconomyControls();
  const economy = world.cityEconomy();
  const developed = world.lots.filter(lot => lot.zone !== "unassigned");
  const averageLandValue = developed.length
    ? Math.round(developed.reduce((total, lot) => total + world.lotLandValue(lot), 0) / developed.length)
    : 0;
  const districtId = currentPolicyDistrictId();
  const district = world.areas.find(area => area.id === districtId);
  const policies = world.districtPolicies[districtId] ?? [];
  const policyCopy = policies.length
    ? policies.map(policy => DISTRICT_POLICY_DEFINITIONS[policy].label).join(" + ")
    : "No active district policy";
  setPanel(
    "CITY ECONOMY",
    `${economy.monthlyBalance >= 0 ? "+" : "-"}$${(Math.abs(economy.monthlyBalance) / 1_000_000).toFixed(2)}m monthly balance`,
    `Private businesses produced ${formatHomeCurrency(economy.privateSectorRevenue)} revenue and ${formatSignedHomeCurrency(economy.privateSectorProfit)} profit on the latest modeled day. Taxes: homes $${(economy.residentialTaxRevenue / 1_000_000).toFixed(2)}m, shops $${(economy.commercialTaxRevenue / 1_000_000).toFixed(2)}m, industry $${(economy.industrialTaxRevenue / 1_000_000).toFixed(2)}m. Services and operations cost $${((economy.monthlyCosts - economy.debtPayments - economy.districtPolicyCosts) / 1_000_000).toFixed(2)}m, policies cost $${(economy.districtPolicyCosts / 1_000_000).toFixed(2)}m, and debt service costs $${(economy.debtPayments / 1_000_000).toFixed(2)}m. Average developed land value is ${averageLandValue}/100. ${district?.name ?? "District"}: ${policyCopy}.`,
    "Taxes|Revenue vs demand;District policy|Local benefit and cost;Bond|Cash now, repayment later;Land value view|See place effects;Undo|Reverse policy"
  );
}

function currentServiceKind() {
  return (document.querySelector("#service-kind") as HTMLSelectElement).value as ServiceKind;
}

function currentUtilityKind() {
  return (document.querySelector("#utility-kind") as HTMLSelectElement).value as UtilityKind;
}

function currentParkingKind() {
  return (document.querySelector("#parking-kind") as HTMLSelectElement).value as ParkingKind;
}

function currentParkingRate() {
  return Number((document.querySelector("#parking-price") as HTMLSelectElement).value);
}

function currentCurbUse() {
  return (document.querySelector("#curb-use") as HTMLSelectElement).value as CurbUse;
}

function currentCurbSchedule() {
  return (document.querySelector("#curb-schedule") as HTMLSelectElement).value as CurbSchedule;
}

function currentCityEventKind() {
  return (document.querySelector("#event-kind") as HTMLSelectElement).value as CityEventKind;
}

function currentCityEventTiming() {
  return (document.querySelector("#event-timing") as HTMLSelectElement).value as CityEventTiming;
}

function cityEventColor(kind: CityEventKind) {
  return {
    concert: 0xc77bd6,
    market: 0xe2a64d,
    parade: 0x5fc7b4,
    sports: 0x6e96dc
  }[kind];
}

function cityEventTimingLabel(timing: CityEventTiming) {
  return timing === "now" ? "starting now" : timing === "tomorrow" ? "tomorrow" : "at its next event time";
}

function currentTransitHeadway() {
  return Number((document.querySelector("#transit-frequency") as HTMLSelectElement).value);
}

function currentTransitFare() {
  return Number((document.querySelector("#transit-fare") as HTMLSelectElement).value);
}

function selectedTransitLine() {
  const selected = world.transitLines.find(line => line.id === selectedTransitLineId);
  if (selected) return selected;
  selectedTransitLineId = world.transitLines[0]?.id ?? null;
  return world.transitLines[0];
}

function syncTransitControls() {
  const lineSelect = document.querySelector<HTMLSelectElement>("#transit-line")!;
  lineSelect.replaceChildren(...world.transitLines.map(line => new Option(line.name, line.id)));
  const line = selectedTransitLine();
  lineSelect.disabled = !line;
  if (!line) {
    (document.querySelector("#transit-name") as HTMLInputElement).value = "";
    (document.querySelector("#transit-rename") as HTMLButtonElement).disabled = true;
    (document.querySelector("#transit-remove") as HTMLButtonElement).disabled = true;
    return;
  }
  lineSelect.value = line.id;
  (document.querySelector("#transit-name") as HTMLInputElement).value = line.name;
  (document.querySelector("#transit-rename") as HTMLButtonElement).disabled = false;
  (document.querySelector("#transit-frequency") as HTMLSelectElement).value = String(line.headwayMinutes);
  (document.querySelector("#transit-fare") as HTMLSelectElement).value = String(line.fare);
  (document.querySelector("#transit-stops") as HTMLSelectElement).value = String(line.stops.length);
  (document.querySelector("#transit-remove") as HTMLButtonElement).disabled = world.transitLines.length <= 1;
}

function utilityColor(kind: UtilityKind) {
  return { power: 0xf0d25e, water: 0x49a9dc, sewage: 0x9a7450, waste: 0xb97d58 }[kind];
}

function utilityName(kind: UtilityKind) {
  return kind === "power" ? "Power line" : kind === "water" ? "Water main" : kind === "sewage" ? "Sewage pipe" : "Waste collection route";
}

function flowModeName(mode: "walk" | "car") {
  return mode === "walk" ? "Walk" : "Car";
}

function serviceDescription(kind: ServiceKind) {
  return {
    power: { title: "Power plant", radius: 430, cost: "$780k/month", capacity: "65,000 residents", purpose: "supplies electricity to development within a broad regional radius" },
    water: { title: "Water tower", radius: 360, cost: "$520k/month", capacity: "72,000 residents", purpose: "provides potable water and pressure across connected neighborhoods" },
    sewage: { title: "Sewage treatment plant", radius: 330, cost: "$610k/month", capacity: "68,000 residents", purpose: "processes wastewater from connected sewage mains" },
    waste: { title: "Waste transfer depot", radius: 240, cost: "$470k/month", capacity: "48,000 residents", purpose: "collects neighborhood refuse and transfers it out of the city" },
    fire: { title: "Fire station", radius: 190, cost: "$360k/month", capacity: "18,000 residents", purpose: "reduces emergency response time and fire risk nearby" },
    health: { title: "Health clinic", radius: 165, cost: "$440k/month", capacity: "12,000 residents", purpose: "provides neighborhood healthcare access and resilience" },
    school: { title: "Public school", radius: 180, cost: "$390k/month", capacity: "8,000 students", purpose: "supports families and increases residential desirability" }
  }[kind];
}

function currentHome() {
  if (!selectedLot) return null;
  return world.homes.find(home => home.lotId === selectedLot!.id) ?? null;
}

function currentExplorerInterior() {
  if (!explorerInteriorHomeId) return null;
  const home = world.homes.find(item => item.id === explorerInteriorHomeId);
  if (!home) return null;
  const lot = world.lots.find(item => item.id === home.lotId);
  return lot ? { home, lot } : null;
}

function currentExplorerFloorHome() {
  const interior = currentExplorerInterior();
  return interior ? homeFloorView(interior.home, explorerInteriorFloor) : null;
}

function controlledInteriorResident() {
  const interior = currentExplorerInterior();
  if (!interior || !controlledResidentId) return null;
  const resident = interior.home.residents.find(item => item.id === controlledResidentId);
  return resident ? { ...interior, resident } : null;
}

function residentInteriorPosition(home: Home, resident: Home["residents"][number], index: number): Point2 {
  const target = world.residentActionTarget(home, resident);
  const targetPosition = target
    ? { x: target.x + (index % 2 ? .55 : -.55), z: target.z + .65 }
    : undefined;
  if (targetPosition && isInteriorPositionValid(home, targetPosition, .2)) return targetPosition;
  if (resident.homePosition && isInteriorPositionValid(home, resident.homePosition, .2)) {
    return resident.homePosition;
  }
  const room = home.rooms[index % Math.max(1, home.rooms.length)] ?? home.rooms[0];
  const offsets = [
    { x: -1.2, z: .45 },
    { x: 0, z: .45 },
    { x: 1.2, z: .45 },
    { x: -1.2, z: -.85 },
    { x: 0, z: -.85 },
    { x: 1.2, z: -.85 }
  ];
  if (room) {
    for (let offset = 0; offset < offsets.length; offset += 1) {
      const candidateOffset = offsets[(index + offset) % offsets.length];
      const candidate = {
        x: room.x + candidateOffset.x,
        z: room.z + candidateOffset.z
      };
      if (isInteriorPositionValid(home, candidate, .2)) return candidate;
    }
  }
  return interiorEntryPoint(home) ?? { x: 0, z: 0 };
}

function cycleControlledResident() {
  const interior = currentExplorerInterior();
  if (!interior) return;
  pendingConversationPartnerId = null;
  const available = interior.home.residents.filter(
    resident => world.residentStatus(resident) === "Home"
  );
  if (!available.length) {
    controlledResidentId = null;
    world.setControlledResident();
    updateInteriorInteractionPrompt();
    notice("No household residents are home to control");
    return;
  }
  const currentIndex = available.findIndex(resident => resident.id === controlledResidentId);
  const next = currentIndex < 0
    ? available[0]
    : currentIndex === available.length - 1
      ? null
      : available[currentIndex + 1];
  controlledResidentId = next?.id ?? null;
  world.setControlledResident(next?.id);
  if (next) {
    const currentLocal = worldToLotLocal(
      { x: camera.position.x, z: camera.position.z },
      interior.lot
    );
    explorerInteriorFloor = Math.max(0, Math.min(interior.home.floors - 1, Math.round(next.homeFloor ?? explorerInteriorFloor)));
    const floorHome = homeFloorView(interior.home, explorerInteriorFloor);
    const saved = next.homePosition;
    const controlPosition = saved && isInteriorPositionValid(floorHome, saved)
      ? saved
      : interiorEntryPoint(floorHome, currentLocal) ?? interiorEntryPoint(floorHome) ?? currentLocal;
    world.setResidentHomePosition(interior.home.id, next.id, controlPosition, explorerInteriorFloor);
    const worldPosition = lotLocalToWorld(controlPosition, interior.lot);
    camera.position.x = worldPosition.x;
    camera.position.z = worldPosition.z;
    notice(`Now controlling ${next.name}`);
  } else {
    notice("Returned to observer mode");
  }
  renderHome();
  updateExplorerContext();
  updateInteriorInteractionPrompt();
}

function nearbyInteriorFurnitureInteraction() {
  const controlled = controlledInteriorResident();
  if (!controlled) return null;
  const local = worldToLotLocal(
    { x: camera.position.x, z: camera.position.z },
    controlled.lot
  );
  return nearestInteriorFurniture(homeFloorView(controlled.home, explorerInteriorFloor), local);
}

function nearbyInteriorResident() {
  const controlled = controlledInteriorResident();
  if (!controlled) return null;
  const local = worldToLotLocal(
    { x: camera.position.x, z: camera.position.z },
    controlled.lot
  );
  return controlled.home.residents
    .map((resident, index) => ({
      resident,
      position: residentInteriorPosition(homeFloorView(controlled.home, explorerInteriorFloor), resident, index)
    }))
    .filter(candidate =>
      candidate.resident.id !== controlled.resident.id
      && world.residentStatus(candidate.resident) === "Home"
      && Math.max(0, Math.round(candidate.resident.homeFloor ?? 0)) === explorerInteriorFloor
    )
    .map(candidate => ({
      ...candidate,
      distance: Math.hypot(candidate.position.x - local.x, candidate.position.z - local.z)
    }))
    .filter(candidate => candidate.distance <= 2.8)
    .sort((first, second) => first.distance - second.distance)[0] ?? null;
}

function nearbyInteriorStair() {
  const interior = currentExplorerInterior();
  if (!interior) return null;
  const local = worldToLotLocal({ x: camera.position.x, z: camera.position.z }, interior.lot);
  return (interior.home.stairs ?? [])
    .filter(stair => stair.fromFloor === explorerInteriorFloor || stair.toFloor === explorerInteriorFloor)
    .map(stair => ({ stair, distance: Math.hypot(stair.x - local.x, stair.z - local.z) }))
    .filter(candidate => candidate.distance <= 2.8)
    .sort((first, second) => first.distance - second.distance)[0] ?? null;
}

function useNearbyInteriorStair() {
  const interior = currentExplorerInterior();
  const nearby = nearbyInteriorStair();
  if (!interior || !nearby) return false;
  const targetFloor = nearby.stair.fromFloor === explorerInteriorFloor ? nearby.stair.toFloor : nearby.stair.fromFloor;
  const floorHome = homeFloorView(interior.home, targetFloor);
  const target = isInteriorPositionValid(floorHome, nearby.stair, .2)
    ? { x: nearby.stair.x, z: nearby.stair.z }
    : interiorEntryPoint(floorHome, nearby.stair);
  if (!target) {
    notice(`Floor ${targetFloor + 1} has no clear landing`);
    return true;
  }
  explorerInteriorFloor = targetFloor;
  const worldTarget = lotLocalToWorld(target, interior.lot);
  camera.position.x = worldTarget.x;
  camera.position.z = worldTarget.z;
  const controlled = controlledInteriorResident();
  if (controlled) world.setResidentHomePosition(interior.home.id, controlled.resident.id, target, targetFloor);
  explorerVelocity.set(0, 0, 0);
  renderHome();
  updateExplorerContext();
  updateExplorerMovementStatus(0);
  notice(`Moved to Floor ${targetFloor + 1}`);
  return true;
}

function useNearbyInteriorInteraction() {
  if (useNearbyInteriorStair()) return;
  const controlled = controlledInteriorResident();
  if (!controlled) {
    notice("Press C to choose a resident first");
    updateInteriorInteractionPrompt();
    return;
  }
  if (pendingConversationPartnerId) {
    pendingConversationPartnerId = null;
    updateInteriorInteractionPrompt();
    notice("Conversation choice closed");
    return;
  }
  const nearbyResident = nearbyInteriorResident();
  if (nearbyResident) {
    world.setResidentHomePosition(
      controlled.home.id,
      nearbyResident.resident.id,
      nearbyResident.position
    );
    pendingConversationPartnerId = nearbyResident.resident.id;
    updateInteriorInteractionPrompt();
    notice(`Choose how ${controlled.resident.name} talks with ${nearbyResident.resident.name}`);
    return;
  }
  const nearbyFurniture = nearbyInteriorFurnitureInteraction();
  if (!nearbyFurniture) {
    notice("Move closer to a resident or furnishing");
    updateInteriorInteractionPrompt();
    return;
  }
  const result = world.commandResidentFurnitureAction(
    controlled.home.id,
    controlled.resident.id,
    nearbyFurniture.item.id
  );
  if (!result.ok) {
    notice(result.reason);
    return;
  }
  renderHome();
  updateExplorerContext();
  updateInteriorInteractionPrompt();
  notice(result.reason);
}

function startPendingConversation(intent: ConversationIntent) {
  const controlled = controlledInteriorResident();
  const partner = controlled?.home.residents.find(
    resident => resident.id === pendingConversationPartnerId
  );
  pendingConversationPartnerId = null;
  if (!controlled || !partner) {
    updateInteriorInteractionPrompt();
    notice("That conversation partner is no longer available");
    return;
  }
  const result = world.commandResidentConversation(
    controlled.home.id,
    controlled.resident.id,
    partner.id,
    intent
  );
  if (!result.ok) {
    updateInteriorInteractionPrompt();
    notice(result.reason);
    return;
  }
  renderHome();
  updateExplorerContext();
  updateInteriorInteractionPrompt();
  notice(result.reason);
}

function updateInteriorInteractionPrompt() {
  const prompt = document.querySelector<HTMLElement>("#interaction-prompt")!;
  const interior = currentExplorerInterior();
  if (!interior) {
    prompt.classList.remove("visible", "conversation-menu");
    return;
  }
  prompt.classList.add("visible");
  prompt.classList.toggle("conversation-menu", Boolean(pendingConversationPartnerId));
  const nearbyStair = nearbyInteriorStair();
  if (nearbyStair && !pendingConversationPartnerId) {
    const targetFloor = nearbyStair.stair.fromFloor === explorerInteriorFloor ? nearbyStair.stair.toFloor : nearbyStair.stair.fromFloor;
    prompt.innerHTML = `<kbd>E</kbd><span>Take stairs to Floor ${targetFloor + 1}<small>Persistent vertical navigation</small></span><kbd>F</kbd><span>Exit home</span>`;
    return;
  }
  const controlled = controlledInteriorResident();
  if (!controlled) {
    prompt.innerHTML = "<kbd>C</kbd><span>Choose a resident to control</span>";
    return;
  }
  const pendingPartner = pendingConversationPartnerId
    ? controlled.home.residents.find(resident => resident.id === pendingConversationPartnerId)
    : undefined;
  if (pendingPartner) {
    const compatibility = world.relationshipCompatibility(controlled.resident, pendingPartner);
    const relationshipScore = world.relationshipScore(
      controlled.home,
      controlled.resident.id,
      pendingPartner.id
    );
    const relationship = world.relationshipBetween(
      controlled.home,
      controlled.resident.id,
      pendingPartner.id
    );
    const tension = relationship?.tension ?? 0;
    const impression = relationship ? world.relationshipImpression(relationship) : undefined;
    prompt.innerHTML = `
      <span class="conversation-heading">Talk with ${pendingPartner.name}<small>${world.compatibilityLabel(compatibility)} · ${world.relationshipLabel(relationshipScore)} ${relationshipScore}% · ${world.relationshipTensionLabel(tension)} tension ${tension}%${impression ? ` · ${impression.label}` : ""}</small></span>
      <span class="conversation-choice"><kbd>1</kbd>Friendly Chat<small>Social +20 · Calm +6</small></span>
      <span class="conversation-choice"><kbd>2</kbd>Offer Support<small>Social +12 · Strong calm</small></span>
      <span class="conversation-choice"><kbd>3</kbd>Tell a Joke<small>Social +16 · Calm +10</small></span>
      <span class="conversation-choice risky"><kbd>4</kbd>Confront<small>Relationship risk · Stress</small></span>
      <span class="conversation-choice reconcile"><kbd>5</kbd>Apologize<small>Repair tension · Make amends</small></span>
      <span class="conversation-cancel"><kbd>Q</kbd>Cancel</span>
    `;
    return;
  }
  const activeAction = world.activeResidentAction(controlled.resident);
  const activePartner = activeAction?.partnerResidentId
    ? controlled.home.residents.find(resident => resident.id === activeAction.partnerResidentId)
    : undefined;
  if (activeAction?.kind === "socialize" && activePartner) {
    const compatibility = world.relationshipCompatibility(controlled.resident, activePartner);
    prompt.innerHTML =
      `<span>${world.conversationIntentLabel(activeAction.conversationIntent ?? "chat")} with ${activePartner.name}<small>${world.compatibilityLabel(compatibility)} · ${Math.max(1, Math.ceil(activeAction.endsAt - world.clock.elapsedMinutes))}m remaining</small></span><kbd>WASD</kbd><span>Walk away to end</span>`;
    return;
  }
  const nearbyResident = nearbyInteriorResident();
  if (nearbyResident) {
    const relationshipScore = world.relationshipScore(
      controlled.home,
      controlled.resident.id,
      nearbyResident.resident.id
    );
    const compatibility = world.relationshipCompatibility(
      controlled.resident,
      nearbyResident.resident
    );
    const relationship = world.relationshipBetween(controlled.home, controlled.resident.id, nearbyResident.resident.id);
    const impression = relationship ? world.relationshipImpression(relationship) : undefined;
    prompt.innerHTML =
      `<kbd>E</kbd><span>Talk with ${nearbyResident.resident.name}<small>${world.compatibilityLabel(compatibility)} · ${world.relationshipLabel(relationshipScore)} ${relationshipScore}%${impression ? ` · ${impression.label}` : ""}</small></span><kbd>C</kbd><span>Switch resident</span>`;
    return;
  }
  const nearbyFurniture = nearbyInteriorFurnitureInteraction();
  if (nearbyFurniture) {
    prompt.innerHTML =
      `<kbd>E</kbd><span>${nearbyFurniture.interaction.label} with ${controlled.resident.name}<small>${nearbyFurniture.interaction.effect}</small></span><kbd>C</kbd><span>Switch resident</span>`;
    return;
  }
  const actionCopy = activeAction
    ? `${world.residentActionLabel(controlled.resident)} · ${Math.max(1, Math.ceil(activeAction.endsAt - world.clock.elapsedMinutes))}m left · ${world.residentOutfitLabel(controlled.resident)}`
    : `Walking as ${controlled.resident.name} · ${world.residentOutfitLabel(controlled.resident)}`;
  prompt.innerHTML =
    `<kbd>C</kbd><span>Switch resident<small>${actionCopy}</small></span><kbd>E</kbd><span>Talk or use furnishing</span>`;
}

function localToWorld(point: Point2, lot: Lot) {
  return lotLocalToWorld(point, lot);
}

function worldToLocal(point: THREE.Vector3, lot: Lot) {
  const dx = point.x - lot.center.x;
  const dz = point.z - lot.center.z;
  const c = Math.cos(lot.rotation);
  const s = Math.sin(lot.rotation);
  return {
    x: Math.round((c * dx - s * dz) * 2) / 2,
    z: Math.round((s * dx + c * dz) * 2) / 2
  };
}

function createResidentFigure(resident: Resident, compact = false) {
  const figure = new THREE.Group();
  const colors = world.residentOutfitColors(resident);
  const style = world.residentOutfitStyle(resident);
  const skinTones = [0xd8ad86, 0xc8946d, 0xa96f50, 0x7b4c37, 0x5a382b];
  const hairColors = [0x2f251f, 0x594332, 0x8c603f, 0xc3a176, 0x3c3532];
  const seed = hash(`${resident.id}:appearance`);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(.28, .72, 4, 8),
    new THREE.MeshStandardMaterial({ color: colors.primary, roughness: .82 })
  );
  body.position.y = .92;
  const lower = new THREE.Mesh(
    new THREE.CapsuleGeometry(.23, .43, 3, 7),
    new THREE.MeshStandardMaterial({ color: colors.secondary, roughness: .86 })
  );
  lower.position.y = .36;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(.23, 12, 9),
    new THREE.MeshStandardMaterial({ color: skinTones[seed % skinTones.length], roughness: .9 })
  );
  head.position.y = 1.62;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(.235, 12, 7, 0, Math.PI * 2, 0, Math.PI * .52),
    new THREE.MeshStandardMaterial({ color: hairColors[Math.floor(seed / 7) % hairColors.length], roughness: .88 })
  );
  hair.position.y = 1.68;
  figure.add(lower, body, head, hair);
  if (style === "casual") {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.47, .09, .58), new THREE.MeshStandardMaterial({ color: colors.accent, roughness: .8 }));
    stripe.position.y = 1.01;
    figure.add(stripe);
  } else if (style === "smart" || style === "formal") {
    const collar = new THREE.Mesh(new THREE.ConeGeometry(.2, .2, 4), new THREE.MeshStandardMaterial({ color: colors.accent, roughness: .75 }));
    collar.position.set(0, 1.28, .25);
    collar.rotation.z = Math.PI;
    figure.add(collar);
    if (style === "formal") {
      const jacket = new THREE.Mesh(new THREE.BoxGeometry(.64, .58, .52), new THREE.MeshStandardMaterial({ color: colors.primary, roughness: .72 }));
      jacket.position.y = .98;
      figure.add(jacket);
    }
  } else if (style === "active") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(.235, .035, 6, 16), new THREE.MeshStandardMaterial({ color: colors.accent, roughness: .65 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.7;
    figure.add(band);
    for (const x of [-.16, .16]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(.24, .11, .42), new THREE.MeshStandardMaterial({ color: colors.accent, roughness: .8 }));
      shoe.position.set(x, .08, .05);
      figure.add(shoe);
    }
  } else {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(.38, .22, .6), new THREE.MeshStandardMaterial({ color: colors.accent, roughness: .9 }));
    pocket.position.set(0, .77, .08);
    figure.add(pocket);
  }
  const stageScale = {
    infant: .5,
    toddler: .64,
    child: .78,
    teen: .9,
    "young-adult": 1,
    adult: 1,
    elder: .96
  }[world.residentLifeStage(resident)];
  figure.scale.setScalar(stageScale * (compact ? .9 : 1));
  figure.userData.residentId = resident.id;
  figure.userData.outfit = world.residentOutfitLabel(resident);
  return figure;
}

function renderHome() {
  homeGroup.clear();
  const explorerInterior = currentExplorerInterior();
  const lot = mode === "home" ? selectedLot : explorerInterior?.lot ?? null;
  const home = mode === "home" ? currentHome() : explorerInterior?.home ?? null;
  homeGroup.visible = Boolean(lot && home);
  if (!lot || !home) {
    if (mode === "home") updateHomeBuildControls(null);
    return;
  }
  const activeFloor = mode === "home" ? homeFloor : explorerInteriorFloor;
  const floorHome = homeFloorView(home, activeFloor);
  if (selectedFurnitureId && !floorHome.furniture.some(item => item.id === selectedFurnitureId)) {
    selectedFurnitureId = null;
  }
  if (selectedRoomId && !floorHome.rooms.some(room => room.id === selectedRoomId)) {
    selectedRoomId = null;
  }
  if (selectedHomeWindowId && !floorHome.windows?.some(window => window.id === selectedHomeWindowId)) {
    selectedHomeWindowId = null;
  }
  if (selectedHomeDoorId && !floorHome.doors?.some(door => door.id === selectedHomeDoorId)) {
    selectedHomeDoorId = null;
  }
  lastHomeActionSignature = home.residents.map(resident =>
    `${resident.id}:${resident.homeFloor ?? 0}:${world.activeResidentAction(resident)?.kind ?? world.residentStatus(resident)}:${Math.floor(world.residentActionProgress(resident) * 10)}:${world.residentWellbeing(resident).score}`
  ).join("|");
  homeGroup.position.set(lot.center.x, .2, lot.center.z);
  homeGroup.rotation.y = lot.rotation;

  const foundation = createHomeFoundation(
    lot.width - 1,
    lot.depth - 1,
    home.foundationStyle ?? defaultHomeFoundationStyle(world.templateId),
    true
  );
  foundation.userData.homeSurface = true;
  foundation.traverse(object => { object.userData.homeSurface = true; });
  homeGroup.add(foundation);

  const entrance = world.accessibilityEntrances.find(
    item => item.targetKind === "lot" && item.targetId === lot.id
  );
  const exteriorDoorway = entrance && activeFloor === 0
    ? interiorExteriorDoorway(floorHome, worldToLotLocal(entrance.position, lot))
    : undefined;
  for (const room of floorHome.rooms) {
    const floorFinish = room.floorFinish ?? "oak";
    const wallFinish = room.wallFinish ?? "warm-white";
    const roomWear = (100 - world.roomCondition(room)) / 100;
    const wornFloorColor = new THREE.Color(homeFloorColors[floorFinish]).lerp(new THREE.Color(0x625b50), roomWear * .38);
    const wornWallColor = new THREE.Color(homeWallColors[wallFinish]).lerp(new THREE.Color(0x777066), roomWear * .3);
    const selected = mode === "home" && room.id === selectedRoomId;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width, room.depth),
      new THREE.MeshStandardMaterial({
        color: selected ? wornFloorColor.clone().lerp(new THREE.Color(0xf0d980), .28) : wornFloorColor,
        emissive: selected ? 0x7b6b2b : 0x000000,
        emissiveIntensity: selected ? .16 : 0,
        roughness: floorFinish === "tile" ? .55 : floorFinish === "concrete" ? .94 : .82,
        side: THREE.DoubleSide
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(room.x, .2, room.z);
    floor.receiveShadow = true;
    floor.userData.roomId = room.id;
    homeGroup.add(floor);
    if (explorerInterior) {
      const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(room.width, room.depth),
        new THREE.MeshStandardMaterial({ color: 0xf6f1e5, roughness: .9, side: THREE.DoubleSide })
      );
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(room.x, 3.02, room.z);
      ceiling.receiveShadow = true;
      homeGroup.add(ceiling);
      const light = new THREE.PointLight(0xffd9a6, 1.05, Math.max(room.width, room.depth) * 1.3, 1.6);
      light.position.set(room.x, 2.55, room.z);
      homeGroup.add(light);
    }
    addHomeRoomWalls(floorHome, room, exteriorDoorway, wornWallColor.getHex());
    addHomeRoomWindows(floorHome, room, exteriorDoorway);
  }

  if (mode === "home" && activeFloor === home.floors - 1 && floorHome.rooms.length) {
    const minX = Math.min(...floorHome.rooms.map(room => room.x - room.width / 2));
    const maxX = Math.max(...floorHome.rooms.map(room => room.x + room.width / 2));
    const minZ = Math.min(...floorHome.rooms.map(room => room.z - room.depth / 2));
    const maxZ = Math.max(...floorHome.rooms.map(room => room.z + room.depth / 2));
    const roof = createHomeRoof(
      maxX - minX + .45,
      maxZ - minZ + .45,
      home.roofColor ?? defaultHomeRoofColor(world.templateId),
      true,
      home.roofStyle ?? defaultHomeRoofStyle(world.templateId)
    );
    roof.position.set((minX + maxX) / 2, 3.74, (minZ + maxZ) / 2);
    homeGroup.add(roof);
  }

  for (const item of floorHome.furniture) homeGroup.add(createFurniture(item));
  for (const stair of floorHome.stairs ?? []) homeGroup.add(createHomeStairs(stair, activeFloor));
  home.residents.forEach((resident, index) => {
    if (world.residentStatus(resident) !== "Home") return;
    if (Math.max(0, Math.round(resident.homeFloor ?? 0)) !== activeFloor) return;
    if (explorerInterior && resident.id === controlledResidentId) return;
    const person = new THREE.Group();
    const action = world.activeResidentAction(resident);
    const wellbeing = world.residentWellbeing(resident);
    const color = wellbeingColor(wellbeing.score);
    const figure = createResidentFigure(resident);
    if (action?.kind === "sleep") {
      figure.rotation.z = Math.PI / 2;
      figure.position.y = .38;
    }
    if (action?.kind === "relax") figure.scale.y *= .82;
    const stateRing = new THREE.Mesh(
      new THREE.RingGeometry(.42, .52, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72, side: THREE.DoubleSide })
    );
    stateRing.rotation.x = -Math.PI / 2;
    stateRing.position.y = .025;
    person.add(figure, stateRing);
    if (mode === "home") {
      const actionLabel = makeHomeLabel(`${resident.name} · ${world.residentActionLabel(resident)}`);
      actionLabel.position.set(0, 2.05, 0);
      person.add(actionLabel);
    }
    if (action?.kind === "socialize") {
      const conversationColor = {
        chat: 0xf0d980,
        support: 0x79c995,
        joke: 0xb59be9,
        confront: 0xd96c5f,
        apologize: 0x77b9d8
      }[action.conversationIntent ?? "chat"];
      for (const x of [-.18, 0, .18]) {
        const thought = new THREE.Mesh(
          new THREE.SphereGeometry(.055, 10, 8),
          new THREE.MeshBasicMaterial({ color: conversationColor })
        );
        thought.position.set(x, 1.82 + Math.abs(x) * .5, 0);
        person.add(thought);
      }
    }
    const position = residentInteriorPosition(floorHome, resident, index);
    person.position.set(position.x, .2, position.z);
    homeGroup.add(person);
  });
  const activeGathering = world.activeHouseholdGathering(home);
  if (activeGathering && activeFloor === 0) {
    const gatheringRoom = floorHome.rooms.find(room => room.kind === "Living room" || room.kind === "Dining room") ?? floorHome.rooms[0];
    if (gatheringRoom) {
      const visibleVisitors = Math.min(6, activeGathering.guestCount);
      for (let index = 0; index < visibleVisitors; index += 1) {
        const angle = index / Math.max(1, visibleVisitors) * Math.PI * 2;
        const radius = Math.min(1.8, Math.max(.8, Math.min(gatheringRoom.width, gatheringRoom.depth) * .2));
        const visitor = createWorkplacePerson([0xb59be9, 0x79c995, 0xd69a64][index % 3], "customer");
        visitor.position.set(
          gatheringRoom.x + Math.cos(angle) * radius,
          .2,
          gatheringRoom.z + Math.sin(angle) * radius
        );
        visitor.rotation.y = -angle;
        visitor.userData.gatheringVisitor = true;
        homeGroup.add(visitor);
      }
      if (mode === "home") {
        const gatheringLabel = makeHomeLabel(`${world.householdGatheringLabel(activeGathering)} · ${activeGathering.guestCount} visitors`);
        gatheringLabel.position.set(gatheringRoom.x, 2.8, gatheringRoom.z);
        homeGroup.add(gatheringLabel);
      }
    }
  }
  if (mode === "home") {
    updateHomeBuildControls(home);
    updateRoomEditor(home);
    updateHouseholdSummary(home);
  }
}

function createHomeFoundation(width: number, depth: number, style: HomeFoundationStyle, cutaway = false) {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({
    color: style === "raised" ? 0xa6977e : 0xcfbf91,
    roughness: .96,
    transparent: cutaway && style !== "slab",
    opacity: cutaway && style !== "slab" ? .72 : 1
  });
  if (style === "slab") {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, .18, depth), concrete);
    slab.position.y = .09;
    group.add(slab);
  } else if (style === "crawlspace") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(width, .42, depth), concrete);
    base.position.y = .21;
    group.add(base);
    const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x34413d, roughness: .82 });
    for (const x of [-width * .28, width * .28]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(.65, .18, .05), ventMaterial);
      vent.position.set(x, .24, depth / 2 + .026);
      group.add(vent);
    }
  } else {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width, .18, depth), concrete);
    deck.position.y = .66;
    group.add(deck);
    for (const x of [-width * .38, 0, width * .38]) {
      for (const z of [-depth * .38, depth * .38]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(.42, .66, .42), concrete);
        pier.position.set(x, .33, z);
        group.add(pier);
      }
    }
  }
  group.traverse(object => {
    if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
  });
  group.userData.homeFoundationStyle = style;
  return group;
}

function createHomeRoof(
  width: number,
  depth: number,
  color: number | string,
  cutaway = false,
  style: HomeRoofStyle = "hip"
) {
  const roof = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: .88,
    transparent: cutaway,
    opacity: cutaway ? .18 : 1,
    wireframe: cutaway,
    depthWrite: !cutaway,
    side: THREE.DoubleSide
  });
  if (style === "flat" || style === "green") {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width, .28, depth), material);
    deck.position.y = .14;
    roof.add(deck);
    if (style === "green") {
      const planting = new THREE.Mesh(
        new THREE.BoxGeometry(width * .86, .16, depth * .82),
        new THREE.MeshStandardMaterial({ color: 0x60795a, roughness: .98, transparent: cutaway, opacity: cutaway ? .22 : 1 })
      );
      planting.position.y = .36;
      roof.add(planting);
    }
  } else if (style === "gable") {
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(width * .57, .16, depth * 1.04), material);
      slope.position.set(side * width * .215, .35, 0);
      slope.rotation.z = side * .5;
      roof.add(slope);
    }
  } else {
    const hip = new THREE.Mesh(new THREE.ConeGeometry(1, 1.35, 4), material);
    hip.scale.set(width * .72, 1, depth * .72);
    hip.rotation.y = Math.PI / 4;
    roof.add(hip);
  }
  roof.traverse(object => {
    if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = !cutaway;
  });
  roof.userData.homeRoof = true;
  roof.userData.homeRoofStyle = style;
  return roof;
}

function createHomeStairs(stair: NonNullable<Home["stairs"]>[number], floor: number) {
  const group = new THREE.Group();
  group.userData.stairId = stair.id;
  group.position.set(stair.x, .22, stair.z);
  group.rotation.y = stair.rotation;
  const upward = floor === stair.fromFloor;
  const wood = new THREE.MeshStandardMaterial({ color: 0x9f7d55, roughness: .78 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x3f4943, metalness: .18, roughness: .58 });
  for (let step = 0; step < 10; step += 1) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(1.8, .18, .42), wood);
    const progression = upward ? step : 9 - step;
    tread.position.set(0, progression * .22, -1.8 + step * .4);
    tread.castShadow = tread.receiveShadow = true;
    group.add(tread);
  }
  for (const side of [-.98, .98]) {
    const handrail = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, 4.4), rail);
    handrail.position.set(side, 1.45, 0);
    handrail.rotation.x = upward ? -.47 : .47;
    group.add(handrail);
  }
  return group;
}

function makeHomeLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 72;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(16, 24, 19, .88)";
  context.beginPath();
  context.roundRect(4, 4, 376, 64, 14);
  context.fill();
  context.font = "600 24px DM Sans";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#edf3eb";
  context.fillText(text, 192, 37);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: false
  }));
  sprite.scale.set(5.6, 1.05, 1);
  sprite.userData.worldLabel = true;
  sprite.visible = !photoMode;
  return sprite;
}

function addHomeRoomWalls(
  home: Home,
  room: Home["rooms"][number],
  exteriorDoorway: ReturnType<typeof interiorExteriorDoorway>,
  wallColor: number
) {
  const doorways = interiorDoorways(home).filter(doorway => doorway.roomIds.includes(room.id));
  addSegmentedHomeWall(
    room.x - room.width / 2,
    room.x + room.width / 2,
    room.z - room.depth / 2,
    0,
    doorways.find(doorway =>
      doorway.orientation === "z" && Math.abs(doorway.boundary - (room.z - room.depth / 2)) < .2
    ) ?? (exteriorDoorway?.roomId === room.id
      && exteriorDoorway.orientation === "z"
      && Math.abs(exteriorDoorway.boundary - (room.z - room.depth / 2)) < .2
      ? exteriorDoorway
      : undefined),
    wallColor
  );
  addSegmentedHomeWall(
    room.x - room.width / 2,
    room.x + room.width / 2,
    room.z + room.depth / 2,
    0,
    doorways.find(doorway =>
      doorway.orientation === "z" && Math.abs(doorway.boundary - (room.z + room.depth / 2)) < .2
    ) ?? (exteriorDoorway?.roomId === room.id
      && exteriorDoorway.orientation === "z"
      && Math.abs(exteriorDoorway.boundary - (room.z + room.depth / 2)) < .2
      ? exteriorDoorway
      : undefined),
    wallColor
  );
  addSegmentedHomeWall(
    room.z - room.depth / 2,
    room.z + room.depth / 2,
    room.x - room.width / 2,
    Math.PI / 2,
    doorways.find(doorway =>
      doorway.orientation === "x" && Math.abs(doorway.boundary - (room.x - room.width / 2)) < .2
    ) ?? (exteriorDoorway?.roomId === room.id
      && exteriorDoorway.orientation === "x"
      && Math.abs(exteriorDoorway.boundary - (room.x - room.width / 2)) < .2
      ? exteriorDoorway
      : undefined),
    wallColor
  );
  addSegmentedHomeWall(
    room.z - room.depth / 2,
    room.z + room.depth / 2,
    room.x + room.width / 2,
    Math.PI / 2,
    doorways.find(doorway =>
      doorway.orientation === "x" && Math.abs(doorway.boundary - (room.x + room.width / 2)) < .2
    ) ?? (exteriorDoorway?.roomId === room.id
      && exteriorDoorway.orientation === "x"
      && Math.abs(exteriorDoorway.boundary - (room.x + room.width / 2)) < .2
      ? exteriorDoorway
      : undefined),
    wallColor
  );
}

function addHomeRoomWindows(
  home: Home,
  room: Home["rooms"][number],
  exteriorDoorway: ReturnType<typeof interiorExteriorDoorway>
) {
  if (home.windows !== undefined) {
    for (const window of home.windows.filter(candidate => candidate.roomId === room.id)) {
      addAuthoredHomeWindow(window, mode === "home" && selectedHomeWindowId === window.id);
    }
    return;
  }
  const frosted = room.kind === "Bathroom" || room.kind === "Nursery";
  for (const wall of homeRoomExteriorWalls(home, room)) {
    const length = wall.end - wall.start;
    if (length < 1.6) continue;
    const desiredCount = Math.max(1, Math.min(3, Math.floor(length / 3.2)));
    const centers = Array.from({ length: desiredCount }, (_, index) =>
      wall.start + length * (index + 1) / (desiredCount + 1)
    ).filter(center => !(
      exteriorDoorway?.roomId === room.id
      && exteriorDoorway.orientation === wall.orientation
      && Math.abs(exteriorDoorway.boundary - wall.boundary) < .2
      && Math.abs(exteriorDoorway.center - center) < exteriorDoorway.width / 2 + .75
    ));
    const windowWidth = Math.min(1.3, length / (desiredCount + 1) * .72);
    for (const center of centers) {
      const group = new THREE.Group();
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(windowWidth, 1.08),
        new THREE.MeshStandardMaterial({
          color: frosted ? 0xc9d8d2 : 0x86b4c4,
          emissive: frosted ? 0x263632 : 0x19323b,
          emissiveIntensity: .18,
          metalness: .05,
          roughness: frosted ? .72 : .26,
          transparent: true,
          opacity: frosted ? .82 : .72,
          side: THREE.DoubleSide
        })
      );
      group.add(glass);
      const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xe6e1d4, roughness: .78 });
      for (const horizontal of [-.59, .59]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(windowWidth + .16, .08, .06), frameMaterial);
        frame.position.y = horizontal;
        group.add(frame);
      }
      for (const vertical of [-windowWidth / 2 - .04, windowWidth / 2 + .04]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.24, .06), frameMaterial);
        frame.position.x = vertical;
        group.add(frame);
      }
      const sideOffset = wall.side === "negative" ? -.101 : .101;
      if (wall.orientation === "z") {
        group.position.set(center, 1.68, wall.boundary + sideOffset);
      } else {
        group.position.set(wall.boundary + sideOffset, 1.68, center);
        group.rotation.y = Math.PI / 2;
      }
      group.userData.homeWindow = true;
      group.userData.roomId = room.id;
      homeGroup.add(group);
    }
  }
}

function addAuthoredHomeWindow(window: NonNullable<Home["windows"]>[number], selected: boolean) {
  const group = new THREE.Group();
  const privacy = window.glazing === "privacy";
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(window.width, 1.08),
    new THREE.MeshStandardMaterial({
      color: privacy ? 0xc9d8d2 : 0x86b4c4,
      emissive: privacy ? 0x263632 : 0x19323b,
      emissiveIntensity: selected ? .42 : .18,
      metalness: .05,
      roughness: privacy ? .72 : .26,
      transparent: true,
      opacity: privacy ? .84 : .72,
      side: THREE.DoubleSide
    })
  );
  group.add(glass);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: selected ? 0xf0d980 : 0xe6e1d4,
    emissive: selected ? 0x554713 : 0x000000,
    emissiveIntensity: selected ? .28 : 0,
    roughness: .78
  });
  for (const horizontal of [-.59, .59]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(window.width + .16, .08, .06), frameMaterial);
    frame.position.y = horizontal;
    group.add(frame);
  }
  for (const vertical of [-window.width / 2 - .04, window.width / 2 + .04]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.24, .06), frameMaterial);
    frame.position.x = vertical;
    group.add(frame);
  }
  const sideOffset = window.side === "negative" ? -.101 : .101;
  if (window.orientation === "z") {
    group.position.set(window.center, 1.68, window.boundary + sideOffset);
  } else {
    group.position.set(window.boundary + sideOffset, 1.68, window.center);
    group.rotation.y = Math.PI / 2;
  }
  group.userData.homeWindow = true;
  group.userData.homeWindowId = window.id;
  group.userData.roomId = window.roomId;
  group.traverse(object => {
    object.userData.homeWindowId = window.id;
    object.userData.roomId = window.roomId;
  });
  homeGroup.add(group);
}

function addSegmentedHomeWall(
  start: number,
  end: number,
  fixed: number,
  rotation: number,
  doorway?: {
    id?: string;
    orientation: "x" | "z";
    boundary: number;
    center: number;
    width: number;
  },
  wallColor = 0xf2eee3
) {
  if (!doorway) {
    const center = (start + end) / 2;
    addWall(
      homeGroup,
      rotation ? fixed : center,
      rotation ? center : fixed,
      end - start,
      .18,
      rotation,
      wallColor
    );
    return;
  }
  const openingStart = Math.max(start, doorway.center - doorway.width / 2);
  const openingEnd = Math.min(end, doorway.center + doorway.width / 2);
  const firstLength = openingStart - start;
  const secondLength = end - openingEnd;
  if (firstLength > .05) {
    const center = start + firstLength / 2;
    addWall(homeGroup, rotation ? fixed : center, rotation ? center : fixed, firstLength, .18, rotation, wallColor);
  }
  if (secondLength > .05) {
    const center = openingEnd + secondLength / 2;
    addWall(homeGroup, rotation ? fixed : center, rotation ? center : fixed, secondLength, .18, rotation, wallColor);
  }
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(doorway.width, .7, .18),
    new THREE.MeshStandardMaterial({
      color: mode === "home" && doorway.id === selectedHomeDoorId ? 0xf0d980 : wallColor,
      roughness: .82
    })
  );
  header.position.set(
    rotation ? fixed : doorway.center,
    2.45,
    rotation ? doorway.center : fixed
  );
  header.rotation.y = rotation;
  header.castShadow = header.receiveShadow = true;
  if (doorway.id) header.userData.homeDoorId = doorway.id;
  homeGroup.add(header);
  if (doorway.id) {
    const threshold = new THREE.Mesh(
      new THREE.BoxGeometry(doorway.width, .05, .34),
      new THREE.MeshStandardMaterial({ color: doorway.id === selectedHomeDoorId ? 0xf0d980 : 0x9d815e, roughness: .74 })
    );
    threshold.position.set(rotation ? fixed : doorway.center, .24, rotation ? doorway.center : fixed);
    threshold.rotation.y = rotation;
    threshold.userData.homeDoorId = doorway.id;
    homeGroup.add(threshold);
  }
}

function addWall(group: THREE.Group, x: number, z: number, length: number, thickness: number, rotation: number, color = 0xf2eee3) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, 2.8, thickness),
    new THREE.MeshStandardMaterial({ color, roughness: .82 })
  );
  wall.position.set(x, 1.6, z);
  wall.rotation.y = rotation;
  wall.castShadow = wall.receiveShadow = true;
  group.add(wall);
}

function createFurniture(item: Home["furniture"][number]) {
  const group = new THREE.Group();
  const palette = furnitureStylePalette(item.style ?? "natural", item.tint);
  const variant = item.variant ?? "classic";
  group.userData.furnitureId = item.id;
  group.position.set(item.x, .25, item.z);
  group.rotation.y = item.rotation;
  if (item.kind === "sofa" || item.kind === "bed") {
    const size = item.kind === "sofa" ? [2.2, .55, .85] : [1.7, .45, 2.1];
    const base = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: palette.primary, roughness: .9 }));
    base.position.y = size[1] / 2;
    base.castShadow = true;
    group.add(base);
    if (item.kind === "sofa") {
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, .75, .18), new THREE.MeshStandardMaterial({ color: palette.secondary }));
      back.position.set(0, .65, .35);
      group.add(back);
    }
  } else if (item.kind === "table") {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .12, 24), new THREE.MeshStandardMaterial({ color: palette.primary }));
    top.position.y = .8;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, .75, 12), new THREE.MeshStandardMaterial({ color: palette.secondary }));
    leg.position.y = .4;
    group.add(top, leg);
  } else if (item.kind === "plant") {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.3, .24, .42, 12), new THREE.MeshStandardMaterial({ color: palette.primary }));
    pot.position.y = .21;
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshStandardMaterial({ color: palette.secondary }));
    leaves.position.y = .75;
    group.add(pot, leaves);
  } else if (item.kind === "desk") {
    const wood = new THREE.MeshStandardMaterial({ color: palette.primary, roughness: .82 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, .12, .75), wood);
    top.position.y = .82;
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(.42, .72, .62), wood);
    drawer.position.set(.5, .4, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.1, .72, .62), wood);
    leg.position.set(-.65, .4, 0);
    group.add(top, drawer, leg);
  } else if (item.kind === "bookcase") {
    const wood = new THREE.MeshStandardMaterial({ color: palette.primary, roughness: .85 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, .16), wood);
    back.position.set(0, .9, .1);
    group.add(back);
    for (const y of [.12, .58, 1.04, 1.5, 1.78]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, .08, .38), wood);
      shelf.position.y = y;
      group.add(shelf);
    }
  } else if (item.kind === "fridge") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.72, .78), new THREE.MeshStandardMaterial({ color: palette.primary, metalness: .18, roughness: .42 }));
    body.position.y = .86;
    const divider = new THREE.Mesh(new THREE.BoxGeometry(.76, .025, .02), new THREE.MeshBasicMaterial({ color: 0x6e7773 }));
    divider.position.set(0, 1.12, .401);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.035, .54, .04), new THREE.MeshStandardMaterial({ color: 0x737b78, metalness: .7 }));
    handle.position.set(.31, .78, .42);
    group.add(body, divider, handle);
  } else {
    const glass = new THREE.MeshStandardMaterial({ color: palette.secondary, transparent: true, opacity: .38, roughness: .16 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, .1, 1.05), new THREE.MeshStandardMaterial({ color: palette.primary, roughness: .5 }));
    base.position.y = .05;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.9, .07), glass);
    back.position.set(0, .95, .49);
    const side = new THREE.Mesh(new THREE.BoxGeometry(.07, 1.9, 1.05), glass);
    side.position.set(-.49, .95, 0);
    const showerHead = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x9da9a5, metalness: .72, roughness: .28 }));
    showerHead.position.set(0, 1.55, .38);
    group.add(base, back, side, showerHead);
  }
  const designedParts = [...group.children];
  if (variant === "modern") {
    for (const child of designedParts) {
      child.position.y *= .86;
      child.scale.y *= .86;
    }
    const size = HOME_FURNITURE_SIZE[item.kind];
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(size.width * .72, .08, size.depth * .72),
      new THREE.MeshStandardMaterial({ color: 0x242a29, metalness: .38, roughness: .48 })
    );
    plinth.position.y = .04;
    group.add(plinth);
  } else if (variant === "soft") {
    for (const child of designedParts) {
      child.scale.x *= .94;
      child.scale.z *= .94;
    }
    if (item.kind === "sofa" || item.kind === "bed") {
      for (const x of [-.42, .42]) {
        const cushion = new THREE.Mesh(
          new THREE.SphereGeometry(.3, 18, 12),
          new THREE.MeshStandardMaterial({ color: palette.secondary, roughness: .96 })
        );
        cushion.scale.set(1.25, .5, .75);
        cushion.position.set(x, item.kind === "sofa" ? .58 : .48, item.kind === "sofa" ? .12 : -.72);
        group.add(cushion);
      }
    }
  }
  const wear = (100 - world.furnitureCondition(item)) / 100;
  if (wear > 0) {
    group.traverse(child => {
      if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) return;
      const material = child.material.clone();
      material.color.lerp(new THREE.Color(0x665e55), wear * .34);
      material.roughness = Math.min(1, material.roughness + wear * .18);
      child.material = material;
    });
  }
  group.traverse(child => {
    if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true;
  });
  group.traverse(child => { child.userData.furnitureId = item.id; });
  if (mode === "home" && selectedFurnitureId === item.id) {
    const size = HOME_FURNITURE_SIZE[item.kind];
    const outerRadius = Math.max(size.width, size.depth) * .62 + .16;
    const selection = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(.28, outerRadius - .12), outerRadius, 32),
      new THREE.MeshBasicMaterial({ color: 0xf0d980, transparent: true, opacity: .92, side: THREE.DoubleSide })
    );
    selection.rotation.x = -Math.PI / 2;
    selection.position.y = .025;
    selection.userData.furnitureId = item.id;
    group.add(selection);
  }
  return group;
}

function furnitureStylePalette(style: HomeFurnitureStyle, tint?: string) {
  const palette = {
    natural: { primary: 0x9a7654, secondary: 0x5f765f },
    light: { primary: 0xe4ded1, secondary: 0xbec9c3 },
    dark: { primary: 0x3f4544, secondary: 0x222827 },
    colorful: { primary: 0xd36b62, secondary: 0x4f8792 }
  }[style];
  if (!tint || !/^#[0-9a-f]{6}$/i.test(tint)) return palette;
  const primary = new THREE.Color(tint);
  const secondary = primary.clone().offsetHSL(.055, -.08, -.14);
  return { primary: primary.getHex(), secondary: secondary.getHex() };
}

function furniturePaletteColor(style: HomeFurnitureStyle) {
  return `#${furnitureStylePalette(style).primary.toString(16).padStart(6, "0")}`;
}

function formatHomeCurrency(value: number) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function formatSignedHomeCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

function homeFurnitureLabel(kind: HomeFurnitureKind) {
  return {
    sofa: "sofa",
    table: "dining table",
    bed: "bed",
    plant: "plant",
    desk: "desk",
    bookcase: "bookcase",
    fridge: "fridge",
    shower: "shower"
  }[kind];
}

function residentRoleLabel(role: ResidentRole) {
  return {
    office: "Office worker",
    service: "Service worker",
    student: "Student",
    home: "Home-based"
  }[role];
}

function selectedCreatorTraits() {
  return [...document.querySelectorAll<HTMLInputElement>(".resident-trait-picker input:checked")]
    .map(input => input.value as ResidentTrait);
}

function creatorPersonality(): ResidentPersonality {
  const values = Object.fromEntries(
    [...document.querySelectorAll<HTMLInputElement>("[data-personality-axis]")]
      .map(input => [input.dataset.personalityAxis!, Number(input.value)])
  ) as ResidentPersonality;
  return values;
}

function updateResidentCreatorPreview() {
  const name = (document.querySelector<HTMLInputElement>("#resident-name")!.value.trim() || "New resident").slice(0, 24);
  const lifeStage = document.querySelector<HTMLSelectElement>("#resident-age")!.value as ResidentLifeStage;
  const roleSelect = document.querySelector<HTMLSelectElement>("#resident-role")!;
  const careerTrack = document.querySelector<HTMLSelectElement>("#resident-career-track")!.value as ResidentCareerTrack;
  const dependent = ["infant", "toddler", "child", "teen"].includes(lifeStage);
  if (lifeStage === "infant" || lifeStage === "toddler" || lifeStage === "elder") {
    roleSelect.value = "home";
    roleSelect.disabled = true;
  } else if (lifeStage === "child" || lifeStage === "teen") {
    roleSelect.value = "student";
    roleSelect.disabled = true;
  } else {
    roleSelect.disabled = false;
    roleSelect.value = RESIDENT_CAREER_TRACK_DEFINITIONS[careerTrack].role;
  }
  const role = roleSelect.value as ResidentRole;
  const aspiration = document.querySelector<HTMLSelectElement>("#resident-aspiration")!.value as ResidentAspiration;
  const decorPreference = document.querySelector<HTMLSelectElement>("#resident-decor-preference")!.value as HomeFurnitureStyle;
  const favoritePastime = document.querySelector<HTMLSelectElement>("#resident-favorite-pastime")!.value as ResidentPastime;
  const outfitStyle = document.querySelector<HTMLSelectElement>("#resident-outfit-style")!.value as ResidentOutfitStyle;
  const outfitPalette = document.querySelector<HTMLSelectElement>("#resident-outfit-palette")!.value as ResidentOutfitPalette;
  const routineProfile = document.querySelector<HTMLSelectElement>("#resident-routine-profile")!.value as ResidentRoutineProfile;
  const outfitColors = RESIDENT_OUTFIT_PALETTES[outfitPalette];
  const caregiverFields = document.querySelector<HTMLElement>("#resident-caregiver-fields")!;
  caregiverFields.hidden = !dependent;
  const traits = selectedCreatorTraits();
  const personality = creatorPersonality();
  document.querySelectorAll<HTMLInputElement>("[data-personality-axis]").forEach(input => {
    const output = input.parentElement?.querySelector("output");
    if (output) output.textContent = input.value;
  });
  document.querySelector("#resident-preview-name")!.textContent = name;
  const caregiverNames = dependent
    ? ["#resident-caregiver-a", "#resident-caregiver-b"]
        .map(selector => document.querySelector<HTMLSelectElement>(selector)!)
        .filter(select => select.value)
        .map(select => select.options[select.selectedIndex]?.text)
    : [];
  document.querySelector("#resident-preview-copy")!.textContent = `${RESIDENT_LIFE_STAGE_DEFINITIONS[lifeStage].label} · ${residentRoleLabel(role)} · ${RESIDENT_CAREER_TRACK_DEFINITIONS[careerTrack].label} · ${RESIDENT_ASPIRATION_DEFINITIONS[aspiration].label} · ${RESIDENT_ROUTINE_DEFINITIONS[routineProfile].label} · ${decorPreference} home · ${RESIDENT_PASTIME_DEFINITIONS[favoritePastime].label}${caregiverNames.length ? ` · caregivers ${caregiverNames.join(" + ")}` : ""} · ${traits.length === 2 ? traits.map(trait => world.residentTraitLabel(trait)).join(" + ") : `Choose ${2 - traits.length} more ${2 - traits.length === 1 ? "trait" : "traits"}`}`;
  const strongest = RESIDENT_PERSONALITY_AXES
    .map(axis => ({ axis, value: personality[axis], distance: Math.abs(personality[axis] - 50) }))
    .filter(entry => entry.distance > 0)
    .sort((first, second) => second.distance - first.distance || first.axis.localeCompare(second.axis))
    .slice(0, 2);
  document.querySelector("#resident-preview-personality")!.textContent = strongest[0]?.distance
    ? strongest.map(entry => `${world.residentPersonalityAxisLabel(entry.axis)} ${entry.value}`).join(" · ")
    : "Balanced personality matrix";
  document.querySelector("#resident-preview-outfit")!.textContent = `${RESIDENT_OUTFIT_DEFINITIONS[outfitStyle].label} · ${outfitColors.label}`;
  (document.querySelector<HTMLElement>("#resident-outfit-primary")!).style.background = `#${outfitColors.primary.toString(16).padStart(6, "0")}`;
  (document.querySelector<HTMLElement>("#resident-outfit-secondary")!).style.background = `#${outfitColors.secondary.toString(16).padStart(6, "0")}`;
  (document.querySelector<HTMLElement>("#resident-outfit-accent")!).style.background = `#${outfitColors.accent.toString(16).padStart(6, "0")}`;
}

function openResidentCreator() {
  const home = currentHome();
  if (!home) return;
  if (home.residents.length >= 8) {
    notice("This household already has the maximum of 8 named residents");
    return;
  }
  const suggestions = ["Avery", "Jordan", "Maya", "Theo", "Rowan", "Sofia", "Noah", "June"];
  const usedNames = new Set(home.residents.map(resident => resident.name.toLocaleLowerCase()));
  const suggestion = suggestions.find(name => !usedNames.has(name.toLocaleLowerCase())) ?? `Resident ${home.residents.length + 1}`;
  const form = document.querySelector<HTMLFormElement>("#resident-creator-form")!;
  form.reset();
  document.querySelector<HTMLSelectElement>("#resident-age")!.value = "adult";
  document.querySelector<HTMLSelectElement>("#resident-career-track")!.value = "civic";
  document.querySelector<HTMLSelectElement>("#resident-aspiration")!.value = "family";
  document.querySelector<HTMLSelectElement>("#resident-decor-preference")!.value = "natural";
  document.querySelector<HTMLSelectElement>("#resident-favorite-pastime")!.value = "socializing";
  document.querySelector<HTMLSelectElement>("#resident-outfit-style")!.value = "casual";
  document.querySelector<HTMLSelectElement>("#resident-outfit-palette")!.value = "earth";
  document.querySelector<HTMLSelectElement>("#resident-routine-profile")!.value = "steady";
  const eligibleCaregivers = home.residents.filter(resident => ["young-adult", "adult", "elder"].includes(world.residentLifeStage(resident)));
  for (const selector of ["#resident-caregiver-a", "#resident-caregiver-b"]) {
    const select = document.querySelector<HTMLSelectElement>(selector)!;
    select.replaceChildren(new Option("None", ""), ...eligibleCaregivers.map(resident => new Option(`${resident.name} · ${world.residentLifeStageLabel(resident)}`, resident.id)));
  }
  document.querySelector<HTMLInputElement>("#resident-name")!.value = suggestion;
  document.querySelectorAll<HTMLInputElement>(".resident-trait-picker input").forEach(input => {
    input.checked = input.value === "outgoing" || input.value === "empathetic";
  });
  const starterPersonality: ResidentPersonality = {
    cleanliness: 52,
    spontaneity: 62,
    sociability: 82,
    emotionality: 40,
    activity: 54
  };
  document.querySelectorAll<HTMLInputElement>("[data-personality-axis]").forEach(input => {
    input.value = String(starterPersonality[input.dataset.personalityAxis as keyof ResidentPersonality]);
  });
  document.querySelector<HTMLElement>("#resident-creator")!.hidden = false;
  form.scrollTop = 0;
  pauseForModal();
  updateResidentCreatorPreview();
  document.querySelector<HTMLInputElement>("#resident-name")!.focus();
}

function closeResidentCreator() {
  document.querySelector<HTMLElement>("#resident-creator")!.hidden = true;
  resumeAfterModal();
}

function updateHomeBuildControls(home: Home | null) {
  const selected = home?.furniture.find(item => item.id === selectedFurnitureId) ?? null;
  const selectedWindow = home?.windows?.find(item => item.id === selectedHomeWindowId) ?? null;
  const selectedDoor = home?.doors?.find(item => item.id === selectedHomeDoorId) ?? null;
  const move = document.querySelector<HTMLButtonElement>("#move-furniture")!;
  const rotate = document.querySelector<HTMLButtonElement>("#rotate-furniture")!;
  const style = document.querySelector<HTMLSelectElement>("#furniture-style")!;
  const variant = document.querySelector<HTMLSelectElement>("#furniture-variant")!;
  const tint = document.querySelector<HTMLInputElement>("#furniture-tint")!;
  const owner = document.querySelector<HTMLSelectElement>("#furniture-owner")!;
  const sell = document.querySelector<HTMLButtonElement>("#sell-furniture")!;
  const repair = document.querySelector<HTMLButtonElement>("#repair-furniture")!;
  const addResident = document.querySelector<HTMLButtonElement>("#add-resident")!;
  const autoAssignRooms = document.querySelector<HTMLButtonElement>("#auto-assign-rooms")!;
  const homeNameInput = document.querySelector<HTMLInputElement>("#home-name-input")!;
  const floorSelect = document.querySelector<HTMLSelectElement>("#home-floor")!;
  const addFloor = document.querySelector<HTMLButtonElement>("#add-home-floor")!;
  const removeFloor = document.querySelector<HTMLButtonElement>("#remove-home-floor")!;
  const removeWindow = document.querySelector<HTMLButtonElement>("#remove-home-window")!;
  const windowGlazing = document.querySelector<HTMLSelectElement>("#home-window-glazing")!;
  const removeDoor = document.querySelector<HTMLButtonElement>("#remove-home-door")!;
  const doorWidth = document.querySelector<HTMLSelectElement>("#home-door-width")!;
  const roofStyle = document.querySelector<HTMLSelectElement>("#home-roof-style")!;
  const roofColor = document.querySelector<HTMLInputElement>("#home-roof-color")!;
  const applyRoof = document.querySelector<HTMLButtonElement>("#apply-home-roof")!;
  const foundationStyle = document.querySelector<HTMLSelectElement>("#home-foundation-style")!;
  const applyFoundation = document.querySelector<HTMLButtonElement>("#apply-home-foundation")!;
  floorSelect.replaceChildren(...Array.from({ length: home?.floors ?? 1 }, (_, floor) => new Option(`Floor ${floor + 1}`, String(floor))));
  if (home) homeFloor = Math.max(0, Math.min(home.floors - 1, homeFloor));
  floorSelect.value = String(homeFloor);
  floorSelect.disabled = !home;
  addFloor.disabled = !home || home.floors >= MAX_HOME_FLOORS || world.homeRemainingBudget(home) < HOME_BUILD_COSTS.floorShell;
  addFloor.textContent = home && home.floors >= MAX_HOME_FLOORS ? `Max ${MAX_HOME_FLOORS} floors` : "+ Floor · $12k";
  removeFloor.disabled = !home || home.floors <= 1;
  removeWindow.disabled = !selectedWindow;
  removeWindow.textContent = selectedWindow
    ? `Remove ${selectedWindow.glazing} window · ${formatHomeCurrency(world.homeWindowCost(selectedWindow.glazing) * .5)}`
    : "Remove window";
  windowGlazing.disabled = !home;
  removeDoor.disabled = !selectedDoor;
  removeDoor.textContent = selectedDoor
    ? `Remove ${selectedDoor.widthKind} doorway · ${formatHomeCurrency(world.homeDoorCost(selectedDoor.widthKind) * .5)}`
    : "Remove doorway";
  doorWidth.disabled = !home;
  roofStyle.disabled = !home;
  roofColor.disabled = !home;
  applyRoof.disabled = !home;
  if (home && document.activeElement !== roofStyle) roofStyle.value = home.roofStyle ?? defaultHomeRoofStyle(world.templateId);
  if (home && document.activeElement !== roofColor) roofColor.value = home.roofColor ?? defaultHomeRoofColor(world.templateId);
  if (home) {
    const pendingRoofStyle = roofStyle.value as HomeRoofStyle;
    applyRoof.textContent = `Apply ${pendingRoofStyle} roof · ${formatHomeCurrency(world.homeRoofCost(pendingRoofStyle))}`;
  } else {
    applyRoof.textContent = "Apply roof";
  }
  foundationStyle.disabled = !home;
  applyFoundation.disabled = !home;
  if (home && document.activeElement !== foundationStyle) foundationStyle.value = home.foundationStyle ?? defaultHomeFoundationStyle(world.templateId);
  if (home) {
    const pendingFoundation = foundationStyle.value as HomeFoundationStyle;
    applyFoundation.textContent = `Apply ${pendingFoundation} · ${formatHomeCurrency(world.homeFoundationCost(pendingFoundation))}`;
  } else {
    applyFoundation.textContent = "Apply foundation";
  }
  move.disabled = !selected;
  rotate.disabled = !selected;
  style.disabled = !selected;
  style.value = selected?.style ?? "natural";
  variant.disabled = !selected;
  variant.value = selected?.variant ?? "classic";
  tint.disabled = !selected;
  tint.value = selected?.tint ?? furniturePaletteColor(selected?.style ?? "natural");
  owner.replaceChildren(
    new Option("Shared household", ""),
    ...(home?.residents ?? []).map(resident => new Option(`Owned by ${resident.name}`, resident.id))
  );
  owner.disabled = !selected || !home?.residents.length;
  owner.value = selected?.ownerResidentId ?? "";
  sell.disabled = !selected;
  const repairCost = selected ? world.furnitureRepairCost(selected) : 0;
  repair.disabled = !selected || !repairCost;
  addResident.disabled = !home || home.residents.length >= 8;
  addResident.textContent = home && home.residents.length >= 8 ? "Household full · 8" : "+ Resident";
  autoAssignRooms.disabled = !home?.residents.length || !home.rooms.some(room => world.roomResidentCapacity(home, room) > 0);
  homeNameInput.disabled = !home;
  document.querySelector<HTMLButtonElement>("#rename-home")!.disabled = !home;
  if (home && document.activeElement !== homeNameInput) homeNameInput.value = home.name;
  move.textContent = movingFurnitureId && selected ? `Cancel ${selected.kind} move` : "Move";
  move.classList.toggle("active", Boolean(movingFurnitureId && selected));
  rotate.textContent = selected ? `Rotate ${selected.kind} 45°` : "Rotate 45°";
  sell.textContent = selected
    ? `Sell ${selected.kind} · ${formatHomeCurrency(HOME_BUILD_COSTS[selected.kind] * .5)}`
    : "Sell";
  repair.textContent = selected
    ? repairCost
      ? `Repair ${world.furnitureCondition(selected)}% · ${formatHomeCurrency(repairCost)}`
      : "Pristine · 100%"
    : "Repair";
  document.querySelector("#home-budget")!.textContent = home
    ? `Floor ${homeFloor + 1} of ${home.floors} · ${formatHomeCurrency(world.homeRemainingBudget(home))} left`
    : "Design budget unavailable";
  const circulation = home ? homeCirculation(home) : null;
  const circulationElement = document.querySelector<HTMLElement>("#home-circulation")!;
  circulationElement.textContent = circulation ? `Circulation ${circulation.score}% · ${circulation.summary}` : "Circulation unavailable";
  circulationElement.classList.toggle("warning", Boolean(circulation && !circulation.connected));
  const energy = home ? world.homeEnergyPerformance(home) : null;
  document.querySelector("#home-energy")!.textContent = energy
    ? `Energy ${energy.score}% · ${energy.dailyKwh.toFixed(1)} kWh/day · ${formatHomeCurrency(energy.dailyCost)}/day`
    : "Energy unavailable";
  document.querySelector("#home-privacy")!.textContent = home
    ? `Bedroom privacy ${world.homePrivacy(home)}% · ${home.residents.filter(resident => world.residentRoom(home, resident.id)).length}/${home.residents.length} residents assigned`
    : "Privacy unavailable";
  const spacePlan = home ? world.homeSpacePlan(home) : null;
  const spaceElement = document.querySelector<HTMLElement>("#home-space-plan")!;
  spaceElement.textContent = spacePlan
    ? `Space ${spacePlan.score}% · beds ${spacePlan.beds.capacity}/${spacePlan.beds.demand} · hygiene ${spacePlan.hygiene.capacity}/${spacePlan.hygiene.demand} · work ${spacePlan.work.capacity}/${spacePlan.work.demand} · seats ${spacePlan.social.capacity}/${spacePlan.social.demand}`
    : "Space plan unavailable";
  spaceElement.classList.toggle("warning", Boolean(spacePlan?.deficits.some(deficit => deficit.severity !== "advisory")));
  const safety = home ? homeSafetyAudit(home) : null;
  const safetyElement = document.querySelector<HTMLElement>("#home-safety")!;
  safetyElement.textContent = safety
    ? `Safety ${safety.score}% · egress ${safety.egressCoverage}% · clearance ${safety.clearanceShare}% · ${safety.issues.length} issue${safety.issues.length === 1 ? "" : "s"}`
    : "Safety audit unavailable";
  safetyElement.classList.toggle("warning", Boolean(safety && !safety.safe));
}

function updateRoomEditor(home: Home | null) {
  const editor = document.querySelector<HTMLElement>("#room-editor")!;
  const room = home?.rooms.find(item => item.id === selectedRoomId) ?? null;
  editor.classList.toggle("visible", Boolean(mode === "home" && room));
  if (!home || !room) return;
  const roomCondition = world.roomCondition(room);
  const renovationCost = world.roomRenovationCost(room);
  document.querySelector("#room-editor-title")!.textContent = `${room.kind} · ${room.width.toFixed(1)} × ${room.depth.toFixed(1)}m`;
  document.querySelector("#room-condition")!.textContent = `${world.homeConditionLabel(roomCondition)} · ${roomCondition}%`;
  const renovate = document.querySelector<HTMLButtonElement>("#renovate-room")!;
  renovate.disabled = !renovationCost;
  renovate.textContent = renovationCost ? `Renovate · ${formatHomeCurrency(renovationCost)}` : "Pristine · 100%";
  const kindSelect = document.querySelector<HTMLSelectElement>("#room-kind")!;
  if (![...kindSelect.options].some(option => option.value === room.kind)) {
    kindSelect.add(new Option(room.kind, room.kind));
  }
  kindSelect.value = room.kind;
  document.querySelector<HTMLSelectElement>("#room-floor-finish")!.value = room.floorFinish ?? "oak";
  document.querySelector<HTMLSelectElement>("#room-wall-finish")!.value = room.wallFinish ?? "warm-white";
  const roomCapacity = world.roomResidentCapacity(home, room);
  const assignedIds = room.assignedResidentIds ?? [];
  const claimSelect = document.querySelector<HTMLSelectElement>("#room-resident-claim")!;
  claimSelect.replaceChildren(
    new Option("Clear room claims", ""),
    ...home.residents.map(resident => new Option(
      `${assignedIds.includes(resident.id) ? "✓ " : ""}${resident.name} · ${world.residentLifeStageLabel(resident)}`,
      resident.id
    ))
  );
  claimSelect.disabled = !roomCapacity || !home.residents.length;
  claimSelect.value = assignedIds[0] ?? "";
  const assignedNames = assignedIds.map(id => home.residents.find(resident => resident.id === id)?.name).filter(Boolean);
  const assignedFits = assignedIds
    .map(id => home.residents.find(resident => resident.id === id))
    .filter((resident): resident is Resident => Boolean(resident))
    .map(resident => world.residentRoomFit(home, resident).score);
  document.querySelector("#room-claim-status")!.textContent = roomCapacity
    ? `${assignedNames.length}/${roomCapacity} claimed · ${assignedNames.join(", ") || "unassigned"}${assignedFits.length ? ` · ${Math.round(assignedFits.reduce((total, score) => total + score, 0) / assignedFits.length)}% fit` : ""}`
    : "Add a bed to a Bedroom, Nursery, or Studio";
  const assignButton = document.querySelector<HTMLButtonElement>("#assign-room-resident")!;
  assignButton.disabled = !roomCapacity || !home.residents.length;
  assignButton.textContent = assignedIds.length ? "Update room claim" : "Assign room";
  const deleteButton = document.querySelector<HTMLButtonElement>("#delete-room")!;
  const floorRoomCount = home.rooms.filter(candidate => homeEntityFloor(candidate) === homeEntityFloor(room)).length;
  deleteButton.disabled = floorRoomCount <= 1;
  deleteButton.textContent = floorRoomCount <= 1 ? "Keep one room on floor" : "Delete room · 25% refund";
}

function updateHouseholdSummary(home: Home) {
  const summary = document.querySelector("#household-summary")!;
  summary.textContent = home.residents.length
    ? home.residents.map(resident => {
      const wellbeing = world.residentWellbeing(resident);
      return `${resident.name} · ${world.residentActionLabel(resident)} · ${wellbeing.score}%`;
    }).join("   ")
    : "No named residents yet";
  if (selectedLot) {
    const activity = world.lotActivity(selectedLot);
    const flow = world.commuteForLot(selectedLot);
    const commuteCopy = flow
      ? ` A representative group of ${flow.travelers} takes about ${world.estimatedCommuteMinutes(flow)} minutes by ${flow.mode === "car" ? "car" : "foot"}.`
      : "";
    const homeScore = world.homeWellbeing(home);
    const outages = world.utilityFailuresForLot(selectedLot);
    const outageCopy = outages.length
      ? ` ${outages.length} active utility ${outages.length === 1 ? "outage is" : "outages are"} affecting this home.`
      : "";
    const activeHouseholdActions = home.residents
      .filter(resident => world.residentStatus(resident) === "Home")
      .map(resident => `${resident.name} is ${world.residentActionLabel(resident).toLowerCase()}`);
    const actionCopy = activeHouseholdActions.length
      ? ` Right now, ${activeHouseholdActions.join(" and ")}.`
      : "";
    const gatherings = world.householdGatherings(home);
    const activeGathering = world.activeHouseholdGathering(home);
    const gatheringCopy = activeGathering
      ? ` ${world.householdGatheringLabel(activeGathering)} is underway with ${activeGathering.guestCount} visitors.`
      : "";
    const homeCondition = world.homeCondition(home);
    const homeDaylight = world.homeDaylight(home);
    const circulation = homeCirculation(home);
    const foundation = world.homeFoundationPerformance(home);
    const energy = world.homeEnergyPerformance(home);
    const privacy = world.homePrivacy(home);
    const spacePlan = world.homeSpacePlan(home);
    const safety = homeSafetyAudit(home);
    const unreachableRooms = home.rooms
      .filter(room => circulation.unreachableRoomIds.includes(room.id))
      .map(room => `${room.kind} on Floor ${homeEntityFloor(room) + 1}`);
    document.querySelector("#panel-copy")!.textContent =
      `${home.residents.length ? `${home.name} is ${wellbeingLabel(homeScore).toLowerCase()} at ${homeScore}% wellbeing.` : "Build the home and add residents to begin their daily simulation."} This is a ${home.floors}-floor home with ${home.rooms.length} rooms, a ${home.roofStyle ?? defaultHomeRoofStyle(world.templateId)} roof, a ${foundation.style} foundation, and ${(home.stairs ?? []).length} stair connection${(home.stairs ?? []).length === 1 ? "" : "s"}, currently ${world.homeConditionLabel(homeCondition).toLowerCase()} at ${homeCondition}% condition with ${homeDaylight}% daylight and ${privacy}% bedroom privacy. The household space plan scores ${spacePlan.score}%${spacePlan.deficits.length ? ` and recommends ${spacePlan.deficits[0].recommendation.toLowerCase()}` : " with every tracked capacity covered"}. Safety scores ${safety.score}% with ${safety.egressCoverage}% sleeping-room egress coverage${safety.issues.length ? `; first priority: ${safety.issues[0].recommendation.toLowerCase()}` : " and no identified hazards"}. The ${foundation.floodRisk} flood risk becomes ${foundation.residualExposure}% residual exposure after ${foundation.protection}% foundation protection. Energy performance is ${energy.score}% at ${energy.dailyKwh.toFixed(1)} kWh and ${formatHomeCurrency(energy.dailyCost)} per day.${energy.benefits.length ? ` Benefits: ${energy.benefits.join(", ")}.` : ""} Circulation is ${circulation.score}%: ${circulation.summary}.${unreachableRooms.length ? ` Unreachable spaces: ${unreachableRooms.join(", ")}.` : ""} The household has ${formatHomeCurrency(world.homeHouseholdFunds(home))} with a ${formatSignedHomeCurrency(world.homeDailyNet(home))} last daily result. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains from the separate ${formatHomeCurrency(home.designBudget)} design budget. ${activity.atHome} residents are home, ${activity.atWorkOrSchool} are at work or school, and ${activity.outInCity} are elsewhere.${actionCopy}${gatheringCopy}${outageCopy}${commuteCopy}`;
    const details = document.querySelector("#parcel-details")!;
    const utility = world.lotUtilityReliability(selectedLot);
    const neighborhood = world.lotNeighborhoodSupport(selectedLot);
    const entrance = world.accessibilityEntrances.find(
      item => item.targetKind === "lot" && item.targetId === selectedLot!.id
    );
    const homeAdvice = homeAdvisorActions({
      residents: home.residents,
      furniture: home.furniture,
      roomCount: home.rooms.length,
      householdFunds: world.homeHouseholdFunds(home),
      dailyNet: world.homeDailyNet(home),
      highestTension: Math.max(0, ...home.relationships.map(relationship => relationship.tension ?? 0))
    });
    const homeFunctionality = world.homeFunctionality(home);
    const destinationHomes = world.homes.filter(candidate => candidate.id !== home.id);
    details.innerHTML = `
      <div class="home-wellbeing-overview">
        <div><span>Structure</span><strong>${home.floors} floor${home.floors === 1 ? "" : "s"}</strong></div>
        <div><span>Roof</span><strong>${home.roofStyle ?? defaultHomeRoofStyle(world.templateId)}</strong></div>
        <div title="${foundation.protection}% flood protection"><span>Foundation</span><strong>${foundation.style} · ${foundation.residualExposure}% exposure</strong></div>
        <div title="Heating ${energy.heating} kWh · cooling ${energy.cooling} kWh · lighting ${energy.lighting} kWh"><span>Energy</span><strong>${energy.score}% · ${formatHomeCurrency(energy.dailyCost)}/day</strong></div>
        <div><span>Bedroom privacy</span><strong>${privacy}%</strong></div>
        <div title="${spacePlan.area.squareMeters} of ${spacePlan.area.targetSquareMeters} m² target"><span>Space plan</span><strong>${spacePlan.score}% · ${spacePlan.deficits.length} recommendation${spacePlan.deficits.length === 1 ? "" : "s"}</strong></div>
        <div title="${safety.egressCoverage}% sleeping-room egress · ${safety.clearanceShare}% clear floor"><span>Safety</span><strong>${safety.score}% · ${safety.safe ? "No critical hazards" : "Action needed"}</strong></div>
        <div><span>Home quality</span><strong>${world.homeQuality(home)}%</strong></div>
        <div><span>Condition</span><strong>${homeCondition}% · ${world.homeConditionLabel(homeCondition)}</strong></div>
        <div><span>Daylight</span><strong>${homeDaylight}%</strong></div>
        <div title="${circulation.summary}"><span>Circulation</span><strong>${circulation.score}% · ${circulation.connected ? "Connected" : `${circulation.unreachableRoomIds.length} blocked`}</strong></div>
        <div><span>Utilities</span><strong>${utility}%</strong></div>
        <div><span>Neighborhood</span><strong>${neighborhood}%</strong></div>
        <div><span>Entrance</span><strong>${entrance ? entranceAccessLabel(entrance) : "Not connected"}</strong></div>
        <div><span>Household funds</span><strong>${formatHomeCurrency(world.homeHouseholdFunds(home))}</strong></div>
        <div><span>Last daily net</span><strong>${formatSignedHomeCurrency(world.homeDailyNet(home))}</strong></div>
        <div title="${homeFunctionality.completeness}% functions · ${homeFunctionality.alignment}% room fit"><span>Room function</span><strong>${homeFunctionality.score}%</strong></div>
      </div>
      ${spacePlan.deficits.length ? `
        <section class="home-advisor" aria-label="Space planning recommendations">
          <div class="relationship-title">Space planning</div>
          ${spacePlan.deficits.map(deficit => `
            <div class="home-space-recommendation ${deficit.severity}">
              <strong>${deficit.label}</strong><span>${deficit.recommendation}</span>
            </div>
          `).join("")}
        </section>
      ` : ""}
      ${safety.issues.length ? `
        <section class="home-advisor" aria-label="Home safety recommendations">
          <div class="relationship-title">Safety and egress</div>
          ${safety.issues.map(issue => `
            <div class="home-space-recommendation ${issue.severity}">
              <strong>${issue.label}</strong><span>${issue.recommendation}</span>
            </div>
          `).join("")}
        </section>
      ` : ""}
      ${homeAdvice.length ? `
        <section class="home-advisor" aria-label="Home Advisor">
          <div class="relationship-title">Household wants</div>
          ${homeAdvice.map(action => `
            <button type="button" data-home-advisor-action="${action.action}" ${action.furnitureKind ? `data-home-advisor-kind="${action.furnitureKind}"` : ""}>
              <strong>${action.title}</strong><span>${action.detail}</span>
            </button>
          `).join("")}
        </section>
      ` : ""}
      ${home.residents.length ? `
        <section class="household-shop" aria-label="Household purchases">
          <div class="relationship-title">Household purchases</div>
          <div>
            <select id="purchase-resident" aria-label="Purchase recipient">
              ${home.residents.map(resident => `<option value="${resident.id}">${resident.name}</option>`).join("")}
            </select>
            <select id="purchase-kind" aria-label="Household purchase">
              ${(Object.entries(RESIDENT_PURCHASES) as Array<[ResidentPurchaseKind, (typeof RESIDENT_PURCHASES)[ResidentPurchaseKind]]>).map(([kind, purchase]) =>
                `<option value="${kind}">${purchase.label} · ${formatHomeCurrency(purchase.cost)}</option>`
              ).join("")}
            </select>
            <button type="button" id="make-resident-purchase">Buy</button>
          </div>
          <div class="personal-collection-row">
            <select id="collection-resident" aria-label="Personal item recipient">
              ${home.residents.map(resident => `<option value="${resident.id}">${resident.name}</option>`).join("")}
            </select>
            <select id="collection-kind" aria-label="Personal collection item">
              ${(Object.entries(RESIDENT_PERSONAL_ITEM_DEFINITIONS) as Array<[ResidentPersonalItemKind, (typeof RESIDENT_PERSONAL_ITEM_DEFINITIONS)[ResidentPersonalItemKind]]>).map(([kind, item]) =>
                `<option value="${kind}">${item.label} · ${formatHomeCurrency(item.cost)}</option>`
              ).join("")}
            </select>
            <button type="button" id="buy-personal-item">Add item</button>
          </div>
          <small>${home.lastPurchase
            ? `Last: ${RESIDENT_PURCHASES[home.lastPurchase.kind].label} · ${formatHomeCurrency(home.lastPurchase.cost)} · total extras ${formatHomeCurrency(home.discretionarySpent ?? 0)}`
            : "Uses household funds, not the home design budget."} Personal items are permanent, unique belongings.</small>
        </section>
      ` : ""}
      ${home.residents.length ? `
        <section class="household-gatherings" aria-label="Household gatherings">
          <div class="relationship-title">Invitations and gatherings</div>
          <div class="gathering-planner">
            <select id="gathering-host" aria-label="Gathering host">${home.residents.map(resident => `<option value="${resident.id}">${resident.name}</option>`).join("")}</select>
            <select id="gathering-kind" aria-label="Gathering type">${(Object.entries(HOUSEHOLD_GATHERING_DEFINITIONS) as Array<[HouseholdGatheringKind, (typeof HOUSEHOLD_GATHERING_DEFINITIONS)[HouseholdGatheringKind]]>).map(([kind, definition]) => `<option value="${kind}">${definition.label} · ${formatHomeCurrency(definition.cost)}</option>`).join("")}</select>
            <select id="gathering-delay" aria-label="Gathering time"><option value="60">In 1 hour</option><option value="180">In 3 hours</option><option value="360">In 6 hours</option><option value="1440">Tomorrow</option></select>
            <button type="button" id="schedule-gathering">Invite</button>
          </div>
          <small>Guests become visible in the shared 3D home. Completed gatherings improve resident needs and household relationships.</small>
          ${gatherings.length ? `<div class="gathering-list">${gatherings.slice(0, 4).map(gathering => {
            const host = home.residents.find(resident => resident.id === gathering.hostResidentId);
            return `<div class="${gathering === activeGathering ? "active" : gathering.completedAt !== undefined ? "complete" : "upcoming"}"><span><strong>${world.householdGatheringLabel(gathering)}</strong><small>${world.householdGatheringDate(gathering)} · hosted by ${host?.name ?? "Resident"}</small></span><b>${world.householdGatheringStatus(gathering)}</b></div>`;
          }).join("")}</div>` : ""}
        </section>
      ` : ""}
      ${outages.length ? `
        <div class="home-outage">
          <span>Utility disruption</span>
          <strong>${outages.map(failure => utilityKindLabel(failure.kind)).join(" · ")}</strong>
          <small>${outages.map(failure => world.utilityFailureStatus(failure)).join(" · ")}</small>
        </div>
      ` : ""}
      <div class="resident-needs">
        ${home.residents.length ? home.residents.map(resident => {
          const wellbeing = world.residentWellbeing(resident);
          const destination = resident.role === "home" ? "Home district" : world.residentDestinationName(resident);
          const strongestRelationship = world.strongestRelationship(home, resident.id);
          const strongestPartnerId = strongestRelationship?.residentIds.find(id => id !== resident.id);
          const strongestPartner = home.residents.find(item => item.id === strongestPartnerId);
          const action = world.activeResidentAction(resident);
          const actionProgress = Math.round(world.residentActionProgress(resident) * 100);
          const status = world.residentStatus(resident);
          const canEnterHome = Boolean(entrance && world.entranceIsUsable(entrance));
          const canControl = status === "Home" && canEnterHome;
          const topSkill = world.residentTopSkill(resident);
          const careerProgress = Math.round(world.residentCareerProgress(resident) * 100);
          const personality = world.residentPersonality(resident);
          const careerFit = world.residentCareerFit(resident);
          const workplaceFit = world.residentWorkplaceFit(resident);
          const workPerformance = world.residentWorkPerformance(resident);
          const workplace = world.residentWorkplaceLot(resident);
          const workplaceActivity = workplace ? world.workplaceActivity(workplace) : undefined;
          const aspirationProgress = world.residentAspirationProgress(resident);
          const caregiverNames = (resident.caregiverIds ?? []).map(id => home.residents.find(candidate => candidate.id === id)?.name).filter(Boolean);
          const personalItems = world.residentPersonalItems(resident);
          const ownedFurniture = world.residentOwnedFurniture(home, resident);
          const ownershipSatisfaction = world.residentOwnershipSatisfaction(home, resident);
          const personalRoom = world.residentRoomFit(home, resident);
          const outfitStyle = world.residentOutfitStyle(resident);
          const outfitPalette = world.residentOutfitPalette(resident);
          const outfitColors = world.residentOutfitColors(resident);
          const routineProfile = world.residentRoutineProfile(resident);
          const milestones = world.residentMilestones(resident).slice(0, 3);
          const carePriority = world.caregivingPriority(home, resident);
          const familyMoveIds = world.familyMoveResidentIds(home.id, resident.id);
          return `
            <div class="resident-card ${wellbeing.label.toLowerCase()} ${resident.id === controlledResidentId ? "selected" : ""}">
              <div class="resident-heading">
                <span><strong>${resident.name}</strong><small>${world.residentLifeStageLabel(resident)} · generation ${resident.generation ?? 1}${caregiverNames.length ? ` · raised by ${caregiverNames.join(" + ")}` : ""}<br>${world.residentActionLabel(resident)} · ${destination}</small></span>
                <b>${wellbeing.score}% ${wellbeing.label}</b>
              </div>
              <div class="resident-traits" title="${world.residentPersonalitySummary(resident)}">
                ${resident.traits.map(trait => `<span>${world.residentTraitLabel(trait)}</span>`).join("")}
                <small>${world.residentPersonalitySummary(resident)}</small>
              </div>
              <div class="resident-outfit-editor" style="border-left:3px solid #${outfitColors.primary.toString(16).padStart(6, "0")};padding-left:6px" title="${RESIDENT_OUTFIT_DEFINITIONS[outfitStyle].summary}">
                <label>Outfit<select data-resident-outfit-style="${resident.id}">${(Object.entries(RESIDENT_OUTFIT_DEFINITIONS) as Array<[ResidentOutfitStyle, (typeof RESIDENT_OUTFIT_DEFINITIONS)[ResidentOutfitStyle]]>).map(([style, definition]) => `<option value="${style}" ${style === outfitStyle ? "selected" : ""}>${definition.label}</option>`).join("")}</select></label>
                <label>Palette<select data-resident-outfit-palette="${resident.id}">${(Object.entries(RESIDENT_OUTFIT_PALETTES) as Array<[ResidentOutfitPalette, (typeof RESIDENT_OUTFIT_PALETTES)[ResidentOutfitPalette]]>).map(([palette, definition]) => `<option value="${palette}" ${palette === outfitPalette ? "selected" : ""}>${definition.label}</option>`).join("")}</select></label>
              </div>
              <div class="resident-routine-editor" title="${RESIDENT_ROUTINE_DEFINITIONS[routineProfile].summary}">
                <label>Daily rhythm<select data-resident-routine-profile="${resident.id}">${(Object.entries(RESIDENT_ROUTINE_DEFINITIONS) as Array<[ResidentRoutineProfile, (typeof RESIDENT_ROUTINE_DEFINITIONS)[ResidentRoutineProfile]]>).map(([profile, definition]) => `<option value="${profile}" ${profile === routineProfile ? "selected" : ""}>${definition.label}</option>`).join("")}</select></label>
                <small>${world.residentRoutineSummary(resident)}</small>
              </div>
              <div class="resident-personality" aria-label="Personality matrix">
                ${RESIDENT_PERSONALITY_AXES.map(axis => `<span title="${world.residentPersonalityAxisLabel(axis)}"><b style="width:${personality[axis]}%"></b><small>${world.residentPersonalityAxisLabel(axis).slice(0, 3)} ${personality[axis]}</small></span>`).join("")}
              </div>
              <div class="resident-preference">${world.residentPreferenceSummary(home, resident)}</div>
              <div class="resident-preference">${world.residentActivityPreferenceSummary(resident)}</div>
              <div class="resident-belongings">
                <span><strong>${world.residentFavoritePastimeLabel(resident)} · ${world.residentDecorPreferenceLabel(resident)} home</strong><small>${personalItems.length ? personalItems.map(item => RESIDENT_PERSONAL_ITEM_DEFINITIONS[item.kind].label).join(" · ") : "No personal collection yet"} · ${ownedFurniture.length} owned ${ownedFurniture.length === 1 ? "furnishing" : "furnishings"}</small></span>
                <b>${ownershipSatisfaction}% belonging</b>
              </div>
              <div class="resident-belongings">
                <span><strong>${personalRoom.room ? `${personalRoom.room.kind} · Floor ${homeEntityFloor(personalRoom.room) + 1}` : "No personal room"}</strong><small>${personalRoom.factors.join(" · ")}</small></span>
                <b>${personalRoom.score}% room fit</b>
              </div>
              <button type="button" class="resident-control" data-personalize-room="${resident.id}" ${personalRoom.room && world.residentRoomFurniture(home, resident.id).length ? "" : "disabled"}>Make room mine${world.residentRoomPersonalizationCost(home, resident.id) ? ` · ${formatHomeCurrency(world.residentRoomPersonalizationCost(home, resident.id))}` : ""}</button>
              <div class="resident-growth">
                <span><strong>${world.residentCareerTitle(resident)}${world.residentDailyWage(resident) ? ` · ${formatHomeCurrency(world.residentDailyWage(resident))}/day` : ""}</strong><small>${world.residentCareerTrackLabel(resident)} · ${world.residentCareerBranchLabel(resident)} · ${world.residentSkillLabel(topSkill[0])} ${world.residentSkillLevel(resident, topSkill[0])} · career fit ${careerFit}%${resident.role === "student" ? "" : `<br>${world.residentWorkTaskLabel(resident)} · workplace fit ${workplaceFit}% · performance ${workPerformance}% · ${resident.workDaysCompleted ?? 0} shifts${workplaceActivity ? `<br>${workplaceActivity.label} workplace · ${workplaceActivity.coworkersOnShift} coworkers · ${workplaceActivity.customersPresent} customers present` : ""}`}</small></span>
                <i><b style="width:${careerProgress}%"></b></i>
                <em>${resident.role === "student" ? "School" : `${careerProgress}%`}</em>
              </div>
              <div class="resident-aspiration">
                <span><strong>${world.residentAspirationLabel(resident)}</strong><small>${RESIDENT_ASPIRATION_DEFINITIONS[world.residentAspiration(resident)].summary}</small></span>
                <i><b style="width:${aspirationProgress}%"></b></i>
                <em>${aspirationProgress}%</em>
              </div>
              ${milestones.length ? `
                <div class="resident-milestones">
                  <span>Life story</span>
                  ${milestones.map(milestone => `
                    <div>
                      <b>${world.residentMilestoneDate(milestone)}</b>
                      <strong>${milestone.title}</strong>
                      <small>${milestone.detail}</small>
                    </div>
                  `).join("")}
                </div>
              ` : ""}
              <div class="resident-action-row">
                <span>${action ? `${Math.max(1, Math.ceil(action.endsAt - world.clock.elapsedMinutes))}m remaining` : world.residentStatus(resident)}</span>
                <i><b style="width:${action ? actionProgress : 100}%"></b></i>
                <strong>${resident.completedActions ?? 0} done</strong>
              </div>
              <div class="need-grid">
                ${needMeter("Energy", resident.energy)}
                ${needMeter("Social", resident.social)}
                ${needMeter("Comfort", resident.comfort)}
                ${needMeter("Health", resident.health)}
                ${needMeter("Calm", 100 - resident.stress)}
              </div>
              <p>${wellbeing.pressure} · commute burden ${wellbeing.commuteBurden}%</p>
              ${strongestRelationship && strongestPartner ? `
                <p class="resident-connection">Closest to ${strongestPartner.name} · ${world.relationshipLabel(strongestRelationship.score)} ${strongestRelationship.score}%</p>
              ` : ""}
              <button
                type="button"
                class="resident-control"
                data-control-resident="${resident.id}"
                ${canControl ? "" : "disabled"}
              >${status !== "Home" ? status : canEnterHome ? "Control in home" : "Upgrade entrance first"}</button>
              ${carePriority ? `<button type="button" class="resident-control" data-caregiver-resident="${resident.id}" data-care-dependent="${carePriority.resident.id}" ${status === "Home" && !action ? "" : "disabled"}>Care for ${carePriority.resident.name} · priority ${carePriority.need}</button>` : ""}
              <div class="resident-move">
                ${destinationHomes.length ? `
                  <select data-resident-move-destination="${resident.id}" aria-label="Move ${resident.name} to household">
                    ${destinationHomes.map(destinationHome => `<option value="${destinationHome.id}">${destinationHome.name}</option>`).join("")}
                  </select>
                  <button type="button" data-move-resident="${resident.id}">Move resident</button>
                  ${familyMoveIds.length > 1 ? `<button type="button" data-move-family="${resident.id}">Move family · ${familyMoveIds.length}</button>` : ""}
                ` : `<small>Open another residential lot in Home Simulator to create a move destination.</small>`}
              </div>
            </div>
          `;
        }).join("") : `<div class="resident-empty">Add a resident to start needs, schedules, health, and household wellbeing.</div>`}
      </div>
      ${home.relationships.length ? `
        <div class="relationship-list">
          <div class="relationship-title">Household relationships</div>
          ${[...home.relationships].sort((a, b) => b.score - a.score).map(relationship => {
            const first = home.residents.find(resident => resident.id === relationship.residentIds[0]);
            const second = home.residents.find(resident => resident.id === relationship.residentIds[1]);
            if (!first || !second) return "";
            const compatibility = world.relationshipCompatibility(first, second);
            const tension = relationship.tension ?? 0;
            const impression = world.relationshipImpression(relationship);
            const recentOutcome = relationship.lastIntent && relationship.lastChange !== undefined
              ? `${world.conversationIntentLabel(relationship.lastIntent)} · ${relationship.lastChange > 0 ? "+" : ""}${relationship.lastChange} ${world.conversationOutcomeLabel(relationship.lastChange, relationship.lastIntent)}`
              : "";
            const memories = (relationship.memories ?? []).slice(0, 3).map(memory => {
              const initiator = home.residents.find(resident => resident.id === memory.initiatorResidentId);
              return `<i>${initiator?.name ?? "Resident"}: ${world.conversationIntentLabel(memory.intent)} ${memory.relationshipChange > 0 ? "+" : ""}${memory.relationshipChange}</i>`;
            }).join("");
            return `
              <div class="relationship-row">
                <span><strong>${first.name} + ${second.name}</strong><small>${world.compatibilityLabel(compatibility)} · ${relationship.conversations} completed ${relationship.conversations === 1 ? "conversation" : "conversations"} · ${relationship.conflicts ?? 0} conflicts · ${relationship.resolvedConflicts ?? 0} repaired<em>${impression.label}: ${impression.summary}</em>${recentOutcome ? `<em>Last: ${recentOutcome}</em>` : ""}${memories ? `<span class="social-memory">${memories}</span>` : ""}</small></span>
                <b>${world.relationshipLabel(relationship.score)} · ${relationship.score}%<small>${world.relationshipTensionLabel(tension)} ${tension}%</small></b>
              </div>
            `;
          }).join("")}
        </div>
      ` : ""}
    `;
    details.classList.add("visible");
    details.querySelector("#make-resident-purchase")?.addEventListener("click", () => {
      const residentId = details.querySelector<HTMLSelectElement>("#purchase-resident")?.value;
      const kind = details.querySelector<HTMLSelectElement>("#purchase-kind")?.value as ResidentPurchaseKind | undefined;
      if (!residentId || !kind) return;
      const result = world.purchaseForResident(home.id, residentId, kind);
      if (result.ok) renderWorld();
      notice(result.reason);
    });
    details.querySelector("#buy-personal-item")?.addEventListener("click", () => {
      const residentId = details.querySelector<HTMLSelectElement>("#collection-resident")?.value;
      const kind = details.querySelector<HTMLSelectElement>("#collection-kind")?.value as ResidentPersonalItemKind | undefined;
      if (!residentId || !kind) return;
      const result = world.buyResidentPersonalItem(home.id, residentId, kind);
      if (result.ok) renderWorld();
      notice(result.reason);
    });
    details.querySelector("#schedule-gathering")?.addEventListener("click", () => {
      const hostResidentId = details.querySelector<HTMLSelectElement>("#gathering-host")?.value;
      const kind = details.querySelector<HTMLSelectElement>("#gathering-kind")?.value as HouseholdGatheringKind | undefined;
      const delay = Number(details.querySelector<HTMLSelectElement>("#gathering-delay")?.value);
      if (!hostResidentId || !kind || !Number.isFinite(delay)) return;
      const result = world.scheduleHouseholdGathering(home.id, hostResidentId, kind, delay);
      if (result.ok) renderWorld();
      notice(result.reason);
    });
    details.querySelectorAll<HTMLSelectElement>("[data-resident-outfit-style], [data-resident-outfit-palette]").forEach(select => {
      select.addEventListener("change", () => {
        const residentId = select.dataset.residentOutfitStyle ?? select.dataset.residentOutfitPalette;
        if (!residentId) return;
        const style = details.querySelector<HTMLSelectElement>(`[data-resident-outfit-style="${residentId}"]`)?.value as ResidentOutfitStyle | undefined;
        const palette = details.querySelector<HTMLSelectElement>(`[data-resident-outfit-palette="${residentId}"]`)?.value as ResidentOutfitPalette | undefined;
        if (!style || !palette) return;
        if (world.setResidentOutfit(home.id, residentId, style, palette)) {
          renderWorld();
          const changedResident = home.residents.find(resident => resident.id === residentId);
          notice(`${changedResident?.name ?? "Resident"} changed into ${RESIDENT_OUTFIT_DEFINITIONS[style].label.toLowerCase()} in ${RESIDENT_OUTFIT_PALETTES[palette].label.toLowerCase()}`);
        }
      });
    });
    details.querySelectorAll<HTMLSelectElement>("[data-resident-routine-profile]").forEach(select => {
      select.addEventListener("change", () => {
        const residentId = select.dataset.residentRoutineProfile;
        const profile = select.value as ResidentRoutineProfile;
        if (!residentId || !RESIDENT_ROUTINE_DEFINITIONS[profile]) return;
        if (world.setResidentRoutine(home.id, residentId, profile)) {
          renderWorld();
          const changedResident = home.residents.find(resident => resident.id === residentId);
          notice(`${changedResident?.name ?? "Resident"} now follows ${RESIDENT_ROUTINE_DEFINITIONS[profile].label.toLowerCase()}`);
        }
      });
    });
    details.querySelectorAll<HTMLButtonElement>("[data-personalize-room]").forEach(button => {
      button.addEventListener("click", () => {
        const residentId = button.dataset.personalizeRoom;
        if (!residentId) return;
        const result = world.personalizeResidentRoom(home.id, residentId);
        if (result.ok) renderWorld();
        notice(result.reason);
      });
    });
    details.querySelectorAll<HTMLButtonElement>("[data-move-resident]").forEach(button => {
      button.addEventListener("click", () => {
        const residentId = button.dataset.moveResident;
        const destinationId = residentId
          ? details.querySelector<HTMLSelectElement>(`[data-resident-move-destination="${residentId}"]`)?.value
          : undefined;
        if (!residentId || !destinationId) return;
        const result = world.moveResidentToHome(home.id, residentId, destinationId);
        if (result.ok) {
          if (controlledResidentId === residentId) controlledResidentId = null;
          renderWorld();
        }
        notice(result.reason);
      });
    });
    details.querySelectorAll<HTMLButtonElement>("[data-move-family]").forEach(button => {
      button.addEventListener("click", () => {
        const residentId = button.dataset.moveFamily;
        const destinationId = residentId
          ? details.querySelector<HTMLSelectElement>(`[data-resident-move-destination="${residentId}"]`)?.value
          : undefined;
        if (!residentId || !destinationId) return;
        const residentIds = world.familyMoveResidentIds(home.id, residentId);
        const result = world.moveHouseholdGroup(home.id, residentIds, destinationId);
        if (result.ok) {
          if (controlledResidentId && result.residentIds.includes(controlledResidentId)) controlledResidentId = null;
          renderWorld();
        }
        notice(result.reason);
      });
    });
    details.querySelectorAll<HTMLButtonElement>("[data-caregiver-resident]").forEach(button => {
      button.addEventListener("click", () => {
        const caregiverId = button.dataset.caregiverResident;
        const dependentId = button.dataset.careDependent;
        if (!caregiverId || !dependentId) return;
        const result = world.commandResidentCare(home.id, caregiverId, dependentId);
        if (result.ok) renderWorld();
        notice(result.reason);
      });
    });
    details.querySelectorAll<HTMLButtonElement>("[data-home-advisor-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.homeAdvisorAction;
        const kind = button.dataset.homeAdvisorKind as HomeFurnitureKind | undefined;
        if (action === "resident") {
          document.querySelector<HTMLButtonElement>("#add-resident")?.click();
        } else if (action === "room") {
          activateHomeTool("room");
        } else if (action === "catalog" && kind) {
          const catalog = document.querySelector<HTMLSelectElement>("#home-catalog")!;
          catalog.value = kind;
          document.querySelector("#place-catalog-item")!.textContent = `Place ${homeFurnitureLabel(kind)}`;
          activateHomeTool(kind);
        } else if (action === "social") {
          details.querySelector<HTMLButtonElement>(".resident-control:not(:disabled)")?.click();
        } else {
          notice(`${formatHomeCurrency(world.homeHouseholdFunds(home))} household funds · ${formatSignedHomeCurrency(world.homeDailyNet(home))} last daily net`);
        }
      });
    });
    details.querySelectorAll<HTMLButtonElement>("[data-control-resident]").forEach(button => {
      button.addEventListener("click", () => {
        if (!button.dataset.controlResident || mode !== "home") return;
        const currentEntrance = selectedLot
          ? world.accessibilityEntrances.find(
              item => item.targetKind === "lot" && item.targetId === selectedLot!.id
            )
          : undefined;
        const status = homeEntryStatus(home, currentEntrance);
        if (!status.allowed) {
          notice(status.reason);
          return;
        }
        controlledResidentId = button.dataset.controlResident;
        setMode("explore");
        toggleHomeInterior();
      });
    });
    document.querySelector(".panel")!.classList.add("inspecting");
  }
  document.querySelector("#panel-title")!.textContent = home.name;
}

function needMeter(label: string, value: number) {
  const normalized = Math.round(Math.max(0, Math.min(100, value)));
  return `<div><span>${label}</span><i><b style="width:${normalized}%"></b></i><strong>${normalized}</strong></div>`;
}

function wellbeingLabel(score: number) {
  return score >= 82 ? "Thriving" : score >= 64 ? "Stable" : score >= 44 ? "Strained" : "Critical";
}

function wellbeingColor(score: number) {
  return score >= 82 ? 0x72bd8a : score >= 64 ? 0x6da9c8 : score >= 44 ? 0xd2a15f : 0xcf6759;
}

function utilityKindLabel(kind: UtilityKind) {
  return kind === "power" ? "Power" : kind === "water" ? "Water" : kind === "sewage" ? "Sewage" : "Waste";
}

function renderActivityCenter() {
  const list = document.querySelector<HTMLElement>("#activity-list");
  const badge = document.querySelector<HTMLElement>("#activity-count");
  const trigger = document.querySelector<HTMLButtonElement>("#activity-open");
  if (!list || !badge || !trigger) return;
  list.replaceChildren();
  if (!activityLog.length) {
    const empty = document.createElement("p");
    empty.className = "activity-empty";
    empty.textContent = "New city and household updates will appear here.";
    list.append(empty);
  } else {
    activityLog.forEach(entry => {
      const item = document.createElement("article");
      const timestamp = document.createElement("span");
      const message = document.createElement("p");
      timestamp.textContent = `${entry.date} · ${entry.time}`;
      message.textContent = entry.text;
      item.append(timestamp, message);
      list.append(item);
    });
  }
  badge.textContent = String(Math.min(99, unreadActivity));
  badge.hidden = unreadActivity === 0;
  trigger.setAttribute("aria-label", unreadActivity ? `Open activity center, ${unreadActivity} unread` : "Open activity center");
}

function notice(text: string) {
  document.querySelector("#notice")!.textContent = text;
  const hour = Math.floor(world.clock.minute / 60);
  const minute = Math.floor(world.clock.minute % 60);
  const entry: ActivityEntry = {
    text,
    date: `Y${world.clock.year} ${MONTH_NAMES[world.clock.month - 1]} ${world.clock.day}`,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  };
  activityLog = recordActivity(activityLog, entry);
  if (document.querySelector<HTMLElement>("#activity-center")!.hidden) unreadActivity++;
  renderActivityCenter();
}

function updatePhotoModePanel() {
  if (!photoMode) return;
  const weather = world.weather();
  const hours = Math.floor(world.clock.minute / 60);
  const minutes = Math.floor(world.clock.minute % 60);
  document.querySelector("#photo-location")!.textContent = document.querySelector("#explorer-location")!.textContent ?? "City streets";
  document.querySelector("#photo-conditions")!.textContent = `${weather.label} · ${weather.temperatureC}°C · ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  document.querySelector("#photo-lens")!.textContent = `${Math.round(43.3 / (2 * Math.tan(THREE.MathUtils.degToRad(photoFov) / 2)))}mm`;
}

function setPhotoMode(enabled: boolean) {
  photoMode = enabled && mode === "explore";
  photoHudVisible = true;
  app.classList.toggle("photo-mode", photoMode);
  app.classList.remove("photo-clean");
  scene.traverse(object => {
    if (object.userData.worldLabel) object.visible = !photoMode;
  });
  if (photoMode) {
    photoFov = THREE.MathUtils.clamp(camera.fov, 35, 70);
    updatePhotoModePanel();
  } else if (mode === "explore") {
    camera.fov = explorerDriving ? 57 : transitRide ? 59 : 55;
    camera.updateProjectionMatrix();
  }
}

function adjustPhotoLens(delta: number) {
  if (!photoMode) return;
  photoFov = THREE.MathUtils.clamp(photoFov + delta, 28, 75);
  camera.fov = photoFov;
  camera.updateProjectionMatrix();
  updatePhotoModePanel();
}

function setMode(next: Mode) {
  if (next !== "explore" && photoMode) setPhotoMode(false);
  if (mode === "explore" && next !== "explore" && explorerDriving) {
    world.rememberPlayerVehicle({
      x: explorerVehicleGroup.position.x,
      z: explorerVehicleGroup.position.z
    }, explorerVehicleHeading);
    explorerVehicleParked = true;
  }
  if (mode === "explore" && next !== "explore") {
    transitRide = null;
    explorerInteriorHomeId = null;
    explorerExteriorReturn = null;
    pendingConversationPartnerId = null;
    world.setControlledResident();
  }
  mode = next;
  if (next === "explore") localStorage.setItem("gridless-starter-explored", "1");
  syncSoundscape();
  if (next !== "home") {
    selectedFurnitureId = null;
    selectedRoomId = null;
    selectedHomeWindowId = null;
    selectedHomeDoorId = null;
    movingFurnitureId = null;
    homePreviewPoint = null;
  }
  setInteriorSceneVisibility(false);
  updateInteriorInteractionPrompt();
  if (next !== "explore") {
    explorerDriving = false;
    explorerVehicleSpeed = 0;
    explorerVehicleGroup.visible = false;
    clearAccessibleRoute();
  } else {
    if (world.playerVehicle) {
      explorerVehicleGroup.position.set(world.playerVehicle.position.x, .16, world.playerVehicle.position.z);
      explorerVehicleGroup.rotation.y = world.playerVehicle.heading;
      explorerVehicleHeading = world.playerVehicle.heading;
      explorerVehicleParked = true;
    }
    explorerVehicleGroup.visible = explorerVehicleParked;
  }
  if (next !== "explore" && document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  explorerVelocity.set(0, 0, 0);
  explorerVerticalOffset = 0;
  explorerVerticalVelocity = 0;
  explorerGrounded = true;
  explorerBlocked = false;
  if (next !== "explore" && camera.fov !== 55) {
    camera.fov = 55;
    camera.updateProjectionMatrix();
  }
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(button => button.classList.toggle("active", button.dataset.mode === next));
  document.querySelector(".hud")!.classList.toggle("exploring", next === "explore");
  document.querySelector(".hud")!.classList.toggle("home-editing", next === "home");
  document.querySelector(".hud")!.classList.toggle("city-editing", next === "city");
  renderStarterJourney();
  orbit.enabled = next !== "explore";
  renderAccessibilityEntrances();
  draft = [];
  lastRoadSnap = null;
  homeDraft = null;
  renderDraft();
  document.querySelector(".home-tools")!.classList.toggle("visible", next === "home");
  if (next === "city") {
    camera.position.set(520, 650, 850);
    orbit.target.set(0, 0, 0);
    updateCityToolPanel(cityTool === "inspect" ? selectedLot ?? undefined : undefined);
  } else if (next === "explore") {
    const selectedHome = selectedLot
      ? world.homes.find(home => home.lotId === selectedLot!.id)
      : undefined;
    const selectedEntrance = selectedLot && selectedHome
      ? world.accessibilityEntrances.find(
          entrance => entrance.targetKind === "lot" && entrance.targetId === selectedLot!.id
        )
      : undefined;
    const activeCommutes = world.activeCommutes();
    const selectedCommute = selectedLot
      ? activeCommutes.find(commute => commute.flow.originLotId === selectedLot!.id)
      : undefined;
    const commute = selectedCommute ?? activeCommutes[0];
    let preferred: Point2;
    if (selectedEntrance) {
      preferred = selectedEntrance.position;
    } else if (commute) {
      const points = commute.direction === "outbound" ? commute.flow.route : [...commute.flow.route].reverse();
      const position = pointAlongRoute(points, commute.progress);
      preferred = { x: position.x, z: position.z };
    } else if (selectedLot) {
      preferred = selectedLot.center;
    } else {
      preferred = { x: 0, z: 35 };
    }
    if (!selectedEntrance) {
      const entryStop = nearestTransitStop(world.transitLines, preferred);
      if (entryStop) preferred = entryStop.stop.position;
    }
    const spawn = findExplorerSpawn(preferred);
    camera.position.set(spawn.x, 1.82, spawn.z);
    const roadLocation = nearestRoadLocation(explorerRoadPaths, spawn);
    yaw = roadLocation
      ? Math.atan2(-roadLocation.tangent.x, -roadLocation.tangent.z)
      : Math.atan2(5, 7);
    pitch = -.05;
    requestExplorerPointerLock();
    setPanel(
      "CITY EXPLORER",
      "Walk the living city",
      "Follow continuous sidewalks, cross the roadway, enter parks, and move around the same buildings created in City Builder.",
      "WASD|Walk;Mouse|Look;Shift|Sprint;Space|Jump;F|Enter home;T|Ride transit;E|Drive;R|Accessible route;Esc|Return"
    );
    updateExplorerContext();
    updateExplorerMovementStatus(0);
  } else {
    const lot = selectedLot ?? world.lots[0];
    if (!lot) {
      selectedLot = null;
      setPanel("HOME SIMULATOR", "No buildable lots yet", "Return to City Builder and draw a road. Gridless will generate flexible parcels along it, then you can choose one for a household.", "City Builder|Draw a road;Enter|Generate lots;Home|Choose a parcel");
      renderWorld();
      return;
    }
    selectedLot = lot;
    const home = world.ensureHome(lot);
    homeFloor = Math.max(0, Math.min(home.floors - 1, homeFloor));
    camera.position.set(lot.center.x + 24, 22, lot.center.z + 28);
    orbit.target.set(lot.center.x, 0, lot.center.z);
    setPanel("HOME SIMULATOR", home.name, "Draw rooms floor by floor, connect stories with stairs, furnish them, and create the household that will live here. Everything remains attached to this city lot.", "Floor menu|Change story;Tool bar|Choose build item;Click|Place or draw;⌘ Z|Undo");
    renderWorld();
  }
}

function updateExplorerContext() {
  if (mode !== "explore") return;
  const interior = currentExplorerInterior();
  if (interior) {
    const floorHome = homeFloorView(interior.home, explorerInteriorFloor);
    const local = worldToLotLocal(
      { x: camera.position.x, z: camera.position.z },
      interior.lot
    );
    const room = interiorRoomAt(floorHome, local);
    const residentsAtHome = interior.home.residents.filter(
      resident => world.residentStatus(resident) === "Home"
    );
    const activities = residentsAtHome.map(
      resident => `${resident.name} is ${world.residentActionLabel(resident).toLowerCase()}`
    );
    const outages = world.utilityFailuresForLot(interior.lot);
    const entrance = world.accessibilityEntrances.find(
      item => item.targetKind === "lot" && item.targetId === interior.lot.id
    );
    const controlled = controlledInteriorResident();
    const controlledAction = controlled
      ? world.activeResidentAction(controlled.resident)
      : undefined;
    const conversationPartner = controlledAction?.partnerResidentId
      ? interior.home.residents.find(resident => resident.id === controlledAction.partnerResidentId)
      : undefined;
    const conversationCopy = controlled && conversationPartner && controlledAction?.kind === "socialize"
      ? ` ${world.conversationIntentLabel(controlledAction.conversationIntent ?? "chat")} with ${conversationPartner.name}. Their personality fit is ${world.compatibilityLabel(
          world.relationshipCompatibility(controlled.resident, conversationPartner)
        ).toLowerCase()}, and their relationship is ${world.relationshipLabel(
          world.relationshipScore(interior.home, controlled.resident.id, conversationPartner.id)
        ).toLowerCase()} with ${world.relationshipTensionLabel(
          world.relationshipBetween(interior.home, controlled.resident.id, conversationPartner.id)?.tension ?? 0
        ).toLowerCase()} tension.`
      : controlled && conversationPartner && controlledAction?.kind === "care"
        ? ` ${controlled.resident.name} is caring for ${conversationPartner.name}, strengthening their bond while restoring the dependent's needs.`
        : "";
    const controlCopy = controlled
      ? ` You are controlling ${controlled.resident.name}. ${controlledAction
          ? `${world.residentActionLabel(controlled.resident)} has ${Math.max(1, Math.ceil(controlledAction.endsAt - world.clock.elapsedMinutes))} minutes remaining.`
          : "Move near a household member or furnishing and press E to interact."}${conversationCopy}`
      : " Press C to choose a resident for direct control.";
    const activityCopy = activities.length
      ? ` ${activities.join(" and ")}.`
      : " No household members are currently home.";
    const outageCopy = outages.length
      ? ` Active disruption: ${outages.map(failure => utilityKindLabel(failure.kind)).join(" and ")}.`
      : " Utilities are operating normally.";
    document.querySelector("#panel-kicker")!.textContent = "HOME INTERIOR";
    document.querySelector("#panel-title")!.textContent =
      controlled
        ? `${controlled.resident.name} · Floor ${explorerInteriorFloor + 1} · ${room?.kind ?? "Landing"}`
        : `${interior.home.name} · Floor ${explorerInteriorFloor + 1} · ${room?.kind ?? "Landing"}`;
    document.querySelector("#panel-copy")!.textContent =
      `${interior.home.floors} floor${interior.home.floors === 1 ? "" : "s"}, ${interior.home.rooms.length} rooms, and ${interior.home.furniture.length} furnishings are part of the persistent Home Simulator plan.${controlCopy}${activityCopy}${outageCopy} ${entrance ? entranceAccessLabel(entrance) : "Entrance not connected"}. Press F to return to the street.`;
    return;
  }
  if (transitRide) {
    const line = world.transitLines.find(item => item.id === transitRide!.lineId);
    if (!line) return;
    const requestedStop = line.stops.find(stop => stop.id === transitRide!.alightStopId);
    document.querySelector("#panel-kicker")!.textContent = "CITY TRANSIT";
    document.querySelector("#panel-title")!.textContent = line.name;
    const onboard = `${transitRide.passengers}/${line.vehicleCapacity} passengers aboard`;
    const service = `${transitFarePolicyLabel(line.fare)} · ${transitCrowdingLabel(transitRide.passengers / line.vehicleCapacity)}`;
    document.querySelector("#panel-copy")!.textContent = requestedStop
      ? `Stop requested: ${requestedStop.name}. ${onboard} · ${service}. The bus is continuing through the live city.`
      : `${onboard} · ${service}. You are riding through the same streets built and simulated in City Builder. Press T to request the next stop.`;
    return;
  }
  if (explorerDriving) {
    const vehiclePosition = {
      x: explorerVehicleGroup.position.x,
      z: explorerVehicleGroup.position.z
    };
    const road = nearestRoadLocation(explorerRoadPaths, vehiclePosition);
    const onRoad = Boolean(road && road.distance <= road.width / 2 + 1.2);
    const forward = {
      x: -Math.sin(explorerVehicleHeading),
      z: -Math.cos(explorerVehicleHeading)
    };
    const signal = trafficSignalAhead(
      vehiclePosition,
      forward,
      streetIntersections,
      world.clock.elapsedMinutes
    );
    const signalCopy = signal
      ? ` Signal ${signal.color} in ${Math.max(1, Math.round(signal.distance))}m.`
      : "";
    const nearbyEvent = closestActiveCityEvent(vehiclePosition, 180);
    const closure = road && onRoad ? world.cityEventRoadClosure(road.roadId) : undefined;
    const eventCopy = nearbyEvent
      ? ` ${nearbyEvent.event.name} is active ${Math.max(1, Math.round(nearbyEvent.distance))}m away with ${world.cityEventExpectedAttendance(nearbyEvent.event).toLocaleString()} attendees and event traffic controls.`
      : "";
    const closureCopy = closure
      ? ` ${road?.roadName ?? "This road"} is closed for ${closure.name}; use another street.`
      : "";
    const parkingOffer = closestParkingFacility(vehiclePosition, 34);
    const curbOffer = closestCurbFacility(vehiclePosition, 34);
    const curbCopy = curbOffer && world.curbEffectiveUse(curbOffer.facility) !== "parking"
      ? ` Curb ahead in ${Math.max(1, Math.round(curbOffer.distance))}m: ${curbStatusLabel(curbOffer.facility)}. Parking is prohibited.`
      : "";
    const parkingCopy = parkingOffer
      ? ` ${parkingKindLabel(parkingOffer.facility.kind)} in ${Math.max(1, Math.round(parkingOffer.distance))}m: ${formatParkingRate(parkingOffer.facility.hourlyRate)}, ${parkingOffer.facility.capacity - parkingOffer.facility.occupied} spaces available.`
      : "";
    document.querySelector("#panel-kicker")!.textContent = "CITY EXPLORER";
    document.querySelector("#panel-title")!.textContent = `Driving ${road?.roadName ?? "the city"}`;
    document.querySelector("#panel-copy")!.textContent =
      `${Math.round(Math.abs(explorerVehicleSpeed) * 3.6)} km/h. ${onRoad ? "The vehicle is on the road network." : "Off-road resistance is slowing the vehicle."}${signalCopy}${closureCopy}${eventCopy}${curbCopy}${parkingCopy} Buildings, facilities, and shorelines remain solid.`;
    return;
  }
  if (accessibleRouteSummary) {
    document.querySelector("#panel-kicker")!.textContent = "ACCESSIBLE WAYFINDING";
    document.querySelector("#panel-title")!.textContent = `Route to ${accessibleRouteSummary.destinationName}`;
    const distanceCopy = accessibleRouteSummary.distance === undefined
      ? "No connected sidewalk path reaches this destination."
      : `${Math.round(accessibleRouteSummary.distance)}m along connected sidewalks and marked crossings. ${accessibleRouteSummary.rampedCrossings} ${accessibleRouteSummary.rampedCrossings === 1 ? "crossing uses" : "crossings use"} paired curb ramps.`;
    const entrance = accessibleRouteSummary.entranceId
      ? world.accessibilityEntrances.find(item => item.id === accessibleRouteSummary!.entranceId)
      : undefined;
    const accessCopy = accessibleRouteSummary.usable
      ? ` The complete trip is step-free.${entrance && world.entranceHasUniversalAccess(entrance) ? " The entrance also has tactile guidance and universal access." : ""}`
      : ` The complete trip is not usable: ${accessibleRouteSummary.barriers.join("; ")}.`;
    const facility = accessibleRouteSummary.destinationKind === "parking"
      ? world.parking.find(item => item.id === accessibleRouteSummary!.sourceId)
      : undefined;
    const parkingCopy = facility
      ? ` ${formatParkingRate(facility.hourlyRate)} with ${facility.capacity - facility.occupied} ${facility.capacity - facility.occupied === 1 ? "space" : "spaces"} available.`
      : "";
    document.querySelector("#panel-copy")!.textContent =
      `${distanceCopy}${accessCopy}${parkingCopy} Press R for the nearest ${accessibilityKindLabel(accessibilityKindOrder[(accessibilityKindIndex + 1) % accessibilityKindOrder.length])}, or Shift+R to hide the route.`;
    return;
  }
  const nearbyStop = nearestTransitStop(
    world.transitLines,
    { x: camera.position.x, z: camera.position.z },
    16
  );
  if (nearbyStop) {
    const stopEntrance = world.accessibilityEntrances.find(
      entrance => entrance.targetKind === "transit" && entrance.targetId === nearbyStop.stop.id
    );
    const access = stopEntrance ? entranceAccessLabel(stopEntrance) : "Access not assessed";
    const stopEvent = closestActiveCityEvent(nearbyStop.stop.position, 220);
    const eventCopy = stopEvent
      ? ` ${stopEvent.event.name} is adding event demand at this stop.`
      : "";
    const transfers = world.transitTransfersAtStop(nearbyStop.line, nearbyStop.stop);
    const transferCopy = transfers.length
      ? ` Transfer here to ${transfers.map(transfer => transfer.lineName).join(" or ")}.`
      : "";
    document.querySelector("#panel-kicker")!.textContent = "CITY TRANSIT";
    document.querySelector("#panel-title")!.textContent = nearbyStop.stop.name;
    document.querySelector("#panel-copy")!.textContent =
      `${nearbyStop.line.name} · every ${world.transitEffectiveHeadway(nearbyStop.line)}m${world.transitEffectiveHeadway(nearbyStop.line) < nearbyStop.line.headwayMinutes ? " temporary event service" : ""} · about ${world.transitAverageWait(nearbyStop.line).toFixed(1)}m average wait · ${nearbyStop.stop.waiting} waiting · ${transitFarePolicyLabel(nearbyStop.line.fare)} · ${transitCrowdingLabel(world.transitLineCrowding(nearbyStop.line))}. ${access}.${transferCopy}${eventCopy} Press T to board.`;
    return;
  }
  const nearbyEvent = closestActiveCityEvent({ x: camera.position.x, z: camera.position.z }, 115);
  if (nearbyEvent) {
    const event = nearbyEvent.event;
    const definition = CITY_EVENT_DEFINITIONS[event.kind];
    const affectedCurbs = world.parking.filter(
      facility => facility.kind === "curb" && world.cityEventCurbOverride(facility)
    ).length;
    const temporaryLine = world.transitLines.find(line => line.id === event.temporaryTransitLineId);
    document.querySelector("#panel-kicker")!.textContent = "CITY EVENT";
    document.querySelector("#panel-title")!.textContent = event.name;
    document.querySelector("#panel-copy")!.textContent =
      `${definition.label} with ${world.cityEventExpectedAttendance(event).toLocaleString()} attendees. ${world.cityEventStatus(event)} · ${event.closureRoadIds?.length ?? 0} closed roads · ${affectedCurbs} nearby curbs under event control · ${Math.round(world.cityEventTrafficPressure() * 100)}% city event traffic pressure.${temporaryLine ? ` ${temporaryLine.name} is running every ${world.transitEffectiveHeadway(temporaryLine)} minutes for the event.` : ""}`;
    return;
  }
  const nearbyWorkplace = closestActiveWorkplace({ x: camera.position.x, z: camera.position.z }, 28);
  if (nearbyWorkplace) {
    const { lot, workers, activity } = nearbyWorkplace;
    const workplaceName = lot.anchorBusiness?.name ?? "Neighborhood workplace";
    const workSummary = workers.slice(0, 3).map(({ resident }) =>
      `${resident.name}: ${world.residentWorkTaskLabel(resident)} (${world.residentWorkPerformance(resident)}%)`
    ).join(" · ");
    document.querySelector("#panel-kicker")!.textContent = "ACTIVE WORKPLACE";
    document.querySelector("#panel-title")!.textContent = workplaceName;
    document.querySelector("#panel-copy")!.textContent =
      `${activity.label} now: ${activity.coworkersOnShift} coworkers and ${activity.customersPresent} customers present, with ${activity.hourlyCustomerDemand} expected visits per hour. ${workers.length ? `${workers.length} named ${workers.length === 1 ? "resident is" : "residents are"} on shift. ${workSummary}. ` : ""}Transit access, congestion, local population, events, and business hours shape this street activity.`;
    return;
  }
  const nearbyEntrance = closestAccessibilityEntrance(
    { x: camera.position.x, z: camera.position.z },
    12
  );
  if (nearbyEntrance) {
    const entrance = nearbyEntrance.entrance;
    const home = entrance.targetKind === "lot"
      ? world.homes.find(item => item.lotId === entrance.targetId)
      : undefined;
    const entry = entrance.targetKind === "lot"
      ? homeEntryStatus(home, entrance)
      : undefined;
    const entryCopy = entry?.allowed
      ? " Move within 6m and press F to enter the home."
      : entry
        ? ` Home entry is unavailable: ${entry.reason}`
        : "";
    document.querySelector("#panel-kicker")!.textContent = "ACCESSIBLE ENTRANCE";
    document.querySelector("#panel-title")!.textContent = entranceDestinationName(entrance);
    document.querySelector("#panel-copy")!.textContent =
      `${entranceAccessLabel(entrance)}. ${entrance.stepFree ? "Step-free approach" : "A step or curb blocks the entrance"} with ${entrance.doorWidth.toFixed(2)}m clear width.${entrance.tactileGuidance ? " Tactile guidance is installed." : " Tactile guidance is missing."}${entryCopy} Press R to plan a complete accessible trip.`;
    return;
  }
  const nearbyCurb = closestCurbFacility({ x: camera.position.x, z: camera.position.z }, 18);
  if (nearbyCurb) {
    const facility = nearbyCurb.facility;
    const effectiveUse = world.curbEffectiveUse(facility);
    const parkingCopy = effectiveUse === "parking"
      ? `${formatParkingRate(facility.hourlyRate)} parking is currently allowed with ${facility.capacity - facility.occupied} spaces available.`
      : "Parking is currently prohibited.";
    document.querySelector("#panel-kicker")!.textContent = "CURB MANAGEMENT";
    document.querySelector("#panel-title")!.textContent = curbUseLabel(effectiveUse);
    document.querySelector("#panel-copy")!.textContent =
      `${curbStatusLabel(facility)} · scheduled ${curbScheduleLabel(facility.curbSchedule ?? "all-day")}. ${parkingCopy} ${world.curbLoadingDemand(facility).toFixed(1)} deliveries per hour nearby · ${facility.deliveriesWaiting ?? 0} waiting · ${facility.deliveriesServed ?? 0} served · ${facility.violations ?? 0} violations.`;
    return;
  }
  const nearbyParking = closestParkingFacility({ x: camera.position.x, z: camera.position.z }, 22);
  if (nearbyParking) {
    const facility = nearbyParking.facility;
    document.querySelector("#panel-kicker")!.textContent = "PARKING & ACCESS";
    document.querySelector("#panel-title")!.textContent = parkingKindLabel(facility.kind);
    document.querySelector("#panel-copy")!.textContent =
      `${formatParkingRate(facility.hourlyRate)}. ${facility.capacity - facility.occupied} of ${facility.capacity} spaces are available, including ${facility.accessibleSpaces} designated accessible spaces. ${parkingPressureLabel(facility)}.`;
    return;
  }
  const home = selectedLot ? world.homes.find(item => item.lotId === selectedLot!.id) : undefined;
  const activeGathering = home ? world.activeHouseholdGathering(home) : undefined;
  if (home && activeGathering) {
    const host = home.residents.find(resident => resident.id === activeGathering.hostResidentId);
    document.querySelector("#panel-kicker")!.textContent = "HOUSEHOLD GATHERING";
    document.querySelector("#panel-title")!.textContent = `${world.householdGatheringLabel(activeGathering)} at ${home.name}`;
    document.querySelector("#panel-copy")!.textContent =
      `${host?.name ?? "A resident"} is hosting ${activeGathering.guestCount} visitors. ${world.householdGatheringStatus(activeGathering)}. Enter from the real street entrance to join the same gathering visible in Home Simulator.`;
    return;
  }
  const resident = home?.residents[0];
  document.querySelector("#panel-kicker")!.textContent = "CITY EXPLORER";
  if (!resident) {
    document.querySelector("#panel-title")!.textContent = "Walk the living city";
    document.querySelector("#panel-copy")!.textContent =
      "Follow continuous sidewalks and road crossings through the same traffic, homes, workplaces, services, and emergencies managed in City Builder.";
    return;
  }
  const wellbeing = world.residentWellbeing(resident);
  const latestMilestone = world.residentMilestones(resident)[0];
  const outages = selectedLot ? world.utilityFailuresForLot(selectedLot) : [];
  const outageCopy = outages.length
    ? ` ${outages.map(failure => utilityKindLabel(failure.kind)).join(" and ")} service is disrupted while crews respond.`
    : "";
  const currentActivity = world.residentStatus(resident) === "Home"
    ? world.residentActionLabel(resident)
    : world.residentStatus(resident);
  document.querySelector("#panel-title")!.textContent = `${resident.name} in the city`;
  document.querySelector("#panel-copy")!.textContent =
    `${resident.name} is ${currentActivity.toLowerCase()} with ${wellbeing.score}% wellbeing, wearing ${world.residentOutfitLabel(resident).toLowerCase()}. ${wellbeing.pressure}.${outageCopy} Their current commute burden is ${wellbeing.commuteBurden}%.${latestMilestone ? ` Latest milestone: ${latestMilestone.title} (${world.residentMilestoneDate(latestMilestone)}).` : ""}`;
}

function setPanel(kicker: string, title: string, copy: string, controls: string) {
  document.querySelector(".panel")!.classList.remove("inspecting", "voices-open");
  document.querySelector<HTMLElement>("#neighborhood-voices")!.hidden = true;
  const parcelDetails = document.querySelector("#parcel-details")!;
  parcelDetails.classList.remove("visible");
  parcelDetails.innerHTML = "";
  document.querySelector("#panel-kicker")!.textContent = kicker;
  document.querySelector("#panel-title")!.textContent = title;
  document.querySelector("#panel-copy")!.textContent = copy;
  document.querySelector("#controls")!.innerHTML = controls.split(";").map(row => {
    const [key, value] = row.split("|");
    return `<kbd>${key}</kbd><span>${value}</span>`;
  }).join("");
}

function areaCenter(points: Point2[]) {
  return points.reduce(
    (center, point) => ({ x: center.x + point.x / points.length, z: center.z + point.z / points.length }),
    { x: 0, z: 0 }
  );
}

function neighborhoodPulses() {
  const totalPopulation = Math.max(1, world.cityEconomy().population);
  const effectiveStaffing = world.effectiveStaffing();
  const parkCenters = world.areas.filter(area => area.kind === "park").map(area => areaCenter(area.points));
  return world.areas
    .filter(area => area.kind === "district")
    .map(district => {
      const lots = world.lots.filter(lot => pointInPolygon(lot.center, district.points) && lot.zone !== "unassigned");
      if (!lots.length) return undefined;
      const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
      const roadIds = new Set(lots.map(lot => lot.roadId));
      const localRoads = world.roads.filter(road => roadIds.has(road.id));
      const constrained = lots.filter(lot => world.lotEnvironmentalConstraintScore(lot) > 0).length;
      const unhealthyExposure = lots.filter(lot => world.lotEnvironmentalQuality(lot).score < 55).length;
      const parkServed = lots.filter(lot => parkCenters.some(park => Math.hypot(lot.center.x - park.x, lot.center.z - park.z) <= 320)).length;
      const pulse = neighborhoodPulse({
        districtId: district.id,
        districtName: district.name,
        population: lots.reduce((total, lot) => total + world.lotPopulation(lot), 0),
        jobs: lots.reduce((total, lot) => total + world.lotJobs(lot), 0),
        wellbeing: average(lots.map(lot => world.lotWellbeing(lot, totalPopulation, effectiveStaffing))),
        utilityReliability: average(lots.map(lot => world.lotUtilityReliability(lot, totalPopulation, effectiveStaffing))),
        trafficPressure: average(localRoads.map(road => world.roadTrafficPressure(road))),
        landValue: average(lots.map(lot => world.lotLandValue(lot, totalPopulation, effectiveStaffing))),
        parkAccess: parkServed / lots.length * 100,
        environmentalExposure: Math.max(constrained, unhealthyExposure) / lots.length * 100,
        activeOutages: lots.reduce((total, lot) => total + world.utilityFailuresForLot(lot).length, 0),
        policyCount: world.districtPolicies[district.id]?.length ?? 0
      });
      return { pulse, center: areaCenter(district.points) };
    })
    .filter((item): item is { pulse: NeighborhoodPulse; center: Point2 } => Boolean(item))
    .sort((first, second) => second.pulse.priority - first.pulse.priority || first.pulse.districtName.localeCompare(second.pulse.districtName));
}

function renderNeighborhoodVoices() {
  const panel = document.querySelector(".panel")!;
  const container = document.querySelector<HTMLElement>("#neighborhood-voices")!;
  panel.classList.add("voices-open");
  container.hidden = false;
  const entries = neighborhoodPulses().slice(0, 4);
  const heading = document.createElement("div");
  heading.className = "neighborhood-voices-heading";
  heading.textContent = "Representative feedback from live district conditions";
  const cards = entries.map(({ pulse, center }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = pulse.status;
    button.dataset.voiceDistrict = pulse.districtId;
    button.dataset.voiceView = pulse.focusView;
    button.dataset.voiceX = String(center.x);
    button.dataset.voiceZ = String(center.z);
    const header = document.createElement("span");
    const district = document.createElement("b");
    district.textContent = pulse.districtName;
    const score = document.createElement("i");
    score.textContent = `${pulse.score}%`;
    header.append(district, score);
    const title = document.createElement("strong");
    title.textContent = pulse.headline;
    const message = document.createElement("small");
    message.textContent = `${pulse.voice}: “${pulse.message}”`;
    const action = document.createElement("em");
    action.textContent = `${pulse.actionLabel} →`;
    button.append(header, title, message, action);
    return button;
  });
  if (!cards.length) {
    const empty = document.createElement("p");
    empty.textContent = "Zone parcels inside a district to begin neighborhood feedback.";
    container.replaceChildren(heading, empty);
  } else {
    container.replaceChildren(heading, ...cards);
  }
}

function renderParcelDetails(lot: Lot) {
  const details = document.querySelector("#parcel-details")!;
  const required: ServiceKind[] = ["power", "water", "sewage", "waste", "fire", "health", "school"];
  const serviceLabels: Record<ServiceKind, string> = {
    power: "Power",
    water: "Water",
    sewage: "Sewage",
    waste: "Waste",
    fire: "Fire",
    health: "Health",
    school: "School"
  };
  const missingServices = required.filter(kind => !isLotCovered(lot, kind));
  const householdMix = [
    ["Families", lot.householdMix.families],
    ["Singles", lot.householdMix.singles],
    ["Shared", lot.householdMix.shared],
    ["Seniors", lot.householdMix.seniors]
  ].filter(([, count]) => Number(count) > 0);
  const businessLabels = {
    retail: "Retail",
    office: "Office",
    hospitality: "Hospitality",
    industrial: "Industrial",
    community: "Community"
  };
  const businessMix = Object.entries(lot.businessMix)
    .filter(([, count]) => count > 0)
    .map(([sector, count]) => `${businessLabels[sector as keyof typeof businessLabels]} ${count}`);
  const progress = world.constructionProgress(lot);
  const activity = world.lotActivity(lot);
  const lotWellbeing = world.lotWellbeing(lot);
  const lotWellbeingState = wellbeingLabel(lotWellbeing);
  const lotHome = world.homes.find(home => home.lotId === lot.id);
  const environmentalQuality = world.lotEnvironmentalQuality(lot);
  const developmentCapacity = world.lotDevelopmentCapacity(lot);
  const parcelSeed = hash(lot.id);
  const parcelArchitecture = buildingArchitecture(world.templateId, lot.zone, parcelSeed);
  const parcelDensityHeight = developmentCapacity.density === "low" ? .62 : developmentCapacity.density === "high" ? 1.55 : 1;
  const parcelHeight = lotHome
    ? Math.max(3.6, lotHome.floors * 3.2 + .4)
    : zoneBuildingHeight(lot.zone, parcelSeed) * parcelArchitecture.heightScale * parcelDensityHeight;
  const parcelProgram = buildingProgram(lot.zone, developmentCapacity.density, lot.households, lot.businesses, parcelHeight);
  const latestHomeMilestone = lotHome?.residents
    .flatMap(resident => world.residentMilestones(resident).map(milestone => ({ resident, milestone })))
    .sort((first, second) => second.milestone.occurredAt - first.milestone.occurredAt)[0];
  const accessibilityEntrance = world.accessibilityEntrances.find(
    entrance => entrance.targetKind === "lot" && entrance.targetId === lot.id
  );
  const commute = world.commuteForLot(lot);
  const commuteDestination = commute ? world.lots.find(item => item.id === commute.destinationLotId) : undefined;
  const commuteDestinationName = commuteDestination
    ? commuteDestination.anchorBusiness?.name
      ?? `${100 + hash(commuteDestination.id) % 900} ${world.roads.find(road => road.id === commuteDestination.roadId)?.name ?? "Unnamed road"}`
    : "";
  const activeCommute = commute
    ? world.activeCommutes().find(item => item.flow.id === commute.id)
    : undefined;
  const activeIncident = world.activeIncidents().some(incident => incident.lotId === lot.id);
  const activeUtilityFailures = world.utilityFailuresForLot(lot);
  const foundationalGap = missingServices.find(kind => kind === "power" || kind === "water" || kind === "sewage" || kind === "waste");
  const population = world.lots.reduce((total, item) => total + world.lotPopulation(item), 0);
  const outlook = progress < 1
    ? { tone: "building", text: `Construction is ${Math.round(progress * 100)}% complete. Occupancy begins when the building opens.` }
    : lot.zone === "unassigned"
      ? { tone: "warning", text: "Growth is paused until this parcel receives a zone." }
      : activeIncident
        ? { tone: "warning", text: "An active emergency is temporarily reducing this parcel's attractiveness." }
        : activeUtilityFailures.length
          ? { tone: "warning", text: `${activeUtilityFailures.map(failure => utilityKindLabel(failure.kind)).join(" and ")} service is disrupted while municipal crews complete repairs.` }
        : foundationalGap
          ? { tone: "warning", text: `${serviceLabels[foundationalGap]} access is missing and is constraining growth.` }
          : powerReliability(population) < .75
            ? { tone: "warning", text: "Citywide power reliability is reducing service effectiveness here." }
            : world.effectiveStaffing() < world.serviceFunding * .9
              ? { tone: "warning", text: "The city lacks enough workers to deliver its selected staffing policy." }
              : lot.businesses > 0 && (lot.businessFinance?.consecutiveLossDays ?? 0) >= 3
                ? { tone: "warning", text: `Local businesses have lost money for ${lot.businessFinance!.consecutiveLossDays} consecutive days. Their operating reserve and future occupancy are under pressure.` }
                : lot.businesses > 0 && (lot.businessFinance?.lastProfit ?? 0) > 0
                  ? { tone: "healthy", text: `Local businesses are profitable, supporting operating reserves and future occupancy alongside the parcel's core services.` }
                  : { tone: "healthy", text: "This parcel has the core support needed for stable daily growth." };
  const anchor = lot.anchorBusiness
    ? `<div class="parcel-anchor"><span>Neighborhood anchor</span><strong>${lot.anchorBusiness.name}</strong><small>${businessLabels[lot.anchorBusiness.sector]} · ${lot.anchorBusiness.jobs} jobs · ${world.businessIsOpen(lot.anchorBusiness.sector) ? "Open now" : "Closed now"}</small></div>`
    : "";
  const assignedWorkers = world.residentsAssignedToWorkplace(lot.id);
  const activeWorkers = world.residentsAtWorkplace(lot.id);
  const workplaceActivity = lot.businesses > 0 ? world.workplaceActivity(lot) : undefined;
  const businessFinance = lot.businesses > 0 ? world.businessFinance(lot) : undefined;
  const businessProjection = lot.businesses > 0 && !businessFinance?.lastSettledAt
    ? world.businessFinanceProjection(lot)
    : undefined;
  const businessRevenue = businessProjection?.revenue ?? businessFinance?.lastRevenue ?? 0;
  const businessPayroll = businessProjection?.payroll ?? businessFinance?.lastPayroll ?? 0;
  const businessOperatingCosts = businessProjection?.operatingCosts ?? businessFinance?.lastOperatingCosts ?? 0;
  const businessProfit = businessProjection?.profit ?? businessFinance?.lastProfit ?? 0;
  const businessMargin = businessProjection?.margin ?? (businessFinance ? world.businessProfitMargin(lot) : 0);
  const workforce = assignedWorkers.length ? `
    <div class="parcel-autonomy">
      <span>Named workplace roster</span>
      <strong>${activeWorkers.length}/${assignedWorkers.length} on shift now · ${assignedWorkers.map(({ resident }) => `${resident.name}: ${world.residentWorkTaskLabel(resident)} ${world.residentWorkPerformance(resident)}%`).join(" · ")}</strong>
      <small>Residents commute here from persistent households and build career progress through daily tasks.</small>
    </div>
  ` : "";
  const customerActivity = workplaceActivity ? `
    <div class="parcel-line">
      <span>Workplace activity</span>
      <strong>${workplaceActivity.label} · ${workplaceActivity.coworkersOnShift} coworkers · ${workplaceActivity.customersPresent} customers present · ${workplaceActivity.hourlyCustomerDemand} visits/hour · ${workplaceActivity.servicePressure}% service pressure</strong>
    </div>
  ` : "";
  const businessViability = businessFinance ? `
    <div class="parcel-autonomy">
      <span>Business viability · ${world.businessViabilityLabel(lot)}</span>
      <strong>${businessProjection ? "Projected" : "Last settled"} day · ${formatHomeCurrency(businessRevenue)} revenue · ${formatHomeCurrency(businessPayroll)} payroll · ${formatHomeCurrency(businessOperatingCosts)} operations · ${formatSignedHomeCurrency(businessProfit)} profit (${businessMargin.toFixed(1)}%)</strong>
      <small>${formatHomeCurrency(businessFinance.operatingReserve)} operating reserve${businessFinance.consecutiveLossDays ? ` · ${businessFinance.consecutiveLossDays} consecutive loss days` : " · no current loss streak"}${businessFinance.lastClosureAt !== undefined ? " · a closure has occurred here" : ""}</small>
    </div>
  ` : "";
  details.innerHTML = `
    <div class="parcel-metrics">
      <div><span>Residents</span><strong>${world.lotPopulation(lot).toLocaleString()}</strong></div>
      <div><span>Households</span><strong>${lot.households.toLocaleString()}</strong></div>
      <div><span>Businesses</span><strong>${lot.businesses.toLocaleString()}</strong></div>
      <div><span>Jobs</span><strong>${world.lotJobs(lot).toLocaleString()}</strong></div>
    </div>
    <div class="parcel-line"><span>Zoning intensity</span><strong>${developmentCapacity.density} · capacity ${developmentCapacity.households} households and ${developmentCapacity.businesses} businesses</strong></div>
    <div class="parcel-line"><span>Building program</span><strong>${parcelProgram.label} · ${parcelProgram.totalFloors} floors${parcelProgram.commercialFloors ? ` · ${parcelProgram.commercialFloors} commercial` : ""}${parcelProgram.residentialFloors ? ` · ${parcelProgram.residentialFloors} residential` : ""}</strong><small>${parcelProgram.groundFloor} · ${parcelProgram.access}</small></div>
    <div class="parcel-line"><span>Household mix</span><strong>${householdMix.length ? householdMix.map(([label, count]) => `${label} ${count}`).join(" · ") : "No occupied homes"}</strong></div>
    <div class="parcel-line"><span>Business mix</span><strong>${businessMix.length ? businessMix.join(" · ") : "No open businesses"}</strong></div>
    <div class="parcel-line"><span>Live neighborhood routine</span><strong>${activity.atHome} home · ${activity.atWorkOrSchool} work or school · ${activity.outInCity} elsewhere · ${activity.openBusinesses}/${lot.businesses} businesses open</strong></div>
    <div class="parcel-wellbeing ${lotWellbeingState.toLowerCase()}">
      <span>Household wellbeing</span>
      <strong>${lotWellbeing}% · ${lotWellbeingState}</strong>
      <small>${world.lotUtilityReliability(lot)}% utilities · ${world.lotNeighborhoodSupport(lot)}% neighborhood support${lotHome?.residents.length ? ` · ${lotHome.residents.length} named ${lotHome.residents.length === 1 ? "resident" : "residents"}` : ""}</small>
    </div>
    <div class="parcel-line">
      <span>Environmental health</span>
      <strong>${environmentalQuality.score}% ${environmentalQuality.label} · air ${environmentalQuality.airQuality}% · noise ${environmentalQuality.noiseLevel}% · ground pollution ${environmentalQuality.groundPollution}%</strong>
      <small>${environmentalQuality.sources.length ? `Sources: ${environmentalQuality.sources.join(" · ")}` : "No major local source"}${environmentalQuality.mitigations.length ? ` · Relief: ${environmentalQuality.mitigations.join(" · ")}` : ""}</small>
    </div>
    ${accessibilityEntrance ? `
      <div class="parcel-line">
        <span>Street entrance</span>
        <strong>${entranceAccessLabel(accessibilityEntrance)} · ${accessibilityEntrance.doorWidth.toFixed(2)}m clear width${accessibilityEntrance.tactileGuidance ? " · tactile guidance" : " · no tactile guidance"}</strong>
      </div>
    ` : ""}
    ${lotHome?.residents.length ? `
      <div class="parcel-autonomy">
        <span>Named household activity</span>
        <strong>${lotHome.residents.map(resident => `${resident.name}: ${world.residentActionLabel(resident)}`).join(" · ")}</strong>
        <small>${lotHome.residents.reduce((total, resident) => total + (resident.completedActions ?? 0), 0)} autonomous actions completed${latestHomeMilestone ? ` · Latest story: ${latestHomeMilestone.resident.name} ${latestHomeMilestone.milestone.title.toLowerCase()}` : ""}</small>
      </div>
    ` : ""}
    ${activeUtilityFailures.length ? `
      <div class="parcel-outage">
        <span>Active utility repair</span>
        <strong>${activeUtilityFailures.map(failure => utilityKindLabel(failure.kind)).join(" · ")}</strong>
        <small>${activeUtilityFailures.map(failure => world.utilityFailureStatus(failure)).join(" · ")}</small>
      </div>
    ` : ""}
    ${commute ? `<div class="parcel-commute"><span>Representative commute</span><strong>${flowModeName(commute.mode)} · ${world.estimatedCommuteMinutes(commute)}m · ${Math.round(commute.distance)}m</strong><small>${commute.travelers} travelers to ${commuteDestinationName}${activeCommute ? ` · ${activeCommute.direction === "outbound" ? "Going to work" : "Returning home"}` : ""}</small></div>` : ""}
    ${anchor}
    ${customerActivity}
    ${businessViability}
    ${workforce}
    <div class="service-pills">${required.map(kind => {
      const covered = isLotCovered(lot, kind);
      const staffing = Math.round(world.serviceStaffing(kind) * 100);
      const outage = activeUtilityFailures.some(failure => failure.kind === kind);
      const state = !covered ? "missing" : outage ? "outage" : staffing < 50 ? "limited" : "connected";
      return `<span class="${state}">${serviceLabels[kind]}${outage ? " OUT" : covered ? ` ${staffing}%` : ""}</span>`;
    }).join("")}</div>
    <div class="parcel-outlook ${outlook.tone}">${outlook.text}</div>
  `;
  details.classList.add("visible");
  document.querySelector(".panel")!.classList.add("inspecting");
}

function updateCityToolPanel(lot?: Lot) {
  if (cityTool === "road") {
    const road = currentRoadConfig();
    const targetId = (document.querySelector("#road-target") as HTMLSelectElement).value;
    const drawingAids = `${roadDrawingAidEnabled("road-snap-endpoints") ? "endpoints snap within 12m" : "endpoint snapping off"} · ${roadDrawingAidEnabled("road-angle-lock") ? "15° angle lock on" : "free-angle curves"} · ${roadDrawingAidEnabled("road-tangent-guide") ? "tangent guides" : "tangent guides off"} · ${roadDrawingAidEnabled("road-parallel-guide") ? "parallel guides" : "parallel guides off"}`;
    const structureCopy = road.structure === "bridge" ? `bridge deck at +${road.elevationMeters}m` : road.structure === "tunnel" ? `tunnel at ${road.elevationMeters}m` : "surface construction";
    setPanel(
      "STREET DESIGNER",
      targetId ? "Retrofit a living street" : "Draw beyond the grid",
      `${road.profile.travelLanes} travel lanes at ${road.profile.speedLimitKph} km/h · ${road.width}m roadway · ${structureCopy} · capacity ${roadCapacityForProfile(road.profile, road.class).toLocaleString()} vehicles per hour. ${roadProfileEffects(road.profile)} · ${drawingAids}. Every choice changes cost, traffic capacity, and visible street geometry.`,
      targetId ? "Profile controls|Design retrofit;Apply profile|Commit changes;⌘ Z|Undo" : "Click|Add a curve point;Enter|Build and pay;Backspace|Remove last point;Escape|Cancel draft;⌘ Z|Undo"
    );
  } else if (cityTool === "inspect") {
    const roadName = lot ? world.roads.find(road => road.id === lot.roadId)?.name ?? "Unnamed road" : "";
    const address = lot ? `${100 + hash(lot.id) % 900} ${roadName}` : "Choose a city parcel";
    setPanel(
      "PARCEL INSPECTOR",
      address,
      lot ? `${lot.zone[0].toUpperCase()}${lot.zone.slice(1)} parcel · ${lot.width}m × ${lot.depth}m. Its households, employers, services, and Home Simulator property all belong to this exact location.` : "Select any lot to inspect its occupants, employers, service dependencies, growth outlook, and household connection.",
      "Click lot|Inspect parcel;Home mode|Enter household;⌘ Z|Undo"
    );
    if (lot) renderParcelDetails(lot);
  } else if (cityTool === "service") {
    const service = serviceDescription(currentServiceKind());
    setPanel("MUNICIPAL SERVICES", `Place ${service.title.toLowerCase()}`, `${service.radius}m coverage · capacity ${service.capacity} · ${service.cost} at full staff. This facility ${service.purpose}.`, "Click land|Place facility;Staffing|Capacity & cost;⌘ Z|Undo");
  } else if (cityTool === "utility") {
    const kind = currentUtilityKind();
    const name = utilityName(kind).toLowerCase();
    const capacity = { power: 42_000, water: 54_000, sewage: 48_000, waste: 32_000 }[kind];
    setPanel("UTILITY NETWORK", `Draw ${name}`, `Each route carries capacity for ${capacity.toLocaleString()} residents. Click several points through the city and press Enter. Parcels require both a nearby route and matching facility.`, "Click|Add network point;Enter|Finish network;⌘ Z|Undo");
  } else if (cityTool === "parking") {
    const kind = currentParkingKind();
    const definition = {
      curb: "A road-aligned two-space curb bay with one designated accessible space.",
      surface: "An 18-space surface lot with two designated accessible spaces.",
      garage: "An 84-space structured garage with five designated accessible spaces and a street-facing entrance."
    }[kind];
    setPanel(
      "PARKING & ACCESS",
      `Place ${parkingKindLabel(kind).toLowerCase()}`,
      `${definition} New facilities charge ${formatParkingRate(currentParkingRate())}. Price changes alter demand, turnover, and projected municipal revenue.`,
      "Click land|Place facility;Click parking|Apply selected price;R in Explorer|Cycle destinations;⌘ Z|Undo"
    );
  } else if (cityTool === "curb") {
    const curbFacilities = world.parking.filter(facility => facility.kind === "curb");
    const activeRules = curbFacilities.filter(facility => world.curbEffectiveUse(facility) !== "parking").length;
    const waiting = curbFacilities.reduce((total, facility) => total + (facility.deliveriesWaiting ?? 0), 0);
    const served = curbFacilities.reduce((total, facility) => total + (facility.deliveriesServed ?? 0), 0);
    const violations = curbFacilities.reduce((total, facility) => total + (facility.violations ?? 0), 0);
    const projectedNet = curbFacilities.reduce(
      (total, facility) => total + world.curbMonthlyProjection(facility) - world.curbMonthlyCost(facility),
      0
    );
    setPanel(
      "CURB MANAGEMENT",
      `${curbUseLabel(currentCurbUse())} · ${curbScheduleLabel(currentCurbSchedule())}`,
      `${curbFacilities.length} managed curb spaces · ${activeRules} restrictions active now · ${waiting} deliveries waiting · ${served} completed deliveries · ${violations} violations · projected ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}. Click an existing curb bay to apply the selected rule, or click a road edge to create one.`,
      "Curb use|Parking, loading, restriction, event;Schedule|Time window;Click curb|Apply rule;Click road edge|Create zone;⌘ Z|Undo"
    );
  } else if (cityTool === "event") {
    const kind = currentCityEventKind();
    const definition = CITY_EVENT_DEFINITIONS[kind];
    const active = world.activeCityEvents();
    const projectedAttendance = world.cityEvents.reduce(
      (total, event) => total + world.cityEventExpectedAttendance(event),
      0
    );
    const projectedNet = world.cityEvents.reduce(
      (total, event) => total + world.cityEventMonthlyProjection(event) - event.monthlyCost,
      0
    );
    const affectedCurbs = world.parking.filter(
      facility => facility.kind === "curb" && world.cityEventCurbOverride(facility)
    ).length;
    const closedRoads = world.cityEventClosedRoads().length;
    const temporaryServices = active.filter(event => event.temporaryTransitLineId).length;
    setPanel(
      "CITY EVENTS",
      `${definition.label} · ${cityEventTimingLabel(currentCityEventTiming())}`,
      `${world.cityEvents.length} recurring monthly events · ${active.length} active now · ${closedRoads} closed roads · ${temporaryServices} temporary transit services · ${projectedAttendance.toLocaleString()} projected attendees · ${affectedCurbs} event-controlled curbs · ${Math.round(world.cityEventTrafficPressure() * 100)}% event traffic pressure · projected ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}. Click near a street to create a named event with a visible road closure, traffic delay, curb controls, and added service on the nearest transit line.`,
      "Event type|Demand pattern;Timing|First occurrence;Click street|Place event;Roads|Temporary closures;Transit|Temporary service;⌘ Z|Undo"
    );
  } else if (cityTool === "transit") {
    const line = selectedTransitLine();
    if (!line) {
      setPanel("TRANSIT NETWORK", "No route available", "Draw a connected road network, then click a road with Transit operations selected to create the first bus line.", "Roads|Build a network;Click road|Create line");
      return;
    }
    const demand = world.transitLineDemand(line);
    const crowding = world.transitLineCrowding(line);
    const waiting = line.stops.reduce((total, stop) => total + stop.waiting, 0);
    const projectedNet = world.transitMonthlyProjection(line) - world.transitMonthlyCost(line);
    const transfers = world.transitTransfersForLine(line);
    const transferCopy = transfers.length
      ? `${transfers.length} network ${transfers.length === 1 ? "transfer" : "transfers"} to ${transfers.map(transfer => transfer.lineName).join(" + ")}`
      : "no connected transfer yet";
    setPanel(
      "TRANSIT NETWORK",
      line.name,
      `${world.transitLines.length}/8 lines · ${line.stops.length} stops · ${transferCopy} · every ${world.transitEffectiveHeadway(line)} minutes${world.transitEffectiveHeadway(line) < line.headwayMinutes ? ` with bus priority or temporary service, normally ${line.headwayMinutes}` : ""} with ${world.transitActiveFleetSize(line)} active buses · ${transitFarePolicyLabel(line.fare)} · ${Math.round(demand)} hourly passenger demand · ${world.transitAverageWait(line).toFixed(1)}m average wait · ${waiting} waiting now · ${transitCrowdingLabel(crowding)} (${Math.round(crowding * 100)}%) · projected ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}. Click another road to create or select its line.`,
      "Line selector|Choose route;Name|Create identity;Click road|Create or select;Gold ring|Transfer stop;Stops|Change coverage;Frequency|Fleet and waits;Fare|Demand and revenue;Remove|Delete selected line"
    );
  } else if (cityTool === "access") {
    const usable = world.accessibilityEntrances.filter(entrance => world.entranceIsUsable(entrance)).length;
    const universal = world.accessibilityEntrances.filter(entrance => world.entranceHasUniversalAccess(entrance)).length;
    setPanel(
      "ACCESSIBILITY UPGRADES",
      "Connect every destination",
      `${usable}/${world.accessibilityEntrances.length} entrances are currently step-free and ${universal} have universal access. Green markers are complete, blue markers are usable but improvable, and orange markers have a barrier.`,
      "Click entrance|Install full upgrade;Homes & shops|$45k;Parks|$70k;Transit stops|$25k;⌘ Z|Undo"
    );
  } else {
    const label = cityTool === "mixed" ? "mixed-use" : cityTool;
    const density = currentZoneDensity();
    setPanel("ZONING BRUSH", `Zone ${density} intensity ${label}`, "Click parcels to choose both land use and development intensity. Low intensity creates smaller buildings, medium supports urban blocks, and high intensity creates the greatest household or business capacity.", "Intensity|Choose built form;Click lot|Apply zoning;Inspect|Review parcel;⌘ Z|Undo");
  }
}

function updateCityViewPanel() {
  const totalPopulation = Math.max(1, world.cityEconomy().population);
  const effectiveStaffing = world.effectiveStaffing();
  const legend = document.querySelector("#city-view-legend")!;
  legend.className = `city-view-legend ${cityView}`;
  const legendCopy = legend.querySelector("span")!;
  if (cityView === "voices") {
    const pulses = neighborhoodPulses();
    const urgent = pulses.filter(item => item.pulse.status === "critical").length;
    legendCopy.textContent = "Listen · locate · respond";
    setPanel(
      "NEIGHBORHOOD VOICES",
      urgent ? `${urgent} district${urgent === 1 ? " needs" : "s need"} attention` : "Residents feel supported",
      "Each card translates real utility, wellbeing, traffic, land, parks, environmental, job, and policy conditions into a localized pulse. Select one to focus the district and open the evidence behind it.",
      "Select a voice|Focus district;Card action|Open evidence;Views|Compare outcomes"
    );
    renderNeighborhoodVoices();
  } else if (cityView === "traffic") {
    const roads = world.roads
      .map(road => ({ road, pressure: world.roadTrafficPressure(road) }))
      .sort((first, second) => second.pressure - first.pressure);
    const busiest = roads[0];
    legendCopy.textContent = "Clear · busy";
    setPanel(
      "TRAFFIC VIEW",
      busiest ? `${busiest.road.name ?? "Unnamed road"} is busiest` : "No roads yet",
      `${Math.round(world.congestionLevel() * 100)}% citywide congestion. Roads shade from green through amber to red using routed commuter groups, road class, live events, and closures. The busiest corridor is at ${Math.round((busiest?.pressure ?? 0) * 100)}% pressure.`,
      "Green|Moving well;Amber|Building pressure;Red|Severe or closed;Explorer|Experience the trip"
    );
  } else if (cityView === "utilities") {
    const reliabilities = world.lots.map(lot => world.lotUtilityReliability(lot, totalPopulation, effectiveStaffing));
    const averageReliability = reliabilities.length ? Math.round(reliabilities.reduce((total, value) => total + value, 0) / reliabilities.length) : 0;
    const critical = reliabilities.filter(value => value < 50).length;
    legendCopy.textContent = "Unserved · reliable";
    setPanel(
      "UTILITY VIEW",
      `${averageReliability}% average reliability`,
      `${critical} parcels are below 50% utility reliability. Red parcels lack dependable power, water, sewage, or waste service; green parcels have the network, source capacity, staffing, and condition they need.`,
      "Red|Missing or failed;Amber|Limited reliability;Green|Reliable;Services|Build capacity"
    );
  } else if (cityView === "wellbeing") {
    const scores = world.lots.map(lot => world.lotWellbeing(lot, totalPopulation, effectiveStaffing));
    const strained = scores.filter(value => value < 64).length;
    legendCopy.textContent = "Critical · thriving";
    setPanel(
      "WELLBEING VIEW",
      `${world.cityWellbeing()}% city wellbeing`,
      `${strained} parcels are strained or critical. This view combines utilities, local services, commute burden, and named household needs so a city-scale problem remains connected to the people experiencing it.`,
      "Red|Critical;Amber|Strained;Green|Stable or thriving;Inspect|See the cause"
    );
  } else if (cityView === "land-value") {
    const values = world.lots.filter(lot => lot.zone !== "unassigned").map(lot => world.lotLandValue(lot, totalPopulation, effectiveStaffing));
    const averageValue = values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
    const pressured = values.filter(value => value < 45).length;
    legendCopy.textContent = "Pressured · valuable";
    setPanel(
      "LAND VALUE VIEW",
      `${averageValue}/100 average land value`,
      `${pressured} developed parcels are below 45. Values combine reliable utilities, neighborhood services, park access, road speed and traffic noise, zoning, tax pressure, and district policy.`,
      "Red|Low value;Amber|Stable;Green|High value;Economy|Change taxes and policy"
    );
  } else if (cityView === "pollution") {
    const quality = world.lots
      .filter(lot => lot.zone !== "unassigned")
      .map(lot => world.lotEnvironmentalQuality(lot));
    const averageQuality = quality.length
      ? Math.round(quality.reduce((total, item) => total + item.score, 0) / quality.length)
      : 0;
    const unhealthy = quality.filter(item => item.score < 42).length;
    const strained = quality.filter(item => item.score >= 42 && item.score < 60).length;
    legendCopy.textContent = "Unhealthy · clean";
    setPanel(
      "ENVIRONMENTAL HEALTH",
      `${averageQuality}% average environmental quality`,
      `${unhealthy} parcels are unhealthy and ${strained} are strained. Air quality, noise, and ground pollution respond to live traffic, speed, industry, waste, sewage, parks, street trees, recycling, and heavy-traffic policy.`,
      "Red|Unhealthy;Amber|Strained;Green|Healthy;Inspect|See sources and relief"
    );
  } else if (cityView === "environment") {
    const highRisk = world.lots.filter(lot => world.lotFloodRisk(lot) === "high").length;
    const moderateRisk = world.lots.filter(lot => world.lotFloodRisk(lot) === "moderate").length;
    const steep = world.lots.filter(lot => world.lotTerrainSlope(lot) === "steep").length;
    const moderateSlope = world.lots.filter(lot => world.lotTerrainSlope(lot) === "moderate").length;
    const outsideGrowthBoundary = world.lots.filter(lot => world.lotGrowthBoundaryStatus(lot) === "outside").length;
    legendCopy.textContent = "High exposure · lower exposure";
    setPanel(
      "ENVIRONMENT VIEW",
      `${highRisk + steep + outsideGrowthBoundary} high-constraint parcels`,
      `${highRisk} parcels have high flood exposure, ${moderateRisk} have moderate flood exposure, ${steep} occupy steep terrain, ${moderateSlope} occupy moderate slopes, and ${outsideGrowthBoundary} sit beyond an urban growth boundary. Regional constraints remain editable, but apply explicit land-value pressure so open space, resilience, and corridor choices have visible tradeoffs.`,
      "Red|High flood or steep slope;Amber|Moderate constraint;Green|Outside mapped constraint;Inspect|Review parcel"
    );
  } else if (cityView === "development") {
    const active = world.lots.filter(lot => world.constructionProgress(lot) < 1).length;
    const complete = world.lots.filter(lot => lot.zone !== "unassigned" && world.constructionProgress(lot) >= 1).length;
    legendCopy.textContent = "Planned · building · complete";
    setPanel(
      "DEVELOPMENT VIEW",
      `${active} active construction projects`,
      `${complete} zoned parcels are complete. Gray is undeveloped, amber is under construction, and blue is complete, making growth gaps and stalled districts readable at a glance.`,
      "Gray|Undeveloped;Amber|Under construction;Blue|Complete;Inspect|Review constraints"
    );
  } else {
    legendCopy.textContent = "Natural city colors";
    setPanel(
      "CITY VIEW",
      "Natural city materials",
      "The default view preserves zoning colors, architecture, streets, parks, and water. Switch views when you need evidence, then return here to read the city as a place.",
      "Traffic|Road pressure;Utilities|Service reliability;Wellbeing|Human outcomes;Environment|Flood exposure"
    );
  }
}

renderer.domElement.addEventListener("pointerdown", event => {
  if (mode === "explore") {
    requestExplorerPointerLock();
    return;
  }
  pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (mode === "home") {
    const home = currentHome();
    const homeDoorHit = raycaster
      .intersectObjects(homeGroup.children, true)
      .find(item => item.object.userData.homeDoorId);
    if (homeTool === "select" && !movingFurnitureId && home && homeDoorHit) {
      selectedHomeDoorId = homeDoorHit.object.userData.homeDoorId as string;
      selectedHomeWindowId = null;
      selectedFurnitureId = null;
      selectedRoomId = null;
      renderHome();
      const selected = home.doors?.find(item => item.id === selectedHomeDoorId);
      if (selected) notice(`${selected.widthKind === "wide" ? "Wide access" : "Standard"} doorway selected · ${selected.width.toFixed(2)}m clear width`);
      return;
    }
    const homeWindowHit = raycaster
      .intersectObjects(homeGroup.children, true)
      .find(item => item.object.userData.homeWindowId);
    if (homeTool === "select" && !movingFurnitureId && home && homeWindowHit) {
      selectedHomeWindowId = homeWindowHit.object.userData.homeWindowId as string;
      selectedHomeDoorId = null;
      selectedFurnitureId = null;
      selectedRoomId = null;
      renderHome();
      const selected = home.windows?.find(item => item.id === selectedHomeWindowId);
      if (selected) notice(`${selected.glazing === "privacy" ? "Privacy" : "Clear"} window selected · ${world.roomDaylight(home, home.rooms.find(room => room.id === selected.roomId)!)}% room daylight`);
      return;
    }
    const furnitureHit = raycaster
      .intersectObjects(homeGroup.children, true)
      .find(item => item.object.userData.furnitureId);
    if (homeTool === "select" && !movingFurnitureId && home && furnitureHit) {
      selectedFurnitureId = furnitureHit.object.userData.furnitureId as string;
      selectedRoomId = null;
      selectedHomeWindowId = null;
      selectedHomeDoorId = null;
      renderHome();
      const selected = home.furniture.find(item => item.id === selectedFurnitureId);
      if (selected) {
        const fit = world.furniturePurposeFit(home, selected);
        notice(`${selected.kind[0].toUpperCase()}${selected.kind.slice(1)} selected${fit === false ? " · consider a more suitable room" : fit === true ? " · room purpose fits" : ""}`);
      }
      return;
    }
    const roomHit = raycaster
      .intersectObjects(homeGroup.children, true)
      .find(item => item.object.userData.roomId);
    if (homeTool === "select" && !movingFurnitureId && home && roomHit) {
      selectedRoomId = roomHit.object.userData.roomId as string;
      selectedFurnitureId = null;
      selectedHomeWindowId = null;
      selectedHomeDoorId = null;
      renderHome();
      const room = home.rooms.find(item => item.id === selectedRoomId);
      if (room) notice(`${room.kind} selected. Choose its floor and wall finishes.`);
      return;
    }
    const foundationHit = raycaster.intersectObjects(homeGroup.children, true).find(item => item.object.userData.homeSurface);
    const placementHit = foundationHit ?? raycaster.intersectObject(ground)[0];
    if (!selectedLot || !placementHit) return;
    const point = worldToLocal(placementHit.point, selectedLot);
    const inLot = Math.abs(point.x) <= selectedLot.width / 2 && Math.abs(point.z) <= selectedLot.depth / 2;
    if (!inLot) {
      if (homeTool === "select") {
        const lotHit = raycaster.intersectObjects(worldGroup.children).find(item => item.object.userData.lotId);
        if (lotHit) {
          selectedLot = world.lots.find(lot => lot.id === lotHit.object.userData.lotId) ?? selectedLot;
          setMode("home");
        }
      } else {
        notice("Placement must stay inside the selected lot");
      }
      return;
    }
    if (!home) return;
    if (movingFurnitureId) {
      const movingItem = home.furniture.find(item => item.id === movingFurnitureId);
      if (!movingItem || !world.moveFurniture(home.id, movingFurnitureId, point.x, point.z)) {
        notice("That position overlaps a wall or another furnishing");
        renderDraft();
        return;
      }
      movingFurnitureId = null;
      renderWorld();
      renderDraft();
      notice(`${movingItem.kind[0].toUpperCase()}${movingItem.kind.slice(1)} moved`);
      return;
    }
    if (homeTool === "select") {
      selectedFurnitureId = null;
      selectedRoomId = null;
      selectedHomeWindowId = null;
      selectedHomeDoorId = null;
      renderHome();
      notice("Selection cleared");
      return;
    }
    if (homeTool === "room") {
      if (!homeDraft) {
        homeDraft = point;
        renderDraft();
        notice("Choose the opposite room corner");
      } else {
        const room = {
          kind: "Living room",
          x: (homeDraft.x + point.x) / 2,
          z: (homeDraft.z + point.z) / 2,
          width: Math.abs(point.x - homeDraft.x),
          depth: Math.abs(point.z - homeDraft.z),
          floor: homeFloor
        };
        const roomCost = Math.round(room.width * room.depth * HOME_BUILD_COSTS.roomPerSquareMeter);
        if (world.addRoom(home.id, room)) notice(`${room.kind} built for ${formatHomeCurrency(roomCost)}`);
        else if (room.width < 2 || room.depth < 2) notice("Rooms must be at least 2m × 2m");
        else notice(`This room needs ${formatHomeCurrency(roomCost)}. The design budget has ${formatHomeCurrency(world.homeRemainingBudget(home))} left`);
        homeDraft = null;
        renderDraft();
        renderWorld();
      }
    } else if (homeTool === "stairs") {
      if (world.addStairs(home.id, homeFloor, point.x, point.z)) {
        renderWorld();
        notice(`Stairs connect Floor ${homeFloor + 1} to Floor ${homeFloor + 2}`);
      } else if (homeFloor >= home.floors - 1) {
        notice("Add an upper floor before placing stairs");
      } else {
        notice("Stairs need overlapping rooms on this floor and the floor above");
      }
    } else if (homeTool === "door") {
      const widthKind = (document.querySelector("#home-door-width") as HTMLSelectElement).value as HomeDoorWidth;
      const cost = world.homeDoorCost(widthKind);
      if (world.addHomeDoor(home.id, point, homeFloor, widthKind)) {
        renderWorld();
        notice(`${widthKind === "wide" ? "Wide access" : "Standard"} doorway placed for ${formatHomeCurrency(cost)}`);
      } else {
        notice(world.homeRemainingBudget(home) < cost
          ? `${formatHomeCurrency(cost)} needed. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains`
          : "Doorways snap between adjacent rooms and cannot overlap");
      }
    } else if (homeTool === "window") {
      const glazing = (document.querySelector("#home-window-glazing") as HTMLSelectElement).value as HomeWindowGlazing;
      const cost = world.homeWindowCost(glazing);
      if (world.addHomeWindow(home.id, point, homeFloor, glazing)) {
        renderWorld();
        notice(`${glazing === "privacy" ? "Privacy" : "Clear"} window placed for ${formatHomeCurrency(cost)} · home daylight ${world.homeDaylight(home)}%`);
      } else {
        notice(world.homeRemainingBudget(home) < cost
          ? `${formatHomeCurrency(cost)} needed. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains`
          : "Windows snap to an open exterior wall and cannot overlap");
      }
    } else {
      if (world.addFurniture(home.id, homeTool, point.x, point.z, homeFloor)) {
        renderWorld();
        notice(`${homeTool[0].toUpperCase()}${homeTool.slice(1)} placed`);
      } else {
        notice(world.homeRemainingBudget(home) < HOME_BUILD_COSTS[homeTool]
          ? `${formatHomeCurrency(HOME_BUILD_COSTS[homeTool])} needed. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains`
          : "Furniture must stay inside a room");
      }
    }
    return;
  }
  if (mode === "city" && cityToolGroup === "economy") {
    notice("Use the economy controls to change taxes, district policy, or debt");
    return;
  }
  if (mode === "city" && cityTool === "access") {
    const entranceHit = raycaster
      .intersectObjects(accessibilityGroup.children, true)
      .find(item => item.object.userData.accessibilityEntranceId);
    const groundHit = raycaster.intersectObject(ground)[0];
    const nearbyEntrance = groundHit
      ? closestAccessibilityEntrance({ x: groundHit.point.x, z: groundHit.point.z }, 14)?.entrance
      : undefined;
    const entranceId = (entranceHit?.object.userData.accessibilityEntranceId as string | undefined)
      ?? nearbyEntrance?.id;
    const entrance = world.accessibilityEntrances.find(item => item.id === entranceId);
    if (!entrance) {
      notice("Choose a marked building, park, or transit entrance");
      return;
    }
    const name = entranceDestinationName(entrance);
    const cost = world.accessibilityUpgradeCost(entrance);
    if (world.entranceHasUniversalAccess(entrance)) {
      notice(`${name} already has universal access`);
      return;
    }
    if (world.clock.treasury < cost) {
      notice(`The city needs $${cost.toLocaleString()} for this upgrade`);
      return;
    }
    world.upgradeAccessibility(entrance.id);
    renderWorld();
    updateCityToolPanel();
    notice(`${name} upgraded for $${cost.toLocaleString()}`);
    return;
  }
  if (mode === "city" && cityTool === "event") {
    const hit = raycaster.intersectObject(ground)[0];
    if (!hit) return;
    const road = nearestRoadLocation(explorerRoadPaths, { x: hit.point.x, z: hit.point.z });
    if (!road || road.distance > 70) {
      notice("Choose a location near the street network");
      return;
    }
    const event = world.addCityEvent(currentCityEventKind(), road.point, currentCityEventTiming());
    renderWorld();
    notice(`${event.name} scheduled ${cityEventTimingLabel(currentCityEventTiming())}`);
    return;
  }
  if (mode === "city" && cityTool === "service") {
    const hit = raycaster.intersectObject(ground)[0];
    if (!hit) return;
    const kind = currentServiceKind();
    world.addService(kind, { x: hit.point.x, z: hit.point.z });
    renderWorld();
    notice(`${serviceDescription(kind).title} placed`);
    return;
  }
  if (mode === "city" && cityTool === "curb") {
    const hit = raycaster.intersectObject(ground)[0];
    if (!hit) return;
    const facilityHit = raycaster
      .intersectObjects(worldGroup.children, true)
      .find(item => item.object.userData.parkingId);
    const hitFacility = world.parking.find(
      facility => facility.id === facilityHit?.object.userData.parkingId && facility.kind === "curb"
    );
    const groundCurb = closestCurbFacility({ x: hit.point.x, z: hit.point.z }, 14)?.facility;
    const facility = hitFacility ?? groundCurb;
    if (facility) {
      if (world.setCurbRule(facility.id, currentCurbUse(), currentCurbSchedule())) {
        renderWorld();
        notice(`${curbUseLabel(facility.curbUse ?? "parking")} scheduled ${curbScheduleLabel(facility.curbSchedule ?? "all-day")}`);
      } else {
        notice("That curb already uses the selected rule");
      }
      return;
    }
    const road = nearestRoadLocation(explorerRoadPaths, { x: hit.point.x, z: hit.point.z });
    if (!road) {
      notice("Build a nearby road before creating a curb zone");
      return;
    }
    const normal = { x: road.tangent.z, z: -road.tangent.x };
    const side = road.signedDistance < 0 ? -1 : 1;
    const offset = Math.max(1.6, road.width / 2 - 1.35) * side;
    const position = {
      x: road.point.x + normal.x * offset,
      z: road.point.z + normal.z * offset
    };
    const heading = Math.atan2(-road.tangent.x, -road.tangent.z);
    const created = world.addCurbZone(position, heading, currentCurbUse(), currentCurbSchedule());
    renderWorld();
    notice(`${curbUseLabel(created.curbUse ?? "parking")} curb created · ${curbScheduleLabel(created.curbSchedule ?? "all-day")}`);
    return;
  }
  if (mode === "city" && cityTool === "parking") {
    const hit = raycaster.intersectObject(ground)[0];
    if (!hit) return;
    const facilityHit = raycaster
      .intersectObjects(worldGroup.children, true)
      .find(item => item.object.userData.parkingId);
    const groundParking = world.parking
      .map(facility => ({
        facility,
        distance: Math.hypot(facility.position.x - hit.point.x, facility.position.z - hit.point.z)
      }))
      .filter(candidate => candidate.distance <= 14)
      .sort((a, b) => a.distance - b.distance)[0]?.facility;
    const parkingId = (facilityHit?.object.userData.parkingId as string | undefined) ?? groundParking?.id;
    if (parkingId) {
      const facility = world.parking.find(item => item.id === parkingId);
      if (!facility) return;
      if (world.setParkingRate(parkingId, currentParkingRate())) {
        renderWorld();
        notice(`${parkingKindLabel(facility.kind)} price set to ${formatParkingRate(facility.hourlyRate)}`);
      } else {
        notice(`${parkingKindLabel(facility.kind)} already charges ${formatParkingRate(facility.hourlyRate)}`);
      }
      return;
    }
    const kind = currentParkingKind();
    const road = nearestRoadLocation(explorerRoadPaths, { x: hit.point.x, z: hit.point.z });
    if (!road) {
      notice("Build a nearby road before placing parking");
      return;
    }
    const heading = Math.atan2(-road.tangent.x, -road.tangent.z);
    let position = { x: hit.point.x, z: hit.point.z };
    if (kind === "curb") {
      const normal = { x: road.tangent.z, z: -road.tangent.x };
      const side = road.signedDistance < 0 ? -1 : 1;
      const offset = Math.max(1.6, road.width / 2 - 1.35) * side;
      position = {
        x: road.point.x + normal.x * offset,
        z: road.point.z + normal.z * offset
      };
    }
    const facility = world.addParking(kind, position, heading, currentParkingRate());
    renderWorld();
    notice(`${parkingKindLabel(facility.kind)} placed · ${facility.capacity} spaces · ${formatParkingRate(facility.hourlyRate)}`);
    return;
  }
  if (mode === "city" && cityTool === "utility") {
    const hit = raycaster.intersectObject(ground)[0];
    if (!hit) return;
    draft.push({ x: hit.point.x, z: hit.point.z });
    renderDraft();
    notice(`${draft.length} utility points`);
    return;
  }
  if (mode === "city" && cityTool === "transit") {
    const hit = raycaster.intersectObject(ground)[0];
    if (!hit) return;
    const roadLocation = nearestRoadLocation(
      explorerRoadPaths,
      { x: hit.point.x, z: hit.point.z }
    );
    if (!roadLocation || roadLocation.distance > 28) {
      notice("Click closer to a road to create or select a transit line");
      return;
    }
    const previousCount = world.transitLines.length;
    const line = world.addTransitLine(roadLocation.roadId);
    if (!line) {
      notice(world.transitLines.length >= 8 ? "Transit network limit reached" : "That road cannot support a line");
      return;
    }
    selectedTransitLineId = line.id;
    renderWorld();
    notice(
      world.transitLines.length > previousCount
        ? `${line.name} created with ${line.stops.length} stops`
        : `${line.name} selected`
    );
    return;
  }
  if (
    mode === "city"
    && cityTool !== "road"
    && cityTool !== "service"
    && cityTool !== "utility"
    && cityTool !== "parking"
    && cityTool !== "curb"
    && cityTool !== "event"
    && cityTool !== "transit"
    && cityTool !== "access"
  ) {
    const lotHit = raycaster.intersectObjects(worldGroup.children).find(item => item.object.userData.lotId);
    if (!lotHit) {
      notice("Choose a parcel");
      return;
    }
    selectedLot = world.lots.find(lot => lot.id === lotHit.object.userData.lotId) ?? null;
    if (!selectedLot) return;
    if (cityTool === "inspect") {
      renderWorld();
      updateCityToolPanel(selectedLot);
      notice("Parcel selected");
    } else {
      const density = currentZoneDensity();
      world.zoneLot(selectedLot.id, cityTool, density);
      renderWorld();
      updateCityToolPanel(selectedLot);
      notice(`${density[0].toUpperCase()}${density.slice(1)} intensity ${cityTool === "mixed" ? "mixed-use" : cityTool} construction started`);
    }
    return;
  }
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) {
    const candidate = { x: hit.point.x, z: hit.point.z };
    lastRoadSnap = snapRoadDrawingPoint(candidate, draft, world.roads, {
      endpoints: roadDrawingAidEnabled("road-snap-endpoints"),
      angleLock: roadDrawingAidEnabled("road-angle-lock"),
      tangentGuide: roadDrawingAidEnabled("road-tangent-guide"),
      parallelGuide: roadDrawingAidEnabled("road-parallel-guide"),
      angleStepDegrees: 15,
      endpointDistance: 12,
      alignmentDistance: 28,
      alignmentToleranceDegrees: 12
    });
    const previous = draft[draft.length - 1];
    if (previous && Math.hypot(lastRoadSnap.point.x - previous.x, lastRoadSnap.point.z - previous.z) < 2) {
      notice("Choose a point at least 2m from the previous road point");
      return;
    }
    draft.push(lastRoadSnap.point);
    renderDraft();
    updateRoadProfileSummary();
    updateRoadDrawingAidStatus();
    const road = currentRoadConfig();
    const cost = draft.length > 1 ? roadConstructionCost(draft, road.profile, road.structure, road.elevationMeters) : 0;
    const snapCopy = lastRoadSnap.kind === "endpoint"
      ? ` · joined ${lastRoadSnap.targetRoadName}`
      : lastRoadSnap.kind === "angle"
        ? ` · locked ${lastRoadSnap.angleDegrees}°`
        : lastRoadSnap.kind === "tangent"
          ? ` · tangent to ${lastRoadSnap.targetRoadName}`
          : lastRoadSnap.kind === "parallel"
            ? ` · parallel to ${lastRoadSnap.targetRoadName}`
        : "";
    notice(`${draft.length} road points${snapCopy}${cost ? ` · $${cost.toLocaleString()} estimate` : ""}`);
  }
});

addEventListener("keydown", event => {
  const controlsGuide = document.querySelector<HTMLElement>("#controls-guide")!;
  const preferencesPanel = document.querySelector<HTMLElement>("#preferences-panel")!;
  const activityCenter = document.querySelector<HTMLElement>("#activity-center")!;
  const residentCreator = document.querySelector<HTMLElement>("#resident-creator")!;
  if (event.code === "Escape" && !controlsGuide.hidden) {
    event.preventDefault();
    controlsGuide.hidden = true;
    resumeAfterModal();
    document.querySelector<HTMLButtonElement>("#help-open")!.focus();
    return;
  }
  if (event.code === "Escape" && !preferencesPanel.hidden) {
    event.preventDefault();
    preferencesPanel.hidden = true;
    resumeAfterModal();
    document.querySelector<HTMLButtonElement>("#settings-open")!.focus();
    return;
  }
  if (event.code === "Escape" && !activityCenter.hidden) {
    event.preventDefault();
    activityCenter.hidden = true;
    document.querySelector<HTMLButtonElement>("#activity-open")!.focus();
    return;
  }
  if (event.code === "Escape" && !residentCreator.hidden) {
    event.preventDefault();
    closeResidentCreator();
    notice("Resident creation cancelled");
    return;
  }
  if (!controlsGuide.hidden || !preferencesPanel.hidden || !residentCreator.hidden) return;
  const target = event.target as HTMLElement | null;
  if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
  if (event.code === "Slash" && event.shiftKey && !event.repeat) {
    event.preventDefault();
    controlsGuide.hidden = false;
    pauseForModal();
    document.querySelector<HTMLButtonElement>("#help-close")!.focus();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyS") {
    event.preventDefault();
    document.querySelector<HTMLButtonElement>("#save")!.click();
    return;
  }
  if (event.altKey && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
    event.preventDefault();
    setMode(({ Digit1: "city", Digit2: "explore", Digit3: "home" } as const)[event.code as "Digit1" | "Digit2" | "Digit3"]);
    return;
  }
  if (event.code === "Backquote" && !event.repeat) {
    event.preventDefault();
    if (simulationSpeed === 0) simulationSpeed = lastNonZeroSimulationSpeed;
    else {
      lastNonZeroSimulationSpeed = simulationSpeed;
      simulationSpeed = 0;
    }
    syncSimulationSpeedControls();
    notice(simulationSpeed === 0 ? "Simulation paused" : "Simulation resumed");
    return;
  }
  keys.add(event.code);
  if (mode === "explore" && event.code === "KeyO" && !event.repeat) {
    event.preventDefault();
    setPhotoMode(!photoMode);
    return;
  }
  if (mode === "explore" && photoMode && event.code === "KeyH" && !event.repeat) {
    event.preventDefault();
    photoHudVisible = !photoHudVisible;
    app.classList.toggle("photo-clean", !photoHudVisible);
    return;
  }
  if (mode === "explore" && photoMode && (event.code === "BracketLeft" || event.code === "BracketRight") && !event.repeat) {
    event.preventDefault();
    adjustPhotoLens(event.code === "BracketLeft" ? -4 : 4);
    return;
  }
  if (mode === "home" && event.code === "Escape" && (movingFurnitureId || homeDraft)) {
    event.preventDefault();
    movingFurnitureId = null;
    homeDraft = null;
    renderHome();
    renderDraft();
    notice("Home edit cancelled");
  }
  if (mode === "home" && event.code === "KeyR" && selectedFurnitureId && !event.repeat) {
    event.preventDefault();
    document.querySelector<HTMLButtonElement>("#rotate-furniture")!.click();
    return;
  }
  if (
    mode === "explore"
    && explorerInteriorHomeId
    && pendingConversationPartnerId
    && ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(event.code)
    && !event.repeat
  ) {
    event.preventDefault();
    const intent = {
      Digit1: "chat",
      Digit2: "support",
      Digit3: "joke",
      Digit4: "confront",
      Digit5: "apologize"
    }[event.code] as ConversationIntent;
    startPendingConversation(intent);
  }
  if (
    mode === "explore"
    && explorerInteriorHomeId
    && pendingConversationPartnerId
    && event.code === "KeyQ"
    && !event.repeat
  ) {
    event.preventDefault();
    pendingConversationPartnerId = null;
    updateInteriorInteractionPrompt();
    notice("Conversation choice canceled");
  }
  if (mode === "explore" && explorerInteriorHomeId && event.code === "KeyC" && !event.repeat) {
    event.preventDefault();
    cycleControlledResident();
  }
  if (mode === "explore" && explorerInteriorHomeId && event.code === "KeyE" && !event.repeat) {
    event.preventDefault();
    useNearbyInteriorInteraction();
  }
  if (
    mode === "explore"
    && explorerInteriorHomeId
    && controlledResidentId
    && ["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)
    && !event.repeat
  ) {
    if (pendingConversationPartnerId) {
      pendingConversationPartnerId = null;
      updateInteriorInteractionPrompt();
    }
    const interior = currentExplorerInterior();
    if (interior && world.cancelResidentAction(interior.home.id, controlledResidentId)) {
      renderHome();
      updateExplorerContext();
      notice("Movement canceled the current activity");
    }
  }
  if (mode === "explore" && event.code === "KeyF" && !event.repeat) {
    event.preventDefault();
    toggleHomeInterior();
  }
  if (mode === "explore" && !explorerInteriorHomeId && event.code === "KeyT" && !event.repeat) {
    event.preventDefault();
    toggleTransitRide();
  }
  if (mode === "explore" && !explorerInteriorHomeId && event.code === "KeyE" && !event.repeat) {
    event.preventDefault();
    toggleExplorerVehicle();
  }
  if (mode === "explore" && !explorerInteriorHomeId && event.code === "KeyR" && !event.repeat) {
    event.preventDefault();
    if (event.shiftKey) {
      clearAccessibleRoute();
      updateExplorerContext();
      notice("Accessible route hidden");
    } else {
      toggleAccessibleRoute();
    }
  }
  if (mode === "explore" && explorerDriving && event.code === "KeyP" && !event.repeat) {
    event.preventDefault();
    parkExplorerVehicle();
  }
  if (mode === "explore" && !explorerInteriorHomeId && !explorerDriving && !transitRide && event.code === "Space") {
    event.preventDefault();
    if (explorerGrounded && !event.repeat) {
      explorerGrounded = false;
      explorerVerticalVelocity = 5.3;
    }
  }
  if (mode === "city" && event.code === "Backspace" && draft.length) {
    event.preventDefault();
    draft.pop();
    lastRoadSnap = null;
    renderDraft();
    updateRoadProfileSummary();
    updateRoadDrawingAidStatus();
    notice(draft.length ? `${draft.length} draft point${draft.length === 1 ? "" : "s"} remaining` : "Road draft cleared");
    return;
  }
  if (mode === "city" && event.code === "Escape" && draft.length) {
    event.preventDefault();
    draft = [];
    lastRoadSnap = null;
    renderDraft();
    updateRoadProfileSummary();
    updateRoadDrawingAidStatus();
    notice("Road draft canceled");
    return;
  }
  if (mode === "city" && event.code === "Enter" && draft.length > 1) {
    if (cityTool === "utility") {
      const kind = currentUtilityKind();
      world.addUtilityLine(kind, draft);
      notice(`${utilityName(kind)} connected`);
    } else if (cityTool === "road") {
      const road = currentRoadConfig();
      const impact = world.roadConstructionImpact(draft, road.profile, road.structure, road.elevationMeters);
      const cost = impact.cost;
      if (impact.status === "parcel-conflict") {
        notice(`Reroute around ${impact.parcelConflicts} parcel conflict${impact.parcelConflicts === 1 ? "" : "s"}`);
        return;
      }
      if (impact.status === "water-conflict") {
        notice("Surface roads cannot cross water · choose a bridge or tunnel");
        return;
      }
      if (!world.addRoad(draft, road.width, road.class, road.profile, road.structure, road.elevationMeters)) {
        notice(`The city needs $${cost.toLocaleString()} for this road`);
        return;
      }
      notice(`Road and parcels built · $${cost.toLocaleString()}`);
    } else {
      return;
    }
    draft = [];
    lastRoadSnap = null;
    renderDraft();
    updateRoadDrawingAidStatus();
    updateRoadProfileSummary();
    renderWorld();
  }
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyZ") {
    event.preventDefault();
    if (event.shiftKey) applyRedo();
    else applyUndo();
  }
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyY") {
    event.preventDefault();
    applyRedo();
  }
  if (event.code === "Escape" && mode === "explore" && photoMode) {
    event.preventDefault();
    setPhotoMode(false);
    return;
  }
  if (event.code === "Escape" && mode === "explore") setMode("city");
});
addEventListener("keyup", event => keys.delete(event.code));
addEventListener("blur", () => keys.clear());
document.querySelector("#help-open")!.addEventListener("click", () => {
  document.querySelector<HTMLElement>("#controls-guide")!.hidden = false;
  pauseForModal();
  document.querySelector<HTMLButtonElement>("#help-close")!.focus();
});
document.querySelector("#help-close")!.addEventListener("click", () => {
  document.querySelector<HTMLElement>("#controls-guide")!.hidden = true;
  resumeAfterModal();
  document.querySelector<HTMLButtonElement>("#help-open")!.focus();
});
document.querySelector("#controls-guide")!.addEventListener("click", event => {
  if (event.target !== event.currentTarget) return;
  document.querySelector<HTMLElement>("#controls-guide")!.hidden = true;
  resumeAfterModal();
});
document.querySelector("#settings-open")!.addEventListener("click", () => {
  applyUiPreferences();
  document.querySelector<HTMLElement>("#preferences-panel")!.hidden = false;
  pauseForModal();
  document.querySelector<HTMLButtonElement>("#settings-close")!.focus();
});
document.querySelector("#settings-close")!.addEventListener("click", () => {
  document.querySelector<HTMLElement>("#preferences-panel")!.hidden = true;
  resumeAfterModal();
  document.querySelector<HTMLButtonElement>("#settings-open")!.focus();
});
document.querySelector("#preferences-panel")!.addEventListener("click", event => {
  if (event.target !== event.currentTarget) return;
  document.querySelector<HTMLElement>("#preferences-panel")!.hidden = true;
  resumeAfterModal();
});
document.querySelector<HTMLInputElement>("#preference-reduced-motion")!.addEventListener("change", event => {
  uiPreferences.reducedMotion = (event.currentTarget as HTMLInputElement).checked;
  saveUiPreferences();
  renderWorld();
  notice(uiPreferences.reducedMotion ? "Reduced motion enabled" : "Full motion enabled");
});
document.querySelector<HTMLInputElement>("#preference-high-contrast")!.addEventListener("change", event => {
  uiPreferences.highContrast = (event.currentTarget as HTMLInputElement).checked;
  saveUiPreferences();
  notice(uiPreferences.highContrast ? "High contrast interface enabled" : "Standard contrast interface enabled");
});
document.querySelector<HTMLInputElement>("#preference-starter")!.addEventListener("change", event => {
  uiPreferences.showStarterJourney = (event.currentTarget as HTMLInputElement).checked;
  starterJourneyDismissed = !uiPreferences.showStarterJourney;
  saveUiPreferences();
  renderStarterJourney();
  notice(uiPreferences.showStarterJourney ? "Starter journey restored" : "Starter journey hidden");
});
document.querySelector("#activity-open")!.addEventListener("click", () => {
  unreadActivity = 0;
  renderActivityCenter();
  document.querySelector<HTMLElement>("#activity-center")!.hidden = false;
  document.querySelector<HTMLButtonElement>("#activity-close")!.focus();
});
document.querySelector("#activity-close")!.addEventListener("click", () => {
  document.querySelector<HTMLElement>("#activity-center")!.hidden = true;
  document.querySelector<HTMLButtonElement>("#activity-open")!.focus();
});
document.querySelector("#activity-clear")!.addEventListener("click", () => {
  activityLog = [];
  unreadActivity = 0;
  renderActivityCenter();
});
renderer.domElement.addEventListener("pointermove", event => {
  if (mode !== "home" || !selectedLot) return;
  pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const foundationHit = raycaster.intersectObjects(homeGroup.children, true).find(item => item.object.userData.homeSurface);
  const placementHit = foundationHit ?? raycaster.intersectObject(ground)[0];
  if (!placementHit) {
    homePreviewPoint = null;
  } else {
    const point = worldToLocal(placementHit.point, selectedLot);
    homePreviewPoint = Math.abs(point.x) <= selectedLot.width / 2 && Math.abs(point.z) <= selectedLot.depth / 2
      ? point
      : null;
  }
  renderDraft();
});
renderer.domElement.addEventListener("pointerleave", () => {
  if (mode !== "home") return;
  homePreviewPoint = null;
  renderDraft();
});
addEventListener("mousemove", event => {
  if (mode !== "explore" || explorerDriving || transitRide || document.pointerLockElement !== renderer.domElement) return;
  yaw -= event.movementX * .002;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * .002, -1.3, 1.3);
});

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode as Mode)));
document.querySelector("#starter-dismiss")!.addEventListener("click", () => {
  starterJourneyDismissed = true;
  uiPreferences.showStarterJourney = false;
  saveUiPreferences();
  renderStarterJourney();
  notice("Starter journey hidden. The field guide remains available from Help.");
});
document.querySelector("#starter-steps")!.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-starter-step]");
  if (!button || button.disabled) return;
  const step = button.dataset.starterStep;
  if (step === "zone") {
    setMode("city");
    setCityToolGroup("zone", true);
    notice("Choose a zone, then click a parcel");
  } else if (step === "service") {
    setMode("city");
    setCityToolGroup("services");
    document.querySelector<HTMLButtonElement>('[data-city-tool="service"]')!.click();
    notice("Choose an essential service, then place it near homes");
  } else if (step === "explore") {
    setMode("explore");
  } else if (step === "home") {
    setMode("home");
  }
});
function applyCityName() {
  const input = document.querySelector<HTMLInputElement>("#city-name-input")!;
  const previous = world.cityName;
  if (!world.setCityName(input.value)) {
    input.value = previous;
    notice("Use 2 to 40 letters, numbers, spaces, apostrophes, periods, or hyphens");
    return;
  }
  renderWorld();
  notice(previous === world.cityName ? `${world.cityName} already has that name` : `City renamed ${world.cityName}`);
}
document.querySelector("#rename-city")!.addEventListener("click", applyCityName);
document.querySelector("#city-name-input")!.addEventListener("keydown", event => {
  if ((event as KeyboardEvent).code !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  applyCityName();
});
function applyHomeName() {
  const home = currentHome();
  const input = document.querySelector<HTMLInputElement>("#home-name-input")!;
  if (!home) return;
  const previous = home.name;
  if (!world.setHomeName(home.id, input.value)) {
    input.value = previous;
    notice("Use 2 to 40 letters, numbers, spaces, apostrophes, periods, or hyphens");
    return;
  }
  renderWorld();
  if (mode === "home") document.querySelector("#panel-title")!.textContent = home.name;
  notice(previous === home.name ? `${home.name} already has that name` : `Home renamed ${home.name}`);
}
document.querySelector("#rename-home")!.addEventListener("click", applyHomeName);
document.querySelector("#home-name-input")!.addEventListener("keydown", event => {
  if ((event as KeyboardEvent).code !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  applyHomeName();
});
document.querySelector("#sound-toggle")!.addEventListener("click", async () => {
  if (soundscape.enabled) {
    soundscape.disable();
    syncSoundscape();
    notice("Ambient sound off");
    return;
  }
  await soundscape.enable();
  const profile = syncSoundscape();
  notice(`${profile.label} soundscape on`);
});
document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach(button => button.addEventListener("click", () => {
  simulationSpeed = Number(button.dataset.speed);
  if (simulationSpeed > 0) lastNonZeroSimulationSpeed = simulationSpeed;
  syncSimulationSpeedControls();
  notice(simulationSpeed === 0 ? "Simulation paused" : simulationSpeed >= 360 ? "Maximum simulation speed" : simulationSpeed >= 72 ? "Fast simulation speed" : "Simulation running");
}));

const cityToolGroupByTool: Record<CityTool, CityToolGroup> = {
  road: "build",
  inspect: "build",
  residential: "zone",
  commercial: "zone",
  mixed: "zone",
  industrial: "zone",
  civic: "zone",
  service: "services",
  utility: "services",
  access: "services",
  parking: "mobility",
  curb: "mobility",
  transit: "mobility",
  event: "events"
};

function setCityToolGroup(group: CityToolGroup, selectDefault = false) {
  cityToolGroup = group;
  document.querySelectorAll<HTMLButtonElement>("[data-city-tool-group]").forEach(button => {
    const active = button.dataset.cityToolGroup === group;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll<HTMLElement>("[data-city-group-panel]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.cityGroupPanel === group);
  });
  if (selectDefault && cityToolGroupByTool[cityTool] !== group) {
    document.querySelector<HTMLButtonElement>(`[data-city-group-panel="${group}"] [data-city-tool]`)?.click();
  }
}

document.querySelectorAll<HTMLButtonElement>("[data-city-tool-group]").forEach(button => button.addEventListener("click", () => {
  setCityToolGroup(button.dataset.cityToolGroup as CityToolGroup, true);
  if (button.dataset.cityToolGroup === "views") updateCityViewPanel();
  if (button.dataset.cityToolGroup === "economy") updateEconomyPanel();
}));

document.querySelector("#city-advisor")!.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-advisor-group]");
  if (!button) return;
  const group = button.dataset.advisorGroup as CityToolGroup;
  setCityToolGroup(group);
  if (button.dataset.advisorTool) {
    document.querySelector<HTMLButtonElement>(`[data-city-tool="${button.dataset.advisorTool}"]`)?.click();
  } else if (button.dataset.advisorView) {
    setCityToolGroup("views");
    document.querySelector<HTMLButtonElement>(`[data-city-view="${button.dataset.advisorView}"]`)?.click();
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-city-view]").forEach(button => button.addEventListener("click", () => {
  cityView = button.dataset.cityView as CityView;
  document.querySelectorAll<HTMLButtonElement>("[data-city-view]").forEach(item => item.classList.toggle("active", item === button));
  renderWorld();
  updateCityViewPanel();
  notice(`${button.textContent?.trim() ?? "City"} planning view active`);
}));

document.querySelector("#neighborhood-voices")!.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-voice-district]");
  if (!button || mode !== "city") return;
  const x = Number(button.dataset.voiceX);
  const z = Number(button.dataset.voiceZ);
  if (Number.isFinite(x) && Number.isFinite(z)) {
    orbit.target.set(x, 0, z);
    camera.position.set(x + 170, 210, z + 250);
    orbit.update();
  }
  const viewButton = document.querySelector<HTMLButtonElement>(`[data-city-view="${button.dataset.voiceView}"]`);
  viewButton?.click();
  notice(`Focused ${button.querySelector("b")?.textContent ?? "district"} resident feedback`);
});

document.querySelectorAll<HTMLButtonElement>("[data-city-tool]").forEach(button => button.addEventListener("click", () => {
  cityTool = button.dataset.cityTool as CityTool;
  setCityToolGroup(cityToolGroupByTool[cityTool]);
  document.querySelectorAll<HTMLElement>("[data-city-tool-settings]").forEach(settings => {
    settings.classList.toggle("active", settings.dataset.cityToolSettings === cityTool);
  });
  draft = [];
  lastRoadSnap = null;
  renderDraft();
  updateRoadDrawingAidStatus();
  document.querySelectorAll<HTMLButtonElement>("[data-city-tool]").forEach(item => item.classList.toggle("active", item === button));
  renderAccessibilityEntrances();
  renderTransitInfrastructure();
  updateCityToolPanel(cityTool === "inspect" ? selectedLot ?? undefined : undefined);
  notice(
    cityTool === "road"
      ? "Choose road points"
      : cityTool === "inspect"
        ? selectedLot ? "Selected parcel inspector opened" : "Choose a parcel to inspect"
        : cityTool === "service"
          ? "Choose a facility location"
          : cityTool === "utility"
            ? "Choose utility network points"
            : cityTool === "parking"
              ? `Place ${parkingKindLabel(currentParkingKind()).toLowerCase()}`
              : cityTool === "curb"
                ? "Choose a curb bay or road edge"
              : cityTool === "event"
                ? "Choose a street location for the event"
              : cityTool === "transit"
                ? "Select a line or click a road to create one"
              : cityTool === "access"
                ? "Choose an entrance to upgrade"
          : `Zoning brush: ${cityTool}`
  );
}));

document.querySelector("#zone-density")!.addEventListener("change", () => {
  if (cityTool === "residential" || cityTool === "commercial" || cityTool === "mixed" || cityTool === "industrial" || cityTool === "civic") {
    updateCityToolPanel();
    notice(`${currentZoneDensity()} intensity selected for the zoning brush`);
  }
});
document.querySelector("#road-class")!.addEventListener("change", () => {
  const roadClass = (document.querySelector("#road-class") as HTMLSelectElement).value as RoadClass;
  setRoadProfileControls(ROAD_PROFILE_PRESETS[roadClass], roadClass);
  updateCityToolPanel();
  notice(`${roadClass[0].toUpperCase()}${roadClass.slice(1)} preset loaded · customize any feature`);
});
document.querySelector("#road-target")!.addEventListener("change", () => {
  const targetId = (document.querySelector("#road-target") as HTMLSelectElement).value;
  const road = world.roads.find(candidate => candidate.id === targetId);
  document.querySelector<HTMLButtonElement>("#apply-road-profile")!.disabled = !road;
  if (road) {
    const structure = world.roadStructure(road);
    setRoadProfileControls(world.roadProfile(road), road.class ?? "street", structure.structure, structure.elevationMeters);
  }
  else {
    const roadClass = (document.querySelector("#road-class") as HTMLSelectElement).value as RoadClass;
    setRoadProfileControls(ROAD_PROFILE_PRESETS[roadClass], roadClass);
  }
  draft = [];
  lastRoadSnap = null;
  renderDraft();
  updateRoadDrawingAidStatus();
  updateCityToolPanel();
  notice(road ? `${road.name ?? "Road"} selected for retrofit` : "New road profile selected");
});
document.querySelectorAll<HTMLSelectElement>("#road-lanes, #road-speed, #road-sidewalk, #road-elevation").forEach(control => control.addEventListener("change", () => {
  renderDraft();
  updateRoadProfileSummary();
  updateCityToolPanel();
}));
document.querySelector("#road-structure")!.addEventListener("change", event => {
  const structure = (event.currentTarget as HTMLSelectElement).value as RoadStructure;
  syncRoadElevationOptions(structure);
  renderDraft();
  updateRoadProfileSummary();
  updateCityToolPanel();
  notice(structure === "bridge" ? "Bridge structure selected" : structure === "tunnel" ? "Tunnel structure selected" : "Surface road selected");
});
document.querySelectorAll<HTMLButtonElement>("[data-road-feature]").forEach(button => button.addEventListener("click", () => {
  const enabled = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(enabled));
  button.classList.toggle("active", enabled);
  renderDraft();
  updateRoadProfileSummary();
  updateCityToolPanel();
}));
document.querySelectorAll<HTMLButtonElement>("#road-snap-endpoints, #road-angle-lock, #road-tangent-guide, #road-parallel-guide").forEach(button => button.addEventListener("click", () => {
  const enabled = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(enabled));
  button.classList.toggle("active", enabled);
  updateRoadDrawingAidStatus();
  updateCityToolPanel();
  notice(button.id === "road-snap-endpoints"
    ? `Road endpoint snapping ${enabled ? "enabled" : "disabled"}`
    : button.id === "road-angle-lock"
      ? `15° angle locking ${enabled ? "enabled" : "disabled"}`
      : button.id === "road-tangent-guide"
        ? `Road tangent guides ${enabled ? "enabled" : "disabled"}`
        : `Road parallel guides ${enabled ? "enabled" : "disabled"}`);
}));
document.querySelector("#apply-road-profile")!.addEventListener("click", () => {
  const targetId = (document.querySelector("#road-target") as HTMLSelectElement).value;
  const road = currentRoadConfig();
  const result = world.updateRoadProfile(targetId, road.profile, road.class, road.structure, road.elevationMeters);
  if (!result.ok) {
    notice(result.reason);
    return;
  }
  explorerRoadKey = "";
  renderWorld();
  updateCityToolPanel();
  notice(`${result.reason} · $${result.cost.toLocaleString()}`);
});
document.querySelector("#service-kind")!.addEventListener("change", () => {
  if (cityTool === "service") updateCityToolPanel();
  const service = serviceDescription(currentServiceKind());
  notice(`${service.title} selected · ${service.radius}m coverage`);
});
document.querySelector("#utility-kind")!.addEventListener("change", () => {
  draft = [];
  lastRoadSnap = null;
  renderDraft();
  if (cityTool === "utility") updateCityToolPanel();
  const kind = currentUtilityKind();
  notice(`${utilityName(kind)} selected`);
});
document.querySelector("#parking-kind")!.addEventListener("change", () => {
  const rate = currentParkingKind() === "curb" ? 6 : currentParkingKind() === "surface" ? 2 : 4;
  (document.querySelector("#parking-price") as HTMLSelectElement).value = String(rate);
  if (cityTool === "parking") updateCityToolPanel();
  notice(`${parkingKindLabel(currentParkingKind())} selected · ${formatParkingRate(rate)}`);
});
document.querySelector("#parking-price")!.addEventListener("change", () => {
  if (cityTool === "parking") updateCityToolPanel();
  notice(`Parking price set to ${formatParkingRate(currentParkingRate())}`);
});
document.querySelector("#curb-use")!.addEventListener("change", () => {
  if (cityTool === "curb") {
    renderWorld();
    updateCityToolPanel();
  }
  notice(`${curbUseLabel(currentCurbUse())} selected`);
});
document.querySelector("#curb-schedule")!.addEventListener("change", () => {
  if (cityTool === "curb") {
    renderWorld();
    updateCityToolPanel();
  }
  notice(`Curb schedule set to ${curbScheduleLabel(currentCurbSchedule())}`);
});
document.querySelector("#event-kind")!.addEventListener("change", () => {
  if (cityTool === "event") {
    renderWorld();
    updateCityToolPanel();
  }
  notice(`${CITY_EVENT_DEFINITIONS[currentCityEventKind()].label} selected`);
});
document.querySelector("#event-timing")!.addEventListener("change", () => {
  if (cityTool === "event") updateCityToolPanel();
  notice(`Event timing set to ${cityEventTimingLabel(currentCityEventTiming())}`);
});
document.querySelector("#transit-frequency")!.addEventListener("change", () => {
  const line = selectedTransitLine();
  if (!line || !world.setTransitOperations(line.id, currentTransitHeadway(), currentTransitFare())) return;
  renderWorld();
  notice(`${line.name} now runs every ${line.headwayMinutes} minutes with ${transitFleetSize(line)} buses`);
});
document.querySelector("#transit-fare")!.addEventListener("change", () => {
  const line = selectedTransitLine();
  if (!line || !world.setTransitOperations(line.id, currentTransitHeadway(), currentTransitFare())) return;
  renderWorld();
  notice(`${line.name} fare set to ${formatTransitFare(line.fare)}`);
});
document.querySelector("#transit-line")!.addEventListener("change", event => {
  selectedTransitLineId = (event.currentTarget as HTMLSelectElement).value;
  const line = selectedTransitLine();
  syncTransitControls();
  renderTransitInfrastructure();
  if (cityTool === "transit") updateCityToolPanel();
  if (line) notice(`${line.name} selected`);
});
function applyTransitLineName() {
  const line = selectedTransitLine();
  const input = document.querySelector<HTMLInputElement>("#transit-name")!;
  if (!line) return;
  const previousName = line.name;
  if (!world.setTransitLineName(line.id, input.value)) {
    input.value = previousName;
    notice("Use a unique line name up to 32 letters, numbers, spaces, or simple punctuation");
    return;
  }
  renderWorld();
  updateCityToolPanel();
  notice(`${previousName} renamed ${line.name}`);
}
document.querySelector("#transit-rename")!.addEventListener("click", applyTransitLineName);
document.querySelector("#transit-name")!.addEventListener("keydown", event => {
  if ((event as KeyboardEvent).code !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  applyTransitLineName();
});
document.querySelector("#transit-stops")!.addEventListener("change", event => {
  const line = selectedTransitLine();
  const count = Number((event.currentTarget as HTMLSelectElement).value);
  if (!line || !world.setTransitStopCount(line.id, count)) return;
  renderWorld();
  notice(`${line.name} now serves ${line.stops.length} stops`);
});
document.querySelector("#transit-remove")!.addEventListener("click", () => {
  const line = selectedTransitLine();
  if (!line || !world.removeTransitLine(line.id)) {
    notice("At least one transit line must remain");
    return;
  }
  selectedTransitLineId = world.transitLines[0]?.id ?? null;
  renderWorld();
  notice(`${line.name} removed from the network`);
});
document.querySelector("#staffing-policy")!.addEventListener("change", event => {
  const funding = Number((event.currentTarget as HTMLSelectElement).value);
  if (!world.setServiceFunding(funding)) return;
  renderWorld();
  notice(`Service staffing set to ${Math.round(funding * 100)}%`);
});
document.querySelectorAll<HTMLSelectElement>("#tax-residential, #tax-commercial, #tax-industrial").forEach(control => control.addEventListener("change", event => {
  const category = (event.currentTarget as HTMLSelectElement).id.replace("tax-", "") as TaxCategory;
  const rate = Number((event.currentTarget as HTMLSelectElement).value);
  if (!world.setTaxRate(category, rate)) return;
  renderWorld();
  updateEconomyPanel();
  notice(`${category[0].toUpperCase()}${category.slice(1)} tax set to ${rate}%`);
}));
document.querySelectorAll<HTMLSelectElement>("#district-policy-area, #district-policy-kind").forEach(control => control.addEventListener("change", () => {
  syncEconomyControls();
  updateEconomyPanel();
}));
document.querySelector("#district-policy-toggle")!.addEventListener("click", () => {
  const areaId = currentPolicyDistrictId();
  const policy = currentDistrictPolicy();
  const enabled = Boolean(world.districtPolicies[areaId]?.includes(policy));
  if (!world.setDistrictPolicy(areaId, policy, !enabled)) return;
  renderWorld();
  updateEconomyPanel();
  const district = world.areas.find(area => area.id === areaId);
  notice(`${DISTRICT_POLICY_DEFINITIONS[policy].label} ${enabled ? "disabled" : "enabled"} in ${district?.name ?? "district"}`);
});
document.querySelector("#issue-bond")!.addEventListener("click", () => {
  const amount = Number((document.querySelector("#municipal-bond") as HTMLSelectElement).value);
  const bond = world.issueMunicipalBond(amount);
  if (!bond) {
    notice("The city can carry up to three active municipal bonds");
    return;
  }
  renderWorld();
  updateEconomyPanel();
  notice(`$${(amount / 1_000_000).toFixed(0)}m bond issued · $${bond.monthlyPayment.toLocaleString()}/mo for 10 years`);
});
document.querySelector("#repay-bond")!.addEventListener("click", () => {
  if (!world.repayMunicipalDebt(1_000_000)) {
    notice("The city needs active debt and $1m cash for an extra repayment");
    return;
  }
  renderWorld();
  updateEconomyPanel();
  notice("$1m extra debt repayment posted");
});
function activateHomeTool(next: HomeTool) {
  homeTool = next;
  homeDraft = null;
  movingFurnitureId = null;
  if (homeTool !== "select") selectedFurnitureId = null;
  if (homeTool !== "select") selectedRoomId = null;
  if (homeTool !== "select") selectedHomeWindowId = null;
  if (homeTool !== "select") selectedHomeDoorId = null;
  renderDraft();
  renderHome();
  document.querySelectorAll<HTMLButtonElement>("[data-home-tool]").forEach(item => item.classList.toggle("active", item.dataset.homeTool === homeTool));
  document.querySelector("#place-catalog-item")!.classList.toggle("active", isHomeFurnitureKind(homeTool));
  notice(homeTool === "room"
    ? "Click two corners to draw a room"
    : homeTool === "stairs"
      ? `Place stairs in overlapping rooms on Floor ${homeFloor + 1} and Floor ${homeFloor + 2}`
    : homeTool === "window"
      ? "Move along an exterior wall, then click to place a window"
    : homeTool === "door"
      ? "Move along a shared wall, then click to place a doorway"
    : homeTool === "select"
      ? "Inspect mode"
      : `Click inside the home to place a ${homeFurnitureLabel(homeTool)}`);
}

document.querySelectorAll<HTMLButtonElement>("[data-home-tool]").forEach(button => button.addEventListener("click", () => {
  activateHomeTool(button.dataset.homeTool as HomeTool);
}));
document.querySelector("#home-floor")!.addEventListener("change", event => {
  const home = currentHome();
  if (!home) return;
  homeFloor = Math.max(0, Math.min(home.floors - 1, Number((event.currentTarget as HTMLSelectElement).value)));
  selectedFurnitureId = null;
  selectedRoomId = null;
  selectedHomeWindowId = null;
  selectedHomeDoorId = null;
  movingFurnitureId = null;
  homeDraft = null;
  renderHome();
  renderDraft();
  notice(`Editing Floor ${homeFloor + 1} of ${home.floors}`);
});
document.querySelector("#add-home-floor")!.addEventListener("click", () => {
  const home = currentHome();
  if (!home || !world.addHomeFloor(home.id)) {
    notice(home && home.floors >= MAX_HOME_FLOORS
      ? `Homes support up to ${MAX_HOME_FLOORS} floors`
      : `${formatHomeCurrency(HOME_BUILD_COSTS.floorShell)} needed for a new floor shell`);
    return;
  }
  homeFloor = home.floors - 1;
  activateHomeTool("room");
  renderWorld();
  notice(`Floor ${homeFloor + 1} added. Draw its first room, then connect stairs below.`);
});
document.querySelector("#remove-home-floor")!.addEventListener("click", () => {
  const home = currentHome();
  if (!home || !world.removeTopHomeFloor(home.id)) {
    notice("A home must keep its ground floor");
    return;
  }
  homeFloor = Math.min(homeFloor, home.floors - 1);
  selectedFurnitureId = null;
  selectedRoomId = null;
  selectedHomeWindowId = null;
  selectedHomeDoorId = null;
  activateHomeTool("select");
  renderWorld();
  notice(`Top floor removed. This home now has ${home.floors} floor${home.floors === 1 ? "" : "s"}.`);
});
document.querySelector("#home-catalog")!.addEventListener("change", event => {
  const kind = (event.currentTarget as HTMLSelectElement).value as HomeFurnitureKind;
  document.querySelector("#place-catalog-item")!.textContent = `Place ${homeFurnitureLabel(kind)}`;
  if (isHomeFurnitureKind(homeTool)) activateHomeTool(kind);
});
document.querySelector("#place-catalog-item")!.addEventListener("click", () => {
  const kind = (document.querySelector("#home-catalog") as HTMLSelectElement).value as HomeFurnitureKind;
  activateHomeTool(kind);
});
document.querySelector("#home-window-glazing")!.addEventListener("change", event => {
  const glazing = (event.currentTarget as HTMLSelectElement).value as HomeWindowGlazing;
  const button = document.querySelector<HTMLButtonElement>('[data-home-tool="window"]')!;
  button.textContent = `Place ${glazing === "privacy" ? "privacy " : ""}window · ${formatHomeCurrency(world.homeWindowCost(glazing))}`;
  renderDraft();
  if (homeTool === "window") notice(`${glazing === "privacy" ? "Privacy glass softens daylight and blocks direct views" : "Clear glass maximizes daylight"}`);
});
document.querySelector("#remove-home-window")!.addEventListener("click", () => {
  const home = currentHome();
  const window = home?.windows?.find(candidate => candidate.id === selectedHomeWindowId);
  if (!home || !window || !world.removeHomeWindow(home.id, window.id)) return;
  const refund = world.homeWindowCost(window.glazing) * .5;
  selectedHomeWindowId = null;
  renderWorld();
  notice(`Window removed · ${formatHomeCurrency(refund)} returned · home daylight ${world.homeDaylight(home)}%`);
});
document.querySelector("#home-door-width")!.addEventListener("change", event => {
  const widthKind = (event.currentTarget as HTMLSelectElement).value as HomeDoorWidth;
  const button = document.querySelector<HTMLButtonElement>('[data-home-tool="door"]')!;
  button.textContent = `Place ${widthKind === "wide" ? "wide " : ""}doorway · ${formatHomeCurrency(world.homeDoorCost(widthKind))}`;
  renderDraft();
  if (homeTool === "door") notice(widthKind === "wide" ? "Wide access supports more comfortable circulation" : "Standard doorway selected");
});
document.querySelector("#remove-home-door")!.addEventListener("click", () => {
  const home = currentHome();
  const door = home?.doors?.find(candidate => candidate.id === selectedHomeDoorId);
  if (!home || !door || !world.removeHomeDoor(home.id, door.id)) return;
  const refund = world.homeDoorCost(door.widthKind) * .5;
  selectedHomeDoorId = null;
  renderWorld();
  notice(`Doorway removed · ${formatHomeCurrency(refund)} returned. Room traversal updates immediately.`);
});
document.querySelector("#home-roof-style")!.addEventListener("change", event => {
  const style = (event.currentTarget as HTMLSelectElement).value as HomeRoofStyle;
  document.querySelector<HTMLButtonElement>("#apply-home-roof")!.textContent = `Apply ${style} roof · ${formatHomeCurrency(world.homeRoofCost(style))}`;
});
document.querySelector("#apply-home-roof")!.addEventListener("click", () => {
  const home = currentHome();
  const style = (document.querySelector("#home-roof-style") as HTMLSelectElement).value as HomeRoofStyle;
  const color = (document.querySelector("#home-roof-color") as HTMLInputElement).value;
  const cost = world.homeRoofCost(style);
  if (!home || !world.setHomeRoof(home.id, style, color)) {
    notice(home && world.homeRemainingBudget(home) < cost
      ? `${formatHomeCurrency(cost)} needed. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains`
      : "Choose a different roof style or color before applying");
    return;
  }
  renderWorld();
  notice(`${style === "green" ? "Planted" : `${style[0].toUpperCase()}${style.slice(1)}`} roof applied for ${formatHomeCurrency(cost)}`);
});
document.querySelector("#home-foundation-style")!.addEventListener("change", event => {
  const style = (event.currentTarget as HTMLSelectElement).value as HomeFoundationStyle;
  document.querySelector<HTMLButtonElement>("#apply-home-foundation")!.textContent = `Apply ${style} · ${formatHomeCurrency(world.homeFoundationCost(style))}`;
});
document.querySelector("#apply-home-foundation")!.addEventListener("click", () => {
  const home = currentHome();
  const style = (document.querySelector("#home-foundation-style") as HTMLSelectElement).value as HomeFoundationStyle;
  const cost = world.homeFoundationCost(style);
  if (!home || !world.setHomeFoundation(home.id, style)) {
    notice(home && world.homeRemainingBudget(home) < cost
      ? `${formatHomeCurrency(cost)} needed. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains`
      : "Choose a different foundation before applying");
    return;
  }
  renderWorld();
  const performance = world.homeFoundationPerformance(home);
  notice(`${style[0].toUpperCase()}${style.slice(1)} foundation applied for ${formatHomeCurrency(cost)} · ${performance.residualExposure}% residual flood exposure`);
});
document.querySelector("#move-furniture")!.addEventListener("click", () => {
  const home = currentHome();
  const item = home?.furniture.find(candidate => candidate.id === selectedFurnitureId);
  if (!home || !item) return;
  movingFurnitureId = movingFurnitureId === item.id ? null : item.id;
  renderHome();
  renderDraft();
  notice(movingFurnitureId ? `Choose a new position for the ${item.kind}` : "Furniture move cancelled");
});
document.querySelector("#rotate-furniture")!.addEventListener("click", () => {
  const home = currentHome();
  if (!home || !selectedFurnitureId) return;
  if (!world.rotateFurniture(home.id, selectedFurnitureId)) {
    notice("Rotation blocked by a wall or another furnishing");
    return;
  }
  renderWorld();
  notice("Furniture rotated 45°");
});
document.querySelector("#furniture-style")!.addEventListener("change", event => {
  const home = currentHome();
  const item = home?.furniture.find(candidate => candidate.id === selectedFurnitureId);
  const style = (event.currentTarget as HTMLSelectElement).value as HomeFurnitureStyle;
  if (!home || !item || !world.setFurnitureStyle(home.id, item.id, style)) return;
  renderWorld();
  notice(`${homeFurnitureLabel(item.kind)} style changed to ${style}`);
});
document.querySelector("#furniture-variant")!.addEventListener("change", event => {
  const home = currentHome();
  const item = home?.furniture.find(candidate => candidate.id === selectedFurnitureId);
  const variant = (event.currentTarget as HTMLSelectElement).value as HomeFurnitureVariant;
  if (!home || !item || !HOME_FURNITURE_VARIANTS.includes(variant) || !world.setFurnitureVariant(home.id, item.id, variant)) return;
  renderWorld();
  notice(`${homeFurnitureLabel(item.kind)} design changed to ${variant === "soft" ? "soft edge" : variant}`);
});
document.querySelector("#furniture-tint")!.addEventListener("change", event => {
  const home = currentHome();
  const item = home?.furniture.find(candidate => candidate.id === selectedFurnitureId);
  const tint = (event.currentTarget as HTMLInputElement).value;
  if (!home || !item || !world.setFurnitureTint(home.id, item.id, tint)) return;
  renderWorld();
  notice(`${homeFurnitureLabel(item.kind)} color changed to ${tint.toUpperCase()}`);
});
document.querySelector("#furniture-owner")!.addEventListener("change", event => {
  const home = currentHome();
  const item = home?.furniture.find(candidate => candidate.id === selectedFurnitureId);
  const residentId = (event.currentTarget as HTMLSelectElement).value || undefined;
  if (!home || !item || !world.setFurnitureOwner(home.id, item.id, residentId)) return;
  renderWorld();
  const owner = residentId ? home.residents.find(resident => resident.id === residentId) : undefined;
  notice(`${homeFurnitureLabel(item.kind)} is now ${owner ? `owned by ${owner.name}` : "shared by the household"}`);
});
document.querySelector("#sell-furniture")!.addEventListener("click", () => {
  const home = currentHome();
  const item = home?.furniture.find(candidate => candidate.id === selectedFurnitureId);
  if (!home || !item || !world.removeFurniture(home.id, item.id)) return;
  const refund = HOME_BUILD_COSTS[item.kind] * .5;
  selectedFurnitureId = null;
  movingFurnitureId = null;
  renderWorld();
  notice(`${item.kind[0].toUpperCase()}${item.kind.slice(1)} sold for ${formatHomeCurrency(refund)}`);
});
document.querySelector("#repair-furniture")!.addEventListener("click", () => {
  const home = currentHome();
  const item = home?.furniture.find(candidate => candidate.id === selectedFurnitureId);
  if (!home || !item) return;
  const result = world.repairFurniture(home.id, item.id);
  if (!result.ok) {
    renderHome();
    notice(result.reason);
    return;
  }
  renderWorld();
  notice(`${homeFurnitureLabel(item.kind)} repaired for ${formatHomeCurrency(result.cost)}`);
});
document.querySelector("#room-kind")!.addEventListener("change", event => {
  const home = currentHome();
  const room = home?.rooms.find(item => item.id === selectedRoomId);
  const kind = (event.currentTarget as HTMLSelectElement).value as HomeRoomKind;
  if (!home || !room || !world.setRoomKind(home.id, room.id, kind)) return;
  renderWorld();
  notice(`Room purpose changed to ${kind}`);
});
document.querySelector("#assign-room-resident")!.addEventListener("click", () => {
  const home = currentHome();
  const room = home?.rooms.find(item => item.id === selectedRoomId);
  const residentId = (document.querySelector("#room-resident-claim") as HTMLSelectElement).value;
  if (!home || !room) return;
  if (!residentId) {
    if (!world.clearRoomAssignments(home.id, room.id)) return;
    renderWorld();
    notice(`${room.kind} claims cleared · household privacy ${world.homePrivacy(home)}%`);
    return;
  }
  const resident = home.residents.find(item => item.id === residentId);
  if (!resident || !world.assignResidentRoom(home.id, room.id, residentId)) {
    notice("This room needs an available bed before another resident can claim it");
    return;
  }
  renderWorld();
  notice(`${resident.name} claimed this ${room.kind.toLowerCase()} · household privacy ${world.homePrivacy(home)}%`);
});
document.querySelector("#room-floor-finish")!.addEventListener("change", event => {
  const home = currentHome();
  const room = home?.rooms.find(item => item.id === selectedRoomId);
  const finish = (event.currentTarget as HTMLSelectElement).value as HomeFloorFinish;
  if (!home || !room) return;
  const cost = Math.round(room.width * room.depth * HOME_FINISH_COSTS.floor[finish]);
  if (!world.setRoomFloorFinish(home.id, room.id, finish)) {
    renderHome();
    notice(world.homeRemainingBudget(home) < cost
      ? `${formatHomeCurrency(cost)} needed for that floor. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains`
      : "That floor finish is already applied");
    return;
  }
  renderWorld();
  notice(`${room.kind} floor updated for ${formatHomeCurrency(cost)}`);
});
document.querySelector("#room-wall-finish")!.addEventListener("change", event => {
  const home = currentHome();
  const room = home?.rooms.find(item => item.id === selectedRoomId);
  const finish = (event.currentTarget as HTMLSelectElement).value as HomeWallFinish;
  if (!home || !room) return;
  const cost = Math.round((room.width + room.depth) * 2 * 2.8 * HOME_FINISH_COSTS.wall[finish]);
  if (!world.setRoomWallFinish(home.id, room.id, finish)) {
    renderHome();
    notice(world.homeRemainingBudget(home) < cost
      ? `${formatHomeCurrency(cost)} needed for those walls. ${formatHomeCurrency(world.homeRemainingBudget(home))} remains`
      : "That wall finish is already applied");
    return;
  }
  renderWorld();
  notice(`${room.kind} walls updated for ${formatHomeCurrency(cost)}`);
});
document.querySelector("#renovate-room")!.addEventListener("click", () => {
  const home = currentHome();
  const room = home?.rooms.find(item => item.id === selectedRoomId);
  if (!home || !room) return;
  const result = world.renovateRoom(home.id, room.id);
  if (!result.ok) {
    renderHome();
    notice(result.reason);
    return;
  }
  renderWorld();
  notice(`${room.kind} renovated for ${formatHomeCurrency(result.cost)}`);
});
document.querySelector("#furnish-room")!.addEventListener("click", () => {
  const home = currentHome();
  const room = home?.rooms.find(item => item.id === selectedRoomId);
  if (!home || !room) return;
  const result = world.autoFurnishRoom(home.id, room.id);
  renderWorld();
  notice(result.placed
    ? `${room.kind} furnished with ${result.placed} object${result.placed === 1 ? "" : "s"} for ${formatHomeCurrency(result.spent)}${result.skipped ? ` · ${result.skipped} could not fit` : ""}`
    : `No new ${room.kind.toLowerCase()} objects fit the room and remaining budget`);
});
document.querySelector("#delete-room")!.addEventListener("click", () => {
  const home = currentHome();
  const room = home?.rooms.find(item => item.id === selectedRoomId);
  if (!home || !room) return;
  if (!world.removeRoom(home.id, room.id)) {
    notice("Each built floor must keep at least one room. Remove the top floor instead.");
    return;
  }
  selectedRoomId = null;
  selectedFurnitureId = null;
  selectedHomeWindowId = null;
  selectedHomeDoorId = null;
  movingFurnitureId = null;
  renderWorld();
  notice(`${room.kind} removed. Exclusive furnishings were sold automatically.`);
});
document.querySelector("#add-resident")!.addEventListener("click", openResidentCreator);
document.querySelector("#auto-assign-rooms")!.addEventListener("click", () => {
  const home = currentHome();
  if (!home) return;
  const result = world.autoAssignResidentRooms(home.id);
  if (!result.assigned) {
    notice("Add beds to Bedroom, Nursery, or Studio rooms before smart assignment");
    return;
  }
  renderWorld();
  notice(`${result.assigned} resident${result.assigned === 1 ? "" : "s"} matched to personal rooms · ${result.unassigned} unassigned · ${result.privacy}% privacy`);
});
document.querySelector("#resident-creator-close")!.addEventListener("click", closeResidentCreator);
document.querySelector("#resident-creator-cancel")!.addEventListener("click", closeResidentCreator);
document.querySelector("#resident-creator")!.addEventListener("click", event => {
  if (event.target === event.currentTarget) closeResidentCreator();
});
document.querySelector("#resident-name")!.addEventListener("input", updateResidentCreatorPreview);
document.querySelector("#resident-age")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-role")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-career-track")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-aspiration")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-decor-preference")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-favorite-pastime")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-outfit-style")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-outfit-palette")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-routine-profile")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-caregiver-a")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-caregiver-b")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelector("#resident-inherit-personality")!.addEventListener("change", updateResidentCreatorPreview);
document.querySelectorAll<HTMLInputElement>("[data-personality-axis]").forEach(input => input.addEventListener("input", updateResidentCreatorPreview));
document.querySelectorAll<HTMLInputElement>(".resident-trait-picker input").forEach(input => input.addEventListener("change", () => {
  const traits = selectedCreatorTraits();
  if (traits.length > 2) {
    input.checked = false;
    notice("Choose exactly two personality traits");
  }
  updateResidentCreatorPreview();
}));
document.querySelector("#resident-creator-form")!.addEventListener("submit", event => {
  event.preventDefault();
  const home = currentHome();
  if (!home) return;
  const name = document.querySelector<HTMLInputElement>("#resident-name")!.value.trim();
  const lifeStage = document.querySelector<HTMLSelectElement>("#resident-age")!.value as ResidentLifeStage;
  const age = ["infant", "toddler", "child", "teen"].includes(lifeStage) ? "child" as const : "adult" as const;
  const role = document.querySelector<HTMLSelectElement>("#resident-role")!.value as ResidentRole;
  const careerTrack = document.querySelector<HTMLSelectElement>("#resident-career-track")!.value as ResidentCareerTrack;
  const aspiration = document.querySelector<HTMLSelectElement>("#resident-aspiration")!.value as ResidentAspiration;
  const decorPreference = document.querySelector<HTMLSelectElement>("#resident-decor-preference")!.value as HomeFurnitureStyle;
  const favoritePastime = document.querySelector<HTMLSelectElement>("#resident-favorite-pastime")!.value as ResidentPastime;
  const outfitStyle = document.querySelector<HTMLSelectElement>("#resident-outfit-style")!.value as ResidentOutfitStyle;
  const outfitPalette = document.querySelector<HTMLSelectElement>("#resident-outfit-palette")!.value as ResidentOutfitPalette;
  const routineProfile = document.querySelector<HTMLSelectElement>("#resident-routine-profile")!.value as ResidentRoutineProfile;
  const caregiverIds = [...new Set([
    document.querySelector<HTMLSelectElement>("#resident-caregiver-a")!.value,
    document.querySelector<HTMLSelectElement>("#resident-caregiver-b")!.value
  ].filter(Boolean))];
  const inheritPersonality = document.querySelector<HTMLInputElement>("#resident-inherit-personality")!.checked && caregiverIds.length > 0;
  const traits = selectedCreatorTraits();
  const personality = inheritPersonality ? undefined : creatorPersonality();
  if (traits.length !== 2) {
    notice("Choose exactly two personality traits");
    return;
  }
  if (!world.addResident(home.id, { name, age, lifeStage, role, traits, personality, careerTrack, aspiration, caregiverIds, inheritPersonality, decorPreference, favoritePastime, outfitStyle, outfitPalette, routineProfile })) {
    notice("Use a unique name with letters, numbers, spaces, apostrophes, periods, or hyphens");
    return;
  }
  closeResidentCreator();
  renderWorld();
  const lifeStageLabel = RESIDENT_LIFE_STAGE_DEFINITIONS[lifeStage].label.toLowerCase();
  const article = /^[aeiou]/.test(lifeStageLabel) ? "an" : "a";
  notice(`${name.trim()} joined the household as ${article} ${lifeStageLabel}`);
});
function updateHistoryControls() {
  document.querySelector<HTMLButtonElement>("#undo")!.disabled = !world.canUndo();
  document.querySelector<HTMLButtonElement>("#redo")!.disabled = !world.canRedo();
}
function updateSaveStatus(text: string, state: "idle" | "pending" | "saved") {
  const status = document.querySelector<HTMLElement>("#save-status")!;
  status.textContent = text;
  status.dataset.state = state;
}
function saveStatusTime() {
  const hour = Math.floor(world.clock.minute / 60);
  const minute = Math.floor(world.clock.minute % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function scheduleAutosave(force = false) {
  if (!force && world.changeRevision() === lastAutosaveRevision) return;
  clearTimeout(autosaveTimer);
  updateSaveStatus("Recovery pending", "pending");
  autosaveTimer = window.setTimeout(() => {
    world.saveAutosave();
    lastAutosaveRevision = world.changeRevision();
    const recover = document.querySelector<HTMLButtonElement>("#recover-autosave")!;
    recover.disabled = false;
    const recoveryHour = Math.floor(world.clock.minute / 60);
    const recoveryMinute = Math.floor(world.clock.minute % 60);
    recover.title = `Latest recovery: Y${world.clock.year} M${world.clock.month} D${world.clock.day} ${String(recoveryHour).padStart(2, "0")}:${String(recoveryMinute).padStart(2, "0")}`;
    updateSaveStatus(`Recovery protected · ${saveStatusTime()}`, "saved");
  }, 700);
}
function applyUndo() {
  if (!world.undo()) return;
  pendingTemplateId = world.templateId;
  renderWorld();
  notice("Change undone");
}
function applyRedo() {
  if (!world.redo()) return;
  pendingTemplateId = world.templateId;
  renderWorld();
  notice("Change restored");
}
document.querySelector("#undo")!.addEventListener("click", applyUndo);
document.querySelector("#redo")!.addEventListener("click", applyRedo);
document.querySelector("#save")!.addEventListener("click", () => {
  world.save();
  updateSaveStatus(`Manual save · ${saveStatusTime()}`, "saved");
  notice("Manual save updated");
});
document.querySelector("#load")!.addEventListener("click", () => {
  const loaded = world.load();
  if (loaded) pendingTemplateId = world.templateId;
  notice(loaded ? "Saved city loaded" : "No saved city found");
  renderWorld();
  updateSaveStatus(loaded ? `Manual save loaded · ${saveStatusTime()}` : "No manual save found", loaded ? "saved" : "idle");
});
document.querySelector("#recover-autosave")!.addEventListener("click", () => {
  const recovered = world.loadAutosave();
  if (recovered) pendingTemplateId = world.templateId;
  notice(recovered ? "Autosave recovered. Undo returns to the previous state." : "No autosave found");
  renderWorld();
  updateSaveStatus(recovered ? `Recovery loaded · ${saveStatusTime()}` : "No recovery found", recovered ? "saved" : "idle");
});
document.querySelector<HTMLButtonElement>("#recover-autosave")!.disabled = !world.hasAutosave();
if (world.hasAutosave()) updateSaveStatus("Recovery available", "saved");
addEventListener("beforeunload", () => world.saveAutosave());
let templateResetArmed = false;
let templateResetTimer = 0;
document.querySelector("#template-select")!.addEventListener("change", event => {
  const value = (event.currentTarget as HTMLSelectElement).value as keyof typeof WORLD_TEMPLATES;
  pendingTemplateId = value;
  document.querySelector("#region-foundation-summary")!.textContent = WORLD_TEMPLATES[value].description;
});
document.querySelector("#apply-template")!.addEventListener("click", event => {
  const button = event.currentTarget as HTMLButtonElement;
  if (!templateResetArmed) {
    templateResetArmed = true;
    button.textContent = "Confirm new region";
    notice("Click confirm to replace the unsaved world");
    clearTimeout(templateResetTimer);
    templateResetTimer = window.setTimeout(() => {
      templateResetArmed = false;
      button.textContent = "Start new region";
    }, 5000);
    return;
  }
  templateResetArmed = false;
  clearTimeout(templateResetTimer);
  button.textContent = "Start new region";
  const value = pendingTemplateId;
  if (!world.applyTemplate(value)) return;
  selectedLot = null;
  renderWorld();
  setMode("city");
  notice(value === "blank" ? "Blank region loaded" : `${WORLD_TEMPLATES[value].name} loaded. Every road remains editable.`);
});

const clock = new THREE.Clock();

function animateWeather(dt: number, weather: WeatherState) {
  const scale = mode === "city" ? 4.6 : mode === "home" || explorerInteriorHomeId ? .48 : 1;
  rainField.scale.setScalar(scale);
  snowField.scale.setScalar(scale);
  rainField.position.copy(camera.position);
  snowField.position.copy(camera.position);
  if (rainField.visible) {
    const fall = dt * (42 + weather.precipitation * 34) / scale;
    for (let index = 0; index < rainParticleCount; index++) {
      const offset = index * 6;
      rainPositions[offset + 1] -= fall;
      rainPositions[offset + 4] -= fall;
      if (rainPositions[offset + 4] < -76) {
        rainPositions[offset + 1] += 156;
        rainPositions[offset + 4] += 156;
      }
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }
  if (snowField.visible) {
    const fall = dt * 9 / scale;
    for (let index = 0; index < snowParticleCount; index++) {
      const offset = index * 3;
      snowPositions[offset] += Math.sin(world.clock.elapsedMinutes * .015 + index) * dt * .7;
      snowPositions[offset + 1] -= fall;
      if (snowPositions[offset + 1] < -76) snowPositions[offset + 1] += 156;
    }
    snowGeometry.attributes.position.needsUpdate = true;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  animateWeather(dt, world.weather());
  if (simulationSpeed > 0) {
    simulationAccumulator += dt * simulationSpeed;
    const elapsedMinutes = Math.floor(simulationAccumulator);
    if (elapsedMinutes > 0) {
      simulationAccumulator -= elapsedMinutes;
      const previousHour = Math.floor(world.clock.elapsedMinutes / 60);
      const previousDate = `${world.clock.year}-${world.clock.month}-${world.clock.day}`;
      const monthChanged = world.advanceMinutes(elapsedMinutes, lastMonthlyBalance);
      const currentHour = Math.floor(world.clock.elapsedMinutes / 60);
      const dayChanged = previousDate !== `${world.clock.year}-${world.clock.month}-${world.clock.day}`;
      if (dayChanged || currentHour !== previousHour) renderWorld();
      else updateClockDisplay();
      if (dayChanged) scheduleAutosave(true);
      if (monthChanged) {
        updateCityStats();
        notice("Monthly budget posted to the treasury");
      } else if (dayChanged) {
        const activity = world.lastDailyActivity;
        notice(`Daily city update · ${activity.households >= 0 ? "+" : ""}${activity.households} households · ${activity.businesses >= 0 ? "+" : ""}${activity.businesses} businesses`);
      }
    }
  }
  updateTransitVehicle(dt);
  soundscapeSyncAccumulator += dt;
  if (soundscape.enabled && soundscapeSyncAccumulator >= .25) {
    soundscapeSyncAccumulator = 0;
    syncSoundscape();
  }
  spatialStreamSyncAccumulator += dt;
  if (spatialStreamSyncAccumulator >= .4) {
    spatialStreamSyncAccumulator = 0;
    if (spatialTierSignature(worldRenderFocus()) !== renderedSpatialTierSignature) renderWorld();
  }
  if (mode === "explore") {
    if (transitRide) {
      updateExplorerMovementStatus(12);
    } else if (explorerDriving) {
      updateExplorerVehicle(dt);
    } else {
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const desired = new THREE.Vector3();
      if (keys.has("KeyW")) desired.add(forward);
      if (keys.has("KeyS")) desired.sub(forward);
      if (keys.has("KeyD")) desired.add(right);
      if (keys.has("KeyA")) desired.sub(right);
      const hasInput = desired.lengthSq() > 0;
      const sprinting = hasInput && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
      if (hasInput) desired.normalize().multiplyScalar(sprinting ? 8.6 : 4.9);
      explorerVelocity.x = THREE.MathUtils.damp(explorerVelocity.x, desired.x, hasInput ? 9 : 13, dt);
      explorerVelocity.z = THREE.MathUtils.damp(explorerVelocity.z, desired.z, hasInput ? 9 : 13, dt);

      const current = { x: camera.position.x, z: camera.position.z };
      const candidate = {
        x: current.x + explorerVelocity.x * dt,
        z: current.z + explorerVelocity.z * dt
      };
      const interior = currentExplorerInterior();
      const movement = interior
        ? (() => {
            const currentLocal = worldToLotLocal(current, interior.lot);
            const candidateLocal = worldToLotLocal(candidate, interior.lot);
            const resolved = resolveInteriorMovement(homeFloorView(interior.home, explorerInteriorFloor), currentLocal, candidateLocal);
            return {
              position: lotLocalToWorld(resolved.position, interior.lot),
              blocked: resolved.blocked
            };
          })()
        : resolveExplorerMovement(current, candidate, explorerCollisionContext());
      explorerBlocked = movement.blocked;
      if (Math.abs(movement.position.x - candidate.x) > .001) explorerVelocity.x = 0;
      if (Math.abs(movement.position.z - candidate.z) > .001) explorerVelocity.z = 0;
      const traveled = Math.hypot(movement.position.x - current.x, movement.position.z - current.z);
      const movementSpeed = traveled / Math.max(.001, dt);
      camera.position.x = movement.position.x;
      camera.position.z = movement.position.z;
      const controlled = controlledInteriorResident();
      if (interior && controlled && traveled > .0001) {
        world.setResidentHomePosition(
          interior.home.id,
          controlled.resident.id,
          worldToLotLocal(movement.position, interior.lot),
          explorerInteriorFloor
        );
      }

      if (!explorerGrounded) {
        explorerVerticalOffset += explorerVerticalVelocity * dt;
        explorerVerticalVelocity -= 13.5 * dt;
        if (explorerVerticalOffset <= 0) {
          explorerVerticalOffset = 0;
          explorerVerticalVelocity = 0;
          explorerGrounded = true;
        }
      }
      if (explorerGrounded && traveled > .0001) explorerStepPhase += traveled * (sprinting ? 3.1 : 2.65);
      const bob = !uiPreferences.reducedMotion && explorerGrounded && movementSpeed > .3
        ? Math.sin(explorerStepPhase) * (sprinting ? .055 : .032)
        : 0;
      const roll = !uiPreferences.reducedMotion && explorerGrounded && movementSpeed > .3
        ? Math.sin(explorerStepPhase * .5) * (sprinting ? .009 : .004)
        : 0;
      camera.position.y = (interior ? 2.02 : 1.82) + explorerVerticalOffset + bob;
      const targetFov = photoMode ? photoFov : !uiPreferences.reducedMotion && sprinting && movementSpeed > 5 ? 60 : 55;
      const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
      if (Math.abs(nextFov - camera.fov) > .001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch, yaw, roll);
      updateExplorerMovementStatus(movementSpeed);
    }
  } else orbit.update();
  renderer.render(scene, camera);
}

renderWorld();
setMode("city");
notice("World ready");
unreadActivity = 0;
renderActivityCenter();
animate();
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
