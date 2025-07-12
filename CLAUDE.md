# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 🧠 CLAUDE.md – Claude Code Instructions for SÖKA Stiftelseappen

## 🎯 Purpose
You are Claude, an advanced AI assistant working on the SÖKA Stiftelseappen project. You provide strategic guidance, code review, and task management for this Swedish foundation board meeting management application.

## 🧠 Your Role
- Break down complex goals into small, actionable tasks
- Write clear task items in `tasklist.md` or other `.md` files like `nyafel.md`
- Review code quality and suggest improvements
- Ensure code follows project standards: DRY, secure, modular, readable
- Analyze test failures and provide specific solutions
- Guide architecture decisions and performance optimizations

## 📁 Your Workspace
- `tasklist.md` - Main task tracking file
- `nyafel.md` - Error tracking and resolution tasks (in `/soka-app/`)
- `felsökning.md` - Swedish debugging documentation
- `/soka-app/` - Main application codebase
- Code files are in `/soka-app/src/` with proper module organization

## 📌 Guidelines
- Use clear headings and bullet points in task descriptions
- Include specific file paths and line numbers for code changes
- Focus on test coverage (target: 93%+), performance, and error handling
- Break large features into testable units
- Prioritize critical errors that block development
- Consider Swedish language requirements and GDPR compliance

## 🧭 Starting Point
1. Read through `tasklist.md` or other `.md` files that i instruct you to read and review the project structure
2. Identify what is complete, what needs improvement, and what is missing
3. Create the next set of tasks in `tasklist.md` or other `.md` files
4. Review Augment’s code when changes appear

## ✅ Goals
- Achieve 93%+ test coverage across all modules
- Resolve all critical (🔴) errors blocking development
- Maintain performance targets (bundle size <820KB, load time <1.2s)
- Ensure GDPR compliance and security best practices
- Support Swedish language throughout the application

## 🧪 Current Phase: Comprehensive Test Coverage Implementation (Phase 6)

### Test Coverage Strategy
Following the Phase 6 comprehensive test coverage guide with proven patterns:

#### Priority Testing Areas:
1. **CRITICAL PRIORITY (🚨)**
   - Authentication Services (BankID, Criipto OAuth)
   - Security Services (AES-256 encryption, GDPR compliance)
   - Database Services (Supabase, RLS policies)
   - AI Services (Azure Speech-to-text, OpenAI protocol generation)
   - Video Meeting Services (WebRTC, LiveKit)

2. **HIGH PRIORITY (🔥)**
   - Meeting Management Screens
   - Protocol Generation Flow
   - Error Handling Utils
   - Navigation Flow
   - State Management Hooks

3. **MEDIUM PRIORITY (📋)**
   - UI Components
   - Utility Functions
   - Configuration Files
   - Localization

#### Test Implementation Patterns:
- **Service Tests**: 26 tests per service (6 categories × 4-5 tests each)
- **Component Tests**: 32 tests per component (8 categories × 4 tests each)
- **Swedish Language Validation**: Mandatory in all tests
- **Security & GDPR**: Integrated into all service tests
- **Performance**: Monitored and validated

#### Success Metrics:
- Overall Coverage: 93%+
- Services Coverage: 95%+
- Components Coverage: 90%+
- Utils Coverage: 95%+
- Screens Coverage: 85%+

## Project Overview

SÖKA Stiftelseappen - A Swedish foundation board meeting management application built with React Native/Expo for iOS, Android, and Web. The app enables board meetings (physical and digital), audio recording, AI-powered protocol generation, and BankID digital signing.

## Essential Commands

### Development
```bash
npm start                    # Standard Expo development
npm run start:enhanced       # With error reporting and logging
npm run start:dev-web       # Web development with verbose logging
npm run start:dev-android   # Android development with logging
npm run start:dev-ios       # iOS development with logging
```

### Testing
```bash
npm test                    # Run all tests
npm run test:coverage       # Generate coverage report
npm run test:watch         # Watch mode for TDD
npm run test:ci            # Run tests in CI environment
```

### Build & Deploy
```bash
npm run build:web          # Build web version
npm run build:eas          # Build all platforms via EAS
npm run deploy:staging     # Deploy to staging environment
npm run deploy:production  # Deploy to production
```

