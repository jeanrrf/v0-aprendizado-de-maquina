"use client"

import { FileText, FileImage, FileCode, FileType, Upload, MoreHorizontal, Download } from "lucide-react"

interface FileItem {
  id: string
  name: string
  type: "pdf" | "image" | "code" | "doc"
  size: string
  date: string
}

const files: FileItem[] = [
  { id: "1", name: "relatorio-ml.pdf", type: "pdf", size: "2.4 MB", date: "Hoje" },
  { id: "2", name: "diagrama-arquitetura.png", type: "image", size: "856 KB", date: "Hoje" },
  { id: "3", name: "app.tsx", type: "code", size: "12 KB", date: "Ontem" },
  { id: "4", name: "notas-reuniao.md", type: "doc", size: "4 KB", date: "Ontem" },
  { id: "5", name: "dataset-treino.csv", type: "doc", size: "18 MB", date: "2 dias atrás" },
  { id: "6", name: "mockup-interface.png", type: "image", size: "1.2 MB", date: "3 dias atrás" },
  { id: "7", name: "documentacao-api.pdf", type: "pdf", size: "5.1 MB", date: "5 dias atrás" },
  { id: "8", name: "config.ts", type: "code", size: "3 KB", date: "1 semana atrás" },
]

const iconMap = {
  pdf: FileType,
  image: FileImage,
  code: FileCode,
  doc: FileText,
}

export function FilesScreen() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Arquivos</h1>
            <p className="text-sm text-muted-foreground">{files.length} arquivos · 45.2 MB usados</p>
          </div>
          <button className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">
            <Upload className="h-4 w-4" />
            Enviar arquivo
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const Icon = iconMap[file.type]
            return (
              <div
                key={file.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/15">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.size} · {file.date}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button className="rounded p-1.5 hover:bg-border" aria-label="Baixar">
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button className="rounded p-1.5 hover:bg-border" aria-label="Mais opções">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
