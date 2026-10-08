"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Button } from "~/app/_components/ui/button";
import { BookingView } from "~/app/_components/booking/booking-view";
import { Chat } from "~/app/_components/chat/chat";
import { ConditionDialog } from "~/app/_components/conditions-dialog";
import { Footer } from "~/app/_components/footer/footer";
import { GuideView } from "~/app/_components/guide/guide-view";
import { Header } from "~/app/_components/header/header";
import {
  AppSidebar,
  type SidebarView,
} from "~/app/_components/sidebar/app-sidebar";
import { fakeMessage } from "~/app/utils/fakeMessage";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const LEGACY_CONDITIONS_KEY = "conditions";
const CONDITIONS_KEY = "conditions-v2";

export default function Home() {
  const [anonId, setAnonId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [refetch, setRefetch] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState<boolean>(false);
  const [activeView, setActiveView] = useState<SidebarView>("chat");
  const [tmpUserMessage, setTmpUserMessage] = useState<string | undefined>(
    undefined,
  );
  const [acceptedChatCondition, setAcceptedChatCondition] =
    useState<boolean>(false);
  const [declinedChatCondition, setDeclinedChatCondition] = useState(false);
  const [showAidaIntro, setShowAidaIntro] = useState<boolean>(false);
  const [pendingIntroPrompt, setPendingIntroPrompt] = useState<string | null>(
    null,
  );
  const clearPendingIntroPrompt = useCallback(
    () => setPendingIntroPrompt(null),
    [],
  );
  const utils = api.useUtils();

  const isOnline = api.chat.isOnline.useQuery();

  const currentChat = api.chat.getOrCreateChat.useQuery(
    {
      anonymId: anonId!,
      newChat: false,
    },
    {
      enabled: !!anonId,
    },
  );

  useEffect(() => {
    let id = localStorage.getItem("anonymUser");
    localStorage.removeItem(LEGACY_CONDITIONS_KEY);
    const conditions = localStorage.getItem(CONDITIONS_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem("anonymUser", id);
    }
    if (conditions) setAcceptedChatCondition(true);
    setAnonId(id);
  }, []);

  const onClickNewChat = async () => {
    if (!anonId) {
      toast.error("Errore nella chat corrente, prova a ricaricare!");
      return;
    }

    try {
      setActiveView("chat");
      setIsMobileSidebarOpen(false);
      setTmpUserMessage(undefined);
      setIsGenerating(false);
      setRefetch(true);
      // Force a new chat creation
      await utils.chat.getOrCreateChat.fetch({
        anonymId: anonId,
        newChat: true,
      });

      // Invalidate and refetch to ensure UI updates
      await utils.chat.getOrCreateChat.invalidate();
      await currentChat.refetch();
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error("Errore nella creazione della chat, riprova più tardi");
    } finally {
      setRefetch(false);
    }
  };

  const onClickAida = async () => {
    if (!anonId) {
      toast.error("Errore nel caricamento della chat");
      return;
    }

    try {
      setActiveView("chat");
      setIsMobileSidebarOpen(false);
      setTmpUserMessage(undefined);
      setIsGenerating(false);
      setRefetch(true);
      await utils.chat.getOrCreateChat.invalidate();
      await currentChat.refetch();
    } catch (error) {
      console.error("Failed to load latest chat:", error);
      toast.error("Errore nel caricamento della chat");
    } finally {
      setRefetch(false);
    }
  };

  const onToggleMobileSidebar = () => {
    setIsMobileSidebarOpen((prev) => !prev);
  };

  const onSelectIntroPrompt = (prompt: string) => {
    setActiveView("chat");
    setIsMobileSidebarOpen(false);
    setPendingIntroPrompt(prompt);
    setShowAidaIntro(false);
  };

  return (
    <div className="bg-aida-canvas text-aida-ink h-full w-full">
      {!acceptedChatCondition ? (
        declinedChatCondition ? (
          <main className="bg-aida-canvas flex h-full items-center justify-center px-5 py-8">
            <section className="border-aida-border bg-aida-surface w-full max-w-lg rounded-2xl border p-6 shadow-sm sm:p-8">
              <h1 className="text-aida-ink text-2xl font-semibold">
                Accesso non attivato
              </h1>
              <p className="text-aida-ink-muted mt-3 text-sm leading-relaxed">
                Hai scelto di non accettare i termini. Chat, guida e richiesta
                di appuntamento restano chiuse; puoi chiudere questa scheda
                oppure rivedere la scelta.
              </p>
              <Button
                type="button"
                className="mt-6 min-h-11"
                onClick={() => setDeclinedChatCondition(false)}
              >
                Rivedi i termini
              </Button>
            </section>
          </main>
        ) : (
          <ConditionDialog
            acceptedChatCondition={acceptedChatCondition}
            setAcceptedChatCondition={setAcceptedChatCondition}
            onDecline={() => setDeclinedChatCondition(true)}
            onAccepted={() => setShowAidaIntro(true)}
          />
        )
      ) : (
        <div className="bg-aida-canvas relative flex h-full w-full overflow-hidden">
          <div className="hidden h-full sm:block">
            <AppSidebar
              activeView={activeView}
              onOpenAida={onClickAida}
              onSelectView={setActiveView}
            />
          </div>
          <div className="grid h-full min-w-0 flex-1 grid-rows-[auto_1fr_auto]">
            <Header
              isOnline={isOnline.data?.online}
              onToggleSidebar={onToggleMobileSidebar}
              onClickNewChat={onClickNewChat}
            />
            {activeView === "chat" ? (
              <Chat
                messages={currentChat.data?.messages ?? fakeMessage}
                isGenerating={isGenerating || refetch}
                tmpUserMessage={tmpUserMessage}
                showAidaIntro={showAidaIntro}
                onCloseAidaIntro={() => setShowAidaIntro(false)}
                onSelectIntroPrompt={onSelectIntroPrompt}
              />
            ) : activeView === "guide" ? (
              <GuideView />
            ) : (
              <BookingView />
            )}
            {activeView === "chat" && (
              <Footer
                setIsGenerating={setIsGenerating}
                setTmpUserMessage={setTmpUserMessage}
                isGenerating={isGenerating}
                anonId={anonId}
                pendingPrompt={pendingIntroPrompt}
                onPendingPromptConsumed={clearPendingIntroPrompt}
              />
            )}
          </div>
          <div
            className={cn(
              "absolute inset-0 z-50 transition-opacity duration-300 sm:hidden",
              isMobileSidebarOpen
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0",
            )}
          >
            <button
              className={cn(
                "absolute inset-0 bg-black/40 transition-opacity duration-300",
                isMobileSidebarOpen ? "opacity-100" : "opacity-0",
              )}
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Chiudi menu"
            />
            <div
              className={cn(
                "absolute inset-y-0 left-0 h-full w-72 transform transition-transform duration-300 ease-out",
                isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <AppSidebar
                activeView={activeView}
                onOpenAida={onClickAida}
                onSelectView={setActiveView}
                mobile
                onClose={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
