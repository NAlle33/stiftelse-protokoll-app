# BaseService Implementation - Service Layer Consolidation

## Översikt

BaseService är en abstrakt basklass som implementerar gemensamma mönster för alla tjänster i SÖKA Stiftelseappen. Denna implementation är del av Service Layer Consolidation-initiativet för att minska kodduplicering från 57 tjänster till 25 tjänster (56% minskning).

## Problemanalys

### Före BaseService
Varje tjänst implementerade sina egna versioner av:
- Felhantering med inkonsistenta meddelanden
- Cache-hantering med olika strategier
- Retry-logik för Supabase-frågor
- Inmatningsvalidering med varierande kvalitet
- Loggning utan GDPR-hänsyn
- Initialisering och livscykelhantering

### Efter BaseService
Alla tjänster ärver standardiserade implementationer av:
- ✅ Enhetlig felhantering med svenska meddelanden
- ✅ Konsistent cache-hantering med automatisk rensning
- ✅ Standardiserad retry-logik via `withRetry`
- ✅ Schema-baserad inmatningsvalidering
- ✅ GDPR-kompatibel loggning och Sentry-integration
- ✅ Gemensam initialiserings- och livscykelhantering

## Arkitektur

### BaseService Struktur

```typescript
export abstract class BaseService {
  // Gemensamma egenskaper
  protected isInitialized: boolean
  protected cache: Map<string, CacheEntry<any>>
  protected readonly options: ServiceOptions
  protected abstract readonly serviceName: string

  // Kärnmetoder som alla tjänster behöver
  protected abstract initialize(): Promise<void>
  protected handleError(error: Error, context: string): ServiceError
  protected executeQuery<T>(queryFn: () => Promise<T>): Promise<T>
  protected validateInput(data: unknown, schema: ValidationSchema): ValidationResult
  
  // Cache-hantering
  protected getCacheKey(operation: string, params: Record<string, any>): string
  protected getFromCache<T>(key: string): T | null
  protected setCache<T>(key: string, data: T): void
  protected clearCache(): void
}
```

### Validationsscheman

```typescript
export interface ValidationSchema {
  required?: string[]                           // Obligatoriska fält
  types?: Record<string, string>               // Datatyper
  patterns?: Record<string, RegExp>            // Regex-mönster
  custom?: Record<string, (value: any) => boolean> // Anpassad validering
}
```

## Implementation Guide

### 1. Skapa en ny tjänst

```typescript
import { BaseService, ValidationSchema } from './BaseService';

export class MyService extends BaseService {
  protected readonly serviceName = 'MyService';

  // Definiera validationsscheman
  private readonly mySchema: ValidationSchema = {
    required: ['id', 'name'],
    types: {
      id: 'string',
      name: 'string',
      isActive: 'boolean'
    },
    patterns: {
      id: /^[0-9a-f-]{36}$/i,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    custom: {
      name: (value: string) => value.length >= 2
    }
  };

  protected async initialize(): Promise<void> {
    // Tjänst-specifik initialisering
    this.clearExpiredCache();
    console.log('✅ MyService initialiserad');
  }

  async myOperation(data: any): Promise<Result> {
    try {
      // 1. Validera input
      const validation = this.validateInput(data, this.mySchema);
      if (!validation.isValid) {
        throw new Error(`Valideringsfel: ${validation.errors.join(', ')}`);
      }

      // 2. Exekvera fråga med retry och cache
      const result = await this.executeQuery(async () => {
        const { data, error } = await supabase
          .from('my_table')
          .select('*')
          .eq('id', data.id);

        if (error) throw new Error(`Databasfel: ${error.message}`);
        return data;
      }, 'myOperation');

      return { success: true, data: result };
    } catch (error) {
      // 3. Standardiserad felhantering
      const serviceError = this.handleError(error as Error, 'myOperation');
      return { success: false, error: serviceError.message };
    }
  }
}
```

### 2. Migrera befintlig tjänst

Se `UserServiceRefactored.ts` för komplett exempel på hur `UserService` migreras till BaseService.

