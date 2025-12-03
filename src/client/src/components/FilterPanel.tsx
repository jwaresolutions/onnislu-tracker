import React, { useState, useEffect } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Button,
  Chip,
  SelectChangeEvent,
  Collapse,
  IconButton,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

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

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableBuildings: string[];
  collapsed?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  availableBuildings,
  collapsed = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...localFilters, searchTerm: event.target.value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleBedroomsChange = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value;
    const bedrooms = typeof value === 'string' ? [] : value;
    const newFilters = { ...localFilters, bedrooms };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleBathroomsChange = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value;
    const bathrooms = typeof value === 'string' ? [] : value;
    const newFilters = { ...localFilters, bathrooms };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleBuildingsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const buildings = typeof value === 'string' ? [] : value;
    const newFilters = { ...localFilters, buildings };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDenChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const hasDen = event.target.checked ? true : null;
    const newFilters = { ...localFilters, hasDen };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handlePriceChange = (field: 'minPrice' | 'maxPrice') => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value === '' ? null : Number(event.target.value);
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSquareFootageChange = (field: 'minSquareFootage' | 'maxSquareFootage') => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value === '' ? null : Number(event.target.value);
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters: FilterState = {
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
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const hasActiveFilters = () => {
    return (
      localFilters.searchTerm !== '' ||
      localFilters.bedrooms.length > 0 ||
      localFilters.bathrooms.length > 0 ||
      localFilters.buildings.length > 0 ||
      localFilters.hasDen !== null ||
      localFilters.minPrice !== null ||
      localFilters.maxPrice !== null ||
      localFilters.minSquareFootage !== null ||
      localFilters.maxSquareFootage !== null
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.searchTerm) count++;
    if (localFilters.bedrooms.length > 0) count++;
    if (localFilters.bathrooms.length > 0) count++;
    if (localFilters.buildings.length > 0) count++;
    if (localFilters.hasDen !== null) count++;
    if (localFilters.minPrice !== null || localFilters.maxPrice !== null) count++;
    if (localFilters.minSquareFootage !== null || localFilters.maxSquareFootage !== null) count++;
    return count;
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isExpanded ? 2 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon />
          <Typography variant="h6">Filters</Typography>
          {hasActiveFilters() && (
            <Chip
              label={getActiveFilterCount()}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasActiveFilters() && (
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
            >
              Clear All
            </Button>
          )}
          <IconButton
            size="small"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'collapse filters' : 'expand filters'}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={isExpanded}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Search */}
          <TextField
            fullWidth
            label="Search Floor Plans"
            placeholder="Search by name..."
            value={localFilters.searchTerm}
            onChange={handleSearchChange}
            size="small"
          />

          {/* Bedrooms and Bathrooms */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200, flex: 1 }} size="small">
              <InputLabel>Bedrooms</InputLabel>
              <Select
                multiple
                value={localFilters.bedrooms}
                onChange={handleBedroomsChange}
                label="Bedrooms"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={`${value} BR`} size="small" />
                    ))}
                  </Box>
                )}
              >
                {[0, 1, 2, 3, 4].map((num) => (
                  <MenuItem key={num} value={num}>
                    {num === 0 ? 'Studio' : `${num} Bedroom${num > 1 ? 's' : ''}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 200, flex: 1 }} size="small">
              <InputLabel>Bathrooms</InputLabel>
              <Select
                multiple
                value={localFilters.bathrooms}
                onChange={handleBathroomsChange}
                label="Bathrooms"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={`${value} BA`} size="small" />
                    ))}
                  </Box>
                )}
              >
                {[1, 1.5, 2, 2.5, 3].map((num) => (
                  <MenuItem key={num} value={num}>
                    {num} Bathroom{num > 1 ? 's' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Buildings */}
          <FormControl fullWidth size="small">
            <InputLabel>Buildings</InputLabel>
            <Select
              multiple
              value={localFilters.buildings}
              onChange={handleBuildingsChange}
              label="Buildings"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {availableBuildings.map((building) => (
                <MenuItem key={building} value={building}>
                  {building}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Special Features */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localFilters.hasDen === true}
                  onChange={handleDenChange}
                />
              }
              label="Has Den"
            />
          </Box>

          {/* Price Range */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Price Range
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Min Price"
                type="number"
                size="small"
                value={localFilters.minPrice ?? ''}
                onChange={handlePriceChange('minPrice')}
                InputProps={{ inputProps: { min: 0 } }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Max Price"
                type="number"
                size="small"
                value={localFilters.maxPrice ?? ''}
                onChange={handlePriceChange('maxPrice')}
                InputProps={{ inputProps: { min: 0 } }}
                sx={{ flex: 1 }}
              />
            </Box>
          </Box>

          {/* Square Footage Range */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Square Footage
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Min Sq Ft"
                type="number"
                size="small"
                value={localFilters.minSquareFootage ?? ''}
                onChange={handleSquareFootageChange('minSquareFootage')}
                InputProps={{ inputProps: { min: 0 } }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Max Sq Ft"
                type="number"
                size="small"
                value={localFilters.maxSquareFootage ?? ''}
                onChange={handleSquareFootageChange('maxSquareFootage')}
                InputProps={{ inputProps: { min: 0 } }}
                sx={{ flex: 1 }}
              />
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default FilterPanel;
