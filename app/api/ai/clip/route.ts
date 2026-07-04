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
  "generate-hooks": "Navrhni 5 silných slovenských hookov pre krátke video.",
  "improve-hook": "Vylepši existujúci hook tak, aby bol kratší, konkrétnejší a mal lepší prvý úder.",
  "generate-caption": "Napíš slovenský caption pre short, ktorý pridá kontext a motivuje k uloženiu alebo komentáru.",
  "generate-hashtags": "Navrhni slovenské a anglické hashtagy pre short, bez preháňania a bez spam efektu.",
  "generate-cta": "Navrhni 5 krátkych CTA viet pre short."
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná požiadavka." }, { status: 400 });
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
          "Si slovenský clipping producer. Pomáhaš s hookmi, captionmi, hashtagmi a CTA pre short-form video. Claipper nie je kampaňový ani payout systém; MyLaura polia sú len referencie."
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
      "1. Tento moment rozhodne, či short prežije prvé tri sekundy.",
      "2. Väčšina clipperov strihá video. Ty potrebuješ vyrobiť dôvod zostať.",
      "3. Toto je pasáž, z ktorej vznikne viac než jeden short.",
      "4. Ak hook nepracuje okamžite, caption ho už nezachráni.",
      "5. Najlepší clip začína tam, kde sa mení energia."
    ].join("\n");
  }

  return "Demo odpoveď: doplň OPENAI_API_KEY a Claipper bude generovať ostré slovenské návrhy priamo cez OpenAI.";
}
