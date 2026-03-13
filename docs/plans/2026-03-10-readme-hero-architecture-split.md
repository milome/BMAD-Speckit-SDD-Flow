# README Hero and Architecture Graphics Implementation Plan

> ✅ **DONE** — 已完成于 2026-03-13

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dense README hero banner with a simpler slogan-plus-emblem banner and move the accurate five-layer architecture into a separate larger architecture overview graphic embedded lower in the README.

**Architecture:** Keep the top visual focused on brand recognition and first-impression clarity: left-aligned slogan, single concise subtitle, and a right-side flow-engine emblem. Preserve all accurate five-layer architecture content in a dedicated second SVG so the README can communicate both identity and system structure without overloading the hero area.

**Tech Stack:** Markdown, SVG

---

### Task 1: Redesign the top hero banner

**Files:**
- Modify: `docs/assets/readme-slogan.svg`

**Step 1: Replace dense architecture content with minimal hero layout**

Create a cleaner composition with:
- left: `Think in Agents.` / `Ship by Spec.`
- short subtitle: `BMAD orchestration with spec-driven delivery and audit loops.`
- right: emblem-style flow-engine mark using nodes, directional pathing, and an audit checkpoint motif
- no five-layer explanatory text in the hero

**Step 2: Verify readability**

Open the SVG and confirm:
- slogan is the strongest element
- emblem reads clearly at README scale
- subtitle stays concise and legible

**Step 3: Commit**

```bash
git add docs/assets/readme-slogan.svg
git commit -m "design: simplify README hero banner"
```

### Task 2: Create the separate architecture overview graphic

**Files:**
- Create: `docs/assets/readme-architecture-overview.svg`
- Source reference: `docs/README.backup-20260310.md:220-286`

**Step 1: Create a large architecture SVG**

Include the accurate five-layer structure:
- Layer 1: Product Brief → Complexity Evaluation → PRD → Architecture
- Layer 2: create-epics-and-stories → Epic/Story lists → dependency map → worktree decision
- Layer 3: Create Story → Party Mode → Story document → 1st Audit
- Layer 4: specify → plan → GAPS → tasks → TDD with §1–§5 audits
- Layer 5: Batch Push → PR generation → Human Review → Post-Implementation Audit

**Step 2: Make it readable as a content diagram**

Use:
- larger canvas than the hero
- bigger text and more whitespace
- clear layer cards and arrows
- concise labels that preserve correctness

**Step 3: Commit**

```bash
git add docs/assets/readme-architecture-overview.svg
git commit -m "design: add README architecture overview graphic"
```

### Task 3: Update README placement

**Files:**
- Modify: `README.md:1-30`

**Step 1: Keep hero near top**

Retain the hero SVG below badges.

**Step 2: Insert architecture overview lower in README**

Add a new architecture section or place the diagram near `## Why BMAD-Speckit-SDD-Flow?`, for example:

```md
## Architecture Overview

<p align="center">
  <img src="docs/assets/readme-architecture-overview.svg" alt="BMAD-Speckit-SDD-Flow architecture overview" width="100%" />
</p>
```

**Step 3: Verify flow**

Check that:
- the top hero is visually light
- the architecture diagram appears where users expect explanatory detail
- overall README scanning feels cleaner

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: separate README hero and architecture overview"
```
