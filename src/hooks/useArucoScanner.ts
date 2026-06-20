// useArucoScanner – ArUco marker detection via photo capture
// Uses expo-camera + expo-image-manipulator + jpeg-js + js-aruco2
// Dictionary: DICT_6X6_50 (ARUCO_MIP_36h12) – nativ von js-aruco2 unterstützt
// No native code, no prebuild needed

import { useCallback, useRef, useState } from 'react';
import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
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
  const internalCameraRef = useRef<CameraView>(null);
  const cameraRef = externalCameraRef ?? internalCameraRef;

  const scanCard = useCallback(async (): Promise<number[]> => {
    if (!cameraRef.current) {
      callbacks?.onError?.('Kamera nicht bereit');
      return [];
    }

    setIsScanning(true);
    setLastResult(null);

    try {
      // 1. Foto aufnehmen
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo || !photo.uri) {
        callbacks?.onError?.('Kein Foto erhalten');
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
        callbacks?.onError?.('Bildverarbeitung fehlgeschlagen');
        setIsScanning(false);
        return [];
      }

      // 3. JPEG-Datei als Base64 einlesen
      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4. JPEG zu Roh-Pixeln decodieren (jpeg-js)
      // Base64 -> binär via Uint8Array (kein Buffer nötig in RN)
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
        callbacks?.onError?.('Kein ArUco-Marker erkannt');
        setIsScanning(false);
        return [];
      }

      const ids = markers.map(m => m.id);
      callbacks?.onDetected?.(ids);
      setIsScanning(false);
      return ids;
    } catch (e) {
      console.error('ArUco scan error:', e);
      callbacks?.onError?.('Scan-Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'));
      setIsScanning(false);
      return [];
    }
  }, [callbacks]);

  return {
    scanCard,
    isScanning,
    lastResult,
    cameraRef,
  };
}
