import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function scriptString(value: string): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

function confirmationPageHtml(input: {
  closeoutAttemptId: string;
  acceptanceRequestHash: string;
  taskReportArtifactHash: string;
  confirmationText: string;
  rejectionConfirmationText: string;
}): string {
  const attempt = escapeHtml(input.closeoutAttemptId);
  const requestHash = escapeHtml(input.acceptanceRequestHash);
  const artifactHash = escapeHtml(input.taskReportArtifactHash);
  const acceptText = escapeHtml(input.confirmationText);
  const rejectText = escapeHtml(input.rejectionConfirmationText);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Goal 交付确认</title>
  <style>
    :root { color-scheme: light; --ink: #17211b; --muted: #66716a; --line: #d7ddd9; --paper: #fff; --wash: #f3f6f4; --pass: #166534; --reject: #9f2d24; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--wash); color: var(--ink); font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; letter-spacing: 0; }
    main { width: min(880px, calc(100% - 32px)); margin: 32px auto; background: var(--paper); border: 1px solid var(--line); }
    header, section, footer { padding: 24px 28px; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--line); }
    .eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 13px; font-weight: 700; text-transform: uppercase; }
    h1 { margin: 0; font-size: 28px; line-height: 1.25; }
    h2 { margin: 0 0 14px; font-size: 18px; }
    .status { flex: 0 0 auto; padding: 6px 10px; border: 1px solid #86b895; color: var(--pass); font-size: 13px; font-weight: 700; }
    section + section { border-top: 1px solid var(--line); }
    dl { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 10px 18px; margin: 0; }
    dt { color: var(--muted); }
    dd { min-width: 0; margin: 0; overflow-wrap: anywhere; font-family: Consolas, monospace; font-size: 13px; }
    .instruction { margin: 0 0 14px; color: var(--muted); line-height: 1.6; }
    pre { min-height: 104px; margin: 0; padding: 16px; overflow: auto; border: 1px solid var(--line); background: #f8faf9; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.6 Consolas, monospace; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    button { min-height: 40px; padding: 8px 14px; border: 1px solid var(--pass); border-radius: 6px; background: var(--pass); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button.reject { border-color: var(--reject); background: #fff; color: var(--reject); }
    button:focus-visible { outline: 3px solid #f2c94c; outline-offset: 2px; }
    footer { border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; line-height: 1.6; }
    @media (max-width: 620px) { main { width: 100%; margin: 0; border-width: 0; } header { align-items: stretch; flex-direction: column; } .status { align-self: flex-start; } dl { grid-template-columns: 1fr; gap: 4px; } dd + dt { margin-top: 8px; } }
  </style>
</head>
<body>
  <main>
    <header><div><p class="eyebrow">Controlled closeout</p><h1>Goal 交付确认</h1></div><div class="status">等待用户确认</div></header>
    <section aria-labelledby="summary-title"><h2 id="summary-title">当前交付</h2><dl>
      <dt>Closeout attempt</dt><dd>${attempt}</dd>
      <dt>Acceptance request</dt><dd>${requestHash}</dd>
      <dt>TaskReport candidate</dt><dd>${artifactHash}</dd>
    </dl></section>
    <section aria-labelledby="accept-title"><h2 id="accept-title">确认并关闭</h2><p class="instruction">核验当前交付后，复制以下原文并提交给 Main Agent。复制操作不会直接关闭记录。</p><pre id="accept-text">${acceptText}</pre><div class="actions"><button type="button" data-copy="accept-text">复制确认文本</button></div></section>
    <section aria-labelledby="reject-title"><h2 id="reject-title">拒绝并保持阻塞</h2><p class="instruction">发现交付不符合预期时，复制以下拒绝原文并提交给 Main Agent。</p><pre id="reject-text">${rejectText}</pre><div class="actions"><button class="reject" type="button" data-copy="reject-text">复制拒绝文本</button></div></section>
    <footer>只有 Main Agent 成功接收与当前 attempt 匹配的原文后，才会写入最终 TaskReport 和 completion receipt。</footer>
  </main>
  <script>
    const texts = { "accept-text": ${scriptString(input.confirmationText)}, "reject-text": ${scriptString(input.rejectionConfirmationText)} };
    for (const button of document.querySelectorAll('[data-copy]')) button.addEventListener('click', async () => {
      const label = button.textContent;
      await navigator.clipboard.writeText(texts[button.dataset.copy]);
      button.textContent = '已复制';
      setTimeout(() => { button.textContent = label; }, 1400);
    });
  </script>
</body>
</html>
`;
}

export function materializeControlledCloseoutConfirmationPage(input: {
  outputPath: string;
  closeoutAttemptId: string;
  acceptanceRequestHash: string;
  taskReportArtifactHash: string;
  confirmationText: string;
  rejectionConfirmationText: string;
}): string {
  const content = confirmationPageHtml(input);
  if (fs.existsSync(input.outputPath)) {
    if (fs.readFileSync(input.outputPath, 'utf8') !== content) {
      throw new Error('main_agent_goal_task_report_provenance_mismatch');
    }
    return input.outputPath;
  }
  fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
  const temporaryPath = `${input.outputPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, input.outputPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
  return input.outputPath;
}
