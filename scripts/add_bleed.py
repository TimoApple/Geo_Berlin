#!/usr/bin/env python3
"""
Add 2mm bleed + crop marks to approved GeoCheckr PDF.
EXACT same content — only adds bleed and crop marks.
"""
from pikepdf import Pdf, Name, Dictionary, Array
import os

INPUT = '/home/donatello/.openclaw/media/inbound/GEOCHECKR_CARDS_COMBINED_approved---f583388c-96ad-4c0b-9a69-9fdad4a019e7.pdf'
OUTDIR = '/home/donatello/.openclaw/workspace/GeoCheckr_App/docs/cards'

MM = 72 / 25.4
BLEED = 2 * MM
MARK_LEN = 3 * MM
MARK_GAP = 0.5 * MM
MARGIN = BLEED + MARK_LEN + MARK_GAP

def main():
    pdf = Pdf.open(INPUT)
    n = len(pdf.pages)
    
    mb = pdf.pages[0].mediabox
    ow = float(mb[2]) - float(mb[0])
    oh = float(mb[3]) - float(mb[1])
    print(f"Input: {n} pages, {ow/MM:.0f}x{oh/MM:.0f}mm")
    
    nw = ow + 2 * MARGIN
    nh = oh + 2 * MARGIN
    print(f"Output: {nw/MM:.0f}x{nh/MM:.0f}mm")
    
    for i in range(n):
        page = pdf.pages[i]
        
        # Get content bytes
        if "/Contents" in page.obj:
            c = page.obj["/Contents"]
            data = b"".join(s.read_bytes() for s in c) if isinstance(c, Array) else c.read_bytes()
        else:
            data = b""
        
        # Make a Form XObject from existing content (same PDF, no copy_foreign needed)
        form = pdf.make_stream(data)
        form[Name("/Type")] = Name("/XObject")
        form[Name("/Subtype")] = Name("/Form")
        form[Name("/FormType")] = 1
        form[Name("/BBox")] = [0, 0, ow, oh]
        if Name("/Resources") in page.obj:
            form[Name("/Resources")] = page.obj[Name("/Resources")]
        
        # Update page size
        page.obj[Name("/MediaBox")] = [0, 0, nw, nh]
        
        # Add form to resources
        rsrc = page.obj.get(Name("/Resources"), Dictionary())
        xobj = rsrc.get(Name("/XObject"), Dictionary())
        xobj[Name("/OrigContent")] = form
        rsrc[Name("/XObject")] = xobj
        page.obj[Name("/Resources")] = rsrc
        
        # Scale for bleed
        sx = (ow + 2 * BLEED) / ow
        sy = (oh + 2 * BLEED) / oh
        px = MARGIN - BLEED
        py = MARGIN - BLEED
        
        # Crop marks
        b, g, m = BLEED, MARK_GAP, MARK_LEN
        bx0, by0 = MARGIN - b, MARGIN - b
        bx1, by1 = MARGIN + ow + b, MARGIN + oh + b
        
        ops = (
            f"q {sx:.6f} 0 0 {sy:.6f} {px:.2f} {py:.2f} cm /OrigContent Do Q "
            f"q 0.3 w 0 0 0 RG "
            f"{bx0-g-m:.2f} {by1:.2f} m {bx0-g:.2f} {by1:.2f} l "
            f"{bx0:.2f} {by1+g:.2f} m {bx0:.2f} {by1+g+m:.2f} l "
            f"{bx1+g:.2f} {by1:.2f} m {bx1+g+m:.2f} {by1:.2f} l "
            f"{bx1:.2f} {by1+g:.2f} m {bx1:.2f} {by1+g+m:.2f} l "
            f"{bx0-g-m:.2f} {by0:.2f} m {bx0-g:.2f} {by0:.2f} l "
            f"{bx0:.2f} {by0-g-m:.2f} m {bx0:.2f} {by0-g:.2f} l "
            f"{bx1+g:.2f} {by0:.2f} m {bx1+g+m:.2f} {by0:.2f} l "
            f"{bx1:.2f} {by0-g-m:.2f} m {bx1:.2f} {by0-g:.2f} l "
            f"S Q"
        )
        
        page.obj[Name("/Contents")] = pdf.make_stream(ops.encode())
        
        if (i+1) % 10 == 0:
            print(f"  {i+1}/{n}")
    
    out_path = os.path.join(OUTDIR, 'GEOCHECKR_CARDS_BLEED_COMBINED.pdf')
    pdf.save(out_path)
    print(f"\nSaved: {out_path}")

if __name__ == '__main__':
    main()
