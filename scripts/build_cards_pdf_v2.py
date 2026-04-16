#!/usr/bin/env python3
"""
GeoCheckr Cards — PDF BUILDER (Step 2)
Embeds pre-generated PNGs into A4 PDFs with 2mm bleed + crop marks.
EN: front bg #3340ca, back bg #c6ff00
DE: front bg #262523, back bg #f2a444
"""
import json, re, os, sys, math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas as rl_canvas
import qrcode
from io import BytesIO
from reportlab.lib.utils import ImageReader

CARD_SIZE = 6 * cm
BLEED = 2 * mm
PAGE_W, PAGE_H = A4
MARGIN_X = 15 * mm
MARGIN_Y_TOP = 20 * mm
MARGIN_Y_BOT = 15 * mm
COLS = 3
ROWS = 4
CARDS_PER_PAGE = 12
CARD_GAP = 2 * mm
CROP_COLOR = (0.3, 0.3, 0.3)

# ── EN COLORS (Timo's spec) ──
EN_FRONT_BG = (0xbd/255, 0xc2/255, 0xff/255)  # #bdc2ff
EN_BACK_BG = (0xbd/255, 0xc2/255, 0xff/255)  # #bdc2ff
EN_QR_FILL = '#3340ca'
EN_QR_BACK = '#bdc2ff'

# ── DE COLORS ──
DE_FRONT_BG = (0x26/255, 0x25/255, 0x23/255)
DE_BACK_BG = (0xf2/255, 0xa4/255, 0x44/255)
DE_QR_FILL = '#262523'
DE_QR_BACK = '#f2a444'

def generate_qr(url, fill, back):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color=fill, back_color=back).convert('RGB')

def get_positions():
    pos = []
    for row in range(ROWS):
        for col in range(COLS):
            x = MARGIN_X + col * (CARD_SIZE + CARD_GAP)
            y = PAGE_H - MARGIN_Y_TOP - (row + 1) * CARD_SIZE - row * CARD_GAP
            pos.append((x, y))
    return pos

def draw_crop_marks(c, x, y, size, bleed):
    c.setStrokeColor(CROP_COLOR)
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

