// app.config.js - Expo configuration with environment variables
import 'dotenv/config';

export default {
  expo: {
    name: "protokoll-app",
    slug: "protokoll-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to save downloaded protocols.",
        NSPhotoLibraryAddUsageDescription: "This app needs access to your photo library to save downloaded protocols."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    // Environment variables that will be available in the app
    extra: {
      // Supabase configuration
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      
      // BankID configuration
      criiptoDomain: process.env.CRIIPTO_DOMAIN,
      criiptoClientId: process.env.CRIIPTO_CLIENT_ID,
      
      // Azure Speech Service configuration
      azureSpeechKey: process.env.AZURE_SPEECH_KEY,
      azureSpeechRegion: process.env.AZURE_SPEECH_REGION,
      
      // Email service configuration
      emailApiKey: process.env.EMAIL_API_KEY,
      emailFrom: process.env.EMAIL_FROM || 'noreply@sokastiftelse.se',
      
      // App configuration
      appUrl: process.env.APP_URL || 'https://app.sokastiftelse.se',
      
      // Environment indicator
      isProduction: process.env.NODE_ENV === 'production',
    }
  }
};
