/**
 * Unified Swedish Localization System - SÖKA Stiftelseappen
 * 
 * Konsoliderar all svensk lokalisering från hela applikationen
 * för att eliminera hårdkodad text och säkerställa konsistent
 * språkhantering med GDPR-efterlevnad och dynamisk språkväxling.
 * 
 * Del av Code Duplication Elimination-initiativet
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleError } from './errorHandling';

/**
 * Tillgängliga språk
 */
export type SupportedLocale = 'sv' | 'en';

/**
 * Lokaliserings-kontext för GDPR-efterlevnad
 */
export interface LocalizationContext {
  gdprCompliant: boolean;
  userConsent: boolean;
  dataProcessingPurpose: string;
  retentionPeriod?: string;
}

/**
 * Interpolationsparametrar för meddelanden
 */
export interface InterpolationParams {
  [key: string]: string | number | boolean;
}

/**
 * Lokaliserings-konfiguration
 */
export interface I18nConfig {
  defaultLocale: SupportedLocale;
  fallbackLocale: SupportedLocale;
  enablePersistence: boolean;
  enableLogging: boolean;
  gdprCompliant: boolean;
}

/**
 * Huvudklass för internationalisering
 */
export class I18nManager {
  private static instance: I18nManager;
  private currentLocale: SupportedLocale = 'sv';
  private translations: Record<SupportedLocale, Record<string, any>> = {
    sv: {},
    en: {},
  };
  private config: I18nConfig;
  private isInitialized: boolean = false;
  private storageKey = '@soka_app_locale';

  private constructor(config: Partial<I18nConfig> = {}) {
    this.config = {
      defaultLocale: 'sv',
      fallbackLocale: 'en',
      enablePersistence: true,
      enableLogging: false,
      gdprCompliant: true,
      ...config,
    };
  }

