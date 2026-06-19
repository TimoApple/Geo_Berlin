import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  url: string;
  onLoad?: () => void;
  onError?: () => void;
}

const WV = WebView as any;

export default function PanoramaViewer({ url, onLoad, onError }: Props) {
  const webViewRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>
    html, body, #panorama { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background-color: #000; }
  </style>
</head>
<body>
  <div id="panorama"></div>
  <script>
    try {
      pannellum.viewer('panorama', {
        "type": "equirectangular",
        "panorama": "${url}",
        "autoLoad": true,
        "showControls": false,
        "hotSpotDebug": false
      });
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('loaded');
    } catch(e) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error:' + e.message);
    }
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
        onMessage={(e: any) => {
          const msg = e.nativeEvent.data;
          if (msg === 'loaded' && !loaded) {
            setLoaded(true);
            onLoad?.();
          } else if (msg.startsWith('error')) {
            onError?.();
          }
        }}
        onError={() => onError?.()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});
