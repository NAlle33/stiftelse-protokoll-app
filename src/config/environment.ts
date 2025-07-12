import { Platform } from 'react-native';

// Environment configuration for the Swedish Board Meeting App (SÖKA)
interface EnvironmentConfig {
  // Supabase Configuration
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  
  // Azure Speech Service Configuration
  azure: {
    speechKey?: string;
    speechRegion?: string;
  };
  
  // OpenAI Configuration
  openai: {
    apiKey?: string;
    model?: string;
  };
  
  // BankID Configuration
  bankid: {
    clientId?: string;
    environment?: 'test' | 'production';
  };
  
  // App Configuration
  app: {
    environment: 'development' | 'staging' | 'production';
    version: string;
    buildNumber: string;
    debugMode: boolean;
  };
  
  // Feature Flags
  features: {
    enablePushNotifications: boolean;
    enableOfflineMode: boolean;
    enableAnalytics: boolean;
    enableCrashReporting: boolean;
  };

  // Service Migration Flags
  serviceMigration: {
    useMigratedUserService: boolean;
    useMigratedVideoService: boolean;
    useMigratedSignalingService: boolean;
    enableMigrationLogging: boolean;
    enableMigrationMetrics: boolean;
    forceLegacyServices: boolean;
  };
}

// Default configuration
const defaultConfig: EnvironmentConfig = {
  supabase: {
    url: '',
    anonKey: '',
  },
  azure: {},
  openai: {
    model: 'gpt-4',
  },
  bankid: {
    environment: 'test',
  },
  app: {
    environment: 'development',
    version: '1.0.0',
    buildNumber: '1',
    debugMode: __DEV__,
  },
  features: {
    enablePushNotifications: Platform.OS !== 'web',
    enableOfflineMode: true,
    enableAnalytics: false,
    enableCrashReporting: false,
  },
  serviceMigration: {
    useMigratedUserService: false,
    useMigratedVideoService: false,
    useMigratedSignalingService: false,
    enableMigrationLogging: true,
    enableMigrationMetrics: true,
    forceLegacyServices: false,
  },
};

// Environment variable getters with fallbacks
const getEnvVar = (key: string, fallback: string = ''): string => {
  // Try different environment variable naming conventions
  const variants = [
    key,
    `EXPO_PUBLIC_${key}`,
    `REACT_NATIVE_${key}`,
    `NEXT_PUBLIC_${key}`,
  ];
  
  for (const variant of variants) {
    const value = process.env[variant];
    if (value && value.trim() !== '') {
      return value.trim();
    }
  }
  
  return fallback;
};

// Load configuration from environment variables
const loadEnvironmentConfig = (): EnvironmentConfig => {
  const config: EnvironmentConfig = {
    supabase: {
      url: getEnvVar('SUPABASE_URL'),
      anonKey: getEnvVar('SUPABASE_ANON_KEY'),
      serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    },
    azure: {
      speechKey: getEnvVar('AZURE_SPEECH_KEY'),
      speechRegion: getEnvVar('AZURE_SPEECH_REGION', 'northeurope'),
    },
    openai: {
      apiKey: getEnvVar('OPENAI_API_KEY'),
      model: getEnvVar('OPENAI_MODEL', 'gpt-4'),
    },
    bankid: {
      clientId: getEnvVar('BANKID_CLIENT_ID'),
      environment: (getEnvVar('BANKID_ENVIRONMENT', 'test') as 'test' | 'production'),
    },
    app: {
      environment: (getEnvVar('NODE_ENV', 'development') as 'development' | 'staging' | 'production'),
      version: getEnvVar('APP_VERSION', '1.0.0'),
      buildNumber: getEnvVar('APP_BUILD_NUMBER', '1'),
      debugMode: getEnvVar('DEBUG_MODE', __DEV__.toString()) === 'true',
    },
    features: {
      enablePushNotifications: getEnvVar('ENABLE_PUSH_NOTIFICATIONS', Platform.OS !== 'web' ? 'true' : 'false') === 'true',
      enableOfflineMode: getEnvVar('ENABLE_OFFLINE_MODE', 'true') === 'true',
      enableAnalytics: getEnvVar('ENABLE_ANALYTICS', 'false') === 'true',
      enableCrashReporting: getEnvVar('ENABLE_CRASH_REPORTING', 'false') === 'true',
    },
    serviceMigration: {
      useMigratedUserService: getEnvVar('USE_MIGRATED_USER_SERVICE', 'false') === 'true',
      useMigratedVideoService: getEnvVar('USE_MIGRATED_VIDEO_SERVICE', 'false') === 'true',
      useMigratedSignalingService: getEnvVar('USE_MIGRATED_SIGNALING_SERVICE', 'false') === 'true',
      enableMigrationLogging: getEnvVar('ENABLE_MIGRATION_LOGGING', 'true') === 'true',
      enableMigrationMetrics: getEnvVar('ENABLE_MIGRATION_METRICS', 'true') === 'true',
      forceLegacyServices: getEnvVar('FORCE_LEGACY_SERVICES', 'false') === 'true',
    },
  };

  return config;
};

