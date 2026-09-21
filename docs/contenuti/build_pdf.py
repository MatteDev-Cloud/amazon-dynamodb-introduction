"""Render the adjacent Markdown with local fonts. Requires reportlab.
These are authoring dependencies only, never required by the deployed application.
"""
from pathlib import Path
import re, html, shutil
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import xml.etree.ElementTree as ET
from reportlab.graphics.shapes import Drawing, Rect, String, Path as GraphicPath

def svg2rlg(filename):
    root=ET.parse(filename).getroot();_,_,w,h=map(float,root.attrib['viewBox'].split());drawing=Drawing(w,h)
    def walk(node,attrs):
        a={**attrs,**node.attrib};tag=node.tag.split('}')[-1]
        fill=None if a.get('fill')=='none' else colors.HexColor(a.get('fill','#000000'))
        stroke=colors.HexColor(a['stroke']) if a.get('stroke') else None
        if tag=='rect':drawing.add(Rect(float(a.get('x',0)),h-float(a.get('y',0))-float(a['height']),float(a['width']),float(a['height']),fillColor=fill,strokeColor=stroke,strokeWidth=float(a.get('stroke-width',1))))
        elif tag=='text':drawing.add(String(float(a['x']),h-float(a['y']),node.text or '',fontName='Mono' if a.get('font-family')=='monospace' else 'Space',fontSize=float(a.get('font-size',20)),fillColor=fill))
        elif tag=='path':
            path=GraphicPath(strokeColor=stroke,fillColor=None,strokeWidth=float(a.get('stroke-width',1)));tokens=re.findall(r'[MmHhVvLl]|-?\d+(?:\.\d+)?',a['d']);x=y=0;i=0
            while i<len(tokens):
                cmd=tokens[i];i+=1
                if cmd in 'MmLl':
                    xx=float(tokens[i]);yy=float(tokens[i+1]);i+=2
                    x,y=(x+xx,y+yy) if cmd.islower() else (xx,yy)
                    (path.moveTo if cmd in 'Mm' else path.lineTo)(x,h-y)
                elif cmd in 'Hh':
                    xx=float(tokens[i]);i+=1;x=x+xx if cmd=='h' else xx;path.lineTo(x,h-y)
                elif cmd in 'Vv':
                    yy=float(tokens[i]);i+=1;y=y+yy if cmd=='v' else yy;path.lineTo(x,h-y)
            drawing.add(path)
        for child in node:walk(child,a)
    walk(root,{})
    return drawing

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
TEMP=ROOT/'frontend/test-results/pdf'
TEMP.mkdir(parents=True,exist_ok=True)
for name,filename in [('Space','SpaceGrotesk'),('Mono','JetBrainsMono')]:
    pdfmetrics.registerFont(TTFont(name,str(ROOT/f'frontend/public/fonts/{filename}.ttf')))
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='Text',fontName='Space',fontSize=10,leading=13.5,textColor=colors.HexColor('#1B2340'),spaceAfter=8))
styles.add(ParagraphStyle(name='TitleLocal',fontName='Space',fontSize=27,leading=31,textColor=colors.HexColor('#1B2340'),spaceAfter=16))
styles.add(ParagraphStyle(name='Sub',fontName='Space',fontSize=14,leading=19,textColor=colors.HexColor('#AF491F'),spaceBefore=8,spaceAfter=7,keepWithNext=True))
styles.add(ParagraphStyle(name='Source',parent=styles['Text'],fontSize=7.2,leading=10,spaceAfter=7,splitLongWords=True))
styles.add(ParagraphStyle(name='Cell',parent=styles['Text'],fontSize=8,leading=11,spaceAfter=0))

def inline(s):
    s=html.escape(s)
    s=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'`(.*?)`',r'<font name="Mono">\1</font>',s)
    s=re.sub(r'https://[^\s]+',lambda m:f'<link href="{m[0]}" color="#AF491F">{m[0]}</link>',s)
    return s

story=[]
for section_i,section in enumerate((HERE/'APPROFONDIMENTO.md').read_text().split('<!-- page -->')):
    if section_i:story.append(PageBreak())
    blocks=re.split(r'\n\s*\n',section.strip())
    for block in blocks:
        if block.startswith('|'):
            rows=[]
            for line in block.splitlines():
                if re.match(r'^\|[\s:|\-]+\|$',line):continue
                rows.append([Paragraph(inline(c.strip()),styles['Cell']) for c in line.strip('|').split('|')])
            widths=([80,140,120,150] if len(rows[0])==4 else [95,395])
            table=Table(rows,colWidths=widths,hAlign='LEFT',repeatRows=1)
            table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E8EBDD')),('LINEBELOW',(0,0),(-1,0),1,colors.HexColor('#AF491F')),('LINEBELOW',(0,1),(-1,-1),.4,colors.HexColor('#D1D2CD')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
            story.extend([table,Spacer(1,13)])
        elif block.startswith('!['):
            match=re.search(r'\((.*?)\)',block)
            drawing=svg2rlg(str((HERE/match[1]).resolve()))
            # Same diagrams as stage, rendered against a dark inset for legibility.
            from reportlab.graphics.shapes import Rect
            drawing.contents.insert(0,Rect(0,0,drawing.width,drawing.height,fillColor=colors.HexColor('#0B0D10'),strokeColor=None))
            scale=400/drawing.width;drawing.scale(scale,scale);drawing.width*=scale;drawing.height*=scale
            story.extend([drawing,Spacer(1,14)])
        else:
            for line in block.splitlines() if block.startswith('#') else [block]:
                if line.startswith('# '):story.append(Paragraph(inline(line[2:]),styles['TitleLocal']))
                elif line.startswith('## '):story.append(Paragraph(inline(line[3:]),styles['Sub']))
                elif line.startswith('### '):story.append(Paragraph(inline(line[4:]),styles['Sub']))
                else:story.append(Paragraph(inline(line).replace('\n','<br/>'),styles['Source' if section_i==9 else 'Text']))

def page(c,doc):
    c.setFillColor(colors.HexColor('#FAF8F2'));c.rect(0,0,595.28,841.89,fill=1,stroke=0)
    c.setStrokeColor(colors.HexColor('#AF491F'));c.line(52,794,542,794)
    c.setFont('Mono',8);c.setFillColor(colors.HexColor('#596072'));c.drawString(52,807,'DYNAMOLIVE / GUIDA DI APPROFONDIMENTO')
    c.drawString(52,30,'21.09.2026  /  CONTRATTO V1');c.drawRightString(542,30,str(doc.page))
output=HERE/'DynamoLive-approfondimento.pdf'
doc=SimpleDocTemplate(str(output),pagesize=(595.28,841.89),leftMargin=52,rightMargin=52,topMargin=65,bottomMargin=55,title='DynamoLive - Siete già nel database',author='DynamoLive',pageCompression=1)
doc.build(story,onFirstPage=page,onLaterPages=page)
shutil.copyfile(output,ROOT/'frontend/public/dynamolive-approfondimento.pdf')
print(output)
