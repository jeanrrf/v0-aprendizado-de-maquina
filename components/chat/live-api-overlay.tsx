"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Mic, MicOff, Volume2, VolumeX, Radio, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LiveAPIOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function LiveAPIOverlay({ isOpen, onClose }: LiveAPIOverlayProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [status, setStatus] = useState("Pronto para iniciar")

  const wsRef = useRef<WebSocket | null>(null)
  const inputAudioCtxRef = useRef<AudioContext | null>(null)
  const outputAudioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  useEffect(() => {
    if (isOpen) {
      startSession()
    } else {
      stopSession()
    }
    return () => stopSession()
  }, [isOpen])

  const startSession = async () => {
    setIsConnecting(true)
    setStatus("Conectando aos neurônios live...")

    try {
      // Setup WebSockets
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`)
      wsRef.current = ws

      // Setup Audio
      const inputCtx = new AudioContext({ sampleRate: 16000 })
      const outputCtx = new AudioContext({ sampleRate: 24000 })
      inputAudioCtxRef.current = inputCtx
      outputAudioCtxRef.current = outputCtx

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const source = inputCtx.createMediaStreamSource(stream)
      const processor = inputCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      source.connect(processor)
      processor.connect(inputCtx.destination)

      processor.onaudioprocess = (e) => {
        try {
          if (ws.readyState === WebSocket.OPEN && isMicOn) {
            const inputData = e.inputBuffer.getChannelData(0)
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff
            }
            
            // Otimização: Evitar loop de concatenação lenta de strings
            const uint8Array = new Uint8Array(pcmData.buffer)
            let binary = ""
            const chunkSize = 8192
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, uint8Array.subarray(i, i + chunkSize) as any)
            }
            const base64 = btoa(binary)
            
            // Verificação de segurança antes de enviar
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ audio: base64 }))
            }
          }
        } catch (error: any) {
          // Ignora silenciosamente erros de conexão perdida durante o processamento, 
          // similar ao "FrameDoesNotExistError" em extensões.
          if (error.message?.includes("not open") || error.message?.includes("closed")) {
            return
          }
          console.warn("Audio processing error:", error)
        }
      }

      ws.onopen = () => {
        setIsConnected(true)
        setIsConnecting(false)
        setStatus("AINEX está ouvindo...")
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.audio && isAudioOn) {
          playAudio(msg.audio)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        setStatus("Sessão encerrada")
      }

      ws.onerror = (err) => {
        console.error("Live API WS Error:", err)
        setStatus("Erro na conexão")
      }
    } catch (err) {
      console.error("Could not start live session:", err)
      setStatus("Erro ao acessar hardware de áudio")
      setIsConnecting(false)
    }
  }

  const stopSession = () => {
    wsRef.current?.close()
    wsRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    processorRef.current?.disconnect()
    processorRef.current = null
    inputAudioCtxRef.current?.close()
    inputAudioCtxRef.current = null
    outputAudioCtxRef.current?.close()
    outputAudioCtxRef.current = null
    setIsConnected(false)
    setIsConnecting(false)
  }

  const playAudio = (base64: string) => {
    if (!outputAudioCtxRef.current) return
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const pcm = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 0x7fff

    const buffer = outputAudioCtxRef.current.createBuffer(1, float32.length, 24000)
    buffer.getChannelData(0).set(float32)
    const source = outputAudioCtxRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(outputAudioCtxRef.current.destination)
    source.start()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-xl p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-8">
              <div className="relative">
                <div className={cn(
                  "flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 transition-all duration-1000",
                  isConnected ? "scale-110 shadow-[0_0_50px_rgba(var(--primary),0.3)]" : "scale-100"
                )}>
                  <Radio className={cn("h-16 w-16 text-primary", isConnecting && "animate-pulse")} />
                </div>
                {isConnected && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                  />
                )}
              </div>

              <div>
                <h3 className="text-2xl font-bold text-foreground">AINEX Voz Live</h3>
                <p className={cn(
                  "text-sm font-medium mt-1",
                  isConnected ? "text-primary" : "text-muted-foreground"
                )}>
                  {status}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <button
                  onClick={() => setIsMicOn(!isMicOn)}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border transition-all active:scale-90",
                    isMicOn ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/5 text-destructive"
                  )}
                >
                  {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                </button>

                <button
                  onClick={() => setIsAudioOn(!isAudioOn)}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border transition-all active:scale-90",
                    isAudioOn ? "border-primary/30 bg-primary/5 text-primary" : "border-muted-foreground/30 bg-muted/5 text-muted-foreground"
                  )}
                >
                  {isAudioOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                </button>
              </div>

              <div className="w-full bg-muted/30 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Instruções</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fale naturalmente. O AINEX irá responder em tempo real utilizando a rede neural acelerada NVIDIA.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
