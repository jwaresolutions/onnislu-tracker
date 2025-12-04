import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterPanel, { FilterState } from '../FilterPanel';

const defaultFilters: FilterState = {
  searchTerm: '',
  bedrooms: [],
  bathrooms: [],
  buildings: [],
  hasDen: null,
  minPrice: null,
  maxPrice: null,
  minSquareFootage: null,
  maxSquareFootage: null,
};

const availableBuildings = ['Fairview', 'Boren'];

describe('FilterPanel', () => {
  it('should render filter panel with all controls', () => {
    const mockOnFilterChange = jest.fn();

    render(
      <FilterPanel
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availableBuildings={availableBuildings}
      />
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
    expect(screen.getByLabelText('Bedrooms')).toBeInTheDocument();
    expect(screen.getByLabelText('Bathrooms')).toBeInTheDocument();
    expect(screen.getByLabelText('Buildings')).toBeInTheDocument();
    expect(screen.getByLabelText('Has Den')).toBeInTheDocument();
  });

  it('should call onFilterChange when search term changes', () => {
    const mockOnFilterChange = jest.fn();

    render(
      <FilterPanel
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availableBuildings={availableBuildings}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search by name...');
    fireEvent.change(searchInput, { target: { value: 'Studio' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilters,
      searchTerm: 'Studio'
    });
  });

  it('should call onFilterChange when den checkbox is toggled', () => {
    const mockOnFilterChange = jest.fn();

    render(
      <FilterPanel
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availableBuildings={availableBuildings}
      />
    );

    const denCheckbox = screen.getByLabelText('Has Den');
    fireEvent.click(denCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilters,
      hasDen: true
    });
  });

  it('should display active filter count', () => {
    const activeFilters: FilterState = {
      ...defaultFilters,
      searchTerm: 'Studio',
      bedrooms: [1, 2],
      hasDen: true,
    };

    render(
      <FilterPanel
        filters={activeFilters}
        onFilterChange={jest.fn()}
        availableBuildings={availableBuildings}
      />
    );

    // Should show count of 3 active filters
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show clear all button when filters are active', () => {
    const activeFilters: FilterState = {
      ...defaultFilters,
      searchTerm: 'Studio',
    };

    render(
      <FilterPanel
        filters={activeFilters}
        onFilterChange={jest.fn()}
        availableBuildings={availableBuildings}
      />
    );

    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('should clear all filters when clear button clicked', () => {
    const mockOnFilterChange = jest.fn();
    const activeFilters: FilterState = {
      ...defaultFilters,
      searchTerm: 'Studio',
      bedrooms: [1],
      hasDen: true,
    };

    render(
      <FilterPanel
        filters={activeFilters}
        onFilterChange={mockOnFilterChange}
        availableBuildings={availableBuildings}
      />
    );

    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);

    expect(mockOnFilterChange).toHaveBeenCalledWith(defaultFilters);
  });

  it('should toggle expand/collapse state', () => {
    render(
      <FilterPanel
        filters={defaultFilters}
        onFilterChange={jest.fn()}
        availableBuildings={availableBuildings}
      />
    );

    const collapseButton = screen.getByLabelText('collapse filters');
    fireEvent.click(collapseButton);

    expect(screen.getByLabelText('expand filters')).toBeInTheDocument();
  });

  it('should handle price range changes', () => {
    const mockOnFilterChange = jest.fn();

    render(
      <FilterPanel
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availableBuildings={availableBuildings}
      />
    );

    const minPriceInput = screen.getByLabelText('Min Price');
    fireEvent.change(minPriceInput, { target: { value: '2000' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilters,
      minPrice: 2000
    });
  });

  it('should handle square footage range changes', () => {
    const mockOnFilterChange = jest.fn();

    render(
      <FilterPanel
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        availableBuildings={availableBuildings}
      />
    );

    const maxSqFtInput = screen.getByLabelText('Max Sq Ft');
    fireEvent.change(maxSqFtInput, { target: { value: '1000' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      ...defaultFilters,
      maxSquareFootage: 1000
    });
  });

  it('should start collapsed when collapsed prop is true', () => {
    render(
      <FilterPanel
        filters={defaultFilters}
        onFilterChange={jest.fn()}
        availableBuildings={availableBuildings}
        collapsed={true}
      />
    );

    expect(screen.getByLabelText('expand filters')).toBeInTheDocument();
  });
});
