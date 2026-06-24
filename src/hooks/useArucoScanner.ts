import { useCallback, useRef, useState, useEffect } from 'react';
import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import jpeg from 'jpeg-js';
import { detectMarkers, ArucoResult } from '../utils/arucoDetector';
import { getLocations } from '../data/panoramaLocations';

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
  const cooldownUntilRef = useRef(0);

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

  const handleDetectedMarkers = useCallback((markers: ArucoResult[]): number[] => {
    setLastResult(markers);
    if (markers.length === 0) return [];

    const ids = markers.map(m => m.id + 1);
    const validIds = ids.filter(id => VALID_MARKER_IDS.has(id));
    if (validIds.length === 0) return [];

    callbacks?.onDetected?.(validIds);
    return validIds;
  }, [callbacks]);

  const scanCard = useCallback(async (): Promise<number[]> => {
    if (isScanningRef.current) return [];
    if (Date.now() < cooldownUntilRef.current) return [];
    if (!cameraRef.current) return [];

    isScanningRef.current = true;
    setIsScanning(true);
    setLastResult(null);

    try {
      if (fallbackModeRef.current) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('takePicture timeout')), 8000)
        );
        const photo = await Promise.race([
          cameraRef.current.takePictureAsync({ quality: 0.5, base64: true }),
          timeoutPromise,
        ]);

        if (!photo || !photo.base64) return [];

        const result = decodeAndDetect(photo.base64);
        if (!result) return [];

        const ids = handleDetectedMarkers(result.markers);
        return ids;
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('takePicture timeout')), 8000)
      );
      const photo = await Promise.race([
        cameraRef.current.takePictureAsync({ quality: 0.5 }),
        timeoutPromise,
      ]);

      if (!photo || !photo.uri) return [];

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
      );

      if (!resized || !resized.uri) return [];

      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = decodeAndDetect(base64);
      if (!result) return [];

      const ids = handleDetectedMarkers(result.markers);
      return ids;
    } catch (e) {
      console.error('[ArUco] FEHLER in scanCard:', e);
      const msg = e instanceof Error ? e.message : '';
      consecutiveErrorsRef.current++;

      if (consecutiveErrorsRef.current >= 3 && !fallbackModeRef.current) {
        console.log('[ArUco] AKTIVIERE FALLBACK-MODUS (JPG base64:true)');
        fallbackModeRef.current = true;
      }

      if (
        msg.includes('timeout') ||
        msg.includes('ExpoCameraView') ||
        msg.includes('Unable to find') ||
        msg.includes('ERR_IMAGE_CAPTURE_FAILED') ||
        msg.includes('ERR_VIEW_NOT_FOUND')
      ) {
        return [];
      }

      callbacks?.onError?.('Scan-Fehler: ' + msg);
      return [];
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
      cooldownUntilRef.current = Date.now() + 1500;
    }
  }, [callbacks, cameraRef, decodeAndDetect, handleDetectedMarkers]);

  const startScanning = useCallback(async () => {
    if (isActiveRef.current) {
      console.log('[ArUco] startScanning: bereits aktiv, ignoriert');
      return;
    }

    console.log('[ArUco] startScanning: Einmal-Scan');
    isActiveRef.current = true;

    let waited = 0;
    while (!cameraRef.current && waited < 3000) {
      await new Promise(resolve => setTimeout(resolve, 200));
      waited += 200;
    }

    if (!cameraRef.current) {
      console.error('[ArUco] CameraRef nie verfügbar!');
      isActiveRef.current = false;
      return;
    }

    try {
      await scanCard();
    } catch (e) {
      console.error('[ArUco] FEHLER in startScanning:', e);
    }

    isActiveRef.current = false;
  }, [cameraRef, scanCard]);

  const stopScanning = useCallback(() => {
    console.log('[ArUco] stopScanning');
    isActiveRef.current = false;
    isScanningRef.current = false;
    setIsScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      console.log('[ArUco] Cleanup – Hook wird unmounted');
      isActiveRef.current = false;
      isScanningRef.current = false;
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