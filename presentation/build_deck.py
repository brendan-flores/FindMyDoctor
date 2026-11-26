# Build the FindMyDoctor presentation deck (6 slides, 16:9).
# Source of truth: the FindMyDoctor repository (docs/, mobile/, web/, backend/).
# No features, roles, or statistics are invented - everything is verified below.
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image

# ---------- palette mirrored from web/tailwind.config.ts (FMD brand) ----------
NAVY   = RGBColor(0x0A, 0x2C, 0x5B)   # primary-900
BLUE   = RGBColor(0x17, 0x64, 0xC0)   # primary-600 (canonical brand blue)
BLUE_D = RGBColor(0x12, 0x4E, 0x9E)   # primary-700
BLUE_L = RGBColor(0xBF, 0xDB, 0xFE)   # primary-200
BG_L   = RGBColor(0xEF, 0xF6, 0xFF)   # primary-50
CARD   = RGBColor(0xFA, 0xFB, 0xFD)
SLATE  = RGBColor(0x0F, 0x17, 0x2A)
GRAY   = RGBColor(0x64, 0x74, 0x8B)
LINE   = RGBColor(0xE2, 0xE8, 0xF0)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
RED_L  = RGBColor(0xFD, 0xE8, 0xE8)
GREEN  = RGBColor(0x04, 0x78, 0x57)
GREEN_L= RGBColor(0xEC, 0xFD, 0xF5)
AMBER_L= RGBColor(0xFF, 0xF4, 0xD9)

FONT = "Segoe UI"
LOGO = "logo/findmydoctor_logo.png"
MOB = "UI-Prototypes/users-mobile-ui"
SEC = "UI-Prototypes/secretary-ui"
DOC = "UI-Prototypes/doctor-ui"

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]
SW, SH = 13.333, 7.5

# ---------- helpers ----------
def slide():
    return prs.slides.add_slide(BLANK)

def box(s, x, y, w, h, fill=None, line=None, line_w=None):
    sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line; sh.line.width = Pt(line_w or 1)
    sh.shadow.inherit = False
    return sh

def rbox(s, x, y, w, h, fill=None, line=None, line_w=None):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line; sh.line.width = Pt(line_w or 1)
    sh.shadow.inherit = False
    try:
        sh.adjustments[0] = 0.05
    except Exception:
        pass
    return sh

def txt(s, x, y, w, h, runs, size=14, color=SLATE, bold=False, align=PP_ALIGN.LEFT,
        anchor=MSO_ANCHOR.TOP, space_after=4, line_spacing=1.0):
    """runs: str, or list of paragraphs; paragraph = str or list of (text, style-dict)."""
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    if isinstance(runs, str):
        runs = [runs]
    first = True
    for para in runs:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.alignment = align
        p.space_after = Pt(space_after)
        p.line_spacing = line_spacing
        if isinstance(para, str):
            para = [(para, {})]
        for text, st in para:
            r = p.add_run(); r.text = text
            f = r.font
            f.name = FONT
            f.size = Pt(st.get("size", size))
            f.bold = st.get("bold", bold)
            f.italic = st.get("italic", False)
            f.color.rgb = st.get("color", color)
    return tb

def pic_fit(s, path, x, y, w, h, border=True):
    """Fit image into box preserving aspect, centered."""
    iw, ih = Image.open(path).size
    scale = min(w / iw, h / ih)
    pw, ph = iw * scale, ih * scale
    px, py = x + (w - pw) / 2, y + (h - ph) / 2
    pic = s.shapes.add_picture(path, Inches(px), Inches(py), Inches(pw), Inches(ph))
    if border:
        pic.line.color.rgb = LINE; pic.line.width = Pt(1)
    return pic

def arrow(s, x, y, w, h, color=BLUE):
    sh = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = color
    sh.line.fill.background(); sh.shadow.inherit = False
    return sh

def header(s, title, kicker=None):
    box(s, 0.55, 0.42, 12.23, 0.05, fill=BLUE)
    txt(s, 0.55, 0.58, 10.6, 0.7, title, size=25, color=NAVY, bold=True)
    if kicker:
        txt(s, 0.55, 1.22, 11.5, 0.35, kicker, size=12, color=GRAY)
    pic_fit(s, LOGO, 11.55, 0.5, 1.5, 0.42, border=False)