  /**
   * Singleton-instans för global lokalisering
   */
  public static getInstance(config?: Partial<I18nConfig>): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager(config);
    }
    return I18nManager.instance;
  }

  /**
   * Initialiserar lokaliseringssystemet
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ladda sparad språkinställning
      if (this.config.enablePersistence) {
        await this.loadPersistedLocale();
      }

      // Ladda översättningar
      await this.loadTranslations();

      this.isInitialized = true;
      
      if (this.config.enableLogging) {
        console.log(`🌍 I18n initialiserad med språk: ${this.currentLocale}`);
      }
    } catch (error) {
      handleError(
        error as Error,
        'initialize',
        'I18nManager'
      );
      
      // Fallback till standardspråk
      this.currentLocale = this.config.defaultLocale;
      this.isInitialized = true;
    }
  }

  /**
   * Hämtar översatt text med interpolation
   */
  public t(
    key: string,
    params?: InterpolationParams,
    context?: LocalizationContext
  ): string {
    if (!this.isInitialized) {
      console.warn('I18n inte initialiserad, använder fallback');
      return key;
    }

    // GDPR-kontroll
    if (this.config.gdprCompliant && context && !context.gdprCompliant) {
      console.warn(`GDPR-varning: Översättning för "${key}" kanske inte är GDPR-kompatibel`);
    }

    const translation = this.getTranslation(key);
    
    if (!translation) {
      if (this.config.enableLogging) {
        console.warn(`Översättning saknas för nyckel: ${key}`);
      }
      return key; // Returnera nyckeln som fallback
    }

    // Interpolera parametrar
    return this.interpolate(translation, params);
  }

  /**
   * Hämtar översättning för given nyckel
   */
  private getTranslation(key: string): string | undefined {
    const keys = key.split('.');
    let current = this.translations[this.currentLocale];

    // Navigera genom nyckelstrukturen
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Försök med fallback-språk
        current = this.translations[this.config.fallbackLocale];
        for (const fallbackKey of keys) {
          if (current && typeof current === 'object' && fallbackKey in current) {
            current = current[fallbackKey];
          } else {
            return undefined;
          }
        }
        break;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Interpolerar parametrar i översättningstext
   */
  private interpolate(text: string, params?: InterpolationParams): string {
    if (!params) return text;

    let result = text;
    Object.entries(params).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return result;
  }

  /**
   * Byter språk
   */
  public async setLocale(locale: SupportedLocale): Promise<void> {
    if (locale === this.currentLocale) return;

    this.currentLocale = locale;

    // Spara språkinställning
    if (this.config.enablePersistence) {
      await this.persistLocale(locale);
    }

    if (this.config.enableLogging) {
      console.log(`🌍 Språk bytt till: ${locale}`);
    }
  }

  /**
   * Hämtar aktuellt språk
   */
  public getCurrentLocale(): SupportedLocale {
    return this.currentLocale;
  }

  /**
   * Kontrollerar om en översättning finns
   */
  public hasTranslation(key: string): boolean {
    return this.getTranslation(key) !== undefined;
  }

  /**
   * Lägger till översättningar dynamiskt
   */
  public addTranslations(
    locale: SupportedLocale,
    translations: Record<string, any>
  ): void {
    this.translations[locale] = {
      ...this.translations[locale],
      ...translations,
    };
  }

  /**
   * Laddar sparad språkinställning
   */
  private async loadPersistedLocale(): Promise<void> {
    try {
      const savedLocale = await AsyncStorage.getItem(this.storageKey);
      if (savedLocale && (savedLocale === 'sv' || savedLocale === 'en')) {
        this.currentLocale = savedLocale as SupportedLocale;
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.warn('Kunde inte ladda sparad språkinställning:', error);
      }
    }
  }

  /**
   * Sparar språkinställning
   */
  private async persistLocale(locale: SupportedLocale): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, locale);
    } catch (error) {
      if (this.config.enableLogging) {
        console.warn('Kunde inte spara språkinställning:', error);
      }
    }
  }

  /**
   * Laddar översättningar från lokala filer
   */
  private async loadTranslations(): Promise<void> {
    try {
      // Ladda svenska översättningar
      const swedishTranslations = await import('../locales/sv.json');
      this.translations.sv = swedishTranslations.default || swedishTranslations;

      // Ladda engelska översättningar (fallback)
      const englishTranslations = await import('../locales/en.json');
      this.translations.en = englishTranslations.default || englishTranslations;
    } catch (error) {
      if (this.config.enableLogging) {
        console.warn('Kunde inte ladda översättningsfiler:', error);
      }
      
      // Använd inbyggda fallback-översättningar
      this.loadFallbackTranslations();
    }
  }

  /**
   * Laddar inbyggda fallback-översättningar
   */
  private loadFallbackTranslations(): void {
    this.translations.sv = {
      common: {
        ok: 'OK',
        cancel: 'Avbryt',
        save: 'Spara',
        delete: 'Ta bort',
        edit: 'Redigera',
        loading: 'Laddar...',
        error: 'Fel',
        success: 'Framgång',
        warning: 'Varning',
        info: 'Information',
      },
      errors: {
        network: 'Nätverksfel - kontrollera internetanslutningen',
        auth: 'Autentiseringsfel - sessionen har gått ut',
        validation: 'Valideringsfel - ogiltiga data',
        permission: 'Behörighetsfel - åtkomst nekad',
        unknown: 'Ett okänt fel uppstod',
      },
      gdpr: {
        consent: 'Samtycke',
        dataProcessing: 'Databehandling',
        personalData: 'Personuppgifter',
        rightToErasure: 'Rätt att bli glömd',
        dataRetention: 'Datalagring',
        auditTrail: 'Revisionsspår',
      },
    };

    this.translations.en = {
      common: {
        ok: 'OK',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        warning: 'Warning',
        info: 'Information',
      },
      errors: {
        network: 'Network error - check internet connection',
        auth: 'Authentication error - session expired',
        validation: 'Validation error - invalid data',
        permission: 'Permission error - access denied',
        unknown: 'An unknown error occurred',
      },
      gdpr: {
        consent: 'Consent',
        dataProcessing: 'Data Processing',
        personalData: 'Personal Data',
        rightToErasure: 'Right to Erasure',
        dataRetention: 'Data Retention',
        auditTrail: 'Audit Trail',
      },
    };
  }
}

