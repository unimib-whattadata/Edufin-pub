import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTableCreator,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Funzione per creare tabelle con un prefisso comune, utile per la gestione multi-progetto.
 */
export const createTable = pgTableCreator((name) => `edufin-db_${name}`);

// Definizione dell'ENUM per il sender, per garantire coerenza nei valori
export const senderEnum = pgEnum("sender", ["bot", "user"]);
export const botVoteEnum = pgEnum("bot_vote", ["up", "down"]);

// ENUM per le aree degli appuntamenti
export const appointmentAreaEnum = pgEnum("appointment_area", [
  "PROTEZIONE",
  "PREVIDENZA",
  "FISCALITA",
  "RISPARMIO/INVESTIMENTI",
  "FINANZIAMENTI",
]);

export const chats = createTable(
  "chat",
  (_) => ({
    chatId: serial("chat_id").primaryKey(),
    lastUpdate: timestamp("last_update", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdate(() => new Date()),
    anonymId: text("anonymId"),
    messageCount: integer("messageCount").notNull().default(1),
    historyContext: text("historyContext").array().notNull().default([]),
  }),
  (table) => ({
    anonymIdIdx: index("anonym_id_idx").on(table.anonymId),
  }),
);

export const messages = createTable(
  "message",
  (_) => ({
    messageId: serial("message_id").primaryKey(),
    chatId: serial("chat_id")
      .notNull()
      .references(() => chats.chatId, { onDelete: "cascade" }),
    text: text("text").notNull(),
    sender: senderEnum("sender").notNull(),
    time: timestamp("time", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    formMessage: text("formMessage"),
    meetingMessage: boolean("meetingMessage").notNull().default(false),
    botVoteSubmitted: boolean("botVoteSubmitted").notNull().default(false),
    botVote: botVoteEnum("botVote"),
    botVoteAt: timestamp("botVoteAt", { withTimezone: true }),
  }),
  (table) => ({
    timeIdx: index("time_idx").on(table.time),
  }),
);

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.chatId],
  }),
}));

// Tabella per tracciare gli appuntamenti e le statistiche per area
export const appointments = createTable(
  "appointment",
  (_) => ({
    appointmentId: serial("appointment_id").primaryKey(),
    area: appointmentAreaEnum("area").notNull(),
    userName: text("user_name"),
    userSurname: text("user_surname"),
    userEmail: text("user_email"),
    educatorEmail: text("educator_email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (table) => ({
    areaIdx: index("area_idx").on(table.area),
    createdAtIdx: index("appointment_created_at_idx").on(table.createdAt),
  }),
);
