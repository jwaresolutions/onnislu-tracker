import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AlertPanel from '../AlertPanel';

// Mock fetch
global.fetch = jest.fn();

const mockAlerts = [
  {
    id: 1,
    floor_plan_id: 1,
    floor_plan_name: 'Studio A',
    building_name: 'Fairview',
    alert_type: 'price_drop' as const,
    old_price: 2500,
    new_price: 2300,
    percentage_change: -8.0,
    is_dismissed: false,
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    floor_plan_id: 2,
    floor_plan_name: '1BR B',
    building_name: 'Boren',
    alert_type: 'lowest_price' as const,
    old_price: null,
    new_price: 2800,
    percentage_change: null,
    is_dismissed: false,
    created_at: '2024-01-16T12:00:00Z'
  }
];

describe('AlertPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<AlertPanel />);
    expect(screen.getByText('Loading alerts...')).toBeInTheDocument();
  });

  it('should render alerts after successful fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { alerts: mockAlerts }
      })
    });

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText('Price Alerts')).toBeInTheDocument();
    });

    expect(screen.getByText('Studio A')).toBeInTheDocument();
    expect(screen.getByText('1BR B')).toBeInTheDocument();
    expect(screen.getByText('Fairview')).toBeInTheDocument();
    expect(screen.getByText('Boren')).toBeInTheDocument();
  });

  it('should not render panel when no alerts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { alerts: [] }
      })
    });

    const { container } = render(<AlertPanel />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('should handle dismiss alert', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { alerts: mockAlerts }
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { alertId: '1' }
        })
      });

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText('Studio A')).toBeInTheDocument();
    });

    const dismissButtons = screen.getAllByTitle('Dismiss alert');
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Studio A')).not.toBeInTheDocument();
    });
  });

  it('should toggle collapse state', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { alerts: mockAlerts }
      })
    });

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText('Price Alerts')).toBeInTheDocument();
    });

    const collapseButton = screen.getByTitle('Collapse');
    fireEvent.click(collapseButton);

    expect(screen.getByTitle('Expand')).toBeInTheDocument();
  });

  it('should call onOpenSettings when settings button clicked', async () => {
    const mockOnOpenSettings = jest.fn();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { alerts: mockAlerts }
      })
    });

    render(<AlertPanel onOpenSettings={mockOnOpenSettings} />);

    await waitFor(() => {
      expect(screen.getByText('Price Alerts')).toBeInTheDocument();
    });

    const settingsButton = screen.getByTitle('Alert Settings');
    fireEvent.click(settingsButton);

    expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('should display error message on fetch failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('should format price drop alert correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { alerts: [mockAlerts[0]] }
      })
    });

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Price dropped from/i)).toBeInTheDocument();
      expect(screen.getByText(/2,500/)).toBeInTheDocument();
      expect(screen.getByText(/2,300/)).toBeInTheDocument();
      expect(screen.getByText(/↓ 8.0%/)).toBeInTheDocument();
    });
  });

  it('should format lowest price alert correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { alerts: [mockAlerts[1]] }
      })
    });

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText(/New lowest price:/i)).toBeInTheDocument();
      expect(screen.getByText(/2,800/)).toBeInTheDocument();
    });
  });
});
