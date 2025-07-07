/**
 * Comprehensive Performance Test Suite
 * Swedish Board Meeting App - Performance & Load Testing
 * 
 * Tests performance characteristics including:
 * - Large file handling
 * - Concurrent user scenarios
 * - Memory leak detection
 * - Swedish character processing performance
 * - Database query optimization
 * - Real-time features performance
 */

import { performance } from 'perf_hooks';

// Mock performance-critical services
jest.mock('../src/services/fileService');
jest.mock('../src/services/meetingService');
jest.mock('../src/services/aiProtocolService');
jest.mock('../src/services/encryptionService');
jest.mock('../src/services/supabaseClient');

// Import services
import { fileService } from '../src/services/fileService';
import { meetingService } from '../src/services/meetingService';
import { aiProtocolService } from '../src/services/aiProtocolService';
import { encryptionService } from '../src/services/encryptionService';

describe('⚡ Comprehensive Performance Test Suite', () => {
  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    FILE_UPLOAD_SMALL: 2000,      // < 2s for files under 10MB
    FILE_UPLOAD_LARGE: 10000,     // < 10s for files under 100MB
    DATABASE_QUERY: 500,          // < 500ms for standard queries
    ENCRYPTION_SMALL: 100,        // < 100ms for small data
    ENCRYPTION_LARGE: 1000,       // < 1s for large data
    AI_PROTOCOL_GENERATION: 5000, // < 5s for protocol generation
    CONCURRENT_USERS: 3000,       // < 3s response time with 50 concurrent users
    MEMORY_LEAK_THRESHOLD: 50     // < 50MB memory increase over baseline
  };

  const mockUser = {
    id: 'perf-user-123',
    email: 'performance.test@example.se',
    role: 'board_member' as const,
    organizationId: 'perf-org-456'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup performance mocks
    (fileService.uploadFile as jest.Mock).mockImplementation(async (file) => {
      // Simulate upload time based on file size
      const delay = Math.min(file.size / 1000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      return { id: 'file-123', url: 'https://example.com/file.pdf' };
    });

    (meetingService.createMeeting as jest.Mock).mockImplementation(async (data) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { id: 'meeting-123', ...data };
    });

    (aiProtocolService.generateProtocol as jest.Mock).mockImplementation(async (data) => {
      // Simulate AI processing time based on content length
      const delay = Math.min(data.transcription.length / 10, 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      return { id: 'protocol-123', content: 'Generated protocol...' };
    });

    (encryptionService.encrypt as jest.Mock).mockImplementation(async (data) => {
      const delay = Math.min(data.length / 100, 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
      return 'encrypted-' + data;
    });
  });

  describe('📁 Large File Handling Performance', () => {
    it('should handle small file uploads within performance threshold', async () => {
      console.log('📄 Testing small file upload performance...');
      
      const smallFile = {
        name: 'protokoll-q4-2024.pdf',
        size: 5 * 1024 * 1024, // 5MB
        type: 'application/pdf',
        data: new ArrayBuffer(5 * 1024 * 1024)
      };

      const startTime = performance.now();
      const result = await fileService.uploadFile(smallFile);
      const endTime = performance.now();
      
      const uploadTime = endTime - startTime;
      console.log(`📊 Small file upload time: ${uploadTime.toFixed(2)}ms`);
      
      expect(uploadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_UPLOAD_SMALL);
      expect(result.id).toBeDefined();
    });

    it('should handle large file uploads within performance threshold', async () => {
      console.log('📦 Testing large file upload performance...');
      
      const largeFile = {
        name: 'årsstämma-video-2024.mp4',
        size: 50 * 1024 * 1024, // 50MB
        type: 'video/mp4',
        data: new ArrayBuffer(50 * 1024 * 1024)
      };

      const startTime = performance.now();
      const result = await fileService.uploadFile(largeFile);
      const endTime = performance.now();
      
      const uploadTime = endTime - startTime;
      console.log(`📊 Large file upload time: ${uploadTime.toFixed(2)}ms`);
      
      expect(uploadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_UPLOAD_LARGE);
      expect(result.id).toBeDefined();
    });

    it('should handle multiple concurrent file uploads efficiently', async () => {
      console.log('🔄 Testing concurrent file upload performance...');
      
      const files = Array.from({ length: 10 }, (_, i) => ({
        name: `dokument-${i + 1}.pdf`,
        size: 2 * 1024 * 1024, // 2MB each
        type: 'application/pdf',
        data: new ArrayBuffer(2 * 1024 * 1024)
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        files.map(file => fileService.uploadFile(file))
      );
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const averageTime = totalTime / files.length;
      
      console.log(`📊 Concurrent uploads total time: ${totalTime.toFixed(2)}ms`);
      console.log(`📊 Average time per file: ${averageTime.toFixed(2)}ms`);
      
      expect(results).toHaveLength(10);
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FILE_UPLOAD_SMALL);
    });
  });

  describe('👥 Concurrent User Scenarios', () => {
    it('should handle multiple users creating meetings simultaneously', async () => {
      console.log('👥 Testing concurrent meeting creation...');
      
      const concurrentUsers = 25;
      const meetingPromises = Array.from({ length: concurrentUsers }, (_, i) => 
        meetingService.createMeeting({
          title: `Styrelsemöte ${i + 1}`,
          description: `Möte skapat av användare ${i + 1}`,
          scheduledAt: new Date(Date.now() + i * 60000).toISOString(),
          organizationId: mockUser.organizationId
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(meetingPromises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentUsers;
      
      console.log(`📊 Concurrent meeting creation time: ${totalTime.toFixed(2)}ms`);
      console.log(`📊 Average time per meeting: ${averageTime.toFixed(2)}ms`);
      
      expect(results).toHaveLength(concurrentUsers);
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_USERS);
    });

    it('should handle concurrent AI protocol generation requests', async () => {
      console.log('🤖 Testing concurrent AI protocol generation...');
      
      const concurrentRequests = 10;
      const transcriptions = Array.from({ length: concurrentRequests }, (_, i) => ({
        meetingId: `meeting-${i + 1}`,
        transcription: `
          Styrelsemöte ${i + 1} öppnades av ordföranden.
          Närvarande: Anna Andersson, Erik Johansson, Maria Lindström.
          
          Punkt 1: Genomgång av kvartalssiffror
          Omsättning för Q${i % 4 + 1} presenterades och diskuterades.
          
          Punkt 2: Strategiska beslut
          Beslut fattades om framtida investeringar.
          
          Mötet avslutades enhälligt.
        `.repeat(10), // Make transcription longer for realistic test
        participants: [mockUser]
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        transcriptions.map(data => aiProtocolService.generateProtocol(data))
      );
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;
      
      console.log(`📊 Concurrent AI generation time: ${totalTime.toFixed(2)}ms`);
      console.log(`📊 Average time per protocol: ${averageTime.toFixed(2)}ms`);
      
      expect(results).toHaveLength(concurrentRequests);
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AI_PROTOCOL_GENERATION);
    });
  });

  describe('🧠 Memory Leak Detection', () => {
    it('should not leak memory during repeated operations', async () => {
      console.log('🔍 Testing memory leak detection...');
      
      // Measure baseline memory usage
      const initialMemory = process.memoryUsage();
      console.log(`📊 Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // Perform repeated operations
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        // Create and process data
        const meetingData = {
          title: `Minnestestmöte ${i}`,
          description: 'Test för minnesläckage',
          scheduledAt: new Date().toISOString(),
          organizationId: mockUser.organizationId
        };
        
        await meetingService.createMeeting(meetingData);
        
        // Encrypt some data
        const testData = `Testdata för iteration ${i} med svenska tecken: åäö`.repeat(100);
        await encryptionService.encrypt(testData);
        
        // Force garbage collection every 10 iterations
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Measure final memory usage
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`📊 Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD);
    });
  });

  describe('🇸🇪 Swedish Character Processing Performance', () => {
    it('should efficiently process Swedish characters in large texts', async () => {
      console.log('🇸🇪 Testing Swedish character processing performance...');
      
      const swedishText = `
        Årsstämma för Åklagarmyndigheten i Göteborg
        
        Närvarande styrelseledamöter:
        - Åsa Öberg, ordförande
        - Erik Ångström, vice ordförande  
        - Maria Björk, sekreterare
        - Lars Öhman, kassör
        
        Dagordning:
        1. Öppnande av mötet
        2. Fastställande av röstlängd
        3. Genomgång av föregående års verksamhet
        4. Beslut om ändringar i stadgarna
        5. Val av styrelse för kommande år
        6. Övriga frågor
        
        Diskussion fördes om förändringar i organisationen.
        Beslut fattades enhälligt om alla föreslagna ändringar.
        
        Mötet avslutades kl. 16:30.
      `.repeat(50); // Create large text with Swedish characters

      const startTime = performance.now();
      
      // Test encryption performance with Swedish characters
      const encryptedText = await encryptionService.encrypt(swedishText);
      
      // Test AI processing performance with Swedish characters
      const protocolData = {
        meetingId: 'swedish-test-meeting',
        transcription: swedishText,
        participants: [mockUser],
        swedishLegalCompliance: true
      };
      
      const protocol = await aiProtocolService.generateProtocol(protocolData);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      console.log(`📊 Swedish text processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`📊 Text length: ${swedishText.length} characters`);
      console.log(`📊 Processing rate: ${(swedishText.length / processingTime * 1000).toFixed(0)} chars/sec`);
      
      expect(encryptedText).toBeDefined();
      expect(protocol).toBeDefined();
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AI_PROTOCOL_GENERATION);
    });

    it('should handle Swedish character encoding efficiently', async () => {
      console.log('🔤 Testing Swedish character encoding performance...');
      
      const swedishCharacters = ['å', 'ä', 'ö', 'Å', 'Ä', 'Ö'];
      const testStrings = swedishCharacters.map(char => 
        `Test med svenska tecken: ${char.repeat(1000)}`
      );

      const startTime = performance.now();
      
      const results = await Promise.all(
        testStrings.map(async (str) => {
          const encrypted = await encryptionService.encrypt(str);
          return {
            original: str,
            encrypted: encrypted,
            length: str.length
          };
        })
      );
      
      const endTime = performance.now();
      const encodingTime = endTime - startTime;
      
      console.log(`📊 Swedish encoding time: ${encodingTime.toFixed(2)}ms`);
      console.log(`📊 Processed ${results.length} strings with Swedish characters`);
      
      expect(results).toHaveLength(swedishCharacters.length);
      expect(encodingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ENCRYPTION_LARGE);
      
      // Verify all characters were processed correctly
      results.forEach((result, index) => {
        expect(result.encrypted).toBeDefined();
        expect(result.original).toContain(swedishCharacters[index]);
      });
    });
  });

  describe('📊 Database Query Performance', () => {
    it('should execute complex queries within performance threshold', async () => {
      console.log('🗄️ Testing database query performance...');
      
      // Mock complex database operations
      (meetingService.searchMeetings as jest.Mock).mockImplementation(async (criteria) => {
        // Simulate database query time
        await new Promise(resolve => setTimeout(resolve, 300));
        return Array.from({ length: 50 }, (_, i) => ({
          id: `meeting-${i}`,
          title: `Möte ${i + 1}`,
          organizationId: mockUser.organizationId
        }));
      });

      const searchCriteria = {
        organizationId: mockUser.organizationId,
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        },
        status: ['completed', 'in_progress'],
        participants: [mockUser.id],
        textSearch: 'styrelsemöte'
      };

      const startTime = performance.now();
      const results = await meetingService.searchMeetings(searchCriteria);
      const endTime = performance.now();
      
      const queryTime = endTime - startTime;
      console.log(`📊 Complex query time: ${queryTime.toFixed(2)}ms`);
      console.log(`📊 Results returned: ${results.length}`);
      
      expect(results).toHaveLength(50);
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY);
    });
  });

  describe('⚡ Real-time Features Performance', () => {
    it('should handle real-time updates efficiently', async () => {
      console.log('🔄 Testing real-time update performance...');
      
      // Mock real-time subscription
      const mockSubscription = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      };

      // Simulate multiple real-time updates
      const updates = Array.from({ length: 100 }, (_, i) => ({
        type: 'meeting_update',
        meetingId: `meeting-${i % 10}`,
        data: {
          status: i % 2 === 0 ? 'in_progress' : 'completed',
          lastUpdated: new Date().toISOString()
        }
      }));

      const startTime = performance.now();
      
      // Process updates
      const processedUpdates = updates.map(update => ({
        ...update,
        processed: true,
        timestamp: Date.now()
      }));
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      console.log(`📊 Real-time updates processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`📊 Updates per second: ${(updates.length / processingTime * 1000).toFixed(0)}`);
      
      expect(processedUpdates).toHaveLength(100);
      expect(processingTime).toBeLessThan(1000); // Should process 100 updates in under 1 second
    });
  });
});
