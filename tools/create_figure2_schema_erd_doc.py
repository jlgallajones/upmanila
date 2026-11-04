from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"C:\Users\jlgallajones\upmanila\disaster-casualty-system")
OUT = ROOT / "output" / "docx"
FIG = ROOT / "tmp" / "figure2-erd"
OUT.mkdir(parents=True, exist_ok=True)
FIG.mkdir(parents=True, exist_ok=True)

NAVY = "#16324F"
TEAL = "#00838F"
PALE_BLUE = "#EEF5FA"
PALE_TEAL = "#E9F7F8"
PALE_GOLD = "#FFF7E8"
PALE_GRAY = "#F5F7F9"
BORDER = "#B9C9D6"
TEXT = "#243447"
MUTED = "#5E6C7B"
WHITE = "#FFFFFF"

FONT_DIR = Path(r"C:\Windows\Fonts")
REGULAR = str(FONT_DIR / "segoeui.ttf")
BOLD = str(FONT_DIR / "segoeuib.ttf")


def img_font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REGULAR, size)


def doc_color(value):
    return RGBColor.from_string(value.replace("#", ""))


def wrap_text(text, width):
    return wrap(text, width=width, break_long_words=False, break_on_hyphens=False)


def entity(draw, item):
    x, y, w, h = item["box"]
    fill = item.get("fill", PALE_BLUE)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=14, fill=fill, outline=BORDER, width=3)
    draw.rectangle((x, y, x + w, y + 52), fill=NAVY)
    draw.text((x + 18, y + 15), item["title"], font=img_font(24, True), fill=WHITE)
    current = y + 70
    for field in item.get("fields", []):
        prefix = "PK " if field.startswith("PK ") else "FK " if field.startswith("FK ") else ""
        label = field[len(prefix):] if prefix else field
        color = TEAL if prefix == "PK " else "#8A5A00" if prefix == "FK " else TEXT
        draw.text((x + 18, current), prefix, font=img_font(17, True), fill=color)
        draw.text((x + 18 + (34 if prefix else 0), current), label, font=img_font(17), fill=TEXT)
        current += 26


def connector(draw, start, end, label, label_pos=None, color=TEAL):
    sx, sy = start
    ex, ey = end
    if abs(ex - sx) > abs(ey - sy):
        mid_x = (sx + ex) // 2
        points = [(sx, sy), (mid_x, sy), (mid_x, ey), (ex, ey)]
    else:
        mid_y = (sy + ey) // 2
        points = [(sx, sy), (sx, mid_y), (ex, mid_y), (ex, ey)]
    draw.line(points, fill=color, width=4, joint="curve")
    dx, dy = ex - points[-2][0], ey - points[-2][1]
    if abs(dx) >= abs(dy):
        tip = (ex, ey)
        base = (ex - (16 if dx > 0 else -16), ey)
        arrow = [tip, (base[0], base[1] - 8), (base[0], base[1] + 8)]
    else:
        tip = (ex, ey)
        base = (ex, ey - (16 if dy > 0 else -16))
        arrow = [tip, (base[0] - 8, base[1]), (base[0] + 8, base[1])]
    draw.polygon(arrow, fill=color)
    lx, ly = label_pos or ((sx + ex) // 2, (sy + ey) // 2)
    tw = max(66, len(label) * 10 + 20)
    draw.rounded_rectangle((lx - tw // 2, ly - 17, lx + tw // 2, ly + 17), radius=9, fill=WHITE, outline=BORDER, width=2)
    draw.text((lx, ly), label, font=img_font(16, True), fill=MUTED, anchor="mm")


def draw_diagram(path, title, subtitle, nodes, edges, footer):
    width, height = 3000, 1850
    image = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 118), fill=NAVY)
    draw.text((52, 25), title, font=img_font(36, True), fill=WHITE)
    draw.text((52, 75), subtitle, font=img_font(21), fill="#DDEAF2")

    for edge in edges:
        connector(draw, edge[0], edge[1], edge[2], edge[3] if len(edge) > 3 else None)
    for item in nodes:
        entity(draw, item)

    draw.rounded_rectangle((52, height - 84, width - 52, height - 32), radius=12, fill=PALE_GRAY, outline=BORDER, width=2)
    draw.text((74, height - 58), footer, font=img_font(17), fill=MUTED, anchor="lm")
    image.save(path, dpi=(240, 240))
    return path


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill.replace("#", ""))


