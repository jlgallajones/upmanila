from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"C:\Users\jlgallajones\upmanila\disaster-casualty-system")
OUT = ROOT / "output" / "docx"
FIG = ROOT / "tmp" / "scriber-schema-figures"
OUT.mkdir(parents=True, exist_ok=True)
FIG.mkdir(parents=True, exist_ok=True)

NAVY = "#16324F"
TEAL = "#00838F"
PALE_TEAL = "#E0F7FA"
PALE_BLUE = "#EEF5FA"
LIGHT = "#F7F9FB"
BORDER = "#C6D2DC"
TEXT = "#243447"
MUTED = "#5E6C7B"
WHITE = "#FFFFFF"
ORANGE = "#B54708"
GREEN = "#16794C"

FONT_DIR = Path(r"C:\Windows\Fonts")
FONT_REG = FONT_DIR / "segoeui.ttf"
FONT_BOLD = FONT_DIR / "segoeuib.ttf"


def docx_color(value):
    return RGBColor.from_string(value.replace("#", ""))


def font(size, bold=False):
    path = FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(str(path), size)


def wrap_lines(text, width):
    return wrap(text, width=width, break_long_words=False, break_on_hyphens=False)


def draw_arrow(draw, start, end, label=None, color=NAVY):
    draw.line([start, end], fill=color, width=4)
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    tip = end
    base = (end[0] - ux * 18, end[1] - uy * 18)
    left = (base[0] + px * 8, base[1] + py * 8)
    right = (base[0] - px * 8, base[1] - py * 8)
    draw.polygon([tip, left, right], fill=color)
    if label:
        mx, my = (start[0] + end[0]) // 2, (start[1] + end[1]) // 2
        draw.rounded_rectangle((mx - 62, my - 18, mx + 62, my + 18), radius=10, fill=WHITE, outline=BORDER, width=2)
        draw.text((mx, my), label, font=font(18), fill=MUTED, anchor="mm")


def draw_node(draw, node):
    x, y, w, h = node["box"]
    fill = node.get("fill", PALE_BLUE)
    accent = node.get("accent", TEAL)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=fill, outline=BORDER, width=3)
    draw.rectangle((x, y, x + 12, y + h), fill=accent)
    draw.text((x + 28, y + 22), node["title"], font=font(24, True), fill=NAVY)
    current_y = y + 62
    for line in node.get("lines", []):
        if isinstance(line, tuple):
            label, value = line
            draw.text((x + 28, current_y), label, font=font(18, True), fill=TEXT)
            draw.text((x + 28 + min(170, len(label) * 9), current_y), value, font=font(18), fill=MUTED)
            current_y += 27
        else:
            for wrapped in wrap_lines(line, max(22, int((w - 56) / 12))):
                draw.text((x + 28, current_y), wrapped, font=font(17), fill=MUTED)
                current_y += 24
        if current_y > y + h - 28:
            break


