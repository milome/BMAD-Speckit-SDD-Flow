#!/usr/bin/env node
// SubagentStop hook: compose and display result summary from milestones + last message
'use strict';

const fs = require('fs');
const path = require('path');

const { loadHookMessages, getHooksTimeLocale } = require('./hook-load-messages.cjs');

const LINE = '═'.repeat(50);

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
    process.stdin.on('error', reject);
  });
}

function parseMilestones(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return entries;
}

function formatDuration(startIso, endDate) {
  const start = new Date(startIso);
  const diffMs = endDate - start;
  if (isNaN(diffMs) || diffMs < 0) return '?';
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function truncate(str, maxLen) {
  if (!str) return '(empty)';
  const clean = str.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen) + '...';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function partyModeRunStatePath(projectDir, agentId) {
  return path.join(projectDir, '.claude', 'state', 'milestones', `${agentId}.party-mode.json`);
}

function deriveExpectedCheckpointRounds(targetRoundsTotal, batchSize) {
  const rounds = [];
  const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 20;
  for (let round = safeBatchSize; round < targetRoundsTotal; round += safeBatchSize) {
    rounds.push(round);
  }
  rounds.push(targetRoundsTotal);
  return rounds;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readBulletField(body, label) {
  const normalizedLabel = `- ${label}:`;
  const line = String(body || '')
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(normalizedLabel));
  return line ? line.slice(normalizedLabel.length).trim() : '';
}

function loadPartyModeRunState(projectDir, agentId) {
  const filePath = partyModeRunStatePath(projectDir, agentId);
  if (!fs.existsSync(filePath)) return null;
  return { filePath, data: readJson(filePath) };
}

function parseAgentManifest(projectDir) {
  const manifestPath = path.join(projectDir, '_bmad', '_config', 'agent-manifest.csv');
  if (!fs.existsSync(manifestPath)) return [];
  return fs
    .readFileSync(manifestPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^"([^"]*)","([^"]*)"/u);
      return match ? { id: match[1], displayName: match[2] } : null;
    })
    .filter(Boolean);
}

function deriveChallengerDisplayNames(projectDir, designatedChallengerId) {
  const labels = new Set();
  const manifest = parseAgentManifest(projectDir);
  const matched = manifest.find((entry) => entry.id === designatedChallengerId);
  if (matched?.displayName) labels.add(matched.displayName);
  if (designatedChallengerId === 'adversarial-reviewer') {
    labels.add('批判性审计员');
    labels.add('Critical Auditor');
    labels.add('Adversarial Reviewer');
  }
  return [...labels];
}

function parseSpeakerLine(line) {
  const match = line.match(/^\S+\s+\*\*(.+?)\*\*:\s(.+)$/u);
  if (!match) return null;
  return {
    displayName: match[1].trim(),
    content: match[2].trim(),
  };
}

