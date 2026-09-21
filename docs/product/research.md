# Nedelko: product research and a path to a useful daily app

Desk research began on 20 September 2026; this record was updated on 21 September 2026. The product brand is Неделко / Nedelko.

**Recommendation:** build around one dependable daily loop: the teacher plans, the family knows what to expect, children enjoy the activity, and a short reflection improves the next plan. The strongest opportunity is a locally relevant, bilingual planner that responds clearly to changing conditions and connects classroom play with home.

This is desk research and product judgment, informed by the current code and primary sources, plus the owner-reported teacher pilot described below. It is not a formal interview study or a measured child-outcome study. “10/10” needs to be earned through observed usefulness, reliability and trust.

## Pilot feedback

The project owner reports a pilot session with a practising kindergarten teacher. According to the owner's account, she found the app promising, valued the weekly AI activity suggestions, and expected the combined weather, air-pollution and holiday information to reduce the work of daily and weekly planning. This is an attributed paraphrase, not a recorded quotation. Her identity, kindergarten and session date are not published, and no before/after planning-time measurement or wider adoption is claimed.

## What the sources suggest

| Evidence | Implication for Nedelko |
| --- | --- |
| NAEYC describes family partnerships as reciprocal and values what families know about their children. | Add a small, structured way for parents to contribute interests and observations, alongside teacher updates. [NAEYC family partnerships](https://www.naeyc.org/node/3810) |
| NAEYC’s developmentally appropriate practice emphasizes joyful play, individual context, language, culture and ability. | Offer flexible versions of practical activities and give teachers control over learning goals. [NAEYC definition](https://www.naeyc.org/node/3807) |
| Brightwheel documents lesson planning, reusable curriculum, observations, learning frameworks and sharing controls. | Planning and family communication are established product capabilities. Nedelko needs a distinctive local planning experience and teacher workflow. [Brightwheel learning](https://mybrightwheel.com/features/learning/) |
| Famly documents daily activity updates, optional notifications, parent contributions and secure staff messaging. | Parents need a clear daily view and a reliable way to respond. Notification preferences should be part of the design. [Famly parent guide](https://help.famly.co/en/articles/4912437-parents-get-the-most-out-of-the-app) |
| UNICEF’s 2025 AI guidance emphasizes children’s privacy, safety, inclusion, transparency and accountability. | Keep the AI teacher-facing, collect only necessary data, and retain human review of educational content. [UNICEF guidance](https://www.unicef.org/innocenti/reports/policy-guidance-ai-children) |
| WCAG 2.2 provides testable accessibility criteria, including keyboard interaction, visible focus, target sizing and accessible authentication. | Include accessibility checks in each release and test with real assistive-technology users. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) |

These sources support design principles and comparisons. They do not establish demand in Macedonian kindergartens, prove Nedelko’s effectiveness, or constitute local curriculum approval.

## What is already implemented in this update

- Kindergarten name and selected location, one group, and reusable planning preferences.
- A teacher-written brief for weekly generation.
- A single-day AI request, a preview, and a separate Apply action.
- Visible AI/library provenance and distinct failure handling.
- A read-only parent week with day navigation, Macedonian/English copy and printing.
- Revocable, expiring links; a dedicated control copies just the URL, while weekly and daily notice copies include the notice and enabled link.
- Private parent notes through the shared link, a teacher inbox and teacher-confirmed suggestions; a note cannot edit the plan itself.
- A server worker that revisits active plans every minute, selecting indoor alternatives and rebuilding parent drafts when conditions change.
- Responsive parent and teacher improvements while retaining Nedelko’s identity.

Current boundaries: the app runs on localhost; family links work on this computer. A link grants access to anyone holding it, without verifying parent identity. There is no email, push or SMS delivery. Both account and demo modes focus on planning, editing and read-only parent sharing. The earlier classroom simulation has been removed: neither mode offers two-way family conversations, child rosters, attendance, individual learning records or packing acknowledgements. The implemented private parent-note submission is a narrower teacher-review workflow. Demo examples remain synthetic and isolated from account data. Automatic checks require the server and computer to be running. The opportunities below are proposals, not implemented features or evidence of demand.

## Prioritized opportunities

Effort is relative engineering scope, not a delivery promise: **S** = an existing-screen extension; **M** = a new workflow or modest service; **L** = identity, delivery or collaboration infrastructure. Priorities are my recommendations to validate in a pilot.

| Order | Feature | Useful first version | Main benefit | Effort / dependency |
| --- | --- | --- | --- | --- |
| 1 | Hosted access and private family links | HTTPS hosting, teacher account recovery, expiring family-specific URLs, revocation and backups | Families can open the app on their own phones, without a parent login | L; foundation for family use |
| 2 | Clear change notices | “What changed, why, what to bring,” teacher preview, optional push/email, quiet hours and duplicate prevention | Parents understand a pollution-related indoor change quickly | M–L; hosted access and delivery preferences |
| 3 | History and undo | Version history, changes highlighted, restore a prior lesson while rechecking current conditions | Teachers can experiment with AI without fear of losing work | M; revision storage and conflict handling |
| 4 | Better AI planning quality | Teacher-reviewed bilingual evaluation set, repetition checks, regenerate one activity, preserve approved content | More useful first drafts with fewer corrections | M; educator review and measurable quality rubric |
| 5 | A classroom preparation checklist | Weekly materials grouped by day, reuse suggestions, who brings what, printable checklist | Less preparation work and fewer missing materials | S–M; uses current lesson/material data |
| 6 | Family-scoped parent contributions | Build on private notes with one optional prompt, verified family access and a private teacher reply | Family knowledge can influence the next plan | M; family-scoped links and visibility rules |
| 7 | A five-minute home activity | One optional activity connected to today’s learning; no purchases; “we tried it” or a short observation | An easy connection between classroom and family life | S–M; starts from the existing home habit |
| 8 | Inclusive activity variants | Teacher-selected seated, lower-noise, simpler-language and different age-band alternatives | More children can participate in the same group activity | M; educator-reviewed adaptations |
| 9 | Co-teacher handover | Owner/editor roles, daily responsibilities and visible concurrent edits | Staff can share planning without overwriting each other | L; organization/group identity and history |
| 10 | A lightweight learning journal | A teacher-approved group reflection, optional consent-controlled photo, and exportable term summary | Parents see learning over time, teachers retain useful evidence | M–L; permissions, storage and retention choices |
| 11 | Practical offline access | Cache the last plan with a prominent “last updated” time; queue draft edits for explicit conflict resolution | Teachers can work through poor connectivity | M; never present cached conditions as current |
| 12 | Locally reviewed curriculum connections | A small set of learning-goal tags mapped with Macedonian educators to the applicable curriculum | Plans become easier to explain and review pedagogically | M; local expertise and verified source material |

My first investment after hosting would combine change notices, undo and a preparation checklist. This gives parents clarity and teachers immediate daily value while the AI evaluation set is being built.

## Design the three experiences deliberately

**Teacher:** one home screen showing today’s activity, the condition update, changes awaiting review and the next preparation task. A daily AI request should show exactly what will change. Saving, sharing and approving a morning notice should have distinct feedback. Show the last successful environmental update, even when the latest refresh failed.

**Parent:** default to today; make the rest of the week one tap away. Lead with the practical message, then activity and learning goal. Offer language and notification preferences. Ask for an acknowledgement only when the kindergarten needs an action, so ordinary updates remain quiet. A “planned” activity must be distinguishable from a teacher-confirmed “we did this today.”

**Child:** use the adult’s app to support tangible play. Candidate features include printable picture cards, a group nature journal, choosing between two teacher-approved activities, and a shared reuse project. Test these with educators and families before adding a child-facing screen. Avoid comparative child rankings or reward mechanics that create pressure to use the app every day. These are proposed design choices, informed by the play and inclusion principles above.

## Make AI quality measurable

Structured output helps constrain response shape, and refusals still require explicit handling. Schema success alone is not a pedagogical quality score. [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

Build an initial set of 40 synthetic briefs across Macedonian/English, age bands, limited materials, inclusive participation, winter/rain, local occasions and day edits. Have an educator rate: instruction fit, age suitability, equivalent indoor/outdoor goal, preparation effort, natural language and variety. Save the prompt/schema version with each evaluation run. Use synthetic or explicitly consented examples, without child identifiers.

Track provider failures, validation failures, latency, teacher acceptance and size of edits separately. Start with bounded retries only for clearly transient failures; credit/auth failures need a visible explanation. A daily change must preserve the timetable and untouched lesson content. Keep weather/AQI calculations and permissions deterministic.

The committed [live-AI evidence](../evidence/README.md) records a successful complete bilingual week from `gpt-5.6-terra` on 21 September 2026, with accepted source `ai`. It used an isolated account and explicitly synthetic environmental conditions. Earlier smoke-test notes remain [historical records](../archive/planner-fix-branches.md), separate from this repeatable weekly proof. These runs do not establish a long-term success rate or pedagogical quality.

## Proposed pilot and success criteria

Start with one willing kindergarten, two educators and approximately 8–12 families for four weeks. This remains a proposed research plan, separate from the owner-reported teacher pilot; that feedback does not establish recruitment or completion of this four-week study.

1. **Before building more:** observe how teachers currently plan and how parents receive changes. Record the time spent, confusing steps and communication channels. Ask which missing information causes calls or messages.
2. **Week 1:** let teachers create and revise real plans while retaining their normal sharing process. Observe mistakes, especially unsaved edits and unclear AI fallback.
3. **Weeks 2–3:** pilot hosted family access after expiring link and visibility controls are ready. Test a clearly labeled simulated indoor change; do not fabricate a real pollution alert.
4. **Week 4:** review usage and interview both groups. Let teachers describe children’s participation; do not infer development from app clicks.

Suggested acceptance targets, to refine against the baseline:

| Measure | Proposed target |
| --- | --- |
| Teacher completes first plan without assistance | At least 4 of 5 observed attempts |
| Revise one day and keep the remaining lessons | Under 2 minutes of teacher interaction, excluding model wait |
| Parent finds today’s activity and preparation needs | Under 30 seconds in at least 4 of 5 observed attempts |
| AI drafts accepted with only minor edits | At least 80% on the educator-reviewed evaluation set |
| Lost edits or cross-group access | Zero in the tested release and pilot |
| Failed or stale environmental refresh | Every tested case visibly marks uncertainty and cannot renew an outdoor approval |
| Parent experience | Median usefulness rating at least 4/5, with reasons recorded |
| Teacher workload | A measured reduction from their own baseline; choose a target after observation |

Optimize for saved teacher time, parent understanding and enjoyable participation. Number of notifications, generated plans or screen minutes would be poor standalone success measures.

## Suggested delivery sequence

**First:** a hosted, recoverable pilot using private parent URLs, access tests, backups and monitoring. Retain the no-login parent experience; use revocable family-specific links for child-specific records.

**Next:** version history/undo, a concise change notice with delivery preferences, and preparation lists. Add explicit “planned / completed / changed” states.

**Then:** parent contributions, optional home activities, inclusive variants and a measured AI quality loop. Add Albanian or other family languages after validating demand and arranging language review.

**Later:** co-teacher collaboration, consent-controlled journals and curriculum mapping. Expand to multiple groups only when the single-group workflow is reliable and the pilot asks for it.

Billing, attendance hardware, unrestricted child AI chat and automated developmental scoring would substantially broaden the product. I would defer them while testing whether Nedelko’s planning-and-family loop earns repeated voluntary use.
