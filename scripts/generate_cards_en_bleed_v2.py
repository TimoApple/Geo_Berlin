#!/usr/bin/env python3
"""
GeoCheckr Cards — Add 2mm Bleed + Crop Marks to Approved English PDF
Takes the approved combined PDF and adds per-card bleed + crop marks.
"""

import os, math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas as rl_canvas
from PIL import Image

# ── CONFIG ──
CARD_SIZE_MM = 60
BLEED_MM = 2
CARD_SIZE = CARD_SIZE_MM * mm  # 6cm
BLEED = BLEED_MM * mm          # 2mm
PAGE_W, PAGE_H = A4
DPI = 400  # render resolution
SCALE = DPI / 25.4  # pixels per mm

# Page layout (from original script)
MARGIN_X = 15 * mm
MARGIN_Y_TOP = 20 * mm
COLS = 3
ROWS = 4
CARDS_PER_PAGE = COLS * ROWS
CARD_GAP = 2 * mm

# Bleed colors per side
BLEED_COLOR_FRONT = (51, 64, 202)    # #3340CA — QR side
BLEED_COLOR_BACK = (198, 255, 0)     # #c6ff00 — City name side

# Crop mark style
CROP_COLOR = (0.2, 0.2, 0.2)  # dark gray
CROP_WIDTH = 0.3
MARK_LEN = 3 * mm
MARK_GAP = 0.5 * mm

# ── PATHS ──
APPROVED_PDF = '/home/donatello/.openclaw/media/inbound/GEOCHECKR_CARDS_COMBINED_approved---eb97f6b3-4d4e-42cf-ba72-2faeeada88f2.pdf'
OUT_DIR = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'
HIRES_DIR = '/tmp/approved_hires'

# ── CARD POSITIONS (mm from top-left of page) ──
def get_card_positions_mm():
    """Card positions in mm, origin at bottom-left (reportlab coords)"""
    positions = []
    for row in range(ROWS):
        for col in range(COLS):
            x = MARGIN_X / mm + col * (CARD_SIZE_MM + BLEED_MM + 2)  # adjusted
            # Recalculate properly
            x_mm = 15 + col * (CARD_SIZE_MM + 2)  # 15mm margin, 2mm gap
            y_mm = 297 - 20 - (row + 1) * CARD_SIZE_MM - row * 2  # from bottom
            positions.append((x_mm * mm, y_mm * mm))
    return positions

def get_card_corners_px(page_w_px, page_h_px):
    """Card corners in pixels (top-left origin), for extracting from rendered PNG"""
    scale = page_w_px / 210.0  # px per mm
    cards = []
    for row in range(ROWS):
        for col in range(COLS):
            x_mm = 15 + col * (CARD_SIZE_MM + 2)
            y_mm = 20 + row * (CARD_SIZE_MM + 2)  # from top
            x1 = int(x_mm * scale)
            y1 = int(y_mm * scale)
            x2 = int((x_mm + CARD_SIZE_MM) * scale)
            y2 = int((y_mm + CARD_SIZE_MM) * scale)
            cards.append((x1, y1, x2, y2))
    return cards

# ── DRAW CROP MARKS ──
def draw_crop_marks(c, x, y, size, bleed):
    """Draw crop marks at corners of a card (x,y = card origin, size = card width/height)"""
    c.setStrokeColor(CROP_COLOR)
    c.setLineWidth(CROP_WIDTH)
    
    # Bleed outer edges
    bx0 = x - bleed
    by0 = y - bleed
    bx1 = x + size + bleed
    by1 = y + size + bleed
    
    # Top-left
    c.line(bx0 - MARK_GAP, by1, bx0 - MARK_GAP - MARK_LEN, by1)
    c.line(bx0, by1 + MARK_GAP, bx0, by1 + MARK_GAP + MARK_LEN)
    
    # Top-right
    c.line(bx1 + MARK_GAP, by1, bx1 + MARK_GAP + MARK_LEN, by1)
    c.line(bx1, by1 + MARK_GAP, bx1, by1 + MARK_GAP + MARK_LEN)
    
    # Bottom-left
    c.line(bx0 - MARK_GAP, by0, bx0 - MARK_GAP - MARK_LEN, by0)
    c.line(bx0, by0 - MARK_GAP, bx0, by0 - MARK_GAP - MARK_LEN)
    
    # Bottom-right
    c.line(bx1 + MARK_GAP, by0, bx1 + MARK_GAP + MARK_LEN, by0)
    c.line(bx1, by0 - MARK_GAP, bx1, by0 - MARK_GAP - MARK_LEN)

