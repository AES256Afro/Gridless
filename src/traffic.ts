import type { Point2 } from "./world";
import {
  trafficSignalState,
  type StreetIntersection,
  type TrafficSignalState
} from "./streets";

export type TrafficSignalAxis = "a" | "b";
export type TrafficSignalColor = "red" | "yellow" | "green";

export type TrafficSignalApproach = {
  intersectionId: string;
  axis: TrafficSignalAxis;
  intersectionProgress: number;
  stopProgress: number;
  clearProgress: number;
};

export type TrafficVehiclePose = {
  point: Point2;
  tangent: Point2;
  progress: number;
  stopped: boolean;
  signalColor?: TrafficSignalColor;
  intersectionId?: string;
};

export type TrafficSignalAhead = {
  intersectionId: string;
  axis: TrafficSignalAxis;
  color: TrafficSignalColor;
  distance: number;
};

type RouteSegment = {
  a: Point2;
  b: Point2;
  startDistance: number;
  length: number;
  tangent: Point2;
};

export function trafficSignalColor(state: TrafficSignalState, axis: TrafficSignalAxis): TrafficSignalColor {
  if (state === "all-red" || !state.startsWith(axis)) return "red";
  return state.endsWith("yellow") ? "yellow" : "green";
}

export function trafficSignalApproaches(points: Point2[], intersections: StreetIntersection[]) {
  const metrics = routeMetrics(points);
  if (!metrics.totalLength) return [] as TrafficSignalApproach[];
  return intersections
    .map(intersection => {
      const projection = projectOntoRoute(intersection.point, metrics.segments);
      if (!projection) return undefined;
      const maximumOffset = Math.max(5, Math.min(11, Math.max(intersection.roadAWidth, intersection.roadBWidth) * .72));
      if (projection.offset > maximumOffset) return undefined;
      const axis = routeAxis(projection.tangent, intersection);
      const crossedRoadWidth = axis === "a" ? intersection.roadBWidth : intersection.roadAWidth;
      const stopDistance = Math.max(0, projection.distance - crossedRoadWidth / 2 - 2.4);
      const clearDistance = Math.min(metrics.totalLength, projection.distance + crossedRoadWidth / 2 + 2.4);
      return {
        intersectionId: intersection.id,
        axis,
        intersectionProgress: projection.distance / metrics.totalLength,
        stopProgress: stopDistance / metrics.totalLength,
        clearProgress: clearDistance / metrics.totalLength
      } satisfies TrafficSignalApproach;
    })
    .filter((approach): approach is TrafficSignalApproach => Boolean(approach))
    .sort((a, b) => a.stopProgress - b.stopProgress);
}

export function trafficVehiclePose(
  points: Point2[],
  rawProgress: number,
  intersections: StreetIntersection[],
  elapsedMinutes: number,
  laneOffset = 0
): TrafficVehiclePose {
  const requestedProgress = clamp(rawProgress, 0, 1);
  let progress = requestedProgress;
  let stoppedAt: TrafficSignalApproach | undefined;
  let signalColor: TrafficSignalColor | undefined;
  for (const approach of trafficSignalApproaches(points, intersections)) {
    if (requestedProgress < approach.stopProgress || requestedProgress > approach.clearProgress) continue;
    const color = trafficSignalColor(trafficSignalState(approach.intersectionId, elapsedMinutes), approach.axis);
    if (color !== "red") continue;
    progress = Math.min(progress, approach.stopProgress);
    stoppedAt = approach;
    signalColor = color;
    break;
  }

  const routePoint = pointAtProgress(points, progress);
  const normal = { x: routePoint.tangent.z, z: -routePoint.tangent.x };
  return {
    point: {
      x: routePoint.point.x + normal.x * laneOffset,
      z: routePoint.point.z + normal.z * laneOffset
    },
    tangent: routePoint.tangent,
    progress,
    stopped: Boolean(stoppedAt),
    signalColor,
    intersectionId: stoppedAt?.intersectionId
  };
}

export function trafficSignalAhead(
  position: Point2,
  forward: Point2,
  intersections: StreetIntersection[],
  elapsedMinutes: number,
  maximumDistance = 55
): TrafficSignalAhead | undefined {
  const direction = normalized(forward);
  let nearest: TrafficSignalAhead | undefined;
  for (const intersection of intersections) {
    const dx = intersection.point.x - position.x;
    const dz = intersection.point.z - position.z;
    const distanceAhead = dx * direction.x + dz * direction.z;
    if (distanceAhead <= 0 || distanceAhead > maximumDistance) continue;
    const crossTrack = Math.abs(dx * direction.z - dz * direction.x);
    const axis = routeAxis(direction, intersection);
    const roadWidth = axis === "a" ? intersection.roadAWidth : intersection.roadBWidth;
    if (crossTrack > roadWidth / 2 + 3.5) continue;
    const color = trafficSignalColor(trafficSignalState(intersection.id, elapsedMinutes), axis);
    if (!nearest || distanceAhead < nearest.distance) {
      nearest = { intersectionId: intersection.id, axis, color, distance: distanceAhead };
    }
  }
  return nearest;
}

function routeAxis(tangent: Point2, intersection: StreetIntersection): TrafficSignalAxis {
  const alignmentA = Math.abs(tangent.x * intersection.tangentA.x + tangent.z * intersection.tangentA.z);
  const alignmentB = Math.abs(tangent.x * intersection.tangentB.x + tangent.z * intersection.tangentB.z);
  return alignmentA >= alignmentB ? "a" : "b";
}

function routeMetrics(points: Point2[]) {
  const segments: RouteSegment[] = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (!length) continue;
    segments.push({
      a,
      b,
      startDistance: totalLength,
      length,
      tangent: { x: dx / length, z: dz / length }
    });
    totalLength += length;
  }
  return { segments, totalLength };
}

function projectOntoRoute(point: Point2, segments: RouteSegment[]) {
  let nearest: { distance: number; offset: number; tangent: Point2 } | undefined;
  for (const segment of segments) {
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    const amount = clamp(
      ((point.x - segment.a.x) * dx + (point.z - segment.a.z) * dz) / (segment.length * segment.length),
      0,
      1
    );
    const projected = {
      x: segment.a.x + dx * amount,
      z: segment.a.z + dz * amount
    };
    const offset = Math.hypot(point.x - projected.x, point.z - projected.z);
    if (!nearest || offset < nearest.offset) {
      nearest = {
        distance: segment.startDistance + segment.length * amount,
        offset,
        tangent: segment.tangent
      };
    }
  }
  return nearest;
}

function pointAtProgress(points: Point2[], progress: number) {
  const metrics = routeMetrics(points);
  if (!metrics.segments.length) {
    return {
      point: points[0] ? { ...points[0] } : { x: 0, z: 0 },
      tangent: { x: 0, z: -1 }
    };
  }
  const distance = metrics.totalLength * clamp(progress, 0, 1);
  for (const segment of metrics.segments) {
    if (distance > segment.startDistance + segment.length) continue;
    const amount = clamp((distance - segment.startDistance) / segment.length, 0, 1);
    return {
      point: {
        x: segment.a.x + (segment.b.x - segment.a.x) * amount,
        z: segment.a.z + (segment.b.z - segment.a.z) * amount
      },
      tangent: segment.tangent
    };
  }
  const last = metrics.segments[metrics.segments.length - 1];
  return { point: { ...last.b }, tangent: last.tangent };
}

function normalized(point: Point2) {
  const length = Math.hypot(point.x, point.z) || 1;
  return { x: point.x / length, z: point.z / length };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
