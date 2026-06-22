# Bugfixes 22.06.2026 – ArUco Scanner Dictionary + Datenfluss

## Erledigt

### 1. Dictionary-Fix in `arucoDetector.ts`
- **Problem**: Detector nutzte Default `ARUCO_MIP_36h12` (6×6, 50 IDs) statt `ARUCO` (7×7, 250 IDs)
- **Fix**: `new AR.Detector({ dictionaryName: 'ARUCO' })` — explizit das 7×7 Dictionary setzen
- **ID-Filter korrigiert**: von `m.id <= 1023` auf `m.id <= 249` (ARUCO hat 250 Codes)

### 2. Grayscale-Datenfluss korrigiert
- **Problem**: `toGrayscale()` produzierte 4-Kanal RGBA-Graustufen, aber `CV.grayscale()` in `detect()` erwartet RGBA-Input und konvertiert selbst zu 1-Kanal
- **Fix**: `toGrayscale()` gibt jetzt RGBA unverändert zurück (Pass-Through)
- **`useArucoScanner.ts`**: Entfernt den `toGrayscale`-Import und -Aufruf, übergibt RGBA direkt

### 3. Kommentare/Doku aktualisiert
- `arucoDetector.ts`: "ARUCO_MIP_36h12 (6x6)" → "ARUCO (7x7, 250 IDs)"
- `useArucoScanner.ts`: "DICT_6X6_50" → "DICT_7X7_250"

## Nächste Schritte (nach Build)
1. APK bauen und installieren
2. logcat checken: `adb logcat | findstr /i "aruco"`
3. ArUco-Marker scannen und [ArUco]-Logs prüfen
