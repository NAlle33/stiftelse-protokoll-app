/**
 * Import Update Script - Service Layer BaseService Migration
 * 
 * Detta script uppdaterar alla import statements för att använda migrerade
 * BaseService-tjänster istället för legacy-implementationer. Använder
 * ServiceFactory för conditional loading baserat på feature flags.
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering.
 */

import * as fs from 'fs';
import * as path from 'path';

interface ImportUpdate {
  filePath: string;
  oldImport: string;
  newImport: string;
  description: string;
}

/**
 * Lista över import-uppdateringar som behöver göras
 */
const IMPORT_UPDATES: ImportUpdate[] = [
  // WebRTC Signaling Service Updates
  {
    filePath: 'src/components/VideoMeeting/VideoMeetingRoom.tsx',
    oldImport: "import { webrtcSignalingService } from '../../services/webrtcSignalingService';",
    newImport: "import { ServiceFactory } from '../../services/ServiceFactory';",
    description: 'Uppdatera VideoMeetingRoom för att använda ServiceFactory'
  },
  {
    filePath: 'src/services/webrtcPeerService.ts',
    oldImport: "import { webrtcSignalingService, RTCSignal } from './webrtcSignalingService';",
    newImport: "import { ServiceFactory } from './ServiceFactory';\nimport { RTCSignal } from './webrtcSignalingService';",
    description: 'Uppdatera webrtcPeerService för att använda ServiceFactory'
  },
  
  // Video Meeting Service Updates
  {
    filePath: 'src/services/videoMeetingService.ts',
    oldImport: "import { webrtcSignalingService } from './webrtcSignalingService';",
    newImport: "import { ServiceFactory } from './ServiceFactory';",
    description: 'Uppdatera videoMeetingService för att använda ServiceFactory'
  },
  
  // Backup service updates (för legacy-filer som fortfarande refererar)
  {
    filePath: 'backup/services/videoMeetingService.legacy.ts',
    oldImport: "import { webrtcSignalingService } from './webrtcSignalingService';",
    newImport: "// Legacy import - använd ServiceFactory i nya implementationer\n// import { ServiceFactory } from './ServiceFactory';",
    description: 'Kommentera legacy imports i backup-filer'
  }
];

/**
 * Kod-uppdateringar för att använda ServiceFactory istället för direkta service-instanser
 */
const CODE_UPDATES: Array<{
  filePath: string;
  oldCode: string;
  newCode: string;
  description: string;
}> = [
  // WebRTC Peer Service - uppdatera för att använda ServiceFactory
  {
    filePath: 'src/services/webrtcPeerService.ts',
    oldCode: 'webrtcSignalingService.setCallbacks({',
    newCode: `// Hämta WebRTC Signaling Service via ServiceFactory
    const signalingResult = await ServiceFactory.getWebRTCSignalingService();
    const webrtcSignalingService = signalingResult.service;
    
    webrtcSignalingService.setCallbacks({`,
    description: 'Använd ServiceFactory för att hämta WebRTC Signaling Service'
  },
  {
    filePath: 'src/services/webrtcPeerService.ts',
    oldCode: 'await webrtcSignalingService.sendSignal(this.roomId!, {',
    newCode: `// Hämta WebRTC Signaling Service via ServiceFactory
    const signalingResult = await ServiceFactory.getWebRTCSignalingService();
    const webrtcSignalingService = signalingResult.service;
    
    await webrtcSignalingService.sendSignal(this.roomId!, {`,
    description: 'Använd ServiceFactory för sendSignal-anrop'
  }
];

/**
 * Utför import-uppdateringar
 */
