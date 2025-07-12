/**
 * Migration Dashboard - Service Layer BaseService Migration
 * 
 * Visar realtidsövervakning av migrerade tjänster:
 * - Rollout-status och prestanda-metrics
 * - Felfrekvens och fallback-användning
 * - GDPR-säker datavisning med svenska etiketter
 * - Rollback-kontroller och historik
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Card, Button, ProgressBar, Badge } from '../ui/CustomElements';
import { MigrationMonitor } from '../../utils/migrationMonitoring';
import { rollbackManager } from '../../utils/rollbackManager';
import { getRolloutStatus } from '../../config/productionFeatureFlags';

/**
 * Interface för dashboard-data
 */
interface DashboardData {
  rolloutStatus: Record<string, any>;
  migrationMetrics: any;
  rollbackHistory: any[];
  lastUpdated: string;
}

/**
 * Interface för service-status
 */
interface ServiceStatus {
  name: string;
  rolloutPercentage: number;
  enabled: boolean;
  successRate: number;
  averageLoadTime: number;
  errorCount: number;
  fallbackCount: number;
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * MigrationDashboard - Huvudkomponent för migration-övervakning
 */
export const MigrationDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Uppdatera var 30:e sekund
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Laddar dashboard-data från monitoring-system
   */
  const loadDashboardData = async (): Promise<void> => {
    try {
      const rolloutStatus = getRolloutStatus();
      const migrationMetrics = MigrationMonitor.getInstance().getMetrics();
      const rollbackHistory = rollbackManager.getRollbackHistory();

      setDashboardData({
        rolloutStatus,
        migrationMetrics,
        rollbackHistory,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Fel vid laddning av dashboard-data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Hanterar manuell uppdatering
   */
  const handleRefresh = (): void => {
    setRefreshing(true);
    loadDashboardData();
  };

  /**
   * Beräknar service-status baserat på metrics
   */
  const calculateServiceStatus = (serviceName: string): ServiceStatus => {
    if (!dashboardData) {
      return {
        name: serviceName,
        rolloutPercentage: 0,
        enabled: false,
        successRate: 0,
        averageLoadTime: 0,
        errorCount: 0,
        fallbackCount: 0,
        status: 'critical',
      };
    }

    const rolloutInfo = dashboardData.rolloutStatus.services[serviceName];
    const serviceMetrics = dashboardData.migrationMetrics.serviceBreakdown[serviceName];

    if (!rolloutInfo || !serviceMetrics) {
      return {
        name: serviceName,
        rolloutPercentage: 0,
        enabled: false,
        successRate: 0,
        averageLoadTime: 0,
        errorCount: 0,
        fallbackCount: 0,
        status: 'critical',
      };
    }

    const successRate = serviceMetrics.totalEvents > 0 
      ? ((serviceMetrics.totalEvents - serviceMetrics.errorEvents) / serviceMetrics.totalEvents) * 100
      : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (successRate < 95) status = 'warning';
    if (successRate < 90) status = 'critical';
    if (serviceMetrics.averageLoadTime > 3000) status = 'warning';
    if (serviceMetrics.averageLoadTime > 5000) status = 'critical';

    return {
      name: serviceName,
      rolloutPercentage: rolloutInfo.rolloutPercentage,
      enabled: rolloutInfo.enabled,
      successRate,
      averageLoadTime: serviceMetrics.averageLoadTime,
      errorCount: serviceMetrics.errorEvents,
      fallbackCount: serviceMetrics.fallbackEvents,
      status,
    };
  };

  /**
   * Hanterar manuell rollback
   */
  const handleManualRollback = (serviceName: string): void => {
    Alert.alert(
      'Bekräfta Rollback',
      `Är du säker på att du vill rulla tillbaka ${serviceName}?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Rulla tillbaka',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await rollbackManager.executeManualRollback(
                serviceName,
                0,
                'Manuell rollback från dashboard'
              );
              
              if (result.success) {
                Alert.alert('Rollback Genomförd', `${serviceName} har rullats tillbaka.`);
                loadDashboardData();
              } else {
                Alert.alert('Rollback Misslyckades', result.error || 'Okänt fel');
              }
            } catch (error) {
              Alert.alert('Fel', 'Kunde inte genomföra rollback');
            }
          },
        },
      ]
    );
  };

  /**
   * Renderar service-kort
   */
  const renderServiceCard = (serviceName: string): React.ReactElement => {
    const status = calculateServiceStatus(serviceName);
    const statusColor = {
      healthy: '#4CAF50',
      warning: '#FF9800',
      critical: '#F44336',
    }[status.status];

    return (
      <Card key={serviceName} containerStyle={styles.serviceCard}>
        <View style={styles.serviceHeader}>
          <Text style={styles.serviceName}>{status.name}</Text>
          <Badge
            value={status.enabled ? 'Aktiv' : 'Inaktiv'}
            badgeStyle={[
              styles.statusBadge,
              { backgroundColor: status.enabled ? statusColor : '#9E9E9E' }
            ]}
          />
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Rollout:</Text>
            <Text style={styles.metricValue}>{status.rolloutPercentage}%</Text>
          </View>
          
          <ProgressBar
            progress={status.rolloutPercentage / 100}
            color={statusColor}
            style={styles.progressBar}
          />

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Framgångsfrekvens:</Text>
            <Text style={[styles.metricValue, { color: statusColor }]}>
              {status.successRate.toFixed(1)}%
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Genomsnittlig laddningstid:</Text>
            <Text style={styles.metricValue}>{status.averageLoadTime}ms</Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Fel / Fallback:</Text>
            <Text style={styles.metricValue}>
              {status.errorCount} / {status.fallbackCount}
            </Text>
          </View>
        </View>

        {status.enabled && (
          <Button
            title="Rulla tillbaka"
            buttonStyle={[styles.rollbackButton, { backgroundColor: '#F44336' }]}
            onPress={() => handleManualRollback(serviceName)}
          />
        )}
      </Card>
    );
  };

  /**
   * Renderar övergripande statistik
   */
  const renderOverallStats = (): React.ReactElement => {
    if (!dashboardData) return <></>;

    const metrics = dashboardData.migrationMetrics;
    const totalServices = Object.keys(dashboardData.rolloutStatus.services).length;
    const activeServices = Object.values(dashboardData.rolloutStatus.services)
      .filter((service: any) => service.enabled).length;

    return (
      <Card containerStyle={styles.statsCard}>
        <Text style={styles.statsTitle}>Övergripande Statistik</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalServices}</Text>
            <Text style={styles.statLabel}>Totala Tjänster</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeServices}</Text>
            <Text style={styles.statLabel}>Aktiva Tjänster</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{metrics.totalEvents}</Text>
            <Text style={styles.statLabel}>Totala Händelser</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{metrics.averageLoadTime}ms</Text>
            <Text style={styles.statLabel}>Genomsnittlig Tid</Text>
          </View>
        </View>

        <Text style={styles.lastUpdated}>
          Senast uppdaterad: {new Date(dashboardData.lastUpdated).toLocaleString('sv-SE')}
        </Text>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Laddar migration dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Text style={styles.title}>Service Migration Dashboard</Text>
      
      {renderOverallStats()}
      
      <Text style={styles.sectionTitle}>Tjänststatus</Text>
      
      {dashboardData && Object.keys(dashboardData.rolloutStatus.services).map(renderServiceCard)}
      
      {dashboardData && dashboardData.rollbackHistory.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Senaste Rollbacks</Text>
          {dashboardData.rollbackHistory.slice(0, 5).map((rollback, index) => (
            <Card key={index} containerStyle={styles.rollbackCard}>
              <Text style={styles.rollbackService}>{rollback.serviceName}</Text>
              <Text style={styles.rollbackReason}>{rollback.reason}</Text>
              <Text style={styles.rollbackTime}>
                {new Date(rollback.timestamp).toLocaleString('sv-SE')}
              </Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  statsCard: {
    marginBottom: 16,
    borderRadius: 8,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  serviceCard: {
    marginBottom: 16,
    borderRadius: 8,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metricsContainer: {
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBar: {
    height: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  rollbackButton: {
    borderRadius: 4,
    paddingVertical: 8,
  },
  rollbackCard: {
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  rollbackService: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  rollbackReason: {
    fontSize: 12,
    color: '#666',
    marginVertical: 4,
  },
  rollbackTime: {
    fontSize: 10,
    color: '#999',
  },
});

export default MigrationDashboard;
