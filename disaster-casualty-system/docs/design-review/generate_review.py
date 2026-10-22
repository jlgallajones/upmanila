"""Rebuild the source-derived SCRIBER design review. No network or database access."""
from __future__ import annotations

import html
import json
import re
import textwrap
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, toColor
from reportlab.lib.utils import simpleSplit

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
REPO = PROJECT.parent
INK, MUTED, CYAN, LINE, SOFT = '#142d36', '#546c74', '#00838f', '#d5e3e5', '#edf6f6'


class Scene:
    def __init__(self, width=1200, height=760):
        self.w, self.h, self.items = width, height, []

    def rect(self, x, y, w, h, fill='white', stroke=LINE, radius=8):
        self.items.append(('rect', x, y, w, h, fill, stroke, radius))

    def text(self, x, y, content, size=15, color=INK, bold=False):
        self.items.append(('text', x, y, str(content), size, color, bold))

    def path(self, points, arrow=False, dashed=False, color='#8aa5aa'):
        self.items.append(('path', points, arrow, dashed, color))

    def node(self, x, y, w, title, lines, height=None, accent=CYAN):
        h = height or (65 + 23 * len(lines))
        self.rect(x, y, w, h)
        self.rect(x, y, w, 6, accent, accent, 0)
        self.text(x+16, y+34, title, 17, bold=True)
        for i, line in enumerate(lines):
            self.text(x+16, y+61+i*23, line, 14, MUTED)
        return h

    def svg(self):
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img">',
               '<rect width="100%" height="100%" fill="white"/>',
               '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#8aa5aa"/></marker></defs>']
        for item in self.items:
            if item[0] == 'rect':
                _, x, y, w, h, fill, stroke, r = item
                out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>')
            elif item[0] == 'text':
                _, x, y, content, size, color, bold = item
                out.append(f'<text x="{x}" y="{y}" font-family="Arial, sans-serif" font-size="{size}" fill="{color}" font-weight="{700 if bold else 400}">{html.escape(content)}</text>')
            else:
                _, points, arrow, dashed, color = item
                attrs = (' marker-end="url(#arrow)"' if arrow else '') + (' stroke-dasharray="7 5"' if dashed else '')
                coords = ' '.join(f'{x},{y}' for x, y in points)
                out.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="2"{attrs}/>')
        out.append('</svg>')
        return '\n'.join(out)

    def pdf(self, c, x, y, width, height):
        scale = min(width / self.w, height / self.h)
        c.saveState()
        c.translate(x, y+height)
        c.scale(scale, scale)
        for item in self.items:
            if item[0] == 'rect':
                _, a, b, w, h, fill, stroke, r = item
                c.setFillColor(toColor(fill)); c.setStrokeColor(toColor(stroke)); c.setLineWidth(1); c.setDash([])
                c.roundRect(a, -b-h, w, h, r, fill=1, stroke=1)
            elif item[0] == 'text':
                _, a, b, content, size, color, bold = item
                c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
                c.setFillColor(HexColor(color)); c.drawString(a, -b, content)
            else:
                _, points, arrow, dashed, color = item
                c.setStrokeColor(HexColor(color)); c.setLineWidth(2); c.setDash([7, 5] if dashed else [])
                p = c.beginPath(); p.moveTo(points[0][0], -points[0][1])
                for a, b in points[1:]: p.lineTo(a, -b)
                c.drawPath(p)
                if arrow:
                    import math
                    a, b = points[-1]; prev = points[-2]
                    angle = math.atan2(b-prev[1], a-prev[0])
                    p = c.beginPath(); p.moveTo(a, -b)
                    for theta in [angle+2.6, angle-2.6]:
                        p.lineTo(a+9*math.cos(theta), -(b+9*math.sin(theta)))
                    p.close(); c.setFillColor(HexColor(color)); c.drawPath(p, fill=1, stroke=0)
        c.restoreState()


