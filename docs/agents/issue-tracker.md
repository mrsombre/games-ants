# Local issue tracker

Store work items in `.scratch/`. Reserve `.tmp/` for temporary files.

## Layout

- Feature: `.scratch/<feature>/`
- Specification: `.scratch/<feature>/spec.md`
- Ticket: `.scratch/<feature>/issues/<NN>-<slug>.md`
- Discussion: append under `## Comments`

Use one numbered file per ticket, starting at `01`.

## Operations

- Publish: create the appropriate file under `.scratch/<feature>/`.
- Fetch: read the path or ticket number supplied by the user.

## Wayfinding

- Map: `.scratch/<effort>/map.md`
- Child: `.scratch/<effort>/issues/<NN>-<slug>.md`
- Metadata: `Type: research|prototype|grilling|task`
- State: `Status: claimed|resolved`
- Dependencies: `Blocked by: NN, NN`

Claim a ticket by saving `Status: claimed`. Resolve it by adding `## Answer`, saving `Status: resolved`, and recording the result in the map.
