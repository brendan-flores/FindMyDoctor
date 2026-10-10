---
name: FiDo Clinical Portal
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
  on-surface-variant: '#424752'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727783'
  outline-variant: '#c2c6d4'
  surface-tint: '#185cb6'
  primary: '#004694'
  on-primary: '#ffffff'
  primary-container: '#1b5eb8'
  on-primary-container: '#ccdbff'
  inverse-primary: '#acc7ff'
  secondary: '#455e8d'
  on-secondary: '#ffffff'
  secondary-container: '#b0caff'
  on-secondary-container: '#3b5482'
  tertiary: '#005338'
  on-tertiary: '#ffffff'
  tertiary-container: '#006e4b'
  on-tertiary-container: '#67f4b7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#004591'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#adc7fc'
  on-secondary-fixed: '#001b3f'
  on-secondary-fixed-variant: '#2c4674'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  fido-50: '#eff6ff'
  fido-100: '#ebf3fc'
  fido-200: '#cbe0f9'
  fido-500: '#1e6fd9'
  fido-600: '#1b5eb8'
  fido-700: '#144994'
  fido-navy: '#0f2d59'
  fido-surface: '#f8fafc'
  fido-border: '#e2e8f0'
  status-emerald-bg: '#ecfdf5'
  status-emerald-text: '#047857'
  status-amber-bg: '#fef3c7'
  status-amber-text: '#92400e'
  status-rose-bg: '#ffe4e6'
  status-rose-text: '#be123c'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 1.875rem
    fontWeight: '800'
    lineHeight: 2.25rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '700'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '700'
    lineHeight: 1.25rem
  body-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '400'
    lineHeight: 1rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
  label-md:
    fontFamily: Inter
    fontSize: 0.625rem
    fontWeight: '700'
    lineHeight: 0.875rem
    letterSpacing: 0.05em
  label-xs:
    fontFamily: Inter
    fontSize: 0.59375rem
    fontWeight: '700'
    lineHeight: 0.75rem
    letterSpacing: 0.24em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

FiDo is a modern, high-precision clinical operating system built for healthcare practitioners, specialists, and medical desk coordinators. The brand balances rigorous clinical reliability with human-centered empathy, reducing cognitive fatigue during high-stress consultation shifts.

The visual style is **Corporate / Modern Clinical**:
- Crisp, clinical utility structured by gentle slate-tinted borders and high-readability typography.
- Focused whitespace paired with clear information hierarchy to streamline patient triage, appointments, and live queuing.
- Subtle vitality conveyed through energetic, confident blues (`#1b5eb8`) and functional health accents (emerald greens for active status, amber for immediate queue action, rose for cancellations).

## Colors

The palette establishes a high-trust clinical workspace.

- **Primary (`#1b5eb8`)**: The signature FiDo royal blue, deployed for active navigation indicators, key calls-to-action, branded badges, and interactive focus states.
- **Secondary / Deep Navy (`#0f2d59`)**: Grounding color utilized for primary headings, doctor metadata, and patient chart names to ensure contrast and commanding presence.
- **Tertiary / Success Emerald (`#10b981`)**: Represents active presence, verified appointments, completed SOAP notes, and positive physiological indicators.
- **Neutral / Slate (`#64748b`)**: Provides structured typography steps, subtle icons, border delineation, and muted metadata.

### Functional Roles & Accents
- **Amber (`#f59e0b` / `#92400e`)**: Denotes live queue priority, triage waiting states, and items requiring immediate doctor signature.
- **Rose / Error (`#f43f5e` / `#be123c`)**: Reserved for cancellations, emergency alerts, and lab flags.
- **Surface Foundations**: Base canvas utilizes `bg-fido-surface` (`#f8fafc`), layered with stark pure white cards (`#ffffff`) framed by precise `#e2e8f0` dividers.

## Typography

Inter serves as the unified typographic engine across headlines, analytical body text, and dense clinical indicators. Its mechanical clarity and robust glyph apertures ensure legibility when scanning rapid diagnostic cues, timestamps, and patient metrics.

- **Brand Display & Page Headings**: Compact, authoritative bold weights (`700` and `800`) paired with negative tracking (`-0.025em`) prevent visual sprawl in dense portal layouts.
- **Data Tables & Vitals**: Standard body weight relies on `0.75rem` (`text-xs`) with medium/semibold variations for patient names and primary metrics.
- **Section Headers & Badges**: Small caps and uppercase micro-labels (`label-xs`, `label-md`) use extended tracking (`0.05em` to `0.24em`) to establish visual separation for category dividers.

## Layout & Spacing

FiDo utilizes a **Fixed Navigation + Fluid Workspace** model:
- **Primary Rail Navigation**: Persistent `18rem` (288px / `w-72`) fixed sidebar on the left containing brand identity, profile status, and portal navigation.
- **Workspace Canvas**: Fluid main content container with an internal maximum width constraint of `max-w-7xl` (`80rem`), centered with `2rem` (`p-8`) padding.

