import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { config, isFeatureEnabled } from '../config/environment';

interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isRegistered: boolean;
  isLoading: boolean;
  error: string | null;
  permission: 'granted' | 'denied' | 'undetermined';
}

interface PushNotificationActions {
  registerForPushNotifications: () => Promise<boolean>;
  unregisterFromPushNotifications: () => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
  clearNotifications: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  getPermissionStatus: () => Promise<'granted' | 'denied' | 'undetermined'>;
}

type PushNotificationsContextType = PushNotificationState & PushNotificationActions;

const PushNotificationsContext = createContext<PushNotificationsContextType | null>(null);

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface PushNotificationsProviderProps {
  children: React.ReactNode;
}

export function PushNotificationsProvider({ children }: PushNotificationsProviderProps) {
  const [state, setState] = useState<PushNotificationState>({
    expoPushToken: null,
    notification: null,
    isRegistered: false,
    isLoading: false,
    error: null,
    permission: 'undetermined',
  });

  // Check if push notifications are supported and enabled
  const isPushNotificationsSupported = useCallback(() => {
    // Web has limited push notification support
    if (Platform.OS === 'web') {
      return false; // Disable for web for now
    }

    // Check if feature is enabled
    if (!isFeatureEnabled('enablePushNotifications')) {
      return false;
    }

    // Check if device supports push notifications
    return Device.isDevice;
  }, []);

  // Get current permission status
  const getPermissionStatus = useCallback(async (): Promise<'granted' | 'denied' | 'undetermined'> => {
    try {
      if (!isPushNotificationsSupported()) {
        return 'denied';
      }

      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'denied';
    }
  }, [isPushNotificationsSupported]);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      if (!isPushNotificationsSupported()) {
        console.log('Push notifications not supported on this platform');
        return false;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';

      setState(prev => ({
        ...prev,
        permission: granted ? 'granted' : 'denied',
        isLoading: false,
        error: granted ? null : 'Push notification permissions denied',
      }));

      return granted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error requesting permissions:', errorMessage);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        permission: 'denied',
      }));
      return false;
    }
  }, [isPushNotificationsSupported]);

  // Register for push notifications
  const registerForPushNotifications = useCallback(async (): Promise<boolean> => {
    try {
      if (!isPushNotificationsSupported()) {
        console.log('Push notifications not supported, skipping registration');
        setState(prev => ({
          ...prev,
          isRegistered: false,
          error: 'Push notifications not supported on this platform',
        }));
        return false;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Request permissions first
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Get the token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: config.app.environment === 'production' ? 'your-production-project-id' : 'your-dev-project-id',
      });

      setState(prev => ({
        ...prev,
        expoPushToken: token.data,
        isRegistered: true,
        isLoading: false,
        error: null,
      }));

      console.log('Push notification token:', token.data);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error registering for push notifications:', errorMessage);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isRegistered: false,
      }));
      return false;
    }
  }, [isPushNotificationsSupported, requestPermissions]);

  // Unregister from push notifications
  const unregisterFromPushNotifications = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Clear the token and state
      setState(prev => ({
        ...prev,
        expoPushToken: null,
        isRegistered: false,
        isLoading: false,
        error: null,
      }));

      console.log('Unregistered from push notifications');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error unregistering from push notifications:', errorMessage);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  // Send test notification
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    try {
      if (!state.isRegistered || !state.expoPushToken) {
        throw new Error('Not registered for push notifications');
      }

      // Schedule a local notification for testing
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'SÖKA Test Notification',
          body: 'Detta är en testnotifiering från SÖKA-appen',
          data: { type: 'test' },
        },
        trigger: { seconds: 1 },
      });

      console.log('Test notification scheduled');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error sending test notification:', errorMessage);
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [state.isRegistered, state.expoPushToken]);

  // Clear all notifications
  const clearNotifications = useCallback(async (): Promise<void> => {
    try {
      await Notifications.dismissAllNotificationsAsync();
      setState(prev => ({ ...prev, notification: null }));
      console.log('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, []);

  // Set up notification listeners
  useEffect(() => {
    if (!isPushNotificationsSupported()) {
      return;
    }

    let isMounted = true;

    // Initialize permission status
    getPermissionStatus().then(permission => {
      if (isMounted) {
        setState(prev => ({ ...prev, permission }));
      }
    });

    // Listen for incoming notifications
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      if (isMounted) {
        setState(prev => ({ ...prev, notification }));
        console.log('Notification received:', notification);
      }
    });

    // Listen for notification responses (when user taps notification)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle notification tap here
    });

    return () => {
      isMounted = false;
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, [isPushNotificationsSupported, getPermissionStatus]);

  const contextValue: PushNotificationsContextType = {
    ...state,
    registerForPushNotifications,
    unregisterFromPushNotifications,
    sendTestNotification,
    clearNotifications,
    requestPermissions,
    getPermissionStatus,
  };

  return (
    <PushNotificationsContext.Provider value={contextValue}>
      {children}
    </PushNotificationsContext.Provider>
  );
}

// Hook to use push notifications context
export function usePushNotifications(): PushNotificationsContextType {
  try {
    const context = useContext(PushNotificationsContext);

    if (!context) {
      // Instead of throwing an error, return a mock implementation for development
      console.warn('usePushNotifications used outside of PushNotificationsProvider, returning mock implementation');

      return {
        expoPushToken: null,
        notification: null,
        isRegistered: false,
        isLoading: false,
        error: 'Push notifications not available (no provider)',
        permission: 'denied',
        registerForPushNotifications: async () => {
          console.warn('Push notifications not available - no provider');
          return false;
        },
        unregisterFromPushNotifications: async () => {
          console.warn('Push notifications not available - no provider');
          return false;
        },
        sendTestNotification: async () => {
          console.warn('Push notifications not available - no provider');
          return false;
        },
        clearNotifications: async () => {
          console.warn('Push notifications not available - no provider');
        },
        requestPermissions: async () => {
          console.warn('Push notifications not available - no provider');
          return false;
        },
        getPermissionStatus: async () => {
          console.warn('Push notifications not available - no provider');
          return 'denied';
        },
      };
    }

    return context;
  } catch (error) {
    // Catch any errors and return a safe mock implementation
    console.error('Error in usePushNotifications hook:', error);
    console.warn('Returning mock implementation due to error');

    return {
      expoPushToken: null,
      notification: null,
      isRegistered: false,
      isLoading: false,
      error: 'Push notifications error - using fallback',
      permission: 'denied',
      registerForPushNotifications: async () => {
        console.warn('Push notifications not available - error fallback');
        return false;
      },
      unregisterFromPushNotifications: async () => {
        console.warn('Push notifications not available - error fallback');
        return false;
      },
      sendTestNotification: async () => {
        console.warn('Push notifications not available - error fallback');
        return false;
      },
      clearNotifications: async () => {
        console.warn('Push notifications not available - error fallback');
      },
      requestPermissions: async () => {
        console.warn('Push notifications not available - error fallback');
        return false;
      },
      getPermissionStatus: async () => {
        console.warn('Push notifications not available - error fallback');
        return 'denied';
      },
    };
  }
}

export default PushNotificationsProvider;
