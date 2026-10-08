import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import { chatbotMessage } from "~/lib/chat-flow/message";
import { canVoteBotMessage } from "~/lib/bot-vote";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { chats, messages } from "~/server/db/schema";
import type * as schema from "~/server/db/schema";

const initialMessage = `Benvenuto!
Sono **Aida**, e sono qui per assisterti e guidarti con semplici spiegazioni nel tuo percorso di formazione di maggiori competenze finanziarie. Potrò aiutarti a comprendere e approfondire i temi del risparmio, della previdenza, della protezione, nonchè della corretta gestione delle risorse finanziarie personali, familiari o aziendali.

Le tematiche che tratterò sono approvate e supervisionate dall’Università di Milano – Bicocca, che, in sinergia con AIEF – Associazione Italiana Educatori Finanziari, ha realizzato questo prezioso strumento di ausilio al cittadino per l’approfondimento di tali argomenti.

Ogni risposta ai tuoi interrogativi sarà mirata unicamente alla comprensione delle problematiche proprie dei suddetti temi, e non avrà alcun collegamento di natura commerciale a prodotti e servizi disponibili sul mercato, non rientrando tale politica negli scopi di questo strumento e della stessa Associazione.

Come posso aiutarti?
Fammi una domanda.`;

const getChatLatestChat = async (
  db: PostgresJsDatabase<typeof schema>,
  anonymId: string,
) => {
  return await db.query.chats.findFirst({
    where: eq(chats.anonymId, anonymId),
    orderBy: [desc(chats.lastUpdate)],
    with: {
      messages: {
        orderBy: asc(messages.time),
      },
    },
  });
};

export const chatRouter = createTRPCRouter({
  getOrCreateChat: publicProcedure
    .input(z.object({ anonymId: z.string(), newChat: z.boolean() }))
    .query(async ({ input, ctx }) => {
      const chatWithMessages = await getChatLatestChat(ctx.db, input.anonymId);

      if (!chatWithMessages || input.newChat) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // 1. Crea una nuova chat nel database
        const [newChat] = await ctx.db
          .insert(chats)
          .values({
            lastUpdate: new Date(),
            messageCount: 1,
            historyContext: [],
            anonymId: input.anonymId,
          })
          .returning({
            chatId: chats.chatId,
          });

        if (!newChat) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Impossibile creare una nuova chat.",
          });
        }

        // 2. Salva il primo messaggio del bot associandolo alla nuova chat
        await ctx.db.insert(messages).values({
          chatId: newChat.chatId,
          text: initialMessage,
          sender: "bot",
          time: new Date(),
        });

        const chatWithMessages = await getChatLatestChat(
          ctx.db,
          input.anonymId,
        );

        return chatWithMessages;
      }

      return chatWithMessages;
    }),
  sendMessage: publicProcedure
    .input(
      z.object({
        text: z.string(),
        anonId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { text } = input;

      const chatWithMessages = await getChatLatestChat(ctx.db, input.anonId);
      if (!chatWithMessages)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });

      // Aggiungo il messaggio dell'utente
      const [userMessage] = await ctx.db
        .insert(messages)
        .values({
          chatId: chatWithMessages.chatId,
          text: input.text,
          sender: "user",
          time: new Date(),
        })
        .returning({
          messageId: messages.messageId,
        });

      await ctx.db
        .update(chats)
        .set({
          messageCount: chatWithMessages.messageCount + 1,
          lastUpdate: new Date(),
        })
        .where(eq(chats.chatId, chatWithMessages.chatId));

      return await chatbotMessage(
        ctx.db,
        chatWithMessages.messages,
        text,
        chatWithMessages.historyContext,
        chatWithMessages.chatId,
        userMessage?.messageId,
      );
    }),
  rateBotMessage: publicProcedure
    .input(
      z.object({
        messageId: z.number().int().positive(),
        vote: z.enum(["up", "down"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const currentMessage = await ctx.db.query.messages.findFirst({
        where: eq(messages.messageId, input.messageId),
      });

      if (!currentMessage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Messaggio non trovato",
        });
      }

      if (currentMessage.sender !== "bot") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "È possibile votare solo i messaggi del bot",
        });
      }

      if (
        !canVoteBotMessage({
          sender: currentMessage.sender,
          text: currentMessage.text,
          meetingMessage: currentMessage.meetingMessage,
          formMessage: currentMessage.formMessage,
        })
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Questo messaggio non può essere votato",
        });
      }

      const [updatedMessage] = await ctx.db
        .update(messages)
        .set({
          botVoteSubmitted: true,
          botVote: input.vote,
          botVoteAt: new Date(),
        })
        .where(eq(messages.messageId, input.messageId))
        .returning({
          messageId: messages.messageId,
          botVoteSubmitted: messages.botVoteSubmitted,
          botVote: messages.botVote,
          botVoteAt: messages.botVoteAt,
        });

      if (!updatedMessage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossibile salvare il voto",
        });
      }

      return updatedMessage;
    }),
  isOnline: publicProcedure.query(async () => {
    const GEMINI_ENDPOINT_API_KEY = process.env.CHATBOT_URL_GEMINI;
    if (!GEMINI_ENDPOINT_API_KEY) {
      // Se l'API key non è impostata, consideriamo il bot offline o mal configurato.
      return {
        online: false,
        message: "Variabile d'ambiente CHATBOT_URL_GEMINI non impostata.",
      };
    }

    try {
      // Tenta di fare una piccola richiesta all'API di Gemini.
      // Non è necessario inviare un prompt complesso, basta una richiesta minima per verificare la connettività.
      const response = await fetch(GEMINI_ENDPOINT_API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
        }),
      });

      if (response.ok) {
        return { online: true, message: "Il chatbot è online e risponde." };
      } else {
        const errorText = await response.text();
        console.error(
          "Gemini API Status Check Error:",
          response.status,
          errorText,
        );
        return {
          online: false,
          message: `Il chatbot è offline o non risponde correttamente (Status: ${response.status}).`,
        };
      }
    } catch (error) {
      console.error("Failed to reach Gemini API for status check:", error);
      return {
        online: false,
        message: "Impossibile raggiungere l'API di Gemini.",
      };
    }
  }),
});
