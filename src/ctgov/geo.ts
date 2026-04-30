import { InvalidInputError } from "../errors";
import { US_ZIP_CENTROIDS_PACKED } from "./data/us-zip-centroids";

export interface GeoPoint {
  lat: number;
  lon: number;
}

let zipCentroids: Map<string, GeoPoint> | null = null;

export function resolveRadiusOrigin(params: {
  location?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
}): GeoPoint | null {
  if (params.radiusMiles === undefined) return null;
  if (
    !Number.isFinite(params.radiusMiles) ||
    params.radiusMiles < 1 ||
    params.radiusMiles > 500
  ) {
    throw new InvalidInputError("`radiusMiles` must be between 1 and 500.");
  }

  if (params.latitude !== undefined || params.longitude !== undefined) {
    if (params.latitude === undefined || params.longitude === undefined) {
      throw new InvalidInputError(
        "`latitude` and `longitude` must be provided together when using `radiusMiles`."
      );
    }
    return validateCoordinates(params.latitude, params.longitude);
  }

  if (!params.location?.trim()) {
    throw new InvalidInputError(
      "`location` must be a recognized U.S. ZIP code when using `radiusMiles`, unless `latitude` and `longitude` are provided."
    );
  }

  const zip = extractZip(params.location);
  if (!zip) {
    throw new InvalidInputError(
      "`location` must be a U.S. ZIP code like \"80202\" when using `radiusMiles`, unless `latitude` and `longitude` are provided."
    );
  }

  const origin = getZipCentroids().get(zip);
  if (!origin) {
    throw new InvalidInputError(
      `ZIP code "${zip}" was not found in the bundled U.S. ZIP centroid table.`
    );
  }
  return origin;
}

export function distanceMiles(a: GeoPoint, b: GeoPoint): number {
  const earthRadiusMiles = 3958.7613;
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);
  const deltaLat = degreesToRadians(b.lat - a.lat);
  const deltaLon = degreesToRadians(b.lon - a.lon);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function roundMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}

function validateCoordinates(latitude: number, longitude: number): GeoPoint {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new InvalidInputError("`latitude` must be a number between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new InvalidInputError(
      "`longitude` must be a number between -180 and 180."
    );
  }
  return { lat: latitude, lon: longitude };
}

function extractZip(location: string): string | null {
  const match = location.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match?.[1] ?? null;
}

function getZipCentroids(): Map<string, GeoPoint> {
  if (zipCentroids) return zipCentroids;

  const parsed = new Map<string, GeoPoint>();
  for (const line of US_ZIP_CENTROIDS_PACKED.split("\n")) {
    const [zip, lat, lon] = line.split(",");
    parsed.set(zip, {
      lat: Number(lat) / 10000,
      lon: Number(lon) / 10000,
    });
  }
  zipCentroids = parsed;
  return parsed;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
