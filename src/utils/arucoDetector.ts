// ArUco Marker Detector – pure JS, no native code
// Uses js-aruco2 (original js-aruco port) with ARUCO_MIP_36h12 dictionary (6x6 markers)
// 6x6 = Standard ArUco MIP 36h12 (36 IDs, 12-bit hamming code)
// Das ist das Standard-Dictionary für die gedruckten Karten

import { AR } from 'js-aruco2';

export interface ArucoResult {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
}

let detector: any = null;

function getDetector() {
  if (!detector) {
    try {
      // Default = ARUCO_MIP_36h12 (6x6 Marker, 36 IDs)
      detector = new AR.Detector();
    } catch (e) {
      console.error('Failed to initialize ArUco detector:', e);
      return null;
    }
  }
  return detector;
}

/**
 * Detect ArUco markers from raw image pixel data
 * Uses js-aruco2's AR.Detector with ARUCO dictionary (7x7 markers)
 * 
 * @param imageData - Uint8ClampedArray (RGBA)
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
    const imgData = { data: imageData, width, height };
    const markers = det.detect(imgData);

    if (!markers || markers.length === 0) return [];

    return markers
      .filter((m: any) => m && m.id !== undefined && m.id >= 0 && m.id <= 1023 && m.corners)
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
    console.error('ArUco detection error:', e);
    return [];
  }
}

/**
 * Convert RGBA pixel data to grayscale (luminosity method)
 * Improves ArUco detection performance
 */
export function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const grayVal = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    gray[i] = grayVal;
    gray[i + 1] = grayVal;
    gray[i + 2] = grayVal;
    gray[i + 3] = 255;
  }
  return gray;
}

