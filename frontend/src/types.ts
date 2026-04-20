export type FuelName = "Benzina" | "Gasolio" | "GPL" | "Metano" | "HVO" | string;

export type FuelMode = "self" | "served" | "all";

export interface FuelPrice {
  name: FuelName;
  isSelf: boolean;
  price: number;
  fuelId?: number | null;
}

export interface Station {
  id: number;
  brand?: string | null;
  name?: string | null;
  address?: string | null;
  municipality?: string | null;
  province?: string | null;
  lat: number;
  lng: number;
  distance?: number | null;
  insertDate?: string | null;
  fuels: FuelPrice[];
}

export interface SearchResponse {
  results: Station[];
  source: "mise_api" | "csv_fallback";
  degraded: boolean;
  message?: string | null;
}

export interface FuelStat {
  fuel: string;
  avgSelf: number | null;
  avgServed: number | null;
  count: number;
}

export interface StatsResponse {
  stats: FuelStat[];
  totalStations: number;
  csvLastUpdate: string | null;
}

export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  type?: string;
}

export interface UserPreferences {
  favoriteFuel: FuelName;
  mode: FuelMode;
  radius: number;
  lastPosition?: { lat: number; lng: number };
}
