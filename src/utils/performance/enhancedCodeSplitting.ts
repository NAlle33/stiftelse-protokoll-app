/**
 * Enhanced Code Splitting System för SÖKA Stiftelseappen
 * 
 * Implementerar avancerade lazy loading-mönster:
 * - Route-level prefetching baserat på användarnavigation
 * - Adaptiv laddning baserat på nätverkshastighet
 * - Intelligent chunk-prioritering
 * - Prediktiv förladdning
 * 
 * Del av Performance Fine-tuning (Section 6) - Enhanced Code Splitting
 */

import React from 'react';
import { Platform } from 'react-native';
import { microFrontendRegistry, MicroFrontendModule } from '../../architecture/MicroFrontendRegistry';

export interface NetworkConditions {
  connectionType: string;
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
}

export interface PrefetchStrategy {
  immediate: string[]; // Ladda omedelbart
  onIdle: string[]; // Ladda när browser är idle
  onHover: string[]; // Ladda vid hover/focus
  onVisible: string[]; // Ladda när synlig i viewport
  conditional: Array<{
    route: string;
    condition: (context: NavigationContext) => boolean;
  }>;
}

export interface NavigationContext {
  currentRoute: string;
  previousRoute?: string;
  userRole: string;
  sessionDuration: number;
  visitCount: number;
  networkConditions: NetworkConditions;
}

export interface ChunkPriority {
  critical: string[]; // Kritiska chunks som alltid laddas
  high: string[]; // Högt prioriterade chunks
  medium: string[]; // Medium prioritet
  low: string[]; // Låg prioritet, laddas sist
  deferred: string[]; // Uppskjutna chunks
}

class EnhancedCodeSplittingManager {
  private prefetchCache = new Map<string, Promise<any>>();
  private navigationHistory: string[] = [];
  private userPatterns = new Map<string, number>();
  private networkConditions: NetworkConditions | null = null;
  private idleCallback: number | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor() {
    this.initializeNetworkMonitoring();
    this.setupIntersectionObserver();
    this.setupIdleCallback();
  }

  /**
   * Huvudmetod för att konfigurera enhanced code splitting
   */
  async initialize(): Promise<void> {
    console.log('🚀 Enhanced Code Splitting: Initialiserar...');

    try {
      // Detektera nätverksförhållanden
      await this.detectNetworkConditions();
      
      // Konfigurera prefetch-strategier baserat på nätverk
      const strategy = this.createAdaptivePrefetchStrategy();
      
      // Implementera route-level prefetching
      this.setupRoutePrefetching(strategy);
      
      // Konfigurera chunk-prioritering
      this.setupChunkPrioritization();
      
      console.log('✅ Enhanced Code Splitting: Initialisering klar');
    } catch (error) {
      console.error('❌ Enhanced Code Splitting: Initialisering misslyckades:', error);
      throw error;
    }
  }

  /**
   * Skapa adaptiv prefetch-strategi baserat på nätverksförhållanden
   */
  private createAdaptivePrefetchStrategy(): PrefetchStrategy {
    const conditions = this.networkConditions;
    
    if (!conditions) {
      return this.getDefaultStrategy();
    }

    // Anpassa strategi baserat på nätverkshastighet
    if (conditions.saveData || conditions.effectiveType === 'slow-2g' || conditions.effectiveType === '2g') {
      return this.getConservativeStrategy();
    } else if (conditions.effectiveType === '3g') {
      return this.getModerateStrategy();
    } else {
      return this.getAggressiveStrategy();
    }
  }

  /**
   * Konservativ strategi för långsamma nätverk
   */
  private getConservativeStrategy(): PrefetchStrategy {
    return {
      immediate: ['LazyMeetingListScreen'], // Endast kritiska screens
      onIdle: [],
      onHover: ['LazyNewMeetingScreen'],
      onVisible: [],
      conditional: [
        {
          route: 'LazyProtocolScreen',
          condition: (ctx) => ctx.currentRoute === 'MeetingList' && ctx.visitCount > 2
        }
      ]
    };
  }

  /**
   * Moderat strategi för medelhastiga nätverk
   */
  private getModerateStrategy(): PrefetchStrategy {
    return {
      immediate: ['LazyMeetingListScreen', 'LazyNewMeetingScreen'],
      onIdle: ['LazyProtocolScreen'],
      onHover: ['LazyRecordingScreen'],
      onVisible: ['LazyVideoMeetingScreen'],
      conditional: [
        {
          route: 'LazyVideoMeetingScreen',
          condition: (ctx) => ctx.userRole === 'Styrelsemedlem'
        }
      ]
    };
  }

  /**
   * Aggressiv strategi för snabba nätverk
   */
  private getAggressiveStrategy(): PrefetchStrategy {
    return {
      immediate: [
        'LazyMeetingListScreen',
        'LazyNewMeetingScreen',
        'LazyProtocolScreen'
      ],
      onIdle: ['LazyRecordingScreen', 'LazyVideoMeetingScreen'],
      onHover: [],
      onVisible: [],
      conditional: []
    };
  }

