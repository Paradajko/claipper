export function isKickUrl(sourceUrl: string): boolean;

export function buildYtDlpDownloadArgs(input: { sourceUrl: string; outputTemplate: string }): string[];

export function findAvailableChromeImpersonationTarget(output: string): string | null;

export function createPlatformImportError(
  cause: unknown,
  input: { sourceUrl: string; args: string[] }
): Error & { userMessage: string; technicalError: string };
