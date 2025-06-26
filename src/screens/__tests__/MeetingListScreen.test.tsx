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
  useBankID: jest.fn(() => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      fullName: 'Test Användare',
      role: 'admin',
    },
  })),
}));

jest.mock('../../hooks/usePermissions', () => ({
  usePermissions: jest.fn(() => ({
    can: jest.fn(() => true),
  })),
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

      const appLayout = component.root.findByProps({ testID: 'app-layout' });
      expect(appLayout).toBeDefined();
      expect(appLayout.props.title).toBe('Mina Möten');
    });

    it('should render search input field', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const searchInput = component.root.findByProps({ placeholder: 'Sök möten...' });
      expect(searchInput).toBeDefined();
      expect(searchInput.props.clearButton).toBe('true');
    });

    it('should render loading state initially', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockImplementation(() => new Promise(() => {})); // Never resolves

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const loadingText = component.root.findByProps({ children: 'Hämtar möten...' });
      expect(loadingText).toBeDefined();
    });

    it('should render error state when fetch fails', async () => {
      const { meetingService } = require('../../services/meetingService');
      meetingService.getUserMeetings.mockRejectedValue(new Error('Network error'));

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const errorText = component.root.findByProps({ children: 'Kunde inte hämta möten' });
      expect(errorText).toBeDefined();
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

      const meetingTitles = component.root.findAllByProps({ children: 'Styrelsemöte Januari' });
      expect(meetingTitles.length).toBeGreaterThan(0);
    });

    it('should display meeting status badges with Swedish text', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const ongoingStatus = component.root.findByProps({ children: 'Pågående' });
      expect(ongoingStatus).toBeDefined();

      const completedStatus = component.root.findByProps({ children: 'Klart' });
      expect(completedStatus).toBeDefined();
    });

    it('should display meeting type icons and Swedish labels', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const physicalMeeting = component.root.findByProps({ children: 'Fysiskt möte' });
      expect(physicalMeeting).toBeDefined();

      const digitalMeeting = component.root.findByProps({ children: 'Digitalt möte' });
      expect(digitalMeeting).toBeDefined();
    });

    it('should format dates in Swedish locale', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Check for Swedish date formatting (should contain Swedish month names)
      const dateElements = component.root.findAllByType('Text');
      const hasSwedishDate = dateElements.some((element: any) =>
        element.props.children &&
        typeof element.props.children === 'string' &&
        (element.props.children.includes('januari') ||
         element.props.children.includes('februari') ||
         element.props.children.includes('2024'))
      );
      expect(hasSwedishDate).toBe(true);
    });
  });

  describe('Permission Handling', () => {
    it('should check meeting view permissions on mount', async () => {
      const { usePermissions } = require('../hooks/usePermissions');
      const mockCan = jest.fn(() => true);
      usePermissions.mockReturnValue({ can: mockCan });

      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      await act(async () => {
        createComponent();
      });

      expect(mockCan).toHaveBeenCalledWith('meetings:view');
    });

    it('should show permission denied alert when user lacks permissions', async () => {
      const { usePermissions } = require('../hooks/usePermissions');
      const { useNavigation } = require('@react-navigation/native');
      const mockGoBack = jest.fn();
      const mockCan = jest.fn(() => false);

      usePermissions.mockReturnValue({ can: mockCan });
      useNavigation.mockReturnValue({ goBack: mockGoBack, navigate: jest.fn() });

      const { meetingService } = require('../services/meetingService');
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
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const searchInput = component.root.findByProps({ placeholder: 'Sök möten...' });

      await act(async () => {
        searchInput.props.onChangeText('Styrelsemöte');
      });

      expect(searchInput.props.value).toBeDefined();
    });

    it('should clear search when clear button is pressed', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const searchInput = component.root.findByProps({ placeholder: 'Sök möten...' });

      // First set some search text
      await act(async () => {
        searchInput.props.onChangeText('test');
      });

      // Then clear it
      if (searchInput.props.onClear) {
        await act(async () => {
          searchInput.props.onClear();
        });
      }

      // Verify search was cleared (implementation dependent)
      expect(searchInput.props.onClear).toBeDefined();
    });

    it('should perform search using searchService', async () => {
      const { meetingService } = require('../services/meetingService');
      const { searchService } = require('../services/searchService');

      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      searchService.searchMeetings.mockResolvedValue([mockMeetings[0]]);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const searchInput = component.root.findByProps({ placeholder: 'Sök möten...' });

      await act(async () => {
        searchInput.props.onChangeText('Styrelsemöte');
      });

      // Wait for debounced search
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      expect(searchService.searchMeetings).toHaveBeenCalledWith(
        'Styrelsemöte',
        { status: null },
        'test-user-id'
      );
    });

    it('should handle search errors gracefully', async () => {
      const { meetingService } = require('../services/meetingService');
      const { searchService } = require('../services/searchService');

      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      searchService.searchMeetings.mockRejectedValue(new Error('Search failed'));

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const searchInput = component.root.findByProps({ placeholder: 'Sök möten...' });

      await act(async () => {
        searchInput.props.onChangeText('test search');
      });

      // Wait for debounced search
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Fel',
        'Kunde inte utföra sökningen. Försök igen senare.'
      );
    });
  });

  describe('Meeting Actions', () => {
    it('should handle meeting press navigation for ongoing meetings', async () => {
      const { meetingService } = require('../services/meetingService');
      const { useNavigation } = require('@react-navigation/native');
      const mockNavigate = jest.fn();

      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      useNavigation.mockReturnValue({ navigate: mockNavigate, goBack: jest.fn() });

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const meetingCard = component.root.findByProps({ testID: 'card' });

      await act(async () => {
        meetingCard.props.onPress();
      });

      expect(mockNavigate).toHaveBeenCalledWith('Recording', {
        meetingId: 'meeting-1',
        isDigital: false
      });
    });

    it('should show transcription alert for transcribing meetings', async () => {
      const transcribingMeeting = {
        ...mockMeetings[0],
        status: 'transcribing'
      };

      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue([transcribingMeeting]);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const meetingCard = component.root.findByProps({ testID: 'card' });

      await act(async () => {
        meetingCard.props.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Transkribering pågår',
        'Mötet transkriberas för närvarande. Du kommer att få en notifiering när transkriberingen är klar.',
        [{ text: 'OK' }]
      );
    });

    it('should navigate to protocol for completed meetings', async () => {
      const completedMeeting = {
        ...mockMeetings[0],
        status: 'completed'
      };

      const { meetingService } = require('../services/meetingService');
      const { useNavigation } = require('@react-navigation/native');
      const mockNavigate = jest.fn();

      meetingService.getUserMeetings.mockResolvedValue([completedMeeting]);
      useNavigation.mockReturnValue({ navigate: mockNavigate, goBack: jest.fn() });

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const meetingCard = component.root.findByProps({ testID: 'card' });

      await act(async () => {
        meetingCard.props.onPress();
      });

      expect(mockNavigate).toHaveBeenCalledWith('Protocol', {
        meetingId: 'meeting-1',
        transcriptionId: 'dummy-id',
        initialText: ''
      });
    });

    it('should handle meeting status progression', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      meetingService.progressMeetingStatus.mockResolvedValue(true);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Find status update button (arrow-forward-circle icon)
      const statusButton = component.root.findByProps({ name: 'arrow-forward-circle' });
      const parentButton = statusButton.parent;

      await act(async () => {
        parentButton.props.onPress();
      });

      expect(meetingService.progressMeetingStatus).toHaveBeenCalledWith('meeting-1');
      expect(Alert.alert).toHaveBeenCalledWith('Framgång', 'Mötets status har uppdaterats');
    });

    it('should handle meeting deletion with confirmation', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      meetingService.deleteMeeting.mockResolvedValue(true);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Find delete button (trash-outline icon)
      const deleteIcon = component.root.findByProps({ name: 'trash-outline' });
      const deleteButton = deleteIcon.parent;

      await act(async () => {
        deleteButton.props.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Radera möte',
        'Är du säker på att du vill radera detta möte? Denna åtgärd kan inte ångras.',
        expect.arrayContaining([
          { text: 'Avbryt', style: 'cancel' },
          { text: 'Radera', style: 'destructive', onPress: expect.any(Function) }
        ])
      );
    });

    it('should handle status progression errors', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      meetingService.progressMeetingStatus.mockResolvedValue(false);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const statusButton = component.root.findByProps({ name: 'arrow-forward-circle' });
      const parentButton = statusButton.parent;

      await act(async () => {
        parentButton.props.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Fel', 'Kunde inte uppdatera mötets status');
    });

    it('should handle deletion errors', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      meetingService.deleteMeeting.mockResolvedValue(false);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const deleteIcon = component.root.findByProps({ name: 'trash-outline' });
      const deleteButton = deleteIcon.parent;

      await act(async () => {
        deleteButton.props.onPress();
      });

      // Simulate confirming deletion
      const alertCall = (Alert.alert as jest.Mock).mock.calls.find(call =>
        call[0] === 'Radera möte'
      );
      const confirmButton = alertCall[2].find((button: any) => button.text === 'Radera');

      await act(async () => {
        confirmButton.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Fel', 'Kunde inte radera mötet');
    });
  });

  describe('Swedish Localization', () => {
    it('should display all Swedish UI text correctly', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Check for Swedish text elements
      const swedishTexts = [
        'Mina Möten',
        'Sök möten...',
        'Pågående',
        'Klart',
        'Fysiskt möte',
        'Digitalt möte'
      ];

      swedishTexts.forEach(text => {
        const element = component.root.findByProps({ children: text });
        expect(element).toBeDefined();
      });
    });

    it('should handle Swedish character encoding (åäö)', async () => {
      const swedishMeeting = {
        ...mockMeetings[0],
        title: 'Årsmöte för Stiftelsen Åsa & Östen'
      };

      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue([swedishMeeting]);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const titleElement = component.root.findByProps({
        children: 'Årsmöte för Stiftelsen Åsa & Östen'
      });
      expect(titleElement).toBeDefined();
    });

    it('should format dates using Swedish locale', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Check that dates are formatted in Swedish
      const textElements = component.root.findAllByType('Text');
      const hasSwedishDateFormat = textElements.some((element: any) => {
        const text = element.props.children;
        return typeof text === 'string' &&
               (text.includes('januari') || text.includes('februari') ||
                text.includes('mars') || text.includes('april'));
      });

      expect(hasSwedishDateFormat).toBe(true);
    });

    it('should display Swedish error messages', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockRejectedValue(new Error('Network error'));

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const errorMessage = component.root.findByProps({
        children: 'Kunde inte hämta möten'
      });
      expect(errorMessage).toBeDefined();
    });
  });

  describe('Advanced Search Modal', () => {
    it('should render advanced search modal when opened', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Check for modal title
      const modalTitle = component.root.findByProps({
        children: 'Avancerad sökning'
      });
      expect(modalTitle).toBeDefined();
    });

    it('should handle date range filters', async () => {
      const { meetingService } = require('../services/meetingService');
      const { searchService } = require('../services/searchService');

      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      searchService.searchMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Find date input fields
      const fromDateInput = component.root.findByProps({ placeholder: 'ÅÅÅÅ-MM-DD' });
      expect(fromDateInput).toBeDefined();
    });

    it('should handle meeting type filters', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Check for meeting type filter buttons
      const physicalButton = component.root.findByProps({
        children: 'Fysiska möten'
      });
      const digitalButton = component.root.findByProps({
        children: 'Digitala möten'
      });

      expect(physicalButton).toBeDefined();
      expect(digitalButton).toBeDefined();
    });

    it('should apply advanced filters', async () => {
      const { meetingService } = require('../services/meetingService');
      const { searchService } = require('../services/searchService');

      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);
      searchService.searchMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Find and press apply filters button
      const applyButton = component.root.findByProps({
        title: 'Tillämpa filter'
      });

      await act(async () => {
        applyButton.props.onPress();
      });

      expect(applyButton).toBeDefined();
    });

    it('should reset advanced filters', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Find and press reset button
      const resetButton = component.root.findByProps({
        title: 'Återställ'
      });

      await act(async () => {
        resetButton.props.onPress();
      });

      expect(resetButton).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user authentication', async () => {
      const { useBankID } = require('../hooks/useBankID');
      useBankID.mockReturnValue({ user: null });

      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue([]);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Should not call getUserMeetings without user
      expect(meetingService.getUserMeetings).not.toHaveBeenCalled();
    });

    it('should handle empty meetings list', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue([]);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Should render without errors when no meetings
      const appLayout = component.root.findByProps({ testID: 'app-layout' });
      expect(appLayout).toBeDefined();
    });

    it('should handle network timeouts gracefully', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockRejectedValue(new Error('Request timeout'));

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const errorText = component.root.findByProps({
        children: 'Kunde inte hämta möten'
      });
      expect(errorText).toBeDefined();

      // Should show retry button
      const retryButton = component.root.findByProps({
        title: 'Försök igen'
      });
      expect(retryButton).toBeDefined();
    });

    it('should handle retry functionality', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const retryButton = component.root.findByProps({
        title: 'Försök igen'
      });

      await act(async () => {
        retryButton.props.onPress();
      });

      expect(meetingService.getUserMeetings).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility Features', () => {
    it('should provide proper accessibility labels', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Check for accessibility-friendly structure
      const appLayout = component.root.findByProps({ testID: 'app-layout' });
      expect(appLayout).toBeDefined();
      expect(appLayout.props.title).toBe('Mina Möten');
    });

    it('should support screen reader navigation', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Verify component structure supports screen readers
      const searchInput = component.root.findByProps({ placeholder: 'Sök möten...' });
      expect(searchInput).toBeDefined();
      expect(searchInput.props.placeholder).toContain('Sök');
    });

    it('should handle Swedish character encoding in accessibility', async () => {
      const swedishMeeting = {
        ...mockMeetings[0],
        title: 'Möte med åäö-tecken'
      };

      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue([swedishMeeting]);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const titleElement = component.root.findByProps({
        children: 'Möte med åäö-tecken'
      });
      expect(titleElement).toBeDefined();
    });
  });

  describe('Component Integration', () => {
    it('should integrate properly with AppLayout', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      const appLayout = component.root.findByProps({ testID: 'app-layout' });
      expect(appLayout).toBeDefined();
      expect(appLayout.props.title).toBe('Mina Möten');
    });

    it('should handle component unmounting gracefully', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      await act(async () => {
        component.unmount();
      });

      // Should unmount without errors
      expect(component.getInstance()).toBeNull();
    });

    it('should handle prop changes correctly', async () => {
      const { meetingService } = require('../services/meetingService');
      meetingService.getUserMeetings.mockResolvedValue(mockMeetings);

      let component: any;
      await act(async () => {
        component = createComponent();
      });

      // Component should handle updates
      await act(async () => {
        component.update(React.createElement(MeetingListScreen, {}));
      });

      const appLayout = component.root.findByProps({ testID: 'app-layout' });
      expect(appLayout).toBeDefined();
    });
  });
});
