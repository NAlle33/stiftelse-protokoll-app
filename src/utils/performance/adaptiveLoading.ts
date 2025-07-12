/**
 * Adaptive Loading System för SÖKA Stiftelseappen
 * 
 * Implementerar intelligent laddning baserat på:
 * - Nätverkshastighet och förhållanden
 * - Enhetskapacitet och prestanda
 * - Användarpreferenser (data saving)
 * - Batteristatus (för mobila enheter)
 * 
 * Del av Performance Fine-tuning (Section 6) - Enhanced Code Splitting
 */

import { Platform } from 'react-native';
import { NetworkConditions } from './enhancedCodeSplitting';

export interface DeviceCapabilities {
  memory: number; // GB
  cores: number;
  gpu: string;
  platform: string;
  screenSize: 'small' | 'medium' | 'large';
  pixelRatio: number;
}

export interface BatteryStatus {
  level: number; // 0-1
  charging: boolean;
  chargingTime?: number;
  dischargingTime?: number;
}

export interface LoadingStrategy {
  chunkSize: 'small' | 'medium' | 'large';
  concurrentLoads: number;
  prefetchDistance: number; // Antal routes att prefetcha
  imageQuality: 'low' | 'medium' | 'high';
  enableAnimations: boolean;
  enableTransitions: boolean;
  cacheStrategy: 'aggressive' | 'moderate' | 'conservative';
}

export interface AdaptiveLoadingContext {
  networkConditions: NetworkConditions;
  deviceCapabilities: DeviceCapabilities;
  batteryStatus?: BatteryStatus;
  userPreferences: {
    dataSaving: boolean;
    reducedMotion: boolean;
    highContrast: boolean;
  };
}

class AdaptiveLoadingManager {
  private context: AdaptiveLoadingContext | null = null;
  private currentStrategy: LoadingStrategy | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryPressureListener: (() => void) | null = null;

  constructor() {
    this.initializePerformanceMonitoring();
  }

  /**
   * Initialisera adaptive loading system
   */
  async initialize(): Promise<void> {
    console.log('🎯 Adaptive Loading: Initialiserar...');

    try {
      // Detektera enhetskapacitet
      const deviceCapabilities = await this.detectDeviceCapabilities();
      
      // Detektera batteristatus
      const batteryStatus = await this.detectBatteryStatus();
      
      // Hämta användarpreferenser
      const userPreferences = await this.getUserPreferences();
      
      // Skapa kontext (nätverksförhållanden kommer från enhancedCodeSplitting)
      this.context = {
        networkConditions: {
          connectionType: 'unknown',
          effectiveType: 'unknown',
          downlink: 5,
          rtt: 100,
          saveData: false,
        },
        deviceCapabilities,
        batteryStatus,
        userPreferences,
      };

      // Skapa initial strategi
      this.currentStrategy = this.createLoadingStrategy(this.context);
      
      console.log('✅ Adaptive Loading: Initialisering klar', {
        strategy: this.currentStrategy,
        context: this.context,
      });
    } catch (error) {
      console.error('❌ Adaptive Loading: Initialisering misslyckades:', error);
      this.currentStrategy = this.getDefaultStrategy();
    }
  }

  /**
   * Uppdatera nätverksförhållanden
   */
  updateNetworkConditions(networkConditions: NetworkConditions): void {
    if (!this.context) return;

    this.context.networkConditions = networkConditions;
    this.currentStrategy = this.createLoadingStrategy(this.context);
    
    console.log('📡 Adaptive Loading: Nätverksförhållanden uppdaterade', {
      networkConditions,
      newStrategy: this.currentStrategy,
    });
  }

  /**
   * Skapa loading-strategi baserat på kontext
   */
  private createLoadingStrategy(context: AdaptiveLoadingContext): LoadingStrategy {
    const { networkConditions, deviceCapabilities, batteryStatus, userPreferences } = context;

    // Börja med baseline-strategi
    let strategy: LoadingStrategy = {
      chunkSize: 'medium',
      concurrentLoads: 2,
      prefetchDistance: 1,
      imageQuality: 'medium',
      enableAnimations: true,
      enableTransitions: true,
      cacheStrategy: 'moderate',
    };

    // Anpassa baserat på nätverk
    strategy = this.adaptForNetwork(strategy, networkConditions);
    
    // Anpassa baserat på enhet
    strategy = this.adaptForDevice(strategy, deviceCapabilities);
    
    // Anpassa baserat på batteri
    if (batteryStatus) {
      strategy = this.adaptForBattery(strategy, batteryStatus);
    }
    
    // Anpassa baserat på användarpreferenser
    strategy = this.adaptForUserPreferences(strategy, userPreferences);

    return strategy;
  }

