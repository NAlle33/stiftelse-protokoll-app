/**
 * Bundle Analyzer för Enhanced Code Splitting
 * 
 * Analyserar och mäter effekten av code splitting optimeringar:
 * - Bundle-storlek före/efter optimering
 * - Chunk-distribution och laddningstider
 * - Prefetch-effektivitet
 * - Network-adaptiv prestanda
 * 
 * Del av Performance Fine-tuning (Section 6) - Enhanced Code Splitting
 */

import { Platform } from 'react-native';

export interface BundleAnalysis {
  totalSize: number;
  chunks: ChunkInfo[];
  loadTimes: LoadTimeMetrics;
  prefetchMetrics: PrefetchMetrics;
  networkAdaptation: NetworkAdaptationMetrics;
  recommendations: string[];
}

export interface ChunkInfo {
  name: string;
  size: number;
  loadTime: number;
  cached: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
}

export interface LoadTimeMetrics {
  average: number;
  p50: number;
  p90: number;
  p95: number;
  slowest: ChunkInfo;
  fastest: ChunkInfo;
}

export interface PrefetchMetrics {
  hitRate: number;
  missRate: number;
  wastedPrefetches: number;
  savedLoadTime: number;
  prefetchedChunks: string[];
}

export interface NetworkAdaptationMetrics {
  strategySwitches: number;
  adaptationAccuracy: number;
  bandwidthSavings: number;
  userExperienceScore: number;
}

class BundleAnalyzer {
  private measurements: Map<string, number[]> = new Map();
  private chunkSizes: Map<string, number> = new Map();
  private prefetchHits: Set<string> = new Set();
  private prefetchMisses: Set<string> = new Set();
  private networkAdaptations: Array<{
    timestamp: number;
    from: string;
    to: string;
    reason: string;
  }> = [];

  constructor() {
    this.initializePerformanceTracking();
  }

  /**
   * Starta bundle-analys
   */
  async startAnalysis(): Promise<void> {
    console.log('📊 Bundle Analyzer: Startar analys...');

    try {
      // Mät initial bundle-storlek
      await this.measureInitialBundleSize();
      
      // Sätt upp chunk-tracking
      this.setupChunkTracking();
      
      // Initialisera performance observers
      this.initializePerformanceObservers();
      
      console.log('✅ Bundle Analyzer: Analys startad');
    } catch (error) {
      console.error('❌ Bundle Analyzer: Fel vid start av analys:', error);
    }
  }

  /**
   * Registrera chunk-laddning
   */
  recordChunkLoad(chunkName: string, loadTime: number, size?: number): void {
    // Spara laddningstid
    const times = this.measurements.get(chunkName) || [];
    times.push(loadTime);
    this.measurements.set(chunkName, times);

    // Spara chunk-storlek om tillgänglig
    if (size) {
      this.chunkSizes.set(chunkName, size);
    }

    console.log(`📦 Bundle Analyzer: Chunk laddad - ${chunkName} (${loadTime}ms)`);
  }

  /**
   * Registrera prefetch-träff
   */
  recordPrefetchHit(chunkName: string): void {
    this.prefetchHits.add(chunkName);
    console.log(`🎯 Bundle Analyzer: Prefetch hit - ${chunkName}`);
  }

  /**
   * Registrera prefetch-miss
   */
  recordPrefetchMiss(chunkName: string): void {
    this.prefetchMisses.add(chunkName);
    console.log(`❌ Bundle Analyzer: Prefetch miss - ${chunkName}`);
  }

  /**
   * Registrera nätverksadaption
   */
  recordNetworkAdaptation(from: string, to: string, reason: string): void {
    this.networkAdaptations.push({
      timestamp: Date.now(),
      from,
      to,
      reason,
    });
    
    console.log(`📡 Bundle Analyzer: Network adaptation - ${from} → ${to} (${reason})`);
  }

  /**
   * Generera komplett bundle-analys
   */
  generateAnalysis(): BundleAnalysis {
    const chunks = this.generateChunkAnalysis();
    const loadTimes = this.calculateLoadTimeMetrics();
    const prefetchMetrics = this.calculatePrefetchMetrics();
    const networkAdaptation = this.calculateNetworkAdaptationMetrics();
    const recommendations = this.generateRecommendations(chunks, loadTimes, prefetchMetrics);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

    return {
      totalSize,
      chunks,
      loadTimes,
      prefetchMetrics,
      networkAdaptation,
      recommendations,
    };
  }

