import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Checkbox,
  IconButton,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';

interface FloorPlan {
  id: number;
  building_id: number;
  name: string;
  bedrooms: number;
  bathrooms: number;
  has_den: number;
  square_footage: number | null;
  building_name: string;
}

const Admin: React.FC = () => {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedPlans, setEditedPlans] = useState<Map<number, Partial<FloorPlan>>>(new Map());

  const fetchFloorPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/floorplans');
      const data = await response.json();
      
      if (data.success) {
        setFloorPlans(data.data);
      } else {
        setError(data.error || 'Failed to load floor plans');
      }
    } catch (err) {
      setError('Network error loading floor plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloorPlans();
  }, []);

  const handleFieldChange = (id: number, field: keyof FloorPlan, value: any) => {
    const current = editedPlans.get(id) || {};
    const updated = new Map(editedPlans);
    updated.set(id, { ...current, [field]: value });
    setEditedPlans(updated);
  };

  const getDisplayValue = (plan: FloorPlan, field: keyof FloorPlan) => {
    const edited = editedPlans.get(plan.id);
    if (edited && field in edited) {
      return edited[field];
    }
    return plan[field];
  };

  const handleSave = async (plan: FloorPlan) => {
    const edited = editedPlans.get(plan.id);
    if (!edited) return;

    setSaving(plan.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/floorplans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: getDisplayValue(plan, 'name'),
          bedrooms: Number(getDisplayValue(plan, 'bedrooms')),
          bathrooms: Number(getDisplayValue(plan, 'bathrooms')),
          has_den: Boolean(getDisplayValue(plan, 'has_den')),
          square_footage: getDisplayValue(plan, 'square_footage'),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Saved ${plan.name}`);
        // Remove from edited map
        const updated = new Map(editedPlans);
        updated.delete(plan.id);
        setEditedPlans(updated);
        // Refresh data
        await fetchFloorPlans();
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Network error saving floor plan');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (plan: FloorPlan) => {
    if (!confirm(`Delete ${plan.name}?`)) return;

    setSaving(plan.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/floorplans/${plan.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Deleted ${plan.name}`);
        await fetchFloorPlans();
      } else {
        setError(data.error || 'Failed to delete');
      }
    } catch (err) {
      setError('Network error deleting floor plan');
    } finally {
      setSaving(null);
    }
  };

  const isEdited = (id: number) => editedPlans.has(id);

  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Floor Plans Admin</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchFloorPlans}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Building</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Bedrooms</TableCell>
              <TableCell>Bathrooms</TableCell>
              <TableCell>Den</TableCell>
              <TableCell>Sq Ft</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {floorPlans.map((plan) => (
              <TableRow
                key={plan.id}
                sx={{ backgroundColor: isEdited(plan.id) ? 'action.hover' : 'inherit' }}
              >
                <TableCell>{plan.id}</TableCell>
                <TableCell>{plan.building_name}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={getDisplayValue(plan, 'name')}
                    onChange={(e) => handleFieldChange(plan.id, 'name', e.target.value)}
                    sx={{ minWidth: 150 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={getDisplayValue(plan, 'bedrooms')}
                    onChange={(e) => handleFieldChange(plan.id, 'bedrooms', parseInt(e.target.value, 10))}
                    sx={{ width: 80 }}
                    inputProps={{ min: 0, max: 10 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={getDisplayValue(plan, 'bathrooms')}
                    onChange={(e) => handleFieldChange(plan.id, 'bathrooms', parseFloat(e.target.value))}
                    sx={{ width: 80 }}
                    inputProps={{ min: 1, max: 10, step: 0.5 }}
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={Boolean(getDisplayValue(plan, 'has_den'))}
                    onChange={(e) => handleFieldChange(plan.id, 'has_den', e.target.checked ? 1 : 0)}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={getDisplayValue(plan, 'square_footage') || ''}
                    onChange={(e) => handleFieldChange(plan.id, 'square_footage', e.target.value ? parseInt(e.target.value, 10) : null)}
                    sx={{ width: 100 }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleSave(plan)}
                      disabled={!isEdited(plan.id) || saving === plan.id}
                    >
                      {saving === plan.id ? <CircularProgress size={20} /> : <SaveIcon />}
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(plan)}
                      disabled={saving === plan.id}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Admin;
