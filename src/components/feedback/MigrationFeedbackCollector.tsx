/**
 * Migration Feedback Collector - Service Layer BaseService Migration
 * 
 * Samlar användarfeedback för migrerade tjänster:
 * - Prestanda-upplevelse och användbarhet
 * - Felrapportering med svenska beskrivningar
 * - GDPR-säker datainsamling och anonymisering
 * - Integration med Sentry och migration monitoring
 * 
 * Följer GDPR-efterlevnad och svensk lokalisering.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Modal } from 'react-native';
import { Button, Input, Rating, CheckBox } from '../ui/CustomElements';
import { supabase } from '../../services/supabaseClient';
import { sentryMigrationMonitor } from '../../monitoring/sentryMigrationMonitoring';

/**
 * Interface för feedback-data
 */
interface FeedbackData {
  serviceName: string;
  rating: number; // 1-5
  performanceRating: number; // 1-5
  usabilityRating: number; // 1-5
  comments: string;
  reportedIssues: string[];
  userType: 'admin' | 'user' | 'guest';
  sessionDuration: number; // millisekunder
  gdprConsent: boolean;
  timestamp: string;
}

/**
 * Interface för feedback-resultat
 */
interface FeedbackResult {
  success: boolean;
  feedbackId?: string;
  error?: string;
  gdprCompliant: boolean;
}

/**
 * Props för MigrationFeedbackCollector
 */
interface MigrationFeedbackCollectorProps {
  serviceName: string;
  visible: boolean;
  onClose: () => void;
  onSubmit?: (feedback: FeedbackData) => void;
  userType?: 'admin' | 'user' | 'guest';
}

/**
 * MigrationFeedbackCollector - Huvudkomponent för feedback-insamling
 */
