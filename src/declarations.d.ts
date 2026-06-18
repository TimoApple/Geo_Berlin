declare module 'react-native-webview' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';
  interface WebViewProps {
    source?: { html?: string; uri?: string };
    style?: ViewStyle;
    javaScriptEnabled?: boolean;
    domStorageEnabled?: boolean;
    allowsInlineMediaPlayback?: boolean;
    mediaPlaybackRequiresUserAction?: boolean;
    mixedContentMode?: string;
    scrollEnabled?: boolean;
    onError?: (e: any) => void;
    onHttpError?: (e: any) => void;
    onMessage?: (e: any) => void;
    onLoadEnd?: () => void;
    onLoadStart?: () => void;
    userAgent?: string;
    key?: string | number;
    bounces?: boolean;
    ref?: any;
  }
  export class WebView extends Component<WebViewProps> {
    injectJavaScript(script: string): void;
  }
  export default WebView;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  export default AsyncStorage;
}
