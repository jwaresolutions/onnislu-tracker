import React, { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Alert as MuiAlert,
  IconButton,
  Chip,
  List,
  ListItem,
  Divider,
  Button,
  Collapse,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import StarIcon from '@mui/icons-material/Star';
import SettingsIcon from '@mui/icons-material/Settings';

interface Alert {
  id: number;
  floor_plan_id: number;
  floor_plan_name: string;
  building_name: string;
  alert_type: 'price_drop' | 'lowest_price';
  old_price: number | null;
  new_price: number;
  percentage_change: number | null;
  is_dismissed: boolean;
  created_at: string;
}

interface AlertPanelProps {
  onOpenSettings?: () => void;
  collapsed?: boolean;
}

const AlertPanel: React.FC<AlertPanelProps> = ({ onOpenSettings, collapsed: initialCollapsed = false }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/alerts');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch alerts');
      }

      setAlerts(data.data?.alerts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Refresh alerts every 60 seconds
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (alertId: number) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to dismiss alert');
      }

      // Remove alert from local state
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err: any) {
      setError(err.message || 'Failed to dismiss alert');
    }
  };

  const getAlertIcon = (type: string) => {
    return type === 'lowest_price' ? (
      <StarIcon sx={{ color: 'warning.main', mr: 1 }} />
    ) : (
      <TrendingDownIcon sx={{ color: 'success.main', mr: 1 }} />
    );
  };

  const formatPrice = (price: number | null) => {
    return price != null ? `$${price.toLocaleString()}` : 'N/A';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading alerts...</Typography>
        </Box>
      </Paper>
    );
  }

  if (alerts.length === 0 && !error) {
    return null; // Don't show panel if no alerts
  }

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: collapsed ? 0 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">
            Price Alerts
          </Typography>
          <Chip 
            label={alerts.length} 
            size="small" 
            color="primary"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onOpenSettings && (
            <IconButton
              size="small"
              onClick={onOpenSettings}
              title="Alert Settings"
            >
              <SettingsIcon />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={!collapsed}>
        {error && (
          <MuiAlert severity="error" sx={{ mb: 2 }}>
            {error}
          </MuiAlert>
        )}

        <List disablePadding>
          {alerts.map((alert, index) => (
            <React.Fragment key={alert.id}>
              {index > 0 && <Divider />}
              <ListItem
                sx={{
                  px: 0,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start'
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    {getAlertIcon(alert.alert_type)}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {alert.floor_plan_name}
                    </Typography>
                    <Chip
                      label={alert.building_name}
                      size="small"
                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>

                  <Box sx={{ ml: 4 }}>
                    {alert.alert_type === 'price_drop' ? (
                      <Typography variant="body2" color="text.secondary">
                        Price dropped from {formatPrice(alert.old_price)} to{' '}
                        <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>
                          {formatPrice(alert.new_price)}
                        </Box>
                        {alert.percentage_change != null && (
                          <Box component="span" sx={{ ml: 1, color: 'success.main' }}>
                            (↓ {alert.percentage_change.toFixed(1)}%)
                          </Box>
                        )}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        New lowest price:{' '}
                        <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>
                          {formatPrice(alert.new_price)}
                        </Box>
                        {alert.old_price != null && (
                          <Box component="span" sx={{ ml: 1 }}>
                            (previous low: {formatPrice(alert.old_price)})
                          </Box>
                        )}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                      {formatDate(alert.created_at)}
                    </Typography>
                  </Box>
                </Box>

                <IconButton
                  size="small"
                  onClick={() => handleDismiss(alert.id)}
                  sx={{ ml: 1 }}
                  title="Dismiss alert"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>

        {alerts.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={fetchAlerts}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default AlertPanel;
