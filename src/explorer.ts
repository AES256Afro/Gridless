import * as THREE from "three";
import type { Area, CityService, Lot, ParkingFacility, Point2, Road } from "./world";

export type ExplorerRoadPath = {
  roadId: string;
  roadName: string;
  width: number;
  points: Point2[];
};

export type NearestRoadLocation = {
  roadId: string;
  roadName: string;
  width: number;
  point: Point2;
  tangent: Point2;
  distance: number;
  signedDistance: number;
};

export type ExplorerCollisionContext = {
  landAreas: Area[];
  lots: Lot[];
  services: CityService[];
  parking?: ParkingFacility[];
  playerRadius?: number;
};

export function buildExplorerRoadPaths(roads: Road[], spacing = 6): ExplorerRoadPath[] {
  return roads
    .filter(road => road.points.length > 1)
    .map(road => {
      const curve = new THREE.CatmullRomCurve3(
        road.points.map(point => new THREE.Vector3(point.x, 0, point.z)),
        false,
        "centripetal"
      );
      return {
        roadId: road.id,
        roadName: road.name ?? "Unnamed road",
        width: road.width,
        points: curve
          .getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / Math.max(2, spacing))))
          .map(point => ({ x: point.x, z: point.z }))
      };
    });
}

export function nearestRoadLocation(paths: ExplorerRoadPath[], point: Point2): NearestRoadLocation | undefined {
  let nearest: NearestRoadLocation | undefined;
  for (const path of paths) {
    for (let index = 0; index < path.points.length - 1; index++) {
      const a = path.points[index];
      const b = path.points[index + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSquared = dx * dx + dz * dz;
      if (!lengthSquared) continue;
      const progress = clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared, 0, 1);
      const projected = { x: a.x + dx * progress, z: a.z + dz * progress };
      const length = Math.sqrt(lengthSquared);
      const tangent = { x: dx / length, z: dz / length };
      const normal = { x: tangent.z, z: -tangent.x };
      const side = (point.x - projected.x) * normal.x + (point.z - projected.z) * normal.z;
      const distance = Math.hypot(point.x - projected.x, point.z - projected.z);
      const signedDistance = distance * (side < 0 ? -1 : 1);
      if (!nearest || distance < nearest.distance) {
        nearest = {
          roadId: path.roadId,
          roadName: path.roadName,
          width: path.width,
          point: projected,
          tangent,
          distance,
          signedDistance
        };
      }
    }
  }
  return nearest;
}

export function sidewalkSpawn(
  paths: ExplorerRoadPath[],
  preferred: Point2,
  sidewalkWidth = 2.2,
  isValid?: (candidate: Point2) => boolean
) {
  const nearest = nearestRoadLocation(paths, preferred);
  if (!nearest) return { ...preferred };
  const normal = { x: nearest.tangent.z, z: -nearest.tangent.x };
  const side = nearest.signedDistance < 0 ? -1 : 1;
  const offset = nearest.width / 2 + sidewalkWidth * .52;
  const primary = {
    x: nearest.point.x + normal.x * offset * side,
    z: nearest.point.z + normal.z * offset * side
  };
  const isClearSidewalk = (candidate: Point2) =>
    explorerSurface(nearestRoadLocation(paths, candidate), sidewalkWidth) === "Sidewalk"
    && (isValid?.(candidate) ?? true);
  if (isClearSidewalk(primary)) return primary;

  const path = paths.find(candidate => candidate.roadId === nearest.roadId);
  if (!path) return primary;
  const candidates = path.points
    .map((point, index) => {
      const previous = path.points[Math.max(0, index - 1)];
      const next = path.points[Math.min(path.points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dz = next.z - previous.z;
      const length = Math.hypot(dx, dz);
      if (!length) return [];
      const pathNormal = { x: dz / length, z: -dx / length };
      return [-1, 1].map(candidateSide => ({
        x: point.x + pathNormal.x * offset * candidateSide,
        z: point.z + pathNormal.z * offset * candidateSide
      }));
    })
    .flat()
    .filter(isClearSidewalk)
    .sort((a, b) =>
      Math.hypot(a.x - preferred.x, a.z - preferred.z)
      - Math.hypot(b.x - preferred.x, b.z - preferred.z)
    );
  return candidates[0] ?? primary;
}

export function explorerSurface(location?: NearestRoadLocation, sidewalkWidth = 2.2) {
  if (!location) return "Open ground";
  const roadEdge = location.width / 2;
  if (location.distance <= roadEdge - .15) return "Roadway";
  if (location.distance <= roadEdge + sidewalkWidth) return "Sidewalk";
  if (location.distance <= roadEdge + sidewalkWidth + 2) return "Building frontage";
  return "City block";
}

export function resolveExplorerMovement(
  current: Point2,
  candidate: Point2,
  context: ExplorerCollisionContext
) {
  if (isExplorerPositionValid(candidate, context)) return { position: candidate, blocked: false };
  const xOnly = { x: candidate.x, z: current.z };
  if (isExplorerPositionValid(xOnly, context)) return { position: xOnly, blocked: true };
  const zOnly = { x: current.x, z: candidate.z };
  if (isExplorerPositionValid(zOnly, context)) return { position: zOnly, blocked: true };
  return { position: { ...current }, blocked: true };
}

export function isExplorerPositionValid(point: Point2, context: ExplorerCollisionContext) {
  const radius = context.playerRadius ?? .45;
  const landAreas = context.landAreas.filter(area => area.kind === "land");
  if (landAreas.length && !landAreas.some(area => pointInPolygon(point, area.points))) return false;
  if (context.lots.some(lot => lot.zone !== "unassigned" && pointInLotBuilding(point, lot, radius))) return false;
  if (context.services.some(service =>
    Math.hypot(point.x - service.position.x, point.z - service.position.z)
      < (service.kind === "school" ? 8 : 6.5) + radius
  )) return false;
  if (context.parking?.some(facility =>
    facility.kind === "garage" && pointInOrientedBox(point, facility.position, facility.rotation, 9.2, 11.2, radius)
  )) return false;
  return true;
}

export function pointInPolygon(point: Point2, polygon: Point2[]) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects = (a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / ((b.z - a.z) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInLotBuilding(point: Point2, lot: Lot, radius: number) {
  return pointInOrientedBox(point, lot.center, lot.rotation, lot.width * .31, lot.depth * .29, radius);
}

function pointInOrientedBox(
  point: Point2,
  center: Point2,
  rotation: number,
  halfWidth: number,
  halfDepth: number,
  radius: number
) {
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const localX = cosine * dx - sine * dz;
  const localZ = sine * dx + cosine * dz;
  return Math.abs(localX) < halfWidth + radius
    && Math.abs(localZ) < halfDepth + radius;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
