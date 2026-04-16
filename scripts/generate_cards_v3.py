#!/usr/bin/env python3
"""
GeoCheckr Cards — NEW Design (3 CI Colors Only)
#a6d700, #3340ca, #bdc2ff — no other colors
2mm bleed per card + crop marks
Generates English and German versions
"""

import json, re, os, sys, math
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
MARGIN_Y_BOT = 15 * mm

# ── ONLY 3 CI COLORS ──
C_GREEN = (0xa6/255, 0xd7/255, 0x00/255)    # #a6d700 — Primary
C_BLUE  = (0x33/255, 0x40/255, 0xca/255)    # #3340ca — Secondary
C_LBLUE = (0xbd/255, 0xc2/255, 0xff/255)    # #bdc2ff — Accent

C_CROP = (0.3, 0.3, 0.3)  # dark gray crop marks

# Grid
COLS = 3
ROWS = 4
CARDS_PER_PAGE = COLS * ROWS
CARD_GAP = 2 * mm

# ── FONTS ──
FONT_DIR = '/tmp'
pdfmetrics.registerFont(TTFont('SpaceGrotesk', f'{FONT_DIR}/SpaceGrotesk-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SpaceGrotesk-Bold', f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'))

# Script-specific fonts for local names
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
        if 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF:
            if 'NotoSansSC' in SCRIPT_FONTS: return 'NotoSansSC'
        if 0x3040 <= cp <= 0x30FF:
            if 'NotoSansSC' in SCRIPT_FONTS: return 'NotoSansSC'
        if 0xAC00 <= cp <= 0xD7AF:
            if 'NotoSansSC' in SCRIPT_FONTS: return 'NotoSansSC'
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
    return 'SpaceGrotesk'  # fallback — CJK chars won't render but won't crash

# ── LOCAL NAMES (English version) ──
LOCAL_NAMES_EN = {
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

# ── GERMAN CITY NAMES ──
CITY_NAMES_DE = {
    "Vienna":"Wien","Rome":"Rom","Munich":"München","Moscow":"Moskau",
    "Prague":"Prag","Warsaw":"Warschau","Copenhagen":"Kopenhagen",
    "Budapest":"Budapest","Athens":"Athen","Lisbon":"Lissabon",
    "Belgrade":"Belgrad","Bucharest":"Bukarest","Sofia":"Sofia",
    "Kyiv":"Kiew","Saint Petersburg":"Sankt Petersburg",
    "Hamburg":"Hamburg","Salzburg":"Salzburg",
}

# ── GERMAN COUNTRY NAMES ──
GERMAN_COUNTRIES = {
    "France":"Frankreich","UK":"Großbritannien","Germany":"Deutschland",
    "Italy":"Italien","Spain":"Spanien","Netherlands":"Niederlande",
    "Belgium":"Belgien","Austria":"Österreich","Switzerland":"Schweiz",
    "Poland":"Polen","Czech Republic":"Tschechien","Hungary":"Ungarn",
    "Romania":"Rumänien","Bulgaria":"Bulgarien","Greece":"Griechenland",
    "Turkey":"Türkei","Russia":"Russland","Sweden":"Schweden",
    "Norway":"Norwegen","Denmark":"Dänemark","Finland":"Finnland",
    "Iceland":"Island","Ireland":"Irland","Portugal":"Portugal",
    "Croatia":"Kroatien","Serbia":"Serbien","Slovenia":"Slowenien",
    "Slovakia":"Slowakei","Lithuania":"Litauen","Latvia":"Lettland",
    "Estonia":"Estland","Georgia":"Georgien","Armenia":"Armenien",
    "Japan":"Japan","China":"China","South Korea":"Südkorea",
    "India":"Indien","Thailand":"Thailand","Vietnam":"Vietnam",
    "Indonesia":"Indonesien","Philippines":"Philippinen",
    "Malaysia":"Malaysia","Singapore":"Singapur","Cambodia":"Kambodscha",
    "Egypt":"Ägypten","Morocco":"Marokko","Tunisia":"Tunesien",
    "Kenya":"Kenia","Tanzania":"Tansania","South Africa":"Südafrika",
    "Nigeria":"Nigeria","Ghana":"Ghana","Ethiopia":"Äthiopien",
    "Australia":"Australien","New Zealand":"Neuseeland",
    "USA":"USA","Canada":"Kanada","Mexico":"Mexiko",
    "Brazil":"Brasilien","Argentina":"Argentinien","Chile":"Chile",
    "Colombia":"Kolumbien","Peru":"Peru","Venezuela":"Venezuela",
    "Ecuador":"Ecuador","Bolivia":"Bolivien","Paraguay":"Paraguay",
    "Uruguay":"Uruguay","Cuba":"Kuba","Jamaica":"Jamaika",
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

# ── QR CODE ──
def generate_qr(data, fill_color, back_color):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color=fill_color, back_color=back_color).convert('RGB')

# ── CROP MARKS ──
def draw_crop_marks(c, x, y, size, bleed):
    c.setStrokeColor(C_CROP)
    c.setLineWidth(0.3)
    mark_len = 3 * mm
    mark_gap = 0.5 * mm

    bx0, by0 = x - bleed, y - bleed
    bx1, by1 = x + size + bleed, y + size + bleed

    # Top-left
    c.line(bx0 - mark_gap, by1, bx0 - mark_gap - mark_len, by1)
    c.line(bx0, by1 + mark_gap, bx0, by1 + mark_gap + mark_len)
    # Top-right
    c.line(bx1 + mark_gap, by1, bx1 + mark_gap + mark_len, by1)
    c.line(bx1, by1 + mark_gap, bx1, by1 + mark_gap + mark_len)
    # Bottom-left
    c.line(bx0 - mark_gap, by0, bx0 - mark_gap - mark_len, by0)
    c.line(bx0, by0 - mark_gap, bx0, by0 - mark_gap - mark_len)
    # Bottom-right
    c.line(bx1 + mark_gap, by0, bx1 + mark_gap + mark_len, by0)
    c.line(bx1, by0 - mark_gap, bx1, by0 - mark_gap - mark_len)

# ── DRAW CITY SIDE ──
def draw_city(c, loc, card_x, card_y, local_name, use_german_countries=False):
    """Draw CITY NAME side: #bdc2ff bg, #a6d700 city, #3340ca local, pill #3340ca/#a6d700"""
    lid = f"{loc['id']:03d}"
    city_en = loc['city']

    # Bleed background — #bdc2ff
    c.setFillColorRGB(*C_LBLUE)
    c.rect(card_x - BLEED, card_y - BLEED,
           CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # City name — #a6d700, centered upper half
    city_display = CITY_NAMES_DE.get(city_en, city_en) if use_german_countries else city_en
    font_size = 21 if len(city_display) <= 12 else (18 if len(city_display) <= 16 else 15)
    c.setFillColorRGB(*C_GREEN)
    c.setFont('SpaceGrotesk-Bold', font_size)
    c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.58, city_display)

    # Local name — #3340ca, below city
    if local_name and local_name != city_display:
        local_font = get_local_font(local_name)
        # Skip local name if no suitable font is registered (e.g. CJK)
        if local_font == 'SpaceGrotesk':
            # Check if SpaceGrotesk can render the chars
            can_render = all(ord(ch) < 0x4E00 or ord(ch) > 0x9FFF for ch in local_name)
            if not can_render:
                local_name = ''  # skip CJK local names without font
        if local_name:
            local_size = 16 if len(local_name) <= 8 else 13
            c.setFillColorRGB(*C_BLUE)
            c.setFont(local_font, local_size)
            c.drawCentredString(card_x + CARD_SIZE/2, card_y + CARD_SIZE*0.44, local_name)

    # Number pill — #3340ca bg, #a6d700 text
    pill_w, pill_h = 44, 22
    pill_x = card_x + CARD_SIZE/2 - pill_w/2
    pill_y = card_y + CARD_SIZE*0.18
    c.setFillColorRGB(*C_BLUE)
    c.roundRect(pill_x, pill_y, pill_w, pill_h, 11, fill=1, stroke=0)
    c.setFillColorRGB(*C_GREEN)
    c.setFont('SpaceGrotesk-Bold', 14)
    c.drawCentredString(card_x + CARD_SIZE/2, pill_y + 6, f"#{lid}")

# ── DRAW QR SIDE ──
def draw_qr(c, loc, card_x, card_y):
    """Draw QR CODE side: #a6d700 bg, #bdc2ff QR — nothing else"""
    lid = f"{loc['id']:03d}"

    # Bleed background — #a6d700
    c.setFillColorRGB(*C_GREEN)
    c.rect(card_x - BLEED, card_y - BLEED,
           CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)

    # QR code — #bdc2ff modules on #a6d700 bg, 8mm margin
    margin = 8 * mm
    qr_size = CARD_SIZE - 2 * margin
    url = f"https://geocheckr.app/play/{lid}"
    qr_img = generate_qr(url, fill_color="#bdc2ff", back_color="#a6d700")

    buf = BytesIO()
    qr_img.save(buf, format='PNG')
    buf.seek(0)
    c.drawImage(ImageReader(buf), card_x + margin, card_y + margin,
                width=qr_size, height=qr_size)

# ── POSITIONS ──
def get_card_positions():
    positions = []
    for row in range(ROWS):
        for col in range(COLS):
            x = MARGIN_X + col * (CARD_SIZE + CARD_GAP)
            y = PAGE_H - MARGIN_Y_TOP - (row + 1) * CARD_SIZE - row * CARD_GAP
            positions.append((x, y))
    return positions

# ── GENERATE PDF SET ──
def generate_pdf_set(locs, local_names, out_prefix, title_prefix, use_german_countries=False):
    positions = get_card_positions()
    out_dir = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'
    pages = math.ceil(len(locs) / CARDS_PER_PAGE)

    # ── CITY PDF ──
    city_path = os.path.join(out_dir, f'{out_prefix}_CITY.pdf')
    cc = canvas.Canvas(city_path, pagesize=A4)
    cc.setTitle(f"{title_prefix} — City Side")
    cc.setAuthor("GeoCheckr")

    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0:
            cc.showPage()
        x, y = positions[i % CARDS_PER_PAGE]
        local = local_names.get(loc['city'], '')
        draw_city(cc, loc, x, y, local, use_german_countries)
        draw_crop_marks(cc, x, y, CARD_SIZE, BLEED)
    cc.save()
    print(f"  ✅ {city_path} ({pages} pages)")

    # ── QR PDF ──
    qr_path = os.path.join(out_dir, f'{out_prefix}_QR.pdf')
    cq = canvas.Canvas(qr_path, pagesize=A4)
    cq.setTitle(f"{title_prefix} — QR Side")
    cq.setAuthor("GeoCheckr")

    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0:
            cq.showPage()
        x, y = positions[i % CARDS_PER_PAGE]
        draw_qr(cq, loc, x, y)
        draw_crop_marks(cq, x, y, CARD_SIZE, BLEED)
    cq.save()
    print(f"  ✅ {qr_path} ({pages} pages)")

    # ── COMBINED (mirrored backs) ──
    combined_path = os.path.join(out_dir, f'{out_prefix}_COMBINED.pdf')
    cb = canvas.Canvas(combined_path, pagesize=A4)
    cb.setTitle(f"{title_prefix} — Combined")
    cb.setAuthor("GeoCheckr")

    for page in range(pages):
        start = page * CARDS_PER_PAGE
        end = min(start + CARDS_PER_PAGE, len(locs))

        # City page
        for i in range(start, end):
            pos_idx = (i - start) % CARDS_PER_PAGE
            x, y = positions[pos_idx]
            local = local_names.get(locs[i]['city'], '')
            draw_city(cb, locs[i], x, y, local, use_german_countries)
            draw_crop_marks(cb, x, y, CARD_SIZE, BLEED)
        cb.showPage()

        # QR page (mirrored)
        for i in range(start, end):
            pos_idx = (i - start) % CARDS_PER_PAGE
            x, y = positions[pos_idx]
            mx = PAGE_W - x - CARD_SIZE
            draw_qr(cb, locs[i], mx, y)
            draw_crop_marks(cb, mx, y, CARD_SIZE, BLEED)
        cb.showPage()

    cb.save()
    print(f"  ✅ {combined_path} ({pages*2} pages)")

# ── MAIN ──
def main():
    locs = load_locations()
    print(f"Loaded {len(locs)} locations\n")

    out_dir = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'
    os.makedirs(out_dir, exist_ok=True)

    # ── ENGLISH ──
    print("🇬🇧 English Cards:")
    generate_pdf_set(locs, LOCAL_NAMES_EN, 'GEOCHECKR_EN', 'GeoCheckr Cards (EN)')

    # ── GERMAN ──
    print("\n🇩🇪 German Cards:")
    # German: use German city names where different, same local names
    generate_pdf_set(locs, LOCAL_NAMES_EN, 'GEOCHECKR_DE', 'GeoCheckr Karten (DE)',
                     use_german_countries=True)

    print(f"\n🎴 Done! 3 CI colors only: #a6d700, #3340ca, #bdc2ff")
    print(f"   2mm bleed per card + crop marks")

if __name__ == '__main__':
    main()
