import { forwardRef, useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import {
  ChatBubbleAvatar,
  ChatBubbleMessage,
  ChatBubbleTimestamp,
} from "~/app/_components/ui/chat-bubble";
import { Button } from "~/app/_components/ui/button";
import { MarkdownRenderer } from "~/app/_components/ui/markdown-renderer";
import type { Message } from "~/app/utils/types";
import { useTheme } from "next-themes";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { canVoteBotMessage } from "~/lib/bot-vote";

interface MessageProps {
  message: Message;
}

export const BubbleMessage = forwardRef<HTMLDivElement, MessageProps>(
  (props, ref) => {
    const { resolvedTheme } = useTheme();
    const { message } = props;
    const [botVote, setBotVote] = useState<"up" | "down" | null>(
      message.botVote ?? null,
    );
    const [botVoteSubmitted, setBotVoteSubmitted] = useState<boolean>(
      message.botVoteSubmitted ?? false,
    );

    const voteMutation = api.chat.rateBotMessage.useMutation({
      onSuccess: (data) => {
        setBotVote(data.botVote);
        setBotVoteSubmitted(data.botVoteSubmitted);
      },
      onError: () => {
        setBotVote(message.botVote ?? null);
        setBotVoteSubmitted(message.botVoteSubmitted ?? false);
      },
    });

    useEffect(() => {
      setBotVote(message.botVote ?? null);
      setBotVoteSubmitted(message.botVoteSubmitted ?? false);
    }, [message.botVote, message.botVoteSubmitted, message.messageId]);

    const handleVote = (vote: "up" | "down") => {
      if (message.sender !== "bot" || voteMutation.isPending) return;

      setBotVote(vote);
      setBotVoteSubmitted(true);
      voteMutation.mutate({
        messageId: message.messageId,
        vote,
      });
    };

    return (
      <div className="mb-1 flex items-end gap-2" hidden={message.hidden}>
        {message.sender !== "user" ? (
          <ChatBubbleAvatar
            className={cn(
              "hidden h-8 w-8 shrink-0 rounded-full sm:-ml-3 sm:flex",
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
        ) : (
          <div className="flex-1" />
        )}
        <div
          ref={ref}
          className={cn(
            "relative flex flex-col",
            message.sender === "user"
              ? "max-w-[88%] sm:max-w-[76%] md:max-w-[68%] lg:max-w-[60%]"
              : "max-w-[min(100%,68ch)]",
          )}
        >
          <ChatBubbleMessage
            variant={message.sender === "user" ? "sent" : "received"}
            className="overflow-x-hidden wrap-break-word"
          >
            <MarkdownRenderer content={message.text} variant="chat" />
          </ChatBubbleMessage>
          <ChatBubbleTimestamp
            timestamp={
              typeof message.time === "string"
                ? message.time
                : message.time.toISOString()
            }
            className={
              message.sender === "user"
                ? "text-aida-ink-muted mt-1 self-end text-right text-xs"
                : "text-aida-ink-muted mt-1 self-start text-left text-xs"
            }
          />
          {canVoteBotMessage({
            sender: message.sender,
            text: message.text,
            meetingMessage: message.meetingMessage,
            formMessage: message.formMessage,
          }) && (
            <div className="mt-1 flex items-center gap-1 self-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote("up")}
                className={cn(
                  "h-11 min-w-11 px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white",
                  botVote === "up" &&
                    "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300",
                )}
                aria-label="Voto positivo"
                disabled={voteMutation.isPending}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote("down")}
                className={cn(
                  "h-11 min-w-11 px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white",
                  botVote === "down" &&
                    "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300",
                )}
                aria-label="Voto negativo"
                disabled={voteMutation.isPending}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
              {botVoteSubmitted && (
                <span
                  className="ml-1 text-[11px] text-gray-500 dark:text-gray-400"
                  role="status"
                  aria-live="polite"
                >
                  Voto salvato
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

BubbleMessage.displayName = "BubbleMessage";
