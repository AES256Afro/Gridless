import type { Area, CityEventKind, Road, Season, WorldTemplate } from "./world";

const rotate = (x: number, z: number) => {
  const angle = -.19;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c + z * s, z: -x * s + z * c };
};

const line = (id: string, width: number, points: Array<[number, number]>): Road => ({
  id,
  width,
  points: points.map(([x, z]) => rotate(x, z))
});

const polygon = (id: string, name: string, kind: Area["kind"], points: Array<[number, number]>): Area => ({
  id,
  name,
  kind,
  points: points.map(([x, z]) => rotate(x, z))
});

const regionLine = (
  id: string,
  name: string,
  roadClass: NonNullable<Road["class"]>,
  width: number,
  points: Array<[number, number]>,
  profile?: Road["profile"],
  developable = true
): Road => ({
  id,
  name,
  class: roadClass,
  width,
  points: points.map(([x, z]) => ({ x, z })),
  profile,
  developable
});

const regionPolygon = (
  id: string,
  name: string,
  kind: Area["kind"],
  points: Array<[number, number]>,
  floodRisk?: Area["floodRisk"],
  terrainSlope?: Area["terrainSlope"]
): Area => ({
  id,
  name,
  kind,
  points: points.map(([x, z]) => ({ x, z })),
  floodRisk,
  terrainSlope
});

function nycRoads() {
  const roads: Road[] = [];
  const avenueNames = ["West End Ave", "Amsterdam Ave", "Columbus Ave", "Broadway East", "Lexington Ave", "Second Ave", "First Ave"];
  [-126, -84, -42, 0, 42, 84, 126].forEach((x, index) => {
    roads.push(line(`nyc-avenue-${index}`, index === 3 ? 13 : 11, [[x, -465], [x + 3, -40], [x - 2, 465]]));
    roads.at(-1)!.name = avenueNames[index];
    roads.at(-1)!.class = index === 3 ? "arterial" : "avenue";
  });

  let streetNumber = 14;
  for (let z = -430; z <= 430; z += 43) {
    const inPark = z > 75 && z < 315;
    const transverse = Math.abs(z - 129) < 5 || Math.abs(z - 258) < 5;
    if (!inPark || transverse) {
      const road = line(`nyc-street-${streetNumber}`, transverse ? 11 : 9, [[-151, z], [0, z + Math.sin(z) * 2], [151, z]]);
      road.name = `${streetNumber}th Street`;
      road.class = transverse ? "avenue" : "street";
      roads.push(road);
    }
    streetNumber += 4;
  }

  const broadway = line("nyc-broadway", 12, [[-118, -462], [-70, -235], [-10, -35], [56, 215], [112, 455]]);
  broadway.name = "Broadway";
  broadway.class = "arterial";
  roads.push(broadway);
  return roads;
}

export const NYC_TEMPLATE: WorldTemplate = {
  id: "nyc",
  name: "New York City Foundation",
  description: "A flexible Manhattan-inspired starting region with avenues, numbered streets, Broadway, districts, waterfront, and a major central park.",
  roads: nycRoads(),
  areas: [
    polygon("nyc-island", "Manhattan", "land", [[-105, -500], [105, -500], [160, -390], [160, 355], [105, 500], [-105, 500], [-160, 355], [-160, -390]]),
    polygon("nyc-central-park", "Central Park", "park", [[-116, 78], [116, 78], [116, 315], [-116, 315]]),
    polygon("nyc-lower", "Lower Manhattan", "district", [[-152, -465], [152, -465], [152, -255], [-152, -255]]),
    polygon("nyc-midtown", "Midtown", "district", [[-152, -250], [152, -250], [152, 75], [-152, 75]]),
    polygon("nyc-upper", "Upper Manhattan", "district", [[-152, 320], [152, 320], [108, 470], [-108, 470]])
  ]
};

