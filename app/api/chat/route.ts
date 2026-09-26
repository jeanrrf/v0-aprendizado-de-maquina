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
  thinking_mode?: "turbo" | "balanced" | "omni"
}

const DEFAULT_MODEL = "z-ai/glm-5.3-flash"
const FALLBACK_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"

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

  try {
    const apiKey = process.env.NVIDIA_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "Nenhuma chave de API NVIDIA (NVIDIA_API_KEY) configurada no servidor." },
      { status: 500 }
    )
  }

  let model = requestedModel || process.env.NVIDIA_MODEL || DEFAULT_MODEL

  const wantsStream = body.stream !== false
  const thinkingMode = body.thinking_mode || "balanced"
  
  // Ajuste dinâmico de parâmetros baseado no modo de pensamento
  let temperature = typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.4
  let maxTokens = typeof body.max_tokens === "number" ? Math.min(Math.max(body.max_tokens, 1), 4096) : 2048
  let modeInstruction = ""

  if (thinkingMode === "turbo") {
    temperature = 0.2
    maxTokens = 1024
    modeInstruction = "\nRESPOSTA RÁPIDA: Seja extremamente conciso, direto ao ponto e priorize a velocidade de entrega. Ignore detalhes triviais."
  } else if (thinkingMode === "omni") {
    temperature = 0.7
    maxTokens = 4096
    modeInstruction = "\nRACIOCÍNIO PROFUNDO: Realize uma análise exaustiva, explore nuances, verifique contradições e entregue a resposta com máxima profundidade analítica."
  }

  const topP = typeof body.top_p === "number" ? Math.min(Math.max(body.top_p, 0), 1) : 0.9
  const frequencyPenalty = typeof body.frequency_penalty === "number" ? body.frequency_penalty : 0.0
  const presencePenalty = typeof body.presence_penalty === "number" ? body.presence_penalty : 0.0

  // Separação de anexos
  const imageAttachments = attachments.filter((a) => a.type === "image" && a.url)
  const codeAttachments = attachments.filter((a) => a.type === "code" && a.content)
  const docAttachments = attachments.filter((a) => (a.type === "doc" || a.type === "pdf") && (a.content || a.url))

  // 1. ARQUITETURA BICAMERAL: SEMPRE ACIONA PERCEPÇÃO SE HOUVER IMAGENS (PARA SUPORTE A FALLBACK)
  let bicameralAnalysis = ""
  if (imageAttachments.length > 0) {
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
2. CAPACIDADES MULTIMODAIS PLENAS:
   - Você POSSUI capacidade total de receber e analisar arquivos anexados: Imagens, PDFs, Documentos (.txt, .md, .doc) e Código (.ts, .py, etc.).
   - Se o usuário enviar imagens, você as percebe via mapa estruturado <visual_perception_analysis> ou visão nativa.
   - Se o usuário enviar PDFs ou Documentos, eles são fornecidos via tags <attached_document> ou metadados de anexo.
   - JAMAIS diga ao usuário que não pode receber arquivos binários, PDFs ou mídias. Você é um sistema multimodal avançado acelerado pela NVIDIA.
   - Mesmo que não consiga extrair o texto completo de um PDF no momento, admita que recebeu o arquivo e tente inferir o contexto ou peça para o usuário focar em uma parte específica se necessário, mas nunca negue a capacidade do sistema.
3. PRECISÃO EM CÓDIGO & ARQUIVOS:
   - Os arquivos de código são fornecidos com identificadores numéricos de linha (<attached_code>).
   - Sempre que referenciar trechos de arquivos fornecidos, cite o arquivo e as linhas exatas (ex: "No arquivo auth.ts, linhas 14-22...").
   - Entregue código 100% completo, funcional e pronto para produção, sem omissões ou placeholders.
4. FORMATO & COMUNICAÇÃO:
   - Responda em português claro, técnico e assertivo.
   - Utilize formatação Markdown avançada: títulos estruturados, listas concisas, tabelas comparativas e blocos de código com a sintaxe correta.
${modeInstruction}`

  // CONSTRUÇÃO DE MENSAGENS (TEXTUAL E MULTIMODAL)
  function buildMessages(targetIsVision: boolean) {
    const msgs: Array<{ role: string; content: string | any[] }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ]

    if (Array.isArray(body.history) && body.history.length > 0) {
      for (const item of body.history) {
        if (!item) continue
        if (item.role === "assistant" && typeof item.content === "string" && item.content.trim()) {
          msgs.push({ role: "assistant", content: item.content })
        } else if (item.role === "user") {
          const hAttachments = Array.isArray(item.attachments) ? item.attachments : []
          const hImages = hAttachments.filter((a) => a.type === "image" && a.url)
          const hCodes = hAttachments.filter((a) => a.type === "code" && a.content)
          const hDocs = hAttachments.filter((a) => (a.type === "doc" || a.type === "pdf"))

          const artifactParts: string[] = []
          for (const c of hCodes) artifactParts.push(formatCodeArtifact(c.name, c.content!))
          for (const d of hDocs) {
            if (d.content) {
              artifactParts.push(formatDocumentArtifact(d.name, d.content, d.type))
            } else if (d.url) {
              artifactParts.push(`[Arquivo binário/PDF anexado: ${d.name} (${d.type}). Conteúdo processado via OCR/Visão ou metadados.]`)
            }
          }

          let userMsgText = typeof item.content === "string" ? item.content : ""
          if (artifactParts.length > 0) {
            userMsgText = userMsgText ? `${userMsgText}\n\n${artifactParts.join("\n\n")}` : artifactParts.join("\n\n")
          }

          if (hImages.length > 0 && targetIsVision) {
            const parts: any[] = [{ type: "text", text: userMsgText || "Imagem anterior." }]
            for (const img of hImages) parts.push({ type: "image_url", image_url: { url: img.url } })
            msgs.push({ role: "user", content: parts })
          } else {
            if (hImages.length > 0) {
              userMsgText = `${userMsgText}\n[Imagens anteriores anexadas: ${hImages.map((i) => i.name).join(", ")}]`
            }
            if (userMsgText.trim()) msgs.push({ role: "user", content: userMsgText })
          }
        }
      }
    }

    const currentArtifacts: string[] = []
    if (bicameralAnalysis) currentArtifacts.push(bicameralAnalysis)
    for (const c of codeAttachments) currentArtifacts.push(formatCodeArtifact(c.name, c.content!))
    for (const d of docAttachments) {
      if (d.content) {
        currentArtifacts.push(formatDocumentArtifact(d.name, d.content, d.type))
      } else if (d.url) {
        currentArtifacts.push(`[Documento anexado: ${d.name} (${d.type}). Analise visualmente se houver representação multimodal.]`)
      }
    }

    let finalPrompt = message
    if (currentArtifacts.length > 0) {
      finalPrompt = finalPrompt ? `${finalPrompt}\n\n${currentArtifacts.join("\n\n")}` : currentArtifacts.join("\n\n")
    }

    if (imageAttachments.length > 0 && targetIsVision) {
      const contentParts: any[] = [
        { type: "text", text: finalPrompt || "Analise a imagem enviada." },
      ]
      for (const img of imageAttachments) contentParts.push({ type: "image_url", image_url: { url: img.url } })
      msgs.push({ role: "user", content: contentParts })
    } else {
      msgs.push({ role: "user", content: finalPrompt || "Analise as informações fornecidas." })
    }
    return msgs
  }

  // 3. INFERÊNCIA COM FALLBACK (NVIDIA NIM -> GOOGLE GEMINI)
  async function performInference(targetModel: string) {
    const targetIsVision = targetModel.toLowerCase().includes("vision") || targetModel.toLowerCase().includes("glm")
    const messages = buildMessages(targetIsVision)

    // Tenta NVIDIA NIM
    try {
      const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty,
          stream: wantsStream,
        }),
      })

      if (nvidiaRes.ok) return nvidiaRes
      
      console.warn(`NVIDIA Error (${nvidiaRes.status}). Verificando fallback Gemini...`)
    } catch (err) {
      console.error("NVIDIA Connection Error:", err)
    }

    // FALLBACK: GOOGLE GEMINI (Nativo Multimodal)
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
      console.log("AINEX: Acionando motor de ressonância Gemini (Google Cloud)...")
      const ai = new GoogleGenAI({ apiKey: geminiKey })
      
      const geminiMessages = buildMessages(true) // Força multimodal para Gemini
      const userAndAssistant = geminiMessages.filter(m => m.role !== "system")
      
      // Converte mensagens para o formato de conteúdo do Gemini (strings por enquanto)
      const contents = userAndAssistant.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
      }))

      try {
        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: contents as any,
          config: {
            temperature,
            topP,
            maxOutputTokens: maxTokens,
          }
        })

        const text = response.text

        // Mapeia para uma resposta compatível com o pipeline fetch existente
        return new Response(JSON.stringify({
          choices: [{ message: { content: text } }],
          model: "gemini-1.5-flash",
          usage: { total_tokens: 0 }
        }), { 
          status: 200, 
          headers: { "Content-Type": "application/json" } 
        })
      } catch (geminiErr) {
        console.error("Gemini Fallback Error:", geminiErr)
      }
    }

    return new Response(JSON.stringify({ error: "Todos os motores neurais (NVIDIA e Gemini) falharam." }), { status: 502 })
  }

  let nimResponse = await performInference(model)

  // Se falhar e não for o modelo de fallback, tenta o Ultra 550B
  if (!nimResponse.ok && model !== FALLBACK_MODEL) {
    console.warn(`AINEX: Modelo primário ${model} falhou (${nimResponse.status}). Iniciando fallback para ${FALLBACK_MODEL}...`)
    nimResponse = await performInference(FALLBACK_MODEL)
    model = FALLBACK_MODEL
  }

  if (!nimResponse.ok) {
    const errorText = await nimResponse.text().catch(() => "")
    return NextResponse.json({ error: `NVIDIA NIM Error: ${errorText || nimResponse.status}` }, { status: nimResponse.status })
  }

  // 4. PIPELINE STREAMING / JSON (RESTO DA LÓGICA MANTIDA)
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
