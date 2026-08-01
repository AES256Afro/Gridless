import type { LotDensity, Zone } from "./world";

export type BuildingProgram = {
  label: string;
  totalFloors: number;
  residentialFloors: number;
  commercialFloors: number;
  civicFloors: number;
  productionFloors: number;
  podiumHeight: number;
  publicFacing: boolean;
  groundFloor: string;
  access: string;
  occupancy: string;
};

export function buildingProgram(
  zone: Zone,
  density: LotDensity,
  households: number,
  businesses: number,
  height: number
): BuildingProgram {
  const totalFloors = Math.max(1, Math.round(height / 3.2));
  const intendedCommercialFloors = density === "low" ? 1 : density === "high" ? 3 : 2;
  let residentialFloors = 0;
  let commercialFloors = 0;
  let civicFloors = 0;
  let productionFloors = 0;
  if (zone === "residential") residentialFloors = totalFloors;
  if (zone === "commercial") commercialFloors = totalFloors;
  if (zone === "mixed") {
    commercialFloors = Math.min(Math.max(1, totalFloors - 1), intendedCommercialFloors);
    residentialFloors = Math.max(1, totalFloors - commercialFloors);
  }
  if (zone === "industrial") productionFloors = totalFloors;
  if (zone === "civic") civicFloors = totalFloors;
  const publicFacing = zone === "mixed" || zone === "commercial" || zone === "civic";
  const podiumFloors = zone === "mixed" ? commercialFloors : publicFacing ? Math.min(2, totalFloors) : 0;
  const label = zone === "mixed"
    ? "Vertical mixed use"
    : zone === "residential"
      ? "Residential building"
      : zone === "commercial"
        ? "Commercial building"
        : zone === "industrial"
          ? "Production building"
          : zone === "civic"
            ? "Civic building"
            : "Unassigned building";
  const groundFloor = zone === "mixed"
    ? "Shops and neighborhood services"
    : zone === "commercial"
      ? "Public storefronts and lobby"
      : zone === "civic"
        ? "Public entrance and services"
        : zone === "industrial"
          ? "Loading and production"
          : "Residential entrance";
  return {
    label,
    totalFloors,
    residentialFloors,
    commercialFloors,
    civicFloors,
    productionFloors,
    podiumHeight: Math.min(height * .38, podiumFloors * 3.6),
    publicFacing,
    groundFloor,
    access: zone === "mixed" ? "Separate residential lobby and public storefront access" : `${groundFloor} access`,
    occupancy: `${households.toLocaleString()} households · ${businesses.toLocaleString()} businesses`
  };
}
