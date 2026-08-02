export type SourceAuthorityJson = Record<string, unknown>;

export interface MainAgentActionContext {
  action?: string;
  cwd: string;
  args: Record<string, unknown>;
  rawArgv?: unknown[];
  json?: boolean;
  [key: string]: unknown;
}

interface InvokeSourceAuthorityMainActionOptions {
  context: MainAgentActionContext;
  action: string;
  invoke: (argv: string[]) => number;
  successStatus: (result: SourceAuthorityJson | null) => string;
  blockedStatus: string;
}

function sourceAuthorityArgv(context: MainAgentActionContext, action: string): string[] {
  const rawArgv = Array.isArray(context.rawArgv) ? context.rawArgv.map(String) : [];
  const argv = rawArgv[0] === action ? rawArgv.slice(1) : [...rawArgv];
  const actionIndex = argv.findIndex(
    (value) => value === '--action' || value.startsWith('--action=')
  );
  if (actionIndex >= 0) {
    const value = argv[actionIndex];
    const actionValue =
      value === '--action' ? String(argv[actionIndex + 1] || '') : value.slice('--action='.length);
    if (actionValue.replace(/_/gu, '-') === action) {
      argv.splice(actionIndex, value === '--action' ? 2 : 1);
    }
  }
  if (!argv.includes('--json')) argv.push('--json');
  return argv;
}

function parseJsonOutput(stdout: string, stderr: string): SourceAuthorityJson | null {
  for (const value of [stdout, stderr]) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    try {
      const parsed: unknown = JSON.parse(normalized);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as SourceAuthorityJson;
      }
    } catch {
      // Preserve non-JSON output as diagnostic evidence below.
    }
  }
  return null;
}

function captureSourceAuthorityMain(
  context: MainAgentActionContext,
  action: string,
  invoke: (argv: string[]) => number
) {
  let stdout = '';
  let stderr = '';
  const originalCwd = process.cwd();
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (typeof callback === 'function') callback();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
    stderr += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (typeof callback === 'function') callback();
    return true;
  }) as typeof process.stderr.write;
  try {
    process.chdir(context.cwd);
    return {
      exitCode: invoke(sourceAuthorityArgv(context, action)),
      stdout,
      stderr,
    };
  } finally {
    process.chdir(originalCwd);
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

export function invokeSourceAuthorityMainAction({
  context,
  action,
  invoke,
  successStatus,
  blockedStatus,
}: InvokeSourceAuthorityMainActionOptions) {
  let captured: ReturnType<typeof captureSourceAuthorityMain>;
  try {
    captured = captureSourceAuthorityMain(context, action, invoke);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: blockedStatus,
      exitCode: 2,
      result: null,
      sourceAuthorityRuntimeProof: {
        mode: 'in_process_source_authority',
        action,
        stdout: '',
        stderr: message,
      },
      errors: [{ code: blockedStatus, message }],
    };
  }

  const exitCode = typeof captured.exitCode === 'number' ? captured.exitCode : 0;
  const result = parseJsonOutput(captured.stdout, captured.stderr);
  const message =
    captured.stderr.trim() ||
    captured.stdout.trim() ||
    `source-authority action ${action} exited with code ${exitCode}`;
  return {
    status: exitCode === 0 ? successStatus(result) : blockedStatus,
    exitCode,
    result,
    sourceAuthorityRuntimeProof: {
      mode: 'in_process_source_authority',
      action,
      stdout: captured.stdout,
      stderr: captured.stderr,
    },
    errors: exitCode === 0 ? [] : [{ code: blockedStatus, message }],
  };
}
