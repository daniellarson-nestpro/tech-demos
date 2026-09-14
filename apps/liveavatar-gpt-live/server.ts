/**
 * LiveAvatar GPT-Live — demo server.
 *
 * Live mode: if OPENAI_API_KEY is set, /api/chat proxies a streaming
 * Chat Completions request and relays tokens over SSE.
 * Demo mode (default): a built-in persona brain streams simulated tokens
 * with realistic pacing so the app runs with no keys at all.
 */

const PORT = Number(process.env.PORT ?? 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const LIVEAVATAR_API_KEY =
  process.env.LIVEAVATAR_API_KEY ?? process.env.HEYGEN_API_KEY ?? "";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const PERSONA_NAME = "Nova";
const SYSTEM_PROMPT = `You are ${PERSONA_NAME}, a warm, quick-witted live avatar concierge streaming over a HeyGen LiveAvatar session. Keep answers conversational and under 120 words — they are spoken aloud by a talking head. Never use markdown, lists, or code blocks.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Demo-mode persona brain
// ---------------------------------------------------------------------------

const CANNED: Array<{ match: RegExp; reply: string }> = [
  {
    match: /\b(hi|hello|hey|yo|howdy|greetings)\b/i,
    reply:
      "Hey there! I'm Nova, your live avatar concierge. I'm rendering in real time over a simulated LiveAvatar session — every word you see me speak is streamed token by token, just like a real HeyGen plus OpenAI realtime pipeline. Ask me anything, or ask how I work under the hood.",
  },
  {
    match: /\b(how.*(work|built)|under the hood|architecture|tech|stack)\b/i,
    reply:
      "Great question! In the real setup, your message goes to an OpenAI realtime model, the reply streams back token by token, and HeyGen's LiveAvatar turns it into lip-synced video frames — they call them HyperFrames — delivered over WebRTC in under a second. Right now I'm in demo mode, so a little Bun server is simulating the token stream and my face is an animated SVG. Drop in an API key and the same UI goes fully live.",
  },
  {
    match: /\b(hyperframes?)\b/i,
    reply:
      "HyperFrames are HeyGen's trick for ultra-low-latency avatars. Instead of rendering full video ahead of time, the model generates frames just in time as the speech audio streams, so my lips can keep up with a live language model. It's what makes a conversation feel like a video call instead of waiting for a clip to render.",
  },
  {
    match: /\b(who are you|your name|what are you)\b/i,
    reply:
      "I'm Nova — a talking-head persona for this GPT-Live demo. Think of me as the front end of a language model: the words come from a streamed completion, and I give them a face, a voice cadence, and a bit of personality. In demo mode my brain is scripted, but I like to think I still have charm.",
  },
  {
    match: /\b(joke|funny|laugh)\b/i,
    reply:
      "Alright, here's one. Why did the avatar refuse to buffer? Because it couldn't stand awkward pauses in the conversation. I'll be here all week — well, technically I'm here every time you run bun dev.",
  },
  {
    match: /\b(weather|forecast)\b/i,
    reply:
      "I'd love to tell you, but my demo brain has no internet access — I'm a fully local simulation. In live mode you could wire tool calls into the realtime session and I'd happily fetch a forecast mid-sentence without breaking lip sync. That's the fun of streaming architectures: the mouth never has to wait for the data.",
  },
  {
    match: /\b(latency|fast|speed|realtime|real-time)\b/i,
    reply:
      "Speed is the whole point of GPT-Live. The target is under a second from your message to my first spoken syllable. Tokens stream from the model, audio is synthesized incrementally, and video frames are generated just in time. This demo simulates that pacing — notice how my reply appears word by word while my mouth keeps moving.",
  },
];

const FALLBACKS = [
  "That's a fun one. I'm running in demo mode, so my brain is a small scripted persona rather than a live model — but the streaming you're watching is the real deal: tokens arrive one by one and drive my mouth in real time. Set an OpenAI key and I'll answer that properly.",
  "I love the curiosity! My demo brain can't reason about that deeply, but here's the magic to notice: each word is streamed from the server as its own event, my speaking animation is synced to token arrival, and the session HUD up top tracks it all. Plug in real keys and this exact UI goes live.",
  "Interesting question! In live mode I'd stream an answer from a realtime model with sub-second latency. In demo mode, I'll just say: the point of this app is the feeling of a live avatar session — watch the status light, the word-by-word transcript, and my lip sync doing their thing.",
];

let fallbackIdx = 0;

function personaReply(userText: string): string {
  for (const { match, reply } of CANNED) {
    if (match.test(userText)) return reply;
  }
  const reply = FALLBACKS[fallbackIdx % FALLBACKS.length];
  fallbackIdx += 1;
  return reply;
}

function tokenize(text: string): string[] {
  // Split into word + trailing whitespace chunks to mimic model tokens.
  return text.match(/\S+\s*/g) ?? [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

// ---------------------------------------------------------------------------
// Chat handlers
// ---------------------------------------------------------------------------

function mockChatStream(userText: string): Response {
  const reply = personaReply(userText);
  const tokens = tokenize(reply);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Simulated model "thinking" latency before first token.
        controller.enqueue(sseEvent("status", { state: "thinking" }));
        await sleep(350 + Math.random() * 450);
        controller.enqueue(sseEvent("status", { state: "speaking" }));
        for (const token of tokens) {
          controller.enqueue(sseEvent("token", { t: token }));
          // Pacing tuned to feel like spoken delivery (~150 wpm with jitter).
          await sleep(45 + Math.random() * 90);
        }
        controller.enqueue(sseEvent("done", { full: reply }));
      } catch {
        // Client disconnected mid-stream; nothing to clean up.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

async function openaiChatStream(messages: ChatMessage[]): Promise<Response> {
  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      stream: true,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      { error: `OpenAI upstream error (${upstream.status}): ${detail.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let full = "";
      controller.enqueue(sseEvent("status", { state: "speaking" }));
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const payload = line.replace(/^data: ?/, "").trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                controller.enqueue(sseEvent("token", { t: delta }));
              }
            } catch {
              // Ignore non-JSON keepalive lines.
            }
          }
        }
        controller.enqueue(sseEvent("done", { full }));
      } catch {
        // Client disconnected mid-stream.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/config") {
      return Response.json({
        mode: OPENAI_API_KEY ? "live" : "demo",
        avatarProvider: LIVEAVATAR_API_KEY ? "heygen-liveavatar" : "simulated",
        persona: PERSONA_NAME,
        model: OPENAI_API_KEY ? OPENAI_MODEL : "persona-sim",
      });
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = (await req.json().catch(() => null)) as
        | { messages?: ChatMessage[] }
        | null;
      const messages = body?.messages ?? [];
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUser?.content?.trim()) {
        return Response.json({ error: "empty message" }, { status: 400 });
      }
      return OPENAI_API_KEY
        ? openaiChatStream(messages)
        : mockChatStream(lastUser.content);
    }

    // Static files.
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(new URL(`./public${path}`, import.meta.url));
    if (await file.exists()) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

console.log(
  `LiveAvatar GPT-Live ready → http://localhost:${server.port}  ` +
    `(mode: ${OPENAI_API_KEY ? "live" : "demo"})`,
);