### Grid & Responsiveness
- **KPI Metrics Deck**: Responsive 4-column fluid grid breaking down from 4 columns (`lg:grid-cols-4`) to 2 columns (`sm:grid-cols-2`) and 1 column on mobile (`grid-cols-1`) with a `1rem` gap (`gap-4`).
- **Operational Split**: 3-column asymmetric layout (`lg:grid-cols-3`) with primary data grids spanning 2 columns (`lg:col-span-2`) and auxiliary timeline/actions spanning 1 column (`gap-6`).
- **Rhythm**: Compact element gaps (`gap-1.5` to `gap-3`) inside interactive components prevent spatial bloat and maintain a scannable dashboard hierarchy.

## Elevation & Depth

FiDo establishes visual hierarchy primarily through **low-contrast outlines** and **subtle ambient shadows**, avoiding heavy skeuomorphism in favor of clinical precision.

- **Base Surfaces**: The background sits at neutral `fido-surface` (`#f8fafc`). Elevated cards and panels use pure white (`#ffffff`) bordered by `1px solid #e2e8f0` with a very soft ambient shadow (`shadow-xs` / `shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`).
- **Active Consultation State**: Employs an ambient gradient banner (`from-blue-600 to-fido-600`) with translucent white overlays (`bg-white/15`) and backdrop blur to pull critical live events forward.
- **Interactive Focus & Active Tokens**: Active sidebar links use flat, colored tinting (`bg-fido-100`) combined with a solid indicator tab, eliminating deep drop-shadows.
- **Modals & Slide-overs**: Raised to `z-50` with high-diffusion drop shadows (`shadow-2xl`) underpinned by a subtle backdrop blur (`backdrop-blur-xs`) and `slate-900/40` scrim.

## Shapes

The design system embraces a **Rounded (Level 2)** shape vocabulary, blending modern friendly curves with technical rigor:

- **Cards & Data Panels**: Structured with `rounded-2xl` (`1rem` / 16px) to soften analytical density.
- **Interactive Controls & Buttons**: Bound by `rounded-xl` (`0.75rem` / 12px) for comfortable touch/click targets.
- **Pills, Avatars & Status Indicators**: Full circular rounding (`rounded-full`) for queue tokens, user headshots, and live pulse dots.
- **Form Controls & Inputs**: Form fields and select triggers utilize `rounded-xl` (`0.75rem`) to align with primary action buttons.

## Components

### Buttons
- **Primary Action**: Solid `bg-fido-600` (`#1b5eb8`), `text-white`, `font-semibold text-xs`, `px-4 py-2`, `rounded-xl`, hover state transitioning to `bg-fido-700` (`#144994`) with micro `shadow-sm`.
- **Secondary / Neutral Action**: Pure white surface, `border border-slate-200`, `text-slate-700`, `hover:bg-slate-50`, `rounded-xl`.
- **Subtle / Action Pill**: `bg-fido-50` text `text-fido-700`, hover `bg-fido-100`, used for secondary table actions and internal charting triggers.
- **Destructive / Warning**: Bordered or softly tinted red (`hover:bg-rose-50 border-rose-200 text-rose-600`).

### Badges & Status Chips
- **Live / Online**: Full rounded pill (`rounded-full`), `px-2.5 py-1`, containing an inline SVG icon (video or profile) and text with subtle background tinting (`bg-blue-50 text-fido-600 border border-blue-100`).
- **Queue Tokens**: Square-proportioned rounded badges (`w-14 h-14 rounded-2xl` or `px-2 py-0.5 rounded-full`) with heavy font weight (`font-extrabold`) for unambiguous patient sequence identification.
- **Status Pills**:
  - In Consultation: `bg-emerald-50 text-emerald-700 border border-emerald-100` with an animated pulse dot.
  - Next in Line: `bg-amber-100 text-amber-800`.
  - Cancelled / Warning: `bg-rose-100 text-rose-700`.

### Data Tables
- Header row styled with `bg-slate-50/70 border-b border-fido-border`, uppercase `text-slate-500 font-semibold text-xs tracking-wider`.
- Rows feature subtle dividers (`divide-y divide-fido-border/70`), soft hover states (`hover:bg-slate-50/60`), and highlighted tinting for active patients (`bg-emerald-50/30`).
- Vertical cell padding locked at `py-3.5 px-4` to preserve high information density while preventing misclicks.

### Input Fields & Search Bars
- Background set to `bg-slate-50/50` bordered by `border-slate-200`, `rounded-xl`, with integrated leading icons (`text-slate-400`).
- Focus transitions smoothly into a 1px primary ring (`focus:ring-1 focus:ring-fido-600 focus:border-fido-600`).

### Cards & KPI Tiles
- Bounded by `border border-fido-border` on white card surfaces with `p-5 rounded-2xl`.
- Paired layout: Left text block (uppercase category label, large stat figure, status context) balanced by a right-aligned soft icon tile (`w-12 h-12 rounded-2xl`).
- Hover transitions offer subtle border accentuation matching the metric's functional color.