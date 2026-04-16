#!/usr/bin/env python3
"""
GeoCheckr QR City Cards — English PDF with 2mm Bleed + Crop Marks
205 cards, 6cm × 6cm, A4 pages, front + back
EXACT same design as original English version, just with bleed + crop marks
"""

import json, re, os, sys, math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode
from io import BytesIO

# ── CONFIG ──
CARD_SIZE = 6 * cm
BLEED = 2 * mm
PAGE_W, PAGE_H = A4
MARGIN_X = 15 * mm
MARGIN_Y_TOP = 20 * mm
MARGIN_Y_BOT = 15 * mm

# Colors
C_BLUE = (0x33/255, 0x40/255, 0xca/255)
C_GREEN = (0xc6/255, 0xff/255, 0x00/255)
C_DARK = (0x0a/255, 0x0b/255, 0x1f/255)
C_WHITE = (0xf5/255, 0xf5/255, 0xf0/255)
C_CROP = (0, 0, 0)

COLS = 3
ROWS = 4
CARDS_PER_PAGE = COLS * ROWS
CARD_GAP = 3 * mm

# ── FONTS ──
FONT_DIR = '/tmp'
pdfmetrics.registerFont(TTFont('SpaceGrotesk', f'{FONT_DIR}/SpaceGrotesk-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SpaceGrotesk-Bold', f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSans', f'{FONT_DIR}/NotoSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSans-Bold', f'{FONT_DIR}/NotoSans-Bold.ttf'))

# ── LOAD LOCATIONS ──
def load_locations():
    with open('/home/donatello/.openclaw/workspace/GeoCheckr_App/src/data/panoramaLocations.ts', 'r') as f:
        content = f.read()
    match = re.search(r'export const panoramaLocations.*?=\s*(\[[\s\S]*?\]);', content)
    arr_str = match.group(1)
    arr_str = re.sub(r',\s*}', '}', arr_str)
    arr_str = re.sub(r',\s*]', ']', arr_str)
    return json.loads(arr_str)

LOCAL_NAMES = {
    "Paris":"Paris","Tokyo":"東京","Cairo":"القاهرة","Berlin":"Berlin",
    "Rome":"Roma","Moscow":"Москва","Seoul":"서울","Bangkok":"กรุงเทพ",
    "Istanbul":"İstanbul","Mumbai":"मुंबई","Beijing":"北京","Shanghai":"上海",
    "Delhi":"दिल्ली","Osaka":"大阪","Kyoto":"京都","Lisbon":"Lisboa",
    "Vienna":"Wien","Prague":"Praha","Budapest":"Budapest","Warsaw":"Warszawa",
    "Athens":"Αθήνα","Copenhagen":"København","Munich":"München",
    "Milan":"Milano","Naples":"Napoli","Venice":"Venezia","Florence":"Firenze",
    "Mexico City":"Ciudad de México","Taipei":"台北","Dubai":"دبي",
    "Riyadh":"الرياض","Saint Petersburg":"Санкт-Петербург","Kyiv":"Київ",
    "Bucharest":"București","Sofia":"София","Belgrade":"Београд",
    "Zagreb":"Zagreb","Bratislava":"Bratislava","Tallinn":"Tallinn",
    "Riga":"Rīga","Vilnius":"Vilnius","Tbilisi":"თბილისი","Yerevan":"Երևան",
    "Brasília":"Brasília","Marrakech":"مراكش","Tunis":"تونس","Algiers":"الجزائر",
    "Addis Ababa":"አዲስ አበባ","Jakarta":"Jakarta","Hanoi":"Hà Nội",
    "Manila":"Maynila","Casablanca":"الدار البيضاء","Baku":"Bakı",
    "Hamburg":"Hamburg","Sarajevo":"Sarajevo","Tirana":"Tirana",
    "Hong Kong":"香港","Kathmandu":"काठमाडौं","Dhaka":"ঢাকা",
    "Tehran":"تهران","Baghdad":"بغداد","Jerusalem":"ירושלים",
    "Colombo":"කොළඹ","Ulaanbaatar":"Улаанбаатар","Doha":"الدوحة",
    "Damascus":"دمشق","Beirut":"بيروت","Islamabad":"اسلام آباد",
    "Accra":"Accra","Dakar":"Dakar","Nairobi":"Nairobi",
    "Kampala":"Kampala","Dar es Salaam":"Dar es Salaam",
    "Kigali":"Kigali","Maputo":"Maputo","Luanda":"Luanda",
    "Kinshasa":"Kinshasa","Lusaka":"Lusaka","Harare":"Harare",
    "Abidjan":"Abidjan","Bamako":"Bamako","Antananarivo":"Antananarivo",
    "Cape Town":"Cape Town","Johannesburg":"Johannesburg",
    "Tripoli":"طرابلس","Khartoum":"الخرطوم","Mombasa":"Mombasa",
    "Zanzibar":"Zanzibar","Djibouti":"Djibouti","Asmara":"Asmara",
    "Mogadishu":"Mogadishu","Libreville":"Libreville",
    "Sydney":"Sydney","Melbourne":"Melbourne","Auckland":"Auckland",
    "Wellington":"Wellington","Brisbane":"Brisbane","Perth":"Perth",
    "New York":"New York","Los Angeles":"Los Angeles","Chicago":"Chicago",
    "Miami":"Miami","San Francisco":"San Francisco","Toronto":"Toronto",
    "Vancouver":"Vancouver","Havana":"La Habana",
    "Buenos Aires":"Buenos Aires","Rio de Janeiro":"Rio de Janeiro",
    "São Paulo":"São Paulo","Bogotá":"Bogotá","Lima":"Lima",
    "Santiago":"Santiago","Caracas":"Caracas","Quito":"Quito",
    "Montevideo":"Montevideo","Medellín":"Medellín","Cusco":"Cusco",
    "Cartagena":"Cartagena","Guayaquil":"Guayaquil",
    "Kraków":"Kraków","Porto":"Porto","Seville":"Sevilla",
    "Salzburg":"Salzburg","Busan":"부산","Chiang Mai":"เชียงใหม่",
    "Jaipur":"जयपुर","Kabul":"کابل","Kochi":"कोची",
    "Canberra":"Canberra","Gold Coast":"Gold Coast",
    "Queenstown":"Queenstown","Christchurch":"Christchurch",
    "Reykjavik":"Reykjavík","Edinburgh":"Edinburgh",
    "Barcelona":"Barcelona","Madrid":"Madrid",
    "Oslo":"Oslo","Stockholm":"Stockholm","Helsinki":"Helsinki",
    "Zurich":"Zürich","Brussels":"Bruxelles","Amsterdam":"Amsterdam",
    "Dublin":"Dublin","London":"London",
    "Ljubljana":"Ljubljana","Kiev":"Київ","Singapore":"新加坡",
    "Kuala Lumpur":"کوالا لمڤور","Amman":"عمّان","Muscat":"مسقط",
    "Kuwait City":"الكويت","Phnom Penh":"ភ្នំពេញ","Vientiane":"ວຽງຈັນ",
    "Yangon":"ရန်ကုန်","Almaty":"Алматы","Tashkent":"Toshkent",
    "Ankara":"Ankara","Lagos":"Lagos","Ouagadougou":"Ouagadougou",
    "Windhoek":"Windhoek","Gaborone":"Gaborone","Lome":"Lomé",
    "Freetown":"Freetown","Monrovia":"Monrovia",
    "Brazzaville":"Brazzaville","N'Djamena":"N'Djamena","Niamey":"Niamey",
    "Conakry":"Conakry","Banjul":"Banjul",
    "Panama City":"Ciudad de Panamá","San Jose":"San José",
    "Guatemala City":"Ciudad de Guatemala",
    "New Orleans":"New Orleans","Seattle":"Seattle","Denver":"Denver",
    "Montreal":"Montréal","Boston":"Boston","Washington DC":"Washington DC",
    "Phoenix":"Phoenix","Honolulu":"Honolulu","Anchorage":"Anchorage",
    "Kingston":"Kingston","Santo Domingo":"Santo Domingo","Nassau":"Nassau",
    "San Juan":"San Juan","Sao Paulo":"São Paulo","Bogota":"Bogotá",
    "Asuncion":"Asunción","La Paz":"La Paz","Medellin":"Medellín",
    "Valparaiso":"Valparaíso","Salvador":"Salvador",
    "Buenaventura":"Buenaventura","Georgetown":"Georgetown",
    "Paramaribo":"Paramaribo","Sucre":"Sucre","Cordoba":"Córdoba",
    "Curitiba":"Curitiba","Mendoza":"Mendoza","Iquique":"Iquique",
    "Adelaide":"Adelaide","Darwin":"Darwin","Hobart":"Hobart",
    "Cairns":"Cairns","Suva":"Suva","Nuku'alofa":"Nukuʻalofa",
    "Port Moresby":"Port Moresby","Noumea":"Nouméa","Apia":"Apia",
    "Ngerulmud":"Ngerulmud","Bissau":"Bissau","Praia":"Praia","Moroni":"Moroni",
}

def get_local_font(text):
    for ch in text:
        cp = ord(ch)
        if 0x4E00 <= cp <= 0x9FFF: return 'NotoSans'
        if 0x0600 <= cp <= 0x06FF: return 'NotoSans'
        if 0x0900 <= cp <= 0x097F: return 'NotoSans'
        if 0x0E00 <= cp <= 0x0E7F: return 'NotoSans'
    return 'SpaceGrotesk'

# ── QR CODE ──
def generate_qr_pil(data):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="#3340ca", back_color="#c6ff00").convert('RGB')

# ── CROP MARKS ──
def draw_crop_marks(c, card_x, card_y, card_w, card_h, bleed):
    mark_len = 3 * mm
    mark_off = 0.5 * mm
    c.setStrokeColor(C_CROP)
    c.setLineWidth(0.3)

    x0 = card_x - bleed
    y0 = card_y - bleed
    x1 = card_x + card_w + bleed
    y1 = card_y + card_h + bleed

    c.line(x0 - mark_off, y1, x0 - mark_off - mark_len, y1)
    c.line(x0, y1 + mark_off, x0, y1 + mark_off + mark_len)
    c.line(x1 + mark_off, y1, x1 + mark_off + mark_len, y1)
    c.line(x1, y1 + mark_off, x1, y1 + mark_off + mark_len)
    c.line(x0 - mark_off, y0, x0 - mark_off - mark_len, y0)
    c.line(x0, y0 - mark_off, x0, y0 - mark_off - mark_len)
    c.line(x1 + mark_off, y0, x1 + mark_off + mark_len, y0)
    c.line(x1, y0 - mark_off, x1, y0 - mark_off - mark_len)

# ── DRAW FRONT — EXACT original design with bleed ──
def draw_front(c, loc, card_x, card_y):
    lid = f"{loc['id']:03d}"

    # Bleed: blue bg extends 2mm beyond card edge
    c.setFillColor(C_BLUE)
    c.rect(card_x - BLEED, card_y - BLEED,
           CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # City name (Space Grotesk Bold 21pt, green)
    city = loc['city']
    font_size = 21 if len(city) <= 12 else (18 if len(city) <= 16 else 15)
    c.setFillColor(C_GREEN)
    c.setFont('SpaceGrotesk-Bold', font_size)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.58, city)

    # Local name
    local = LOCAL_NAMES.get(city, '')
    if local and local != city:
        local_font = get_local_font(local)
        c.setFillColor(C_DARK)
        c.setFont(local_font, 16)
        c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.48, local)

        # "LOCAL NAME" label
        c.setFillColor(C_WHITE)
        c.setFont('SpaceGrotesk', 7)
        c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.42, "LOCAL NAME")

    # Card number badge
    c.setFillColor(C_DARK)
    c.roundRect(card_x + CARD_SIZE/2 - 22, card_y + CARD_SIZE*0.22, 44, 22, 11, fill=1, stroke=0)
    c.setFillColor(C_GREEN)
    c.setFont('SpaceGrotesk-Bold', 14)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.22 + 6, f"#{lid}")

    # GEOCHECKR at bottom
    c.setFillColor(C_WHITE)
    c.setFont('SpaceGrotesk', 7)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + 8, "GEOCHECKR")

