#!/usr/bin/env python3
"""
GeoCheckr QR City Cards — German PDF Generator
205 cards, 6cm × 6cm, A4 pages, front + back

GERMAN SPECS:
- Front: City name (unchanged), country in GERMAN
- Back: QR code, same design
- 2mm bleed (Beschnittzugabe) on all sides
- Crop marks (Schnittmarken) at corners
"""

import json, re, os, sys, math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode
from PIL import Image as PILImage
from io import BytesIO

# ── CONFIG ──
CARD_SIZE = 6 * cm  # 6cm × 6cm
BLEED = 2 * mm      # 2mm Beschnittzugabe
PAGE_W, PAGE_H = A4  # 210 × 297 mm
MARGIN_X = 15 * mm
MARGIN_Y_TOP = 20 * mm
MARGIN_Y_BOT = 15 * mm

# Card with bleed (total size including bleed)
CARD_BLEED_W = CARD_SIZE + 2 * BLEED
CARD_BLEED_H = CARD_SIZE + 2 * BLEED

# Colors
C_BLUE = (0x33/255, 0x40/255, 0xca/255)          # #3340ca
C_GREEN = (0xc6/255, 0xff/255, 0x00/255)          # #c6ff00
C_DARK = (0x0a/255, 0x0b/255, 0x1f/255)           # #0a0b1f
C_WHITE = (0xf5/255, 0xf5/255, 0xf0/255)          # #f5f5f0
C_CROP = (0, 0, 0)                                # Black crop marks

# Grid
COLS = 3
ROWS = 4
CARDS_PER_PAGE = COLS * ROWS  # 12
CARD_GAP = 3 * mm  # gap between cards (increased for crop marks)

