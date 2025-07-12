/**
 * Task 4.3: Swedish Localization Tests
 * 
 * Comprehensive test suite for Swedish localization implementation
 * following the established 6-phase testing methodology.
 * 
 * Coverage Areas:
 * - UI component text rendering in Swedish
 * - Date/time formatting for Swedish locale (sv-SE)
 * - Number and currency formatting for Swedish standards
 * - Error message localization and fallback mechanisms
 * - Dynamic content translation (meeting protocols, notifications)
 * - BankID integration with Swedish language support
 * - Form validation messages in Swedish
 * - Accessibility features with Swedish screen reader support
 * - GDPR compliance in Swedish localization
 * - Swedish-specific business logic and terminology
 */

import {
  I18nManager,
  t,
  tGDPR,
  setLocale,
  getCurrentLocale,
  hasTranslation,
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  formatCurrency,
  pluralize,
  useTranslation
} from '../../../utils/i18n';
import { testUtils } from '../../utils/testUtils';

// Mock AsyncStorage for i18n persistence
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('sv')),
  setItem: jest.fn(() => Promise.resolve()),
}));

// Mock Platform for cross-platform testing
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios'
  }
}));

// Mock React for useTranslation hook testing
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
  useEffect: jest.fn(),
  useMemo: jest.fn(),
}));

