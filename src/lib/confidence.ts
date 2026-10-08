import { compareTwoStrings } from "string-similarity";
import { knowledgeBase, type KnowledgeItem } from "./knowledge";

const MIN_WORD_LENGTH = 3;
const MIN_SUBSTRING_LENGTH = 4;
const SIMILARITY_THRESHOLD_WORD = 0.75;
const MIN_RELIABLE_SCORE = 0.22;
const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.42;

const STOP_WORDS = new Set([
  "a",
  "ad",
  "al",
  "allo",
  "ai",
  "agli",
  "all",
  "alla",
  "alle",
  "anche",
  "che",
  "chi",
  "con",
  "come",
  "cui",
  "da",
  "dal",
  "dallo",
  "dai",
  "dagli",
  "dalla",
  "dalle",
  "dei",
  "degli",
  "del",
  "della",
  "delle",
  "di",
  "dove",
  "e",
  "ed",
  "gli",
  "ha",
  "hai",
  "ho",
  "i",
  "il",
  "in",
  "io",
  "la",
  "le",
  "lo",
  "ma",
  "mi",
  "ne",
  "nel",
  "nella",
  "nelle",
  "nello",
  "non",
  "o",
  "per",
  "piu",
  "quale",
  "quali",
  "quando",
  "quanto",
  "se",
  "sei",
  "sia",
  "sono",
  "su",
  "tra",
  "un",
  "una",
  "uno",
  "voi",
]);

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const unique = (words: string[]): string[] => [...new Set(words)];

const getSignificantWords = (text: string): string[] => {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];

  return unique(
    normalizedText
      .split(" ")
      .filter(
        (word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word),
      ),
  );
};

const isWordMatch = (inputWord: string, targetWord: string): boolean => {
  if (inputWord === targetWord) return true;

  if (
    inputWord.length >= MIN_SUBSTRING_LENGTH &&
    targetWord.length >= MIN_SUBSTRING_LENGTH &&
    (targetWord.includes(inputWord) || inputWord.includes(targetWord))
  ) {
    return true;
  }

  return compareTwoStrings(inputWord, targetWord) >= SIMILARITY_THRESHOLD_WORD;
};

const calculateInputCoverage = (
  userInputWords: string[],
  targetWords: string[],
): number => {
  if (userInputWords.length === 0 || targetWords.length === 0) return 0;

  const matchedInputWords = userInputWords.filter((uWord) =>
    targetWords.some((tWord) => isWordMatch(uWord, tWord)),
  );

  return matchedInputWords.length / userInputWords.length;
};

const calculateBalancedOverlapScore = (
  userInputWords: string[],
  targetWords: string[],
): number => {
  if (userInputWords.length === 0 || targetWords.length === 0) return 0;

  const matchedInputWords = userInputWords.filter((uWord) =>
    targetWords.some((tWord) => isWordMatch(uWord, tWord)),
  );

  if (matchedInputWords.length === 0) return 0;

  const precision = matchedInputWords.length / userInputWords.length;
  const recall = matchedInputWords.length / targetWords.length;

  return (2 * precision * recall) / (precision + recall);
};

const containsNormalizedPhrase = (text: string, phrase: string): boolean => {
  if (!text || !phrase) return false;
  return text.includes(phrase);
};

export type CalculatedConfidence = {
  bestMatch: KnowledgeItem | null;
  confidence: "high" | "medium" | "low";
  matchedTerms: KnowledgeItem[];
  allScores: { term: string; score: number }[];
};