# ── FONTS ──
FONT_DIR = '/tmp'
pdfmetrics.registerFont(TTFont('SpaceGrotesk', f'{FONT_DIR}/SpaceGrotesk-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SpaceGrotesk-Bold', f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSans', f'{FONT_DIR}/NotoSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSans-Bold', f'{FONT_DIR}/NotoSans-Bold.ttf'))

# ── GERMAN COUNTRY NAMES ──
GERMAN_COUNTRIES = {
    "France": "Frankreich",
    "UK": "Großbritannien",
    "Germany": "Deutschland",
    "Italy": "Italien",
    "Spain": "Spanien",
    "Netherlands": "Niederlande",
    "Belgium": "Belgien",
    "Austria": "Österreich",
    "Switzerland": "Schweiz",
    "Poland": "Polen",
    "Czech Republic": "Tschechien",
    "Hungary": "Ungarn",
    "Romania": "Rumänien",
    "Bulgaria": "Bulgarien",
    "Greece": "Griechenland",
    "Turkey": "Türkei",
    "Russia": "Russland",
    "Ukraine": "Ukraine",
    "Sweden": "Schweden",
    "Norway": "Norwegen",
    "Denmark": "Dänemark",
    "Finland": "Finnland",
    "Iceland": "Island",
    "Ireland": "Irland",
    "Portugal": "Portugal",
    "Croatia": "Kroatien",
    "Serbia": "Serbien",
    "Bosnia and Herzegovina": "Bosnien und Herzegowina",
    "Albania": "Albanien",
    "North Macedonia": "Nordmazedonien",
    "Montenegro": "Montenegro",
    "Kosovo": "Kosovo",
    "Slovenia": "Slowenien",
    "Slovakia": "Slowakei",
    "Lithuania": "Litauen",
    "Latvia": "Lettland",
    "Estonia": "Estland",
    "Georgia": "Georgien",
    "Armenia": "Armenien",
    "Azerbaijan": "Aserbaidschan",
    "Moldova": "Moldau",
    "Belarus": "Weißrussland",
    "Luxembourg": "Luxemburg",
    "Japan": "Japan",
    "China": "China",
    "South Korea": "Südkorea",
    "North Korea": "Nordkorea",
    "India": "Indien",
    "Thailand": "Thailand",
    "Vietnam": "Vietnam",
    "Indonesia": "Indonesien",
    "Philippines": "Philippinen",
    "Malaysia": "Malaysia",
    "Singapore": "Singapur",
    "Cambodia": "Kambodscha",
    "Laos": "Laos",
    "Myanmar": "Myanmar",
    "Bangladesh": "Bangladesch",
    "Nepal": "Nepal",
    "Sri Lanka": "Sri Lanka",
    "Pakistan": "Pakistan",
    "Afghanistan": "Afghanistan",
    "Iran": "Iran",
    "Iraq": "Irak",
    "Syria": "Syrien",
    "Lebanon": "Libanon",
    "Israel": "Israel",
    "Palestine": "Palästina",
    "Jordan": "Jordanien",
    "Saudi Arabia": "Saudi-Arabien",
    "UAE": "Vereinigte Arabische Emirate",
    "Qatar": "Katar",
    "Kuwait": "Kuwait",
    "Oman": "Oman",
    "Bahrain": "Bahrain",
    "Yemen": "Jemen",
    "Mongolia": "Mongolei",
    "Kazakhstan": "Kasachstan",
    "Uzbekistan": "Usbekistan",
    "Turkmenistan": "Turkmenistan",
    "Tajikistan": "Tadschikistan",
    "Kyrgyzstan": "Kirgisistan",
    "Taiwan": "Taiwan",
    "Hong Kong": "Hongkong",
    "Egypt": "Ägypten",
    "Libya": "Libyen",
    "Tunisia": "Tunesien",
    "Algeria": "Algerien",
    "Morocco": "Marokko",
    "Sudan": "Sudan",
    "South Sudan": "Südsudan",
    "Ethiopia": "Äthiopien",
    "Eritrea": "Eritrea",
    "Djibouti": "Dschibuti",
    "Somalia": "Somalia",
    "Kenya": "Kenia",
    "Tansania": "Tansania",
    "Tanzania": "Tansania",
    "Uganda": "Uganda",
    "Rwanda": "Ruanda",
    "Burundi": "Burundi",
    "DR Congo": "Demokratische Republik Kongo",
    "Congo": "Kongo",
    "Cameroon": "Kamerun",
    "Nigeria": "Nigeria",
    "Ghana": "Ghana",
    "Ivory Coast": "Elfenbeinküste",
    "Senegal": "Senegal",
    "Mali": "Mali",
    "Burkina Faso": "Burkina Faso",
    "Niger": "Niger",
    "Chad": "Tschad",
    "Guinea": "Guinea",
    "Sierra Leone": "Sierra Leone",
    "Liberia": "Liberia",
    "Gambia": "Gambia",
    "Guinea-Bissau": "Guinea-Bissau",
    "Mauritania": "Mauretanien",
    "Benin": "Benin",
    "Togo": "Togo",
    "Gabon": "Gabun",
    "Equatorial Guinea": "Äquatorialguinea",
    "Central African Republic": "Zentralafrikanische Republik",
    "Angola": "Angola",
    "Zambia": "Sambia",
    "Zimbabwe": "Simbabwe",
    "Mozambique": "Mosambik",
    "Madagascar": "Madagaskar",
    "Malawi": "Malawi",
    "Botswana": "Botswana",
    "Namibia": "Namibia",
    "South Africa": "Südafrika",
    "Lesotho": "Lesotho",
    "Eswatini": "Eswatini",
    "Cape Verde": "Kap Verde",
    "São Tomé and Príncipe": "São Tomé und Príncipe",
    "Comoros": "Komoren",
    "Mauritius": "Mauritius",
    "Seychelles": "Seychellen",
    "Australia": "Australien",
    "New Zealand": "Neuseeland",
    "Papua New Guinea": "Papua-Neuguinea",
    "Fiji": "Fidschi",
    "Tonga": "Tonga",
    "Samoa": "Samoa",
    "Vanuatu": "Vanuatu",
    "Solomon Islands": "Salomonen",
    "Palau": "Palau",
    "USA": "USA",
    "Canada": "Kanada",
    "Mexico": "Mexiko",
    "Guatemala": "Guatemala",
    "Belize": "Belize",
    "Honduras": "Honduras",
    "El Salvador": "El Salvador",
    "Nicaragua": "Nicaragua",
    "Costa Rica": "Costa Rica",
    "Panama": "Panama",
    "Cuba": "Kuba",
    "Jamaica": "Jamaika",
    "Haiti": "Haiti",
    "Dominican Republic": "Dominikanische Republik",
    "Bahamas": "Bahamas",
    "Trinidad and Tobago": "Trinidad und Tobago",
    "Barbados": "Barbados",
    "Puerto Rico": "Puerto Rico",
    "Brazil": "Brasilien",
    "Argentina": "Argentinien",
    "Chile": "Chile",
    "Colombia": "Kolumbien",
    "Peru": "Peru",
    "Venezuela": "Venezuela",
    "Ecuador": "Ecuador",
    "Bolivia": "Bolivien",
    "Paraguay": "Paraguay",
    "Uruguay": "Uruguay",
    "Guyana": "Guyana",
    "Suriname": "Suriname",
    "Cyprus": "Zypern",
    "Malta": "Malta",
    "Bhutan": "Bhutan",
    "Timor-Leste": "Osttimor",
    "Brunei": "Brunei",
    "Micronesia": "Mikronesien",
    "Marshall Islands": "Marshallinseln",
}

# ── LOAD LOCATIONS ──
def load_locations():
    with open('/home/donatello/.openclaw/workspace/GeoCheckr_App/src/data/panoramaLocations.ts', 'r') as f:
        content = f.read()
    match = re.search(r'export const panoramaLocations.*?=\s*(\[[\s\S]*?\]);', content)
    arr_str = match.group(1)
    arr_str = re.sub(r',\s*}', '}', arr_str)
    arr_str = re.sub(r',\s*]', ']', arr_str)
    return json.loads(arr_str)

# ── QR CODE GENERATION ──
def generate_qr_pil(data):
    """Generate QR code as PIL Image"""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="#3340ca", back_color="#c6ff00").convert('RGB')

# ── DRAW CROP MARKS ──
def draw_crop_marks(c, card_x, card_y, card_w, card_h, bleed):
    """Draw crop marks at the corners of a card (outside the bleed area)"""
    mark_len = 3 * mm   # length of crop mark
    mark_off = 0.5 * mm  # offset from bleed edge
    c.setStrokeColor(C_CROP)
    c.setLineWidth(0.3)  # thin line

    # Outer bounds (where the final cut is)
    x0 = card_x - bleed
    y0 = card_y - bleed
    x1 = card_x + card_w + bleed
    y1 = card_y + card_h + bleed

    # Top-left corner
    c.line(x0 - mark_off, y1, x0 - mark_off - mark_len, y1)  # horizontal left
    c.line(x0, y1 + mark_off, x0, y1 + mark_off + mark_len)  # vertical up

    # Top-right corner
    c.line(x1 + mark_off, y1, x1 + mark_off + mark_len, y1)  # horizontal right
    c.line(x1, y1 + mark_off, x1, y1 + mark_off + mark_len)  # vertical up

    # Bottom-left corner
    c.line(x0 - mark_off, y0, x0 - mark_off - mark_len, y0)  # horizontal left
    c.line(x0, y0 - mark_off, x0, y0 - mark_off - mark_len)  # vertical down

    # Bottom-right corner
    c.line(x1 + mark_off, y0, x1 + mark_off + mark_len, y0)  # horizontal right
    c.line(x1, y0 - mark_off, x1, y0 - mark_off - mark_len)  # vertical down

# ── DRAW FRONT (CITY NAME) ──
def draw_front(c, loc, card_x, card_y):
    """Draw the CITY NAME side with 2mm bleed"""
    # Bleed area - blue background extends beyond card edge
    c.setFillColor(C_BLUE)
    c.rect(card_x - BLEED, card_y - BLEED,
           CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # City name
    city = loc['city']
    font_size = 21 if len(city) <= 12 else (18 if len(city) <= 16 else 15)
    c.setFillColor(C_GREEN)
    c.setFont('SpaceGrotesk-Bold', font_size)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.60, city)

    # Country name (German)
    country_de = GERMAN_COUNTRIES.get(loc['country'], loc['country'])
    c.setFillColor(C_DARK)
    c.setFont('NotoSans-Bold', 11)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.50, country_de)

    # Card number
    lid = f"{loc['id']:03d}"
    c.setFillColor(C_DARK)
    c.roundRect(card_x + CARD_SIZE/2 - 22, card_y + CARD_SIZE*0.20, 44, 22, 11, fill=1, stroke=0)
    c.setFillColor(C_GREEN)
    c.setFont('SpaceGrotesk-Bold', 14)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.20 + 6, f"#{lid}")

    # GEOCHECKR logo at bottom
    c.setFillColor(C_WHITE)
    c.setFont('SpaceGrotesk', 7)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + 8, "GEOCHECKR")

