// useArucoScanner – ArUco marker detection via photo capture
// Uses expo-camera + expo-image-manipulator + jpeg-js + js-aruco2
// Dictionary: DICT_7X7_250 (ARUCO) – nativ von js-aruco2 unterstützt
// No native code, no prebuild needed
// Continuous scanning: scanCard wird automatisch in Schleife getriggert
//
// API: startScanning() / stopScanning() statt setIsActive
// Kein externes setIsActive mehr – der Hook kontrolliert seinen eigenen Lifecycle.

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
  const internalCameraRef = useRef<CameraView>(null);
  const cameraRef = externalCameraRef ?? internalCameraRef;
  const isActiveRef = useRef(false);
  const isScanningRef = useRef(false);
  const fallbackModeRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const loopActiveRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gemeinsame Bildverarbeitung: RGBA → Kontrast → Marker erkennen
  const processImageData = useCallback((width: number, height: number, rawData: Uint8ClampedArray): ArucoResult[] => {
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
    return detectMarkers(contrastData, width, height);
  }, []);

  // JPEG-Base64 dekodieren und Marker erkennen
  const decodeAndDetect = useCallback((base64: string): { markers: ArucoResult[], width: number, height: number } | null => {
    try {
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const decoded = jpeg.decode(bytes, { useTArray: true });
      const rawData = new Uint8ClampedArray(
        decoded.data.buffer,
        decoded.data.byteOffset,
        decoded.data.length
      );
      const markers = processImageData(decoded.width, decoded.height, rawData);
      return { markers, width: decoded.width, height: decoded.height };
    } catch (e) {
      console.error('[ArUco] decodeAndDetect Fehler:', e);
      return null;
    }
  }, [processImageData]);

  // Marker-IDs validieren und Callback aufrufen
  const handleDetectedMarkers = useCallback((markers: ArucoResult[]): number[] => {
    setLastResult(markers);
    if (markers.length === 0) {
      return [];
    }
    const ids = markers.map(m => m.id + 1);
    const validIds = ids.filter(id => VALID_MARKER_IDS.has(id));
    if (validIds.length === 0) {
      return [];
    }
    callbacks?.onDetected?.(validIds);
    return validIds;
  }, [callbacks]);

  const scanCard = useCallback(async (): Promise<number[]> => {
    // Re-Entry Guard: kein paralleler Scan
    if (isScanningRef.current) {
      return [];
    }

    if (!cameraRef.current) {
      return [];
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setLastResult(null);

    try {
      if (fallbackModeRef.current) {
        // === FALLBACK-MODUS: takePictureAsync mit base64:true ===
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('takePicture timeout')), 8000)
        );
        const photo = await Promise.race([
          cameraRef.current.takePictureAsync({ quality: 0.5, base64: true }),
          timeoutPromise,
        ]);
        if (!photo || !photo.base64) {
          isScanningRef.current = false;
          setIsScanning(false);
          return [];
        }
        const result = decodeAndDetect(photo.base64);
        if (!result) {
          isScanningRef.current = false;
          setIsScanning(false);
          return [];
        }
        handleDetectedMarkers(result.markers);
        isScanningRef.current = false;
        setIsScanning(false);
        return result.markers.map(m => m.id + 1);
      }

      // === NORMAL-MODUS: takePictureAsync → ImageManipulator → FileSystem → jpeg-js ===
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('takePicture timeout')), 8000)
      );
      const photo = await Promise.race([
        cameraRef.current.takePictureAsync({ quality: 0.5 }),
        timeoutPromise,
      ]);

      if (!photo || !photo.uri) {
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
      );

      if (!resized || !resized.uri) {
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = decodeAndDetect(base64);
      if (!result) {
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }
      handleDetectedMarkers(result.markers);
      isScanningRef.current = false;
      setIsScanning(false);
      return result.markers.map(m => m.id + 1);
    } catch (e) {
      console.error('[ArUco] FEHLER in scanCard:', e);
      const msg = e instanceof Error ? e.message : '';
      consecutiveErrorsRef.current++;

      // Nach 3 Fehlern in Folge → Fallback-Modus aktivieren
      if (consecutiveErrorsRef.current >= 3 && !fallbackModeRef.current) {
        console.log('[ArUco] AKTIVIERE FALLBACK-MODUS (JPG base64:true)');
        fallbackModeRef.current = true;
      }

      // Timeout oder Camera-remount Fehler ignorieren (kein Toast)
      if (msg.includes('timeout') || msg.includes('ExpoCameraView') || msg.includes('Unable to find') || msg.includes('ERR_IMAGE_CAPTURE_FAILED') || msg.includes('ERR_VIEW_NOT_FOUND')) {
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }
      callbacks?.onError?.('Scan-Fehler: ' + msg);
      isScanningRef.current = false;
      setIsScanning(false);
      return [];
    }
  }, [callbacks, decodeAndDetect, handleDetectedMarkers]);

  // Continuous scanning loop (wird von startScanning/stopScanning gesteuert)
  const scanningLoopRef = useRef<Promise<void> | null>(null);

  const startScanning = useCallback(() => {
    if (isActiveRef.current) {
      console.log('[ArUco] startScanning: bereits aktiv, ignoriert');
      return;
    }
    console.log('[ArUco] startScanning: Aktiviere Scan-Loop');
    isActiveRef.current = true;
    loopActiveRef.current = true;

    const loop = async () => {
      // Warte bis Kamera gemountet ist (max 3 Sekunden)
      let waited = 0;
      while (!cameraRef.current && waited < 3000) {
        await new Promise(resolve => setTimeout(resolve, 200));
        waited += 200;
      }

      if (!cameraRef.current) {
        console.error('[ArUco] CameraRef nie verfügbar!');
        return;
      }

      while (isActiveRef.current && loopActiveRef.current) {
        // Warte bis vorheriger Scan abgeschlossen ist (max 10s)
        let waitCount = 0;
        while (isScanningRef.current && waitCount < 50) {
          await new Promise(resolve => setTimeout(resolve, 200));
          waitCount++;
        }
        if (!isActiveRef.current || !loopActiveRef.current) break;

        try {
          await scanCard();
        } catch (e) {
          console.error('[ArUco] FEHLER in Scan-Loop:', e);
        }
        // Warte 500ms zwischen Scans
        await new Promise(resolve => {
          timeoutRef.current = setTimeout(resolve, 500);
        });
      }
      console.log('[ArUco] Scan-Loop beendet');
    };

    scanningLoopRef.current = loop();
  }, [scanCard]);

  const stopScanning = useCallback(() => {
    if (!isActiveRef.current) {
      return;
    }
    console.log('[ArUco] stopScanning: Deaktiviere Scan-Loop');
    isActiveRef.current = false;
    loopActiveRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsScanning(false);
    isScanningRef.current = false;
  }, []);

  // Cleanup bei unmount
  useEffect(() => {
    return () => {
      console.log('[ArUco] Cleanup – Hook wird unmounted');
      isActiveRef.current = false;
      loopActiveRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    scanCard,
    isScanning,
    lastResult,
    cameraRef,
    startScanning,
    stopScanning,
  };
}
