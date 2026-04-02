/* eslint-env browser */

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

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
    swimlaneTodo: '待开始',
    swimlaneInProgress: '进行中',
    swimlaneDone: '已完成',
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
    phaseScore: '阶段分数',
    rawScore: '原始分数',
    dimensionScores: '维度分数',
    latestBundle: '最近导出',
    globalLatestBundle: '全局最近导出',
    scopedLatestBundle: '当前工作项最近导出',
    sourceScope: '来源范围',
    bundleDir: 'Bundle 目录',
    manifestPath: 'Manifest 路径',
    targetAvailability: '目标可用性',
    unavailable: '暂无数据',
    acceptedLabel: '接受',
    rejectedLabel: '拒绝',
    downgradedLabel: '降级',
    trainingReadyLabel: '训练就绪',
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
    swimlaneTodo: 'TODO',
    swimlaneInProgress: 'IN PROGRESS',
    swimlaneDone: 'DONE',
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
    phaseScore: 'Phase Score',
    rawScore: 'Raw Score',
    dimensionScores: 'Dimension Scores',
    latestBundle: 'Last Bundle',
    globalLatestBundle: 'Global Latest Bundle',
    scopedLatestBundle: 'Current Work Item Bundle',
    sourceScope: 'Source Scope',
    bundleDir: 'Bundle Dir',
    manifestPath: 'Manifest Path',
    targetAvailability: 'Target Availability',
    unavailable: 'N/A',
    acceptedLabel: 'Accepted',
    rejectedLabel: 'Rejected',
    downgradedLabel: 'Downgraded',
    trainingReadyLabel: 'Training Ready',
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

function getBoardGroupKindLabel(kind, msg) {
  if (kind === 'standalone_ops') return msg.standaloneLane;
  if (kind === 'bugfix_queue') return msg.bugfixLane;
  return msg.epicLane;
}

function formatBoardStatus(status, msg) {
  if (status === 'todo') return msg.todo;
  if (status === 'in_progress') return msg.inProgress;
  if (status === 'done') return msg.done;
  return msg.unavailable;
}

function formatSourceScope(scope, msg) {
  if (!scope) return msg.unavailable;
  const parts = [scope.scope_type ?? 'unknown'];
  if (scope.epic_id) parts.push(scope.epic_id);
  if (scope.story_key) parts.push(scope.story_key);
  if (scope.work_item_id) parts.push(scope.work_item_id);
  return parts.join(' · ');
}

function Badge({ label, tone }) {
  return <span className={`badge-pill badge-${tone}`}>{label}</span>;
}

function MetricCard({ label, value, tone = 'cyan' }) {
  const text = String(value ?? '');
  const isUnavailable = text === '' || text === messages.zh.unavailable || text === messages.en.unavailable;
  const fontSize = text.length > 30 ? 'text-[11px]' : text.length > 20 ? 'text-[13px]' : text.length > 10 ? 'text-[18px]' : 'text-[24px]';
  return (
    <div className="panel-card p-4">
      <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-secondary">{label}</div>
      <div className={`min-w-0 font-mono leading-tight truncate ${isUnavailable ? 'text-[13px] text-secondary' : `${fontSize} text-${tone}`}`}>{value}</div>
    </div>
  );
}

function BundleMetaBlock({ title, bundle, msg }) {
  return (
    <div className="bundle-meta-block">
      <div className="text-[15px] font-semibold text-primary">{title}</div>
      <div className="mt-2 grid gap-2 text-[13px] leading-5 text-secondary">
        <div className="bundle-meta-line">{formatNullable(msg, bundle?.bundle_id)}</div>
        <div className="bundle-meta-line">{msg.sourceScope}: {formatSourceScope(bundle?.source_scope, msg)}</div>
        <div className="bundle-meta-line">{msg.bundleDir}: {formatNullable(msg, bundle?.bundle_dir)}</div>
        <div className="bundle-meta-line">{msg.manifestPath}: {formatNullable(msg, bundle?.manifest_path)}</div>
      </div>
    </div>
  );
}