# ── DRAW BACK (QR CODE) ──
def draw_back(c, loc, card_x, card_y):
    """Draw the QR CODE side with 2mm bleed"""
    lid = f"{loc['id']:03d}"

    # Bleed area - green background extends beyond card edge
    c.setFillColor(C_GREEN)
    c.rect(card_x - BLEED, card_y - BLEED,
           CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # QR code - 0.5cm margin from card edge (not bleed edge)
    margin = 5 * mm
    qr_size = CARD_SIZE - 2 * margin

    # Generate QR pointing to geocheckr.app with city ID
    url = f"https://geocheckr.app/play/{lid}"
    qr_img = generate_qr_pil(url)

    # Save to temp buffer
    buf = BytesIO()
    qr_img.save(buf, format='PNG')
    buf.seek(0)

    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(buf), card_x + margin, card_y + margin,
                width=qr_size, height=qr_size)

    # Card number badge
    c.setFillColor(C_BLUE)
    c.roundRect(card_x + CARD_SIZE/2 - 22, card_y + CARD_SIZE - 30, 44, 22, 11, fill=1, stroke=0)
    c.setFillColor(C_WHITE)
    c.setFont('SpaceGrotesk-Bold', 14)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE - 24, f"#{lid}")

# ── GET CARD POSITIONS (with space for crop marks) ──
def get_card_positions():
    """Calculate card positions on A4 page"""
    positions = []
    for row in range(ROWS):
        for col in range(COLS):
            x = MARGIN_X + col * (CARD_SIZE + CARD_GAP)
            y = PAGE_H - MARGIN_Y_TOP - (row + 1) * CARD_SIZE - row * CARD_GAP
            positions.append((x, y))
    return positions

