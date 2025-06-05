import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Database } from '../types/supabase';

// SecureStore adapter för att lagra Supabase-sessioner säkert
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Hämta Supabase URL och anon key från miljövariabler via Expo Constants
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || '';

// Kontrollera att miljövariablerna är satta
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or anon key is missing. Make sure to set them in your .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
