import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gt, gte, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { chats, messages, appointments } from "~/server/db/schema";

export const dashboardRouter = createTRPCRouter({
  getStatistics: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        excludeZeroUserChats: z.boolean().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, excludeZeroUserChats } = input;

      // Costruisci le condizioni WHERE per il filtro temporale
      // Se le date sono fornite, normalizzale per includere l'intera giornata
      const dateConditions = [];
      if (startDate) {
        // Imposta l'inizio della giornata (00:00:00) nel fuso orario locale
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateConditions.push(gte(chats.lastUpdate, start));
      }
      if (endDate) {
        // Imposta la fine della giornata (23:59:59.999) nel fuso orario locale
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateConditions.push(lte(chats.lastUpdate, end));
      }

      const whereClause =
        dateConditions.length > 0 ? and(...dateConditions) : undefined;

      const userMessageCountExpr = sql<number>`COALESCE(SUM(CASE WHEN ${messages.sender} = 'user' THEN 1 ELSE 0 END), 0)`;

      let totalChatsCount = 0;
      let uniqueUsersCount = 0;
      let chatsByDay: Array<{ date: string; count: number }> = [];
      let chatsWithUserMessagesCount = 0;

      if (excludeZeroUserChats) {
        const chatsWithAtLeastOneUserMessage = await ctx.db
          .select({
            chatId: chats.chatId,
            anonymId: chats.anonymId,
            lastUpdate: chats.lastUpdate,
            userMessageCount: userMessageCountExpr,
          })
          .from(chats)
          .leftJoin(messages, eq(messages.chatId, chats.chatId))
          .where(whereClause)
          .groupBy(chats.chatId, chats.anonymId, chats.lastUpdate)
          .having(gt(userMessageCountExpr, 0));

        chatsWithUserMessagesCount = chatsWithAtLeastOneUserMessage.length;
        totalChatsCount = chatsWithAtLeastOneUserMessage.length;
        uniqueUsersCount = new Set(
          chatsWithAtLeastOneUserMessage
            .map((chat) => chat.anonymId)
            .filter((anonymId): anonymId is string => anonymId !== null),
        ).size;

        const chatsByDayMap = chatsWithAtLeastOneUserMessage.reduce(
          (acc, chat) => {
            const date = chat.lastUpdate.toISOString().split("T")[0];
            if (!date) return acc;
            acc.set(date, (acc.get(date) ?? 0) + 1);
            return acc;
          },
          new Map<string, number>(),
        );

        chatsByDay = Array.from(chatsByDayMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, chatCount]) => ({
            date,
            count: chatCount,
          }));
      } else {
        const totalChats = await ctx.db
          .select({ count: count() })
          .from(chats)
          .where(whereClause);

        totalChatsCount = Number(totalChats[0]?.count ?? 0);

        const uniqueUsers = await ctx.db
          .select({
            anonymId: chats.anonymId,
          })
          .from(chats)
          .where(whereClause)
          .groupBy(chats.anonymId);

        uniqueUsersCount = uniqueUsers.filter(
          (u) => u.anonymId !== null,
        ).length;

        const chatsByDayRaw = await ctx.db
          .select({
            date: sql<string>`DATE(${chats.lastUpdate})`,
            count: count(),
          })
          .from(chats)
          .where(whereClause)
          .groupBy(sql`DATE(${chats.lastUpdate})`)
          .orderBy(sql`DATE(${chats.lastUpdate})`);

        chatsByDay = chatsByDayRaw.map((item) => ({
          date: item.date,
          count: Number(item.count),
        }));

        const chatsWithAtLeastOneUserMessage = await ctx.db
          .select({
            chatId: chats.chatId,
          })
          .from(chats)
          .leftJoin(messages, eq(messages.chatId, chats.chatId))
          .where(whereClause)
          .groupBy(chats.chatId)
          .having(gt(userMessageCountExpr, 0));

        chatsWithUserMessagesCount = chatsWithAtLeastOneUserMessage.length;
      }

      // Conta il numero totale di messaggi (solo quelli inviati dagli utenti)
      const messageDateConditions = [eq(messages.sender, "user")];
      if (startDate) {
        // Imposta l'inizio della giornata (00:00:00) nel fuso orario locale
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        messageDateConditions.push(gte(messages.time, start));
      }
      if (endDate) {
        // Imposta la fine della giornata (23:59:59.999) nel fuso orario locale
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        messageDateConditions.push(lte(messages.time, end));
      }

      const messageWhereClause = and(...messageDateConditions);

      const totalMessages = await ctx.db
        .select({ count: count() })
        .from(messages)
        .where(messageWhereClause);

      // Statistiche per giorno (per i grafici)
      const messagesByDay = await ctx.db
        .select({
          date: sql<string>`DATE(${messages.time})`,
          count: count(),
        })
        .from(messages)
        .where(messageWhereClause)
        .groupBy(sql`DATE(${messages.time})`)
        .orderBy(sql`DATE(${messages.time})`);

      // Messaggi per tipo (user vs bot)
      const messagesBySender = await ctx.db
        .select({
          sender: messages.sender,
          count: count(),
        })
        .from(messages)
        .where(messageWhereClause)
        .groupBy(messages.sender);

      // Condizioni per gli appuntamenti
      const appointmentDateConditions = [];
      if (startDate) {
        // Imposta l'inizio della giornata (00:00:00) nel fuso orario locale
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        appointmentDateConditions.push(gte(appointments.createdAt, start));
      }
      if (endDate) {
        // Imposta la fine della giornata (23:59:59.999) nel fuso orario locale
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        appointmentDateConditions.push(lte(appointments.createdAt, end));
      }

      const appointmentWhereClause =
        appointmentDateConditions.length > 0
          ? and(...appointmentDateConditions)
          : undefined;

      // Conta il numero totale di appuntamenti
      const totalAppointments = await ctx.db
        .select({ count: count() })
        .from(appointments)
        .where(appointmentWhereClause);

      // Appuntamenti per area
      const appointmentsByArea = await ctx.db
        .select({
          area: appointments.area,
          count: count(),
        })
        .from(appointments)
        .where(appointmentWhereClause)
        .groupBy(appointments.area);

      // Appuntamenti per giorno
      const appointmentsByDay = await ctx.db
        .select({
          date: sql<string>`DATE(${appointments.createdAt})`,
          count: count(),
        })
        .from(appointments)
        .where(appointmentWhereClause)
        .groupBy(sql`DATE(${appointments.createdAt})`)
        .orderBy(sql`DATE(${appointments.createdAt})`);

      const botVoteDateConditions = [
        eq(messages.sender, "bot"),
        eq(messages.botVoteSubmitted, true),
      ];
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        botVoteDateConditions.push(gte(messages.time, start));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        botVoteDateConditions.push(lte(messages.time, end));
      }

      const botVoteWhereClause = and(...botVoteDateConditions);

      const botVotes = await ctx.db
        .select({
          vote: messages.botVote,
          count: count(),
        })
        .from(messages)
        .where(botVoteWhereClause)
        .groupBy(messages.botVote);

      const upvotes = botVotes.find((vote) => vote.vote === "up")?.count ?? 0;
      const downvotes =
        botVotes.find((vote) => vote.vote === "down")?.count ?? 0;
      const totalVotes = Number(upvotes) + Number(downvotes);

      return {
        totalChats: totalChatsCount,
        chatsWithUserMessages: chatsWithUserMessagesCount,
        totalMessages: totalMessages[0]?.count ?? 0,
        totalAppointments: totalAppointments[0]?.count ?? 0,
        uniqueUsers: uniqueUsersCount,
        feedbackStats: {
          totalVotes,
          upvotes: Number(upvotes),
          downvotes: Number(downvotes),
          positiveRate:
            totalVotes > 0
              ? Math.round((Number(upvotes) / totalVotes) * 100)
              : 0,
        },
        messagesByDay: messagesByDay.map((item) => ({
          date: item.date,
          count: Number(item.count),
        })),
        chatsByDay,
        messagesBySender: messagesBySender.map((item) => ({
          sender: item.sender,
          count: Number(item.count),
        })),
        appointmentsByArea: appointmentsByArea.map((item) => ({
          area: item.area,
          count: Number(item.count),
        })),
        appointmentsByDay: appointmentsByDay.map((item) => ({
          date: item.date,
          count: Number(item.count),
        })),
      };
    }),
  getChatsList: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        sortBy: z.enum(["lastUpdate", "messageCount"]).default("lastUpdate"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        excludeZeroUserChats: z.boolean().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, sortBy, sortOrder, excludeZeroUserChats } =
        input;

      const dateConditions = [];
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateConditions.push(gte(chats.lastUpdate, start));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateConditions.push(lte(chats.lastUpdate, end));
      }

      const whereClause =
        dateConditions.length > 0 ? and(...dateConditions) : undefined;

      const userMessageCountExpr = sql<number>`COALESCE(SUM(CASE WHEN ${messages.sender} = 'user' THEN 1 ELSE 0 END), 0)`;
      const totalMessageCountExpr = sql<number>`COALESCE(COUNT(${messages.messageId}), 0)`;

      const chatsList = excludeZeroUserChats
        ? await ctx.db
            .select({
              chatId: chats.chatId,
              anonymId: chats.anonymId,
              lastUpdate: chats.lastUpdate,
              userMessageCount: userMessageCountExpr,
              totalMessageCount: totalMessageCountExpr,
            })
            .from(chats)
            .leftJoin(messages, eq(messages.chatId, chats.chatId))
            .where(whereClause)
            .groupBy(chats.chatId, chats.anonymId, chats.lastUpdate)
            .having(gt(userMessageCountExpr, 0))
            .orderBy(
              sortBy === "messageCount"
                ? sortOrder === "asc"
                  ? asc(totalMessageCountExpr)
                  : desc(totalMessageCountExpr)
                : sortOrder === "asc"
                  ? asc(chats.lastUpdate)
                  : desc(chats.lastUpdate),
              desc(chats.lastUpdate),
            )
        : await ctx.db
            .select({
              chatId: chats.chatId,
              anonymId: chats.anonymId,
              lastUpdate: chats.lastUpdate,
              userMessageCount: userMessageCountExpr,
              totalMessageCount: totalMessageCountExpr,
            })
            .from(chats)
            .leftJoin(messages, eq(messages.chatId, chats.chatId))
            .where(whereClause)
            .groupBy(chats.chatId, chats.anonymId, chats.lastUpdate)
            .orderBy(
              sortBy === "messageCount"
                ? sortOrder === "asc"
                  ? asc(totalMessageCountExpr)
                  : desc(totalMessageCountExpr)
                : sortOrder === "asc"
                  ? asc(chats.lastUpdate)
                  : desc(chats.lastUpdate),
              desc(chats.lastUpdate),
            );

      return chatsList.map((chat) => ({
        chatId: chat.chatId,
        anonymId: chat.anonymId,
        lastUpdate: chat.lastUpdate,
        userMessageCount: Number(chat.userMessageCount ?? 0),
        totalMessageCount: Number(chat.totalMessageCount ?? 0),
      }));
    }),
  getNegativeFeedbackMessages: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, limit } = input;

      const feedbackConditions = [
        eq(messages.sender, "bot"),
        eq(messages.botVoteSubmitted, true),
        eq(messages.botVote, "down"),
      ];

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        feedbackConditions.push(gte(messages.time, start));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        feedbackConditions.push(lte(messages.time, end));
      }

      const negativeFeedbackMessages = await ctx.db
        .select({
          messageId: messages.messageId,
          chatId: messages.chatId,
          answerText: messages.text,
          answerTime: messages.time,
          voteTime: messages.botVoteAt,
        })
        .from(messages)
        .where(and(...feedbackConditions))
        .orderBy(desc(messages.botVoteAt), desc(messages.time))
        .limit(limit);

      const messagesWithQuestion = await Promise.all(
        negativeFeedbackMessages.map(async (message) => {
          const relatedQuestion = await ctx.db
            .select({
              questionText: messages.text,
            })
            .from(messages)
            .where(
              and(
                eq(messages.chatId, message.chatId),
                eq(messages.sender, "user"),
                lte(messages.time, message.answerTime),
              ),
            )
            .orderBy(desc(messages.time))
            .limit(1);

          return {
            messageId: message.messageId,
            chatId: message.chatId,
            questionText: relatedQuestion[0]?.questionText ?? null,
            answerText: message.answerText,
            answerTime: message.answerTime,
            voteTime: message.voteTime ?? message.answerTime,
          };
        }),
      );

      return messagesWithQuestion;
    }),
  getPositiveFeedbackMessages: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, limit } = input;

      const feedbackConditions = [
        eq(messages.sender, "bot"),
        eq(messages.botVoteSubmitted, true),
        eq(messages.botVote, "up"),
      ];

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        feedbackConditions.push(gte(messages.time, start));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        feedbackConditions.push(lte(messages.time, end));
      }

      const positiveFeedbackMessages = await ctx.db
        .select({
          messageId: messages.messageId,
          chatId: messages.chatId,
          answerText: messages.text,
          answerTime: messages.time,
          voteTime: messages.botVoteAt,
        })
        .from(messages)
        .where(and(...feedbackConditions))
        .orderBy(desc(messages.botVoteAt), desc(messages.time))
        .limit(limit);

      const messagesWithQuestion = await Promise.all(
        positiveFeedbackMessages.map(async (message) => {
          const relatedQuestion = await ctx.db
            .select({
              questionText: messages.text,
            })
            .from(messages)
            .where(
              and(
                eq(messages.chatId, message.chatId),
                eq(messages.sender, "user"),
                lte(messages.time, message.answerTime),
              ),
            )
            .orderBy(desc(messages.time))
            .limit(1);

          return {
            messageId: message.messageId,
            chatId: message.chatId,
            questionText: relatedQuestion[0]?.questionText ?? null,
            answerText: message.answerText,
            answerTime: message.answerTime,
            voteTime: message.voteTime ?? message.answerTime,
          };
        }),
      );

      return messagesWithQuestion;
    }),
  exportQuestionAnswers: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const answerDateConditions = [];
      if (input.startDate) {
        const start = new Date(input.startDate);
        start.setHours(0, 0, 0, 0);
        answerDateConditions.push(gte(messages.time, start));
      }
      if (input.endDate) {
        const end = new Date(input.endDate);
        end.setHours(23, 59, 59, 999);
        answerDateConditions.push(lte(messages.time, end));
      }

      const botAnswerCondition = and(
        eq(messages.sender, "bot"),
        ...answerDateConditions,
      );

      const rows = await ctx.db
        .select({
          chatId: messages.chatId,
          messageId: messages.messageId,
          text: messages.text,
          sender: messages.sender,
          time: messages.time,
          botVote: messages.botVote,
          botVoteAt: messages.botVoteAt,
          legacyFeedback: sql<
            string | null
          >`to_jsonb(${messages}) ->> 'feedback'`,
          legacyNote: sql<string | null>`COALESCE(
            to_jsonb(${messages}) ->> 'note',
            to_jsonb(${messages}) ->> 'feedback_note',
            to_jsonb(${messages}) ->> 'feedbackNote'
          )`,
        })
        .from(messages)
        .where(or(eq(messages.sender, "user"), botAnswerCondition))
        .orderBy(
          asc(messages.chatId),
          asc(messages.time),
          asc(messages.messageId),
        );

      const exportedRows: Array<{
        chatId: number;
        answerMessageId: number;
        questionText: string;
        answerText: string;
        feedback: string | null;
        note: string | null;
        questionTime: Date;
        answerTime: Date;
        feedbackTime: Date | null;
      }> = [];

      let currentChatId: number | null = null;
      let currentQuestion: { text: string; time: Date } | null = null;

      for (const row of rows) {
        if (row.chatId !== currentChatId) {
          currentChatId = row.chatId;
          currentQuestion = null;
        }

        if (row.sender === "user") {
          currentQuestion = { text: row.text, time: row.time };
          continue;
        }

        if (!currentQuestion) continue;

        const feedback =
          row.botVote === "up"
            ? "positivo"
            : row.botVote === "down"
              ? "negativo"
              : row.legacyFeedback === "true"
                ? "positivo"
                : row.legacyFeedback === "false"
                  ? "negativo"
                  : null;

        exportedRows.push({
          chatId: row.chatId,
          answerMessageId: row.messageId,
          questionText: currentQuestion.text,
          answerText: row.text,
          feedback,
          note: row.legacyNote?.trim() ?? null,
          questionTime: currentQuestion.time,
          answerTime: row.time,
          feedbackTime: row.botVoteAt,
        });
      }

      return exportedRows;
    }),
  exportAllChats: publicProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { startDate, endDate } = input;

      const dateConditions = [];
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateConditions.push(gte(chats.lastUpdate, start));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateConditions.push(lte(chats.lastUpdate, end));
      }

      const whereClause =
        dateConditions.length > 0 ? and(...dateConditions) : undefined;

      const userMessageCountExpr = sql<number>`COALESCE(SUM(CASE WHEN ${messages.sender} = 'user' THEN 1 ELSE 0 END), 0)`;

      const chatIds = await ctx.db
        .select({ chatId: chats.chatId })
        .from(chats)
        .leftJoin(messages, eq(messages.chatId, chats.chatId))
        .where(whereClause)
        .groupBy(chats.chatId)
        .having(gt(userMessageCountExpr, 0))
        .orderBy(asc(chats.chatId));

      const allChats = await Promise.all(
        chatIds.map(async ({ chatId }) => {
          const chatMessages = await ctx.db
            .select({
              sender: messages.sender,
              text: messages.text,
              time: messages.time,
            })
            .from(messages)
            .where(eq(messages.chatId, chatId))
            .orderBy(asc(messages.time));

          return {
            chatId,
            messages: chatMessages.map((m) => ({
              sender: m.sender,
              text: m.text,
              time: m.time,
            })),
          };
        }),
      );

      return allChats;
    }),

  getChatDetail: publicProcedure
    .input(z.object({ chatId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const chat = await ctx.db.query.chats.findFirst({
        where: eq(chats.chatId, input.chatId),
        with: {
          messages: {
            orderBy: asc(messages.time),
          },
        },
      });

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat non trovata",
        });
      }

      return {
        chatId: chat.chatId,
        anonymId: chat.anonymId,
        lastUpdate: chat.lastUpdate,
        messages: chat.messages.map((message) => ({
          messageId: message.messageId,
          chatId: message.chatId,
          sender: message.sender,
          text: message.text,
          time: message.time,
          meetingMessage: message.meetingMessage,
          formMessage: message.formMessage,
        })),
      };
    }),
});