def build_pdf(lang, locs):
    front_dir = f'/tmp/card_fronts_{lang}'
    out = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'
    prefix = f'GEOCHECKR_{lang.upper()}'

    if lang == 'de':
        front_bg = DE_FRONT_BG
        back_bg = DE_BACK_BG
        qr_fill, qr_back = DE_QR_FILL, DE_QR_BACK
        has_back_pill = False  # DE: no pill on back
    else:
        front_bg = EN_FRONT_BG
        back_bg = EN_BACK_BG
        qr_fill, qr_back = EN_QR_FILL, EN_QR_BACK
        has_back_pill = True  # EN: pill on back

    pos = get_positions()
    pages = math.ceil(len(locs) / CARDS_PER_PAGE)

    # FRONT PDF (City)
    front_path = os.path.join(out, f'{prefix}_FRONT.pdf')
    cf = rl_canvas.Canvas(front_path, pagesize=A4)
    cf.setTitle(f"GeoCheckr {lang.upper()} — Front")
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cf.showPage()
        x, y = pos[i % CARDS_PER_PAGE]
        lid = f"{loc['id']:03d}"
        # Bleed background
        cf.setFillColorRGB(*front_bg)
        cf.rect(x - BLEED, y - BLEED, CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
        # Card image
        img_path = os.path.join(front_dir, f'front_{lid}.png')
        if os.path.exists(img_path):
            cf.drawImage(img_path, x, y, width=CARD_SIZE, height=CARD_SIZE)
        draw_crop_marks(cf, x, y, CARD_SIZE, BLEED)
    cf.save()
    print(f"  ✅ {front_path} ({pages}p)")

    # BACK PDF (QR) — only QR, tiny number, nothing else
    back_path = os.path.join(out, f'{prefix}_BACK.pdf')
    cb = rl_canvas.Canvas(back_path, pagesize=A4)
    cb.setTitle(f"GeoCheckr {lang.upper()} — Back")
    for i, loc in enumerate(locs):
        if i % CARDS_PER_PAGE == 0 and i > 0: cb.showPage()
        x, y = pos[i % CARDS_PER_PAGE]
        lid = f"{loc['id']:03d}"
        # Bleed background
        r, g, b = back_bg
        cb.setFillColorRGB(r, g, b)
        cb.rect(x - BLEED, y - BLEED, CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
        # QR code — 5mm margin (0.5cm)
        margin = 5 * mm
        qr_size = CARD_SIZE - 2 * margin
        url = f"https://geocheckr.app/play/{lid}"
        qr_img = generate_qr(url, fill=qr_fill, back=qr_back)
        buf = BytesIO()
        qr_img.save(buf, format='PNG')
        buf.seek(0)
        cb.drawImage(ImageReader(buf), x + margin, y + margin, width=qr_size, height=qr_size)
        # Number pill — EN has pill, DE has nothing
        if has_back_pill:
            cb.setFillColorRGB(0x33/255, 0x40/255, 0xca/255)  # #3340ca pill bg
            pill_w, pill_h = 44, 22
            px = x + CARD_SIZE/2 - pill_w/2
            py = y + 5*mm
            cb.roundRect(px, py, pill_w, pill_h, 11, fill=1, stroke=0)
            cb.setFillColorRGB(0xa6/255, 0xd7/255, 0x00/255)  # #a6d700 text
            cb.setFont('Helvetica-Bold', 11)
            cb.drawCentredString(x + CARD_SIZE/2, py + 6, f"#{lid}")
        draw_crop_marks(cb, x, y, CARD_SIZE, BLEED)
    cb.save()
    print(f"  ✅ {back_path} ({pages}p)")

    # COMBINED PDF (mirrored backs for duplex printing)
    combined_path = os.path.join(out, f'{prefix}_COMBINED.pdf')
    cc = rl_canvas.Canvas(combined_path, pagesize=A4)
    cc.setTitle(f"GeoCheckr {lang.upper()} — Combined")
    for page in range(pages):
        start = page * CARDS_PER_PAGE
        end = min(start + CARDS_PER_PAGE, len(locs))
        # Front page
        for i in range(start, end):
            x, y = pos[(i - start) % CARDS_PER_PAGE]
            lid = f"{locs[i]['id']:03d}"
            # Bleed
            cc.setFillColorRGB(*front_bg)
            cc.rect(x - BLEED, y - BLEED, CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
            img_path = os.path.join(front_dir, f'front_{lid}.png')
            if os.path.exists(img_path):
                cc.drawImage(img_path, x, y, width=CARD_SIZE, height=CARD_SIZE)
            draw_crop_marks(cc, x, y, CARD_SIZE, BLEED)
        cc.showPage()
        # Back page (mirrored)
        for i in range(start, end):
            x, y = pos[(i - start) % CARDS_PER_PAGE]
            lid = f"{locs[i]['id']:03d}"
            mx = PAGE_W - x - CARD_SIZE
            r, g, b = back_bg
            cc.setFillColorRGB(r, g, b)
            cc.rect(mx - BLEED, y - BLEED, CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
            margin = 5 * mm
            qr_size = CARD_SIZE - 2 * margin
            url = f"https://geocheckr.app/play/{lid}"
            qr_img = generate_qr(url, fill=qr_fill, back=qr_back)
            buf = BytesIO()
            qr_img.save(buf, format='PNG')
            buf.seek(0)
            cc.drawImage(ImageReader(buf), mx + margin, y + margin, width=qr_size, height=qr_size)
            # Number pill — EN has pill, DE has nothing
            if has_back_pill:
                cc.setFillColorRGB(0x33/255, 0x40/255, 0xca/255)
                pill_w, pill_h = 44, 22
                px = mx + CARD_SIZE/2 - pill_w/2
                py = y + 5*mm
                cc.roundRect(px, py, pill_w, pill_h, 11, fill=1, stroke=0)
                cc.setFillColorRGB(0xa6/255, 0xd7/255, 0x00/255)
                cc.setFont('Helvetica-Bold', 11)
                cc.drawCentredString(mx + CARD_SIZE/2, py + 6, f"#{lid}")
            draw_crop_marks(cc, mx, y, CARD_SIZE, BLEED)
        cc.showPage()
    cc.save()
    print(f"  ✅ {combined_path} ({pages*2}p)")

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
    print(f"Loaded {len(locs)} locations")
    build_pdf(lang, locs)

if __name__ == '__main__':
    main()
