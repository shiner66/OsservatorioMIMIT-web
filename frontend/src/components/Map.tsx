import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Station } from "../types";

// Fix Leaflet default marker icons for Vite bundling.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function coloredIcon(color: string) {
  return L.divIcon({
    className: "custom-station-marker",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50% 50% 50% 0;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.35)"><div style="width:6px;height:6px;background:#fff;border-radius:50%;margin:6px auto 0;transform:rotate(45deg)"></div></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });
}

function colorForPrice(price: number | null, avg: number | null): string {
  if (price == null || avg == null) return "#64748b";
  const diff = price - avg;
  if (diff <= -0.02) return "#10b981"; // verde
  if (diff >= 0.02) return "#ef4444"; // rosso
  return "#f59e0b"; // giallo
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.6 });
  }, [lat, lng, zoom, map]);
  return null;
}

function LongPressToSetCenter({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    contextmenu(e) {
      // desktop: click destro
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  center: { lat: number; lng: number };
  stations: Station[];
  highlightFuel: string;
  avgPrice: number | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onPickCenter?: (lat: number, lng: number) => void;
  favorites?: Set<number>;
}

export function StationsMap({
  center,
  stations,
  highlightFuel,
  avgPrice,
  selectedId,
  onSelect,
  onPickCenter,
  favorites,
}: Props) {
  // Pre-calcola icone e prezzi una sola volta per render — evita di ricreare
  // istanze L.divIcon (costose) ad ogni aggiornamento del componente padre.
  const markerData = useMemo(
    () =>
      stations.map((s) => {
        const price = s.fuels.find((f) => f.name === highlightFuel)?.price ?? null;
        const isFav = favorites?.has(s.id) ?? false;
        const color = isFav ? "#f59e0b" : colorForPrice(price, avgPrice);
        return { station: s, price, icon: coloredIcon(color) };
      }),
    [stations, highlightFuel, avgPrice, favorites],
  );

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={center.lat} lng={center.lng} />
      {onPickCenter && <LongPressToSetCenter onPick={onPickCenter} />}
      <Marker position={[center.lat, center.lng]} icon={coloredIcon("#2563eb")}>
        <Popup>La tua posizione</Popup>
      </Marker>
      {markerData.map(({ station: s, price, icon }) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={icon}
          eventHandlers={{ click: () => onSelect(s.id) }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{s.brand || s.name || "Impianto"}</div>
              {s.address && <div className="text-xs text-slate-500">{s.address}</div>}
              {price != null && (
                <div className="mt-1 font-mono">
                  {highlightFuel}: € {price.toFixed(3)}
                </div>
              )}
              {selectedId === s.id && <div className="mt-1 text-brand-600 text-xs">Selezionato</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
