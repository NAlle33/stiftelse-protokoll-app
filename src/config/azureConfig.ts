/**
 * Azure Configuration
 * Configures Azure services for Swedish language processing
 */

export const azureSpeechConfig = {
  subscriptionKey: process.env.AZURE_SPEECH_KEY || 'test-key',
  region: process.env.AZURE_SPEECH_REGION || 'northeurope',
  language: 'sv-SE',
  endpoint: process.env.AZURE_SPEECH_ENDPOINT || 'https://test.cognitiveservices.azure.com/',
};

export const azureOpenAIConfig = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://test.openai.azure.com/',
  apiKey: process.env.AZURE_OPENAI_API_KEY || 'test-key',
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
  apiVersion: '2024-02-15-preview',
};

export default {
  speech: azureSpeechConfig,
  openai: azureOpenAIConfig,
};
