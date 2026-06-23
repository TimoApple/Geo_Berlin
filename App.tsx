// GeoCheckr — Berlin Street Edition
// Design System: "The Tactical Cartographer"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Animated,
  Vibration, Platform, KeyboardAvoidingView, StatusBar, ScrollView, Dimensions, Image, PanResponder
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFonts, SpaceGrotesk_400Regular, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { VideoView, useVideoPlayer } from 'expo-video';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useArucoScanner } from './src/hooks/useArucoScanner';

import { calculateDistance, formatDistance } from './src/utils/distance';
import { playClickSound, playSuccessSound, playErrorSound, playPerfectSound, playTimerWarning, playTimerTick, playAnswerphoneBeep } from './src/utils/sounds';
import { panoramaLocations, PanoramaLocation, getRandomLocation, fetchLocationsFromDB, findLocationById, getLocations } from './src/data/panoramaLocations';
import PanoramaViewer from './src/components/PanoramaViewer';

const { width, height } = Dimensions.get('window');
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

// ═══════════════ SLIDER TRACK COMPONENT ═══════════════
const SNAP_VALUES = [1, 5, 10, 20, 30, 45];
function SliderTrack({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const containerRef = useRef<View>(null);
  const containerLayoutRef = useRef({ x: 0, y: 0, w: 0 });
  const currentSnapIdx = SNAP_VALUES.indexOf(value);
  const numSnaps = SNAP_VALUES.length;
  const LABEL_W = 40;

  const getLabelCenter = useCallback((idx: number, containerW: number) => {
    if (containerW <= 0) return 0;
    const gap = (containerW - numSnaps * LABEL_W) / (numSnaps - 1);
    return idx * (LABEL_W + gap) + LABEL_W / 2;
  }, []);

  const getSnapFromX = useCallback((pageX: number) => {
    const { x, w } = containerLayoutRef.current;
    if (w <= 0) return value;
    const relativeX = pageX - x;
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < numSnaps; i++) {
      const center = getLabelCenter(i, w);
      const dist = Math.abs(relativeX - center);
      if (dist < minDist) { minDist = dist; nearestIdx = i; }
    }
    return SNAP_VALUES[nearestIdx];
  }, [value, getLabelCenter]);

  const updateLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, w) => {
      containerLayoutRef.current = { x, y, w };
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { updateLayout(); onChange(getSnapFromX(e.nativeEvent.pageX)); },
      onPanResponderMove: (e) => { if (containerLayoutRef.current.w > 0) onChange(getSnapFromX(e.nativeEvent.pageX)); },
    })
  ).current;

  const [containerWidth, setContainerWidth] = useState(0);
  const circleCenter = currentSnapIdx >= 0 && containerWidth > 0 ? getLabelCenter(currentSnapIdx, containerWidth) : 0;

  return (
    <View ref={containerRef} style={{ height: 60, justifyContent: 'center', position: 'relative' }}
      onLayout={(e) => { const w = e.nativeEvent.layout.width; setContainerWidth(w); containerLayoutRef.current.x = 0; containerLayoutRef.current.w = w; updateLayout(); }}
      {...panResponder.panHandlers}>
      <View style={{ position: 'absolute', left: 0, top: 13, right: 0, height: 6, backgroundColor: C.surfaceHigh }}>
        <View style={{ position: 'absolute', left: 0, top: 0, height: 6, width: circleCenter, backgroundColor: C.primary }} />
      </View>
      <View style={{ position: 'absolute', left: circleCenter - 12, top: 4, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.outline, backgroundColor: C.surface }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 }}>
        {SNAP_VALUES.map(t => (
          <TouchableOpacity key={t} style={{ width: LABEL_W, height: 28, justifyContent: 'center', alignItems: 'center' }} onPress={() => onChange(t)}>
            <Text style={{ color: value === t ? C.primary : C.muted, fontSize: 14, fontFamily: FF.bold }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
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
  const [timerSetting, setTimerSetting] = useState(10);
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
  const [svLoadingLong, setSvLoadingLong] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [closestCityIdx, setClosestCityIdx] = useState<number | null>(null);
  const [distances, setDistances] = useState<number[]>([]);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [qrBlockedMsg, setQrBlockedMsg] = useState('');

  const timerPulse = useRef(new Animated.Value(1)).current;
  const resultScale = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const tutScrollRef = useRef<ScrollView>(null);
  const cameraRef = useRef<CameraView>(null);
  const [tutOpacity] = useState(new Animated.Value(1));

  // Intro video player
  const introPlayer = useVideoPlayer(require('./assets/intro.mp4'), (player) => {
    player.loop = false;
    player.play();
  });

  // Scanner (Marker-Erkennung via Kamera) – Continuous Scanning
  const { scanCard, isScanning: arucoScanning, lastResult: arucoResult, setIsActive: setArucoActive } = useArucoScanner(
    cameraRef,
    {
      onDetected: (ids) => {
        if (ids.length > 0) {
          const id = ids[0];
          console.log('[ArUco] Erkannte ID:', id);
          // ID → Location aus der Datenbank (live oder Fallback)
          const loc = findLocationById(id);
          if (loc) {
            console.log('[ArUco] match found:', id, loc.name);
            if (usedLocations.includes(id) || tableCities.some(tc => tc.city.toLowerCase() === loc.name.toLowerCase())) {
              console.log('[ArUco] match already on table – skipping');
              setScanError('Diese Stadt liegt bereits auf dem Tisch!');
              setTimeout(() => setScanError(''), 2500);
              return;
            }
            playClickSound();
            Vibration.vibrate(100);
            
            // Vollständiger UI-Übergang nach Marker-Treffer
            console.log('[ArUco] Game-Flow: Setze Location', loc.name, '– phase=view');
            setArucoActive(false); // Scanner stoppen
            setLocation(loc);       // Panorama setzen
            setUsedLocations(prev => [...prev, loc.id]);
            setTimer(timerSetting); // Timer starten
            setTimerPaused(false);
            setPhase('view');       // In View-Phase wechseln
            setShowQrScanner(false); // Scanner-UI schließen
            setSvLoaded(false);
            setSvError(false);
            console.log('[ArUco] Game-Flow: UI-Übergang abgeschlossen – phase=view, scanner=aus');
          } else {
            console.log('[ArUco] no match for id:', id);
            setScanError('Dieser Ort wurde nicht gefunden. Bitte scanne eine gültige Karte.');
            setTimeout(() => setScanError(''), 2500);
          }
        }
      },
      onError: (err) => {
        console.log('[ArUco] Fehler:', err);
        setScanError(err);
        setTimeout(() => setScanError(''), 2500);
      },
    }
  );

  const allPlayersScanned = players.length >= 2 && players.every(p => p.city.length > 0);

  // LOADING SCREEN + DB-FETCH
  useEffect(() => {
    Animated.timing(loadingFade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    try { require('expo-navigation-bar').then((nb: any) => nb.setBackgroundColorAsync('#262523').catch(() => {})); } catch (_) {}
    // Datenbank laden (ArUco-ID → Location Mapping)
    fetchLocationsFromDB().then(locs => {
      console.log(`[App] ${locs.length} Locations geladen (live von DB)`);
    });
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

  // ArUco-Scanner im Game-Flow aktivieren/deaktivieren
  useEffect(() => {
    if (showQrScanner && phase === 'scan-qr') {
      console.log('[ArUco] Game-Flow: Aktiviere Scanner (showQrScanner=true, phase=scan-qr)');
      setArucoActive(true);
    } else if (!showQrScanner && !showCityScanner) {
      // Nur deaktivieren, wenn auch kein City-Scanner läuft
      console.log('[ArUco] Game-Flow: Deaktiviere Scanner (kein Scanner-UI aktiv)');
      setArucoActive(false);
    }
  }, [showQrScanner, showCityScanner, phase]);

  // SV loading timeout — show LOAD NEW CARD after 5s
  useEffect(() => {
    if (phase !== 'view' || svLoaded || svError) { setSvLoadingLong(false); return; }
    const t = setTimeout(() => setSvLoadingLong(true), 5000);
    return () => clearTimeout(t);
  }, [phase, svLoaded, svError, location]);

  // GAME LOGIC
  const addPlayer = () => {
    const count = players.length + 1;
    setPlayers(prev => [...prev, { id: Date.now(), name: `Spieler ${count}`, city: '', cityId: -1, lat: 0, lng: 0, score: 0 }]);
    playClickSound();
  };

  const openCityScan = (idx: number) => {
    setScanCityForIdx(idx); setShowCityScanner(true); setScanned(false); setScanError(''); setManualCode('');
    setArucoActive(true); // ArUco-Scanning starten – Continuous-Loop übernimmt das Scannen
    console.log('[App] openCityScan: ArUco Continuous-Loop aktiviert für City-Assign');
  };

  const submitManualCode = useCallback(() => {
    if (!manualCode.trim() || scanCityForIdx === null) return;
    const code = manualCode.trim();
    const assign = (loc: PanoramaLocation, id: number) => {
      const takenBy = players.find(p => p.city.toLowerCase() === loc.name.toLowerCase() && players.indexOf(p) !== scanCityForIdx);
      if (takenBy) { setScanError(`Diese Karte ist bereits vergeben von ${takenBy.name}`); setTimeout(() => setScanError(''), 2500); return; }
      playClickSound(); Vibration.vibrate(100);
      setUsedLocations(prev => [...prev, id]);
      setPlayers(prev => prev.map((p, i) => i === scanCityForIdx ? { ...p, city: loc.name, cityId: id, lat: loc.lat, lng: loc.lng } : p));
      setShowCityScanner(false); setScanned(false); setScanCityForIdx(null); setManualCode('');
    };
    const numMatch = code.match(/#?(\d+)/);
    if (numMatch) {
      const id = parseInt(numMatch[1], 10);
      const loc = findLocationById(id);
      if (loc) { assign(loc, id); return; }
    }
    const normalized = code.toLowerCase().trim().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    const allLocs = getLocations();
    const textMatch = allLocs.find(l => l.name.toLowerCase() === normalized);
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
    setPhase('scan-qr'); setSvLoaded(false); setSvError(false); setSvLoadingLong(false);
    setClosestCityIdx(null); setDistances([]); setWinnerId(null);
    setChallengerId(null); setActivePickIdx(null);
    setTimer(timerSetting); setTimerPaused(false); resultScale.setValue(0);
  }, [timerSetting]);

  const loadNewCard = useCallback(() => {
    const newLoc = getRandomLocation(usedLocations);
    setLocation(newLoc);
    setUsedLocations(prev => [...prev, newLoc.id]);
    setSvLoaded(false); setSvError(false); setSvLoadingLong(false);
    setTimer(timerSetting); setTimerPaused(false);
  }, [getRandomLocation, timerSetting, usedLocations]);

  const onQrScanned = useCallback((loc: PanoramaLocation) => {
    const playerCity = players.find(p => p.city.toLowerCase() === loc.name.toLowerCase());
    if (playerCity) {
      setQrBlockedMsg('Diese Stadt ist bereits auf dem Tisch!');
      Vibration.vibrate(300);
      setTimeout(() => setQrBlockedMsg(''), 2000);
      return;
    }
    console.log('[App] onQrScanned: UI-Übergang für', loc.name);
    setArucoActive(false); // ArUco-Scanner stoppen
    setLocation(loc);
    setUsedLocations(prev => [...prev, loc.id]);
    setTimer(timerSetting);
    setTimerPaused(false);
    setPhase('view');
    setShowQrScanner(false);
    setScanned(false);
    setSvLoaded(false);
    setSvError(false);
    Vibration.vibrate(100);
    console.log('[App] onQrScanned: phase=view, scanner=aus');
  }, [timerSetting, players]);

  const pickCity = useCallback((idx: number) => {
    playClickSound(); setTimerPaused(true);
    const dists = tableCities.map(tc => calculateDistance(location.lat, location.lng, tc.lat, tc.lng));
    setDistances(dists);
    let minIdx = 0; for (let i = 1; i < dists.length; i++) if (dists[i] < dists[minIdx]) minIdx = i;
    setClosestCityIdx(minIdx);
    setActivePickIdx(idx);
    setPhase('challenge');
    setChallengerId(null);
  }, [tableCities, location]);

  const resolveRound = useCallback(() => {
    const minIdx = closestCityIdx;
    const pickedIdx = activePickIdx;
    if (minIdx === null || pickedIdx === null) return;
    const originalCorrect = pickedIdx === minIdx;
    if (challengerId !== null) {
      if (originalCorrect) {
        playPerfectSound(); Vibration.vibrate([100, 50, 100]);
        setPlayers(prev => prev.map(p => p.id === players[activePlayerIdx].id ? { ...p, score: p.score + 1 } : p));
        setWinnerId(players[activePlayerIdx].id);
      } else {
        playPerfectSound(); Vibration.vibrate([100, 50, 100]);
        setPlayers(prev => prev.map(p => p.id === challengerId ? { ...p, score: p.score + 1 } : p));
        setWinnerId(challengerId);
      }
    } else {
      if (originalCorrect) {
        playPerfectSound(); Vibration.vibrate([100, 50, 100]);
        setPlayers(prev => prev.map(p => p.id === players[activePlayerIdx].id ? { ...p, score: p.score + 1 } : p));
        setWinnerId(players[activePlayerIdx].id);
      } else {
        playErrorSound(); Vibration.vibrate(500);
        setWinnerId(null);
      }
    }
    setTableCities(prev => [...prev, { city: location.name, lat: location.lat, lng: location.lng, ownerPlayerId: null, isPlayerCity: false }]);
    Animated.spring(resultScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    setPhase('result');
  }, [closestCityIdx, activePickIdx, challengerId, tableCities, location, activePlayerIdx]);

  const nextTurn = () => {
    playClickSound();
    if (round >= maxRounds) { setScreen('result'); return; }
    setActivePlayerIdx(prev => (prev + 1) % players.length);
    setRound(r => r + 1); startRound();
  };

  // OCR capture – über result.blocks iterieren, nur ersten Treffer nehmen
  const captureAndRecognize = useCallback(async () => {
    if (!cameraRef.current || scanCityForIdx === null) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;
      console.log('[OCR] Foto aufgenommen:', photo.uri);
      const result = await TextRecognition.recognize(photo.uri);
      console.log('[OCR] Ergebnis:', JSON.stringify(result));
      if (!result || !result.blocks || result.blocks.length === 0) {
        console.log('[OCR] Kein Text erkannt');
        setScanError('Kein Text erkannt – manuell eingeben');
        setTimeout(() => setScanError(''), 2000);
        return;
      }
      console.log(`[OCR] ${result.blocks.length} Textblöcke gefunden`);
      // Über alle Textblöcke iterieren, ersten passenden Treffer nehmen
      for (const block of result.blocks) {
        console.log(`[OCR] Block: "${block.text}"`);
        const text = block.text.trim();
        if (!text) continue;
        // 1. Prüfen ob es eine Zahl ist (#042 oder 042)
        const numMatch = text.match(/#?(\d+)/);
        if (numMatch) {
          const id = parseInt(numMatch[1], 10);
          const loc = findLocationById(id);
          if (loc) {
            const takenBy = players.find(p => p.city.toLowerCase() === loc.name.toLowerCase() && players.indexOf(p) !== scanCityForIdx);
            if (takenBy) { setScanError(`Diese Karte ist bereits vergeben von ${takenBy.name}`); setTimeout(() => setScanError(''), 2500); return; }
            playClickSound(); Vibration.vibrate(100);
            setUsedLocations(prev => [...prev, loc.id]);
            setPlayers(prev => prev.map((p, i) => i === scanCityForIdx ? { ...p, city: loc.name, cityId: loc.id, lat: loc.lat, lng: loc.lng } : p));
            setShowCityScanner(false); setScanned(false); setScanCityForIdx(null);
            return;
          }
        }
        // 2. Prüfen ob es ein Ortsname ist
        const normalized = text.toLowerCase().trim().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
        const allLocs = getLocations();
        const match = allLocs.find(l => l.name.toLowerCase() === normalized);
        if (match) {
          const takenBy = players.find(p => p.city.toLowerCase() === match.name.toLowerCase() && players.indexOf(p) !== scanCityForIdx);
          if (takenBy) { setScanError(`Diese Karte ist bereits vergeben von ${takenBy.name}`); setTimeout(() => setScanError(''), 2500); return; }
          playClickSound(); Vibration.vibrate(100);
          setUsedLocations(prev => [...prev, match.id]);
          setPlayers(prev => prev.map((p, i) => i === scanCityForIdx ? { ...p, city: match.name, cityId: match.id, lat: match.lat, lng: match.lng } : p));
          setShowCityScanner(false); setScanned(false); setScanCityForIdx(null);
          return;
        }
      }
      // Nichts gefunden
      setScanError('Nicht erkannt – manuell eingeben');
      setTimeout(() => setScanError(''), 2000);
    } catch (e) {
      setScanError('OCR-Fehler – manuell eingeben');
      setTimeout(() => setScanError(''), 2000);
    }
  }, [scanCityForIdx, players]);

  // SCAN HANDLER
  const handleScan = useCallback(({ data }: { data: string }) => {
    if (scanned || !data) return;
    if (showQrScanner) {
      const numMatch = data.match(/#?(\d+)/);
      if (numMatch) {
        const id = parseInt(numMatch[1], 10);
        const loc = findLocationById(id);
        if (loc) {
          if (usedLocations.includes(id) || tableCities.some(tc => tc.city.toLowerCase() === loc.name.toLowerCase())) {
            setScanError('Diese Stadt liegt bereits auf dem Tisch!'); setScanned(true); setTimeout(() => { setScanError(''); setScanned(false); }, 2500); return;
          }
          playClickSound(); setScanned(true); Vibration.vibrate(100); onQrScanned(loc); return;
        }
      }
      if (data.startsWith('city:')) {
        const id = parseInt(data.split(':')[1]);
        const loc = findLocationById(id);
        if (loc) {
          if (usedLocations.includes(id) || tableCities.some(tc => tc.city.toLowerCase() === loc.name.toLowerCase())) {
            setScanError('Diese Stadt liegt bereits auf dem Tisch!'); setScanned(true); setTimeout(() => { setScanError(''); setScanned(false); }, 2500); return;
          }
          playClickSound(); setScanned(true); Vibration.vibrate(100); onQrScanned(loc); return;
        }
      }
      return;
    }
    if (!showCityScanner || scanCityForIdx === null) return;
    const assign = (loc: PanoramaLocation, id: number) => {
      const takenBy = players.find(p => p.city.toLowerCase() === loc.name.toLowerCase() && players.indexOf(p) !== scanCityForIdx);
      if (takenBy) { setScanError(`Diese Karte ist bereits vergeben von ${takenBy.name}`); setScanned(true); setTimeout(() => { setScanError(''); setScanned(false); }, 2500); return; }
      playClickSound(); setScanned(true); Vibration.vibrate(100);
      setUsedLocations(prev => [...prev, id]);
      setPlayers(prev => prev.map((p, i) => i === scanCityForIdx ? { ...p, city: loc.name, cityId: id, lat: loc.lat, lng: loc.lng } : p));
      setShowCityScanner(false); setScanned(false); setScanCityForIdx(null);
    };
    const numMatch = data.match(/#?(\d+)/);
    if (numMatch) {
      const id = parseInt(numMatch[1], 10);
      const loc = findLocationById(id);
      if (loc) { assign(loc, id); return; }
    }
    const normalized = data.toLowerCase().trim().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    const allLocs = getLocations();
    const textMatch = allLocs.find(l => l.name.toLowerCase() === normalized);
    if (textMatch) { assign(textMatch, textMatch.id); return; }
    if (data.startsWith('city:')) {
      const id = parseInt(data.split(':')[1]);
      const loc = findLocationById(id);
      if (loc) { assign(loc, id); return; }
    }
    setScanError('Karte nicht erkannt – nochmal versuchen');
    setTimeout(() => setScanError(''), 2000);
  }, [scanned, showCityScanner, scanCityForIdx, showQrScanner, onQrScanned, usedLocations, tableCities]);

  // TUTORIAL
  const TUT_PAGES = [
    { bg: '#262523', titleColor: '#D9593C', bodyColor: '#F1E8E1', title: 'Eine Aufgabe. Nur eine.', body: 'Du stehst plötzlich irgendwo in Berlin. Wo bist du nur? Auf dem Tisch liegen Berliner Orte. Deine Aufgabe: Welcher Ort liegt am nächsten zu dem, was du siehst?' },
    { bg: '#F2A344', titleColor: '#262523', bodyColor: '#262523', title: 'Ziehen. Scannen. Die Zeit läuft.', body: 'Zieh eine Karte vom Stapel. Scanne den Code mit der App. Ein Berliner Ort erscheint – und der Timer startet, ob du bereit bist oder nicht.' },
    { bg: '#262523', titleColor: '#F2A344', bodyColor: '#F1E8E1', title: 'Wo zur Hölle bist du?', body: 'Schau dich um. Erkennst du den Ort?\n\nWähle den Ort vom Tisch, der am nächsten dran liegt. Je näher du liegst, desto mehr Punkte.' },
    { bg: '#D9593C', titleColor: '#262523', bodyColor: '#262523', title: 'Auf die harte Tour?', body: 'Denkst du, jemand lag falsch? Setz einen Token und nenn DEINEN Ort.\n\nRichtig → Bonuspunkte.\nFalsch → Tschüss, Token.\n\n→ Los geht\'s!' },
  ];

  // ═══════════════ SCREEN RENDER ═══════════════

  // SCANNER
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
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'] }}>
          <View style={s.scanOverlay}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: C.primary, fontSize: 13, fontFamily: FF.bold, letterSpacing: 2, marginBottom: 6 }}>
                {showCityScanner ? 'KARTE ZUWEISEN' : 'CODE SCANNEN'}
              </Text>
              <Text style={{ color: '#fff', fontSize: 22, fontFamily: FF.bold }}>{assignName || 'Spieler'}</Text>
            </View>
            <View style={s.scanFrame}>
              <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                {showCityScanner ? 'Stadtkarte in den Rahmen halten' : 'Code in den Rahmen halten'}
              </Text>
            </View>
            {showCityScanner && (
              <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 16 }}>
                <Text style={{ color: 'rgba(241,232,225,0.6)', fontSize: 11, fontFamily: FF.bold, letterSpacing: 2, textAlign: 'center', marginBottom: 10, textTransform: 'uppercase' }}>Oder Code manuell eingeben</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(25,26,45,0.9)', borderWidth: 1, borderColor: 'rgba(68,73,52,0.4)', borderRadius: 0 }}>
                    <TextInput style={{ color: '#fff', fontSize: 16, fontFamily: FF.bold, paddingVertical: 12, paddingHorizontal: 16 }}
                      value={manualCode} onChangeText={setManualCode} placeholder="#042 oder Berlin" placeholderTextColor="rgba(241,232,225,0.3)"
                      autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={submitManualCode} />
                  </View>
                  <TouchableOpacity style={{ backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center' }} onPress={submitManualCode}>
                    <Text style={{ color: C.onPrimaryContainer, fontSize: 14, fontFamily: FF.bold }}>GO</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {scanError ? (<View style={{ backgroundColor: 'rgba(255,100,100,0.9)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, marginTop: 16 }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{scanError}</Text></View>) : null}
            {qrBlockedMsg ? (<View style={{ backgroundColor: 'rgba(255,100,100,0.9)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, marginTop: 16 }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{qrBlockedMsg}</Text></View>) : null}
            <TouchableOpacity style={s.scanCloseBtn} onPress={() => { setShowCityScanner(false); setShowQrScanner(false); setScanned(false); setManualCode(''); setArucoActive(false); }}>
              <Text style={s.scanCloseText}>SCHLIESSEN</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // INTRO
  if (screen === 'intro') {
    return (
      <View style={{ flex: 1, backgroundColor: '#262523' }}><StatusBar hidden />
        <TouchableOpacity activeOpacity={1} style={{ ...StyleSheet.absoluteFill, zIndex: 10 }} onPress={() => setScreen('tutorial')}>
          <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 20 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: FF.regular }}>Überspringen</Text>
          </View>
        </TouchableOpacity>
        <VideoView player={introPlayer} style={{ ...StyleSheet.absoluteFill }}
          contentFit="cover" nativeControls={false} />
      </View>
    );
  }

  // TUTORIAL
  if (screen === 'tutorial') {
    const currentBg = TUT_PAGES[tutorialPage]?.bg || '#262523';
    return (
      <View style={{ flex: 1, backgroundColor: currentBg }}><StatusBar hidden />
        <ScrollView
          ref={tutScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled
          onMomentumScrollEnd={(e) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / width);
            if (page >= TUT_PAGES.length) {
              setTutorialPage(0);
              setScreen('setup');
            } else {
              setTutorialPage(page);
            }
          }}
          style={{ flex: 1 }}>
          {TUT_PAGES.map((page, i) => (
            <TouchableOpacity key={i} activeOpacity={1} style={{ width, flex: 1, backgroundColor: page.bg, justifyContent: 'center', paddingHorizontal: 30 }}
              onPress={(e) => {
                const touchX = e.nativeEvent.locationX;
                if (touchX > width / 2) {
                  // Rechte Hälfte → nächster Slide
                  if (i < TUT_PAGES.length - 1) {
                    tutScrollRef.current?.scrollTo({ x: (i + 1) * width, animated: true });
                    setTutorialPage(i + 1);
                  } else {
                    setTutorialPage(0);
                    setScreen('setup');
                  }
                } else {
                  // Linke Hälfte → vorheriger Slide
                  if (i > 0) {
                    tutScrollRef.current?.scrollTo({ x: (i - 1) * width, animated: true });
                    setTutorialPage(i - 1);
                  }
                }
              }}>
              <Text style={{ color: page.titleColor, fontSize: 51, fontFamily: FF.bold, marginBottom: 20, lineHeight: 60 }}>{page.title}</Text>
              <Text style={{ color: page.bodyColor, fontSize: 25, fontFamily: FF.regular, lineHeight: 34 }}>{page.body}</Text>
            </TouchableOpacity>
          ))}
          {/* Unsichtbarer Slide für Swipe-Over → Setup */}
          <View style={{ width, flex: 1 }} />
        </ScrollView>
        {/* Dots mittig – gleiche bg wie Slide */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 60, backgroundColor: currentBg }}>
          {TUT_PAGES.map((_, i) => (
            <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === tutorialPage ? C.primary : C.muted }} />
          ))}
        </View>
      </View>
    );
  }

  // ═══════════════ SETUP ═══════════════
  if (screen === 'setup') {
    return (
      <View style={s.container}><StatusBar hidden />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Logo */}
            <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 30 }}>
              <Image source={require('./assets/GeoChecker_Aruco_Square_01.png')} style={{ width: 200, height: 80, resizeMode: 'contain' }} />
            </View>

            {/* Players */}
            <View style={{ paddingHorizontal: 20 }}>
              <View style={s.sectionLabel}><Text style={s.sectionLabelText}>SPIELER</Text></View>
              {players.map((p, i) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.outline, height: 48, justifyContent: 'center' }}>
                    <TextInput
                      style={{ color: C.onSurface, fontSize: 16, fontFamily: FF.bold, paddingVertical: 0, paddingHorizontal: 16 }}
                      value={p.name} onChangeText={(t) => setPlayers(prev => prev.map((pl, j) => j === i ? { ...pl, name: t } : pl))}
                      placeholder={`Spieler ${i + 1}`} placeholderTextColor={C.muted}
                    />
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: p.city ? C.primary : C.surfaceHigh, height: 48, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: p.city ? C.primary : C.outline }}
                    onPress={() => openCityScan(i)}
                  >
                    <Text style={{ color: p.city ? C.onPrimaryContainer : C.muted, fontSize: 13, fontFamily: FF.bold }}>
                      {p.city ? p.city : 'KARTE'}
                    </Text>
                  </TouchableOpacity>
                  {players.length > 2 && (
                    <TouchableOpacity onPress={() => setPlayers(prev => prev.filter((_, j) => j !== i))}>
                      <Text style={{ color: C.error, fontSize: 20 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity onPress={addPlayer} style={{ marginBottom: 20 }}>
                <Text style={{ color: C.primary, fontSize: 14, fontFamily: FF.bold }}>+ SPIELER HINZUFÜGEN</Text>
              </TouchableOpacity>
            </View>

            {/* Timer Slider */}
            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <View style={s.sectionLabel}><Text style={s.sectionLabelText}>TIMER (SEKUNDEN)</Text></View>
              <SliderTrack value={timerSetting} onChange={setTimerSetting} />
            </View>

            {/* Rounds */}
            <View style={{ paddingHorizontal: 20, marginBottom: 30 }}>
              <View style={s.sectionLabel}><Text style={s.sectionLabelText}>RUNDEN PRO SPIELER</Text></View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[5, 10, 15].map(r => (
                  <TouchableOpacity key={r}
                    style={{ flex: 1, backgroundColor: roundsSetting === r ? C.primary : C.surface, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: roundsSetting === r ? C.primary : C.outline }}
                    onPress={() => setRoundsSetting(r)}>
                    <Text style={{ color: roundsSetting === r ? C.onPrimaryContainer : C.onSurface, fontSize: 16, fontFamily: FF.bold }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Start */}
            <View style={{ paddingHorizontal: 20 }}>
              <TouchableOpacity
                style={[s.primaryBtn, { opacity: allPlayersScanned ? 1 : 0.4 }]}
                onPress={startGame}
                disabled={!allPlayersScanned}
              >
                <Text style={s.primaryBtnText}>SPIEL STARTEN</Text>
              </TouchableOpacity>
              {!allPlayersScanned && (
                <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                  Jeder Spieler braucht eine zugewiesene Karte
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ═══════════════ GAME ═══════════════
  if (screen === 'game') {
    const activePlayer = players[activePlayerIdx];
    const isLastRound = round >= maxRounds;

    // SCAN QR PHASE
    if (phase === 'scan-qr') {
      return (
        <View style={s.container}><StatusBar hidden />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
            <Text style={{ color: C.muted, fontSize: 13, fontFamily: FF.bold, letterSpacing: 2, marginBottom: 8 }}>RUNDE {round}/{maxRounds}</Text>
            <Text style={{ color: C.onSurface, fontSize: 24, fontFamily: FF.bold, marginBottom: 4 }}>{activePlayer.name}</Text>
            <Text style={{ color: C.muted, fontSize: 14, fontFamily: FF.regular, marginBottom: 30 }}>Punkte: {activePlayer.score}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => { setShowQrScanner(true); setScanned(false); }}>
              <Text style={s.primaryBtnText}>KARTE ZIEHEN & SCANNEN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.tertiaryBtn} onPress={loadNewCard}>
              <Text style={s.tertiaryBtnText}>NEUE KARTE LADEN</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // VIEW PHASE — Panorama
    if (phase === 'view') {
      return (
        <View style={s.container}><StatusBar hidden />
          {/* Timer */}
          <View style={{ position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10, alignItems: 'center' }}>
            <Animated.View style={{ backgroundColor: timer <= 10 ? C.error : 'rgba(0,0,0,0.6)', paddingVertical: 6, paddingHorizontal: 20, transform: [{ scale: timerPulse }] }}>
              <Text style={{ color: '#fff', fontSize: 28, fontFamily: FF.bold }}>{timer}</Text>
            </Animated.View>
          </View>

          {/* Panorama */}
          <PanoramaViewer
            url={location.url_avif}
            onLoad={() => setSvLoaded(true)}
            onError={() => setSvError(true)}
          />

          {/* Loading overlay */}
          {!svLoaded && !svError && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
              <Text style={{ color: C.primary, fontSize: 16, fontFamily: FF.bold }}>Panorama wird geladen...</Text>
              {svLoadingLong && (
                <TouchableOpacity style={{ marginTop: 20, backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 24 }} onPress={loadNewCard}>
                  <Text style={{ color: C.onPrimaryContainer, fontSize: 14, fontFamily: FF.bold }}>NEUE KARTE LADEN</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Error overlay */}
          {svError && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
              <Text style={{ color: C.error, fontSize: 16, fontFamily: FF.bold, marginBottom: 20 }}>Fehler beim Laden</Text>
              <TouchableOpacity style={s.primaryBtn} onPress={loadNewCard}>
                <Text style={s.primaryBtnText}>NEUE KARTE LADEN</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pick button */}
          {svLoaded && (
            <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20 }}>
              <TouchableOpacity style={s.primaryBtn} onPress={() => setPhase('pick')}>
                <Text style={s.primaryBtnText}>ORT WÄHLEN</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    // PICK PHASE
    if (phase === 'pick') {
      return (
        <View style={s.container}><StatusBar hidden />
          <View style={{ paddingHorizontal: 20, paddingTop: 60, flex: 1 }}>
            <Text style={{ color: C.muted, fontSize: 13, fontFamily: FF.bold, letterSpacing: 2, marginBottom: 8 }}>ORT WÄHLEN</Text>
            <Text style={{ color: C.onSurface, fontSize: 18, fontFamily: FF.bold, marginBottom: 20 }}>{activePlayer.name}, welcher Ort liegt am nächsten?</Text>
            <ScrollView>
              {tableCities.map((tc, i) => (
                <TouchableOpacity key={i}
                  style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.outline, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 8 }}
                  onPress={() => pickCity(i)}>
                  <Text style={{ color: C.onSurface, fontSize: 16, fontFamily: FF.bold }}>{tc.city}</Text>
                  {tc.ownerPlayerId !== null && (
                    <Text style={{ color: C.muted, fontSize: 12, fontFamily: FF.regular }}>Startort von {players.find(p => p.id === tc.ownerPlayerId)?.name}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      );
    }

    // CHALLENGE PHASE
    if (phase === 'challenge') {
      const pickedCity = activePickIdx !== null ? tableCities[activePickIdx]?.city : '';
      const closestCity = closestCityIdx !== null ? tableCities[closestCityIdx]?.city : '';
      const pickedDist = activePickIdx !== null && distances[activePickIdx] !== undefined ? formatDistance(distances[activePickIdx]) : '';
      const closestDist = closestCityIdx !== null && distances[closestCityIdx] !== undefined ? formatDistance(distances[closestCityIdx]) : '';
      const isCorrect = activePickIdx === closestCityIdx;

      return (
        <View style={s.container}><StatusBar hidden />
          <View style={{ paddingHorizontal: 20, paddingTop: 60, flex: 1 }}>
            <Text style={{ color: C.muted, fontSize: 13, fontFamily: FF.bold, letterSpacing: 2, marginBottom: 8 }}>HERAUSFORDERUNG</Text>
            <Text style={{ color: C.onSurface, fontSize: 18, fontFamily: FF.bold, marginBottom: 20 }}>
              {activePlayer.name} wählte: {pickedCity} ({pickedDist})
            </Text>
            <Text style={{ color: C.muted, fontSize: 14, fontFamily: FF.regular, marginBottom: 20 }}>
              Nächster Ort: {closestCity} ({closestDist})
            </Text>
            {!isCorrect && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: C.primary, fontSize: 14, fontFamily: FF.bold, marginBottom: 10 }}>Jemand anderes? (Token einsetzen)</Text>
                <ScrollView horizontal style={{ marginBottom: 10 }}>
                  {players.filter(p => p.id !== activePlayer.id).map(p => (
                    <TouchableOpacity key={p.id}
                      style={{ backgroundColor: challengerId === p.id ? C.primary : C.surface, borderWidth: 1, borderColor: C.outline, paddingVertical: 12, paddingHorizontal: 20, marginRight: 8 }}
                      onPress={() => setChallengerId(challengerId === p.id ? null : p.id)}>
                      <Text style={{ color: challengerId === p.id ? C.onPrimaryContainer : C.onSurface, fontSize: 14, fontFamily: FF.bold }}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <TouchableOpacity style={s.primaryBtn} onPress={resolveRound}>
              <Text style={s.primaryBtnText}>AUFLÖSEN</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // RESULT PHASE
    if (phase === 'result') {
      const isCorrect = activePickIdx === closestCityIdx;
      const isTie = players.filter(p => p.score === Math.max(...players.map(pl => pl.score))).length > 1;
      return (
        <View style={s.container}><StatusBar hidden />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
            <Animated.View style={{ transform: [{ scale: resultScale }], alignItems: 'center' }}>
              {winnerId !== null ? (
                <>
                  <Text style={{ color: C.primary, fontSize: 48, fontFamily: FF.bold, marginBottom: 10 }}>✓</Text>
                  <Text style={{ color: C.onSurface, fontSize: 22, fontFamily: FF.bold, marginBottom: 4 }}>
                    {players.find(p => p.id === winnerId)?.name} punktet!
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: C.error, fontSize: 48, fontFamily: FF.bold, marginBottom: 10 }}>✗</Text>
                  <Text style={{ color: C.onSurface, fontSize: 22, fontFamily: FF.bold, marginBottom: 4 }}>Leider daneben!</Text>
                </>
              )}
              <Text style={{ color: C.muted, fontSize: 14, fontFamily: FF.regular, marginBottom: 30 }}>
                {location.name} ({location.district})
              </Text>
              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 30 }}>
                {players.map(p => (
                  <View key={p.id} style={{ alignItems: 'center' }}>
                    <Text style={{ color: p.id === winnerId ? C.primary : C.muted, fontSize: 14, fontFamily: FF.bold }}>{p.name}</Text>
                    <Text style={{ color: p.id === winnerId ? C.primary : C.muted, fontSize: 24, fontFamily: FF.bold }}>{p.score}</Text>
                  </View>
                ))}
              </View>
              {isLastRound && isTie ? (
                <TouchableOpacity style={s.primaryBtn} onPress={() => {
                  // Tie-Breaker: extra round for tied players
                  const tiePlayers = players.filter(p => p.score === Math.max(...players.map(pl => pl.score)));
                  setRound(r => r + 1);
                  setMaxRounds(maxRounds + tiePlayers.length);
                  setPhase('scan-qr');
                  setActivePlayerIdx(0);
                  startRound();
                }}>
                  <Text style={s.primaryBtnText}>TIE BREAKER — PLAY ON!</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.primaryBtn} onPress={nextTurn}>
                  <Text style={s.primaryBtnText}>{isLastRound ? 'ERGEBNIS ANZEIGEN' : 'NÄCHSTE RUNDE'}</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </View>
      );
    }

    return null;
  }

  // ═══════════════ RESULT SCREEN ═══════════════
  if (screen === 'result') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const isTie = players.filter(p => p.score === winner.score).length > 1;
    return (
      <View style={s.container}><StatusBar hidden />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
          <Text style={{ color: C.muted, fontSize: 13, fontFamily: FF.bold, letterSpacing: 2, marginBottom: 10 }}>SPIEL BEENDET</Text>
          {isTie ? (
            <Text style={{ color: C.primary, fontSize: 28, fontFamily: FF.bold, marginBottom: 20, textAlign: 'center' }}>UNENTSCHIEDEN!</Text>
          ) : (
            <>
              <Text style={{ color: C.primary, fontSize: 48, fontFamily: FF.bold, marginBottom: 4 }}>{winner.name}</Text>
              <Text style={{ color: C.onSurface, fontSize: 20, fontFamily: FF.regular, marginBottom: 20 }}>gewinnt mit {winner.score} Punkten!</Text>
            </>
          )}
          <View style={{ width: '100%', marginBottom: 30 }}>
            {sorted.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.surface, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 4 }}>
                <Text style={{ color: C.onSurface, fontSize: 16, fontFamily: FF.bold }}>{i + 1}. {p.name}</Text>
                <Text style={{ color: C.primary, fontSize: 16, fontFamily: FF.bold }}>{p.score}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={() => {
            setScreen('setup');
            setPlayers(prev => prev.map(p => ({ ...p, score: 0, city: '', cityId: -1, lat: 0, lng: 0 })));
            setTableCities([]);
            setUsedLocations([]);
            setRound(1);
          }}>
            <Text style={s.primaryBtnText}>NOCH EIN SPIEL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={() => {
            setScreen('intro');
            setPlayers(prev => prev.map(p => ({ ...p, score: 0, city: '', cityId: -1, lat: 0, lng: 0 })));
            setTableCities([]);
            setUsedLocations([]);
            setRound(1);
          }}>
            <Text style={{ color: C.muted, fontSize: 14, fontFamily: FF.regular }}>Zum Startbildschirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

// ═══════════════ STYLES ═══════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  primaryBtn: { backgroundColor: C.primary, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: C.onPrimaryContainer, fontSize: 16, fontFamily: FF.bold, letterSpacing: 2 },
  tertiaryBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  tertiaryBtnText: { color: C.muted, fontSize: 14, fontFamily: FF.regular },
  sectionLabel: { marginBottom: 10, paddingBottom: 6 },
  sectionLabelText: { color: C.muted, fontSize: 11, fontFamily: FF.bold, letterSpacing: 2 },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: C.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  scanCloseBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 24 },
  scanCloseText: { color: '#fff', fontSize: 14, fontFamily: FF.bold, letterSpacing: 2 },
});
