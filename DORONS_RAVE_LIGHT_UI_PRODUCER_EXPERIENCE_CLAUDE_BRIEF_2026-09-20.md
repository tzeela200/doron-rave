# DORON'S RAVE — Light UI / Producer Experience Rebuild
## Master implementation brief for Claude Code
**Version:** 2026-09-20  
**Goal:** Redesign the current interface into a light, premium, producer-first operational app **without losing any existing data, business logic, flow, endpoint, action, calculation, or screen capability**.

---

# 0. First principle

This is **not a rewrite** and **not a product reset**.

The current system already works and contains important operational logic.  
The task is to improve **visual design, information hierarchy, navigation, consistency, scanability, and mobile ergonomics** while preserving all functionality.

The product is a personal operating system for an event producer. It should help Doron understand and manage an event quickly, not behave like an AI assistant that invents work for him.

The UI must feel:
- premium
- calm
- clear
- light
- practical
- fast to scan
- designed for real event production
- mobile-first
- RTL-first
- consistent across every screen

---

# 1. Non-negotiable safety constraints

## 1.1 Preserve all data and logic

Do **not**:
- delete or rename Google Sheets columns
- change sheet structure
- change existing records
- remove data
- remove calculations
- remove existing user actions
- remove existing screens
- remove existing endpoints
- rename `google.script.run` functions
- change formulas or business logic
- change event financial calculations
- change payment logic
- change artist scheduling logic
- change lineup overlap logic
- change break-even logic
- change coverage logic
- change readiness logic
- change archive behavior
- change IDs
- migrate storage
- add a database
- add React / Vue / Tailwind / build tooling
- change the technology stack

The current stack remains:
**Google Apps Script + Google Sheets + current HTML/CSS/JavaScript client.**

## 1.2 Frontend-first change

The redesign should be implemented primarily in:
- `src/Index.html`
- `src/Stylesheet.html`
- `src/JavaScript.html`

Do not modify `.gs` files unless a specific UI requirement cannot be fulfilled from existing data and the user explicitly approves that backend change.

## 1.3 Preserve regression protection

Before changing anything:
1. Read `HANDOFF.md`
2. Read `WORKLOG.md`
3. Read current `src/Index.html`
4. Read current `src/Stylesheet.html`
5. Read current `src/JavaScript.html`
6. Read `.ui-backup/check-ui.js`
7. Identify the current restore point and make a new backup before the redesign.

After every implementation batch:
- run `check-ui.js`
- run all available server/test suites
- test the app in the browser
- inspect browser console
- verify that no user action disappeared
- verify that no endpoint disappeared
- verify no horizontal scrolling on small mobile
- verify all touch targets remain accessible

Important: `check-ui.js` is not enough by itself. Runtime browser testing is mandatory.

---

# 2. This brief overrides previous visual rules

Previous instructions that required:
- a dark-only interface
- dark panel bodies
- white text everywhere
- dark gradients as the primary visual language
- “דורש טיפול” / AI-generated operational attention as a major dashboard block

are **no longer the desired direction**.

The new product direction is:

> **Light-mode-first, clean, premium, operational, consistent and producer-focused.**

The underlying data and functionality remain unchanged.

---

# 3. Product UX model

The application is built for a producer who needs to answer four questions quickly:

1. What events do I have?
2. What is the current state of this event?
3. Who and what are involved in this event?
4. What is happening financially?

The application should **present facts and user-created information**, not invent tasks.

---

# 4. Important product decision: remove “דורש טיפול” as an AI/system-generated task center

The current system contains a concept of “דורש טיפול” / attention center based on machine-generated interpretations.

This is **not wanted as a primary UX concept**.

Examples:
- an artist still needing payment is not automatically a “problem”
- a future payment is not automatically “something requiring attention”
- an expected production step should not be presented as an invented task

## New rule

Do not create, infer, or surface AI-generated tasks as if they were the user’s task list.

If the system already has alerts that are important for correctness, they may still exist technically, but they must not dominate the home screen or masquerade as personal tasks.

### Personal tasks / reminders

Only user-created items may be presented as:
- משימות
- תזכורות
- הערות
- To-do items

If Notes / reminders already exist, preserve them and present them clearly as **“המשימות / התזכורות שלי”**.

Do not invent new tasks.

---

# 5. Naming changes

Use the label:

## **אמנים וליין אפ**

Do not shorten this area to only “אמנים” when it represents artist scheduling / performance planning.

---

# 6. Visual direction

## 6.1 Overall style

Use a **warm light premium dashboard**.

Not sterile corporate white.  
Not colorful toy UI.  
Not dark nightclub UI.

The visual reference is:
- warm editorial light background
- white cards
- subtle depth
- strong typography
- restrained event-industry personality
- selective color
- luxury / production feel

## 6.2 Recommended palette