function chicagoRoads() {
  const roads: Road[] = [];
  const northSouth = [
    [-390, "Kedzie Avenue"],
    [-330, "Western Avenue"],
    [-270, "Damen Avenue"],
    [-210, "Ashland Avenue"],
    [-150, "Halsted Street"],
    [-90, "Canal Street"],
    [-30, "State Street"],
    [30, "Wabash Avenue"],
    [88, "Michigan Avenue"]
  ] as const;
  northSouth.forEach(([x, name], index) => {
    roads.push(regionLine(
      name === "State Street" ? "chicago-state" : `chicago-north-south-${index + 1}`,
      name,
      name === "State Street" || name === "Michigan Avenue" ? "avenue" : "street",
      name === "State Street" || name === "Michigan Avenue" ? 13 : 9,
      [[x, -455], [x, 455]],
      name === "State Street"
        ? { travelLanes: 4, speedLimitKph: 40, sidewalkWidth: 3.4, bikeLanes: false, busLanes: true, median: false, curbParking: false, streetTrees: true }
        : undefined
    ));
  });

  const eastWest = [
    [-420, "71st Street"],
    [-360, "63rd Street"],
    [-300, "55th Street"],
    [-240, "47th Street"],
    [-180, "35th Street"],
    [-120, "Roosevelt Road"],
    [-60, "Harrison Street"],
    [0, "Lake Street"],
    [60, "Chicago Avenue"],
    [120, "Division Street"],
    [180, "North Avenue"],
    [240, "Fullerton Avenue"],
    [300, "Diversey Parkway"],
    [360, "Belmont Avenue"],
    [420, "Irving Park Road"]
  ] as const;
  eastWest.forEach(([z, name], index) => {
    roads.push(regionLine(
      name === "Lake Street" ? "chicago-lake" : `chicago-east-west-${index + 1}`,
      name,
      name === "Roosevelt Road" || name === "Lake Street" || name === "North Avenue" ? "avenue" : "street",
      name === "Roosevelt Road" || name === "Lake Street" || name === "North Avenue" ? 13 : 9,
      [[-455, z], [118, z]],
      name === "Lake Street"
        ? { travelLanes: 4, speedLimitKph: 40, sidewalkWidth: 3, bikeLanes: false, busLanes: true, median: false, curbParking: false, streetTrees: true }
        : undefined
    ));
  });

  roads.push(regionLine(
    "chicago-lake-shore",
    "DuSable Lake Shore Drive",
    "arterial",
    22,
    [[92, -455], [112, -280], [108, -100], [120, 80], [108, 260], [82, 455]],
    { travelLanes: 6, speedLimitKph: 60, sidewalkWidth: 2.4, bikeLanes: true, busLanes: false, median: true, curbParking: false, streetTrees: true }
  ));
  roads.push(regionLine(
    "chicago-kennedy",
    "Kennedy and Dan Ryan Expressway",
    "arterial",
    24,
    [[-430, 420], [-310, 265], [-205, 150], [-112, 20], [-165, -145], [-255, -300], [-350, -450]],
    { travelLanes: 6, speedLimitKph: 80, sidewalkWidth: 1.2, bikeLanes: false, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "chicago-milwaukee",
    "Milwaukee Avenue",
    "avenue",
    12,
    [[-385, 360], [-270, 235], [-165, 120], [-65, 10]],
    { travelLanes: 2, speedLimitKph: 35, sidewalkWidth: 3, bikeLanes: true, busLanes: false, median: false, curbParking: true, streetTrees: true }
  ));
  roads.push(regionLine(
    "chicago-lakefront-trail",
    "Lakefront Trail",
    "street",
    5,
    [[125, -420], [137, -230], [132, -40], [142, 150], [126, 330], [105, 445]],
    { travelLanes: 1, speedLimitKph: 20, sidewalkWidth: 3, bikeLanes: true, busLanes: false, median: false, curbParking: false, streetTrees: true },
    false
  ));
  [-42, 18].forEach((z, index) => {
    roads.push(regionLine(
      `chicago-loop-alley-${index + 1}`,
      index ? "Loop Service Alley South" : "Loop Service Alley North",
      "street",
      6,
      [[-82, z], [75, z]],
      { travelLanes: 1, speedLimitKph: 20, sidewalkWidth: 1.2, bikeLanes: false, busLanes: false, median: false, curbParking: false, streetTrees: false },
      false
    ));
  });
  return roads;
}

export const CHICAGO_TEMPLATE: WorldTemplate = {
  id: "chicago",
  name: "Chicago Foundation",
  description: "A flexible lakefront grid with the Chicago River, compact blocks, service alleys, diagonal corridors, broad arterials, and distinct north, west, south, and Loop districts.",
  roads: chicagoRoads(),
  areas: [
    regionPolygon("chicago-land", "Chicago", "land", [[-500, -500], [130, -500], [145, -350], [128, -190], [150, -20], [138, 170], [120, 340], [95, 500], [-500, 500]]),
    regionPolygon("chicago-river-main", "Main Branch", "water", [[-390, -14], [145, -14], [145, 8], [-390, 8]]),
    regionPolygon("chicago-river-north", "North Branch", "water", [[-128, -8], [-114, -8], [-165, 224], [-181, 224]]),
    regionPolygon("chicago-river-south", "South Branch", "water", [[-128, -8], [-110, -8], [-153, -282], [-171, -282]]),
    regionPolygon("chicago-grant-park", "Grant Park", "park", [[48, -150], [108, -150], [108, -35], [48, -35]]),
    regionPolygon("chicago-lincoln-park", "Lincoln Park", "park", [[74, 155], [119, 155], [106, 415], [62, 415]]),
    regionPolygon("chicago-loop", "The Loop", "district", [[-95, -85], [55, -85], [55, 55], [-95, 55]]),
    regionPolygon("chicago-near-north", "Near North Side", "district", [[-145, 65], [110, 65], [105, 275], [-145, 275]]),
    regionPolygon("chicago-west-side", "West Side", "district", [[-455, -120], [-170, -120], [-170, 310], [-455, 310]]),
    regionPolygon("chicago-south-side", "South Side", "district", [[-455, -455], [110, -455], [110, -130], [-455, -130]])
  ]
};

function houstonRoads() {
  const roads: Road[] = [];
  const northSouth = [
    [-420, "Eldridge Parkway"],
    [-300, "Gessner Road"],
    [-180, "Hillcroft Avenue"],
    [-60, "Main Street"],
    [60, "Fannin Street"],
    [180, "Lockwood Drive"],
    [300, "Wayside Drive"],
    [420, "Federal Road"]
  ] as const;
  northSouth.forEach(([x, name], index) => roads.push(regionLine(
    name === "Main Street" ? "houston-main" : `houston-north-south-${index + 1}`,
    name,
    name === "Main Street" ? "avenue" : "street",
    name === "Main Street" ? 14 : 10,
    [[x, -470], [x, 470]],
    name === "Main Street"
      ? { travelLanes: 4, speedLimitKph: 40, sidewalkWidth: 3.2, bikeLanes: false, busLanes: true, median: true, curbParking: false, streetTrees: true }
      : undefined
  )));
  const eastWest = [
    [-420, "Almeda Genoa Road"],
    [-300, "Holcombe Boulevard"],
    [-180, "Westheimer Road"],
    [-60, "Richmond Avenue"],
    [80, "Washington Avenue"],
    [200, "West 18th Street"],
    [320, "Tidwell Road"],
    [440, "Little York Road"]
  ] as const;
  eastWest.forEach(([z, name], index) => roads.push(regionLine(
    `houston-east-west-${index + 1}`,
    name,
    name === "Westheimer Road" || name === "Richmond Avenue" ? "avenue" : "street",
    name === "Westheimer Road" || name === "Richmond Avenue" ? 14 : 10,
    [[-470, z], [470, z]]
  )));
  roads.push(regionLine(
    "houston-i10",
    "Interstate 10",
    "arterial",
    26,
    [[-500, 38], [500, 38]],
    { travelLanes: 8, speedLimitKph: 100, sidewalkWidth: 1.2, bikeLanes: false, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "houston-i45",
    "Interstate 45",
    "arterial",
    24,
    [[-285, 500], [-150, 280], [-42, 45], [65, -225], [225, -500]],
    { travelLanes: 6, speedLimitKph: 100, sidewalkWidth: 1.2, bikeLanes: false, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "houston-us59",
    "Interstate 69 and US 59",
    "arterial",
    24,
    [[-500, -315], [-210, -180], [-35, -20], [230, 125], [500, 265]],
    { travelLanes: 6, speedLimitKph: 90, sidewalkWidth: 1.2, bikeLanes: false, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "houston-loop-610",
    "Interstate 610 Loop",
    "arterial",
    24,
    [[-350, -320], [325, -320], [390, -220], [390, 250], [305, 340], [-330, 340], [-395, 245], [-395, -235], [-350, -320]],
    { travelLanes: 6, speedLimitKph: 90, sidewalkWidth: 1.2, bikeLanes: false, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  [18, 58].forEach((z, index) => roads.push(regionLine(
    `houston-i10-frontage-${index + 1}`,
    index ? "Katy Freeway North Frontage Road" : "Katy Freeway South Frontage Road",
    "avenue",
    12,
    [[-480, z], [480, z]],
    { travelLanes: 3, speedLimitKph: 50, sidewalkWidth: 2, bikeLanes: false, busLanes: false, median: false, curbParking: false, streetTrees: false }
  )));
  roads.push(regionLine(
    "houston-allen-parkway",
    "Allen Parkway",
    "avenue",
    14,
    [[-330, 96], [-210, 72], [-80, 92], [45, 68], [170, 94]],
    { travelLanes: 4, speedLimitKph: 50, sidewalkWidth: 3, bikeLanes: true, busLanes: false, median: true, curbParking: false, streetTrees: true }
  ));
  roads.push(regionLine(
    "houston-brays-trail",
    "Brays Bayou Greenway",
    "street",
    5,
    [[-430, -245], [-245, -220], [-70, -250], [115, -212], [330, -250]],
    { travelLanes: 1, speedLimitKph: 20, sidewalkWidth: 3, bikeLanes: true, busLanes: false, median: false, curbParking: false, streetTrees: true },
    false
  ));
  return roads;
}

export const HOUSTON_TEMPLATE: WorldTemplate = {
  id: "houston",
  name: "Houston Foundation",
  description: "A flexible bayou metropolis with freeway loops, frontage roads, large parcels, floodplain tradeoffs, industrial corridors, warm climate, and mixed low-density growth.",
  roads: houstonRoads(),
  areas: [
    regionPolygon("houston-land", "Houston Region", "land", [[-520, -520], [520, -520], [520, 520], [-520, 520]]),
    regionPolygon("houston-buffalo-floodplain", "Buffalo Bayou Floodplain", "floodplain", [[-510, 45], [-340, 58], [-190, 45], [-40, 62], [110, 46], [270, 64], [510, 48], [510, 122], [265, 128], [105, 108], [-45, 124], [-195, 104], [-345, 118], [-510, 102]], "high"),
    regionPolygon("houston-brays-floodplain", "Brays Bayou Floodplain", "floodplain", [[-500, -285], [-315, -252], [-145, -286], [35, -244], [215, -278], [500, -240], [500, -185], [220, -215], [40, -184], [-140, -220], [-310, -196], [-500, -225]], "moderate"),
    regionPolygon("houston-white-oak-floodplain", "White Oak Bayou Floodplain", "floodplain", [[-350, 490], [-305, 490], [-155, 115], [-195, 92]], "moderate"),
    regionPolygon("houston-buffalo-bayou", "Buffalo Bayou", "water", [[-510, 73], [-340, 84], [-190, 70], [-40, 88], [110, 72], [270, 90], [510, 76], [510, 94], [270, 108], [110, 90], [-40, 106], [-190, 88], [-340, 102], [-510, 91]]),
    regionPolygon("houston-brays-bayou", "Brays Bayou", "water", [[-500, -255], [-315, -224], [-145, -258], [35, -216], [215, -250], [500, -212], [500, -198], [215, -234], [35, -200], [-145, -242], [-315, -208], [-500, -241]]),
    regionPolygon("houston-memorial-park", "Memorial Park", "park", [[-300, 112], [-155, 112], [-155, 235], [-300, 235]]),
    regionPolygon("houston-hermann-park", "Hermann Park", "park", [[-35, -245], [70, -245], [70, -150], [-35, -150]]),
    regionPolygon("houston-downtown", "Downtown", "district", [[-120, -70], [105, -70], [105, 125], [-120, 125]]),
    regionPolygon("houston-energy-corridor", "Energy Corridor", "district", [[-500, -165], [-275, -165], [-275, 175], [-500, 175]]),
    regionPolygon("houston-ship-channel", "Ship Channel", "district", [[205, -180], [500, -180], [500, 180], [205, 180]]),
    regionPolygon("houston-medical-center", "Texas Medical Center", "district", [[-90, -315], [110, -315], [110, -135], [-90, -135]])
  ]
};

function seattleRoads() {
  const roads: Road[] = [];
  const northSouth = [
    [-250, "15th Avenue West"],
    [-190, "Elliott Avenue"],
    [-130, "1st Avenue"],
    [-70, "3rd Avenue"],
    [-10, "Broadway"],
    [50, "12th Avenue"],
    [110, "23rd Avenue"],
    [170, "Martin Luther King Jr Way"],
    [225, "Lake Washington Boulevard"]
  ] as const;
  northSouth.forEach(([x, name], index) => roads.push(regionLine(
    name === "3rd Avenue" ? "seattle-third" : `seattle-north-south-${index + 1}`,
    name,
    name === "3rd Avenue" || name === "23rd Avenue" ? "avenue" : "street",
    name === "3rd Avenue" || name === "23rd Avenue" ? 12 : 9,
    [[x, -450], [x + (index % 2 ? 8 : -6), 450]],
    name === "3rd Avenue"
      ? { travelLanes: 4, speedLimitKph: 30, sidewalkWidth: 4, bikeLanes: false, busLanes: true, median: false, curbParking: false, streetTrees: true }
      : name === "Lake Washington Boulevard"
        ? { travelLanes: 2, speedLimitKph: 30, sidewalkWidth: 3, bikeLanes: true, busLanes: false, median: false, curbParking: true, streetTrees: true }
        : undefined
  )));
  const eastWest = [
    [-420, "South Henderson Street"],
    [-340, "South Orcas Street"],
    [-260, "South Spokane Street"],
    [-180, "South Jackson Street"],
    [-100, "Madison Street"],
    [-20, "Pine Street"],
    [60, "Denny Way"],
    [140, "Eastlake Avenue"],
    [220, "North 45th Street"],
    [320, "North 65th Street"],
    [410, "North 85th Street"]
  ] as const;
  eastWest.forEach(([z, name], index) => roads.push(regionLine(
    `seattle-east-west-${index + 1}`,
    name,
    name === "Madison Street" || name === "Denny Way" || name === "North 45th Street" ? "avenue" : "street",
    name === "Madison Street" || name === "Denny Way" || name === "North 45th Street" ? 12 : 9,
    [[-285, z], [245, z]]
  )));
  roads.push(regionLine(
    "seattle-i5",
    "Interstate 5",
    "arterial",
    22,
    [[35, -500], [20, -250], [32, 0], [22, 260], [42, 500]],
    { travelLanes: 6, speedLimitKph: 90, sidewalkWidth: 1.2, bikeLanes: false, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "seattle-sr99",
    "State Route 99",
    "arterial",
    18,
    [[-175, -500], [-160, -245], [-170, -20], [-150, 240], [-165, 500]],
    { travelLanes: 4, speedLimitKph: 70, sidewalkWidth: 1.5, bikeLanes: false, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "seattle-520-bridge",
    "State Route 520 Bridge",
    "arterial",
    18,
    [[35, 175], [480, 175]],
    { travelLanes: 4, speedLimitKph: 80, sidewalkWidth: 2.4, bikeLanes: true, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "seattle-i90-bridge",
    "Interstate 90 Bridge",
    "arterial",
    20,
    [[40, -185], [480, -185]],
    { travelLanes: 6, speedLimitKph: 80, sidewalkWidth: 2, bikeLanes: true, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "seattle-west-bridge",
    "West Seattle Bridge",
    "arterial",
    16,
    [[-480, -270], [-210, -270]],
    { travelLanes: 4, speedLimitKph: 60, sidewalkWidth: 2, bikeLanes: true, busLanes: false, median: true, curbParking: false, streetTrees: false },
    false
  ));
  roads.push(regionLine(
    "seattle-burke-gilman",
    "Burke-Gilman Trail",
    "street",
    5,
    [[-250, 280], [-90, 235], [70, 265], [235, 340]],
    { travelLanes: 1, speedLimitKph: 20, sidewalkWidth: 3.2, bikeLanes: true, busLanes: false, median: false, curbParking: false, streetTrees: true },
    false
  ));
  return roads;
}

export const SEATTLE_TEMPLATE: WorldTemplate = {
  id: "seattle",
  name: "Seattle Foundation",
  description: "A flexible sound-and-lake city with constrained corridors, bridge crossings, mapped steep slopes, compact urban villages, bike routes, cool wet climate, and narrow developable land.",
  roads: seattleRoads(),
  areas: [
    regionPolygon("seattle-land", "Seattle", "land", [[-315, -520], [275, -520], [300, -350], [270, -160], [290, 40], [265, 240], [285, 520], [-300, 520], [-330, 300], [-305, 90], [-345, -130], [-320, -340]]),
    regionPolygon("seattle-lake-washington", "Lake Washington", "water", [[245, -520], [520, -520], [520, 520], [255, 520], [275, 330], [245, 120], [270, -80], [240, -300]]),
    regionPolygon("seattle-lake-union", "Lake Union", "water", [[-112, 92], [88, 92], [110, 225], [42, 278], [-78, 260], [-125, 198]]),
    regionPolygon("seattle-ship-canal", "Lake Washington Ship Canal", "water", [[-300, 225], [-72, 225], [-72, 250], [-300, 250]]),
    regionPolygon("seattle-queen-anne-slope", "Queen Anne Hill", "slope", [[-225, 35], [-95, 35], [-75, 185], [-205, 205]], undefined, "steep"),
    regionPolygon("seattle-capitol-hill-slope", "Capitol Hill", "slope", [[-20, -40], [145, -40], [155, 150], [-10, 150]], undefined, "moderate"),
    regionPolygon("seattle-beacon-hill-slope", "Beacon Hill", "slope", [[-15, -390], [145, -390], [130, -150], [-35, -150]], undefined, "steep"),
    regionPolygon("seattle-west-ridge-slope", "West Seattle Ridge", "slope", [[-315, -440], [-185, -440], [-195, -215], [-330, -215]], undefined, "moderate"),
    regionPolygon("seattle-discovery-park", "Discovery Park", "park", [[-300, 260], [-175, 260], [-175, 410], [-300, 410]]),
    regionPolygon("seattle-seward-park", "Seward Park", "park", [[165, -450], [250, -450], [245, -325], [175, -325]]),
    regionPolygon("seattle-downtown", "Downtown", "district", [[-190, -190], [25, -190], [25, 35], [-190, 35]]),
    regionPolygon("seattle-capitol-hill", "Capitol Hill", "district", [[-15, -75], [165, -75], [165, 155], [-15, 155]]),
    regionPolygon("seattle-ballard", "Ballard", "district", [[-300, 240], [-95, 240], [-95, 440], [-300, 440]]),
    regionPolygon("seattle-west", "West Seattle", "district", [[-315, -470], [-175, -470], [-175, -215], [-315, -215]]),
    regionPolygon("seattle-university", "University District", "district", [[55, 235], [220, 235], [220, 420], [55, 420]])
  ]
};

export const BLANK_TEMPLATE: WorldTemplate = {
  id: "blank",
  name: "Blank Region",
  description: "An open landscape for a completely original city.",
  roads: [],
  areas: [
    polygon("blank-land", "Open region", "land", [[-520, -520], [520, -520], [520, 520], [-520, 520]])
  ]
};

export const WORLD_TEMPLATES = {
  nyc: NYC_TEMPLATE,
  chicago: CHICAGO_TEMPLATE,
  houston: HOUSTON_TEMPLATE,
  seattle: SEATTLE_TEMPLATE,
  blank: BLANK_TEMPLATE
} satisfies Record<WorldTemplate["id"], WorldTemplate>;

export type TemplateRegionalConfig = {
  defaultCityName: string;
  climate: {
    monthlyTemperature: number[];
    wetThreshold: Record<Season, number>;
    snowThreshold: number;
    windBase: number;
  };
  transit: { roadId: string; lineName: string; stopNames: string[] } | null;
  parkingRoadIds: string[];
  event: { id: string; name: string; kind: CityEventKind; roadId: string } | null;
};

export const TEMPLATE_REGIONAL_CONFIGS: Record<WorldTemplate["id"], TemplateRegionalConfig> = {
  nyc: {
    defaultCityName: "New Gridless City",
    climate: {
      monthlyTemperature: [-1, 1, 6, 12, 18, 23, 26, 25, 21, 14, 8, 2],
      wetThreshold: { winter: 30, spring: 42, summer: 34, autumn: 38 },
      snowThreshold: 18,
      windBase: 6
    },
    transit: {
      roadId: "nyc-broadway",
      lineName: "Broadway Local B1",
      stopNames: ["Lower Broadway", "Canal Street", "Union Square", "Times Square", "Columbus Circle", "Upper Broadway", "Harlem Terminal", "North Terminal"]
    },
    parkingRoadIds: ["nyc-avenue-1", "nyc-avenue-3", "nyc-avenue-5"],
    event: { id: "template-event-broadway-market", name: "Broadway Night Market", kind: "market", roadId: "nyc-broadway" }
  },
  chicago: {
    defaultCityName: "New Lakeshore City",
    climate: {
      monthlyTemperature: [-6, -4, 3, 10, 17, 23, 26, 25, 20, 12, 4, -3],
      wetThreshold: { winter: 32, spring: 42, summer: 37, autumn: 36 },
      snowThreshold: 25,
      windBase: 12
    },
    transit: {
      roadId: "chicago-state",
      lineName: "State Street Connector C1",
      stopNames: ["South Side", "Bronzeville", "Roosevelt", "The Loop", "River North", "Near North", "Lincoln Park", "North Terminal"]
    },
    parkingRoadIds: ["chicago-state", "chicago-lake", "chicago-milwaukee"],
    event: { id: "template-event-state-street-arts", name: "State Street Arts Walk", kind: "market", roadId: "chicago-state" }
  },
  houston: {
    defaultCityName: "New Bayou City",
    climate: {
      monthlyTemperature: [13, 15, 19, 23, 27, 30, 31, 31, 28, 24, 18, 14],
      wetThreshold: { winter: 38, spring: 46, summer: 51, autumn: 43 },
      snowThreshold: 0,
      windBase: 8
    },
    transit: {
      roadId: "houston-main",
      lineName: "Main Street Rapid H1",
      stopNames: ["South Terminal", "Medical Center", "Museum District", "Midtown", "Downtown", "Northside", "North Terminal"]
    },
    parkingRoadIds: ["houston-main", "houston-i10-frontage-1", "houston-allen-parkway"],
    event: { id: "template-event-buffalo-bayou", name: "Buffalo Bayou Festival", kind: "concert", roadId: "houston-allen-parkway" }
  },
  seattle: {
    defaultCityName: "New Sound City",
    climate: {
      monthlyTemperature: [5, 6, 8, 11, 14, 17, 20, 20, 17, 12, 8, 5],
      wetThreshold: { winter: 60, spring: 48, summer: 22, autumn: 56 },
      snowThreshold: 4,
      windBase: 5
    },
    transit: {
      roadId: "seattle-third",
      lineName: "3rd Avenue Rapid S1",
      stopNames: ["Rainier Valley", "International District", "Pioneer Square", "Downtown", "Belltown", "Seattle Center", "North Terminal"]
    },
    parkingRoadIds: ["seattle-third", "seattle-east-west-5", "seattle-north-south-1"],
    event: { id: "template-event-waterfront-music", name: "Seattle Waterfront Music Walk", kind: "concert", roadId: "seattle-north-south-2" }
  },
  blank: {
    defaultCityName: "Untitled Region",
    climate: {
      monthlyTemperature: [-1, 1, 6, 12, 18, 23, 26, 25, 21, 14, 8, 2],
      wetThreshold: { winter: 30, spring: 42, summer: 34, autumn: 38 },
      snowThreshold: 18,
      windBase: 6
    },
    transit: null,
    parkingRoadIds: [],
    event: null
  }
};
