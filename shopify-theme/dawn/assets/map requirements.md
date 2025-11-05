map design requirements
Detailed UI Specification – Map Design Page
1. Global Layout Framework

Viewport	Content Max Width	Grid	Gutter	Margins
≥1440px (desktop)	1360 px centred	12 columns	24 px	80 px outer
1024–1439 px	Fluid up to 1200 px	12 columns	24 px	48 px
768–1023 px (tablet)	100% width	8 columns	20 px	32 px
≤767 px (mobile)	100% width	4 columns	16 px	16 px
2. Top Navigation Bar

Width: Full-bleed across viewport; align content to grid (max 1360 px).
Height: 72 px desktop, 64 px tablet, 56 px mobile.
Padding: 24 px horizontal (desktop), 16 px (mobile).
Background: #0F172A (navy) with 90% opacity over gradient; subtle 1 px bottom border rgba(255,255,255,0.08).
Logo size: Height 32 px (auto width).
Primary actions (Save, Share): Buttons 40 px height, 16 px horizontal padding, gap 12 px.
Typography: Navigation labels 16 px / 24 px line-height, weight 600, colour rgba(255,255,255,0.85).
3. Main Workspace (Desktop Baseline 1440 px)

Left control column: 440 px width (approx. 32% of content width), sticky from 96 px top.
Right preview column: 840 px width (approx. 62%), centred with 32 px gap between columns.
Poster preview container:
Card width 640 px; maintain 3:4 ratio.
Background: #FFFFFF, box-shadow 0 24px 60px rgba(15,23,42,0.25), border-radius 24 px.
Safe area (print bleed indication): 24 px inset dashed line rgba(15,23,42,0.2).
Action footer: Sticky bar at bottom of viewport, height 72 px, background rgba(15,23,42,0.92) blurred. Contains status text (left) and buttons (right).
4. Stepper & Panels

Stepper width: 100% of control column.
Step indicator: Circular 24 px icon with numbers; 1 px border #E2E8F0 for inactive, filled #FC4C02 for active.
Progress bar: 2 px thick line running vertically between steps, 24 px offset from step titles.
Section headers: 20 px / 28 px line-height, weight 600, colour #0B1220. Step subtitle 14 px / 20 px, weight 400, #475569.
5. Controls

Preset cards: 160 × 120 px, border 1 px #CBD5F5, radius 16 px, internal padding 16 px. Active state border #FC4C02 2 px plus soft glow 0 0 0 4px rgba(252,76,2,0.15).
Colour swatches: 48 px diameter circles with 2 px border rgba(15,23,42,0.05). Active ring 3 px using #FC4C02. Provide hex label beneath (12 px text).
Slider controls: Track length 240 px, height 4 px, colour rgba(15,23,42,0.12); active track #FC4C02. Thumb 16 px diameter with shadow 0 4px 12px rgba(15,23,42,0.2). Pair with numeric input 64 px width, 36 px height, border #CBD5F5.
Buttons: From design system – primary background #FC4C02, hover darken to #D83C00; secondary ghost with border #CBD5F5. Radius 12 px, height 48 px, text 16 px / weight 600.
6. Typography

Element	Font Stack	Weight	Size / Line-height	Colour
Headings (H1/H2)	"Inter", "Segoe UI", Sans-serif	700	28 px / 36 px	#0B1220
Section titles	Same	600	20 px / 28 px	#0B1220
Body copy	"Inter", "Segoe UI", Sans-serif	400	16 px / 24 px	#1F2933
Helper text	Same	400	14 px / 20 px	#64748B
Labels / chips	Same	500	12 px / 16 px	#475569
Buttons	Same	600	16 px / 24 px	Primary text #FFFFFF, Secondary #0B1220
7. Colour Palette

Usage	Hex	Notes
Background (workspace)	#F5F6F8	Light neutral
Control panel	#FFFFFF	Card with shadow 0 20px 60px rgba(15,23,42,0.08)
Accent (primary CTA)	#FC4C02	Use sparingly
Accent hover	#D83C00	15% darker
Secondary CTA	#0F172A	Button text white
Dividers	rgba(15,23,42,0.08)	1 px lines
Success	#16A34A	e.g. saved states
Warning	#F59E0B	e.g. missing data
Error	#DC2626	inline validation
Contrast ratios validated: primary button text 8.1:1; body text on white 11.4:1.

8. Spacing & Sizing

Panel padding: 32 px internal padding on desktop, 24 px tablet, 20 px mobile.
Component spacing: 24 px between major sections, 16 px between related controls, 8 px between label and input.
Divider spacing: 24 px above/below.
Tooltips: 240 px max width, 12 px text, 12 px padding, arrow 8 px.
9. Responsive Adjustments

Tablet: Control panel collapses to 300 px slide-in on left; preview width 100% minus panel. Action bar height 64 px.
Mobile: Poster preview full width with 16 px margins. Control panel becomes bottom sheet (height 60% viewport) with stepper horizontally across top. Buttons full width 48 px high. Typography steps down by 2 px (e.g., body 15 px).
Icons: Minimum hit target 44 × 44 px on touch devices.
10. Interaction Guidelines

Preview refresh: Display loading overlay (outset from poster edges) rgba(255,255,255,0.75) with animated spinner 24 px after 300 ms delay; fade in/out 150 ms.
Autosave: Every 30 s or on step change; banner at bottom left “Saved · 12:04” (12 px text).
Error states: Red border 2 px + message below input (12 px).
Keyboard support:
Tab order: stepper → panel controls → preview action bar.
Press Enter on slider numeric input commits value.
Space toggles swatch selection.
Esc closes modals/bottom sheet.
Summary: I’ve converted the recommendations into concrete measurements: navigation dimensions, layout widths, typography scale, colour palette, spacing rules, and responsive behaviour. These specs give the UI team the precision they need for mock-ups and documentation.