// GeoCheckr — Street View via WebView with interactive Google Maps JS API
// Touch-Navigation funktioniert weil WebView die Events direkt bekommt
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const API_KEY = 'AIzaSyCl3ogHqguF1QcwhyHdvJmUkbgx3bpKLJI';

interface StreetViewProps {
  location: {
    city?: string;
    name?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  showInfo?: boolean;
}

function buildHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#pano{width:100%;height:100%;overflow:hidden;background:#000}
#status{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#888;font-family:sans-serif;text-align:center;font-size:14px}
#status .spinner{width:32px;height:32px;border:3px solid #333;border-top-color:#e94560;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="pano"></div>
<div id="status"><div class="spinner"></div>Lade Street View...</div>

<script>
function init() {
  var status = document.getElementById('status');
  
  var sv = new google.maps.StreetViewService();
  
  sv.getPanorama({
    location: {lat: ${lat}, lng: ${lng}},
    radius: 50000,
    preference: google.maps.StreetViewPreference.NEAREST,
    source: google.maps.StreetViewSource.OUTDOOR
  }, function(data, st) {
    if (st === google.maps.StreetViewStatus.OK) {
      var pano = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
        pano: data.location.pano,
        pov: {heading: Math.random() * 360, pitch: 0},
        zoom: 0,
        addressControl: false,
        linksControl: true,
        panControl: true,
        zoomControl: true,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        enableCloseButton: false,
        clickToGo: true,
        scrollwheel: true,
        disableDefaultUI: false
      });
      
      status.style.display = 'none';
      
      // Report to React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('loaded');
      }
    } else {
      status.innerHTML = '🌍 Kein Street View hier verfügbar<br><small>' + data.location?.description + '</small>';
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('error');
      }
    }
  });
}
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=init&libraries=streetView"></script>
</body>
</html>`;
}

export default function StreetViewImage({ location, showInfo = false }: StreetViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [location.lat, location.lng]);

  if (!location.lat || !location.lng) {
    return (
      <View style={styles.errorOverlay}>
        <Text style={styles.errorEmoji}>🌍</Text>
        <Text style={styles.errorText}>{location.city}</Text>
        <Text style={styles.errorHint}>Keine Koordinaten</Text>
      </View>
    );
  }

  const html = buildHtml(location.lat, location.lng);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Lade Street View...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        scrollEnabled={false}
        onError={() => { setError(true); setLoading(false); }}
        onHttpError={() => { setError(true); setLoading(false); }}
        onMessage={(e) => {
          const msg = e.nativeEvent.data;
          if (msg === 'loaded') setLoading(false);
          if (msg === 'error') { setError(true); setLoading(false); }
        }}
      />

      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorEmoji}>🌍</Text>
          <Text style={styles.errorText}>{location.city}</Text>
          <Text style={styles.errorHint}>{location.country}</Text>
        </View>
      )}

      {showInfo && !error && (
        <View style={styles.infoOverlay}>
          <Text style={styles.infoText}>{location.city}, {location.country}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', position: 'relative' },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 10,
  },
  loadingText: { color: '#aaa', marginTop: 10, fontSize: 14 },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    zIndex: 5,
  },
  errorEmoji: { fontSize: 60, marginBottom: 15 },
  errorText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  errorHint: { color: '#888', fontSize: 14, marginTop: 8 },
  infoOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 20,
  },
  infoText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
