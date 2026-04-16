#!/usr/bin/env python3
"""
GeoCheckr Cards — CLEAN PDF (no bleed, no crop marks)
Generates Combined PDFs for DE and EN.

Colors extracted pixel-by-pixel from approved PDFs:
  EN: GEOCHECKR_CARDS_COMBINED_approved---eb97f6b3.pdf
  DE: GEOCHECKR_DE_COMBINED---bed42e8a.pdf
"""
import json, re, os, math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import qrcode
from io import BytesIO
from reportlab.lib.utils import ImageReader

CARD_SIZE = 6 * cm
PAGE_W, PAGE_H = A4
MARGIN_X = 15 * mm
MARGIN_Y_TOP = 20 * mm
COLS, ROWS = 3, 4
CARDS_PER_PAGE = 12
CARD_GAP = 3 * mm

# ── EXTRACTED COLOR SPECS (from approved PDFs) ──────────────────────────
# EN Card:  BG=#3340ca (dark blue), text=#ffffff (white),
#           local=#c6ff00 (yellow-green), pill BG=#111225, pill text=#c6ff00
#           Back BG=#3340ca, QR fill=#c6ff00, QR back=#3340ca
EN_BG       = (0x33/255, 0x40/255, 0xca/255)  # #3340ca
EN_TEXT     = (1, 1, 1)                          # #ffffff
EN_LOCAL    = (0xc6/255, 0xff/255, 0x00/255)    # #c6ff00
EN_PILL_BG  = (0x11/255, 0x12/255, 0x25/255)   # #111225
EN_PILL_TXT = (0xc6/255, 0xff/255, 0x00/255)    # #c6ff00
EN_QR_FILL  = '#c6ff00'
EN_QR_BACK  = '#3340ca'

# DE Card:  BG=#262523 (dark charcoal), city=#ffffff (white),
#           country=#f2a444 (orange), local/coords=#d9593d (red),
#           pill BG=#f2a444, pill text=#262523
#           Back BG=#f2a444, QR fill=#262523, QR back=#f2a444
DE_BG       = (0x26/255, 0x25/255, 0x23/255)   # #262523
DE_CITY     = (1, 1, 1)                          # #ffffff
DE_COUNTRY  = (0xf2/255, 0xa4/255, 0x44/255)    # #f2a444
DE_LOCAL    = (0xd9/255, 0x59/255, 0x3d/255)    # #d9593d
DE_PILL_BG  = (0xf2/255, 0xa4/255, 0x44/255)    # #f2a444
DE_PILL_TXT = (0x26/255, 0x25/255, 0x23/255)    # #262523
DE_QR_FILL  = '#262523'
DE_QR_BACK  = '#f2a444'

