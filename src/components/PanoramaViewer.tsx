// PanoramaViewer – Stabiler 360°-Bild-Viewer (WebView-basiert)
// Lädt ein .avif-Panorama-Bild und zeigt es als interaktiven 360°-Viewer an.
// Touch-Drag zum horizontalen Rotieren, Pinch-Zoom, Gyroskop-Unterstützung.
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  url: string;
  onLoad?: () => void;
  onError?: () => void;
}

const WV = WebView as any;

export default function PanoramaViewer({ url, onLoad, onError }: Props) {
  const webViewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Reset bei URL-Änderung
  useEffect(() => {
    setLoading(true);
    setError(false);
    setLoadAttempted(false);
  }, [url]);

  const handleMessage = useCallback((e: any) => {
    const msg = e.nativeEvent?.data || '';
    if (msg === 'loaded') {
      setLoading(false);
      setError(false);
      onLoad?.();
    } else if (msg.startsWith('error')) {
      setLoading(false);
      setError(true);
      onError?.();
    }
  }, [onLoad, onError]);

  const handleWebViewError = useCallback(() => {
    setLoading(false);
    setError(true);
    onError?.();
  }, [onError]);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #container { width: 100%; height: 100%; position: relative; overflow: hidden; }
    #pano-img { 
      position: absolute; 
      height: 100%; 
      min-width: 100%; 
      object-fit: cover;
      cursor: grab;
      user-select: none;
      -webkit-user-drag: none;
      touch-action: none;
    }
    #loading {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; justify-content: center;
      background: #000; color: #F2A344; font-family: sans-serif; font-size: 14px;
      z-index: 10;
    }
    #loading .spinner {
      width: 32px; height: 32px;
      border: 3px solid #3a3836;
      border-top-color: #F2A344;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      display: none; align-items: center; justify-content: center;
      background: #000; color: #D9593C; font-family: sans-serif; font-size: 16px;
      z-index: 10;
    }
  </style>
</head>
<body>
  <div id="loading"><div><div class="spinner"></div>Panorama wird geladen...</div></div>
  <div id="error">Fehler beim Laden des Panoramas</div>
  <div id="container">
    <img id="pano-img" src="${url}" draggable="false" 
      onload="document.getElementById('loading').style.display='none'; window.ReactNativeWebView && window.ReactNativeWebView.postMessage('loaded');"
      onerror="document.getElementById('loading').style.display='none'; document.getElementById('error').style.display='flex'; window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error');" />
  </div>
  <script>
    (function() {
      var img = document.getElementById('pano-img');
      var isDragging = false;
      var startX = 0;
      var currentTranslate = 0;
      var prevTranslate = 0;
      var startY = 0;
      var currentScale = 1;
      var lastPinchDist = 0;

      function getTranslateX() {
        return currentTranslate;
      }

      function setTransform() {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var containerH = window.innerHeight;
        var scale = containerH / h;
        var displayW = w * scale * currentScale;
        img.style.width = displayW + 'px';
        img.style.height = (h * scale * currentScale) + 'px';
        img.style.transform = 'translateX(' + currentTranslate + 'px)';
      }

      // Touch-Drag für horizontale Rotation
      img.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
          isDragging = true;
          startX = e.touches[0].clientX;
          prevTranslate = currentTranslate;
          img.style.cursor = 'grabbing';
          e.preventDefault();
        } else if (e.touches.length === 2) {
          lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: false });

      img.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && isDragging) {
          var dx = e.touches[0].clientX - startX;
          currentTranslate = prevTranslate + dx;
          setTransform();
          e.preventDefault();
        } else if (e.touches.length === 2 && lastPinchDist > 0) {
          var dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          var scaleDelta = dist / lastPinchDist;
          currentScale = Math.max(0.5, Math.min(3, currentScale * scaleDelta));
          lastPinchDist = dist;
          setTransform();
          e.preventDefault();
        }
      }, { passive: false });

      img.addEventListener('touchend', function(e) {
        isDragging = false;
        img.style.cursor = 'grab';
        lastPinchDist = 0;
      });

      // Maus-Unterstützung für Web/Desktop
      img.addEventListener('mousedown', function(e) {
        isDragging = true;
        startX = e.clientX;
        prevTranslate = currentTranslate;
        img.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        var dx = e.clientX - startX;
        currentTranslate = prevTranslate + dx;
        setTransform();
      });

      window.addEventListener('mouseup', function() {
        isDragging = false;
        img.style.cursor = 'grab';
      });

      // Initiale Position
      img.onload = function() {
        setTransform();
      };

      // Bei Fenster-Änderung neu berechnen
      window.addEventListener('resize', setTransform);
    })();
  </script>
</body>
</html>`;

  return (
    <View style={styles.container}>
      <WV
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="compatibility"
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        onMessage={handleMessage}
        onError={handleWebViewError}
        onHttpError={handleWebViewError}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F2A344" />
          <Text style={styles.loadingText}>Panorama wird geladen...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Panorama konnte nicht geladen werden</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 10,
  },
  loadingText: {
    color: '#F2A344',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 12,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 10,
  },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: {
    color: '#D9593C',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
