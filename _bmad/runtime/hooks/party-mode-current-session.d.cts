export function derivePartyModeFinalSidecarPath(projectRoot: string, sessionKey: string): string;
export function derivePartyModeLaunchCapturePath(projectRoot: string, sessionKey: string): string;
export function derivePartyModeProgressSidecarPath(projectRoot: string, sessionKey: string): string;
export function derivePartyModeSidecarDir(projectRoot: string): string;
export function derivePartyModeStartedSidecarPath(projectRoot: string, sessionKey: string): string;
export function derivePartyModeVisibleOutputCapturePath(projectRoot: string, sessionKey: string): string;
export function partyModeCurrentSessionStatePath(projectRoot: string): string;
export function readPartyModeSidecar(filePath: string): Record<string, unknown> | null;
export function readPartyModeCurrentSessionState(projectRoot: string): Record<string, unknown> | null;
export function writePartyModeSidecar(
  filePath: string,
  payload: Record<string, unknown>
): Record<string, unknown>;
export function writePartyModeCurrentSessionState(
  projectRoot: string,
  payload: Record<string, unknown>
): Record<string, unknown>;
