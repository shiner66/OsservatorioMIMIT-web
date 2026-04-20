import { useEffect, useRef, useState } from "react";
import { MapPin, Search, LocateFixed, Loader2 } from "lucide-react";
import { geocode } from "../api";
import type { NominatimResult } from "../types";

interface Props {
  onPick: (lat: number, lng: number, label?: string) => void;
  onLocate: () => void;
  locating: boolean;
}

export function SearchBar({ onPick, onLocate, locating }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await geocode(q.trim());
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [q]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder="Cerca una città o indirizzo"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          )}
        </div>
        <button
          onClick={onLocate}
          disabled={locating}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium shadow-sm"
          title="Usa la mia posizione"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          <span className="hidden sm:inline">Dove sono</span>
        </button>
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-auto">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
                  setQ(r.display_name.split(",")[0]);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <span className="text-sm">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