def architecture():
    s = Scene()
    s.path([(215,180),(215,260),(470,260),(470,300)], True)
    s.path([(615,180),(615,300)], True)
    s.path([(770,125),(860,125)], True, True)
    for x, source in [(165,470),(455,600),(745,730)]:
        s.path([(source,440),(source,505),(x,505),(x,590)], True)
    s.path([(575,640),(600,640),(600,725),(1035,725),(1035,690)], True)
    s.path([(1155,640),(1180,640),(1180,35),(215,35),(215,70)], True, True)
    s.text(775,25,'Realtime events to web; scoped subscription policies',13,MUTED)
    s.text(780,111,'cache / retry',12,MUTED)
    s.text(485,223,'HTTPS + bearer token',14,CYAN)
    s.text(40,292,'APPLICATION TRUST BOUNDARY',12,CYAN,True)
    s.text(40,560,'SUPABASE SERVICES',12,CYAN,True)
    s.node(60,70,310,'Web command dashboard',['Static HTML / CSS / JavaScript','Admins and super admins'],110)
    s.node(460,70,310,'Mobile / installed PWA',['Expo / React Native / TypeScript','Responders and documenters'],110)
    s.node(860,70,280,'Device-local persistence',['AsyncStorage: cache / queue','SecureStore where supported'],110)
    s.node(335,300,530,'Express API / TypeScript',['Token validation + active profile + role / unit scope','Controllers / services / audit / exports','Request IDs and error handling'],140)
    s.text(45,461,'HOSTING CONFIGURATION',12,CYAN,True)
    s.text(45,483,'Static clients + Node API service',13,MUTED)
    s.text(65,580,'Validate identity',12,MUTED)
    s.text(365,580,'Scoped reads / writes',12,MUTED)
    s.text(655,580,'Attachment objects',12,MUTED)
    s.node(45,590,240,'Supabase Auth',['Sessions / user identity'],100)
    s.node(335,590,240,'PostgreSQL',['Operational records'],100)
    s.node(625,590,240,'Object Storage',['Photos / signed access'],100)
    s.node(915,590,240,'Realtime',['Postgres change events'],100)
    s.text(50,749,'Solid: request / data path. Dashed: client-side cache or event channel. No direct client database CRUD is shown.',12,MUTED)
    return s


def core_erd():
    s=Scene()
    s.path([(260,130),(285,130),(285,330),(470,330)])
    s.path([(440,200),(440,250),(520,250),(520,290)])
    s.path([(740,200),(740,250),(680,250),(680,290)])
    s.path([(1040,200),(1040,225),(805,225),(805,380),(730,380)])
    s.path([(260,365),(470,365)])
    s.path([(730,340),(920,340)])
    for x, start in [(140,500),(440,560),(740,620),(1040,690)]:
        s.path([(start,455),(start,500),(x,500),(x,550)])
    s.node(20,70,240,'users',['PK id -> auth.users.id','role / reporting_context','is_active / full_name'],130)
    s.node(320,70,240,'incidents',['PK id; UQ incident_code','FK created_by -> users','status / started_at'],130)
    s.node(620,70,240,'casualties',['PK id; id_number','identification_status','name / age / address'],130)
    s.node(920,70,260,'healthcare_facilities',['PK id; FK created_by','facility_name / location','is_active'],130)
    s.node(20,300,240,'evacuation_centers',['PK id; FK incident_id','center_name / capacity','location / is_active'],130)
    s.node(470,290,260,'casualty_incidents',['PK id; UQ client_record_id','FK casualty_id / incident_id','FK encoded_by / verified_by','status / verification_status'],165)
    s.node(920,300,260,'triage assessments',['casualty_triage_assessments','PK id; FK casualty_incident_id','triage stage / category'],130)
    s.node(20,550,260,'transport records',['casualty_transport_records','PK id; FK casualty_incident_id','FK receiving_facility_id'],130)
    s.node(320,550,260,'facility_encounters',['PK id; FK casualty_incident_id','FK facility_id','arrival / ED / disposition'],130)
    s.node(620,550,260,'attachments',['PK id; FK casualty_incident_id','FK uploaded_by','file metadata / storage path'],130)
    s.node(920,550,260,'verification history',['casualty_verification_history','PK id; FK casualty_incident_id','decision / reviewer / reason'],130)
    s.text(330,240,'1 : 0..N',13,CYAN);s.text(755,240,'1 : 0..N',13,CYAN)
    s.text(300,353,'0..1 center : 0..N reports',12,MUTED)
    s.text(758,329,'1 report : 0..N',12,CYAN)
    s.text(40,530,'1 report : 0..N per child table',13,CYAN)
    s.text(35,716,'PK = primary key; FK = foreign key; UQ = unique. Every report belongs to one incident, one casualty, and one encoder.',14,MUTED)
    s.text(35,742,'Relationship view is selective. Full field declarations and all source tables are in the searchable schema catalog.',13,MUTED)
    return s