def set_cell_border(cell, color="#C6D2DC", size="8"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = qn(f"w:{edge}")
        element = borders.find(tag)
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color.replace("#", ""))


def set_cell_margins(cell, top=90, start=120, bottom=90, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    margins = tc_pr.first_child_found_in("w:tcMar")
    if margins is None:
        margins = OxmlElement("w:tcMar")
        tc_pr.append(margins)
    for key, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = margins.find(qn(f"w:{key}"))
        if node is None:
            node = OxmlElement(f"w:{key}")
            margins.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def add_table(doc, headers, rows, widths):
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        set_cell_shading(cell, NAVY)
        set_cell_border(cell)
        set_cell_margins(cell)
        cell.width = Inches(widths[i])
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(header)
        r.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = doc_color(WHITE)
    for row_index, values in enumerate(rows):
        row = table.add_row()
        for i, value in enumerate(values):
            cell = row.cells[i]
            set_cell_shading(cell, "F8FBFD" if row_index % 2 == 0 else WHITE)
            set_cell_border(cell)
            set_cell_margins(cell)
            cell.width = Inches(widths[i])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            r = p.add_run(str(value))
            r.font.size = Pt(8.5)
            r.font.color.rgb = doc_color(TEXT)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_heading(doc, text, level=1):
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.space_before = Pt(10 if level == 1 else 7)
    p.paragraph_format.space_after = Pt(4)
    p.add_run(text)


def add_body(doc, text):
    p = doc.add_paragraph(style="Body Text")
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.08
    p.add_run(text)


def add_figure(doc, path, caption):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(3)
    p.add_run().add_picture(str(path), width=Inches(10.2))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(7)
    r = cap.add_run(caption)
    r.bold = True
    r.font.size = Pt(9)
    r.font.color.rgb = doc_color("5E6C7B")


def set_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    run.font.size = Pt(8)
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_end)


