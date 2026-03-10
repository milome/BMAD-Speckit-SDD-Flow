# README Banner and Architecture Overview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the README top banner to keep the slogan while simplifying supporting copy and replacing the right-side detail panel with a process-engine emblem, then move the five-layer architecture content into a dedicated mid-page architecture overview SVG.

**Iterations (2026-03-10):**
- **Emblem → Badge:** Added gradient border (`badgeBorder`), top highlight strip, stronger product-logo feel.
- **Architecture → Flowchart:** Added arrow markers, vertical flow arrows between layers (L1→L2→L3→L4→L5), directional arrow on speckit sub-flow, Input/Output labels.

**Architecture:** Keep the hero banner focused on brand identity and positioning only. Create a second SVG that carries the full five-layer BMAD + Speckit flow, then update README placement so the visual hierarchy becomes hero first, architecture second.

**Tech Stack:** Markdown, SVG

---

### Task 1: Audit existing README and banner asset

**Files:**
- Modify: `README.md`
- Modify: `docs/assets/readme-slogan.svg`

**Step 1: Read current README hero section**
Confirm current banner placement, supporting copy, and the best insertion point for a new architecture overview section.

**Step 2: Read current slogan SVG**
Identify reusable styles, colors, and gradients so the redesign stays visually consistent.

**Step 3: Define new visual split**
Top banner: slogan, shorter subcopy, right-side emblem only.
Mid README: separate architecture overview image containing the five-layer flow.

### Task 2: Redesign top banner

**Files:**
- Modify: `docs/assets/readme-slogan.svg`

**Step 1: Keep title and slogan**
Retain BMAD-SPECKIT-SDD-FLOW branding and the two-line slogan.

**Step 2: Shorten supporting text**
Replace architecture-dense lines with concise product-positioning copy.

**Step 3: Replace right-side panel**
Remove the current five-layer stack and substitute a process-engine style emblem.

**Step 4: Preserve accessibility**
Update SVG title/desc text to match the new visual meaning.

### Task 3: Create dedicated architecture overview graphic

**Files:**
- Create: `docs/assets/readme-architecture-overview.svg`

**Step 1: Reuse current accurate five-layer information**
Carry over the existing layer names, sequencing, and audit concepts from the current banner.

**Step 2: Optimize for README mid-page use**
Design for section-level scanning rather than hero impact.

**Step 3: Preserve visual consistency**
Reuse compatible palette, typography, and signal colors from the hero banner.

### Task 4: Update README structure

**Files:**
- Modify: `README.md`

**Step 1: Keep the hero banner at the top**
Continue using `docs/assets/readme-slogan.svg` in the centered image block.

**Step 2: Add a new architecture overview section in the middle**
Insert `docs/assets/readme-architecture-overview.svg` near the "Why BMAD-Speckit-SDD-Flow?" explanation so the graphic sits beside related content.

**Step 3: Reduce duplicated bullets if needed**
Keep the nearby text readable and avoid repeating the exact same layer description too many times.
