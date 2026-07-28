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
  blank: BLANK_TEMPLATE
} satisfies Record<string, WorldTemplate>;
