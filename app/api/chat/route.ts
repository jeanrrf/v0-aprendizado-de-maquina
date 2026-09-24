import { NextResponse } from "next/server"

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

export async function POST(request: Request) {
  const apiKey = process.env.NVIDIA_API_KEY
  const model = process.env.NVIDIA_MODEL

  if (!apiKey || !model) {
    return NextResponse.json(
      { error: "A configuração da NVIDIA está incompleta no ambiente do servidor." },
      { status: 500 },
    )
  }

  const body = (await request.json()) as { message?: unknown }
  const message = typeof body.message === "string" ? body.message.trim() : ""

  if (!message) {
    return NextResponse.json({ error: "Envie uma mensagem válida." }, { status: 400 })
  }

  const response = await fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: message }],
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const detail = await response.text()
    return NextResponse.json(
      { error: `A NVIDIA API retornou ${response.status}.`, detail },
      { status: response.status >= 500 ? 502 : response.status },
    )
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = data.choices?.[0]?.message?.content

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "A NVIDIA API não retornou conteúdo." }, { status: 502 })
  }

  return NextResponse.json({ content, model })
}