function ValidationSummary({ summary, msg }) {
  const entries = Object.entries(summary ?? {});
  if (entries.length === 0) {
    return <div className="empty-note">{msg.noData}</div>;
  }

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2">
          <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{key}</div>
          <div className="text-[14px] font-semibold text-primary">{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

function TargetAvailabilityGrid({ availability, msg }) {
  const entries = Object.entries(availability ?? {});
  if (entries.length === 0) {
    return <div className="empty-note">{msg.noData}</div>;
  }

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      {entries.map(([target, counts]) => (
        <div key={target} className="rounded-[16px] border border-soft bg-white/[0.025] p-3">
          <div className="mb-2 font-mono text-[13px] text-primary">{target}</div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-[12px] border border-soft bg-white/[0.02] px-3 py-2">
              <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{msg.compatible}</div>
              <div className="text-[16px] font-semibold text-mint">{formatNullable(msg, counts?.compatible)}</div>
            </div>
            <div className="rounded-[12px] border border-soft bg-white/[0.02] px-3 py-2">
              <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{msg.rejectedLabel}</div>
              <div className="text-[16px] font-semibold text-coral">{formatNullable(msg, counts?.incompatible)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [localeMode, setLocaleMode] = useState(() => globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) || 'auto');
  const [activeTab, setActiveTab] = useState('overview');
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState({ activeBoardGroupId: null, activeWorkItemId: null });
  const locale = useMemo(() => resolveLocale(localeMode), [localeMode]);
  const msg = messages[locale];

  useEffect(() => {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, localeMode);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = msg.title;
  }, [localeMode, locale, msg.title]);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const params = new URLSearchParams();
        if (selection.activeBoardGroupId) params.set('board_group_id', selection.activeBoardGroupId);
        if (selection.activeWorkItemId) params.set('work_item_id', selection.activeWorkItemId);
        const response = await fetch(`/api/snapshot${params.toString() ? `?${params}` : ''}`);
        const json = await response.json();
        if (!disposed) {
          setSnapshot(json);
          setError('');
          setSelection((current) => {
            const nextBoardGroupId = current.activeBoardGroupId ?? json?.workboard?.active_board_group_id ?? null;
            const nextWorkItemId = current.activeWorkItemId ?? json?.workboard?.active_work_item_id ?? null;
            if (current.activeBoardGroupId === nextBoardGroupId && current.activeWorkItemId === nextWorkItemId) {
              return current;
            }
            return {
              activeBoardGroupId: nextBoardGroupId,
              activeWorkItemId: nextWorkItemId,
            };
          });
        }
      } catch (fetchError) {
        if (!disposed) setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      }
    };
    refresh();
    const timer = globalThis.setInterval(refresh, 2000);
    return () => {
      disposed = true;
      globalThis.clearInterval(timer);
    };
  }, [selection.activeBoardGroupId, selection.activeWorkItemId]);

  const workboard = snapshot?.workboard ?? { board_groups: [], work_items: [], active_board_group_id: null, active_work_item_id: null };
  const boardGroups = workboard.board_groups ?? [];
  const boardGroupSwimlanes = workboard.board_group_swimlanes ?? { todo: [], in_progress: [], done: [] };
  const swimlanes = workboard.swimlanes ?? { todo: [], in_progress: [], done: [] };
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

  return (
    <main className="mx-auto max-w-[1700px] px-4 pb-16 pt-6 text-primary">
      <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-[920px]">
          <p id="hero-eyebrow" className="mb-3 text-[12px] uppercase tracking-[0.28em] text-live">{msg.eyebrow}</p>
          <h1 id="hero-title" className="mb-3 text-[clamp(32px,4.6vw,44px)] font-semibold leading-[0.98] tracking-[-0.04em] text-wrap-balance">{msg.heroTitle}</h1>
          <p id="hero-lede" className="max-w-[840px] text-[16px] leading-7 text-secondary">{msg.heroLede}</p>
        </div>
        <div className="inline-flex w-fit gap-1 rounded-full border border-soft bg-white/5 p-1" role="group" aria-label="Language switch">
          {['auto', 'zh', 'en'].map((mode) => (
            <button key={mode} type="button" className={`rounded-full px-3 py-2 text-sm ${localeMode === mode ? 'bg-cyan-400/15 text-primary' : 'text-secondary'}`} data-locale={mode} onClick={() => setLocaleMode(mode)}>
              {mode === 'auto' ? `Auto (${locale.toUpperCase()})` : mode === 'zh' ? '中文' : 'EN'}
            </button>
          ))}
        </div>
      </header>

      <section className="dashboard-shell">
        <div className="dashboard-left-column">
          <aside className="dashboard-rail-left">
            <div className="dashboard-rail-scroll grid content-start gap-4">
            <section className="glass-card p-[18px]">
            <div className="mb-3 text-[15px] font-semibold" id="runs-heading">{msg.runs}</div>
            <div className="grid gap-4" id="run-list">
              {boardGroups.length === 0 ? (
                <div className="empty-note">{isLoading ? msg.loading : msg.noData}</div>
              ) : (
                <>
                  {[
                    ['todo', msg.swimlaneTodo],
                    ['in_progress', msg.swimlaneInProgress],
                    ['done', msg.swimlaneDone],
                  ].map(([laneKey, laneLabel]) => (
                    <section key={laneKey} className="rounded-[18px] border border-soft bg-white/[0.02] p-3" data-board-swimlane={laneKey}>
                      <div className="mb-3 text-[12px] uppercase tracking-[0.12em] text-secondary">{laneLabel}</div>
                      <div className="grid gap-3">
                        {(boardGroupSwimlanes[laneKey] ?? []).length === 0 ? (
                          <div className="empty-note">{msg.noData}</div>
                        ) : (boardGroupSwimlanes[laneKey] ?? []).map((group) => (
                          <button key={group.board_group_id} type="button" data-board-group-id={group.board_group_id} className={`panel-card p-3 text-left ${group.board_group_id === activeBoardGroupId ? 'item-active' : ''}`} onClick={() => setSelection({ activeBoardGroupId: group.board_group_id, activeWorkItemId: null })}>
                            <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-secondary">{msg.boardGroups}</div>
                            <div className="min-w-0 font-mono text-[15px] leading-6 text-primary truncate">{formatNullable(msg, group.board_group_label)}</div>
                            <div className="mt-3 flex items-start justify-between gap-3">
                              <span className="text-[12px] leading-5 text-secondary font-mono">TODO {group.counts?.todo ?? 0} · IN {group.counts?.in_progress ?? 0} · DONE {group.counts?.done ?? 0}</span>
                              <Badge label={getBoardGroupKindLabel(group.kind, msg)} tone="cyan" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
            </div>
            </section>

            <section className="glass-card p-[18px]">
            <div className="mb-3 text-[15px] font-semibold" id="stage-rail-heading">{msg.workItems}</div>
            <div className="grid gap-4" id="stage-list">
              {workItems.length === 0 ? (
                <div className="empty-note">{isLoading ? msg.loading : msg.noData}</div>
              ) : (
                <>
                  {[
                    ['todo', msg.swimlaneTodo],
                    ['in_progress', msg.swimlaneInProgress],
                    ['done', msg.swimlaneDone],
                  ].map(([laneKey, laneLabel]) => (
                    <section key={laneKey} className="rounded-[18px] border border-soft bg-white/[0.02] p-3" data-swimlane={laneKey}>
                      <div className="mb-3 text-[12px] uppercase tracking-[0.12em] text-secondary">{laneLabel}</div>
                      <div className="grid gap-3">
                        {(swimlanes[laneKey] ?? []).length === 0 ? (
                          <div className="empty-note">{msg.noData}</div>
                        ) : (swimlanes[laneKey] ?? []).map((item) => (
                          <button key={item.work_item_id} type="button" data-work-item-id={item.work_item_id} className={`panel-card p-4 text-left ${item.work_item_id === activeWorkItemId ? 'item-active' : ''}`} onClick={() => setSelection((current) => ({ ...current, activeBoardGroupId: item.board_group_id, activeWorkItemId: item.work_item_id }))}>
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <strong className="flex-1 min-w-0 text-[14px] leading-6 text-primary truncate">{item.title}</strong>
                              <Badge label={formatBoardStatus(item.board_status, msg)} tone={item.board_status === 'done' ? 'mint' : item.board_status === 'in_progress' ? 'cyan' : 'amber'} />
                            </div>
                            <div className="grid gap-2 md:grid-cols-[1.05fr_1.2fr_0.75fr]">
                              <div className="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2">
                                <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{msg.status}</div>
                                <div className="text-[14px] font-semibold text-primary text-truncate">{formatBoardStatus(item.board_status, msg)}</div>
                              </div>
                              <div className="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2">
                                <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{msg.currentStage}</div>
                                <div className="text-[14px] font-semibold text-primary text-truncate">{item.current_stage ? formatStage(locale, item.current_stage, msg) : msg.unavailable}</div>
                              </div>
                              <div className="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2">
                                <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{msg.score}</div>
                                <div className="text-[14px] font-semibold text-primary text-truncate">{item.phase_score != null ? item.phase_score : msg.unavailable}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
            </div>
            </section>
            </div>
          </aside>
        </div>

        <section className="dashboard-main grid content-start gap-4">
          <section className="glass-card p-[18px]">
            <div className="mb-4 flex flex-wrap gap-2" id="command-grid">
              {['overview', 'runtime', 'score', 'sft'].map((tab) => (
                <button key={tab} type="button" data-tab={tab} className={`rounded-full border px-4 py-2 text-sm ${activeTab === tab ? 'bg-cyan-400/15 border-cyan-300/40 text-primary' : 'border-soft text-secondary'}`} onClick={() => setActiveTab(tab)}>
                  {msg.tabs[tab]}
                </button>
              ))}
            </div>

            {error ? <div className="empty-note">{msg.refreshError}: {error}</div> : null}

            {activeTab === 'overview' ? (
              <div className="grid gap-4" id="panel-overview">
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard label={msg.health} value={formatNullable(msg, snapshot?.overview?.health_score)} tone="cyan" />
                  <MetricCard label={msg.trend} value={formatNullable(msg, snapshot?.overview?.trend)} tone="mint" />
                  <MetricCard label={msg.accepted} value={formatNullable(msg, sft.total_candidates)} tone="cyan" />
                  <MetricCard label={msg.findings} value={formatNullable(msg, activeWorkItem?.findings_count)} tone="amber" />
                </div>
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <section className="panel-card p-4">
                    <div className="mb-3 text-[15px] font-semibold text-primary">{msg.dimensionSummary}</div>
                    <div className="grid gap-3">
                      {dimensions.length === 0 ? <div className="empty-note">{msg.noData}</div> : dimensions.map(([dimension, score]) => (
                        <div key={dimension} className="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2">
                          <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{dimension}</div>
                          <div className="text-[20px] font-semibold text-primary">{score}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="panel-card p-4" id="inspector-runtime">
                    <div className="mb-2 text-[15px] font-semibold text-primary">{msg.inspector}</div>
                    <div className="mb-4 text-[13px] leading-5 text-secondary">{msg.inspectorDesc}</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <MetricCard label={msg.currentStage} value={activeWorkItem?.current_stage ? formatStage(locale, activeWorkItem.current_stage, msg) : msg.unavailable} tone="cyan" />
                      <MetricCard label={msg.lastEventAt} value={formatNullable(msg, snapshot?.runtime_context?.last_event_at)} tone="mint" />
                      <MetricCard label={msg.scopedLatestBundle} value={formatNullable(msg, sft?.last_bundle?.bundle_id)} tone="amber" />
                    </div>
                    <div className="mt-4">
                      <BundleMetaBlock title={msg.scopedLatestBundle} bundle={sft?.last_bundle} msg={msg} />
                    </div>
                  </section>
                </div>
              </div>
            ) : null}

            {activeTab === 'runtime' ? (
              <div className="grid gap-4" id="panel-runtime">
                {timeline.length === 0 ? <div className="empty-note">{msg.noData}</div> : timeline.map((entry) => (
                  <div key={`${entry.stage}-${entry.timestamp ?? entry.started_at ?? 'na'}`} className={`panel-card p-4 ${entry.stage === activeWorkItem?.current_stage ? 'item-active' : ''}`}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <strong className="text-[15px] leading-6 text-primary">{formatStage(locale, entry?.stage, msg)}</strong>
                      <Badge label={formatRuntimeStatus(locale, entry?.status, msg)} tone={entry?.status === 'passed' ? 'mint' : entry?.status === 'running' ? 'cyan' : entry?.status === 'blocked' ? 'coral' : 'amber'} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-5 text-secondary">
                      <span>{msg.score} · {formatNullable(msg, entry?.phase_score)}</span>
                      <span>Iter · {formatNullable(msg, entry?.iteration_count)}</span>
                    </div>
                    <div className="mt-2 text-[13px] leading-5 text-secondary truncate">{formatNullable(msg, entry?.timestamp ?? entry?.completed_at ?? entry?.started_at)}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 'score' ? (
              <div className="grid gap-4 xl:grid-cols-[360px_1fr]" id="panel-score">
                <section className="grid gap-4 content-start">
                  <section className="panel-card p-4">
                    <div className="mb-3 text-[15px] font-semibold text-primary">{msg.phaseScore}</div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                      <MetricCard label={msg.phaseScore} value={formatNullable(msg, activeWorkItem?.phase_score)} tone="cyan" />
                      <MetricCard label={msg.rawScore} value={formatNullable(msg, snapshot?.score_detail?.records?.[0]?.raw_phase_score)} tone="mint" />
                    </div>
                  </section>
                  <section className="panel-card p-4">
                    <div className="mb-3 text-[15px] font-semibold text-primary">{msg.dimensionScores}</div>
                    <div className="grid gap-3">
                      {dimensions.length === 0 ? <div className="empty-note">{msg.noData}</div> : dimensions.map(([dimension, score]) => (
                        <div key={dimension} className="rounded-[14px] border border-soft bg-white/[0.025] px-3 py-2">
                          <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-secondary">{dimension}</div>
                          <div className="text-[18px] font-semibold text-primary">{score}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </section>
                <section className="panel-card p-4">
                  <div className="mb-3 text-[15px] font-semibold text-primary">{msg.failureStream}</div>
                  <div className="grid gap-3">
                    {findings.length === 0 ? <div className="empty-note">{msg.noData}</div> : findings.map((finding) => (
                      <div key={`${finding.run_id}-${finding.item_id}-${finding.timestamp}`} className="relative overflow-hidden rounded-[18px] border border-soft bg-panel-2 p-4 pl-5">
                        <div className={`absolute left-0 top-0 h-full w-1 ${Number(finding.score_delta ?? 0) <= -5 ? 'bg-[var(--color-coral)]' : Number(finding.score_delta ?? 0) < 0 ? 'bg-[var(--color-amber)]' : 'bg-[var(--color-live-cyan)]'}`} />
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                          <div>
                            <div className="mb-1 text-[15px] font-semibold leading-6 text-primary text-truncate-2">{finding?.note ?? msg.unavailable}</div>
                            <div className="text-[13px] leading-5 text-secondary"><span className="font-mono">{finding?.item_id}</span> · {formatStage(locale, finding?.stage, msg)} · {msg.score} {finding?.score_delta}</div>
                          </div>
                          <Badge label={Number(finding.score_delta ?? 0) <= -5 ? msg.needAction : msg.cleanup} tone={Number(finding.score_delta ?? 0) <= -5 ? 'coral' : 'amber'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            {activeTab === 'sft' ? (
              <div className="grid gap-4" id="panel-sft">
                <section className="panel-card p-4">
                  <div className="mb-3 text-[15px] font-semibold text-primary">{msg.accepted}</div>
                  <div className="grid gap-4 md:grid-cols-5">
                    <MetricCard label={msg.acceptedLabel} value={formatNullable(msg, sft.accepted)} tone="mint" />
                    <MetricCard label={msg.rejectedLabel} value={formatNullable(msg, sft.rejected)} tone="coral" />
                    <MetricCard label={msg.downgradedLabel} value={formatNullable(msg, sft.downgraded)} tone="amber" />
                    <MetricCard label={msg.trainingReadyLabel} value={formatNullable(msg, sft.training_ready_candidates)} tone="mint" />
                    <MetricCard label={msg.compatible} value={formatNullable(msg, sft.target_availability?.openai_chat?.compatible)} tone="cyan" />
                    <MetricCard label={msg.blocked} value={formatNullable(msg, sft.target_availability?.hf_tool_calling?.compatible)} tone="amber" />
                  </div>
                  <div className="bundle-meta-grid">
                    <BundleMetaBlock title={msg.scopedLatestBundle} bundle={sft?.last_bundle} msg={msg} />
                    <BundleMetaBlock title={msg.globalLatestBundle} bundle={sft?.global_last_bundle} msg={msg} />
                  </div>
                  <div className="mt-4 text-[15px] font-semibold text-primary">{msg.targetAvailability}</div>
                  <TargetAvailabilityGrid availability={sft?.target_availability} msg={msg} />
                  <div className="mt-4 text-[15px] font-semibold text-primary">Validation Summary</div>
                  <ValidationSummary summary={sft?.last_bundle?.validation_summary ?? sft?.global_last_bundle?.validation_summary} msg={msg} />
                </section>
              </div>
            ) : null}
          </section>
        </section>
      </section>
    </main>
  );
}

const rootElement = document.getElementById('app');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
