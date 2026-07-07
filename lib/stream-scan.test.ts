import { describe, expect, it } from "vitest";
import {
  buildTranscriptSegments,
  clipIdeaInsertPayload,
  extractSourceQuote,
  groundClipCandidate,
  normalizeClipCandidate,
  parseTimestampToSeconds,
  rankClipCandidates,
  refineFinalMomentTiming,
  secondsToTimestamp
} from "@/lib/stream-scan";

describe("stream scan helpers", () => {
  it("parses and formats HH:MM:SS timestamps", () => {
    expect(parseTimestampToSeconds("00:08:14")).toBe(494);
    expect(parseTimestampToSeconds("01:02:03")).toBe(3723);
    expect(secondsToTimestamp(494)).toBe("00:08:14");
    expect(secondsToTimestamp(3723)).toBe("01:02:03");
  });

  it("splits transcript items into bounded 5 minute segments", () => {
    const words = Array.from({ length: 13 }, (_, index) => ({
      start: index * 60,
      end: index * 60 + 20,
      text: `minute-${index}`
    }));

    const segments = buildTranscriptSegments(words, 300);

    expect(segments).toEqual([
      {
        segment_index: 0,
        start_time: 0,
        end_time: 260,
        text: "minute-0 minute-1 minute-2 minute-3 minute-4"
      },
      {
        segment_index: 1,
        start_time: 300,
        end_time: 560,
        text: "minute-5 minute-6 minute-7 minute-8 minute-9"
      },
      {
        segment_index: 2,
        start_time: 600,
        end_time: 740,
        text: "minute-10 minute-11 minute-12"
      }
    ]);
  });

  it("normalizes structured AI candidates and rejects invalid items", () => {
    const candidate = normalizeClipCandidate({
      title: "Strong opener",
      start_time: "00:08:14",
      end_time: "00:08:49",
      score: 91,
      reason: "Clear opinion and payoff.",
      hook: "This is where the argument changes.",
      caption: "A short moment worth replaying.",
      difficulty: "easy",
      clip_type: "opinion",
      attention_score: 92,
      emotion_spike: 80,
      hook_strength: 95,
      payoff_score: 88,
      context_needed: 12,
      retention_risk: 18,
      edit_difficulty: 22,
      recommendation: "export",
      recut_suggestion: "Start at the sentence with the challenge and end after the laugh."
    });

    expect(candidate).toMatchObject({
      title: "Strong opener",
      start_time: 494,
      end_time: 529,
      score: 91,
      difficulty: "easy",
      clip_type: "opinion",
      attention_score: 92,
      emotion_spike: 80,
      hook_strength: 95,
      payoff_score: 88,
      context_needed: 12,
      retention_risk: 18,
      edit_difficulty: 22,
      recommendation: "export",
      recut_suggestion: "Start at the sentence with the challenge and end after the laugh."
    });
    expect(normalizeClipCandidate({ title: "bad", start_time: "oops" })).toBeNull();
  });

  it("keeps legacy clip idea candidates working with v2 scoring defaults", () => {
    const candidate = normalizeClipCandidate({
      title: "Legacy opener",
      start_time: "00:01:10",
      end_time: "00:01:44",
      score: 82,
      reason: "Clear reaction.",
      hook: "Wait for the turn.",
      caption: "This changed fast.",
      difficulty: "medium",
      clip_type: "reaction"
    });

    expect(candidate).toMatchObject({
      title: "Legacy opener",
      attention_score: 82,
      emotion_spike: 50,
      hook_strength: 82,
      payoff_score: 50,
      context_needed: 50,
      retention_risk: 50,
      edit_difficulty: 50,
      recommendation: "maybe",
      recut_suggestion: ""
    });
  });

  it("ranks candidates by score while filtering long or unclear ranges", () => {
    const ranked = rankClipCandidates([
      { title: "Too short", start_time: 0, end_time: 12, score: 100, reason: "short", hook: "h", caption: "c", difficulty: "easy", clip_type: "story", attention_score: 100, emotion_spike: 90, hook_strength: 95, payoff_score: 90, context_needed: 10, retention_risk: 10, edit_difficulty: 10, recommendation: "export", recut_suggestion: "", source_quote: "" },
      { title: "Too long", start_time: 0, end_time: 400, score: 99, reason: "long", hook: "h", caption: "c", difficulty: "easy", clip_type: "story", attention_score: 99, emotion_spike: 90, hook_strength: 95, payoff_score: 90, context_needed: 10, retention_risk: 10, edit_difficulty: 10, recommendation: "export", recut_suggestion: "", source_quote: "" },
      { title: "Summary", start_time: 1, end_time: 40, score: 98, reason: "calm explanation", hook: "h", caption: "c", difficulty: "easy", clip_type: "educational", attention_score: 25, emotion_spike: 10, hook_strength: 20, payoff_score: 15, context_needed: 85, retention_risk: 90, edit_difficulty: 30, recommendation: "skip", recut_suggestion: "Needs a sharper reaction.", source_quote: "" },
      { title: "Needs recut", start_time: 60, end_time: 100, score: 96, reason: "great payoff but starts early", hook: "h", caption: "c", difficulty: "medium", clip_type: "opinion", attention_score: 88, emotion_spike: 80, hook_strength: 84, payoff_score: 90, context_needed: 28, retention_risk: 42, edit_difficulty: 64, recommendation: "needs_recut", recut_suggestion: "Trim the setup.", source_quote: "" },
      { title: "Best", start_time: 10, end_time: 50, score: 95, reason: "best", hook: "h", caption: "c", difficulty: "easy", clip_type: "reaction", attention_score: 95, emotion_spike: 88, hook_strength: 92, payoff_score: 86, context_needed: 18, retention_risk: 20, edit_difficulty: 22, recommendation: "export", recut_suggestion: "", source_quote: "" },
      { title: "Weak", start_time: 110, end_time: 140, score: 61, reason: "weak", hook: "h", caption: "c", difficulty: "medium", clip_type: "other", attention_score: 55, emotion_spike: 40, hook_strength: 52, payoff_score: 45, context_needed: 60, retention_risk: 62, edit_difficulty: 50, recommendation: "maybe", recut_suggestion: "", source_quote: "" }
    ]);

    expect(ranked.map((item) => item.title)).toEqual(["Best", "Needs recut", "Weak"]);
  });

  it("keeps multiple visible v2.1 opportunities while hiding only skip recommendations", () => {
    const candidates = Array.from({ length: 10 }, (_, index) => ({
      title: `Moment ${index}`,
      start_time: index * 70,
      end_time: index * 70 + 38,
      score: 80 - index,
      reason: "Has a clear reaction or opinion.",
      hook: "Sharp first sentence.",
      caption: "Worth testing.",
      difficulty: "easy" as const,
      clip_type: "reaction" as const,
      attention_score: 80 - index,
      emotion_spike: 70,
      hook_strength: 75,
      payoff_score: 72,
      context_needed: 25,
      retention_risk: 30,
      edit_difficulty: 35,
      recommendation: index === 2 ? ("skip" as const) : index % 3 === 0 ? ("needs_recut" as const) : ("maybe" as const),
      recut_suggestion: index % 3 === 0 ? "Trim the setup and start on the reaction." : "",
      source_quote: ""
    }));

    const ranked = rankClipCandidates(candidates);

    expect(ranked).toHaveLength(8);
    expect(ranked.some((candidate) => candidate.recommendation === "skip")).toBe(false);
    expect(ranked.some((candidate) => candidate.recommendation === "maybe")).toBe(true);
    expect(ranked.some((candidate) => candidate.recommendation === "needs_recut")).toBe(true);
  });

  it("stores v2.1 scoring metadata without adding database columns", () => {
    const candidate = normalizeClipCandidate({
      title: "To je dosť tvrdý názor",
      start_time: "00:02:10",
      end_time: "00:02:44",
      score: 86,
      reason: "Silný názor s jasnou reakciou.",
      hook: "Toto by som nikdy nepovedal nahlas.",
      caption: "Keď príde nepríjemná pravda.",
      difficulty: "medium",
      clip_type: "opinion",
      attention_score: 88,
      emotion_spike: 82,
      hook_strength: 91,
      payoff_score: 79,
      context_needed: 20,
      retention_risk: 28,
      edit_difficulty: 42,
      recommendation: "needs_recut",
      recut_suggestion: "Začni až vetou s názorom a ukonči po reakcii."
    });

    const payload = clipIdeaInsertPayload("video-1", candidate!, "test");

    expect(payload).toMatchObject({
      video_id: "video-1",
      title: "To je dosť tvrdý názor",
      score: 86,
      raw_data: {
        source: "test",
        moment_finder_version: "v2.1",
        moment_v2: {
          attention_score: 88,
          recommendation: "needs_recut",
          recut_suggestion: "Začni až vetou s názorom a ukonči po reakcii."
        }
      }
    });
    expect(payload).not.toHaveProperty("attention_score");
    expect(payload).not.toHaveProperty("recommendation");
  });

  it("extracts the exact transcript quote overlapping a selected timestamp", () => {
    const quote = extractSourceQuote(
      [
        { start: 10, end: 15, text: "Najprv sme riešili manažérov." },
        { start: 16, end: 21, text: "Potom Ferrari vôbec nechcelo naštartovať." },
        { start: 22, end: 26, text: "Všetci sa začali smiať." }
      ],
      16,
      26
    );

    expect(quote).toBe("Potom Ferrari vôbec nechcelo naštartovať. Všetci sa začali smiať.");
  });

  it("moves unsupported metadata to the nearby timestamp where its quote appears", () => {
    const candidate = normalizeClipCandidate({
      title: "Naštartovanie Ferrari",
      start_time: "00:00:10",
      end_time: "00:00:35",
      score: 87,
      reason: "Ferrari nejde naštartovať.",
      hook: "Ferrari vôbec nechcelo chytiť.",
      caption: "Keď Ferrari odmietne štartovať.",
      difficulty: "easy",
      clip_type: "funny",
      attention_score: 90,
      emotion_spike: 80,
      hook_strength: 88,
      payoff_score: 82,
      context_needed: 20,
      retention_risk: 24,
      edit_difficulty: 30,
      recommendation: "export",
      recut_suggestion: "Začni pri Ferrari a skonči po reakcii."
    })!;

    const grounded = groundClipCandidate(candidate, [
      { start: 10, end: 18, text: "Tu ešte hovoríme o manažéroch a procese." },
      { start: 42, end: 49, text: "Sadol som do Ferrari a ono vôbec nechcelo naštartovať." },
      { start: 50, end: 57, text: "Potom sa všetci začali smiať, lebo to bolo absurdné." }
    ]);

    expect(grounded.start_time).toBe(42);
    expect(grounded.end_time).toBe(57);
    expect(grounded.source_quote).toContain("Ferrari");
    expect(grounded.title).toBe("Naštartovanie Ferrari");
  });

  it("rewrites and demotes unsupported metadata when no matching quote exists", () => {
    const candidate = normalizeClipCandidate({
      title: "Naštartovanie Ferrari",
      start_time: "00:00:10",
      end_time: "00:00:35",
      score: 87,
      reason: "Ferrari nejde naštartovať.",
      hook: "Ferrari vôbec nechcelo chytiť.",
      caption: "Keď Ferrari odmietne štartovať.",
      difficulty: "easy",
      clip_type: "funny",
      recommendation: "export"
    })!;

    const grounded = groundClipCandidate(candidate, [
      { start: 10, end: 18, text: "Tu ešte hovoríme o manažéroch a ich rozhodovaní." },
      { start: 19, end: 30, text: "Dôležité je, kto berie zodpovednosť v tíme." }
    ]);

    expect(grounded.start_time).toBe(10);
    expect(grounded.source_quote).toContain("manažéroch");
    expect(grounded.title).not.toContain("Ferrari");
    expect(grounded.recommendation).toBe("maybe");
  });

  it("trims grounded final moments to the first strong sentence and a natural payoff", () => {
    const candidate = normalizeClipCandidate({
      title: "Klient zahodil zmluvu",
      start_time: "00:00:00",
      end_time: "00:00:50",
      score: 91,
      reason: "Silny konflikt s jasnou reakciou.",
      hook: "Klient povedal, ze zmluvu jednoducho zahodi.",
      caption: "Ked klient zahodi zmluvu, miestnost stichne.",
      difficulty: "easy",
      clip_type: "story",
      attention_score: 92,
      emotion_spike: 86,
      hook_strength: 91,
      payoff_score: 88,
      context_needed: 18,
      retention_risk: 20,
      edit_difficulty: 24,
      recommendation: "export",
      recut_suggestion: ""
    })!;
    const transcript = [
      { start: 0, end: 6, text: "Ahojte, vitajte, dnes sa budeme rozpravat o zakulisi projektu." },
      { start: 7, end: 14, text: "Najprv len rychly kontext o nasom time a procese." },
      { start: 15, end: 23, text: "Potom mi klient povedal, ze zmluvu jednoducho zahodi." },
      { start: 24, end: 34, text: "A ja som mu povedal, ze takto sa biznis nerobi." },
      { start: 35, end: 42, text: "Vtedy nastalo uplne ticho a vsetci sa zacali smiat." },
      { start: 43, end: 50, text: "Takze dakujem za pozornost a odoberajte kanal." }
    ];

    const refined = refineFinalMomentTiming(candidate, transcript);

    expect(refined.start_time).toBe(15);
    expect(refined.end_time).toBe(42);
    expect(refined.source_quote).toBe(
      "Potom mi klient povedal, ze zmluvu jednoducho zahodi. A ja som mu povedal, ze takto sa biznis nerobi. Vtedy nastalo uplne ticho a vsetci sa zacali smiat."
    );
    expect(refined.title).toBe("Klient zahodil zmluvu");
  });
});
