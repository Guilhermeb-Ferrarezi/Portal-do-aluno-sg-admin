---
name: portal-improvement-sprints
description: Organize, prioritize, and track improvements for the portal-do-aluno repository as ordered sprints with markdown checklists and progress counts. Use when the user asks for roadmap planning, sprint breakdowns, todo organization, refactor prioritization, UX polish planning, technical debt reduction, or what to improve next in this project.
---

default
# Portal Improvement Sprints

Use this skill to keep improvement work for this repository organized as a sprint board instead of scattered ideas.

## Workflow

1. Read `references/sprint-board.md` before proposing or executing improvement work.
2. Use the existing sprint order unless the user explicitly reprioritizes.
3. Treat the sprint board as the source of truth for improvement planning.
4. Keep every task in markdown checklist format.
5. Use `[ ]` for pending work.
6. Use `[x]` only after the work is implemented and validated.
7. Update the `Progresso:` line in the same edit where a checkbox changes.
8. If a new idea does not fit an active sprint, append it to `Backlog` instead of mixing priorities.

## Output Rules

- When the user asks "o que melhorar agora?", suggest the next unchecked items from the earliest active sprint.
- When the user asks for a roadmap or planning, answer from the sprint board before inventing a new structure.
- When executing an improvement item, identify the matching checklist entry and update it after validation.
- Keep sprint items action-oriented and scoped to one deliverable whenever possible.
- Prefer evolving the existing board over creating parallel todo files.

## Resource

- Sprint board: `references/sprint-board.md`
