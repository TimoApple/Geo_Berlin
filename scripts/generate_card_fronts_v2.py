#!/usr/bin/env python3
"""
GeoCheckr Cards — IMAGE GENERATOR (Step 1)
Generates high-res PNG card fronts for all cities.
EN: #3340ca bg, #c6ff00 city, #0a0b1f local
DE: #262523 bg, #f2a444 city, #d9593d local
"""
import json, re, os, sys
from PIL import Image, ImageDraw, ImageFont

CARD_PX = 708  # 6cm at 300 DPI
DPI = 300

# ── EN COLORS (Timo's spec) ──
EN_BG = (0xbd, 0xc2, 0xff)  # #bdc2ff
EN_CITY = (0xa6, 0xd7, 0x00)  # #a6d700
EN_LOCAL = (0x33, 0x40, 0xca)  # #3340ca
EN_PILL_BG = (0x33, 0x40, 0xca)  # #3340ca
EN_PILL_TX = (0xa6, 0xd7, 0x00)  # #a6d700

# ── DE COLORS (logo) ──
DE_BG = (0x26, 0x25, 0x23)
DE_CITY = (0xf2, 0xa4, 0x44)
DE_LOCAL = (0xd9, 0x59, 0x3d)
DE_PILL_BG = (0xf2, 0xa4, 0x44)
DE_PILL_TX = (0x26, 0x25, 0x23)

# ── FONTS ──
FONT_DIR = '/tmp'
SYS_FONT = '/usr/share/fonts/truetype/noto'
OT_FONT = '/usr/share/fonts/opentype/noto'

FONT_SG_BOLD = f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'

SCRIPT_FONTS = {
    'latin': f'{SYS_FONT}/NotoSans-Bold.ttf',
    'arabic': f'{SYS_FONT}/NotoSansArabic-Bold.ttf',
    'devanagari': f'{SYS_FONT}/NotoSansDevanagari-Bold.ttf',
    'bengali': f'{SYS_FONT}/NotoSansBengali-Bold.ttf',
    'thai': f'{SYS_FONT}/NotoSansThai-Bold.ttf',
    'lao': f'{SYS_FONT}/NotoSansLao-Bold.ttf',
    'hebrew': f'{SYS_FONT}/NotoSansHebrew-Bold.ttf',
    'georgian': f'{SYS_FONT}/NotoSansGeorgian-Regular.ttf',
    'armenian': f'{SYS_FONT}/NotoSansArmenian-Regular.ttf',
    'ethiopic': f'{SYS_FONT}/NotoSansEthiopic-Regular.ttf',
    'telugu': f'{SYS_FONT}/NotoSansTelugu-Regular.ttf',
    'gujarati': f'{SYS_FONT}/NotoSansGujarati-Regular.ttf',
    'tamil': f'{SYS_FONT}/NotoSansTamil-Regular.ttf',
    'khmer': f'{SYS_FONT}/NotoSansKhmer-Bold.ttf',
    'myanmar': f'{SYS_FONT}/NotoSansMyanmar-Regular.ttf',
    'sinhala': f'{SYS_FONT}/NotoSansSinhala-Regular.ttf',
    'cjk': f'{OT_FONT}/NotoSerifCJK-Bold.ttc',
    'korean': f'{OT_FONT}/NotoSerifCJK-Bold.ttc',
}

_fonts = {}
def get_font(path, size):
    key = f"{path}_{size}"
    if key not in _fonts:
        try:
            _fonts[key] = ImageFont.truetype(path, size)
        except:
            _fonts[key] = ImageFont.load_default()
    return _fonts[key]

