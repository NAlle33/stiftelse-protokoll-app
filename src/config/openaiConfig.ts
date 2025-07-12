/**
 * OpenAI Configuration
 * Configures OpenAI client for Swedish protocol generation
 */

import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY || 'test-key';

export const openaiClient = new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true, // Only for development
});

export const openaiConfig = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  language: 'sv-SE',
  swedishPrompts: true,
  businessTerminology: true,
  legalCompliance: true,
  gdprCompliant: true,
  outputSanitization: true,
};

export default {
  client: openaiClient,
  config: openaiConfig,
};
