import { FilterState } from '../hooks/useFilters';

// Using the same type structure as in App.tsx
interface FloorPlan {
  id: number;
  name: string;
  building_name?: string;
  bedrooms?: number;
  bathrooms?: number;
  has_den?: boolean;
  square_footage?: number | null;
  current_price?: number | null;
  lowest_price?: number | null;
  is_available?: boolean;
  image_url?: string | null;
}

/**
 * Apply filters to a list of floor plans
 */
export const applyFilters = (
  floorPlans: FloorPlan[],
  filters: FilterState
): FloorPlan[] => {
  return floorPlans.filter((plan) => {
    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const nameMatch = plan.name?.toLowerCase().includes(searchLower);
      const buildingMatch = plan.building_name?.toLowerCase().includes(searchLower);
      if (!nameMatch && !buildingMatch) {
        return false;
      }
    }

    // Bedrooms filter
    if (filters.bedrooms.length > 0) {
      if (!filters.bedrooms.includes(plan.bedrooms ?? -1)) {
        return false;
      }
    }

    // Bathrooms filter
    if (filters.bathrooms.length > 0) {
      if (!filters.bathrooms.includes(plan.bathrooms ?? -1)) {
        return false;
      }
    }

    // Buildings filter
    if (filters.buildings.length > 0) {
      if (!plan.building_name || !filters.buildings.includes(plan.building_name)) {
        return false;
      }
    }

    // Den filter
    if (filters.hasDen === true) {
      if (!plan.has_den) {
        return false;
      }
    }

    // Price range filter
    const price = plan.current_price ?? plan.lowest_price;
    if (filters.minPrice !== null && price !== null && price !== undefined) {
      if (price < filters.minPrice) {
        return false;
      }
    }
    if (filters.maxPrice !== null && price !== null && price !== undefined) {
      if (price > filters.maxPrice) {
        return false;
      }
    }

    // Square footage filter
    if (filters.minSquareFootage !== null && plan.square_footage !== null && plan.square_footage !== undefined) {
      if (plan.square_footage < filters.minSquareFootage) {
        return false;
      }
    }
    if (filters.maxSquareFootage !== null && plan.square_footage !== null && plan.square_footage !== undefined) {
      if (plan.square_footage > filters.maxSquareFootage) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Get unique building names from floor plans
 */
export const getUniqueBuildings = (floorPlans: FloorPlan[]): string[] => {
  const buildings = new Set<string>();
  floorPlans.forEach((plan) => {
    if (plan.building_name) {
      buildings.add(plan.building_name);
    }
  });
  return Array.from(buildings).sort();
};

/**
 * Get filter summary text
 */
export const getFilterSummary = (
  totalCount: number,
  filteredCount: number,
  filters: FilterState
): string => {
  if (totalCount === filteredCount) {
    return `Showing all ${totalCount} floor plans`;
  }

  const activeFilters: string[] = [];
  
  if (filters.searchTerm) {
    activeFilters.push(`search: "${filters.searchTerm}"`);
  }
  if (filters.bedrooms.length > 0) {
    activeFilters.push(`bedrooms: ${filters.bedrooms.join(', ')}`);
  }
  if (filters.bathrooms.length > 0) {
    activeFilters.push(`bathrooms: ${filters.bathrooms.join(', ')}`);
  }
  if (filters.buildings.length > 0) {
    activeFilters.push(`buildings: ${filters.buildings.join(', ')}`);
  }
  if (filters.hasDen) {
    activeFilters.push('has den');
  }
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const priceRange = [
      filters.minPrice !== null ? `$${filters.minPrice}` : '',
      filters.maxPrice !== null ? `$${filters.maxPrice}` : '',
    ].filter(Boolean).join(' - ');
    activeFilters.push(`price: ${priceRange}`);
  }
  if (filters.minSquareFootage !== null || filters.maxSquareFootage !== null) {
    const sqftRange = [
      filters.minSquareFootage !== null ? `${filters.minSquareFootage}` : '',
      filters.maxSquareFootage !== null ? `${filters.maxSquareFootage}` : '',
    ].filter(Boolean).join(' - ');
    activeFilters.push(`sq ft: ${sqftRange}`);
  }

  return `Showing ${filteredCount} of ${totalCount} floor plans (${activeFilters.join(', ')})`;
};