def get_script_font(text):
    for ch in text:
        cp = ord(ch)
        if 0xAC00 <= cp <= 0xD7AF:
            p = SCRIPT_FONTS.get('korean', '')
            if os.path.exists(p): return p
        if 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or 0xF900 <= cp <= 0xFAFF:
            p = SCRIPT_FONTS.get('cjk', '')
            if os.path.exists(p): return p
        if 0x3040 <= cp <= 0x309F or 0x30A0 <= cp <= 0x30FF:
            p = SCRIPT_FONTS.get('cjk', '')
            if os.path.exists(p): return p
        if 0x0600 <= cp <= 0x06FF or 0xFB50 <= cp <= 0xFDFF:
            p = SCRIPT_FONTS.get('arabic', '')
            if os.path.exists(p): return p
        if 0x0900 <= cp <= 0x097F:
            p = SCRIPT_FONTS.get('devanagari', '')
            if os.path.exists(p): return p
        if 0x0980 <= cp <= 0x09FF:
            p = SCRIPT_FONTS.get('bengali', '')
            if os.path.exists(p): return p
        if 0x0E80 <= cp <= 0x0EFF:
            p = SCRIPT_FONTS.get('lao', '')
            if os.path.exists(p): return p
        if 0x0E00 <= cp <= 0x0E7F:
            p = SCRIPT_FONTS.get('thai', '')
            if os.path.exists(p): return p
        if 0x0590 <= cp <= 0x05FF:
            p = SCRIPT_FONTS.get('hebrew', '')
            if os.path.exists(p): return p
        if 0x10A0 <= cp <= 0x10FF:
            p = SCRIPT_FONTS.get('georgian', '')
            if os.path.exists(p): return p
        if 0x0530 <= cp <= 0x058F:
            p = SCRIPT_FONTS.get('armenian', '')
            if os.path.exists(p): return p
        if 0x1200 <= cp <= 0x137F:
            p = SCRIPT_FONTS.get('ethiopic', '')
            if os.path.exists(p): return p
        if 0x0C00 <= cp <= 0x0C7F:
            p = SCRIPT_FONTS.get('telugu', '')
            if os.path.exists(p): return p
        if 0x0A80 <= cp <= 0x0AFF:
            p = SCRIPT_FONTS.get('gujarati', '')
            if os.path.exists(p): return p
        if 0x0B80 <= cp <= 0x0BFF:
            p = SCRIPT_FONTS.get('tamil', '')
            if os.path.exists(p): return p
        if 0x1780 <= cp <= 0x17FF:
            p = SCRIPT_FONTS.get('khmer', '')
            if os.path.exists(p): return p
        if 0x1000 <= cp <= 0x109F:
            p = SCRIPT_FONTS.get('myanmar', '')
            if os.path.exists(p): return p
        if 0x0D80 <= cp <= 0x0DFF:
            p = SCRIPT_FONTS.get('sinhala', '')
            if os.path.exists(p): return p
    return SCRIPT_FONTS['latin']

# ── LOCAL NAMES (from original script) ──
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
    "Riga":"Rīga","Vilnius":"Vilnius","Tbilisi":"თბილისი","Yerevan":"Երևაն",
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

# DE city name overrides
CITY_DE = {
    "Vienna":"Wien","Rome":"Rom","Munich":"München","Moscow":"Moskau",
    "Prague":"Prag","Warsaw":"Warschau","Copenhagen":"Kopenhagen",
    "Athens":"Athen","Lisbon":"Lissabon","Belgrade":"Belgrad",
    "Bucharest":"Bukarest","Kyiv":"Kiew","Saint Petersburg":"Sankt Petersburg",
}

