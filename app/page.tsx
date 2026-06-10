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
import { ResonanceField } from "@/components/ainex/resonance-field"

const titles: Record<string, string> = {
  ainex: "AINEX · Campo de Ressonância",
  menu: "Conversas",
  chat: "Chat com AINEX",
  search: "Pesquisar",
  files: "Arquivos",
  settings: "Configurações",
}

export default function ChatPage() {
  const [active, setActive] = useState("ainex")

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex h-full w-full">
        <Sidebar activeItem={active} onSelect={setActive} />

        <main className="flex flex-1 flex-col">
          <ChatHeader title={titles[active]} showModelInfo={active === "chat"} />

          <div key={active} className="flex flex-1 flex-col overflow-hidden duration-300 animate-in fade-in-50 slide-in-from-bottom-2">
            {active === "ainex" && <ResonanceField />}
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
          </div>
        </main>
      </div>
    </div>
  )
}
