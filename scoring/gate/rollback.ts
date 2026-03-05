/**
 * B13: D 级熔断后 Git 回退建议（不自动执行）
 */

export interface RollbackSuggestion {
  action: 'suggest_rollback';
  stage: string;
  lastStableCommit: string | undefined;
  message: string;
  commands: string[];
}

const WARNING_PREFIX = '⚠️ 以下回退命令仅供参考，请确认后手动执行：';

/**
 * 生成回退建议，不执行任何 git 操作。
 */
export function suggestRollback(
  stage: string,
  lastStableCommit?: string
): RollbackSuggestion {
  const commands: string[] = ['git stash'];
  if (lastStableCommit) {
    commands.push(`git reset --hard ${lastStableCommit}`);
  } else {
    // 无已知稳定提交时仅 stash
  }
  const body = commands.join('\n');
  const extra = lastStableCommit
    ? ''
    : '\n无已知稳定提交，请手动确认回退目标。';
  const message = `${WARNING_PREFIX}\n${body}${extra}`;
  return {
    action: 'suggest_rollback',
    stage,
    lastStableCommit,
    message,
    commands,
  };
}
