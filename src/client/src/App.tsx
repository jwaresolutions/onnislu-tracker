// Main React App component - minimal availability view
import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router } from 'react-router-dom';
import { Container, Typography, Box, Grid, Paper, List, ListItem, ListItemText, CircularProgress, Alert, Button } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

type AvailabilityItem = { name: string; moveInDate?: string };
type AvailabilityResponse = {
  success: boolean;
  data?: {
    availableNow: AvailabilityItem[];
    availableNextMonth: AvailabilityItem[];
    scrapedAt: string;
    source: string;
  };
  error?: string;
  message?: string;
};

type FloorPlan = {
  id: number;
  name: string;
  building_name?: string;
  current_price?: number | null;
  lowest_price?: number | null;
  is_available?: boolean;
  square_footage?: number | null;
};

type FloorPlansResponse = {
  success: boolean;
  data?: { floorPlans: FloorPlan[] };
};

type HistoryPoint = { collection_date: string; price: number };
type FloorPlanHistoryResponse = {
  success: boolean;
  data?: { history: HistoryPoint[] };
};

function App() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [availableNow, setAvailableNow] = useState<AvailabilityItem[]>([]);
  const [availableNextMonth, setAvailableNextMonth] = useState<AvailabilityItem[]>([]);
  const [scrapedAt, setScrapedAt] = useState<string>('');
  const [statusData, setStatusData] = useState<any | null>(null);
  const [latestInfo, setLatestInfo] = useState<{ count: number; lastUpdated: string } | null>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
 
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const fetchAll = async () => {
    try {
      setLoading(true);
      setErr(null);

      const [availRes, statusRes, latestRes, fpsRes] = await Promise.all([
        fetch('/api/availability?wings=D,E'),
        fetch('/api/status'),
        fetch('/api/prices/latest'),
        fetch('/api/floorplans')
      ]);

      const availJson: AvailabilityResponse = await availRes.json();
      if (!availJson.success || !availJson.data) {
        throw new Error(availJson.error || availJson.message || 'Availability failed');
      }
      setAvailableNow(availJson.data.availableNow);
      setAvailableNextMonth(availJson.data.availableNextMonth);
      setScrapedAt(availJson.data.scrapedAt);

      const statusJson = await statusRes.json();
      if (statusJson?.success) {
        setStatusData(statusJson.data);
      }

      const latestJson = await latestRes.json();
      if (latestJson?.success) {
        const prices = latestJson.data?.prices || [];
        setLatestInfo({ count: prices.length, lastUpdated: latestJson.data?.lastUpdated || '' });
      }

      const fpsJson: FloorPlansResponse = await fpsRes.json();
      if (fpsJson?.success && fpsJson.data?.floorPlans) {
        setFloorPlans(fpsJson.data.floorPlans);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const loadHistory = async (fp: FloorPlan) => {
    try {
      setSelectedPlan(fp);
      const res = await fetch(`/api/floorplans/${fp.id}/history?limit=60`);
      const json: FloorPlanHistoryResponse = await res.json();
      if (json?.success && json.data?.history) {
        // Oldest -> newest
        setHistory(json.data.history.slice().reverse());
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    }
  };

  const runScraper = async () => {
    try {
      setScraping(true);
      setErr(null);
      setScrapeMsg(null);

      const resp = await fetch('/api/scraper/run', { method: 'POST' });
      const json = await resp.json();
      if (!json?.success) {
        throw new Error(json?.error || json?.message || 'Scrape failed');
      }

      const filtered = json?.data?.totals?.filtered ?? 0;
      const upserted = json?.data?.totals?.upserted ?? 0;
      setScrapeMsg(`Scrape completed: ${filtered} D/E plans processed, ${upserted} upserted.`);

      await fetchAll();
    } catch (e: any) {
      setErr(e?.message || 'Scrape failed');
    } finally {
      setScraping(false);
    }
  };
 
  const PriceChart: React.FC<{ points: HistoryPoint[] }> = ({ points }) => {
    if (!points?.length) return <Typography variant="body2">No history</Typography>;
    const prices = points.map(p => Number(p.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const w = 300, h = 120, pad = 10;
    const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1));
    const ys = prices.map(p => {
      if (max === min) return h / 2;
      return pad + (h - 2 * pad) * (1 - (p - min) / (max - min));
    });
    const d = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polyline fill="none" stroke="#1976d2" strokeWidth="2" points={d} />
        <text x={pad} y={h - 2} fontSize="10" fill="#666">${min.toFixed(0)}</text>
        <text x={w - pad - 24} y={12} fontSize="10" fill="#666">${max.toFixed(0)}</text>
      </svg>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Container maxWidth="lg">
          <Box sx={{ my: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              ONNISLU Availability (D/E)
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Button variant="contained" onClick={runScraper} disabled={scraping}>
                {scraping ? 'Running…' : 'Run Scraper Now'}
              </Button>
            </Box>
            {scrapeMsg && <Alert severity="success" sx={{ mt: 2 }}>{scrapeMsg}</Alert>}

            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Loading availability…</Typography>
              </Box>
            )}

            {err && <Alert severity="error">{err}</Alert>}

            {!loading && !err && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Available Now</Typography>
                    {availableNow.length === 0 ? (
                      <Typography variant="body2">No D/E units available now.</Typography>
                    ) : (
                      <List dense>
                        {availableNow.map((u) => (
                          <ListItem key={`now-${u.name}`}>
                            <ListItemText primary={u.name} secondary="Now" />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Available Next Month</Typography>
                    {availableNextMonth.length === 0 ? (
                      <Typography variant="body2">No D/E units next month.</Typography>
                    ) : (
                      <List dense>
                        {availableNextMonth.map((u) => (
                          <ListItem key={`next-${u.name}`}>
                            <ListItemText primary={u.name} secondary={u.moveInDate || 'Next month'} />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            )}

            {!loading && (
              <Box sx={{ mt: 3 }}>
                {scrapedAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Last scraped: {new Date(scrapedAt).toLocaleString()}
                  </Typography>
                )}

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>System Status</Typography>
                      {statusData ? (
                        <List dense>
                          <ListItem><ListItemText primary={`DB Connected: ${statusData.database?.connected ? 'Yes' : 'No'}`} /></ListItem>
                          <ListItem><ListItemText primary={`Integrity: ${statusData.database?.integrity || 'unknown'}`} /></ListItem>
                          <ListItem><ListItemText primary={`Buildings: ${statusData.database?.stats?.buildings ?? 0}`} /></ListItem>
                          <ListItem><ListItemText primary={`Floor Plans: ${statusData.database?.stats?.floor_plans ?? 0}`} /></ListItem>
                          <ListItem><ListItemText primary={`Price Records: ${statusData.database?.stats?.price_records ?? 0}`} /></ListItem>
                          <ListItem><ListItemText primary={`Next Run: ${statusData.scheduler?.nextCollection || 'n/a'}`} /></ListItem>
                        </List>
                      ) : (
                        <Typography variant="body2">Status loading…</Typography>
                      )}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>Latest Prices</Typography>
                      {latestInfo ? (
                        <List dense>
                          <ListItem><ListItemText primary={`Floor plans with latest prices: ${latestInfo.count}`} /></ListItem>
                          <ListItem><ListItemText primary={`Last Updated: ${new Date(latestInfo.lastUpdated).toLocaleString()}`} /></ListItem>
                        </List>
                      ) : (
                        <Typography variant="body2">Latest prices loading…</Typography>
                      )}
                    </Paper>
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 3 }}>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>Floor Plans</Typography>
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <Grid container spacing={2}>
                      {floorPlans.length === 0 ? (
                        <Grid item xs={12}>
                          <Typography variant="body2">No floor plans available.</Typography>
                        </Grid>
                      ) : (
                        floorPlans.slice(0, 50).map((fp) => (
                          <Grid item xs={12} sm={6} md={4} key={fp.id}>
                            <Paper onClick={() => loadHistory(fp)} sx={{ p: 2, cursor: 'pointer', border: selectedPlan?.id === fp.id ? '2px solid #1976d2' : '1px solid #eee' }}>
                              <Typography variant="subtitle1">{fp.name}</Typography>
                              <Typography variant="body2" color="text.secondary">{fp.building_name || '—'}</Typography>
                              <Typography variant="body2">Current: {fp.current_price != null ? `$${fp.current_price}` : 'n/a'}</Typography>
                              <Typography variant="body2">Lowest: {fp.lowest_price != null ? `$${fp.lowest_price}` : 'n/a'}</Typography>
                              <Typography variant="body2">Available: {fp.is_available ? 'Yes' : 'No'}</Typography>
                            </Paper>
                          </Grid>
                        ))
                      )}
                    </Grid>
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>History {selectedPlan ? `— ${selectedPlan.name}` : ''}</Typography>
                      <PriceChart points={history} />
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        </Container>
      </Router>
    </ThemeProvider>
  );
}

export default App;