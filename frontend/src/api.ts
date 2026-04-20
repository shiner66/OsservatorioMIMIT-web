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

export function health(): Promise<{ csvLastUpdate: string | null; stationsLoaded: number }> {
  return request("/api/health");
}