export const MigrationFeedbackCollector: React.FC<MigrationFeedbackCollectorProps> = ({
  serviceName,
  visible,
  onClose,
  onSubmit,
  userType = 'user',
}) => {
  const [rating, setRating] = useState(5);
  const [performanceRating, setPerformanceRating] = useState(5);
  const [usabilityRating, setUsabilityRating] = useState(5);
  const [comments, setComments] = useState('');
  const [reportedIssues, setReportedIssues] = useState<string[]>([]);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionStartTime] = useState(Date.now());

  /**
   * Tillgängliga problem-kategorier
   */
  const issueCategories = [
    { key: 'slow_performance', label: 'Långsam prestanda' },
    { key: 'connection_issues', label: 'Anslutningsproblem' },
    { key: 'ui_problems', label: 'Gränssnittsproblem' },
    { key: 'data_sync_issues', label: 'Datasynkroniseringsproblem' },
    { key: 'audio_video_issues', label: 'Ljud/videoproblem' },
    { key: 'backup_restore_issues', label: 'Säkerhetskopiering/återställning' },
    { key: 'other', label: 'Annat problem' },
  ];

  /**
   * Hanterar ändring av rapporterade problem
   */
  const handleIssueToggle = (issueKey: string): void => {
    setReportedIssues(prev => 
      prev.includes(issueKey)
        ? prev.filter(issue => issue !== issueKey)
        : [...prev, issueKey]
    );
  };

  /**
   * Validerar feedback-data
   */
  const validateFeedback = (): string | null => {
    if (!gdprConsent) {
      return 'Du måste ge samtycke för datainsamling enligt GDPR';
    }

    if (rating < 1 || rating > 5) {
      return 'Betyg måste vara mellan 1 och 5';
    }

    if (comments.length > 1000) {
      return 'Kommentarer får inte överstiga 1000 tecken';
    }

    return null;
  };

  /**
   * Anonymiserar feedback-data för GDPR-efterlevnad
   */
  const anonymizeFeedbackData = (feedback: FeedbackData): FeedbackData => {
    return {
      ...feedback,
      // Ta bort potentiellt identifierande information
      comments: feedback.comments.replace(/\b\d{6,8}[-\s]?\d{4}\b/g, '[PERSONNUMMER]'),
      // Anonymisera tidsstämpel till timme-nivå
      timestamp: new Date(feedback.timestamp).toISOString().substring(0, 13) + ':00:00.000Z',
    };
  };

  /**
   * Skickar feedback till backend
   */
  const submitFeedback = async (): Promise<FeedbackResult> => {
    try {
      const sessionDuration = Date.now() - sessionStartTime;
      
      const feedbackData: FeedbackData = {
        serviceName,
        rating,
        performanceRating,
        usabilityRating,
        comments: comments.trim(),
        reportedIssues,
        userType,
        sessionDuration,
        gdprConsent,
        timestamp: new Date().toISOString(),
      };

      // Anonymisera data för GDPR-efterlevnad
      const anonymizedFeedback = anonymizeFeedbackData(feedbackData);

      // Spara till Supabase
      const { data, error } = await supabase
        .from('migration_feedback')
        .insert([{
          service_name: anonymizedFeedback.serviceName,
          rating: anonymizedFeedback.rating,
          performance_rating: anonymizedFeedback.performanceRating,
          usability_rating: anonymizedFeedback.usabilityRating,
          comments: anonymizedFeedback.comments,
          reported_issues: anonymizedFeedback.reportedIssues,
          user_type: anonymizedFeedback.userType,
          session_duration: anonymizedFeedback.sessionDuration,
          gdpr_consent: anonymizedFeedback.gdprConsent,
          created_at: anonymizedFeedback.timestamp,
          gdpr_compliant: true,
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Rapportera till Sentry för analys
      sentryMigrationMonitor.trackPerformance({
        serviceName: `${serviceName}_feedback`,
        operationName: 'feedback_submission',
        duration: sessionDuration,
        success: true,
        metadata: {
          rating: anonymizedFeedback.rating,
          performanceRating: anonymizedFeedback.performanceRating,
          usabilityRating: anonymizedFeedback.usabilityRating,
          issueCount: anonymizedFeedback.reportedIssues.length,
          userType: anonymizedFeedback.userType,
        },
      });

      return {
        success: true,
        feedbackId: data.id,
        gdprCompliant: true,
      };
    } catch (error) {
      console.error('❌ Fel vid skickning av feedback:', error);
      
      // Rapportera fel till Sentry
      sentryMigrationMonitor.reportMigrationError(
        `${serviceName}_feedback`,
        error as Error,
        { operation: 'feedback_submission' }
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Okänt fel',
        gdprCompliant: true,
      };
    }
  };

  /**
   * Hanterar feedback-inlämning
   */
  const handleSubmit = async (): Promise<void> => {
    const validationError = validateFeedback();
    if (validationError) {
      Alert.alert('Valideringsfel', validationError);
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitFeedback();
      
      if (result.success) {
        Alert.alert(
          'Tack för din feedback!',
          'Din feedback har skickats och hjälper oss att förbättra tjänsten.',
          [{ text: 'OK', onPress: onClose }]
        );

        // Anropa callback om tillgänglig
        if (onSubmit) {
          const feedbackData: FeedbackData = {
            serviceName,
            rating,
            performanceRating,
            usabilityRating,
            comments,
            reportedIssues,
            userType,
            sessionDuration: Date.now() - sessionStartTime,
            gdprConsent,
            timestamp: new Date().toISOString(),
          };
          onSubmit(feedbackData);
        }
      } else {
        Alert.alert(
          'Fel vid skickning',
          `Kunde inte skicka feedback: ${result.error}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Fel',
        'Ett oväntat fel inträffade. Försök igen senare.',
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Återställer formulär
   */
  const resetForm = (): void => {
    setRating(5);
    setPerformanceRating(5);
    setUsabilityRating(5);
    setComments('');
    setReportedIssues([]);
    setGdprConsent(false);
  };

  /**
   * Hanterar stängning av modal
   */
  const handleClose = (): void => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Feedback för {serviceName}</Text>
          <Button
            title="Stäng"
            type="clear"
            onPress={handleClose}
            titleStyle={styles.closeButtonText}
          />
        </View>

        <View style={styles.content}>
          {/* Allmänt betyg */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allmänt betyg</Text>
            <Rating
              startingValue={rating}
              onFinishRating={setRating}
              style={styles.rating}
              imageSize={30}
            />
          </View>

          {/* Prestanda-betyg */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prestanda</Text>
            <Rating
              startingValue={performanceRating}
              onFinishRating={setPerformanceRating}
              style={styles.rating}
              imageSize={25}
            />
          </View>

          {/* Användbarhet */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Användbarhet</Text>
            <Rating
              startingValue={usabilityRating}
              onFinishRating={setUsabilityRating}
              style={styles.rating}
              imageSize={25}
            />
          </View>

          {/* Rapporterade problem */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upplevda problem (valfritt)</Text>
            {issueCategories.map(issue => (
              <CheckBox
                key={issue.key}
                title={issue.label}
                checked={reportedIssues.includes(issue.key)}
                onPress={() => handleIssueToggle(issue.key)}
                containerStyle={styles.checkboxContainer}
                textStyle={styles.checkboxText}
              />
            ))}
          </View>

          {/* Kommentarer */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kommentarer (valfritt)</Text>
            <Input
              placeholder="Beskriv din upplevelse eller förslag för förbättringar..."
              value={comments}
              onChangeText={setComments}
              multiline
              numberOfLines={4}
              maxLength={1000}
              containerStyle={styles.inputContainer}
              inputStyle={styles.textInput}
            />
            <Text style={styles.characterCount}>
              {comments.length}/1000 tecken
            </Text>
          </View>

          {/* GDPR-samtycke */}
          <View style={styles.section}>
            <CheckBox
              title="Jag samtycker till att min feedback samlas in och analyseras för att förbättra tjänsten. Data behandlas enligt GDPR och anonymiseras."
              checked={gdprConsent}
              onPress={() => setGdprConsent(!gdprConsent)}
              containerStyle={styles.gdprContainer}
              textStyle={styles.gdprText}
            />
          </View>

          {/* Skicka-knapp */}
          <Button
            title="Skicka feedback"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!gdprConsent || submitting}
            buttonStyle={[
              styles.submitButton,
              (!gdprConsent || submitting) && styles.submitButtonDisabled
            ]}
            titleStyle={styles.submitButtonText}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  rating: {
    alignSelf: 'flex-start',
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginLeft: 0,
    marginRight: 0,
    paddingVertical: 4,
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'normal',
  },
  inputContainer: {
    paddingHorizontal: 0,
  },
  textInput: {
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  gdprContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  gdprText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'normal',
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MigrationFeedbackCollector;
