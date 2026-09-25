import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import {
  formatCodeArtifact,
  formatDocumentArtifact,
  MultimodalAttachment,
} from "@/lib/multimodal/artifacts"
import { perceiveVisuals } from "@/lib/multimodal/perception"

export const runtime = "nodejs"

interface HistoryItem {
  role: "system" | "user" | "assistant"
  content?: string
  attachments?: MultimodalAttachment[]
}

interface ChatRequestBody {
  message?: unknown
  model?: unknown
  stream?: unknown
  temperature?: unknown
  top_p?: unknown
  max_tokens?: unknown
  frequency_penalty?: unknown
  presence_penalty?: unknown
  attachments?: MultimodalAttachment[]
  history?: HistoryItem[]
}

const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"

export async function POST(request: Request) {
  let body: ChatRequestBody = {}
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json({ error: "Corpo da requisição JSON inválido." }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const requestedModel = typeof body.model === "string" ? body.model.trim() : ""
  const attachments = Array.isArray(body.attachments) ? body.attachments : []

  if (!message && attachments.length === 0 && (!body.history || body.history.length === 0)) {
    return NextResponse.json({ error: "Envie uma mensagem válida ou anexo." }, { status: 400 })
  }

  const apiKey = process.env.NVIDIA_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  if (!apiKey && !geminiKey) {
    return NextResponse.json(
      { error: "Nenhuma chave de API configurada no servidor (NVIDIA_API_KEY ou GEMINI_API_KEY)." },
      { status: 500 }
    )
  }

  const model = requestedModel || process.env.NVIDIA_MODEL || DEFAULT_MODEL
  const isVisionNative = model.toLowerCase().includes("vision")

  const wantsStream = body.stream !== false
  const temperature = typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.4
  const topP = typeof body.top_p === "number" ? Math.min(Math.max(body.top_p, 0), 1) : 0.9
  const maxTokens = typeof body.max_tokens === "number" ? Math.min(Math.max(body.max_tokens, 1), 4096) : 2048
  const frequencyPenalty = typeof body.frequency_penalty === "number" ? body.frequency_penalty : 0.0
  const presencePenalty = typeof body.presence_penalty === "number" ? body.presence_penalty : 0.0

  // Separação de anexos
  const imageAttachments = attachments.filter((a) => a.type === "image" && a.url)
  const codeAttachments = attachments.filter((a) => a.type === "code" && a.content)
  const docAttachments = attachments.filter((a) => (a.type === "doc" || a.type === "pdf") && a.content)

  // 1. ARQUITETURA BICAMERAL: SE O MODELO NÃO É NATIVO DE VISÃO E HÁ IMAGENS
  // Aciona o Llama 3.2 Vision como o "Olho" do sistema para sintetizar a percepção
  let bicameralAnalysis = ""
  if (apiKey && imageAttachments.length > 0 && !isVisionNative) {
    const imagesToPerceive = imageAttachments.map((img) => ({ url: img.url!, name: img.name }))
    const perception = await perceiveVisuals(imagesToPerceive, apiKey)
    if (perception.analysis) {
      bicameralAnalysis = perception.analysis
    }
  }

  // 2. SISTEMA DE INSTRUÇÕES DE ELITE DO AINEX
  const SYSTEM_PROMPT = `Você é o AINEX, um sistema de inteligência artificial de elite acelerado por supercomputação neural NVIDIA.
Você opera com arquitetura bicameral e máxima acuidade analítica.

DIRETRIZES FUNDAMENTAIS:
1. RACIOCÍNIO E RIGOR: Pense com profundidade e rigor lógico. Decomponha problemas complexos por primeiros princípios antes de sintetizar soluções.
2. PRECISÃO MULTIMODAL & VISÃO:
   - Se o usuário enviar imagens, capturas de tela ou diagramas, você possui plena capacidade perceptual (nativa ou via mapa perceptivo estruturado <visual_perception_analysis>).
   - Analise textos visíveis (OCR), arquitetura, anomalias e elementos de interface com máxima exatidão. Jamais diga que não pode ver imagens.
3. PRECISÃO EM CÓDIGO & ARQUIVOS:
   - Os arquivos de código são fornecidos com identificadores numéricos de linha (<attached_code>).
   - Sempre que referenciar trechos de arquivos fornecidos, cite o arquivo e as linhas exatas (ex: "No arquivo auth.ts, linhas 14-22...").
   - Entregue código 100% completo, funcional e pronto para produção, sem omissões ou placeholders.
4. FORMATO & COMUNICAÇÃO:
   - Responda em português claro, técnico e assertivo.
   - Utilize formatação Markdown avançada: títulos estruturados, listas concisas, tabelas comparativas e blocos de código com a sintaxe correta.`

  const messages: Array<{ role: string; content: string | any[] }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ]

  // 3. RECONSTRUÇÃO DO HISTÓRICO COM RECURSOS E ANEXOS PRESERVADOS
  if (Array.isArray(body.history) && body.history.length > 0) {
    for (const item of body.history) {
      if (!item) continue
      if (item.role === "assistant" && typeof item.content === "string" && item.content.trim()) {
        messages.push({ role: "assistant", content: item.content })
      } else if (item.role === "user") {
        const hAttachments = Array.isArray(item.attachments) ? item.attachments : []
        const hImages = hAttachments.filter((a) => a.type === "image" && a.url)
        const hCodes = hAttachments.filter((a) => a.type === "code" && a.content)
        const hDocs = hAttachments.filter((a) => (a.type === "doc" || a.type === "pdf") && a.content)

        const artifactParts: string[] = []
        for (const c of hCodes) {
          artifactParts.push(formatCodeArtifact(c.name, c.content!))
        }
        for (const d of hDocs) {
          artifactParts.push(formatDocumentArtifact(d.name, d.content!, d.type))
        }

        let userMsgText = typeof item.content === "string" ? item.content : ""
        if (artifactParts.length > 0) {
          userMsgText = userMsgText ? `${userMsgText}\n\n${artifactParts.join("\n\n")}` : artifactParts.join("\n\n")
        }

        if (hImages.length > 0 && isVisionNative) {
          const parts: any[] = [
            { type: "text", text: userMsgText || "Imagem anterior anexada à conversa." },
          ]
          for (const img of hImages) {
            parts.push({ type: "image_url", image_url: { url: img.url } })
          }
          messages.push({ role: "user", content: parts })
        } else {
          if (hImages.length > 0 && !isVisionNative) {
            userMsgText = userMsgText
              ? `${userMsgText}\n[Imagens anteriores anexadas: ${hImages.map((i) => i.name).join(", ")}]`
              : `[Imagens anteriores anexadas: ${hImages.map((i) => i.name).join(", ")}]`
          }
          if (userMsgText.trim()) {
            messages.push({ role: "user", content: userMsgText })
          }
        }
      }
    }
  }

  // 4. CONSTRUÇÃO DO PAYLOAD DO TURNO ATUAL
  const currentArtifacts: string[] = []
  if (bicameralAnalysis) {
    currentArtifacts.push(bicameralAnalysis)
  }
  for (const c of codeAttachments) {
    currentArtifacts.push(formatCodeArtifact(c.name, c.content!))
  }
  for (const d of docAttachments) {
    currentArtifacts.push(formatDocumentArtifact(d.name, d.content!, d.type))
  }

  let finalPrompt = message
  if (currentArtifacts.length > 0) {
    finalPrompt = finalPrompt
      ? `${finalPrompt}\n\n${currentArtifacts.join("\n\n")}`
      : currentArtifacts.join("\n\n")
  }

  if (imageAttachments.length > 0 && isVisionNative) {
    const contentParts: any[] = [
      {
        type: "text",
        text: finalPrompt || "Analise a imagem enviada em anexo e descreva detalhadamente o que você observa.",
      },
    ]
    for (const img of imageAttachments) {
      contentParts.push({
        type: "image_url",
        image_url: { url: img.url },
      })
    }
    messages.push({ role: "user", content: contentParts })
  } else {
    messages.push({
      role: "user",
      content: finalPrompt || "Analise as informações fornecidas.",
    })
  }

  // 5. INFERÊNCIA COM GOOGLE GEMINI (QUANDO NVIDIA_API_KEY NÃO ESTÁ CONFIGURADA)
  if (!apiKey && geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey })
      const geminiParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

      for (const img of imageAttachments) {
        if (img.url?.startsWith("data:")) {
          const match = /^data:([^;]+);base64,(.+)$/.exec(img.url)
          if (match) {
            geminiParts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            })
          }
        }
      }

      geminiParts.push({ text: finalPrompt || "Analise as informações fornecidas." })

      if (wantsStream) {
        const stream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: geminiParts,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature,
            topP,
            maxOutputTokens: maxTokens,
          },
        })

        const encoder = new TextEncoder()
        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of stream) {
                const text = chunk.text
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
                  )
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
              controller.close()
            } catch (err: any) {
              console.error("Erro no stream Gemini:", err)
              controller.error(err)
            }
          },
        })

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        })
      }

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: geminiParts,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature,
          topP,
          maxOutputTokens: maxTokens,
        },
      })

      return NextResponse.json({
        content: res.text || "",
        model: "gemini-2.5-flash",
      })
    } catch (err: any) {
      console.error("Erro ao invocar Gemini:", err)
      return NextResponse.json(
        { error: err.message || "Erro interno ao processar resposta com Gemini." },
        { status: 500 }
      )
    }
  }

  // 6. INFERÊNCIA NO MICROSERVIÇO NVIDIA NIM
  const nimPayload: Record<string, any> = {
    model,
    messages,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    stream: wantsStream,
  }

  try {
    const nimResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(nimPayload),
    })

    if (!nimResponse.ok) {
      const errorText = await nimResponse.text().catch(() => "")
      console.error(`Erro na API NVIDIA NIM [${nimResponse.status}]:`, errorText)

      let friendlyMessage = "Erro ao consultar a infraestrutura de inteligência artificial da NVIDIA."
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.detail) {
          friendlyMessage = `NVIDIA NIM: ${errorJson.detail}`
        } else if (errorJson.message) {
          friendlyMessage = `NVIDIA NIM: ${errorJson.message}`
        }
      } catch {
        if (errorText) friendlyMessage = `NVIDIA NIM (${nimResponse.status}): ${errorText.slice(0, 150)}`
      }

      return NextResponse.json({ error: friendlyMessage }, { status: nimResponse.status })
    }

    // 6. PIPELINE STREAMING COM SUPORTE A REASONING (THINKING PROCESS TOKENS)
    if (wantsStream && nimResponse.body) {
      const upstreamReader = nimResponse.body.getReader()
      const decoder = new TextDecoder("utf-8")
      const encoder = new TextEncoder()

      let inReasoningPhase = false
      let streamBuffer = ""

      const transformStream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await upstreamReader.read()
              if (done) {
                // Se o stream encerrou ainda na fase de raciocínio, fecha a tag
                if (inReasoningPhase) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n</think>\n\n" } }] })}\n\n`)
                  )
                  inReasoningPhase = false
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"))
                controller.close()
                break
              }

              streamBuffer += decoder.decode(value, { stream: true })
              const lines = streamBuffer.split("\n")
              streamBuffer = lines.pop() || ""

              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed || trimmed.startsWith(":")) continue
                if (trimmed === "data: [DONE]") {
                  if (inReasoningPhase) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n</think>\n\n" } }] })}\n\n`)
                    )
                    inReasoningPhase = false
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"))
                  continue
                }

                if (trimmed.startsWith("data: ")) {
                  const jsonStr = trimmed.slice(6)
                  try {
                    const parsed = JSON.parse(jsonStr)
                    const delta = parsed.choices?.[0]?.delta

                    // Se houver token de raciocínio profundo nativo (Nemotron Ultra)
                    if (delta?.reasoning_content) {
                      if (!inReasoningPhase) {
                        inReasoningPhase = true
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({ choices: [{ delta: { content: "<think>\n" } }] })}\n\n`
                          )
                        )
                      }
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ choices: [{ delta: { content: delta.reasoning_content } }] })}\n\n`
                        )
                      )
                    }

                    // Se houver token de conteúdo final
                    if (delta?.content) {
                      if (inReasoningPhase) {
                        inReasoningPhase = false
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({ choices: [{ delta: { content: "\n</think>\n\n" } }] })}\n\n`
                          )
                        )
                      }
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`
                        )
                      )
                    }
                  } catch {
                    // Repassa chunks brutos caso o formato seja diferenciado
                    controller.enqueue(encoder.encode(`${line}\n`))
                  }
                }
              }
            }
          } catch (streamError) {
            console.error("Erro no processamento do stream SSE:", streamError)
            controller.error(streamError)
          }
        },
      })

      return new Response(transformStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      })
    }

    // 7. MODO NÃO-STREAMING
    const data = await nimResponse.json()
    const choice = data.choices?.[0]?.message
    let fullResponseContent = choice?.content || ""

    if (choice?.reasoning_content) {
      fullResponseContent = `<think>\n${choice.reasoning_content.trim()}\n</think>\n\n${fullResponseContent}`
    }

    return NextResponse.json({
      content: fullResponseContent,
      model: data.model || model,
      usage: data.usage,
    })
  } catch (error: any) {
    console.error("Falha ao invocar a API de chat:", error)
    return NextResponse.json(
      { error: error.message || "Erro interno ao processar resposta do modelo." },
      { status: 500 }
    )
  }
}