async function updateImports(): Promise<void> {
  console.log('🔄 Startar import-uppdateringar för Service Layer BaseService Migration...');
  
  let updatedFiles = 0;
  let errors = 0;

  for (const update of IMPORT_UPDATES) {
    try {
      const fullPath = path.resolve(process.cwd(), update.filePath);
      
      // Kontrollera om filen existerar
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  Fil existerar inte: ${update.filePath}`);
        continue;
      }

      // Läs filinnehåll
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Kontrollera om uppdatering behövs
      if (!content.includes(update.oldImport)) {
        console.log(`ℹ️  Ingen uppdatering behövs: ${update.filePath}`);
        continue;
      }

      // Utför uppdatering
      const updatedContent = content.replace(update.oldImport, update.newImport);
      
      // Skriv tillbaka till fil
      fs.writeFileSync(fullPath, updatedContent, 'utf8');
      
      console.log(`✅ Uppdaterad: ${update.filePath}`);
      console.log(`   ${update.description}`);
      updatedFiles++;
      
    } catch (error) {
      console.error(`❌ Fel vid uppdatering av ${update.filePath}:`, error);
      errors++;
    }
  }

  console.log(`\n📊 Import-uppdateringar slutförda:`);
  console.log(`   ✅ Uppdaterade filer: ${updatedFiles}`);
  console.log(`   ❌ Fel: ${errors}`);
}

/**
 * Utför kod-uppdateringar
 */
async function updateCode(): Promise<void> {
  console.log('\n🔄 Startar kod-uppdateringar för ServiceFactory-användning...');
  
  let updatedFiles = 0;
  let errors = 0;

  for (const update of CODE_UPDATES) {
    try {
      const fullPath = path.resolve(process.cwd(), update.filePath);
      
      // Kontrollera om filen existerar
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  Fil existerar inte: ${update.filePath}`);
        continue;
      }

      // Läs filinnehåll
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Kontrollera om uppdatering behövs
      if (!content.includes(update.oldCode)) {
        console.log(`ℹ️  Ingen kod-uppdatering behövs: ${update.filePath}`);
        continue;
      }

      // Utför uppdatering
      const updatedContent = content.replace(update.oldCode, update.newCode);
      
      // Skriv tillbaka till fil
      fs.writeFileSync(fullPath, updatedContent, 'utf8');
      
      console.log(`✅ Kod uppdaterad: ${update.filePath}`);
      console.log(`   ${update.description}`);
      updatedFiles++;
      
    } catch (error) {
      console.error(`❌ Fel vid kod-uppdatering av ${update.filePath}:`, error);
      errors++;
    }
  }

  console.log(`\n📊 Kod-uppdateringar slutförda:`);
  console.log(`   ✅ Uppdaterade filer: ${updatedFiles}`);
  console.log(`   ❌ Fel: ${errors}`);
}

/**
 * Skapar backup av filer innan uppdatering
 */
async function createBackups(): Promise<void> {
  console.log('💾 Skapar säkerhetskopior innan uppdatering...');
  
  const filesToBackup = [
    ...IMPORT_UPDATES.map(u => u.filePath),
    ...CODE_UPDATES.map(u => u.filePath)
  ];
  
  const uniqueFiles = [...new Set(filesToBackup)];
  
  for (const filePath of uniqueFiles) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      
      if (!fs.existsSync(fullPath)) {
        continue;
      }
      
      const backupPath = `${fullPath}.backup.${Date.now()}`;
      fs.copyFileSync(fullPath, backupPath);
      
      console.log(`💾 Backup skapad: ${backupPath}`);
    } catch (error) {
      console.error(`❌ Fel vid backup av ${filePath}:`, error);
    }
  }
}

/**
 * Validerar att uppdateringarna är korrekta
 */
async function validateUpdates(): Promise<void> {
  console.log('\n🔍 Validerar uppdateringar...');
  
  const filesToValidate = [
    ...IMPORT_UPDATES.map(u => u.filePath),
    ...CODE_UPDATES.map(u => u.filePath)
  ];
  
  const uniqueFiles = [...new Set(filesToValidate)];
  
  for (const filePath of uniqueFiles) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      
      if (!fs.existsSync(fullPath)) {
        continue;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Kontrollera att ServiceFactory importeras om det används
      if (content.includes('ServiceFactory.get') && !content.includes("import { ServiceFactory }")) {
        console.warn(`⚠️  ${filePath}: Använder ServiceFactory men saknar import`);
      }
      
      // Kontrollera att inga gamla imports finns kvar
      const oldImports = [
        "from './userService'",
        "from './videoMeetingService'",
        "from './webrtcSignalingService'"
      ];
      
      for (const oldImport of oldImports) {
        if (content.includes(oldImport) && !filePath.includes('backup/')) {
          console.warn(`⚠️  ${filePath}: Innehåller fortfarande legacy import: ${oldImport}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Fel vid validering av ${filePath}:`, error);
    }
  }
  
  console.log('✅ Validering slutförd');
}

/**
 * Huvudfunktion
 */
async function main(): Promise<void> {
  console.log('🚀 Service Layer BaseService Migration - Import Update Script');
  console.log('====================================================================');
  
  try {
    // Skapa backups
    await createBackups();
    
    // Uppdatera imports
    await updateImports();
    
    // Uppdatera kod
    await updateCode();
    
    // Validera uppdateringar
    await validateUpdates();
    
    console.log('\n🎉 Import-uppdateringar slutförda framgångsrikt!');
    console.log('\n📋 Nästa steg:');
    console.log('1. Kör tester för att verifiera att allt fungerar: npm test');
    console.log('2. Kontrollera att feature flags är korrekt konfigurerade');
    console.log('3. Testa applikationen i utvecklingsmiljö');
    console.log('4. Efter framgångsrik testning, ta bort legacy-filer');
    
  } catch (error) {
    console.error('💥 Fel vid import-uppdateringar:', error);
    process.exit(1);
  }
}

// Kör script om det anropas direkt
if (require.main === module) {
  main();
}

export { updateImports, updateCode, validateUpdates };