def generate_front(loc, out_path, bg, city_c, local_c, pill_bg, pill_tx, is_german=False):
    """Generate a single card front PNG — EXACTLY matching approved design."""
    city = CITY_DE.get(loc['city'], loc['city']) if is_german else loc['city']
    local = LOCAL_NAMES.get(loc['city'], loc['city'])
    lid = f"{loc['id']:03d}"

    img = Image.new('RGBA', (CARD_PX, CARD_PX), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background
    draw.rectangle([0, 0, CARD_PX, CARD_PX], fill=bg)

    # City name — Space Grotesk Bold
    city_size = 74 if len(city) <= 10 else (63 if len(city) <= 14 else 56)
    city_font = get_font(FONT_SG_BOLD, city_size)
    bbox = draw.textbbox((0, 0), city, font=city_font)
    tw = bbox[2] - bbox[0]
    while tw > CARD_PX * 0.9 and city_size > 20:
        city_size -= 2
        city_font = get_font(FONT_SG_BOLD, city_size)
        bbox = draw.textbbox((0, 0), city, font=city_font)
        tw = bbox[2] - bbox[0]
    city_x = (CARD_PX - tw) / 2
    city_y = CARD_PX * 0.30
    draw.text((city_x, city_y), city, fill=city_c, font=city_font)

    # Local name — script-specific font
    if local != city:
        local_font_path = get_script_font(local)
        local_size = 74 if len(local) <= 10 else (56 if len(local) <= 14 else 48)
        local_font = get_font(local_font_path, local_size)
        bbox2 = draw.textbbox((0, 0), local, font=local_font)
        lw = bbox2[2] - bbox2[0]
        while lw > CARD_PX * 0.9 and local_size > 20:
            local_size -= 2
            local_font = get_font(local_font_path, local_size)
            bbox2 = draw.textbbox((0, 0), local, font=local_font)
            lw = bbox2[2] - bbox2[0]
        local_x = (CARD_PX - lw) / 2
        local_y = city_y + city_size + 10
        draw.text((local_x, local_y), local, fill=local_c, font=local_font)

    # ID badge — small pill, perfectly centered
    badge_text = f"#{lid}"
    badge_font = get_font(FONT_SG_BOLD, 22)
    tw = draw.textlength(badge_text, font=badge_font)
    bth = 28
    pad_x = 22
    pad_y = 10
    badge_w = int(tw) + 2 * pad_x
    badge_h = bth + 2 * pad_y
    badge_x = (CARD_PX - badge_w) / 2
    badge_y = CARD_PX - 75
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
                          radius=badge_h // 2, fill=pill_bg)
    center_x = badge_x + badge_w / 2
    center_y = badge_y + badge_h / 2
    draw.text((center_x, center_y), badge_text, fill=pill_tx, font=badge_font, anchor="mm")

    img.save(out_path, 'PNG', dpi=(DPI, DPI))

def load_locations():
    with open('/home/donatello/.openclaw/workspace/GeoCheckr_App/src/data/panoramaLocations.ts') as f:
        content = f.read()
    match = re.search(r'export const panoramaLocations.*?=\s*(\[[\s\S]*?\]);', content)
    arr_str = match.group(1)
    arr_str = re.sub(r',\s*}', '}', arr_str)
    arr_str = re.sub(r',\s*]', ']', arr_str)
    return json.loads(arr_str)

def main():
    lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
    locs = load_locations()
    out_dir = f'/tmp/card_fronts_{lang}'
    os.makedirs(out_dir, exist_ok=True)

    if lang == 'de':
        bg, city_c, local_c, pill_bg, pill_tx = DE_BG, DE_CITY, DE_LOCAL, DE_PILL_BG, DE_PILL_TX
        is_german = True
    else:
        bg, city_c, local_c, pill_bg, pill_tx = EN_BG, EN_CITY, EN_LOCAL, EN_PILL_BG, EN_PILL_TX
        is_german = False

    for loc in locs:
        lid = f"{loc['id']:03d}"
        out_path = os.path.join(out_dir, f"front_{lid}.png")
        generate_front(loc, out_path, bg, city_c, local_c, pill_bg, pill_tx, is_german)
        if loc['id'] % 50 == 0:
            print(f"  [{lang.upper()}] Generated {loc['id']}/205...")

    print(f"✅ [{lang.upper()}] {len(locs)} fronts in {out_dir}")

if __name__ == '__main__':
    main()
