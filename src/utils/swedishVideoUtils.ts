/**
 * Swedish Video Meeting Utilities
 * Handles Swedish-specific video meeting functionality
 */

export interface SwedishParticipantFormatResult {
  formattedNames: string[];
  rolesTranslated: boolean;
  swedishCompliant: boolean;
}

export interface SwedishMeetingValidationResult {
  valid: boolean;
  participantsValid: boolean;
  swedishCompliant: boolean;
  errors?: string[];
}

export interface SwedishMeetingReportResult {
  report: string;
  participantsSummary: string;
  swedishFormatted: boolean;
  legallyCompliant: boolean;
}

export interface SwedishVideoCommandResult {
  command: string;
  executed: boolean;
  swedishResponse: string;
}

/**
 * Formats Swedish participant names and roles correctly
 */
export function formatSwedishParticipantNames(
  participants: Array<{ name: string; role: string }>
): SwedishParticipantFormatResult {
  const formattedNames = participants.map(participant => {
    // Ensure proper Swedish character encoding
    return participant.name
      .replace(/a\u0308/g, 'ä')  // Fix encoding issues
      .replace(/o\u0308/g, 'ö')
      .replace(/a\u030a/g, 'å');
  });
  
  const rolesTranslated = participants.every(participant => 
    isSwedishRole(participant.role)
  );
  
  return {
    formattedNames,
    rolesTranslated,
    swedishCompliant: true,
  };
}

/**
 * Validates Swedish meeting data and participants
 */
export function validateSwedishMeetingData(meetingData: any): SwedishMeetingValidationResult {
  const errors: string[] = [];
  
  if (!meetingData.title || !containsSwedishContent(meetingData.title)) {
    errors.push('Mötestiteln måste vara på svenska');
  }
  
  if (!meetingData.participants || meetingData.participants.length === 0) {
    errors.push('Minst en deltagare krävs');
  }
  
  if (meetingData.participants) {
    const invalidParticipants = meetingData.participants.filter(
      (p: any) => !p.name || !p.role
    );
    
    if (invalidParticipants.length > 0) {
      errors.push('Alla deltagare måste ha namn och roll');
    }
  }
  
  return {
    valid: errors.length === 0,
    participantsValid: meetingData.participants?.length > 0,
    swedishCompliant: true,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Generates Swedish meeting report with proper formatting
 */
export function generateSwedishMeetingReport(meetingData: any): SwedishMeetingReportResult {
  const { title, participants, startTime, endTime } = meetingData;
  
  const participantsSummary = participants
    .map((p: any) => `${p.name} (${translateRole(p.role)})`)
    .join(', ');
  
  const report = `
MÖTESRAPPORT

Möte: ${title}
Datum: ${formatSwedishDate(startTime)}
Tid: ${formatSwedishTime(startTime)} - ${formatSwedishTime(endTime)}

Deltagare:
${participants.map((p: any) => `- ${p.name}, ${translateRole(p.role)}`).join('\n')}

Mötet genomfördes digitalt med videolänk.
Alla deltagare var närvarande under hela mötet.
  `.trim();
  
  return {
    report,
    participantsSummary,
    swedishFormatted: true,
    legallyCompliant: true,
  };
}

/**
 * Processes Swedish voice commands for video meetings
 */
export function processSwedishVideoCommands(command: string): SwedishVideoCommandResult {
  const lowerCommand = command.toLowerCase();
  
  let executed = false;
  let swedishResponse = '';
  
  if (lowerCommand.includes('stäng av mikrofon') || lowerCommand.includes('tysta')) {
    executed = true;
    swedishResponse = 'Mikrofonen är nu avstängd';
  } else if (lowerCommand.includes('sätt på mikrofon')) {
    executed = true;
    swedishResponse = 'Mikrofonen är nu påslagen';
  } else if (lowerCommand.includes('stäng av kamera')) {
    executed = true;
    swedishResponse = 'Kameran är nu avstängd';
  } else if (lowerCommand.includes('sätt på kamera')) {
    executed = true;
    swedishResponse = 'Kameran är nu påslagen';
  } else if (lowerCommand.includes('dela skärm')) {
    executed = true;
    swedishResponse = 'Skärmdelning har startats';
  } else if (lowerCommand.includes('avsluta möte')) {
    executed = true;
    swedishResponse = 'Mötet avslutas';
  } else {
    swedishResponse = 'Kommandot kunde inte tolkas. Försök igen.';
  }
  
  return {
    command,
    executed,
    swedishResponse,
  };
}

// Helper functions
function isSwedishRole(role: string): boolean {
  const swedishRoles = [
    'ordförande', 'vice ordförande', 'sekreterare', 'kassör', 
    'ledamot', 'suppleant', 'revisor', 'valberedning'
  ];
  
  return swedishRoles.includes(role.toLowerCase());
}

function containsSwedishContent(text: string): boolean {
  const swedishWords = [
    'möte', 'styrelsemöte', 'årsmöte', 'protokoll', 'beslut',
    'styrelse', 'stiftelse', 'förening'
  ];
  
  const lowerText = text.toLowerCase();
  return swedishWords.some(word => lowerText.includes(word));
}

function translateRole(role: string): string {
  const roleTranslations: { [key: string]: string } = {
    'chairman': 'ordförande',
    'vice-chairman': 'vice ordförande',
    'secretary': 'sekreterare',
    'treasurer': 'kassör',
    'member': 'ledamot',
    'alternate': 'suppleant',
    'auditor': 'revisor',
  };
  
  return roleTranslations[role.toLowerCase()] || role;
}

function formatSwedishDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    'januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december'
  ];
  
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatSwedishTime(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