export const calculateConfidence = (userInput: string): CalculatedConfidence => {
  const normalizedUserInput = normalizeText(userInput);
  const userInputWords = getSignificantWords(userInput);

  const scores = knowledgeBase.map((item) => {
    const normalizedTerm = normalizeText(item.term);
    const termWords = getSignificantWords(item.term);

    const termPhraseScore = compareTwoStrings(normalizedUserInput, normalizedTerm);
    const termTokenScore = calculateBalancedOverlapScore(userInputWords, termWords);
    let score = termPhraseScore * 0.55 + termTokenScore * 0.45;

    if (containsNormalizedPhrase(normalizedUserInput, normalizedTerm)) {
      score += 0.25;
    }

    if (
      normalizedUserInput.length >= 6 &&
      containsNormalizedPhrase(normalizedTerm, normalizedUserInput)
    ) {
      score += 0.1;
    }

    if (item.acronym) {
      const normalizedAcronym = normalizeText(item.acronym);
      const acronymWords = getSignificantWords(item.acronym);
      const acronymPhraseScore = compareTwoStrings(
        normalizedUserInput,
        normalizedAcronym,
      );
      const acronymTokenScore = calculateBalancedOverlapScore(
        userInputWords,
        acronymWords,
      );

      score = Math.max(score, acronymPhraseScore * 0.55 + acronymTokenScore * 0.45);

      if (
        containsNormalizedPhrase(normalizedUserInput, normalizedAcronym) ||
        userInputWords.includes(normalizedAcronym)
      ) {
        score += 0.25;
      }
    }

    if (item.keywords && item.keywords.length > 0) {
      const keywordWords = getSignificantWords(item.keywords.join(" "));
      const keywordInputCoverage = calculateInputCoverage(
        userInputWords,
        keywordWords,
      );
      const keywordPhraseScore = Math.max(
        ...item.keywords.map((keyword) =>
          compareTwoStrings(normalizedUserInput, normalizeText(keyword)),
        ),
      );

      score += keywordInputCoverage * 0.35 + keywordPhraseScore * 0.15;

      const containsKeywordPhrase = item.keywords.some((keyword) =>
        containsNormalizedPhrase(normalizedUserInput, normalizeText(keyword)),
      );
      if (containsKeywordPhrase) {
        score += 0.15;
      }
    }

    const definitionWords = getSignificantWords(item.definition);
    const definitionInputCoverage = calculateInputCoverage(
      userInputWords,
      definitionWords,
    );
    score += definitionInputCoverage * 0.18;

    const normalizedDefinition = normalizeText(item.definition);
    if (
      normalizedUserInput.length >= 8 &&
      containsNormalizedPhrase(normalizedDefinition, normalizedUserInput)
    ) {
      score += 0.2;
    }

    return { item, score: Math.min(score, 1.0) };
  });

  const allScoresForOutput = scores.map((s) => ({ term: s.item.term, score: s.score }));
  const sortedScores = scores.sort((a, b) => b.score - a.score);
  const bestScore = sortedScores[0];

  if (!bestScore || bestScore.score < MIN_RELIABLE_SCORE) {
    return {
      bestMatch: null,
      confidence: "low",
      matchedTerms: [],
      allScores: allScoresForOutput,
    };
  }

  let confidence: "high" | "medium" | "low";
  let matchedTerms: KnowledgeItem[];

  if (bestScore.score >= HIGH_CONFIDENCE_THRESHOLD) {
    confidence = "high";
    const cutoff = Math.max(HIGH_CONFIDENCE_THRESHOLD * 0.85, bestScore.score * 0.82);
    matchedTerms = sortedScores
      .filter((s) => s.score >= cutoff)
      .slice(0, 5)
      .map((s) => s.item);
  } else if (bestScore.score >= MEDIUM_CONFIDENCE_THRESHOLD) {
    confidence = "medium";
    const cutoff = Math.max(
      MEDIUM_CONFIDENCE_THRESHOLD * 0.8,
      bestScore.score * 0.78,
    );
    matchedTerms = sortedScores
      .filter((s) => s.score >= cutoff)
      .slice(0, 4)
      .map((s) => s.item);
  } else {
    confidence = "low";
    const cutoff = Math.max(MIN_RELIABLE_SCORE, bestScore.score * 0.9);
    matchedTerms = sortedScores
      .filter((s) => s.score >= cutoff)
      .slice(0, 2)
      .map((s) => s.item);
  }

  if (matchedTerms.length === 0) {
    matchedTerms = [bestScore.item];
  }

  return {
    bestMatch: bestScore.item,
    confidence,
    matchedTerms,
    allScores: allScoresForOutput,
  };
};
