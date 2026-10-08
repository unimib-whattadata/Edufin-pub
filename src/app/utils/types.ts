export interface Message {
  chatId: number;
  messageId: number;
  text: string;
  sender: "user" | "bot";
  time: Date;
  meetingMessage: boolean;
  botVoteSubmitted?: boolean;
  botVote?: "up" | "down" | null;
  botVoteAt?: Date | null;
  isLoading?: boolean;
  hidden?: boolean;
  formMessage?: string | null;
}
