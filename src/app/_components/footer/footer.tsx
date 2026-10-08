import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CircularProgress from "@mui/material/CircularProgress";
import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { Button } from "~/app/_components/ui/button";
import { Textarea } from "~/app/_components/ui/textarea";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface FooterProps {
  setTmpUserMessage: Dispatch<SetStateAction<string | undefined>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  anonId: string | null;
  isGenerating: boolean;
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
}

export const Footer = (props: FooterProps) => {
  const {
    anonId,
    isGenerating,
    pendingPrompt,
    onPendingPromptConsumed,
    setIsGenerating,
    setTmpUserMessage,
  } = props;

  const utils = api.useUtils();
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!pendingPrompt) return;
    setInputValue(pendingPrompt);
    onPendingPromptConsumed?.();
  }, [onPendingPromptConsumed, pendingPrompt]);

  const sendMessageMutation = api.chat.sendMessage.useMutation({
    onError: () => {
      toast.error(
        "Aida è momentaneamente sovraccarica. Riprova tra qualche minuto!",
      );
    },
    onSettled: async () => {
      await utils.chat.getOrCreateChat.invalidate();
      setTmpUserMessage(undefined);
      setIsGenerating(false);
    },
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setIsGenerating(true);
    setTmpUserMessage(inputValue.trim());
    setInputValue("");
    if (anonId) {
      sendMessageMutation.mutate({
        text: inputValue.trim(),
        anonId: anonId,
      });
    } else {
      toast.error("Errore nella chat corrente, prova a ricaricare!");
    }
    setInputValue("");
  };

  return (
    <footer className="bg-aida-canvas shrink-0 px-2 sm:px-4">
      <form
        onSubmit={onSubmit}
        className="border-aida-border bg-aida-surface focus-within:border-aida-focus mb-3 flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 shadow-sm transition-colors duration-200"
      >
        <Textarea
          aria-label="Domanda per AIDA"
          placeholder="Hai una domanda?"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              await onSubmit(e);
            }
          }}
          className="text-aida-ink placeholder:text-aida-ink-muted grow shadow-none"
          disabled={isGenerating}
        />
        <Button
          type="submit"
          size="icon"
          aria-label={
            isGenerating ? "Invio messaggio in corso" : "Invia messaggio"
          }
          aria-busy={isGenerating}
          disabled={!inputValue.trim() || isGenerating}
          className="h-11 w-11"
        >
          {isGenerating ? (
            <CircularProgress size={20} className="text-aida-ink!" />
          ) : (
            <SendRoundedIcon className="h-5 w-5" />
          )}
        </Button>
        <span className="sr-only" role="status" aria-live="polite">
          {isGenerating ? "Invio del messaggio ad AIDA in corso." : ""}
        </span>
      </form>
    </footer>
  );
};
