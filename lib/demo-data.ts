import type { ClipWithSchedule, ScheduledPost, SourceVideo } from "@/lib/types";

const now = new Date();
const iso = (daysOffset: number, hour = 10) => {
  const date = new Date(now);
  date.setDate(now.getDate() + daysOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const demoSources: SourceVideo[] = [
  {
    id: "source-1",
    created_at: iso(-5),
    title: "Founder podcast: growth without chaos",
    source_url: "https://example.com/source-founder-podcast",
    platform: "YouTube",
    duration_seconds: 3180,
    transcript: "The founder explains how to catch the moment before the audience loses attention.",
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    mylaura_campaign_url: "https://mylaura.example/campaigns/saas-creator-push",
    client_name: "Nord Studio",
    status: "review",
    notes: "The strongest passages are between 08:10 and 14:35.",
    raw_data: null
  },
  {
    id: "source-2",
    created_at: iso(-2),
    title: "Livestream: short-form production in practice",
    source_url: "https://example.com/source-livestream",
    platform: "Twitch",
    duration_seconds: 5420,
    transcript: "The operator shows how short clips are created from a long stream.",
    mylaura_campaign_name: "MyLaura / Clip workflow",
    mylaura_campaign_url: null,
    client_name: "Creator Ops",
    status: "new",
    notes: "Useful for a series of hooks about speed.",
    raw_data: null
  }
];

export const demoScheduledPosts: ScheduledPost[] = [
  {
    id: "post-1",
    created_at: iso(-3),
    clip_id: "clip-4",
    platform: "TikTok",
    target_account: "@nordstudio",
    scheduled_at: iso(0, 18),
    published_at: null,
    post_url: null,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    status: "scheduled",
    notes: "Evening slot."
  },
  {
    id: "post-2",
    created_at: iso(-6),
    clip_id: "clip-5",
    platform: "Instagram Reels",
    target_account: "@creatorops",
    scheduled_at: iso(-1, 12),
    published_at: iso(-1, 12),
    post_url: "https://example.com/reel",
    views: 28400,
    likes: 1920,
    comments: 84,
    shares: 320,
    status: "posted",
    notes: "Strong retention in the first 3 seconds."
  }
];

export const demoClips: ClipWithSchedule[] = [
  {
    id: "clip-1",
    created_at: iso(-4),
    source_video_id: "source-1",
    title: "When the workflow keeps pace",
    start_seconds: 490,
    end_seconds: 535,
    duration_seconds: 45,
    hook: "This is the difference between editing and controlled short-form production.",
    caption: "A long interview becomes a series of short moments when each clip has a clear hook.",
    hashtags: "#shorts #creatorops #workflow",
    cta: "Save this process before your next edit.",
    content_type: "educational",
    score: 87,
    status: "idea",
    exported_video_url: null,
    target_platforms: ["TikTok", "Instagram Reels"],
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    notes: "Try a sharper first title.",
    raw_data: null,
    scheduled_posts: [],
    source_videos: { title: "Founder podcast: growth without chaos", platform: "YouTube", source_url: "https://example.com/source-founder-podcast", client_name: "Nord Studio" }
  },
  {
    id: "clip-2",
    created_at: iso(-3),
    source_video_id: "source-1",
    title: "Hook in 3 seconds",
    start_seconds: 820,
    end_seconds: 858,
    duration_seconds: 38,
    hook: "If the first three seconds promise nothing, the rest of the video cannot carry it.",
    caption: "Promise first, then proof. That is how a short keeps attention.",
    hashtags: "#hook #shortform #marketing",
    cta: "Send this to your clipping checklist.",
    content_type: "hook teardown",
    score: 92,
    status: "editing",
    exported_video_url: null,
    target_platforms: ["TikTok", "YouTube Shorts"],
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    notes: "Add b-roll from the dashboard.",
    raw_data: null,
    scheduled_posts: [],
    source_videos: { title: "Founder podcast: growth without chaos", platform: "YouTube", source_url: "https://example.com/source-founder-podcast", client_name: "Nord Studio" }
  },
  {
    id: "clip-3",
    created_at: iso(-2),
    source_video_id: "source-2",
    title: "A caption is not a description",
    start_seconds: 1330,
    end_seconds: 1364,
    duration_seconds: 34,
    hook: "A caption should extend attention, not repeat the video.",
    caption: "A good caption adds a reason to stay, comment, or save.",
    hashtags: "#caption #socialvideo #clips",
    cta: "Test this on your next post.",
    content_type: "tip",
    score: 79,
    status: "ready",
    exported_video_url: "https://example.com/export/caption-tip.mp4",
    target_platforms: ["Instagram Reels"],
    mylaura_campaign_name: "MyLaura / Clip workflow",
    notes: "Ready for scheduling.",
    raw_data: null,
    scheduled_posts: [],
    source_videos: { title: "Livestream: short-form production in practice", platform: "Twitch", source_url: "https://example.com/source-livestream", client_name: "Creator Ops" }
  },
  {
    id: "clip-4",
    created_at: iso(-3),
    source_video_id: "source-1",
    title: "The moment before drop-off",
    start_seconds: 1010,
    end_seconds: 1041,
    duration_seconds: 31,
    hook: "The best moments often start right before you would turn the video off.",
    caption: "Look for the energy shift, not only the loudest line.",
    hashtags: "#editing #shorts #creator",
    cta: "Review your next source with this filter.",
    content_type: "insight",
    score: 84,
    status: "scheduled",
    exported_video_url: "https://example.com/export/dropoff.mp4",
    target_platforms: ["TikTok"],
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    notes: "Scheduled.",
    raw_data: null,
    scheduled_posts: [demoScheduledPosts[0]],
    source_videos: { title: "Founder podcast: growth without chaos", platform: "YouTube", source_url: "https://example.com/source-founder-podcast", client_name: "Nord Studio" }
  },
  {
    id: "clip-5",
    created_at: iso(-8),
    source_video_id: "source-2",
    title: "Why one clip is not enough",
    start_seconds: 2210,
    end_seconds: 2252,
    duration_seconds: 42,
    hook: "One good moment can produce three different shorts.",
    caption: "Hook, proof, and CTA can be assembled differently by platform.",
    hashtags: "#repurpose #shorts #contentops",
    cta: "Split your next moment into three angles.",
    content_type: "strategy",
    score: 95,
    status: "posted",
    exported_video_url: "https://example.com/export/one-moment-three-shorts.mp4",
    target_platforms: ["Instagram Reels"],
    mylaura_campaign_name: "MyLaura / Clip workflow",
    notes: "Top performer so far.",
    raw_data: null,
    scheduled_posts: [demoScheduledPosts[1]],
    source_videos: { title: "Livestream: short-form production in practice", platform: "Twitch", source_url: "https://example.com/source-livestream", client_name: "Creator Ops" }
  }
];
