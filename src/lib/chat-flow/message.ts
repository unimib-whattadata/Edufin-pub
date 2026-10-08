import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Message } from "~/app/utils/types";
import { callLLM } from "~/lib/llm-request";
import { chats, messages } from "~/server/db/schema";
import type * as schema from "~/server/db/schema";

export const saveHistory = async (
  db: PostgresJsDatabase<typeof schema>,
  chatId: number,
  context: string,
) => {
  await db
    .update(chats)
    .set({
      historyContext: sql`array_append(${chats.historyContext}, ${context})`,
    })
    .where(eq(chats.chatId, chatId));
};

const callChatbot = async (
  db: PostgresJsDatabase<typeof schema>,
  messageList: Message[],
  text: string,
  historyContext: string[],
  chatId: number,
) => {
  const botResponseText = await callLLM(messageList, historyContext, text);

  await db.insert(messages).values({
    chatId: chatId,
    text:
      botResponseText.response ?? "Non sono riuscito a generare una risposta.",
    sender: "bot",
    time: new Date(),
  });

  await saveHistory(db, chatId, botResponseText.knowledgeContext);

  return {
    knowledgeContext: botResponseText.knowledgeContext,
  };
};

export const chatbotMessage = async (
  db: PostgresJsDatabase<typeof schema>,
  messageList: Message[],
  text: string,
  historyContext: string[],
  chatId: number,
  messageId: number | undefined,
) => {
  try {
    return callChatbot(db, messageList, text, historyContext, chatId);
  } catch (error) {
    if (messageId)
      await db.delete(messages).where(eq(messages.messageId, messageId));
    console.error("Failed to fetch from Gemini API", error);
    throw new Error("Failed to communicate with the AI model.");
  }
};
