import { applyFilters } from '../filterUtils';
import { FilterState } from '../../hooks/useFilters';

const mockFloorPlans = [
  {
    id: 1,
    building_name: 'Fairview',
    name: 'Studio A',
    bedrooms: 0,
    bathrooms: 1,
    has_den: false,
    square_footage: 500,
    current_price: 2000,
    is_available: true
  },
  {
    id: 2,
    building_name: 'Fairview',
    name: '1BR with Den',
    bedrooms: 1,
    bathrooms: 1,
    has_den: true,
    square_footage: 750,
    current_price: 2500,
    is_available: true
  },
  {
    id: 3,
    building_name: 'Boren',
    name: '2BR Deluxe',
    bedrooms: 2,
    bathrooms: 2,
    has_den: false,
    square_footage: 1200,
    current_price: 3500,
    is_available: false
  },
  {
    id: 4,
    building_name: 'Boren',
    name: '1BR Standard',
    bedrooms: 1,
    bathrooms: 1.5,
    has_den: false,
    square_footage: 800,
    current_price: 2800,
    is_available: true
  }
];

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

describe('filterUtils', () => {
  describe('applyFilters', () => {
    it('should return all floor plans with default filters', () => {
      const result = applyFilters(mockFloorPlans, defaultFilters);
      expect(result).toHaveLength(4);
    });

    it('should filter by search term', () => {
      const filters = { ...defaultFilters, searchTerm: 'Studio' };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Studio A');
    });

    it('should filter by bedrooms', () => {
      const filters = { ...defaultFilters, bedrooms: [1] };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(2);
      expect(result.every(fp => fp.bedrooms === 1)).toBe(true);
    });

    it('should filter by multiple bedrooms', () => {
      const filters = { ...defaultFilters, bedrooms: [0, 1] };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(3);
    });

    it('should filter by bathrooms', () => {
      const filters = { ...defaultFilters, bathrooms: [1] };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(2);
    });

    it('should filter by building', () => {
      const filters = { ...defaultFilters, buildings: ['Fairview'] };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(2);
      expect(result.every(fp => fp.building_name === 'Fairview')).toBe(true);
    });

    it('should filter by den', () => {
      const filters = { ...defaultFilters, hasDen: true };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(1);
      expect(result[0].has_den).toBe(true);
    });

    it('should filter by price range', () => {
      const filters = { ...defaultFilters, minPrice: 2400, maxPrice: 3000 };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(2);
      expect(result.every(fp => fp.current_price >= 2400 && fp.current_price <= 3000)).toBe(true);
    });

    it('should filter by min price only', () => {
      const filters = { ...defaultFilters, minPrice: 2600 };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(2);
      expect(result.every(fp => fp.current_price >= 2600)).toBe(true);
    });

    it('should filter by max price only', () => {
      const filters = { ...defaultFilters, maxPrice: 2500 };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(2);
      expect(result.every(fp => fp.current_price <= 2500)).toBe(true);
    });

    it('should filter by square footage range', () => {
      const filters = { ...defaultFilters, minSquareFootage: 700, maxSquareFootage: 900 };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(2);
      expect(result.every(fp => fp.square_footage >= 700 && fp.square_footage <= 900)).toBe(true);
    });

    it('should apply multiple filters simultaneously', () => {
      const filters: FilterState = {
        ...defaultFilters,
        bedrooms: [1],
        buildings: ['Fairview'],
        hasDen: true
      };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('1BR with Den');
    });

    it('should handle case-insensitive search', () => {
      const filters = { ...defaultFilters, searchTerm: 'deluxe' };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('2BR Deluxe');
    });

    it('should return empty array when no matches', () => {
      const filters = { ...defaultFilters, searchTerm: 'NonExistent' };
      const result = applyFilters(mockFloorPlans, filters);
      expect(result).toHaveLength(0);
    });

    it('should handle floor plans without prices', () => {
      const floorPlansWithoutPrice = [
        { ...mockFloorPlans[0], current_price: null }
      ];
      const filters = { ...defaultFilters, minPrice: 2000 };
      const result = applyFilters(floorPlansWithoutPrice as any, filters);
      expect(result).toHaveLength(0);
    });
  });
});
