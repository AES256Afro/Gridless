import * as THREE from "three";
import type { Point2, Road } from "./world";

type Node = {
  point: Point2;
  roadId: string;
  edges: Array<{ to: number; distance: number }>;
};

let cachedKey = "";
let cachedNodes: Node[] = [];

export function findRoadRoute(roads: Road[], start: Point2, end: Point2) {
  const nodes = roadGraph(roads);
  if (!nodes.length) return [start, end];
  const startNode = nearestNode(nodes, start);
  const endNode = nearestNode(nodes, end);
  const distances = new Float64Array(nodes.length);
  distances.fill(Infinity);
  const previous = new Int32Array(nodes.length);
  previous.fill(-1);
  const visited = new Uint8Array(nodes.length);
  distances[startNode] = 0;

  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1;
    let currentDistance = Infinity;
    for (let index = 0; index < nodes.length; index++) {
      if (!visited[index] && distances[index] < currentDistance) {
        current = index;
        currentDistance = distances[index];
      }
    }
    if (current === -1 || current === endNode) break;
    visited[current] = 1;
    for (const edge of nodes[current].edges) {
      const candidate = currentDistance + edge.distance;
      if (candidate < distances[edge.to]) {
        distances[edge.to] = candidate;
        previous[edge.to] = current;
      }
    }
  }

  if (!Number.isFinite(distances[endNode])) return [start, end];
  const route: Point2[] = [];
  for (let cursor = endNode; cursor !== -1; cursor = previous[cursor]) {
    route.push(nodes[cursor].point);
    if (cursor === startNode) break;
  }
  route.reverse();
  return [start, ...route, end];
}

export function routeLength(points: Point2[]) {
  let length = 0;
  for (let index = 0; index < points.length - 1; index++) {
    length += Math.hypot(points[index + 1].x - points[index].x, points[index + 1].z - points[index].z);
  }
  return length;
}

function roadGraph(roads: Road[]) {
  const key = roads.map(road => `${road.id}:${road.points.map(point => `${point.x.toFixed(1)},${point.z.toFixed(1)}`).join(";")}`).join("|");
  if (key === cachedKey) return cachedNodes;
  const nodes: Node[] = [];
  for (const road of roads) {
    const curve = new THREE.CatmullRomCurve3(road.points.map(point => new THREE.Vector3(point.x, 0, point.z)), false, "centripetal");
    const points = curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 16)));
    let previousIndex = -1;
    for (const point of points) {
      const index = nodes.length;
      nodes.push({ point: { x: point.x, z: point.z }, roadId: road.id, edges: [] });
      if (previousIndex !== -1) connect(nodes, previousIndex, index);
      previousIndex = index;
    }
  }

  const bucketSize = 18;
  const buckets = new Map<string, number[]>();
  nodes.forEach((node, index) => {
    const key = `${Math.floor(node.point.x / bucketSize)},${Math.floor(node.point.z / bucketSize)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(index);
    buckets.set(key, bucket);
  });
  nodes.forEach((node, index) => {
    const bucketX = Math.floor(node.point.x / bucketSize);
    const bucketZ = Math.floor(node.point.z / bucketSize);
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
        for (const otherIndex of buckets.get(`${bucketX + offsetX},${bucketZ + offsetZ}`) ?? []) {
          if (otherIndex <= index || nodes[otherIndex].roadId === node.roadId) continue;
          const distance = Math.hypot(nodes[otherIndex].point.x - node.point.x, nodes[otherIndex].point.z - node.point.z);
          if (distance <= 13.5) connect(nodes, index, otherIndex);
        }
      }
    }
  });
  cachedKey = key;
  cachedNodes = nodes;
  return nodes;
}

function connect(nodes: Node[], a: number, b: number) {
  const distance = Math.hypot(nodes[b].point.x - nodes[a].point.x, nodes[b].point.z - nodes[a].point.z);
  nodes[a].edges.push({ to: b, distance });
  nodes[b].edges.push({ to: a, distance });
}

function nearestNode(nodes: Node[], point: Point2) {
  let nearest = 0;
  let distance = Infinity;
  nodes.forEach((node, index) => {
    const candidate = Math.hypot(node.point.x - point.x, node.point.z - point.z);
    if (candidate < distance) {
      nearest = index;
      distance = candidate;
    }
  });
  return nearest;
}
