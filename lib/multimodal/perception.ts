/**
 * AINEX Multimodal Bicameral Perception Engine
 * Atua como o "Olho" do sistema: quando um modelo de raciocínio puro (como o Nemotron 3 Ultra 550B)
 * recebe imagens, este módulo extrai a semântica visual, OCR, diagramas e dados estruturados
 * através do Llama 3.2 Vision e injeta a percepção de alta densidade no córtex do Nemotron.
 */

export interface PerceptionResult {
  analysis: string
  success: boolean
  error?: string
}

/**
 * Realiza a leitura e extração perceptual de alta fidelidade de uma ou mais imagens.
 */
export async function perceiveVisuals(
  images: Array<{ url: string; name?: string }>,
  apiKey: string,
  model = "meta/llama-3.2-11b-vision-instruct"
): Promise<PerceptionResult> {
  if (!images || images.length === 0) {
    return { analysis: "", success: true }
  }

  const validImages = images.filter((img) => img.url && img.url.startsWith("data:image/"))
  if (validImages.length === 0) {
    return { analysis: "", success: true }
  }

  const promptText = `Você é o subsistema de percepção visual avançada do AINEX.
Sua missão é inspecionar minuciosamente a(s) imagem(ns) enviada(s) e produzir um relatório analítico para ser processado pelo córtex de raciocínio profundo.

Extraia com máxima precisão e densidade de informação:
1. **OCR & Textos Literais**: Transcreva todo e qualquer texto visível na imagem (código, mensagens de erro, logs, comandos, botões, tabelas ou anotações).
2. **Arquitetura & Diagramas**: Se for diagrama ou fluxo, descreva nós, setas, relacionamentos, entidades e conexões lógicas.
3. **Interface & Elementos Visuais**: Identifique estados de UI, gráficos (valores, eixos, tendências), cores críticas (ex: alertas vermelhos, avisos amarelos) e contexto.
4. **Resumo Semântico**: Descreva o objetivo central do conteúdo visual em poucas frases.

Seja objetivo, factual, detalhado e não omita detalhes técnicos ou números.`

  const contentParts: any[] = [
    { type: "text", text: promptText },
  ]

  for (const img of validImages) {
    contentParts.push({
      type: "image_url",
      image_url: { url: img.url },
    })
  }

  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: contentParts }],
        max_tokens: 1536,
        temperature: 0.1,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "")
      console.warn("Bicameral perception call failed:", res.status, err)
      return {
        analysis: `[Nota Perceptual: A análise visual de ${validImages.length} imagem(ns) não pôde ser completada automaticamente pelo encoder. Status: ${res.status}]`,
        success: false,
        error: `HTTP ${res.status}`,
      }
    }

    const data = await res.json()
    const rawAnalysis = data.choices?.[0]?.message?.content || ""

    const formatted = [
      `<visual_perception_analysis total_images="${validImages.length}">`,
      rawAnalysis.trim(),
      `</visual_perception_analysis>`,
    ].join("\n")

    return { analysis: formatted, success: true }
  } catch (err: any) {
    console.error("Perception engine runtime error:", err)
    return {
      analysis: `[Erro de Percepção: Falha de conexão com o encoder visual: ${err.message}]`,
      success: false,
      error: err.message,
    }
  }
}
