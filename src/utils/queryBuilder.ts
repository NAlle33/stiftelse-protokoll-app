/**
 * Centralized Supabase Query Builder - SÖKA Stiftelseappen
 * 
 * Konsoliderar Supabase-frågemönster från alla tjänster för att eliminera
 * kodduplicering och säkerställa konsistenta databasoperationer med
 * svenska felmeddelanden och GDPR-efterlevnad.
 * 
 * Del av Code Duplication Elimination-initiativet
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { handleError, ErrorCode } from './errorHandling';

/**
 * Konfiguration för frågebyggaren
 */
export interface QueryConfig {
  enableCache?: boolean;
  cacheTimeout?: number;
  enableRetry?: boolean;
  enableLogging?: boolean;
}

/**
 * Filter-alternativ för frågor
 */
export interface QueryFilters {
  eq?: Record<string, any>;
  neq?: Record<string, any>;
  gt?: Record<string, any>;
  gte?: Record<string, any>;
  lt?: Record<string, any>;
  lte?: Record<string, any>;
  like?: Record<string, any>;
  ilike?: Record<string, any>;
  in?: Record<string, any[]>;
  is?: Record<string, any>;
  or?: string;
  and?: string;
}

/**
 * Pagineringsalternativ
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Sorteringsalternativ
 */
export interface SortOptions {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

/**
 * Resultat från frågor med metadata
 */
export interface QueryResult<T> {
  data: T[];
  count?: number;
  error?: string;
  metadata?: {
    totalCount?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  };
}

/**
 * Huvudklass för Supabase-frågebyggning
 */
export class SupabaseQueryBuilder<T = any> {
  private supabase: SupabaseClient;
  private tableName: string;
  private selectColumns: string = '*';
  private filters: QueryFilters = {};
  private sorts: SortOptions[] = [];
  private pagination?: PaginationOptions;
  private joinTables: string[] = [];
  private config: QueryConfig;

  constructor(
    supabase: SupabaseClient,
    tableName: string,
    config: QueryConfig = {}
  ) {
    this.supabase = supabase;
    this.tableName = tableName;
    this.config = {
      enableCache: true,
      cacheTimeout: 300, // 5 minuter
      enableRetry: true,
      enableLogging: false,
      ...config,
    };
  }

  /**
   * Väljer kolumner att hämta
   */
  select(columns: string | string[]): this {
    if (Array.isArray(columns)) {
      this.selectColumns = columns.join(', ');
    } else {
      this.selectColumns = columns;
    }
    return this;
  }

  /**
   * Lägger till join med relaterade tabeller
   */
  join(relationQuery: string): this {
    this.joinTables.push(relationQuery);
    return this;
  }

  /**
   * Lägger till filter för frågan
   */
  filter(filters: QueryFilters): this {
    this.filters = { ...this.filters, ...filters };
    return this;
  }

  /**
   * Lägger till eq-filter (equals)
   */
  eq(column: string, value: any): this {
    if (!this.filters.eq) this.filters.eq = {};
    this.filters.eq[column] = value;
    return this;
  }

  /**
   * Lägger till ilike-filter (case-insensitive like)
   */
  ilike(column: string, pattern: string): this {
    if (!this.filters.ilike) this.filters.ilike = {};
    this.filters.ilike[column] = pattern;
    return this;
  }

  /**
   * Lägger till in-filter (value in array)
   */
  in(column: string, values: any[]): this {
    if (!this.filters.in) this.filters.in = {};
    this.filters.in[column] = values;
    return this;
  }

  /**
   * Lägger till or-filter
   */
  or(condition: string): this {
    this.filters.or = condition;
    return this;
  }

  /**
   * Lägger till sortering
   */
  orderBy(column: string, ascending: boolean = true, nullsFirst?: boolean): this {
    this.sorts.push({ column, ascending, nullsFirst });
    return this;
  }

  /**
   * Lägger till paginering
   */
  paginate(options: PaginationOptions): this {
    this.pagination = options;
    return this;
  }

  /**
   * Begränsar antal resultat
   */
  limit(count: number): this {
    if (!this.pagination) this.pagination = {};
    this.pagination.limit = count;
    return this;
  }

  /**
   * Sätter offset för resultat
   */
  offset(count: number): this {
    if (!this.pagination) this.pagination = {};
    this.pagination.offset = count;
    return this;
  }