# ── DRAW BACK — EXACT original design with bleed ──
def draw_back(c, loc, card_x, card_y):
    lid = f"{loc['id']:03d}"

    # Bleed: green bg extends 2mm beyond card edge
    c.setFillColor(C_GREEN)
    c.rect(card_x - BLEED, card_y - BLEED,
           CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # QR code, 0.5cm margin
    margin = 5 * mm
    qr_size = CARD_SIZE - 2 * margin
    url = f"https://geocheckr.app/play/{lid}"
    qr_img = generate_qr_pil(url)
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

# ── POSITIONS ──
def get_card_positions():
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
    pages = math.ceil(len(locs) / CARDS_PER_PAGE)

    # ── FRONT PDF ──
    front_path = os.path.join(out_dir, 'GEOCHECKR_CARDS_BLEED_FRONT.pdf')
    cf = canvas.Canvas(front_path, pagesize=A4)
    cf.setTitle("GeoCheckr Cards — Front (2mm Bleed)")
    cf.setAuthor("GeoCheckr")
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cf.showPage()
        x, y = positions[i % CARDS_PER_PAGE]
        draw_front(cf, loc, x, y)
        draw_crop_marks(cf, x, y, CARD_SIZE, CARD_SIZE, BLEED)
    cf.save()
    print(f"✅ Front: {front_path} ({pages} pages)")

    # ── BACK PDF ──
    back_path = os.path.join(out_dir, 'GEOCHECKR_CARDS_BLEED_BACK.pdf')
    cb = canvas.Canvas(back_path, pagesize=A4)
    cb.setTitle("GeoCheckr Cards — Back (2mm Bleed)")
    cb.setAuthor("GeoCheckr")
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cb.showPage()
        x, y = positions[i % CARDS_PER_PAGE]
        draw_back(cb, loc, x, y)
        draw_crop_marks(cb, x, y, CARD_SIZE, CARD_SIZE, BLEED)
    cb.save()
    print(f"✅ Back: {back_path} ({pages} pages)")

    # ── COMBINED ──
    combined_path = os.path.join(out_dir, 'GEOCHECKR_CARDS_BLEED_COMBINED.pdf')
    cc = canvas.Canvas(combined_path, pagesize=A4)
    cc.setTitle("GeoCheckr Cards — Combined (2mm Bleed)")
    cc.setAuthor("GeoCheckr")
    for page in range(pages):
        start = page * CARDS_PER_PAGE
        end = min(start + CARDS_PER_PAGE, len(locs))
        for i in range(start, end):
            x, y = positions[(i - start) % CARDS_PER_PAGE]
            draw_front(cc, locs[i], x, y)
            draw_crop_marks(cc, x, y, CARD_SIZE, CARD_SIZE, BLEED)
        cc.showPage()
        for i in range(start, end):
            x, y = positions[(i - start) % CARDS_PER_PAGE]
            mx = PAGE_W - x - CARD_SIZE
            draw_back(cc, locs[i], mx, y)
            draw_crop_marks(cc, mx, y, CARD_SIZE, CARD_SIZE, BLEED)
        cc.showPage()
    cc.save()
    print(f"✅ Combined: {combined_path} ({pages*2} pages)")
    print(f"\n🎴 {len(locs)} cards, {pages} pages, 6×6cm + 2mm bleed")

if __name__ == '__main__':
    main()
