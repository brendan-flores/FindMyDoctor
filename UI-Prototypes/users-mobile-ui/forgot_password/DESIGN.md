---
name: CareFlow Pulse
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4850'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7881'
  outline-variant: '#bec8d2'
  surface-tint: '#006591'
  primary: '#006591'
  on-primary: '#ffffff'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#89ceff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006b5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#00ae9d'
  on-tertiary-container: '#003a33'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#71f8e4'
  tertiary-fixed-dim: '#4fdbc8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-lg-medium:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md-medium:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  queue-num:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter-xs: 0.25rem
  gutter-sm: 0.5rem
  gutter-md: 0.75rem
  gutter-lg: 1rem
  gutter-xl: 1.25rem
  gutter-2xl: 1.5rem
  gutter-3xl: 2rem
  safe-margin: 1rem
  touch-target: 3rem
---

## Brand & Style

The design system embodies a modern, warm, and highly accessible clinical atmosphere tailored for Filipino patients and healthcare providers. It balances clinical precision with an empathetic, human touch—demystifying healthcare navigation across diverse demographics, from young urban professionals to multi-generational family caregivers booking appointments for senior relatives.

The aesthetic blends **Modern Contemporary** clarity with soft, human-centered tactile elements:
- **Tone:** Empathetic, dependable, crystal clear, unhurried, reassuring.
- **Visual Weight:** Light, airy layouts rooted in calm slate tones, anchored by deep navy high-contrast readability and lively sky-to-teal clinical accents.
- **Physical Feel:** Tactile cards, prominent rounded corners, and soft, clean boundaries that feel welcoming rather than cold or sterile.

## Colors

The palette delivers medical clarity, calm reassurance, and high readability under direct tropical sunlight.

### Core Palette
- **Primary (`#0EA5E9` - Sky Blue):** Core brand actions, active bottom navigation states, primary buttons, interactive links, calendar date selections.
- **Secondary (`#0F172A` - Deep Navy):** Headings, critical labels, dominant text, heavy structural icons. Ensures WCAG AAA compliance against soft backgrounds.
- **Tertiary / Accent (`#14B8A6` - Medical Teal):** Positive clinical feedback, real-time doctor availability indicators, live queue tokens, completed states.
- **Neutral Core (`#64748B` - Slate Muted):** Secondary typography, subtle borders, metadata timestamps, de-emphasized iconography.

### Functional & Surface Tokens
- **Canvas Base:** `#F8FAFC` (Slate 50) creates a gentle, non-glare surface that reduces eye fatigue compared to pure harsh white.
- **Card / Sheet Surface:** `#FFFFFF` (Pure White) with `#E2E8F0` structural outlines for clear layer separation.
- **Urgent / Delayed:** `#F59E0B` (Amber) for delayed clinics, payment warnings, or preparation notes.
- **Emergency / Error:** `#EF4444` (Crimson) for appointment cancellations, validation errors, and ER/Hotline action triggers.
- **Tint Overlays:**
  - Sky Tint: `rgba(14, 165, 233, 0.08)` for selected appointment slot pills.
  - Teal Tint: `rgba(20, 184, 166, 0.12)` for "Doctor In Clinic" queue chips.
  - Amber Tint: `rgba(245, 158, 11, 0.12)` for pending queue notices.

## Typography

Typography relies entirely on **Plus Jakarta Sans** for its friendly, rounded geometry, wide aperture, and exceptional legibility on compact screens.

### Hierarchy Guidelines
- **Base Body Standard:** Base body size starts at a legible `16px` (`body-lg`) to serve users reviewing dense health instructions, prescription details, or clinic schedules without strain.
- **Headlines:** Clean and tight, leveraging Deep Navy (`#0F172A`) for immediate authority and focus without feeling intimidating.
- **Queue & Data Displays:** The dedicated `queue-num` style pairs bold, high-visibility numbering with colored status badges so patients waiting in waiting rooms can read updates at an arm's length.
- **Numeric & Medical Data:** Clinic room numbers, consultation fees (PHP ₱), and dates use medium-to-bold weights to avoid misinterpretation.

## Layout & Spacing

The layout is built mobile-first, targeting modern phone viewports (specifically optimized for `390px` portrait displays). 

### Layout Model & Rhythm
- **Grid Structure:** Fluid single-column mobile stack anchored by standard `16px` (`safe-margin`) edge padding. Horizontal sub-scrollers (specialties, available dates) bleed edge-to-edge with matching internal safe padding.
- **Rhythm Multiplier:** Strictly based on an 8-point system, with 4px intervals used only for dense chip arrangements, inline icons, and pill badge padding.
- **Touch Boundaries:** All interactive triggers (buttons, list selections, slot pickers, filter chips) maintain a strict minimum bounding box of `48px` (`touch-target`) for swift, error-free tapping while on the go.
- **Viewport Accommodations:** Fixed bottom sheet modals and bottom navigation bars respect device safe areas (`env(safe-area-inset-bottom)`) with added clearance above the hardware pill indicator.

