import type { ExplorerRoadPath } from "./explorer";
import type { StreetIntersection } from "./streets";
import type {
  AccessibilityDestination,
  AccessibilityDestinationKind,
  ParkingFacility,
  Point2
} from "./world";

export type AccessibleRoute = {
  points: Point2[];
  distance: number;
  rampedCrossings: number;
};

export type AccessibleTripAssessment = {
  route?: AccessibleRoute;
  usable: boolean;
  barriers: string[];
};

type EdgeKind = "sidewalk" | "corner" | "crossing";
type Edge = { to: number; cost: number; kind: EdgeKind };
type PedestrianNode = {
  point: Point2;
  roadId: string;
  side: -1 | 1;
  edges: Edge[];
};

export function nearestParkingFacility(parking: ParkingFacility[], point: Point2, maximumDistance = Infinity) {
  return parking
    .filter(facility => facility.occupied < facility.capacity)
    .map(facility => ({
      facility,
      distance: Math.hypot(facility.position.x - point.x, facility.position.z - point.z)
    }))
    .filter(candidate => candidate.distance <= maximumDistance)
    .sort((a, b) => {
      const score = (candidate: typeof a) =>
        candidate.distance
        + candidate.facility.hourlyRate * 1.6
        + candidate.facility.occupied / Math.max(1, candidate.facility.capacity) * 8;
      return score(a) - score(b);
    })[0]?.facility;
}

export function nearestAccessibilityDestination(
  destinations: AccessibilityDestination[],
  point: Point2,
  kind?: AccessibilityDestinationKind
) {
  return destinations
    .filter(destination => kind === undefined || destination.kind === kind)
    .map(destination => ({
      destination,
      distance: distance(destination.position, point)
    }))
    .sort((a, b) => a.distance - b.distance || a.destination.name.localeCompare(b.destination.name))[0];
}

export function assessAccessibleTrip(
  paths: ExplorerRoadPath[],
  intersections: StreetIntersection[],
  start: Point2,
  destination: Pick<AccessibilityDestination, "position" | "usable">
): AccessibleTripAssessment {
  const route = buildAccessibleRoute(paths, intersections, start, destination.position);
  const barriers: string[] = [];
  if (!route) barriers.push("No connected sidewalk route");
  if (!destination.usable) barriers.push("Entrance is not step-free");
  return {
    route,
    usable: Boolean(route) && destination.usable,
    barriers
  };
}

