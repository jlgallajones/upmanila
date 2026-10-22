"""Check the package and render all PDF pages for visual review."""
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw
from pypdf import PdfReader

HERE=Path(__file__).resolve().parent
QA=HERE.parents[1]/'tmp/design-review'
QA.mkdir(parents=True,exist_ok=True)


class Parse(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.targets=[]
    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        if 'id' in data:self.ids.append(data['id'])
        for key in ('href','src'):
            value=data.get(key,'')
            if value and not value.startswith(('#','http','data:')):self.targets.append(value)


parser=Parse();parser.feed((HERE/'index.html').read_text(encoding='utf-8'))
assert all(n==1 for n in Counter(parser.ids).values()),'Duplicate HTML IDs'
assert all((HERE/t).is_file() for t in parser.targets),'Missing linked asset'
catalog=json.loads((HERE/'schema-catalog.json').read_text(encoding='utf-8'))
assert len(catalog)==32 and len({t['name'] for t in catalog})==32
for table in catalog:
    assert table['columns'] and table['definitions'] and table['sources']
    for source in table['sources']:assert (HERE.parents[2]/source).is_file(),source
for file in HERE.rglob('*.svg'):ElementTree.parse(file)
pdf=HERE/'SCRIBER-design-review.pdf';reader=PdfReader(pdf)
assert len(reader.pages)==11
with pdfplumber.open(pdf) as doc:
    texts=[page.extract_text() or '' for page in doc.pages]
    assert all('Approval pending' in text for text in texts)
    assert 'malformed' not in '\n'.join(texts).lower()
    assert '32 tables' in texts[5]
    assert 'Reviewer:' in texts[-1]
    assert 'medsort' not in '\n'.join(texts).lower()
    for page in doc.pages:
        for char in page.chars:
            assert char['x0']>=0 and char['x1']<=page.width+1, (page.page_number,char)
            assert char['top']>=0 and char['bottom']<=page.height+1, (page.page_number,char)
doc=pdfium.PdfDocument(pdf);thumbs=[]
for i,page in enumerate(doc):
    im=page.render(scale=1.5).to_pil().convert('RGB');im.save(QA/f'page-{i+1:02}.png')
    im.thumbnail((505,357));tile=Image.new('RGB',(525,390),'#d9e3e3');tile.paste(im,(10,10))
    ImageDraw.Draw(tile).text((15,370),f'Page {i+1}',fill='black');thumbs.append(tile)
sheet=Image.new('RGB',(1575,390*((len(thumbs)+2)//3)),'white')
for i,im in enumerate(thumbs):sheet.paste(im,((i%3)*525,(i//3)*390))
sheet.save(QA/'contact-sheet.png')
separate_counts={}
for group,expected in [('diagrams',3),('wireframes',2)]:
    separate=HERE/group/f'SCRIBER-{group}.pdf'
    with pdfplumber.open(separate) as doc:
        assert len(doc.pages)==expected
        for page in doc.pages:
            text=page.extract_text()
            assert 'SCRIBER' in text and 'medsort' not in text.lower()
            for char in page.chars:
                assert 0<=char['x0'] and char['x1']<=page.width+1
                assert 0<=char['top'] and char['bottom']<=page.height+1
    images=[]
    for i,page in enumerate(pdfium.PdfDocument(separate)):
        im=page.render(scale=1.5).to_pil().convert('RGB')
        im.save(QA/f'{group}-{i+1:02}.png');im.thumbnail((758,536));images.append(im)
    sheet=Image.new('RGB',(778,556*expected),'#d9e3e3')
    for i,im in enumerate(images):sheet.paste(im,(10,10+i*556))
    sheet.save(QA/f'{group}-contact-sheet.png');separate_counts[group]=expected
for path in HERE.rglob('*'):
    if path.suffix in {'.html','.svg','.md','.js'}:
        assert 'medsort' not in path.read_text(encoding='utf-8').lower(),path
print(json.dumps({'review_pages':len(reader.pages),'separate_pages':separate_counts,'tables':len(catalog),'html_links_checked':len(parser.targets),'svg_files':len(list(HERE.rglob('*.svg'))),'qa_directory':str(QA)}))