function parseRoundSections(content) {
  return content
    .split(/(?=^### Round \d+\s*$)/gmu)
    .filter((section) => /^### Round \d+\s*$/mu.test(section))
    .map((section) => {
      const roundMatch = section.match(/^### Round (\d+)\s*$/mu);
      const speakerLines = section
        .split(/\r?\n/u)
        .map((line) => parseSpeakerLine(line.trim()))
        .filter(Boolean);
      return {
        round: roundMatch ? Number(roundMatch[1]) : null,
        section,
        speakerLines,
      };
    })
    .filter((entry) => Number.isInteger(entry.round) && entry.round > 0);
}

function parseCheckpointBlocks(content) {
  const headingMatches = Array.from(
    String(content || '').matchAll(/^## Checkpoint (\d+)\/(\d+)\s*$/gmu)
  );
  const finalGateMatch = /^## Final Gate Evidence\s*$/gmu.exec(String(content || ''));
  return headingMatches.map((match, index) => {
    const headingLine = match[0];
    const bodyStart = match.index + headingLine.length;
    const nextCheckpointIndex = headingMatches[index + 1]?.index ?? content.length;
    const nextFinalGateIndex =
      finalGateMatch && finalGateMatch.index > match.index ? finalGateMatch.index : content.length;
    const bodyEnd = Math.min(nextCheckpointIndex, nextFinalGateIndex);
    const body = String(content || '').slice(bodyStart, bodyEnd);
    return {
      round: Number(match[1]),
      totalRounds: Number(match[2]),
      resolvedTopics: readBulletField(body, 'Resolved Topics'),
      unresolvedTopics: readBulletField(body, 'Unresolved Topics'),
      deferredRisks: readBulletField(body, 'Deferred Risks'),
      challengerRatio: readBulletField(body, 'Challenger Ratio'),
      nextFocus: readBulletField(body, 'Next Focus'),
    };
  });
}

function parseFinalGateEvidence(content) {
  const blockMatch = content.match(/^## Final Gate Evidence\s*$([\s\S]*)$/mu);
  if (!blockMatch) return null;
  const body = blockMatch[1];
  return {
    gateProfile: readBulletField(body, 'Gate Profile'),
    totalRounds: Number(readBulletField(body, 'Total Rounds')),
    challengerRatioCheck: readBulletField(body, 'Challenger Ratio Check'),
    tailWindowNoNewGap: readBulletField(body, 'Tail Window No New Gap'),
    finalResult: readBulletField(body, 'Final Result'),
  };
}

function resolveBatchBounds(ctx) {
  const batchStartRound =
    Number.isInteger(ctx.current_batch_start_round) && ctx.current_batch_start_round > 0
      ? ctx.current_batch_start_round
      : 1;
  const batchTargetRound =
    Number.isInteger(ctx.current_batch_target_round) && ctx.current_batch_target_round > 0
      ? ctx.current_batch_target_round
      : Number(ctx.target_rounds_total);
  const targetRoundsTotal = Number(ctx.target_rounds_total);
  const isFinalBatch = batchTargetRound >= targetRoundsTotal;
  return {
    batchStartRound,
    batchTargetRound,
    targetRoundsTotal,
    isFinalBatch,
  };
}

function renderCheckpointBlock(checkpoint) {
  if (!checkpoint) return null;
  return [
    `## Checkpoint ${checkpoint.round}/${checkpoint.totalRounds}`,
    `- Resolved Topics: ${checkpoint.resolvedTopics || '(none)'}`,
    `- Unresolved Topics: ${checkpoint.unresolvedTopics || '(none)'}`,
    `- Deferred Risks: ${checkpoint.deferredRisks || '(none)'}`,
    `- Challenger Ratio: ${checkpoint.challengerRatio || '(unknown)'}`,
    `- Next Focus: ${checkpoint.nextFocus || '(none)'}`,
  ].join('\n');
}

function renderFinalGateBlock(finalGate) {
  if (!finalGate) return null;
  return [
    '## Final Gate Evidence',
    `- Gate Profile: ${finalGate.gateProfile || '(unknown)'}`,
    `- Total Rounds: ${Number.isFinite(finalGate.totalRounds) ? finalGate.totalRounds : '(unknown)'}`,
    `- Challenger Ratio Check: ${finalGate.challengerRatioCheck || '(unknown)'}`,
    `- Tail Window No New Gap: ${finalGate.tailWindowNoNewGap || '(unknown)'}`,
    `- Final Result: ${finalGate.finalResult || '(unknown)'}`,
  ].join('\n');
}

function resolveSpeakerId(projectDir, displayName, designatedChallengerId, challengerLabels) {
  if (challengerLabels.includes(displayName)) {
    return designatedChallengerId;
  }
  const manifest = parseAgentManifest(projectDir);
  const matched = manifest.find((entry) => entry.displayName === displayName);
  return matched?.id || displayName;
}

function inferHasNewGap(round, totalRounds, sectionText, tailWindowNoNewGap) {
  if (tailWindowNoNewGap === 'PASS' && round > Math.max(totalRounds - 3, 0)) {
    return false;
  }
  return /反对|遗漏|风险|gap|risk|edge case|invalid|challenge|counter/u.test(sectionText);
}

function updatePartyModeMetaForFinalBatch(projectDir, ctx) {
  const metaPath = path.join(
    projectDir,
    '_bmad-output',
    'party-mode',
    'sessions',
    `${ctx.session_key}.meta.json`
  );
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  const meta = readJson(metaPath);
  const checkpointRounds = Array.isArray(ctx.checkpoint_rounds) ? ctx.checkpoint_rounds : [];
  const finalBatchIndex = checkpointRounds.length > 0 ? checkpointRounds.length : 1;
  const previousRound = finalBatchIndex > 1 ? checkpointRounds[finalBatchIndex - 2] : 0;
  const nextMeta = {
    ...meta,
    current_batch_index: finalBatchIndex,
    current_batch_start_round: previousRound + 1,
    current_batch_target_round: ctx.target_rounds_total,
    current_batch_status: 'completed',
    updated_at: new Date().toISOString(),
  };
  writeJson(metaPath, nextMeta);
  return nextMeta;
}

function materializeCheckpointArtifacts(projectDir, runtimeHelper, ctx, checkpoints, gateResult) {
  checkpoints.forEach((checkpoint, index) => {
    const paths = runtimeHelper.deriveBatchCheckpointPaths(projectDir, ctx.session_key, checkpoint.round);
    writeJson(paths.checkpointJsonPath, {
      version: 'party_mode_checkpoint_v1',
      session_key: ctx.session_key,
      gate_profile_id: ctx.gate_profile_id,
      closure_level: ctx.closure_level || 'standard',
      batch_index: index + 1,
      batch_start_round: index === 0 ? 1 : checkpoints[index - 1].round + 1,
      batch_end_round: checkpoint.round,
      deterministic_state: {
        current_round: checkpoint.round,
        target_rounds_total: checkpoint.totalRounds,
        remaining_rounds: Math.max(checkpoint.totalRounds - checkpoint.round, 0),
        challenger_ratio: gateResult?.challenger_ratio ?? 0,
        tail_window_no_new_gap: gateResult?.last_tail_no_new_gap ?? false,
        source_log_sha256: gateResult?.source_log_sha256
          ? `sha256:${gateResult.source_log_sha256}`
          : 'sha256:unknown',
      },
      facilitator_summary: {
        resolved_topics: checkpoint.resolvedTopics ? [checkpoint.resolvedTopics] : [],
        unresolved_topics: checkpoint.unresolvedTopics ? [checkpoint.unresolvedTopics] : [],
        deferred_risks: checkpoint.deferredRisks ? [checkpoint.deferredRisks] : [],
        next_focus: checkpoint.nextFocus ? [checkpoint.nextFocus] : [],
      },
      generated_at: new Date().toISOString(),
    });
    fs.mkdirSync(path.dirname(paths.checkpointMarkdownPath), { recursive: true });
    fs.writeFileSync(
      paths.checkpointMarkdownPath,
      [
        `# Party-Mode Checkpoint ${checkpoint.round}/${checkpoint.totalRounds}`,
        '',
        `- 已收敛议题: ${checkpoint.resolvedTopics || '(none)'}`,
        `- 未收敛议题: ${checkpoint.unresolvedTopics || '(none)'}`,
        `- Deferred Risks: ${checkpoint.deferredRisks || '(none)'}`,
        `- Challenger Ratio: ${checkpoint.challengerRatio || '(unknown)'}`,
        `- 下一段 20 轮重点: ${checkpoint.nextFocus || '(none)'}`,
        '',
      ].join('\n'),
      'utf8'
    );
    writeJson(paths.receiptPath, {
      session_key: ctx.session_key,
      gate_profile_id: ctx.gate_profile_id,
      closure_level: ctx.closure_level || 'standard',
      batch_size: ctx.batch_size,
      batch_index: index + 1,
      batch_start_round: index === 0 ? 1 : checkpoints[index - 1].round + 1,
      batch_target_round: checkpoint.round,
      target_rounds_total: checkpoint.totalRounds,
      checkpoint_window_ms: 15000,
      status: checkpoint.round === ctx.target_rounds_total ? 'completed' : 'checkpoint_ready',
      checkpoint_json_path: paths.checkpointJsonPath.replace(/\\/g, '/'),
      checkpoint_markdown_path: paths.checkpointMarkdownPath.replace(/\\/g, '/'),
      generated_at: new Date().toISOString(),
    });
  });
}

function maybeReconstructPartyModeArtifacts(projectDir, state, lastMsg) {
  const runtimeHelper = require('./party-mode-session-runtime.cjs');
  const finalGate = parseFinalGateEvidence(lastMsg);
  const checkpoints = parseCheckpointBlocks(lastMsg);
  const rounds = parseRoundSections(lastMsg);
  const batch = resolveBatchBounds(state);
  if (rounds.length === 0) {
    return null;
  }

  const designatedChallengerId = state.designated_challenger_id || 'adversarial-reviewer';
  const challengerLabels = deriveChallengerDisplayNames(projectDir, designatedChallengerId);
  const sessionPaths = runtimeHelper.deriveSessionPaths(projectDir, state.session_key);
  fs.mkdirSync(path.dirname(sessionPaths.sessionLogPath), { recursive: true });

  let existingEntries = [];
  if (fs.existsSync(sessionPaths.sessionLogPath)) {
    existingEntries = fs
      .readFileSync(sessionPaths.sessionLogPath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  const preservedEntries = existingEntries.filter((entry) => {
    if (entry.record_type !== 'agent_turn') {
      return true;
    }
    if (entry.session_key !== state.session_key) {
      return true;
    }
    const roundIndex = Number(entry.round_index);
    return roundIndex < batch.batchStartRound || roundIndex > batch.batchTargetRound;
  });

  const batchEntries = [];

  for (const round of rounds) {
    const selectedSpeaker =
      round.speakerLines.find((line) => challengerLabels.includes(line.displayName)) ||
      round.speakerLines[0];
    if (!selectedSpeaker) continue;
    batchEntries.push({
      record_type: 'agent_turn',
      session_key: state.session_key,
      round_index: round.round,
      speaker_id: resolveSpeakerId(
        projectDir,
        selectedSpeaker.displayName,
        designatedChallengerId,
        challengerLabels
      ),
      designated_challenger_id: designatedChallengerId,
      counts_toward_ratio: true,
      has_new_gap: inferHasNewGap(
        round.round,
        finalGate?.totalRounds || state.target_rounds_total,
        round.section,
        finalGate?.tailWindowNoNewGap
      ),
      timestamp: new Date().toISOString(),
    });
  }

  const mergedEntries = [...preservedEntries, ...batchEntries].sort((left, right) => {
    const leftRound = Number(left.round_index || 0);
    const rightRound = Number(right.round_index || 0);
    return leftRound - rightRound;
  });
  fs.writeFileSync(
    sessionPaths.sessionLogPath,
    mergedEntries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
    'utf8'
  );

  const refresh = runtimeHelper.refreshSessionArtifacts(projectDir, state.session_key);
  materializeCheckpointArtifacts(projectDir, runtimeHelper, state, checkpoints, refresh?.result || null);

  if (batch.isFinalBatch) {
    updatePartyModeMetaForFinalBatch(projectDir, state);
    try {
      runtimeHelper.markBatchCompleted(projectDir, state.session_key);
    } catch {
      /* keep reconstructed artifacts even if status transition is unavailable */
    }
  } else {
    try {
      runtimeHelper.markBatchCheckpointReady(projectDir, state.session_key);
    } catch {
      /* keep reconstructed artifacts even if status transition is unavailable */
    }
  }

  return {
    refresh,
    challengerLabels,
    lastCheckpoint: checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null,
    finalGate,
    batch,
  };
}

function extractChallengerFinalReview(lastMsg, challengerLabels) {
  const sections = parseRoundSections(lastMsg).reverse();
  for (const section of sections) {
    const challengerLine = [...section.speakerLines]
      .reverse()
      .find((line) => challengerLabels.includes(line.displayName));
    if (challengerLine) {
      return `${challengerLine.displayName}: ${challengerLine.content}`;
    }
  }
  return '';
}

function validateCheckpointBlock(content, round, totalRounds) {
  const heading = `## Checkpoint ${round}/${totalRounds}`;
  const blockPattern = new RegExp(
    `${escapeRegex(heading)}[\\s\\S]*?- Resolved Topics:[\\s\\S]*?- Unresolved Topics:[\\s\\S]*?- Deferred Risks:[\\s\\S]*?- Challenger Ratio:[\\s\\S]*?- Next Focus:`,
    'u'
  );
  return blockPattern.test(content);
}

function validatePartyModeVisibleOutput(lastMsg, ctx) {
  const errors = [];
  const content = String(lastMsg || '');
  const batch = resolveBatchBounds(ctx);
  const totalRounds = batch.targetRoundsTotal;
  const batchSize = Number(ctx.batch_size);
  const expectedCheckpoints = [batch.batchTargetRound];
  const roundMatches = Array.from(content.matchAll(/^### Round (\d+)\s*$/gmu)).map((match) =>
    Number(match[1])
  );

  const expectedRoundCount = batch.batchTargetRound - batch.batchStartRound + 1;
  if (roundMatches.length !== expectedRoundCount) {
    errors.push(`visible_round_count=${roundMatches.length}; expected=${expectedRoundCount}`);
  } else {
    const missingRounds = [];
    for (let offset = 0; offset < expectedRoundCount; offset += 1) {
      const expectedRound = batch.batchStartRound + offset;
      if (roundMatches[offset] !== expectedRound) {
        missingRounds.push(expectedRound);
      }
    }
    if (missingRounds.length > 0) {
      errors.push(`missing_or_out_of_order_round_headers=${missingRounds.join(',')}`);
    }
  }

  const roundSections = content
    .split(/(?=^### Round \d+\s*$)/gmu)
    .filter((section) => /^### Round \d+\s*$/mu.test(section));
  const speakerLinePattern = /^\S+\s+\*\*.+\*\*:\s.+$/mu;
  const roundWithoutSpeaker = [];
  roundSections.forEach((section, index) => {
    if (!speakerLinePattern.test(section)) {
      roundWithoutSpeaker.push(index + 1);
    }
  });
  if (roundWithoutSpeaker.length > 0) {
    errors.push(`rounds_without_visible_speaker_lines=${roundWithoutSpeaker.join(',')}`);
  }

  expectedCheckpoints.forEach((round) => {
    if (!validateCheckpointBlock(content, round, totalRounds)) {
      errors.push(`missing_checkpoint_block=${round}/${totalRounds}`);
    }
  });

  if (batch.isFinalBatch) {
    if (!/^## Final Gate Evidence$/gmu.test(content)) {
      errors.push('missing_final_gate_evidence_block');
    }

    const auditVerdictPath =
      typeof ctx.audit_verdict_path === 'string' && ctx.audit_verdict_path.trim()
        ? ctx.audit_verdict_path
        : '';
    if (!auditVerdictPath || !fs.existsSync(auditVerdictPath)) {
      errors.push('missing_audit_verdict_artifact');
    } else {
      const audit = readJson(auditVerdictPath);
      const requiredLines = [
        `- Gate Profile: ${ctx.gate_profile_id}`,
        `- Total Rounds: ${totalRounds}`,
        `- Final Result: ${audit.final_result}`,
        `- Challenger Ratio Check: ${audit.challenger_ratio_check}`,
        `- Tail Window No New Gap: ${audit.last_tail_no_new_gap_check}`,
      ];
      for (const line of requiredLines) {
        if (!content.includes(line)) {
          errors.push(`missing_final_gate_line=${line}`);
        }
      }
    }
  }

  return errors;
}

function assertPartyModeVisibleOutput(projectDir, agentId, agentType, lastMsg) {
  const state = loadPartyModeRunState(projectDir, agentId);
  const isPartyMode = agentType === 'party-mode-facilitator' || Boolean(state);
  if (!isPartyMode) {
    return { state };
  }
  if (!state) {
    throw new Error('Party-Mode visible-output validation metadata missing for this subagent run');
  }

  const reconstructed = maybeReconstructPartyModeArtifacts(projectDir, state.data, lastMsg);

  const errors = validatePartyModeVisibleOutput(lastMsg, state.data);
  if (errors.length > 0) {
    throw new Error(
      [
        'Party-Mode visible output validation failed; fail-closed.',
        'Required visible contract:',
        '- Every round must start with `### Round N`',
        '- Every batch boundary must show `## Checkpoint M/T` with all checkpoint fields',
        '- Final closeout must show `## Final Gate Evidence`',
        `Detected issues: ${errors.join(' | ')}`,
      ].join('\n')
    );
  }

  const challengerLabels =
    reconstructed?.challengerLabels ||
    deriveChallengerDisplayNames(
      projectDir,
      state.data.designated_challenger_id || 'adversarial-reviewer'
    );

  return {
    state,
    reconstructed,
    challengerFinalReview: extractChallengerFinalReview(lastMsg, challengerLabels),
    lastCheckpoint: reconstructed?.lastCheckpoint || null,
    finalGate: reconstructed?.finalGate || parseFinalGateEvidence(lastMsg),
  };
}

async function main() {
  const input = await readStdin();
  if (!input) {
    process.exit(0);
  }

  const agentId = input.agent_id || 'unknown';
  const agentType = input.agent_type || 'unknown';
  const lastMsg = input.last_assistant_message || '';
  const projectDir = input.cwd || process.cwd();
  const now = new Date();
  const ts = now.toLocaleTimeString(getHooksTimeLocale(), { hour12: false });
  const MSG = loadHookMessages(__dirname);
  const sr = MSG.subagentResult || {};
  const partyModeContext = assertPartyModeVisibleOutput(projectDir, agentId, agentType, lastMsg);

  const milestoneFile = path.join(projectDir, '.claude', 'state', 'milestones', `${agentId}.jsonl`);
  const milestones = parseMilestones(milestoneFile);

  const parts = [LINE, `${sr.title}  ${ts}`, LINE];
  parts.push(`${sr.type} ${agentType}`);

  if (milestones.length > 0) {
    const startEntry = milestones.find(m => m.event === 'agent_start');
    if (startEntry) {
      parts.push(`${sr.duration} ${formatDuration(startEntry.ts, now)}`);
    }

    const phaseEntries = milestones.filter(m => m.event !== 'agent_start');
    if (phaseEntries.length > 0) {
      parts.push(sr.milestones);
      phaseEntries.forEach((m, i) => {
        const mTime = new Date(m.ts).toLocaleTimeString(getHooksTimeLocale(), { hour12: false });
        const detail = m.detail ? `: ${m.detail}` : '';
        parts.push(`  ${i + 1}. [${mTime}] ${m.event}${detail}`);
      });
    }
  } else {
    parts.push(sr.milestonesEmpty);
  }

  if (partyModeContext?.challengerFinalReview) {
    parts.push(`挑战者终审: ${truncate(partyModeContext.challengerFinalReview, 300)}`);
  }
  if (partyModeContext?.lastCheckpoint) {
    parts.push(renderCheckpointBlock(partyModeContext.lastCheckpoint));
  }
  if (partyModeContext?.finalGate) {
    parts.push(renderFinalGateBlock(partyModeContext.finalGate));
  }
  parts.push(`${sr.resultSummary} ${truncate(lastMsg, 500)}`);
  parts.push(LINE);

  const summary = parts.join('\n');
  if (process.env.BMAD_HOOKS_QUIET !== '1') {
    process.stderr.write(summary + '\n');
  }
  process.stdout.write(JSON.stringify({ systemMessage: summary }));

  try { fs.unlinkSync(milestoneFile); } catch { /* ignore */ }
  try {
    if (partyModeContext?.state?.filePath) fs.unlinkSync(partyModeContext.state.filePath);
  } catch { /* ignore */ }
}

main().catch((error) => {
  process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
  process.exit(1);
});
