import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CITY_EVENT_DEFINITIONS,
  type AccessibilityDestination,
  type AccessibilityDestinationKind,
  type AccessibilityEntrance,
  type CityEventKind,
  type CityEventTiming,
  type CityService,
  type CurbSchedule,
  type CurbUse,
  type Home,
  type Lot,
  type ParkingFacility,
  type ParkingKind,
  type Point2,
  type Road,
  type ServiceKind,
  type UtilityKind,
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
  interiorDoorways,
  interiorEntryPoint,
  interiorExteriorDoorway,
  interiorRoomAt,
  lotLocalToWorld,
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
type HomeTool = "select" | "room" | "sofa" | "table" | "bed" | "plant";
type CityTool = "road" | "inspect" | "service" | "utility" | "parking" | "curb" | "event" | "transit" | "access" | Exclude<Zone, "unassigned">;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="hud">
    <div class="brand"><div class="eyebrow">A living city sandbox</div><h1>Gridless</h1></div>
    <div class="simulation-controls">
      <div><span id="sim-date">Y1 · JAN 1</span><strong id="sim-time">08:00</strong></div>
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
      <button data-mode="city" class="active"><span>01</span> City Builder</button>
      <button data-mode="explore"><span>02</span> City Explorer</button>
      <button data-mode="home"><span>03</span> Home Simulator</button>
    </nav>
    <div class="stats">
      <div class="stat"><span>Population</span><strong id="population">0</strong></div>
      <div class="stat"><span>Monthly balance</span><strong id="funds">$0</strong></div>
      <div class="stat"><span>Lots</span><strong id="lot-count">0</strong></div>
      <div class="stat"><span>Services</span><strong id="coverage">0%</strong></div>
      <div class="stat"><span>Mobility</span><strong id="mobility">Quiet</strong></div>
      <div class="stat"><span>Wellbeing</span><strong id="wellbeing">0%</strong></div>
    </div>
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
    </div>
    <div class="actionbar">
      <button id="undo">Undo</button><button id="save">Save city</button><button id="load">Load city</button>
      <select id="staffing-policy" aria-label="Service staffing">
        <option value="0.65">Lean staff · 65%</option>
        <option value="0.85" selected>Standard staff · 85%</option>
        <option value="1">Full staff · 100%</option>
      </select>
      <span id="notice">World ready</span>
    </div>
    <div class="city-tools">
      <div>
        <div class="eyebrow">REGION FOUNDATION</div>
        <strong>Start structured, change anything</strong>
      </div>
      <select id="template-select" aria-label="Region template">
        <option value="nyc">New York City foundation</option>
        <option disabled>Chicago foundation · planned</option>
        <option disabled>Houston foundation · planned</option>
        <option disabled>Seattle foundation · planned</option>
        <option disabled>Portland foundation · planned</option>
        <option value="blank">Blank region</option>
      </select>
      <button id="apply-template">Start new region</button>
    </div>
    <div class="city-build-tools" aria-label="City building tools">
      <button data-city-tool="road" class="active">Draw road</button>
      <select id="road-class" aria-label="Road class">
        <option value="street">Local street · 9m</option>
        <option value="avenue">Avenue · 12m</option>
        <option value="arterial">Arterial · 16m</option>
      </select>
      <div class="tool-divider"></div>
      <button data-city-tool="inspect">Inspect</button>
      <span class="tool-label">Zone</span>
      <button data-city-tool="residential">Residential</button>
      <button data-city-tool="commercial">Commercial</button>
      <button data-city-tool="mixed">Mixed use</button>
      <button data-city-tool="industrial">Industrial</button>
      <button data-city-tool="civic">Civic</button>
      <div class="tool-divider"></div>
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
      <button data-city-tool="parking">Place parking</button>
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
      <button data-city-tool="curb">Manage curb</button>
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
      <button data-city-tool="transit">Transit operations</button>
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
      <button data-city-tool="access">Improve access</button>
    </div>
    <div class="home-tools" aria-label="Home building tools">
      <button data-home-tool="select" class="active">Inspect</button>
      <button data-home-tool="room">Draw room</button>
      <div class="tool-divider"></div>
      <button data-home-tool="sofa">Sofa</button>
      <button data-home-tool="table">Table</button>
      <button data-home-tool="bed">Bed</button>
      <button data-home-tool="plant">Plant</button>
      <div class="tool-divider"></div>
      <button id="add-resident">+ Resident</button>
      <div class="household-summary" id="household-summary">No residents yet</div>
    </div>
    <div class="explorer-status" aria-label="Explorer movement status">
      <div><span>Location</span><strong id="explorer-location">City streets</strong></div>
      <div><span>Surface</span><strong id="explorer-surface">Sidewalk</strong></div>
      <div><span>Movement</span><strong id="explorer-pace">Standing</strong></div>
    </div>
    <div class="crosshair"></div>
  </div>`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8c9cb);
scene.fog = new THREE.FogExp2(0xb8c9cb, 0.00052);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 2400);
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
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
ground.rotation.x = -Math.PI / 2;
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(1800, 1800),
  new THREE.MeshStandardMaterial({ color: 0x6e919b, roughness: .62, metalness: .08 })
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
  explorerVehicleGroup,
  transitVehicleGroup,
  transitFleetGroup
);
const world = new World();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const keys = new Set<string>();
let mode: Mode = "city";
let draft: Point2[] = [];
let selectedLot: Lot | null = null;
let cityTool: CityTool = "road";
let homeTool: HomeTool = "select";
let homeDraft: Point2 | null = null;
let yaw = Math.PI;
let pitch = 0;
let simulationSpeed = 12;
let simulationAccumulator = 0;
let lastMonthlyBalance = 0;
let lastHomeActionSignature = "";
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

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x303533, roughness: .94 });
const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xb7b4aa, roughness: .98 });
const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x777b74, roughness: 1 });
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
    road.points.map(point => new THREE.Vector3(point.x, .205, point.z)),
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

function rebuildExplorerRoadNavigation() {
  const key = world.roads
    .map(road => `${road.id}:${road.width}:${road.points.map(point => `${point.x.toFixed(2)},${point.z.toFixed(2)}`).join(";")}`)
    .join("|");
  if (key === explorerRoadKey) return;
  explorerRoadKey = key;
  explorerRoadPaths = buildExplorerRoadPaths(world.roads);
  streetIntersections = detectStreetIntersections(explorerRoadPaths);
  lastSignalMinute = -1;
  renderStreetFurniture();
}

function renderStreetFurniture() {
  streetFurnitureGroup.clear();
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
      .255,
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
      .235,
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
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(
      line.route.map(point => new THREE.Vector3(point.x, .34, point.z))
    );
    const route = new THREE.Line(
      routeGeometry,
      new THREE.LineBasicMaterial({ color: line.color, transparent: true, opacity: .48 })
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
      if (mode === "city" && cityTool === "transit") {
        const label = makeLabel(`${stop.name} · ${stop.waiting} waiting`);
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
      const label = makeLabel(
        `${line.name} · every ${line.headwayMinutes}m · ${transitFleetSize(line)} buses · ${transitFarePolicyLabel(line.fare)} · ${transitCrowdingLabel(world.transitLineCrowding(line))} · ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}`
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
  vehicle.position.set(pose.point.x, .18, pose.point.z);
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

  const scheduledFleet = scheduledTransitFleet(
    line,
    world.clock.elapsedMinutes + simulationAccumulator,
    2.5
  );
  const backgroundFleet = activeTransitVehicle ? scheduledFleet.slice(1) : scheduledFleet;
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
  const nextFov = THREE.MathUtils.damp(camera.fov, 59, 5, dt);
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
  camera.fov = 55;
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
  streetFurnitureGroup.visible = !inside;
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
    selectedLot = activeInterior.lot;
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
  const entry = interiorEntryPoint(home, preferred);
  if (!entry) {
    notice("The furnished floor plan has no clear place to enter");
    return;
  }
  explorerExteriorReturn = {
    position: { x: camera.position.x, z: camera.position.z },
    yaw
  };
  explorerInteriorHomeId = home.id;
  selectedLot = lot;
  clearAccessibleRoute();
  setInteriorSceneVisibility(true);
  renderHome();
  const worldEntry = lotLocalToWorld(entry, lot);
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
    "Walk through the rooms and furniture designed in Home Simulator. Household activity, utilities, and city conditions continue while you are inside.",
    "WASD|Walk;Mouse|Look;Shift|Move faster;F|Exit home;Esc|Return to City Builder"
  );
  updateExplorerMovementStatus(0);
  updateExplorerContext();
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
      "WASD|Walk;Mouse|Look;Shift|Sprint;Space|Jump;F|Enter home;T|Ride transit;E|Drive;R|Accessible route;Esc|Return"
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
    const local = worldToLotLocal(
      { x: camera.position.x, z: camera.position.z },
      interior.lot
    );
    const room = interiorRoomAt(interior.home, local);
    const pace = explorerBlocked && speed < .4
      ? "Blocked"
      : speed < .35
        ? "Standing"
        : speed < 6.2
          ? "Walking"
          : "Moving quickly";
    document.querySelector("#explorer-location")!.textContent = interior.home.name;
    document.querySelector("#explorer-surface")!.textContent = room?.kind ?? "Interior doorway";
    document.querySelector("#explorer-pace")!.textContent = pace;
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
  const movement = resolveExplorerMovement(current, candidate, explorerCollisionContext(1.35));
  explorerBlocked = movement.blocked;
  if (movement.blocked && Math.hypot(
    movement.position.x - candidate.x,
    movement.position.z - candidate.z
  ) > .08) {
    explorerVehicleSpeed = 0;
  }
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
  const targetFov = 57 + Math.min(7, Math.abs(explorerVehicleSpeed) * .22);
  const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 5, dt);
  if (Math.abs(nextFov - camera.fov) > .001) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
  updateExplorerMovementStatus(Math.abs(explorerVehicleSpeed));
}

function renderWorld() {
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
  for (const road of world.roads) {
    const curb = ribbon(road.points, road.width + 5.2, curbMaterial);
    curb.position.y = .01;
    worldGroup.add(curb);
    const sidewalk = ribbon(road.points, road.width + 4.4, sidewalkMaterial);
    sidewalk.position.y = .025;
    worldGroup.add(sidewalk);
    for (const point of road.points) {
      const curbJunction = new THREE.Mesh(new THREE.CircleGeometry((road.width + 5.2) * .55, 24), curbMaterial);
      curbJunction.rotation.x = -Math.PI / 2;
      curbJunction.position.set(point.x, .14, point.z);
      worldGroup.add(curbJunction);
      const sidewalkJunction = new THREE.Mesh(new THREE.CircleGeometry((road.width + 4.4) * .55, 24), sidewalkMaterial);
      sidewalkJunction.rotation.x = -Math.PI / 2;
      sidewalkJunction.position.set(point.x, .16, point.z);
      worldGroup.add(sidewalkJunction);
    }
  }
  for (const road of world.roads) {
    const roadway = ribbon(road.points, road.width, roadMaterial);
    roadway.position.y = .055;
    worldGroup.add(roadway);
    for (const point of road.points) {
      const junction = new THREE.Mesh(new THREE.CircleGeometry(road.width * .55, 24), roadMaterial);
      junction.rotation.x = -Math.PI / 2;
      junction.position.set(point.x, .18, point.z);
      worldGroup.add(junction);
    }
    worldGroup.add(roadCenterLine(road));
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
  for (const lot of world.lots) {
    const lotMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(lot.width, lot.depth),
      lot.id === selectedLot?.id ? lotSelectedMaterial : zoneLotMaterials[lot.zone]
    );
    lotMesh.rotation.set(-Math.PI / 2, 0, lot.rotation);
    lotMesh.position.set(lot.center.x, .16, lot.center.z);
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
    const fullHeight = lot.homeId ? 7 : zoneBuildingHeight(lot.zone, seed);
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
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(lot.width * .62, height, lot.depth * .58),
      new THREE.MeshStandardMaterial({
        color: progress < 1 ? 0xc5a25f : zoneBuildingColors[lot.zone],
        emissive: progress < 1 || occupiedShare <= 0 || powerOutage ? 0x000000 : 0x2e2415,
        emissiveIntensity: progress < 1 || powerOutage ? 0 : darkness * occupiedShare * .12,
        roughness: .8
      })
    );
    shell.position.set(lot.center.x, height / 2, lot.center.z);
    shell.rotation.y = lot.rotation;
    shell.castShadow = shell.receiveShadow = true;
    worldGroup.add(shell);
    if (progress >= 1) addBuildingWindows(lot, height, darkness, occupiedShare);
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
  renderAccessibilityEntrances();
  renderCityEvents();
  document.querySelector("#lot-count")!.textContent = String(world.lots.length);
  updateCityStats();
  updateClockDisplay();
  renderHome();
  renderIncidents();
  if (mode === "city" && (
    cityTool === "inspect"
    || cityTool === "transit"
    || cityTool === "curb"
    || cityTool === "event"
  )) {
    updateCityToolPanel(cityTool === "inspect" ? selectedLot ?? undefined : undefined);
  }
  if (currentExplorerInterior()) setInteriorSceneVisibility(true);
}

function addBuildingWindows(lot: Lot, height: number, darkness: number, occupiedShare: number) {
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
  const frontPosition = localToWorld({ x: 0, z: lot.depth * .3 + .03 }, lot);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(lot.width * .5, facadeHeight), material);
  front.position.set(frontPosition.x, height * .52, frontPosition.z);
  front.rotation.y = lot.rotation;
  worldGroup.add(front);

  const sidePosition = localToWorld({ x: lot.width * .31 + .03, z: 0 }, lot);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(lot.depth * .47, facadeHeight), material);
  side.position.set(sidePosition.x, height * .52, sidePosition.z);
  side.rotation.y = lot.rotation + Math.PI / 2;
  worldGroup.add(side);
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
  return value >= 100_000
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

function updateCityStats() {
  const {
    households,
    businesses,
    population,
    jobs,
    openBusinesses,
    workersOnShift,
    monthlyBalance: balance,
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

  const completedLots = world.lots.filter(lot => world.constructionProgress(lot) >= 1);
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
    `${households.toLocaleString()} households · ${openBusinesses.toLocaleString()}/${businesses.toLocaleString()} businesses open · ${workersOnShift.toLocaleString()}/${jobs.toLocaleString()} jobs on shift · parking ${parkingRevenue - parkingCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(parkingRevenue - parkingCosts))} · curb ${curbRevenue - curbCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(curbRevenue - curbCosts))} · ${curbDeliveries.toLocaleString()} deliveries · ${curbViolations.toLocaleString()} violations · transit ${transitRevenue - transitCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(transitRevenue - transitCosts))} · ${transitRidership.toLocaleString()} rides · events ${eventRevenue - eventCosts >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(eventRevenue - eventCosts))} · ${eventAttendance.toLocaleString()} visits`;
  (document.querySelector("#staffing-policy") as HTMLSelectElement).value = String(world.serviceFunding);
  const transitLine = world.transitLines[0];
  if (transitLine) {
    (document.querySelector("#transit-frequency") as HTMLSelectElement).value = String(transitLine.headwayMinutes);
    (document.querySelector("#transit-fare") as HTMLSelectElement).value = String(transitLine.fare);
  }
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
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const hours = Math.floor(minute / 60);
  const minutes = Math.floor(minute % 60);
  document.querySelector("#sim-date")!.textContent = `Y${year} · ${monthNames[month - 1]} ${day}`;
  document.querySelector("#sim-time")!.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const daylight = Math.max(0, Math.sin((hours + minutes / 60 - 6) / 12 * Math.PI));
  sun.intensity = .38 + daylight * 2.82;
  hemisphere.intensity = .58 + daylight * 1.67;
  const night = new THREE.Color(0x172532);
  const dayColor = new THREE.Color(0xb8c9cb);
  const sky = night.clone().lerp(dayColor, .18 + daylight * .82);
  scene.background = sky;
  if (scene.fog) scene.fog.color.copy(sky);
  renderIncidents();
  renderCommutes();
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
  for (const area of world.areas) {
    if (area.kind === "district") {
      const center = area.points.reduce((sum, point) => ({ x: sum.x + point.x / area.points.length, z: sum.z + point.z / area.points.length }), { x: 0, z: 0 });
      const label = makeLabel(area.name);
      label.position.set(center.x, 12, center.z);
      terrainGroup.add(label);
      continue;
    }
    const shape = new THREE.Shape();
    area.points.forEach((point, index) => index === 0 ? shape.moveTo(point.x, point.z) : shape.lineTo(point.x, point.z));
    shape.closePath();
    const surface = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color: area.kind === "park" ? 0x587a4f : 0x819773,
        roughness: 1,
        side: THREE.DoubleSide
      })
    );
    surface.rotation.x = Math.PI / 2;
    surface.position.y = area.kind === "park" ? .08 : -.02;
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
          new THREE.MeshBasicMaterial({ color: vehiclePose?.stopped ? 0xff3b2f : 0x69251f })
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
    traveler.position.set(point.x, .18, point.z);
    traveler.rotation.y = Math.atan2(next.x - point.x, next.z - point.z);
    traveler.userData.stoppedForSignal = vehiclePose?.stopped ?? false;
    traveler.scale.setScalar(active.flow.mode === "car" ? 1 : 1.15);
    commuteGroup.add(traveler);
  });
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
    const label = makeLabel(
      `${event.name} · ${active ? `${attendance.toLocaleString()} attending` : world.cityEventStatus(event)}`
    );
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
  return sprite;
}

function hash(value: string) {
  return [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function renderDraft() {
  previewGroup.clear();
  if (draft.length > 1) {
    const utility = cityTool === "utility" ? currentUtilityKind() : null;
    previewGroup.add(ribbon(
      draft,
      utility ? 2.5 : currentRoadConfig().width,
      new THREE.MeshBasicMaterial({ color: utility ? utilityColor(utility) : 0xe8cb68, transparent: true, opacity: .78 })
    ));
  }
  for (const point of draft) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(1.5), new THREE.MeshBasicMaterial({ color: 0xffe07b }));
    marker.position.set(point.x, 1.5, point.z);
    previewGroup.add(marker);
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
}

function currentRoadConfig() {
  const roadClass = (document.querySelector("#road-class") as HTMLSelectElement).value as "street" | "avenue" | "arterial";
  return {
    class: roadClass,
    width: roadClass === "street" ? 9 : roadClass === "avenue" ? 12 : 16
  };
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

function renderHome() {
  homeGroup.clear();
  const explorerInterior = currentExplorerInterior();
  const lot = mode === "home" ? selectedLot : explorerInterior?.lot ?? null;
  const home = mode === "home" ? currentHome() : explorerInterior?.home ?? null;
  homeGroup.visible = Boolean(lot && home);
  if (!lot || !home) return;
  lastHomeActionSignature = home.residents.map(resident =>
    `${resident.id}:${world.activeResidentAction(resident)?.kind ?? world.residentStatus(resident)}:${Math.floor(world.residentActionProgress(resident) * 10)}:${world.residentWellbeing(resident).score}`
  ).join("|");
  homeGroup.position.set(lot.center.x, .2, lot.center.z);
  homeGroup.rotation.y = lot.rotation;

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(lot.width - 1, .18, lot.depth - 1),
    new THREE.MeshStandardMaterial({ color: 0xcfbf91, roughness: .96 })
  );
  foundation.position.y = .09;
  foundation.receiveShadow = true;
  foundation.userData.homeSurface = true;
  homeGroup.add(foundation);

  const entrance = world.accessibilityEntrances.find(
    item => item.targetKind === "lot" && item.targetId === lot.id
  );
  const exteriorDoorway = entrance
    ? interiorExteriorDoorway(home, worldToLotLocal(entrance.position, lot))
    : undefined;
  for (const room of home.rooms) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width, room.depth),
      new THREE.MeshStandardMaterial({ color: 0xe2d6bd, roughness: .88, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(room.x, .2, room.z);
    floor.receiveShadow = true;
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
    addHomeRoomWalls(home, room, exteriorDoorway);
  }

  for (const item of home.furniture) homeGroup.add(createFurniture(item));
  home.residents.filter(resident => world.residentStatus(resident) === "Home").forEach((resident, index) => {
    const person = new THREE.Group();
    const action = world.activeResidentAction(resident);
    const target = world.residentActionTarget(home, resident);
    const wellbeing = world.residentWellbeing(resident);
    const color = wellbeingColor(wellbeing.score);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.28, .8, 4, 8), new THREE.MeshStandardMaterial({ color }));
    body.position.y = action?.kind === "sleep" ? .52 : action?.kind === "relax" ? .78 : .95;
    if (action?.kind === "sleep") body.rotation.z = Math.PI / 2;
    if (action?.kind === "relax") body.scale.y = .82;
    const stateRing = new THREE.Mesh(
      new THREE.RingGeometry(.42, .52, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72, side: THREE.DoubleSide })
    );
    stateRing.rotation.x = -Math.PI / 2;
    stateRing.position.y = .025;
    person.add(body, stateRing);
    if (mode === "home") {
      const actionLabel = makeHomeLabel(`${resident.name} · ${world.residentActionLabel(resident)}`);
      actionLabel.position.set(0, 2.05, 0);
      person.add(actionLabel);
    }
    person.position.set(
      target ? target.x + (index % 2 ? .55 : -.55) : -1 + index * 1.1,
      .2,
      target ? target.z + .65 : .4
    );
    homeGroup.add(person);
  });
  if (mode === "home") updateHouseholdSummary(home);
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
  return sprite;
}

function addHomeRoomWalls(
  home: Home,
  room: Home["rooms"][number],
  exteriorDoorway?: ReturnType<typeof interiorExteriorDoorway>
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
      : undefined)
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
      : undefined)
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
      : undefined)
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
      : undefined)
  );
}

function addSegmentedHomeWall(
  start: number,
  end: number,
  fixed: number,
  rotation: number,
  doorway?: {
    orientation: "x" | "z";
    boundary: number;
    center: number;
    width: number;
  }
) {
  if (!doorway) {
    const center = (start + end) / 2;
    addWall(
      homeGroup,
      rotation ? fixed : center,
      rotation ? center : fixed,
      end - start,
      .18,
      rotation
    );
    return;
  }
  const openingStart = Math.max(start, doorway.center - doorway.width / 2);
  const openingEnd = Math.min(end, doorway.center + doorway.width / 2);
  const firstLength = openingStart - start;
  const secondLength = end - openingEnd;
  if (firstLength > .05) {
    const center = start + firstLength / 2;
    addWall(homeGroup, rotation ? fixed : center, rotation ? center : fixed, firstLength, .18, rotation);
  }
  if (secondLength > .05) {
    const center = openingEnd + secondLength / 2;
    addWall(homeGroup, rotation ? fixed : center, rotation ? center : fixed, secondLength, .18, rotation);
  }
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(doorway.width, .7, .18),
    new THREE.MeshStandardMaterial({ color: 0xf2eee3, roughness: .82 })
  );
  header.position.set(
    rotation ? fixed : doorway.center,
    2.45,
    rotation ? doorway.center : fixed
  );
  header.rotation.y = rotation;
  header.castShadow = header.receiveShadow = true;
  homeGroup.add(header);
}

function addWall(group: THREE.Group, x: number, z: number, length: number, thickness: number, rotation: number) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, 2.8, thickness),
    new THREE.MeshStandardMaterial({ color: 0xf2eee3, roughness: .82 })
  );
  wall.position.set(x, 1.6, z);
  wall.rotation.y = rotation;
  wall.castShadow = wall.receiveShadow = true;
  group.add(wall);
}

function createFurniture(item: Home["furniture"][number]) {
  const group = new THREE.Group();
  group.position.set(item.x, .25, item.z);
  group.rotation.y = item.rotation;
  if (item.kind === "sofa" || item.kind === "bed") {
    const size = item.kind === "sofa" ? [2.2, .55, .85] : [1.7, .45, 2.1];
    const base = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: item.kind === "sofa" ? 0x73907e : 0xc9b999, roughness: .9 }));
    base.position.y = size[1] / 2;
    base.castShadow = true;
    group.add(base);
    if (item.kind === "sofa") {
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, .75, .18), new THREE.MeshStandardMaterial({ color: 0x627c6c }));
      back.position.set(0, .65, .35);
      group.add(back);
    }
  } else if (item.kind === "table") {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .12, 24), new THREE.MeshStandardMaterial({ color: 0x8a694c }));
    top.position.y = .8;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, .75, 12), new THREE.MeshStandardMaterial({ color: 0x684e39 }));
    leg.position.y = .4;
    group.add(top, leg);
  } else {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.3, .24, .42, 12), new THREE.MeshStandardMaterial({ color: 0xb37450 }));
    pot.position.y = .21;
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshStandardMaterial({ color: 0x4f7652 }));
    leaves.position.y = .75;
    group.add(pot, leaves);
  }
  return group;
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
    document.querySelector("#panel-copy")!.textContent =
      `${home.residents.length ? `${home.name} is ${wellbeingLabel(homeScore).toLowerCase()} at ${homeScore}% wellbeing.` : "Build the home and add residents to begin their daily simulation."} ${activity.atHome} residents are home, ${activity.atWorkOrSchool} are at work or school, and ${activity.outInCity} are elsewhere.${actionCopy}${outageCopy}${commuteCopy}`;
    const details = document.querySelector("#parcel-details")!;
    const utility = world.lotUtilityReliability(selectedLot);
    const neighborhood = world.lotNeighborhoodSupport(selectedLot);
    const entrance = world.accessibilityEntrances.find(
      item => item.targetKind === "lot" && item.targetId === selectedLot!.id
    );
    details.innerHTML = `
      <div class="home-wellbeing-overview">
        <div><span>Home quality</span><strong>${world.homeQuality(home)}%</strong></div>
        <div><span>Utilities</span><strong>${utility}%</strong></div>
        <div><span>Neighborhood</span><strong>${neighborhood}%</strong></div>
        <div><span>Entrance</span><strong>${entrance ? entranceAccessLabel(entrance) : "Not connected"}</strong></div>
      </div>
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
          const action = world.activeResidentAction(resident);
          const actionProgress = Math.round(world.residentActionProgress(resident) * 100);
          return `
            <div class="resident-card ${wellbeing.label.toLowerCase()}">
              <div class="resident-heading">
                <span><strong>${resident.name}</strong><small>${world.residentActionLabel(resident)} · ${destination}</small></span>
                <b>${wellbeing.score}% ${wellbeing.label}</b>
              </div>
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
            </div>
          `;
        }).join("") : `<div class="resident-empty">Add a resident to start needs, schedules, health, and household wellbeing.</div>`}
      </div>
    `;
    details.classList.add("visible");
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

function notice(text: string) {
  document.querySelector("#notice")!.textContent = text;
}

function setMode(next: Mode) {
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
  }
  mode = next;
  setInteriorSceneVisibility(false);
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
  orbit.enabled = next !== "explore";
  renderAccessibilityEntrances();
  draft = [];
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
    camera.position.set(lot.center.x + 24, 22, lot.center.z + 28);
    orbit.target.set(lot.center.x, 0, lot.center.z);
    setPanel("HOME SIMULATOR", home.name, "Draw connected rooms, furnish them, and create the household that will live here. Everything remains attached to this city lot.", "Tool bar|Choose build item;Click|Place or draw;⌘ Z|Undo");
    renderWorld();
  }
}

function updateExplorerContext() {
  if (mode !== "explore") return;
  const interior = currentExplorerInterior();
  if (interior) {
    const local = worldToLotLocal(
      { x: camera.position.x, z: camera.position.z },
      interior.lot
    );
    const room = interiorRoomAt(interior.home, local);
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
    const activityCopy = activities.length
      ? ` ${activities.join(" and ")}.`
      : " No household members are currently home.";
    const outageCopy = outages.length
      ? ` Active disruption: ${outages.map(failure => utilityKindLabel(failure.kind)).join(" and ")}.`
      : " Utilities are operating normally.";
    document.querySelector("#panel-kicker")!.textContent = "HOME INTERIOR";
    document.querySelector("#panel-title")!.textContent =
      `${interior.home.name} · ${room?.kind ?? "Doorway"}`;
    document.querySelector("#panel-copy")!.textContent =
      `${interior.home.rooms.length} rooms and ${interior.home.furniture.length} furnishings are part of the persistent Home Simulator plan.${activityCopy}${outageCopy} ${entrance ? entranceAccessLabel(entrance) : "Entrance not connected"}. Press F to return to the street.`;
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
    const eventCopy = nearbyEvent
      ? ` ${nearbyEvent.event.name} is active ${Math.max(1, Math.round(nearbyEvent.distance))}m away with ${world.cityEventExpectedAttendance(nearbyEvent.event).toLocaleString()} attendees and event traffic controls.`
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
      `${Math.round(Math.abs(explorerVehicleSpeed) * 3.6)} km/h. ${onRoad ? "The vehicle is on the road network." : "Off-road resistance is slowing the vehicle."}${signalCopy}${eventCopy}${curbCopy}${parkingCopy} Buildings, facilities, and shorelines remain solid.`;
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
    document.querySelector("#panel-kicker")!.textContent = "CITY TRANSIT";
    document.querySelector("#panel-title")!.textContent = nearbyStop.stop.name;
    document.querySelector("#panel-copy")!.textContent =
      `${nearbyStop.line.name} · every ${nearbyStop.line.headwayMinutes}m · about ${world.transitAverageWait(nearbyStop.line).toFixed(1)}m average wait · ${nearbyStop.stop.waiting} waiting · ${transitFarePolicyLabel(nearbyStop.line.fare)} · ${transitCrowdingLabel(world.transitLineCrowding(nearbyStop.line))}. ${access}.${eventCopy} Press T to board.`;
    return;
  }
  const nearbyEvent = closestActiveCityEvent({ x: camera.position.x, z: camera.position.z }, 115);
  if (nearbyEvent) {
    const event = nearbyEvent.event;
    const definition = CITY_EVENT_DEFINITIONS[event.kind];
    const affectedCurbs = world.parking.filter(
      facility => facility.kind === "curb" && world.cityEventCurbOverride(facility)
    ).length;
    document.querySelector("#panel-kicker")!.textContent = "CITY EVENT";
    document.querySelector("#panel-title")!.textContent = event.name;
    document.querySelector("#panel-copy")!.textContent =
      `${definition.label} with ${world.cityEventExpectedAttendance(event).toLocaleString()} attendees. ${world.cityEventStatus(event)} · ${affectedCurbs} nearby curbs under event control · ${Math.round(world.cityEventTrafficPressure() * 100)}% city event traffic pressure. Transit queues and pedestrian activity respond to the same event.`;
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
  const resident = home?.residents[0];
  document.querySelector("#panel-kicker")!.textContent = "CITY EXPLORER";
  if (!resident) {
    document.querySelector("#panel-title")!.textContent = "Walk the living city";
    document.querySelector("#panel-copy")!.textContent =
      "Follow continuous sidewalks and road crossings through the same traffic, homes, workplaces, services, and emergencies managed in City Builder.";
    return;
  }
  const wellbeing = world.residentWellbeing(resident);
  const outages = selectedLot ? world.utilityFailuresForLot(selectedLot) : [];
  const outageCopy = outages.length
    ? ` ${outages.map(failure => utilityKindLabel(failure.kind)).join(" and ")} service is disrupted while crews respond.`
    : "";
  const currentActivity = world.residentStatus(resident) === "Home"
    ? world.residentActionLabel(resident)
    : world.residentStatus(resident);
  document.querySelector("#panel-title")!.textContent = `${resident.name} in the city`;
  document.querySelector("#panel-copy")!.textContent =
    `${resident.name} is ${currentActivity.toLowerCase()} with ${wellbeing.score}% wellbeing. ${wellbeing.pressure}.${outageCopy} Their current commute burden is ${wellbeing.commuteBurden}%.`;
}

function setPanel(kicker: string, title: string, copy: string, controls: string) {
  document.querySelector(".panel")!.classList.remove("inspecting");
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
              : { tone: "healthy", text: "This parcel has the core support needed for stable daily growth." };
  const anchor = lot.anchorBusiness
    ? `<div class="parcel-anchor"><span>Neighborhood anchor</span><strong>${lot.anchorBusiness.name}</strong><small>${businessLabels[lot.anchorBusiness.sector]} · ${lot.anchorBusiness.jobs} jobs · ${world.businessIsOpen(lot.anchorBusiness.sector) ? "Open now" : "Closed now"}</small></div>`
    : "";
  details.innerHTML = `
    <div class="parcel-metrics">
      <div><span>Residents</span><strong>${world.lotPopulation(lot).toLocaleString()}</strong></div>
      <div><span>Households</span><strong>${lot.households.toLocaleString()}</strong></div>
      <div><span>Businesses</span><strong>${lot.businesses.toLocaleString()}</strong></div>
      <div><span>Jobs</span><strong>${world.lotJobs(lot).toLocaleString()}</strong></div>
    </div>
    <div class="parcel-line"><span>Household mix</span><strong>${householdMix.length ? householdMix.map(([label, count]) => `${label} ${count}`).join(" · ") : "No occupied homes"}</strong></div>
    <div class="parcel-line"><span>Business mix</span><strong>${businessMix.length ? businessMix.join(" · ") : "No open businesses"}</strong></div>
    <div class="parcel-line"><span>Live neighborhood routine</span><strong>${activity.atHome} home · ${activity.atWorkOrSchool} work or school · ${activity.outInCity} elsewhere · ${activity.openBusinesses}/${lot.businesses} businesses open</strong></div>
    <div class="parcel-wellbeing ${lotWellbeingState.toLowerCase()}">
      <span>Household wellbeing</span>
      <strong>${lotWellbeing}% · ${lotWellbeingState}</strong>
      <small>${world.lotUtilityReliability(lot)}% utilities · ${world.lotNeighborhoodSupport(lot)}% neighborhood support${lotHome?.residents.length ? ` · ${lotHome.residents.length} named ${lotHome.residents.length === 1 ? "resident" : "residents"}` : ""}</small>
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
        <small>${lotHome.residents.reduce((total, resident) => total + (resident.completedActions ?? 0), 0)} autonomous actions completed</small>
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
    setPanel("NYC FLEXIBLE FOUNDATION", "Draw beyond the grid", "Use the avenue and street structure as a head start. Extend it, curve it, break blocks apart, or build an entirely different borough.", "Click|Add a curve point;Enter|Finish road;⌘ Z|Undo construction");
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
    setPanel(
      "CITY EVENTS",
      `${definition.label} · ${cityEventTimingLabel(currentCityEventTiming())}`,
      `${world.cityEvents.length} recurring monthly events · ${active.length} active now · ${projectedAttendance.toLocaleString()} projected attendees · ${affectedCurbs} event-controlled curbs · ${Math.round(world.cityEventTrafficPressure() * 100)}% event traffic pressure · projected ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}. Click near a street to create a named event that coordinates curb access, traffic, transit demand, and pedestrian crowds.`,
      "Event type|Demand pattern;Timing|First occurrence;Click city|Place recurring event;Explorer|Walk or drive to it;⌘ Z|Undo"
    );
  } else if (cityTool === "transit") {
    const line = world.transitLines[0];
    if (!line) {
      setPanel("TRANSIT OPERATIONS", "No route available", "Start from the NYC foundation or draw a connected road network before operating transit service.", "Region|Load NYC foundation;Roads|Build a network");
      return;
    }
    const demand = world.transitLineDemand(line);
    const crowding = world.transitLineCrowding(line);
    const waiting = line.stops.reduce((total, stop) => total + stop.waiting, 0);
    const projectedNet = world.transitMonthlyProjection(line) - world.transitMonthlyCost(line);
    setPanel(
      "TRANSIT OPERATIONS",
      line.name,
      `Every ${line.headwayMinutes} minutes with ${transitFleetSize(line)} active buses · ${transitFarePolicyLabel(line.fare)} · ${Math.round(demand)} hourly passenger demand · ${world.transitAverageWait(line).toFixed(1)}m average wait · ${waiting} waiting now · ${transitCrowdingLabel(crowding)} (${Math.round(crowding * 100)}%) · projected ${projectedNet >= 0 ? "+" : "-"}${formatParkingMonthly(Math.abs(projectedNet))}.`,
      "Frequency|Fleet and waits;Fare|Demand and revenue;Stop rings|Passenger queues;T in Explorer|Board"
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
    setPanel("ZONING BRUSH", `Zone ${label}`, "Click parcels to change what can develop there. Buildings and population respond immediately while the underlying lot remains fully editable.", "Click lot|Apply zoning;Inspect|Review parcel;⌘ Z|Undo");
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
    const home = currentHome();
    if (!home) return;
    if (homeTool === "room") {
      if (!homeDraft) {
        homeDraft = point;
        renderDraft();
        notice("Choose the opposite room corner");
      } else {
        const room = {
          kind: `Room ${home.rooms.length + 1}`,
          x: (homeDraft.x + point.x) / 2,
          z: (homeDraft.z + point.z) / 2,
          width: Math.abs(point.x - homeDraft.x),
          depth: Math.abs(point.z - homeDraft.z)
        };
        if (world.addRoom(home.id, room)) notice(`${room.kind} built`);
        else notice("Rooms must be at least 2m × 2m");
        homeDraft = null;
        renderDraft();
        renderWorld();
      }
    } else if (homeTool !== "select") {
      if (world.addFurniture(home.id, homeTool, point.x, point.z)) {
        renderWorld();
        notice(`${homeTool[0].toUpperCase()}${homeTool.slice(1)} placed`);
      } else {
        notice("Furniture must stay inside a room");
      }
    }
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
  if (mode === "city" && cityTool === "transit") return;
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
      world.zoneLot(selectedLot.id, cityTool);
      renderWorld();
      updateCityToolPanel(selectedLot);
      notice(`${cityTool === "mixed" ? "Mixed-use" : `${cityTool[0].toUpperCase()}${cityTool.slice(1)}`} construction started`);
    }
    return;
  }
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) {
    draft.push({ x: hit.point.x, z: hit.point.z });
    renderDraft();
    notice(`${draft.length} road points`);
  }
});