# ── FONTS ────────────────────────────────────────────────────────────────
FONT_DIR = '/tmp'
pdfmetrics.registerFont(TTFont('SG',  f'{FONT_DIR}/SpaceGrotesk-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SGB', f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NS',  f'{FONT_DIR}/NotoSans-Regular.ttf'))

# ── GERMAN TRANSLATIONS ─────────────────────────────────────────────────
GERMAN = {
    "France":"Frankreich","UK":"Großbritannien","Germany":"Deutschland","Italy":"Italien",
    "Spain":"Spanien","Netherlands":"Niederlande","Belgium":"Belgien","Austria":"Österreich",
    "Switzerland":"Schweiz","Poland":"Polen","Czech Republic":"Tschechien","Hungary":"Ungarn",
    "Romania":"Rumänien","Bulgaria":"Bulgarien","Greece":"Griechenland","Turkey":"Türkei",
    "Russia":"Russland","Ukraine":"Ukraine","Sweden":"Schweden","Norway":"Norwegen",
    "Denmark":"Dänemark","Finland":"Finnland","Iceland":"Island","Ireland":"Irland",
    "Portugal":"Portugal","Croatia":"Kroatien","Serbia":"Serbien","Japan":"Japan",
    "China":"China","South Korea":"Südkorea","India":"Indien","Thailand":"Thailand",
    "Vietnam":"Vietnam","Indonesia":"Indonesien","Philippines":"Philippinen",
    "Malaysia":"Malaysia","Singapore":"Singapur","Egypt":"Ägypten","Morocco":"Marokko",
    "Tunisia":"Tunesien","Algeria":"Algerien","South Africa":"Südafrika",
    "Nigeria":"Nigeria","Kenya":"Kenia","Tanzania":"Tansania","Ethiopia":"Äthiopien",
    "Ghana":"Ghana","Australia":"Australien","New Zealand":"Neuseeland","USA":"USA",
    "Canada":"Kanada","Mexico":"Mexiko","Brazil":"Brasilien","Argentina":"Argentinien",
    "Chile":"Chile","Colombia":"Kolumbien","Peru":"Peru","Venezuela":"Venezuela",
    "Ecuador":"Ecuador","Bolivia":"Bolivien","Cuba":"Kuba","Jamaica":"Jamaika",
    "Dominican Republic":"Dominikanische Republik","Saudi Arabia":"Saudi-Arabien",
    "Iran":"Iran","Iraq":"Irak","Israel":"Israel","Jordan":"Jordanien",
    "Lebanon":"Libanon","Syria":"Syrien","UAE":"Vereinigte Arabische Emirate",
    "Qatar":"Katar","Kuwait":"Kuwait","Pakistan":"Pakistan","Afghanistan":"Afghanistan",
    "Bangladesh":"Bangladesch","Nepal":"Nepal","Sri Lanka":"Sri Lanka","Myanmar":"Myanmar",
    "Cambodia":"Kambodscha","Laos":"Laos","Mongolia":"Mongolei","Georgia":"Georgien",
    "Armenia":"Armenien","Azerbaijan":"Aserbaidschan","Kazakhstan":"Kasachstan",
    "Uzbekistan":"Usbekistan","Slovenia":"Slowenien","Slovakia":"Slowakei",
    "Bosnia and Herzegovina":"Bosnien und Herzegowina","Montenegro":"Montenegro",
    "Albania":"Albanien","North Macedonia":"Nordmazedonien","Kosovo":"Kosovo",
    "Lithuania":"Litauen","Latvia":"Lettland","Estonia":"Estland",
    "Belarus":"Weißrussland","Moldova":"Moldau","Cameroon":"Kamerun",
    "DR Congo":"Demokratische Republik Kongo","Congo":"Kongo","Gabon":"Gabun",
    "Senegal":"Senegal","Mali":"Mali","Niger":"Niger","Chad":"Tschad",
    "Burkina Faso":"Burkina Faso","Guinea":"Guinea","Sierra Leone":"Sierra Leone",
    "Benin":"Benin","Togo":"Togo","Angola":"Angola","Zambia":"Sambia",
    "Zimbabwe":"Simbabwe","Mozambique":"Mosambik","Madagascar":"Madagaskar",
    "Malawi":"Malawi","Botswana":"Botswana","Namibia":"Namibia","Uganda":"Uganda",
    "Rwanda":"Ruanda","Libya":"Libyen","Sudan":"Sudan","Somalia":"Somalia",
    "Eritrea":"Eritrea","Liberia":"Liberia","Gambia":"Gambia","Djibouti":"Dschibuti",
    "Cape Verde":"Kap Verde","Costa Rica":"Costa Rica","Panama":"Panama",
    "Guatemala":"Guatemala","Honduras":"Honduras","El Salvador":"El Salvador",
    "Nicaragua":"Nicaragua","Haiti":"Haiti","Puerto Rico":"Puerto Rico",
    "Cyprus":"Zypern","Malta":"Malta","Luxembourg":"Luxemburg",
}

# ── LOCAL NAMES ──────────────────────────────────────────────────────────
LOCAL = {
    "Paris":"Paris","London":"London","Berlin":"Berlin","Rome":"Roma","Madrid":"Madrid",
    "Vienna":"Wien","Prague":"Praha","Budapest":"Budapest","Warsaw":"Warszawa",
    "Athens":"Αθήνα","Copenhagen":"København","Stockholm":"Stockholm","Oslo":"Oslo",
    "Helsinki":"Helsinki","Amsterdam":"Amsterdam","Brussels":"Brussel","Zurich":"Zürich",
    "Munich":"München","Milan":"Milano","Venice":"Venezia","Florence":"Firenze",
    "Naples":"Napoli","Barcelona":"Barcelona","Lisbon":"Lisboa","Porto":"Porto",
    "Dublin":"Dublin","Edinburgh":"Edinburgh","Reykjavik":"Reykjavik","Hamburg":"Hamburg",
    "Salzburg":"Salzburg","Krakow":"Kraków","Seville":"Sevilla","Ljubljana":"Ljubljana",
    "Bratislava":"Bratislava","Tallinn":"Tallinn","Riga":"Riga","Vilnius":"Vilnius",
    "Bucharest":"București","Sofia":"София","Belgrade":"Београд","Zagreb":"Zagreb",
    "Skopje":"Скопје","Montreal":"Montréal","Kiev":"Київ","Moscow":"Москва",
    "Tbilisi":"თბილისი","Yerevan":"Երևan","Tashkent":"Тошкент","Almaty":"Алматы",
    "Ulaanbaatar":"Улаанбаатар","Cairo":"Al-Qāhira","Marrakech":"Marrākesh",
    "Casablanca":"Dār al-Bayḍāʾ","Tunis":"Tūnis","Algiers":"Al-Jazāʾir",
    "Tripoli":"Ṭarābulus","Khartoum":"Al-Khurṭūm","Addis Ababa":"Āddīs Ābebā",
    "Asmara":"Asmara","Djibouti":"Jībūtī","Mogadishu":"Muqdisho","Tehran":"Tehrān",
    "Baghdad":"Baghdād","Dubai":"Dubayy","Doha":"Doha","Muscat":"Masqaṭ",
    "Kuwait City":"Al-Kuwayt","Riyadh":"Ar-Riyāḍ","Jerusalem":"Ūrshalīm",
    "Amman":"ʿAmmān","Beirut":"Bayrūt","Damascus":"Dimašq","Ankara":"Ankara",
    "Istanbul":"İstanbul","Baku":"Bakı","Bogota":"Bogotá","Bogotá":"Bogotá",
    "Cordoba":"Córdoba","Córdoba":"Córdoba","Sao Paulo":"São Paulo","São Paulo":"São Paulo",
    "Asuncion":"Asunción","Asunción":"Asunción","Medellin":"Medellín","Medellín":"Medellín",
    "Valparaiso":"Valparaíso","Valparaíso":"Valparaíso","Lome":"Lomé","Lomé":"Lomé",
    "Noumea":"Nouméa","Nouméa":"Nouméa","San Jose":"San José","San José":"San José",
    "Cusco":"Cusco","Guayaquil":"Guayaquil","Cartagena":"Cartagena",
    "Buenos Aires":"Buenos Aires","Rio de Janeiro":"Rio de Janeiro",
    "Ciudad de México":"Ciudad de México","La Habana":"La Habana",
    "Santo Domingo":"Santo Domingo","Sydney":"Sydney","Melbourne":"Melbourne",
    "Brisbane":"Brisbane","Perth":"Perth","Auckland":"Auckland","Wellington":"Wellington",
    "Jakarta":"Jakarta","Nairobi":"Nairobi","Dar es Salaam":"Dar es Salaam",
    "Mombasa":"Mombasa","Singapore":"Singapore","Kuala Lumpur":"Kuala Lumpur",
    "Bangkok":"Bangkok","Mumbai":"Mumbai","Delhi":"Delhi","Dhaka":"Dhaka",
    "Kathmandu":"Kathmandu","Colombo":"Colombo","Manila":"Manila","Hanoi":"Hanoi",
    "New York":"New York","Los Angeles":"Los Angeles","Chicago":"Chicago","Miami":"Miami",
    "San Francisco":"San Francisco","Boston":"Boston","Toronto":"Toronto",
    "Vancouver":"Vancouver","Lima":"Lima","Santiago":"Santiago",
    "Abidjan":"Abidjan","Accra":"Accra","Adelaide":"Adelaide","Anchorage":"Anchorage",
    "Antananarivo":"Antananarivo","Apia":"Apia","Bamako":"Bamako","Banjul":"Banjul",
    "Beijing":"北京","Bissau":"Bissau","Brazzaville":"Brazzaville",
    "Buenaventura":"Buenaventura","Busan":"부산","Cairns":"Cairns","Canberra":"Canberra",
    "Cape Town":"Cape Town","Caracas":"Caracas","Chiang Mai":"เชียงใหม่",
    "Christchurch":"Christchurch","Conakry":"Conakry","Curitiba":"Curitiba","Dakar":"Dakar",
    "Darwin":"Darwin","Denver":"Denver","Freetown":"Freetown","Gaborone":"Gaborone",
    "Georgetown":"Georgetown","Gold Coast":"Gold Coast","Guatemala City":"Guatemala City",
    "Harare":"Harare","Havana":"La Habana","Hobart":"Hobart","Hong Kong":"香港",
    "Honolulu":"Honolulu","Iquique":"Iquique","Islamabad":"اسلام آباد","Jaipur":"जयपुर",
    "Johannesburg":"Johannesburg","Kabul":"کابل","Kampala":"Kampala","Kigali":"Kigali",
    "Kingston":"Kingston","Kinshasa":"Kinshasa","Kochi":"कोच्चि","La Paz":"La Paz",
    "Lagos":"Lagos","Libreville":"Libreville","Luanda":"Luanda","Lusaka":"Lusaka",
    "Maputo":"Maputo","Mendoza":"Mendoza","Mexico City":"Ciudad de México",
    "Monrovia":"Monrovia","Montevideo":"Montevideo","Moroni":"Moroni",
    "N'Djamena":"N'Djamena","Nassau":"Nassau","New Orleans":"New Orleans",
    "Ngerulmud":"Ngerulmud","Niamey":"Niamey","Nuku'alofa":"Nuku'alofa",
    "Osaka":"大阪","Ouagadougou":"Ouagadougou","Panama City":"Ciudad de Panamá",
    "Paramaribo":"Paramaribo","Phnom Penh":"ភ្នំពេញ","Phoenix":"Phoenix",
    "Port Moresby":"Port Moresby","Praia":"Praia","Queenstown":"Queenstown",
    "Quito":"Quito","Salvador":"Salvador","San Juan":"San Juan","Sarajevo":"Sarajevo",
    "Seattle":"Seattle","Seoul":"서울","Shanghai":"上海","Sucre":"Sucre","Suva":"Suva",
    "Taipei":"台北","Tirana":"Tiranë","Tokyo":"東京","Vientiane":"ວຽງຈັນ",
    "Washington DC":"Washington, D.C.","Windhoek":"Windhoek","Yangon":"ရန်ကုန်",
    "Zanzibar":"Zanzibar",
}

# ── FUNCTIONS ────────────────────────────────────────────────────────────

def generate_qr(url, fill, back):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(url); qr.make(fit=True)
    return qr.make_image(fill_color=fill, back_color=back).convert('RGB')

def get_positions():
    return [(MARGIN_X + c*(CARD_SIZE+CARD_GAP), PAGE_H-MARGIN_Y_TOP-(r+1)*CARD_SIZE-r*CARD_GAP)
            for r in range(ROWS) for c in range(COLS)]

def draw_front(c, loc, x, y, lang):
    """Full card front: city, country, local name, coordinates, ID pill."""
    lid = f"{loc['id']:03d}"
    city = loc.get('city','')
    country = loc.get('country','')
    local = LOCAL.get(city, '')

    if lang == 'de':
        bg = DE_BG; cc = DE_CITY; ct_color = DE_COUNTRY; lc = DE_LOCAL
        pb = DE_PILL_BG; pt = DE_PILL_TXT
        ct = GERMAN.get(country, country)
    else:
        bg = EN_BG; cc = EN_TEXT; ct_color = EN_TEXT; lc = EN_LOCAL
        pb = EN_PILL_BG; pt = EN_PILL_TXT
        ct = country

    # Card background
    c.setFillColorRGB(*bg)
    c.rect(x, y, CARD_SIZE, CARD_SIZE, fill=1, stroke=0)

    # City name — bold, uppercase
    c.setFillColorRGB(*cc)
    fs = 16 if len(city) <= 10 else (14 if len(city) <= 14 else 11)
    c.setFont('SGB', fs)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.72, city.upper())

    # Country name
    c.setFillColorRGB(*ct_color)
    c.setFont('SG', 11)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.60, ct)

    # Local name (if different from city)
    if local and local != city:
        c.setFillColorRGB(*lc)
        c.setFont('NS', 9)
        c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.50, local)

    # Coordinates — white text (same as country)
    lat, lng = loc.get('lat',0), loc.get('lng',0)
    cs = f"{abs(lat):.2f}°{'N' if lat>=0 else 'S'}  {abs(lng):.2f}°{'E' if lng>=0 else 'W'}"
    if lang == 'de':
        coord_color = DE_LOCAL  # red for DE
    else:
        coord_color = EN_TEXT   # white for EN
    c.setFillColorRGB(*coord_color)
    c.setFont('SG', 8)
    c.drawCentredString(x + CARD_SIZE/2, y + CARD_SIZE*0.35, cs)

    # ID pill — rounded rect
    pw, ph, p = 44, 22, y + CARD_SIZE*0.12
    c.setFillColorRGB(*pb)
    c.roundRect(x + CARD_SIZE/2 - pw/2, p, pw, ph, 11, fill=1, stroke=0)
    c.setFillColorRGB(*pt)
    c.setFont('SGB', 11)
    c.drawCentredString(x + CARD_SIZE/2, p + 6, f"#{lid}")

