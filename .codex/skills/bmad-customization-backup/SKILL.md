---
name: "bmad-customization-backup"
description: "Record and back up `_bmad` directory customizations in the current worktree so they can be migrated to a new worktree after reinstalling bmad-method. Use when: (1) Backing up `_bmad` optimizations before creating a new worktree or reinstalling BMAD, (2) Preparing a portable backup of `_bmad` changes for reuse, (3) Applying a previously saved backup to a fresh `_bmad` install in the current or another worktree. Requires project root and `_bmad` path; backups go under `_bmad-output/bmad-customizat"
---

# BMAD customization backup and migration

This skill **records and backs up** optimizations under `_bmad` in the current worktree and **migrates** them after reinstalling bmad-method in a new worktree.

**Script location**: This is a global skill; scripts live at `{SKILLS_ROOT}/bmad-customization-backup/scripts/` (e.g. Windows `%USERPROFILE%\.cursor\skills\`, macOS/Linux `~/.cursor/skills/`).

## Prerequisites

- Project root contains `_bmad` (BMAD installed).
- Backup output directory: `{project-root}/_bmad-output/bmad-customization-backups/` (created if missing).

## 1. Backup (capture current `_bmad` customizations)

**Goal**: Copy the current `_bmad` tree into a timestamped backup directory and generate a manifest for later migration.

**Steps**:

1. Confirm `{project-root}/_bmad` exists.
2. Run the backup script (recommended):

   ```bash
   # macOS/Linux
   python ~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py --project-root "{project-root}"

   # Windows (PowerShell)
   python "$HOME\.cursor\skills\bmad-customization-backup\scripts\backup_bmad.py" --project-root "{project-root}"
   ```

   Or from the project root (script uses cwd as project root):

   ```bash
   python ~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py
   ```

3. The script will:
   - Create `YYYY-MM-DD_HH-MM-SS_bmad/` under `_bmad-output/bmad-customization-backups/`;
   - Copy everything under `_bmad` into that directory (preserving relative paths);
   - Write `manifest.txt` (relative path list) and `BACKUP_README.md` (instructions and migration steps) inside the backup directory.
4. **Manual backup**: If you cannot run the script, copy `_bmad` to `_bmad-output/bmad-customization-backups/<custom-name>_bmad/` and maintain your own change notes.

**Acceptance**: A timestamped directory exists under `_bmad-output/bmad-customization-backups/` containing a full mirror of `_bmad` plus the manifest.

## 2. Migration (apply backup in a new worktree)

**Scenario**: You created a new worktree and reinstalled BMAD (fresh `_bmad`); you need to overlay previous customizations.

**Steps**:

1. Install BMAD in the new worktree (you get a fresh `_bmad`).
2. Choose the backup directory (e.g. `_bmad-output/bmad-customization-backups/2026-02-27_14-30-00_bmad`). If the backup lives in another worktree or machine, copy that directory into `_bmad-output/bmad-customization-backups/` in the project.
3. Run the apply script (prefer `--dry-run` first):

   ```bash
   # macOS/Linux
   python ~/.cursor/skills/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{path-to-backup-dir}" --project-root "{project-root}" --dry-run
   python ~/.cursor/skills/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{path-to-backup-dir}" --project-root "{project-root}"

   # Windows (PowerShell)
   python "$HOME\.cursor\skills\bmad-customization-backup\scripts\apply_bmad_backup.py" --backup-path "{path-to-backup-dir}" --project-root "{project-root}" --dry-run
   python "$HOME\.cursor\skills\bmad-customization-backup\scripts\apply_bmad_backup.py" --backup-path "{path-to-backup-dir}" --project-root "{project-root}"
   ```

4. The script overlays files from the backup onto the current `_bmad`, preserving structure; conflicts are handled as overwrite (see script docs).
5. **Manual migration**: Copy everything from the backup except `manifest.txt` and `BACKUP_README.md` into the current worktree’s `_bmad/` by relative path, overwriting.

**Acceptance**: The current worktree’s `_bmad` matches the backup (key files match).

## 3. When to back up vs migrate

| When | Action |
|------|--------|
| After changing `_bmad` (party-mode rounds, display names, workflows, etc.) | **Back up** for reuse in future worktrees. |
| After creating a worktree and installing bmad-method | **Migrate** by applying the latest or a chosen backup over `_bmad`. |
| Multiple machines or branches need the same `_bmad` customizations | Back up in one place; copy the backup directory elsewhere, then migrate. |

## 4. References

- **Migration details**: [references/migrate.md](references/migrate.md) (when to back up, how to apply after BMAD install in a new worktree, caveats).
- **Backup script**: `~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py` (args: `--project-root`, default cwd).
- **Apply script**: `~/.cursor/skills/bmad-customization-backup/scripts/apply_bmad_backup.py` (args: `--backup-path`, `--project-root`, `--dry-run`).

## 5. Constraints and notes

- `_bmad` is often in `.gitignore`; backups are usually under `_bmad-output/`. If you want backups in version control, exclude `_bmad-output/bmad-customization-backups/` from ignore per project policy.
- Migration **overwrites** the current `_bmad`; back up or confirm discard before first migration.
- Backup is a full directory copy, not “changed files only”; for partial paths, extend the script or copy manually.
