import { Sidebar } from "@/components/chat/sidebar"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"

export default function ChatPage() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      </div>
      
      {/* Main content */}
      <div className="relative z-10 flex h-full w-full">
        <Sidebar />
        
        <main className="flex flex-1 flex-col">
          <ChatHeader />
          <ChatMessages />
          <ChatInput />
        </main>
      </div>
    </div>
  )
}
