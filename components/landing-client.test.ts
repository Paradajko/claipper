import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MyLaura x Claipper landing cards", () => {
  const source = readFileSync("components/landing-client.tsx", "utf8");
  const heroSource = readFileSync("components/hero.tsx", "utf8");

  it("uses the simplified clip production structure for the Claipper card", () => {
    expect(source).toContain("Clip production workspace");
    expect(source).toContain("moment scanning");
    expect(source).toContain("clip ideas");
    expect(source).toContain("hooks & captions");
    expect(source).toContain("ready-to-edit outputs");
    expect(source).toContain("Long video becomes short clips");

    expect(source).not.toContain("Clips ready from Laura&apos;s brief");
    expect(source).not.toContain("Laura brief received");
    expect(source).not.toContain("clips ready</p>");
  });

  it("uses the requested public landing navigation and CTA copy", () => {
    expect(source).toContain('href="#how-it-works"');
    expect(source).toContain('href="#mylaura"');
    expect(source).toContain('href="/app"');
    expect(source).toContain("Open App");
    expect(source).not.toContain("Get Clips");

    expect(heroSource).toContain("Find Moments");
    expect(heroSource).toContain("See Workflow");
    expect(heroSource).toContain("from-emerald-300");
    expect(heroSource).toContain("to-green-400");
    expect(source).toContain("md:hidden");
    expect(source).toContain("hidden md:flex");
  });

  it("uses a swipeable connected MyLaura pair on mobile without squeezing the cards", () => {
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("snap-x");
    expect(source).toContain("snap-mandatory");
    expect(source).toContain("snap-start");
    expect(source).toContain("min-w-[84vw]");
    expect(source).toContain("[scrollbar-width:none]");
    expect(source).toContain("[&::-webkit-scrollbar]:hidden");
    expect(source).toContain("Swipe from context");
    expect(source).toContain("to clips");
    expect(source).toContain("const [myLauraSlide, setMyLauraSlide] = useState<\"context\" | \"clips\">(\"context\");");
    expect(source).toContain("handleMyLauraCarouselScroll");
    expect(source).toContain("CONTEXT");
    expect(source).toContain("CLIPS");
    expect(source).toContain("aria-hidden=\"true\"");
    expect(source).toContain('myLauraSlide === "context"');
    expect(source).toContain('myLauraSlide === "clips"');
    expect(source).toContain("hidden items-stretch gap-5 lg:grid lg:grid-cols-[1fr_auto_1fr]");
    expect(source).not.toContain("grid grid-cols-2 items-stretch");
  });

  it("keeps the mobile hero video sequence linear and synced to the mobile timeline", () => {
    expect(heroSource).toContain("const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);");
    expect(heroSource).toContain("videoRefs.current.forEach((video, index) => {");
    expect(heroSource).toContain("preload=\"auto\"");
    expect(heroSource).toContain("video.currentTime = 0");
    expect(heroSource).toContain("pause()");
    expect(heroSource).toContain("HERO_VIDEOS.map((src, index) => (");
    expect(heroSource).toContain("animate={{ opacity: index === activeIndex ? 1 : 0 }}");
    expect(heroSource).toContain("mobileTimelineDots = [24, 58, 82] as const");
    expect(heroSource).toContain("top-[8px]");
    expect(heroSource).toContain("grid-cols-[0.92fr_1fr]");
    expect(heroSource).not.toContain("function HeroVideoLayer");
    expect(heroSource).not.toContain("incomingIndex");
    expect(heroSource).not.toContain("[18, 43, 58, 82].map");
  });

  it("adds the product-led landing page sections below the workflow", () => {
    for (const workflowTitle of ["Scan the footage", "Create clip drafts", "Shape the angle", "Track performance"]) {
      expect(source).toContain(`title: "${workflowTitle}"`);
    }

    expect(source).toContain("How much");
    expect(heroSource).toContain("Find the best moments in long videos without watching the whole thing");
    expect(source).toContain("Find the best moments in long videos without watching the whole thing");
    expect(source).toContain('className="text-emerald-400">time</span>');
    expect(source).toContain("do you waste before the edit even starts?");
    expect(source).toContain("Videos per week");
    expect(source).toContain("Review time per video");
    expect(source).toContain("manualMonthlyHours");
    expect(source).toContain("claipperMonthlyHours");
    expect(source).toContain("savedMonthlyHours");
    expect(source).toContain("draftsPreparedPerMonth");
    expect(source).toContain("momentsReviewedPerMonth");
    expect(source).toContain("draftsPreparedPerMonth = videosPerWeek * 4");
    expect(source).toContain("momentsReviewedPerMonth = videosPerWeek * 4 * 3");
    expect(source).toContain("Manual review");
    expect(source).toContain("With Claipper");
    expect(source).toContain("Time saved");
    expect(source).toContain("Review workload breakdown");
    expect(source).toContain("Scrubbing footage");
    expect(source).toContain("Writing timestamps");
    expect(source).toContain("First hook pass");
    expect(source).toContain("Claipper reduces the slow review layer before the creative edit starts.");
    expect(source).toContain("3.3x faster review");
    expect(source).toContain('type="range"');
    expect(source).toContain("Estimated from reducing manual review time by roughly 70%. Actual results depend on video type and review depth.");
    expect(source).not.toContain("How long is one video?");
    expect(source).not.toContain("Avg");
    expect(heroSource).toContain("MobileHeroVisual");
    expect(heroSource).toContain("md:hidden");
    expect(heroSource).toContain("hidden md:block");
    expect(source).toContain("md:hidden");
    expect(source).toContain("01");
    expect(source).toContain("02");
    expect(source).toContain("03");
    expect(source).toContain("04");

    expect(source).toContain('"/clips/streamer.mp4"');
    expect(source).toContain('"/clips/motivator.mp4"');
    expect(source).toContain('"/clips/podcast.mp4"');
    expect(source).toContain("loop");
    expect(source).toContain("playsInline");
    expect(source).not.toContain("One video can become a full content week.");
    expect(source).not.toContain("CONTENT MULTIPLIER");
    expect(source).not.toContain("ContentMultiplierMockup");
    expect(source).not.toContain("SOURCE VIDEO");
    expect(source).not.toContain("Podcast episode / campaign video");
    expect(source).not.toContain("CONTENT WEEK");
    expect(source).not.toContain("From long video to ready-to-review clips.");
    expect(source).not.toContain("Stop managing clipping in notes and timelines.");
    expect(source).not.toContain("AI does the heavy lifting.");
    expect(source).not.toContain("One workspace for every clip.");
    expect(source).not.toContain("Not just moments. Ready-to-review clip drafts.");
    expect(source).not.toContain("Built for people who actually make clips.");
  });

  it("keeps the product-led redesign away from disallowed reference patterns", () => {
    expect(source).not.toContain("live chat");
    expect(source).not.toContain("Manual vs ClipMe");
    expect(source).not.toContain("Competitor");
    expect(source).not.toContain("bg-rose");
    expect(source).not.toContain("bg-pink");
    expect(source).not.toContain("fake browser");
  });

  it("keeps the reduced post-workflow landing structure focused", () => {
    expect(source).toContain('eyebrow="TIME SAVED"');
    expect(source).not.toContain('eyebrow="CONTENT MULTIPLIER"');
    expect(source).not.toContain("Workflow comparison");
    expect(source).not.toContain("Human control");
    expect(source).not.toContain('eyebrow="Workspace"');
  });

  it("uses the green Claipper identity without cyan or blue styling", () => {
    const landingSources = [
      source,
      heroSource,
      readFileSync("components/hero-phone.tsx", "utf8"),
      readFileSync("components/ai-scanner-panel.tsx", "utf8")
    ].join("\n");

    expect(landingSources).not.toContain("cyan");
    expect(landingSources).not.toContain("blue");
    expect(landingSources).not.toContain("sky");
    expect(landingSources).not.toContain("34,211,238");
    expect(landingSources).not.toContain("103 232 249");
  });

  it("keeps the Claipper card benefit icons green", () => {
    expect(source).toContain("text-emerald-300");
    expect(source).not.toContain('Icon className="h-4 w-4 text-cyan-300"');
  });

  it("uses the cropped MyLaura logo asset so left alignment is real", () => {
    expect(source).toContain('src="/images/my-laura-logo-dark-bg.png"');
    expect(source).toContain("width={577}");
    expect(source).toContain("height={176}");
    expect(source).not.toContain("width={1304}");
  });

  it("renders the MyLaura logo at the same visual scale as the Claipper logo", () => {
    expect(source).toContain('sizes="260px"');
    expect(source).toContain("w-[min(260px,100%)]");
  });
});