def diagram(name, title, subtitle, nodes, edges, legend=None):
    width, height = 1800, 980
    image = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 112), fill=NAVY)
    draw.text((48, 25), title, font=font(34, True), fill=WHITE)
    draw.text((48, 70), subtitle, font=font(19), fill="#DDEAF2")
    for edge in edges:
        source = next(n for n in nodes if n["id"] == edge[0])
        target = next(n for n in nodes if n["id"] == edge[1])
        sx, sy, sw, sh = source["box"]
        tx, ty, tw, th = target["box"]
        start = (sx + sw, sy + sh // 2) if tx >= sx + sw else (sx, sy + sh // 2)
        end = (tx, ty + th // 2) if tx >= sx + sw else (tx + tw, ty + th // 2)
        if abs(tx - sx) < 140:
            start = (sx + sw // 2, sy + sh)
            end = (tx + tw // 2, ty)
        draw_arrow(draw, start, end, edge[2] if len(edge) > 2 else None)
    for node in nodes:
        draw_node(draw, node)
    if legend:
        draw.rounded_rectangle((48, height - 74, width - 48, height - 28), radius=12, fill=LIGHT, outline=BORDER, width=2)
        draw.text((68, height - 51), legend, font=font(17), fill=MUTED, anchor="lm")
    path = FIG / f"{name}.png"
    image.save(path, dpi=(180, 180))
    return path


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill.replace("#", ""))


def set_cell_border(cell, color=BORDER, size="8"):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color.replace("#", ""))


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    header = table.rows[0]
    set_repeat_table_header(header)
    for i, text in enumerate(headers):
        cell = header.cells[i]
        set_cell_shading(cell, NAVY)
        set_cell_border(cell)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        if widths:
            cell.width = Inches(widths[i])
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = docx_color(WHITE)
    for row_index, values in enumerate(rows):
        row = table.add_row()
        for i, text in enumerate(values):
            cell = row.cells[i]
            set_cell_shading(cell, "F8FBFD" if row_index % 2 == 0 else WHITE)
            set_cell_border(cell)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if widths:
                cell.width = Inches(widths[i])
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            run = p.add_run(str(text))
            run.font.size = Pt(8.5)
            run.font.color.rgb = docx_color(TEXT)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def add_heading(doc, text, level=1):
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.space_before = Pt(12 if level == 1 else 8)
    p.paragraph_format.space_after = Pt(5)
    p.add_run(text)
    return p


def add_body(doc, text, bold_lead=None):
    p = doc.add_paragraph(style="Body Text")
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.1
    if bold_lead and text.startswith(bold_lead):
        r = p.add_run(bold_lead)
        r.bold = True
        p.add_run(text[len(bold_lead):])
    else:
        p.add_run(text)
    return p


def add_bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.left_indent = Inches(0.22)
        p.add_run(item)


def add_figure(doc, image_path, caption):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(3)
    p.add_run().add_picture(str(image_path), width=Inches(10.15))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(8)
    r = cap.add_run(caption)
    r.bold = True
    r.font.size = Pt(9)
    r.font.color.rgb = docx_color(MUTED)


def set_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    run.font.size = Pt(8)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def configure_doc(doc):
    section = doc.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width = Inches(11.69)
    section.page_height = Inches(8.27)
    section.top_margin = Inches(0.55)
    section.bottom_margin = Inches(0.52)
    section.left_margin = Inches(0.62)
    section.right_margin = Inches(0.62)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(9.5)
    normal.font.color.rgb = docx_color(TEXT)
    body = styles["Body Text"]
    body.font.name = "Aptos"
    body.font.size = Pt(9.5)
    body.font.color.rgb = docx_color(TEXT)
    for name, size in (("Title", 27), ("Heading 1", 17), ("Heading 2", 12)):
        style = styles[name]
        style.font.name = "Aptos Display" if name == "Title" else "Aptos"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = docx_color("#000000")
    styles["Title"].paragraph_format.space_after = Pt(8)
    styles["Heading 1"].paragraph_format.keep_with_next = True
    styles["Heading 2"].paragraph_format.keep_with_next = True
    header = section.header.paragraphs[0]
    header.text = "SCRIBER  |  DATABASE SCHEMA DESIGN"
    header.runs[0].font.size = Pt(8)
    header.runs[0].font.bold = True
    header.runs[0].font.color.rgb = docx_color(TEAL)
    footer = section.footer.paragraphs[0]
    set_page_number(footer)


def build():
    core = diagram(
        "01-overall-core",
        "Overall Database Schema Core",
        "SCRIBER operational records are anchored by users, incidents, casualties, and the incident-specific casualty record.",
        [
            {"id": "users", "box": (70, 190, 360, 190), "title": "users", "lines": ["Identity, role, scope, account status", "created_by -> users.id"], "accent": TEAL},
            {"id": "incidents", "box": (710, 160, 380, 220), "title": "incidents", "lines": ["Official incident definition", "status and triage_mode", "created_by -> users.id"], "accent": NAVY},
            {"id": "casualties", "box": (70, 570, 360, 190), "title": "casualties", "lines": ["Person-level identity and demographics", "id_number and identification status"], "accent": ORANGE},
            {"id": "casualty_incidents", "box": (650, 560, 500, 220), "title": "casualty_incidents", "lines": ["Central incident report record", "casualty_id + incident_id", "verification, status, location, reporter"], "accent": TEAL},
            {"id": "operations", "box": (1320, 150, 390, 230), "title": "Incident operations", "lines": ["response timelines", "DMMP and safety", "EMS arrivals and resources", "SitReps and notifications"], "accent": NAVY},
            {"id": "clinical", "box": (1320, 520, 390, 240), "title": "Clinical and transport", "lines": ["triage assessments", "transport records", "facility encounters", "ICU, procedures, treatment, outcomes"], "accent": ORANGE},
        ],
        [("users", "incidents", "creates"), ("users", "casualty_incidents", "encodes"), ("casualties", "casualty_incidents", "reported in"), ("incidents", "casualty_incidents", "includes"), ("incidents", "operations", "has"), ("casualty_incidents", "clinical", "has")],
        "PK = primary key   FK = foreign key   The same user and incident scope controls access across web and mobile workflows.",
    )
    extensions = diagram(
        "02-overall-extensions",
        "Overall Database Schema Extensions",
        "Supporting tables extend the core casualty record without duplicating the person or incident master records.",
        [
            {"id": "ci", "box": (80, 370, 370, 210), "title": "casualty_incidents", "lines": ["one report within one incident", "verification and current status"], "accent": TEAL},
            {"id": "triage", "box": (560, 150, 340, 180), "title": "triage_assessments", "lines": ["system, stage, category", "answers and algorithm version"], "accent": ORANGE},
            {"id": "transport", "box": (560, 410, 340, 180), "title": "transport_records", "lines": ["patient-for disposition", "departed and arrived timestamps"], "accent": ORANGE},
            {"id": "facility", "box": (560, 670, 340, 180), "title": "facility_encounters", "lines": ["ED and hospital timestamps", "admission and discharge"], "accent": ORANGE},
            {"id": "attachments", "box": (1040, 120, 360, 170), "title": "attachments", "lines": ["stored photos and files", "uploaded_by -> users.id"], "accent": GREEN},
            {"id": "history", "box": (1040, 350, 360, 180), "title": "history and review", "lines": ["status_history", "verification_history", "audit_logs"], "accent": NAVY},
            {"id": "care", "box": (1040, 590, 360, 220), "title": "care and outcomes", "lines": ["treatments, procedures", "ICU encounters", "outcomes and mortality"], "accent": ORANGE},
            {"id": "facility2", "box": (1450, 300, 280, 250), "title": "healthcare_facilities", "lines": ["facility directory", "resource snapshots", "receiving facility FK"], "accent": TEAL},
        ],
        [("ci", "triage", "has"), ("ci", "transport", "has"), ("ci", "facility", "has"), ("ci", "attachments", "has"), ("ci", "history", "tracks"), ("ci", "care", "has"), ("transport", "facility2", "receives"), ("facility", "facility2", "at")],
        "Operational child records are linked by casualty_incident_id; facility-facing records also reference healthcare_facilities.",
    )

    roles = [
        ("03-fr", "Field Responder Schema Scope", "FR creates the initial field record and performs field triage and intervention documentation.", [
            {"id": "u", "box": (70, 360, 300, 180), "title": "users", "lines": ["role = field_responder", "created_by = admin"]},
            {"id": "i", "box": (520, 140, 320, 180), "title": "incidents", "lines": ["assigned incident scope", "triage_mode controls workflow"]},
            {"id": "ci", "box": (520, 420, 320, 210), "title": "casualty_incidents", "lines": ["field casualty report", "identity and location", "encoded_by -> users.id"]},
            {"id": "t", "box": (1040, 140, 350, 180), "title": "triage_assessments", "lines": ["primary triage", "algorithm answers and category"]},
            {"id": "tx", "box": (1040, 390, 350, 180), "title": "casualty_treatments", "lines": ["automatic intervention type", "stabilization time and notes"]},
            {"id": "a", "box": (1040, 640, 350, 160), "title": "attachments and history", "lines": ["photos", "status history"]},
        ], [("u", "i", "scope"), ("u", "ci", "encodes"), ("i", "ci", "includes"), ("ci", "t", "assesses"), ("ci", "tx", "records"), ("ci", "a", "supports")], "FR access is incident-scoped and limited to the field workflow assigned by the admin.", ["casualty_incidents", "casualty_triage_assessments", "casualty_treatments", "attachments", "casualty_status_history"]),
        ("04-amp", "Advanced Medical Responder Schema Scope", "AMP extends an incident casualty record with secondary triage, transport, and receiving-facility information.", [
            {"id": "u", "box": (70, 360, 300, 180), "title": "users", "lines": ["role = sa_responder", "AMP responder account"]},
            {"id": "ci", "box": (520, 360, 340, 210), "title": "casualty_incidents", "lines": ["matched or selected casualty", "current status and verification"]},
            {"id": "t", "box": (1040, 130, 350, 180), "title": "triage_assessments", "lines": ["secondary triage", "category and answers"]},
            {"id": "tr", "box": (1040, 380, 350, 190), "title": "transport_records", "lines": ["patient-for disposition", "departure, arrival, facility"]},
            {"id": "f", "box": (1040, 650, 350, 160), "title": "healthcare_facilities", "lines": ["receiving facility reference", "facility directory"]},
        ], [("u", "ci", "updates"), ("ci", "t", "assesses"), ("ci", "tr", "transports"), ("tr", "f", "receives")], "AMP does not own the person master record; it adds a responder-stage record to the selected incident casualty.", ["casualty_incidents", "casualty_triage_assessments", "casualty_transport_records", "healthcare_facilities"]),
        ("05-mid", "Minor Incident Documenter Schema Scope", "MID uses the incident-scoped casualty reporting path with a reduced mobile workflow and retained identifier fields.", [
            {"id": "u", "box": (70, 360, 300, 180), "title": "users", "lines": ["role = minor_incident_documenter", "created_by = admin"]},
            {"id": "i", "box": (520, 150, 330, 180), "title": "incidents", "lines": ["admin-created incidents only", "same unit scope"]},
            {"id": "c", "box": (520, 440, 330, 190), "title": "casualties", "lines": ["victim code and ID fields", "identity fields retained"]},
            {"id": "ci", "box": (1030, 270, 360, 210), "title": "casualty_incidents", "lines": ["minor incident report", "reported_at and status"]},
            {"id": "a", "box": (1030, 590, 360, 160), "title": "attachments and history", "lines": ["photos when permitted", "status trace"]},
        ], [("u", "i", "scope"), ("u", "ci", "encodes"), ("c", "ci", "identifies"), ("i", "ci", "includes"), ("ci", "a", "supports")], "MID is filtered to incidents created by its admin unit and does not receive the unrestricted admin dashboard scope.", ["users", "incidents", "casualties", "casualty_incidents", "attachments", "casualty_status_history"]),
        ("06-hcfd", "Healthcare Facility Documenter Schema Scope", "HCFD records facility arrival, ED, hospital, ICU, procedure, and resource data for an incident casualty.", [
            {"id": "u", "box": (60, 360, 300, 180), "title": "users", "lines": ["role = documenter", "facility assignment"]},
            {"id": "ci", "box": (490, 360, 340, 210), "title": "casualty_incidents", "lines": ["facility-linked casualty", "pre-transport triage category"]},
            {"id": "hf", "box": (1060, 120, 340, 180), "title": "healthcare_facilities", "lines": ["facility identity and level", "street and resource context"]},
            {"id": "fe", "box": (1060, 360, 340, 190), "title": "facility_encounters", "lines": ["arrived, admitted, discharged", "ED and hospital timestamps"]},
            {"id": "icu", "box": (1060, 620, 340, 150), "title": "ICU and procedures", "lines": ["icu_encounters", "clinical_procedures"]},
        ], [("u", "ci", "updates"), ("hf", "ci", "receives"), ("ci", "fe", "encounter"), ("hf", "fe", "at facility"), ("ci", "icu", "care history")], "HCFD records are facility-scoped; transport ownership remains with AMP workflows.", ["healthcare_facilities", "casualty_incidents", "facility_encounters", "icu_encounters", "clinical_procedures", "facility_resource_snapshots"]),
        ("07-admin", "Administrator Schema Scope", "Admin operates one unit scope: its incidents, created users, mobile submissions, facilities, analytics, and SitReps.", [
            {"id": "u", "box": (60, 330, 320, 220), "title": "users", "lines": ["role = administrator", "created_by relationship", "unit account scope"]},
            {"id": "i", "box": (520, 130, 340, 210), "title": "incidents", "lines": ["create and edit official incidents", "triage mode and closure"]},
            {"id": "ops", "box": (520, 500, 340, 210), "title": "incident operations", "lines": ["timeline, DMMP, safety", "scene clearance, SitRep"]},
            {"id": "records", "box": (1060, 130, 360, 250), "title": "casualty record graph", "lines": ["casualty_incidents", "triage, transport, facility", "attachments and histories"]},
            {"id": "control", "box": (1060, 510, 360, 220), "title": "administrative control", "lines": ["IC delegation and backups", "notifications and audit_logs", "analytics and exports"]},
        ], [("u", "i", "creates"), ("u", "ops", "manages"), ("i", "ops", "has"), ("i", "records", "includes"), ("u", "control", "controls"), ("records", "control", "summarized")], "Admin actions are restricted to incidents created within the administrator's operational scope; user accounts remain separate from record reset operations.", ["users", "incidents", "casualty_incidents", "incident_response_timelines", "sitreps", "incident_ic_delegations", "audit_logs"]),
        ("08-super-admin", "Super Administrator Schema Scope", "Super Admin has system-wide visibility and manages administrator accounts and cross-unit operational data.", [
            {"id": "sa", "box": (60, 350, 320, 200), "title": "users", "lines": ["role = super_admin", "administrator account management", "global scope"]},
            {"id": "admins", "box": (520, 130, 350, 190), "title": "admin units", "lines": ["administrator users", "created_by hierarchy", "active status"]},
            {"id": "inc", "box": (520, 430, 350, 210), "title": "all incidents", "lines": ["cross-admin incident list", "status and closure control"]},
            {"id": "data", "box": (1060, 130, 360, 260), "title": "all operational data", "lines": ["casualty and mobile records", "triage, transport, facility", "response operations"]},
            {"id": "audit", "box": (1060, 500, 360, 190), "title": "system oversight", "lines": ["audit_logs", "global analytics", "backup and restore scope"]},
        ], [("sa", "admins", "manages"), ("sa", "inc", "views"), ("admins", "inc", "owns"), ("inc", "data", "includes"), ("sa", "audit", "oversees")], "Super Admin scope spans administrator units; account identities remain distinct from operational incident and casualty records.", ["users", "incidents", "casualty_incidents", "audit_logs", "sitreps", "notifications"]),
        ("09-ro", "Responsible Officer Schema Scope", "Responsible Officer is a web-only oversight role for Incident Management and Incident Analytics without incident delegation.", [
            {"id": "u", "box": (70, 360, 320, 190), "title": "users", "lines": ["role = responsible_officer", "created by administrator"]},
            {"id": "i", "box": (540, 170, 350, 200), "title": "incidents", "lines": ["authorized incident visibility", "no ownership transfer"]},
            {"id": "records", "box": (540, 500, 350, 190), "title": "operational records", "lines": ["read incident data", "casualty and response summaries"]},
            {"id": "analytics", "box": (1100, 330, 360, 220), "title": "analytics views", "lines": ["incident analytics", "KPIs and charts", "no mobile authoring"]},
        ], [("u", "i", "authorized"), ("i", "records", "summarizes"), ("records", "analytics", "aggregates")], "RO access is intentionally narrower than Admin access: oversight and analytics only.", ["users", "incidents", "casualty_incidents", "incident_response_timelines"]),
    ]

    for name, title, subtitle, nodes, edges, legend, _ in roles:
        diagram(name, title, subtitle, nodes, edges, legend)

    doc = Document()
    configure_doc(doc)

    title = doc.add_paragraph(style="Title")
    title.add_run("SCRIBER Overall Database Schema Design")
    subtitle = doc.add_paragraph()
    subtitle.paragraph_format.space_after = Pt(16)
    run = subtitle.add_run("Role-specific data relationships for Field Responder, AMP, MID, HCFD, Administrator, Super Admin, and Responsible Officer workflows")
    run.font.size = Pt(12)
    run.font.color.rgb = docx_color(MUTED)
    add_body(doc, "This document presents the database structure used by SCRIBER and separates the overall relationship model from the operational scope of each account role. The diagrams are intentionally simplified for readability: they show the tables and foreign-key relationships that define each workflow, while the accompanying tables identify the main records stored in each area.")
    add_table(doc, ["Document item", "Coverage"], [
        ("Overall schema", "Core entities and supporting operational tables"),
        ("Role figures", "FR, AMP, MID, HCFD, Admin, Super Admin, and RO"),
        ("Relationship notation", "PK, FK, parent-child records, and scope boundaries"),
        ("Access interpretation", "Primary workflow ownership and visibility scope; not a replacement for API authorization rules"),
    ], [1.9, 8.0])
    add_heading(doc, "How to read the diagrams", 1)
    add_bullets(doc, [
        "A box represents a database table or a closely related table group.",
        "An arrow shows the principal relationship used by the workflow. For example, an incident includes many casualty incident records.",
        "The user table is the application profile table linked to the authenticated account. created_by, encoded_by, recorded_by, reviewed_by, and similar columns point back to users.id.",
        "The role figures describe operational scope. They do not imply that a role can write every column in every table shown.",
    ])
    doc.add_page_break()

    add_heading(doc, "1 Overall schema", 1)
    add_figure(doc, core, "Figure 1. Core SCRIBER relationship model")
    add_body(doc, "The core design keeps person identity separate from the incident-specific report. casualties stores the person-level identity and demographic information, while casualty_incidents represents that person's report in a particular incident. This allows one person record to remain distinct from the operational history of each incident. incidents is the parent for incident-wide response operations, analytics inputs, and SitRep generation.")
    add_table(doc, ["Core table", "Purpose", "Important relationships"], [
        ("users", "Authenticated profile, role, account status, and creator hierarchy", "Self-reference through created_by; referenced by most audit and author columns"),
        ("incidents", "Official incident, status, triage mode, and ownership", "created_by -> users; parent of incident-wide and casualty records"),
        ("casualties", "Person identity and demographic master record", "Referenced by casualty_incidents.casualty_id"),
        ("casualty_incidents", "Central report for one casualty inside one incident", "incident_id and casualty_id; parent of triage, transport, facility, and history records"),
    ], [1.8, 4.0, 4.1])
    doc.add_page_break()

    add_heading(doc, "2 Supporting operational schema", 1)
    add_figure(doc, extensions, "Figure 2. Supporting operational and clinical relationships")
    add_body(doc, "Supporting tables extend the central casualty incident record. Triage records preserve the decision system, stage, answers, and calculated category. Transport records preserve patient disposition and timestamps. Facility, ICU, procedure, treatment, and outcome records provide the downstream care history. Attachments and history tables preserve evidence, review status, and traceability without duplicating the core casualty or incident row.")
    add_table(doc, ["Table group", "Representative tables", "Relationship anchor"], [
        ("Field and triage", "casualty_triage_assessments, casualty_treatments", "casualty_incident_id"),
        ("Transport and facility", "casualty_transport_records, facility_encounters, healthcare_facilities", "casualty_incident_id and facility IDs"),
        ("Clinical care", "icu_encounters, clinical_procedures, casualty_outcomes", "casualty_incident_id"),
        ("Evidence and governance", "attachments, casualty_status_history, casualty_verification_history, audit_logs", "casualty_incident_id, user IDs, and entity IDs"),
        ("Incident operations", "incident_response_timelines, DMMP staff call-downs, responder safety, EMS arrivals, SitReps", "incident_id"),
    ], [2.0, 4.2, 3.7])
    doc.add_page_break()

    role_sections = {
        "03-fr": ("3 Field Responder", "FR creates the initial field casualty record, completes the assigned triage workflow, records interventions, and attaches evidence when permitted."),
        "04-amp": ("4 Advanced Medical Responder", "AMP continues the incident casualty record with secondary assessment and transport or receiving-facility information."),
        "05-mid": ("5 Minor Incident Documenter", "MID receives a reduced incident-scoped mobile workflow while retaining the identifier fields needed to connect the report to the incident."),
        "06-hcfd": ("6 Healthcare Facility Documenter", "HCFD records the facility-side encounter and resource information without taking ownership of the transport workflow."),
        "07-admin": ("7 Administrator", "Admin manages one operational unit, its official incidents, created mobile accounts, incident analytics, and final SitReps."),
        "08-super-admin": ("8 Super Admin", "Super Admin manages administrator accounts and has cross-unit visibility for system oversight and data governance."),
        "09-ro": ("9 Responsible Officer", "RO provides web-based incident management and analytics access without incident delegation or mobile authoring."),
    }
    for index, (name, heading_text, intro) in enumerate([(x[0], role_sections[x[0]][0], role_sections[x[0]][1]) for x in [
        ("03-fr",), ("04-amp",), ("05-mid",), ("06-hcfd",), ("07-admin",), ("08-super-admin",), ("09-ro",)
    ]]):
        role = next(r for r in roles if r[0] == name)
        _, _, _, nodes, edges, legend, table_rows = role
        add_heading(doc, heading_text, 1)
        add_body(doc, intro)
        add_figure(doc, FIG / f"{name}.png", f"Figure {index + 3}. {heading_text} data scope")
        add_body(doc, legend)
        add_table(doc, ["Primary table or group", "Role-specific use"], [(row, "Primary workflow record or filtered supporting data for this role") for row in table_rows], [3.6, 6.5])
        if name != "09-ro":
            doc.add_page_break()

    add_heading(doc, "10 Role scope summary", 1)
    add_body(doc, "The role figures show a shared relational model with different authorization boundaries. FR, AMP, MID, and HCFD accounts work against the incidents assigned to their administrator unit. Admin operates the unit and its official incidents. Super Admin operates across administrator units. RO is a controlled web oversight role rather than an incident owner.")
    add_table(doc, ["Role", "Primary interface", "Main data responsibility", "Scope"], [
        ("Field Responder", "Mobile", "Field casualty report, triage, intervention, attachments", "Assigned incidents in admin unit"),
        ("AMP", "Mobile", "Secondary triage, transport, receiving-facility data", "Assigned incidents in admin unit"),
        ("MID", "Mobile", "Reduced casualty documentation and identifiers", "Admin-created incidents only"),
        ("HCFD", "Mobile", "Facility encounter and hospital resource data", "Assigned facility and incidents"),
        ("Administrator", "Web", "Official incidents, users, analytics, SitReps, governance", "Own administrator unit"),
        ("Super Admin", "Web", "Account management, global oversight, backup and restore governance", "All administrator units"),
        ("Responsible Officer", "Web", "Incident management and analytics review", "Authorized incident visibility"),
    ], [1.55, 1.1, 4.5, 2.95])
    add_heading(doc, "11 Implementation notes", 1)
    add_bullets(doc, [
        "The diagrams use the current table names and role names represented in the SCRIBER API and database design files.",
        "The central foreign-key relationship for mobile casualty work is casualty_incidents.id. Role-specific records should attach to that row rather than creating separate casualty master records.",
        "Incident-wide records use incident_id. This includes response timelines, DMMP and staff call-downs, responder safety, EMS arrivals, facility resource snapshots, and SitReps.",
        "Account and role scope is enforced by the application authorization layer in addition to the relational links shown here.",
        "The diagrams are designed as documentation figures and should be updated when a migration adds or changes a table, foreign key, enum, or role scope.",
    ])

    output = OUT / "SCRIBER_Overall_Database_Schema_Design.docx"
    doc.save(output)
    print(output)


if __name__ == "__main__":
    build()
