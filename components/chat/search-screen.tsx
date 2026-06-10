"use client"

import { Search, MessageSquare, FileText, Clock } from "lucide-react"
import { useState } from "react"

interface SearchResult {
  id: string
  type: "conversa" | "arquivo"
  title: string
  snippet: string
  time: string
}

const allResults: SearchResult[] = [
  {
    id: "1",
    type: "conversa",
    title: "Chat com Claude",
    snippet: "...aprendizado de máquina é uma área da inteligência artificial...",
    time: "Agora",
  },
  {
    id: "2",
    type: "conversa",
    title: "Revisão de código React",
    snippet: "...otimizar o re-render usando memo e useCallback...",
    time: "2h atrás",
  },
  {
    id: "3",
    type: "arquivo",
    title: "relatorio-ml.pdf",
    snippet: "Documento sobre fundamentos de machine learning",
    time: "Ontem",
  },
  {
    id: "4",
    type: "conversa",
    title: "Plano de estudos",
    snippet: "...cronograma de 30 dias para aprender TypeScript...",
    time: "Ontem",
  },
  {
    id: "5",
    type: "arquivo",
    title: "notas-reuniao.md",
    snippet: "Pontos discutidos sobre o lançamento do produto",
    time: "3 dias atrás",
  },
]

const recentSearches = ["aprendizado de máquina", "react hooks", "typescript", "marketing saas"]

export function SearchScreen() {
  const [query, setQuery] = useState("")

  const results = query
    ? allResults.filter(
        (r) =>
          r.title.toLowerCase().includes(query.toLowerCase()) ||
          r.snippet.toLowerCase().includes(query.toLowerCase()),
      )
    : allResults

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-xl font-semibold text-foreground">Pesquisar</h1>

        <div className="mb-6 flex items-center gap-3 rounded-full border border-border bg-input px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar conversas e arquivos..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {!query && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Pesquisas recentes
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="mb-2 text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? "resultado" : "resultados"}
          </div>
          {results.map((result) => (
            <button
              key={result.id}
              className="flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                {result.type === "conversa" ? (
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{result.title}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {result.type}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{result.snippet}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{result.time}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
