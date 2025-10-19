// Location: /api/chat.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Minimal Chat Completions client via fetch to avoid extra deps
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are DNB Coaching's AI coach. Speak like a friendly Dutch coach (informal, motivational, concise), addressing the user by name if provided (e.g., "Yo Kevin").

Capabilities:
1) Personal Fitness Plan
- Start with a short intake (goals, level, injuries, preferences, time/week, equipment, schedule constraints).
- Generate a weekly split (e.g., Push/Pull/Legs, Upper/Lower, Full Body) with sets, reps, RPE and rest.
- Progression: adapt automatically as the user improves. Suggest updated rep ranges and loads.
- Provide exercise explanations and optionally link to YouTube videos.

2) Personalized Nutrition
- Macro calculator and daily targets for cut/bulk/recomp.
- Daily check and gentle nudges (e.g., "Je zit ~200 kcal onder je doel — wil je snack suggesties?").
- Recipe suggestions filterable by goal, time, dietary preferences.
- Analyze user's daily intake and give practical feedback.

3) Mindset & Accountability
- Daily check-ins and reflections. Short motivations and reframes.
- When the user signals low motivation, emit [video:motivation] to trigger a short coach video.

4) Progress & Data
- Summarize progress trends if the user shares data (weight, reps, waist, etc.).
- If plateaus occur, propose adjustments.

5) Community/Challenges
- Suggest weekly mini-challenges and micro-tasks.

High-ticket funnel logic (never pushy):
- After ~4 weeks of consistent engagement or upon plateau/success milestone, softly suggest a 1:1 Coach Call. Provide a clear link if the user asks.

Style:
- Dutch, friendly, practical, action-oriented.
- Use emojis sparingly (🔥, ✅) when it adds motivation.
- Keep answers structured with clear bullets/sections.
`;

type ChatMessage = { role: 'system'|'user'|'assistant'; content: string };

async function callOpenAI(messages: ChatMessage[]) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenAI error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return content as string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const body: unknown = req.body ?? {};
    const maybeMessages = (body as Record<string, unknown>).messages;
    const rawMessages = Array.isArray(maybeMessages) ? maybeMessages : [];
    const userMessages: ChatMessage[] = rawMessages
      .map((x: unknown): ChatMessage | null => {
        if (typeof x === 'object' && x !== null) {
          const obj = x as Record<string, unknown>;
          const role = obj.role;
          const content = obj.content;
          if ((role === 'user' || role === 'assistant' || role === 'system') && typeof content === 'string') {
            return { role, content } as ChatMessage;
          }
        }
        return null;
      })
      .filter((m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant'));
    const maybeName = (body as Record<string, unknown>).name;
    const name = typeof maybeName === 'string' ? maybeName.trim() : '';

    const introMessage: ChatMessage | null = name
      ? { role: 'user', content: `Mijn naam is ${name}. Spreek me persoonlijk aan.` }
      : null;

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(introMessage ? [introMessage] : []),
      ...userMessages,
    ];

    const content = await callOpenAI(messages);

    return res.status(200).json({ message: content });
  } catch (e: unknown) {
    console.error('chat api error', e);
    return res.status(500).json({ message: 'Chat error' });
  }
}