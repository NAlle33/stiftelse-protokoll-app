# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is SÖKA Stiftelseappen - a Swedish board meeting protocol management app built with React Native/Expo. The app provides secure digital meeting documentation with BankID authentication, audio recording, automatic transcription, AI-powered protocol generation, and digital signing capabilities.

## Key Architecture

### Workspace Structure
- **Root workspace**: Monorepo with main app in `soka-app/` subdirectory
- **Main application**: Located in `soka-app/` - this is where most development happens
- **Test workspace**: Additional test files in root `__tests__/` and `src/` directories
- **Shared components**: Some components and services exist in both root `src/` and `soka-app/src/`
- **Video Meeting components**: WebRTC integration components in `src/components/VideoMeeting/`

### Core Technology Stack
- **Frontend**: React Native with Expo (v53)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Authentication**: BankID integration via Criipto
- **AI Services**: Azure OpenAI for protocol generation
- **Speech**: Azure Speech Services for transcription
- **Language**: TypeScript with strict mode enabled

### Security & Compliance
- **GDPR-compliant**: All data stored in EU datacenters
- **Encryption**: End-to-end encrypted storage using Expo SecureStore
- **Row-Level Security**: Database access controlled via Supabase RLS policies
- **Audit logging**: Comprehensive activity tracking

## Common Development Commands

### Main Development
```bash
# Start development server
cd soka-app && npm start

# Platform-specific development
cd soka-app && npm run android    # Android emulator
cd soka-app && npm run ios        # iOS simulator  
cd soka-app && npm run web        # Web browser

# Enhanced development with error reporting
cd soka-app && npm run start:enhanced
cd soka-app && npm run start:android-enhanced
cd soka-app && npm run start:qr

# Development with logging
cd soka-app && npm run start:dev-logging
cd soka-app && npm run start:dev-web
cd soka-app && npm run start:dev-android
cd soka-app && npm run start:dev-ios
```

### Testing
```bash
# Run all tests
cd soka-app && npm test

# Run tests with coverage
cd soka-app && npm run test:coverage

# Run tests in watch mode
cd soka-app && npm run test:watch

# Run CI tests (no watch)
cd soka-app && npm run test:ci
```

### Build and Deployment
```bash
# Web builds
cd soka-app && npm run build:web
cd soka-app && npm run serve:web

# EAS builds
cd soka-app && npm run build:eas
cd soka-app && npm run build:eas:android
cd soka-app && npm run build:eas:ios

# Deploy to staging
cd soka-app && npm run deploy:staging

# Deploy to production (requires manual confirmation)
cd soka-app && npm run deploy:production

# Netlify deployment
cd soka-app && npm run netlify:build
cd soka-app && npm run netlify:preview
cd soka-app && npm run netlify:deploy

# Security audit
cd soka-app && ./scripts/security-audit.sh

# Performance optimization
cd soka-app && ./scripts/optimize-performance.sh
```

### Azure Service Testing
```bash
# Test Azure OpenAI integration
cd soka-app && node scripts/test-azure-openai.js

# Test Azure Speech Service
cd soka-app && node scripts/test-azure-speech-service.js

# Test complete workflow
cd soka-app && node scripts/test-complete-workflow.js
```

## Project Structure

### Core Directories
- `soka-app/src/components/` - React Native components
- `soka-app/src/screens/` - App screens/pages
- `soka-app/src/services/` - API services and business logic
- `soka-app/src/hooks/` - Custom React hooks
- `soka-app/src/navigation/` - Navigation configuration
- `soka-app/src/types/` - TypeScript type definitions
- `soka-app/src/config/` - Configuration files
- `soka-app/supabase/` - Supabase configuration and functions

### Key Services
- **Authentication**: `authService.ts`, `bankidService.ts`
- **Meeting Management**: `meetingService.ts`, `audioRecordingService.ts`
- **Video Meetings**: `videoMeetingService.ts`, `webrtcPeerService.ts`, `webrtcSignalingService.ts`
- **AI Integration**: `aiProtocolService.ts`, `transcriptionService.ts`
- **Security**: `encryptionService.ts`, `securityService.ts`
- **Data**: `protocolService.ts`, `fileService.ts`
- **Support & Feedback**: `supportService.ts`, `feedbackService.ts`, `onboardingService.ts`

