"use client"

import { memo, useEffect, useRef, useState } from "react"
import {
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  User as UserIcon,
  FileCode,
  FileType,
  FileText,
  FileImage,
  ExternalLink,
  Code2,
} from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { AinexOrb } from "@/components/ainex/ainex-orb"
import { ChatAttachment } from "./chat-input"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  attachments?: ChatAttachment[]
}

interface ChatMessagesProps {
  messages: Message[]
  error?: string
  isLoading?: boolean
  streamingText?: string | null
  modelName?: string
  onSelectPrompt?: (prompt: string) => void
}

const STARTER_PROMPTS = [
  {
    title: "Análise Neural",
    description: "Explique como funciona a arquitetura da esfera neural AINEX",
  },
  {
    title: "Otimização de Código",
    description: "Escreva uma função TypeScript concorrente com tratamento de erro",
  },
  {
    title: "Visão & Imagens",
    description: "Anexe uma foto ou diagrama para a IA analisar visualmente",
  },
  {
    title: "Leitura de Arquivos",
    description: "Anexe um arquivo de código ou texto para refatoração e auditoria",
  },
]

export function ChatMessages({
  messages,
  error,
  isLoading = false,
  streamingText = null,
  modelName,
  onSelectPrompt,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const isNearBottomRef = useRef(true)

  // Monitora a posição de scroll para determinar se o usuário está no fim
  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight)
    const isClose = distanceToBottom < 120
    isNearBottomRef.current = isClose
    setShowScrollBottom(!isClose)
  }

  // Scroll automático inteligente: rola ao fim a cada chunk/token recebido do streaming
  // Throttled to avoid excessive DOM operations during high-frequency token updates
  const lastScrollTimeRef = useRef(0)
  useEffect(() => {
    const now = performance.now()
    if (now - lastScrollTimeRef.current < 32) return // Max ~30fps scroll updates

    if (isNearBottomRef.current && bottomRef.current) {
      // Usar "auto" (instantâneo) durante streaming para evitar engasgos na UI
      const behavior = streamingText ? "auto" : "smooth"
      bottomRef.current.scrollIntoView({ behavior, block: "end" })
      lastScrollTimeRef.current = now
    }
  }, [messages, streamingText, isLoading])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    setShowScrollBottom(false)
    isNearBottomRef.current = true
  }

  const hasContent = messages.length > 0 || streamingText !== null

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative flex-1 flex-grow min-h-0 w-full overflow-y-auto px-4 py-6 md:px-8"
    >
      <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-start">
        {/* Quando não há mensagens, exibe o Hero centralizado e sugestões iniciais */}
        {!hasContent ? (
          <div className="my-auto flex flex-col items-center justify-center py-10 text-center animate-in fade-in-50 duration-300">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
              AINEX Neural Core
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Alimentado pela aceleração de microserviços NVIDIA NIM com visão computacional e leitura de arquivos.
            </p>

            {/* Sugestões de entrada que aparecem apenas no início */}
            <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
              {STARTER_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectPrompt?.(item.description)}
                  className="group flex flex-col rounded-xl border border-border/80 bg-card/60 p-3.5 text-left transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-md"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{item.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground/90 transition-colors">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Lista de mensagens limpa, dimensionada e contínua */
          <div className="space-y-6 pb-4">
            {messages.map((message) => (
              <div key={message.id} className="animate-in fade-in-50 duration-200">
                {message.role === "user" ? (
                  <UserMessageBubble
                    content={message.content}
                    attachments={message.attachments}
                  />
                ) : (
                  <AssistantMessageBubble
                    content={message.content}
                    modelName={modelName}
                  />
                )}
              </div>
            ))}

            {/* Balão projetado ao vivo durante o streaming de tokens */}
            {streamingText !== null && (
              <div className="animate-in fade-in duration-100">
                <AssistantMessageBubble
                  content={streamingText}
                  modelName={modelName}
                  isStreaming={true}
                />
              </div>
            )}

            {/* Indicador de carregamento enquanto aguarda primeiro token */}
            {isLoading && streamingText === null && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 animate-in fade-in duration-200">
                <div className="shrink-0 mt-0.5">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">AINEX</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Iniciando stream NIM...</span>
                  </div>
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-ping" />
                    <span className="h-2 w-2 rounded-full bg-primary/40 animate-pulse delay-75" />
                    <span className="h-2 w-2 rounded-full bg-primary/20 animate-pulse delay-150" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mensagem de Erro destacada se ocorrer */}
        {error && (
          <div
            role="alert"
            className="my-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs md:text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Sentinela de ancoragem para auto-scroll */}
        <div ref={bottomRef} className="h-px" />
      </div>

      {/* Botão flutuante para rolar para o fim */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          aria-label="Rolar para as mensagens recentes"
          className="fixed bottom-24 right-8 z-20 flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-card hover:border-primary/50"
        >
          <ChevronDown className="h-4 w-4 text-primary" />
          <span>Rolar para o fim</span>
        </button>
      )}
    </div>
  )
}

const UserMessageBubble = function UserMessageBubble({
  content,
  attachments = [],
}: {
  content: string
  attachments?: ChatAttachment[]
}) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  return (
    <div className="flex justify-end gap-2.5 pl-6 sm:pl-12">
      <div className="flex flex-col items-end max-w-[90%] sm:max-w-[80%] space-y-2">
        {/* Anexos de fotos ou arquivos enviados pelo usuário */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {attachments.map((att) => {
              if (att.type === "image" && att.url) {
                return (
                  <div key={att.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt={att.name}
                      onClick={() => setExpandedImage(att.url!)}
                      className="h-28 w-28 sm:h-36 sm:w-36 rounded-xl object-cover border border-border shadow-md cursor-pointer transition-transform hover:scale-105"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white font-mono">
                      {att.sizeFormatted}
                    </span>
                  </div>
                )
              }
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs text-foreground shadow-sm"
                >
                  {att.type === "code" ? (
                    <FileCode className="h-4 w-4 text-primary shrink-0" />
                  ) : att.type === "pdf" ? (
                    <FileType className="h-4 w-4 text-red-400 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0 max-w-[160px]">
                    <span className="truncate font-medium">{att.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{att.sizeFormatted}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Texto da mensagem */}
        {content && (
          <div className="rounded-2xl rounded-tr-sm border border-primary/30 bg-primary/15 px-4 py-3 text-sm text-foreground shadow-sm">
            <p className="whitespace-pre-wrap leading-relaxed break-words">{content}</p>
          </div>
        )}

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground pr-1">
          <UserIcon className="h-3 w-3" />
          <span>Você</span>
        </div>
      </div>

      {/* Modal para expansão de imagem */}
      {expandedImage && (
        <div
          onClick={() => setExpandedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedImage}
            alt="Imagem ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl border border-border/80 object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-zinc-950 shadow-md">
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3.5 py-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
          <Code2 className="h-3.5 w-3.5 text-primary" />
          <span>{language || "code"}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copiar código</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto">
        <pre className="font-mono text-xs text-zinc-100 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

function parseThinkingContent(raw: string) {
  const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/i
  const match = thinkRegex.exec(raw)
  if (!match) {
    return { thinking: null, isThinkingActive: false, cleanContent: raw }
  }

  const thinking = match[1].trim()
  const isThinkingActive = !raw.includes("</think>")
  const cleanContent = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, "").trim()
  return { thinking, isThinkingActive, cleanContent }
}

const AssistantMessageBubble = function AssistantMessageBubble({
  content,
  modelName,
  isStreaming = false,
}: {
  content: string
  modelName?: string
  isStreaming?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const { thinking, isThinkingActive, cleanContent } = parseThinkingContent(content)
  const [showReasoning, setShowReasoning] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanContent || content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const formattedModel = modelName
    ? modelName.split("/").pop()?.replace(/-instruct|-vision/gi, "")
    : "NVIDIA NIM"

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-2xl border bg-card/75 p-4 sm:p-5 shadow-sm transition-all duration-300 pr-4 sm:pr-6",
        isStreaming
          ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)] shadow-primary/5"
          : "border-border/70 hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
      )}
    >
      {/* Avatar dinâmico */}
      <div className="shrink-0 mt-0.5">
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className={cn("h-4 w-4 text-primary", isStreaming && "animate-pulse")} />
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Cabeçalho da resposta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs sm:text-sm text-foreground">AINEX</span>
            <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/40">
              {formattedModel}
            </span>
            {isStreaming && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                <span>{isThinkingActive ? "Deliberando raciocínio..." : "Transmitindo resposta..."}</span>
              </span>
            )}
          </div>

          {!isStreaming && (
            <button
              onClick={handleCopy}
              title="Copiar resposta"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground opacity-60 transition-all hover:bg-muted hover:text-foreground hover:opacity-100"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copiar</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Processo de Raciocínio Profundo (Thinking Tokens do Nemotron Ultra) */}
        {thinking && (
          <div className="my-2.5 overflow-hidden rounded-xl border border-primary/25 bg-muted/30 shadow-inner">
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex w-full items-center justify-between px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Raciocínio & Planejamento Neural</span>
                {isThinkingActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-medium text-primary animate-pulse">
                    Pensando...
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform duration-200", showReasoning ? "rotate-180" : "")}
              />
            </button>
            {showReasoning && (
              <div className="border-t border-border/40 bg-zinc-950/70 p-3.5 font-mono text-[11px] leading-relaxed text-zinc-300/90 whitespace-pre-wrap max-h-72 overflow-y-auto">
                {thinking}
              </div>
            )}
          </div>
        )}

        {/* Texto renderizado com react-markdown e remark-gfm completo */}
        <div className="markdown-content text-sm leading-relaxed text-foreground/95 space-y-3 break-words">
          {cleanContent ? (
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold text-foreground mt-4 mb-2 border-b border-border/60 pb-1">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">
                    {children}
                  </h3>
                ),
                ul: ({ children }) => <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs text-left border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-muted/80 text-foreground font-semibold border-b border-border">
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-border/60 bg-card/40">{children}</tbody>
                ),
                tr: ({ children }) => <tr className="transition-colors hover:bg-muted/30">{children}</tr>,
                th: ({ children }) => <th className="px-3 py-2 font-medium">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 text-muted-foreground">{children}</td>,
                code: ({ className, children }) => {
                  const isInline = !className
                  const match = /language-(\w+)/.exec(className || "")
                  const language = match ? match[1] : ""
                  const rawCode = String(children).replace(/\n$/, "")

                  if (isInline) {
                    return (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary font-medium">
                        {children}
                      </code>
                    )
                  }

                  return <CodeBlock language={language} code={rawCode} />
                },
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium"
                  >
                    <span>{children}</span>
                    <ExternalLink className="h-3 w-3 inline" />
                  </a>
                ),
              }}
            >
              {cleanContent}
            </Markdown>
          ) : (
            <span className="text-xs text-muted-foreground italic flex items-center gap-1">
              <span>Sintonizando neurônios</span>
              <span className="animate-pulse">...</span>
            </span>
          )}

          {/* Cursor pulsante indicando streaming ativo */}
          {isStreaming && (
            <span className="inline-block h-4 w-1.5 ml-1 rounded-sm bg-primary animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  )
}
