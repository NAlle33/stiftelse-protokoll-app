/**
 * Network Connectivity Service - Hanterar nätverksanslutning för svenska styrelseprotokoll-appen
 * 
 * Denna service hanterar:
 * - Nätverksanslutningskontroll för Android/iOS/Web
 * - Supabase-anslutningsvalidering
 * - GDPR-kompatibel felrapportering på svenska
 * - Cross-platform nätverkskonfiguration
 * 
 * Säkerhetsfokus:
 * - Säker hantering av API-nycklar
 * - GDPR-kompatibel loggning
 * - Svenska felmeddelanden för användare
 * - Automatisk återanslutning vid nätverksproblem
 */

import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

// Conditional import for NetInfo (only on mobile platforms)
let NetInfo: any = null;
if (Platform.OS !== 'web') {
  try {
    NetInfo = require('@react-native-community/netinfo').default;
  } catch (error) {
    console.warn('⚠️  NetInfo inte tillgängligt på denna plattform:', Platform.OS);
  }
}

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean | null;
  details: {
    strength?: number;
    ssid?: string;
    ipAddress?: string;
    subnet?: string;
  };
}

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  isReachable: boolean;
  projectStatus: 'active' | 'inactive' | 'unknown';
  lastChecked: Date;
  error?: string;
}

class NetworkConnectivityService {
  private networkStatus: NetworkStatus | null = null;
  private supabaseStatus: SupabaseConnectionStatus | null = null;
  private listeners: Array<(status: NetworkStatus) => void> = [];
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Initialiserar nätverksövervakning
   */
  async initialize(): Promise<void> {
    try {
      console.log('🌐 Initialiserar nätverksövervakning för SÖKA-appen...');

      // Kontrollera initial nätverksstatus
      await this.checkNetworkStatus();
      
      // Kontrollera Supabase-anslutning
      await this.checkSupabaseConnection();

      // Starta kontinuerlig övervakning (endast på mobila enheter)
      if (Platform.OS !== 'web') {
        this.startNetworkMonitoring();
      }

      console.log('✅ Nätverksövervakning initialiserad');
    } catch (error) {
      console.error('❌ Fel vid initialisering av nätverksövervakning:', error);
    }
  }

  /**
   * Kontrollerar aktuell nätverksstatus
   */
  async checkNetworkStatus(): Promise<NetworkStatus> {
    try {
      if (Platform.OS === 'web') {
        // Web-specifik nätverkskontroll
        const isOnline = navigator.onLine;
        this.networkStatus = {
          isConnected: isOnline,
          connectionType: 'web',
          isInternetReachable: isOnline,
          details: {}
        };
      } else {
        // React Native NetInfo för mobila enheter
        if (NetInfo) {
          const netInfoState = await NetInfo.fetch();
          this.networkStatus = {
            isConnected: netInfoState.isConnected ?? false,
            connectionType: netInfoState.type || 'unknown',
            isInternetReachable: netInfoState.isInternetReachable,
            details: {
              strength: netInfoState.details?.strength,
              ssid: netInfoState.details?.ssid,
              ipAddress: netInfoState.details?.ipAddress,
              subnet: netInfoState.details?.subnet,
            }
          };
        } else {
          // Fallback för plattformar utan NetInfo
          this.networkStatus = {
            isConnected: true, // Anta anslutning om vi inte kan kontrollera
            connectionType: Platform.OS,
            isInternetReachable: true,
            details: {}
          };
        }
      }

      console.log('📊 Nätverksstatus uppdaterad:', {
        ansluten: this.networkStatus.isConnected,
        typ: this.networkStatus.connectionType,
        internetåtkomst: this.networkStatus.isInternetReachable,
        plattform: Platform.OS
      });

      // Notifiera lyssnare
      this.notifyListeners(this.networkStatus);

      return this.networkStatus;
    } catch (error) {
      console.error('❌ Fel vid kontroll av nätverksstatus:', error);
      
      // Fallback-status
      const fallbackStatus: NetworkStatus = {
        isConnected: false,
        connectionType: 'unknown',
        isInternetReachable: false,
        details: {}
      };
      
      this.networkStatus = fallbackStatus;
      return fallbackStatus;
    }
  }

