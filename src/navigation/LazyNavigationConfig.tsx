/**
 * Lazy Navigation Configuration för SÖKA Stiftelseappen
 * 
 * Implementerar enhanced code splitting för navigation med:
 * - Route-level prefetching
 * - Adaptiv laddning baserat på nätverkshastighet
 * - Intelligent chunk-prioritering
 * - Performance monitoring
 * 
 * Del av Performance Fine-tuning (Section 6) - Enhanced Code Splitting
 */

import React, { Suspense, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enhancedCodeSplittingManager, NetworkConditions } from '../utils/performance/enhancedCodeSplitting';

const Stack = createNativeStackNavigator();

// Lazy-loaded screens med enhanced prefetching
const LazyMeetingListScreen = React.lazy(() => 
  enhancedCodeSplittingManager.getPrefetchedRoute('LazyMeetingListScreen')
    .catch(() => import('../screens/lazy/LazyMeetingListScreen'))
);

const LazyNewMeetingScreen = React.lazy(() => 
  enhancedCodeSplittingManager.getPrefetchedRoute('LazyNewMeetingScreen')
    .catch(() => import('../screens/lazy/LazyNewMeetingScreen'))
);

const LazyProtocolScreen = React.lazy(() => 
  enhancedCodeSplittingManager.getPrefetchedRoute('LazyProtocolScreen')
    .catch(() => import('../screens/lazy/LazyProtocolScreen'))
);

const LazyRecordingScreen = React.lazy(() => 
  enhancedCodeSplittingManager.getPrefetchedRoute('LazyRecordingScreen')
    .catch(() => import('../screens/lazy/LazyRecordingScreen'))
);

const LazyVideoMeetingScreen = React.lazy(() => 
  enhancedCodeSplittingManager.getPrefetchedRoute('LazyVideoMeetingScreen')
    .catch(() => import('../screens/lazy/LazyVideoMeetingScreen'))
);

// Adaptiva loading-komponenter baserat på nätverkshastighet
interface AdaptiveLoadingSpinnerProps {
  networkConditions?: NetworkConditions | null;
  routeName?: string;
}

const AdaptiveLoadingSpinner: React.FC<AdaptiveLoadingSpinnerProps> = ({ 
  networkConditions, 
  routeName 
}) => {
  const [loadingMessage, setLoadingMessage] = useState('Laddar...');
  const [showProgressBar, setShowProgressBar] = useState(false);

  useEffect(() => {
    if (!networkConditions) return;

    // Anpassa loading-meddelande baserat på nätverkshastighet
    if (networkConditions.saveData || networkConditions.effectiveType === 'slow-2g') {
      setLoadingMessage('Laddar (optimerat för långsamt nätverk)...');
      setShowProgressBar(true);
    } else if (networkConditions.effectiveType === '2g') {
      setLoadingMessage('Laddar (2G-nätverk)...');
      setShowProgressBar(true);
    } else if (networkConditions.effectiveType === '3g') {
      setLoadingMessage('Laddar...');
      setShowProgressBar(false);
    } else {
      setLoadingMessage('Laddar...');
      setShowProgressBar(false);
    }
  }, [networkConditions]);

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      padding: 20,
    }}>
      <ActivityIndicator 
        size="large" 
        color="#007AFF" 
        style={{ marginBottom: 16 }}
      />
      <Text style={{
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: showProgressBar ? 16 : 0,
      }}>
        {loadingMessage}
      </Text>
      
      {showProgressBar && (
        <View style={{
          width: '80%',
          height: 4,
          backgroundColor: '#e0e0e0',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <View style={{
            width: '60%', // Simulerad progress
            height: '100%',
            backgroundColor: '#007AFF',
            borderRadius: 2,
          }} />
        </View>
      )}
      
      {routeName && (
        <Text style={{
          fontSize: 12,
          color: '#999',
          marginTop: 8,
          textAlign: 'center',
        }}>
          {routeName}
        </Text>
      )}
    </View>
  );
};

// Error boundary för lazy loading
interface LazyLoadingErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType;
  routeName?: string;
}

class LazyLoadingErrorBoundary extends React.Component<
  LazyLoadingErrorBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: LazyLoadingErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Lazy Loading Error:', error, errorInfo);
    
    // Rapportera fel till monitoring
    if (Platform.OS === 'web' && 'gtag' in window) {
      // @ts-ignore
      window.gtag('event', 'lazy_loading_error', {
        route_name: this.props.routeName,
        error_message: error.message,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent />;
    }

    return this.props.children;
  }
}

