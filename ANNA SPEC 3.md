# ANNA — Product Spec (reference only)

Agents: read only the sections your current task names. Do not act on sections outside your phase.

## 0. Ground rules (apply to every phase)
- Anything marked DONE, or already working, must not be rebuilt, redesigned or re-tested. Build on top of it.
- Work on the existing project. Inspect before editing. Commit before significant changes.
- Preserve: authentication and credentials, the five existing sections, Settings, all stored user data, the downloaded model.
- Never hardcode, expose or change credentials.
- Prefer small, targeted changes over rewrites. Add a dependency only if it clearly beats writing it yourself.
- Exact maths, dates and times come from code, never from the language model.
- Never invent balances, hours, wages, achievements or events. If data is missing, say so.
- Never report something as working unless you ran it. Separate "tested" from "needs real-iPhone test".
- Report at the end of each phase in 10 lines max: changed files, tests run (pass/fail), open issues, anything needing my approval, keys or payment.

## 1. Design (DONE: don't redo or restyle; new screens just match it)
- Colours: black #000000, midnight #080D18, ice blue #A9DFFF, cyan #75CFFF, soft white #EAF7FF.
- Jost for branding, Apple system font for UI text.
- Glowing ice-blue orb logo with a subtle breathing animation. Soft blue edge glow.
- Minimal, premium, Apple-like. No grey/charcoal backgrounds, no heavy neon, no clutter.
- Welcome screen: "ANNA", orb, greeting "Hey, Jamal.", "Your space. Your thoughts. Your ANNA.", button "Meet ANNA", footer "POWERED BY TAMANY.TECH".
- Password screen: same style, one field, one button, existing auth unchanged.
- Home is the main AI experience.
- Native-app feel: ‹ back button top-left (not on Welcome) plus swipe-back; no zoom, bounce or text selection; screens fit without page scrolling; safe areas respected; portrait only.
- Buttons about 44–48px tall, with generous spacing.

## 2. Offline AI (DONE in v0.6.0: don't change the engine)
- Engine: WebLLM (WebGPU) with Qwen2.5-0.5B-Instruct q4f16_1 (~290 MB), cached on the device. It replaced wllama, which used too much memory in Safari.
- Tested on iPhone 15: loads in about 61s, replies offline in 1–2s.
- The ANNA system prompt sets her personality. Other features call this engine; they don't load their own.

## 3. Memory and journal (Priority 2)
- Local stores (IndexedDB) kept apart: profile, preferences, goals, journal, saved memories, finance, calendar, staff, progress.
- Journal: daily entries, mood, search, edit, delete. Private by default. AI reflection only when the user asks.
- Journal entries are never auto-copied into memory. Ask before saving anything sensitive.
- Users can review and delete anything stored.
- Data export and recovery. Optional encrypted backup/sync, only with explicit consent.
- Journal covers: experiences, reflections, important events, relationships, achievements, challenges.
- Prompts get only the few relevant items, never whole histories.
- Optional check-ins ("How are you feeling today?") that are light and not repetitive.
- Goals: daily, weekly, monthly and long-term, plus habits and reviews. Encouragement must be based on real records only.
- Tone: listen first and understand before advising. Learn whether the user wants listening, encouragement, honesty, questions, steps or accountability. No diagnosing, no labelling people, no pressure. Point to professional or emergency help when needed. Don't encourage dependence.

## 4. Money and business (Priority 3)
- Monthly calculator that works without the AI. Inputs: income, extra income, rent, electricity, water, food, transport, subscriptions, debt, custom bills (add, rename, remove), once-off costs, savings.
- Outputs: total income, total expenses, total bills, total savings, remaining money, weekly and daily allowance (state the assumption used, e.g. 30-day month), percentage of income spent, surplus or shortfall.
- ZAR by default, with selectable currencies. Save each month and compare months.
- Test case: income 15,000 minus rent 5,000, food 2,000, transport 1,000, electricity 800 and other 700 leaves R5,500.
- Advanced calculator using an exact-maths library: percentages, VAT (SA 15%), wages, hours, overtime, margins, profit and loss, budget comparisons, financial projections. Show the working when useful.
- Financial intelligence also covers savings, debt, bills, commitments and spending patterns.
- "Can I afford R2,000?" uses recorded figures to answer BUY, WAIT, REDUCE COST or AVOID, explains why, and lists any missing data.
- Staff: records, shifts, timesheets, hours, wages, overtime, tasks, expenses, sales. Use only data that was entered.

## 5. Time and calendar (Priority 4)
- Use the device clock, the IANA time zones built into Intl, UTC for stored timestamps, and correct daylight-saving handling.
- Understand: today, tomorrow, next Friday, next month, time in other cities, public holidays (SA first), recurring events.
- Local calendar and reminders: appointments, birthdays, bills, shifts, deadlines, routines, reviews.
- Before building anything, state what iOS PWAs can actually do: web push works only for apps installed to the Home Screen and needs a push server. There's no direct Apple Calendar access, but .ics export works. Google Calendar needs OAuth.
- Label each item as a local reminder, a device calendar event or a synced event. Never say something was saved unless the save succeeded.

## 6. Research and routing (Priority 5)
- Web research only when online and only through a service I approve (state its cost and API key). Cite sources. Never pretend a search happened while offline.
- Never send journal, finance or personal data outside the device without explicit consent.
- Routing: time questions go to the clock, maths to the calculator, "remind me" to the date engine plus reminders, "what did I say" to memory, "can I afford" to finance plus the calculator, "how did I feel" to the journal, staff hours to timesheets, current events to research. Everything else goes to Qwen. Run the tool first, then let Qwen phrase the answer.
- The user should feel they're talking to one companion.
