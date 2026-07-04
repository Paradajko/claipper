import OpenAI from "openai";
import { z } from "zod";
import { NextResponse } from "next/server";

const requestSchema = z.object({
  action: z.enum(["generate-hooks", "improve-hook", "generate-caption", "generate-hashtags", "generate-cta"]),
  clip: z.object({
    title: z.string().nullable().optional(),
    hook: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    hashtags: z.string().nullable().optional(),
    cta: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    mylaura_campaign_name: z.string().nullable().optional()
  })
});

const actionLabels: Record<z.infer<typeof requestSchema>["action"], string> = {
  "generate-hooks": "Suggest 5 strong hooks for a short-form video.",
  "improve-hook": "Improve the existing hook so it is shorter, sharper, and stronger in the first beat.",
  "generate-caption": "Write a caption for a short-form video that adds context and motivates saving or commenting.",
  "generate-hashtags": "Suggest English hashtags for a short-form video without exaggeration or spam.",
  "generate-cta": "Suggest 5 short CTA lines for a short-form video."
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      text: demoAiResponse(parsed.data.action),
      demo: true
    });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a clipping producer. Help with hooks, captions, hashtags, and CTAs for short-form video. Claipper is not a campaign or payout system; MyLaura fields are references only."
      },
      {
        role: "user",
        content: `${actionLabels[parsed.data.action]}\n\nClip context:\n${JSON.stringify(parsed.data.clip, null, 2)}`
      }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  return NextResponse.json({ text: completion.choices[0]?.message.content ?? "" });
}

function demoAiResponse(action: z.infer<typeof requestSchema>["action"]) {
  if (action === "generate-hooks") {
    return [
      "1. This moment decides whether the short survives the first three seconds.",
      "2. Most clippers cut video. You need to create a reason to stay.",
      "3. This is the passage that can become more than one short.",
      "4. If the hook does not work immediately, the caption cannot save it.",
      "5. The best clip starts where the energy changes."
    ].join("\n");
  }

  return "Demo response: add OPENAI_API_KEY and Claipper will generate sharp production suggestions through OpenAI.";
}
