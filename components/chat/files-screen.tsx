"use client"

import { useState, useEffect, useRef, ChangeEvent } from "react"
import {
  FileText,
  FileImage,
  FileCode,
  FileType,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  Loader2,
  Plus,
  HardDrive,
} from "lucide-react"
import { User } from "firebase/auth"
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { db, handleFirestoreError, OperationType } from "@/lib/firebase"
import { cn } from "@/lib/utils"

export interface FirestoreFileItem {
  id: string
  name: string
  type: "pdf" | "image" | "code" | "doc"
  mimeType: string
  sizeBytes: number
  sizeFormatted: string
  content?: string
  createdAt?: any
}

interface FilesScreenProps {
  user: User | null
  onSignIn: () => void
}

const iconMap = {
  pdf: FileType,
  image: FileImage,
  code: FileCode,
  doc: FileText,
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function detectFileType(name: string, mime: string): "pdf" | "image" | "code" | "doc" {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  if (ext === "pdf" || mime.includes("pdf")) return "pdf"
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) || mime.startsWith("image/"))
    return "image"
  if (["ts", "tsx", "js", "jsx", "py", "json", "html", "css", "sql", "sh"].includes(ext))
    return "code"
  return "doc"
}

export function FilesScreen({ user, onSignIn }: FilesScreenProps) {
  const [files, setFiles] = useState<FirestoreFileItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega arquivos reais do usuário logado via Firestore em tempo real
  useEffect(() => {
    if (!user) {
      setFiles([])
      return
    }

    const filesPath = `users/${user.uid}/files`
    const filesRef = collection(db, "users", user.uid, "files")
    const q = query(filesRef, orderBy("createdAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: FirestoreFileItem[] = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name || "Arquivo sem nome",
            type: data.type || "doc",
            mimeType: data.mimeType || "",
            sizeBytes: data.sizeBytes || 0,
            sizeFormatted: data.sizeFormatted || formatBytes(data.sizeBytes || 0),
            content: data.content,
            createdAt: data.createdAt,
          }
        })
        setFiles(list)
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, filesPath)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Manipulador de upload real de arquivos para o Firestore
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setError(undefined)

    if (!user) {
      onSignIn()
      return
    }

    // Limite de segurança de 800KB para armazenamento direto seguro em documento Firestore
    if (selectedFile.size > 800 * 1024) {
      setError("Para armazenamento em base de dados sem Storage externo, o arquivo deve ter até 800 KB.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setIsUploading(true)

    try {
      const detectedType = detectFileType(selectedFile.name, selectedFile.type)
      const sizeFormatted = formatBytes(selectedFile.size)

      // Leitura real do conteúdo
      const reader = new FileReader()
      const contentPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        if (detectedType === "code" || detectedType === "doc") {
          reader.readAsText(selectedFile)
        } else {
          reader.readAsDataURL(selectedFile)
        }
      })

      const content = await contentPromise

      const filesRef = collection(db, "users", user.uid, "files")
      await addDoc(filesRef, {
        name: selectedFile.name,
        type: detectedType,
        mimeType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
        sizeFormatted,
        content,
        createdAt: serverTimestamp(),
      })

      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err) {
      console.error("Erro no upload:", err)
      setError("Falha ao salvar arquivo no Firestore.")
    } finally {
      setIsUploading(false)
    }
  }

  // Download real do arquivo armazenado
  const handleDownload = (file: FirestoreFileItem) => {
    if (!file.content) return
    try {
      const link = document.createElement("a")
      link.download = file.name

      if (file.content.startsWith("data:")) {
        link.href = file.content
      } else {
        const blob = new Blob([file.content], { type: file.mimeType || "text/plain" })
        link.href = URL.createObjectURL(blob)
      }

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error("Erro ao baixar arquivo:", err)
    }
  }

  // Exclusão real do documento no Firestore
  const handleDelete = async (fileId: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, "users", user.uid, "files", fileId))
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/files/${fileId}`)
    }
  }

  const totalBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0)
  const totalFormatted = formatBytes(totalBytes)

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card/60 p-8 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <FolderOpen className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Gerenciador de Arquivos em Nuvem</h2>
          <p className="text-sm text-muted-foreground">
            Conecte sua conta para fazer upload de documentos, códigos e imagens persistidos com segurança no Firestore.
          </p>
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95"
          >
            Conectar Conta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Arquivos</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5 text-primary" />
              <span>
                {files.length} {files.length === 1 ? "arquivo" : "arquivos"} reais · {totalFormatted} armazenados
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md transition-all hover:opacity-90 active:scale-95",
                isUploading && "opacity-70 cursor-not-allowed"
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Enviar arquivo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Lista Real ou Estado Vazio */}
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Nenhum arquivo enviado ainda</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Faça upload de códigos (.ts, .py), documentos (.md, .txt) ou imagens para enriquecer sua base de dados no Firestore.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Selecionar do computador
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => {
              const Icon = iconMap[file.type] || FileText
              return (
                <div
                  key={file.id}
                  className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm text-foreground" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {file.sizeFormatted}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-80 sm:opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleDownload(file)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Baixar arquivo"
                      aria-label="Baixar arquivo"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Excluir arquivo"
                      aria-label="Excluir arquivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
