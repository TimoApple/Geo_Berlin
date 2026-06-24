# Migration auf Live-Viewer

## Ziel
Wir ersetzen den Snapshot-Scanner durch einen Live-Stream-Viewer mit echter Frame-Verarbeitung für ArUco.
Die Demo läuft danach stabiler und näher am Verhalten der Referenz-App.

## Ausgangslage
- `App.tsx` ist bereits entschlackt und orchestriert nur noch den Flow.
- `GameScreen.tsx` trägt den Spielablauf.
- `PanoramaViewer.tsx` und die Datenbasis bleiben unabhängig.
- Der aktuelle ArUco-Scanner ist noch snapshot-basiert und damit nur ein Zwischenstand.

## Was neu kommen muss
- `react-native-vision-camera` als Kamera-Basis.
- Ein Frame Processor für Live-Frames.
- Ein ArUco-Detektor, der pro Frame arbeitet.
- Native / Prebuild-Unterstützung im Expo-Workflow.

## Was bleibt
- `panoramaLocations-2.ts` als Datenquelle.
- Spielregeln, Timer, Scoring, Setup-Flow.
- Panorama-Rendering und Result-Flow.

## Warum das nötig ist
Snapshot-Scanning bedeutet immer: Foto aufnehmen, speichern, laden, decodieren, auswerten.
Das ist langsamer, fragiler und weniger ähnlich zu einer echten Scanner-App.
Live-Stream heißt: Bild kommt rein, Detektion läuft direkt pro Frame.

## Technische Konsequenzen
- `expo-camera` reicht dafür nicht als Kernlösung.
- Der Wechsel auf VisionCamera ist ein echter Architekturwechsel.
- Du brauchst vermutlich einen nativen Rebuild / Dev Client / Prebuild-Workflow.
- Das ist kein kleiner Patch, sondern ein eigener Umbau-Track.

## Reihenfolge der Migration
### Phase 1: Basis vorbereiten
1. VisionCamera in das Expo-Projekt einhängen.
2. Kamera-Berechtigungen prüfen.
3. Minimalen Preview-Screen zum Laufen bringen.

### Phase 2: Frame-Processing
1. Einen Frame Processor hinzufügen.
2. Ein kleines Testsignal pro Frame loggen.
3. FPS und Stabilität prüfen.

### Phase 3: ArUco integrieren
1. ArUco-Erkennung auf Frame-Ebene verbinden.
2. IDs und Dictionary-Handling prüfen.
3. Doppelte Treffer und Debounce sauber lösen.

### Phase 4: Game-Flow koppeln
1. Scanner-Resultate an `GameScreen` senden.
2. QR-/City-Logik nur noch als UI-Flow nutzen.
3. Scanner bei Phasenwechsel sauber starten und stoppen.

### Phase 5: Stabilisierung
1. Error-States anzeigen.
2. Kamera-Restore nach Fehlern.
3. End-to-End-Test auf echtem Gerät.

## Was du vorher nicht mehr tun solltest
- Keine weiteren Snapshot-Fehlerfixes in den Live-Plan hineinmischen.
- Keine neue Scanner-Logik mehr in `App.tsx` bauen.
- Keine Panorama- oder Game-Refactors parallel zur Kamera-Migration.

## Aufwand
- Live-Preview: klein bis mittel.
- Frame Processor + ArUco: mittel bis groß.
- Stabiler Demo-Betrieb: groß, aber machbar.

## Empfehlung
Für eine stabile Demo: erst den aktuellen Workflow behalten und fertigstellen.
Für die echte Live-Viewer-Version: danach die Migration sauber separat machen.

## Erfolgsdefinition
Die Migration ist fertig, wenn:
- die Kamera sofort live zeigt,
- ArUco pro Frame reagiert,
- der Game-Flow sauber weiterläuft,
- keine Snapshot-Schleife mehr nötig ist.