def draw_back(c, loc, x, y, lang):
    """Card back: solid color + QR code."""
    lid = f"{loc['id']:03d}"
    if lang == 'de':
        bg = DE_BG; qf, qb = DE_QR_FILL, DE_QR_BACK
    else:
        bg = EN_BG; qf, qb = EN_QR_FILL, EN_QR_BACK

    c.setFillColorRGB(*bg)
    c.rect(x, y, CARD_SIZE, CARD_SIZE, fill=1, stroke=0)

    m, qs = 5*mm, CARD_SIZE - 10*mm
    img = generate_qr(f"https://geocheckr.app/play/{lid}", qf, qb)
    buf = BytesIO(); img.save(buf, format='PNG'); buf.seek(0)
    c.drawImage(ImageReader(buf), x + m, y + m, width=qs, height=qs)

def build_combined(lang, locs):
    out = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards/2026-03-31'
    os.makedirs(out, exist_ok=True)
    prefix = f'GEOCHECKR_{lang.upper()}'
    pos = get_positions()
    pages = math.ceil(len(locs) / CARDS_PER_PAGE)
    path = os.path.join(out, f'{prefix}_COMBINED.pdf')
    cc = rl_canvas.Canvas(path, pagesize=A4)
    cc.setTitle(f"{prefix} — Combined")

    for page in range(pages):
        s, e = page*CARDS_PER_PAGE, min((page+1)*CARDS_PER_PAGE, len(locs))
        # Front
        for i in range(s, e):
            draw_front(cc, locs[i], *pos[(i-s) % CARDS_PER_PAGE], lang)
        cc.showPage()
        # Back (mirrored horizontally)
        for i in range(s, e):
            bx, by = pos[(i-s) % CARDS_PER_PAGE]
            draw_back(cc, locs[i], PAGE_W - bx - CARD_SIZE, by, lang)
        cc.showPage()

    cc.save()
    print(f"  ✅ {path} ({len(locs)} cards, {pages*2} pages)")

def load_locations():
    with open('/home/donatello/.openclaw/workspace/GeoCheckr_App/src/data/panoramaLocations.ts') as f:
        content = f.read()
    m = re.search(r'export const panoramaLocations.*?=\s*(\[[\s\S]*?\]);', content)
    s = re.sub(r',\s*}', '}', re.sub(r',\s*]', ']', m.group(1)))
    return json.loads(s)

if __name__ == '__main__':
    locs = load_locations()
    print(f"Loaded {len(locs)} locations")
    missing = [l['city'] for l in locs if l['city'] not in LOCAL]
    if missing:
        print(f"⚠️  Missing LOCAL for: {', '.join(sorted(set(missing)))}")
    build_combined('en', locs)
    build_combined('de', locs)
    print("Done!")
