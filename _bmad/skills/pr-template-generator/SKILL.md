---
name: pr-template-generator
description: Automatically analyze all commits since the last PR and generate a detailed PR template as a markdown file. Analyzes commit history, categorizes changes (features, improvements, fixes, docs), generates detailed summaries with problem/fix descriptions, and saves to docs/PR directory. Use when preparing pull requests, reviewing branch changes, or documenting work since last merge.
---

# PR Template Generator

Automatically analyze commits since the last PR and generate a comprehensive PR template following the format of PR_34.md, with:
- Detailed overview summary
- Feature sections with core changes, implementation details, related files
- Improvement sections with improvement content and impact
- Bugfix sections with problem description and fix solution
- Statistics, file lists, code quality sections
- Acceptance criteria and related documentation links

## Quick Start

Generate PR template for current branch:

```bash
# Using Python script (recommended - better UTF-8 support)
python scripts/generate-pr-template.py --output-dir "docs/PR"

# With specific base branch
python scripts/generate-pr-template.py --base-branch "main" --output-dir "docs/PR"
```

## Usage

### Python Script (Recommended)

```bash
python scripts/generate-pr-template.py [options]
```

**Options:**
- `--base-branch`, `-b`: Target branch for PR (default: "dev")
- `--current-branch`, `-c`: Current feature branch (default: auto-detect)
- `--output-dir`, `-o`: Output directory for PR template (default: "docs/PR")
- `--last-pr-commit`, `-l`: Specific commit hash to use as last PR

## Generated Template Structure

The generated PR template includes (following PR_34.md format):

### 1. Overview Section
- High-level summary of the PR
- Numbered list of key changes (features, improvements, bugfixes, docs)

### 2. Feature Sections (New Features)
Each feature includes:
- **Core Changes**: Main changes made
- **Implementation Details**: Extracted from commit body
- **Related Files**: Key Python files modified
- **Commit Records**: Commit hash and message

### 3. Improvement Sections
Each improvement includes:
- **Improvement Content**: What was improved
- **Related Files**: Files modified
- **Commit Records**: Commit hash and message

### 4. Bugfix Sections
Each bugfix includes:
- **Problem Description**: Extracted from commit message
- **Fix Solution**: How it was fixed
- **Related Files**: Files modified
- **Commit Records**: Commit hash and message

### 5. Documentation Updates
- List of documentation commits with commit records

### 6. Commit History Table
- Full table of all commits with #, hash, description, author, date

### 7. Statistics Section
- Commit count
- Modified file count
- Breakdown by type (features, improvements, bugfixes, docs)

### 8. Modified File List
- Core implementation files
- Test files
- Documentation files

### 9. Code Quality Section
- Development methods
- Code standards

### 10. Acceptance Criteria
- Checklist of verification items

### 11. Related Documentation
- Links to new documentation files

### 12. Summary
- Final notes and recommendations

## Commit Categorization

The script automatically categorizes commits based on:

### Conventional Commits
- `feat:` or `feat(...)` - New features
- `fix:` or `fix(...)` - Bug fixes
- `docs:` or `docs(...)` - Documentation
- `refactor:` - Improvements

### Chinese Commit Messages
- Contains "shixian" (implement) without "xiufu" (fix) - Features
- Contains "xiufu", "BUGFIX", "Bug xiufu" - Bug fixes
- Contains "youhua", "gaijin", "zengqiang", "xingneng" - Improvements

## Output Format

The output file is named: `PR_<branch-name>_<timestamp>.md`

Example: `PR_014-chart-performance-optimization_2026-01-27_18-30-00.md`

Default output directory: `docs/PR/`

## Features

- **Comprehensive Analysis**: Extracts file changes for each commit
- **Smart Categorization**: Recognizes conventional and Chinese commit patterns
- **Detailed Summaries**: Generates problem/fix descriptions for bugfixes
- **UTF-8 Support**: Properly handles Chinese characters
- **Auto-detection**: Automatically detects current branch and merge base
- **Statistics**: Generates file change and diff statistics
- **Documentation Tracking**: Lists newly added documentation files

## Reference Template

This skill generates templates following the format of `PR_34.md`:
- HKFE Week Period Calculation Refactoring PR template
- Includes all standard sections for professional PR documentation

## Resources

### scripts/

- **generate-pr-template.py**: Python script for generating comprehensive PR templates

The script uses git commands to:
- Find merge commits or merge base
- Extract commit metadata (hash, message, author, date, body)
- Get file changes for each commit
- Categorize commits by type
- Generate detailed sections for each category
- Format markdown template with proper UTF-8 encoding
