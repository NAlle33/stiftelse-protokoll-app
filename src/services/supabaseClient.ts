import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Environment variables with fallbacks
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Validate environment variables with Swedish error messages
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('🔧 Supabase-konfigurationsfel: Saknade miljövariabler');
  console.error('📋 Krävs: EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.error('🛠️  För att konfigurera Supabase:');
  console.error('   1. Aktivera Supabase-projektet "protokoll-app" (pbixoirdtwajlsgqqeoq)');
  console.error('   2. Hämta API-nycklar från projektinställningar');
  console.error('   3. Uppdatera .env-filen med korrekta värden');
  console.error('🌐 Projekt-URL: https://pbixoirdtwajlsgqqeoq.supabase.co');
}

// Custom storage adapter for React Native
const customStorageAdapter = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Storage setItem error:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removeItem error:', error);
    }
  },
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2,
};

// Create Supabase client with enhanced configuration
const createSupabaseClient = (): SupabaseClient => {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: customStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          'X-Client-Info': 'soka-app-swedish-board-meeting',
        },
      },
      db: {
        schema: 'public',
      },
    });

    // Add connection monitoring
    client.auth.onAuthStateChange((event, session) => {
      console.log('Supabase auth state changed:', event);
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      } else if (event === 'SIGNED_IN') {
        console.log('User signed in');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });

    return client;
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    throw new Error('Supabase client initialization failed');
  }
};

// Enhanced fetch wrapper with retry logic and Swedish error messages
const enhancedFetch = async (
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for mobile

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SOKA-Swedish-Board-Meeting-App/1.0.0',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorMessage = `🌐 Nätverksfel: HTTP ${response.status} - ${response.statusText}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    return response;
  } catch (error) {
    const isNetworkError = error instanceof TypeError && error.message.includes('Network request failed');
    const isTimeoutError = error.name === 'AbortError';

    if (isNetworkError) {
      console.error(`🔌 Nätverksanslutningsfel (försök ${retryCount + 1}/${RETRY_CONFIG.maxRetries + 1}):`, {
        url: url.replace(/\/[^\/]*$/, '/***'), // Hide sensitive parts of URL
        error: 'Nätverksbegäran misslyckades',
        platform: Platform.OS,
        timestamp: new Date().toISOString()
      });
    } else if (isTimeoutError) {
      console.error(`⏱️  Timeout-fel (försök ${retryCount + 1}/${RETRY_CONFIG.maxRetries + 1}):`, {
        url: url.replace(/\/[^\/]*$/, '/***'),
        error: 'Begäran tog för lång tid',
        timeout: '15 sekunder'
      });
    } else {
      console.error(`❌ Okänt nätverksfel (försök ${retryCount + 1}/${RETRY_CONFIG.maxRetries + 1}):`, error);
    }

    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
      console.log(`🔄 Försöker igen om ${delay}ms... (GDPR-kompatibel återförsök)`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return enhancedFetch(url, options, retryCount + 1);
    }

    // Final error with Swedish GDPR-compliant message
    const finalError = new Error(
      isNetworkError
        ? '🔌 Nätverksanslutning misslyckades. Kontrollera internetanslutning och försök igen.'
        : isTimeoutError
        ? '⏱️  Begäran tog för lång tid. Kontrollera nätverkshastighet och försök igen.'
        : '❌ Ett oväntat nätverksfel inträffade. Kontakta support om problemet kvarstår.'
    );

    throw finalError;
  }
};

// Create the client instance with enhanced error handling
let supabaseClient: SupabaseClient;

// Check if we're in demo/development mode
const isDemoMode = !SUPABASE_URL || !SUPABASE_ANON_KEY ||
                   SUPABASE_URL.includes('your-') || SUPABASE_ANON_KEY.includes('your-') ||
                   SUPABASE_ANON_KEY.includes('demo-');