Use semantic design tokens, not raw hard-coded colors inside individual components.

Suggested master tokens:

```css
--bg: #F7F5F1;              /* warm off-white app background */
--surface: #FFFFFF;         /* primary cards */
--surface-soft: #F1EEE8;    /* secondary surfaces */
--text: #181716;            /* primary text */
--text-secondary: #6F6A64;  /* secondary text */
--border: #E2DED7;          /* separators */
--brand: #B28A46;           /* champagne/gold brand accent */
--brand-soft: #F1E7D2;

--blue: #52708D;
--blue-soft: #EAF0F5;

--green: #607A62;
--green-soft: #EDF2EC;

--clay: #9B6A57;
--clay-soft: #F3EAE6;

--violet: #75688C;
--violet-soft: #EEEAF3;

--sand: #9A8465;
--sand-soft: #F2EEE7;

--danger: #B64B47;
--danger-soft: #F7E8E7;

--success: #52705A;
--warning: #A76D2A;
```

Color should support meaning and recognition, but **must not be the only carrier of meaning**.

## 6.3 Color usage

Use:
- background = warm off-white
- cards = white
- primary text = near-black
- secondary text = muted warm gray
- brand gold = selection, active navigation, important CTA, brand details

Use category colors as **subtle accents**, not full heavy gradients.

Examples:
- thin accent line
- tinted icon background
- soft chip
- very light card header tint
- small status marker

Do not cover every card in a different saturated gradient.

## 6.4 Typography

The interface is Hebrew RTL.

Use **Heebo** consistently for the product UI unless the existing brand logo is used as an image.

Recommended hierarchy:

- Page title: 28–32px / 700
- Hero event title: 26–30px / 700
- Section title: 18–20px / 700
- KPI value: 26–32px / 700
- Card title: 16–17px / 600–700
- Body: 15–16px / 400–500
- Metadata: 13–14px / 400–500

Do not use body text under 14px.

## 6.5 Radius / shadow

Keep one system:
- card radius: 16px
- small controls/chips: 10–12px
- buttons: 12–14px
- low, subtle shadow only where depth is useful
- use borders more than shadows

Avoid inconsistent radii between screens.

---

# 7. Layout system — one grid for the whole product

Use one consistent layout system across all screens.

## Mobile

- page horizontal padding: 16px
- section gap: 24px
- card gap: 12px
- internal card padding: 16px
- small gaps: 8px
- large section gap: 32px
- minimum touch target: 48px
- no horizontal scroll

## Tablet / desktop

Use a centered content container with adaptive gutters.

The same visual hierarchy must remain; do not turn desktop into a completely different product.

## Grid rule

Use a 4/8px spacing rhythm only:
4 / 8 / 12 / 16 / 24 / 32 / 40 / 48

No arbitrary 17px, 23px, 29px spacing values unless technically necessary.

---

# 8. Shared component system

Do not design each screen independently.

Create reusable visual components and make all screens use them.

Required shared components:

1. `PageHeader`
2. `EventHero`
3. `StatCard`
4. `QuickActionCard`
5. `SectionHeader`
6. `AccordionSection`
7. `EventCard`
8. `PersonCard`
9. `PaymentRow`
10. `StatusChip`
11. `EmptyState`
12. `SearchBar`
13. `SegmentedControl`
14. `BottomNavigation`
15. `OverflowMenu`
16. `PrimaryButton`
17. `SecondaryButton`
18. `IconButton`
19. `FormField`
20. `BottomSheet / Modal`

The implementation can use existing renderer functions, but their visual structure should be normalized.

No screen-specific duplicate card CSS when a shared component can be reused.

---

# 9. Home screen — producer dashboard

The home screen is not an accounting report and not an AI task inbox.

It should answer:

> “What is happening in my production world right now?”

## Recommended hierarchy

### A. Compact brand header
- logo
- optional compact page title
- no oversized hero

### B. Main producer snapshot

Show the most useful global KPIs using one shared `StatCard` component.

Recommended:
- אירועים פעילים
- נותר לתשלום
- רווח / הפסד צפוי
- תשלומים קרובים (if this exists as factual data)

These cards should summarize facts, not generate instructions.

### C. Active events

This is the main content area.

Each event card should show:
- event name
- date
- location
- number of days until event
- optional true readiness percentage if already available
- one useful financial summary
- direct tap into event

Do not overload the card with every metric.

### D. My notes / reminders

Only if there are user-created notes/reminders.

Label clearly:
- `התזכורות שלי`
or
- `המשימות שלי`

Do not mix system-generated alerts into this area.

### E. Management / quick navigation grid

A consistent 2-column mobile grid.

Recommended tiles:
- אירועים
- אמנים וליין אפ
- ספקים
- קטגוריות
- תשלומים
- אמצעי תשלום
- חיפוש וסינון
- השוואת אירועים
- ייבוא רשומות
- Google Sheets

