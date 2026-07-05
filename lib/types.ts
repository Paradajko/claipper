export const clipStatuses = [
  "idea",
  "selected",
  "editing",
  "ready",
  "scheduled",
  "posted",
  "reported",
  "rejected"
] as const;

export type ClipStatus = (typeof clipStatuses)[number];

export type SourceVideo = {
  id: string;
  created_at: string;
  title: string;
  source_url: string | null;
  platform: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  mylaura_campaign_name: string | null;
  mylaura_campaign_url: string | null;
  client_name: string | null;
  status: string;
  notes: string | null;
  raw_data: Record<string, unknown> | null;
};

export type Clip = {
  id: string;
  created_at: string;
  source_video_id: string | null;
  video_id?: string | null;
  clip_idea_id?: string | null;
  title: string | null;
  start_seconds: number | null;
  end_seconds: number | null;
  duration_seconds: number | null;
  hook: string | null;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  content_type: string | null;
  score: number | null;
  status: ClipStatus;
  exported_video_url: string | null;
  file_path?: string | null;
  target_platforms: string[] | null;
  mylaura_campaign_name: string | null;
  notes: string | null;
  raw_data: Record<string, unknown> | null;
};

export type ScheduledPost = {
  id: string;
  created_at: string;
  clip_id: string;
  platform: string;
  target_account: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  post_url: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  status: string;
  notes: string | null;
};

export type ClipWithSchedule = Clip & {
  scheduled_posts?: ScheduledPost[];
  source_videos?: Pick<SourceVideo, "title" | "platform" | "source_url" | "client_name"> | null;
};

export type StreamVideoStatus =
  | "uploaded"
  | "extracting_audio"
  | "transcribing"
  | "segmenting"
  | "analyzing"
  | "ranking"
  | "ready"
  | "failed";

export type StreamVideo = {
  id: string;
  created_at: string;
  updated_at: string | null;
  title: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  file_path: string;
  audio_path: string | null;
  status: StreamVideoStatus;
  progress_text: string | null;
  error_message: string | null;
  raw_data: Record<string, unknown> | null;
};

export type Transcript = {
  id: string;
  created_at: string;
  video_id: string;
  status: string;
  language: string | null;
  text: string | null;
  raw_data: Record<string, unknown> | null;
};

export type TranscriptSegmentRecord = {
  id: string;
  created_at: string;
  video_id: string;
  transcript_id: string | null;
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
  status: string;
  raw_data: Record<string, unknown> | null;
};

export type ClipIdea = {
  id: string;
  created_at: string;
  video_id: string;
  title: string;
  start_time: number;
  end_time: number;
  score: number;
  reason: string;
  hook: string;
  caption: string;
  difficulty: "easy" | "medium" | "hard";
  clip_type: "funny" | "reaction" | "opinion" | "educational" | "hype" | "story" | "other";
  status: string;
  raw_data: Record<string, unknown> | null;
};

export type ProcessingJob = {
  id: string;
  created_at: string;
  updated_at: string | null;
  video_id: string | null;
  job_type: string;
  status: string;
  step: string | null;
  error_message: string | null;
  raw_data: Record<string, unknown> | null;
};

export type StreamVideoDetail = StreamVideo & {
  transcripts?: Transcript[];
  transcript_segments?: TranscriptSegmentRecord[];
  clip_ideas?: ClipIdea[];
  clips?: Clip[];
  processing_jobs?: ProcessingJob[];
};
