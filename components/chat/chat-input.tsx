"use client"

import {
  FormEvent,
  KeyboardEvent,
  useState,
  useRef,
  useEffect,
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
} from "react"
import {
  ArrowUp,
  Paperclip,
  X,
  FileImage,
  FileCode,
  FileType,
  FileText,
  Cloud,
  Loader2,
} from "lucide-react"
import { User } from "firebase/auth"
import { collection, getDocs, limit, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { cn } from "@/lib/utils"

export interface ChatAttachment {
  id: string
  name: string
  type: "image" | "doc" | "code" | "pdf"
  mimeType: string
  sizeFormatted: string
  sizeBytes?: number
  url?: string
  content?: string
}

interface ChatInputProps {
  onSubmit: (message: string, attachments?: ChatAttachment[]) => void
  isLoading: boolean
  user?: User | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function detectFileType(name: string, mime: string): "image" | "doc" | "code" | "pdf" {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  if (ext === "pdf" || mime.includes("pdf")) return "pdf"
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) || mime.startsWith("image/"))
    return "image"
  if (["ts", "tsx", "js", "jsx", "py", "json", "html", "css", "sql", "sh", "yml", "yaml"].includes(ext))
    return "code"
  return "doc"
}

export function ChatInput({ onSubmit, isLoading, user }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showCloudPicker, setShowCloudPicker] = useState(false)
  const [cloudFiles, setCloudFiles] = useState<ChatAttachment[]>([])
  const [loadingCloudFiles, setLoadingCloudFiles] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-foco inicial no carregamento da tela
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Mantém o cursor ativo sempre que a IA terminar de responder
  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus()
    }
  }, [isLoading])

  // Auto-ajuste de altura da caixa de texto conforme o usuário digita
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [message])

  function compressImageToDataUrl(file: File, maxDim = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (!dataUrl) {
        resolve("")
        return
      }
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width <= maxDim && height <= maxDim && file.size < 500 * 1024) {
          // Já é pequeno o suficiente
          resolve(dataUrl)
          return
        }
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(dataUrl)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const format = file.type === "image/png" ? "image/png" : "image/jpeg"
        resolve(canvas.toDataURL(format, quality))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    }
    reader.onerror = () => resolve("")
    reader.readAsDataURL(file)
  })
}

