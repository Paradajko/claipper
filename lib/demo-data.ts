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
    title: "Podcast s founderom: rast bez chaosu",
    source_url: "https://example.com/source-founder-podcast",
    platform: "YouTube",
    duration_seconds: 3180,
    transcript: "Zakladatel vysvetľuje, ako zachytiť moment pred tým, než publikum stratí pozornosť.",
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    mylaura_campaign_url: "https://mylaura.example/campaigns/saas-creator-push",
    client_name: "Nord Studio",
    status: "review",
    notes: "Najsilnejšie pasáže sú medzi 08:10 a 14:35.",
    raw_data: null
  },
  {
    id: "source-2",
    created_at: iso(-2),
    title: "Livestream: tvorba shortov v praxi",
    source_url: "https://example.com/source-livestream",
    platform: "Twitch",
    duration_seconds: 5420,
    transcript: "Operátor ukazuje, ako z dlhého streamu vznikajú krátke klipy.",
    mylaura_campaign_name: "MyLaura / Clip workflow",
    mylaura_campaign_url: null,
    client_name: "Creator Ops",
    status: "new",
    notes: "Vhodné na sériu hookov o rýchlosti.",
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
    notes: "Večerný slot."
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
    notes: "Silný retention na prvých 3 sekundách."
  }
];

export const demoClips: ClipWithSchedule[] = [
  {
    id: "clip-1",
    created_at: iso(-4),
    source_video_id: "source-1",
    title: "Keď workflow drží tempo",
    start_seconds: 490,
    end_seconds: 535,
    duration_seconds: 45,
    hook: "Toto je rozdiel medzi strihaním a riadenou výrobou shortov.",
    caption: "Z dlhého rozhovoru vznikne séria krátkych momentov, ak má každý clip jasný hook.",
    hashtags: "#shorts #creatorops #workflow",
    cta: "Ulož si tento postup pred ďalším strihom.",
    content_type: "educational",
    score: 87,
    status: "idea",
    exported_video_url: null,
    target_platforms: ["TikTok", "Instagram Reels"],
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    notes: "Skúsiť ostrejší prvý titulok.",
    raw_data: null,
    scheduled_posts: [],
    source_videos: { title: "Podcast s founderom: rast bez chaosu", platform: "YouTube", source_url: "https://example.com/source-founder-podcast", client_name: "Nord Studio" }
  },
  {
    id: "clip-2",
    created_at: iso(-3),
    source_video_id: "source-1",
    title: "Hook za 3 sekundy",
    start_seconds: 820,
    end_seconds: 858,
    duration_seconds: 38,
    hook: "Ak prvé tri sekundy nič nesľúbia, zvyšok videa už nehrá.",
    caption: "Najprv sľub, potom dôkaz. Tak vzniká short, ktorý drží pozornosť.",
    hashtags: "#hook #shortform #marketing",
    cta: "Pošli si to do svojho clipping checklistu.",
    content_type: "hook teardown",
    score: 92,
    status: "editing",
    exported_video_url: null,
    target_platforms: ["TikTok", "YouTube Shorts"],
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    notes: "Doplniť b-roll z dashboardu.",
    raw_data: null,
    scheduled_posts: [],
    source_videos: { title: "Podcast s founderom: rast bez chaosu", platform: "YouTube", source_url: "https://example.com/source-founder-podcast", client_name: "Nord Studio" }
  },
  {
    id: "clip-3",
    created_at: iso(-2),
    source_video_id: "source-2",
    title: "Caption nie je popis",
    start_seconds: 1330,
    end_seconds: 1364,
    duration_seconds: 34,
    hook: "Caption má predĺžiť pozornosť, nie zopakovať video.",
    caption: "Dobrý caption pridáva dôvod zostať, komentovať alebo uložiť.",
    hashtags: "#caption #socialvideo #clips",
    cta: "Otestuj to na ďalšom poste.",
    content_type: "tip",
    score: 79,
    status: "ready",
    exported_video_url: "https://example.com/export/caption-tip.mp4",
    target_platforms: ["Instagram Reels"],
    mylaura_campaign_name: "MyLaura / Clip workflow",
    notes: "Ready na plánovanie.",
    raw_data: null,
    scheduled_posts: [],
    source_videos: { title: "Livestream: tvorba shortov v praxi", platform: "Twitch", source_url: "https://example.com/source-livestream", client_name: "Creator Ops" }
  },
  {
    id: "clip-4",
    created_at: iso(-3),
    source_video_id: "source-1",
    title: "Moment pred drop-offom",
    start_seconds: 1010,
    end_seconds: 1041,
    duration_seconds: 31,
    hook: "Najlepšie momenty často začínajú tesne pred tým, ako by si video vypol.",
    caption: "Hľadaj zmenu energie, nie len najhlasnejšiu vetu.",
    hashtags: "#editing #shorts #creator",
    cta: "Pozri si svoj ďalší zdroj s týmto filtrom.",
    content_type: "insight",
    score: 84,
    status: "scheduled",
    exported_video_url: "https://example.com/export/dropoff.mp4",
    target_platforms: ["TikTok"],
    mylaura_campaign_name: "MyLaura / SaaS creator push",
    notes: "Naplánované.",
    raw_data: null,
    scheduled_posts: [demoScheduledPosts[0]],
    source_videos: { title: "Podcast s founderom: rast bez chaosu", platform: "YouTube", source_url: "https://example.com/source-founder-podcast", client_name: "Nord Studio" }
  },
  {
    id: "clip-5",
    created_at: iso(-8),
    source_video_id: "source-2",
    title: "Prečo jeden clip nestačí",
    start_seconds: 2210,
    end_seconds: 2252,
    duration_seconds: 42,
    hook: "Jeden dobrý moment vie vyrobiť tri rôzne shorty.",
    caption: "Hook, dôkaz a CTA sa dajú poskladať podľa platformy.",
    hashtags: "#repurpose #shorts #contentops",
    cta: "Rozdeľ svoj ďalší moment na tri angle.",
    content_type: "strategy",
    score: 95,
    status: "posted",
    exported_video_url: "https://example.com/export/one-moment-three-shorts.mp4",
    target_platforms: ["Instagram Reels"],
    mylaura_campaign_name: "MyLaura / Clip workflow",
    notes: "Top performer zatiaľ.",
    raw_data: null,
    scheduled_posts: [demoScheduledPosts[1]],
    source_videos: { title: "Livestream: tvorba shortov v praxi", platform: "Twitch", source_url: "https://example.com/source-livestream", client_name: "Creator Ops" }
  }
];
