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
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ArucoResult[] | null>(null);
  const [isActive, setIsActive] = useState(false);
  const internalCameraRef = useRef<CameraView>(null);
  const cameraRef = externalCameraRef ?? internalCameraRef;
  const isScanningRef = useRef(false);
  const isActiveRef = useRef(false);

  const scanCard = useCallback(async (): Promise<number[]> => {
    if (!cameraRef.current || isScanningRef.current) {
      return [];
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setLastResult(null);

    try {
      // 1. Foto aufnehmen
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo || !photo.uri) {
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      // 2. Auf 640px Breite skalieren (JPEG, Performance)
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

      // 3. JPEG-Datei als Base64 einlesen
      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4. JPEG zu Roh-Pixeln decodieren (jpeg-js)
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const decoded = jpeg.decode(bytes, { useTArray: true });

      // 5. In Graustufen konvertieren (bessere Erkennung)
      const clampedData = new Uint8ClampedArray(
        decoded.data.buffer,
        decoded.data.byteOffset,
        decoded.data.length
      );
      const grayData = toGrayscale(clampedData);

      // 6. ArUco-Marker erkennen (DICT_6X6_50)
      const markers = detectMarkers(grayData, decoded.width, decoded.height);

      setLastResult(markers);

      if (markers.length === 0) {
        isScanningRef.current = false;
        setIsScanning(false);
        return [];
      }

      const ids = markers.map(m => m.id);
      console.log('[ArUco] Marker erkannt:', ids);
      callbacks?.onDetected?.(ids);
      isScanningRef.current = false;
      setIsScanning(false);
      return ids;
    } catch (e) {
      console.error('ArUco scan error:', e);
      callbacks?.onError?.('Scan-Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'));
      isScanningRef.current = false;
      setIsScanning(false);
      return [];
    }
  }, [callbacks]);

  // Continuous scanning loop
  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    
    const loop = async () => {
      while (isActiveRef.current) {
        await scanCard();
        // Warte 500ms zwischen Scans
        await new Promise(resolve => { timeoutId = setTimeout(resolve, 500); });
      }
    };
    
    loop();

    return () => {
      isActiveRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, scanCard]);

  return {
    scanCard,
    isScanning,
    lastResult,
    cameraRef,
    isActive,
    setIsActive,
  };
}