  /**
   * Anpassa strategi för nätverksförhållanden
   */
  private adaptForNetwork(strategy: LoadingStrategy, network: NetworkConditions): LoadingStrategy {
    if (network.saveData || network.effectiveType === 'slow-2g' || network.effectiveType === '2g') {
      return {
        ...strategy,
        chunkSize: 'small',
        concurrentLoads: 1,
        prefetchDistance: 0,
        imageQuality: 'low',
        enableAnimations: false,
        cacheStrategy: 'conservative',
      };
    }

    if (network.effectiveType === '3g') {
      return {
        ...strategy,
        chunkSize: 'medium',
        concurrentLoads: 2,
        prefetchDistance: 1,
        imageQuality: 'medium',
        cacheStrategy: 'moderate',
      };
    }

    if (network.effectiveType === '4g' && network.downlink > 10) {
      return {
        ...strategy,
        chunkSize: 'large',
        concurrentLoads: 4,
        prefetchDistance: 3,
        imageQuality: 'high',
        cacheStrategy: 'aggressive',
      };
    }

    return strategy;
  }

  /**
   * Anpassa strategi för enhetskapacitet
   */
  private adaptForDevice(strategy: LoadingStrategy, device: DeviceCapabilities): LoadingStrategy {
    // Anpassa baserat på minne
    if (device.memory < 2) {
      strategy.concurrentLoads = Math.min(strategy.concurrentLoads, 1);
      strategy.prefetchDistance = 0;
      strategy.cacheStrategy = 'conservative';
    } else if (device.memory > 4) {
      strategy.concurrentLoads = Math.min(strategy.concurrentLoads + 1, 6);
      strategy.prefetchDistance = Math.min(strategy.prefetchDistance + 1, 4);
    }

    // Anpassa baserat på CPU-kärnor
    if (device.cores < 4) {
      strategy.enableAnimations = false;
      strategy.enableTransitions = false;
    }

    // Anpassa baserat på skärmstorlek
    if (device.screenSize === 'small') {
      strategy.imageQuality = strategy.imageQuality === 'high' ? 'medium' : strategy.imageQuality;
    }

    return strategy;
  }

  /**
   * Anpassa strategi för batteristatus
   */
  private adaptForBattery(strategy: LoadingStrategy, battery: BatteryStatus): LoadingStrategy {
    // Energisparläge när batteriet är lågt
    if (battery.level < 0.2 && !battery.charging) {
      return {
        ...strategy,
        chunkSize: 'small',
        concurrentLoads: 1,
        prefetchDistance: 0,
        imageQuality: 'low',
        enableAnimations: false,
        enableTransitions: false,
        cacheStrategy: 'conservative',
      };
    }

    // Måttlig optimering när batteriet är medel
    if (battery.level < 0.5 && !battery.charging) {
      strategy.concurrentLoads = Math.max(strategy.concurrentLoads - 1, 1);
      strategy.prefetchDistance = Math.max(strategy.prefetchDistance - 1, 0);
      strategy.enableAnimations = false;
    }

    return strategy;
  }

  /**
   * Anpassa strategi för användarpreferenser
   */
  private adaptForUserPreferences(
    strategy: LoadingStrategy, 
    preferences: AdaptiveLoadingContext['userPreferences']
  ): LoadingStrategy {
    if (preferences.dataSaving) {
      strategy.chunkSize = 'small';
      strategy.concurrentLoads = 1;
      strategy.prefetchDistance = 0;
      strategy.imageQuality = 'low';
      strategy.cacheStrategy = 'conservative';
    }

    if (preferences.reducedMotion) {
      strategy.enableAnimations = false;
      strategy.enableTransitions = false;
    }

    return strategy;
  }

  /**
   * Hämta aktuell loading-strategi
   */
  getCurrentStrategy(): LoadingStrategy {
    return this.currentStrategy || this.getDefaultStrategy();
  }

