// useArucoScanner – ArUco marker detection via photo capture
// Uses expo-camera + expo-image-manipulator + jpeg-js + js-aruco2
// Dictionary: DICT_6X6_50 (ARUCO_MIP_36h12) – nativ von js-aruco2 unterstützt
// No native code, no prebuild needed
// Continuous scanning: scanCard wird automatisch in Schleife getriggert

import { useCallback, useRef, useState, useEffect } from 'react';
import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import jpeg from 'jpeg-js';
import { detectMarkers, toGrayscale, ArucoResult } from '../utils/arucoDetector';

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

  // Debug: setIsActive wird aufgerufen
  const wrappedSetIsActive = useCallback((value: boolean) => {
    console.log('[ArUco] setIsActive aufgerufen mit:', value);
    setIsActive(value);
  }, []);

  const scanCard = useCallback(async (): Promise<number[]> => {
    console.log('[ArUco] scanCard aufgerufen, cameraRef.current:', !!cameraRef.current);

    if (!cameraRef.current) {
      console.log('[ArUco] scanCard abgebrochen – kein CameraRef');
      return [];
    }

    setIsScanning(true);
    setLastResult(null);

    try {
      console.log('[ArUco] Foto wird aufgenommen...');
      // 1. Foto aufnehmen – ohne Parameter (expo-camera 16.x native cast)
      const photo = await cameraRef.current.takePictureAsync();

      console.log('[ArUco] Foto aufgenommen:', photo ? 'OK' : 'NULL', 'uri:', photo?.uri);

      if (!photo || !photo.uri) {
        console.log('[ArUco] Kein Foto erhalten');
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

      // 5. In Graustufen konvertieren (bessere Erkennung)
      console.log('[ArUco] Graustufen...');
      const clampedData = new Uint8ClampedArray(
        decoded.data.buffer,
        decoded.data.byteOffset,
        decoded.data.length
      );
      const grayData = toGrayscale(clampedData);

      // 6. ArUco-Marker erkennen (DICT_6X6_50)
      console.log('[ArUco] Detektiere Marker...');
      const markers = detectMarkers(grayData, decoded.width, decoded.height);
      console.log('[ArUco] Marker gefunden:', markers.length);

      setLastResult(markers);

      if (markers.length === 0) {
        console.log('[ArUco] Keine Marker erkannt');
        setIsScanning(false);
        return [];
      }

      const ids = markers.map(m => m.id);
      console.log('[ArUco] Marker erkannt – IDs:', ids);
      callbacks?.onDetected?.(ids);
      setIsScanning(false);
      return ids;
    } catch (e) {
      console.error('[ArUco] FEHLER in scanCard:', e);
      callbacks?.onError?.('Scan-Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'));
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
