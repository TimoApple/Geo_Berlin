// GeoCheckr — Game Screen (Full Screen Street View + Answer)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, Vibration, Platform, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import StreetViewImage from '../components/StreetViewImage';
import MapAnswer from '../components/MapAnswer';
import { calculateDistance, calculatePoints, formatDistance } from '../utils/distance';
import { playClickSound, playSuccessSound, playErrorSound, playPerfectSound, playTimerWarning, playTimerTick, playAnswerphoneBeep } from '../utils/sounds';
import { panoramaLocations, PanoramaLocation } from '../data/panoramaLocations';
import { useArucoScanner } from '../hooks/useArucoScanner';

interface Player {
  id: number;
  name: string;
}

interface Props {
  route: any;
  navigation: any;
}

// Answer mode: text, map
type AnswerMode = 'text' | 'map';

export default function GameScreen({ route, navigation }: Props) {
  const { players, difficulty, rounds: maxRounds } = route.params as {
    players: Player[];
    difficulty: string;
    rounds: number;
  };

  // State
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [location, setLocation] = useState<PanoramaLocation>(panoramaLocations[0]);
  const [usedLocations, setUsedLocations] = useState<number[]>([]);
  const [scores, setScores] = useState<Record<number, number>>(
    Object.fromEntries(players.map(p => [p.id, 0]))
  );
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<'view' | 'answer' | 'result'>('view');
  const [timer, setTimer] = useState(30);
  const [timerPaused, setTimerPaused] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>('text');
  const [textInput, setTextInput] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [distance, setDistance] = useState(0);
  const [points, setPoints] = useState(0);
  const [showMapResult, setShowMapResult] = useState(false);

  // Animations
  const timerPulse = useRef(new Animated.Value(1)).current;
  const resultScale = useRef(new Animated.Value(0)).current;

  // Timer
  useEffect(() => {
    if (phase !== 'view' || timerPaused || timer <= 0) return;
    const interval = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [phase, timerPaused, timer]);

  // Timer warning
  useEffect(() => {
    if (timer <= 5 && timer > 0 && phase === 'view') {
      playTimerTick();
      Vibration.vibrate(200);
      Animated.sequence([
        Animated.timing(timerPulse, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(timerPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    if (timer === 0 && phase === 'view') {
      playTimerWarning();
      Vibration.vibrate(500);
      setPhase('answer');
      setTimeout(() => playAnswerphoneBeep(), 100);
    }
  }, [timer, phase]);

  // ArUco Scanner – automatisch in view-Phase aktiv
  const { isActive, setIsActive } = useArucoScanner(undefined, {
    onDetected: (ids) => {
      console.log('[ArUco] Marker erkannt in GameScreen:', ids);
      // Location anhand der Marker-ID setzen
      const loc = panoramaLocations.find(l => ids.includes(l.id));
      if (loc) {
        console.log('[ArUco] Panorama-Flow: Location gefunden:', loc.name);
        // 1. Location setzen (triggert Panorama-Load in StreetViewImage)
        setLocation(loc);
        // 2. Timer anhalten
        setTimerPaused(true);
        // 3. In answer-Phase wechseln (Scanner stoppt automatisch durch phase-Change)
        setPhase('answer');
        console.log('[ArUco] Panorama-Flow: setPhase(answer) nach Marker-Match');
        // 4. Sound
        playAnswerphoneBeep();
      }
    },
    onError: (error) => {
      console.warn('[ArUco] Scan-Fehler:', error);
    },
  });

  // Scanner aktivieren/deaktivieren basierend auf phase
  useEffect(() => {
    if (phase === 'view') {
      console.log('[ArUco] Aktiviere Scanner (phase=view)');
      setIsActive(true);
    } else {
      console.log('[ArUco] Deaktiviere Scanner (phase=' + phase + ')');
      setIsActive(false);
    }
  }, [phase, setIsActive]);

  // Random location
  const getRandomLocation = useCallback(() => {
    const available = panoramaLocations.filter(l => !usedLocations.includes(l.id));
    const pool = available.length > 0 ? available : panoramaLocations;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [usedLocations]);

  // New round
  const startRound = useCallback(() => {
    const loc = getRandomLocation();
    setUsedLocations(prev => [...prev, loc.id]);
    setLocation(loc);
    setTimer(30);
    setTimerPaused(false);
    setPhase('view');
    setTextInput('');
    setAnswerMode('text');
    setShowMap(false);
    setShowMapResult(false);
    resultScale.setValue(0);
  }, [getRandomLocation, resultScale]);

  // Skip to answer
  const skipToAnswer = () => {
    playClickSound();
    setTimerPaused(true);
    setPhase('answer');
    playAnswerphoneBeep();
  };

  // Submit answer from text
  const submitTextAnswer = () => {
    submitAnswer(textInput);
  };

  // Submit answer from map
  const submitMapAnswer = (lat: number, lng: number) => {
    setShowMap(false);
    const dist = calculateDistance(location.lat, location.lng, lat, lng);
    resolveAnswer(dist);
  };

  // Core answer resolution
  const submitAnswer = (cityName: string) => {
    let dist = 20000;
    if (cityName.trim()) {
      const allLocs = require('../data/locations_complete').default;
      const normalized = cityName.toLowerCase().trim()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
      let match = allLocs.find((l: any) => l.city.toLowerCase() === normalized);
      if (!match) match = allLocs.find((l: any) => l.city.toLowerCase().includes(normalized) || normalized.includes(l.city.toLowerCase()));
      if (match) dist = calculateDistance(location.lat, location.lng, match.lat, match.lng);
    }
    resolveAnswer(dist);
  };

  const resolveAnswer = (dist: number) => {
    const pts = calculatePoints(dist);
    const timeBonus = (difficulty === 'schwer' && timer > 10 && pts > 0) ? 1 : 0;
    const totalPts = pts + timeBonus;

    if (totalPts >= 3) { playPerfectSound(); Vibration.vibrate([100, 50, 100]); }
    else if (totalPts > 0) { playSuccessSound(); Vibration.vibrate([100, 50, 100]); }
    else { playErrorSound(); Vibration.vibrate(500); }

    setDistance(dist);
    setPoints(totalPts);
    setScores(prev => ({ ...prev, [players[currentPlayerIdx].id]: prev[players[currentPlayerIdx].id] + totalPts }));
    Animated.spring(resultScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    setPhase('result');
  };

  // Next turn
  const nextTurn = () => {
    playClickSound();
    const nextIdx = (currentPlayerIdx + 1) % players.length;
    if (nextIdx === 0 && round >= maxRounds) {
      navigation.replace('Result', { players, scores, rounds: maxRounds });
      return;
    }
    if (nextIdx === 0) setRound(r => r + 1);
    setCurrentPlayerIdx(nextIdx);
    startRound();
  };

  const currentPlayer = players[currentPlayerIdx];
  const timerColor = timer <= 5 ? '#ff4444' : timer <= 10 ? '#ffaa00' : '#e94560';

  return (
    <View style={styles.container}>
      {/* ===== FULL SCREEN STREET VIEW ===== */}
      <StreetViewImage location={location} showInfo={false} />

      {/* ===== OVERLAY: Timer ===== */}
      {phase === 'view' && (
        <Animated.View style={[styles.timerCircle, { borderColor: timerColor, transform: [{ scale: timerPulse }] }]}>
          <Text style={[styles.timerText, { color: timerColor }]}>{timer}</Text>
        </Animated.View>
      )}

      {/* ===== OVERLAY: Player + Round (tiny) ===== */}
      {phase === 'view' && (
        <View style={styles.topBar}>
          <Text style={styles.playerLabel}>{currentPlayer.name}</Text>
          <Text style={styles.roundLabel}>Runde {round}/{maxRounds}</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>⭐ {scores[currentPlayer.id]}</Text>
          </View>
        </View>
      )}

      {/* ===== OVERLAY: Skip Button ===== */}
      {phase === 'view' && (
        <TouchableOpacity style={styles.skipBtn} onPress={skipToAnswer}>
          <Text style={styles.skipText}>Ich weiß es! →</Text>
        </TouchableOpacity>
      )}

      {/* ===== OVERLAY: Answer ===== */}
      {phase === 'answer' && (
        <View style={styles.answerOverlay}>
          <View style={styles.answerContainer}>
            <Text style={styles.answerTitle}>📍 Deine Antwort</Text>
            <Text style={styles.answerSub}>{currentPlayer.name}, wo bist du?</Text>

            {/* Mode Tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, answerMode === 'text' && styles.modeTabActive]}
                onPress={() => setAnswerMode('text')}
              >
                <Text style={styles.modeTabIcon}>⌨️</Text>
                <Text style={[styles.modeTabText, answerMode === 'text' && styles.modeTabTextActive]}>Tippen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, answerMode === 'map' && styles.modeTabActive]}
                onPress={() => { setAnswerMode('map'); setShowMap(true); }}
              >
                <Text style={styles.modeTabIcon}>🗺️</Text>
                <Text style={[styles.modeTabText, answerMode === 'map' && styles.modeTabTextActive]}>Karte</Text>
              </TouchableOpacity>
            </View>

            {/* Text Input */}
            {answerMode === 'text' && (
              <View style={styles.textArea}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Stadtname eingeben..."
                  placeholderTextColor="#555"
                  value={textInput}
                  onChangeText={setTextInput}
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={submitTextAnswer}
                />
                <TouchableOpacity style={styles.submitBtn} onPress={submitTextAnswer}>
                  <Text style={styles.submitText}>✓</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Map mode hint */}
            {answerMode === 'map' && !showMap && (
              <TouchableOpacity style={styles.mapHint} onPress={() => setShowMap(true)}>
                <Text style={styles.mapHintText}>🗺️ Karte öffnen und tippen</Text>
              </TouchableOpacity>
            )}

            {/* Skip */}
            <TouchableOpacity style={styles.skipAnswerBtn} onPress={() => submitAnswer('')}>
              <Text style={styles.skipAnswerText}>Überspringen →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ===== OVERLAY: Result ===== */}
      {phase === 'result' && (
        <View style={styles.resultOverlay}>
          <Animated.View style={[styles.resultCard, { transform: [{ scale: resultScale }] }]}>
            <Text style={styles.resultEmoji}>
              {points >= 3 ? '🎯' : points >= 1 ? '👍' : '😅'}
            </Text>
            <Text style={[styles.resultTitle, points > 0 ? styles.correct : styles.wrong]}>
              {points >= 3 ? 'Perfekt!' : points >= 2 ? 'Gut!' : points >= 1 ? 'Nicht schlecht!' : 'Daneben!'}
            </Text>

            <View style={styles.resultInfo}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>📍 Ort</Text>
                <Text style={styles.resultValue}>{location.name}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>📏 Distanz</Text>
                <Text style={styles.resultValue}>{formatDistance(distance)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>⭐ Punkte</Text>
                <Text style={[styles.resultValue, styles.pointsHighlight]}>+{points}</Text>
              </View>
            </View>

            {/* Show map with location */}
            <TouchableOpacity style={styles.showMapBtn} onPress={() => setShowMapResult(!showMapResult)}>
              <Text style={styles.showMapText}>{showMapResult ? 'Karte schließen' : '🗺️ Auf Karte zeigen'}</Text>
            </TouchableOpacity>

            {showMapResult && (
              <View style={styles.miniMap}>
                <WebView
                  source={{ html: `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%}</style>
</head><body><div id="map"></div><script>
var m=L.map('map').setView([${location.lat},${location.lng}],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
L.marker([${location.lat},${location.lng}]).addTo(m).bindPopup('${location.name}').openPopup();
</script></body></html>` }}
                  style={{ flex: 1 }}
                  javaScriptEnabled={true}
                />
              </View>
            )}

            <TouchableOpacity style={styles.nextBtn} onPress={nextTurn}>
              <Text style={styles.nextText}>
                {currentPlayerIdx < players.length - 1
                  ? `${players[currentPlayerIdx + 1].name} ist dran →`
                  : round >= maxRounds
                    ? '🏆 Ergebnis'
                    : 'Nächste Runde →'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ===== Map Modal ===== */}
      <Modal visible={showMap} animationType="slide" presentationStyle="fullScreen">
        <MapAnswer
          onPick={submitMapAnswer}
          onClose={() => { setShowMap(false); setAnswerMode('text'); }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Timer
  timerCircle: {
    position: 'absolute', top: 15, right: 15,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
  },
  timerText: { fontSize: 22, fontWeight: 'bold' },

  // Top bar
  topBar: {
    position: 'absolute', top: 15, left: 15,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    zIndex: 10,
  },
  playerLabel: { color: '#e94560', fontSize: 15, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  roundLabel: { color: '#fff', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  scoreBadge: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  scoreText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },

  // Skip
  skipBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 25, borderWidth: 1.5, borderColor: '#4CAF50', zIndex: 20,
  },
  skipText: { color: '#4CAF50', fontSize: 17, fontWeight: '600' },

  // Answer overlay
  answerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 30,
    justifyContent: 'center', paddingHorizontal: 24,
  },
  answerContainer: { backgroundColor: '#16213e', borderRadius: 20, padding: 24 },
  answerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  answerSub: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 20 },

  // Mode tabs
  modeTabs: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: '#333', backgroundColor: '#0f3460' },
  modeTabActive: { borderColor: '#e94560' },
  modeTabIcon: { fontSize: 18 },
  modeTabText: { color: '#888', fontSize: 14, fontWeight: '600' },
  modeTabTextActive: { color: '#fff' },

  // Text input
  textArea: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  textInput: { flex: 1, backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#2a2a4a' },
  submitBtn: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },

  // Map hint
  mapHint: { backgroundColor: '#0f3460', paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a', marginBottom: 12 },
  mapHintText: { color: '#fff', fontSize: 16 },

  // Skip answer
  skipAnswerBtn: { paddingVertical: 10, alignItems: 'center' },
  skipAnswerText: { color: '#666', fontSize: 14 },

  // Result
  resultOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 40,
    justifyContent: 'center', paddingHorizontal: 20,
  },
  resultCard: { backgroundColor: '#16213e', borderRadius: 20, padding: 24, alignItems: 'center' },
  resultEmoji: { fontSize: 50, marginBottom: 10 },
  resultTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 18, textAlign: 'center' },
  correct: { color: '#4CAF50' },
  wrong: { color: '#ff4444' },
  resultInfo: { width: '100%', marginBottom: 18 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  resultLabel: { color: '#aaa', fontSize: 15 },
  resultValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pointsHighlight: { color: '#4CAF50', fontSize: 20, fontWeight: 'bold' },

  // Show map
  showMapBtn: { backgroundColor: '#0f3460', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginBottom: 12 },
  showMapText: { color: '#aaa', fontSize: 14 },
  miniMap: { width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },

  // Next
  nextBtn: { backgroundColor: '#e94560', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 14, width: '100%', alignItems: 'center' },
  nextText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
