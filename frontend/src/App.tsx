import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronUp, Crosshair, Loader2, Moon, RefreshCw, Star, Sun } from "lucide-react";
import { fetchStats, health, searchByPosition } from "./api";
import { StationsMap } from "./components/Map";
import { StationCard } from "./components/StationCard";
import { SearchBar } from "./components/SearchBar";
import { FuelFilter } from "./components/FuelFilter";
import { PriceStats } from "./components/PriceStats";
import { useGeolocation } from "./hooks/useGeolocation";
import { usePreferences } from "./hooks/usePreferences";
import type { Station, UserPreferences } from "./types";

const AUTO_REFRESH_MS = 60 * 60 * 1000;
const DEFAULT_CENTER = { lat: 41.9028, lng: 12.4964 }; // Roma

const isSecureContext =
  typeof window !== "undefined" &&
  (window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname));

function formatFreshness(iso?: string | null) {
  if (!iso) return { label: "—", tone: "bg-slate-400" };
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const hours = (now - ts) / 36e5;
  if (hours < 1) return { label: "Dati freschi", tone: "bg-emerald-500" };
  if (hours < 6) return { label: `${Math.round(hours)}h fa`, tone: "bg-amber-500" };
  return { label: `${Math.round(hours)}h fa`, tone: "bg-rose-500" };
}