Each tile:
- same size
- same padding
- same icon size
- same label position
- same count style
- subtle category accent
- no heavy gradient required

The grid is for **navigation**, not duplicate creation actions.

Existing creation actions must remain accessible through the current FAB / creation flow.

---

# 10. Events screen

The events list should be simple and highly scannable.

## Header
- title: `אירועים`
- result count
- search
- filter segmented control: עתידיים / עברו / הכל (based on existing supported state)
- `+ אירוע חדש`

## Event card structure

Every event card should use the same layout:

### Row 1
**Event name**

### Row 2
`date · location`

### Row 3
`עוד X ימים`

### Optional row 4
one financial / operational summary that already exists

Example:

```text
IN THE FARM
16.10.2026 · פרדס חנה
עוד 26 ימים

29,840 ₪ רווח צפוי
```

Do not use ambiguous `כרטיסים`.

If a ticket quantity is displayed, label it explicitly:
- `כרטיסים שנמכרו`
- `150 מתוך 300`

If revenue is displayed:
- `הכנסות מכרטיסים`
or
- `הכנסות`

Never call revenue simply `כרטיסים`.

## Event actions

Preserve:
- edit
- duplicate
- archive
- any current event actions

Secondary/destructive actions may remain in the existing three-dot menu.

---

# 11. Event detail screen — the main work surface

This is the most important screen in the product.

The structure should be stable across every event.

## 11.1 Event hero

A clean white card with subtle accent.

Show:
- event name
- date
- location
- day/time if available
- large `X ימים לאירוע`
- real readiness percentage if already calculated
- small status chip
- three-dot event menu

Do not make the hero visually heavier than the rest of the product.

## 11.2 Financial snapshot

Immediately below the hero:

Use one shared 2-column `StatCard` grid.

Recommended:
- הוצאות
- נותר לתשלום
- הכנסות
- רווח / הפסד צפוי

Each card can remain clickable to open the relevant detailed section if that behavior already exists.

Keep all existing numbers and calculations unchanged.

## 11.3 Quick actions

Use compact action buttons/cards:
- הוצאה
- הכנסה
- תזכורת

Preserve existing creation flows.

## 11.4 Main event sections

Organize the current content into these producer-oriented groups:

### הפקה
- מצב הפקה
- הוצאות לפי תחום
- categories / subcategories / coverage
- all existing operational detail

### אנשים
- **אמנים וליין אפ**
- ספקים ואנשי קשר

### כספים
- סיכום כספי
- תשלומים ומקדמות
- הכנסות
- כרטיסים ונקודת איזון
- חלוקת הוצאות

### תיעוד
- הערות ותזכורות

Do not delete any current block.  
Reorder and visually normalize them.

## 11.5 Accordion behavior

Use progressive disclosure.

Rules:
- closed by default when appropriate
- one open at a time if this is the existing stable behavior
- header always contains a useful summary
- header height consistent across all sections
- chevron behavior consistent
- `aria-expanded` correct
- opening a section should not feel like a new page

Section headers should be light-mode cards with:
- icon
- title
- concise summary/value
- chevron

Not dark full-width gradients.

---

# 12. “אמנים וליין אפ” screen / section

This area should communicate both the people and the performance schedule.

Display:
- artist name / stage name
- real name if available
- start time
- end time
- duration
- agreed amount
- remaining payment
- cost per hour if already calculated
- overlap warning where existing data indicates overlap
- artist notes / reminders
- current payment state

The schedule should be readable as a lineup, not only as accounting rows.

Do not change the fact that artists may still be represented as expenses in the backend.

That is a data model concern; the UI should present the human operational concept.

---

# 13. Financial UX

Financial data is important, but the entire application should not look like a finance dashboard.

Use money formatting consistently.

Labels must be unambiguous:

- `הוצאות`
- `סוכם`
- `שולם`
- `נותר לתשלום`
- `הכנסות`
- `רווח צפוי`
- `הפסד צפוי`
- `הכנסות מכרטיסים`
- `כרטיסים שנמכרו`
- `נקודת איזון`

A negative result should not be presented as “רווח -29,840”.
Use:
**הפסד צפוי 29,840 ₪**

Preserve existing calculation logic.

---

# 14. Bottom navigation

Keep a maximum of 5 primary destinations.

Do not overload bottom navigation with secondary management tools.

Use the existing product destinations where possible and preserve current navigation behavior.

Recommended information architecture:

- בית
- אירועים
- central create action / FAB
- השוואה
- עוד / ניהול

If the current navigation already implements a stable five-destination pattern, preserve its behavior and only restyle it.

All icons must come from one vector icon family.  
No emojis as structural icons.

---

# 15. Interaction quality