## Elevation & Depth

Visual hierarchy uses **tonal layering backed by soft ambient shadows** rather than high-contrast structural borders, maintaining a soothing, friendly aesthetic.

### Elevation Levels
- **Level 0 (Flat / Canvas):** Neutral background (`#F8FAFC`). No shadow.
- **Level 1 (Surface Cards & Clinic Items):** White cards (`#FFFFFF`) with a hairline border (`1px solid #E2E8F0`) and an ambient shadow: `0px 2px 8px -2px rgba(15, 23, 42, 0.05), 0px 1px 3px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Dropdowns, Active Cards & Pinned Bars):** Floating search bars, appointment sticky cards, and bottom bars: `0px 8px 24px -4px rgba(15, 23, 42, 0.08), 0px 2px 6px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Sheets & Alerts):** Clinic detail bottom sheets and emergency queue dialogs: `0px 16px 36px -6px rgba(15, 23, 42, 0.16)`. Accompanied by a 40% deep navy backdrop overlay (`rgba(15, 23, 42, 0.40)` with `backdrop-filter: blur(4px)`).

## Shapes

The shape philosophy prioritizes approachable curves that convey safety, gentle care, and approachability. 

- **Primary Radius (`rounded-2xl` / 16px):** The foundational container shape used across all standard cards (doctor profile cards, clinic list items, summary boards).
- **Control Radius (`rounded-xl` / 12px):** Inputs, search bars, large action buttons, and appointment time-slot tiles.
- **Pill Radius (`rounded-full` / 9999px):** Status chips, queue counters (`#4 in Queue`), filter tags, doctor credential tags, and active navigation indicators.
- **Top-Sheet Radius (`rounded-t-3xl` / 24px):** Interactive bottom sheets, confirmation trays, and filter drawers.

## Components

### Buttons
- **Primary Button:** Height `48px` to `52px`, background Sky Blue (`#0EA5E9`), text white, `rounded-xl`, bold label (`16px`). Hover/Pressed: `#0284C7`. Focus ring: 3px Sky Blue at 30% opacity.
- **Secondary Button:** White surface, border `1.5px solid #0EA5E9`, text Sky Blue (`#0EA5E9`), `rounded-xl`.
- **Urgent / Danger Button:** Fill `#EF4444`, text white, `rounded-xl` for emergency hotlines or cancellations.

### Status Chips & Queue Badges
- **Queue Tracker Badge:** Pill shape (`rounded-full`), Teal light background (`rgba(20, 184, 166, 0.12)`), text Teal (`#0D9488`), font `label-md`, left-aligned pulsing indicator dot.
- **Status Pills:**
  - *Upcoming:* Sky tint with Deep Navy text.
  - *Completed:* Light Slate background (`#F1F5F9`) with Slate text (`#475569`).
  - *Pending Verification:* Amber light background (`rgba(245, 158, 11, 0.15)`) with `#B45309` text.
  - *Full / No Slots:* Neutral Gray tint (`#F1F5F9`) with `#94A3B8` text.

### Doctor & Clinic Cards
- Pure White background, `16px` border radius, `1px solid #E2E8F0`, padded at `16px`.
- Avatar: 64x64px rounded-xl with subtle inner shadow.
- Specialty tag, hospital/clinic branch name in `#64748B`, consultation fee in bold `#0F172A`, and earliest available schedule pill in `#14B8A6`.

### Form Fields & Inputs
- Height `48px`, background `#FFFFFF`, border `1px solid #CBD5E1`, `12px` border radius.
- Placeholder in `#94A3B8`. Active focus shifts border to `#0EA5E9` with a subtle `3px` glow ring.
- Left icon clearance for medical search and location pins (`40px` inset).

### Bottom Navigation Bar
- Fixed bottom mobile bar, height `68px` + device safe-area inset.
- White surface with `1px` top border (`#E2E8F0`) and Level 2 elevation.
- 4 Items: Home, Appointments, Chat, Profile.
- Active item uses Sky Blue (`#0EA5E9`) icon and label with an active soft pill backdrop dot. Inactive items use `#64748B`.

### Bottom Sheet Modals
- Top corners `24px` radius, drag handle pill (`40px` x `4px`, `#CBD5E1`) centered at the top.
- Used for date/time slot selection, doctor bio previews, and queue real-time status.