  /**
   * Default strategi
   */
  private getDefaultStrategy(): LoadingStrategy {
    return {
      chunkSize: 'medium',
      concurrentLoads: 2,
      prefetchDistance: 1,
      imageQuality: 'medium',
      enableAnimations: true,
      enableTransitions: true,
      cacheStrategy: 'moderate',
    };
  }

  /**
   * Detektera enhetskapacitet
   */
  private async detectDeviceCapabilities(): Promise<DeviceCapabilities> {
    const capabilities: DeviceCapabilities = {
      memory: 4, // Default 4GB
      cores: 4, // Default 4 cores
      gpu: 'unknown',
      platform: Platform.OS,
      screenSize: 'medium',
      pixelRatio: 1,
    };

    if (Platform.OS === 'web') {
      // Web-specifik detektering
      // @ts-ignore
      if ('deviceMemory' in navigator) {
        // @ts-ignore
        capabilities.memory = navigator.deviceMemory || 4;
      }

      // @ts-ignore
      if ('hardwareConcurrency' in navigator) {
        // @ts-ignore
        capabilities.cores = navigator.hardwareConcurrency || 4;
      }

      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        capabilities.screenSize = width < 768 ? 'small' : width < 1200 ? 'medium' : 'large';
        capabilities.pixelRatio = window.devicePixelRatio || 1;
      }
    } else {
      // React Native-specifik detektering
      const { Dimensions } = require('react-native');
      const { width } = Dimensions.get('window');
      capabilities.screenSize = width < 400 ? 'small' : width < 800 ? 'medium' : 'large';
      capabilities.pixelRatio = Dimensions.get('window').scale || 1;
    }

    return capabilities;
  }

  /**
   * Detektera batteristatus
   */
  private async detectBatteryStatus(): Promise<BatteryStatus | undefined> {
    if (Platform.OS === 'web' && 'getBattery' in navigator) {
      try {
        // @ts-ignore
        const battery = await navigator.getBattery();
        return {
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
        };
      } catch (error) {
        console.warn('⚠️ Adaptive Loading: Kunde inte hämta batteristatus:', error);
      }
    }

    return undefined;
  }

  /**
   * Hämta användarpreferenser
   */
  private async getUserPreferences(): Promise<AdaptiveLoadingContext['userPreferences']> {
    const preferences = {
      dataSaving: false,
      reducedMotion: false,
      highContrast: false,
    };

    if (Platform.OS === 'web') {
      // Kontrollera prefers-reduced-motion
      if (window.matchMedia) {
        preferences.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        preferences.highContrast = window.matchMedia('(prefers-contrast: high)').matches;
      }

      // Kontrollera connection.saveData
      // @ts-ignore
      if ('connection' in navigator && navigator.connection?.saveData) {
        preferences.dataSaving = true;
      }
    }

    return preferences;
  }

  /**
   * Initialisera performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (Platform.OS === 'web' && 'PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'navigation') {
              console.log('📊 Adaptive Loading: Navigation performance:', entry);
            }
          });
        });

        this.performanceObserver.observe({ entryTypes: ['navigation', 'resource'] });
      } catch (error) {
        console.warn('⚠️ Adaptive Loading: Performance monitoring inte tillgängligt:', error);
      }
    }
  }

  /**
   * Rensa resurser
   */
  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    if (this.memoryPressureListener) {
      this.memoryPressureListener();
    }
  }

  /**
   * Hämta diagnostik-information
   */
  getDiagnostics() {
    return {
      context: this.context,
      currentStrategy: this.currentStrategy,
      isInitialized: this.context !== null,
    };
  }
}

// Singleton-instans
export const adaptiveLoadingManager = new AdaptiveLoadingManager();

// Utility-funktioner
export const initializeAdaptiveLoading = async (): Promise<void> => {
  return adaptiveLoadingManager.initialize();
};

export const getCurrentLoadingStrategy = (): LoadingStrategy => {
  return adaptiveLoadingManager.getCurrentStrategy();
};

export const updateNetworkConditions = (conditions: NetworkConditions): void => {
  adaptiveLoadingManager.updateNetworkConditions(conditions);
};

export default adaptiveLoadingManager;
