/* eslint-env browser */

const LOCALE_STORAGE_KEY = 'runtime-dashboard-locale';

const messages = {
  zh: {
    title: '运行时观测台',
    eyebrow: '运行时观测台',
    heroTitle: '统一 group-level 语义，实时查看执行流、质量门禁与 SFT 就绪度。',
    heroLede: 'run-list、command-grid、active work item 与 inspector 共享同一组视觉分组，减少噪音并保持扫描路径稳定。',
    tabs: { overview: '总览', runtime: '运行流', score: '质量门禁', sft: 'SFT 就绪度' },
    runs: '看板分组',
    workItems: '工作项',
    boardGroups: '看板分组',
    epicLane: '史诗主线',
    standaloneLane: '运维队列',
    bugfixLane: '缺陷队列',
    currentStage: '当前阶段',
    status: '状态',
    score: '分数',
    todo: '待开始',
    inProgress: '进行中',
    done: '已完成',
    noData: '暂无数据',
    loading: '加载中...',
    refreshError: '加载仪表板数据失败。',
    accepted: '接受样本',
    blocked: '阻断样本',
    findings: '问题数',
    health: '健康分',
    trend: '趋势',
    dimensionSummary: '维度驱动项',
    topFindings: '重点问题',
    inspector: '检查器',
    inspectorDesc: '右侧保持 group-level 上下文、问题流与导出信号，减少来回跳转。',
    latestBundle: '最近导出',
    targetAvailability: '目标可用性',
    unavailable: '暂无数据',
    acceptedLabel: '接受',
    rejectedLabel: '拒绝',
    downgradedLabel: '降级',
    compatible: '可用',
    failureStream: '问题流',
    lastEventAt: '最近事件',
    needAction: '需处理',
    cleanup: '待清理',
  },
  en: {
    title: 'Runtime Observatory',
    eyebrow: 'Runtime Observatory',
    heroTitle: 'Unify group-level semantics across execution, quality gates, and SFT readiness.',
    heroLede: 'Run list, command grid, active work item, and inspector share the same visual grouping so the surface reads faster with less noise.',
    tabs: { overview: 'Overview', runtime: 'Runtime Flow', score: 'Quality Gate', sft: 'SFT Readiness' },
    runs: 'Board Groups',
    workItems: 'Work Items',
    boardGroups: 'Board Groups',
    epicLane: 'Epic Lane',
    standaloneLane: 'Ops Queue',
    bugfixLane: 'Bugfix Queue',
    currentStage: 'Current Stage',
    status: 'Status',
    score: 'Score',
    todo: 'TODO',
    inProgress: 'IN PROGRESS',
    done: 'DONE',
    noData: 'None',
    loading: 'Loading...',
    refreshError: 'Failed to load dashboard data.',
    accepted: 'Accepted SFT',
    blocked: 'Blocked Samples',
    findings: 'Findings',
    health: 'Health',
    trend: 'Trend',
    dimensionSummary: 'Dimension Drivers',
    topFindings: 'Top Findings',
    inspector: 'Inspector',
    inspectorDesc: 'Keep group-level context, findings, and export signals visible on the right so the operator does not bounce between views.',
    latestBundle: 'Last Bundle',
    targetAvailability: 'Target Availability',
    unavailable: 'N/A',
    acceptedLabel: 'Accepted',
    rejectedLabel: 'Rejected',
    downgradedLabel: 'Downgraded',
    compatible: 'Compatible',
    failureStream: 'Failure Stream',
    lastEventAt: 'Last Event',
    needAction: 'Needs Action',
    cleanup: 'Cleanup',
  },
};

const stageLabels = {
  prd: { zh: 'PRD', en: 'PRD' },
  arch: { zh: '架构', en: 'Architecture' },
  story: { zh: 'Story', en: 'Story' },
  spec: { zh: 'Spec', en: 'Spec' },
  plan: { zh: 'Plan', en: 'Plan' },
  tasks: { zh: 'Tasks', en: 'Tasks' },
  implement: { zh: '实现', en: 'Implementation' },
};