def notes(s, text):
    s.notes_slide.notes_text_frame.text = text

def role_card(s, x, y, w, h, name, color, duties, accent=None):
    """A role card: colored header band + short duty lines."""
    rbox(s, x, y, w, h, fill=WHITE, line=LINE, line_w=1)
    box(s, x, y, w, 0.30, fill=color if accent is None else accent)
    txt(s, x + 0.16, y + 0.035, w - 0.3, 0.26, name, size=12.5, color=WHITE, bold=True)
    txt(s, x + 0.16, y + 0.38, w - 0.32, h - 0.44,
        [[(d, {"size": 10, "color": SLATE})] for d in duties], space_after=2, line_spacing=1.02)

# ============================================================ SLIDE 1 — TITLE
s = slide()
box(s, 0, 0, SW, SH, fill=WHITE)
box(s, 0, 0, 0.28, SH, fill=BLUE)
box(s, 7.35, 0, SW - 7.35, SH, fill=BG_L)
box(s, 7.35, 0, 0.05, SH, fill=BLUE_L)

pic_fit(s, LOGO, 0.8, 0.72, 3.4, 1.05, border=False)
txt(s, 0.8, 2.05, 6.2, 1.1, "FindMyDoctor", size=46, color=NAVY, bold=True)
txt(s, 0.8, 3.15, 6.0, 1.0,
    "A patient finds a doctor, books a consultation, and gets a queue number - "
    "all in one app. The clinic runs the queue, records visits, and handles billing "
    "from web dashboards.",
    size=14.5, color=GRAY, space_after=8, line_spacing=1.15)
txt(s, 0.8, 4.25, 6.0, 0.35,
    [[("Software Engineering Project", {"bold": True, "color": SLATE, "size": 13})]])
txt(s, 0.8, 4.65, 6.0, 0.4,
    [[("Flutter mobile app  ·  Next.js web dashboards  ·  Node.js REST API  ·  PostgreSQL",
       {"color": BLUE_D, "size": 11.5})]])

# phone visual on right
box(s, 9.5, 0.9, 2.9, 6.0, fill=NAVY)
pic_fit(s, "mobile/flutter_01.png", 9.62, 1.05, 2.66, 5.7, border=False)
txt(s, 7.55, 6.85, 5.2, 0.5,
    "The FindMyDoctor mobile app: doctor search, booking, and queue tracking.",
    size=11, color=GRAY, align=PP_ALIGN.CENTER)
notes(s, "Open with the name and one sentence on what the app does: patients find a doctor, "
        "book a slot, and get a queue number; the clinic runs the queue and records from "
        "the web dashboard. Point at the phone screenshot on the right. Keep it under a "
        "minute - the details come on later slides.")

# ============================================================ SLIDE 2 — PROBLEM / SOLUTION
s = slide()
header(s, "The problem, and what we built", "Why FindMyDoctor exists")

txt(s, 0.55, 1.7, 5.9, 0.4, "The problem today", size=16, color=NAVY, bold=True)
rbox(s, 0.55, 2.15, 5.9, 4.5, fill=CARD, line=LINE, line_w=1)
probs = [
    "Patients call or visit the clinic just to ask if a doctor is available, what the schedule is, and how much a consultation costs.",
    "Walk-in and online patients are managed on separate lists, so the queue order becomes unclear.",
    "Booking details, payments, and consultation records end up scattered across notebooks, chats, and memory.",
    "Patients have general health questions but no easy way to get reliable information before deciding to see a doctor.",
]
y = 2.4
for p in probs:
    box(s, 0.85, y + 0.08, 0.14, 0.14, fill=RED_L)
    txt(s, 1.15, y, 5.0, 1.0, p, size=12, color=SLATE, space_after=2, line_spacing=1.05)
    y += 1.08

