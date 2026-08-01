import type { Area, Road, WorldTemplate } from "./world";

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

const regionPolygon = (id: string, name: string, kind: Area["kind"], points: Array<[number, number]>): Area => ({
  id,
  name,
  kind,
  points: points.map(([x, z]) => ({ x, z }))
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
  blank: BLANK_TEMPLATE
} satisfies Record<WorldTemplate["id"], WorldTemplate>;
