import {
  expectedRalphTddPhasesForStory,
  isProductionRalphUserStory,
  type RalphPrdDocument,
  type RalphProgressHeader,
  type RalphStoryLogEntryInput,
  type RalphTddPhase,
  type RalphUserStory,
} from './types';

const STORY_LOG_SENTINEL = '# Story log';

function pad(num: number): string {
  return String(num).padStart(2, '0');
}

export function formatRalphTimestamp(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Ralph timestamp: ${String(value)}`);
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function computeRalphProgressHeader(prd: RalphPrdDocument): RalphProgressHeader {
  const totalStories = prd.userStories.length;
  const completedStories = prd.userStories.filter((story) => story.passes).length;
  const currentStory =
    totalStories === 0 ? 0 : completedStories >= totalStories ? totalStories : completedStories + 1;

  return {
    title: prd.taskDescription,
    totalStories,
    currentStory,
    completedStories,
  };
}

export function formatRalphStoryLogLine(input: RalphStoryLogEntryInput): string {
  return `[${formatRalphTimestamp(input.timestamp)}] ${input.userStoryId}: ${input.title} - PASSED`;
}

function renderPendingStepLine(phase: RalphTddPhase): string {
  return `[${phase}] _pending_`;
}

export function renderRalphUserStorySection(story: RalphUserStory): string {
  const lines = [`## ${story.id}: ${story.title}`, `Status: ${story.passes ? 'PASSED' : 'PENDING'}`];

  for (const phase of expectedRalphTddPhasesForStory(story.involvesProductionCode)) {
    lines.push(renderPendingStepLine(phase));
  }

  return lines.join('\n');
}

export function renderInitialRalphProgressDocument(prd: RalphPrdDocument): string {
  const header = computeRalphProgressHeader(prd);
  const sections = prd.userStories
    .map((story) => renderRalphUserStorySection(story))
    .join('\n\n');

  return [
    `# Progress: ${header.title}`,
    `# Total stories: ${header.totalStories}`,
    '',
    `Current story: ${header.currentStory}`,
    `Completed: ${header.completedStories}`,
    '',
    '---',
    STORY_LOG_SENTINEL,
    '',
    sections,
    '',
  ].join('\n');
}

function replaceFirstLineMatching(
  content: string,
  matcher: RegExp,
  replacement: string
): string {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => matcher.test(line));
  if (index === -1) {
    return content;
  }
  lines[index] = replacement;
  return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}

export function updateRalphProgressHeader(
  content: string,
  header: RalphProgressHeader
): string {
  let next = content;
  next = replaceFirstLineMatching(next, /^# Progress:/, `# Progress: ${header.title}`);
  next = replaceFirstLineMatching(next, /^# Total stories:/, `# Total stories: ${header.totalStories}`);
  next = replaceFirstLineMatching(next, /^Current story:/, `Current story: ${header.currentStory}`);
  next = replaceFirstLineMatching(next, /^Completed:/, `Completed: ${header.completedStories}`);
  return next;
}

export function markRalphStoryStatus(
  content: string,
  story: RalphUserStory
): string {
  const header = `## ${story.id}: ${story.title}`;
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim() === header);
  if (index === -1 || index + 1 >= lines.length) {
    return content;
  }
  lines[index + 1] = `Status: ${story.passes ? 'PASSED' : 'PENDING'}`;
  return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}

function phaseMarker(phase: RalphTddPhase): string {
  return `[${phase}]`;
}

export function upsertRalphProgressPhaseLine(
  content: string,
  story: RalphUserStory,
  phase: RalphTddPhase,
  detail: string
): string {
  const header = `## ${story.id}: ${story.title}`;
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim() === header);
  if (index === -1) {
    return content;
  }

  const marker = phaseMarker(phase);
  const targetLine = `${marker} ${detail}`;
  for (let i = index + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) {
      break;
    }
    if (line.startsWith(marker)) {
      lines[i] = targetLine;
      return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
    }
  }

  const insertAt = index + 2 + expectedRalphTddPhasesForStory(story.involvesProductionCode).indexOf(phase);
  lines.splice(insertAt, 0, targetLine);
  return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}

export function appendRalphStoryLog(content: string, entry: string): string {
  const lines = content.split(/\r?\n/);
  const sentinelIndex = lines.findIndex((line) => line.trim() === STORY_LOG_SENTINEL);
  if (sentinelIndex === -1) {
    return `${content}${content.endsWith('\n') ? '' : '\n'}${STORY_LOG_SENTINEL}\n${entry}\n`;
  }

  const firstSectionIndex = lines.findIndex(
    (line, index) => index > sentinelIndex && line.startsWith('## ')
  );
  const insertAt = firstSectionIndex === -1 ? lines.length : firstSectionIndex;
  lines.splice(insertAt, 0, entry, '');
  return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}

export function hasRalphStoryLogEntry(content: string, userStoryId: string): boolean {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line.includes(`] ${userStoryId}: `) && line.endsWith(' - PASSED'));
}

export function validateRalphProgressPhaseSet(story: RalphUserStory): readonly RalphTddPhase[] {
  return isProductionRalphUserStory(story)
    ? ['TDD-RED', 'TDD-GREEN', 'TDD-REFACTOR']
    : ['DONE'];
}