export default function App() {
  const { prefs, update, toggleFavorite } = usePreferences();
  const { position, locate, loading: locating, error: geoError, setPosition } = useGeolocation();
  const [center, setCenter] = useState(prefs.lastPosition ?? DEFAULT_CENTER);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_MS);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const MOBILE_LIMIT = 40;

  const handleFilterChange = useCallback(
    (patch: { fuel?: UserPreferences["favoriteFuel"]; mode?: UserPreferences["mode"]; radius?: number }) => {
      const { fuel, ...rest } = patch;
      update({ ...rest, ...(fuel !== undefined ? { favoriteFuel: fuel } : {}) });
    },
    [update],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (position) {
      setCenter({ lat: position.lat, lng: position.lng });
      update({ lastPosition: { lat: position.lat, lng: position.lng } });
    }
  }, [position, update]);

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 10 * 60 * 1000,
  });

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: health,
    // Finché il CSV sta caricando/parsando, poll rapido; poi rallenta.
    refetchInterval: (q) => {
      const s = q.state.data?.csvStatus;
      return s === "downloading" || s === "parsing" ? 2000 : 30_000;
    },
  });

  const searchQuery = useQuery({
    queryKey: ["search", center.lat, center.lng, prefs.radius],
    queryFn: () =>
      searchByPosition({
        lat: center.lat,
        lon: center.lng,
        radius: prefs.radius,
      }),
    refetchInterval: AUTO_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!searchQuery.dataUpdatedAt) return;
    setCountdown(AUTO_REFRESH_MS);
    const id = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [searchQuery.dataUpdatedAt]);

  const stations: Station[] = searchQuery.data?.results ?? [];
  const favoritesSet = useMemo(() => new Set(prefs.favorites), [prefs.favorites]);

  const filteredStations = useMemo(() => {
    const radiusKm = prefs.radius / 1000;
    return stations
      .map((s) => ({
        ...s,
        fuels: s.fuels.filter((f) => {
          if (f.name !== prefs.favoriteFuel) return false;
          if (prefs.mode === "self" && !f.isSelf) return false;
          if (prefs.mode === "served" && f.isSelf) return false;
          return true;
        }),
      }))
      .filter((s) => s.fuels.length > 0)
      .filter((s) => s.distance == null || s.distance <= radiusKm)
      .sort((a, b) => {
        const pa = a.fuels[0]?.price ?? Infinity;
        const pb = b.fuels[0]?.price ?? Infinity;
        return pa - pb;
      });
  }, [stations, prefs.favoriteFuel, prefs.mode, prefs.radius]);

  // Resetta la lista mobile quando i filtri cambiano (l'utente si aspetta
  // di ricominciare dalla cima della lista con il nuovo risultato).
  useEffect(() => {
    setShowAllMobile(false);
  }, [prefs.favoriteFuel, prefs.mode, prefs.radius]);

  const favoriteStations = useMemo(
    () => filteredStations.filter((s) => favoritesSet.has(s.id)),
    [filteredStations, favoritesSet],
  );
  const otherStations = useMemo(
    () => filteredStations.filter((s) => !favoritesSet.has(s.id)),
    [filteredStations, favoritesSet],
  );

  const avgPrice = useMemo(() => {
    const stat = statsQuery.data?.stats.find(
      (s) => s.fuel.toLowerCase() === prefs.favoriteFuel.toLowerCase(),
    );
    return stat?.avgSelf ?? stat?.avgServed ?? null;
  }, [statsQuery.data, prefs.favoriteFuel]);

  const localAvg = useMemo(() => {
    if (filteredStations.length === 0) return null;
    const prices = filteredStations
      .map((s) => s.fuels[0]?.price)
      .filter((p): p is number => typeof p === "number");
    if (!prices.length) return null;
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }, [filteredStations]);

  const fresh = formatFreshness(
    searchQuery.data?.source === "mise_api" ? new Date().toISOString() : statsQuery.data?.csvLastUpdate,
  );
  const degradedMsg = searchQuery.data?.degraded ? searchQuery.data.message : null;
  const csvStatus = healthQuery.data?.csvStatus;
  const csvBusy = csvStatus === "downloading" || csvStatus === "parsing";
  const searching = searchQuery.isFetching;
  const activityLabel = csvBusy
    ? healthQuery.data?.csvMessage ?? "Scarico dati MIMIT…"
    : searching
      ? "Cerco impianti…"
      : null;
  const selectedStation = filteredStations.find((s) => s.id === selectedId) ?? null;

  const handleMapPick = useCallback(
    (lat: number, lng: number) => {
      setCenter({ lat, lng });
      setPosition(null);
      setPickMode(false);
    },
    [setPosition],
  );

  const handleLocate = useCallback(() => {
    if (!isSecureContext) {
      // Non possiamo ottenere la geolocalizzazione su HTTP: attiva pick-on-map.
      setPickMode(true);
      return;
    }
    locate();
  }, [locate]);

  const geoBlocked = !isSecureContext;
  const hasPickedPosition =
    !!prefs.lastPosition ||
    center.lat !== DEFAULT_CENTER.lat ||
    center.lng !== DEFAULT_CENTER.lng;
  const headerWarning = geoError
    ? geoError
    : geoBlocked && !hasPickedPosition
      ? "Su HTTP la geolocalizzazione è bloccata dal browser. Usa la ricerca per città o tocca «Segnala posizione» e poi tocca la mappa."
      : null;

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm z-20">
        <h1 className="text-base sm:text-lg font-bold text-brand-700 dark:text-brand-500 shrink-0">
          Osservaprezzi
        </h1>
        <div className="flex-1 min-w-0 max-w-xl">
          <SearchBar
            onPick={(lat, lng) => {
              setCenter({ lat, lng });
              setPosition(null);
            }}
            onLocate={handleLocate}
            locating={locating}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {activityLabel ? (
            <span
              className="hidden sm:flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-700/20 px-2 py-1 rounded-full"
              title={activityLabel}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="max-w-[160px] truncate">{activityLabel}</span>
            </span>
          ) : (
            <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2 h-2 rounded-full ${fresh.tone}`} />
              {fresh.label}
            </span>
          )}
          <button
            onClick={() => searchQuery.refetch()}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Aggiorna dati"
            title={`Aggiorna (auto fra ${
              countdown >= 60000
                ? `${Math.floor(countdown / 60000)}m`
                : `${Math.floor(countdown / 1000)}s`
            })`}
          >
            <RefreshCw className={`w-4 h-4 ${searchQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setDark((d) => !d)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label={dark ? "Passa al tema chiaro" : "Passa al tema scuro"}
            title="Tema"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {csvBusy && (
        <div className="sm:hidden px-3 py-1.5 bg-brand-50 dark:bg-brand-700/20 border-b border-brand-200 dark:border-brand-700 text-xs text-brand-800 dark:text-brand-200 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="truncate">{healthQuery.data?.csvMessage ?? "Scarico dati MIMIT…"}</span>
        </div>
      )}
      {(degradedMsg || headerWarning) && (
        <div className="px-3 sm:px-4 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{headerWarning || degradedMsg}</span>
          {geoBlocked && (
            <button
              onClick={() => setPickMode((p) => !p)}
              className="shrink-0 px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 font-medium"
            >
              {pickMode ? "Annulla" : "Segnala posizione"}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 relative flex overflow-hidden">
        <aside className="hidden md:flex flex-col w-[380px] border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          <div className="p-3 space-y-3 border-b border-slate-200 dark:border-slate-700">
            <FuelFilter
              fuel={prefs.favoriteFuel}
              mode={prefs.mode}
              radius={prefs.radius}
              onChange={handleFilterChange}
            />
            {statsQuery.data && (
              <PriceStats
                stats={statsQuery.data.stats}
                highlightFuel={prefs.favoriteFuel}
                currentPrice={localAvg ?? filteredStations[0]?.fuels[0]?.price ?? null}
              />
            )}
          </div>
          <div className="p-3 space-y-2">
            {favoriteStations.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase tracking-wide">
                  <Star className="w-3 h-3" fill="currentColor" /> Preferiti
                </div>
                {favoriteStations.map((s) => (
                  <StationCard
                    key={`fav-${s.id}`}
                    station={s}
                    highlightFuel={prefs.favoriteFuel}
                    onSelect={() => setSelectedId(s.id)}
                    selected={selectedId === s.id}
                    priceBadge={priceBadge(s.fuels[0]?.price ?? null, avgPrice)}
                    favorite
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
                <div className="border-t border-slate-200 dark:border-slate-700 my-2" />
              </>
            )}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{otherStations.length} impianti nel raggio di {(prefs.radius / 1000).toFixed(1)} km</span>
              {activityLabel && (
                <span className="flex items-center gap-1 text-brand-700 dark:text-brand-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> {activityLabel}
                </span>
              )}
            </div>
            {otherStations.length === 0 && !searchQuery.isFetching && (
              <div className="text-sm text-slate-500 text-center py-8">
                Nessun impianto trovato. Prova ad aumentare il raggio o cambiare carburante.
              </div>
            )}
            {otherStations.map((s) => (
              <StationCard
                key={s.id}
                station={s}
                highlightFuel={prefs.favoriteFuel}
                onSelect={() => setSelectedId(s.id)}
                selected={selectedId === s.id}
                priceBadge={priceBadge(s.fuels[0]?.price ?? null, avgPrice)}
                favorite={favoritesSet.has(s.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </aside>

        <main className="flex-1 relative">
          <StationsMap
            center={center}
            stations={filteredStations}
            highlightFuel={prefs.favoriteFuel}
            avgPrice={avgPrice}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPickCenter={pickMode ? handleMapPick : undefined}
            favorites={favoritesSet}
          />
          {pickMode && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full bg-brand-600 text-white text-xs font-medium shadow-lg pointer-events-none">
              Tocca la mappa per impostare la posizione
            </div>
          )}
          <button
            onClick={() => setPickMode((p) => !p)}
            className={`md:hidden absolute right-3 top-3 z-[400] p-2.5 rounded-full shadow-lg ${
              pickMode ? "bg-brand-600 text-white" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            }`}
            title="Imposta posizione manualmente"
          >
            <Crosshair className="w-5 h-5" />
          </button>
        </main>

        {/* Mobile bottom sheet */}
        <div
          className="md:hidden absolute inset-x-0 bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-t-2xl shadow-xl bottom-sheet z-30"
          style={{
            transform: sheetOpen
              ? "translateY(0)"
              : "translateY(calc(100% - 148px - env(safe-area-inset-bottom)))",
            maxHeight: "85vh",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <button
            onClick={() => setSheetOpen((o) => !o)}
            className="w-full flex flex-col items-center pt-3 pb-2 active:bg-slate-100 dark:active:bg-slate-700 rounded-t-2xl"
            aria-label={sheetOpen ? "Chiudi pannello" : "Apri pannello"}
          >
            <span className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
              <ChevronUp
                className={`w-4 h-4 transition-transform ${sheetOpen ? "rotate-180" : ""}`}
              />
              {filteredStations.length} impianti — {prefs.favoriteFuel}
            </div>
            {localAvg != null && (
              <div className="text-xs text-slate-500 mt-0.5">
                media in zona € {localAvg.toFixed(3)}
                {avgPrice != null && (
                  <span className={localAvg <= avgPrice ? " text-emerald-600" : " text-rose-600"}>
                    {" "}
                    ({localAvg <= avgPrice ? "−" : "+"}
                    {Math.abs(localAvg - avgPrice).toFixed(3)} vs nazionale)
                  </span>
                )}
              </div>
            )}
          </button>
          <div
            className="px-3 pt-1 pb-4 space-y-3 overflow-y-auto overscroll-contain"
            style={{ maxHeight: "calc(85vh - 110px)" }}
          >
            <FuelFilter
              fuel={prefs.favoriteFuel}
              mode={prefs.mode}
              radius={prefs.radius}
              onChange={handleFilterChange}
            />
            {favoriteStations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase tracking-wide">
                  <Star className="w-3 h-3" fill="currentColor" /> Preferiti
                </div>
                {favoriteStations.map((s) => (
                  <StationCard
                    key={`mfav-${s.id}`}
                    station={s}
                    highlightFuel={prefs.favoriteFuel}
                    onSelect={() => setSelectedId(s.id)}
                    selected={selectedId === s.id}
                    priceBadge={priceBadge(s.fuels[0]?.price ?? null, avgPrice)}
                    favorite
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
                <div className="border-t border-slate-200 dark:border-slate-700" />
              </div>
            )}
            {(showAllMobile ? otherStations : otherStations.slice(0, MOBILE_LIMIT)).map((s) => (
              <StationCard
                key={s.id}
                station={s}
                highlightFuel={prefs.favoriteFuel}
                onSelect={() => setSelectedId(s.id)}
                selected={selectedId === s.id}
                priceBadge={priceBadge(s.fuels[0]?.price ?? null, avgPrice)}
                favorite={favoritesSet.has(s.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
            {!showAllMobile && otherStations.length > MOBILE_LIMIT && (
              <button
                onClick={() => setShowAllMobile(true)}
                className="w-full py-2 text-sm text-brand-600 dark:text-brand-400 font-medium hover:underline"
              >
                Mostra altri {otherStations.length - MOBILE_LIMIT} impianti
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedStation && (
        <div className="hidden md:block absolute bottom-4 right-4 w-[360px] z-10">
          <StationCard
            station={selectedStation}
            highlightFuel={prefs.favoriteFuel}
            selected
            priceBadge={priceBadge(selectedStation.fuels[0]?.price ?? null, avgPrice)}
            favorite={favoritesSet.has(selectedStation.id)}
            onToggleFavorite={toggleFavorite}
          />
        </div>
      )}
    </div>
  );
}

function priceBadge(price: number | null, avg: number | null): "cheap" | "mid" | "expensive" | null {
  if (price == null || avg == null) return null;
  const diff = price - avg;
  if (diff <= -0.02) return "cheap";
  if (diff >= 0.02) return "expensive";
  return "mid";
}