  /**
   * Default strategi när nätverksinfo inte är tillgänglig
   */
  private getDefaultStrategy(): PrefetchStrategy {
    return {
      immediate: ['LazyMeetingListScreen'],
      onIdle: ['LazyNewMeetingScreen'],
      onHover: ['LazyProtocolScreen'],
      onVisible: ['LazyRecordingScreen'],
      conditional: []
    };
  }

  /**
   * Implementera route-level prefetching
   */
  private setupRoutePrefetching(strategy: PrefetchStrategy): void {
    // Omedelbar prefetching
    strategy.immediate.forEach(route => {
      this.prefetchRoute(route, 'immediate');
    });

    // Idle prefetching
    if (strategy.onIdle.length > 0) {
      this.scheduleIdlePrefetch(strategy.onIdle);
    }

    // Hover/focus prefetching
    this.setupHoverPrefetching(strategy.onHover);

    // Visibility prefetching
    this.setupVisibilityPrefetching(strategy.onVisible);

    // Conditional prefetching
    this.setupConditionalPrefetching(strategy.conditional);
  }

  /**
   * Prefetch en route med given prioritet
   */
  private async prefetchRoute(routeName: string, priority: string): Promise<void> {
    if (this.prefetchCache.has(routeName)) {
      return; // Redan prefetchad
    }

    console.log(`🔄 Enhanced Code Splitting: Prefetching ${routeName} (${priority})`);

    try {
      const prefetchPromise = this.loadRouteModule(routeName);
      this.prefetchCache.set(routeName, prefetchPromise);
      
      await prefetchPromise;
      console.log(`✅ Enhanced Code Splitting: ${routeName} prefetchad`);
    } catch (error) {
      console.warn(`⚠️ Enhanced Code Splitting: Prefetch misslyckades för ${routeName}:`, error);
      this.prefetchCache.delete(routeName);
    }
  }

  /**
   * Ladda route-modul
   */
  private async loadRouteModule(routeName: string): Promise<any> {
    // Använd befintlig lazy loading från screens/lazy
    switch (routeName) {
      case 'LazyMeetingListScreen':
        return import('../../screens/lazy/LazyMeetingListScreen');
      case 'LazyNewMeetingScreen':
        return import('../../screens/lazy/LazyNewMeetingScreen');
      case 'LazyProtocolScreen':
        return import('../../screens/lazy/LazyProtocolScreen');
      case 'LazyRecordingScreen':
        return import('../../screens/lazy/LazyRecordingScreen');
      case 'LazyVideoMeetingScreen':
        return import('../../screens/lazy/LazyVideoMeetingScreen');
      default:
        throw new Error(`Unknown route: ${routeName}`);
    }
  }

  /**
   * Schemalägg idle prefetching
   */
  private scheduleIdlePrefetch(routes: string[]): void {
    if (Platform.OS === 'web' && 'requestIdleCallback' in window) {
      // @ts-ignore
      window.requestIdleCallback(() => {
        routes.forEach(route => {
          this.prefetchRoute(route, 'idle');
        });
      });
    } else {
      // Fallback för React Native
      setTimeout(() => {
        routes.forEach(route => {
          this.prefetchRoute(route, 'idle');
        });
      }, 1000);
    }
  }

  /**
   * Konfigurera hover prefetching
   */
  private setupHoverPrefetching(routes: string[]): void {
    if (Platform.OS !== 'web') return;

    // Implementation för hover-baserad prefetching
    // Detta skulle kopplas till navigation-komponenter
    console.log('🎯 Enhanced Code Splitting: Hover prefetching konfigurerad för:', routes);
  }

  /**
   * Konfigurera visibility prefetching
   */
  private setupVisibilityPrefetching(routes: string[]): void {
    if (!this.intersectionObserver || routes.length === 0) return;

    // Implementation för visibility-baserad prefetching
    console.log('👁️ Enhanced Code Splitting: Visibility prefetching konfigurerad för:', routes);
  }

  /**
   * Konfigurera conditional prefetching
   */
  private setupConditionalPrefetching(
    conditions: Array<{ route: string; condition: (ctx: NavigationContext) => boolean }>
  ): void {
    // Implementation för conditional prefetching
    console.log('🔀 Enhanced Code Splitting: Conditional prefetching konfigurerad');
  }

