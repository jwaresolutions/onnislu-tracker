import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';

interface AlertSettings {
  thresholdType: 'dollar' | 'percentage';
  thresholdValue: number;
}

interface AlertSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const AlertSettingsDialog: React.FC<AlertSettingsDialogProps> = ({ open, onClose, onSave }) => {
  const [settings, setSettings] = useState<AlertSettings>({
    thresholdType: 'percentage',
    thresholdValue: 5
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSettings();
      setSuccess(false);
    }
  }, [open]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch current settings from the settings table
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.success && data.data?.settings) {
        const settingsArray = data.data.settings;
        const typeEntry = settingsArray.find((s: any) => s.key === 'alert_threshold_type');
        const valueEntry = settingsArray.find((s: any) => s.key === 'alert_threshold_value');

        if (typeEntry || valueEntry) {
          setSettings({
            thresholdType: (typeEntry?.value as 'dollar' | 'percentage') || 'percentage',
            thresholdValue: valueEntry?.value ? Number(valueEntry.value) : 5
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch('/api/alerts/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess(true);
      
      // Call onSave callback if provided
      if (onSave) {
        onSave();
      }

      // Close dialog after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleThresholdTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      thresholdType: event.target.value as 'dollar' | 'percentage'
    });
  };

  const handleThresholdValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setSettings({
        ...settings,
        thresholdValue: value
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Alert Settings</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Settings saved successfully!
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure when you want to be notified about price changes. Alerts will be generated
              when a floor plan's price drops by the specified threshold.
            </Typography>

            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">Alert Threshold Type</FormLabel>
              <RadioGroup
                value={settings.thresholdType}
                onChange={handleThresholdTypeChange}
              >
                <FormControlLabel
                  value="percentage"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">Percentage</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Alert when price drops by a percentage (e.g., 5%)
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="dollar"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">Dollar Amount</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Alert when price drops by a dollar amount (e.g., $100)
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label={settings.thresholdType === 'percentage' ? 'Threshold (%)' : 'Threshold ($)'}
              value={settings.thresholdValue}
              onChange={handleThresholdValueChange}
              inputProps={{
                min: 0,
                step: settings.thresholdType === 'percentage' ? 0.1 : 1
              }}
              helperText={
                settings.thresholdType === 'percentage'
                  ? 'Alert when price drops by this percentage or more'
                  : 'Alert when price drops by this dollar amount or more'
              }
            />

            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Note:</strong> You will always be notified when a floor plan reaches its
                lowest recorded price, regardless of these threshold settings.
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlertSettingsDialog;
