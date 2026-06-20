// GeoCheckr — Minimal Debug: Full Screen Street View Navigation
// Based on build #170 approach that works
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const API_KEY = 'AIzaSyCl3ogHqguF1QcwhyHdvJmUkbgx3bpKLJI';

// Berlin — 1 Location, multiple hardcoded coords to test
const LOCATIONS = [
  { city: 'Berlin Brandenburger Tor', lat: 52.5163, lng: 13.3777 },
  { city: 'Berlin Alexanderplatz', lat: 52.5219, lng: 13.4132 },
  { city: 'Berlin Reichstag', lat: 52.5186, lng: 13.3761 },
];

function buildHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#pano{width:100%;height:100%;overflow:hidden;background:#000}
#status{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#888;font-family:sans-serif;text-align:center;font-size:14px;z-index:999}
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
      
      // Listen for POV changes (= navigation)
      pano.addListener('pov_changed', function() {
        var pov = pano.getPov();
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          'pov:' + pov.heading.toFixed(1) + ',' + pov.pitch.toFixed(1)
        );
      });
      
      // Listen for position changes (= walking to next panorama)
      pano.addListener('position_changed', function() {
        var pos = pano.getPosition();
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          'moved:' + pos.lat().toFixed(6) + ',' + pos.lng().toFixed(6)
        );
      });
      
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('loaded');
    } else {
      status.innerHTML = '❌ Kein Street View hier<br><small>Status: ' + st + '</small>';
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error:' + st);
    }
  });
}
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=init&libraries=streetView"></script>
</body>
</html>`;
}

export default function DebugStreetView() {
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastPov, setLastPov] = useState('');
  const [lastMove, setLastMove] = useState('');

  const loc = LOCATIONS[idx];
  const html = buildHtml(loc.lat, loc.lng);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-15), msg]);
  };

  useEffect(() => {
    setLoading(true);
    setError(false);
    setLogs([]);
    setLastPov('');
    setLastMove('');
  }, [idx]);

  return (
    <View style={styles.container}>
      {/* FULLSCREEN WebView */}
      <WebView
        key={idx}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        scrollEnabled={true}
        onError={(e) => { setError(true); setLoading(false); addLog('ERR: ' + e.nativeEvent.description); }}
        onHttpError={(e) => { addLog('HTTP: ' + e.nativeEvent.statusCode); }}
        onMessage={(e) => {
          const msg = e.nativeEvent.data;
          if (msg === 'loaded') { setLoading(false); addLog('✅ Street View loaded'); }
          else if (msg.startsWith('error')) { setError(true); setLoading(false); addLog('❌ ' + msg); }
          else if (msg.startsWith('pov:')) { setLastPov(msg.replace('pov:', '')); }
          else if (msg.startsWith('moved:')) { setLastMove(msg.replace('moved:', '')); addLog('🚶 ' + msg); }
        }}
        userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      />

      {/* Minimal UI overlay — only visible when NOT loading */}
      {!loading && !error && (
        <>
          {/* Location selector — bottom */}
          <View style={styles.bottomBar}>
            {LOCATIONS.map((l, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.locBtn, i === idx && styles.locBtnActive]}
                onPress={() => setIdx(i)}
              >
                <Text style={[styles.locBtnText, i === idx && styles.locBtnTextActive]}>
                  {i + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Debug info — bottom left */}
          <View style={styles.debugOverlay}>
            <Text style={styles.debugText}>📍 {loc.city}</Text>
            {lastPov ? <Text style={styles.debugSmall}>👁 POV: {lastPov}</Text> : null}
            {lastMove ? <Text style={styles.debugSmall}>🚶 Moved: {lastMove}</Text> : null}
          </View>
        </>
      )}

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Lade {loc.city}...</Text>
        </View>
      )}

      {/* Error overlay */}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorEmoji}>❌</Text>
          <Text style={styles.errorText}>{loc.city}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setIdx((idx + 1) % LOCATIONS.length)}>
            <Text style={styles.retryText}>Nächste Location →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Log overlay — top right, semi-transparent */}
      <View style={styles.logOverlay}>
        {logs.slice(-5).map((l, i) => (
          <Text key={i} style={styles.logLine}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },

  // Location selector
  bottomBar: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 12,
    zIndex: 10,
  },
  locBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 2, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  locBtnActive: { borderColor: '#e94560', backgroundColor: 'rgba(233,69,96,0.3)' },
  locBtnText: { color: '#888', fontSize: 16, fontWeight: 'bold' },
  locBtnTextActive: { color: '#fff' },

  // Debug info
  debugOverlay: {
    position: 'absolute', bottom: 80, left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 8,
    zIndex: 10, maxWidth: 200,
  },
  debugText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  debugSmall: { color: '#4ade80', fontSize: 10, fontFamily: 'monospace', marginTop: 2 },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#000', zIndex: 20,
  },
  loadingText: { color: '#aaa', marginTop: 10, fontSize: 14 },

  // Error
  errorOverlay: {
    ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1a1a2e', zIndex: 20,
  },
  errorEmoji: { fontSize: 60, marginBottom: 15 },
  errorText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  retryBtn: { backgroundColor: '#e94560', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Log
  logOverlay: {
    position: 'absolute', top: 40, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 6,
    zIndex: 10, maxWidth: 180,
  },
  logLine: { color: '#4ade80', fontSize: 9, fontFamily: 'monospace', marginBottom: 1 },
});