def extensions():
    s=Scene()
    s.node(30,30,540,'casualty_incidents / report extensions',['FK casualty_incident_id -> casualty_incidents.id'],95)
    s.node(630,30,540,'incidents / operational extensions',['FK incident_id -> incidents.id'],95)
    left=[('casualty_status_history','0..N status transitions'),('casualty_treatments','0..N treatment entries'),('clinical_procedures','0..N procedures; optional facility_id'),('icu_encounters','0..N ICU episodes; optional facility_id'),('casualty_outcomes','0..1 final outcome; UNIQUE report FK'),('casualty_case_links','0..1 link per report; case_id is a UUID group')]
    right=[('incident_response_timelines','0..1 timeline; UNIQUE incident FK'),('dmmp_staff_call_downs','0..N call-down / staffing entries'),('medical_coordination_assessments','0..1 evaluation; UNIQUE incident FK'),('continuity_of_care_assessments','0..1 assessment; UNIQUE incident FK'),('facility_resource_snapshots','0..N snapshots; optional facility_id'),('sitreps / ems_vehicle_arrivals','0..N situation reports / vehicle arrivals')]
    for col, rows in [(30,left),(630,right)]:
        for idx,(title,desc) in enumerate(rows):
            y=145+idx*72
            s.rect(col,y,540,60,SOFT)
            s.text(col+15,y+24,title,16,bold=True)
            s.text(col+15,y+46,desc,13,MUTED)
    s.node(30,610,540,'User-linked support tables',['form_drafts, notifications, audit_logs, call_down_staff'],100)
    s.node(630,610,540,'Additional incident / user links',['responder_safety_reports, responder_safety_responses','incident_ic_backups, incident_ic_delegations'],100)
    s.text(30,743,'Reference groups summarize declared FK links; they do not imply that every optional extension is deployed or used by every workflow.',12,MUTED)
    return s


def web_wireframe():
    s=Scene(1200,720)
    s.rect(25,25,1150,650,'white','#a2b5b9',0)
    s.rect(25,25,210,650,'#edf1f1','#a2b5b9',0)
    s.text(50,75,'SCRIBER',25,bold=True);s.text(50,110,'ADMIN WORKSPACE',11,MUTED)
    for i,t in enumerate(['Overview','Incidents','Casualty records','Verification [2]','Facilities']):
        y=165+58*i
        if not i:s.rect(40,y-26,180,42,'#dce4e5',LINE,0)
        s.text(55,y,t,15)
    s.text(50,630,'Demo administrator',13,MUTED)
    s.text(270,70,'Operations / Overview',13,MUTED);s.text(975,70,'Demo workspace',13,MUTED)
    s.text(270,130,'Command overview',28,bold=True)
    s.text(270,165,'Current incident context, synchronized reports and review work.',15,MUTED)
    for i,(label,count) in enumerate([('ACTIVE INCIDENTS','2'),('CASUALTY RECORDS','3'),('AWAITING REVIEW','2'),('VERIFIED','1')]):
        x=270+220*i;s.rect(x,195,200,105,'white','#a2b5b9',0);s.text(x+15,224,label,11,MUTED);s.text(x+15,271,count,32,bold=True)
    s.rect(270,330,860,255,'white','#a2b5b9',0);s.text(290,365,'Latest casualty reports',19,bold=True)
    for x,label in [(290,'RECORD'),(485,'INCIDENT'),(680,'ASSESSMENT'),(845,'STATUS'),(1025,'ACTION')]:s.text(x,405,label,11,MUTED)
    for i,(code,assessment,status) in enumerate([('DEMO-001','Red','Awaiting review'),('DEMO-002','Yellow','Verified'),('DEMO-003','Green','Awaiting review')]):
        y=450+48*i;s.path([(285,y+16),(1115,y+16)],color=LINE)
        for x,v in [(290,code),(485,'DEMO-INC-01' if i<2 else 'DEMO-INC-02'),(680,assessment),(845,status),(1025,'View ->')]:s.text(x,y,v,13)
    s.text(270,625,'Review path: Verification > record details > approve or return with reason.',14,MUTED)
    s.text(25,706,'Desktop layout wireframe. The HTML prototype includes filters, incident reports, record detail, verification and the mobile handoff.',13,MUTED)
    return s


