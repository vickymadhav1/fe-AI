# Interview Mate AI UI Prototypes

This folder contains standalone SVG design references only. These files are not production UI, do not contain React or Vue components, and are not connected to routing, APIs, backend services, Electron, Razorpay, OCR, or the interview pipeline.

## Design Inspiration

The visual direction is inspired by Linear, Vercel, Stripe Dashboard, Cursor, Raycast, Arc Browser, Notion AI, Framer, and Supabase. The goal is a premium AI-first SaaS interface with a dark operating-system feel, clear hierarchy, compact surfaces, and high-confidence live workflow states.

## Color Palette

- Background: `#05070B`, `#070812`, `#0B111D`
- Panels: `#0E1422`, `#101827`, `#111827`
- Borders: `#263347`, `#334155`
- Primary text: `#F8FAFC`
- Secondary text: `#CBD5E1`
- Muted text: `#64748B`
- Accent cyan: `#38BDF8`
- Accent violet: `#7C3AED`, `#8B5CF6`
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`

## Typography

The prototypes use Inter-style typography through SVG font declarations. Implementation should use the application's existing font stack unless a formal typography update is planned.

## Design Philosophy

- Keep the product useful on the first screen, with no marketing detours inside the app.
- Prefer dense but calm layouts for operational screens.
- Make live interview surfaces glanceable, not decorative.
- Keep Invisible Mode visually premium while making credit usage obvious.
- Treat AI suggestions as compact decision support, not long-form content.
- Use status indicators and confidence markers consistently.

## Prototype Inventory

- `dashboard.svg`: workspace overview, activity, metrics, quick actions, recent interviews.
- `live-interview.svg`: transcript, AI suggestions, meeting status, floating assistant, processing states.
- `invisible.svg`: credit wallet, usage analytics, upgrade cards, Invisible Mode toggle state.
- `payment.svg`: Razorpay UPI-only checkout concept and purchase flow.
- `history.svg`: search, filters, timeline, interview cards.
- `settings.svg`: profile, AI preferences, capture settings, billing, subscription.
- `companion-window.svg`: floating assistant panel for real-time suggestions.
- `login.svg`: premium authentication screen reference.
- `pricing.svg`: Invisible credit pricing section.
- `sidebar.svg`: navigation reference.
- `ai-cards.svg`: reusable AI suggestion card system.

## Recommended Implementation Order

Implement `live-interview.svg` first because it is closest to the application's core workflow and will define the visual language for transcript, suggestions, capture status, and Companion Window behavior.

After that, implement `invisible.svg` and `payment.svg` together so credit wallet, upgrade plans, and Razorpay purchase states stay visually consistent.

## Developer Notes

- Do not copy these SVGs directly into production as functional UI.
- Use them as visual references for spacing, hierarchy, states, and tone.
- Preserve existing application behavior during future implementation.
- Keep OCR, AI prompt generation, Socket.IO flow, Razorpay verification, and Electron capture behavior separate from UI styling work.
- Validate responsive behavior separately; these mockups are fixed-frame design references.
