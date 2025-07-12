import { supabase, withRetry } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface User {
  id: string;
  email: string;
  name?: string;
  organizationId?: string;
  role: 'admin' | 'member' | 'viewer';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    title?: string;
    department?: string;
  };
}

interface Organization {
  id: string;
  name: string;
  type: 'stiftelse' | 'förening' | 'aktiebolag' | 'annat';
  orgNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserFetchOptions {
  includeInactive?: boolean;
  role?: User['role'];
  organizationId?: string;
  limit?: number;
  offset?: number;
}

class UserService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      // Clear expired cache entries
      this.clearExpiredCache();
      this.isInitialized = true;
      console.log('UserService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize UserService:', error);
      this.isInitialized = true; // Continue with limited functionality
    }
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(operation: string, params: any = {}): string {
    return `${operation}_${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getCurrentUser(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const cacheKey = this.getCacheKey('currentUser');
      const cached = this.getFromCache<User>(cacheKey);
      if (cached) {
        return { success: true, user: cached };
      }

      const result = await withRetry(async () => {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          throw new Error(`Authentication error: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error('No authenticated user found');
        }

        // Fetch user profile data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select(`
            *,
            organizations (
              id,
              name,
              type
            )
          `)
          .eq('id', authData.user.id)
          .single();

        if (userError) {
          throw new Error(`User data error: ${userError.message}`);
        }

        return userData;
      }, 'Get current user');

      this.setCache(cacheKey, result);
      return { success: true, user: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching current user:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async fetchUsers(options: UserFetchOptions = {}): Promise<{ success: boolean; users?: User[]; total?: number; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const cacheKey = this.getCacheKey('fetchUsers', options);
      const cached = this.getFromCache<{ users: User[]; total: number }>(cacheKey);
      if (cached) {
        return { success: true, users: cached.users, total: cached.total };
      }

      const result = await withRetry(async () => {
        let query = supabase
          .from('users')
          .select(`
            *,
            organizations (
              id,
              name,
              type
            )
          `, { count: 'exact' });

        // Apply filters
        if (!options.includeInactive) {
          query = query.eq('isActive', true);
        }

        if (options.role) {
          query = query.eq('role', options.role);
        }

        if (options.organizationId) {
          query = query.eq('organizationId', options.organizationId);
        }

        // Apply pagination
        if (options.limit) {
          query = query.limit(options.limit);
        }

        if (options.offset) {
          query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
        }

        // Order by name or email
        query = query.order('name', { ascending: true, nullsFirst: false })
                     .order('email', { ascending: true });

        const { data, error, count } = await query;

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return { users: data || [], total: count || 0 };
      }, 'Fetch users');

      this.setCache(cacheKey, result);
      return { success: true, users: result.users, total: result.total };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching users:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async fetchOrganizationUsers(organizationId: string, options: Omit<UserFetchOptions, 'organizationId') = {}): Promise<{ success: boolean; users?: User[]; total?: number; error?: string }> {
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      return await this.fetchUsers({ ...options, organizationId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching organization users:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async getUserById(userId: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      const cacheKey = this.getCacheKey('getUserById', { userId });
      const cached = this.getFromCache<User>(cacheKey);
      if (cached) {
        return { success: true, user: cached };
      }

      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('users')
          .select(`
            *,
            organizations (
              id,
              name,
              type
            )
          `)
          .eq('id', userId)
          .single();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return data;
      }, 'Get user by ID');

      this.setCache(cacheKey, result);
      return { success: true, user: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching user by ID:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Remove read-only fields
      const { id, createdAt, ...allowedUpdates } = updates;

      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('users')
          .update({
            ...allowedUpdates,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return data;
      }, 'Update user');

      // Clear related cache entries
      this.clearUserCache(userId);

      return { success: true, user: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating user:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async updateUserLastLogin(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      await withRetry(async () => {
        const { error } = await supabase
          .from('users')
          .update({ lastLoginAt: new Date().toISOString() })
          .eq('id', userId);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      }, 'Update user last login');

      // Clear related cache entries
      this.clearUserCache(userId);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating user last login:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async searchUsers(query: string, options: UserFetchOptions = {}): Promise<{ success: boolean; users?: User[]; error?: string }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!query || query.trim().length < 2) {
        return { success: true, users: [] };
      }

      const searchTerm = query.trim().toLowerCase();
      const cacheKey = this.getCacheKey('searchUsers', { query: searchTerm, ...options });
      const cached = this.getFromCache<User[]>(cacheKey);
      if (cached) {
        return { success: true, users: cached };
      }

      const result = await withRetry(async () => {
        let baseQuery = supabase
          .from('users')
          .select(`
            *,
            organizations (
              id,
              name,
              type
            )
          `);

        // Apply filters
        if (!options.includeInactive) {
          baseQuery = baseQuery.eq('isActive', true);
        }

        if (options.role) {
          baseQuery = baseQuery.eq('role', options.role);
        }

        if (options.organizationId) {
          baseQuery = baseQuery.eq('organizationId', options.organizationId);
        }

        // Apply search filters
        const { data, error } = await baseQuery
          .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
          .order('name', { ascending: true })
          .limit(options.limit || 50);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return data || [];
      }, 'Search users');

      this.setCache(cacheKey, result);
      return { success: true, users: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error searching users:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private clearUserCache(userId?: string): void {
    if (userId) {
      // Clear specific user cache entries
      for (const key of this.cache.keys()) {
        if (key.includes(userId) || key.includes('fetchUsers') || key.includes('currentUser')) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all user-related cache
      this.cache.clear();
    }
  }

  clearCache(): void {
    this.cache.clear();
    console.log('UserService cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Create and export singleton instance
const userService = new UserService();
export default userService;
export type { User, Organization, UserFetchOptions };
