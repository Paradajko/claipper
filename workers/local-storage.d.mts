export type LocalVideoLayout = {
  videoId: string;
  root: string;
  originalDir: string;
  workingDir: string;
  clipsDir: string;
  clipsRelativeDir: string;
  sourceRelativePath: string;
  chatRelativePath: string;
  normalizedChatRelativePath: string;
  metadataRelativePath: string;
};

export function createLocalVideoLayout(root: string, videoId: string, extension: string): Promise<LocalVideoLayout>;
export function resolveLocalMediaPath(root: string, relativePath: string): string;
export function localRelativePath(...segments: string[]): string;