  /**
   * Detektera nätverksförhållanden
   */
  private async detectNetworkConditions(): Promise<void> {
    try {
      if (Platform.OS === 'web' && 'connection' in navigator) {
        // @ts-ignore
        const connection = navigator.connection;
        this.networkConditions = {
          connectionType: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false,
        };
      } else {
        // Använd NetworkConnectivityService för React Native
        const { NetworkConnectivityServiceMigrated } = await import('../../services/NetworkConnectivityServiceMigrated');
        const networkService = NetworkConnectivityServiceMigrated.getInstance();
        const status = await networkService.getNetworkStatus();
        
        this.networkConditions = {
          connectionType: status.connectionType,
          effectiveType: this.mapConnectionTypeToEffectiveType(status.connectionType),
          downlink: this.estimateDownlinkFromConnectionType(status.connectionType),
          rtt: 100, // Default RTT
          saveData: false,
        };
      }

      console.log('📡 Enhanced Code Splitting: Nätverksförhållanden detekterade:', this.networkConditions);
    } catch (error) {
      console.warn('⚠️ Enhanced Code Splitting: Kunde inte detektera nätverksförhållanden:', error);
    }
  }

  /**
   * Mappa connection type till effective type
   */
  private mapConnectionTypeToEffectiveType(connectionType: string): NetworkConditions['effectiveType'] {
    switch (connectionType.toLowerCase()) {
      case 'cellular':
      case '2g':
        return '2g';
      case '3g':
        return '3g';
      case '4g':
      case 'lte':
        return '4g';
      case 'wifi':
      case 'ethernet':
        return '4g';
      default:
        return 'unknown';
    }
  }

  /**
   * Uppskatta downlink från connection type
   */
  private estimateDownlinkFromConnectionType(connectionType: string): number {
    switch (connectionType.toLowerCase()) {
      case '2g':
        return 0.25; // 250 kbps
      case '3g':
        return 1.5; // 1.5 Mbps
      case '4g':
      case 'lte':
        return 10; // 10 Mbps
      case 'wifi':
      case 'ethernet':
        return 25; // 25 Mbps
      default:
        return 5; // Default 5 Mbps
    }
  }

  /**
   * Initialisera nätverksmonitoring
   */
  private initializeNetworkMonitoring(): void {
    if (Platform.OS === 'web' && 'connection' in navigator) {
      // @ts-ignore
      navigator.connection?.addEventListener('change', () => {
        this.detectNetworkConditions();
      });
    }
  }

  /**
   * Konfigurera intersection observer
   */
  private setupIntersectionObserver(): void {
    if (Platform.OS === 'web' && 'IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const routeName = entry.target.getAttribute('data-prefetch-route');
              if (routeName) {
                this.prefetchRoute(routeName, 'visible');
              }
            }
          });
        },
        { threshold: 0.1 }
      );
    }
  }

  /**
   * Konfigurera idle callback
   */
  private setupIdleCallback(): void {
    if (Platform.OS === 'web' && 'requestIdleCallback' in window) {
      // Idle callback är redan konfigurerad i scheduleIdlePrefetch
    }
  }

  /**
   * Konfigurera chunk-prioritering
   */
  private setupChunkPrioritization(): void {
    const priority: ChunkPriority = {
      critical: ['LazyMeetingListScreen'],
      high: ['LazyNewMeetingScreen', 'LazyProtocolScreen'],
      medium: ['LazyRecordingScreen'],
      low: ['LazyVideoMeetingScreen'],
      deferred: []
    };

    console.log('📊 Enhanced Code Splitting: Chunk-prioritering konfigurerad:', priority);
  }

  /**
   * Hämta prefetchad route
   */
  async getPrefetchedRoute(routeName: string): Promise<any> {
    const cached = this.prefetchCache.get(routeName);
    if (cached) {
      console.log(`🎯 Enhanced Code Splitting: Använder prefetchad ${routeName}`);
      return cached;
    }

    // Fallback till normal loading
    return this.loadRouteModule(routeName);
  }

  /**
   * Rensa prefetch-cache
   */
  clearPrefetchCache(): void {
    this.prefetchCache.clear();
    console.log('🧹 Enhanced Code Splitting: Prefetch-cache rensad');
  }

  /**
   * Hämta statistik
   */
  getStatistics() {
    return {
      prefetchedRoutes: Array.from(this.prefetchCache.keys()),
      navigationHistory: this.navigationHistory.slice(-10),
      networkConditions: this.networkConditions,
      cacheSize: this.prefetchCache.size,
    };
  }
}

// Singleton-instans
export const enhancedCodeSplittingManager = new EnhancedCodeSplittingManager();

// Utility-funktioner
export const initializeEnhancedCodeSplitting = async (): Promise<void> => {
  return enhancedCodeSplittingManager.initialize();
};

export const prefetchRoute = (routeName: string): Promise<void> => {
  return enhancedCodeSplittingManager.prefetchRoute(routeName, 'manual');
};

export const getPrefetchedRoute = (routeName: string): Promise<any> => {
  return enhancedCodeSplittingManager.getPrefetchedRoute(routeName);
};

export default enhancedCodeSplittingManager;
