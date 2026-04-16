---
name: refrence
description: Design and visual reference plans for UI refactoring in the Portal-do-aluno. Use when the user asks to redesign, refactor, or restyle a page or component. Contains documented patterns, before/after specs, and implementation blueprints for each major UI change.
---

# UI Refactoring Reference Plans

Use this skill to store and retrieve structured plans for visual/UX refactors in this project.

## Workflow

1. Before starting a UI refactor, check `references/` for an existing plan for that component.
2. If no plan exists, design one and save it to `references/<component>-refactor.md`.
3. When executing a refactor, follow the plan's diff summary and verification checklist.
4. After completion, mark the plan as `[done]` in its header.

## Output Rules

- Each reference plan must include: Context, Visual Changes (with before/after class names), Section Layout diagram, and Verification steps.
- Plans describe only what changes — unchanged data/logic/APIs are not repeated.
- Import cleanup is always listed explicitly (which imports to remove).
- Verification must include: lint, build, and a role-by-role smoke test.

## Available Plans

- `references/dashboard-flat-refactor.md` — Dashboard.tsx: remove rounded cards, flat data-dense style (AbacatePay-inspired)
