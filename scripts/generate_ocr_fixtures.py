"""Fictional printed English OCR fixtures. Requires Pillow and reportlab.
These controlled samples are integration fixtures, not a clinical benchmark.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
SAMPLES=ROOT/'dist/samples';FIXTURES=ROOT/'tests/fixtures/ocr'
FIXTURES.mkdir(parents=True,exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
image=Image.new('RGB',(1700,1100),'#fffefb');draw=ImageDraw.Draw(image)
draw.text((95,85),'MedDelta / Printed record',font=ImageFont.truetype(bold,48),fill='#173f39')
draw.line((95,175,1605,175),fill='#a9b6a0',width=3)
draw.text((95,215),'FICTIONAL SOFTWARE SAMPLE',font=ImageFont.truetype(bold,27),fill='#526145')
draw.text((95,275),'Document date: 18 September 2026',font=ImageFont.truetype(font,30),fill='#333333')
instructions=['Change Metformin 500 mg orally twice daily.','Continue Amlodipine 5 mg orally once daily.','Stop Cetirizine.']
for index,line in enumerate(instructions):draw.text((95,410+index*120),line,font=ImageFont.truetype(font,39),fill='#161616')
draw.line((95,875,1605,875),fill='#a9b6a0',width=2)
draw.text((95,925),'Not a prescription. No patient data. For software testing.',font=ImageFont.truetype(font,26),fill='#526145')
image=image.filter(ImageFilter.GaussianBlur(.25))
image.save(SAMPLES/'fictional-printed-scan.png',optimize=True)
image.save(FIXTURES/'printed.jpg',quality=90)
image.save(FIXTURES/'printed.webp',quality=90)
Image.new('RGB',(800,600),'white').save(FIXTURES/'blank.png')
(FIXTURES/'corrupt.png').write_bytes(b'\x89PNG\r\n\x1a\nnot a valid image')
c=canvas.Canvas(str(FIXTURES/'printed-scan.pdf'),pagesize=(850,550),invariant=1)
c.drawImage(ImageReader(image),0,0,850,550);c.showPage();c.save()
print('Created fictional PNG, JPEG, WebP, blank/corrupt image, and image-only PDF fixtures.')
