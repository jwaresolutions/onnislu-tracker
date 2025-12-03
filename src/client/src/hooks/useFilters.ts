import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterState {
  searchTerm: string;
  bedrooms: number[];
  bathrooms: number[];
  buildings: string[];
  hasDen: boolean | null;
  minPrice: number | null;
  maxPrice: number | null;
  minSquareFootage: number | null;
  maxSquareFootage: number | null;
}

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

/**
 * Custom hook to manage filter state with URL parameter synchronization
 */
export const useFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  // Parse filters from URL on mount
  useEffect(() => {
    const parsedFilters: FilterState = {
      searchTerm: searchParams.get('search') || '',
      bedrooms: searchParams.get('bedrooms')
        ? searchParams.get('bedrooms')!.split(',').map(Number)
        : [],
      bathrooms: searchParams.get('bathrooms')
        ? searchParams.get('bathrooms')!.split(',').map(Number)
        : [],
      buildings: searchParams.get('buildings')
        ? searchParams.get('buildings')!.split(',')
        : [],
      hasDen: searchParams.get('hasDen') === 'true' ? true : null,
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : null,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : null,
      minSquareFootage: searchParams.get('minSqFt') ? Number(searchParams.get('minSqFt')) : null,
      maxSquareFootage: searchParams.get('maxSqFt') ? Number(searchParams.get('maxSqFt')) : null,
    };
    setFilters(parsedFilters);
  }, []);

  // Update URL when filters change
  const updateFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);

    const params = new URLSearchParams();

    if (newFilters.searchTerm) {
      params.set('search', newFilters.searchTerm);
    }
    if (newFilters.bedrooms.length > 0) {
      params.set('bedrooms', newFilters.bedrooms.join(','));
    }
    if (newFilters.bathrooms.length > 0) {
      params.set('bathrooms', newFilters.bathrooms.join(','));
    }
    if (newFilters.buildings.length > 0) {
      params.set('buildings', newFilters.buildings.join(','));
    }
    if (newFilters.hasDen === true) {
      params.set('hasDen', 'true');
    }
    if (newFilters.minPrice !== null) {
      params.set('minPrice', String(newFilters.minPrice));
    }
    if (newFilters.maxPrice !== null) {
      params.set('maxPrice', String(newFilters.maxPrice));
    }
    if (newFilters.minSquareFootage !== null) {
      params.set('minSqFt', String(newFilters.minSquareFootage));
    }
    if (newFilters.maxSquareFootage !== null) {
      params.set('maxSqFt', String(newFilters.maxSquareFootage));
    }

    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    updateFilters(defaultFilters);
  }, [updateFilters]);

  return {
    filters,
    updateFilters,
    clearFilters,
  };
};