# ── MAIN ──
def main():
    locs = load_locations()
    print(f"Loaded {len(locs)} locations")

    positions = get_card_positions()
    out_dir = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'
    os.makedirs(out_dir, exist_ok=True)

    pages = math.ceil(len(locs) / CARDS_PER_PAGE)

    # ── FRONT PDF (City Names - German) ──
    front_path = os.path.join(out_dir, 'GEOCHECKR_KARTEN_VORDERSEITE.pdf')
    cf = canvas.Canvas(front_path, pagesize=A4)
    cf.setTitle("GeoCheckr Karten — Vorderseite (Stadtname)")
    cf.setAuthor("GeoCheckr")

    for i, loc in enumerate(locs):
        pos_idx = i % CARDS_PER_PAGE
        if pos_idx == 0 and i > 0:
            cf.showPage()

        card_x, card_y = positions[pos_idx]
        draw_front(cf, loc, card_x, card_y)
        draw_crop_marks(cf, card_x, card_y, CARD_SIZE, CARD_SIZE, BLEED)

    cf.save()
    print(f"✅ Front PDF: {front_path} ({pages} pages)")

    # ── BACK PDF (QR Codes) ──
    back_path = os.path.join(out_dir, 'GEOCHECKR_KARTEN_RUECKSEITE.pdf')
    cb = canvas.Canvas(back_path, pagesize=A4)
    cb.setTitle("GeoCheckr Karten — Rückseite (QR-Code)")
    cb.setAuthor("GeoCheckr")

    for i, loc in enumerate(locs):
        pos_idx = i % CARDS_PER_PAGE
        if pos_idx == 0 and i > 0:
            cb.showPage()

        card_x, card_y = positions[pos_idx]
        draw_back(cb, loc, card_x, card_y)
        draw_crop_marks(cb, card_x, card_y, CARD_SIZE, CARD_SIZE, BLEED)

    cb.save()
    print(f"✅ Back PDF: {back_path} ({pages} pages)")

    # ── COMBINED PDF (for double-sided printing, mirrored backs) ──
    combined_path = os.path.join(out_dir, 'GEOCHECKR_KARTEN_KOMPLETT.pdf')
    cc = canvas.Canvas(combined_path, pagesize=A4)
    cc.setTitle("GeoCheckr Karten — Komplett (Vorder + Rückseite)")
    cc.setAuthor("GeoCheckr")

    for page in range(pages):
        start = page * CARDS_PER_PAGE
        end = min(start + CARDS_PER_PAGE, len(locs))

        # Front page
        for i in range(start, end):
            pos_idx = (i - start) % CARDS_PER_PAGE
            card_x, card_y = positions[pos_idx]
            draw_front(cc, locs[i], card_x, card_y)
            draw_crop_marks(cc, card_x, card_y, CARD_SIZE, CARD_SIZE, BLEED)
        cc.showPage()

        # Back page (mirrored for double-sided printing)
        for i in range(start, end):
            pos_idx = (i - start) % CARDS_PER_PAGE
            card_x, card_y = positions[pos_idx]
            mirror_x = PAGE_W - card_x - CARD_SIZE
            draw_back(cc, locs[i], mirror_x, card_y)
            draw_crop_marks(cc, mirror_x, card_y, CARD_SIZE, CARD_SIZE, BLEED)
        cc.showPage()

    cc.save()
    print(f"✅ Combined PDF: {combined_path} ({pages*2} pages)")
    print(f"\n🎴 {len(locs)} Karten, {pages} Seiten, 6×6cm + 2mm Beschnittzugabe")

if __name__ == '__main__':
    main()
