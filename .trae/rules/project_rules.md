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
# Project: Swedish Board Meeting App
- Building a Swedish app for board meeting documentation using Flutter/React Native, Supabase, BankID integration, speech-to-text, and AI protocol generation with focus on GDPR compliance and security.
- The app will follow the design created with Lovable AI, available at https://github.com/NAlle33/stiftelse-m.git
- User prefers to read tasklist.md, test.md, and project_description.md first before fixing terminal errors to understand context and priorities.

# Features
- Implement Speech-to-Text integration using Azure Speech Service with Swedish language support for the board meeting app.
- Implement comprehensive security improvements in the Swedish board meeting app including server validation, database constraints, extended form validation, CSRF protection, rate limiting, and unit tests for all new validation functionality. Also, remove hardcoded credentials, implement proper encryption with improved key management, HMAC integrity verification, secure key derivation, and proper encryption of sensitive data in transit and at rest, improving session management, and adding input validation.
- Implement session management improvements including proper expiration, invalidation on security events, secure storage, device fingerprinting, IP-based validation, and audit trails.
- Continue implementing security improvements in the protocol app, focusing on session management enhancements, fixing encryption service tests, and implementing LLM/AI integration with GDPR compliance.

# Testing
- For the Swedish board meeting app, follow structured testing approach: fix existing failing tests first, then implement comprehensive test coverage (unit/integration/end-to-end) for critical features like BankID integration, speech-to-text, protocol generation, security features, and Supabase data persistence, ensuring tests cover edge cases, error handling, and security scenarios.
- Implement comprehensive testing strategy for the Swedish board meeting app including unit tests, integration tests, and end-to-end tests for critical functionality like speech-to-text, BankID integration, security features, and Supabase data persistence.
- For the Swedish board meeting app, follow comprehensive QA testing methodology covering data connection verification, functionality integration, error handling, responsive design, BankID/security testing, API contract validation, GDPR compliance UI testing, and performance validation with focus on Swedish localization and cultural appropriateness.
- For the Swedish board meeting app, follow comprehensive testing methodology with priority order: 1) Security-critical features (BankID, encryption, session management), 2) Core business logic (protocol generation, speech-to-text, data persistence), 3) UI components, 4) Integration points with Supabase, 5) Error handling, ensuring unit/integration/end-to-end tests with security validation, GDPR compliance verification, and Swedish language/cultural appropriateness.
- For the Swedish board meeting app, continue using the proven 6-phase systematic test fixing methodology: pre-implementation analysis, research/planning with security/GDPR considerations, implementation with proper mocking strategies, comprehensive testing/validation, task completion marking in test.md, with priority order focusing on fixing existing failing tests before implementing new features.
- For the Swedish board meeting app, follow systematic test fixing approach: complete current failing test suite before moving to next, prioritize Audio Recording Service → Key Management Service → BankID Hook → E2E tests, analyze specific failure causes, implement proper mocking, ensure tests align with service implementations, and update test.md to mark completed items as done.
- For the Swedish board meeting app, use proven test fixing methodology: fix mocking issues with method replacement approach for object literals (like sessionService), apply same fixes systematically across test suites, maintain security-first approach with GDPR compliance, and mark completed tasks in test.md for systematic progress tracking.
- For the Swedish board meeting app, use testUtils.setupSupabaseMock as the proven standard approach for all Supabase mocking in tests, as this methodology has been validated as highly effective for fixing test failures.
- For the Swedish board meeting app, user prefers comprehensive test execution approach: run all tests, fix any failures using best practices, and build any missing important tests that are discovered.
- For the Swedish board meeting app, user wants comprehensive test coverage analysis and building of missing important tests using best practices when coverage gaps are discovered.
- For the Swedish board meeting app, follow comprehensive test coverage methodology: create detailed tasks in test.md with test type/priority/scenarios/GDPR/Swedish localization requirements, then implement using 6-phase approach (analysis, research, implementation, validation, completion marking, progression) covering business logic, error handling, security, GDPR compliance, Swedish cultural appropriateness, and cross-platform compatibility.

# Task Management
- User wants to include detailed frontend specifications in the tasklist and then proceed with implementing tasks from the tasklist.
- Process tasks from tasklist.md systematically with thorough understanding, research, detailed planning, proper security/GDPR compliance, comprehensive testing, and adherence to best practices for code quality, security, and performance.
- Implement tasks from tasklist.md systematically with thorough understanding, research, detailed planning, proper security/GDPR compliance, comprehensive testing, and adherence to best practices for code quality, security, and performance. When completing tasks from tasklist.md, mark specific sub-items as 'done' and continue systematically implementing remaining tasks in sequence with thorough research, planning, testing, and security/GDPR compliance.
- For the Swedish board meeting app, execute tasks from test.md systematically using 6-phase approach: pre-implementation analysis, research/planning with Context7 documentation, implementation with security/GDPR/Swedish localization focus, comprehensive testing, task completion marking, and systematic progression with priority on security-critical features first.
- For the Swedish board meeting app, execute tasks from test.md systematically using 6-phase methodology with strict priority order: fix existing failing tests first, then security-critical features, core business logic, UI components, and integration points, marking each task as done before progressing to next.