def mobile_wireframes():
    s=Scene(1200,760)
    screens=[('01 / IDENTITY','New casualty report'),('02 / REVIEW','Confirm report'),('03 / QUEUE','Records & sync')]
    for i,(label,title) in enumerate(screens):
        x=30+395*i;s.text(x,28,label,14,CYAN,True);s.rect(x,50,350,660,'white','#7f959b',20)
        s.text(x+22,85,'09:41',11);s.text(x+22,130,'SCRIBER',23,bold=True)
        s.rect(x+10,155,330,32,'#edf1f1',LINE,0);s.text(x+22,176,'Offline / saved work remains visible',12,MUTED)
        s.text(x+22,225,title,22,bold=True)
        if i==0:
            for j,(caption,value) in enumerate([('ACTIVE INCIDENT','Demo earthquake response'),('NAME / TEMPORARY LABEL','Unidentified demo D'),('AGE (OPTIONAL)','Unknown'),('SEX (OPTIONAL)','Unknown')]):
                y=260+j*75;s.text(x+22,y,caption,11,MUTED);s.rect(x+22,y+10,306,38,'white','#a2b5b9',0);s.text(x+32,y+35,value,14)
            s.rect(x+22,580,306,45,'#dce4e5','#a2b5b9',0);s.text(x+48,608,'Continue to assessment ->',15,bold=True)
        elif i==1:
            s.rect(x+22,250,306,240,'white','#a2b5b9',0)
            for j,line in enumerate(['DEMO-INC-01','Unidentified demo D','Age unknown / sex unknown','Assessment: not assessed','Location: Scene / Zone A','Synthetic demonstration notes']):s.text(x+37,280+34*j,line,14)
            s.text(x+22,526,'Offline: report will be queued.',14,MUTED)
            s.rect(x+22,560,306,48,'#dce4e5','#a2b5b9',0);s.text(x+60,590,'Save to offline queue',16,bold=True)
        else:
            s.text(x+22,270,'Queued (1)',18,bold=True);s.rect(x+227,246,101,36,'#edf1f1','#a2b5b9',0);s.text(x+240,269,'Sync all',13)
            s.rect(x+22,295,306,140,'white','#a2b5b9',0)
            for j,line in enumerate(['DEMO-004 / Pending','Unidentified demo D','DEMO-INC-01','Reconnect to synchronize.']):s.text(x+37,325+29*j,line,14)
            s.text(x+22,476,'Submitted (3)',18,bold=True);s.rect(x+22,495,306,100,'white','#a2b5b9',0);s.text(x+37,526,'DEMO-001 / Awaiting review',14);s.text(x+37,558,'Open record details ->',14,MUTED)
        s.path([(x+10,645),(x+340,645)],color=LINE)
        for dx,t in [(27,'Home'),(119,'Add casualty'),(258,'Records')]:s.text(x+dx,679,t,13,MUTED)
    s.text(30,744,'Touch targets: at least 44 px in the HTML design. Queue, connection state and review feedback use text as well as color.',13,MUTED)
    return s


