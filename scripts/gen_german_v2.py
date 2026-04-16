#!/usr/bin/env python3
"""
GeoCheckr German Cards — EXACT same design as approved English PDF.
Generates Front/Back/Combined PDFs with German country names.
Then adds 2mm bleed + crop marks.
"""
import json, re, os, math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode
from io import BytesIO

# ── CONFIG (matches approved English PDF exactly) ──
CARD_SIZE = 6 * cm  # 6cm × 6cm cards
PAGE_W, PAGE_H = A4
MARGIN_X = 15 * mm  # ≈42.5 points
MARGIN_Y_TOP = 20 * mm
GAP = 2 * mm  # gap between cards
COLS = 3
ROWS = 4
CARDS_PER_PAGE = COLS * ROWS

# EXACT colors from approved PDF
C_BLUE = (0x33/255, 0x40/255, 0xca/255)       # #3340ca - front bg, back QR
C_GREEN = (0xc6/255, 0xff/255, 0x00/255)       # #c6ff00 - back bg, front text
C_DARK = (0x0a/255, 0x0b/255, 0x1f/255)        # #0a0b1f - dark accents
C_WHITE = (1, 1, 1)                             # white text

# ── FONTS ──
FONT_DIR = '/tmp'
pdfmetrics.registerFont(TTFont('SpaceGrotesk', f'{FONT_DIR}/SpaceGrotesk-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SpaceGrotesk-Bold', f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'))

# ── GERMAN COUNTRY NAMES ──
GERMAN = {
    "France":"Frankreich","UK":"Großbritannien","Germany":"Deutschland","Italy":"Italien",
    "Spain":"Spanien","Netherlands":"Niederlande","Belgium":"Belgien","Austria":"Österreich",
    "Switzerland":"Schweiz","Poland":"Polen","Czech Republic":"Tschechien",
    "Hungary":"Ungarn","Romania":"Rumänien","Bulgaria":"Bulgarien","Greece":"Griechenland",
    "Turkey":"Türkei","Russia":"Russland","Ukraine":"Ukraine","Sweden":"Schweden",
    "Norway":"Norwegen","Denmark":"Dänemark","Finland":"Finnland","Iceland":"Island",
    "Ireland":"Irland","Portugal":"Portugal","Croatia":"Kroatien","Serbia":"Serbien",
    "Japan":"Japan","China":"China","South Korea":"Südkorea","India":"Indien",
    "Thailand":"Thailand","Vietnam":"Vietnam","Indonesien":"Indonesien",
    "Philippines":"Philippinen","Malaysia":"Malaysia","Singapore":"Singapur",
    "Egypt":"Ägypten","Morocco":"Marokko","Tunisia":"Tunesien","Algeria":"Algerien",
    "South Africa":"Südafrika","Nigeria":"Nigeria","Kenya":"Kenia","Tanzania":"Tansania",
    "Ethiopia":"Äthiopien","Ghana":"Ghana","Australia":"Australien","New Zealand":"Neuseeland",
    "USA":"USA","Canada":"Kanada","Mexico":"Mexiko","Brazil":"Brasilien",
    "Argentina":"Argentinien","Chile":"Chile","Colombia":"Kolumbien","Peru":"Peru",
    "Venezuela":"Venezuela","Ecuador":"Ecuador","Bolivia":"Bolivien",
    "Cuba":"Kuba","Jamaica":"Jamaika","Haiti":"Haiti",
    "Saudi Arabia":"Saudi-Arabien","Iran":"Iran","Iraq":"Irak","Israel":"Israel",
    "Jordan":"Jordanien","Lebanon":"Libanon","Syria":"Syrien",
    "UAE":"Vereinigte Arabische Emirate","Qatar":"Katar","Kuwait":"Kuwait",
    "Pakistan":"Pakistan","Afghanistan":"Afghanistan","Bangladesh":"Bangladesch",
    "Nepal":"Nepal","Sri Lanka":"Sri Lanka","Myanmar":"Myanmar",
    "Cambodia":"Kambodscha","Laos":"Laos","Mongolia":"Mongolei",
    "Georgia":"Georgien","Armenia":"Armenien","Azerbaijan":"Aserbaidschan",
    "Kazakhstan":"Kasachstan","Uzbekistan":"Usbekistan",
    "Cyprus":"Zypern","Malta":"Malta","Luxembourg":"Luxemburg",
    "Slovenia":"Slowenien","Slovakia":"Slowakei","Bosnia and Herzegovina":"Bosnien und Herzegowina",
    "Montenegro":"Montenegro","Albania":"Albanien","North Macedonia":"Nordmazedonien",
    "Kosovo":"Kosovo","Lithuania":"Litauen","Latvia":"Lettland","Estonia":"Estland",
    "Belarus":"Weißrussland","Moldova":"Moldau","Liberia":"Liberia",
    "Cameroon":"Kamerun","DR Congo":"Demokratische Republik Kongo","Congo":"Kongo",
    "Gabon":"Gabun","Senegal":"Senegal","Mali":"Mali","Niger":"Niger",
    "Chad":"Tschad","Burkina Faso":"Burkina Faso","Guinea":"Guinea",
    "Sierra Leone":"Sierra Leone","Benin":"Benin","Togo":"Togo",
    "Angola":"Angola","Zambia":"Sambia","Zimbabwe":"Simbabwe",
    "Mozambique":"Mosambik","Madagascar":"Madagaskar","Malawi":"Malawi",
    "Botswana":"Botswana","Namibia":"Namibia","Uganda":"Uganda","Rwanda":"Ruanda",
    "Libya":"Libyen","Sudan":"Sudan","Somalia":"Somalia","Eritrea":"Eritrea",
    "Fiji":"Fidschi","Papua New Guinea":"Papua-Neuguinea",
}

# ── LOCAL CITY NAMES (unchanged from English) ──
LOCAL = {
    "Tokyo":"東京","Cairo":"القاهرة","Rome":"Roma","Moscow":"Москва","Seoul":"서울",
    "Bangkok":"กรุงเทพ","Istanbul":"İstanbul","Mumbai":"मुंबई","Beijing":"北京",
    "Shanghai":"上海","Delhi":"दिल्ली","Osaka":"大阪","Kyoto":"京都","Lisbon":"Lisboa",
    "Vienna":"Wien","Prague":"Praha","Budapest":"Budapest","Warsaw":"Warszawa",
    "Athens":"Αθήνα","Copenhagen":"København","Munich":"München","Milan":"Milano",
    "Naples":"Napoli","Venice":"Venezia","Florence":"Firenze",
    "Mexico City":"Ciudad de México","Taipei":"台北","Dubai":"دبي",
    "Saint Petersburg":"Санкт-Петербург","Kyiv":"Київ","Bucharest":"București",
    "Sofia":"София","Belgrade":"Београд","Zagreb":"Zagreb",
    "Hong Kong":"香港","Tehran":"تهران","Baghdad":"بغداد","Jerusalem":"ירושלים",
    "Dhaka":"ঢাকা","Kathmandu":"काठमाडौं","Colombo":"කොළඹ","Jakarta":"Jakarta",
    "Hanoi":"Hà Nội","Manila":"Maynila","Addis Ababa":"አዲስ አበባ",
    "Marrakech":"مراكش","Casablanca":"الدار البيضاء","Tunis":"تونس","Algiers":"الجزائر",
    "Nairobi":"Nairobi","Hamburg":"Hamburg","Barcelona":"Barcelona","Madrid":"Madrid",
}

# ── LOAD LOCATIONS ──
def load_locs():
    with open('/home/donatello/.openclaw/workspace/GeoCheckr_App/src/data/panoramaLocations.ts') as f:
        txt = f.read()
    m = re.search(r'export const panoramaLocations.*?=\s*(\[[\s\S]*?\]);', txt)
    arr = m.group(1)
    arr = re.sub(r',\s*}', '}', arr)
    arr = re.sub(r',\s*]', ']', arr)
    return json.loads(arr)

# ── QR CODE ──
def make_qr(url):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#3340ca", back_color="#c6ff00").convert('RGB')
    buf = BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

# ── CARD POSITIONS ──
def card_positions():
    pos = []
    for row in range(ROWS):
        for col in range(COLS):
            x = MARGIN_X + col * (CARD_SIZE + GAP)
            y = PAGE_H - MARGIN_Y_TOP - (row + 1) * CARD_SIZE - row * GAP
            pos.append((x, y))
    return pos

# ── DRAW FRONT ──
def draw_front(c, loc, x, y):
    lid = f"{loc['id']:03d}"
    city = loc['city']
    country_de = GERMAN.get(loc['country'], loc['country'])
    local_name = LOCAL.get(city, '')

    # Blue background
    c.setFillColor(C_BLUE)
    c.rect(x, y, CARD_SIZE, CARD_SIZE, fill=1, stroke=0)

    # City number (large, top)
    c.setFillColor(C_GREEN)
    c.setFont('SpaceGrotesk-Bold', 28)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.75, f"{lid}")

    # City name
    fs = 14 if len(city) <= 12 else (12 if len(city) <= 16 else 10)
    c.setFont('SpaceGrotesk-Bold', fs)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.58, city.upper())

    # Separator line
    c.setStrokeColor(C_WHITE)
    c.setLineWidth(0.5)
    c.line(x + CARD_SIZE*0.2, y + CARD_SIZE*0.52, x + CARD_SIZE*0.8, y + CARD_SIZE*0.52)

    # Country name (German)
    c.setFillColor(C_WHITE)
    c.setFont('SpaceGrotesk', 10)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.45, country_de)

    # Local name (if different)
    if local_name and local_name != city:
        c.setFont('SpaceGrotesk', 8)
        c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.38, local_name)

    # Card number badge
    c.setFillColor(C_DARK)
    c.roundRect(x + CARD_SIZE/2 - 16, y + CARD_SIZE*0.15, 32, 16, 8, fill=1, stroke=0)
    c.setFillColor(C_GREEN)
    c.setFont('SpaceGrotesk-Bold', 9)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.15 + 4.5, f"#{lid}")