addEventListener("keydown", event => {
  keys.add(event.code);
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
  if (mode === "city" && event.code === "Enter" && draft.length > 1) {
    if (cityTool === "utility") {
      const kind = currentUtilityKind();
      world.addUtilityLine(kind, draft);
      notice(`${utilityName(kind)} connected`);
    } else if (cityTool === "road") {
      const road = currentRoadConfig();
      world.addRoad(draft, road.width, road.class);
      notice("Road and parcels built");
    } else {
      return;
    }
    draft = [];
    renderDraft();
    renderWorld();
  }
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyZ") {
    event.preventDefault();
    if (world.undo()) { renderWorld(); notice("Construction undone"); }
  }
  if (event.code === "Escape" && mode === "explore") setMode("city");
});
addEventListener("keyup", event => keys.delete(event.code));
addEventListener("blur", () => keys.clear());
addEventListener("mousemove", event => {
  if (mode !== "explore" || explorerDriving || transitRide || document.pointerLockElement !== renderer.domElement) return;
  yaw -= event.movementX * .002;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * .002, -1.3, 1.3);
});

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode as Mode)));
document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach(button => button.addEventListener("click", () => {
  simulationSpeed = Number(button.dataset.speed);
  document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach(item => item.classList.toggle("active", item === button));
  notice(simulationSpeed === 0 ? "Simulation paused" : simulationSpeed >= 360 ? "Maximum simulation speed" : simulationSpeed >= 72 ? "Fast simulation speed" : "Simulation running");
}));
document.querySelectorAll<HTMLButtonElement>("[data-city-tool]").forEach(button => button.addEventListener("click", () => {
  cityTool = button.dataset.cityTool as CityTool;
  draft = [];
  renderDraft();
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
                ? "Adjust route frequency and fare"
              : cityTool === "access"
                ? "Choose an entrance to upgrade"
          : `Zoning brush: ${cityTool}`
  );
}));
document.querySelector("#road-class")!.addEventListener("change", () => {
  renderDraft();
  const road = currentRoadConfig();
  notice(`${road.class[0].toUpperCase()}${road.class.slice(1)} selected · ${road.width}m`);
});
document.querySelector("#service-kind")!.addEventListener("change", () => {
  if (cityTool === "service") updateCityToolPanel();
  const service = serviceDescription(currentServiceKind());
  notice(`${service.title} selected · ${service.radius}m coverage`);
});
document.querySelector("#utility-kind")!.addEventListener("change", () => {
  draft = [];
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
  const line = world.transitLines[0];
  if (!line || !world.setTransitOperations(line.id, currentTransitHeadway(), currentTransitFare())) return;
  renderWorld();
  notice(`${line.name} now runs every ${line.headwayMinutes} minutes with ${transitFleetSize(line)} buses`);
});
document.querySelector("#transit-fare")!.addEventListener("change", () => {
  const line = world.transitLines[0];
  if (!line || !world.setTransitOperations(line.id, currentTransitHeadway(), currentTransitFare())) return;
  renderWorld();
  notice(`${line.name} fare set to ${formatTransitFare(line.fare)}`);
});
document.querySelector("#staffing-policy")!.addEventListener("change", event => {
  const funding = Number((event.currentTarget as HTMLSelectElement).value);
  if (!world.setServiceFunding(funding)) return;
  renderWorld();
  notice(`Service staffing set to ${Math.round(funding * 100)}%`);
});
document.querySelectorAll<HTMLButtonElement>("[data-home-tool]").forEach(button => button.addEventListener("click", () => {
  homeTool = button.dataset.homeTool as HomeTool;
  homeDraft = null;
  renderDraft();
  document.querySelectorAll<HTMLButtonElement>("[data-home-tool]").forEach(item => item.classList.toggle("active", item === button));
  notice(homeTool === "room" ? "Click two corners to draw a room" : homeTool === "select" ? "Inspect mode" : `Click inside the home to place a ${homeTool}`);
}));
document.querySelector("#add-resident")!.addEventListener("click", () => {
  const home = currentHome();
  if (!home) return;
  world.addResident(home.id);
  renderWorld();
  notice("Resident joined the household");
});
document.querySelector("#undo")!.addEventListener("click", () => { if (world.undo()) { renderWorld(); notice("Construction undone"); } });
document.querySelector("#save")!.addEventListener("click", () => { world.save(); notice("City saved locally"); });
document.querySelector("#load")!.addEventListener("click", () => { notice(world.load() ? "Saved city loaded" : "No saved city found"); renderWorld(); });
let templateResetArmed = false;
let templateResetTimer = 0;
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
  const value = (document.querySelector("#template-select") as HTMLSelectElement).value as "nyc" | "blank";
  if (!world.applyTemplate(value)) return;
  selectedLot = null;
  renderWorld();
  setMode("city");
  notice(value === "nyc" ? "NYC foundation loaded. Every road remains editable." : "Blank region loaded");
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
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
            const resolved = resolveInteriorMovement(interior.home, currentLocal, candidateLocal);
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
      const bob = explorerGrounded && movementSpeed > .3
        ? Math.sin(explorerStepPhase) * (sprinting ? .055 : .032)
        : 0;
      const roll = explorerGrounded && movementSpeed > .3
        ? Math.sin(explorerStepPhase * .5) * (sprinting ? .009 : .004)
        : 0;
      camera.position.y = (interior ? 2.02 : 1.82) + explorerVerticalOffset + bob;
      const targetFov = sprinting && movementSpeed > 5 ? 60 : 55;
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
animate();
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
