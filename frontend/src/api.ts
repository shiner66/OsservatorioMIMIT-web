import type { NominatimResult, SearchResponse, StatsResponse } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText} ${body}`);
  }
  return (await resp.json()) as T;
}

export function fetchStats(): Promise<StatsResponse> {
  return request<StatsResponse>("/api/data/stats");
}

export function searchByPosition(params: {
  lat: number;
  lon: number;
  radius: number;
  fuel?: string;
  order?: "asc" | "desc";
}): Promise<SearchResponse> {
  return request<SearchResponse>("/api/search/position", {
    method: "POST",
    body: JSON.stringify({ order: "asc", ...params }),
  });
}

export function geocode(query: string): Promise<NominatimResult[]> {
  const url = `/api/geo/search?q=${encodeURIComponent(query)}`;
  return request<NominatimResult[]>(url);
}

export function reverseGeocode(lat: number, lon: number): Promise<{ display_name?: string }> {
  return request(`/api/geo/reverse?lat=${lat}&lon=${lon}`);
}

export interface HealthResponse {
  status: string;
  csvLastUpdate: string | null;
  stationsLoaded: number;
  csvStatus: "idle" | "downloading" | "parsing" | "ready" | "failed";
  csvMessage: string | null;
}

export function health(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export interface AdvancedSettings {
  miseMaxRadiusM: number;
  miseMaxRadiusDefaultM: number;
  miseHardCapM: number;
}

export function getAdvancedSettings(): Promise<AdvancedSettings> {
  return request<AdvancedSettings>("/api/settings");
}

export function updateAdvancedSettings(miseMaxRadiusM: number): Promise<AdvancedSettings> {
  return request<AdvancedSettings>("/api/settings", {
    method: "POST",
    body: JSON.stringify({ miseMaxRadiusM }),
  });
}
