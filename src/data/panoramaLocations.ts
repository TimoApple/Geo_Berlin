export interface PanoramaLocation {
  id: number;
  name: string;
  district: string;
  lat: number;
  lng: number;
  url_avif: string;
  qr_data: string;
}

// Fallback-Daten – werden von der Datenbank überschrieben sobald API verfügbar
const FALLBACK_LOCATIONS: PanoramaLocation[] = [
  { id: 1,  name: "Brandenburger Tor",          district: "Mitte",         lat: 52.5163, lng: 13.3777, url_avif: "https://timoboese.com/pano/berlin/01.avif", qr_data: '{"id":1,"name":"Brandenburger Tor","pano":"berlin_01"}' },
  { id: 2,  name: "Reichstagsgebäude",           district: "Mitte",         lat: 52.5186, lng: 13.3763, url_avif: "https://timoboese.com/pano/berlin/02.avif", qr_data: '{"id":2,"name":"Reichstagsgebäude","pano":"berlin_02"}' },
  { id: 3,  name: "Fernsehturm",                 district: "Mitte",         lat: 52.5208, lng: 13.4094, url_avif: "https://timoboese.com/pano/berlin/03.avif", qr_data: '{"id":3,"name":"Fernsehturm","pano":"berlin_03"}' },
  { id: 4,  name: "East Side Gallery",           district: "Friedrichshain", lat: 52.5051, lng: 13.4394, url_avif: "https://timoboese.com/pano/berlin/04.avif", qr_data: '{"id":4,"name":"East Side Gallery","pano":"berlin_04"}' },
  { id: 5,  name: "Checkpoint Charlie",          district: "Mitte",         lat: 52.5074, lng: 13.3903, url_avif: "https://timoboese.com/pano/berlin/05.avif", qr_data: '{"id":5,"name":"Checkpoint Charlie","pano":"berlin_05"}' },
  { id: 6,  name: "Alexanderplatz",              district: "Mitte",         lat: 52.5219, lng: 13.4132, url_avif: "https://timoboese.com/pano/berlin/06.avif", qr_data: '{"id":6,"name":"Alexanderplatz","pano":"berlin_06"}' },
  { id: 7,  name: "Potsdamer Platz",             district: "Mitte",         lat: 52.5095, lng: 13.3763, url_avif: "https://timoboese.com/pano/berlin/07.avif", qr_data: '{"id":7,"name":"Potsdamer Platz","pano":"berlin_07"}' },
  { id: 8,  name: "Kurfürstendamm",              district: "Charlottenburg", lat: 52.5020, lng: 13.3100, url_avif: "https://timoboese.com/pano/berlin/08.avif", qr_data: '{"id":8,"name":"Kurfürstendamm","pano":"berlin_08"}' },
  { id: 9,  name: "Gendarmenmarkt",              district: "Mitte",         lat: 52.5137, lng: 13.3927, url_avif: "https://timoboese.com/pano/berlin/09.avif", qr_data: '{"id":9,"name":"Gendarmenmarkt","pano":"berlin_09"}' },
  { id: 10, name: "Berliner Dom",                district: "Mitte",         lat: 52.5192, lng: 13.4011, url_avif: "https://timoboese.com/pano/berlin/10.avif", qr_data: '{"id":10,"name":"Berliner Dom","pano":"berlin_10"}' },
  { id: 11, name: "Museumsinsel",                district: "Mitte",         lat: 52.5163, lng: 13.3989, url_avif: "https://timoboese.com/pano/berlin/11.avif", qr_data: '{"id":11,"name":"Museumsinsel","pano":"berlin_11"}' },
  { id: 12, name: "Oberbaumbrücke",              district: "Friedrichshain", lat: 52.5018, lng: 13.4453, url_avif: "https://timoboese.com/pano/berlin/12.avif", qr_data: '{"id":12,"name":"Oberbaumbrücke","pano":"berlin_12"}' },
  { id: 13, name: "Hackescher Markt",            district: "Mitte",         lat: 52.5239, lng: 13.4022, url_avif: "https://timoboese.com/pano/berlin/13.avif", qr_data: '{"id":13,"name":"Hackescher Markt","pano":"berlin_13"}' },
  { id: 14, name: "Schloss Charlottenburg",      district: "Charlottenburg", lat: 52.5206, lng: 13.2956, url_avif: "https://timoboese.com/pano/berlin/14.avif", qr_data: '{"id":14,"name":"Schloss Charlottenburg","pano":"berlin_14"}' },
  { id: 15, name: "Tiergarten",                  district: "Mitte",         lat: 52.5145, lng: 13.3500, url_avif: "https://timoboese.com/pano/berlin/15.avif", qr_data: '{"id":15,"name":"Tiergarten","pano":"berlin_15"}' },
  { id: 16, name: "Siegessäule",                 district: "Mitte",         lat: 52.5145, lng: 13.3501, url_avif: "https://timoboese.com/pano/berlin/16.avif", qr_data: '{"id":16,"name":"Siegessäule","pano":"berlin_16"}' },
  { id: 17, name: "KaDeWe",                      district: "Schöneberg",    lat: 52.5016, lng: 13.3410, url_avif: "https://timoboese.com/pano/berlin/17.avif", qr_data: '{"id":17,"name":"KaDeWe","pano":"berlin_17"}' },
  { id: 18, name: "Rotes Rathaus",               district: "Mitte",         lat: 52.5186, lng: 13.4083, url_avif: "https://timoboese.com/pano/berlin/18.avif", qr_data: '{"id":18,"name":"Rotes Rathaus","pano":"berlin_18"}' },
  { id: 19, name: "Nikolaiviertel",              district: "Mitte",         lat: 52.5167, lng: 13.4075, url_avif: "https://timoboese.com/pano/berlin/19.avif", qr_data: '{"id":19,"name":"Nikolaiviertel","pano":"berlin_19"}' },
  { id: 20, name: "Bellevue Palace",             district: "Mitte",         lat: 52.5175, lng: 13.3500, url_avif: "https://timoboese.com/pano/berlin/20.avif", qr_data: '{"id":20,"name":"Bellevue Palace","pano":"berlin_20"}' },
  { id: 21, name: "Hauptbahnhof",                district: "Mitte",         lat: 52.5250, lng: 13.3694, url_avif: "https://timoboese.com/pano/berlin/21.avif", qr_data: '{"id":21,"name":"Hauptbahnhof","pano":"berlin_21"}' },
  { id: 22, name: "Tempelhofer Feld",            district: "Tempelhof",     lat: 52.4733, lng: 13.4033, url_avif: "https://timoboese.com/pano/berlin/22.avif", qr_data: '{"id":22,"name":"Tempelhofer Feld","pano":"berlin_22"}' },
  { id: 23, name: "Mauerpark",                   district: "Prenzlauer Berg", lat: 52.5350, lng: 13.4025, url_avif: "https://timoboese.com/pano/berlin/23.avif", qr_data: '{"id":23,"name":"Mauerpark","pano":"berlin_23"}' },
  { id: 24, name: "Kreuzberg (Viktoriapark)",    district: "Kreuzberg",     lat: 52.4875, lng: 13.3817, url_avif: "https://timoboese.com/pano/berlin/24.avif", qr_data: '{"id":24,"name":"Kreuzberg Viktoriapark","pano":"berlin_24"}' },
  { id: 25, name: "Friedrichstraße",             district: "Mitte",         lat: 52.5200, lng: 13.3875, url_avif: "https://timoboese.com/pano/berlin/25.avif", qr_data: '{"id":25,"name":"Friedrichstraße","pano":"berlin_25"}' },
  { id: 26, name: "Unter den Linden",            district: "Mitte",         lat: 52.5167, lng: 13.3833, url_avif: "https://timoboese.com/pano/berlin/26.avif", qr_data: '{"id":26,"name":"Unter den Linden","pano":"berlin_26"}' },
  { id: 27, name: "Bode-Museum",                 district: "Mitte",         lat: 52.5219, lng: 13.3947, url_avif: "https://timoboese.com/pano/berlin/27.avif", qr_data: '{"id":27,"name":"Bode-Museum","pano":"berlin_27"}' },
  { id: 28, name: "Pergamonmuseum",              district: "Mitte",         lat: 52.5211, lng: 13.3967, url_avif: "https://timoboese.com/pano/berlin/28.avif", qr_data: '{"id":28,"name":"Pergamonmuseum","pano":"berlin_28"}' },
  { id: 29, name: "Neue Wache",                  district: "Mitte",         lat: 52.5175, lng: 13.3950, url_avif: "https://timoboese.com/pano/berlin/29.avif", qr_data: '{"id":29,"name":"Neue Wache","pano":"berlin_29"}' },
  { id: 30, name: "Humboldt Forum",              district: "Mitte",         lat: 52.5181, lng: 13.4017, url_avif: "https://timoboese.com/pano/berlin/30.avif", qr_data: '{"id":30,"name":"Humboldt Forum","pano":"berlin_30"}' },
  { id: 31, name: "Zoologischer Garten",         district: "Charlottenburg", lat: 52.5081, lng: 13.3375, url_avif: "https://timoboese.com/pano/berlin/31.avif", qr_data: '{"id":31,"name":"Zoologischer Garten","pano":"berlin_31"}' },
  { id: 32, name: "Wannsee",                     district: "Steglitz-Zehlendorf", lat: 52.4167, lng: 13.1667, url_avif: "https://timoboese.com/pano/berlin/32.avif", qr_data: '{"id":32,"name":"Wannsee","pano":"berlin_32"}' },
  { id: 33, name: "Schlossplatz",                district: "Mitte",         lat: 52.5161, lng: 13.4033, url_avif: "https://timoboese.com/pano/berlin/33.avif", qr_data: '{"id":33,"name":"Schlossplatz","pano":"berlin_33"}' },
  { id: 34, name: "Köpenick (Rathaus)",          district: "Treptow-Köpenick", lat: 52.4450, lng: 13.5742, url_avif: "https://timoboese.com/pano/berlin/34.avif", qr_data: '{"id":34,"name":"Köpenick Rathaus","pano":"berlin_34"}' },
  { id: 35, name: "Spandau (Zitadelle)",         district: "Spandau",       lat: 52.5417, lng: 13.2083, url_avif: "https://timoboese.com/pano/berlin/35.avif", qr_data: '{"id":35,"name":"Spandau Zitadelle","pano":"berlin_35"}' },
  { id: 36, name: "Karl-Marx-Allee",             district: "Friedrichshain", lat: 52.5181, lng: 13.4300, url_avif: "https://timoboese.com/pano/berlin/36.avif", qr_data: '{"id":36,"name":"Karl-Marx-Allee","pano":"berlin_36"}' },
  { id: 37, name: "Treptower Park",              district: "Treptow-Köpenick", lat: 52.4883, lng: 13.4700, url_avif: "https://timoboese.com/pano/berlin/37.avif", qr_data: '{"id":37,"name":"Treptower Park","pano":"berlin_37"}' },
  { id: 38, name: "Volkspark Friedrichshain",    district: "Friedrichshain", lat: 52.5267, lng: 13.4333, url_avif: "https://timoboese.com/pano/berlin/38.avif", qr_data: '{"id":38,"name":"Volkspark Friedrichshain","pano":"berlin_38"}' },
  { id: 39, name: "Gleisdreieck",                district: "Kreuzberg",     lat: 52.4967, lng: 13.3733, url_avif: "https://timoboese.com/pano/berlin/39.avif", qr_data: '{"id":39,"name":"Gleisdreieck","pano":"berlin_39"}' },
];

