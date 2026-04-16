#!/usr/bin/env python3
"""
GeoCheckr Cards — FINAL VERSION
EN: 3 CI colors (#a6d700, #3340ca, #bdc2ff)
DE: Logo colors (#262523, #f2a444, #d9593d)
2mm bleed per card + crop marks
QR side = ONLY QR code, NO other elements
"""

import json, re, os, math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode
from io import BytesIO
from reportlab.lib.utils import ImageReader

# ── CONFIG ──
CARD_SIZE = 6 * cm
BLEED = 2 * mm
PAGE_W, PAGE_H = A4
MARGIN_X = 15 * mm
MARGIN_Y_TOP = 20 * mm
COLS = 3
ROWS = 4
CARDS_PER_PAGE = 12
CARD_GAP = 2 * mm

# ── ENGLISH COLORS (CI) ──
EN_BG      = (0xbd/255, 0xc2/255, 0xff/255)  # #bdc2ff
EN_CITY    = (0xa6/255, 0xd7/255, 0x00/255)  # #a6d700
EN_LOCAL   = (0x33/255, 0x40/255, 0xca/255)  # #3340ca
EN_PILL_BG = (0x33/255, 0x40/255, 0xca/255)  # #3340ca
EN_PILL_TX = (0xa6/255, 0xd7/255, 0x00/255)  # #a6d700
EN_QR_BG   = (0xa6/255, 0xd7/255, 0x00/255)  # #a6d700
EN_QR_FILL = "#bdc2ff"
EN_QR_BACK = "#a6d700"

# ── GERMAN COLORS (Logo) ──
DE_BG      = (0x26/255, 0x25/255, 0x23/255)  # #262523
DE_CITY    = (0xf2/255, 0xa4/255, 0x44/255)  # #f2a444
DE_LOCAL   = (0xd9/255, 0x59/255, 0x3d/255)  # #d9593d
DE_PILL_BG = (0xf2/255, 0xa4/255, 0x44/255)  # #f2a444
DE_PILL_TX = (0x26/255, 0x25/255, 0x23/255)  # #262523
DE_QR_BG   = (0xf2/255, 0xa4/255, 0x44/255)  # #f2a444
DE_QR_FILL = "#262523"
DE_QR_BACK = "#f2a444"

C_CROP = (0.3, 0.3, 0.3)

