# Goal Execution Contract

<!-- goal-slot:frontMatter required dynamic=frontMatter -->
<!-- /goal-slot:frontMatter -->

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, and do not claim completion until every strict acceptance item passes.
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

<!-- goal-slot:goalEntry required dynamic=goalEntry -->
<!-- /goal-slot:goalEntry -->

The full execution contract is this document, not the command text.

## Contract Freeze Rules

- `/goal` must not rewrite this contract.
- `/goal` must not replace this contract with a different task list, acceptance matrix, completion gate, or authority model.
- `/goal` must not convert this template into a JSON-generates-Markdown design.
- `/goal` must not convert a consumer compiler into a hardcoded local Markdown string that bypasses shared template slots.
- If this contract is incomplete, `/goal` must stop with `contract_amendment_required` and list the missing fields.
- If acceptance criteria are insufficient, `/goal` must stop with `contract_amendment_required`; it must not silently add stricter acceptance criteria while executing.
- If a task requires files outside its declared write scope, `/goal` must stop with `scope_amendment_required` unless this contract explicitly allows scope expansion.
- If a requirement semantic decision is missing, `/goal` must stop with `semantic_decision_required`.
- If a validation command is unavailable, ambiguous, and not produced by a declared earlier or current task in this contract, `/goal` must stop with `validation_contract_required`.

## Contract Completeness Gate

Before editing files, verify this contract has all required sections:

- `/goal Entry`
- `Contract Freeze Rules`
- `Contract Completeness Gate`
- `Non-Negotiable Execution Rules`
- `Authority Model`
- `Root Cause To Fix`
- `Domain-Specific Contract Addenda`
- `Implementation Tasks`
- `Strict Acceptance Checklist`
- `Acceptance Traceability Matrix`
- `Required Test Commands`
- `Manual Verification Scenarios`
- `Completion Evidence Packet`
- `Stop Conditions`

Before editing files, verify the frozen front matter has no unresolved placeholders and that every required slot was rendered.

Fail closed when any required section, field, task ID, acceptance ID, evidence command, matrix row, slot, or invariant fragment is missing.

## Non-Negotiable Execution Rules

- Use the shell required by the host environment and repository rules.
- Use `apply_patch` for manual code and documentation edits.
- Run the project encoding gate before and after Markdown, JSON, skill, command, or generated-surface edits when the repository provides one.
- Inspect `git status --short` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output or direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, or audit prose alone.
- Do not weaken the declared machine-readable authority.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, or tests.

## Authority Model

<!-- goal-slot:authorityModel required dynamic=authorityModel -->
<!-- /goal-slot:authorityModel -->

## Root Cause To Fix

<!-- goal-slot:rootCause required dynamic=rootCause -->
<!-- /goal-slot:rootCause -->

## Domain-Specific Contract Addenda

Use this section to bind any domain-specific classifier, state machine, schema, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, or other machine contract.

<!-- goal-slot:domainAddenda required dynamic=domainAddenda -->
<!-- /goal-slot:domainAddenda -->

## Implementation Tasks

<!-- goal-slot:implementationTasks required dynamic=traceSlices -->
<!-- /goal-slot:implementationTasks -->

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

<!-- goal-slot:strictAcceptanceChecklist required dynamic=traceEvidence -->
<!-- /goal-slot:strictAcceptanceChecklist -->

## Acceptance Traceability Matrix

<!-- goal-slot:acceptanceTraceabilityMatrix required dynamic=traceEvidence -->
<!-- /goal-slot:acceptanceTraceabilityMatrix -->

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

<!-- goal-slot:requiredTestCommands required dynamic=requiredCommands -->
<!-- /goal-slot:requiredTestCommands -->

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

<!-- goal-slot:manualVerificationScenarios required dynamic=manualScenarios -->
<!-- /goal-slot:manualVerificationScenarios -->

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

<!-- goal-slot:completionEvidencePacket required dynamic=evidencePacket -->
<!-- /goal-slot:completionEvidencePacket -->

## Stop Conditions

<!-- goal-slot:stopConditions required dynamic=stopConditions -->
<!-- /goal-slot:stopConditions -->
