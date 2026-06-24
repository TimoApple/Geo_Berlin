# Geo_Berlin – Stand 18.06.2026 (260608)

## Worum geht's?

**GeoCheckr Berlin Street Edition** – eine App, die ArUco-Marker scannt, Berliner Straßen erkennt und Panorama-Bilder von einem privaten Server anzeigt. Kein Google API, keine Barcodes, keine Weltstädte.

---

## Repositories & Branches

### 1. `TimoApple/GeoChecker` (dieses Repo hier – `origin`)
- **Remote:** `origin` → `https://github.com/TimoApple/GeoChecker.git`
- **Aktueller Branch:** `master`
- **Letzter Commit:** `69f0533` (Fix: expo-av Video props)
- **Wichtige Commits:**
  - `ac299d0` — **"Berlin Street Edition: Panorama-Viewer, ArUco-Scanner, neues Setup"** ← Basis der Berlin App
  - `196d41f` — "ArUco Marker Scanner via ML Kit Text Recognition + Kamera-Integration"
  - `fe93517` — "Fix GitHub Actions workflow to trigger on master branch"
  - `adb2130` — "Initial commit for EAS build"
- **Letzter funktionaler Build (vor dem Reset):** Build #27743393604 (success)
- **Letzter Build (nach Reset):** Build #27781204554 (success) – aber mit falschem Code (alte Google Maps Städte)

### 2. `TimoApple/GeoCheckr` (anderes Repo – `geocheckr`)
- **Remote:** `geocheckr` → `https://github.com/TimoApple/GeoCheckr.git`
- **Wichtige Branches:**
  - `geocheckr/main` — Finale Google Maps Version **mit Slider** (Commit `50fb0d9`)
  - `geocheckr/german` — Deutsche Version (Commit `6767fc8`)
  - Tag `v1.0-working` auf Commit `c599a3e` — funktionaler Stand

---

## Aktueller Stand (18.06.2026)

### Was heute passiert ist:

1. **Build-Log analysiert** – `npm ci` scheiterte wegen `overrides` in package.json
2. **`overrides` entfernt** – damit `npm ci` wieder funktioniert
3. **`@react-native-ml-kit/text-recognition` wieder eingebaut** (Version ^2.0.0) – Texterkennung wird gebraucht!
4. **`react-native-video` wieder eingebaut** (Version ^6.12.0)
5. **`npm install`** → frische package-lock.json
6. **Commit & Push** nach `Geo_Berlin` (Commit `6991ac4`)
7. **Build #27781204554** → ✅ **completed success**

### Was noch falsch ist:

- **ArUco-Nummern sind mit alten Städten verknüpft** (Berlin, Tokyo, etc.) statt mit Berliner Straßen
- **`panoramaLocations.ts`** enthält noch die Google Maps API Locations (weltweit)
- **Texterkennung** muss wieder rein (wurde zwischenzeitlich rausgeworfen)
- **Slider** ist in der aktuellen `master` Version nicht drin – muss aus `geocheckr/main` übernommen werden
- **Neues Logo, Feedback, Texte** fehlen noch

---

## Nächste Schritte (ToDo)

### Phase 1: Build zum Laufen bringen (heute erledigt)
- [x] `overrides` aus package.json entfernt
- [x] `@react-native-ml-kit/text-recognition` (^2.0.0) wieder eingebaut
- [x] `react-native-video` (^6.12.0) wieder eingebaut
- [x] `npm install` → frische package-lock.json
- [x] Commit & Push → Build #27781204554 ✅

### Phase 2: Richtige Codebasis herstellen
- [ ] **Slider aus `geocheckr/main` übernehmen** – die neueste Version mit Slider im Setup
- [ ] **`geocheckr/german` mergen** – deutsche Texte, Intro, DE Farben
- [ ] **ArUco/Scanner-Logik aus `ac299d0` übernehmen** – Panorama-Viewer, ArUco-Scanner

### Phase 3: Datenbank auf Berliner Straßen umstellen
- [ ] **`panoramaLocations.ts`** umschreiben: ArUco-Nummern → Berliner Straßen
- [ ] **Panorama-URLs** auf privaten Server zeigen (`timoboese.com/pano/berlin/...`)
- [ ] **Backend-Logik** anpassen: nicht nach Städten suchen, sondern nach Straßen

### Phase 4: Texterkennung & Scanner
- [ ] **Texterkennung (OCR)** wieder funktionsfähig machen
- [ ] **Scanner.tsx** bereinigen – ArUco-Marker erkennen, Nummer auslesen
- [ ] **Manuelle Eingabe** als Fallback behalten

### Phase 5: Design & Inhalte
- [ ] **Neues Logo** einbinden
- [ ] **Feedback** von Timo einarbeiten
- [ ] **Deutsche Texte** für Berlin-Straßen-Edition
- [ ] **Intro/Tutorial** anpassen

### Phase 6: Build & Test
- [ ] Build auf GitHub Actions testen
- [ ] APK installieren und testen
- [ ] ArUco-Scan + Straßenerkennung testen

---

## Wichtige Builds

| Build ID | Status | Branch | Commit | Beschreibung |
|----------|--------|--------|--------|-------------|
| #27781204554 | ✅ success | `master` | `6991ac4` | Fix: overrides entfernt, TextRecognition + react-native-video |
| #27777187556 | ❌ failure | `master` | `355e1d0` | Build-Fixes: TextRecognition entfernt, react-native-video |
| #27743393604 | ✅ success | `master` | `69f0533` | Fix: expo-av Video props (vor dem Reset) |

---

## Dateien & Pfade

| Datei | Pfad | Beschreibung |
|-------|------|-------------|
| App.tsx | `./App.tsx` | Haupt-App (899 Zeilen) – enthält ArUco-Scanner, Panorama-Viewer, Setup mit Slider |
| Scanner.tsx | `./src/components/Scanner.tsx` | Kamera/Scanner-Komponente |
| panoramaLocations.ts | `./src/data/panoramaLocations.ts` | Datenbank mit Locations (muss auf Straßen umgestellt werden) |
| package.json | `./package.json` | Dependencies (aktuell: TextRecognition ^2.0.0, react-native-video ^6.12.0) |
| app.json | `./app.json` | Expo-Konfiguration |
| index.tsx | `./index.tsx` | Einstiegspunkt |
| BRANCH_ANALYSE.md | `./BRANCH_ANALYSE.md` | Analyse der Repos/Branches |
| Geo_Berlin_260608.md | `./Geo_Berlin_260608.md` | **Diese Datei** – aktueller Stand |