# ── FONTS ──
FONT_DIR = '/tmp'
pdfmetrics.registerFont(TTFont('SpaceGrotesk', f'{FONT_DIR}/SpaceGrotesk-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SpaceGrotesk-Bold', f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'))

FONT_DIR_SYS = '/usr/share/fonts/truetype/noto'
SCRIPT_FONTS = {}
def _reg(name, path):
    try:
        pdfmetrics.registerFont(TTFont(name, path))
        SCRIPT_FONTS[name] = True
    except: pass

_reg('NotoSansArabic', f'{FONT_DIR_SYS}/NotoSansArabic-Regular.ttf')
_reg('NotoSansDevanagari', f'{FONT_DIR_SYS}/NotoSansDevanagari-Regular.ttf')
_reg('NotoSansThai', f'{FONT_DIR_SYS}/NotoSansThai-Regular.ttf')
_reg('NotoSansGeorgian', f'{FONT_DIR_SYS}/NotoSansGeorgian-Regular.ttf')
_reg('NotoSansArmenian', f'{FONT_DIR_SYS}/NotoSansArmenian-Regular.ttf')
_reg('NotoSansEthiopic', f'{FONT_DIR_SYS}/NotoSansEthiopic-Regular.ttf')
_reg('NotoSansHebrew', f'{FONT_DIR_SYS}/NotoSansHebrew-Regular.ttf')
_reg('NotoSansBengali', f'{FONT_DIR_SYS}/NotoSansBengali-Regular.ttf')
_reg('NotoSansKhmer', f'{FONT_DIR_SYS}/NotoSansKhmer-Regular.ttf')
_reg('NotoSansMyanmar', f'{FONT_DIR_SYS}/NotoSansMyanmar-Regular.ttf')

def get_local_font(text):
    for ch in text:
        cp = ord(ch)
        if 0x0600 <= cp <= 0x06FF or 0xFB50 <= cp <= 0xFDFF:
            if 'NotoSansArabic' in SCRIPT_FONTS: return 'NotoSansArabic'
        if 0x0900 <= cp <= 0x097F:
            if 'NotoSansDevanagari' in SCRIPT_FONTS: return 'NotoSansDevanagari'
        if 0x0E00 <= cp <= 0x0E7F:
            if 'NotoSansThai' in SCRIPT_FONTS: return 'NotoSansThai'
        if 0x10A0 <= cp <= 0x10FF:
            if 'NotoSansGeorgian' in SCRIPT_FONTS: return 'NotoSansGeorgian'
        if 0x0530 <= cp <= 0x058F:
            if 'NotoSansArmenian' in SCRIPT_FONTS: return 'NotoSansArmenian'
        if 0x1200 <= cp <= 0x137F:
            if 'NotoSansEthiopic' in SCRIPT_FONTS: return 'NotoSansEthiopic'
        if 0x0590 <= cp <= 0x05FF:
            if 'NotoSansHebrew' in SCRIPT_FONTS: return 'NotoSansHebrew'
        if 0x0980 <= cp <= 0x09FF:
            if 'NotoSansBengali' in SCRIPT_FONTS: return 'NotoSansBengali'
        if 0x1780 <= cp <= 0x17FF:
            if 'NotoSansKhmer' in SCRIPT_FONTS: return 'NotoSansKhmer'
        if 0x1000 <= cp <= 0x109F:
            if 'NotoSansMyanmar' in SCRIPT_FONTS: return 'NotoSansMyanmar'
    return 'SpaceGrotesk'

# ── LOCAL NAMES ──
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

# ── GERMAN CITY NAME OVERRIDES ──
CITY_DE = {
    "Vienna":"Wien","Rome":"Rom","Munich":"München","Moscow":"Moskau",
    "Prague":"Prag","Warsaw":"Warschau","Copenhagen":"Kopenhagen",
    "Athens":"Athen","Lisbon":"Lissabon","Belgrade":"Belgrad",
    "Bucharest":"Bukarest","Kyiv":"Kiew","Saint Petersburg":"Sankt Petersburg",
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

# ── QR ──
def generate_qr(url, fill, back):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color=fill, back_color=back).convert('RGB')

# ── CROP MARKS ──
def draw_crop_marks(c, x, y, size, bleed):
    c.setStrokeColor(C_CROP)
    c.setLineWidth(0.3)
    ml, mg = 3 * mm, 0.5 * mm
    bx0, by0 = x - bleed, y - bleed
    bx1, by1 = x + size + bleed, y + size + bleed
    c.line(bx0 - mg, by1, bx0 - mg - ml, by1)
    c.line(bx0, by1 + mg, bx0, by1 + mg + ml)
    c.line(bx1 + mg, by1, bx1 + mg + ml, by1)
    c.line(bx1, by1 + mg, bx1, by1 + mg + ml)
    c.line(bx0 - mg, by0, bx0 - mg - ml, by0)
    c.line(bx0, by0 - mg, bx0, by0 - mg - ml)
    c.line(bx1 + mg, by0, bx1 + mg + ml, by0)
    c.line(bx1, by0 - mg, bx1, by0 - mg - ml)

# ── DRAW CITY SIDE ──
def draw_city(c, loc, x, y, bg, city_c, local_c, pill_bg, pill_tx,
              local_name='', city_override=''):
    lid = f"{loc['id']:03d}"
    city_display = city_override or loc['city']

    # Background + bleed
    c.setFillColorRGB(*bg)
    c.rect(x - BLEED, y - BLEED, CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # City name
    fs = 21 if len(city_display) <= 12 else (18 if len(city_display) <= 16 else 15)
    c.setFillColorRGB(*city_c)
    c.setFont('SpaceGrotesk-Bold', fs)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.58, city_display)

    # Local name
    if local_name and local_name != city_display:
        font = get_local_font(local_name)
        if font == 'SpaceGrotesk' and any(0x4E00 <= ord(ch) <= 0x9FFF for ch in local_name):
            local_name = ''  # skip CJK without font
        if local_name:
            ls = 16 if len(local_name) <= 8 else 13
            c.setFillColorRGB(*local_c)
            c.setFont(font, ls)
            c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.44, local_name)

    # Number pill
    pw, ph = 44, 22
    px = x + CARD_SIZE/2 - pw/2
    py = y + CARD_SIZE*0.18
    c.setFillColorRGB(*pill_bg)
    c.roundRect(px, py, pw, ph, 11, fill=1, stroke=0)
    c.setFillColorRGB(*pill_tx)
    c.setFont('SpaceGrotesk-Bold', 14)
    c.drawCentredString(x + CARD_SIZE/2, py + 6, f"#{lid}")

# ── DRAW QR SIDE — ONLY QR, NOTHING ELSE ──
def draw_qr(c, loc, x, y, bg_r, bg_g, bg_b, qr_fill, qr_back):
    lid = f"{loc['id']:03d}"

    # Background + bleed
    c.setFillColorRGB(bg_r, bg_g, bg_b)
    c.rect(x - BLEED, y - BLEED, CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # QR code only — 8mm margin
    margin = 8 * mm
    qr_size = CARD_SIZE - 2 * margin
    url = f"https://geocheckr.app/play/{lid}"
    qr_img = generate_qr(url, fill=qr_fill, back=qr_back)
    buf = BytesIO()
    qr_img.save(buf, format='PNG')
    buf.seek(0)
    c.drawImage(ImageReader(buf), x + margin, y + margin, width=qr_size, height=qr_size)

# ── POSITIONS ──
def get_positions():
    pos = []
    for row in range(ROWS):
        for col in range(COLS):
            x = MARGIN_X + col * (CARD_SIZE + CARD_GAP)
            y = PAGE_H - MARGIN_Y_TOP - (row + 1) * CARD_SIZE - row * CARD_GAP
            pos.append((x, y))
    return pos

# ── GENERATE SET ──
def generate(locs, prefix, title, city_bg, city_c, local_c, pill_bg, pill_tx,
             qr_bg, qr_fill, qr_back, is_german=False):
    pos = get_positions()
    out = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'
    pages = math.ceil(len(locs) / CARDS_PER_PAGE)

    # CITY PDF
    cp = os.path.join(out, f'{prefix}_CITY.pdf')
    cc = canvas.Canvas(cp, pagesize=A4)
    cc.setTitle(f"{title} — City")
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cc.showPage()
        x, y = pos[i % CARDS_PER_PAGE]
        local = LOCAL_NAMES.get(loc['city'], '')
        override = CITY_DE.get(loc['city'], '') if is_german else ''
        draw_city(cc, loc, x, y, city_bg, city_c, local_c, pill_bg, pill_tx,
                  local, override)
        draw_crop_marks(cc, x, y, CARD_SIZE, BLEED)
    cc.save()
    print(f"  ✅ {cp} ({pages}p)")

    # QR PDF — ONLY QR, no pill, no text
    qp = os.path.join(out, f'{prefix}_QR.pdf')
    cq = canvas.Canvas(qp, pagesize=A4)
    cq.setTitle(f"{title} — QR")
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cq.showPage()
        x, y = pos[i % CARDS_PER_PAGE]
        r, g, b = qr_bg
        draw_qr(cq, loc, x, y, r, g, b, qr_fill, qr_back)
        draw_crop_marks(cq, x, y, CARD_SIZE, BLEED)
    cq.save()
    print(f"  ✅ {qp} ({pages}p)")

    # COMBINED (mirrored backs)
    bp = os.path.join(out, f'{prefix}_COMBINED.pdf')
    cb = canvas.Canvas(bp, pagesize=A4)
    cb.setTitle(f"{title} — Combined")
    for page in range(pages):
        start = page * CARDS_PER_PAGE
        end = min(start + CARDS_PER_PAGE, len(locs))
        # City page
        for i in range(start, end):
            x, y = pos[(i - start) % CARDS_PER_PAGE]
            local = LOCAL_NAMES.get(locs[i]['city'], '')
            override = CITY_DE.get(locs[i]['city'], '') if is_german else ''
            draw_city(cb, locs[i], x, y, city_bg, city_c, local_c, pill_bg, pill_tx,
                      local, override)
            draw_crop_marks(cb, x, y, CARD_SIZE, BLEED)
        cb.showPage()
        # QR page (mirrored)
        for i in range(start, end):
            x, y = pos[(i - start) % CARDS_PER_PAGE]
            mx = PAGE_W - x - CARD_SIZE
            r, g, b = qr_bg
            draw_qr(cb, locs[i], mx, y, r, g, b, qr_fill, qr_back)
            draw_crop_marks(cb, mx, y, CARD_SIZE, BLEED)
        cb.showPage()
    cb.save()
    print(f"  ✅ {bp} ({pages*2}p)")

# ── MAIN ──
def main():
    locs = load_locations()
    print(f"Loaded {len(locs)} locations\n")

    print("🇬🇧 English (CI: #a6d700, #3340ca, #bdc2ff):")
    generate(locs, 'GEOCHECKR_EN', 'GeoCheckr EN',
             city_bg=EN_BG, city_c=EN_CITY, local_c=EN_LOCAL,
             pill_bg=EN_PILL_BG, pill_tx=EN_PILL_TX,
             qr_bg=EN_QR_BG, qr_fill=EN_QR_FILL, qr_back=EN_QR_BACK)

    print("\n🇩🇪 German (Logo: #262523, #f2a444, #d9593d):")
    generate(locs, 'GEOCHECKR_DE', 'GeoCheckr DE',
             city_bg=DE_BG, city_c=DE_CITY, local_c=DE_LOCAL,
             pill_bg=DE_PILL_BG, pill_tx=DE_PILL_TX,
             qr_bg=DE_QR_BG, qr_fill=DE_QR_FILL, qr_back=DE_QR_BACK,
             is_german=True)

    print(f"\n🎴 Done!")

if __name__ == '__main__':
    main()