txt(s, 6.9, 1.7, 5.9, 0.4, "What FindMyDoctor does", size=16, color=NAVY, bold=True)
rbox(s, 6.9, 2.15, 5.9, 4.5, fill=BG_L, line=BLUE_L, line_w=1)
sols = [
    ("Doctor discovery", "Search doctors by specialty, view profiles, schedules, and consultation fees, then book a slot in the app."),
    ("One unified queue", "Online reservations and walk-ins share a single daily queue per doctor, numbered by registration time."),
    ("Clinic operations on web", "Secretaries run the queue, register walk-ins, verify GCash receipts, and handle billing; doctors manage schedules and write prescriptions."),
    ("Records & guidance", "Consultations, prescriptions, invoices, and patient-secretary chat stay in one place; an AI assistant answers general health questions."),
]
y = 2.4
for head, body in sols:
    box(s, 7.2, y + 0.08, 0.14, 0.14, fill=BLUE)
    txt(s, 7.55, y, 4.95, 0.3, head, size=13, color=NAVY, bold=True)
    txt(s, 7.55, y + 0.32, 4.95, 0.72, body, size=11.5, color=SLATE, line_spacing=1.05)
    y += 1.08

txt(s, 0.55, 6.82, 12.2, 0.35,
    [[("Core workflow:  ", {"bold": True, "color": NAVY, "size": 13}),
      ("Find a doctor  ->  Check availability  ->  Reserve a slot  ->  Get a queue number  ->  Consultation  ->  Records & prescriptions",
       {"color": SLATE, "size": 13})]])
notes(s, "Frame the motivation: most clinics still handle bookings by phone and paper, "
        "which causes confusion about schedules, fees, and queue order. Then walk through "
        "the right side - discovery, one unified queue, web dashboards for the clinic, "
        "and records in one place. This is an educational appointment-management prototype, "
        "not a hospital system replacement.")

# ============================================================ SLIDE 3 — ARCHITECTURE
s = slide()
header(s, "How the system is put together", "Three applications, one backend, one database")

DX, DY = 0.55, 1.7
# apps tier
rbox(s, DX, DY, 7.3, 1.0, fill=WHITE, line=BLUE, line_w=1.5)
txt(s, DX + 0.25, DY + 0.12, 6.8, 0.34,
    [[("Patient app", {"bold": True, "color": NAVY, "size": 13}),
      ("   Flutter (Android / iOS)", {"color": GRAY, "size": 11})]])
txt(s, DX + 0.25, DY + 0.52, 6.8, 0.4,
    "Doctor, secretary & admin dashboards - Next.js 14, React, TypeScript, Tailwind CSS",
    size=11, color=SLATE)
arrow(s, DX + 3.45, DY + 1.06, 0.62, 0.28, color=BLUE)
txt(s, DX + 4.25, DY + 1.1, 2.9, 0.26,
    [[("HTTPS · REST /api/v1 · JSON", {"size": 9.5, "color": BLUE_D, "bold": True})]])

# backend tier
rbox(s, DX, DY + 1.42, 7.3, 1.45, fill=NAVY)
txt(s, DX + 0.25, DY + 1.56, 6.8, 0.34,
    [[("Backend API", {"bold": True, "color": WHITE, "size": 13}),
      ("   Node.js · Express · TypeScript - modular monolith", {"color": BLUE_L, "size": 11})]])
txt(s, DX + 0.25, DY + 1.96, 6.8, 0.85,
    [[("Modules: ", {"bold": True, "color": WHITE, "size": 10.5}),
      ("auth & roles, scheduling, capacity, appointments, queue, visits & prescriptions, "
       "payments & invoices, conversations, notifications, AI chat, admin",
       {"color": WHITE, "size": 10.5})]], line_spacing=1.12)
arrow(s, DX + 3.45, DY + 2.92, 0.62, 0.28, color=BLUE)
txt(s, DX + 4.25, DY + 2.96, 2.9, 0.26,
    [[("SQL · transactions · row locks", {"size": 9.5, "color": BLUE_D, "bold": True})]])

# database tier
rbox(s, DX, DY + 3.36, 7.3, 0.85, fill=WHITE, line=BLUE, line_w=1.5)
txt(s, DX + 0.25, DY + 3.5, 6.8, 0.6,
    [[("PostgreSQL", {"bold": True, "color": NAVY, "size": 13}),
      ("   source of truth - users, schedules, appointments, queue, visits, payments, messages",
       {"color": GRAY, "size": 10.5})]])

