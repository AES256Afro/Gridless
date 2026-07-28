import * as THREE from "three";
import type { Point2, Road, TransitLine, TransitStop } from "./world";

export type TransitDirection = 1 | -1;

export type TransitRide = {
  lineId: string;
  progress: number;
  direction: TransitDirection;
  alightStopId?: string;
};

export type TransitVehiclePose = {
  point: Point2;
  tangent: Point2;
  progress: number;
  direction: TransitDirection;
};

export function initialTransitLines(roads: Road[]): TransitLine[] {
  const candidates = roads.filter(road => road.points.length > 1);
  if (!candidates.length) return [];
  const road = candidates.find(candidate => candidate.id === "nyc-broadway")
    ?? [...candidates].sort((a, b) => approximateRoadLength(b) - approximateRoadLength(a))[0];
  const curve = new THREE.CatmullRomCurve3(
    road.points.map(point => new THREE.Vector3(point.x, 0, point.z)),
    false,
    "centripetal"
  );
  const length = curve.getLength();
  const route = curve
    .getSpacedPoints(Math.max(8, Math.ceil(length / 10)))
    .map(point => ({ x: point.x, z: point.z }));
  const stopCount = Math.max(4, Math.min(8, Math.round(length / 145)));
  const stopNames = road.id === "nyc-broadway"
    ? ["Lower Broadway", "Canal Street", "Union Square", "Times Square", "Columbus Circle", "Upper Broadway", "Harlem Terminal", "North Terminal"]
    : [];
  const stops: TransitStop[] = Array.from({ length: stopCount }, (_, index) => {
    const progress = .04 + index / Math.max(1, stopCount - 1) * .92;
    const position = transitPoseAtProgress(
      {
        id: "transit-preview",
        name: "Preview",
        mode: "bus",
        color: 0x2d79a7,
        route,
        stops: [],
        travelMinutes: 1
      },
      progress,
      1,
      road.width / 2 + 1.35
    ).point;
    return {
      id: `transit-stop-${road.id}-${index + 1}`,
      name: stopNames[index] ?? `${road.name ?? "City Line"} Stop ${index + 1}`,
      position,
      progress
    };
  });
  return [{
    id: `transit-line-${road.id}`,
    name: road.id === "nyc-broadway" ? "Broadway Local B1" : `${road.name ?? "City"} Local`,
    mode: "bus",
    color: 0x2d79a7,
    route,
    stops,
    travelMinutes: Math.max(6, Math.round(length / 150 + stopCount * .65))
  }];
}

export function nearestTransitStop(lines: TransitLine[], point: Point2, maximumDistance = Infinity) {
  let nearest: { line: TransitLine; stop: TransitStop; distance: number } | undefined;
  for (const line of lines) {
    for (const stop of line.stops) {
      const distance = Math.hypot(stop.position.x - point.x, stop.position.z - point.z);
      if (distance > maximumDistance || nearest && distance >= nearest.distance) continue;
      nearest = { line, stop, distance };
    }
  }
  return nearest;
}

export function scheduledTransitPose(line: TransitLine, elapsedMinutes: number, laneOffset = 2.5) {
  const terminalDwell = .75;
  const oneWay = Math.max(1, line.travelMinutes);
  const cycle = oneWay * 2 + terminalDwell * 2;
  const phase = positiveModulo(elapsedMinutes, cycle);
  if (phase < oneWay) {
    return transitPoseAtProgress(line, phase / oneWay, 1, laneOffset);
  }
  if (phase < oneWay + terminalDwell) {
    return transitPoseAtProgress(line, 1, -1, laneOffset);
  }
  if (phase < oneWay * 2 + terminalDwell) {
    const returning = (phase - oneWay - terminalDwell) / oneWay;
    return transitPoseAtProgress(line, 1 - returning, -1, laneOffset);
  }
  return transitPoseAtProgress(line, 0, 1, laneOffset);
}

