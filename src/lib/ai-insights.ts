import { insforge } from './insforge';

const GOOGLE_AI_API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;
const MODEL = import.meta.env.VITE_GOOGLE_AI_MODEL || 'gemma-4-31b-it';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const MAX_RETRIES = 3;

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.warn(`${label} attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms...`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

export interface TradeInsight {
  market: string;
  trend: 'up' | 'down' | 'stable';
  growthRate: string;
  recommendation: string;
}

export async function generateMarketInsights(productDesc: string, targetRegion: string): Promise<string> {
  const systemPrompt = 'You are an expert trade consultant for Sri Lankan SMEs.';
  const userPrompt = `Export opportunity: ${productDesc} to ${targetRegion}.

Example of the exact format to follow for "Organic coconut oil to European Union":

Demand for organic coconut oil in the European Union continues to grow as consumers shift toward plant-based, sustainably sourced cooking oils. Germany and the Netherlands lead imports, with the organic segment expanding at 8-10% annually. Seasonal demand peaks align with summer and holiday baking periods.

Most EU member states apply a 0% duty on organic coconut oil under the GSP+ scheme, which Sri Lanka qualifies for. The EU's Farm to Fork strategy further incentivizes organic imports. Rotterdam remains the primary entry port, offering cold-press storage facilities for bulk shipments.

Compliance requires EU Organic Certification through an approved control body, along with compliance to EC 396/2005 on pesticide residue limits. A Certificate of Analysis confirming fatty acid profile and a phytosanitary certificate from the Sri Lanka Export Development Board are standard documentation.

Now write the same format for ${productDesc} to ${targetRegion}. Output exactly 3 paragraphs, no more, no less. Do not include any bullet points, internal checklists, self-evaluations, chain-of-thought reasoning, instructions, explanations, or meta-commentary. Start directly with the first sentence.`;

  if (GOOGLE_AI_API_KEY && MODEL.startsWith('gemini')) {
    return generateWithGoogleAI(systemPrompt, userPrompt);
  }

  return generateWithInsforgeGateway(systemPrompt, userPrompt);
}

async function generateWithGoogleAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`;
  const body = {
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
  };

  return withRetry(async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Google AI API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Google AI returned an empty response.');
    return text;
  }, 'Google AI');
}

async function generateWithInsforgeGateway(systemPrompt: string, userPrompt: string): Promise<string> {
  return withRetry(async () => {
    const response = await insforge.ai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return response.choices[0].message.content;
  }, 'InsForge AI');
}
