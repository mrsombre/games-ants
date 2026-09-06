# Domain documentation

## Before domain or architecture work

1. Read the root `CONTEXT.md`.
2. Read every relevant ADR under `docs/adr/`.
3. If either location is absent, continue silently. Domain-modeling work creates documents when terminology or decisions stabilize.

## Layout

This repository uses one domain context:

```text
/
├── CONTEXT.md
└── docs/
    └── adr/
```

## Vocabulary

Use the terms defined in `CONTEXT.md`. Treat a missing term as either vocabulary drift or a domain-model gap.

## ADR conflicts

Surface any contradiction with an existing ADR and identify the decision that would need reconsideration.
