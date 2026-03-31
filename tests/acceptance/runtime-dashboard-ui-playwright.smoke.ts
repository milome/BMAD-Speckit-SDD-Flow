import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium, type Page } from 'playwright';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { startLiveDashboardServer } from '../../packages/scoring/dashboard/live-server';
import { parseAndWriteScore } from '../../packages/scoring/orchestrator/parse-and-write';

async function expectText(page: Page, selector: string, expected: string): Promise<void> {
  const locator = page.locator(selector);
  await locator.waitFor();
  await assert.doesNotReject(async () => {
    const text = await locator.textContent();
    assert.equal(text?.trim(), expected);
  });
}

async function expectContains(page: Page, selector: string, expected: string): Promise<void> {
  const locator = page.locator(selector);
  await locator.waitFor();
  await assert.doesNotReject(async () => {
    const text = await locator.textContent();
    assert.ok(text?.includes(expected), `expected "${text}" to contain "${expected}"`);
  });
}

async function run(): Promise<void> {
  const fixture = await createRuntimeDashboardFixture();
  let server: Awaited<ReturnType<typeof startLiveDashboardServer>> | null = null;
  const browser = await chromium.launch({ headless: true });

  try {
    await parseAndWriteScore({
      content: fs.readFileSync(
        path.join(process.cwd(), 'packages', 'scoring', 'parsers', '__tests__', 'fixtures', 'sample-implement-report-with-four-dimensions.md'),
        'utf-8'
      ),
      stage: 'implement',
      runId: fixture.runId,
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath: fixture.dataPath,
      artifactDocPath: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      baseCommitHash: 'playwright-smoke-base-commit',
    });

    await parseAndWriteScore({
      content: fs.readFileSync(
        path.join(process.cwd(), 'packages', 'scoring', 'parsers', '__tests__', 'fixtures', 'sample-implement-report-high-score.md'),
        'utf-8'
      ),
      stage: 'implement',
      runId: 'run-standalone-ops-001',
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath: fixture.dataPath,
      artifactDocPath: '_bmad-output/implementation-artifacts/_orphan/standalone_tasks/improve-audit-rollup.md',
      baseCommitHash: 'playwright-smoke-standalone-base-commit',
    });

    await parseAndWriteScore({
      content: fs.readFileSync(
        path.join(process.cwd(), 'packages', 'scoring', 'parsers', '__tests__', 'fixtures', 'sample-plan-report.md'),
        'utf-8'
      ),
      stage: 'plan',
      runId: 'run-bugfix-queue-001',
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath: fixture.dataPath,
      artifactDocPath: '_bmad-output/implementation-artifacts/_orphan/bugfix/fix-runtime-dashboard-findings-duplication.md',
      baseCommitHash: 'playwright-smoke-bugfix-base-commit',
    });

    server = await startLiveDashboardServer({
      root: fixture.root,
      host: '127.0.0.1',
      port: 0,
      dataPath: fixture.dataPath,
    });

    const enContext = await browser.newContext({ locale: 'en-US' });
    const enPage = await enContext.newPage();
    await enPage.goto(server.url, { waitUntil: 'networkidle' });

    await expectText(enPage, 'button[data-locale="auto"]', 'Auto (EN)');
    await expectText(enPage, '#hero-eyebrow', 'Runtime Observatory');
    await expectText(enPage, '#runs-heading', 'Board Groups');
    await expectText(enPage, '#stage-rail-heading', 'Work Items');
    await expectContains(enPage, '#run-list', 'Epic 15');
    await expectContains(enPage, '#run-list', 'Epic Lane');
    await expectContains(enPage, '#stage-list', 'Current Stage');
    await expectContains(enPage, '#stage-list', 'Status');
    await expectContains(enPage, '#stage-list', 'Implementation');
    await expectContains(enPage, '#stage-list', 'IN PROGRESS');
    await expectContains(enPage, '#stage-list', 'Score');
    await expectContains(enPage, '#command-grid', 'Overview');
    await expectContains(enPage, '#inspector-runtime', 'Epic 15');

    await enPage.click('button[data-locale="zh"]');
    await expectText(enPage, '#hero-eyebrow', '运行时观测台');
    await expectText(enPage, '#runs-heading', '看板分组');
    await expectText(enPage, '#stage-rail-heading', '工作项');
    await expectContains(enPage, '#run-list', '史诗主线');
    await expectContains(enPage, '#stage-list', '当前阶段');
    await expectContains(enPage, '#stage-list', '状态');
    await expectContains(enPage, '#stage-list', '分数');

    await enPage.click('button[data-tab="score"]');
    await expectContains(enPage, '#panel-score', '问题流');

    await enPage.click('button[data-tab="runtime"]');
    await expectContains(enPage, '#panel-runtime', 'Plan');

    await enContext.close();

    const zhContext = await browser.newContext({ locale: 'zh-CN' });
    const zhPage = await zhContext.newPage();
    await zhPage.goto(server.url, { waitUntil: 'networkidle' });

    await expectText(zhPage, 'button[data-locale="auto"]', 'Auto (ZH)');
    await expectText(zhPage, '#hero-eyebrow', '运行时观测台');
    await expectText(zhPage, '#runs-heading', '看板分组');
    await expectText(zhPage, '#stage-rail-heading', '工作项');
    await expectContains(zhPage, '#run-list', 'Epic 15');
    await zhPage.click('button[data-tab="overview"]');
    await expectContains(zhPage, '#panel-overview', '维度驱动项');

    await zhContext.close();

    console.log('playwright runtime dashboard locale smoke passed');
  } finally {
    await browser.close();
    if (server) await server.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