/**
 * Globala hjälpfunktioner för enkel användning
 */

/**
 * Hämtar översatt text - huvudfunktion för komponenter
 */
export function t(
  key: string,
  params?: InterpolationParams,
  context?: LocalizationContext
): string {
  return I18nManager.getInstance().t(key, params, context);
}

/**
 * Byter språk globalt
 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  return I18nManager.getInstance().setLocale(locale);
}

/**
 * Hämtar aktuellt språk
 */
export function getCurrentLocale(): SupportedLocale {
  return I18nManager.getInstance().getCurrentLocale();
}

/**
 * Kontrollerar om översättning finns
 */
export function hasTranslation(key: string): boolean {
  return I18nManager.getInstance().hasTranslation(key);
}

/**
 * Initialiserar lokaliseringssystemet
 */
export async function initializeI18n(config?: Partial<I18nConfig>): Promise<void> {
  const manager = I18nManager.getInstance(config);
  return manager.initialize();
}

/**
 * Lägger till översättningar dynamiskt
 */
export function addTranslations(
  locale: SupportedLocale,
  translations: Record<string, any>
): void {
  return I18nManager.getInstance().addTranslations(locale, translations);
}

/**
 * GDPR-säker översättningsfunktion
 */
export function tGDPR(
  key: string,
  params?: InterpolationParams,
  dataProcessingPurpose: string = 'user_interface'
): string {
  const context: LocalizationContext = {
    gdprCompliant: true,
    userConsent: true,
    dataProcessingPurpose,
  };

  return t(key, params, context);
}

/**
 * Formaterar datum enligt svensk standard
 */
export function formatDate(date: Date, locale?: SupportedLocale): string {
  const currentLocale = locale || getCurrentLocale();

  if (currentLocale === 'sv') {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formaterar tid enligt svensk standard
 */
export function formatTime(date: Date, locale?: SupportedLocale): string {
  const currentLocale = locale || getCurrentLocale();

  if (currentLocale === 'sv') {
    return date.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formaterar datum och tid enligt svensk standard
 */
export function formatDateTime(date: Date, locale?: SupportedLocale): string {
  return `${formatDate(date, locale)} ${formatTime(date, locale)}`;
}

/**
 * Pluralisering för svenska
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
  locale?: SupportedLocale
): string {
  const currentLocale = locale || getCurrentLocale();

  if (currentLocale === 'sv') {
    // Svenska pluralregler
    if (count === 1) {
      return `${count} ${singular}`;
    }
    return `${count} ${plural || singular + 'ar'}`;
  }

  // Engelska pluralregler
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${plural || singular + 's'}`;
}

/**
 * Formaterar nummer enligt svensk standard
 */
export function formatNumber(
  number: number,
  options?: Intl.NumberFormatOptions,
  locale?: SupportedLocale
): string {
  const currentLocale = locale || getCurrentLocale();
  const localeCode = currentLocale === 'sv' ? 'sv-SE' : 'en-US';

  return new Intl.NumberFormat(localeCode, options).format(number);
}

/**
 * Formaterar valuta enligt svensk standard
 */
export function formatCurrency(
  amount: number,
  currency: string = 'SEK',
  locale?: SupportedLocale
): string {
  return formatNumber(amount, {
    style: 'currency',
    currency,
  }, locale);
}

/**
 * Hook för React-komponenter (om React används)
 */
export function useTranslation() {
  const currentLocale = getCurrentLocale();

  return {
    t,
    tGDPR,
    setLocale,
    currentLocale,
    hasTranslation,
    formatDate,
    formatTime,
    formatDateTime,
    pluralize,
    formatNumber,
    formatCurrency,
  };
}

/**
 * Exportera singleton-instans för global användning
 */
export const i18n = I18nManager.getInstance({
  defaultLocale: 'sv',
  fallbackLocale: 'en',
  enablePersistence: true,
  enableLogging: __DEV__,
  gdprCompliant: true,
});

// Auto-initialisera i18n
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  i18n.initialize().catch(error => {
    console.warn('Kunde inte initialisera i18n:', error);
  });
}
