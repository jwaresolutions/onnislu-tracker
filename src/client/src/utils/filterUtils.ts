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
 * Extract layout group from floor plan name (e.g., "PLAN A1" -> "A")
 */
const getLayoutGroup = (planName: string): string | null => {
  const match = planName.match(/PLAN\s+([A-Z]+)/i);
  return match ? match[1].toUpperCase() : null;
};

/**
 * Apply filters to a list of floor plans
 */
export const applyFilters = (
  floorPlans: FloorPlan[],
  filters: FilterState
): FloorPlan[] => {
  return floorPlans.filter((plan) => {
    // Layout groups filter
    if (filters.layoutGroups.length > 0) {
      const layoutGroup = getLayoutGroup(plan.name || '');
      if (!layoutGroup || !filters.layoutGroups.includes(layoutGroup)) {
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
 * Get unique layout groups from floor plans (e.g., A, B, C, PH, SKY)
 */
export const getUniqueLayoutGroups = (floorPlans: FloorPlan[]): string[] => {
  const groups = new Set<string>();
  floorPlans.forEach((plan) => {
    const group = getLayoutGroup(plan.name || '');
    if (group) {
      groups.add(group);
    }
  });
  // Sort with special handling for multi-letter groups
  return Array.from(groups).sort((a, b) => {
    // Single letters first, then multi-letter groups
    if (a.length === 1 && b.length === 1) return a.localeCompare(b);
    if (a.length === 1) return -1;
    if (b.length === 1) return 1;
    return a.localeCompare(b);
  });
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
  
  if (filters.layoutGroups.length > 0) {
    activeFilters.push(`layouts: ${filters.layoutGroups.join(', ')}`);
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
