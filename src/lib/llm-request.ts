import type { GeminiResponse } from "~/server/api/types";
import { calculateConfidence } from "~/lib/confidence";

interface Message {
  sender: "user" | "bot";
  text: string;
  chatId: number;
  messageId: number;
  time: Date;
}

const CONTEXT_WINDOW = 5;

const generatePrompt = (
  historyText: string,
  historyContextString: string,
  knowledgeContext: string,
  text: string,
) => {
  // The production system prompt is withheld from the public research release.
  const systemPrompt = process.env.AIDA_SYSTEM_PROMPT?.trim();
  if (!systemPrompt) {
    throw new Error(
      "AIDA_SYSTEM_PROMPT is not set. The production prompt is not included in this public repository.",
    );
  }

  const prompt = `${systemPrompt}

# CRONOLOGIA CONVERSAZIONE
${historyText || "Nessuna cronologia precedente"}

# CRONOLOGIA CONTESTI PRECEDENTI
${historyContextString || "Nessun contesto di cronologia precedente"}

# CONTESTO CONOSCITIVO ATTIVO
${knowledgeContext || "Nessun termine specifico identificato"}

# DOMANDA ATTUALE
"${text}"

# RISPOSTA:`;
  return prompt;
};

const buildInput = (
  messages: Message[],
  historyContext: string[],
  text: string,
  knowledgeContext: string,
) => {
  // Limita il contesto agli ultimi 5 messaggi
  const lastMessages = messages.slice(-CONTEXT_WINDOW);
  const geminiHistory =
    lastMessages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    })) ?? [];

  const historyText = lastMessages
    .map(
      (msg) =>
        `${msg.sender === "user" ? "Utente" : "Assistente"}: ${msg.text}`,
    )
    .join("\n");

  // Limita il contesto della cronologia ai 5 più recenti
  const historyContextString = historyContext
    .slice(-CONTEXT_WINDOW)
    .map((historyContext) => historyContext)
    .join("\n");

  const prompt = generatePrompt(
    historyText,
    historyContextString,
    knowledgeContext,
    text,
  );

  const contents = [
    ...geminiHistory,
    { role: "user", parts: [{ text: prompt }] },
  ];

  return contents;
};

export const callLLM = async (
  messages: Message[],
  historyContext: string[],
  text: string,
) => {
  const confidenceResult = calculateConfidence(text);
  const { bestMatch, matchedTerms } = confidenceResult;

  const allMatchedTerms = [...matchedTerms];
  if (bestMatch && !allMatchedTerms.some((t) => t.term === bestMatch.term)) {
    allMatchedTerms.push(bestMatch);
  }

  const knowledgeContext = allMatchedTerms
    .map((entry) => {
      let termContext = `Termine: "${entry.term}", Definizione: "${entry.definition}"`;
      if (entry.links && entry.links.length > 0) {
        const linksStr = entry.links
          .map(
            (link) =>
              `* **${link.source}**: [Approfondisci qui](${link.url})\n  _${link.description}_`,
          )
          .join("\n");
        termContext += `\nLink correlati:\n${linksStr}`;
      }
      return termContext;
    })
    .join("\n\n");

  const GEMINI_ENDPOINT_API_KEY = process.env.CHATBOT_URL_GEMINI;
  if (!GEMINI_ENDPOINT_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const contents = buildInput(messages, historyContext, text, knowledgeContext);

  const response = await fetch(GEMINI_ENDPOINT_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    console.error("Gemini API Error:", await response.text());
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const result = (await response.json()) as GeminiResponse;
  const botResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  return {
    response: botResponseText,
    confidenceScore: confidenceResult.confidence,
    matchedEntry: confidenceResult.bestMatch,
    allScores: confidenceResult.allScores,
    knowledgeContext: knowledgeContext,
  };
};