Use subtle motion only.

Recommended:
- tap/pressed feedback: 80–150ms
- accordion transition: ~180–220ms
- modal/sheet: ~220–280ms
- hover/focus desktop: 150–200ms

Do not:
- animate large layout shifts unnecessarily
- use flashy page transitions
- use scroll storytelling
- use parallax
- animate numbers just for decoration

Respect `prefers-reduced-motion`.

---

# 16. Accessibility

Mandatory:

- RTL correct at document and component level
- text contrast ≥ 4.5:1
- non-text UI contrast appropriate
- touch targets ≥ 48px for mobile web controls
- visible keyboard focus
- icon-only buttons require `aria-label`
- accordion buttons require `aria-expanded`
- no meaning conveyed only by color
- no body text below 14px
- form labels remain visible
- error messages next to relevant fields
- loading and error states remain accessible

---

# 17. Forms

Do not remove or rename fields.

Improve only:
- grouping
- spacing
- label clarity
- field hierarchy
- sticky save actions if appropriate
- mobile keyboard ergonomics
- validation visibility

Every form must preserve:
- current defaults
- current values
- current save behavior
- current validation
- current cancel/back flow

---

# 18. Responsive verification

Must be tested at minimum:

- 320px
- 360px
- 375px
- 390px
- 768px
- 1024px

Requirements:
- no horizontal scrolling
- no clipped amounts
- no clipped Hebrew labels
- no hidden fixed-footer content
- tap targets remain usable
- the 2-column mobile grid should collapse only when truly necessary
- larger screens get wider gutters, not huge stretched cards

---

# 19. Implementation strategy

Do not redesign the whole application in one giant destructive edit.

Implement in controlled batches.

## Batch 1 — Design tokens + primitives
- semantic light theme
- typography
- spacing
- radii
- shadows
- icons
- buttons
- cards
- shared stat tile
- shared section header
- shared accordion

QA.

## Batch 2 — Home screen
- producer dashboard hierarchy
- remove “דורש טיפול” as primary home concept
- active events
- user-created reminders/tasks only
- management grid

QA.

## Batch 3 — Events list
- new shared event card
- search/filter cleanup
- event actions preserved

QA.

## Batch 4 — Event detail
- hero
- financial snapshot
- quick actions
- production / people / finance / documentation hierarchy
- shared accordion style

QA.

## Batch 5 — People screens
- אמנים וליין אפ
- suppliers
- person details
- payment/history presentation

QA.

## Batch 6 — Secondary screens
- payments
- categories
- payment methods
- comparison
- search
- import
- settings / management

QA.

## Batch 7 — final consistency pass
- typography audit
- spacing audit
- color-token audit
- icon audit
- accessibility audit
- responsive audit
- regression audit

---

# 20. Acceptance criteria

The redesign is accepted only if all of the following are true:

### Data and logic
- 0 data loss
- 0 renamed backend fields
- 0 removed endpoints
- 0 removed existing user actions
- 0 changed business calculations
- 0 changed records as a side effect of redesign

### UX
- every screen has clear information hierarchy
- user can identify the main purpose of a screen within a few seconds
- event detail is organized consistently
- no AI-generated “task” concept dominates the app
- only user-created notes/reminders are presented as personal tasks
- labels are explicit and not ambiguous
- `אמנים וליין אפ` is used where appropriate

### Visual
- light-mode-first
- warm off-white background
- white cards
- near-black text
- subtle brand gold
- category colors used as accents, not noisy full-card gradients
- same grid system
- same card language
- same accordion language
- same typography scale
- same icon family
- same spacing rhythm

### Technical
- all regression tests pass
- `check-ui.js` passes
- browser console has no errors
- app opens all major screens
- all current actions still execute
- no horizontal overflow on supported widths
- no interactive target below required size
- no text below minimum size

---

# 21. Final deliverables expected from Claude Code

At the end, provide:

1. concise summary of files changed
2. list of visual/UX changes
3. explicit confirmation that `.gs` / Sheets / data logic were not changed, or list any approved exception
4. regression test results
5. responsive test results
6. browser-console result
7. list of every existing capability verified after redesign
8. before/after screenshots of:
   - home
   - events
   - event detail
   - אמנים וליין אפ
9. any remaining limitation that is caused by missing backend data rather than UI
10. restore point / backup location

---

# 22. Critical instruction before coding

Before writing code, produce a short implementation plan based on the actual repository and current renderers.

The plan must explicitly identify:
- what will be changed
- what will not be changed
- which existing components/renderers will be reused
- which current visual rules conflict with this new brief
- how backward compatibility will be protected
- how each batch will be tested

Then implement batch by batch.

Do not “simplify” by deleting capabilities.

**The goal is the same powerful application, with a substantially better producer experience and a coherent light visual system.**
