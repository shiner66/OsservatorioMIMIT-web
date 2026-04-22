export type FuelName = "Benzina" | "Gasolio" | "GPL" | "Metano" | "HVO";
/** Per i casi in cui il backend restituisce un nome carburante non noto. */
export type AnyFuelName = FuelName | string;

export type FuelMode = "self" | "served" | "all";

export interface FuelPrice {
  name: AnyFuelName;
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
  /** Raggio effettivo usato dal backend per la query MIMIT (può essere < del raggio richiesto). */
  effectiveRadius?: number | null;
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
  favorites: number[];
}

/** Risposta dell'endpoint /api/health. Unica fonte di verità (non duplicare in api.ts). */
export interface HealthResponse {
  status: string;
  csvLastUpdate: string | null;
  stationsLoaded: number;
  csvStatus: "idle" | "downloading" | "parsing" | "ready" | "failed";
  csvMessage: string | null;
}
