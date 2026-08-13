from pathlib import Path

from reportlab.lib import colors
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "dcms-database-schema-full-diagram.pdf"

PAGE_W = 48 * 72
PAGE_H = 36 * 72
MARGIN = 56

COLORS = {
    "core": colors.HexColor("#7B1113"),
    "care": colors.HexColor("#2E7D4F"),
    "ops": colors.HexColor("#267ABD"),
    "audit": colors.HexColor("#D96D12"),
    "soft": colors.HexColor("#F7F9FC"),
    "line": colors.HexColor("#D7DFEA"),
    "ink": colors.HexColor("#17213A"),
    "muted": colors.HexColor("#64748B"),
}


tables = {
    "users": {
        "group": "core",
        "x": 80,
        "y": 180,
        "w": 330,
        "fields": [
            "PK id uuid",
            "full_name varchar",
            "email varchar unique",
            "phone_number varchar",
            "role user_role",
            "reporting_context",
            "assigned_municipality",
            "assigned_barangay",
            "is_active boolean",
            "FK created_by -> users.id",
            "last_seen_at timestamptz",
        ],
    },
    "incidents": {
        "group": "core",
        "x": 920,
        "y": 116,
        "w": 360,
        "fields": [
            "PK id uuid",
            "incident_code varchar unique",
            "incident_name varchar",
            "disaster_type varchar",
            "description text",
            "province / municipality / barangay",
            "started_at / ended_at",
            "status varchar",
            "FK created_by -> users.id",
        ],
    },
    "casualties": {
        "group": "core",
        "x": 1820,
        "y": 116,
        "w": 360,
        "fields": [
            "PK id uuid",
            "id_number varchar",
            "id_type varchar",
            "identification_status enum",
            "first_name / middle_name / last_name",
            "suffix varchar",
            "date_of_birth date",
            "estimated_age integer",
            "sex varchar",
            "contact_number varchar",
            "house_street / barangay / municipality",
            "province / region",
        ],
    },
    "casualty_incidents": {
        "group": "core",
        "x": 1130,
        "y": 760,
        "w": 440,
        "fields": [
            "PK id uuid",
            "client_record_id uuid",
            "FK casualty_id -> casualties.id",
            "FK incident_id -> incidents.id",
            "FK evacuation_center_id",
            "FK healthcare_facility_id",
            "current_status casualty_status",
            "severity casualty_severity",
            "verification_status enum",
            "FK verified_by -> users.id",
            "verified_at timestamptz",
            "current_location / hospital_name",
            "visible_injury / medical_condition",
            "assistance_needed / provided",
            "remarks text",
            "FK encoded_by -> users.id",
            "reported_at timestamptz",
            "latitude / longitude",
        ],
    },
    "evacuation_centers": {
        "group": "care",
        "x": 520,
        "y": 520,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK incident_id -> incidents.id",
            "center_name varchar",
            "address text",
            "barangay / municipality / province",
            "capacity integer",
            "contact_person / contact_number",
            "latitude / longitude",
            "is_active boolean",
        ],
    },
    "healthcare_facilities": {
        "group": "care",
        "x": 2350,
        "y": 500,
        "w": 360,
        "fields": [
            "PK id uuid",
            "facility_name varchar",
            "facility_level varchar",
            "address text",
            "barangay / municipality / province",
            "contact_person / contact_number",
            "latitude / longitude",
            "is_active boolean",
            "FK created_by -> users.id",
        ],
    },
    "casualty_triage_assessments": {
        "group": "core",
        "x": 1830,
        "y": 760,
        "w": 390,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "triage_system varchar",
            "triage_category varchar",
            "responder_category varchar",
            "calculated_category varchar",
            "triage_stage varchar",
            "assessment_answers jsonb",
            "algorithm_version varchar",
            "is_over_triage / is_under_triage",
            "triaged_at timestamptz",
            "FK triaged_by -> users.id",
            "location / notes",
        ],
    },
    "casualty_transport_records": {
        "group": "core",
        "x": 1830,
        "y": 1270,
        "w": 390,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "transport_required varchar",
            "transport_mode varchar",
            "ems_unit_type varchar",
            "arrived_scene_at timestamptz",
            "departed_scene_at timestamptz",
            "arrived_facility_at timestamptz",
            "FK receiving_facility_id",
            "FK recorded_by -> users.id",
            "notes text",
        ],
    },
    "casualty_status_history": {
        "group": "audit",
        "x": 640,
        "y": 1240,
        "w": 350,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "old_status varchar",
            "new_status varchar",
            "FK changed_by -> users.id",
            "change_reason text",
            "created_at timestamptz",
        ],
    },
    "casualty_verification_history": {
        "group": "audit",
        "x": 640,
        "y": 1530,
        "w": 350,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "old_status varchar",
            "new_status varchar",
            "FK reviewed_by -> users.id",
            "review_notes text",
            "created_at timestamptz",
        ],
    },
    "facility_encounters": {
        "group": "care",
        "x": 2360,
        "y": 900,
        "w": 360,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "FK facility_id -> healthcare_facilities.id",
            "arrived_at timestamptz",
            "ed_admitted_at / ed_departed_at",
            "hospital_admitted_at / discharged_at",
            "admitted_to_hospital boolean",
            "discharged_home_after_ed boolean",
            "transferred_out_of_hospital boolean",
            "FK recorded_by -> users.id",
        ],
    },
    "icu_encounters": {
        "group": "care",
        "x": 2360,
        "y": 1300,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "FK healthcare_facility_id",
            "icu_admitted_at / discharged_at",
            "mechanical_ventilation_required",
            "ventilation_started_at / ended_at",
        ],
    },
    "clinical_procedures": {
        "group": "care",
        "x": 2360,
        "y": 1580,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "FK healthcare_facility_id",
            "procedure_type varchar",
            "procedure_required boolean",
            "procedure_started_at / ended_at",
            "notes text",
        ],
    },
    "casualty_treatments": {
        "group": "care",
        "x": 1130,
        "y": 1510,
        "w": 360,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "treatment_strategy varchar",
            "treatment_area_name varchar",
            "stabilization_started_at",
            "stabilized_at timestamptz",
            "FK treated_by -> users.id",
            "notes text",
        ],
    },
    "casualty_outcomes": {
        "group": "care",
        "x": 1130,
        "y": 1840,
        "w": 360,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "reached_hospital boolean",
            "medical_contact_before_death",
            "died boolean",
            "death_stage varchar",
            "death_at timestamptz",
            "final_disposition varchar",
            "FK recorded_by -> users.id",
        ],
    },
    "incident_response_timelines": {
        "group": "ops",
        "x": 520,
        "y": 120,
        "w": 340,
        "fields": [
            "PK id uuid",
            "FK incident_id -> incidents.id",
            "event_notification_at",
            "dmmp_activated_at",
            "first_ems_on_scene_at",
            "triage_ordered_at",
            "first/last site triage",
            "first/last transport from scene",
            "scene_demobilized_at",
            "FK updated_by -> users.id",
        ],
    },
    "dmmp_staff_call_downs": {
        "group": "ops",
        "x": 80,
        "y": 620,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK incident_id",
            "staff_group varchar",
            "contacted_count integer",
            "arrived_count integer",
            "FK recorded_by -> users.id",
        ],
    },
    "medical_coordination_assessments": {
        "group": "ops",
        "x": 80,
        "y": 900,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK incident_id",
            "coordination_status varchar",
            "communication_status varchar",
            "FK assessed_by -> users.id",
        ],
    },
    "continuity_of_care_assessments": {
        "group": "ops",
        "x": 80,
        "y": 1140,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK incident_id",
            "responders_demobilized_at",
            "facility_deactivated_at",
            "normal_ems_coverage_disruption",
            "routine_care_disruption",
            "FK assessed_by -> users.id",
            "assessed_at / notes",
        ],
    },
    "responder_safety_reports": {
        "group": "ops",
        "x": 80,
        "y": 1490,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK incident_id",
            "responder_injuries integer",
            "responder_deaths integer",
            "safety_issues text",
            "FK reported_by -> users.id",
        ],
    },
    "ems_vehicle_arrivals": {
        "group": "ops",
        "x": 80,
        "y": 1770,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK incident_id",
            "vehicle_identifier varchar",
            "arrived_at timestamptz",
            "departed_at timestamptz",
            "FK recorded_by -> users.id",
        ],
    },
    "facility_resource_snapshots": {
        "group": "ops",
        "x": 2740,
        "y": 520,
        "w": 340,
        "fields": [
            "PK id uuid",
            "FK incident_id",
            "FK healthcare_facility_id",
            "beds_available / occupied",
            "icu_beds_available / occupied",
            "FK recorded_by -> users.id",
            "recorded_at timestamptz",
        ],
    },
    "sitreps": {
        "group": "audit",
        "x": 1550,
        "y": 1840,
        "w": 360,
        "fields": [
            "PK id uuid",
            "FK incident_id",
            "report_number varchar unique",
            "period_start / period_end",
            "summary text",
            "generated_payload jsonb",
            "FK generated_by -> users.id",
            "status varchar",
            "FK approved_by -> users.id",
        ],
    },
    "notifications": {
        "group": "audit",
        "x": 80,
        "y": 2050,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK user_id -> users.id",
            "title varchar",
            "message text",
            "notification_type varchar",
            "is_read boolean",
            "created_at timestamptz",
        ],
    },
    "attachments": {
        "group": "audit",
        "x": 1550,
        "y": 1510,
        "w": 330,
        "fields": [
            "PK id uuid",
            "FK casualty_incident_id",
            "file_name varchar",
            "file_type varchar",
            "file_size integer",
            "storage_path text",
            "FK uploaded_by -> users.id",
        ],
    },
}


