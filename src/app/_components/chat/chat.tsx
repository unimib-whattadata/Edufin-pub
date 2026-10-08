import { useEffect } from "react";
import { AidaIntroCarousel } from "~/app/_components/chat/aida-intro-carousel";
import { BubbleMessage } from "~/app/_components/chat/message";
import { LogoOfficial } from "~/app/_components/logo-aief";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
  ChatBubbleTimestamp,
} from "~/app/_components/ui/chat-bubble";
import { ChatMessageList } from "~/app/_components/ui/chat-message-list";
import { MarkdownRenderer } from "~/app/_components/ui/markdown-renderer";
import type { Message } from "~/app/utils/types";
import { cn } from "~/lib/utils";
import { LogoBicocca } from "~/app/_components/logo-bicocca";
import { useTheme } from "next-themes";

interface ChatProps {
  messages: Message[];
  isGenerating: boolean;
  tmpUserMessage?: string;
  showAidaIntro?: boolean;
  onCloseAidaIntro?: () => void;
  onSelectIntroPrompt?: (prompt: string) => void;
}

const chatElements = new Map<number, HTMLElement>();

export const Chat = (props: ChatProps) => {
  const { resolvedTheme } = useTheme();
  const {
    messages,
    isGenerating,
    tmpUserMessage,
    showAidaIntro = false,
    onCloseAidaIntro,
    onSelectIntroPrompt,
  } = props;

  useEffect(() => {
    if (isGenerating || messages.length === 0) return;

    // Find the last bot message from the messages array
    let lastBotMessageId: number | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.sender !== "user") {
        lastBotMessageId = messages[i]?.messageId;
        break;
      }
    }

    if (!lastBotMessageId) return;

    // Store the messageId in a const to avoid type assertion
    const targetMessageId = lastBotMessageId;

    // Use requestAnimationFrame to ensure DOM is updated, then scroll
    const scrollToNewMessage = () => {
      const messageElement = chatElements.get(targetMessageId);
      if (messageElement) {
        messageElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      }
    };

    // Immediate scroll attempt with double RAF for layout completion
    let timeoutId: NodeJS.Timeout | undefined;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToNewMessage();

        // Fallback: also try after a short delay to catch async markdown rendering
        timeoutId = setTimeout(() => {
          scrollToNewMessage();
        }, 100);
      });
    });

    // Cleanup timeout if component unmounts or dependencies change
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isGenerating]);

  return (
    <div className="bg-aida-canvas relative overflow-y-auto px-2 sm:px-4">
      <ChatMessageList
        className={cn(
          "h-full",
          messages.length == 0 && "flex items-center justify-center",
        )}
      >
        <div className="flex flex-col items-center justify-center py-2">
          <p className="text-aida-ink-muted mb-1 text-xs font-semibold tracking-[0.16em] uppercase">
            powered by
          </p>
          <div className="flex flex-row items-center justify-center py-4">
            <div className="bg-aida-canvas rounded-lg p-1.5 dark:bg-white">
              <LogoOfficial />
            </div>
            {resolvedTheme && <LogoBicocca theme={resolvedTheme} />}
          </div>
        </div>
        {messages.map((message, index) => (
          <BubbleMessage
            ref={(ref) =>
              void chatElements.set(message.messageId, ref as HTMLElement)
            }
            key={index}
            message={message}
          />
        ))}
        {tmpUserMessage && (
          <div className="mb-3 flex items-end gap-2">
            <div className="flex-1" />
            <div className="flex max-w-[88%] flex-col sm:max-w-[82%] md:max-w-[72%] lg:max-w-[64%] xl:max-w-[58%] 2xl:max-w-[52%]">
              <ChatBubbleMessage
                variant="sent"
                className="overflow-x-hidden wrap-break-word"
              >
                <MarkdownRenderer content={tmpUserMessage} variant="chat" />
              </ChatBubbleMessage>
              <ChatBubbleTimestamp
                timestamp={new Date().toISOString()}
                className="text-aida-ink-muted mt-1 self-end text-right text-xs"
              />
            </div>
          </div>
        )}
        {isGenerating && (
          <>
            <ChatBubble variant="received">
              <ChatBubbleAvatar
                className={cn(
                  "h-8 w-8 self-end rounded-full",
                  resolvedTheme === "light"
                    ? "border-aida-border"
                    : "border-aida-border-strong",
                )}
                src={
                  resolvedTheme === "light"
                    ? "/bot_logo_light.png"
                    : "/bot_logo_dark.png"
                }
                fallback="🤖"
              />
              <ChatBubbleMessage isLoading />
            </ChatBubble>
            <div className="h-0.5"></div>
          </>
        )}
      </ChatMessageList>
      {onCloseAidaIntro && (
        <AidaIntroCarousel
          open={showAidaIntro}
          onClose={onCloseAidaIntro}
          onSelectPrompt={(prompt) => {
            onSelectIntroPrompt?.(prompt);
            onCloseAidaIntro();
          }}
        />
      )}
    </div>
  );
};