export function buildAccessibleRoute(
  paths: ExplorerRoadPath[],
  intersections: StreetIntersection[],
  start: Point2,
  end: Point2
): AccessibleRoute | undefined {
  const nodes: PedestrianNode[] = [];
  const byRoadSide = new Map<string, number[]>();
  const addEdge = (from: number, to: number, kind: EdgeKind, multiplier = 1) => {
    const cost = distance(nodes[from].point, nodes[to].point) * multiplier;
    nodes[from].edges.push({ to, cost, kind });
    nodes[to].edges.push({ to: from, cost, kind });
  };

  for (const path of paths) {
    for (const side of [-1, 1] as const) {
      const indices: number[] = [];
      path.points.forEach((point, index) => {
        const previous = path.points[Math.max(0, index - 1)];
        const next = path.points[Math.min(path.points.length - 1, index + 1)];
        const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
        const tangent = { x: (next.x - previous.x) / length, z: (next.z - previous.z) / length };
        const normal = { x: tangent.z, z: -tangent.x };
        const offset = path.width / 2 + 1.1;
        const nodeIndex = nodes.length;
        nodes.push({
          point: {
            x: point.x + normal.x * offset * side,
            z: point.z + normal.z * offset * side
          },
          roadId: path.roadId,
          side,
          edges: []
        });
        indices.push(nodeIndex);
        if (indices.length > 1) addEdge(indices.at(-2)!, nodeIndex, "sidewalk");
      });
      byRoadSide.set(`${path.roadId}:${side}`, indices);
    }
  }
  if (!nodes.length) return undefined;

  for (const intersection of intersections) {
    const roadANodes = ([-1, 1] as const).map(side =>
      closestNode(byRoadSide.get(`${intersection.roadAId}:${side}`) ?? [], nodes, intersection.point)
    );
    const roadBNodes = ([-1, 1] as const).map(side =>
      closestNode(byRoadSide.get(`${intersection.roadBId}:${side}`) ?? [], nodes, intersection.point)
    );
    if (roadANodes.every(index => index !== undefined)) {
      addEdge(roadANodes[0]!, roadANodes[1]!, "crossing", 1.05);
    }
    if (roadBNodes.every(index => index !== undefined)) {
      addEdge(roadBNodes[0]!, roadBNodes[1]!, "crossing", 1.05);
    }
    for (const a of roadANodes) {
      for (const b of roadBNodes) {
        if (a === undefined || b === undefined) continue;
        if (distance(nodes[a].point, nodes[b].point) <= 20) addEdge(a, b, "corner", 1.08);
      }
    }
  }

  const startNode = closestNode(nodes.map((_, index) => index), nodes, start);
  const endNode = closestNode(nodes.map((_, index) => index), nodes, end);
  if (startNode === undefined || endNode === undefined) return undefined;

  const costs = new Array(nodes.length).fill(Infinity);
  const previous = new Array<number | undefined>(nodes.length);
  const previousKind = new Array<EdgeKind | undefined>(nodes.length);
  const queue = new MinHeap();
  costs[startNode] = 0;
  queue.push(startNode, 0);
  while (queue.size) {
    const current = queue.pop()!;
    if (current.cost !== costs[current.node]) continue;
    if (current.node === endNode) break;
    for (const edge of nodes[current.node].edges) {
      const nextCost = current.cost + edge.cost;
      if (nextCost >= costs[edge.to]) continue;
      costs[edge.to] = nextCost;
      previous[edge.to] = current.node;
      previousKind[edge.to] = edge.kind;
      queue.push(edge.to, nextCost);
    }
  }
  if (!Number.isFinite(costs[endNode])) return undefined;

  const nodePath: number[] = [];
  let cursor: number | undefined = endNode;
  while (cursor !== undefined) {
    nodePath.push(cursor);
    if (cursor === startNode) break;
    cursor = previous[cursor];
  }
  if (nodePath.at(-1) !== startNode) return undefined;
  nodePath.reverse();
  const rampedCrossings = nodePath
    .slice(1)
    .filter(node => previousKind[node] === "crossing")
    .length;
  const points = coalesce([
    start,
    ...nodePath.map(node => nodes[node].point),
    end
  ]);
  return {
    points,
    distance: costs[endNode] + distance(start, nodes[startNode].point) + distance(end, nodes[endNode].point),
    rampedCrossings
  };
}

function closestNode(indices: number[], nodes: PedestrianNode[], point: Point2) {
  let closest: number | undefined;
  let closestDistance = Infinity;
  for (const index of indices) {
    const candidateDistance = distance(nodes[index].point, point);
    if (candidateDistance < closestDistance) {
      closest = index;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}

function coalesce(points: Point2[]) {
  return points.filter((point, index) =>
    index === 0 || distance(point, points[index - 1]) > .05
  );
}

function distance(a: Point2, b: Point2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

class MinHeap {
  private values: Array<{ node: number; cost: number }> = [];

  get size() {
    return this.values.length;
  }

  push(node: number, cost: number) {
    this.values.push({ node, cost });
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].cost <= cost) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = { node, cost };
  }

  pop() {
    if (!this.values.length) return undefined;
    const root = this.values[0];
    const last = this.values.pop()!;
    if (!this.values.length) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child = right < this.values.length && this.values[right].cost < this.values[left].cost
        ? right
        : left;
      if (this.values[child].cost >= last.cost) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return root;
  }
}