# ── MAIN ──
def main():
    from reportlab.lib.utils import ImageReader
    from io import BytesIO
    
    # Card positions in reportlab coords (bottom-left origin)
    rl_positions = get_card_positions_mm()
    
    # Load rendered pages
    page_files = sorted([f for f in os.listdir(HIRES_DIR) if f.startswith('approved_hires-')])
    total_pages = len(page_files)
    print(f"Total pages in approved PDF: {total_pages}")
    
    # Pages are alternating: odd=front(QR), even=back(city)
    # Front pages: 1,3,5,... Back pages: 2,4,6,...
    front_pages = []
    back_pages = []
    for i, f in enumerate(page_files):
        if i % 2 == 0:
            front_pages.append(os.path.join(HIRES_DIR, f))
        else:
            back_pages.append(os.path.join(HIRES_DIR, f))
    
    print(f"Front (QR) pages: {len(front_pages)}")
    print(f"Back (City) pages: {len(back_pages)}")
    
    # ── FRONT PDF with bleed ──
    front_out = os.path.join(OUT_DIR, 'GEOCHECKR_CARDS_BLEED_FRONT.pdf')
    cf = rl_canvas.Canvas(front_out, pagesize=A4)
    cf.setTitle("GeoCheckr Cards — Front (QR) with 2mm Bleed")
    cf.setAuthor("GeoCheckr")
    
    for page_idx, front_file in enumerate(front_pages):
        if page_idx > 0:
            cf.showPage()
        
        img = Image.open(front_file)
        w, h = img.size
        card_corners = get_card_corners_px(w, h)
        
        for card_idx, (x1, y1, x2, y2) in enumerate(card_corners):
            global_idx = page_idx * CARDS_PER_PAGE + card_idx
            if global_idx >= 205:
                break
            
            # Extract card from image (top-left origin → PIL)
            card_img = img.crop((x1, y1, x2, y2))
            
            # Convert to reportlab position (bottom-left origin)
            rl_x, rl_y = rl_positions[card_idx]
            
            # Draw bleed background
            cf.setFillColorRGB(
                BLEED_COLOR_FRONT[0]/255,
                BLEED_COLOR_FRONT[1]/255,
                BLEED_COLOR_FRONT[2]/255
            )
            cf.rect(rl_x - BLEED, rl_y - BLEED,
                    CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
            
            # Draw card image
            buf = BytesIO()
            card_img.save(buf, format='PNG')
            buf.seek(0)
            cf.drawImage(ImageReader(buf), rl_x, rl_y, width=CARD_SIZE, height=CARD_SIZE)
            
            # Draw crop marks
            draw_crop_marks(cf, rl_x, rl_y, CARD_SIZE, BLEED)
    
    cf.save()
    print(f"✅ Front Bleed PDF: {front_out}")
    
    # ── BACK PDF with bleed ──
    back_out = os.path.join(OUT_DIR, 'GEOCHECKR_CARDS_BLEED_BACK.pdf')
    cb = rl_canvas.Canvas(back_out, pagesize=A4)
    cb.setTitle("GeoCheckr Cards — Back (City) with 2mm Bleed")
    cb.setAuthor("GeoCheckr")
    
    for page_idx, back_file in enumerate(back_pages):
        if page_idx > 0:
            cb.showPage()
        
        img = Image.open(back_file)
        w, h = img.size
        card_corners = get_card_corners_px(w, h)
        
        for card_idx, (x1, y1, x2, y2) in enumerate(card_corners):
            global_idx = page_idx * CARDS_PER_PAGE + card_idx
            if global_idx >= 205:
                break
            
            card_img = img.crop((x1, y1, x2, y2))
            rl_x, rl_y = rl_positions[card_idx]
            
            # Draw bleed background (green)
            cb.setFillColorRGB(
                BLEED_COLOR_BACK[0]/255,
                BLEED_COLOR_BACK[1]/255,
                BLEED_COLOR_BACK[2]/255
            )
            cb.rect(rl_x - BLEED, rl_y - BLEED,
                    CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
            
            # Draw card image
            buf = BytesIO()
            card_img.save(buf, format='PNG')
            buf.seek(0)
            cb.drawImage(ImageReader(buf), rl_x, rl_y, width=CARD_SIZE, height=CARD_SIZE)
            
            # Draw crop marks
            draw_crop_marks(cb, rl_x, rl_y, CARD_SIZE, BLEED)
    
    cb.save()
    print(f"✅ Back Bleed PDF: {back_out}")
    
    # ── COMBINED PDF (front+back alternating, mirrored backs) ──
    combined_out = os.path.join(OUT_DIR, 'GEOCHECKR_CARDS_BLEED_COMBINED.pdf')
    cc = rl_canvas.Canvas(combined_out, pagesize=A4)
    cc.setTitle("GeoCheckr Cards — Combined with 2mm Bleed")
    cc.setAuthor("GeoCheckr")
    
    num_sheets = len(front_pages)
    for sheet in range(num_sheets):
        if sheet > 0:
            cc.showPage()
        
        # Front page
        front_file = front_pages[sheet]
        img = Image.open(front_file)
        w, h = img.size
        card_corners = get_card_corners_px(w, h)
        
        for card_idx, (x1, y1, x2, y2) in enumerate(card_corners):
            global_idx = sheet * CARDS_PER_PAGE + card_idx
            if global_idx >= 205:
                break
            
            card_img = img.crop((x1, y1, x2, y2))
            rl_x, rl_y = rl_positions[card_idx]
            
            cc.setFillColorRGB(
                BLEED_COLOR_FRONT[0]/255,
                BLEED_COLOR_FRONT[1]/255,
                BLEED_COLOR_FRONT[2]/255
            )
            cc.rect(rl_x - BLEED, rl_y - BLEED,
                    CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
            
            buf = BytesIO()
            card_img.save(buf, format='PNG')
            buf.seek(0)
            cc.drawImage(ImageReader(buf), rl_x, rl_y, width=CARD_SIZE, height=CARD_SIZE)
            draw_crop_marks(cc, rl_x, rl_y, CARD_SIZE, BLEED)
        
        cc.showPage()
        
        # Back page (mirrored)
        back_file = back_pages[sheet]
        img = Image.open(back_file)
        w, h = img.size
        card_corners = get_card_corners_px(w, h)
        
        for card_idx, (x1, y1, x2, y2) in enumerate(card_corners):
            global_idx = sheet * CARDS_PER_PAGE + card_idx
            if global_idx >= 205:
                break
            
            card_img = img.crop((x1, y1, x2, y2))
            # Mirror: flip X position
            rl_x, rl_y = rl_positions[card_idx]
            mirror_x = PAGE_W - rl_x - CARD_SIZE
            
            cc.setFillColorRGB(
                BLEED_COLOR_BACK[0]/255,
                BLEED_COLOR_BACK[1]/255,
                BLEED_COLOR_BACK[2]/255
            )
            cc.rect(mirror_x - BLEED, rl_y - BLEED,
                    CARD_SIZE + 2*BLEED, CARD_SIZE + 2*BLEED, fill=1, stroke=0)
            
            # Mirror the card image horizontally
            card_img_mirrored = card_img.transpose(Image.FLIP_LEFT_RIGHT)
            buf = BytesIO()
            card_img_mirrored.save(buf, format='PNG')
            buf.seek(0)
            cc.drawImage(ImageReader(buf), mirror_x, rl_y, width=CARD_SIZE, height=CARD_SIZE)
            draw_crop_marks(cc, mirror_x, rl_y, CARD_SIZE, BLEED)
    
    cc.save()
    print(f"✅ Combined Bleed PDF: {combined_out}")
    print(f"\n🎴 205 cards, 2mm bleed per card, crop marks")

if __name__ == '__main__':
    main()
