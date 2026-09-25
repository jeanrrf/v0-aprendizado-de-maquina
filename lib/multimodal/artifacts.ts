/**
 * AINEX Multimodal & Code Artifact Normalizer
 * Transforma arquivos, códigos e documentos em containers semânticos de alta densidade
 * com indexação absoluta de linhas e isolamento sintático para modelos de fronteira.
 */

export interface MultimodalAttachment {
  id: string
  name: string
  type: "image" | "code" | "doc" | "pdf"
  mimeType: string
  sizeFormatted: string
  sizeBytes?: number
  url?: string
  content?: string
}

/**
 * Formata arquivos de código com numeração estrita de linhas 1-indexed,
 * tag de linguagem e metadados estruturados.
 */
export function formatCodeArtifact(
  name: string,
  source: string,
  maxLines = 800
): string {
  if (!source) return ""
  const lines = source.split("\n")
  const total = lines.length
  const sliced = lines.slice(0, maxLines)
  
  const numbered = sliced
    .map((line, idx) => `${idx + 1}: ${line}`)
    .join("\n")

  const truncatedNotice =
    total > maxLines
      ? `\n... [Truncado em ${maxLines} linhas de ${total} totais para otimização de contexto]`
      : ""

  const ext = name.includes(".") ? name.split(".").pop() || "code" : "code"

  return `<attached_code name="${name}" language="${ext}" total_lines="${total}">\n${numbered}${truncatedNotice}\n</attached_code>`
}

/**
 * Formata documentos de texto, logs ou extrações de PDF com delimitadores semânticos.
 */
export function formatDocumentArtifact(
  name: string,
  content: string,
  type: string,
  maxChars = 15000
): string {
  if (!content) return ""
  const trimmed =
    content.length > maxChars
      ? `${content.slice(0, maxChars)}\n... [Documento truncado para otimização]`
      : content

  return `<attached_document name="${name}" type="${type}">\n${trimmed}\n</attached_document>`
}

/**
 * Higieniza o anexo para persistência no Firestore.
 * Garante que payloads gigantes em base64 não estourem o limite estrito de 1MB por documento.
 */
export function sanitizeAttachmentForFirestore(att: MultimodalAttachment): Record<string, any> {
  let safeUrl = att.url || null

  // Se for uma dataURL base64 pesada (> 300KB), mantém apenas uma versão utilizável ou reduzida
  if (safeUrl && safeUrl.startsWith("data:") && safeUrl.length > 300 * 1024) {
    // Para persistência no Firestore, evitamos armazenar megabytes em um único documento
    safeUrl = safeUrl.slice(0, 200 * 1024)
  }

  let safeContent = att.content || null
  if (safeContent && safeContent.length > 50 * 1024) {
    safeContent = safeContent.slice(0, 50 * 1024)
  }

  return {
    id: att.id,
    name: att.name,
    type: att.type,
    mimeType: att.mimeType,
    sizeFormatted: att.sizeFormatted,
    sizeBytes: att.sizeBytes || 0,
    url: safeUrl,
    content: safeContent,
  }
}
