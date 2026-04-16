#!/usr/bin/env python3
"""
GeoCheckr — Edition PDF Generator
Reads JSON city data and generates clean combined PDFs.
Usage: python3 build_edition.py <json_file> <prefix> [--simple]
"""
import json, re, os, math, sys
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

EN_FRONT_BG = (0xbd/255, 0xc2/255, 0xff/255)
EN_QR_FILL, EN_QR_BACK = '#3340ca', '#bdc2ff'
DE_FRONT_BG = (0x26/255, 0x25/255, 0x23/255)
DE_QR_FILL, DE_QR_BACK = '#262523', '#f2a444'

FONT_DIR = '/tmp'
pdfmetrics.registerFont(TTFont('SG', f'{FONT_DIR}/SpaceGrotesk-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SGB', f'{FONT_DIR}/SpaceGrotesk-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NS', f'{FONT_DIR}/NotoSans-Regular.ttf'))

GERMAN = {
    "France":"Frankreich","UK":"Großbritannien","Germany":"Deutschland","Italy":"Italien",
    "Spain":"Spanien","Netherlands":"Niederlande","Belgium":"Belgien","Austria":"Österreich",
    "Switzerland":"Schweiz","Poland":"Polen","Czech Republic":"Tschechien","Hungary":"Ungarn",
    "Romania":"Rumänien","Bulgaria":"Bulgarien","Greece":"Griechenland","Turkey":"Türkei",
    "Russia":"Russland","Ukraine":"Ukraine","Sweden":"Schweden","Norway":"Norwegen",
    "Denmark":"Dänemark","Finland":"Finnland","Iceland":"Island","Ireland":"Irland",
    "Portugal":"Portugal","Croatia":"Kroatien","Serbia":"Serbien","Slovenia":"Slowenien",
    "Slovakia":"Slowakei","Bosnia and Herzegovina":"Bosnien und Herzegowina",
    "Montenegro":"Montenegro","Albania":"Albanien","North Macedonia":"Nordmazedonien",
    "Kosovo":"Kosovo","Lithuania":"Litauen","Latvia":"Lettland","Estonia":"Estland",
    "Belarus":"Weißrussland","Moldova":"Moldau","Cyprus":"Zypern","Malta":"Malta",
    "Luxembourg":"Luxemburg","Georgia":"Georgien","Armenia":"Armenien",
    "Azerbaijan":"Aserbaidschan","Japan":"Japan","China":"China","South Korea":"Südkorea",
    "India":"Indien","Thailand":"Thailand","Vietnam":"Vietnam","Indonesia":"Indonesien",
    "Philippines":"Philippinen","Malaysia":"Malaysia","Singapore":"Singapur",
    "Egypt":"Ägypten","Morocco":"Marokko","Tunisia":"Tunesien","Algeria":"Algerien",
    "South Africa":"Südafrika","Nigeria":"Nigeria","Kenya":"Kenia","Tanzania":"Tansania",
    "Ethiopia":"Äthiopien","Ghana":"Ghana","Australia":"Australien","New Zealand":"Neuseeland",
    "USA":"USA","Canada":"Kanada","Mexico":"Mexiko","Brazil":"Brasilien",
    "Argentina":"Argentinien","Chile":"Chile","Colombia":"Kolumbien","Peru":"Peru",
    "Venezuela":"Venezuela","Ecuador":"Ecuador","Bolivia":"Bolivien","Cuba":"Kuba",
    "Saudi Arabia":"Saudi-Arabien","Iran":"Iran","Iraq":"Irak","Israel":"Israel",
    "Jordan":"Jordanien","Lebanon":"Libanon","Syria":"Syrien",
    "UAE":"Vereinigte Arabische Emirate","Qatar":"Katar","Kuwait":"Kuwait",
    "Pakistan":"Pakistan","Afghanistan":"Afghanistan","Bangladesh":"Bangladesch",
    "Nepal":"Nepal","Sri Lanka":"Sri Lanka","Myanmar":"Myanmar","Cambodia":"Kambodscha",
    "Laos":"Laos","Mongolia":"Mongolei","Kazakhstan":"Kasachstan","Uzbekistan":"Usbekistan",
}

def generate_qr(url, fill, back):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(url); qr.make(fit=True)
    return qr.make_image(fill_color=fill, back_color=back).convert('RGB')

def get_positions():
    return [(MARGIN_X + c*(CARD_SIZE+CARD_GAP), PAGE_H-MARGIN_Y_TOP-(r+1)*CARD_SIZE-r*CARD_GAP)
            for r in range(ROWS) for c in range(COLS)]