// Processa arquivos locais do usuário (fotos, documentos, códigos)
  const processFiles = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList)
    if (filesArray.length === 0) return

    setIsProcessingFiles(true)
    const newAttachments: ChatAttachment[] = []

    for (const file of filesArray) {
      // Limite seguro de 8MB antes de compressão
      if (file.size > 8 * 1024 * 1024) {
        console.warn(`Arquivo ${file.name} excede o limite de 8MB.`)
        continue
      }

      const type = detectFileType(file.name, file.type)

      try {
        let url: string | undefined
        let content: string | undefined
        let approxSize = file.size

        if (type === "image") {
          url = await compressImageToDataUrl(file, 1280, 0.85)
          // Aproxima o tamanho em bytes a partir da string base64
          if (url) {
            approxSize = Math.round((url.length * 3) / 4)
          }
        } else if (type === "code" || type === "doc") {
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsText(file)
          })
        } else {
          // PDF ou outros
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
        }

        const sizeFormatted = formatBytes(approxSize)

        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          type,
          mimeType: file.type || "application/octet-stream",
          sizeFormatted,
          sizeBytes: approxSize,
          url,
          content,
        })
      } catch (err) {
        console.error("Erro ao ler arquivo:", err)
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments])
    setIsProcessingFiles(false)
    textareaRef.current?.focus()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files)
      e.target.value = ""
    }
  }

  // Suporte a colar print/screenshot da área de transferência (Ctrl+V)
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault()
      processFiles(e.clipboardData.files)
    }
  }

  // Suporte a Drag & Drop de arquivos direto na caixa de mensagem
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  // Carrega arquivos salvos na biblioteca da nuvem (Firestore)
  const handleOpenCloudPicker = async () => {
    if (!user) return
    setShowCloudPicker((prev) => !prev)
    if (cloudFiles.length > 0) return

    setLoadingCloudFiles(true)
    try {
      const q = query(
        collection(db, "users", user.uid, "files"),
        orderBy("createdAt", "desc"),
        limit(8)
      )
      const snap = await getDocs(q)
      const items: ChatAttachment[] = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name || "Arquivo",
          type: data.type || "doc",
          mimeType: data.mimeType || "",
          sizeFormatted: data.sizeFormatted || "0 KB",
          url: data.content?.startsWith("data:") ? data.content : undefined,
          content: !data.content?.startsWith("data:") ? data.content : undefined,
        }
      })
      setCloudFiles(items)
    } catch (err) {
      console.warn("Could not load cloud files:", err)
    } finally {
      setLoadingCloudFiles(false)
    }
  }

  const handleSelectCloudFile = (cf: ChatAttachment) => {
    if (!attachments.some((a) => a.name === cf.name)) {
      setAttachments((prev) => [...prev, cf])
    }
    setShowCloudPicker(false)
    textareaRef.current?.focus()
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    textareaRef.current?.focus()
  }

  function handleSend() {
    const value = message.trim()
    if ((!value && attachments.length === 0) || isLoading) return

    onSubmit(value, attachments)
    setMessage("")
    setAttachments([])
    setShowCloudPicker(false)

    // Reseta altura e mantém foco com cursor piscando no box
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.focus()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleSend()
  }

  const userInitials = user?.displayName
    ? user.displayName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "JF"

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "shrink-0 border-t border-border/80 bg-background/95 px-4 py-3 sm:py-4 backdrop-blur-md transition-colors",
        isDragOver && "bg-primary/10 border-primary"
      )}
    >
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl flex-col gap-2">
        {/* Input escondido para seleção de arquivos */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.sql"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal/Popover flutuante para anexar arquivos já existentes no Firestore */}
        {showCloudPicker && (
          <div className="rounded-xl border border-border bg-card p-3 shadow-xl animate-in fade-in-50 duration-150 mb-1">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Cloud className="h-3.5 w-3.5 text-primary" />
                <span>Anexar da Nuvem (Firestore)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCloudPicker(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {loadingCloudFiles ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Carregando sua biblioteca...</span>
              </div>
            ) : cloudFiles.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Nenhum arquivo na nuvem ainda. Faça upload pelo botão de clipe ou na aba Arquivos!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 max-h-40 overflow-y-auto">
                {cloudFiles.map((cf) => (
                  <button
                    key={cf.id}
                    type="button"
                    onClick={() => handleSelectCloudFile(cf)}
                    className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-muted/70 transition-colors border border-border/50 text-xs text-foreground"
                  >
                    {cf.type === "image" ? (
                      <FileImage className="h-4 w-4 text-primary shrink-0" />
                    ) : cf.type === "code" ? (
                      <FileCode className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="truncate flex-1 font-medium">{cf.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{cf.sizeFormatted}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Faixa de Anexos com Previews Dinâmicos (Imagens e Arquivos) */}
        {(attachments.length > 0 || isProcessingFiles) && (
          <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-xl border border-primary/30 bg-card/90 px-3 py-1.5 text-xs text-foreground shadow-sm transition-all hover:border-primary/60"
              >
                {att.type === "image" && att.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={att.url}
                    alt={att.name}
                    className="h-8 w-8 rounded-lg object-cover border border-border"
                  />
                ) : att.type === "code" ? (
                  <FileCode className="h-4 w-4 text-primary shrink-0" />
                ) : att.type === "pdf" ? (
                  <FileType className="h-4 w-4 text-red-400 shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                )}

                <div className="flex flex-col min-w-0 max-w-[140px] sm:max-w-[200px]">
                  <span className="truncate font-medium">{att.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {att.sizeFormatted}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-1"
                  title="Remover anexo"
                  aria-label="Remover anexo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {isProcessingFiles && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Carregando mídia...</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2.5">
          {/* Avatar ou Identificador do Usuário */}
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName || "Usuário"}
              className="hidden sm:block h-10 w-10 shrink-0 rounded-full border border-border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-xs font-semibold text-foreground">
              {userInitials}
            </div>
          )}

          {/* Caixa de Entrada Responsiva com foco permanente */}
          <div
            onClick={() => textareaRef.current?.focus()}
            className={cn(
              "flex min-w-0 flex-1 items-end rounded-2xl border border-border bg-input/80 px-3.5 py-2 shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 cursor-text",
              isDragOver && "border-primary ring-2 ring-primary/30"
            )}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isLoading
                  ? "AINEX respondendo em tempo real... (digite sua próxima mensagem)"
                  : attachments.length > 0
                  ? "Pergunte ou comente sobre as fotos/arquivos anexados..."
                  : "Pergunte ao AINEX, anexe arquivos ou cole imagens com Ctrl+V..."
              }
              aria-label="Mensagem"
              className="max-h-40 min-h-[26px] w-full resize-none bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none scrollbar-none"
            />

            <div className="flex items-center gap-1 pl-2 pb-0.5">
              {/* Botão de Anexo de Arquivo e Foto */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Anexar fotos ou arquivos do computador"
                title="Anexar fotos ou arquivos (imagens, código, documentos)"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {/* Botão para carregar arquivos da biblioteca Firestore */}
              {user && (
                <button
                  type="button"
                  onClick={handleOpenCloudPicker}
                  aria-label="Selecionar arquivo da biblioteca Firestore"
                  title="Selecionar arquivo da sua biblioteca na nuvem"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors active:scale-95",
                    showCloudPicker
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Cloud className="h-4 w-4" />
                </button>
              )}

              {/* Botão de Enviar */}
              <button
                type="submit"
                aria-label="Enviar mensagem"
                disabled={isLoading || (!message.trim() && attachments.length === 0)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200",
                  (message.trim() || attachments.length > 0) && !isLoading
                    ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-95"
                    : "text-muted-foreground opacity-40 hover:bg-muted"
                )}
              >
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </form>
      <div className="mx-auto mt-1.5 flex max-w-4xl items-center justify-between text-[11px] text-muted-foreground px-1">
        <span>Arraste e solte fotos/arquivos ou use Ctrl+V para colar imagens</span>
        <span className="hidden sm:inline">Multimodal LLaMA 3.2 Vision · NVIDIA NIM</span>
      </div>
    </div>
  )
}
