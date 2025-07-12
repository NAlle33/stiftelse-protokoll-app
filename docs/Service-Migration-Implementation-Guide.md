# Service Migration Implementation Guide

## Översikt

Denna guide beskriver hur man implementerar och integrerar de migrerade BaseService-tjänsterna i SÖKA Stiftelseappen. Följ dessa steg för en säker och gradvis migration från gamla till nya tjänster.

## Steg 1: Förberedelser

### 1.1 Verifiera BaseService-infrastruktur
```bash
# Kontrollera att alla BaseService-filer finns
ls -la src/services/BaseService.ts
ls -la src/services/MediaBaseService.ts
ls -la src/services/RealtimeBaseService.ts
ls -la src/services/AIBaseService.ts
```

### 1.2 Kör befintliga tester
```bash
# Säkerställ att alla befintliga tester passerar
npm test src/__tests__/services/
```

## Steg 2: Gradvis migration av UserService

### 2.1 Skapa alias för gradvis övergång
```typescript
// src/services/index.ts
export { userServiceMigrated as userService } from './UserServiceMigrated';
export { userService as userServiceLegacy } from './userService';
```

### 2.2 Uppdatera OptimizedServiceRegistry
```typescript
// src/services/OptimizedServiceRegistry.ts
import { userServiceMigrated } from './UserServiceMigrated';

// I registerBaseServices():
this.registry.define({
  identifier: ServiceIdentifiers.USER_SERVICE,
  factory: () => userServiceMigrated,
  singleton: true,
  dependencies: [ServiceIdentifiers.SUPABASE_CLIENT]
});
```

### 2.3 Testa migration
```bash
# Kör specifika tester för UserService
npm test src/__tests__/services/UserServiceMigrated.test.ts
```

## Steg 3: Migration av VideoMeetingService

### 3.1 Uppdatera service registry
```typescript
// src/services/OptimizedServiceRegistry.ts
import { videoMeetingServiceMigrated } from './VideoMeetingServiceMigrated';

// I registerAdvancedServices():
this.registry.define({
  identifier: ServiceIdentifiers.VIDEO_MEETING_SERVICE,
  factory: () => videoMeetingServiceMigrated,
  singleton: true,
  dependencies: [ServiceIdentifiers.SUPABASE_CLIENT, ServiceIdentifiers.LOGGER]
});
```

### 3.2 Uppdatera komponenter som använder VideoMeetingService
```typescript
// src/components/VideoMeeting/VideoMeetingRoom.tsx
import { videoMeetingServiceMigrated as videoMeetingService } from '../../services/VideoMeetingServiceMigrated';

// Ersätt alla anrop till gamla videoMeetingService
const result = await videoMeetingService.createVideoMeeting(meetingId, options);
```

## Steg 4: Migration av WebRTCSignalingService

### 4.1 Uppdatera service registry
```typescript
// src/services/OptimizedServiceRegistry.ts
import { webrtcSignalingServiceMigrated } from './WebRTCSignalingServiceMigrated';

this.registry.define({
  identifier: ServiceIdentifiers.WEBRTC_SIGNALING_SERVICE,
  factory: () => webrtcSignalingServiceMigrated,
  singleton: true,
  dependencies: [ServiceIdentifiers.SUPABASE_CLIENT]
});
```

### 4.2 Uppdatera WebRTC-komponenter
```typescript
// src/services/webrtcPeerService.ts
import { webrtcSignalingServiceMigrated as webrtcSignalingService } from './WebRTCSignalingServiceMigrated';

// Uppdatera alla referenser
await webrtcSignalingService.initializeMeeting(roomId, callbacks);
```

## Steg 5: Validering och testning

### 5.1 Kör fullständig testsvit
```bash
# Kör alla tester för att säkerställa kompatibilitet
npm test

# Kör specifika tester för migrerade tjänster
npm test src/__tests__/services/UserServiceMigrated.test.ts
npm test src/__tests__/services/VideoMeetingServiceMigrated.test.ts
npm test src/__tests__/services/WebRTCSignalingServiceMigrated.test.ts
```

