/// <reference types="vite/client" />
import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { EvidenceSignal, Hypothesis } from '../db/models';

export interface ExtractedEvidence {
  classification: string;
  statement: string;
  exactExcerpt: string;
  isDirect: boolean;
  hypothesisId: string | null;
  relationship: EvidenceSignal['relationship'];
}

export interface GeneratedInterviewQuestion {
  question: string;
  rationale: string;
  targetHypothesis: string;
}

function getApiKey(): string | null {
  // First check local storage for user-provided key
  const localKey = localStorage.getItem('validation_ledger_gemini_key');
  if (localKey) return localKey;

  // Fallback to env variable
  return import.meta.env.VITE_GEMINI_API_KEY || null;
}

function parseJsonArray<T>(value: string, isValidItem: (item: unknown) => item is T): T[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(isValidItem)) {
    throw new Error('AI returned data in an unexpected format. Please try again.');
  }
  return parsed;
}

function isExtractedEvidence(item: unknown): item is ExtractedEvidence {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  return typeof candidate.classification === 'string'
    && typeof candidate.statement === 'string'
    && typeof candidate.exactExcerpt === 'string'
    && typeof candidate.isDirect === 'boolean'
    && (candidate.hypothesisId === null || candidate.hypothesisId === undefined || typeof candidate.hypothesisId === 'string')
    && (candidate.relationship === null || candidate.relationship === undefined || ['supports', 'contradicts', 'neutral'].includes(String(candidate.relationship)));
}

function isGeneratedQuestion(item: unknown): item is GeneratedInterviewQuestion {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  return typeof candidate.question === 'string'
    && typeof candidate.rationale === 'string'
    && typeof candidate.targetHypothesis === 'string';
}

export async function extractEvidence(text: string, hypotheses: Hypothesis[]): Promise<ExtractedEvidence[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key found. Please configure it in Settings.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const hypothesisContext = hypotheses.map(h => `- [ID: ${h.id}] ${h.statement}`).join('\n');

  const prompt = `
You are an expert product researcher. Analyze the following source material (interview transcript, email, or notes).
Extract discrete, atomic pieces of evidence (Evidence Signals).

Rules for extraction:
1. ONLY extract evidence that is actually present in the text. Do not invent details.
2. Differentiate between direct statements ("isDirect": true) and your reasonable inferences ("isDirect": false).
3. Always include the 'exactExcerpt' that supports your extraction so the user can verify provenance.
4. Try to map evidence to the provided Hypotheses if relevant. If not relevant, leave hypothesisId null.
5. Identify the relationship (supports, contradicts, neutral) if linked to a hypothesis.

Current Hypotheses:
${hypothesisContext || 'None provided yet.'}

Source Material:
${text}
`;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        classification: {
          type: Type.STRING,
          description: "One of: pain, workaround, feature_request, willingness_to_pay, objection, positive_reaction, current_solution, other"
        },
        statement: {
          type: Type.STRING,
          description: "A concise summary of the observation"
        },
        exactExcerpt: {
          type: Type.STRING,
          description: "The exact quote from the source material that supports this observation"
        },
        isDirect: {
          type: Type.BOOLEAN,
          description: "True if the participant directly stated this, False if it is an inference"
        },
        hypothesisId: {
          type: Type.STRING,
          description: "The ID of the related hypothesis, or null if unrelated",
          nullable: true
        },
        relationship: {
          type: Type.STRING,
          description: "One of: supports, contradicts, neutral",
          nullable: true
        }
      },
      required: ["classification", "statement", "exactExcerpt", "isDirect"]
    }
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.2
    }
  });

  if (!response.text) {
    throw new Error('AI returned an empty response.');
  }

  return parseJsonArray(response.text, isExtractedEvidence);
}

export async function generateInterviewQuestions(gaps: Hypothesis[]): Promise<GeneratedInterviewQuestion[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key found. Please configure it in Settings.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const gapContext = gaps.map(h => `- ${h.statement} (Importance: ${h.importance})`).join('\n');

  const prompt = `
You are an expert product researcher. Based on the following unvalidated hypotheses (validation gaps), generate a short list of the highest-value interview questions to ask the next participant.

Rules:
1. Questions should reduce uncertainty, not produce flattering responses.
2. Avoid leading questions (e.g. "Wouldn't X be valuable?").
3. Prefer questions about past behavior, actual spending, and current workarounds.
4. Each question MUST target at least one specific hypothesis.

Validation Gaps:
${gapContext}
`;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        rationale: { type: Type.STRING },
        targetHypothesis: { type: Type.STRING }
      },
      required: ["question", "rationale", "targetHypothesis"]
    }
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.4
    }
  });

  if (!response.text) {
    throw new Error('AI returned an empty response.');
  }

  return parseJsonArray(response.text, isGeneratedQuestion);
}
