/**
 * MeetingConsent - GDPR-kompatibel samtycke för videomöten
 * 
 * Denna komponent hanterar:
 * - Explicit GDPR-samtycke för videomöten
 * - Tydlig information om databehandling
 * - Svenska juridiska texter
 * - Tillgänglighet och användarvänlighet
 * - Audit trail för samtycke
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform
} from 'react-native';
import { SafeIonicons } from '../ui/SafeIonicons';
import { colors } from '../../theme/colors';
import { logger } from '../../utils/logger';

interface MeetingConsentProps {
  meetingId: string;
  onConsent: (consentGiven: boolean) => void;
}

interface ConsentInfo {
  title: string;
  description: string;
  icon: string;
  isImportant?: boolean;
}

export const MeetingConsent: React.FC<MeetingConsentProps> = ({
  meetingId,
  onConsent
}) => {
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Information om databehandling enligt GDPR
   */
  const consentInfo: ConsentInfo[] = [
    {
      title: 'Ljudinspelning',
      description: 'Din röst kommer att spelas in för att skapa mötesprotokoll. Inspelningen transkriberas automatiskt och används endast för protokollsändamål.',
      icon: 'mic',
      isImportant: true
    },
    {
      title: 'Ingen videoinspelning',
      description: 'Din video spelas INTE in. Endast ljud används för protokollsändamål. Video används bara för kommunikation under mötet.',
      icon: 'videocam-off',
      isImportant: true
    },
    {
      title: 'Datalagring',
      description: 'Ljudinspelningar lagras säkert i EU-datacenter och raderas automatiskt efter 30 dagar. Endast auktoriserad personal har åtkomst.',
      icon: 'shield-checkmark'
    },
    {
      title: 'Dina rättigheter',
      description: 'Du kan när som helst begära att få se, korrigera eller radera dina personuppgifter. Du kan också återkalla ditt samtycke.',
      icon: 'person-circle'
    },
    {
      title: 'Säker överföring',
      description: 'All data överförs krypterat och mötet använder end-to-end kryptering för maximal säkerhet.',
      icon: 'lock-closed'
    }
  ];

  /**
   * Hanterar samtycke
   */
  const handleConsent = async (consentGiven: boolean) => {
    try {
      setIsProcessing(true);

      // Logga samtycke-beslut för audit trail
      logger.info('Samtycke för videomöte', {
        meetingId,
        consentGiven,
        timestamp: new Date().toISOString(),
        userAgent: Platform.OS
      });

      // Vänta lite för att visa processing
      await new Promise(resolve => setTimeout(resolve, 500));

      onConsent(consentGiven);

    } catch (error) {
      logger.error('Fel vid hantering av samtycke', { error, meetingId });
      Alert.alert('Fel', 'Ett fel uppstod vid hantering av samtycke. Försök igen.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Visar detaljerad information om GDPR
   */
  const showGDPRDetails = () => {
    Alert.alert(
      'GDPR och Personuppgifter',
      'Enligt EU:s dataskyddsförordning (GDPR) har du rätt att:\n\n' +
      '• Få information om hur dina personuppgifter behandlas\n' +
      '• Begära rättelse av felaktiga uppgifter\n' +
      '• Begära radering av dina uppgifter\n' +
      '• Återkalla ditt samtycke när som helst\n' +
      '• Lämna klagomål till Integritetsskyddsmyndigheten\n\n' +
      'Kontakta oss på privacy@stiftelse-app.se för frågor om personuppgifter.',
      [{ text: 'Förstått', style: 'default' }]
    );
  };

  /**
   * Visar information om teknisk säkerhet
   */
  const showSecurityDetails = () => {
    Alert.alert(
      'Teknisk Säkerhet',
      'Videomötet använder:\n\n' +
      '• End-to-end kryptering (DTLS/SRTP)\n' +
      '• Säkra EU-baserade servrar\n' +
      '• BankID-autentisering\n' +
      '• Automatisk dataradering\n' +
      '• Fullständig audit trail\n\n' +
      'All data behandlas enligt svenska och EU-lagar.',
      [{ text: 'Förstått', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Rubrik */}
        <View style={styles.header}>
          <SafeIonicons
            name="shield-checkmark"
            size={48}
            color={colors.primary}
          />
          <Text style={styles.title}>Samtycke för Videomöte</Text>
          <Text style={styles.subtitle}>
            Läs igenom informationen nedan innan du går med i mötet
          </Text>
        </View>

        {/* Informationskort */}
        <View style={styles.infoCards}>
          {consentInfo.map((info, index) => (
            <View 
              key={index} 
              style={[
                styles.infoCard,
                info.isImportant && styles.importantCard
              ]}
            >
              <View style={styles.cardHeader}>
                <SafeIonicons
                  name={info.icon as any}
                  size={24}
                  color={info.isImportant ? colors.primary : colors.textSecondary}
                />
                <Text style={[
                  styles.cardTitle,
                  info.isImportant && styles.importantTitle
                ]}>
                  {info.title}
                </Text>
              </View>
              <Text style={styles.cardDescription}>
                {info.description}
              </Text>
            </View>
          ))}
        </View>

        {/* Juridisk information */}
        <View style={styles.legalSection}>
          <Text style={styles.legalTitle}>Juridisk Information</Text>
          <Text style={styles.legalText}>
            Genom att ge ditt samtycke godkänner du att dina personuppgifter 
            (röstinspelning) behandlas enligt ovan beskrivning och i enlighet 
            med GDPR. Du kan återkalla ditt samtycke när som helst.
          </Text>
          
          <View style={styles.legalLinks}>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={showGDPRDetails}
            >
              <Text style={styles.linkText}>GDPR-rättigheter</Text>
              <SafeIonicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={showSecurityDetails}
            >
              <Text style={styles.linkText}>Teknisk säkerhet</Text>
              <SafeIonicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bekräftelse att användaren har läst */}
        <TouchableOpacity
          style={styles.readConfirmation}
          onPress={() => setHasReadTerms(!hasReadTerms)}
          accessibilityLabel="Bekräfta att du har läst informationen"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasReadTerms }}
        >
          <View style={[
            styles.checkbox,
            hasReadTerms && styles.checkboxChecked
          ]}>
            {hasReadTerms && (
              <SafeIonicons
                name="checkmark"
                size={16}
                color={colors.white}
              />
            )}
          </View>
          <Text style={styles.readConfirmationText}>
            Jag har läst och förstått informationen ovan
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Knappar */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={() => handleConsent(false)}
          disabled={isProcessing}
          accessibilityLabel="Avböj samtycke och gå tillbaka"
          accessibilityRole="button"
        >
          <Text style={styles.declineButtonText}>
            {isProcessing ? 'Bearbetar...' : 'Avböj'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button, 
            styles.acceptButton,
            (!hasReadTerms || isProcessing) && styles.buttonDisabled
          ]}
          onPress={() => handleConsent(true)}
          disabled={!hasReadTerms || isProcessing}
          accessibilityLabel="Ge samtycke och gå med i mötet"
          accessibilityRole="button"
        >
          <SafeIonicons
            name="checkmark-circle"
            size={20}
            color={colors.white}
            style={styles.buttonIcon}
          />
          <Text style={styles.acceptButtonText}>
            {isProcessing ? 'Bearbetar...' : 'Ge Samtycke'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Plats för knappar
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoCards: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  importantCard: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 12,
    flex: 1,
  },
  importantTitle: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginLeft: 36,
  },
  legalSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  legalText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  legalLinks: {
    gap: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  readConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  readConfirmationText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    minHeight: 52,
  },
  buttonIcon: {
    marginRight: 8,
  },
  declineButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default MeetingConsent;
