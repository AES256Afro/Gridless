import type { Point2 } from "./world";
import type { ExplorerRoadPath } from "./explorer";

export type StreetIntersection = {
  id: string;
  point: Point2;
  roadAId: string;
  roadAName: string;
  roadAWidth: number;
  tangentA: Point2;
  roadBId: string;
  roadBName: string;
  roadBWidth: number;
  tangentB: Point2;
};

export type TrafficSignalState = "a-green" | "a-yellow" | "all-red" | "b-green" | "b-yellow";

export function detectStreetIntersections(paths: ExplorerRoadPath[], mergeDistance = 8) {
  const intersections: StreetIntersection[] = [];
  for (let first = 0; first < paths.length; first++) {
    const roadA = paths[first];
    for (let second = first + 1; second < paths.length; second++) {
      const roadB = paths[second];
      for (let aIndex = 0; aIndex < roadA.points.length - 1; aIndex++) {
        const a1 = roadA.points[aIndex];
        const a2 = roadA.points[aIndex + 1];
        for (let bIndex = 0; bIndex < roadB.points.length - 1; bIndex++) {
          const b1 = roadB.points[bIndex];
          const b2 = roadB.points[bIndex + 1];
          if (!boundsOverlap(a1, a2, b1, b2)) continue;
          const crossing = segmentIntersection(a1, a2, b1, b2);
          if (!crossing) continue;
          const tangentA = normalized({ x: a2.x - a1.x, z: a2.z - a1.z });
          const tangentB = normalized({ x: b2.x - b1.x, z: b2.z - b1.z });
          if (Math.abs(tangentA.x * tangentB.x + tangentA.z * tangentB.z) > .94) continue;
          if (intersections.some(item => Math.hypot(item.point.x - crossing.x, item.point.z - crossing.z) < mergeDistance)) continue;
          const x = Math.round(crossing.x * 10) / 10;
          const z = Math.round(crossing.z * 10) / 10;
          intersections.push({
            id: `crossing-${roadA.roadId}-${roadB.roadId}-${x}-${z}`,
            point: { x, z },
            roadAId: roadA.roadId,
            roadAName: roadA.roadName,
            roadAWidth: roadA.width,
            tangentA,
            roadBId: roadB.roadId,
            roadBName: roadB.roadName,
            roadBWidth: roadB.width,
            tangentB
          });
        }
      }
    }
  }
  return intersections;
}

export function trafficSignalState(intersectionId: string, elapsedMinutes: number): TrafficSignalState {
  const phase = (Math.floor(elapsedMinutes) + stableHash(intersectionId) % 90) % 90;
  if (phase < 35) return "a-green";
  if (phase < 41) return "a-yellow";
  if (phase < 45) return "all-red";
  if (phase < 80) return "b-green";
  if (phase < 86) return "b-yellow";
  return "all-red";
}

function segmentIntersection(a1: Point2, a2: Point2, b1: Point2, b2: Point2) {
  const adx = a2.x - a1.x;
  const adz = a2.z - a1.z;
  const bdx = b2.x - b1.x;
  const bdz = b2.z - b1.z;
  const denominator = adx * bdz - adz * bdx;
  if (Math.abs(denominator) < .0001) return undefined;
  const dx = b1.x - a1.x;
  const dz = b1.z - a1.z;
  const alongA = (dx * bdz - dz * bdx) / denominator;
  const alongB = (dx * adz - dz * adx) / denominator;
  if (alongA < 0 || alongA > 1 || alongB < 0 || alongB > 1) return undefined;
  return { x: a1.x + adx * alongA, z: a1.z + adz * alongA };
}

function boundsOverlap(a1: Point2, a2: Point2, b1: Point2, b2: Point2) {
  return Math.max(a1.x, a2.x) + .01 >= Math.min(b1.x, b2.x)
    && Math.max(b1.x, b2.x) + .01 >= Math.min(a1.x, a2.x)
    && Math.max(a1.z, a2.z) + .01 >= Math.min(b1.z, b2.z)
    && Math.max(b1.z, b2.z) + .01 >= Math.min(a1.z, a2.z);
}

function normalized(point: Point2) {
  const length = Math.hypot(point.x, point.z) || 1;
  return { x: point.x / length, z: point.z / length };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
