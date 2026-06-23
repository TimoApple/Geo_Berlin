// useArucoScanner – ArUco marker detection via photo capture
// Uses expo-camera + expo-image-manipulator + jpeg-js + js-aruco2
// Dictionary: DICT_7X7_250 (ARUCO) – nativ von js-aruco2 unterstützt
// No native code, no prebuild needed
// Continuous scanning: scanCard wird automatisch in Schleife getriggert

import { useCallback, useRef, useState, useEffect } from 'react';
import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import jpeg from 'jpeg-js';
import { detectMarkers, ArucoResult } from '../utils/arucoDetector';
import { getLocations } from '../data/panoramaLocations';

// Gültige Marker-IDs aus der Datenbank (einmalig beim Import ermitteln)
const VALID_MARKER_IDS = new Set<number>();
try {
  const locs = getLocations();
  locs.forEach(l => {
    if (l.id >= 0) VALID_MARKER_IDS.add(l.id);
  });
  console.log('[ArUco] Gültige Marker-IDs in DB:', [...VALID_MARKER_IDS].sort((a, b) => a - b).join(', '));
} catch (e) {
  console.warn('[ArUco] Konnte gültige Marker-IDs nicht laden:', e);
}

export function useArucoScanner(
  externalCameraRef?: React.RefObject<CameraView>,
  callbacks?: {
    onDetected?: (ids: number[]) => void;
    onError?: (error: string) => void;
  }
) {
  console.log('[ArUco] Hook initialisiert');

  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ArucoResult[] | null>(null);
  const [isActive, setIsActive] = useState(false);
  const internalCameraRef = useRef<CameraView>(null);
  const cameraRef = externalCameraRef ?? internalCameraRef;
  const isActiveRef = useRef(false);
  const isScanningRef = useRef(false);

  // Debug: setIsActive wird aufgerufen
  const wrappedSetIsActive = useCallback((value: boolean) => {
    console.log('[ArUco] setIsActive aufgerufen mit:', value);
    setIsActive(value);
  }, []);

  const scanCard = useCallback(async (): Promise<number[]> => {
    // Re-Entry Guard: kein paralleler Scan
    if (isScanningRef.current) {
      console.log('[ArUco] scanCard abgebrochen – Scan läuft bereits');
      return [];
    }

    console.log('[ArUco] scanCard aufgerufen, cameraRef.current:', !!cameraRef.current);

    if (!cameraRef.current) {
      console.log('[ArUco] scanCard abgebrochen – kein CameraRef');
      return [];
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setLastResult(null);

    try {
      console.log('[ArUco] Foto wird aufgenommen...');
      // 1. Foto aufnehmen – mit Timeout (Kamera braucht Warmup)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('takePicture timeout')), 8000)
      );
      const photo = await Promise.race([
        cameraRef.current.takePictureAsync({ quality: 0.5 }),
        timeoutPromise,
      ]);

      console.log('[ArUco] Foto aufgenommen:', photo ? 'OK' : 'NULL', 'uri:', photo?.uri);

      if (!photo || !photo.uri) {
        console.log('[ArUco] Kein Foto erhalten');
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      // 2. Auf 640px Breite skalieren (JPEG, Performance)
      console.log('[ArUco] Resize...');
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
      );

      console.log('[ArUco] Resized:', resized ? 'OK' : 'NULL');

      if (!resized || !resized.uri) {
        console.log('[ArUco] Resize fehlgeschlagen');
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      // 3. JPEG-Datei als Base64 einlesen
      console.log('[ArUco] Lese Base64...');
      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('[ArUco] Base64 gelesen, Länge:', base64.length);

      // 4. JPEG zu Roh-Pixeln decodieren (jpeg-js)
      console.log('[ArUco] Decodiere JPEG...');
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const decoded = jpeg.decode(bytes, { useTArray: true });
      console.log('[ArUco] JPEG decodiert:', decoded.width, 'x', decoded.height);

      // 5. Orange→weiß, Dunkel→schwarz normalisieren (SVGs haben #f2a444 + #262523)
      console.log('[ArUco] RGBA-Daten vorbereiten...');
      const rawData = new Uint8ClampedArray(
        decoded.data.buffer,
        decoded.data.byteOffset,
        decoded.data.length
      );
      const contrastData = new Uint8ClampedArray(rawData.length);
       for (let i = 0; i < rawData.length; i += 4) {
        const r = rawData[i], g = rawData[i + 1], b = rawData[i + 2];
        const isOrange = r > 160 && g > 80 && b < 100;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const val = isOrange ? 255 : lum > 128 ? 255 : 0;
        contrastData[i] = val;
        contrastData[i + 1] = val;
        contrastData[i + 2] = val;
        contrastData[i + 3] = 255;
      }

      // 6. ArUco-Marker erkennen (DICT_7X7_250)
      console.log('[ArUco] Detektiere Marker...');
      const markers = detectMarkers(contrastData, decoded.width, decoded.height);
      console.log('[ArUco] Marker gefunden:', markers.length);

      setLastResult(markers);

      if (markers.length === 0) {
        console.log('[ArUco] Keine Marker erkannt');
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      const ids = markers.map(m => m.id + 1);
      console.log('[ArUco] Marker erkannt – IDs:', ids);

      // Prüfe ob IDs in der Datenbank existieren
      const validIds = ids.filter(id => VALID_MARKER_IDS.has(id));
      if (validIds.length === 0) {
        console.log('[ArUco] Keine der erkannten IDs in DB:', ids, '– gültige IDs:', [...VALID_MARKER_IDS].sort((a, b) => a - b).join(','));
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      callbacks?.onDetected?.(validIds);
      isScanningRef.current = false;
      setIsScanning(false);
      return validIds;
    } catch (e) {
      console.error('[ArUco] FEHLER in scanCard:', e);
      const msg = e instanceof Error ? e.message : '';
      // Timeout oder Camera-remount Fehler ignorieren (kein Toast)
      if (msg.includes('timeout') || msg.includes('ExpoCameraView') || msg.includes('Unable to find')) {
        console.log('[ArUco] Timeout/Camera-Fehler ignoriert');
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }
      callbacks?.onError?.('Scan-Fehler: ' + msg);
      isScanningRef.current = false;
      setIsScanning(false);
      return [];
    }
  }, [callbacks]);

  // Continuous scanning loop
  useEffect(() => {
    console.log('[ArUco] useEffect isActive geändert zu:', isActive);
    isActiveRef.current = isActive;
    if (!isActive) {
      console.log('[ArUco] isActive=false – Scan-Loop beendet');
      return;
    }

    console.log('[ArUco] Starte Continuous Scan-Loop...');
    let timeoutId: ReturnType<typeof setTimeout>;
    let loopActive = true;
    
    const loop = async () => {
      // Warte bis Kamera gemountet ist (max 3 Sekunden)
      let waited = 0;
      while (!cameraRef.current && waited < 3000) {
        console.log('[ArUco] Warte auf CameraRef...');
        await new Promise(resolve => setTimeout(resolve, 200));
        waited += 200;
      }
      
      if (!cameraRef.current) {
        console.error('[ArUco] CameraRef nie verfügbar!');
        return;
      }
      
      console.log('[ArUco] CameraRef verfügbar, starte Loop');
      
      while (isActiveRef.current && loopActive) {
        console.log('[ArUco] Scan-Loop läuft...');
        try {
          await scanCard();
        } catch (e) {
          console.error('[ArUco] FEHLER in Scan-Loop:', e);
        }
        // Warte 500ms zwischen Scans
        await new Promise(resolve => { timeoutId = setTimeout(resolve, 500); });
      }
      console.log('[ArUco] Scan-Loop beendet');
    };
    
    loop();

    return () => {
      console.log('[ArUco] Cleanup – Scan-Loop wird gestoppt');
      loopActive = false;
      isActiveRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive]);

  return {
    scanCard,
    isScanning,
    lastResult,
    cameraRef,
    isActive,
    setIsActive: wrappedSetIsActive,
  };
}
