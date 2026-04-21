import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, FlaskConical, RotateCcw } from "lucide-react";
import { getAdvancedSettings, updateAdvancedSettings } from "../api";

export function AdvancedSettings() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: getAdvancedSettings,
    enabled: open,
    staleTime: 60_000,
  });
  const [draftKm, setDraftKm] = useState<number>(10);

  useEffect(() => {
    if (settingsQuery.data) setDraftKm(Math.round(settingsQuery.data.miseMaxRadiusM / 1000));
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: (miseMaxRadiusM: number) => updateAdvancedSettings(miseMaxRadiusM),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });

  const currentKm = settingsQuery.data ? Math.round(settingsQuery.data.miseMaxRadiusM / 1000) : null;
  const defaultKm = settingsQuery.data ? Math.round(settingsQuery.data.miseMaxRadiusDefaultM / 1000) : 10;
  const hardCapKm = settingsQuery.data ? Math.round(settingsQuery.data.miseHardCapM / 1000) : 50;
  const dirty = currentKm != null && draftKm !== currentKm;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
      >
        <FlaskConical className="w-4 h-4" />
        Sperimentale
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Il sito MIMIT ufficiale ammette la ricerca per zona fino a {defaultKm} km. Valori
              superiori <b>potrebbero essere ignorati</b> dal server remoto: prova e controlla se
              il numero di impianti cambia.
            </span>
          </div>
          <label className="block">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Raggio massimo API MIMIT: {draftKm} km
            </span>
            <input
              type="range"
              min={1}
              max={hardCapKm}
              step={1}
              value={draftKm}
              onChange={(e) => setDraftKm(Number(e.target.value))}
              className="w-full mt-1 accent-brand-600"
              disabled={settingsQuery.isLoading}
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1 km</span>
              <span>{defaultKm} km (default)</span>
              <span>{hardCapKm} km</span>
            </div>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => mutation.mutate(draftKm * 1000)}
              disabled={!dirty || mutation.isPending}
              className="flex-1 px-2 py-1.5 rounded bg-brand-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Salvo…" : "Applica"}
            </button>
            <button
              onClick={() => {
                setDraftKm(defaultKm);
                mutation.mutate(defaultKm * 1000);
              }}
              disabled={mutation.isPending}
              className="px-2 py-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
              title="Ripristina default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {mutation.isError && (
            <div className="text-rose-600">Errore salvataggio impostazioni.</div>
          )}
        </div>
      )}
    </div>
  );
}
