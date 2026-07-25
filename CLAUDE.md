## AI development workflow

Superpowers is the primary implementation methodology.

Use Superpowers for:
- brainstorming before new implementation
- design approval
- implementation planning
- TDD
- plan execution
- systematic debugging

Use gstack only as explicit quality gates:
- /plan-ceo-review for product-level decisions
- /plan-eng-review after an approved design
- /plan-design-review for user-facing flows
- /review after implementation
- /cso for security-sensitive slices
- /qa-only for staging verification
- /ship for approved delivery

Do not let gstack expand an already approved scope.
Do not let QA automatically modify auth, RLS, grants, or migration code.
When workflows conflict, the approved design and implementation plan take precedence.