edges = [
    ("users", "users", "created_by", "audit"),
    ("users", "incidents", "created_by", "audit"),
    ("incidents", "casualty_incidents", "incident_id", "primary"),
    ("casualties", "casualty_incidents", "casualty_id", "primary"),
    ("users", "casualty_incidents", "encoded_by", "primary"),
    ("users", "casualty_incidents", "verified_by", "audit"),
    ("incidents", "evacuation_centers", "incident_id", "care"),
    ("evacuation_centers", "casualty_incidents", "evacuation_center_id", "care"),
    ("healthcare_facilities", "casualty_incidents", "healthcare_facility_id", "care"),
    ("casualty_incidents", "casualty_triage_assessments", "casualty_incident_id", "primary"),
    ("users", "casualty_triage_assessments", "triaged_by", "audit"),
    ("casualty_incidents", "casualty_transport_records", "casualty_incident_id", "primary"),
    ("healthcare_facilities", "casualty_transport_records", "receiving_facility_id", "care"),
    ("users", "casualty_transport_records", "recorded_by", "audit"),
    ("casualty_incidents", "casualty_status_history", "casualty_incident_id", "audit"),
    ("users", "casualty_status_history", "changed_by", "audit"),
    ("casualty_incidents", "casualty_verification_history", "casualty_incident_id", "audit"),
    ("users", "casualty_verification_history", "reviewed_by", "audit"),
    ("casualty_incidents", "facility_encounters", "casualty_incident_id", "care"),
    ("healthcare_facilities", "facility_encounters", "facility_id", "care"),
    ("users", "facility_encounters", "recorded_by", "audit"),
    ("casualty_incidents", "icu_encounters", "casualty_incident_id", "care"),
    ("healthcare_facilities", "icu_encounters", "healthcare_facility_id", "care"),
    ("casualty_incidents", "clinical_procedures", "casualty_incident_id", "care"),
    ("healthcare_facilities", "clinical_procedures", "healthcare_facility_id", "care"),
    ("casualty_incidents", "casualty_treatments", "casualty_incident_id", "care"),
    ("users", "casualty_treatments", "treated_by", "audit"),
    ("casualty_incidents", "casualty_outcomes", "casualty_incident_id", "care"),
    ("users", "casualty_outcomes", "recorded_by", "audit"),
    ("incidents", "incident_response_timelines", "incident_id", "ops"),
    ("users", "incident_response_timelines", "updated_by", "audit"),
    ("incidents", "dmmp_staff_call_downs", "incident_id", "ops"),
    ("users", "dmmp_staff_call_downs", "recorded_by", "audit"),
    ("incidents", "medical_coordination_assessments", "incident_id", "ops"),
    ("users", "medical_coordination_assessments", "assessed_by", "audit"),
    ("incidents", "continuity_of_care_assessments", "incident_id", "ops"),
    ("users", "continuity_of_care_assessments", "assessed_by", "audit"),
    ("incidents", "responder_safety_reports", "incident_id", "ops"),
    ("users", "responder_safety_reports", "reported_by", "audit"),
    ("incidents", "ems_vehicle_arrivals", "incident_id", "ops"),
    ("users", "ems_vehicle_arrivals", "recorded_by", "audit"),
    ("incidents", "facility_resource_snapshots", "incident_id", "ops"),
    ("healthcare_facilities", "facility_resource_snapshots", "healthcare_facility_id", "care"),
    ("users", "facility_resource_snapshots", "recorded_by", "audit"),
    ("incidents", "sitreps", "incident_id", "audit"),
    ("users", "sitreps", "generated_by", "audit"),
    ("users", "sitreps", "approved_by", "audit"),
    ("users", "notifications", "user_id", "audit"),
    ("casualty_incidents", "attachments", "casualty_incident_id", "audit"),
    ("users", "attachments", "uploaded_by", "audit"),
]