  /**
   * Kontrollerar Supabase-anslutning och projektstatus
   */
  async checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
    try {
      console.log('🔧 Kontrollerar Supabase-anslutning...');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      // Kontrollera konfiguration
      if (!supabaseUrl || !supabaseKey || 
          supabaseUrl.includes('your-') || supabaseKey.includes('your-')) {
        this.supabaseStatus = {
          isConfigured: false,
          isReachable: false,
          projectStatus: 'unknown',
          lastChecked: new Date(),
          error: 'Supabase-konfiguration saknas eller innehåller placeholder-värden'
        };

        console.warn('⚠️  Supabase ej konfigurerat:', {
          url: supabaseUrl ? 'Inställt' : 'Saknas',
          key: supabaseKey ? 'Inställt' : 'Saknas',
          urlValid: supabaseUrl && !supabaseUrl.includes('your-'),
          keyValid: supabaseKey && !supabaseKey.includes('your-')
        });

        return this.supabaseStatus;
      }

      // Testa anslutning till Supabase
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error && error.message.includes('Invalid API key')) {
          this.supabaseStatus = {
            isConfigured: true,
            isReachable: false,
            projectStatus: 'inactive',
            lastChecked: new Date(),
            error: 'Ogiltig API-nyckel eller inaktivt projekt'
          };
        } else {
          this.supabaseStatus = {
            isConfigured: true,
            isReachable: true,
            projectStatus: 'active',
            lastChecked: new Date()
          };
        }
      } catch (networkError) {
        this.supabaseStatus = {
          isConfigured: true,
          isReachable: false,
          projectStatus: 'unknown',
          lastChecked: new Date(),
          error: 'Nätverksfel vid anslutning till Supabase'
        };
      }

      console.log('📊 Supabase-status:', {
        konfigurerat: this.supabaseStatus.isConfigured,
        nåbart: this.supabaseStatus.isReachable,
        projektstatus: this.supabaseStatus.projectStatus,
        fel: this.supabaseStatus.error || 'Inga fel'
      });

      return this.supabaseStatus;
    } catch (error) {
      console.error('❌ Fel vid kontroll av Supabase-anslutning:', error);
      
      this.supabaseStatus = {
        isConfigured: false,
        isReachable: false,
        projectStatus: 'unknown',
        lastChecked: new Date(),
        error: 'Okänt fel vid Supabase-kontroll'
      };

      return this.supabaseStatus;
    }
  }

  /**
   * Startar kontinuerlig nätverksövervakning
   */
  private startNetworkMonitoring(): void {
    if (Platform.OS === 'web' || !NetInfo) return;

    // Lyssna på nätverksförändringar
    const unsubscribe = NetInfo.addEventListener(state => {
      const newStatus: NetworkStatus = {
        isConnected: state.isConnected ?? false,
        connectionType: state.type || 'unknown',
        isInternetReachable: state.isInternetReachable,
        details: {
          strength: state.details?.strength,
          ssid: state.details?.ssid,
          ipAddress: state.details?.ipAddress,
          subnet: state.details?.subnet,
        }
      };

      this.networkStatus = newStatus;
      this.notifyListeners(newStatus);

      console.log('🔄 Nätverksförändring detekterad:', {
        ansluten: newStatus.isConnected,
        typ: newStatus.connectionType,
        internetåtkomst: newStatus.isInternetReachable
      });
    });

    // Periodisk kontroll av Supabase-anslutning (var 30:e sekund)
    this.checkInterval = setInterval(async () => {
      await this.checkSupabaseConnection();
    }, 30000);

    console.log('🔄 Kontinuerlig nätverksövervakning startad');
  }

  /**
   * Lägger till lyssnare för nätverksförändringar
   */
  addNetworkListener(callback: (status: NetworkStatus) => void): () => void {
    this.listeners.push(callback);
    
    // Returnera unsubscribe-funktion
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notifierar alla lyssnare om nätverksförändringar
   */
  private notifyListeners(status: NetworkStatus): void {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('❌ Fel vid notifiering av nätverkslyssnare:', error);
      }
    });
  }

  /**
   * Hämtar aktuell nätverksstatus
   */
  getCurrentNetworkStatus(): NetworkStatus | null {
    return this.networkStatus;
  }

  /**
   * Hämtar aktuell Supabase-status
   */
  getCurrentSupabaseStatus(): SupabaseConnectionStatus | null {
    return this.supabaseStatus;
  }

  /**
   * Genererar diagnostikrapport för felsökning
   */
  generateDiagnosticReport(): {
    network: NetworkStatus | null;
    supabase: SupabaseConnectionStatus | null;
    platform: string;
    timestamp: string;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Nätverksrekommendationer
    if (!this.networkStatus?.isConnected) {
      recommendations.push('🔌 Kontrollera internetanslutning');
    }
    if (this.networkStatus?.connectionType === 'cellular') {
      recommendations.push('📱 Använder mobildata - kontrollera dataplan');
    }

    // Supabase-rekommendationer
    if (!this.supabaseStatus?.isConfigured) {
      recommendations.push('🔧 Konfigurera Supabase-miljövariabler');
    }
    if (this.supabaseStatus?.projectStatus === 'inactive') {
      recommendations.push('⚡ Aktivera Supabase-projektet "protokoll-app"');
    }
    if (!this.supabaseStatus?.isReachable) {
      recommendations.push('🌐 Kontrollera Supabase-projektets tillgänglighet');
    }

    return {
      network: this.networkStatus,
      supabase: this.supabaseStatus,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
      recommendations
    };
  }

  /**
   * Rensar resurser vid avslutning
   */
  cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.listeners = [];
    console.log('🧹 Nätverksövervakning rensad');
  }
}

// Exportera singleton-instans
export const networkConnectivityService = new NetworkConnectivityService();
export default networkConnectivityService;
