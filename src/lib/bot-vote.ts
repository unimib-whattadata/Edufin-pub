type BotVoteMessage = {
  sender: "user" | "bot";
  text: string;
  meetingMessage?: boolean | null;
  formMessage?: string | null;
};

const NON_VOTABLE_BOT_MESSAGE_PREFIXES = [
  "Benvenuto!",
  "Seleziona l'area di interesse:",
  "✨ Siamo contenti per il tuo interesse alle tematiche finanziarie",
  "Grazie per aver parlato con **Aida**",
  "Se hai altre domande o curiosità, sono qui per te",
  "Compila il seguente Form per registrare la tua presenza:",
] as const;

export const canVoteBotMessage = (message: BotVoteMessage): boolean => {
  if (message.sender !== "bot") return false;
  if (message.meetingMessage) return false;
  if (message.formMessage) return false;

  const normalizedText = message.text.trim();
  const isNonVotableSystemMessage = NON_VOTABLE_BOT_MESSAGE_PREFIXES.some(
    (prefix) =>
      normalizedText === prefix || normalizedText.startsWith(prefix),
  );

  return !isNonVotableSystemMessage;
};