def top_to_pdf(y, h=0):
    return PAGE_H - y - h


def node_height(table):
    return 36 + len(table["fields"]) * 19 + 14


for table in tables.values():
    table["h"] = node_height(table)


def anchor(name, side):
    table = tables[name]
    x, y, w, h = table["x"], table["y"], table["w"], table["h"]
    if side == "left":
        return x, y + h / 2
    if side == "right":
        return x + w, y + h / 2
    if side == "top":
        return x + w / 2, y
    if side == "bottom":
        return x + w / 2, y + h
    return x + w / 2, y + h / 2


def choose_sides(src, dst):
    s = tables[src]
    d = tables[dst]
    scx = s["x"] + s["w"] / 2
    dcx = d["x"] + d["w"] / 2
    scy = s["y"] + s["h"] / 2
    dcy = d["y"] + d["h"] / 2
    if abs(scx - dcx) > abs(scy - dcy):
        return ("right", "left") if scx < dcx else ("left", "right")
    return ("bottom", "top") if scy < dcy else ("top", "bottom")


def draw_edge(c, src, dst, label, kind):
    src_side, dst_side = choose_sides(src, dst)
    x1, y1 = anchor(src, src_side)
    x2, y2 = anchor(dst, dst_side)
    y1p = top_to_pdf(y1)
    y2p = top_to_pdf(y2)

    if kind == "primary":
        color = COLORS["core"]
        width = 2.4
    elif kind == "care":
        color = COLORS["care"]
        width = 1.55
    elif kind == "ops":
        color = COLORS["ops"]
        width = 1.45
    else:
        color = colors.HexColor("#A0AABD")
        width = 1.05

    c.setStrokeColor(color)
    c.setLineWidth(width)

    if src_side in ("left", "right"):
        dx = 80 if src_side == "right" else -80
        c.bezier(x1, y1p, x1 + dx, y1p, x2 - dx, y2p, x2, y2p)
    else:
        dy = -80 if src_side == "bottom" else 80
        c.bezier(x1, y1p, x1, y1p + dy, x2, y2p - dy, x2, y2p)

    if kind == "primary":
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(COLORS["core"])
        mx = (x1 + x2) / 2
        my = (y1p + y2p) / 2
        c.drawCentredString(mx, my + 4, label)


