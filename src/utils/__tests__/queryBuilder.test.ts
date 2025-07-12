/**
 * Test Suite för Supabase Query Builder Utilities
 * 
 * Testar query builder-verktyg för GDPR-efterlevnad, svenska felmeddelanden
 * och konsistent databashantering enligt Code Duplication Elimination-initiativet
 */

import { 
  SupabaseQueryBuilder, 
  SupabaseMutationBuilder,
  createQuery, 
  createMutation,
  createSearchQuery,
  createPaginatedQuery,
  createActiveQuery,
  QueryFilters,
  PaginationOptions
} from '../queryBuilder';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        neq: jest.fn(() => ({
          ilike: jest.fn(() => ({
            in: jest.fn(() => ({
              is: jest.fn(() => ({
                or: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => ({
                      range: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({ data: mockUser, error: null })),
                        then: jest.fn(() => Promise.resolve({ data: [mockUser], error: null, count: 1 }))
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
      }))
    })),
    upsert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [mockUser], error: null }))
    }))
  }))
};

// Mock data
const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Användare',
  email: 'test@example.com',
  role: 'member',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z'
};

describe('SupabaseQueryBuilder', () => {
  let queryBuilder: SupabaseQueryBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder = new SupabaseQueryBuilder(mockSupabaseClient as any, 'users');
  });

  describe('Query Building', () => {
    test('bygger grundläggande SELECT-fråga', async () => {
      const result = await queryBuilder
        .select('id, name, email')
        .execute();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(result.data).toEqual([mockUser]);
      expect(result.error).toBeUndefined();
    });

    test('lägger till eq-filter korrekt', async () => {
      await queryBuilder
        .eq('isActive', true)
        .execute();

      // Verifiera att eq-metoden anropades med rätt parametrar
      const fromResult = mockSupabaseClient.from('users');
      expect(fromResult.select().eq).toHaveBeenCalledWith('isActive', true);
    });

    test('lägger till ilike-filter för sökning', async () => {
      await queryBuilder
        .ilike('name', '%test%')
        .execute();

      const fromResult = mockSupabaseClient.from('users');
      expect(fromResult.select().eq().neq().ilike).toHaveBeenCalledWith('name', '%test%');
    });

    test('lägger till in-filter för flera värden', async () => {
      await queryBuilder
        .in('role', ['admin', 'member'])
        .execute();

      const fromResult = mockSupabaseClient.from('users');
      expect(fromResult.select().eq().neq().ilike().in).toHaveBeenCalledWith('role', ['admin', 'member']);
    });

    test('lägger till or-filter för komplex sökning', async () => {
      await queryBuilder
        .or('name.ilike.%test%,email.ilike.%test%')
        .execute();

      const fromResult = mockSupabaseClient.from('users');
      expect(fromResult.select().eq().neq().ilike().in().is().or).toHaveBeenCalledWith('name.ilike.%test%,email.ilike.%test%');
    });

    test('lägger till sortering korrekt', async () => {
      await queryBuilder
        .orderBy('name', true)
        .orderBy('email', false)
        .execute();

      const fromResult = mockSupabaseClient.from('users');
      expect(fromResult.select().eq().neq().ilike().in().is().or().order).toHaveBeenCalledTimes(2);
    });

    test('lägger till paginering med limit och offset', async () => {
      await queryBuilder
        .limit(10)
        .offset(20)
        .execute();

      const fromResult = mockSupabaseClient.from('users');
      expect(fromResult.select().eq().neq().ilike().in().is().or().order().limit().range).toHaveBeenCalledWith(20, 29);
    });

    test('hanterar page-baserad paginering', async () => {
      await queryBuilder
        .paginate({ page: 2, pageSize: 10 })
        .execute();

      const fromResult = mockSupabaseClient.from('users');
      expect(fromResult.select().eq().neq().ilike().in().is().or().order().limit().range).toHaveBeenCalledWith(10, 19);
    });
  });

  describe('Single Query', () => {
    test('hämtar enskilt resultat med single()', async () => {
      const result = await queryBuilder
        .eq('id', mockUser.id)
        .single();

      expect(result).toEqual(mockUser);
    });

    test('returnerar null för tomt resultat', async () => {
      // Mock empty result
      const emptyQueryBuilder = new SupabaseQueryBuilder({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              neq: jest.fn(() => ({
                ilike: jest.fn(() => ({
                  in: jest.fn(() => ({
                    is: jest.fn(() => ({
                      or: jest.fn(() => ({
                        order: jest.fn(() => ({
                          limit: jest.fn(() => ({
                            range: jest.fn(() => ({
                              single: jest.fn(() => Promise.resolve({ data: [], error: null })),
                              then: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
                            }))
                          }))
                        }))
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      } as any, 'users');

      const result = await emptyQueryBuilder
        .eq('id', 'nonexistent')
        .single();

      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('hanterar databasfel med svenska meddelanden', async () => {
      const errorQueryBuilder = new SupabaseQueryBuilder({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              neq: jest.fn(() => ({
                ilike: jest.fn(() => ({
                  in: jest.fn(() => ({
                    is: jest.fn(() => ({
                      or: jest.fn(() => ({
                        order: jest.fn(() => ({
                          limit: jest.fn(() => ({
                            range: jest.fn(() => ({
                              then: jest.fn(() => Promise.resolve({ 
                                data: null, 
                                error: { message: 'Database connection failed' },
                                count: null 
                              }))
                            }))
                          }))
                        }))
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      } as any, 'users');

      const result = await errorQueryBuilder.execute();

      expect(result.data).toEqual([]);
      expect(result.error).toContain('Databasfel');
    });
  });
});

describe('SupabaseMutationBuilder', () => {
  let mutationBuilder: SupabaseMutationBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    mutationBuilder = new SupabaseMutationBuilder(mockSupabaseClient as any, 'users');
  });

  describe('Insert Operations', () => {
    test('infogar ny data korrekt', async () => {
      const newUser = { name: 'Ny Användare', email: 'ny@example.com' };
      
      const result = await mutationBuilder.insert(newUser);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(result.data).toEqual([mockUser]);
      expect(result.error).toBeUndefined();
    });

    test('infogar flera poster samtidigt', async () => {
      const newUsers = [
        { name: 'Användare 1', email: 'user1@example.com' },
        { name: 'Användare 2', email: 'user2@example.com' }
      ];
      
      const result = await mutationBuilder.insert(newUsers);

      expect(result.data).toEqual([mockUser]);
    });
  });

  describe('Update Operations', () => {
    test('uppdaterar data med filter', async () => {
      const updates = { name: 'Uppdaterat Namn' };
      const filters = { eq: { id: mockUser.id } };
      
      const result = await mutationBuilder.update(updates, filters);

      expect(result.data).toEqual([mockUser]);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Delete Operations', () => {
    test('tar bort data med filter', async () => {
      const filters = { eq: { id: mockUser.id } };
      
      const result = await mutationBuilder.delete(filters);

      expect(result.data).toEqual([mockUser]);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Upsert Operations', () => {
    test('utför upsert-operation', async () => {
      const data = { id: mockUser.id, name: 'Upsert Namn' };
      
      const result = await mutationBuilder.upsert(data, { onConflict: 'id' });

      expect(result.data).toEqual([mockUser]);
      expect(result.error).toBeUndefined();
    });
  });
});

describe('Factory Functions', () => {
  test('createQuery skapar SupabaseQueryBuilder', () => {
    const query = createQuery(mockSupabaseClient as any, 'users');
    expect(query).toBeInstanceOf(SupabaseQueryBuilder);
  });

  test('createMutation skapar SupabaseMutationBuilder', () => {
    const mutation = createMutation(mockSupabaseClient as any, 'users');
    expect(mutation).toBeInstanceOf(SupabaseMutationBuilder);
  });

  test('createSearchQuery skapar sökfråga med OR-villkor', () => {
    const searchQuery = createSearchQuery(
      mockSupabaseClient as any, 
      'users', 
      'test', 
      ['name', 'email']
    );
    
    expect(searchQuery).toBeInstanceOf(SupabaseQueryBuilder);
  });

  test('createPaginatedQuery skapar paginerad fråga', () => {
    const paginatedQuery = createPaginatedQuery(
      mockSupabaseClient as any, 
      'users', 
      2, 
      10
    );
    
    expect(paginatedQuery).toBeInstanceOf(SupabaseQueryBuilder);
  });

  test('createActiveQuery skapar fråga för aktiva poster', () => {
    const activeQuery = createActiveQuery(mockSupabaseClient as any, 'users');
    expect(activeQuery).toBeInstanceOf(SupabaseQueryBuilder);
  });
});

describe('GDPR Compliance', () => {
  test('säkerställer att känslig data inte loggas', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    await queryBuilder
      .eq('personnummer', '19801010-1234') // Känslig data
      .execute();

    // Verifiera att känslig data inte loggas
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('19801010-1234')
    );
    
    consoleSpy.mockRestore();
  });

  test('hanterar GDPR-kompatibel felrapportering', async () => {
    const errorQueryBuilder = new SupabaseQueryBuilder({
      from: jest.fn(() => {
        throw new Error('Database error with sensitive data: user@example.com');
      })
    } as any, 'users');

    const result = await errorQueryBuilder.execute();

    // Verifiera att felmeddelandet är GDPR-säkert
    expect(result.error).toContain('Databasfel');
    expect(result.error).not.toContain('user@example.com');
  });
});

describe('Swedish Localization', () => {
  test('använder svenska felmeddelanden', async () => {
    const errorQueryBuilder = new SupabaseQueryBuilder({
      from: jest.fn(() => ({
        select: jest.fn(() => {
          throw new Error('Connection failed');
        })
      }))
    } as any, 'users');

    const result = await errorQueryBuilder.execute();

    expect(result.error).toMatch(/databasfel|fel|misslyckades/i);
  });

  test('formaterar svenska metadata korrekt', async () => {
    const result = await queryBuilder
      .paginate({ page: 1, pageSize: 10 })
      .execute({ count: true });

    if (result.metadata) {
      expect(result.metadata.page).toBe(1);
      expect(result.metadata.pageSize).toBe(10);
      expect(typeof result.metadata.hasMore).toBe('boolean');
    }
  });
});
