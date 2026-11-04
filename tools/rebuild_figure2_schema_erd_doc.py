from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

from create_figure2_schema_erd_doc import (
    BORDER,
    FIG,
    MUTED,
    NAVY,
    OUT,
    PALE_BLUE,
    PALE_GOLD,
    PALE_GRAY,
    PALE_TEAL,
    TEAL,
    TEXT,
    WHITE,
    add_body,
    add_figure,
    add_heading,
    add_table,
    doc_color,
    set_page_number,
)


FONT_DIR = Path(r"C:\Windows\Fonts")
REGULAR = str(FONT_DIR / "segoeui.ttf")
BOLD = str(FONT_DIR / "segoeuib.ttf")


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REGULAR, size)


def draw_entity(draw, item):
    x, y, w, h = item["box"]
    fill = item.get("fill", PALE_BLUE)
    title_lines = wrap(item["title"], width=27, break_long_words=False, break_on_hyphens=False)
    header_h = 86 if len(title_lines) == 1 else 122
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=fill, outline=BORDER, width=5)
    draw.rectangle((x, y, x + w, y + header_h), fill=NAVY)
    for index, line in enumerate(title_lines[:2]):
        draw.text((x + 28, y + 18 + index * 38), line, font=font(32, True), fill=WHITE)
    current = y + header_h + 28
    for field in item.get("fields", []):
        prefix = "PK " if field.startswith("PK ") else "FK " if field.startswith("FK ") else ""
        label = field[len(prefix):] if prefix else field
        color = TEAL if prefix == "PK " else "#8A5A00" if prefix == "FK " else TEXT
        draw.text((x + 28, current), prefix, font=font(25, True), fill=color)
        draw.text((x + 28 + (43 if prefix else 0), current), label, font=font(25), fill=TEXT)
        current += 36