# external services
rbox(s, DX, DY + 4.32, 7.3, 1.3, fill=CARD, line=LINE, line_w=1)
txt(s, DX + 0.25, DY + 4.44, 6.8, 0.28, "Backend only:", size=11.5, color=NAVY, bold=True)
txt(s, DX + 0.25, DY + 4.74, 6.8, 0.85,
    [[("Supabase Auth ", {"bold": True, "color": SLATE, "size": 10.5}),
      ("- email OTP      ", {"color": GRAY, "size": 10.5}),
      ("Supabase Storage ", {"bold": True, "color": SLATE, "size": 10.5}),
      ("- doctor photos      ", {"color": GRAY, "size": 10.5}),
      ("AI provider ", {"bold": True, "color": SLATE, "size": 10.5}),
      ("- general health info; keys never reach the apps", {"color": GRAY, "size": 10.5})]],
    line_spacing=1.14)

# tech stack column (right)
txt(s, 8.25, 1.75, 4.5, 0.4, "Tech stack", size=15, color=NAVY, bold=True)
stack = [
    ("Mobile", "Flutter · Dart"),
    ("Web", "Next.js 14 · React · TypeScript · Tailwind"),
    ("Backend", "Node.js · Express · TypeScript · REST /api/v1"),
    ("Database", "PostgreSQL with SQL migrations"),
    ("Storage & Auth", "Supabase Storage · Supabase Auth (OTP)"),
    ("AI", "External LLM provider - backend only"),
]
y = 2.2
for k, v in stack:
    rbox(s, 8.25, y, 4.5, 0.6, fill=WHITE, line=LINE, line_w=1)
    txt(s, 8.45, y + 0.1, 1.5, 0.4, k, size=11, color=BLUE_D, bold=True)
    txt(s, 9.85, y + 0.1, 2.75, 0.45, v, size=11, color=SLATE)
    y += 0.7
rbox(s, 8.25, y + 0.1, 4.5, 0.85, fill=NAVY)
txt(s, 8.45, y + 0.3, 4.1, 0.6,
    "Neither the mobile app nor the web app connects to PostgreSQL or the AI provider "
    "directly - everything goes through the API.", size=11, color=WHITE, line_spacing=1.12)
notes(s, "Walk the diagram top to bottom: the Flutter app for patients and secretaries, "
        "the Next.js dashboards for doctors, secretaries, and admins, both talking HTTPS/JSON "
        "to a single Node.js/Express backend, which talks SQL to PostgreSQL. Supabase is only "
        "used for OTP email and file storage, and the AI provider is only reachable from the "
        "backend - a deliberate security decision.")

# ============================================================ SLIDE 4 — ROLES & WORKFLOW
s = slide()
header(s, "Who uses it, and how a visit flows", "Roles and the end-to-end workflow")

# ---- left column: roles ----
txt(s, 0.55, 1.5, 4.1, 0.35, "Roles", size=15, color=NAVY, bold=True)
roles = [
    ("Patient", BLUE, ["Finds doctors, books slots,", "tracks queue position,", "chats with secretary, views records"]),
    ("Doctor", BLUE_D, ["Sets schedule & capacity,", "manages appointments,", "records visits & prescriptions"]),
    ("Secretary", BLUE, ["Runs the daily queue,", "registers walk-ins, verifies", "GCash payments, sends invoices"]),
    ("Administrator", NAVY, ["Manages users, doctors &", "secretaries, approvals -", "no clinic operations"]),
]
ry = 1.95
card_h = 1.02
for name, color, duties in roles:
    role_card(s, 0.55, ry, 4.1, card_h, name, color, duties)
    ry += card_h + 0.115

# ---- right column: workflow + screenshot ----
txt(s, 5.0, 1.5, 7.85, 0.35, "Patient visit workflow", size=15, color=NAVY, bold=True)