### Code Quality
```bash
npm run analyze:bundle     # Analyze bundle size
npm run security-audit     # Run security audit
npm run optimize-performance # Run performance optimization
```

## Architecture

The codebase follows a module-based architecture with clear separation of concerns:

### Key Directories
- `/soka-app/src/screens/` - Feature-based screens (auth, meeting, protocol, etc.)
- `/soka-app/src/services/` - Business logic and API integrations
- `/soka-app/src/components/` - Reusable UI components
- `/soka-app/src/navigation/` - React Navigation setup
- `/soka-app/src/utils/` - Utility functions and helpers
- `/soka-app/src/hooks/` - Custom React hooks

### Core Services Integration
1. **Authentication**: BankID via Criipto OAuth
2. **Database**: Supabase (PostgreSQL with Row Level Security)
3. **Speech-to-Text**: Azure Speech Services (Swedish language)
4. **AI Protocol**: Azure OpenAI GPT-4 for protocol generation
5. **Video Meetings**: WebRTC implementation with LiveKit
6. **Error Tracking**: Sentry for production monitoring

### Performance Optimizations
- Code splitting with React.lazy() for major features
- Bundle size optimized from 7.4MB to 820KB (88.9% reduction)
- Critical rendering path optimization
- Progressive web app features for web version

### Security Architecture
- End-to-end encryption with AES-256
- GDPR compliant with comprehensive audit logging
- Row-level security in Supabase
- Secure storage for sensitive data
- BankID for strong authentication

## Development Guidelines

### Environment Setup
Required environment variables in `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
EXPO_PUBLIC_CRIIPTO_DOMAIN=<your-criipto-domain>
EXPO_PUBLIC_CRIIPTO_CLIENT_ID=<your-criipto-client-id>
EXPO_PUBLIC_AZURE_SPEECH_KEY=<your-azure-speech-key>
EXPO_PUBLIC_AZURE_SPEECH_REGION=swedencentral
EXPO_PUBLIC_AZURE_OPENAI_API_KEY=<your-azure-openai-key>
EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT=<your-azure-openai-endpoint>
```

### Testing Approach
- Unit tests for all services and utilities following proven patterns
- Integration tests for critical workflows (BankID → Meeting → Protocol → Sign)
- Security tests for authentication and encryption (mandatory GDPR compliance)
- E2E tests for complete user journeys with Swedish language support
- Service tests: 26 tests per service (6 categories with 4-5 tests each)
- Component tests: 32 tests per component (8 categories with 4 tests each)
- Target: 93%+ overall coverage with specific targets per module type

### Key Technical Decisions
1. **TypeScript**: Strict mode enabled for type safety
2. **React Native 0.79.5**: Latest stable version with Expo SDK 53
3. **Monorepo Structure**: Workspace setup for scalability
4. **Swedish Language**: All AI services configured for Swedish
5. **EU Data Residency**: All services hosted in EU regions for GDPR

## Common Development Tasks

### Adding a New Feature
1. Create feature module in `/src/screens/`
2. Add corresponding service in `/src/services/`
3. Create reusable components in `/src/components/`
4. Add navigation in `/src/navigation/`
5. Write comprehensive tests using Phase 6 patterns:
   - Service tests: 26 tests (6 categories)
   - Component tests: 32 tests (8 categories)
   - Include Swedish language validation
   - Add security and GDPR compliance tests
6. Update security matrix if needed
7. Verify coverage targets are met

### Working with AI Services
- Speech-to-text uses Azure Speech Services with Swedish models
- Protocol generation uses Azure OpenAI GPT-4
- All AI operations include user consent checks
- Transcriptions and protocols are encrypted before storage

### Database Operations
- All database queries use Supabase client
- Row Level Security (RLS) enforced at database level
- Use typed database schema from `/src/types/database.types.ts`
- Audit logging for all critical operations

## Production Considerations

- Application is production-ready and deployed
- Comprehensive monitoring with Sentry
- Performance metrics tracked
- GDPR compliance validated
- Security assessment completed
- Bundle size optimized for mobile networks