def draw_connector(draw, start, end, label, label_pos=None):
    sx, sy = start
    ex, ey = end
    if abs(ex - sx) > abs(ey - sy):
        mid_x = (sx + ex) // 2
        points = [(sx, sy), (mid_x, sy), (mid_x, ey), (ex, ey)]
    else:
        mid_y = (sy + ey) // 2
        points = [(sx, sy), (sx, mid_y), (ex, mid_y), (ex, ey)]
    draw.line(points, fill=TEAL, width=7, joint="curve")
    dx, dy = ex - points[-2][0], ey - points[-2][1]
    if abs(dx) >= abs(dy):
        base_x = ex - (26 if dx > 0 else -26)
        arrow = [(ex, ey), (base_x, ey - 13), (base_x, ey + 13)]
    else:
        base_y = ey - (26 if dy > 0 else -26)
        arrow = [(ex, ey), (ex - 13, base_y), (ex + 13, base_y)]
    draw.polygon(arrow, fill=TEAL)
    lx, ly = label_pos or ((sx + ex) // 2, (sy + ey) // 2)
    width = max(130, len(label) * 16 + 36)
    draw.rounded_rectangle((lx - width // 2, ly - 25, lx + width // 2, ly + 25), radius=12, fill=WHITE, outline=BORDER, width=3)
    draw.text((lx, ly), label, font=font(24, True), fill=MUTED, anchor="mm")


def diagram(name, title, subtitle, nodes, edges, footer):
    width, height = 4200, 2800
    image = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 150), fill=NAVY)
    draw.text((72, 30), title, font=font(52, True), fill=WHITE)
    draw.text((72, 94), subtitle, font=font(27), fill="#DDEAF2")
    for edge in edges:
        draw_connector(draw, edge[0], edge[1], edge[2], edge[3] if len(edge) > 3 else None)
    for item in nodes:
        draw_entity(draw, item)
    draw.rounded_rectangle((72, height - 100, width - 72, height - 38), radius=14, fill=PALE_GRAY, outline=BORDER, width=3)
    draw.text((100, height - 69), footer, font=font(23), fill=MUTED, anchor="lm")
    output = FIG / f"{name}.png"
    image.save(output, dpi=(480, 480))
    return output


def build():
    figure_a = diagram(
        "figure-2a-casualty-report-erd-readable",
        "Figure 2A  Casualty report core and care records",
        "The incident report joins a casualty to an incident and owns the report-level care records",
        [
            {"title": "INCIDENTS", "box": (1600, 220, 1000, 390), "fields": ["PK id", "incident_code", "incident_name", "status", "started_at", "ended_at"]},
            {"title": "CASUALTIES", "box": (170, 760, 1000, 390), "fields": ["PK id", "id_number", "identification_status", "first_name / last_name", "estimated_age", "sex"]},
            {"title": "CASUALTY_INCIDENTS", "box": (1600, 760, 1000, 475), "fill": PALE_TEAL, "fields": ["PK id", "FK casualty_id", "FK incident_id", "client_record_id UNIQUE", "current_status", "verification_status", "encoded_by"]},
            {"title": "HEALTHCARE_FACILITIES", "box": (3030, 760, 1000, 390), "fields": ["PK id", "facility_name", "facility_level", "street", "is_active", "created_by"]},
            {"title": "CASUALTY_TRIAGE_ASSESSMENTS", "box": (100, 1510, 900, 430), "fields": ["PK id", "FK casualty_incident_id", "triage_system", "triage_stage", "triage_category", "triaged_by", "triaged_at"]},
            {"title": "CASUALTY_TRANSPORT_RECORDS", "box": (1100, 1510, 900, 430), "fields": ["PK id", "FK casualty_incident_id", "transport_required", "transport_mode", "ems_unit_type", "FK receiving_facility_id"]},
            {"title": "CASUALTY_TREATMENTS", "box": (2100, 1510, 900, 360), "fields": ["PK id", "FK casualty_incident_id", "treatment_strategy", "stabilized_at", "notes"]},
            {"title": "FACILITY_ENCOUNTERS", "box": (3100, 1510, 900, 360), "fields": ["PK id", "FK casualty_incident_id", "FK facility_id", "arrived_at", "admitted_to_hospital"]},
        ],
        [
            ((2100, 610), (2100, 760), "1 : N", (2220, 685)),
            ((1170, 955), (1600, 955), "1 : N", (1380, 900)),
            ((2600, 955), (3030, 955), "N : 1", (2800, 900)),
            ((1750, 1235), (550, 1510), "1 : N", (1120, 1375)),
            ((1900, 1235), (1550, 1510), "1 : N", (1800, 1375)),
            ((2100, 1235), (2550, 1510), "1 : N", (2250, 1375)),
            ((2450, 1235), (3550, 1510), "1 : N", (2850, 1375)),
        ],
        "PK marks a primary key. FK marks a foreign key. UNIQUE indicates a one-row-per-report constraint where declared.",
    )

    figure_b = diagram(
        "figure-2b-report-history-clinical-erd-readable",
        "Figure 2B  Report history and clinical extensions",
        "Additional records preserve the report history, verification, procedures, ICU care, outcomes and case matching",
        [
            {"title": "CASUALTY_INCIDENTS", "box": (1600, 220, 1000, 430), "fill": PALE_TEAL, "fields": ["PK id", "FK casualty_id", "FK incident_id", "current_status", "verification_status", "reported_at"]},
            {"title": "STATUS_HISTORY", "box": (100, 900, 900, 380), "fields": ["PK id", "FK casualty_incident_id", "status", "reason", "actor_id", "created_at"]},
            {"title": "VERIFICATION_HISTORY", "box": (1100, 900, 900, 380), "fields": ["PK id", "FK casualty_incident_id", "decision", "reviewer_id", "notes", "created_at"]},
            {"title": "CLINICAL_PROCEDURES", "box": (2100, 900, 900, 380), "fields": ["PK id", "FK casualty_incident_id", "FK facility_id optional", "procedure_type", "performed_at"]},
            {"title": "ICU_ENCOUNTERS", "box": (3100, 900, 900, 380), "fields": ["PK id", "FK casualty_incident_id", "FK facility_id optional", "admitted_at", "discharged_at"]},
            {"title": "CASUALTY_OUTCOMES", "box": (600, 1660, 900, 360), "fields": ["PK id", "FK casualty_incident_id UNIQUE", "final_outcome", "recorded_at"]},
            {"title": "CASUALTY_CASE_LINKS", "box": (1700, 1660, 900, 360), "fields": ["PK id", "case_id", "FK casualty_incident_id UNIQUE", "role UNIQUE per case", "linked_by"]},
            {"title": "ATTACHMENTS", "box": (2800, 1660, 900, 360), "fields": ["PK id", "FK casualty_incident_id", "file_name", "storage_path", "uploaded_by"]},
        ],
        [
            ((2100, 650), (550, 900), "1 : N", (1240, 780)),
            ((2100, 650), (1550, 900), "1 : N", (1740, 780)),
            ((2100, 650), (2550, 900), "1 : N", (2260, 780)),
            ((2100, 650), (3550, 900), "1 : N", (2850, 780)),
            ((1400, 1280), (1050, 1660), "1 : 1", (1230, 1480)),
            ((1900, 1280), (2150, 1660), "1 : 1", (2060, 1480)),
            ((2600, 1280), (3250, 1660), "1 : N", (2840, 1480)),
        ],
        "History tables retain transitions and decisions. Outcomes and case links are constrained to at most one linked row per report in the reviewed definitions.",
    )

    figure_c = diagram(
        "figure-2c-incident-operations-erd-readable",
        "Figure 2C  Incident operations",
        "Incident-level operations use incident_id as their scope anchor for response, staffing, resources and reporting",
        [
            {"title": "INCIDENTS", "box": (1600, 220, 1000, 390), "fill": PALE_TEAL, "fields": ["PK id", "incident_code", "incident_name", "status", "started_at", "ended_at"]},
            {"title": "INCIDENT_RESPONSE_TIMELINES", "box": (100, 850, 900, 410), "fields": ["PK id", "FK incident_id UNIQUE", "event timestamps", "triage / transport order", "updated_at"]},
            {"title": "DMMP_STAFF_CALL_DOWNS", "box": (1100, 850, 900, 410), "fields": ["PK id", "FK incident_id", "staff / user link", "status", "called_at", "arrived_at"]},
            {"title": "MEDICAL_COORDINATION_ASSESSMENTS", "box": (2100, 850, 900, 410), "fields": ["PK id", "FK incident_id UNIQUE", "rating", "assessment", "assessed_by", "assessed_at"]},
            {"title": "CONTINUITY_OF_CARE_ASSESSMENTS", "box": (3100, 850, 900, 410), "fields": ["PK id", "FK incident_id UNIQUE", "disruption_status", "notes", "assessed_by", "assessed_at"]},
            {"title": "EMS_VEHICLE_ARRIVALS", "box": (100, 1600, 900, 360), "fields": ["PK id", "FK incident_id", "provider", "vehicle_type", "arrival_at"]},
            {"title": "FACILITY_RESOURCE_SNAPSHOTS", "box": (1100, 1600, 900, 360), "fields": ["PK id", "FK incident_id", "FK facility_id optional", "resource_values", "captured_at"]},
            {"title": "SITREPS", "box": (2100, 1600, 900, 360), "fields": ["PK id", "FK incident_id", "report_number", "generated_by FK", "approved_by FK", "status"]},
            {"title": "RESPONDER_SAFETY_REPORTS", "box": (3100, 1600, 900, 360), "fields": ["PK id", "FK incident_id", "summary", "reported_by FK", "created_at"]},
        ],
        [
            ((2100, 610), (550, 850), "1 : 1", (1250, 740)),
            ((2100, 610), (1550, 850), "1 : N", (1750, 740)),
            ((2100, 610), (2550, 850), "1 : 1", (2250, 740)),
            ((2100, 610), (3550, 850), "1 : 1", (2850, 740)),
            ((1500, 1260), (550, 1600), "1 : N", (1120, 1430)),
            ((1750, 1260), (1550, 1600), "1 : N", (1700, 1430)),
            ((2300, 1260), (2550, 1600), "1 : N", (2400, 1430)),
            ((2650, 1260), (3550, 1600), "1 : N", (2960, 1430)),
        ],
        "One incident can have many operational records; assessment and timeline tables marked UNIQUE represent one incident-level record in the reviewed definitions.",
    )

    figure_d = diagram(
        "figure-2d-user-support-erd-readable",
        "Figure 2D  User linked support and control records",
        "User-linked entities preserve ownership, notifications, audit activity and incident command continuity",
        [
            {"title": "USERS", "box": (1600, 220, 1000, 430), "fill": PALE_GOLD, "fields": ["PK id", "full_name", "email", "role", "reporting_context", "created_by FK", "is_active"]},
            {"title": "CALL_DOWN_STAFF", "box": (100, 900, 900, 390), "fields": ["PK id", "linked_user_id FK", "created_by FK", "full_name", "role_position", "is_active"]},
            {"title": "FORM_DRAFTS", "box": (1100, 900, 900, 390), "fields": ["PK id", "FK user_id", "form_type", "payload JSON", "status", "created_at"]},
            {"title": "NOTIFICATIONS", "box": (2100, 900, 900, 390), "fields": ["PK id", "FK user_id optional", "notification_type", "related_entity_id", "read_at"]},
            {"title": "AUDIT_LOGS", "box": (3100, 900, 900, 390), "fields": ["PK id", "actor_id FK", "action", "entity_type", "entity_id", "metadata"]},
            {"title": "INCIDENT_IC_BACKUPS", "box": (650, 1660, 1000, 390), "fields": ["PK id", "FK incident_id", "FK user_id", "priority", "is_active"]},
            {"title": "INCIDENT_IC_DELEGATIONS", "box": (2550, 1660, 1000, 390), "fields": ["PK id", "FK incident_id", "delegated_to FK", "delegated_by FK", "delegated_at", "resumed_at"]},
        ],
        [
            ((1900, 650), (550, 900), "1 : N", (1150, 780)),
            ((2050, 650), (1550, 900), "1 : N", (1750, 780)),
            ((2250, 650), (2550, 900), "1 : N", (2350, 780)),
            ((2450, 650), (3550, 900), "1 : N", (2950, 780)),
            ((1750, 650), (1150, 1660), "1 : N", (1300, 1450)),
            ((2450, 650), (3050, 1660), "1 : N", (2900, 1450)),
        ],
        "User foreign keys identify creators, recipients, reviewers, delegated commanders and audit actors without changing incident ownership semantics.",
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
    sub = doc.add_paragraph()
    sub.paragraph_format.space_after = Pt(8)
    run = sub.add_run("Readable replacement for the report extensions and incident operational entities")
    run.font.size = Pt(10)
    run.font.color.rgb = doc_color(MUTED)
    add_body(doc, "The previous Figure 2 summary was too dense when inserted as one raster image. This replacement separates the logical design into four focused ERD figures. Each table-shaped node shows its primary key and important foreign keys, while connector labels show the relationship cardinality. The figures are intended to be read directly in the document at normal page size.")

    sections = [
        ("Figure 2A Casualty report core and care records", "The casualty report is anchored by casualty_incidents. It joins a person identity to an incident and owns triage, transport, treatment and facility encounter records.", figure_a, "Figure 2A Casualty report core and care records entity relationship diagram"),
        ("Figure 2B Report history and clinical extensions", "These entities preserve report transitions, verification decisions, clinical procedures, ICU care, outcomes, case matching and stored attachments.", figure_b, "Figure 2B Report history and clinical extensions entity relationship diagram"),
        ("Figure 2C Incident operations", "These entities are scoped directly to incidents and support the response timeline, staffing, coordination, continuity, EMS, resources, SitReps and safety records.", figure_c, "Figure 2C Incident operations entity relationship diagram"),
        ("Figure 2D User linked support and control records", "These entities connect users to drafts, notifications, audit activity and incident command continuity records.", figure_d, "Figure 2D User linked support and control records entity relationship diagram"),
    ]
    for heading, description, image, caption in sections:
        add_heading(doc, heading, 1)
        add_body(doc, description)
        add_figure(doc, image, caption)
        if heading.startswith("Figure 2A"):
            doc.add_page_break()

    add_heading(doc, "Relationship notes", 1)
    add_table(doc, ["Relationship", "Design interpretation"], [
        ("incidents to casualty_incidents", "One incident can contain many casualty reports; every report belongs to one incident."),
        ("casualties to casualty_incidents", "A person identity remains separate from the incident-specific report describing that person."),
        ("casualty_incidents to report extensions", "Triage, transport, treatment, encounters, procedures, ICU, history and evidence rows reference the report."),
        ("incidents to operational extensions", "Timeline, staffing, coordination, continuity, EMS, resource, SitRep and safety rows reference the incident."),
        ("users to support and accountability", "User foreign keys identify creators, recipients, delegates and audit actors."),
        ("unique links", "The reviewed definitions declare one linked outcome and one case-link row per casualty report, and unique incident links for selected incident assessments."),
    ], [3.0, 7.0])
    add_heading(doc, "Source and scope", 1)
    add_body(doc, "The figures are based on the supplied Figure 2 relationship notes, the reviewed schema catalog, the project database ERD and the SQL migration definitions. They present the logical schema design and important relationships; the deployed database remains the authority for exact columns, policies, indexes and migration order.")
    set_page_number(section.footer.paragraphs[0])
    output = OUT / "SCRIBER_Figure_2_Extended_Schema_ERD.docx"
    doc.save(output)
    print(output)


if __name__ == "__main__":
    build()