## Configuration Management

### Environment Variables
Required environment variables (configured in `app.config.js`):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `CRIIPTO_DOMAIN` - BankID authentication domain
- `CRIIPTO_CLIENT_ID` - BankID client ID
- `AZURE_SPEECH_KEY` - Azure Speech Services key
- `AZURE_SPEECH_REGION` - Azure Speech Services region
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL

### Database Configuration
- Supabase client configured in `src/config/supabase.ts`
- Uses EU datacenter (eu-central-1) for GDPR compliance
- Secure session storage via Expo SecureStore

## Swedish Language Considerations

### Character Support
- Full Swedish character support (å, ä, ö)
- UTF-8 encoding throughout
- Swedish-specific text processing in transcription services

### Localization
- Swedish UI text and error messages
- Swedish date/time formatting
- Swedish business terminology for board meetings

## Development Guidelines

### Testing Requirements
- Unit tests for all services in `__tests__/unit/`
- Integration tests in `__tests__/integration/`
- Security tests in `__tests__/security/`
- E2E tests in `__tests__/e2e/`

### Code Quality
- TypeScript strict mode enabled
- Jest testing framework with comprehensive coverage
- ESLint configuration for code quality
- Automated security scanning

### Performance Considerations
- Metro bundler optimization configured
- Lazy loading for large components
- Performance monitoring in place
- Bundle size optimization (target <1MB)

## Common Issues and Solutions

### Development Server Issues
- Use enhanced start scripts for better error reporting
- Console forwarding available for debugging
- QR code optimization for Expo Go

### Build Issues
- Android builds require Java 11+
- iOS builds require Xcode 14+
- Web builds optimized for PWA deployment

### Testing Issues
- Use `npm run test:ci` for CI environments
- Mock configurations available for external services
- Enhanced memory management for large test suites

## Security Notes

### Sensitive Data Handling
- Never commit API keys or secrets
- Use environment variables for all configuration
- Supabase keys are already committed (anon key only - safe for client-side)

### Authentication Flow
- BankID authentication handled via Criipto service
- Session management via Supabase Auth with secure storage
- Automatic token refresh implemented

### Data Protection
- All user data encrypted at rest
- GDPR compliance built-in
- Audit logging for all data access

## Claude & Augment Collaboration Workflow

This project uses a hybrid Claude + Augment workflow for optimal productivity.

### Claude (Architect, Planner, Reviewer)
- Defines or updates `tasklist.md` with implementation steps
- Reviews code after milestones (typically every 3–5 tasks)
- Proposes architecture or design improvements
- Updates this `CLAUDE.md` file as the project evolves
- Explains trade-offs and reasons behind architectural choices

Claude should not directly implement features unless explicitly requested.

### Augment (Executor, Implementer)
- Executes tasks listed in `tasklist.md`, one by one
- Marks tasks as complete (`[x]`) and commits changes with meaningful messages
- Follows project structure, naming conventions, and code style as defined above
- Never modifies `CLAUDE.md` or architectural rules unless instructed
- Applies formatting (Prettier), linting (ESLint), and testing (Jest) as needed

### Workflow Summary
1. Claude creates or updates `tasklist.md` based on project status or user input
2. Augment executes tasks sequentially, marking them as completed
3. Claude reviews the results and suggests improvements or next steps
4. Improvements are added to a new or updated `tasklist.md`
5. The user provides guidance or clarification as needed

If ambiguity arises, Claude’s reasoning takes precedence unless overridden by the user.

### Claude Error Handling Policy

- If Augment's implementation contains **minor bugs**, **missing details**, or **small structural mistakes**, Claude may directly fix them.
- If the issue is **structural**, **involves multiple files**, or affects app security/performance, Claude should instead add tasks to `tasklist.md` and allow Augment to handle the fix.
- Claude must always explain the reasoning behind any direct fixes or new tasks.

Direct code modifications by Claude are allowed if:
- The scope is well-contained
- The impact is minimal
- No user decision is required
