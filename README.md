# Investigații de teren – Însurăței

Aplicație web statică (fără backend) pentru raportarea investigațiilor geotehnice de teren
executate la Însurăței, jud. Brăila (foraje drumuri de acces – F și sondaje deschise / dezveliri – D).

Conține, pentru fiecare investigație:

- fotografii de teren (lăzi de carote, probe ambalate) + fișa manuscrisă;
- stratificația transcrisă din fișă, cu coloană litologică desenată automat;
- nivelul apei subterane (NH) / infiltrații (IN);
- coordonate GPS din teren (WGS84) și punctul proiectat (Stereo 70), cu abaterea dintre ele;
- probele netulburate (ștuțuri) consemnate în fișă;
- condițiile meteo din ziua execuției (Open-Meteo, reanaliză ERA5);
- hartă interactivă (OpenStreetMap / satelit Esri) cu toate punctele proiectate din KML;
- calendar de execuție, centralizator tabelar și export CSV.

## Structura

```
index.html            aplicația (HTML + CSS + JS, un singur fișier)
data.json             datele structurate (generat)
photos/<ID>/          poze optimizate (1200 px) + miniaturi t_*.jpg (generat)
scripts/build_data.py generatorul de date
scripts/meteo.json    răspunsul Open-Meteo pentru perioada de execuție
```

## Regenerarea datelor

```bash
python3 scripts/build_data.py \
  --fise   "fise foraj Insuratei.xlsx" \
  --facute "foraje facute.xlsx" \
  --kml    "OSTSG – Investigații geotehnice Faza I – UAT Însurăței.kml" \
  --poze   "Insuratei FORAJE" \
  --meteo  scripts/meteo.json \
  --out    .
```

Necesită `openpyxl` și `Pillow`. Folderul cu poze trebuie să conțină subfoldere `Foraj Nxx` / `Dezvelire Nxx`;
fișierul cu `fisa` în nume este tratat ca fișă manuscrisă.

Meteo: `scripts/meteo.json` se obține de la

```
https://archive-api.open-meteo.com/v1/archive?latitude=44.87&longitude=27.56&start_date=AAAA-LL-ZZ&end_date=AAAA-LL-ZZ&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,relative_humidity_2m_mean,sunshine_duration&timezone=Europe/Bucharest
```

## Rulare locală

Browserele nu permit `fetch('data.json')` de pe `file://`, deci:

```bash
python -m http.server 8000
# apoi http://localhost:8000
```

## Publicare pe GitHub Pages

1. Creează un repository nou pe GitHub (ex. `raport-foraje-insuratei`).
2. În folderul aplicației:
   ```bash
   git init
   git add .
   git commit -m "Raport investigații de teren Însurăței"
   git branch -M main
   git remote add origin https://github.com/<utilizator>/raport-foraje-insuratei.git
   git push -u origin main
   ```
3. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)` → Save.
4. Aplicația va fi disponibilă la `https://<utilizator>.github.io/raport-foraje-insuratei/`.

## Observații asupra datelor

- Fișa Fr92 (cod fișă F92) este datată în manuscris „23.10.2026” (eroare de scriere); s-a reținut 23.09.2026 din lista de execuție.
- Fișa Fr91 (cod fișă F91) indică 28.09.2026, lista de execuție 29.09.2026; s-a reținut data din lista de execuție. Corectează în `data.json` dacă fișa este cea corectă.
- D93 nu are GPS în fișă; pe hartă este plasat în punctul proiectat.
- Probele tulburate pe strat (vizibile în pozele lăzilor) nu sunt listate în fișe; se pot adăuga manual în `data.json → investigatii[].probe`.
- Denumirile investigațiilor sunt cele din KML (`Fr67`, `D67`); codul scurt din fișa Excel (`F67`) apare ca „cod fișă”.
- Secțiunea „Stadiu execuție” compară forajele de drum (Fr) și dezvelirile (D) executate cu cele proiectate în KML.
- Intro 3D (`intro3d.js`, Three.js r128): bloc de teren stilizat din `terrain.json` (grilă EU-DEM 25 m, 20×20) cu carotele extrase animat în ordinea execuției; relief exagerat ×30, carote ×110. Se dezactivează singur dacă WebGL nu e disponibil.
- Folderul `gis/` (local, pe Drive) conține proiectul QGIS al hărții apei subterane și scriptul `build_map.py`.