// Default error fallback
const DefaultErrorFallback: React.FC = () => (
  <View style={{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  }}>
    <Text style={{
      fontSize: 18,
      color: '#d32f2f',
      textAlign: 'center',
      marginBottom: 16,
    }}>
      Fel vid laddning
    </Text>
    <Text style={{
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
    }}>
      Något gick fel när sidan skulle laddas. Försök igen senare.
    </Text>
  </View>
);

// Screen wrapper med enhanced loading
interface LazyScreenWrapperProps {
  children: React.ReactNode;
  routeName: string;
  networkConditions?: NetworkConditions | null;
}

const LazyScreenWrapper: React.FC<LazyScreenWrapperProps> = ({ 
  children, 
  routeName, 
  networkConditions 
}) => (
  <LazyLoadingErrorBoundary routeName={routeName}>
    <Suspense 
      fallback={
        <AdaptiveLoadingSpinner 
          networkConditions={networkConditions} 
          routeName={routeName}
        />
      }
    >
      {children}
    </Suspense>
  </LazyLoadingErrorBoundary>
);

// Navigation configuration med enhanced code splitting
interface LazyNavigationConfigProps {
  initialRouteName?: string;
  onNavigationReady?: () => void;
}

export const LazyNavigationConfig: React.FC<LazyNavigationConfigProps> = ({
  initialRouteName = 'MeetingList',
  onNavigationReady,
}) => {
  const [networkConditions, setNetworkConditions] = useState<NetworkConditions | null>(null);
  const [isCodeSplittingReady, setIsCodeSplittingReady] = useState(false);

  useEffect(() => {
    // Initialisera enhanced code splitting
    const initializeCodeSplitting = async () => {
      try {
        await enhancedCodeSplittingManager.initialize();
        setIsCodeSplittingReady(true);
        
        // Hämta nätverksförhållanden
        const stats = enhancedCodeSplittingManager.getStatistics();
        setNetworkConditions(stats.networkConditions);
        
        console.log('✅ Lazy Navigation: Enhanced code splitting initialiserat');
      } catch (error) {
        console.error('❌ Lazy Navigation: Fel vid initialisering:', error);
        setIsCodeSplittingReady(true); // Fortsätt ändå
      }
    };

    initializeCodeSplitting();
  }, []);

  const handleNavigationReady = () => {
    console.log('🧭 Lazy Navigation: Navigation redo');
    onNavigationReady?.();
  };

  if (!isCodeSplittingReady) {
    return (
      <AdaptiveLoadingSpinner 
        networkConditions={networkConditions}
        routeName="Initialiserar navigation..."
      />
    );
  }

  return (
    <NavigationContainer onReady={handleNavigationReady}>
      <Stack.Navigator 
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen 
          name="MeetingList" 
          options={{ title: 'Möten' }}
        >
          {() => (
            <LazyScreenWrapper 
              routeName="MeetingList" 
              networkConditions={networkConditions}
            >
              <LazyMeetingListScreen />
            </LazyScreenWrapper>
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="NewMeeting" 
          options={{ title: 'Nytt möte' }}
        >
          {() => (
            <LazyScreenWrapper 
              routeName="NewMeeting" 
              networkConditions={networkConditions}
            >
              <LazyNewMeetingScreen />
            </LazyScreenWrapper>
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="Protocol" 
          options={{ title: 'Protokoll' }}
        >
          {() => (
            <LazyScreenWrapper 
              routeName="Protocol" 
              networkConditions={networkConditions}
            >
              <LazyProtocolScreen />
            </LazyScreenWrapper>
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="Recording" 
          options={{ title: 'Inspelning' }}
        >
          {() => (
            <LazyScreenWrapper 
              routeName="Recording" 
              networkConditions={networkConditions}
            >
              <LazyRecordingScreen />
            </LazyScreenWrapper>
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="VideoMeeting" 
          options={{ title: 'Videomöte' }}
        >
          {() => (
            <LazyScreenWrapper 
              routeName="VideoMeeting" 
              networkConditions={networkConditions}
            >
              <LazyVideoMeetingScreen />
            </LazyScreenWrapper>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Hook för att använda enhanced code splitting i komponenter
export const useEnhancedCodeSplitting = () => {
  const [statistics, setStatistics] = useState(enhancedCodeSplittingManager.getStatistics());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatistics(enhancedCodeSplittingManager.getStatistics());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    statistics,
    prefetchRoute: (routeName: string) => enhancedCodeSplittingManager.prefetchRoute(routeName, 'manual'),
    clearCache: () => enhancedCodeSplittingManager.clearPrefetchCache(),
  };
};

export default LazyNavigationConfig;
