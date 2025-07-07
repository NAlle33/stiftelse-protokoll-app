/**
 * Vendor Bundle Loader UI Components
 * 
 * UI-komponenter för att visa vendor bundle loading status
 * med svensk lokalisering och GDPR-efterlevnad.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useVendorSplitting } from '../providers/VendorSplittingProvider';

// Colors and styling
const colors = {
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  background: '#f8fafc',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
};

// Main Vendor Bundle Loader Component
interface VendorBundleLoaderProps {
  showProgress?: boolean;
  compact?: boolean;
  showBundleStatus?: boolean;
}

export const VendorBundleLoader: React.FC<VendorBundleLoaderProps> = ({
  showProgress = false,
  compact = false,
  showBundleStatus = false,
}) => {
  const { bundleState, isLoading, error, getBundleStats } = useVendorSplitting();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {isLoading && (
          <View style={styles.compactLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.compactText}>Laddar bundles...</Text>
          </View>
        )}
        {error && (
          <View style={styles.compactError}>
            <Text style={styles.compactErrorText}>Bundle-fel</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showProgress && (
        <View style={styles.progressSection}>
          <Text style={styles.title}>Bundle Loading Status</Text>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Laddar vendor bundles...</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {showBundleStatus && (
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Bundle Status</Text>
          <BundleStatusIndicator />
        </View>
      )}
    </View>
  );
};

// Bundle Status Indicator Component
export const BundleStatusIndicator: React.FC = () => {
  const { bundleState, getBundleStats } = useVendorSplitting();
  const stats = getBundleStats();

  const bundleItems = [
    { key: 'react', name: 'React/React Native', loaded: bundleState.react },
    { key: 'supabase', name: 'Supabase Client', loaded: bundleState.supabase },
    { key: 'crypto', name: 'Crypto & Security', loaded: bundleState.crypto },
    { key: 'expo', name: 'Expo Modules', loaded: bundleState.expo },
    { key: 'webrtc', name: 'WebRTC Video', loaded: bundleState.webrtc },
    { key: 'monitoring', name: 'Monitoring & Analytics', loaded: bundleState.monitoring },
    { key: 'polyfills', name: 'Node.js Polyfills', loaded: bundleState.polyfills },
  ];

  return (
    <ScrollView style={styles.statusContainer}>
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Laddade bundles: {stats.totalLoaded} / {bundleItems.length}
        </Text>
        {stats.totalLoading > 0 && (
          <Text style={styles.statsText}>
            Laddar: {stats.totalLoading}
          </Text>
        )}
      </View>

      {bundleItems.map((bundle) => (
        <View key={bundle.key} style={styles.bundleItem}>
          <View style={[
            styles.bundleIndicator,
            { backgroundColor: bundle.loaded ? colors.success : colors.warning }
          ]} />
          <Text style={styles.bundleName}>{bundle.name}</Text>
          <Text style={[
            styles.bundleStatus,
            { color: bundle.loaded ? colors.success : colors.textSecondary }
          ]}>
            {bundle.loaded ? 'Laddad' : 'Inte laddad'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

// Loading Overlay Component
interface VendorBundleLoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const VendorBundleLoadingOverlay: React.FC<VendorBundleLoadingOverlayProps> = ({
  visible,
  message = 'Laddar vendor bundles...',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.overlayText}>{message}</Text>
        <Text style={styles.overlaySubtext}>
          Detta kan ta några sekunder...
        </Text>
      </View>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.background,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  compactLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactText: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  compactError: {
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  compactErrorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  progressSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: colors.error,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
  },
  statusSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  statusContainer: {
    maxHeight: 300,
  },
  statsContainer: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  bundleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bundleIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  bundleName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  bundleStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  overlaySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default VendorBundleLoader;
