import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useFilters } from '../useFilters';

// Mock useSearchParams
const mockSetSearchParams = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

describe('useFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.forEach((_, key) => mockSearchParams.delete(key));
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  it('should initialize with default filters', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    expect(result.current.filters).toEqual({
      searchTerm: '',
      bedrooms: [],
      bathrooms: [],
      buildings: [],
      hasDen: null,
      minPrice: null,
      maxPrice: null,
      minSquareFootage: null,
      maxSquareFootage: null,
    });
  });

  it('should update filters and URL params', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => {
      result.current.updateFilters({
        ...result.current.filters,
        searchTerm: 'Studio',
        bedrooms: [1, 2],
      });
    });

    expect(result.current.filters.searchTerm).toBe('Studio');
    expect(result.current.filters.bedrooms).toEqual([1, 2]);
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('should clear all filters', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => {
      result.current.updateFilters({
        ...result.current.filters,
        searchTerm: 'Studio',
        bedrooms: [1],
        hasDen: true,
      });
    });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({
      searchTerm: '',
      bedrooms: [],
      bathrooms: [],
      buildings: [],
      hasDen: null,
      minPrice: null,
      maxPrice: null,
      minSquareFootage: null,
      maxSquareFootage: null,
    });
  });

  it('should parse filters from URL params on mount', () => {
    mockSearchParams.set('search', 'Studio');
    mockSearchParams.set('bedrooms', '1,2');
    mockSearchParams.set('hasDen', 'true');
    mockSearchParams.set('minPrice', '2000');

    const { result } = renderHook(() => useFilters(), { wrapper });

    expect(result.current.filters.searchTerm).toBe('Studio');
    expect(result.current.filters.bedrooms).toEqual([1, 2]);
    expect(result.current.filters.hasDen).toBe(true);
    expect(result.current.filters.minPrice).toBe(2000);
  });

  it('should handle multiple building filters', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => {
      result.current.updateFilters({
        ...result.current.filters,
        buildings: ['Fairview', 'Boren'],
      });
    });

    expect(result.current.filters.buildings).toEqual(['Fairview', 'Boren']);
  });

  it('should handle price range filters', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => {
      result.current.updateFilters({
        ...result.current.filters,
        minPrice: 2000,
        maxPrice: 3000,
      });
    });

    expect(result.current.filters.minPrice).toBe(2000);
    expect(result.current.filters.maxPrice).toBe(3000);
  });

  it('should handle square footage range filters', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => {
      result.current.updateFilters({
        ...result.current.filters,
        minSquareFootage: 500,
        maxSquareFootage: 1200,
      });
    });

    expect(result.current.filters.minSquareFootage).toBe(500);
    expect(result.current.filters.maxSquareFootage).toBe(1200);
  });
});
