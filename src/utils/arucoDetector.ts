// ArUco Marker Detector – pure JS, no native code
// Uses js-aruco2 (original js-aruco port) with ARUCO dictionary (7x7 markers, 250 IDs)
// 7x7 = Standard ArUco DICT_7X7_250 (250 IDs, 5-bit hamming distance)
// Das ist das korrekte Dictionary für die gedruckten Karten (aruco_001.svg – aruco_100.svg)

// Lokale Kopie von js-aruco2 mit ES-Modul-Export
import AR from '../libs/aruco';

export interface ArucoResult {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
}

let detector: any = null;

function getDetector() {
  if (!detector) {
    try {
      // ARUCO = 7x7 Marker, 250 IDs (DICT_7X7_250)
      // Wichtig: Nicht ARUCO_MIP_36h12 (6x6) verwenden!
      detector = new AR.Detector({ dictionaryName: 'ARUCO' });
    } catch (e) {
      console.error('[ArUco] Failed to initialize detector:', e);
      return null;
    }
  }
  return detector;
}

/**
 * Detect ArUco markers from raw image pixel data
 * Uses js-aruco2's AR.Detector with ARUCO dictionary (7x7 markers, 250 IDs)
 * 
 * @param imageData - Uint8ClampedArray (RGBA, 4 bytes per pixel)
 * @param width - image width in pixels
 * @param height - image height in pixels
 * @returns Array of detected markers with id, corners, center
 */
export function detectMarkers(
  imageData: Uint8ClampedArray,
  width: number,
  height: number
): ArucoResult[] {
  const det = getDetector();
  if (!det) return [];

  try {
    // JPEG decodiert → Graustufen → Detektiere Marker
    // js-aruco2 braucht ein Graustufen-Array (1 Byte/Pixel), kein RGBA
    const grayData = toGrayscale(imageData);
    const imgData = { data: grayData, width, height };
    const markers = det.detect(imgData);

    if (!markers || markers.length === 0) {
      console.log('[ArUco] Keine Marker erkannt');
      return [];
    }

    console.log('[ArUco] Marker gefunden:', markers.length);

    return markers
      .filter((m: any) => m && m.id !== undefined && m.id >= 0 && m.id <= 999 && m.corners)
      .map((m: any) => {
        const corners = m.corners.map((c: any) => ({
          x: typeof c.x === 'number' ? c.x : c[0],
          y: typeof c.y === 'number' ? c.y : c[1],
        }));

        const centerX = corners.reduce((sum: number, c: { x: number }) => sum + c.x, 0) / corners.length;
        const centerY = corners.reduce((sum: number, c: { y: number }) => sum + c.y, 0) / corners.length;

        return {
          id: m.id,
          corners,
          center: { x: centerX, y: centerY },
        };
      });
  } catch (e) {
    console.error('[ArUco] Detection error:', e);
    return [];
  }
}

/**
 * Konvertiert RGBA-Daten (4 Bytes/Pixel) in Graustufen (1 Byte/Pixel).
 * js-aruco2 erwartet ein Graustufen-Array, kein RGBA.
 * Verwendet die Standard-Luminanz-Formel: 0.299*R + 0.587*G + 0.114*B
 */
export function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  const len = data.length;
  const grayLen = len / 4;
  const gray = new Uint8ClampedArray(grayLen);
  for (let i = 0; i < grayLen; i++) {
    const offset = i * 4;
    gray[i] = Math.round(0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]);
  }
  return gray;
}

