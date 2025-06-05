# Stiftelsekollen - Digital Protokollhantering

## Projektöversikt
Stiftelsekollen är en mobilapp för stiftelser där styrelsemöten dokumenteras digitalt genom hela processen - från inspelning till AI-genererat protokoll, redigering och BankID-signering, med fokus på säkerhet och GDPR-efterlevnad.

## Kärnprinciper
- **Användarvänlighet**: Optimerad för äldre användare med tydliga gränssnitt
- **Säkerhet**: Genomgående kryptering och BankID-autentisering
- **GDPR-efterlevnad**: All data lagras i EU med fullständig loggning
- **Spårbarhet**: Komplett audit trail för alla åtgärder

## Moduler

### 1. Autentisering & Behörigheter
- BankID-baserad inloggning
- Rollbaserad åtkomstkontroll (styrelse, sekreterare, revisor)
- Automatisk utloggning vid inaktivitet

### 2. Möteshantering
- Skapa och schemalägga möten
- Översikt över kommande och tidigare möten
- Sökbar möteshistorik

### 3. Inspelning & Digitala Möten
- Enkel ljudinspelning med pausfunktion
- Stöd för digitala möten
- Säker lagring av inspelningar

### 4. Transkribering
- Automatisk konvertering från tal till text
- Stöd för svenska språket
- Statusuppdateringar under processen

### 5. AI-protokollgenerering
- Skapar juridiskt korrekta protokoll från transkribering
- Använder fördefinierade mallar för protokollstruktur
- Felhantering med användarnotifiering

### 6. Redigering & Versionshantering
- Strukturerad editor för protokollredigering
- Automatiskt sparande och versionshistorik
- Spårbarhet för alla ändringar

### 7. Digital Signering
- BankID-baserad signering
- Stöd för sekventiell eller parallell signering
- Låsning av dokument efter signering

### 8. Säker Lagring
- Krypterad lagring i Supabase (EU-datacenter)
- Rollbaserad åtkomstkontroll
- Automatisk backup

### 9. Notifieringar
- Pushnotiser för viktiga händelser
- Statusuppdateringar i realtid
- Påminnelser för väntande åtgärder

### 10. GDPR & Loggning
- Komplett loggning av alla aktiviteter
- Stöd för "rätten att bli glömd"
- Transparent datapolicy

### 11. Support & Incidenthantering
- Tydliga felmeddelanden
- Automatisk rapportering av systemfel
- Dokumenterade supportrutiner

## Teknisk Implementation
- Frontend: React Native
- Backend: Supabase
- Autentisering: BankID via svensk leverantör
- AI/ML: OpenAI GPT-4 eller motsvarande
- Lagring: Krypterad databas inom EU

## Kvalitetssäkring
- Omfattande testning av både happy path och felscenarier
- UX-tester med målgruppen
- Verifierad GDPR-efterlevnad
- Dokumenterade incidentrutiner