  /**
   * Bygger och exekverar SELECT-frågan
   */
  async execute(options: { count?: boolean } = {}): Promise<QueryResult<T>> {
    try {
      // Bygg select-delen med joins
      let selectQuery = this.selectColumns;
      if (this.joinTables.length > 0) {
        selectQuery = `${this.selectColumns}, ${this.joinTables.join(', ')}`;
      }

      // Starta frågan
      let query = this.supabase
        .from(this.tableName)
        .select(selectQuery, { count: options.count ? 'exact' : undefined });

      // Tillämpa filter
      query = this.applyFilters(query);

      // Tillämpa sortering
      query = this.applySorting(query);

      // Tillämpa paginering
      query = this.applyPagination(query);

      // Exekvera frågan
      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Databasfel: ${error.message}`);
      }

      // Beräkna metadata för paginering
      const metadata = this.calculateMetadata(count);

      return {
        data: data || [],
        count,
        metadata,
      };
    } catch (error) {
      const serviceError = handleError(
        error as Error,
        `executeQuery.${this.tableName}`,
        'QueryBuilder'
      );
      
      return {
        data: [],
        error: serviceError.message,
      };
    }
  }

  /**
   * Exekverar en single-fråga (förväntar sig exakt ett resultat)
   */
  async single(): Promise<T | null> {
    try {
      const result = await this.execute();
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data.length === 0) {
        return null;
      }

      if (result.data.length > 1) {
        throw new Error('Frågan returnerade flera resultat när endast ett förväntades');
      }

      return result.data[0];
    } catch (error) {
      handleError(
        error as Error,
        `singleQuery.${this.tableName}`,
        'QueryBuilder'
      );
      return null;
    }
  }

  /**
   * Tillämpar filter på frågan
   */
  private applyFilters(query: any): any {
    // Eq filters
    if (this.filters.eq) {
      Object.entries(this.filters.eq).forEach(([column, value]) => {
        query = query.eq(column, value);
      });
    }

    // Neq filters
    if (this.filters.neq) {
      Object.entries(this.filters.neq).forEach(([column, value]) => {
        query = query.neq(column, value);
      });
    }

    // Ilike filters
    if (this.filters.ilike) {
      Object.entries(this.filters.ilike).forEach(([column, pattern]) => {
        query = query.ilike(column, pattern);
      });
    }

    // In filters
    if (this.filters.in) {
      Object.entries(this.filters.in).forEach(([column, values]) => {
        query = query.in(column, values);
      });
    }

    // Is filters
    if (this.filters.is) {
      Object.entries(this.filters.is).forEach(([column, value]) => {
        query = query.is(column, value);
      });
    }

    // Or filter
    if (this.filters.or) {
      query = query.or(this.filters.or);
    }

    return query;
  }

  /**
   * Tillämpar sortering på frågan
   */
  private applySorting(query: any): any {
    this.sorts.forEach(sort => {
      query = query.order(sort.column, {
        ascending: sort.ascending,
        nullsFirst: sort.nullsFirst,
      });
    });
    return query;
  }

  /**
   * Tillämpar paginering på frågan
   */
  private applyPagination(query: any): any {
    if (!this.pagination) return query;

    // Hantera page-baserad paginering
    if (this.pagination.page !== undefined && this.pagination.pageSize !== undefined) {
      const offset = (this.pagination.page - 1) * this.pagination.pageSize;
      const limit = this.pagination.pageSize;
      return query.range(offset, offset + limit - 1);
    }

    // Hantera offset/limit-baserad paginering
    if (this.pagination.offset !== undefined || this.pagination.limit !== undefined) {
      const offset = this.pagination.offset || 0;
      const limit = this.pagination.limit || 50;
      return query.range(offset, offset + limit - 1);
    }

    // Endast limit
    if (this.pagination.limit) {
      return query.limit(this.pagination.limit);
    }

    return query;
  }

  /**
   * Beräknar metadata för paginering
   */
  private calculateMetadata(totalCount?: number): any {
    if (!this.pagination || totalCount === undefined) {
      return undefined;
    }

    const metadata: any = { totalCount };

    if (this.pagination.page && this.pagination.pageSize) {
      metadata.page = this.pagination.page;
      metadata.pageSize = this.pagination.pageSize;
      metadata.hasMore = (this.pagination.page * this.pagination.pageSize) < totalCount;
    }

    return metadata;
  }
}

/**
 * Insert/Update/Delete Query Builder
 */
export class SupabaseMutationBuilder<T = any> {
  private supabase: SupabaseClient;
  private tableName: string;
  private config: QueryConfig;

  constructor(
    supabase: SupabaseClient,
    tableName: string,
    config: QueryConfig = {}
  ) {
    this.supabase = supabase;
    this.tableName = tableName;
    this.config = {
      enableRetry: true,
      enableLogging: false,
      ...config,
    };
  }

  /**
   * Infogar ny data
   */
  async insert(data: Partial<T> | Partial<T>[]): Promise<{ data: T[] | null; error?: string }> {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(data)
        .select();

      if (error) {
        throw new Error(`Kunde inte infoga data: ${error.message}`);
      }

      return { data: result };
    } catch (error) {
      const serviceError = handleError(
        error as Error,
        `insert.${this.tableName}`,
        'MutationBuilder'
      );

      return { data: null, error: serviceError.message };
    }
  }

  /**
   * Uppdaterar befintlig data
   */
  async update(
    data: Partial<T>,
    filters: QueryFilters
  ): Promise<{ data: T[] | null; error?: string }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .update(data);

      // Tillämpa filter för att specificera vilka rader som ska uppdateras
      query = this.applyFiltersToMutation(query, filters);

      const { data: result, error } = await query.select();

      if (error) {
        throw new Error(`Kunde inte uppdatera data: ${error.message}`);
      }

      return { data: result };
    } catch (error) {
      const serviceError = handleError(
        error as Error,
        `update.${this.tableName}`,
        'MutationBuilder'
      );

      return { data: null, error: serviceError.message };
    }
  }

  /**
   * Tar bort data
   */
  async delete(filters: QueryFilters): Promise<{ data: T[] | null; error?: string }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .delete();

      // Tillämpa filter för att specificera vilka rader som ska tas bort
      query = this.applyFiltersToMutation(query, filters);

      const { data: result, error } = await query.select();

      if (error) {
        throw new Error(`Kunde inte ta bort data: ${error.message}`);
      }

      return { data: result };
    } catch (error) {
      const serviceError = handleError(
        error as Error,
        `delete.${this.tableName}`,
        'MutationBuilder'
      );

      return { data: null, error: serviceError.message };
    }
  }

  /**
   * Upsert (insert eller update)
   */
  async upsert(
    data: Partial<T> | Partial<T>[],
    options: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  ): Promise<{ data: T[] | null; error?: string }> {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .upsert(data, options)
        .select();

      if (error) {
        throw new Error(`Kunde inte utföra upsert: ${error.message}`);
      }

      return { data: result };
    } catch (error) {
      const serviceError = handleError(
        error as Error,
        `upsert.${this.tableName}`,
        'MutationBuilder'
      );

      return { data: null, error: serviceError.message };
    }
  }

  /**
   * Tillämpar filter på mutation-frågor
   */
  private applyFiltersToMutation(query: any, filters: QueryFilters): any {
    // Eq filters
    if (filters.eq) {
      Object.entries(filters.eq).forEach(([column, value]) => {
        query = query.eq(column, value);
      });
    }

    // Neq filters
    if (filters.neq) {
      Object.entries(filters.neq).forEach(([column, value]) => {
        query = query.neq(column, value);
      });
    }

    // In filters
    if (filters.in) {
      Object.entries(filters.in).forEach(([column, values]) => {
        query = query.in(column, values);
      });
    }

    return query;
  }
}

/**
 * Fabriksfunktioner för enkel användning
 */

/**
 * Skapar en ny query builder för SELECT-operationer
 */
export function createQuery<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  config?: QueryConfig
): SupabaseQueryBuilder<T> {
  return new SupabaseQueryBuilder<T>(supabase, tableName, config);
}

/**
 * Skapar en ny mutation builder för INSERT/UPDATE/DELETE-operationer
 */
export function createMutation<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  config?: QueryConfig
): SupabaseMutationBuilder<T> {
  return new SupabaseMutationBuilder<T>(supabase, tableName, config);
}

/**
 * Hjälpfunktioner för vanliga frågemönster
 */

/**
 * Skapar en sökfråga med ilike på flera kolumner
 */
export function createSearchQuery<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  searchTerm: string,
  searchColumns: string[],
  config?: QueryConfig
): SupabaseQueryBuilder<T> {
  const orCondition = searchColumns
    .map(column => `${column}.ilike.%${searchTerm}%`)
    .join(',');

  return createQuery<T>(supabase, tableName, config).or(orCondition);
}

/**
 * Skapar en paginerad fråga med standardsortering
 */
export function createPaginatedQuery<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  page: number,
  pageSize: number,
  sortColumn: string = 'created_at',
  config?: QueryConfig
): SupabaseQueryBuilder<T> {
  return createQuery<T>(supabase, tableName, config)
    .paginate({ page, pageSize })
    .orderBy(sortColumn, false); // Senaste först som standard
}

/**
 * Skapar en fråga för aktiva poster (isActive = true)
 */
export function createActiveQuery<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  config?: QueryConfig
): SupabaseQueryBuilder<T> {
  return createQuery<T>(supabase, tableName, config).eq('isActive', true);
}
