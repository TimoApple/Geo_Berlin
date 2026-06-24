# Branch-Analyse: GeoCheckr / GeoChecker

## Zwei Repositories

### 1. `TimoApple/GeoChecker` (aktuelles Working Directory)
- **Remote**: `origin` → `https://github.com/TimoApple/GeoChecker.git`
- **Aktueller Branch**: `master`
- **Letzter Commit**: `69f0533` (Fix: expo-av Video props)
- **Historie**: Enthält die **Berlin Street Edition** mit ArUco-Markern, Panorama-Viewer (`timoboese.com/pano/berlin/`)
- **Letzter funktionaler Stand (Mai)**: `ac299d0` — "Berlin Street Edition: Panorama-Viewer, ArUco-Scanner, neues Setup"
- **Davor**: Google Maps API-basierte Version mit Weltstädten (QR001_Berlin, QR002_Tokyo, etc.)

### 2. `TimoApple/GeoCheckr` (anderes Repo)
- **Remote**: `geocheckr` → `https://github.com/TimoApple/GeoCheckr.git`
- **Wichtige Branches**:

#### `geocheckr/main` — **Die finale, funktionale Google Maps Version (mit Slider!)**
- Letzter Commit: `50fb0d9` — "feat: add intro animation before loading screen"
- Enthält: Challenge System, Tie-Breaker, 18 Edition PDFs, Scoring, Runden-Logik
- **Tag `v1.0-working`** auf Commit `c599a3e` — funktionaler Stand
- **Das ist die Version mit dem Slider**, die Timo mühsam programmiert hat!

#### `geocheckr/german` — **Deutsche Version (DE App)**
- Letzter Commit: `6767fc8` — "fix: remove non-existent expo-splash-screen dep"
- Enthält: Deutsche Texte, Intro Video, DE Farben, Tutorial
- Basierend auf `main` mit deutschen Anpassungen

#### `geocheckr/master` — **Forschung/Experimente**
- Letzter Commit: `e63a09f` — "RESEARCH: Complete rewrite based on Google's official samples"
- Viele Experimente mit Native StreetView, WebView, etc.

## Problem: Ich war im falschen Repo!

Ich habe im **`GeoChecker`** Repo gearbeitet (Berlin Street Edition), aber die **funktionale Version mit Slider** liegt im **`GeoCheckr`** Repo, Branch `main` (und `german`).

## Nächste Schritte

1. **`geocheckr/main` als Basis nehmen** — das ist der letzte funktionale Google Maps Stand (Mai)
2. **`geocheckr/german` mergen** — deutsche Texte, Intro, DE Farben
3. **Build-Fixes anwenden** (expo-av, ErrorBoundary, etc.) — aber NUR die Fixes, nichts kaputt machen
4. **Neues Feedback, Logo, Text einarbeiten**
5. **Sichern und Build testen**
