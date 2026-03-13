# README Slogan SVG Implementation Plan

> ✅ **DONE** — 已完成于 2026-03-13

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a distinctive README hero SVG banner that communicates the project's multi-agent, spec-driven, audit-loop identity and embed it near the top of README.

**Architecture:** Create a single self-contained SVG asset under `docs/assets/` so GitHub README rendering works without extra build steps. Update `README.md` to reference the new asset directly below the badges so the slogan appears immediately in the repository hero area.

**Tech Stack:** Markdown, SVG

---

### Task 1: Create asset directory and banner SVG

**Files:**
- Create: `docs/assets/readme-slogan.svg`

**Step 1: Write the SVG asset**

Create a self-contained SVG with:
- dark GitHub-friendly background
- main title: `Think in Agents.` and `Ship by Spec.`
- subtitle: `BMAD + Spec-Driven Development + Mandatory Audit Loops`
- primary workflow row: `Idea → Spec → Plan → Tasks → TDD → PR`
- floating labels: `AGENT`, `CRITIC`, `AUDIT`, `REVIEW GATE`
- connecting lines and glowing nodes for a BMAD-like multi-agent workflow feel

**Step 2: Validate readability**

Open the SVG in a browser or previewer and check:
- text is readable in GitHub dark mode context
- width works well for README embedding
- labels are not clipped

**Step 3: Commit**

```bash
git add docs/assets/readme-slogan.svg
git commit -m "feat: add README slogan banner asset"
```

### Task 2: Embed the banner in README

**Files:**
- Modify: `README.md:1-10`

**Step 1: Insert image reference below badges**

Add:

```md
<p align="center">
  <img src="docs/assets/readme-slogan.svg" alt="BMAD-Speckit-SDD-Flow slogan banner" width="100%" />
</p>
```

Place it below the badges and above the "Built on" paragraph.

**Step 2: Verify markdown rendering**

Check the rendered README preview and confirm:
- banner appears near the top
- spacing is clean
- alt text is meaningful

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: embed README slogan banner"
```

### Task 3: Final verification

**Files:**
- Verify: `README.md`
- Verify: `docs/assets/readme-slogan.svg`

**Step 1: Review final output**

Confirm the combined effect communicates:
- BMAD multi-agent orchestration
- spec-driven delivery
- mandatory audit loops

**Step 2: Final git status check**

Run:

```bash
git status
```

Expected: only intended README/banner changes remain unstaged or staged as appropriate.