def sql_catalog():
    """Extract source declarations, deliberately not replaying migration ordering."""
    files=[REPO/'UP-Manila-DB.sql', *sorted((PROJECT/'api/sql').glob('*.sql'))]
    catalog={}
    for file in files:
        raw=file.read_text(encoding='utf-8-sig')
        clean=re.sub(r'--[^\n]*', '', raw)
        source=file.relative_to(REPO).as_posix()
        for match in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(\w+)\s*\(',clean,re.I):
            name=match.group(1);start=match.end();depth=1;idx=start;quoted=False
            while idx<len(clean) and depth:
                char=clean[idx]
                if char=="'":quoted=not quoted
                if not quoted:
                    if char=='(':depth+=1
                    if char==')':depth-=1
                idx+=1
            body=clean[start:idx-1]
            table=catalog.setdefault(name,{'name':name,'columns':[],'sources':[],'definitions':[]})
            if source not in table['sources']:table['sources'].append(source)
            table['definitions'].append({'source':source,'sql':clean[match.start():idx]+';'})
            # Column names lead a top-level comma-delimited declaration.
            parts=[];depth=0;quoted=False;begin=0
            for pos,ch in enumerate(body):
                if ch=="'":quoted=not quoted
                if not quoted:
                    if ch=='(':depth+=1
                    elif ch==')':depth-=1
                    elif ch==',' and depth==0:parts.append(body[begin:pos]);begin=pos+1
            parts.append(body[begin:])
            for part in parts:
                m=re.match(r'\s*(\w+)\s+',part)
                if m and m.group(1).lower() not in ['constraint','primary','foreign','unique','check']:
                    if m.group(1) not in table['columns']:table['columns'].append(m.group(1))
        for match in re.finditer(r'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.(\w+)\s+([^;]+);',clean,re.I):
            names=re.findall(r'ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)',match.group(2),re.I)
            if not names:continue
            name=match.group(1);table=catalog.setdefault(name,{'name':name,'columns':[],'sources':[],'definitions':[]})
            if source not in table['sources']:table['sources'].append(source)
            table['definitions'].append({'source':source,'sql':match.group(0)})
            for col in names:
                if col not in table['columns']:table['columns'].append(col)
    return sorted(catalog.values(),key=lambda t:t['name'])


def mermaid_sources():
    (HERE/'diagrams/architecture.mmd').write_text('''flowchart TB
  Web[Web dashboard: HTML / CSS / JS] -->|HTTPS + bearer token| API[Express / TypeScript API]
  Mobile[Expo / React Native / PWA] -->|HTTPS + bearer token| API
  Mobile -.->|Cache / offline queue| Local[AsyncStorage / SecureStore where supported]
  API -->|Token validation| Auth[Supabase Auth]
  API -->|Scoped reads / writes| DB[(PostgreSQL)]
  API -->|Attachment objects| Storage[Supabase Storage]
  DB --> Events[Supabase Realtime]
  Events -.->|Scoped subscriptions| Web
''',encoding='utf-8')
    (HERE/'diagrams/core-erd.mmd').write_text('''erDiagram
  USERS ||--o{ INCIDENTS : creates
  USERS ||--o{ CASUALTY_INCIDENTS : encodes
  INCIDENTS ||--o{ CASUALTY_INCIDENTS : contains
  CASUALTIES ||--o{ CASUALTY_INCIDENTS : participates
  INCIDENTS ||--o{ EVACUATION_CENTERS : has
  EVACUATION_CENTERS |o--o{ CASUALTY_INCIDENTS : hosts
  HEALTHCARE_FACILITIES |o--o{ CASUALTY_INCIDENTS : receives
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TRIAGE_ASSESSMENTS : assesses
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TRANSPORT_RECORDS : transports
  CASUALTY_INCIDENTS ||--o{ FACILITY_ENCOUNTERS : encounters
  CASUALTY_INCIDENTS ||--o{ ATTACHMENTS : documents
  CASUALTY_INCIDENTS ||--o{ CASUALTY_VERIFICATION_HISTORY : reviews
  CASUALTY_INCIDENTS ||--o{ CASUALTY_STATUS_HISTORY : changes
  CASUALTY_INCIDENTS ||--o{ CASUALTY_TREATMENTS : treats
  CASUALTY_INCIDENTS ||--o{ CLINICAL_PROCEDURES : records
  CASUALTY_INCIDENTS ||--o{ ICU_ENCOUNTERS : records
  CASUALTY_INCIDENTS ||--o| CASUALTY_OUTCOMES : concludes
  CASUALTY_INCIDENTS ||--o| CASUALTY_CASE_LINKS : links
''',encoding='utf-8')


W,H=842,595


def make_pdf(scenes,catalog):
    output=HERE/'SCRIBER-design-review.pdf'
    c=canvas.Canvas(str(output),pagesize=(W,H))
    c.setTitle('SCRIBER - Architecture, Database and UI/UX Design Review')
    c.setAuthor('UP Manila project - prepared for review')
    page=0

    def start(kicker,title,sub=''):
        nonlocal page
        page+=1;c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(HexColor(CYAN));c.setFont('Helvetica-Bold',9);c.drawString(38,H-35,kicker.upper())
        c.setFillColor(HexColor(INK));c.setFont('Helvetica-Bold',25);c.drawString(38,H-72,title)
        if sub:para(sub,38,H-94,W-76,9.5,MUTED)
        c.setStrokeColor(HexColor(LINE));c.line(38,35,W-38,35)
        c.setFillColor(HexColor(MUTED));c.setFont('Helvetica',8)
        c.drawString(38,22,'SCRIBER / DCMS | Design review v1.1 | 22 October 2026 | Approval pending')
        c.drawRightString(W-38,22,f'{page:02d}')

    def para(text,x,y,width,size=11,color=INK,bold=False,leading=None):
        font='Helvetica-Bold' if bold else 'Helvetica';leading=leading or size*1.5
        c.setFont(font,size);c.setFillColor(HexColor(color))
        lines=simpleSplit(text,font,size,width)
        for line in lines:c.drawString(x,y,line);y-=leading
        return y

    def box(x,y,w,h,title,body):
        c.setFillColor(HexColor(SOFT));c.setStrokeColor(HexColor(LINE));c.roundRect(x,y-h,w,h,7,fill=1,stroke=1)
        para(title,x+17,y-25,w-34,12,bold=True)
        para(body,x+17,y-50,w-34,10,MUTED)

    start('Design package / 01','From field report to coordinated response.','System architecture, database schema visualization, and web / mobile frontend prototypes for the existing UP Manila project.')
    para('SCRIBER',38,425,760,58,bold=True)
    para('Disaster Casualty Management System',40,388,740,18,MUTED)
    box(38,337,246,145,'01 / System architecture','Vector diagram, client and API boundaries, authentication, data services, offline queue and realtime paths.')
    box(298,337,246,145,'02 / Database schema','Core ERD, extension map, full searchable table catalog with source DDL, and read-only inspection queries.')
    box(558,337,246,145,'03 / UI / UX prototype','Clickable web and mobile flows, low-fidelity wireframe mode, offline queue simulation, and review decisions.')
    para('REVIEW STATUS',38,160,760,10,CYAN,True)
    para('Prepared for stakeholder review. No approval is implied. Reviewer and decision fields are provided on the final page.',38,137,750,11)
    para('Basis: repository source only. No production data, live database inspection, deployment verification, or clinical protocol validation was performed.',38,91,750,9,MUTED)
    c.showPage()

    start('01 / Architecture','Two clients, one operational backend.','Solid lines show request / data paths. Dashed lines show local persistence or client event subscriptions.')
    scenes['architecture'].pdf(c,45,67,752,421)
    para('Source: api/src/app.ts; api/src/middleware/auth.ts; website/app.js; mobile/src/offline/casualtyQueue.ts.',38,51,765,8,MUTED)
    c.showPage()

    start('02 / Core entity relationships','The incident record connects the care journey.','Selected key fields and links. Relationship optionality follows the reviewed declarations; confirm against the deployed catalog.')
    scenes['core-erd'].pdf(c,42,62,758,425)
    para('Source: UP-Manila-DB.sql and api/sql/*.sql. The linked HTML catalog preserves exact source statements and filenames.',38,49,765,8,MUTED)
    c.showPage()

    start('02 / Extended schema','Care history and incident operations.','Optional extensions are grouped by their declared parent. Grouping does not assert that every table is deployed or actively used.')
    scenes['schema-extensions'].pdf(c,42,64,758,423)
    c.showPage()

    start('02 / Schema dictionary','Data ownership and integrity.','Design interpretation of the source model; the full declared field list and source DDL are included in schema-catalog.json and the HTML explorer.')
    rows=[
      ('users','Application profile; id links to auth.users. Active status, role and reporting context influence API access.'),
      ('incidents','Operational scope; created_by identifies the permanent owner. Acting IC delegation uses separate tables.'),
      ('casualties','Identity attributes. Keep the person distinct from the incident report; victim code semantics require explicit review.'),
      ('casualty_incidents','Report hub linking casualty, incident, encoder and optional destinations. Root SQL declares client_record_id UNIQUE NOT NULL.'),
      ('casualty_case_links','Groups related reporting-role records by case_id. UNIQUE casualty_incident_id; UNIQUE (case_id, role). No separate cases table is declared here.'),
      ('triage / transport / care','Multiple assessments, movements and encounters preserve the care timeline. Optional facility links differ across tables.'),
      ('history / attachments','Verification and status histories provide traceability. Attachments link report metadata to storage objects.'),
    ]
    y=470
    for title,body in rows:
        para(title,42,y,205,10,CYAN,True);end=para(body,252,y,548,10);y=min(y-48,end-17)
    para('Important distinction: the source field union is a discovery aid, not an executable baseline or a live database export.',42,77,755,10,MUTED)
    c.showPage()

    start('02 / Source catalog',f'{len(catalog)} tables found in the reviewed SQL.','Every table below is linked to exact CREATE TABLE / ADD COLUMN source declarations in the companion explorer. Counts are source field unions.')
    half=(len(catalog)+1)//2
    for col,items in enumerate([catalog[:half],catalog[half:]]):
        x=42+col*397;y=470
        for table in items:
            name=table['name'];size=9 if len(name)<35 else 8
            para(name,x,y,330,size,INK,True)
            c.setFont('Helvetica',8);c.setFillColor(HexColor(MUTED));c.drawRightString(x+355,y,f"{len(table['columns'])} fields")
            c.setStrokeColor(HexColor(LINE));c.line(x,y-9,x+355,y-9);y-=23
    para('Scope: root UP-Manila-DB.sql plus all api/sql/*.sql files. Migration ordering, drops, renames and type changes are not reconstructed.',42,65,758,9,MUTED)
    c.showPage()

    start('03 / Web wireframe','A command workspace for review and coordination.','Desktop information hierarchy: incident scope, operational totals, latest reports, and a visible verification queue.')
    scenes['web-wireframe'].pdf(c,42,65,758,423)
    c.showPage()

    start('03 / Mobile wireframes','Short steps. Explicit submission state.','Identity -> assessment -> review -> submission or offline queue. The interactive prototype includes the assessment step and both connection states.')
    scenes['mobile-wireframes'].pdf(c,42,65,758,423)
    c.showPage()

    start('03 / Interaction contract','Walk through the complete reporting loop.','The prototype uses synthetic records in memory. It makes no backend requests and does not persist records after reloading the page.')
    steps=[
      ('1. Capture','Mobile > Add casualty. Select an active incident, enter a name or unidentified label, and complete the assessment step.'),
      ('2. Review','Check the report before submitting. Back navigation retains draft fields. Age is optional; entered values must be 0 to 130.'),
      ('3. Queue','Enable Offline before submission. The report appears as Pending in Records and remains absent from the web register.'),
      ('4. Synchronize','Reconnect and select Sync all. Queued reports become submitted and appear in the web verification list.'),
      ('5. Verify','Web > Verification > Review. Approve the record or return it with a required reason. Status and history update in both views.'),
      ('6. Inspect / reset','Search and filter the register, inspect record history, toggle Wireframe view, or Reset demo to restore the starting data.'),
    ]
    y=468
    for title,body in steps:
        para(title,42,y,140,11,CYAN,True);end=para(body,190,y,610,10.5);y=min(y-58,end-19)
    para('UI design: cyan / neutral palette aligned to the existing project; textual state labels; visible focus outlines; responsive layouts; native form controls.',42,80,755,9,MUTED)
    para('Simulated: authentication, sync transport and offline storage. Photo capture and full role-specific clinical forms remain in the existing application.',42,53,755,9,MUTED)
    c.showPage()

    start('04 / Review decisions','Resolve source drift before implementation sign-off.','These are review findings, not changes applied to your database or application.')
    findings=[
      ('Roles / baseline','The root user_role enum lists the original roles, while API middleware supports additional roles such as field_responder, sa_responder and documenter. Compare the live role column / enum with add-separated-responder-roles.sql and the application guards.'),
      ('Migration provenance','Multiple files declare overlapping tables and constraints. The source union cannot establish migration order or which definitions are deployed. Export the live catalog with schema-review.sql.'),
      ('Identifiers / retries','Root SQL declares a unique client_record_id. The API checks it before submission and calls a transaction function. Confirm the deployed uniqueness guarantee and concurrent retry behavior.'),
      ('Victim codes','replace-global-casualty-id-number-uniqueness.sql drops global identity-code uniqueness. API checks codes within an incident; a database-level incident/code guarantee remains a review decision.'),
      ('Authorization / realtime','Review API unit / role scope and Realtime policies together. Supabase service-role calls need explicit API authorization. Client filtering is insufficient for sensitive record visibility.'),
      ('Offline recovery','Confirm shared-device queue isolation, attachment size limits, partial-upload retry, and expired-session behavior on actual devices and weak connections.'),
    ]
    y=470
    for title,body in findings:
        para(title,42,y,145,10,CYAN,True);end=para(body,195,y,605,10);y=min(y-62,end-15)
    c.showPage()

    start('04 / Acceptance & approval','Reviewable now. Approval is a recorded decision.','Complete the architecture, database and UI walkthrough with the appropriate project reviewers.')
    checks=[
      '[ ] Architecture: client responsibilities, API boundary, hosting ownership and data paths accepted.',
      '[ ] Database: live schema compared with source; enum, role and migration differences reconciled.',
      '[ ] Identity: victim-code and retry uniqueness guarantees agreed and verified.',
      '[ ] UI / UX: desktop, mobile, empty states, queue workflow and return-for-correction feedback reviewed.',
      '[ ] Operational roles: field, stabilization, facility and command terminology confirmed.',
      '[ ] Validation: API permissions, Realtime visibility and real-device offline recovery assigned for testing.',
    ]
    y=470
    for line in checks:y=para(line,42,y,755,10.5)-17
    c.setStrokeColor(HexColor(LINE));c.line(42,242,800,242)
    para('Reviewer: ____________________________   Role / organization: ____________________________',42,216,755,11)
    para('Decision: Approve / Approve with changes / Revise     Date: _______________________________',42,179,755,11)
    para('Conditions / comments: _____________________________________________________________',42,142,755,11)
    para('________________________________________________________________________________',42,106,755,11)
    para('Companion files: index.html, editable SVG / Mermaid diagrams, schema-catalog.json, schema-review.sql, and README.md.',42,61,755,9,MUTED)
    c.showPage();c.save()
    return output,page


def make_separate_pdfs(scenes):
    groups = {
        'diagrams': [
            ('architecture', 'System architecture', 'Client, API, data service, offline persistence and realtime paths.'),
            ('core-erd', 'Core database relationships', 'Selected keys and relationships from the reviewed source schema.'),
            ('schema-extensions', 'Extended database schema', 'Care history, incident operations and supporting entities.'),
        ],
        'wireframes': [
            ('web-wireframe', 'Web dashboard wireframe', 'Desktop layout for command overview, casualty records and verification.'),
            ('mobile-wireframes', 'Mobile app wireframes', 'Identity entry, submission review and offline queue layouts.'),
        ],
    }
    outputs=[]
    for group, pages in groups.items():
        output=HERE/group/f'SCRIBER-{group}.pdf'
        c=canvas.Canvas(str(output), pagesize=(W,H))
        c.setTitle(f'SCRIBER - {group.title()}')
        c.setAuthor('UP Manila project - prepared for review')
        for index,(key,title,subtitle) in enumerate(pages,1):
            c.setFillColor(HexColor(CYAN));c.setFont('Helvetica-Bold',10)
            c.drawString(38,H-35,f'SCRIBER / {group.upper()}')
            c.setFillColor(HexColor(INK));c.setFont('Helvetica-Bold',25)
            c.drawString(38,H-72,title)
            c.setFillColor(HexColor(MUTED));c.setFont('Helvetica',10)
            c.drawString(38,H-94,subtitle)
            scenes[key].pdf(c,42,65,758,423)
            c.setStrokeColor(HexColor(LINE));c.line(38,35,W-38,35)
            c.setFillColor(HexColor(MUTED));c.setFont('Helvetica',8)
            c.drawString(38,22,'SCRIBER / DCMS | Design review v1.1 | 22 October 2026 | Approval pending')
            c.drawRightString(W-38,22,f'{index:02d} / {len(pages):02d}')
            c.showPage()
        c.save();outputs.append(str(output))
    return outputs


def main():
    for group in ('diagrams','wireframes'):(HERE/group).mkdir(exist_ok=True)
    catalog=sql_catalog()
    (HERE/'schema-catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
    (HERE/'schema-catalog.js').write_text('globalThis.SCHEMA_CATALOG = '+json.dumps(catalog)+';\n',encoding='utf-8')
    scenes={'architecture':architecture(),'core-erd':core_erd(),'schema-extensions':extensions(),'web-wireframe':web_wireframe(),'mobile-wireframes':mobile_wireframes()}
    for name,scene in scenes.items():
        group='wireframes' if 'wireframe' in name else 'diagrams'
        (HERE/group/f'{name}.svg').write_text(scene.svg(),encoding='utf-8')
    mermaid_sources()
    pdf,pages=make_pdf(scenes,catalog)
    separate=make_separate_pdfs(scenes)
    print(json.dumps({'review_pdf':str(pdf),'pages':pages,'separate_pdfs':separate,'tables':len(catalog)}))


if __name__=='__main__':main()