steps = [
    ("1", "Search doctors", "patient finds a doctor by specialty"),
    ("2", "Book a slot", "patient picks an open date & time"),
    ("3", "Queue number", "backend assigns next number, one queue"),
    ("4", "Check in", "secretary calls & notifies the patient"),
    ("5", "Consultation", "doctor records visit & prescription"),
]
n = len(steps)
gap = 0.12
cw = (7.85 - gap * (n - 1)) / n
x = 5.0
for i, (num, t, cap) in enumerate(steps):
    rbox(s, x, 2.0, cw, 0.86, fill=BG_L, line=BLUE_L, line_w=1)
    box(s, x, 2.0, 0.3, 0.86, fill=BLUE)
    txt(s, x + 0.02, 2.12, 0.28, 0.6, num, size=13, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
    txt(s, x + 0.36, 2.06, cw - 0.42, 0.26, t, size=10.5, color=NAVY, bold=True)
    txt(s, x + 0.36, 2.34, cw - 0.42, 0.45, cap, size=8.5, color=SLATE, line_spacing=0.98)
    if i < n - 1:
        arrow(s, x + cw + 0.015, 2.36, gap - 0.03, 0.16, color=BLUE)
    x += cw + gap

txt(s, 5.0, 3.02, 7.85, 0.3, "Clinic side: the secretary runs the daily queue", size=12.5, color=NAVY, bold=True)
# secretary dashboard screenshot (landscape, readable)
pic_fit(s, f"{SEC}/secretary_dashboard/screen.png", 5.0, 3.36, 7.85, 2.75, border=True)
txt(s, 5.0, 6.22, 7.85, 0.6,
    [[("Secretary dashboard - ", {"bold": True, "color": NAVY, "size": 10.5}),
      ("clinic calls the next patient, updates queue status, and checks patients in and out.",
       {"color": SLATE, "size": 10.5})]], line_spacing=1.05)
notes(s, "Introduce the four roles quickly - the Secretary is the clinic/front-desk role "
        "(there is no separate Clinic Staff role in the system). Then narrate the five-step "
        "workflow, stressing that queue numbers are assigned by the backend, not the app, and "
        "that online and walk-in patients share one queue ordered by registration time. "
        "The screenshot on the right is the real secretary queue view.")

# ============================================================ SLIDE 5 — FEATURES
s = slide()
header(s, "What the app actually does", "Key screens from the mobile app and web dashboards")

# --- patient mobile app row ---
txt(s, 0.55, 1.42, 8.0, 0.35, "Patient mobile app", size=14.5, color=NAVY, bold=True)
mob_items = [
    (f"{MOB}/doctors_page/screen.png", "Browse doctors by specialty, view profiles, schedules, and consultation fees"),
    (f"{MOB}/appointments_hub/screen.png", "Track appointments, queue position, and waitlist status"),
]
mx, mw = 0.55, 5.95
for path, cap in mob_items:
    rbox(s, mx, 1.82, mw, 3.25, fill=WHITE, line=LINE, line_w=1)
    pic_fit(s, path, mx + 0.15, 1.98, 1.75, 2.95, border=True)
    txt(s, mx + 2.05, 2.05, mw - 2.25, 2.8,
        [[(cap, {"size": 11.5, "color": SLATE})]], line_spacing=1.15, anchor=MSO_ANCHOR.MIDDLE)
    mx += mw + 0.23

# --- clinic web dashboards row ---
txt(s, 0.55, 5.28, 8.0, 0.35, "Clinic web dashboards", size=14.5, color=NAVY, bold=True)
web_items = [
    (f"{SEC}/secretary_dashboard/screen.png", "Secretary dashboard: queue status, payments, and walk-ins for the assigned doctor"),
    (f"{SEC}/secretary_conversations/screen.png", "Patient-secretary chat with invoices and appointment context"),
]
wx, ww = 0.55, 5.95
for path, cap in web_items:
    rbox(s, wx, 5.68, ww, 1.62, fill=WHITE, line=LINE, line_w=1)
    pic_fit(s, path, wx + 0.15, 5.8, 3.0, 1.42, border=True)
    txt(s, wx + 3.35, 5.8, ww - 3.55, 1.4,
        [[(cap, {"size": 9.5, "color": SLATE})]], line_spacing=1.0, anchor=MSO_ANCHOR.MIDDLE)
    wx += ww + 0.23
notes(s, "Show real screens, top row from the Flutter app and bottom row from the Next.js "
        "dashboards. Point out that patients never chat with doctors directly - messaging is "
        "patient-to-secretary only, and the AI assistant handles general health questions. "
        "Keep each caption to one line; let the screenshots carry it.")

# ============================================================ SLIDE 6 — DEMO, VALUE, CONCLUSION
s = slide()
header(s, "What this gives us", "Demo, value, and what's next")

txt(s, 0.55, 1.75, 5.9, 0.4, "Value for patients and clinics", size=15, color=NAVY, bold=True)
vals = [
    ("Patients", "No more calling to check schedules or fees - search, book, and track the queue from one app; records and prescriptions stay accessible."),
    ("Clinics", "One daily queue for online and walk-in patients, fewer manual errors through backend-enforced capacity and concurrency rules, and a clear billing trail."),
]
y = 2.2
for who, what in vals:
    rbox(s, 0.55, y, 5.9, 1.3, fill=BG_L, line=BLUE_L, line_w=1)
    txt(s, 0.8, y + 0.13, 5.4, 0.3, who, size=13, color=BLUE_D, bold=True)
    txt(s, 0.8, y + 0.46, 5.4, 0.78, what, size=11.5, color=SLATE, line_spacing=1.1)
    y += 1.48

txt(s, 0.55, 5.32, 5.9, 0.4, "Verified during development", size=15, color=NAVY, bold=True)
ver = [
    "REST API with role-based authorization on every endpoint",
    "Concurrency-safe booking: advisory locks prevent double-booking and capacity overflow",
    "Unit tests and Playwright end-to-end tests in the web app",
    "Versioned PostgreSQL migrations; schema mirrored in consolidated_schema.sql",
]
y = 5.78
for v in ver:
    box(s, 0.62, y + 0.08, 0.11, 0.11, fill=GREEN)
    txt(s, 0.85, y, 5.5, 0.34, v, size=11, color=SLATE)
    y += 0.36

txt(s, 6.9, 1.75, 5.9, 0.4, "Scope and honest limitations", size=15, color=NAVY, bold=True)
rbox(s, 6.9, 2.25, 5.9, 2.85, fill=CARD, line=LINE, line_w=1)
lims = [
    "Educational appointment-management prototype - not a production hospital or EHR system.",
    "GCash uses a static QR with manual receipt verification; no payment-gateway API.",
    "The AI assistant gives general health information only - no diagnosis or prescriptions.",
    "Direct patient-doctor chat is intentionally not part of the design.",
]
y = 2.5
for l in lims:
    txt(s, 7.2, y, 5.4, 0.55, l, size=11.5, color=SLATE, line_spacing=1.1, space_after=0)
    y += 0.64

txt(s, 6.9, 5.3, 5.9, 0.4, "Where we go next", size=15, color=NAVY, bold=True)
rbox(s, 6.9, 5.78, 5.9, 1.18, fill=BG_L, line=BLUE_L, line_w=1)
txt(s, 7.15, 5.92, 5.45, 1.0,
    [[("Planned improvements:  ", {"bold": True, "color": NAVY, "size": 11.5}),
      ("deeper waitlist automation, richer reporting for clinics, and a real payment "
       "integration once the prototype is validated.", {"color": SLATE, "size": 11.5})]],
    line_spacing=1.15)

rbox(s, 0.55, 6.62, 12.23, 0.7, fill=NAVY)
txt(s, 0.85, 6.75, 11.6, 0.45,
    [[("FindMyDoctor - ", {"bold": True, "color": WHITE, "size": 15}),
      ("one platform that takes a patient from finding a doctor to receiving a prescription, "
       "while giving the clinic a queue it can actually run.", {"color": BLUE_L, "size": 13})]],
    anchor=MSO_ANCHOR.MIDDLE)
notes(s, "Close by demoing the flow if time allows: patient books, secretary calls the queue, "
        "doctor issues a prescription. Then be upfront about limits - it's a prototype, GCash "
        "is a static QR verified manually, and the AI only gives general information. End on "
        "the conclusion line and offer to take questions.")

prs.save("presentation/FindMyDoctor_Presentation.pptx")
print("saved presentation/FindMyDoctor_Presentation.pptx")