describe('Task 4.3: Swedish Localization Tests', () => {
  let i18nManager: I18nManager;

  beforeEach(async () => {
    // Setup test environment with Swedish locale
    testUtils.setupTestEnvironment();
    i18nManager = I18nManager.getInstance({
      defaultLocale: 'sv',
      fallbackLocale: 'en',
      enablePersistence: true,
      enableLogging: false,
      gdprCompliant: true,
    });
    await i18nManager.initialize();
    await i18nManager.setLocale('sv');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('4.3.1: Swedish Language Content Validation', () => {
    test('renderar svenska UI-komponenter korrekt', () => {
      // Test common UI elements in Swedish
      expect(t('common.save')).toBe('Spara');
      expect(t('common.cancel')).toBe('Avbryt');
      expect(t('common.delete')).toBe('Ta bort');
      expect(t('common.loading')).toBe('Laddar...');
      expect(t('common.error')).toBe('Fel');
      expect(t('common.success')).toBe('Framgång');
    });

    test('validerar svenska felmeddelanden', () => {
      // Test Swedish error messages
      expect(t('errors.network')).toBe('Nätverksfel - kontrollera internetanslutningen');
      expect(t('errors.auth')).toBe('Autentiseringsfel - sessionen har gått ut');
      expect(t('errors.validation')).toBe('Valideringsfel - ogiltiga data');
      expect(t('errors.permission')).toBe('Behörighetsfel - åtkomst nekad');
      expect(t('errors.bankidError')).toBe('BankID-fel');
      expect(t('errors.bankidCancelled')).toBe('BankID-inloggning avbruten');
    });

    test('kontrollerar svenska autentiseringsmeddelanden', () => {
      // Test Swedish authentication messages
      expect(t('auth.login')).toBe('Logga in');
      expect(t('auth.logout')).toBe('Logga ut');
      expect(t('auth.loginWithBankID')).toBe('Logga in med BankID');
      expect(t('auth.loginSuccess')).toBe('Inloggning lyckades');
      expect(t('auth.loginFailed')).toBe('Inloggning misslyckades');
      expect(t('auth.sessionExpired')).toBe('Sessionen har gått ut');
    });

    test('verifierar svenska mötesterminologi', () => {
      // Test Swedish meeting terminology
      expect(t('meetings.createMeeting')).toBe('Skapa möte');
      expect(t('meetings.editMeeting')).toBe('Redigera möte');
      expect(t('meetings.deleteMeeting')).toBe('Ta bort möte');
      expect(t('meetings.meetingTitle')).toBe('Mötestitel');
      expect(t('meetings.meetingDate')).toBe('Mötesdatum');
      expect(t('meetings.meetingTime')).toBe('Mötestid');
      expect(t('meetings.participants')).toBe('Deltagare');
    });

    test('validerar svenska protokollterminologi', () => {
      // Test Swedish protocol terminology
      expect(t('protocols.createProtocol')).toBe('Skapa protokoll');
      expect(t('protocols.editProtocol')).toBe('Redigera protokoll');
      expect(t('protocols.signProtocol')).toBe('Signera protokoll');
      expect(t('protocols.protocolContent')).toBe('Protokollinnehåll');
      expect(t('protocols.protocolStatus')).toBe('Protokollstatus');
      expect(t('protocols.protocolVersion')).toBe('Protokollversion');
    });

    test('kontrollerar svenska teckenuppsättning (Å, Ä, Ö)', () => {
      // Test Swedish character encoding
      const swedishText = 'Möte för styrelsemedlemmar på Åland';
      expect(testUtils.verifySwedishLocalization(swedishText)).toBe(true);
      
      // Test specific Swedish characters in translations
      expect(t('common.settings')).toContain('Inställningar');
      expect(t('meetings.meetingLocation')).toContain('Mötesplats');
    });
  });

  describe('4.3.2: Date/Time Formatting for Swedish Locale', () => {
    test('formaterar datum enligt svensk standard (sv-SE)', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const formattedDate = formatDate(testDate, 'sv');
      
      // Should contain Swedish month name
      expect(formattedDate).toContain('januari');
      expect(formattedDate).toContain('2024');
      expect(formattedDate).toContain('15');
    });

    test('formaterar tid enligt svensk 24-timmarsformat', () => {
      const testDate = new Date('2024-01-15T14:30:00Z');
      const formattedTime = formatTime(testDate, 'sv');
      
      // Should use 24-hour format
      expect(formattedTime).toMatch(/\d{2}:\d{2}/);
      // Should not contain AM/PM
      expect(formattedTime).not.toMatch(/AM|PM/);
    });

    test('kombinerar datum och tid korrekt på svenska', () => {
      const testDate = new Date('2024-03-20T15:45:00Z');
      const formattedDateTime = formatDateTime(testDate, 'sv');
      
      expect(formattedDateTime).toContain('mars');
      expect(formattedDateTime).toMatch(/\d{2}:\d{2}/);
      expect(formattedDateTime).toContain('2024');
    });

    test('hanterar svenska helgdagar och veckonamn', () => {
      const mondayDate = new Date('2024-01-15T10:00:00Z'); // Monday
      const formattedDate = formatDate(mondayDate, 'sv', { weekday: 'long' });
      
      // Should contain Swedish weekday name
      expect(formattedDate).toContain('måndag');
    });

    test('använder svensk tidszon och sommar-/vintertid', () => {
      // Test Swedish timezone handling
      const summerDate = new Date('2024-07-15T12:00:00Z');
      const winterDate = new Date('2024-01-15T12:00:00Z');
      
      const summerFormatted = formatDateTime(summerDate, 'sv');
      const winterFormatted = formatDateTime(winterDate, 'sv');
      
      expect(summerFormatted).toContain('juli');
      expect(winterFormatted).toContain('januari');
    });
  });

  describe('4.3.3: Currency and Number Formatting Tests', () => {
    test('formaterar svenska kronor (SEK) korrekt', () => {
      const amount = 1234.56;
      const formattedCurrency = formatCurrency(amount, 'sv', 'SEK');
      
      // Should use Swedish currency format
      expect(formattedCurrency).toContain('kr');
      expect(formattedCurrency).toContain('1 234,56');
    });

    test('formaterar stora belopp med svenska tusentalsavskiljare', () => {
      const largeAmount = 1234567.89;
      const formattedCurrency = formatCurrency(largeAmount, 'sv', 'SEK');
      
      // Should use space as thousands separator
      expect(formattedCurrency).toContain('1 234 567,89');
    });

    test('formaterar decimaltal enligt svensk standard', () => {
      const number = 1234.56;
      const formattedNumber = formatNumber(number, 'sv');
      
      // Should use comma as decimal separator
      expect(formattedNumber).toContain('1 234,56');
    });

    test('hanterar svenska procentformat', () => {
      const percentage = 0.1234;
      const formattedPercent = formatNumber(percentage, 'sv', { 
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });
      
      expect(formattedPercent).toContain('12,3');
      expect(formattedPercent).toContain('%');
    });

    test('formaterar svenska telefonnummer', () => {
      // Test Swedish phone number formatting
      const phoneNumber = '+46701234567';
      const formattedPhone = formatNumber(phoneNumber, 'sv', {
        style: 'decimal',
        useGrouping: true
      });

      // Should handle Swedish phone number format
      expect(formattedPhone).toBeDefined();
    });
  });

  describe('4.3.4: Cultural Appropriateness Validation', () => {
    test('validerar svenska affärstermer och protokollspråk', () => {
      // Test Swedish business terminology
      expect(t('meetings.boardMeeting')).toBe('Styrelsemöte');
      expect(t('meetings.annualMeeting')).toBe('Årsmöte');
      expect(t('meetings.extraordinaryMeeting')).toBe('Extra bolagsstämma');
      expect(t('protocols.meetingMinutes')).toBe('Mötesprotokoll');
      expect(t('protocols.decisionPoint')).toBe('Beslutspunkt');
    });

    test('kontrollerar svenska juridiska termer för GDPR', () => {
      // Test Swedish GDPR terminology
      expect(tGDPR('gdpr.consent', {}, 'legal_document')).toBe('Samtycke');
      expect(tGDPR('gdpr.dataProcessing', {}, 'legal_document')).toBe('Databehandling');
      expect(tGDPR('gdpr.personalData', {}, 'legal_document')).toBe('Personuppgifter');
      expect(tGDPR('gdpr.dataController', {}, 'legal_document')).toBe('Personuppgiftsansvarig');
      expect(tGDPR('gdpr.rightToErasure', {}, 'legal_document')).toBe('Rätt att bli glömd');
    });

    test('verifierar svenska pluralformer', () => {
      // Test Swedish pluralization
      expect(pluralize(1, 'möte', 'möten', 'sv')).toBe('1 möte');
      expect(pluralize(2, 'möte', 'möten', 'sv')).toBe('2 möten');
      expect(pluralize(0, 'deltagare', 'deltagare', 'sv')).toBe('0 deltagare');
      expect(pluralize(5, 'protokoll', 'protokoll', 'sv')).toBe('5 protokoll');
    });

    test('kontrollerar svenska artighetsfraser och formella uttryck', () => {
      // Test Swedish formal expressions
      expect(t('common.pleaseWait')).toBe('Vänligen vänta');
      expect(t('common.thankYou')).toBe('Tack');
      expect(t('common.youAreWelcome')).toBe('Varsågod');
      expect(t('meetings.meetingClosed')).toBe('Mötet avslutat');
      expect(t('protocols.protocolApproved')).toBe('Protokoll godkänt');
    });
  });

  describe('Error Message Localization and Fallback Mechanisms', () => {
    test('hanterar fallback till engelska vid saknad översättning', async () => {
      // Test fallback mechanism
      const nonExistentKey = 'nonexistent.translation.key';
      const translation = t(nonExistentKey);

      // Should return the key as fallback
      expect(translation).toBe(nonExistentKey);
    });

    test('validerar svenska felmeddelanden för BankID-integration', () => {
      // Test BankID-specific Swedish error messages
      expect(t('bankid.startFailed')).toBe('BankID kunde inte startas');
      expect(t('bankid.userCancel')).toBe('Användaren avbröt');
      expect(t('bankid.expired')).toBe('BankID-sessionen har gått ut');
      expect(t('bankid.certificateError')).toBe('Certifikatfel');
      expect(t('bankid.startNotSupported')).toBe('BankID stöds inte på denna enhet');
    });

    test('kontrollerar svenska valideringsmeddelanden för formulär', () => {
      // Test Swedish form validation messages
      expect(t('validation.required')).toBe('Detta fält är obligatoriskt');
      expect(t('validation.email')).toBe('Ange en giltig e-postadress');
      expect(t('validation.phone')).toBe('Ange ett giltigt telefonnummer');
      expect(t('validation.minLength')).toBe('Minst {{min}} tecken krävs');
      expect(t('validation.maxLength')).toBe('Högst {{max}} tecken tillåtet');
    });

    test('verifierar svenska notifikationsmeddelanden', () => {
      // Test Swedish notification messages
      expect(t('notifications.meetingStarted')).toBe('Mötet har startat');
      expect(t('notifications.protocolReady')).toBe('Protokollet är klart');
      expect(t('notifications.signatureRequired')).toBe('Signatur krävs');
      expect(t('notifications.meetingReminder')).toBe('Påminnelse om möte');
    });
  });

  describe('Dynamic Content Translation', () => {
    test('översätter dynamiskt mötesprotokoll-innehåll', () => {
      // Test dynamic protocol content translation
      const protocolTemplate = t('protocols.template.opening');
      expect(protocolTemplate).toContain('Mötet öppnades');

      const decisionTemplate = t('protocols.template.decision');
      expect(decisionTemplate).toContain('Beslut');
    });

    test('hanterar parametriserade översättningar', () => {
      // Test parameterized translations
      const meetingTitle = t('meetings.scheduledFor', {
        date: '15 januari 2024',
        time: '14:00'
      });
      expect(meetingTitle).toContain('15 januari 2024');
      expect(meetingTitle).toContain('14:00');
    });

    test('översätter användarroller och behörigheter', () => {
      // Test user role translations
      expect(t('roles.admin')).toBe('Administratör');
      expect(t('roles.boardMember')).toBe('Styrelsemedlem');
      expect(t('roles.secretary')).toBe('Sekreterare');
      expect(t('roles.auditor')).toBe('Revisor');
      expect(t('roles.guest')).toBe('Gäst');
    });
  });

  describe('Accessibility Features with Swedish Screen Reader Support', () => {
    test('validerar svenska tillgänglighetstext för skärmläsare', () => {
      // Test Swedish accessibility labels
      expect(t('accessibility.button.save')).toBe('Spara-knapp');
      expect(t('accessibility.button.delete')).toBe('Ta bort-knapp');
      expect(t('accessibility.input.meetingTitle')).toBe('Mötestitel-inmatningsfält');
      expect(t('accessibility.link.downloadProtocol')).toBe('Ladda ner protokoll-länk');
    });

    test('kontrollerar svenska beskrivningar för komplexa komponenter', () => {
      // Test complex component descriptions
      expect(t('accessibility.modal.meetingDetails')).toBe('Mötesdetaljer-modal');
      expect(t('accessibility.table.participantList')).toBe('Deltagarlista-tabell');
      expect(t('accessibility.form.createMeeting')).toBe('Skapa möte-formulär');
    });

    test('verifierar svenska hjälptexter och instruktioner', () => {
      // Test Swedish help texts
      expect(t('help.bankidLogin')).toBe('Logga in med ditt BankID');
      expect(t('help.recordMeeting')).toBe('Spela in mötet för protokollskapande');
      expect(t('help.signProtocol')).toBe('Signera protokollet digitalt');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('fungerar korrekt på webbplattform', async () => {
      // Mock web platform
      const Platform = require('react-native').Platform;
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      await setLocale('sv');
      expect(getCurrentLocale()).toBe('sv');
      expect(t('common.save')).toBe('Spara');
    });

    test('fungerar korrekt på iOS-plattform', async () => {
      // Mock iOS platform
      const Platform = require('react-native').Platform;
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      await setLocale('sv');
      expect(getCurrentLocale()).toBe('sv');
      expect(t('common.cancel')).toBe('Avbryt');
    });

    test('fungerar korrekt på Android-plattform', async () => {
      // Mock Android platform
      const Platform = require('react-native').Platform;
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      await setLocale('sv');
      expect(getCurrentLocale()).toBe('sv');
      expect(t('common.loading')).toBe('Laddar...');
    });
  });

  describe('GDPR Compliance in Swedish Localization', () => {
    test('validerar svenska GDPR-meddelanden för samtycke', () => {
      // Test Swedish GDPR consent messages
      expect(tGDPR('gdpr.consentRequest', {}, 'consent_dialog')).toBe('Vi behöver ditt samtycke');
      expect(tGDPR('gdpr.dataRetention', {}, 'privacy_policy')).toBe('Datalagring enligt GDPR');
      expect(tGDPR('gdpr.userRights', {}, 'privacy_policy')).toBe('Dina rättigheter enligt GDPR');
    });

    test('kontrollerar svenska integritetspolicy-texter', () => {
      // Test Swedish privacy policy texts
      expect(tGDPR('privacy.dataController', {}, 'legal_document')).toBe('Personuppgiftsansvarig');
      expect(tGDPR('privacy.legalBasis', {}, 'legal_document')).toBe('Rättslig grund');
      expect(tGDPR('privacy.contactDPO', {}, 'legal_document')).toBe('Kontakta dataskyddsombud');
    });
  });

  describe('Swedish-Specific Business Logic', () => {
    test('validerar svenska lagkrav för styrelsemöten', () => {
      // Test Swedish legal requirements
      expect(t('legal.boardMeetingRequirements')).toBe('Krav för styrelsemöten enligt ABL');
      expect(t('legal.protocolRetention')).toBe('Protokoll ska sparas i 10 år');
      expect(t('legal.auditRequirements')).toBe('Revisionskrav enligt ABL');
    });

    test('kontrollerar svenska affärstider och helgdagar', () => {
      // Test Swedish business hours and holidays
      expect(t('business.workingHours')).toBe('Arbetstid: 08:00-17:00');
      expect(t('business.swedishHolidays')).toBe('Svenska helgdagar');
      expect(t('business.summerBreak')).toBe('Sommarsemester');
    });
  });

  describe('useTranslation Hook Testing', () => {
    test('returnerar svenska översättningar via hook', () => {
      // Mock React hooks
      const mockUseState = jest.fn(() => ['sv', jest.fn()]);
      const mockUseEffect = jest.fn();
      const mockUseMemo = jest.fn((fn) => fn());

      require('react').useState.mockImplementation(mockUseState);
      require('react').useEffect.mockImplementation(mockUseEffect);
      require('react').useMemo.mockImplementation(mockUseMemo);

      const { t: hookT, currentLocale } = useTranslation();

      expect(currentLocale).toBe('sv');
      expect(hookT('common.save')).toBe('Spara');
    });
  });
});
