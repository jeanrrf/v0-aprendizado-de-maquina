import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server, path: "/api/live" });

  wss.on("connection", async (clientWs) => {
    console.log("Live API: Client connected");
    let session: any = null;

    try {
      session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "Você é o AINEX em modo Voz Live. Seja assertivo, técnico e amigável.",
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              clientWs.send(JSON.stringify({ 
                audio: message.serverContent.modelTurn.parts[0].inlineData.data 
              }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio && session) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (err) {
          console.error("Live API WS message error:", err);
        }
      });

      clientWs.on("close", () => {
        console.log("Live API: Client disconnected");
        if (session) {
          // session close logic if needed
        }
      });
    } catch (err) {
      console.error("Live API session error:", err);
      clientWs.close();
    }
  });

  server.listen(3000, () => {
    console.log("> Ready on http://localhost:3000");
  });
});