# Implementation Approach
- For the Swedish board meeting app, follow detailed 6-phase implementation methodology: Pre-implementation Analysis (read project/analyze codebase), Research & Planning (Context7 docs/best practices with security/GDPR/Swedish localization), Implementation (security-first with proper package management), Comprehensive Testing (unit/integration/security), Task Completion (mark done in test.md), Systematic Progression (complete current before next), with priority order: fix existing failing tests first, then security-critical features, core business logic, UI components, integration points, error handling.
- For the Swedish board meeting app, follow systematic 6-phase implementation approach for all tasks from test.md: 1) Pre-implementation analysis, 2) Research/planning with Context7 documentation and GDPR/security considerations, 3) Implementation with security-first approach and Swedish localization, 4) Comprehensive testing (unit/integration/security), 5) Task completion marking, 6) Systematic progression, with priority order: fix existing failing tests first, then security-critical features, core business logic, UI components, and integration points.
- For the Swedish board meeting app, follow structured 6-phase implementation approach for all tasks: 1) Pre-implementation analysis, 2) Research/planning with GDPR/security considerations, 3) Implementation with Swedish localization, 4) Testing (comprehensive unit/integration/security), 5) Task completion marking in test.md, 6) Systematic progression, with priority on security-critical features first, then core business logic, UI components, and integration points.
- For the Swedish board meeting app, follow systematic 6-phase implementation approach for all tasks: 1) Pre-implementation analysis, 2) Research/planning with GDPR/security considerations, 3) Implementation with Swedish localization, 4) Testing (comprehensive unit/integration/security), 5) Task completion marking in test.md, 6) Systematic progression, with focus on simplifying integration tests using business logic over complex UI rendering.
- For the Swedish board meeting app, follow structured implementation approach: complete CI/CD setup, then proceed to next priority tasks using pattern of pre-implementation research/planning, implementation with security/GDPR compliance, comprehensive testing, and systematic task completion marking in tasklist.md while maintaining high quality standards for testing, security, and documentation.
- For the Swedish board meeting app, follow structured implementation approach: complete and fix failing tests first, then proceed to next priority tasks (protocol editing with version management, BankID signing flow, protocol immutability, secure storage) using pattern of research, planning, implementation with security/GDPR compliance, testing, and systematic task completion marking.
- For the Swedish board meeting app, follow structured implementation methodology: Pre-implementation (analyze project/tasklist, research best practices), Implementation (detailed planning with security/GDPR/Swedish localization, proper package management), Testing (comprehensive unit/integration/security/end-to-end tests), and Task Completion (mark items done systematically), maintaining focus on security, GDPR compliance, and Swedish cultural appropriateness.
- For the Swedish board meeting app, follow detailed 6-phase implementation methodology with specific priority order: fix existing failing tests first, then security-critical features, core business logic, UI components, and integration points, ensuring comprehensive testing (unit/integration/security/end-to-end) and systematic task completion marking in test.md.
- For the Swedish board meeting app, follow systematic documentation approach: mark significant technical breakthroughs in test.md, update status of all related tests, document key technical discoveries, mark completed tasks as done, then continue with 6-phase implementation methodology (analysis, research, implementation, testing, completion marking, systematic progression) while maintaining security-first approach with GDPR compliance and Swedish localization.
- For the Swedish board meeting app, follow 6-phase systematic approach for fixing issues: analysis, research, implementation with security/GDPR compliance, testing, task completion marking, systematic progression, with priority order of security-critical fixes first (SecureStore, BankID, Supabase), then deprecation warnings, then web platform compatibility issues.
- For the Swedish board meeting app, when fixing web platform compatibility issues, use priority order: Navigation context issues first (critical functionality), then push notifications platform compatibility, then deprecated style props cleanup, implementing platform-specific conditional logic while maintaining mobile functionality.
- For the Swedish board meeting app, follow systematic error fixing methodology: read terminal output, analyze errors, prioritize fixes (security-critical first, then core functionality, build errors, test failures, deprecation warnings, web compatibility), implement using 6-phase approach with GDPR/Swedish compliance, test fixes, and update task documentation.

# Frontend Audit & Web Platform Considerations
- For the Swedish board meeting app, conduct comprehensive frontend audits by verifying core features (meeting management, speech-to-text, AI protocol generation, BankID workflows, version management, secure storage, GDPR compliance), security UI implementation, Swedish localization, cross-referencing against tasklist.md/design specs/backend APIs, and documenting implementation gaps.
- For the Swedish board meeting app, web platform has limitations: push notifications have limited support requiring fallback implementations, shadow style props are deprecated in favor of boxShadow, and navigation context may not be available in certain providers requiring fallback handling.
- For web platform compatibility in React Native/Expo apps: use Platform.OS !== 'web' checks for push notifications and SecureStore, set useNativeDriver: Platform.OS !== 'web' for animations, move deprecated props like pointerEvents to style objects, and ensure proper UUID formatting for Supabase queries.