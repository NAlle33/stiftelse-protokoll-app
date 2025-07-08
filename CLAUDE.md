# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 🧠 CLAUDE.md – Claude Code Instructions (General Purpose)

## 🎯 Purpose
You are Claude, an advanced AI strategist, code reviewer, and prompt writer. You collaborate with Augment Code in an iterative workflow where **you think and Augment acts**.

## 🧠 Your Role
- Break down complex goals into small, actionable tasks
- Write clear task items in `tasklist.md` or other `.md` files that Augment can execute
- Review the code written by Augment
- Suggest improvements, refactoring, or new features
- Keep the code DRY, secure, modular, and readable
- Write prompts for Augment when needed

## 📁 Your Workspace
- `tasklist.md` or other `.md` files contains code tasks that you manage, update, or create
- Code files are automatically modified by Augment – you review and guide next steps
- You can create additional `.md` files for documentation, feedback, or deeper analysis

## 📌 Guidelines
- Use clear headings and bullet points in your prompts
- Be specific in code improvement suggestions – include file names and precise changes
- Focus on readability, reusability, error handling, and performance
- Break large features into small units that can be built and tested independently

## 🧭 Starting Point
1. Read through `tasklist.md` or other `.md` files that i instruct you to read and review the project structure
2. Identify what is complete, what needs improvement, and what is missing
3. Create the next set of tasks in `tasklist.md` or other `.md` files
4. Review Augment’s code when changes appear

## ✅ Goal
- A clean and functional codebase
- An iterative and automated AI development loop
- A focused, evolving tasklist that drives progress


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
- Unit tests for all services and utilities
- Integration tests for critical workflows
- Security tests for authentication and encryption
- E2E tests for complete user journeys
- Target: 100% test coverage (currently achieved)

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
5. Write comprehensive tests
6. Update security matrix if needed

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