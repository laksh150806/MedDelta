"""Optional regeneration of fictional PDF samples and integration fixtures.
Requires reportlab and Pillow. No real patient data is used.
"""
from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.pdfencrypt import StandardEncryption
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
SAMPLES=ROOT/'dist/samples';FIXTURES=ROOT/'tests/fixtures/pdf'
SAMPLES.mkdir(parents=True,exist_ok=True);FIXTURES.mkdir(parents=True,exist_ok=True)

def page(c,title,lines,number):
    c.setFillColorRGB(.09,.25,.22);c.rect(0,730,612,62,fill=1,stroke=0)
    c.setFillColorRGB(1,1,1);c.setFont('Helvetica-Bold',19);c.drawString(42,754,'MedDelta / '+title)
    c.setFillColorRGB(.25,.3,.25);c.setFont('Helvetica',10)
    c.drawString(42,705,'FICTIONAL SOFTWARE DEMO - not treatment guidance')
    c.drawString(42,680,'Document date: 18 September 2026')
    c.setFont('Helvetica',12)
    for index,line in enumerate(lines):c.drawString(42,625-index*40,line)
    c.setFont('Helvetica',9);c.drawString(42,45,f'Fictional follow-up record / Page {number}')

sample=canvas.Canvas(str(SAMPLES/'fictional-followup.pdf'),pagesize=(612,792),invariant=1)
page(sample,'Follow-up instructions',['Please increase Metformin to 500 mg by mouth twice a day.','Please keep taking Amlodipine 5 mg by mouth every day.'],1);sample.showPage()
page(sample,'Instructions continued',['Please discontinue taking Cetirizine.'],2);sample.showPage();sample.save()

image=Image.new('RGB',(900,400),'white');ImageDraw.Draw(image).text((30,80),'FICTIONAL SCAN - contains image pixels, no text layer.',fill='black')
for name,mixed in [('image-only.pdf',False),('mixed.pdf',True)]:
    c=canvas.Canvas(str(FIXTURES/name),pagesize=(612,792),invariant=1)
    if mixed:page(c,'Typed page',['Continue Metformin 500 mg orally once daily.'],1);c.showPage()
    c.drawImage(ImageReader(image),42,350,width=528,height=234);c.showPage();c.save()
c=canvas.Canvas(str(FIXTURES/'locked.pdf'),encrypt=StandardEncryption('fictional-test-password'),invariant=1)
c.drawString(40,700,'Fictional locked document');c.showPage();c.save()
c=canvas.Canvas(str(FIXTURES/'11-pages.pdf'),invariant=1)
for i in range(11):c.drawString(40,700,f'Fictional page {i+1}');c.showPage()
c.save()
(FIXTURES/'corrupt.pdf').write_bytes(b'%PDF-1.7\ninvalid-object\n%%EOF')
print('Generated fictional sample and PDF error fixtures.')
