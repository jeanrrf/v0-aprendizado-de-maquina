"use client"

import { useState } from "react"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"
import { MenuScreen } from "@/components/chat/menu-screen"
import { SearchScreen } from "@/components/chat/search-screen"
import { FilesScreen } from "@/components/chat/files-screen"
import { SettingsScreen } from "@/components/chat/settings-screen"

const titles: Record<string, string> = {
  menu: "Conversas",
  chat: "Chat com Claude",
  search: "Pesquisar",
  files: "Arquivos",
  settings: "Configurações",
}

export default function ChatPage() {
  const [active, setActive] = useState("chat")

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex h-full w-full">
        <Sidebar activeItem={active} onSelect={setActive} />

        <main className="flex flex-1 flex-col">
          <ChatHeader title={titles[active]} showModelInfo={active === "chat"} />

          {active === "chat" && (
            <>
              <ChatMessages />
              <ChatInput />
            </>
          )}
          {active === "menu" && <MenuScreen />}
          {active === "search" && <SearchScreen />}
          {active === "files" && <FilesScreen />}
          {active === "settings" && <SettingsScreen />}
        </main>
      </div>
    </div>
  )
}
