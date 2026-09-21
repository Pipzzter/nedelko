# Documentation

Start with the [project README](../README.md). Active guidance is grouped by purpose; previous branch narratives and verification notes are historical records, not current acceptance evidence.

Nedelko was built with substantial AI coding assistance. Optional runtime AI supplies validated bilingual curriculum, supporting sessions and a preferred outdoor-date order. Environmental decisions, scheduling constraints, approvals and parent-message templates remain deterministic; the templates can embed accepted educational text. The [live-generation evidence](evidence/README.md) separates a real model call from synthetic conditions and from offline tests.

| Area | Documents |
| --- | --- |
| Architecture | [Overview](architecture/overview.md), [decision basis](architecture/decision-basis.md), [ADRs](architecture/adrs/README.md) |
| Development | [Quality gates](development/quality-gates.md), [Postman API tests](development/api-tests.md), [verification status](development/verification-status.md), [team PR workflow skill](development/skills/ekocuvar-pr-workflow/SKILL.md) |
| Operations | [Native development and demos](operations/local-development.md), [Docker and persistence](operations/docker.md) |
| Evidence | [Live AI generation and its limits](evidence/README.md) |
| Product | [Research and roadmap](product/research.md) |
| Reference | [Sources](reference/sources.md), [third-party code](reference/third-party.md), [licenses](reference/licenses/) |
| Archive | [Earlier verification notes](archive/verification-notes.md), [original feature branches](archive/feature-branches.md), [planner fix branches](archive/planner-fix-branches.md) |

## Team PR workflow skill

The reusable [ekocuvar-pr-workflow skill](development/skills/ekocuvar-pr-workflow/SKILL.md) follows the repository's observed branch names, commit subjects, PR merge style, and current quality gates. Its source and UI metadata live in this repository so teammates can review and share changes together.

Use it directly by asking: "Read `docs/development/skills/ekocuvar-pr-workflow/SKILL.md` and use it to commit, push, create or reactivate the appropriate PR, merge into main, and pull for [describe the changes]." Narrow the request when only preparation or an unmerged PR is wanted. The root project instructions also point agents to this skill for matching tasks.

For Codex skill-menu discovery, copy the skill folder into `.agents/skills` from a terminal allowed to write there. [Official Codex documentation](https://learn.chatgpt.com/docs/build-skills) describes this repository-scoped location. From the repository root, when the destination skill does not already exist:

```sh
mkdir -p .agents/skills
cp -R docs/development/skills/ekocuvar-pr-workflow .agents/skills/
```

Then invoke `$ekocuvar-pr-workflow` with the changes and desired scope. Keep the installed copy aligned with the source when the skill changes; inspect an existing copy before updating it. Restart Codex if the new skill does not appear. No global skill installation is needed.

## Maintaining these docs

- Add an ADR for changes to architecture, data ownership, evidence rules or development gates. Start from the [template](architecture/adrs/template.md).
- Update the decision basis when behavior changes; an ADR explains why, while the decision basis describes current rules.
- Keep commands in sync with `package.json` and `compose.yaml`. `npm run check` validates relative Markdown/HTML links.
- Keep README and scoped AGENTS.md files at their conventional entry points. Other project documentation belongs here.
- Do not turn an old test report into a new claim. Record the command, environment, result and limits of new verification.