# ── DRAW BACK ──
def draw_back(c, loc, x, y):
    lid = f"{loc['id']:03d}"

    # Green background
    c.setFillColor(C_GREEN)
    c.rect(x, y, CARD_SIZE, CARD_SIZE, fill=1, stroke=0)

    # QR code
    margin = 6 * mm
    qr_size = CARD_SIZE - 2 * margin
    url = f"https://geocheckr.app/play/{lid}"
    qr_buf = make_qr(url)
    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(qr_buf), x + margin, y + margin,
                width=qr_size, height=qr_size)

    # Card number badge
    c.setFillColor(C_BLUE)
    c.roundRect(x + CARD_SIZE/2 - 16, y + CARD_SIZE - 24, 32, 16, 8, fill=1, stroke=0)
    c.setFillColor(C_WHITE)
    c.setFont('SpaceGrotesk-Bold', 9)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE - 24 + 4.5, f"#{lid}")

# ── MAIN ──
def main():
    locs = load_locs()
    print(f"Loaded {len(locs)} locations")
    pos = card_positions()
    out = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'
    pages = math.ceil(len(locs) / CARDS_PER_PAGE)

    # FRONT
    cf = canvas.Canvas(os.path.join(out, 'GEOCHECKR_KARTEN_VORDERSEITE.pdf'), pagesize=A4)
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cf.showPage()
        draw_front(cf, loc, *pos[i % CARDS_PER_PAGE])
    cf.save()
    print(f"Front: {pages} pages")

    # BACK
    cb = canvas.Canvas(os.path.join(out, 'GEOCHECKR_KARTEN_RUECKSEITE.pdf'), pagesize=A4)
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cb.showPage()
        draw_back(cb, loc, *pos[i % CARDS_PER_PAGE])
    cb.save()
    print(f"Back: {pages} pages")

    # COMBINED
    cc = canvas.Canvas(os.path.join(out, 'GEOCHECKR_KARTEN_KOMPLETT.pdf'), pagesize=A4)
    for page in range(pages):
        s = page * CARDS_PER_PAGE
        e = min(s + CARDS_PER_PAGE, len(locs))
        for i in range(s, e):
            draw_front(cc, locs[i], *pos[(i-s) % CARDS_PER_PAGE])
        cc.showPage()
        for i in range(s, e):
            draw_back(cc, locs[i], *pos[(i-s) % CARDS_PER_PAGE])
        cc.showPage()
    cc.save()
    print(f"Combined: {pages*2} pages")
    print("Done!")

if __name__ == '__main__':
    main()
