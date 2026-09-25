import { NextResponse } from "next/server"

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

interface ChatRequestBody {
  message?: unknown
  model?: unknown
  stream?: unknown
  temperature?: unknown
  top_p?: unknown
  max_tokens?: unknown
  frequency_penalty?: unknown
  presence_penalty?: unknown
  history?: Array<{ role: "system" | "user" | "assistant"; content: string }>
}

export async function POST(request: Request) {
  const startTime = Date.now()
  const body = (await request.json()) as ChatRequestBody

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const requestedModel = typeof body.model === "string" ? body.model.trim() : ""

  if (!message && (!body.history || body.history.length === 0)) {
    return NextResponse.json({ error: "Envie uma mensagem válida ou histórico." }, { status: 400 })
  }

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "NVIDIA_API_KEY não configurada no ambiente do servidor (.env.local)." },
      { status: 500 }
    )
  }

  // Executa estritamente o modelo selecionado pelo usuário
  const model = requestedModel || process.env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct"

  // Parâmetros Nativos da NVIDIA NIM (Inference Microservice)
  const wantsStream = body.stream !== false // Padrão: Streaming ativo
  const temperature = typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1) : 0.7
  const topP = typeof body.top_p === "number" ? Math.min(Math.max(body.top_p, 0.01), 1) : 0.9
  const maxTokens = typeof body.max_tokens === "number" ? Math.min(Math.max(body.max_tokens, 1), 4096) : 2048
  const frequencyPenalty = typeof body.frequency_penalty === "number" ? body.frequency_penalty : 0.0
  const presencePenalty = typeof body.presence_penalty === "number" ? body.presence_penalty : 0.0

  // Montagem do histórico com a nova mensagem
  const messages: Array<{ role: string; content: string }> = []
  if (Array.isArray(body.history) && body.history.length > 0) {
    for (const item of body.history) {
      if (item && typeof item.content === "string" && item.content.trim()) {
        messages.push({ role: item.role, content: item.content })
      }
    }
  }
  if (message) {
    messages.push({ role: "user", content: message })
  }

  // Payload nativo completo para a NVIDIA NIM
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    stream: wantsStream,
  }

  if (wantsStream) {
    payload.stream_options = { include_usage: true }
  }

  // Log detalhado e auditável dos parâmetros NIM
  console.log(`[NVIDIA NIM REQUEST] -----------------------------------------`)
  console.log(`[NVIDIA URL]     ${NVIDIA_CHAT_URL}`)
  console.log(`[NVIDIA MODEL]   ${model}`)
  console.log(`[NVIDIA STREAM]  ${wantsStream ? "ENABLED (Server-Sent Events)" : "DISABLED (JSON)"}`)
  console.log(`[NVIDIA PARAMS]  temp=${temperature} | top_p=${topP} | max_tokens=${maxTokens} | freq_pen=${frequencyPenalty} | pres_pen=${presencePenalty}`)
  console.log(`[NVIDIA PAYLOAD]`, JSON.stringify(payload, null, 2))
  console.log(`--------------------------------------------------------------`)

  try {
    const response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    })

    const latencyMs = Date.now() - startTime

    if (!response.ok) {
      const errorDetail = await response.text()
      console.error(`[NVIDIA ERROR] Status: ${response.status} (${latencyMs}ms) | Modelo: ${model}`)
      console.error(`[NVIDIA ERROR DETAIL]`, errorDetail)
      return NextResponse.json(
        {
          error: `[Erro NVIDIA ${response.status}] Modelo '${model}': ${errorDetail}`,
          status: response.status,
          model,
          debug: {
            url: NVIDIA_CHAT_URL,
            model,
            latencyMs,
            nativeParams: { temperature, topP, maxTokens, stream: wantsStream },
          },
        },
        { status: response.status >= 500 ? 502 : response.status }
      )
    }

    // Se o cliente solicitou Streaming nativo (SSE)
    if (wantsStream && response.body) {
      console.log(`[NVIDIA STREAM START] Pipe SSE conectado para '${model}' (${latencyMs}ms)`)
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Nvidia-Model": model,
        },
      })
    }

    // Modo não-streaming (JSON direto)
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      model?: string
    }
    const content = data.choices?.[0]?.message?.content

    console.log(`[NVIDIA RESPONSE] Status: ${response.status} OK (${latencyMs}ms)`)
    console.log(`[NVIDIA MODEL RETORNADO] ${data.model || model}`)
    if (data.usage) {
      console.log(
        `[NVIDIA TOKENS] Total: ${data.usage.total_tokens} (Prompt: ${data.usage.prompt_tokens}, Completion: ${data.usage.completion_tokens})`
      )
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: `A API da NVIDIA respondeu sem conteúdo para o modelo '${model}'.` },
        { status: 502 }
      )
    }

    return NextResponse.json({
      content,
      model,
      debug: {
        url: NVIDIA_CHAT_URL,
        modelExecuted: data.model || model,
        latencyMs,
        usage: data.usage,
        nativeParams: { temperature, topP, maxTokens, stream: false },
      },
    })
  } catch (err) {
    const latencyMs = Date.now() - startTime
    console.error(`[NVIDIA CONNECTION FAILED] Modelo: ${model} após ${latencyMs}ms:`, err)
    return NextResponse.json(
      {
        error: `Falha direta de conexão com a API da NVIDIA no modelo '${model}': ${err instanceof Error ? err.message : String(err)}`,
        model,
        debug: {
          url: NVIDIA_CHAT_URL,
          model,
          latencyMs,
        },
      },
      { status: 502 }
    )
  }
}