const statusLabels = {
  zh: { passed: '通过', running: '运行中', pending: '待执行', failed: '失败', blocked: '阻塞' },
  en: { passed: 'Passed', running: 'Running', pending: 'Pending', failed: 'Failed', blocked: 'Blocked' },
};

function detectInitialLocaleMode() {
  const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'auto' || stored === 'zh' || stored === 'en') return stored;
  return 'auto';
}

function resolveLocale(localeMode) {
  if (localeMode === 'zh' || localeMode === 'en') return localeMode;
  const browserLocale = globalThis.navigator?.language?.toLowerCase() ?? '';
  return browserLocale.startsWith('zh') ? 'zh' : 'en';
}

function formatNullable(msg, value) {
  return value == null || value === '' ? msg.unavailable : String(value);
}

function formatStage(locale, stage, msg) {
  return stageLabels[stage]?.[locale] ?? stage ?? msg.unavailable;
}

function formatRuntimeStatus(locale, status, msg) {
  return statusLabels[locale]?.[status] ?? status ?? msg.unavailable;
}

function formatBoardStatus(status, msg) {
  if (status === 'todo') return msg.todo;
  if (status === 'in_progress') return msg.inProgress;
  if (status === 'done') return msg.done;
  return msg.unavailable;
}

function getBoardGroupKindLabel(kind, msg) {
  if (kind === 'standalone_ops') return msg.standaloneLane;
  if (kind === 'bugfix_queue') return msg.bugfixLane;
  return msg.epicLane;
}

