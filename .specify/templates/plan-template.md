# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Source: `.specify/memory/constitution.md` v1.0.0

Mark each gate PASS / FAIL / N-A. Any FAIL MUST be recorded in **Complexity Tracking**
below, with a specific problem and why the simpler alternative was insufficient.

| #   | Gate                  | Check                                                                                                                                                                                                                    | Status |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| I   | مرجعیت یک‌طرفهٔ دانش  | Does any component write to, commit to, or mutate the knowledge repository? Does the system still function while that repository is unavailable?                                                                         |        |
| II  | دادهٔ خام دست‌نخورده  | Are verbatim user answers stored separately from derived values and never overwritten? Are extraction rules versioned data rather than hardcoded logic? Is every derived value traceable to raw input plus rule version? |        |
| III | لبه خودکفاست          | Can a submission complete end to end — questions, access check, ID issuance, durable storage — with the core unreachable? Is the tracking ID issued at the edge? Is transfer queued and retried in both directions?      |        |
| IV  | تعهد پاسخ             | Is the seven-day commitment enforced by the system, with at-risk items surfaced _before_ breach? Can any request close without a recorded written response? Can any human-facing message send without human approval?    |        |
| V   | متریک و تاریخ بازبینی | Can an execute-decision be recorded without exactly one success metric and one review date? Is fast-track ever blocked, or ever exempt from the 48-hour accounting?                                                      |        |
| VI  | مرزهای ماژول          | Are intake / dashboard / reports independent, with no shared mutable state? Would a new report be a new module rather than a special case in an existing one?                                                            |        |
| VII | متناسب با مقیاس       | Does any chosen infrastructure need scale beyond ~30–50 submissions per month, ~300 knowledge documents, and one part-time developer to justify itself?                                                                  |        |
| R   | تاب‌آوری و آزمون      | Are the five mandatory resilience tests planned, including an executable test for SC-004 (72-hour outage, zero loss)?                                                                                                    |        |
| L   | زبان و تقویم          | Is all user-facing text Persian, with Jalali calendar and Tehran time in every display? Are internal analytical values hidden from submitters?                                                                           |        |
| S   | اسرار و دسترسی        | Are all credentials outside the repository? Is access derived from channel membership rather than a hand-maintained list?                                                                                                |        |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
