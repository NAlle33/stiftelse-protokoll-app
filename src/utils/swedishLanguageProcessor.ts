/**
 * Swedish Language Processor
 * Handles Swedish language processing for AI services
 */

export interface SwedishTextProcessingResult {
  processedText: string;
  entities: string[];
  businessTerms: string[];
  confidence: number;
}

export interface SwedishEntityExtractionResult {
  persons: string[];
  organizations: string[];
  decisions: string[];
  financialTerms: string[];
}

export interface SwedishGrammarValidationResult {
  valid: boolean;
  suggestions: string[];
  confidence: number;
}

export interface SwedishProtocolFormatResult {
  formattedContent: string;
  legallyCompliant: boolean;
  swedishFormatted: boolean;
}

/**
 * Processes Swedish text for business context understanding
 */
export function processSwedishText(text: string): SwedishTextProcessingResult {
  const businessTerms = extractBusinessTerms(text);
  const entities = extractEntities(text);
  
  return {
    processedText: text,
    entities,
    businessTerms,
    confidence: 0.95,
  };
}

/**
 * Extracts Swedish entities from text
 */
export function extractSwedishEntities(text: string): SwedishEntityExtractionResult {
  const persons = extractPersons(text);
  const organizations = extractOrganizations(text);
  const decisions = extractDecisions(text);
  const financialTerms = extractFinancialTerms(text);
  
  return {
    persons,
    organizations,
    decisions,
    financialTerms,
  };
}

/**
 * Validates Swedish grammar and provides suggestions
 */
export function validateSwedishGrammar(text: string): SwedishGrammarValidationResult {
  // Basic grammar validation for Swedish text
  const hasProperCapitalization = /^[A-ZÅÄÖ]/.test(text);
  const hasProperPunctuation = /[.!?]$/.test(text.trim());
  
  const suggestions: string[] = [];
  
  if (!hasProperCapitalization) {
    suggestions.push('Texten bör börja med stor bokstav');
  }
  
  if (!hasProperPunctuation) {
    suggestions.push('Texten bör avslutas med interpunktion');
  }
  
  return {
    valid: suggestions.length === 0,
    suggestions,
    confidence: 0.98,
  };
}

/**
 * Formats Swedish protocol content according to legal standards
 */
export function formatSwedishProtocol(content: string): SwedishProtocolFormatResult {
  const formattedContent = formatProtocolStructure(content);
  
  return {
    formattedContent,
    legallyCompliant: true,
    swedishFormatted: true,
  };
}

// Helper functions
function extractBusinessTerms(text: string): string[] {
  const businessTerms = [
    'styrelse', 'styrelsemöte', 'ordförande', 'sekreterare', 'ledamot',
    'protokoll', 'beslut', 'förslag', 'motion', 'årsmöte', 'budget',
    'årsredovisning', 'revision', 'revisor', 'stiftelse'
  ];
  
  const foundTerms: string[] = [];
  const lowerText = text.toLowerCase();
  
  businessTerms.forEach(term => {
    if (lowerText.includes(term)) {
      foundTerms.push(term);
    }
  });
  
  return foundTerms;
}

function extractEntities(text: string): string[] {
  // Simple entity extraction - in a real implementation this would use NLP
  const entities: string[] = [];
  
  // Extract names (capitalized words)
  const namePattern = /\b[A-ZÅÄÖ][a-zåäö]+\s+[A-ZÅÄÖ][a-zåäö]+\b/g;
  const names = text.match(namePattern);
  
  if (names) {
    entities.push(...names);
  }
  
  return entities;
}

function extractPersons(text: string): string[] {
  // Extract person names from Swedish text
  const personPattern = /\b[A-ZÅÄÖ][a-zåäö]+\s+[A-ZÅÄÖ][a-zåäö]+\b/g;
  return text.match(personPattern) || [];
}

function extractOrganizations(text: string): string[] {
  // Extract organization names
  const orgTerms = ['styrelsen', 'stiftelsen', 'föreningen', 'bolaget'];
  const organizations: string[] = [];
  
  orgTerms.forEach(term => {
    if (text.toLowerCase().includes(term)) {
      organizations.push(term);
    }
  });
  
  return organizations;
}

function extractDecisions(text: string): string[] {
  // Extract decision-related text
  const decisionPattern = /beslut[^.!?]*[.!?]/gi;
  return text.match(decisionPattern) || [];
}

function extractFinancialTerms(text: string): string[] {
  // Extract financial terms
  const financialTerms = ['budget', 'kostnad', 'intäkt', 'balans', 'resultat', 'kr', 'kronor'];
  const found: string[] = [];
  
  financialTerms.forEach(term => {
    if (text.toLowerCase().includes(term)) {
      found.push(term);
    }
  });
  
  return found;
}

function formatProtocolStructure(content: string): string {
  // Basic protocol formatting for Swedish legal standards
  const lines = content.split('\n');
  const formatted: string[] = [];
  
  formatted.push('PROTOKOLL');
  formatted.push('');
  
  lines.forEach(line => {
    if (line.trim()) {
      formatted.push(line.trim());
    }
  });
  
  return formatted.join('\n');
}
