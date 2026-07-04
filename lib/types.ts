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
