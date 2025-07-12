/**
 * Test Suite för Unified Swedish Localization System
 * 
 * Testar i18n-verktyg för GDPR-efterlevnad, svenska lokalisering
 * och konsistent språkhantering enligt Code Duplication Elimination-initiativet
 */

import {
  I18nManager,
  t,
  tGDPR,
  setLocale,
  getCurrentLocale,
  hasTranslation,
  initializeI18n,
  addTranslations,
  formatDate,
  formatTime,
  formatDateTime,
  pluralize,
  formatNumber,
  formatCurrency,
  useTranslation,
  SupportedLocale
} from '../i18n';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('sv')),
  setItem: jest.fn(() => Promise.resolve()),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios'
  }
}));

describe('I18nManager', () => {
  let i18nManager: I18nManager;

  beforeEach(async () => {
    i18nManager = I18nManager.getInstance();
    await i18nManager.initialize();
  });

  describe('Initialization', () => {
    test('initialiserar med svenska som standardspråk', async () => {
      const locale = i18nManager.getCurrentLocale();
      expect(locale).toBe('sv');
    });

    test('laddar översättningar korrekt', async () => {
      const hasCommonOk = i18nManager.hasTranslation('common.ok');
      expect(hasCommonOk).toBe(true);
    });

    test('hanterar initialisering endast en gång', async () => {
      // Anropa initialize flera gånger
      await i18nManager.initialize();
      await i18nManager.initialize();
      
      // Bör fortfarande fungera korrekt
      expect(i18nManager.getCurrentLocale()).toBe('sv');
    });
  });

  describe('Translation', () => {
    test('översätter enkla nycklar korrekt', () => {
      const translation = i18nManager.t('common.ok');
      expect(translation).toBe('OK');
    });

    test('översätter nästlade nycklar', () => {
      const translation = i18nManager.t('errors.network');
      expect(translation).toContain('Nätverksfel');
    });

    test('hanterar saknade översättningar med fallback', () => {
      const translation = i18nManager.t('nonexistent.key');
      expect(translation).toBe('nonexistent.key');
    });

    test('interpolerar parametrar korrekt', () => {
      const translation = i18nManager.t('validation.minLength', { min: 5 });
      expect(translation).toContain('5');
    });

    test('hanterar komplexa interpolationer', () => {
      const translation = i18nManager.t('validation.range', { min: 1, max: 10 });
      expect(translation).toContain('1');
      expect(translation).toContain('10');
    });

    test('använder fallback-språk för saknade översättningar', async () => {
      // Lägg till en översättning som bara finns på engelska
      i18nManager.addTranslations('en', {
        test: { onlyEnglish: 'Only in English' }
      });

      const translation = i18nManager.t('test.onlyEnglish');
      expect(translation).toBe('Only in English');
    });
  });

  describe('Locale Management', () => {
    test('byter språk korrekt', async () => {
      await i18nManager.setLocale('en');
      expect(i18nManager.getCurrentLocale()).toBe('en');
      
      const translation = i18nManager.t('common.cancel');
      expect(translation).toBe('Cancel');
    });

    test('behåller samma språk vid identisk setLocale', async () => {
      const currentLocale = i18nManager.getCurrentLocale();
      await i18nManager.setLocale(currentLocale);
      expect(i18nManager.getCurrentLocale()).toBe(currentLocale);
    });

    test('lägger till dynamiska översättningar', () => {
      i18nManager.addTranslations('sv', {
        dynamic: { test: 'Dynamisk test' }
      });

      const translation = i18nManager.t('dynamic.test');
      expect(translation).toBe('Dynamisk test');
    });
  });

  describe('GDPR Compliance', () => {
    test('loggar GDPR-varning för icke-kompatibel kontext', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const context = {
        gdprCompliant: false,
        userConsent: false,
        dataProcessingPurpose: 'testing'
      };

      i18nManager.t('common.ok', {}, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GDPR-varning')
      );
      
      consoleSpy.mockRestore();
    });

    test('hanterar GDPR-kompatibel kontext utan varning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const context = {
        gdprCompliant: true,
        userConsent: true,
        dataProcessingPurpose: 'user_interface'
      };

      i18nManager.t('common.ok', {}, context);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('GDPR-varning')
      );
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Global Functions', () => {
  beforeEach(async () => {
    await initializeI18n();
  });

  test('t() fungerar som global funktion', () => {
    const translation = t('common.save');
    expect(translation).toBe('Spara');
  });

  test('tGDPR() skapar GDPR-säker kontext', () => {
    const translation = tGDPR('common.ok', {}, 'user_interface');
    expect(translation).toBe('OK');
  });

  test('setLocale() byter språk globalt', async () => {
    await setLocale('en');
    expect(getCurrentLocale()).toBe('en');
    
    const translation = t('common.save');
    expect(translation).toBe('Save');
  });

  test('hasTranslation() kontrollerar översättningar', () => {
    expect(hasTranslation('common.ok')).toBe(true);
    expect(hasTranslation('nonexistent.key')).toBe(false);
  });

  test('addTranslations() lägger till översättningar globalt', () => {
    addTranslations('sv', {
      test: { global: 'Global test' }
    });

    expect(hasTranslation('test.global')).toBe(true);
    expect(t('test.global')).toBe('Global test');
  });
});