if (isDemoMode) {
  console.warn('🔧 Supabase körs i demo-läge - ingen riktig databasanslutning');
  console.warn('📋 För att aktivera Supabase:');
  console.warn('   1. Aktivera projektet "protokoll-app" (pbixoirdtwajlsgqqeoq)');
  console.warn('   2. Hämta API-nycklar från Supabase-projektinställningar');
  console.warn('   3. Uppdatera .env-filen med korrekta värden');

  // Create a comprehensive mock client for development
  supabaseClient = {
    auth: {
      getSession: () => Promise.resolve({
        data: { session: null },
        error: { message: 'Demo-läge: Ingen riktig autentisering tillgänglig' }
      }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => console.log('🔄 Demo auth state change unsubscribed')
          }
        }
      }),
      getUser: () => Promise.resolve({
        data: { user: null },
        error: { message: 'Demo-läge: Ingen användare tillgänglig' }
      }),
    },
    from: (table: string) => ({
      select: () => {
        console.warn(`🗄️  Demo-läge: Simulerar SELECT från tabell "${table}"`);
        return Promise.resolve({
          data: [],
          error: { message: `Demo-läge: Ingen riktig data från tabell "${table}"` }
        });
      },
      insert: (data: any) => {
        console.warn(`🗄️  Demo-läge: Simulerar INSERT till tabell "${table}"`, data);
        return Promise.resolve({
          data: null,
          error: { message: `Demo-läge: Kan inte spara data till tabell "${table}"` }
        });
      },
      update: (data: any) => {
        console.warn(`🗄️  Demo-läge: Simulerar UPDATE i tabell "${table}"`, data);
        return Promise.resolve({
          data: null,
          error: { message: `Demo-läge: Kan inte uppdatera data i tabell "${table}"` }
        });
      },
      delete: () => {
        console.warn(`🗄️  Demo-läge: Simulerar DELETE från tabell "${table}"`);
        return Promise.resolve({
          data: null,
          error: { message: `Demo-läge: Kan inte ta bort data från tabell "${table}"` }
        });
      },
      eq: function(column: string, value: any) { return this; },
      single: function() { return this; },
      order: function(column: string, options?: any) { return this; },
      limit: function(count: number) { return this; },
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: any) => {
          console.warn(`📁 Demo-läge: Simulerar filuppladdning till bucket "${bucket}"`);
          return Promise.resolve({
            data: null,
            error: { message: `Demo-läge: Kan inte ladda upp fil till bucket "${bucket}"` }
          });
        },
        download: (path: string) => {
          console.warn(`📁 Demo-läge: Simulerar filnedladdning från bucket "${bucket}"`);
          return Promise.resolve({
            data: null,
            error: { message: `Demo-läge: Kan inte ladda ner fil från bucket "${bucket}"` }
          });
        },
      })
    },
    realtime: {
      channel: (name: string) => ({
        on: () => ({ subscribe: () => {} }),
        subscribe: () => {},
        unsubscribe: () => {},
      })
    }
  } as any;
} else {
  try {
    supabaseClient = createSupabaseClient();
    console.log('✅ Supabase-klient initialiserad med riktig databasanslutning');
  } catch (error) {
    console.error('❌ Kritiskt fel: Kunde inte initialisera Supabase-klient:', error);
    throw error;
  }
}
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
    realtime: {
      channel: () => ({
        on: () => ({}),
        subscribe: () => Promise.resolve('ok'),
        unsubscribe: () => Promise.resolve('ok'),
      }),
    },
  } as any;
}

// Health check function
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
    console.log('Supabase connection check successful');
    return true;
  } catch (error) {
    console.error('Supabase connection check error:', error);
    return false;
  }
};

// Connection retry wrapper for database operations with Swedish error messages
export const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'Databasoperation'
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if it's a Supabase configuration error
      if (lastError.message.includes('Invalid API key') ||
          lastError.message.includes('Project not found') ||
          lastError.message.includes('Network request failed')) {
        console.error(`🔧 ${operationName} - Konfigurationsfel (försök ${attempt}/${RETRY_CONFIG.maxRetries}):`, {
          error: lastError.message,
          suggestion: 'Kontrollera Supabase-konfiguration och projektaktivering',
          platform: Platform.OS,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error(`❌ ${operationName} - Fel (försök ${attempt}/${RETRY_CONFIG.maxRetries}):`, {
          error: lastError.message,
          platform: Platform.OS
        });
      }

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
        console.log(`🔄 Försöker ${operationName} igen om ${delay}ms... (GDPR-säker återförsök)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Create Swedish GDPR-compliant error message
  const isConfigError = lastError.message.includes('Invalid API key') ||
                        lastError.message.includes('Project not found') ||
                        lastError.message.includes('Network request failed');

  const swedishErrorMessage = isConfigError
    ? `🔧 ${operationName} misslyckades: Supabase-konfigurationsfel. Kontrollera att projektet är aktiverat och API-nycklar är korrekta.`
    : `❌ ${operationName} misslyckades efter ${RETRY_CONFIG.maxRetries} försök: ${lastError.message}`;

  throw new Error(swedishErrorMessage);
};

// Export the client and utilities
export { supabaseClient as supabase, enhancedFetch };
export default supabaseClient;

// Initialize connection check on module load
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  checkSupabaseConnection().catch(error => {
    console.error('Initial Supabase connection check failed:', error);
  });
} else {
  console.warn('Supabase client running in mock mode due to missing configuration');
}
