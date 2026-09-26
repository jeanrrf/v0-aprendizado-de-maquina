import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob;
    
    if (!audioFile) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio recebido." }, { status: 400 });
    }

    const buffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: [
        {
          inlineData: {
            mimeType: audioFile.type,
            data: base64Audio,
          },
        },
        { text: "Transcreva este áudio com precisão, mantendo a pontuação e o tom." }
      ],
    });

    const transcription = response.text || "";
    
    return NextResponse.json({ text: transcription });
  } catch (err: any) {
    console.error("Transcription Error:", err);
    return NextResponse.json({ error: err.message || "Erro na transcrição." }, { status: 500 });
  }
}