def draw_node(c, name, table):
    x, y, w, h = table["x"], table["y"], table["w"], table["h"]
    yp = top_to_pdf(y, h)
    group = table["group"]
    header_color = COLORS[group]

    c.setStrokeColor(COLORS["line"])
    c.setLineWidth(1)
    c.setFillColor(colors.white)
    c.roundRect(x, yp, w, h, 10, fill=1, stroke=1)

    c.setFillColor(header_color)
    c.roundRect(x, yp + h - 34, w, 34, 10, fill=1, stroke=0)
    c.rect(x, yp + h - 22, w, 22, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 12, yp + h - 22, name)

    c.setFont("Helvetica", 8.3)
    current_y = yp + h - 51
    for field in table["fields"]:
        if field.startswith("PK"):
            c.setFillColor(COLORS["core"])
            c.setFont("Helvetica-Bold", 8.2)
        elif field.startswith("FK"):
            c.setFillColor(COLORS["ops"])
            c.setFont("Helvetica-Bold", 8.2)
        else:
            c.setFillColor(COLORS["ink"])
            c.setFont("Helvetica", 8.2)
        c.drawString(x + 12, current_y, field[:55])
        current_y -= 19


def draw_legend(c):
    x = 2280
    y = top_to_pdf(138)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(COLORS["ink"])
    c.drawString(x, y, "Legend")
    items = [
        ("Core casualty data", "core"),
        ("Care/facility data", "care"),
        ("Incident operations", "ops"),
        ("Audit/history/reporting", "audit"),
    ]
    y -= 24
    for label, group in items:
        c.setFillColor(COLORS[group])
        c.roundRect(x, y - 1, 22, 10, 3, fill=1, stroke=0)
        c.setFillColor(COLORS["ink"])
        c.setFont("Helvetica", 9)
        c.drawString(x + 30, y - 1, label)
        y -= 20


def create_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H))
    c.setTitle("DCMS Database Schema Full Diagram")

    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.setFillColor(COLORS["core"])
    c.rect(0, PAGE_H - 86, PAGE_W, 86, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(MARGIN, PAGE_H - 42, "Disaster Casualty Management System - Database Schema")
    c.setFont("Helvetica", 12)
    c.drawString(
        MARGIN,
        PAGE_H - 65,
        "Full ERD for Supabase PostgreSQL tables used by the mobile PWA, admin dashboard, API, triage, verification, SitRep, and operations workflows.",
    )

    draw_legend(c)

    c.setFont("Helvetica", 8)
    c.setFillColor(COLORS["muted"])
    c.drawString(MARGIN, 28, "Generated from project schema references. PK = primary key, FK = foreign key. Open in a PDF viewer and zoom for full detail.")

    # Draw edges first so table cards sit above lines.
    for edge in edges:
        draw_edge(c, *edge)

    for name, table in tables.items():
        draw_node(c, name, table)

    c.showPage()
    c.save()


if __name__ == "__main__":
    create_pdf()
    print(OUTPUT)
