import { Message } from "ai";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ElevenLabsClient } from "elevenlabs";

const elevenlabs = new ElevenLabsClient();
const openai = new OpenAI();

type TextToSpeechEngine = "deepgram" | "whisper" | "elevenLabs";

const defaultVoices: Record<TextToSpeechEngine, string> = {
  deepgram: "aura-asteria-en",
  whisper: "whisper-alloy",
  elevenLabs: "elevenLabs-Rachel",
};

async function convertTextToSpeech(
  text: string,
  voice: string,
): Promise<Buffer | globalThis.ReadableStream<Uint8Array> | null> {
  voice = defaultVoices[voice as TextToSpeechEngine] ?? voice;

  if (voice.startsWith('aura-')) {
    return deepgram(text, voice);
  } else if (voice.startsWith('whisper-')) {
    return whisper(text, voice.replace("whisper-", "") as OpenAIVoice);
  } else if (voice.startsWith('elevenLabs-')) {
    return elevenLabs(text, voice.replace("elevenLabs-", ""));
  } else {
    throw new Error(`Invalid voice: ${voice}`);
  }
}

async function deepgram(
  text: string,
  voice: string,
): Promise<Buffer | globalThis.ReadableStream<Uint8Array> | null> {
  const response = await fetch(
    `${process.env.DEEPGRAM_STT_DOMAIN}/v1/speak?model=${voice}`,
    {
      method: "POST",
      body: JSON.stringify({ text }),
      headers: {
        "Content-Type": `application/json`,
        Authorization: `token ${process.env.DEEPGRAM_API_KEY || ""}`,
        // "X-DG-Referrer": url,
      },
    }
  );

  return response.body;
}

type OpenAIVoice = OpenAI.Audio.Speech.SpeechCreateParams["voice"];

async function whisper(
  text: string,
  voice: OpenAIVoice,
): Promise<Buffer | globalThis.ReadableStream<Uint8Array> | null> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
  });

  return response.body ? Buffer.from(await response.arrayBuffer()) : null;
}

async function elevenLabs(
  text: string,
  voice: string,
): Promise<Buffer | globalThis.ReadableStream<Uint8Array> | null> {
  const audio = await elevenlabs.generate({
    voice,
    text,
    model_id: "eleven_multilingual_v2"
  });

  if (!audio) {
    return null;
  }

  const chunks: any[] = [];

  for await (const chunk of audio) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Return a stream from the API
 * @param {NextRequest} req - The HTTP request
 * @returns {Promise<NextResponse>} A NextResponse with the streamable response
 */
export async function POST(req: NextRequest) {
  // gotta use the request object to invalidate the cache every request :vomit:
  const url = req.url;
  const model = req.nextUrl.searchParams.get("model") ?? "aura-asteria-en";
  const message: Message = await req.json();

  let text = message.content;

  text = text
    .replaceAll("¡", "")
    .replaceAll("https://", "")
    .replaceAll("http://", "")
    .replaceAll(".com", " dot com")
    .replaceAll(".org", " dot org")
    .replaceAll(".co.uk", " dot co dot UK")
    .replaceAll(/```[\s\S]*?```/g, "\nAs shown on the app.\n")
    .replaceAll(
      /([a-zA-Z0-9])\/([a-zA-Z0-9])/g,
      (match, precedingText, followingText) => {
        return precedingText + " forward slash " + followingText;
      }
    );

  const start = Date.now();

  try {
    const buffer = await convertTextToSpeech(text, model);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mp3",
        "X-DG-Latency": `${Date.now() - start}`,
      }
    });
  } catch (error: any) {
    console.error(error || error?.message);

    return new NextResponse(error || error?.message, { status: 500 });
  }
}
