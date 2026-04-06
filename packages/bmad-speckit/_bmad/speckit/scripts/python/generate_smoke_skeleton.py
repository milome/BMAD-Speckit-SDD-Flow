#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "journey"


def render_smoke_spec(journey: dict) -> str:
    journey_id = journey["journeyId"]
    title = journey["title"]
    user_goal = journey["userVisibleGoal"]
    smoke_commands = journey.get("smokeCommands") or []
    smoke_command = smoke_commands[0] if smoke_commands else "npx playwright test tests/e2e/smoke/<file>.smoke.spec.ts"
    return f"""import {{ test, expect }} from '@playwright/test';

test.describe('@smoke @p0 {journey_id} {title}', () => {{
  test('{user_goal}', async ({{ page }}) => {{
    test.skip(true, 'Generated smoke skeleton. Replace with real steps before claiming runnable status.');

    await page.goto(process.env.BASE_URL ?? '/');
    await expect(page).toBeDefined();
  }});
}});

// Suggested command:
// {smoke_command}
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate minimal smoke E2E skeletons from a journey ledger JSON file.")
    parser.add_argument("--journey-ledger", required=True, help="Path to journey-ledger JSON file.")
    parser.add_argument("--output-root", required=True, help="Directory where smoke specs will be generated.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing generated files.")
    args = parser.parse_args()

    ledger_path = Path(args.journey_ledger).resolve()
    output_root = Path(args.output_root).resolve()

    if not ledger_path.is_file():
        print(f"Journey ledger not found: {ledger_path}", file=sys.stderr)
        return 2

    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    journeys = ledger.get("journeys", [])
    output_root.mkdir(parents=True, exist_ok=True)

    generated: list[str] = []
    for journey in journeys:
        journey_id = str(journey.get("journeyId", "")).strip()
        title = str(journey.get("title", "")).strip()
        filename = f"{slugify(journey_id)}-{slugify(title)}.smoke.spec.ts"
        target = output_root / filename
        if target.exists() and not args.overwrite:
            continue
        target.write_text(render_smoke_spec(journey), encoding="utf-8")
        generated.append(str(target))

    print(json.dumps({"generatedCount": len(generated), "files": generated}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