export function beginTransitRide(line: TransitLine, stopId: string): TransitRide | undefined {
  const stopIndex = line.stops.findIndex(stop => stop.id === stopId);
  if (stopIndex < 0) return undefined;
  return {
    lineId: line.id,
    progress: line.stops[stopIndex].progress,
    direction: stopIndex === line.stops.length - 1 ? -1 : 1
  };
}

export function requestTransitAlight(ride: TransitRide, line: TransitLine): TransitRide {
  if (ride.alightStopId) return ride;
  const stops = ride.direction === 1 ? line.stops : [...line.stops].reverse();
  const next = stops.find(stop =>
    ride.direction === 1
      ? stop.progress > ride.progress + .0001
      : stop.progress < ride.progress - .0001
  );
  return { ...ride, alightStopId: next?.id ?? stops[0]?.id };
}

export function advanceTransitRide(
  ride: TransitRide,
  line: TransitLine,
  distanceMeters: number
): { ride: TransitRide; arrivedStop?: TransitStop } {
  const routeLength = polylineLength(line.route);
  if (!routeLength || distanceMeters <= 0) return { ride };
  let direction = ride.direction;
  let progress = ride.progress + direction * distanceMeters / routeLength;
  if (progress >= 1) {
    progress = 1 - (progress - 1);
    direction = -1;
  } else if (progress <= 0) {
    progress = -progress;
    direction = 1;
  }
  progress = clamp(progress, 0, 1);
  const target = ride.alightStopId
    ? line.stops.find(stop => stop.id === ride.alightStopId)
    : undefined;
  const crossedTarget = target && (
    ride.direction === 1
      ? ride.progress <= target.progress && progress >= target.progress
      : ride.progress >= target.progress && progress <= target.progress
  );
  if (crossedTarget) {
    return {
      ride: { ...ride, progress: target.progress, direction },
      arrivedStop: target
    };
  }
  return { ride: { ...ride, progress, direction } };
}

export function transitPoseAtProgress(
  line: TransitLine,
  progress: number,
  direction: TransitDirection,
  laneOffset = 0
): TransitVehiclePose {
  const location = pointAtProgress(line.route, progress);
  const tangent = direction === 1
    ? location.tangent
    : { x: -location.tangent.x, z: -location.tangent.z };
  const right = { x: tangent.z, z: -tangent.x };
  return {
    point: {
      x: location.point.x + right.x * laneOffset,
      z: location.point.z + right.z * laneOffset
    },
    tangent,
    progress: clamp(progress, 0, 1),
    direction
  };
}

function pointAtProgress(points: Point2[], progress: number) {
  const lengths = points.slice(0, -1).map((point, index) =>
    Math.hypot(points[index + 1].x - point.x, points[index + 1].z - point.z)
  );
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total || points.length < 2) {
    return {
      point: points[0] ? { ...points[0] } : { x: 0, z: 0 },
      tangent: { x: 0, z: -1 }
    };
  }
  let remaining = total * clamp(progress, 0, 1);
  for (let index = 0; index < lengths.length; index++) {
    if (remaining > lengths[index]) {
      remaining -= lengths[index];
      continue;
    }
    const amount = lengths[index] ? remaining / lengths[index] : 0;
    const dx = points[index + 1].x - points[index].x;
    const dz = points[index + 1].z - points[index].z;
    const length = lengths[index] || 1;
    return {
      point: {
        x: points[index].x + dx * amount,
        z: points[index].z + dz * amount
      },
      tangent: { x: dx / length, z: dz / length }
    };
  }
  const last = points.length - 1;
  const dx = points[last].x - points[last - 1].x;
  const dz = points[last].z - points[last - 1].z;
  const length = Math.hypot(dx, dz) || 1;
  return {
    point: { ...points[last] },
    tangent: { x: dx / length, z: dz / length }
  };
}

function polylineLength(points: Point2[]) {
  return points.slice(0, -1).reduce((total, point, index) =>
    total + Math.hypot(points[index + 1].x - point.x, points[index + 1].z - point.z), 0
  );
}

function approximateRoadLength(road: Road) {
  return polylineLength(road.points);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
