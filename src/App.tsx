// GeoCheckr — QR Card Game
// Design System: "The Tactical Cartographer"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Animated,
  Vibration, Platform, KeyboardAvoidingView, StatusBar, ScrollView, Dimensions, Image
} from 'react-native';
import { WebView } from 'react-native-webview';
import { CameraView, useCameraPermissions } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as NavigationBar from 'expo-navigation-bar';
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import Video from 'react-native-video';

import { calculateDistance, formatDistance } from './utils/distance';
import { playClickSound, playSuccessSound, playErrorSound, playPerfectSound, playTimerWarning, playTimerTick, playAnswerphoneBeep } from './utils/sounds';
import { panoramaLocations, PanoramaLocation } from './data/panoramaLocations';

const { width, height } = Dimensions.get('window');
const API_KEY = 'AIzaSyCl3ogHqguF1QcwhyHdvJmUkbgx3bpKLJI';
const FF = { regular: 'SpaceGrotesk_400Regular', bold: 'SpaceGrotesk_700Bold' };

// CI COLORS — German Version
const C = {
  bg: '#262523', surfaceLow: '#1a1918', surface: '#2e2d2b',
  surfaceHigh: '#3a3836', surfaceHighest: '#4a4845',
  primary: '#F2A344', primaryBright: '#f5b866',
  onPrimary: '#262523', onPrimaryContainer: '#262523',
  secondary: '#D9593C', secondaryContainer: '#D9593C',
  onSecondaryContainer: '#ffffff',
  onSurface: '#F1E8E1', outline: '#6b6560',
  error: '#D9593C', accent: '#D9593C', green: '#F2A344', blue: '#D9593C',
  text: '#F1E8E1', muted: '#8a8580',
};

// TYPES
interface Player { id: number; name: string; city: string; cityId: number; lat: number; lng: number; score: number; }
interface TableCity { city: string; lat: number; lng: number; ownerPlayerId: number | null; isPlayerCity: boolean; }
type Screen = 'intro' | 'loading' | 'tutorial' | 'setup' | 'scan-city' | 'game' | 'result';

// LOADING QUOTES
const QUOTES = [
  'Die Welt ist ein Buch. Wer nicht reist, liest nur eine Seite.',
  'Nicht jeder, der wandert, hat sich verloren.',
  'Reisen ist Leben.',
  'Die Erde hat eine Melodie – für die, die zuhören.',
  'Das Abenteuer ist sein eigener Lohn.',
  'Irgendwo auf der Erde liegt deine Antwort. Rate schneller.',
];