// Live-Daten aus der Datenbank (wird asynchron geladen)
let liveLocations: PanoramaLocation[] | null = null;

/**
 * Lädt die aktuellen ArUco-ID → Location-Zuweisungen von der Datenbank.
 * Überschreibt die Fallback-Daten mit den echten Werten.
 */
export async function fetchLocationsFromDB(): Promise<PanoramaLocation[]> {
  try {
    const response = await fetch('https://timoboese.com/pano/berlin/data.json');
    const data = await response.json();
    
    // API gibt direkt ein Array von Arrays zurück: [filename, name, district, lat, lng, tags, arucoId]
    // data.value existiert nicht – die API liefert das Array direkt
    const rows: any[] = Array.isArray(data) ? data : (data.value || data);
    
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn('[DB] Keine Daten erhalten, verwende Fallback');
      return getLocations();
    }

    console.log(`[DB] ${rows.length} Einträge geladen`);
    
    // Mapping: ArUco-ID → Location-Daten
    const dbLocations: PanoramaLocation[] = [];
    
    for (const row of rows) {
      // Format: [filename, name, district, lat, lng, tags, arucoId]
      const arucoId = row[6];
      if (arucoId === undefined || arucoId === null) continue;
      
      const id = typeof arucoId === 'number' ? arucoId : parseInt(arucoId, 10);
      if (isNaN(id) || id < 1) continue;
      
      const name = row[1] || `Ort ${id}`;
      const district = row[2] || '';
      const lat = typeof row[3] === 'number' ? row[3] : parseFloat(row[3]);
      const lng = typeof row[4] === 'number' ? row[4] : parseFloat(row[4]);
      
      // Panorama-URL: filename ohne .avif → ID-Nummer
      const filename = row[0] || '';
      // Extrahiere die Nummer aus dem Dateinamen (z.B. "IMG_20260611_110629_00_001" → "01")
      const fileMatch = filename.match(/_(\d{3})$/);
      const panoId = fileMatch ? fileMatch[1] : String(id).padStart(2, '0');
      
      dbLocations.push({
        id,
        name,
        district,
        lat,
        lng,
        url_avif: `https://timoboese.com/pano/berlin/${panoId}.avif`,
        qr_data: JSON.stringify({ id, name, pano: `berlin_${panoId}` }),
      });
    }
    
    if (dbLocations.length > 0) {
      liveLocations = dbLocations;
      console.log(`[DB] ${dbLocations.length} Locations geladen (IDs: ${dbLocations.map(l => l.id).join(', ')})`);
    } else {
      console.warn('[DB] Keine gültigen Locations in DB, verwende Fallback');
    }
    
    return getLocations();
  } catch (e) {
    console.warn('[DB] Fehler beim Laden der Datenbank:', e);
    return getLocations();
  }
}

/**
 * Gibt die aktuellen Locations zurück (live oder Fallback)
 */
export function getLocations(): PanoramaLocation[] {
  return liveLocations || FALLBACK_LOCATIONS;
}

/**
 * Findet eine Location anhand der ArUco-ID
 */
export function findLocationById(id: number): PanoramaLocation | undefined {
  const locations = getLocations();
  return locations.find(l => l.id === id);
}

/**
 * Findet eine Location anhand des Namens
 */
export function findLocationByName(name: string): PanoramaLocation | undefined {
  const normalized = name.toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const locations = getLocations();
  return locations.find(l => l.name.toLowerCase() === normalized);
}

/**
 * Gibt eine zufällige Location zurück (ohne die bereits verwendeten IDs)
 */
export const getRandomLocation = (usedIds: number[] = []): PanoramaLocation => {
  const locations = getLocations();
  const available = locations.filter(l => !usedIds.includes(l.id));
  if (available.length === 0) {
    return locations[Math.floor(Math.random() * locations.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
};

// Export für Abwärtskompatibilität
export const panoramaLocations: PanoramaLocation[] = FALLBACK_LOCATIONS;