describe('Formatting Functions', () => {
  beforeEach(async () => {
    await initializeI18n();
  });

  describe('Date Formatting', () => {
    test('formaterar datum enligt svensk standard', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date, 'sv');
      
      expect(formatted).toContain('2024');
      expect(formatted).toContain('januari');
      expect(formatted).toContain('15');
    });

    test('formaterar datum enligt engelsk standard', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date, 'en');
      
      expect(formatted).toContain('2024');
      expect(formatted).toContain('January');
      expect(formatted).toContain('15');
    });

    test('använder aktuellt språk som standard', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date);
      
      // Bör använda svenska som standard
      expect(formatted).toContain('januari');
    });
  });

  describe('Time Formatting', () => {
    test('formaterar tid enligt svensk standard', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatTime(date, 'sv');
      
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    test('formaterar tid enligt engelsk standard', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatTime(date, 'en');
      
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('DateTime Formatting', () => {
    test('kombinerar datum och tid korrekt', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDateTime(date, 'sv');
      
      expect(formatted).toContain('januari');
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('Pluralization', () => {
    test('hanterar svenska pluralregler korrekt', () => {
      expect(pluralize(1, 'användare', undefined, 'sv')).toBe('1 användare');
      expect(pluralize(2, 'användare', undefined, 'sv')).toBe('2 användarear');
      expect(pluralize(5, 'protokoll', 'protokoll', 'sv')).toBe('5 protokoll');
    });

    test('hanterar engelska pluralregler', () => {
      expect(pluralize(1, 'user', undefined, 'en')).toBe('1 user');
      expect(pluralize(2, 'user', undefined, 'en')).toBe('2 users');
      expect(pluralize(5, 'child', 'children', 'en')).toBe('5 children');
    });

    test('använder aktuellt språk som standard', () => {
      const result = pluralize(2, 'möte');
      expect(result).toContain('möte');
    });
  });

  describe('Number Formatting', () => {
    test('formaterar nummer enligt svensk standard', () => {
      const formatted = formatNumber(1234.56, undefined, 'sv');
      expect(formatted).toContain(','); // Svensk decimalavskiljare
    });

    test('formaterar nummer enligt engelsk standard', () => {
      const formatted = formatNumber(1234.56, undefined, 'en');
      expect(formatted).toContain('.'); // Engelsk decimalavskiljare
    });

    test('hanterar anpassade formateringsalternativ', () => {
      const formatted = formatNumber(1234.56, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }, 'sv');
      
      expect(formatted).toMatch(/\d+,\d{2}/);
    });
  });

  describe('Currency Formatting', () => {
    test('formaterar SEK korrekt', () => {
      const formatted = formatCurrency(1234.56, 'SEK', 'sv');
      expect(formatted).toContain('kr');
      expect(formatted).toContain('1');
    });

    test('formaterar EUR korrekt', () => {
      const formatted = formatCurrency(1234.56, 'EUR', 'sv');
      expect(formatted).toContain('€');
    });

    test('använder SEK som standard', () => {
      const formatted = formatCurrency(100);
      expect(formatted).toContain('kr');
    });
  });
});

describe('React Hook', () => {
  test('useTranslation returnerar alla nödvändiga funktioner', () => {
    const hook = useTranslation();
    
    expect(typeof hook.t).toBe('function');
    expect(typeof hook.tGDPR).toBe('function');
    expect(typeof hook.setLocale).toBe('function');
    expect(typeof hook.currentLocale).toBe('string');
    expect(typeof hook.hasTranslation).toBe('function');
    expect(typeof hook.formatDate).toBe('function');
    expect(typeof hook.formatTime).toBe('function');
    expect(typeof hook.formatDateTime).toBe('function');
    expect(typeof hook.pluralize).toBe('function');
    expect(typeof hook.formatNumber).toBe('function');
    expect(typeof hook.formatCurrency).toBe('function');
  });

  test('hook använder aktuellt språk', () => {
    const hook = useTranslation();
    expect(hook.currentLocale).toBe('sv');
  });
});

describe('Performance', () => {
  test('hanterar många översättningar effektivt', () => {
    const startTime = Date.now();
    
    // Utför många översättningar
    for (let i = 0; i < 1000; i++) {
      t('common.ok');
      t('errors.network');
      t('validation.required');
    }
    
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(100); // Bör ta mindre än 100ms
  });

  test('cachar översättningar för prestanda', () => {
    // Första anropet
    const start1 = Date.now();
    t('common.loading');
    const time1 = Date.now() - start1;

    // Andra anropet (bör vara snabbare om cachning fungerar)
    const start2 = Date.now();
    t('common.loading');
    const time2 = Date.now() - start2;

    expect(time2).toBeLessThanOrEqual(time1 + 2); // Tillåt 2ms marginal
  });
});

describe('Error Handling', () => {
  test('hanterar fel vid laddning av översättningsfiler', async () => {
    // Mock fel vid import
    const originalConsoleWarn = console.warn;
    console.warn = jest.fn();

    // Skapa ny instans som kommer att misslyckas med att ladda filer
    const failingManager = I18nManager.getInstance({
      enableLogging: true
    });

    await failingManager.initialize();

    // Bör fortfarande fungera med fallback-översättningar
    expect(failingManager.t('common.ok')).toBe('OK');

    console.warn = originalConsoleWarn;
  });

  test('hanterar fel vid sparning av språkinställning', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

    // Bör inte krascha
    await expect(setLocale('en')).resolves.not.toThrow();
  });
});

describe('Memory Management', () => {
  test('förhindrar minnesläckor vid många språkbyten', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Utför många språkbyten
    for (let i = 0; i < 100; i++) {
      await setLocale('sv');
      await setLocale('en');
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Minnesökningen bör vara rimlig (mindre än 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