### 5.2 Integrationstester
```bash
# Testa att services fungerar tillsammans
npm test src/__tests__/integration/
```

### 5.3 E2E-tester
```bash
# Kör end-to-end-tester för kritiska flöden
npm run test:e2e
```

## Steg 6: Produktionsdeploy

### 6.1 Feature flags för gradvis rollout
```typescript
// src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  USE_MIGRATED_USER_SERVICE: process.env.USE_MIGRATED_USER_SERVICE === 'true',
  USE_MIGRATED_VIDEO_SERVICE: process.env.USE_MIGRATED_VIDEO_SERVICE === 'true',
  USE_MIGRATED_SIGNALING_SERVICE: process.env.USE_MIGRATED_SIGNALING_SERVICE === 'true'
};
```

### 6.2 Conditional service loading
```typescript
// src/services/ServiceFactory.ts
import { FEATURE_FLAGS } from '../config/featureFlags';

export const getUserService = () => {
  if (FEATURE_FLAGS.USE_MIGRATED_USER_SERVICE) {
    return userServiceMigrated;
  }
  return userServiceLegacy;
};
```

### 6.3 Monitoring och logging
```typescript
// src/utils/migrationMonitoring.ts
export const logServiceMigration = (serviceName: string, success: boolean, error?: Error) => {
  console.log(`Service Migration: ${serviceName}`, {
    success,
    error: error?.message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
};
```

## Steg 7: Rensning av gamla tjänster

### 7.1 Efter framgångsrik migration (1-2 veckor)
```bash
# Ta backup av gamla tjänster
mkdir -p backup/services
cp src/services/userService.ts backup/services/
cp src/services/videoMeetingService.ts backup/services/
cp src/services/webrtcSignalingService.ts backup/services/

# Ta bort gamla tjänster
rm src/services/userService.ts
rm src/services/videoMeetingService.ts
rm src/services/webrtcSignalingService.ts
```

### 7.2 Uppdatera imports
```bash
# Sök och ersätt gamla imports
grep -r "from './userService'" src/ --include="*.ts" --include="*.tsx"
grep -r "from './videoMeetingService'" src/ --include="*.ts" --include="*.tsx"
```

## Steg 8: Dokumentation och utbildning

### 8.1 Uppdatera utvecklardokumentation
- Uppdatera API-dokumentation för nya tjänster
- Dokumentera BaseService-mönster och best practices
- Skapa migreringsguide för framtida tjänster

### 8.2 Teamutbildning
- Genomför workshop om BaseService-arkitektur
- Demonstrera nya felhantering och GDPR-funktioner
- Träna teamet i att skriva tester för BaseService-tjänster

## Felsökning

### Vanliga problem och lösningar

#### Problem: "Cannot find module" fel
```bash
# Lösning: Kontrollera att alla imports är korrekta
npm run type-check
```

#### Problem: Tester misslyckas efter migration
```bash
# Lösning: Uppdatera testmocks för nya tjänster
# Se src/__tests__/services/UserServiceMigrated.test.ts för exempel
```

#### Problem: Cache-problem i utvecklingsmiljö
```bash
# Lösning: Rensa cache och starta om
npm start -- --reset-cache
```

## Verifiering av framgång

### Kontrollpunkter
- [ ] Alla tester passerar (90%+ täckning)
- [ ] Svenska felmeddelanden visas korrekt
- [ ] GDPR-funktioner fungerar (cache-rensning, datasanitisering)
- [ ] Prestanda är bibehållen eller förbättrad
- [ ] Inga breaking changes för befintliga API:er

### Mätningar
```bash
# Kontrollera bundle-storlek
npm run analyze-bundle

# Mät testtäckning
npm run test:coverage

# Kontrollera TypeScript-fel
npm run type-check
```

## Slutsats

Genom att följa denna guide säkerställer du en smidig migration till BaseService-mönster med minimal risk för produktionsproblem. Den gradvis rollout-strategin möjliggör snabb återställning om problem upptäcks.

För frågor eller problem, se dokumentationen i `docs/BaseService-Implementation.md` eller kontakta utvecklingsteamet.
