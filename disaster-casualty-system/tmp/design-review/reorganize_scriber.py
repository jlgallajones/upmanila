from pathlib import Path

root=Path(__file__).resolve().parents[2]
folder=root/'docs/design-review'
for name in ['generate_review.py','index.html','review.js','README.md','verify_review.py']:
    path=folder/name
    text=path.read_text(encoding='utf-8')
    text=text.replace('medSort','SCRIBER').replace('medsort','SCRIBER')
    text=text.replace('v1.0','v1.1').replace('Version 1.0','Version 1.1')
    path.write_text(text,encoding='utf-8')
for group,names in {
    'diagrams':['architecture.svg','core-erd.svg','schema-extensions.svg','architecture.mmd','core-erd.mmd'],
    'wireframes':['web-wireframe.svg','mobile-wireframes.svg'],
}.items():
    (folder/group).mkdir(exist_ok=True)
    for name in names:
        old=folder/name
        if old.exists():old.rename(folder/group/name)
old=folder/'medsort-design-review.pdf'
if old.exists():old.rename(folder/'SCRIBER-design-review.pdf')
path=folder/'index.html';text=path.read_text(encoding='utf-8')
text=text.replace('<span class="brand-mark">m<span>+</span>','<span class="brand-mark">S<span>+</span>')
text=text.replace('<a class="button subtle" href="SCRIBER-design-review.pdf">Download review PDF</a>',
                  '<a class="button subtle" href="diagrams/SCRIBER-diagrams.pdf">Diagrams PDF</a><a class="button subtle" href="wireframes/SCRIBER-wireframes.pdf">Wireframes PDF</a>')
for name in ['architecture.svg','core-erd.svg']:
    text=text.replace(f'"{name}"',f'"diagrams/{name}"')
text=text.replace('<p class="caption">Try: select Mobile',
                  '<p class="caption"><a href="wireframes/web-wireframe.svg">Open web wireframe SVG ↗</a> &nbsp; / &nbsp; <a href="wireframes/mobile-wireframes.svg">Open mobile wireframes SVG ↗</a></p><p class="caption">Try: select Mobile')
path.write_text(text,encoding='utf-8')
path=folder/'README.md';text=path.read_text(encoding='utf-8')
text=text.replace('Open `SCRIBER-design-review.pdf` for the 11-page review and sign-off document.',
                  'Open `diagrams/SCRIBER-diagrams.pdf` for the three architecture/database diagrams and `wireframes/SCRIBER-wireframes.pdf` for the two web/mobile wireframe sheets. They are separate documents. The full review and sign-off report remains in the repository as `SCRIBER-design-review.pdf`.')
text=text.replace('Use the five `.svg` files as editable, scalable diagrams and wireframes. The architecture and core ERD also have `.mmd` sources.',
                  'The `diagrams/` folder contains three separate SVG diagrams and two Mermaid sources. The `wireframes/` folder contains separate web and mobile SVG wireframes. The downloadable ZIP retains these folders and omits the combined report.')
path.write_text(text,encoding='utf-8')
print('Updated SCRIBER branding and separated asset folders.')