  /**
   * Generera chunk-analys
   */
  private generateChunkAnalysis(): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];

    for (const [chunkName, times] of this.measurements.entries()) {
      const averageLoadTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const size = this.chunkSizes.get(chunkName) || 0;
      const cached = this.prefetchHits.has(chunkName);

      chunks.push({
        name: chunkName,
        size,
        loadTime: averageLoadTime,
        cached,
        priority: this.determinePriority(chunkName),
        dependencies: this.getDependencies(chunkName),
      });
    }

    return chunks.sort((a, b) => b.size - a.size);
  }

  /**
   * Beräkna laddningstid-metrics
   */
  private calculateLoadTimeMetrics(): LoadTimeMetrics {
    const allTimes: number[] = [];
    for (const times of this.measurements.values()) {
      allTimes.push(...times);
    }

    if (allTimes.length === 0) {
      return {
        average: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        slowest: { name: '', size: 0, loadTime: 0, cached: false, priority: 'low', dependencies: [] },
        fastest: { name: '', size: 0, loadTime: 0, cached: false, priority: 'low', dependencies: [] },
      };
    }

    allTimes.sort((a, b) => a - b);
    const chunks = this.generateChunkAnalysis();

    return {
      average: allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length,
      p50: allTimes[Math.floor(allTimes.length * 0.5)],
      p90: allTimes[Math.floor(allTimes.length * 0.9)],
      p95: allTimes[Math.floor(allTimes.length * 0.95)],
      slowest: chunks.reduce((slowest, chunk) => 
        chunk.loadTime > slowest.loadTime ? chunk : slowest
      ),
      fastest: chunks.reduce((fastest, chunk) => 
        chunk.loadTime < fastest.loadTime ? chunk : fastest
      ),
    };
  }

  /**
   * Beräkna prefetch-metrics
   */
  private calculatePrefetchMetrics(): PrefetchMetrics {
    const totalPrefetches = this.prefetchHits.size + this.prefetchMisses.size;
    const hitRate = totalPrefetches > 0 ? this.prefetchHits.size / totalPrefetches : 0;
    const missRate = totalPrefetches > 0 ? this.prefetchMisses.size / totalPrefetches : 0;

    // Uppskatta sparad laddningstid från prefetch-träffar
    let savedLoadTime = 0;
    for (const chunkName of this.prefetchHits) {
      const times = this.measurements.get(chunkName) || [];
      if (times.length > 0) {
        savedLoadTime += times[0]; // Första laddningstiden (innan prefetch)
      }
    }

    return {
      hitRate,
      missRate,
      wastedPrefetches: this.prefetchMisses.size,
      savedLoadTime,
      prefetchedChunks: Array.from(this.prefetchHits),
    };
  }

  /**
   * Beräkna nätverksadaption-metrics
   */
  private calculateNetworkAdaptationMetrics(): NetworkAdaptationMetrics {
    const strategySwitches = this.networkAdaptations.length;
    
    // Uppskatta adaptionsnoggrannhet baserat på framgångsrika laddningar efter adaptation
    const adaptationAccuracy = strategySwitches > 0 ? 0.85 : 1.0; // Mock-värde
    
    // Uppskatta bandbreddsbesparingar
    const bandwidthSavings = strategySwitches * 50; // KB per adaptation (mock)
    
    // Beräkna användarupplevelse-poäng
    const userExperienceScore = Math.min(100, 100 - (strategySwitches * 5));

    return {
      strategySwitches,
      adaptationAccuracy,
      bandwidthSavings,
      userExperienceScore,
    };
  }

  /**
   * Generera rekommendationer
   */
  private generateRecommendations(
    chunks: ChunkInfo[],
    loadTimes: LoadTimeMetrics,
    prefetchMetrics: PrefetchMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Chunk-storlek rekommendationer
    const largeChunks = chunks.filter(chunk => chunk.size > 100000); // > 100KB
    if (largeChunks.length > 0) {
      recommendations.push(
        `Överväg att dela upp stora chunks: ${largeChunks.map(c => c.name).join(', ')}`
      );
    }

    // Laddningstid rekommendationer
    if (loadTimes.average > 500) {
      recommendations.push('Genomsnittlig laddningstid är hög - överväg mer aggressiv prefetching');
    }

    // Prefetch rekommendationer
    if (prefetchMetrics.hitRate < 0.7) {
      recommendations.push('Låg prefetch hit rate - justera prefetch-strategin');
    }

    if (prefetchMetrics.wastedPrefetches > 3) {
      recommendations.push('Många oanvända prefetches - minska prefetch-distans');
    }

    // Cache rekommendationer
    const uncachedCritical = chunks.filter(c => c.priority === 'critical' && !c.cached);
    if (uncachedCritical.length > 0) {
      recommendations.push('Kritiska chunks bör prefetchas för bättre prestanda');
    }

    return recommendations;
  }

  /**
   * Bestäm chunk-prioritet
   */
  private determinePriority(chunkName: string): ChunkInfo['priority'] {
    if (chunkName.includes('MeetingList') || chunkName.includes('Auth')) {
      return 'critical';
    }
    if (chunkName.includes('NewMeeting') || chunkName.includes('Protocol')) {
      return 'high';
    }
    if (chunkName.includes('Recording')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Hämta chunk-beroenden
   */
  private getDependencies(chunkName: string): string[] {
    // Mock-implementation - skulle analysera verkliga beroenden
    const dependencies: Record<string, string[]> = {
      'LazyMeetingListScreen': ['meetingService', 'searchService'],
      'LazyNewMeetingScreen': ['meetingService', 'validationService'],
      'LazyProtocolScreen': ['protocolService', 'aiService'],
      'LazyRecordingScreen': ['speechService', 'recordingService'],
      'LazyVideoMeetingScreen': ['webrtcService', 'videoService'],
    };

    return dependencies[chunkName] || [];
  }

  /**
   * Mät initial bundle-storlek
   */
  private async measureInitialBundleSize(): Promise<void> {
    if (Platform.OS === 'web' && 'performance' in window) {
      try {
        const entries = performance.getEntriesByType('resource');
        let totalSize = 0;

        entries.forEach(entry => {
          if (entry.name.includes('.js') || entry.name.includes('.chunk')) {
            // @ts-ignore
            totalSize += entry.transferSize || 0;
          }
        });

        console.log(`📊 Bundle Analyzer: Initial bundle size: ${totalSize} bytes`);
      } catch (error) {
        console.warn('⚠️ Bundle Analyzer: Kunde inte mäta initial bundle-storlek:', error);
      }
    }
  }

  /**
   * Sätt upp chunk-tracking
   */
  private setupChunkTracking(): void {
    if (Platform.OS === 'web' && 'performance' in window) {
      // Övervaka nya resource-laddningar
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.name.includes('.chunk.js')) {
            const chunkName = this.extractChunkName(entry.name);
            // @ts-ignore
            this.recordChunkLoad(chunkName, entry.duration, entry.transferSize);
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  /**
   * Extrahera chunk-namn från URL
   */
  private extractChunkName(url: string): string {
    const match = url.match(/([^\/]+)\.chunk\.js$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Initialisera performance tracking
   */
  private initializePerformanceTracking(): void {
    if (Platform.OS === 'web') {
      // Övervaka navigation timing
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            console.log('📊 Bundle Analyzer: Navigation timing:', {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            });
          }
        }, 0);
      });
    }
  }

  /**
   * Initialisera performance observers
   */
  private initializePerformanceObservers(): void {
    if (Platform.OS === 'web' && 'PerformanceObserver' in window) {
      // Övervaka largest contentful paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          console.log('📊 Bundle Analyzer: LCP:', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('⚠️ Bundle Analyzer: LCP observer inte tillgänglig:', error);
      }
    }
  }

  /**
   * Exportera analys som rapport
   */
  exportAnalysisReport(): string {
    const analysis = this.generateAnalysis();
    
    return `
# Enhanced Code Splitting Analysis Report

## Bundle Overview
- Total Size: ${(analysis.totalSize / 1024).toFixed(2)} KB
- Number of Chunks: ${analysis.chunks.length}

## Load Time Metrics
- Average: ${analysis.loadTimes.average.toFixed(2)}ms
- P50: ${analysis.loadTimes.p50.toFixed(2)}ms
- P90: ${analysis.loadTimes.p90.toFixed(2)}ms
- P95: ${analysis.loadTimes.p95.toFixed(2)}ms

## Prefetch Performance
- Hit Rate: ${(analysis.prefetchMetrics.hitRate * 100).toFixed(1)}%
- Saved Load Time: ${analysis.prefetchMetrics.savedLoadTime.toFixed(2)}ms
- Wasted Prefetches: ${analysis.prefetchMetrics.wastedPrefetches}

## Network Adaptation
- Strategy Switches: ${analysis.networkAdaptation.strategySwitches}
- Adaptation Accuracy: ${(analysis.networkAdaptation.adaptationAccuracy * 100).toFixed(1)}%
- Bandwidth Savings: ${analysis.networkAdaptation.bandwidthSavings} KB

## Recommendations
${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Chunk Details
${analysis.chunks.map(chunk => 
  `- ${chunk.name}: ${(chunk.size / 1024).toFixed(2)} KB (${chunk.loadTime.toFixed(2)}ms)`
).join('\n')}
    `.trim();
  }
}

// Singleton-instans
export const bundleAnalyzer = new BundleAnalyzer();

// Utility-funktioner
export const startBundleAnalysis = (): Promise<void> => {
  return bundleAnalyzer.startAnalysis();
};

export const recordChunkLoad = (chunkName: string, loadTime: number, size?: number): void => {
  bundleAnalyzer.recordChunkLoad(chunkName, loadTime, size);
};

export const generateBundleReport = (): string => {
  return bundleAnalyzer.exportAnalysisReport();
};

export default bundleAnalyzer;
