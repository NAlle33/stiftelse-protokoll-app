/**
 * Vendor Splitting Provider
 * 
 * Tillhandahåller context för vendor bundle loading med svensk lokalisering
 * och GDPR-efterlevnad.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import VendorBundleLoader from '../../utils/performance/vendorSplitting';

// Bundle state interface
interface BundleState {
  react: boolean;
  supabase: boolean;
  crypto: boolean;
  expo: boolean;
  webrtc: boolean;
  monitoring: boolean;
  polyfills: boolean;
}

// Context interface
interface VendorSplittingContextType {
  bundleState: BundleState;
  loadBundle: (bundleName: keyof BundleState) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  getBundleStats: () => any;
}

// Create context
const VendorSplittingContext = createContext<VendorSplittingContextType | undefined>(undefined);

// Provider props
interface VendorSplittingProviderProps {
  children: ReactNode;
  preloadBundles?: (keyof BundleState)[];
}

// Provider component
export const VendorSplittingProvider: React.FC<VendorSplittingProviderProps> = ({
  children,
  preloadBundles = []
}) => {
  const [bundleState, setBundleState] = useState<BundleState>({
    react: false,
    supabase: false,
    crypto: false,
    expo: false,
    webrtc: false,
    monitoring: false,
    polyfills: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load bundle function
  const loadBundle = async (bundleName: keyof BundleState): Promise<void> => {
    if (bundleState[bundleName]) {
      return; // Already loaded
    }

    setIsLoading(true);
    setError(null);

    try {
      switch (bundleName) {
        case 'react':
          await VendorBundleLoader.loadReactBundle();
          break;
        case 'supabase':
          await VendorBundleLoader.loadSupabaseBundle();
          break;
        case 'crypto':
          await VendorBundleLoader.loadCryptoBundle();
          break;
        case 'expo':
          await VendorBundleLoader.loadExpoBundle();
          break;
        case 'webrtc':
          await VendorBundleLoader.loadWebRTCBundle();
          break;
        case 'monitoring':
          await VendorBundleLoader.loadMonitoringBundle();
          break;
        case 'polyfills':
          await VendorBundleLoader.loadPolyfillsBundle();
          break;
        default:
          throw new Error(`Okänd bundle: ${bundleName}`);
      }

      setBundleState(prev => ({
        ...prev,
        [bundleName]: true
      }));

      console.log(`✅ Bundle laddad: ${bundleName}`);
    } catch (err) {
      const errorMessage = `Fel vid laddning av bundle ${bundleName}: ${err instanceof Error ? err.message : 'Okänt fel'}`;
      setError(errorMessage);
      console.error(errorMessage, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get bundle statistics
  const getBundleStats = () => {
    return VendorBundleLoader.getBundleStats();
  };

  // Preload bundles on mount
  useEffect(() => {
    const preloadBundlesAsync = async () => {
      for (const bundleName of preloadBundles) {
        try {
          await loadBundle(bundleName);
        } catch (err) {
          console.error(`Fel vid förladdning av bundle ${bundleName}:`, err);
        }
      }
    };

    if (preloadBundles.length > 0) {
      preloadBundlesAsync();
    }
  }, [preloadBundles]);

  const contextValue: VendorSplittingContextType = {
    bundleState,
    loadBundle,
    isLoading,
    error,
    getBundleStats,
  };

  return (
    <VendorSplittingContext.Provider value={contextValue}>
      {children}
    </VendorSplittingContext.Provider>
  );
};

// Main hook
export const useVendorSplitting = (): VendorSplittingContextType => {
  const context = useContext(VendorSplittingContext);
  if (!context) {
    throw new Error('useVendorSplitting måste användas inom VendorSplittingProvider');
  }
  return context;
};

// Specific bundle hooks
export const useReactBundle = () => {
  const { bundleState, loadBundle } = useVendorSplitting();
  return {
    isLoaded: bundleState.react,
    load: () => loadBundle('react'),
  };
};

export const useSupabaseBundle = () => {
  const { bundleState, loadBundle } = useVendorSplitting();
  return {
    isLoaded: bundleState.supabase,
    load: () => loadBundle('supabase'),
  };
};

export const useCryptoBundle = () => {
  const { bundleState, loadBundle } = useVendorSplitting();
  return {
    isLoaded: bundleState.crypto,
    load: () => loadBundle('crypto'),
  };
};

export const useWebRTCBundle = () => {
  const { bundleState, loadBundle } = useVendorSplitting();
  return {
    isLoaded: bundleState.webrtc,
    load: () => loadBundle('webrtc'),
  };
};

export const useMonitoringBundle = () => {
  const { bundleState, loadBundle } = useVendorSplitting();
  return {
    isLoaded: bundleState.monitoring,
    load: () => loadBundle('monitoring'),
  };
};

export default VendorSplittingProvider;
