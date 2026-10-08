interface Content {
    parts: Array<{
        text: string;
    }>;
    role?: string;
}

interface TokenDetails {
    count?: number;
    tokens?: string[];
}

interface Candidate {
    content: Content;
    finishReason: string; // Could be more specific with union types if known
    index?: number; // Sometimes present in API responses
    safetyRatings?: Array<{
        category: string;
        probability: string;
    }>; // Sometimes present
    citationMetadata?: {
        citations?: Array<string>;
    };
    tokenCount?: number;
    avgLogprobs: number;
}

interface UsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    promptTokensDetails: TokenDetails[];
    candidatesTokensDetails: TokenDetails[];
}

export interface GeminiResponse {
    candidates: Candidate[];
    usageMetadata: UsageMetadata;
    modelVersion: string;
    promptFeedback?: {
        blockReason?: string;
        safetyRatings?: Array<{
            category: string;
            probability: string;
        }>;
    };
}