// Validate configuration
const validateConfig = (config: EnvironmentConfig): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required Supabase configuration
  if (!config.supabase.url) {
    errors.push('Missing required environment variable: SUPABASE_URL');
  }
  if (!config.supabase.anonKey) {
    errors.push('Missing required environment variable: SUPABASE_ANON_KEY');
  }

  // Validate Supabase URL format
  if (config.supabase.url && !config.supabase.url.startsWith('https://')) {
    errors.push('SUPABASE_URL must start with https://');
  }

  // Validate environment
  if (!['development', 'staging', 'production'].includes(config.app.environment)) {
    errors.push('Invalid NODE_ENV value. Must be development, staging, or production');
  }

  // Validate BankID environment
  if (config.bankid.environment && !['test', 'production'].includes(config.bankid.environment)) {
    errors.push('Invalid BANKID_ENVIRONMENT value. Must be test or production');
  }

  // Production-specific validations
  if (config.app.environment === 'production') {
    if (!config.azure.speechKey) {
      errors.push('AZURE_SPEECH_KEY is required in production');
    }
    if (!config.openai.apiKey) {
      errors.push('OPENAI_API_KEY is required in production');
    }
    if (!config.bankid.clientId) {
      errors.push('BANKID_CLIENT_ID is required in production');
    }
    if (config.bankid.environment !== 'production') {
      errors.push('BANKID_ENVIRONMENT must be "production" in production environment');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Load and validate configuration
let environmentConfig: EnvironmentConfig;
let configValidation: { isValid: boolean; errors: string[] };

try {
  environmentConfig = loadEnvironmentConfig();
  configValidation = validateConfig(environmentConfig);

  // Log configuration status
  if (configValidation.isValid) {
    console.log('✅ Environment configuration loaded successfully');
    if (environmentConfig.app.debugMode) {
      console.log('🔧 Debug mode enabled');
      console.log('📍 Environment:', environmentConfig.app.environment);
      console.log('🏗️ Version:', environmentConfig.app.version);
      console.log('🔢 Build:', environmentConfig.app.buildNumber);
    }
  } else {
    console.error('❌ Environment configuration validation failed:');
    configValidation.errors.forEach(error => console.error(`  - ${error}`));
    
    // In development, show warnings but continue
    if (environmentConfig.app.environment === 'development') {
      console.warn('⚠️ Continuing with partial configuration in development mode');
    }
  }
} catch (error) {
  console.error('💥 Failed to load environment configuration:', error);
  environmentConfig = defaultConfig;
  configValidation = { isValid: false, errors: ['Failed to load configuration'] };
}

// Export configuration and utilities
export { environmentConfig as config, configValidation };

export const isConfigValid = (): boolean => configValidation.isValid;

export const getConfigErrors = (): string[] => configValidation.errors;

export const isFeatureEnabled = (feature: keyof EnvironmentConfig['features']): boolean => {
  return environmentConfig.features[feature];
};

export const isDevelopment = (): boolean => environmentConfig.app.environment === 'development';
export const isProduction = (): boolean => environmentConfig.app.environment === 'production';
export const isDebugMode = (): boolean => environmentConfig.app.debugMode;

// Helper function to get safe config values
export const getSafeConfig = () => {
  return {
    app: environmentConfig.app,
    features: environmentConfig.features,
    hasSupabase: !!(environmentConfig.supabase.url && environmentConfig.supabase.anonKey),
    hasAzureSpeech: !!environmentConfig.azure.speechKey,
    hasOpenAI: !!environmentConfig.openai.apiKey,
    hasBankID: !!environmentConfig.bankid.clientId,
  };
};

// Environment-specific logging
export const logConfig = () => {
  if (!isDebugMode()) return;

  console.group('🔧 Environment Configuration');
  console.log('Environment:', environmentConfig.app.environment);
  console.log('Version:', environmentConfig.app.version);
  console.log('Build:', environmentConfig.app.buildNumber);
  console.log('Platform:', Platform.OS);
  console.log('Debug Mode:', environmentConfig.app.debugMode);
  
  console.group('🔌 Services');
  console.log('Supabase:', environmentConfig.supabase.url ? '✅ Configured' : '❌ Missing');
  console.log('Azure Speech:', environmentConfig.azure.speechKey ? '✅ Configured' : '❌ Missing');
  console.log('OpenAI:', environmentConfig.openai.apiKey ? '✅ Configured' : '❌ Missing');
  console.log('BankID:', environmentConfig.bankid.clientId ? '✅ Configured' : '❌ Missing');
  console.groupEnd();
  
  console.group('🎛️ Features');
  Object.entries(environmentConfig.features).forEach(([key, value]) => {
    console.log(`${key}:`, value ? '✅ Enabled' : '❌ Disabled');
  });
  console.groupEnd();
  
  if (configValidation.errors.length > 0) {
    console.group('⚠️ Configuration Issues');
    configValidation.errors.forEach(error => console.warn(error));
    console.groupEnd();
  }
  
  console.groupEnd();
};

// Auto-log configuration in debug mode
if (isDebugMode()) {
  logConfig();
}

export default environmentConfig;
