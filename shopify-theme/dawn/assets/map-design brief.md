Map Design Page – UI/UX Brief for Design Team
1. Project Overview

The map design page is the core revenue driver for the custom Strava poster experience. It must feel premium, guide customers smoothly through configuration, and instil confidence in print quality. The goal is to deliver a “best in class” poster builder that rivals or surpasses offerings from Mapiful, Atlas.co, Craft & Oak, and similar competitors.

2. Objectives & Success Measures

Increase conversion: Higher click-through to “Add to basket” / checkout. Target +20% lift in completed previews or add-to-cart events.
Improve task completion speed: Users should configure a poster in <3 minutes on desktop, <4 minutes on mobile (measured via usability testing).
Boost perceived quality: Improve satisfaction scores (>4/5 in post-test surveys) for “visual polish” and “ease of use”.
Accessibility compliance: Meet WCAG 2.1 AA for colour contrast, keyboard navigation, and semantic structure.
3. Key Problems to Address (from audit)

Inconsistent hierarchy and overwhelming control panel.
Neon gradients and low-contrast text reduce readability and premium feel.
Poster preview lacks dominance, with slow or unclear feedback on changes.
Disjointed copy and unclear next steps (no guided flow or progress indication).
Monolithic code and non-semantic markup hinder future iterations.
4. Design Principles

Preview-first: The poster preview should be the visual anchor; every control exists to enhance it.
Guided simplicity: Present steps in a logical order with progressive disclosure.
Calm premium aesthetic: Use an editorial, print-inspired visual language with restrained accent colours.
Immediate feedback: Any change should update the preview instantly or show clear loading states.
Inclusive by default: Meet accessibility standards and provide ample affordances.
5. Experience Blueprint

Step	Goal	Key UI Elements	Notes
1. Route & Basics	Confirm selected activity	Banner with ride summary, “Change ride” modal, location map thumbnail	Should be collapsible after confirmation
2. Style	Choose map style & theme	Preset cards with thumbnails, colour swatches, optional advanced settings	Offer curated presets (Classic, Night Ride, Minimal Monochrome, etc.)
3. Text & Details	Personalise titles & labels	Inline editing on poster plus form inputs, typography presets, alignment controls	Provide live character counts and style previews
4. Format & Checkout	Select size, orientation, finish	Format tiles (A3, A4), price call-out, delivery info, primary CTA	Sticky summary showing selections + price
Add a stepper or progress indicator (“Step 2 of 4 – Style”) with next/back buttons, and allow direct navigation once prerequisites are met.

6. Visual & Interaction Recommendations

Layout: Two-column desktop layout (left 35–40% controls, right 60–65% preview). On mobile, use a collapsible bottom sheet for controls and full-width poster preview.
Colour palette: Neutral backgrounds (#F5F6F8 / #121622) with brand accent (#FC4C02) only for primary CTAs and highlights. Avoid heavy gradients except in subtle accents.
Typography: Adopt core scale (e.g., Heading 24–28px, Body 16px, Microcopy 14px) with 1.5 line-height. Use consistent font weights (400/600/700).
Components:
Buttons: use standard primary/secondary styles from design system.
Accordions: labelled sections with numeric prefixes; open current step by default.
Sliders: pair with numeric inputs, min/max labels, and reset.
Colour swatches: circular or square chips showing actual palette, plus “Custom” option triggering colour picker.
Tooltips / info icons for advanced options.
Preview feedback: Add subtle animation or shimmer when re-rendering. Provide timestamp feedback (“Preview updated just now”).
Action bar: Sticky footer or top-right toolbar with “Save draft”, “Download proof”, and “Add to basket”, showing disabled state until preview refreshed.
7. Accessibility & Content

Ensure contrast ratios meet WCAG AA; avoid pink on purple combinations.
Provide descriptive headings (<h2>, <h3>) and aria-expanded on accordions.
Keyboard navigation: tab order follows stepper; focus states clearly visible.
Microcopy: adopt consistent tone; e.g., “Choose a theme to set the mood”, “Need help? View inspiration”.
Provide inline help for format choices (“A3 portrait – best for large prints, frame not included”).
8. Deliverables for UI Team

Wireframes (low/high fidelity): Desktop and mobile for each step, including variations (empty, loading, error states).
Component library updates: Button, accordion, swatch, slider, tooltip, bottom sheet, stepper. Provide Figma components tied to design tokens.
Visual design mock-ups: Final screens showcasing hero preview, inspiration gallery, and action bar. Include animation guidance for preview updates.
Accessibility checklist: Document contrast checks, keyboard flows, and screen-reader annotations.
Prototype: Interactive Figma prototype covering the full flow, with transitions between steps and preview interactions.
Design hand-off notes: Annotated specifications (spacing, typography, colour values) for engineering and QA.
9. Collaboration & Timeline

Research & discovery (1 week): Review competitor references, test current flow with 3–5 users to validate pain points.
Wireframes & user testing (2 weeks): Create stepper flow, run moderated testing, iterate.
Visual design & prototyping (2 weeks): Apply final art direction, refine interactions, deliver design system updates.
Development support (ongoing): Partner with engineering to ensure implementation matches designs; schedule design QA prior to launch.
10. Reference Inspirations

Atlas.co Builder: Clean step-by-step layout and premium copy.
Mapiful Poster Designer: Strong preset cards and instant feedback.
Ventum Ride Visualiser: Emphasises route preview with minimal controls.
Capture screenshots or screen recordings for the team to reference, focusing on layout, copy tone, preset galleries, and mobile adaptations.
This brief packages the earlier critique into concrete actions, deliverables, and guiding principles for the UI team. Let me know if you’d like it reformatted into a document or converted into tasks for a project tool.
