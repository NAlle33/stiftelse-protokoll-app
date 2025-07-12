import { supabase, withRetry } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface BackupData {
  id: string;
  userId: string;
  data: any;
  type: 'meeting' | 'protocol' | 'user_settings' | 'full_backup';
  createdAt: string;
  size: number;
  checksum?: string;
}

interface RetentionPolicy {
  dailyBackups: number; // Keep last N daily backups
  weeklyBackups: number; // Keep last N weekly backups
  monthlyBackups: number; // Keep last N monthly backups
}

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  dailyBackups: 7,
  weeklyBackups: 4,
  monthlyBackups: 12,
};

class BackupService {
  private isInitialized = false;
  private retentionPolicy: RetentionPolicy = DEFAULT_RETENTION_POLICY;

  async initialize(): Promise<void> {
    try {
      // Load retention policy from storage
      const storedPolicy = await this.getStoredRetentionPolicy();
      if (storedPolicy) {
        this.retentionPolicy = { ...DEFAULT_RETENTION_POLICY, ...storedPolicy };
      }
      
      this.isInitialized = true;
      console.log('BackupService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BackupService:', error);
      // Continue with default settings
      this.isInitialized = true;
    }
  }

  private async getStoredRetentionPolicy(): Promise<Partial<RetentionPolicy> | null> {
    try {
      const key = 'backup_retention_policy';
      let stored: string | null;
      
      if (Platform.OS === 'web') {
        stored = localStorage.getItem(key);
      } else {
        stored = await AsyncStorage.getItem(key);
      }
      
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error loading retention policy:', error);
      return null;
    }
  }

  private async saveRetentionPolicy(policy: RetentionPolicy): Promise<void> {
    try {
      const key = 'backup_retention_policy';
      const value = JSON.stringify(policy);
      
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error saving retention policy:', error);
    }
  }

  async createBackup(
    userId: string,
    data: any,
    type: BackupData['type'] = 'full_backup'
  ): Promise<{ success: boolean; backupId?: string; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Validate input
      if (!userId || !data) {
        throw new Error('Invalid backup parameters: userId and data are required');
      }

      // Prepare backup data
      const backupData: Omit<BackupData, 'id'> = {
        userId,
        data: typeof data === 'string' ? data : JSON.stringify(data),
        type,
        createdAt: new Date().toISOString(),
        size: JSON.stringify(data).length,
        checksum: await this.generateChecksum(data),
      };

      // Create backup with retry logic
      const result = await withRetry(async () => {
        const { data: insertedData, error } = await supabase
          .from('backups')
          .insert([backupData])
          .select('id')
          .single();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return insertedData;
      }, 'Create backup');

      console.log(`Backup created successfully: ${result.id}`);
      
      // Apply retention policy asynchronously
      this.applyRetentionPolicy(userId).catch(error => {
        console.error('Error applying retention policy:', error);
      });

      return { success: true, backupId: result.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating backup:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async restoreBackup(backupId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!backupId) {
        throw new Error('Backup ID is required');
      }

      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('backups')
          .select('*')
          .eq('id', backupId)
          .single();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return data;
      }, 'Restore backup');

      if (!result) {
        throw new Error('Backup not found');
      }

      // Parse and validate data
      let parsedData;
      try {
        parsedData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      } catch (parseError) {
        throw new Error('Invalid backup data format');
      }

      // Verify checksum if available
      if (result.checksum) {
        const currentChecksum = await this.generateChecksum(parsedData);
        if (currentChecksum !== result.checksum) {
          console.warn('Backup checksum mismatch - data may be corrupted');
        }
      }

      console.log(`Backup restored successfully: ${backupId}`);
      return { success: true, data: parsedData };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error restoring backup:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async listBackups(userId: string, type?: BackupData['type']): Promise<{ success: boolean; backups?: BackupData[]; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      const result = await withRetry(async () => {
        let query = supabase
          .from('backups')
          .select('*')
          .eq('userId', userId)
          .order('createdAt', { ascending: false });

        if (type) {
          query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return data;
      }, 'List backups');

      return { success: true, backups: result || [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error listing backups:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async deleteBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!backupId) {
        throw new Error('Backup ID is required');
      }

      await withRetry(async () => {
        const { error } = await supabase
          .from('backups')
          .delete()
          .eq('id', backupId);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      }, 'Delete backup');

      console.log(`Backup deleted successfully: ${backupId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting backup:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async applyRetentionPolicy(userId: string): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Get all backups for user
      const { success, backups, error } = await this.listBackups(userId);
      if (!success || !backups) {
        throw new Error(error || 'Failed to list backups');
      }

      const now = new Date();
      const backupsToDelete: string[] = [];

      // Group backups by type and apply retention rules
      const groupedBackups = this.groupBackupsByPeriod(backups);

      // Apply daily retention
      if (groupedBackups.daily.length > this.retentionPolicy.dailyBackups) {
        const excessDaily = groupedBackups.daily.slice(this.retentionPolicy.dailyBackups);
        backupsToDelete.push(...excessDaily.map(b => b.id));
      }

      // Apply weekly retention
      if (groupedBackups.weekly.length > this.retentionPolicy.weeklyBackups) {
        const excessWeekly = groupedBackups.weekly.slice(this.retentionPolicy.weeklyBackups);
        backupsToDelete.push(...excessWeekly.map(b => b.id));
      }

      // Apply monthly retention
      if (groupedBackups.monthly.length > this.retentionPolicy.monthlyBackups) {
        const excessMonthly = groupedBackups.monthly.slice(this.retentionPolicy.monthlyBackups);
        backupsToDelete.push(...excessMonthly.map(b => b.id));
      }

      // Delete excess backups
      let deletedCount = 0;
      for (const backupId of backupsToDelete) {
        const result = await this.deleteBackup(backupId);
        if (result.success) {
          deletedCount++;
        }
      }

      console.log(`Retention policy applied: ${deletedCount} backups deleted`);
      return { success: true, deletedCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error applying retention policy:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private groupBackupsByPeriod(backups: BackupData[]): {
    daily: BackupData[];
    weekly: BackupData[];
    monthly: BackupData[];
  } {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      daily: backups.filter(b => new Date(b.createdAt) > oneDayAgo),
      weekly: backups.filter(b => {
        const date = new Date(b.createdAt);
        return date <= oneDayAgo && date > oneWeekAgo;
      }),
      monthly: backups.filter(b => {
        const date = new Date(b.createdAt);
        return date <= oneWeekAgo && date > oneMonthAgo;
      }),
    };
  }

  private async generateChecksum(data: any): Promise<string> {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        // Use Web Crypto API if available
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(dataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        // Fallback to simple hash for React Native
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
          const char = dataString.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
      }
    } catch (error) {
      console.error('Error generating checksum:', error);
      return 'checksum_error';
    }
  }

  async updateRetentionPolicy(policy: Partial<RetentionPolicy>): Promise<{ success: boolean; error?: string }> {
    try {
      this.retentionPolicy = { ...this.retentionPolicy, ...policy };
      await this.saveRetentionPolicy(this.retentionPolicy);
      console.log('Retention policy updated successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating retention policy:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }
}

// Create and export singleton instance
const backupService = new BackupService();
export default backupService;