def build():
    figure_a = draw_diagram(
        FIG / "figure-2a-casualty-report-erd.png",
        "Figure 2A  Casualty report extensions",
        "Entity relationship diagram for the incident report and its clinical, transport, history and evidence records",
        [
            {"title": "INCIDENTS", "box": (1220, 155, 430, 225), "fields": ["PK id", "incident_code", "incident_name", "status", "started_at", "ended_at"]},
            {"title": "CASUALTIES", "box": (90, 490, 440, 220), "fields": ["PK id", "id_number", "identification_status", "first_name / last_name", "estimated_age", "sex"]},
            {"title": "CASUALTY_INCIDENTS", "box": (1180, 485, 520, 260), "fill": PALE_TEAL, "fields": ["PK id", "FK casualty_id", "FK incident_id", "client_record_id UNIQUE", "current_status", "verification_status", "encoded_by"]},
            {"title": "HEALTHCARE_FACILITIES", "box": (2260, 490, 560, 220), "fields": ["PK id", "facility_name", "facility_level", "street", "is_active", "created_by"]},
            {"title": "CASUALTY_TRIAGE_ASSESSMENTS", "box": (70, 855, 535, 250), "fields": ["PK id", "FK casualty_incident_id", "triage_system", "triage_stage", "triage_category", "triaged_by", "triaged_at"]},
            {"title": "CASUALTY_TRANSPORT_RECORDS", "box": (665, 855, 535, 250), "fields": ["PK id", "FK casualty_incident_id", "transport_required", "transport_mode", "ems_unit_type", "FK receiving_facility_id"]},
            {"title": "CASUALTY_TREATMENTS", "box": (1260, 855, 500, 225), "fields": ["PK id", "FK casualty_incident_id", "treatment_strategy", "stabilized_at", "notes"]},
            {"title": "FACILITY_ENCOUNTERS", "box": (1820, 855, 495, 225), "fields": ["PK id", "FK casualty_incident_id", "FK facility_id", "arrived_at", "admitted_to_hospital"]},
            {"title": "ATTACHMENTS", "box": (2375, 855, 445, 225), "fields": ["PK id", "FK casualty_incident_id", "file_name", "storage_path", "uploaded_by"]},
            {"title": "STATUS / VERIFICATION HISTORY", "box": (90, 1260, 560, 230), "fields": ["PK id", "FK casualty_incident_id", "status or decision", "reason", "actor_id", "created_at"]},
            {"title": "CLINICAL_PROCEDURES", "box": (760, 1260, 485, 230), "fields": ["PK id", "FK casualty_incident_id", "FK facility_id optional", "procedure_type", "performed_at"]},
            {"title": "ICU_ENCOUNTERS", "box": (1355, 1260, 455, 230), "fields": ["PK id", "FK casualty_incident_id", "FK facility_id optional", "admitted_at", "discharged_at"]},
            {"title": "CASUALTY_OUTCOMES", "box": (1920, 1260, 420, 230), "fields": ["PK id", "FK casualty_incident_id UNIQUE", "final_outcome", "recorded_at"]},
            {"title": "CASUALTY_CASE_LINKS", "box": (2450, 1260, 370, 230), "fields": ["PK id", "case_id", "FK casualty_incident_id UNIQUE", "role UNIQUE per case", "linked_by"]},
        ],
        [
            ((1435, 380), (1440, 485), "1 : N", (1510, 430)),
            ((530, 600), (1180, 600), "1 : N", (850, 565)),
            ((1435, 745), (1435, 855), "1 : N", (1485, 800)),
            ((1700, 610), (2260, 610), "N : 1", (1980, 565)),
            ((1280, 745), (335, 855), "1 : N", (830, 790)),
            ((1300, 745), (930, 855), "1 : N", (1110, 800)),
            ((1435, 745), (1510, 855), "1 : N", (1470, 800)),
            ((1570, 745), (2065, 855), "1 : N", (1810, 800)),
            ((1620, 745), (2595, 855), "1 : N", (2170, 800)),
            ((360, 1105), (360, 1260), "1 : N", (420, 1180)),
            ((920, 1105), (1000, 1260), "1 : N", (1010, 1180)),
            ((1510, 1080), (1580, 1260), "1 : N", (1600, 1170)),
            ((2020, 1080), (2110, 1260), "1 : 1", (2150, 1170)),
            ((2570, 1080), (2630, 1260), "1 : N", (2680, 1170)),
        ],
        "Solid connectors show declared foreign-key relationships. UNIQUE report links are marked in the entity fields.",
    )

    figure_b = draw_diagram(
        FIG / "figure-2b-incident-operations-erd.png",
        "Figure 2B  Incident operations and support",
        "Entity relationship diagram for incident-level operations, staffing, accountability and administrative support",
        [
            {"title": "USERS", "box": (70, 160, 450, 245), "fill": PALE_GOLD, "fields": ["PK id", "full_name", "email", "role", "reporting_context", "created_by FK", "is_active"]},
            {"title": "INCIDENTS", "box": (1260, 160, 470, 245), "fill": PALE_TEAL, "fields": ["PK id", "incident_code", "incident_name", "status", "started_at", "ended_at", "created_by FK"]},
            {"title": "CALL_DOWN_STAFF", "box": (2450, 160, 430, 245), "fields": ["PK id", "full_name", "role_position", "linked_user_id FK", "created_by FK", "is_active"]},
            {"title": "INCIDENT_RESPONSE_TIMELINES", "box": (70, 560, 510, 240), "fields": ["PK id", "FK incident_id UNIQUE", "event timestamps", "triage / transport order", "updated_at"]},
            {"title": "DMMP_STAFF_CALL_DOWNS", "box": (650, 560, 500, 240), "fields": ["PK id", "FK incident_id", "staff / user link", "status", "called_at", "arrived_at"]},
            {"title": "MEDICAL_COORDINATION_ASSESSMENTS", "box": (1220, 560, 550, 240), "fields": ["PK id", "FK incident_id UNIQUE", "rating", "assessment", "assessed_by", "assessed_at"]},
            {"title": "CONTINUITY_OF_CARE_ASSESSMENTS", "box": (1840, 560, 540, 240), "fields": ["PK id", "FK incident_id UNIQUE", "disruption status", "notes", "assessed_by", "assessed_at"]},
            {"title": "EMS_VEHICLE_ARRIVALS", "box": (2450, 560, 430, 240), "fields": ["PK id", "FK incident_id", "provider", "vehicle_type", "arrival_at"]},
            {"title": "FACILITY_RESOURCE_SNAPSHOTS", "box": (70, 985, 530, 240), "fields": ["PK id", "FK incident_id", "FK facility_id optional", "resource values", "captured_at"]},
            {"title": "SITREPS", "box": (680, 985, 480, 240), "fields": ["PK id", "FK incident_id", "report_number", "generated_by FK", "approved_by FK", "status"]},
            {"title": "RESPONDER_SAFETY_REPORTS", "box": (1240, 985, 500, 240), "fields": ["PK id", "FK incident_id", "summary", "reported_by FK", "created_at"]},
            {"title": "RESPONDER_SAFETY_RESPONSES", "box": (1815, 985, 530, 240), "fields": ["PK id", "FK safety_report_id", "FK responder_id", "safe status", "arrival_at", "ppe_at"]},
            {"title": "INCIDENT_IC_BACKUPS", "box": (2420, 985, 460, 240), "fields": ["PK id", "FK incident_id", "FK user_id", "priority", "is_active"]},
            {"title": "INCIDENT_IC_DELEGATIONS", "box": (70, 1400, 540, 220), "fields": ["PK id", "FK incident_id", "delegated_to FK", "delegated_by FK", "delegated_at", "resumed_at"]},
            {"title": "FORM_DRAFTS / NOTIFICATIONS", "box": (720, 1400, 500, 220), "fill": PALE_GRAY, "fields": ["PK id", "FK user_id", "payload or message", "status / read_at", "created_at"]},
            {"title": "AUDIT_LOGS", "box": (1330, 1400, 480, 220), "fill": PALE_GRAY, "fields": ["PK id", "actor_id FK", "action", "entity_type", "entity_id", "metadata"]},
            {"title": "HEALTHCARE_FACILITIES", "box": (1920, 1400, 470, 220), "fields": ["PK id", "facility_name", "facility_level", "street", "created_by FK"]},
            {"title": "EVACUATION_CENTERS", "box": (2500, 1400, 380, 220), "fields": ["PK id", "FK incident_id", "center_name", "capacity", "is_active"]},
        ],
        [
            ((520, 280), (1260, 280), "creates / manages", (900, 235)),
            ((1730, 280), (2450, 280), "uses staff", (2100, 235)),
            ((1495, 405), (325, 560), "1 : 1", (840, 465)),
            ((1495, 405), (900, 560), "1 : N", (1120, 465)),
            ((1495, 405), (1495, 560), "1 : 1", (1590, 485)),
            ((1495, 405), (2110, 560), "1 : 1", (1870, 465)),
            ((1730, 300), (2665, 560), "1 : N", (2200, 455)),
            ((1495, 405), (335, 985), "1 : N", (1210, 720)),
            ((1495, 405), (920, 985), "1 : N", (1350, 720)),
            ((1495, 405), (1490, 985), "1 : N", (1660, 720)),
            ((1495, 405), (2080, 985), "1 : N", (1950, 720)),
            ((1495, 405), (2650, 985), "1 : N", (2250, 720)),
            ((1495, 405), (340, 1400), "1 : N", (1040, 1160)),
            ((520, 280), (970, 1400), "owns drafts / notices", (690, 1020)),
            ((520, 300), (1570, 1400), "actor", (730, 1270)),
            ((1495, 405), (2150, 1400), "facility link", (1800, 1235)),
            ((1495, 405), (2690, 1400), "1 : N", (2220, 1260)),
            ((1495, 405), (2650, 985), "backup IC", (2220, 850)),
        ],
        "Incident-level tables use incident_id as their scope anchor; user-linked tables preserve accountability and access context.",
    )

    doc = Document()
    section = doc.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width = Inches(11.69)
    section.page_height = Inches(8.27)
    section.top_margin = Inches(0.55)
    section.bottom_margin = Inches(0.55)
    section.left_margin = Inches(0.65)
    section.right_margin = Inches(0.65)

    normal = doc.styles["Normal"]
    normal.font.name = "Segoe UI"
    normal.font.size = Pt(9.5)
    normal.font.color.rgb = doc_color(TEXT)
    for style_name, size in (("Title", 22), ("Heading 1", 15), ("Heading 2", 11)):
        style = doc.styles[style_name]
        style.font.name = "Segoe UI"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = doc_color("000000")

    title = doc.add_paragraph(style="Title")
    title.paragraph_format.space_after = Pt(2)
    title.add_run("SCRIBER Figure 2 Extended Schema Entity Relationship Diagram")
    subtitle = doc.add_paragraph()
    subtitle.paragraph_format.space_after = Pt(8)
    r = subtitle.add_run("Replacement figure for the report extensions and incident operational entities")
    r.font.size = Pt(10)
    r.font.color.rgb = doc_color(MUTED)

    add_body(doc, "This document replaces the previous Figure 2 relationship summary with an entity relationship design. Each entity is shown as a table-shaped node with its primary key, important foreign keys and representative attributes. Connector labels show the intended cardinality or relationship purpose. The diagram is split into two readable figures so the database relationships can be reviewed without reducing the text to an unreadable scale.")

    add_heading(doc, "Figure 2A Casualty report extensions", 1)
    add_body(doc, "The casualty report is anchored by casualty_incidents. It links a person in casualties to an incident and then collects the report history, triage assessments, transport, treatment, facility encounters, clinical procedures, ICU episodes, outcomes, case links and attachments. casualty_outcomes has at most one linked row per report, and casualty_case_links has at most one linked row per report in the reviewed definitions.")
    add_figure(doc, figure_a, "Figure 2A Casualty report extensions entity relationship diagram")

    add_heading(doc, "Figure 2B Incident operations and support", 1)
    add_body(doc, "Incident operations are scoped from incidents. Timeline, staffing, coordination, continuity, EMS arrival, resource, SitRep, safety, backup and delegation records therefore remain associated with the incident that they describe. Users and support tables provide ownership, accountability, drafts, notifications and audit history without being mixed into the casualty report entity itself.")
    add_figure(doc, figure_b, "Figure 2B Incident operations and support entity relationship diagram")

    add_heading(doc, "Relationship notes", 1)
    rows = [
        ("incidents to casualty_incidents", "One incident can contain many casualty reports; every report belongs to one incident."),
        ("casualties to casualty_incidents", "A person identity is kept separate from the incident-specific report describing that person."),
        ("casualty_incidents to report extensions", "Triage, transport, treatment, encounter, procedure, ICU, status, verification and attachment rows reference the report."),
        ("incidents to operational extensions", "Operational assessment, timeline, staffing, EMS, resource, SitRep, safety and continuity rows reference the incident."),
        ("users to accountability tables", "User foreign keys identify creators, encoders, reviewers, assessors, delegates and audit actors."),
        ("facilities to care records", "Healthcare facilities are referenced by transport, facility encounters, clinical procedures, ICU encounters and resource snapshots."),
        ("case links and outcomes", "The reviewed definitions declare a unique casualty_incident_id for each linked outcome and each case-link row."),
    ]
    add_table(doc, ["Relationship", "Design interpretation"], rows, [3.0, 7.0])

    add_heading(doc, "Source and scope", 1)
    add_body(doc, "The diagram is based on the reviewed schema catalog, database ERD, SQL migrations and the supplied Figure 2 relationship notes. It presents the logical design and important relationships; exact live column definitions, policies, indexes and migration order remain governed by the deployed database baseline and migration files.")
    set_page_number(section.footer.paragraphs[0])

    output = OUT / "SCRIBER_Figure_2_Extended_Schema_ERD.docx"
    doc.save(output)
    print(output)


if __name__ == "__main__":
    build()
