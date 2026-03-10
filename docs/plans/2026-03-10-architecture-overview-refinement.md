# Architecture Overview Diagram Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the README architecture overview SVG so it reads as a hybrid system diagram + infographic, replacing button-like labels with visual flow semantics and reducing text.

**Architecture:** Keep the five-layer vertical structure, preserve the nested Speckit sub-flow in Layer 4, and express audit/review/gate semantics through diagram grammar: loops, checkpoints, decision diamonds, and directed flow lines. Reduce explanatory pills and let shapes carry meaning.

**Tech Stack:** SVG, Markdown

---

### Task 1: Replace button-like labels with system-diagram semantics

**Files:**
- Modify: `docs/assets/readme-architecture-overview.final.svg`

**Step 1: Keep the five-layer stack**
Preserve the current five layer titles and overall vertical reading order.

**Step 2: Remove floating button feel**
Replace detached pills with tighter, diagram-native symbols near the associated layer.

**Step 3: Encode audit closure visually**
Use loop arrows, checkpoint rings, and gate diamonds instead of repeated text labels.

### Task 2: Simplify wording and strengthen diagram readability

**Files:**
- Modify: `docs/assets/readme-architecture-overview.final.svg`

**Step 1: Shorten per-layer descriptions**
Keep only essential wording required to disambiguate the diagram.

**Step 2: Preserve the Speckit sub-flow**
Retain `specify → plan → GAPS → tasks → TDD` as the only expanded horizontal sub-process.

**Step 3: Ensure no text overlaps**
Adjust positions and density so all text remains readable without pills colliding with copy.
