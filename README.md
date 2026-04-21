# Osservaprezzi Carburanti

UI moderna e responsive sui dati ufficiali del **MIMIT** (ex MISE) per consultare i prezzi dei carburanti in Italia. Sostituisce l'esperienza di `carburanti.mise.gov.it` con una mappa interattiva, filtri, preferiti e ricerca per raggio.

- **Backend**: FastAPI + Uvicorn (Python 3.11)
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Leaflet
- **Dati**: CSV pubblici MIMIT (snapshot giornaliero 08:00) + API non ufficiale `ospzApi/search/zone` (real-time entro 10 km)
- **Distribuzione**: binario standalone PyInstaller (macOS/Linux/Windows) oppure immagine Docker multi-arch

## Funzionalità

- Mappa Leaflet con marker colorati per prezzo (verde < media, giallo = media, rosso > media)
- Filtri: tipo carburante (Benzina, Gasolio, GPL, Metano, HVO), modalità self/servito, raggio 0.5–30 km
- Geolocalizzazione nativa (HTTPS/localhost) o "Segnala posizione" (tap sulla mappa) come fallback su HTTP
- Preferiti persistenti in `localStorage` + marker oro in mappa
- Media prezzi nazionale e locale con delta vs media
- Auto-refresh ogni 60 minuti + aggiornamento manuale
- Dark mode
- Mobile-first con bottom sheet
- Indicatore di stato ("Scarico CSV…", "Elaboro dati…", "Cerco impianti…")
- Degradazione graceful: se l'API real-time è giù, usa il CSV come fallback

## Architettura dati

| Sorgente | Uso | Freschezza |
| --- | --- | --- |
| `ospzApi/search/zone` (MIMIT) | Ricerca per raggio ≤ 10 km | Real-time |
| `anagrafica_impianti_attivi.csv` | Anagrafica stazioni + enrichment indirizzi | Giornaliero 08:00 |
| `prezzo_alle_8.csv` | Prezzi e fallback oltre i 10 km | Giornaliero 08:00 |

Il CSV viene scaricato in background all'avvio e rinfrescato ogni ora. La cache sta in RAM nel container Docker (tmpfs), oppure in `~/.carburanti/cache` sul binario standalone.

---

## Installazione

### Opzione A — Docker Compose (sistemi Linux/macOS/Windows)

Serve `docker` + `docker compose`. Clona e avvia:

```bash
git clone https://github.com/shiner66/OsservatorioMIMIT-web.git
cd OsservatorioMIMIT-web
docker compose up -d
```

Apri http://localhost:8765.

Per usare l'immagine pre-buildata da GHCR anziché buildare localmente, sostituisci `build: .` con `image: ghcr.io/shiner66/osservatoriomimit-web:latest` nel `docker-compose.yml`.

Comandi utili:

```bash
docker compose logs -f      # vedi i log (download CSV, API, ecc.)
docker compose pull         # aggiorna l'immagine
docker compose restart      # riavvia (la cache in tmpfs si rigenera)
docker compose down         # stop + rimuovi container
```

### Opzione B — Docker CLI senza compose

```bash
docker run -d \
  --name osservaprezzi \
  --restart unless-stopped \
  -p 8765:8765 \
  --tmpfs /tmp/carburanti:size=128M,mode=1777 \
  ghcr.io/shiner66/osservatoriomimit-web:latest
```

### Opzione C — Unraid

1. Vai su **Docker** → **Add Container**
2. In **Template**, incolla il link al template XML raw del repo:
   ```
   https://raw.githubusercontent.com/shiner66/OsservatorioMIMIT-web/main/unraid-template.xml
   ```
3. Conferma. I default sono:
   - **Repository**: `ghcr.io/shiner66/osservatoriomimit-web:latest`
   - **Network**: Bridge
   - **Port**: `8765` host → `8765` container
   - **ExtraParams**: `--tmpfs /tmp/carburanti:size=128M,mode=1777` (cache CSV in RAM)
4. **Apply**, poi clicca sull'icona del container → **WebUI** per aprire l'interfaccia.

Nessun path da mappare: la cache è in RAM, si rigenera a ogni avvio.

### Opzione D — Binario standalone (senza Docker)