function metricCard(label, value, tone = 'cyan') {
  const text = String(value ?? '');
  const fontSize = text.length > 30 ? '11px' : text.length > 20 ? '13px' : text.length > 10 ? '18px' : '24px';
  return `
    <div class="panel-card p-4">
      <div class="mb-2 text-[11px] uppercase tracking-[0.12em] text-secondary">${label}</div>
      <div class="min-w-0 font-mono leading-tight truncate text-${tone}" style="font-size:${fontSize}">${value ?? ''}</div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function render(state) {
  const { localeMode, locale, snapshot, error, selection } = state;
  const msg = messages[locale];
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.title = msg.title;

  const workboard = snapshot?.workboard ?? { board_groups: [], work_items: [], active_board_group_id: null, active_work_item_id: null };
  const boardGroups = workboard.board_groups ?? [];
  const activeBoardGroupId = selection.activeBoardGroupId ?? workboard.active_board_group_id ?? boardGroups[0]?.board_group_id ?? null;
  const activeBoardGroup = boardGroups.find((group) => group.board_group_id === activeBoardGroupId) ?? null;
  const workItems = (workboard.work_items ?? []).filter((item) => item.board_group_id === activeBoardGroupId);
  const activeWorkItemId = selection.activeWorkItemId ?? workboard.active_work_item_id ?? workItems[0]?.work_item_id ?? null;
  const activeWorkItem = workItems.find((item) => item.work_item_id === activeWorkItemId) ?? workItems[0] ?? null;
  const findings = snapshot?.score_detail?.findings ?? [];
  const dimensions = Object.entries(snapshot?.score_detail?.records?.[0]?.dimension_scores ?? {});
  const sft = snapshot?.sft_summary ?? {};
  const timeline = snapshot?.stage_timeline ?? [];
  const isLoading = !snapshot && !error;

  const app = document.getElementById('app');
  app.innerHTML = `
    <main class="mx-auto max-w-[1700px] px-4 pb-16 pt-6 text-primary">
      <header class="mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div class="max-w-[920px]">
          <p id="hero-eyebrow" class="mb-3 text-[12px] uppercase tracking-[0.28em] text-live">${msg.eyebrow}</p>
          <h1 id="hero-title" class="mb-3 text-[clamp(32px,4.6vw,44px)] font-semibold leading-[0.98] tracking-[-0.04em] text-wrap-balance">${msg.heroTitle}</h1>
          <p id="hero-lede" class="max-w-[840px] text-[16px] leading-7 text-secondary">${msg.heroLede}</p>
        </div>
        <div class="inline-flex w-fit gap-1 rounded-full border border-soft bg-white/5 p-1" role="group" aria-label="Language switch">
          ${['auto', 'zh', 'en'].map((mode) => `<button type="button" class="rounded-full px-3 py-2 text-sm ${localeMode === mode ? 'bg-cyan-400/15 text-primary' : 'text-secondary'}" data-locale="${mode}">${mode === 'auto' ? `Auto (${locale.toUpperCase()})` : mode === 'zh' ? '中文' : 'EN'}</button>`).join('')}
        </div>
      </header>

      <section class="dashboard-shell">
        <aside class="grid content-start gap-4">
          <section class="glass-card p-[18px]">
            <div class="mb-3 text-[15px] font-semibold" id="runs-heading">${msg.runs}</div>
            <div class="grid gap-4" id="run-list">
              ${boardGroups.length === 0
                ? `<div class="empty-note">${isLoading ? msg.loading : msg.noData}</div>`
                : boardGroups.map((group) => `
                  <button type="button" data-board-group-id="${group.board_group_id}" class="panel-card p-3 text-left ${group.board_group_id === activeBoardGroupId ? 'item-active' : ''}">
                    <div class="mb-1 text-[11px] uppercase tracking-[0.12em] text-secondary">${msg.boardGroups}</div>
                    <div class="min-w-0 font-mono text-[15px] leading-6 text-primary truncate">${escapeHtml(formatNullable(msg, group.board_group_label))}</div>
                    <div class="mt-3 flex items-start justify-between gap-3">
                      <span class="text-[12px] leading-5 text-secondary font-mono">TODO ${group.counts?.todo ?? 0} · IN ${group.counts?.in_progress ?? 0} · DONE ${group.counts?.done ?? 0}</span>
                      <span class="badge-pill badge-cyan">${getBoardGroupKindLabel(group.kind, msg)}</span>
                    </div>
                  </button>
                `).join('')}
            </div>
          </section>

          <section class="glass-card p-[18px]">
            <div class="mb-3 text-[15px] font-semibold" id="stage-rail-heading">${msg.workItems}</div>
            <div class="grid gap-4" id="stage-list">
              ${workItems.length === 0
                ? `<div class="empty-note">${isLoading ? msg.loading : msg.noData}</div>`
                : workItems.map((item) => `
                  <button type="button" data-work-item-id="${item.work_item_id}" class="panel-card p-4 text-left ${item.work_item_id === activeWorkItemId ? 'item-active' : ''}">
                    <div class="mb-3 flex items-start justify-between gap-3">
                      <strong class="flex-1 min-w-0 text-[14px] leading-6 text-primary truncate">${escapeHtml(item.title)}</strong>
                      <span class="badge-pill badge-${item.board_status === 'done' ? 'mint' : item.board_status === 'in_progress' ? 'cyan' : 'amber'}">${formatBoardStatus(item.board_status, msg)}</span>
                    </div>
                    <div class="grid gap-2 md:grid-cols-3">
                      <div class="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2"><div class="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">${msg.status}</div><div class="text-[14px] font-semibold text-primary">${formatBoardStatus(item.board_status, msg)}</div></div>
                      <div class="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2"><div class="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">${msg.currentStage}</div><div class="text-[14px] font-semibold text-primary">${item.current_stage ? formatStage(locale, item.current_stage, msg) : msg.unavailable}</div></div>
                      <div class="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2"><div class="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">${msg.score}</div><div class="text-[14px] font-semibold text-primary">${item.phase_score != null ? item.phase_score : msg.unavailable}</div></div>
                    </div>
                  </button>
                `).join('')}
            </div>
          </section>
        </aside>

        <section class="grid content-start gap-4">
          <section class="glass-card p-[18px]">
            <div class="mb-4 flex flex-wrap gap-2" id="command-grid">
              ${['overview', 'runtime', 'score', 'sft'].map((tab) => `<button type="button" data-tab="${tab}" class="rounded-full border px-4 py-2 text-sm ${state.activeTab === tab ? 'bg-cyan-400/15 border-cyan-300/40 text-primary' : 'border-soft text-secondary'}">${msg.tabs[tab]}</button>`).join('')}
            </div>

            ${error ? `<div class="empty-note">${msg.refreshError}: ${escapeHtml(error)}</div>` : ''}

            <div id="panel-overview" style="display:${state.activeTab === 'overview' ? 'grid' : 'none'}" class="grid gap-4">
              <div class="grid gap-4 md:grid-cols-4">
                ${metricCard(msg.health, formatNullable(msg, snapshot?.overview?.health_score), 'cyan')}
                ${metricCard(msg.trend, formatNullable(msg, snapshot?.overview?.trend), 'mint')}
                ${metricCard(msg.accepted, formatNullable(msg, sft.total_candidates), 'cyan')}
                ${metricCard(msg.findings, formatNullable(msg, activeWorkItem?.findings_count), 'amber')}
              </div>
              <div class="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <section class="panel-card p-4">
                  <div class="mb-3 text-[15px] font-semibold text-primary">${msg.dimensionSummary}</div>
                  <div class="grid gap-3">
                    ${dimensions.length === 0 ? `<div class="empty-note">${msg.noData}</div>` : dimensions.map(([dimension, score]) => `<div class="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2"><div class="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">${dimension}</div><div class="text-[20px] font-semibold text-primary">${score}</div></div>`).join('')}
                  </div>
                </section>
                <section class="panel-card p-4" id="inspector-runtime">
                  <div class="mb-2 text-[15px] font-semibold text-primary">${msg.inspector}</div>
                  <div class="mb-4 text-[13px] leading-5 text-secondary">${msg.inspectorDesc}</div>
                  <div class="grid gap-3 md:grid-cols-3">
                    ${metricCard(msg.currentStage, activeWorkItem?.current_stage ? formatStage(locale, activeWorkItem.current_stage, msg) : msg.unavailable, 'cyan')}
                    ${metricCard(msg.lastEventAt, formatNullable(msg, snapshot?.runtime_context?.last_event_at), 'mint')}
                    ${metricCard(msg.latestBundle, formatNullable(msg, sft?.last_bundle?.bundle_id), 'amber')}
                  </div>
                  <div class="mt-4 text-[13px] leading-5 text-secondary">${formatNullable(msg, activeBoardGroup?.board_group_label)}</div>
                </section>
              </div>
            </div>

            <div id="panel-runtime" style="display:${state.activeTab === 'runtime' ? 'grid' : 'none'}" class="grid gap-4">
              ${timeline.length === 0 ? `<div class="empty-note">${msg.noData}</div>` : timeline.map((entry) => `
                <div class="panel-card p-4 ${entry.stage === activeWorkItem?.current_stage ? 'item-active' : ''}">
                  <div class="mb-3 flex items-start justify-between gap-3">
                    <strong class="text-[15px] leading-6 text-primary">${formatStage(locale, entry?.stage, msg)}</strong>
                    <span class="badge-pill badge-${entry?.status === 'passed' ? 'mint' : entry?.status === 'running' ? 'cyan' : entry?.status === 'blocked' ? 'coral' : 'amber'}">${formatRuntimeStatus(locale, entry?.status, msg)}</span>
                  </div>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-5 text-secondary"><span>${msg.score} · ${formatNullable(msg, entry?.phase_score)}</span><span>Iter · ${formatNullable(msg, entry?.iteration_count)}</span></div>
                  <div class="mt-2 text-[13px] leading-5 text-secondary truncate">${formatNullable(msg, entry?.timestamp ?? entry?.completed_at ?? entry?.started_at)}</div>
                </div>`).join('')}
            </div>

            <div id="panel-score" style="display:${state.activeTab === 'score' ? 'grid' : 'none'}" class="grid gap-4">
              <section class="panel-card p-4">
                <div class="mb-3 text-[15px] font-semibold text-primary">${msg.failureStream}</div>
                <div class="grid gap-3">
                  ${findings.length === 0 ? `<div class="empty-note">${msg.noData}</div>` : findings.map((finding) => `
                    <div class="relative overflow-hidden rounded-[18px] border border-soft bg-panel-2 p-4 pl-5">
                      <div class="absolute left-0 top-0 h-full w-1 ${Number(finding.score_delta ?? 0) <= -5 ? 'bg-[var(--color-coral)]' : Number(finding.score_delta ?? 0) < 0 ? 'bg-[var(--color-amber)]' : 'bg-[var(--color-live-cyan)]'}"></div>
                      <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                        <div>
                          <div class="mb-1 text-[15px] font-semibold leading-6 text-primary text-truncate-2">${escapeHtml(finding?.note ?? msg.unavailable)}</div>
                          <div class="text-[13px] leading-5 text-secondary"><span class="font-mono">${escapeHtml(finding?.item_id)}</span> · ${formatStage(locale, finding?.stage, msg)} · ${msg.score} ${finding?.score_delta}</div>
                        </div>
                        <span class="badge-pill badge-${Number(finding.score_delta ?? 0) <= -5 ? 'coral' : 'amber'}">${Number(finding.score_delta ?? 0) <= -5 ? msg.needAction : msg.cleanup}</span>
                      </div>
                    </div>`).join('')}
                </div>
              </section>
            </div>

            <div id="panel-sft" style="display:${state.activeTab === 'sft' ? 'grid' : 'none'}" class="grid gap-4">
              <section class="panel-card p-4">
                <div class="mb-3 text-[15px] font-semibold text-primary">${msg.accepted}</div>
                <div class="grid gap-4 md:grid-cols-5">
                  ${metricCard(msg.acceptedLabel, formatNullable(msg, sft.accepted), 'mint')}
                  ${metricCard(msg.rejectedLabel, formatNullable(msg, sft.rejected), 'coral')}
                  ${metricCard(msg.downgradedLabel, formatNullable(msg, sft.downgraded), 'amber')}
                  ${metricCard(msg.compatible, formatNullable(msg, sft.target_availability?.openai_chat?.compatible), 'cyan')}
                  ${metricCard(msg.blocked, formatNullable(msg, sft.target_availability?.hf_tool_calling?.compatible), 'amber')}
                </div>
                <div class="mt-4 text-[15px] font-semibold text-primary">${msg.latestBundle}</div>
                <div class="mt-2 text-[13px] leading-5 text-secondary">${formatNullable(msg, sft?.last_bundle?.bundle_id)}</div>
                <div class="mt-4 text-[15px] font-semibold text-primary">${msg.targetAvailability}</div>
              </section>
            </div>
          </section>
        </section>
      </section>
    </main>
  `;

  app.querySelectorAll('[data-locale]').forEach((button) => {
    button.addEventListener('click', () => {
      state.localeMode = button.dataset.locale;
      globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, state.localeMode);
      render({ ...state, locale: resolveLocale(state.localeMode) });
    });
  });

  app.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab;
      render(state);
    });
  });

  app.querySelectorAll('[data-board-group-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selection = { activeBoardGroupId: button.dataset.boardGroupId, activeWorkItemId: null };
      refresh(state);
    });
  });

  app.querySelectorAll('[data-work-item-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selection = { ...state.selection, activeWorkItemId: button.dataset.workItemId };
      refresh(state);
    });
  });
}

async function refresh(state) {
  const params = new URLSearchParams();
  if (state.selection.activeBoardGroupId) params.set('board_group_id', state.selection.activeBoardGroupId);
  if (state.selection.activeWorkItemId) params.set('work_item_id', state.selection.activeWorkItemId);
  try {
    const response = await fetch(`/api/snapshot${params.toString() ? `?${params}` : ''}`);
    state.snapshot = await response.json();
    state.error = '';
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  }
  state.locale = resolveLocale(state.localeMode);
  render(state);
}

const state = {
  localeMode: detectInitialLocaleMode(),
  locale: 'en',
  activeTab: 'overview',
  snapshot: null,
  error: '',
  selection: { activeBoardGroupId: null, activeWorkItemId: null },
};

state.locale = resolveLocale(state.localeMode);
render(state);
refresh(state);
setInterval(() => refresh(state), 2000);