def draw_front(c, loc, x, y, lang):
    lid = f"{loc['id']:03d}"
    city = loc['city']
    country = loc.get('country','')
    local = loc.get('local_name','')
    if lang == 'de':
        bg, cc, lc, pb, pt = DE_FRONT_BG, (0xf2/255,0xa4/255,0), (0xd9/255,0x59/255,0x3d/255), (0xf2/255,0xa4/255,0), (0x26/255,0x25/255,0x23/255)
        ct = GERMAN.get(country, country)
    else:
        bg, cc, lc, pb, pt = EN_FRONT_BG, (0xa6/255,0xd7/255,0), (0x33/255,0x40/255,0xca/255), (0x33/255,0x40/255,0xca/255), (0xa6/255,0xd7/255,0)
        ct = country
    c.setFillColorRGB(*bg); c.rect(x,y,CARD_SIZE,CARD_SIZE,fill=1,stroke=0)
    c.setFillColorRGB(*cc)
    fs = 16 if len(city)<=10 else (14 if len(city)<=14 else 11)
    c.setFont('SGB',fs); c.drawCentredString(x+CARD_SIZE/2, y+CARD_SIZE*0.72, city.upper())
    c.setFillColorRGB(1,1,1); c.setFont('SG',11)
    c.drawCentredString(x+CARD_SIZE/2, y+CARD_SIZE*0.60, ct)
    if local and local != city:
        c.setFillColorRGB(*lc); c.setFont('NS',9)
        c.drawCentredString(x+CARD_SIZE/2, y+CARD_SIZE*0.50, local)
    lat,lng = loc.get('lat',0), loc.get('lng',0)
    cs = f"{abs(lat):.2f}°{'N' if lat>=0 else 'S'}  {abs(lng):.2f}°{'E' if lng>=0 else 'W'}"
    c.setFillColorRGB(*lc); c.setFont('SG',8)
    c.drawCentredString(x+CARD_SIZE/2, y+CARD_SIZE*0.35, cs)
    c.setFillColorRGB(*pb)
    pw,ph,p = 44,22, y+CARD_SIZE*0.12
    c.roundRect(x+CARD_SIZE/2-pw/2,p,pw,ph,11,fill=1,stroke=0)
    c.setFillColorRGB(*pt); c.setFont('SGB',11)
    c.drawCentredString(x+CARD_SIZE/2, p+6, f"#{lid}")

def draw_front_simple(c, loc, x, y, lang):
    lid = f"{loc['id']:03d}"; city = loc['city']
    if lang == 'de':
        bg, cc, pb, pt, lc = DE_FRONT_BG, (0xf2/255,0xa4/255,0), (0xf2/255,0xa4/255,0), (0x26/255,0x25/255,0x23/255), (0xd9/255,0x59/255,0x3d/255)
    else:
        bg, cc, pb, pt, lc = EN_FRONT_BG, (0xa6/255,0xd7/255,0), (0x33/255,0x40/255,0xca/255), (0xa6/255,0xd7/255,0), (0x33/255,0x40/255,0xca/255)
    c.setFillColorRGB(*bg); c.rect(x,y,CARD_SIZE,CARD_SIZE,fill=1,stroke=0)
    c.setFillColorRGB(*cc)
    fs = 20 if len(city)<=10 else (16 if len(city)<=14 else 12)
    c.setFont('SGB',fs); c.drawCentredString(x+CARD_SIZE/2, y+CARD_SIZE*0.68, city.upper())
    lat,lng = loc.get('lat',0), loc.get('lng',0)
    cs = f"{abs(lat):.2f}°{'N' if lat>=0 else 'S'}  {abs(lng):.2f}°{'E' if lng>=0 else 'W'}"
    c.setFillColorRGB(*lc); c.setFont('SG',8)
    c.drawCentredString(x+CARD_SIZE/2, y+CARD_SIZE*0.42, cs)
    c.setFillColorRGB(*pb)
    pw,ph,p = 44,22, y+CARD_SIZE*0.15
    c.roundRect(x+CARD_SIZE/2-pw/2,p,pw,ph,11,fill=1,stroke=0)
    c.setFillColorRGB(*pt); c.setFont('SGB',11)
    c.drawCentredString(x+CARD_SIZE/2, p+6, f"#{lid}")

def draw_back(c, loc, x, y, lang):
    lid = f"{loc['id']:03d}"
    bg = (0xf2/255,0xa4/255,0) if lang=='de' else (0xbd/255,0xc2/255,0xff/255)
    qf, qb = (DE_QR_FILL, DE_QR_BACK) if lang=='de' else (EN_QR_FILL, EN_QR_BACK)
    c.setFillColorRGB(*bg); c.rect(x,y,CARD_SIZE,CARD_SIZE,fill=1,stroke=0)
    m, qs = 5*mm, CARD_SIZE-10*mm
    img = generate_qr(f"https://geocheckr.app/play/{lid}", qf, qb)
    buf = BytesIO(); img.save(buf,format='PNG'); buf.seek(0)
    c.drawImage(ImageReader(buf), x+m, y+m, width=qs, height=qs)

def build_pdf(locs, out_path, lang='en', simple=False):
    pos = get_positions()
    pages = math.ceil(len(locs)/CARDS_PER_PAGE)
    cc = rl_canvas.Canvas(out_path, pagesize=A4)
    dfn = draw_front_simple if simple else draw_front
    for page in range(pages):
        s,e = page*CARDS_PER_PAGE, min((page+1)*CARDS_PER_PAGE, len(locs))
        for i in range(s,e): dfn(cc, locs[i], *pos[(i-s)%CARDS_PER_PAGE], lang)
        cc.showPage()
        for i in range(s,e):
            x,y = pos[(i-s)%CARDS_PER_PAGE]
            draw_back(cc, locs[i], PAGE_W-x-CARD_SIZE, y, lang)
        cc.showPage()
    cc.save()
    print(f"  ✅ {out_path} ({len(locs)} cards, {pages*2} pages)")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 build_edition.py <json_file> <output.pdf> [en|de] [--simple]")
        sys.exit(1)
    json_file = sys.argv[1]
    out_path = sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else 'en'
    simple = '--simple' in sys.argv
    with open(json_file) as f:
        locs = json.load(f)
    print(f"Loaded {len(locs)} locations from {json_file}")
    build_pdf(locs, out_path, lang, simple)