#### Före migration (UserService.ts):
- 430 rader kod
- Egen cache-implementation
- Egen felhantering
- Ingen validering
- Inkonsistent loggning

#### Efter migration (UserServiceRefactored.ts):
- 300 rader kod (30% minskning)
- Standardiserad cache via BaseService
- Enhetlig felhantering med svenska meddelanden
- Schema-baserad validering
- GDPR-kompatibel loggning

## Fördelar

### 1. Kodminskning
- **30-40% mindre kod** per tjänst
- **Eliminerar duplicerad kod** för vanliga operationer
- **Standardiserade mönster** över hela kodbasen

### 2. Förbättrad kvalitet
- **Konsistent felhantering** med svenska meddelanden
- **GDPR-kompatibel loggning** med automatisk datarensning
- **Robust validering** med schema-stöd
- **Automatisk retry-logik** för nätverksfel

### 3. Bättre underhållbarhet
- **Centraliserade uppdateringar** i BaseService påverkar alla tjänster
- **Enhetliga API:er** gör det lättare för utvecklare
- **Standardiserad testning** med gemensamma mönster

### 4. Prestanda
- **Intelligent caching** med automatisk rensning
- **Optimerad retry-logik** minskar onödiga anrop
- **Bättre minneshantering** genom centraliserad cache

## GDPR-efterlevnad

BaseService implementerar GDPR-säkra mönster:

### Datarensning
```typescript
private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'personnummer', 'bankid', 'email'];
  // Automatisk rensning av känslig data före loggning
}
```

### Audit Trail
- Alla operationer loggas med tidsstämpel
- Användar-ID anonymiseras i loggar
- Känslig data filtreras bort automatiskt

### Datalagring
- Cache rensas automatiskt efter konfigurerad tid
- Ingen känslig data lagras i cache längre än nödvändigt
- Explicit cache-rensning vid känsliga operationer

## Testning

### Enhetstester för BaseService
```typescript
describe('BaseService', () => {
  it('ska validera input korrekt', () => {
    const schema: ValidationSchema = {
      required: ['name'],
      types: { name: 'string' }
    };
    
    const result = service.validateInput({ name: 'test' }, schema);
    expect(result.isValid).toBe(true);
  });

  it('ska hantera fel med svenska meddelanden', () => {
    const error = new Error('Network request failed');
    const serviceError = service.handleError(error, 'testOperation');
    
    expect(serviceError.message).toContain('Nätverksfel');
    expect(serviceError.gdprCompliant).toBe(true);
  });
});
```

### Integration med befintliga tester
- Alla befintliga tjänsttester fortsätter fungera
- Nya tester kan fokusera på affärslogik istället för infrastruktur
- Gemensamma testverktyg för BaseService-funktionalitet

## Nästa steg

1. **Migrera prioriterade tjänster** (userService, meetingService, protocolService) ✅ COMPLETED
2. **Implementera Service Composition** för beroenden mellan tjänster ✅ COMPLETED
3. **Optimera Service Dependencies** för bättre import-struktur 🔄 IN PROGRESS
4. **Skapa specialiserade BaseService-subklasser** för specifika domäner

## Mätning av framgång

### Kvantitativa mål
- ✅ **Kodminskning**: 30% per tjänst (uppnått i UserServiceRefactored)
- 🎯 **Tjänstminskning**: 57 → 25 tjänster (56% minskning)
- 🎯 **Byggtid**: 20% förbättring genom färre filer
- 🎯 **Bundle-storlek**: Ytterligare 5-10% minskning

### Kvalitativa förbättringar
- ✅ **Enhetlig felhantering** implementerad
- ✅ **GDPR-kompatibel loggning** implementerad
- ✅ **Schema-baserad validering** implementerad
- 🎯 **Förbättrad utvecklarupplevelse** genom standardiserade mönster

---

*Denna implementation följer etablerade mönster från protokolltjänstkonsolideringen och säkerställer svensk lokalisering och GDPR-efterlevnad genom hela systemet.*