Scarica il binario per il tuo OS dalla sezione [Releases](https://github.com/shiner66/OsservatorioMIMIT-web/releases) del repo (o dagli artifact del workflow `Build binaries` su GitHub Actions):

- `carburanti-linux-x86_64`
- `carburanti-macos-arm64`
- `carburanti-windows-x86_64.exe`

Rendilo eseguibile (Linux/macOS) e avvialo:

```bash
chmod +x carburanti-linux-x86_64
./carburanti-linux-x86_64
```

Si apre automaticamente il browser su http://localhost:8765.

Argomenti CLI:

| Flag | Default | Descrizione |
| --- | --- | --- |
| `--port N` | `8765` | Porta TCP |
| `--host IP` | `0.0.0.0` | IP di bind (LAN-accessible) |
| `--local-only` | off | Bind solo su `127.0.0.1` (non raggiungibile dalla LAN) |
| `--no-browser` | off | Non aprire il browser all'avvio |

### Opzione E — Build locale dai sorgenti

Serve Python 3.11+, Node 20+, npm.

```bash
git clone https://github.com/shiner66/OsservatorioMIMIT-web.git
cd OsservatorioMIMIT-web
./build.sh          # crea dist/carburanti (binario standalone)
./dist/carburanti
```

Oppure in dev-mode (hot reload):

```bash
# terminale 1 — backend
pip install -r requirements.txt
python app.py --port 8765 --no-browser

# terminale 2 — frontend
cd frontend
npm install
npm run dev         # Vite su http://localhost:5173
```

---

## Variabili d'ambiente

| Variabile | Default | Descrizione |
| --- | --- | --- |
| `PORT` | `8765` | Porta HTTP |
| `HOST` | `0.0.0.0` | IP di bind |
| `CARBURANTI_CACHE` | `~/.carburanti/cache` (`/tmp/carburanti` in Docker) | Dove salvare i CSV scaricati |
| `CARBURANTI_OPEN_BROWSER` | `1` | A `0` disattiva l'apertura automatica del browser |

---

## Note sulla geolocalizzazione

Il browser blocca `navigator.geolocation` quando la pagina è servita via **HTTP non-localhost** (tipico accesso da LAN). In quel caso:

- **Chrome desktop**: funziona comunque su alcune reti considerate "sicure"
- **Safari/iOS e Chrome su iOS**: bloccata sempre senza HTTPS

Workaround integrati:
1. **Ricerca per città** nella search bar
2. **"Segnala posizione"**: appare un banner, tocca la mappa per impostare il centro manualmente

Per la geolocalizzazione automatica su LAN serve HTTPS. Metti davanti un reverse-proxy con certificato valido (es. Nginx Proxy Manager su Unraid + Let's Encrypt, oppure Caddy/Traefik con cert self-signed fidato).

---

## Note tecniche

### Cap di raggio della ricerca

L'API `ospzApi/search/zone` del MIMIT **ignora richieste con raggio > 10 km** (verificato empiricamente). Per raggi maggiori (fino a 30 km configurabili nel filtro UI), l'app unisce:

- risultati in tempo reale entro 10 km dall'API
- anagrafica + prezzi dallo snapshot CSV giornaliero per l'anello 10–30 km

Il frontend mostra un banner ambra ("Oltre i 10 km i prezzi provengono dal CSV giornaliero…") quando sta mischiando le due sorgenti.

### Fallback CSV

Se l'API MIMIT risponde 5xx o è irraggiungibile, l'app usa interamente il CSV (snapshot 08:00). Il banner indica "API in tempo reale non disponibile".

### Endpoint API

- `POST /api/search/position` — ricerca per raggio
- `POST /api/search/localita` — ricerca per regione/provincia/comune
- `GET  /api/data/stats` — medie nazionali per carburante
- `GET  /api/data/cheapest` — top N impianti per carburante
- `GET  /api/geo/search?q=…` — geocoding via Nominatim
- `GET  /api/geo/reverse?lat=…&lon=…` — reverse geocoding
- `GET  /api/health` — stato + info CSV

Swagger UI su http://localhost:8765/docs quando il server è in esecuzione.

---

## Licenza e dati

I dati provengono dal [portale MIMIT Osservaprezzi Carburanti](https://www.mimit.gov.it/it/) ed sono rilasciati in open-data. Questa UI è non-ufficiale e non affiliata al MIMIT.
