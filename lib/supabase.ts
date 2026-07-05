import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { demoClips, demoScheduledPosts, demoSources } from "@/lib/demo-data";
import type { ClipIdea, ClipStatus, ClipWithSchedule, ScheduledPost, SourceVideo, StreamVideo, StreamVideoDetail } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

export async function getSourceVideos(): Promise<SourceVideo[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return demoSources;

  const { data, error } = await supabase
    .from("source_videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load source videos", error);
    return demoSources;
  }

  return data as SourceVideo[];
}

export async function getStreamVideos(): Promise<StreamVideo[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load stream scan videos", error);
    return [];
  }

  return data as StreamVideo[];
}

export async function getStreamVideo(id: string): Promise<StreamVideoDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("videos")
    .select("*, transcripts(*), transcript_segments(*), clip_ideas(*), clips(*), processing_jobs(*), video_imports(*)")
    .eq("id", id)
    .order("score", { referencedTable: "clip_ideas", ascending: false })
    .single();

  if (error) {
    console.error("Failed to load stream scan video", error);
    return null;
  }

  return data as StreamVideoDetail;
}

export async function createStorageSignedUrl(bucket: string | null | undefined, storagePath: string | null | undefined, expiresIn = 3600) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !bucket || !storagePath) return null;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
  if (error) {
    console.error("Failed to create signed storage URL", error);
    return null;
  }

  return data.signedUrl;
}

export async function getClipIdea(id: string): Promise<ClipIdea | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.from("clip_ideas").select("*").eq("id", id).single();
  if (error) {
    console.error("Failed to load clip idea", error);
    return null;
  }

  return data as ClipIdea;
}

export async function getClips(): Promise<ClipWithSchedule[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return demoClips;

  const { data, error } = await supabase
    .from("clips")
    .select("*, scheduled_posts(*), source_videos(title, platform, source_url, client_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load clips", error);
    return demoClips;
  }

  return data as ClipWithSchedule[];
}

export async function getClip(id: string): Promise<ClipWithSchedule | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return demoClips.find((clip) => clip.id === id) ?? null;

  const { data, error } = await supabase
    .from("clips")
    .select("*, scheduled_posts(*), source_videos(title, platform, source_url, client_name)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to load clip", error);
    return null;
  }

  return data as ClipWithSchedule;
}

export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return demoScheduledPosts;

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Failed to load scheduled posts", error);
    return demoScheduledPosts;
  }

  return data as ScheduledPost[];
}

export async function createSourceVideo(formData: FormData) {
  "use server";

  const supabase = getSupabaseAdmin();
  if (!supabase) redirect("/app/content-lab?demo=1");

  const duration = Number(formData.get("duration_seconds"));
  const payload = {
    title: String(formData.get("title") ?? ""),
    source_url: valueOrNull(formData.get("source_url")),
    platform: valueOrNull(formData.get("platform")),
    duration_seconds: Number.isFinite(duration) && duration > 0 ? duration : null,
    transcript: valueOrNull(formData.get("transcript")),
    mylaura_campaign_name: valueOrNull(formData.get("mylaura_campaign_name")),
    mylaura_campaign_url: valueOrNull(formData.get("mylaura_campaign_url")),
    client_name: valueOrNull(formData.get("client_name")),
    status: String(formData.get("status") ?? "new"),
    notes: valueOrNull(formData.get("notes"))
  };

  const { error } = await supabase.from("source_videos").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/app/content-lab");
  revalidatePath("/app");
  redirect("/app/content-lab");
}

export async function updateClipStatus(clipId: string, status: ClipStatus) {
  "use server";

  const supabase = getSupabaseAdmin();
  if (!supabase) redirect(`/app/clips/${clipId}?demo=1`);

  const { error } = await supabase.from("clips").update({ status }).eq("id", clipId);
  if (error) throw new Error(error.message);

  revalidatePath("/app/clips");
  revalidatePath(`/app/clips/${clipId}`);
  revalidatePath("/app");
}

export async function updateClipDetails(formData: FormData) {
  "use server";

  const clipId = String(formData.get("id"));
  const supabase = getSupabaseAdmin();
  if (!supabase) redirect(`/app/clips/${clipId}?demo=1`);

  const payload = {
    hook: valueOrNull(formData.get("hook")),
    caption: valueOrNull(formData.get("caption")),
    hashtags: valueOrNull(formData.get("hashtags")),
    cta: valueOrNull(formData.get("cta")),
    exported_video_url: valueOrNull(formData.get("exported_video_url")),
    notes: valueOrNull(formData.get("notes"))
  };

  const { error } = await supabase.from("clips").update(payload).eq("id", clipId);
  if (error) throw new Error(error.message);

  revalidatePath("/app/clips");
  revalidatePath(`/app/clips/${clipId}`);
  redirect(`/app/clips/${clipId}`);
}

function valueOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}
