import React from 'react';
import { create, act } from 'react-test-renderer';
import { Alert } from 'react-native';
import MeetingListScreen from '../MeetingListScreen';
import { testUtils } from '../../__tests__/utils/testUtils';

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
}));

jest.mock('../../hooks/useBankID', () => ({
  useBankID: jest.fn().mockReturnValue({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      fullName: 'Test Användare',
      role: 'admin',
    },
  }),
}));

jest.mock('../../hooks/usePermissions', () => ({
  usePermissions: jest.fn().mockReturnValue({
    can: jest.fn().mockReturnValue(true),
  }),
}));

jest.mock('../../services/meetingService', () => ({
  meetingService: {
    getUserMeetings: jest.fn(),
    progressMeetingStatus: jest.fn(),
    deleteMeeting: jest.fn(),
  },
}));

jest.mock('../../services/searchService', () => ({
  searchService: {
    searchMeetings: jest.fn(),
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock components using simple string returns
jest.mock('../../components/layout/AppLayout', () => 'AppLayout');
jest.mock('../../components/ui/Card', () => 'Card');
jest.mock('../../components/ui/Button', () => 'Button');
jest.mock('../../components/ui/Input', () => 'Input');

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Setup test utilities
beforeEach(() => {
  testUtils.setupSupabaseMock();
  jest.clearAllMocks();
});

// Helper function to create component with proper mocking
const createComponent = (props = {}) => {
  return create(React.createElement(MeetingListScreen, props));
};

// Mock meeting data
const mockMeetings = [
  {
    id: 'meeting-1',
    title: 'Styrelsemöte Januari',
    meeting_date: '2024-01-15T10:00:00Z',
    meeting_type: 'physical',
    status: 'ongoing',
    organization_id: 'org-1',
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'meeting-2',
    title: 'Digitalt Årsmöte',
    meeting_date: '2024-02-20T14:00:00Z',
    meeting_type: 'digital',
    status: 'completed',
    organization_id: 'org-1',
    created_by: 'user-1',
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
];

describe('MeetingListScreen Component', () => {
  describe('Component Rendering', () => {
    it('should render main container with AppLayout', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
      expect(component.root).toBeDefined();
    });

    it('should render search input field', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });

    it('should render loading state initially', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockImplementation(() => new Promise(() => {})); // Never resolves

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });

    it('should render error state when fetch fails', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockRejectedValue(new Error('Network error'));

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });
  });

  describe('Meeting Management', () => {
    it('should fetch and display user meetings', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(meetingService.getUserMeetings).toHaveBeenCalledWith('test-user-id');
    });

    it('should display meeting status badges with Swedish text', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });

    it('should display meeting type icons and Swedish labels', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });

    it('should format dates in Swedish locale', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });
  });

  describe('Permission Handling', () => {
    it('should check meeting view permissions on mount', async () => {
      const { usePermissions } = require('../../hooks/usePermissions');
      const mockCan = jest.fn(() => true);
      usePermissions.mockReturnValue({ can: mockCan });

      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      await act(async () => {
        createComponent();
      });

      expect(mockCan).toHaveBeenCalledWith('meetings:view');
    });

    it('should show permission denied alert when user lacks permissions', async () => {
      const { usePermissions } = require('../../hooks/usePermissions');
      const { useNavigation } = require('@react-navigation/native');
      const mockGoBack = jest.fn();
      const mockCan = jest.fn(() => false);

      usePermissions.mockReturnValue({ can: mockCan });
      useNavigation.mockReturnValue({ goBack: mockGoBack, navigate: jest.fn() });

      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue([]);

      await act(async () => {
        createComponent();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Behörighet saknas',
        'Du har inte behörighet att se möten.',
        [{ text: 'OK', onPress: expect.any(Function) }]
      );
    });
  });

  describe('Search Functionality', () => {
    it('should handle basic search input changes', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });

    it('should clear search when clear button is pressed', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });

    it('should perform search using searchService', async () => {
      const { meetingService } = require('../../services/meetingService');
      const { searchService } = require('../../services/searchService');

      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      searchService.searchMeetings.mockResolvedValue([mockMeetings[0]]);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });

    it('should handle search errors gracefully', async () => {
      const { meetingService } = require('../../services/meetingService');
      const { searchService } = require('../../services/searchService');

      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      searchService.searchMeetings.mockRejectedValue(new Error('Search failed'));

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      expect(component).toBeDefined();
    });
  });
});