// STREET VIEW HTML
function buildStreetViewHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body,#pano{width:100%;height:100%;overflow:hidden;background:#000}#status{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#888;font-family:sans-serif;text-align:center;font-size:14px;z-index:999}#status .spinner{width:32px;height:32px;border:3px solid #333;border-top-color:#F2A344;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div id="pano"></div><div id="status"><div class="spinner"></div>Ort wird geladen...</div><script>function init(){var sv=new google.maps.StreetViewService();sv.getPanorama({location:{lat:${lat},lng:${lng}},radius:50000,preference:google.maps.StreetViewPreference.NEAREST,source:google.maps.StreetViewSource.DEFAULT},function(data,st){if(st===google.maps.StreetViewStatus.OK){new google.maps.StreetViewPanorama(document.getElementById('pano'),{pano:data.location.pano,pov:{heading:Math.random()*360,pitch:0},zoom:0,addressControl:false,linksControl:true,panControl:true,zoomControl:true,fullscreenControl:false,motionTracking:false,motionTrackingControl:false,enableCloseButton:false,clickToGo:true,scrollwheel:true,disableDefaultUI:false});document.getElementById('status').style.display='none';window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('loaded')}else{document.getElementById('status').innerHTML='Kein Ort verfügbar';window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('error')}})}</script><script async defer src="https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=init&libraries=streetView"></script></body></html>`;
}

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceGrotesk_400Regular, SpaceGrotesk_700Bold });
  const [screen, setScreen] = useState<Screen>('intro');
  const [tutorialPage, setTutorialPage] = useState(0);
  const [introPhase, setIntroPhase] = useState<'video' | 'still' | 'freeze'>('video');
  const [loadingFade] = useState(new Animated.Value(0));
  const [loadingQuote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  // Setup
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'Spieler 1', city: '', cityId: -1, lat: 0, lng: 0, score: 0 },
    { id: 2, name: 'Spieler 2', city: '', cityId: -1, lat: 0, lng: 0, score: 0 },
  ]);
  const [timerSetting, setTimerSetting] = useState(15);
  const [roundsSetting, setRoundsSetting] = useState(10);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // City scan
  const [scanCityForIdx, setScanCityForIdx] = useState<number | null>(null);
  const [showCityScanner, setShowCityScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState('');
  const [manualCode, setManualCode] = useState('');

  // Game
  const [tableCities, setTableCities] = useState<TableCity[]>([]);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(10);
  const [location, setLocation] = useState<PanoramaLocation>(panoramaLocations[0]);
  const [usedLocations, setUsedLocations] = useState<number[]>([]);
  const [phase, setPhase] = useState<'scan-qr' | 'view' | 'pick' | 'challenge' | 'result'>('scan-qr');
  const [challengerId, setChallengerId] = useState<number | null>(null);
  const [activePickIdx, setActivePickIdx] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [timerPaused, setTimerPaused] = useState(false);
  const [svLoaded, setSvLoaded] = useState(false);
  const [svError, setSvError] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [closestCityIdx, setClosestCityIdx] = useState<number | null>(null);
  const [distances, setDistances] = useState<number[]>([]);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  const timerPulse = useRef(new Animated.Value(1)).current;
  const resultScale = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const tutScrollRef = useRef<ScrollView>(null);
  const cameraRef = useRef<CameraView>(null);
  const [tutOpacity] = useState(new Animated.Value(1));

  const allPlayersScanned = players.length >= 2 && players.every(p => p.city.length > 0);

  // LOADING SCREEN
  useEffect(() => {
    Animated.timing(loadingFade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    NavigationBar.setBackgroundColorAsync('#262523').catch(() => {});
    const t = setTimeout(() => setScreen('tutorial'), 2500);
    return () => clearTimeout(t);
  }, []);

  // TIMER
  useEffect(() => {
    if (phase !== 'view' || timerPaused || timer <= 0) return;
    const interval = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [phase, timerPaused, timer]);

  useEffect(() => {
    if (timer <= 10 && timer > 0 && phase === 'view') {
      playTimerTick(); Vibration.vibrate(200);
      Animated.sequence([
        Animated.timing(timerPulse, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(timerPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    if (timer === 0 && phase === 'view') { playTimerWarning(); Vibration.vibrate(500); setPhase('pick'); }
  }, [timer, phase]);

  // GAME LOGIC
  const getRandomLocation = useCallback(() => {
    const available = panoramaLocations.filter(l => !usedLocations.includes(l.id));
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : panoramaLocations[Math.floor(Math.random() * panoramaLocations.length)];
  }, [usedLocations]);

  const addPlayer = () => {
    const count = players.length + 1;
    setPlayers(prev => [...prev, { id: Date.now(), name: `Spieler ${count}`, city: '', cityId: -1, lat: 0, lng: 0, score: 0 }]);

    playClickSound();
  };

  const openCityScan = (idx: number) => {
    setScanCityForIdx(idx); setShowCityScanner(true); setScanned(false); setScanError(''); setManualCode('');
  };

  // Manual code entry for city cards
  const submitManualCode = useCallback(() => {
    if (!manualCode.trim() || scanCityForIdx === null) return;
    const code = manualCode.trim();
    const assign = (loc: any, id: number) => {
      // Check if city already taken
      const takenBy = players.find(p => p.city.toLowerCase() === loc.city.toLowerCase() && players.indexOf(p) !== scanCityForIdx);
      if (takenBy) {
        setScanError(`Diese Karte ist bereits vergeben von ${takenBy.name}`);
        setTimeout(() => setScanError(''), 2500);
        return;
      }
      playClickSound(); Vibration.vibrate(100);
      setUsedLocations(prev => [...prev, id]);
      setPlayers(prev => prev.map((p, i) =>
        i === scanCityForIdx ? { ...p, city: loc.city, cityId: id, lat: loc.lat, lng: loc.lng } : p
      ));
      setShowCityScanner(false); setScanned(false); setScanCityForIdx(null); setManualCode('');
    };
    // Try number match
    const numMatch = code.match(/#?(\d+)/);
    if (numMatch) {
      const id = parseInt(numMatch[1], 10);
      if (id >= 0 && id < panoramaLocations.length) {
        const loc = panoramaLocations.find(l => l.id === id);
        if (loc) { assign(loc, id); return; }
      }
    }
    // Try text match
    const normalized = code.toLowerCase().trim().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    const textMatch = panoramaLocations.find(l => l.city.toLowerCase() === normalized);
    if (textMatch) { assign(textMatch, textMatch.id); return; }
    setScanError('Nicht erkannt – Code oder Stadtname prüfen');
    setTimeout(() => setScanError(''), 2000);
  }, [manualCode, scanCityForIdx, players]);

  const startGame = () => {
    if (!allPlayersScanned) return;
    playClickSound();
    setTableCities(players.map(p => ({ city: p.city, lat: p.lat, lng: p.lng, ownerPlayerId: p.id, isPlayerCity: true })));
    setRound(1); setMaxRounds(roundsSetting * players.length); setActivePlayerIdx(0); setUsedLocations([]);
    setPhase('scan-qr'); setScreen('game');
  };

  const startRound = useCallback(() => {
    setPhase('scan-qr'); setSvLoaded(false); setSvError(false);
    setClosestCityIdx(null); setDistances([]); setWinnerId(null);
    setChallengerId(null); setActivePickIdx(null);
    setTimer(timerSetting); setTimerPaused(false); resultScale.setValue(0);
  }, [timerSetting]);

  const onQrScanned = useCallback((loc: PanoramaLocation) => {
    setLocation(loc); setUsedLocations(prev => [...prev, loc.id]);
    setTimer(timerSetting); setTimerPaused(false); setPhase('view');
    setShowQrScanner(false); setScanned(false); Vibration.vibrate(100);
  }, [timerSetting]);

  const pickCity = useCallback((idx: number) => {
    playClickSound(); setTimerPaused(true);
    const dists = tableCities.map(tc => calculateDistance(location.lat, location.lng, tc.lat, tc.lng));
    setDistances(dists);
    let minIdx = 0; for (let i = 1; i < dists.length; i++) if (dists[i] < dists[minIdx]) minIdx = i;
    setClosestCityIdx(minIdx);
    setActivePickIdx(idx);
    // Don't resolve yet — go to challenge phase
    setPhase('challenge');
    setChallengerId(null);
  }, [tableCities, location]);

  // Resolve the round (called after challenge phase or skip)
  const resolveRound = useCallback(() => {
    const minIdx = closestCityIdx;
    const pickedIdx = activePickIdx;
    if (minIdx === null || pickedIdx === null) return;
    const originalCorrect = pickedIdx === minIdx;

    if (challengerId !== null) {
      // There was a challenge
      if (originalCorrect) {
        // Original player was right — challenge fails, active player gets point
        playPerfectSound(); Vibration.vibrate([100, 50, 100]);
        setPlayers(prev => prev.map(p => p.id === players[activePlayerIdx].id ? { ...p, score: p.score + 1 } : p));
        setWinnerId(players[activePlayerIdx].id);
      } else {
        // Original player was wrong — challenger gets the point
        playPerfectSound(); Vibration.vibrate([100, 50, 100]);
        setPlayers(prev => prev.map(p => p.id === challengerId ? { ...p, score: p.score + 1 } : p));
        setWinnerId(challengerId);
      }
    } else {
      // No challenge — normal resolution
      if (originalCorrect) {
        playPerfectSound(); Vibration.vibrate([100, 50, 100]);
        // Point goes to the active player who picked correctly
        setPlayers(prev => prev.map(p => p.id === players[activePlayerIdx].id ? { ...p, score: p.score + 1 } : p));
        setWinnerId(players[activePlayerIdx].id);
      } else {
        playErrorSound(); Vibration.vibrate(500);
        setWinnerId(null);
      }
    }

    setTableCities(prev => [...prev, { city: location.city, lat: location.lat, lng: location.lng, ownerPlayerId: null, isPlayerCity: false }]);
    Animated.spring(resultScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    setPhase('result');
  }, [closestCityIdx, activePickIdx, challengerId, tableCities, location, activePlayerIdx]);

  const nextTurn = () => {
    playClickSound();
    if (round >= maxRounds) { setScreen('result'); return; }
    setActivePlayerIdx(prev => (prev + 1) % players.length);
    setRound(r => r + 1); startRound();
  };

  // Camera capture + OCR
  const captureAndRecognize = useCallback(async () => {
    if (!cameraRef.current || scanned || scanCityForIdx === null) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo?.uri) return;
      const result = await TextRecognition.recognize(photo.uri);
      const allText = result.text.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
      // Try to match a known city name from OCR text
      const matched = panoramaLocations.find(l => allText.includes(l.city.toLowerCase()));
      if (matched) {
        const takenBy = players.find(p => p.city.toLowerCase() === matched.city.toLowerCase() && players.indexOf(p) !== scanCityForIdx);
        if (takenBy) {
          setScanError(`Diese Karte ist bereits vergeben von ${takenBy.name}`);
          setScanned(true);
          setTimeout(() => { setScanError(''); setScanned(false); }, 2500);
          return;
        }
        playClickSound(); setScanned(true); Vibration.vibrate(100);
        setPlayers(prev => prev.map((p, i) =>
          i === scanCityForIdx ? { ...p, city: matched.city, cityId: matched.id, lat: matched.lat, lng: matched.lng } : p
        ));
        setShowCityScanner(false); setScanned(false); setScanCityForIdx(null);
      } else {
        setScanError('Stadt nicht erkannt – nochmal versuchen oder Code eingeben');
        setTimeout(() => setScanError(''), 2500);
      }
    } catch (e) {
      setScanError('Aufnahme fehlgeschlagen – nochmal versuchen');
      setTimeout(() => setScanError(''), 2000);
    }
  }, [scanned, scanCityForIdx, players]);

  // ═══════════════ SCAN HANDLER — 3 MECHANICS ═══════════════
  const handleScan = useCallback(({ data }: { data: string }) => {
    if (scanned || !data) return;
    console.log('[SCAN]', data, 'cityScanner:', showCityScanner, 'qrScanner:', showQrScanner, 'idx:', scanCityForIdx);

    // GAME QR → Street View
    if (showQrScanner) {
      const numMatch = data.match(/#?(\d+)/);
      if (numMatch) {
        const id = parseInt(numMatch[1], 10);
        if (id >= 0 && id < panoramaLocations.length) {
          const loc = panoramaLocations.find(l => l.id === id);
          if (loc) { 
            if (usedLocations.includes(id) || tableCities.some(tc => tc.city.toLowerCase() === loc.city.toLowerCase())) {
              setScanError('Diese Stadt liegt bereits auf dem Tisch!');
              setScanned(true); setTimeout(() => { setScanError(''); setScanned(false); }, 2500); return;
            }
            playClickSound(); setScanned(true); Vibration.vibrate(100); onQrScanned(loc); return; 
          }
        }
      }
      if (data.startsWith('city:')) {
        const id = parseInt(data.split(':')[1]);
        if (id >= 0 && id < panoramaLocations.length) {
          const loc = panoramaLocations.find(l => l.id === id);
          if (loc) { 
            if (usedLocations.includes(id) || tableCities.some(tc => tc.city.toLowerCase() === loc.city.toLowerCase())) {
              setScanError('Diese Stadt liegt bereits auf dem Tisch!');
              setScanned(true); setTimeout(() => { setScanError(''); setScanned(false); }, 2500); return;
            }
            playClickSound(); setScanned(true); Vibration.vibrate(100); onQrScanned(loc); return; 
          }
        }
      }
      return;
    }

    // CITY CARD ASSIGNMENT
    if (!showCityScanner || scanCityForIdx === null) return;

    const assign = (loc: any, id: number) => {
      // Check if city already taken by another player
      const takenBy = players.find(p => p.city.toLowerCase() === loc.city.toLowerCase() && players.indexOf(p) !== scanCityForIdx);
      if (takenBy) {
        setScanError(`Diese Karte ist bereits vergeben von ${takenBy.name}`);
        setScanned(true);
        setTimeout(() => { setScanError(''); setScanned(false); }, 2500);
        return;
      }
      playClickSound(); setScanned(true); Vibration.vibrate(100);
      setUsedLocations(prev => [...prev, id]);
      setPlayers(prev => prev.map((p, i) =>
        i === scanCityForIdx ? { ...p, city: loc.city, cityId: id, lat: loc.lat, lng: loc.lng } : p
      ));
      setShowCityScanner(false); setScanned(false); setScanCityForIdx(null);
    };

    // A) Barcode: #042 or 042
    const numMatch = data.match(/#?(\d+)/);
    if (numMatch) {
      const id = parseInt(numMatch[1], 10);
      if (id >= 0 && id < panoramaLocations.length) {
        const loc = panoramaLocations.find(l => l.id === id);
        if (loc) { assign(loc, id); return; }
      }
    }

    // B) Text: "Berlin" "Tokyo" etc
    const normalized = data.toLowerCase().trim().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    const textMatch = panoramaLocations.find(l => l.city.toLowerCase() === normalized);
    if (textMatch) { assign(textMatch, textMatch.id); return; }

    // C) Token: "city:42"
    if (data.startsWith('city:')) {
      const id = parseInt(data.split(':')[1]);
      if (id >= 0 && id < panoramaLocations.length) {
        const loc = panoramaLocations.find(l => l.id === id);
        if (loc) { assign(loc, id); return; }
      }
    }

    setScanError('Karte nicht erkannt – nochmal versuchen');
    setTimeout(() => setScanError(''), 2000);
  }, [scanned, showCityScanner, scanCityForIdx, showQrScanner, onQrScanned]);

  // TUTORIAL
  const TUT_PAGES = [
    { bg: '#262523', titleColor: '#D9593C', bodyColor: '#F1E8E1', title: 'Eine Aufgabe. Nur eine.', body: 'Du stehst plötzlich irgendwo auf der Welt. Wo bist du nur? Auf dem Tisch liegen Stadtnamen. Deine Aufgabe: Welche Stadt liegt am nächsten zu dem, was du siehst?' },
    { bg: '#F2A344', titleColor: '#262523', bodyColor: '#262523', title: 'Ziehen. Scannen. Die Zeit läuft.', body: 'Zieh eine Karte vom Stapel. Scanne den QR-Code mit der App. Ein Ort irgendwo auf der Welt erscheint – und der Timer startet, ob du bereit bist oder nicht.' },
    { bg: '#262523', titleColor: '#F2A344', bodyColor: '#F1E8E1', title: 'Wo zur Hölle bist du?', body: 'Schau dich um. Lies die Zeichen. Hast du eine Landkarte im Kopf?\n\nWähle die Stadt vom Tisch, die am nächsten dran liegt. Je näher du liegst, desto mehr Punkte.' },
    { bg: '#D9593C', titleColor: '#262523', bodyColor: '#262523', title: 'Auf die harte Tour?', body: 'Denkst du, jemand lag falsch? Setz einen Token und nenn DEINE Stadt.\n\nRichtig → Bonuspunkte.\nFalsch → Tschüss, Token.\n\n→ Los geht\'s!' },
  ];

  // ═══════════════ SCANNERS ═══════════════
  if (showCityScanner || showQrScanner) {
    if (!cameraPermission?.granted) {
      return (
        <View style={s.container}><StatusBar hidden />
          <View style={s.centerScreen}>
            <Text style={{ color: C.onSurface, fontSize: 18, marginBottom: 20, textAlign: 'center' }}>Kamera-Berechtigung erforderlich</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={requestCameraPermission}><Text style={s.primaryBtnText}>ERLAUBEN</Text></TouchableOpacity>
            <TouchableOpacity style={s.tertiaryBtn} onPress={() => { setShowCityScanner(false); setShowQrScanner(false); setScanned(false); }}><Text style={s.tertiaryBtnText}>ABBRECHEN</Text></TouchableOpacity>
          </View>
        </View>
      );
    }
    const assignName = showCityScanner && scanCityForIdx !== null ? players[scanCityForIdx]?.name : '';
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}><StatusBar hidden />
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'] }}
        >
          <View style={s.scanOverlay}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: C.primary, fontSize: 13, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 2, marginBottom: 6 }}>
                {showCityScanner ? 'KARTE ZUWEISEN' : 'QR-KARTE SCANNEN'}}
              </Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', fontFamily: FF.bold }}>{assignName || 'Spieler'}</Text>
            </View>
            <View style={s.scanFrame}>
              <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                {showCityScanner ? 'Stadtkarte in den Rahmen halten' : 'QR-Karte in den Rahmen halten'}
              </Text>
            </View>

            {showCityScanner && (
              <TouchableOpacity style={{ backgroundColor: C.error, width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', marginTop: 20, alignSelf: 'center' }} onPress={captureAndRecognize}>
                <Text style={{ color: C.bg, fontSize: 26, fontWeight: '700', fontFamily: FF.bold }}>◉</Text>
              </TouchableOpacity>
            )}

            {showCityScanner && (
              <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 16 }}>
                <Text style={{ color: 'rgba(241,232,225,0.6)', fontSize: 11, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 2, textAlign: 'center', marginBottom: 10, textTransform: 'uppercase' }}>Oder Code manuell eingeben</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(25,26,45,0.9)', borderWidth: 1, borderColor: 'rgba(68,73,52,0.4)', borderRadius: 0 }}>
                    <TextInput
                      style={{ color: '#fff', fontSize: 16, fontFamily: FF.bold, paddingVertical: 12, paddingHorizontal: 16 }}
                      value={manualCode}
                      onChangeText={setManualCode}
                      placeholder="#042 oder Berlin"
                      placeholderTextColor="rgba(241,232,225,0.3)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={submitManualCode}
                    />
                  </View>
                  <TouchableOpacity style={{ backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center' }} onPress={submitManualCode}>
                    <Text style={{ color: C.onPrimaryContainer, fontSize: 14, fontWeight: '700', fontFamily: FF.bold }}>GO</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {scanError ? (
              <View style={{ backgroundColor: 'rgba(255,100,100,0.9)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, marginTop: 16 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{scanError}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={s.scanCloseBtn} onPress={() => { setShowCityScanner(false); setShowQrScanner(false); setScanned(false); setManualCode(''); }}>
              <Text style={s.scanCloseText}>SCHLIESSEN</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // ═══════════════ LOADING ═══════════════
  if (screen === 'intro') {
    return (
      <View style={{ flex: 1, backgroundColor: '#262523' }}><StatusBar hidden />
        <TouchableOpacity
          activeOpacity={1}
          style={{ ...StyleSheet.absoluteFillObject, zIndex: 10 }}
          onPress={() => setScreen('tutorial')}
        >
          <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 20 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: FF.regular }}>Überspringen</Text>
          </View>
        </TouchableOpacity>
        <Image source={require('./assets/intro_last_frame.png')} style={{ ...StyleSheet.absoluteFillObject }} resizeMode="cover" />
        {introPhase === 'video' && (
          <Video
            source={require('./assets/intro.mp4')}
            style={{ ...StyleSheet.absoluteFillObject }}
            resizeMode="cover"
            shouldPlay
            onEnd={() => {
              setIntroPhase('still');
              setTimeout(() => {
                setIntroPhase('freeze');
                setTimeout(() => setScreen('tutorial'), 2500);
              }, 500);
            }}
            onError={(e) => { console.warn('Intro video error', e); setScreen('tutorial'); }}
          />
        )}
        {introPhase === 'freeze' && (
          <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(38,37,35,0.6)' }}>
            <Text style={{ color: C.primary, fontSize: 16, fontFamily: FF.regular, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 40, lineHeight: 24 }}>„{loadingQuote}“</Text>
          </View>
        )}
      </View>
    );
  }

  if (screen === 'loading') {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#262523' }]}>
        <StatusBar hidden />
        <Animated.View style={{ opacity: loadingFade, alignItems: 'center' }}>
          <Image source={require('./assets/logo-startscreen.png')} style={{ marginBottom: 28 }} resizeMode="contain" />
          <Text style={{ color: '#F1E8E1', fontSize: 22, fontFamily: FF.regular, letterSpacing: 6, marginBottom: 6 }}>GEOCHECKR</Text>
          <Text style={{ color: '#F1E8E1', fontSize: 10, fontFamily: FF.regular, letterSpacing: 3, opacity: 0.7, marginBottom: 32 }}>STREET VIEW EDITION</Text>
          <Text style={{ color: C.primary, fontSize: 14, fontFamily: FF.regular, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 40, opacity: 0.7, lineHeight: 22 }}>"{loadingQuote}"</Text>
        </Animated.View>
      </View>
    );
  }

  // ═══════════════ TUTORIAL ═══════════════
  if (screen === 'tutorial') {
    const goToPage = (idx: number) => {
      if (idx < 0 || idx >= TUT_PAGES.length || idx === tutorialPage) return;
      tutOpacity.setValue(0);
      tutScrollRef.current?.scrollTo({ x: idx * width, animated: false });
      setTutorialPage(idx);
      Animated.timing(tutOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    };
    const handleTutScroll = (e: any) => {
      const x = e.nativeEvent.contentOffset.x;
      const newPage = Math.round(x / width);
      // Spacer page reached → go to setup
      if (newPage >= TUT_PAGES.length) {
        setScreen('setup');
        return;
      }
      if (newPage !== tutorialPage && newPage >= 0 && newPage < TUT_PAGES.length) {
        tutOpacity.setValue(0);
        setTutorialPage(newPage);
        Animated.timing(tutOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }
    };
    return (
      <View style={{ flex: 1 }}>
        <StatusBar hidden />
        <ScrollView
          ref={tutScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollEndDrag={handleTutScroll}
          onMomentumScrollEnd={handleTutScroll}
        >
          {TUT_PAGES.map((p, i) => (
            <View key={i} style={{ width, height, backgroundColor: p.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36 }}>
              <View style={{ alignItems: 'center', paddingHorizontal: 10 }}>
                <Text style={{ color: p.titleColor, fontSize: 48, fontWeight: '700', fontFamily: FF.bold, textAlign: 'center', marginBottom: 36, lineHeight: 56 }}>{p.title}</Text>
                <Text style={{ color: p.bodyColor || '#F1E8E1', fontSize: 24, fontFamily: FF.regular, textAlign: 'center', lineHeight: 38, opacity: 0.95 }}>{p.body}</Text>
              </View>
            </View>
          ))}
          {/* Spacer page — swipe past last tutorial page → setup */}
          <View style={{ width, height, backgroundColor: C.bg }} />
        </ScrollView>
        <View style={{ position: 'absolute', bottom: 100, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {TUT_PAGES.map((_, i) => <View key={i} style={{ width: tutorialPage === i ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: tutorialPage === i ? TUT_PAGES[i].titleColor : 'rgba(255,255,255,0.2)', marginHorizontal: 2 }} />)}
        </View>
        <View style={{ position: 'absolute', bottom: 40, width: '100%', paddingHorizontal: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setScreen('setup')}><Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, fontFamily: FF.regular }}>Tutorial überspringen</Text></TouchableOpacity>
          {tutorialPage < TUT_PAGES.length - 1 ? (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: FF.regular }}>Swipe →</Text>
          ) : (
            <TouchableOpacity style={{ backgroundColor: C.error, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 9999 }} onPress={() => setScreen('setup')}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', fontFamily: FF.bold }}>Auf geht's!</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ═══════════════ SETUP — Timo's HTML Design ═══════════════
  if (screen === 'setup') {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar hidden />
        <ScrollView contentContainerStyle={s.setupScroll} keyboardShouldPersistTaps="handled">
          <Text style={s.setupTitle}>SESSION EINRICHTEN</Text>
          <View style={s.titleBar} />

          <View style={s.sectionLabel}><Text style={s.sectionLabelText}>SPIELER</Text></View>

          {players.map((p, i) => (
            <View key={p.id} style={s.playerRow}>
              <View style={{ flex: 1, position: 'relative' }}>
                <TextInput
                  style={[s.playerInput, p.city.length > 0 && { paddingBottom: 2 }]}
                  value={p.name.startsWith('Spieler ') ? '' : p.name}
                  onChangeText={t => setPlayers(prev => prev.map((pp, idx) => idx === i ? { ...pp, name: t.length > 0 ? t : `Spieler ${idx + 1}` } : pp))}
                  placeholder={`Spieler ${i + 1}`}
                  placeholderTextColor="rgba(241,232,225,0.3)"
                />
                {p.city.length > 0 && <Text style={s.cityBadgeInline}>{p.city}</Text>}
              </View>
              <TouchableOpacity style={[s.hashBtn, p.city.length > 0 && s.hashBtnDone]} onPress={() => openCityScan(i)}>
                <Text style={[s.hashBtnText, p.city.length > 0 && s.hashBtnTextDone]}>
                  {p.city.length > 0 ? '✓' : '#'}
                </Text>
              </TouchableOpacity>
              {players.length > 2 ? (
                <TouchableOpacity style={s.removeBtn} onPress={() => setPlayers(prev => prev.filter(pp => pp.id !== p.id))}>
                  <Text style={{ color: C.error, fontSize: 14, fontWeight: '700', fontFamily: FF.bold }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}

          <TouchableOpacity style={s.recruitBtn} onPress={addPlayer}>
            <Text style={s.recruitBtnText}>+ NEUER SPIELER</Text>
          </TouchableOpacity>

          <View style={s.gridRow}>
            <View style={s.gridCol}>
              <View style={s.sectionLabel}><Text style={s.sectionLabelText}>ZEIT</Text></View>
              <View style={s.chipRow}>
                {[5, 15, 30].map(t => (
                  <TouchableOpacity key={t} style={[s.chip, timerSetting === t && s.chipActive]} onPress={() => setTimerSetting(t)}>
                    <Text style={[s.chipText, timerSetting === t && s.chipTextActive]}>{t}s</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.gridCol}>
              <View style={s.sectionLabel}><Text style={s.sectionLabelText}>RUNDEN</Text></View>
              <View style={s.chipRow}>
                {[5, 10, 15].map(r => (
                  <TouchableOpacity key={r} style={[s.chip, roundsSetting === r && s.chipActive]} onPress={() => setRoundsSetting(r)}>
                    <Text style={[s.chipText, roundsSetting === r && s.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={{ marginTop: 32 }}>
            <TouchableOpacity style={[s.mainBtn, !allPlayersScanned && s.mainBtnDisabled]} disabled={!allPlayersScanned} onPress={startGame}>
              <Text style={s.mainBtnText}>{allPlayersScanned ? 'ALLES KLAR, LOS GEHT\'S!' : 'ERST ALLE KARTEN SCANNEN'}</Text>
            </TouchableOpacity>
            <Text style={s.actionHint}>{allPlayersScanned ? `${players.length} Spieler bereit` : 'City Cards für alle Spieler scannen'}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ═══════════════ GAME ═══════════════
  if (screen === 'game') {
    const activePlayer = players[activePlayerIdx];
    const timerColor = timer <= 10 ? C.error : C.primary;

    if (phase === 'scan-qr') {
      return (
        <View style={s.container}><StatusBar hidden />
          <View style={s.gameTopBar}>
            <Text style={{ color: C.primary, fontSize: 14, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 1 }}>{activePlayer.name}</Text>
            <Text style={{ color: C.onSurface, fontSize: 12, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 4 }}>R{round}/{maxRounds}</Text>
          </View>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40 }}>
            <Text style={{ color: C.onSurface, fontSize: 15, fontFamily: FF.regular, textAlign: 'center', marginBottom: 12, opacity: 0.6 }}>Karte auf dem Tisch abgelegt?</Text>
            <Text style={{ color: C.onSurface, fontSize: 22, fontWeight: '700', fontFamily: FF.bold, textAlign: 'center', marginBottom: 8 }}>{activePlayer.name}, zieh eine QR-Karte!</Text>
            <Text style={{ color: 'rgba(241,232,225,0.6)', fontSize: 14, fontFamily: FF.regular, textAlign: 'center', marginBottom: 24 }}>QR-Karte scannen, um den Ort zu enthüllen</Text>
            <View style={[s.tableList, { maxHeight: height * 0.45 }]}>
              <Text style={{ color: C.primary, fontSize: 10, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 3, marginBottom: 12 }}>STÄDTE AUF DEM TISCH</Text>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} style={{ maxHeight: height * 0.38 }}>
                {tableCities.map((tc, i) => (
                  <View key={i} style={[s.tableRow, i % 2 === 0 ? { backgroundColor: C.surfaceLow } : { backgroundColor: C.surface }]}>
                    <Text style={{ color: C.primary, fontSize: 14, marginRight: 10 }}>{tc.isPlayerCity ? '◉' : '◈'}</Text>
                    <Text style={{ color: C.onSurface, fontSize: 15, fontWeight: '600' }}>{tc.city}</Text>
                    {tc.isPlayerCity && <Text style={{ color: 'rgba(241,232,225,0.5)', fontSize: 12, marginLeft: 8 }}>— {players.find(pp => pp.id === tc.ownerPlayerId)?.name}</Text>}
                  </View>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={[s.primaryBtn, { marginTop: 24 }]} onPress={() => { setShowQrScanner(true); setScanned(false); }}>
              <Text style={s.primaryBtnText}>QR-KARTE SCANNEN</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={s.container}><StatusBar hidden />
        <View style={s.gameTopBar}>
          <Text style={{ color: C.primary, fontSize: 14, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 1 }}>{activePlayer.name}</Text>
          <Text style={{ color: C.onSurface, fontSize: 12, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 4 }}>R{round}/{maxRounds}</Text>
        </View>

        {phase === 'view' && (
          <>
            <WebView key={`${location.lat}-${location.lng}`} source={{ html: buildStreetViewHtml(location.lat, location.lng) }}
              style={{ flex: 1 }} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false} mixedContentMode="compatibility" scrollEnabled
              onError={() => setSvError(true)}
              onMessage={(e) => { const msg = e.nativeEvent.data; if (msg === 'loaded') setSvLoaded(true); if (msg.startsWith('error')) setSvError(true); }}
              userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" />
            {!svLoaded && !svError && <View style={s.loadingOverlay}><Text style={{ color: 'rgba(241,232,225,0.6)' }}>Ort wird geladen...</Text></View>}
            {svError && <View style={s.errorOverlay}><Text style={{ color: C.error, fontSize: 16, marginBottom: 20 }}>Kein Ort verfügbar</Text><TouchableOpacity style={s.primaryBtn} onPress={nextTurn}><Text style={s.primaryBtnText}>ÜBERSPRINGEN</Text></TouchableOpacity></View>}
            {svLoaded && <>
              <Animated.View style={[s.timer, { borderColor: timerColor, transform: [{ scale: timerPulse }] }]}><Text style={[s.timerText, { color: timerColor }]}>{timer}</Text></Animated.View>
              <TouchableOpacity style={s.pickBtn} onPress={() => { playClickSound(); setTimerPaused(true); setPhase('pick'); }}><Text style={s.pickBtnText}>ICH WEISS ES!</Text></TouchableOpacity>
            </>}
          </>
        )}

        {phase === 'pick' && (
          <View style={s.pickScreen}>
            <Text style={{ color: C.onSurface, fontSize: 20, fontWeight: '700', fontFamily: FF.bold, textAlign: 'center', marginBottom: 4 }}>
{challengerId !== null ? `${players.find(p => p.id === challengerId)?.name}, wähle deine Stadt` : `${activePlayer.name}, wähle die Stadt, die dem gezeigten Ort am nächsten liegt`}
            </Text>
            <Text style={{ color: 'rgba(241,232,225,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
              {challengerId !== null ? `${players.find(p => p.id === challengerId)?.name}, wähle deine Stadt` : `${activePlayer.name}, wähle die nächste Stadt zum gezeigten Ort`}
            </Text>
            <ScrollView style={{ flex: 1, width: '100%' }}>
              {tableCities.map((tc, i) => (
                <TouchableOpacity key={i} style={[s.pickOption, i % 2 === 0 ? { backgroundColor: C.surfaceLow } : { backgroundColor: C.surface }]} onPress={() => {
                  if (challengerId !== null) {
                    // Challenger picked — check if correct, then resolve
                    playClickSound(); setTimerPaused(true);
                    const dists = tableCities.map(t => calculateDistance(location.lat, location.lng, t.lat, t.lng));
                    setDistances(dists);
                    // Resolve with challenge
                    resolveRound();
                  } else {
                    pickCity(i);
                  }
                }}>
                  <Text style={{ color: C.primary, fontSize: 18, marginRight: 14 }}>{tc.isPlayerCity ? '◉' : '◈'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.onSurface, fontSize: 18, fontWeight: '600' }}>{tc.city}</Text>
                    {tc.isPlayerCity && tc.ownerPlayerId !== null && <Text style={{ color: 'rgba(241,232,225,0.5)', fontSize: 12 }}>{players.find(pp => pp.id === tc.ownerPlayerId)?.name}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {phase === 'challenge' && activePickIdx !== null && (
          <View style={s.pickScreen}>
            <Text style={{ color: C.accent, fontSize: 20, fontWeight: '700', fontFamily: FF.bold, textAlign: 'center', marginBottom: 4 }}>CHALLENGE?</Text>
            <Text style={{ color: C.onSurface, fontSize: 16, textAlign: 'center', marginBottom: 6 }}>{activePlayer.name} wählte:</Text>
            <View style={{ backgroundColor: C.surface, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 24, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: C.primary, fontSize: 22, fontWeight: '700', fontFamily: FF.bold }}>{tableCities[activePickIdx].city}</Text>
            </View>
            <Text style={{ color: 'rgba(241,232,225,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>Möchte ein Spieler challengen?</Text>
            <ScrollView style={{ flex: 1, width: '100%' }}>
              {players.filter(p => p.id !== activePlayer.id).map(p => (
                <TouchableOpacity key={p.id} style={[s.pickOption, { backgroundColor: C.surfaceLow }]} onPress={() => { playClickSound(); setChallengerId(p.id); }}>
                  <Text style={{ color: C.accent, fontSize: 18, marginRight: 14 }}>{challengerId === p.id ? '◉' : '○'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.onSurface, fontSize: 18, fontWeight: '600' }}>{p.name}</Text>
                  </View>
                  {challengerId === p.id && <Text style={{ color: C.green, fontSize: 14, fontWeight: '700', fontFamily: FF.bold }}>CHALLENGT</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {challengerId !== null ? (
              <TouchableOpacity style={[s.primaryBtn, { marginTop: 16, width: '100%' }]} onPress={() => { playClickSound(); setPhase('pick'); }}>
                <Text style={s.primaryBtnText}>CHALLENGER WÄHLT</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[s.primaryBtn, { marginTop: 16, width: '100%', backgroundColor: C.surfaceHigh }]} onPress={() => resolveRound()}>
                <Text style={[s.primaryBtnText, { color: C.onSurface }]}>KEIN CHALLENGE</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {phase === 'result' && closestCityIdx !== null && (
          <View style={s.resultOverlay}>
            <Animated.View style={[s.resultCard, { transform: [{ scale: resultScale }] }]}>
              <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>{winnerId !== null && winnerId === activePlayer.id ? '🎯' : '📍'}</Text>
              <Text style={{ color: C.primary, fontSize: 26, fontWeight: '700', fontFamily: FF.bold, textAlign: 'center', marginBottom: 4 }}>{location.city}</Text>
              <Text style={{ color: 'rgba(241,232,225,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>({location.country})</Text>
              <Text style={{ color: C.onSurface, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>liegt am nächsten an {tableCities[closestCityIdx].city}</Text>
              {tableCities.filter(tc => tc.city.toLowerCase() !== location.city.toLowerCase()).map((tc, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: i === closestCityIdx ? 'rgba(242,163,68,0.15)' : C.surfaceLow, marginBottom: 2, borderRadius: 4 }}>
                  <Text style={{ color: C.primary, fontSize: 15, fontWeight: '600', fontFamily: FF.bold }}>{tc.isPlayerCity ? '◉' : '◈'} {tc.city}</Text>
                  <Text style={{ color: C.onSurface, fontSize: 14, fontWeight: '600', fontFamily: FF.regular }}>{formatDistance(distances[tableCities.indexOf(tc)] ?? 0)}</Text>
                </View>
              ))}
              {winnerId !== null && <Text style={{ color: C.primary, fontSize: 16, fontWeight: '700', fontFamily: FF.bold, textAlign: 'center', marginVertical: 16 }}>⭐️ {players.find(pp => pp.id === winnerId)?.name} punktet!</Text>}
              <TouchableOpacity style={s.primaryBtn} onPress={nextTurn}>
                <Text style={s.primaryBtnText}>{round >= maxRounds ? 'ENDERGEBNIS' : 'NÄCHSTE RUNDE →'}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </View>
    );
  }

  // ═══════════════ END SCREEN ═══════════════
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
  const tiePlayers = isTie ? sorted.filter(p => p.score === sorted[0].score) : [];
  return (
    <View style={s.container}><StatusBar hidden />
      <ScrollView contentContainerStyle={s.endScroll}>
        <Text style={{ fontSize: 64, color: C.primary, marginBottom: 16 }}>✓</Text>
        <Text style={{ color: C.onSurface, fontSize: 28, fontWeight: '700', fontFamily: FF.bold, textAlign: 'center', marginBottom: 4 }}>{isTie ? 'UNENTSCHIEDEN!' : 'AUSWERTUNG ABGESCHLOSSEN'}</Text>
        <Text style={{ color: 'rgba(241,232,225,0.5)', fontSize: 11, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 40 }}>{isTie ? `${tiePlayers.map(p => p.name).join(' & ')} gleichauf mit ${sorted[0].score} Pkt. – Stechen!` : 'SESSIONDATEN BEREIT ZUR AUSWERTUNG'}</Text>
        {sorted.map((p, i) => (
          <View key={p.id} style={[s.endRow, i % 2 === 0 ? { backgroundColor: C.surfaceLow } : { backgroundColor: C.surface }]}>
            <Text style={{ color: C.primary, fontSize: 14, fontWeight: '700', fontFamily: FF.bold, width: 36 }}>#{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.onSurface, fontSize: 18, fontWeight: '700', fontFamily: FF.bold }}>{p.name}</Text>
              <Text style={{ color: 'rgba(241,232,225,0.5)', fontSize: 12, marginTop: 2 }}>{p.city}</Text>
            </View>
            <Text style={{ color: C.onSurface, fontSize: 28, fontWeight: '700', fontFamily: FF.bold }}>{p.score}</Text>
          </View>
        ))}
        <TouchableOpacity style={[s.primaryBtn, { marginTop: 32, width: '100%' }]} onPress={() => {
          setPlayers(prev => prev.map(p => ({ ...p, city: '', cityId: -1, lat: 0, lng: 0, score: 0 })));
          setScreen('setup');
        }}>
          <Text style={s.primaryBtnText}>NOCHMAL SPIELEN</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ═══════════════ STYLES ═══════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  // Tutorial
  tutSlide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  tutEmoji: { fontSize: 80, marginBottom: 32 },
  tutTitle: { fontSize: 28, fontWeight: '700', marginBottom: 16, textAlign: 'center', letterSpacing: -0.5 },
  tutBody: { fontSize: 16, textAlign: 'center', lineHeight: 26 },
  tutDots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32, gap: 8 },
  tutDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.surfaceHighest },
  tutDotActive: { backgroundColor: C.primary, width: 24 },
  tutBtnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 32, paddingBottom: 48 },

  // Buttons
  primaryBtn: { backgroundColor: C.primary, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  primaryBtnText: { color: C.onPrimaryContainer, fontSize: 14, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 2, textTransform: 'uppercase' },
  tertiaryBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  tertiaryBtnText: { color: 'rgba(38,37,35,0.35)', fontSize: 13, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 2, textTransform: 'uppercase' },

  // Setup
  setupScroll: { paddingTop: 48, paddingBottom: 80, paddingHorizontal: 24 },
  setupHeader: { color: C.primary, fontSize: 24, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 32 },
  setupTitle: { color: C.onSurface, fontSize: 28, fontWeight: '700', fontFamily: FF.bold, marginBottom: 8 },
  titleBar: { width: 48, height: 4, backgroundColor: C.error, marginBottom: 32 },
  sectionLabel: { marginBottom: 12, marginTop: 8 },
  sectionLabelText: { color: C.secondary, fontSize: 10, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 3, textTransform: 'uppercase' },

  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLow, marginBottom: 8, paddingRight: 0 },
  playerInput: { flex: 1, color: C.onSurface, fontSize: 16, fontWeight: '500', fontFamily: FF.regular, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: C.surfaceLow, borderBottomWidth: 1, borderBottomColor: 'rgba(68,73,52,0.15)' },
  cityBadgeInline: { color: C.primary, fontSize: 10, fontWeight: '600', letterSpacing: 1, paddingHorizontal: 16, paddingBottom: 0, paddingTop: 1 },
  cityBadgeBelow: { color: C.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingHorizontal: 16, paddingBottom: 6, paddingTop: 2, backgroundColor: C.surfaceLow },
  hashBtn: { backgroundColor: C.error, paddingVertical: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  hashBtnDone: { backgroundColor: C.primary },
  hashBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: FF.bold },
  hashBtnTextDone: { color: C.bg },
  cityBadge: { color: C.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginLeft: 8 },
  removeBtn: { paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLow, marginBottom: 8 },
  recruitBtn: { alignItems: 'center', paddingVertical: 16, marginBottom: 32 },
  recruitBtnText: { color: C.error, fontSize: 12, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 3, textTransform: 'uppercase' },

  gridRow: { flexDirection: 'row', gap: 24, marginBottom: 48 },
  gridCol: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(68,73,52,0.3)' },
  chipActive: { backgroundColor: C.error, borderColor: C.error },
  chipText: { color: 'rgba(241,232,225,0.6)', fontSize: 12, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 2 },
  chipTextActive: { color: '#fff' },

  mainBtn: { backgroundColor: C.error, paddingVertical: 20, alignItems: 'center' },
  mainBtnDisabled: { backgroundColor: C.surfaceHighest },
  mainBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 3, textTransform: 'uppercase' },
  actionHint: { color: 'rgba(241,232,225,0.3)', fontSize: 10, fontFamily: FF.regular, textAlign: 'center', marginTop: 12, letterSpacing: 2, textTransform: 'uppercase' },

  // Scanner
  scanOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  scanFrame: { width: 260, height: 260, borderWidth: 3, borderColor: C.error, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', marginBottom: 20 },
  scanCloseBtn: { position: 'absolute', bottom: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 24, paddingVertical: 12 },
  scanCloseText: { color: C.onSurface, fontSize: 14, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 2 },

  // Game
  gameTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 44, paddingBottom: 8, backgroundColor: 'rgba(38,37,35,0.92)', zIndex: 20 },
  tableList: { width: '100%', backgroundColor: C.surface, padding: 16, marginBottom: 32 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },

  timer: { position: 'absolute', top: 80, right: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(241,232,225,0.95)', borderWidth: 3, justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  timerText: { fontSize: 22, fontWeight: '700', fontFamily: FF.bold },
  pickBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(241,232,225,0.95)', paddingHorizontal: 28, paddingVertical: 14, borderWidth: 1.5, borderColor: C.primary, zIndex: 20 },
  pickBtnText: { color: C.primary, fontSize: 16, fontWeight: '700', fontFamily: FF.bold, letterSpacing: 2 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, zIndex: 5 },
  errorOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, zIndex: 10, paddingHorizontal: 32 },

  pickScreen: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  pickOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, marginBottom: 4 },

  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(241,232,225,0.97)', zIndex: 40, justifyContent: 'center', paddingHorizontal: 20 },
  resultCard: { backgroundColor: C.surface, padding: 24 },

  // End screen
  endScroll: { paddingTop: 60, paddingBottom: 80, paddingHorizontal: 24, alignItems: 'center' },
  endRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingVertical: 18, paddingHorizontal: 16, marginBottom: 2 },
});
