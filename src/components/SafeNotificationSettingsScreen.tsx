import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePushNotifications } from '../providers/PushNotificationsProvider';
import { isFeatureEnabled } from '../config/environment';

interface NotificationSettings {
  pushNotifications: boolean;
  meetingReminders: boolean;
  protocolUpdates: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
}

export function SafeNotificationSettingsScreen() {
  const pushNotifications = usePushNotifications();
  const [settings, setSettings] = useState<NotificationSettings>({
    pushNotifications: false,
    meetingReminders: true,
    protocolUpdates: true,
    systemNotifications: true,
    emailNotifications: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  const isPushSupported = Platform.OS !== 'web' && isFeatureEnabled('enablePushNotifications');

  useEffect(() => {
    // Initialize settings based on current push notification state
    if (pushNotifications.isRegistered) {
      setSettings(prev => ({ ...prev, pushNotifications: true }));
    }
  }, [pushNotifications.isRegistered]);

  const handlePushNotificationToggle = async (value: boolean) => {
    if (!isPushSupported) {
      Alert.alert(
        'Inte tillgängligt',
        'Push-notifieringar stöds inte på denna plattform.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    
    try {
      if (value) {
        // Enable push notifications
        const success = await pushNotifications.registerForPushNotifications();
        if (success) {
          setSettings(prev => ({ ...prev, pushNotifications: true }));
          Alert.alert(
            'Aktiverat',
            'Push-notifieringar har aktiverats för SÖKA-appen.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Fel',
            pushNotifications.error || 'Kunde inte aktivera push-notifieringar.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Disable push notifications
        const success = await pushNotifications.unregisterFromPushNotifications();
        if (success) {
          setSettings(prev => ({ ...prev, pushNotifications: false }));
          Alert.alert(
            'Inaktiverat',
            'Push-notifieringar har inaktiverats.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      Alert.alert(
        'Fel',
        'Ett fel uppstod när push-notifieringar skulle ändras.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingToggle = (key: keyof NotificationSettings, value: boolean) => {
    if (key === 'pushNotifications') {
      handlePushNotificationToggle(value);
      return;
    }

    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const sendTestNotification = async () => {
    if (!isPushSupported || !pushNotifications.isRegistered) {
      Alert.alert(
        'Inte tillgängligt',
        'Push-notifieringar måste vara aktiverade för att skicka testnotifieringar.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      const success = await pushNotifications.sendTestNotification();
      if (success) {
        Alert.alert(
          'Testnotifiering skickad',
          'En testnotifiering har skickats till din enhet.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Fel',
          'Kunde inte skicka testnotifiering.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert(
        'Fel',
        'Ett fel uppstod när testnotifieringen skulle skickas.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await pushNotifications.clearNotifications();
      Alert.alert(
        'Rensade',
        'Alla notifieringar har rensats.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifieringsinställningar</Text>
          <Text style={styles.subtitle}>
            Hantera hur du vill få notifieringar från SÖKA-appen
          </Text>
        </View>

        {/* Push Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push-notifieringar</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Aktivera push-notifieringar</Text>
              <Text style={styles.settingDescription}>
                {isPushSupported 
                  ? 'Få notifieringar direkt till din enhet'
                  : 'Inte tillgängligt på denna plattform'
                }
              </Text>
            </View>
            <Switch
              value={settings.pushNotifications}
              onValueChange={(value) => handleSettingToggle('pushNotifications', value)}
              disabled={!isPushSupported || isLoading}
            />
          </View>

          {pushNotifications.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{pushNotifications.error}</Text>
            </View>
          )}

          {pushNotifications.expoPushToken && (
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>Push Token:</Text>
              <Text style={styles.tokenText} numberOfLines={2}>
                {pushNotifications.expoPushToken}
              </Text>
            </View>
          )}
        </View>

        {/* Notification Types Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifieringstyper</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Mötespåminnelser</Text>
              <Text style={styles.settingDescription}>
                Få påminnelser innan möten börjar
              </Text>
            </View>
            <Switch
              value={settings.meetingReminders}
              onValueChange={(value) => handleSettingToggle('meetingReminders', value)}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Protokolluppdateringar</Text>
              <Text style={styles.settingDescription}>
                Få notifieringar när protokoll uppdateras
              </Text>
            </View>
            <Switch
              value={settings.protocolUpdates}
              onValueChange={(value) => handleSettingToggle('protocolUpdates', value)}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Systemnotifieringar</Text>
              <Text style={styles.settingDescription}>
                Få notifieringar om systemuppdateringar
              </Text>
            </View>
            <Switch
              value={settings.systemNotifications}
              onValueChange={(value) => handleSettingToggle('systemNotifications', value)}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>E-postnotifieringar</Text>
              <Text style={styles.settingDescription}>
                Få notifieringar via e-post
              </Text>
            </View>
            <Switch
              value={settings.emailNotifications}
              onValueChange={(value) => handleSettingToggle('emailNotifications', value)}
            />
          </View>
        </View>

        {/* Test Section */}
        {isPushSupported && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test & Hantering</Text>
            
            <TouchableOpacity
              style={[
                styles.button,
                (!pushNotifications.isRegistered || isLoading) && styles.buttonDisabled
              ]}
              onPress={sendTestNotification}
              disabled={!pushNotifications.isRegistered || isLoading}
            >
              <Text style={[
                styles.buttonText,
                (!pushNotifications.isRegistered || isLoading) && styles.buttonTextDisabled
              ]}>
                Skicka testnotifiering
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={clearAllNotifications}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Rensa alla notifieringar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Plattform:</Text>
            <Text style={styles.statusValue}>{Platform.OS}</Text>
          </View>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Push-stöd:</Text>
            <Text style={styles.statusValue}>
              {isPushSupported ? 'Tillgängligt' : 'Inte tillgängligt'}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Registrerad:</Text>
            <Text style={styles.statusValue}>
              {pushNotifications.isRegistered ? 'Ja' : 'Nej'}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Behörighet:</Text>
            <Text style={styles.statusValue}>
              {pushNotifications.permission === 'granted' ? 'Beviljad' :
               pushNotifications.permission === 'denied' ? 'Nekad' : 'Okänd'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  tokenContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  tokenLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  tokenText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#999',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  secondaryButtonText: {
    color: '#2196F3',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});

export default SafeNotificationSettingsScreen;
