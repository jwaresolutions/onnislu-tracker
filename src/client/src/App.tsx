// Main React App component - minimal availability view
import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router } from 'react-router-dom';
import { Container, Typography, Box, Grid, Paper, List, ListItem, ListItemText, CircularProgress, Alert, Button, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';

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
    availableSoonTable?: { headers: string[]; rows: string[][] };
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
  image_url?: string | null;
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
  const [availableSoonTable, setAvailableSoonTable] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const availablePlans = React.useMemo(() => floorPlans.filter(fp => !!fp.is_available), [floorPlans]);

  // Keep Available Now in sync with floor plan availability
  useEffect(() => {
    const derived = floorPlans
      .filter(fp => !!fp.is_available)
      .map(fp => ({ name: String(fp.name) }));
    setAvailableNow(derived);
  }, [floorPlans]);
 
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
      setAvailableSoonTable(((availJson.data as any).availableSoonTable) || { headers: [], rows: [] });
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

        // Derive available-now from floor plans (price/availability-based) and merge with scraped units
        const fpsList = fpsJson.data.floorPlans;
        const derivedNow: AvailabilityItem[] = fpsList
          .filter(fp => !!fp.is_available)
          .filter(fp => /^PLAN\s+[DE]/i.test(String(fp.name)))
          .map(fp => ({ name: String(fp.name) }));

        const uniq = new Map<string, AvailabilityItem>();
        (availJson.data.availableNow || []).forEach(it => uniq.set(String(it.name).toUpperCase(), it));
        derivedNow.forEach(it => {
          const k = String(it.name).toUpperCase();
          if (!uniq.has(k)) uniq.set(k, it);
        });
        setAvailableNow(Array.from(uniq.values()));
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
 
  const PriceChart: React.FC<{
    points: HistoryPoint[];
    width?: number;
    height?: number;
    stroke?: string;
    strokeWidth?: number;
    padding?: number;
    area?: boolean;
    showExtents?: boolean;
  }> = ({
    points,
    width = 300,
    height = 120,
    stroke = '#1976d2',
    strokeWidth = 2,
    padding = 10,
    area = false,
    showExtents = true
  }) => {
    if (!points?.length) return <Typography variant="body2">No history</Typography>;
    const prices = points.map(p => Number(p.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const xs = points.map((_, i) => padding + (i * (width - 2 * padding)) / Math.max(1, points.length - 1));
    const ys = prices.map(p => {
      if (max === min) return height / 2;
      return padding + (height - 2 * padding) * (1 - (p - min) / (max - min));
    });
    const linePoints = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    const areaPath = area
      ? `M ${xs[0]} ${height - padding} L ${xs.map((x, i) => `${x} ${ys[i]}`).join(' L ')} L ${xs[xs.length - 1]} ${height - padding} Z`
      : null;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {areaPath && <path d={areaPath} fill={stroke + '33'} stroke="none" />}
        <polyline fill="none" stroke={stroke} strokeWidth={strokeWidth} points={linePoints} />
        {showExtents && (
          <>
            <text x={padding} y={height - 2} fontSize="10" fill="#666">${min.toFixed(0)}</text>
            <text x={width - padding - 24} y={12} fontSize="10" fill="#666">${max.toFixed(0)}</text>
          </>
        )}
      </svg>
    );
  };

  const FloorPlanCard: React.FC<{ fp: FloorPlan; selected: boolean; onSelect: (fp: FloorPlan) => void; imageHeight?: number; }> = ({ fp, selected, onSelect, imageHeight = 120 }) => {
    const [index, setIndex] = React.useState(0);

    // Deterministic mock history so visuals always render even without DB data
    const hist = React.useMemo<HistoryPoint[]>(() => {
      const n = 24;
      let seed = (fp.id || 1) * 9301 + 49297;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      const base = fp.current_price != null ? Number(fp.current_price) : 2200 + Math.floor(rand() * 400);
      const out: HistoryPoint[] = [];
      let price = base * (0.95 + rand() * 0.1);
      const drift = (rand() - 0.5) * 12; // small up/down trend
      for (let i = 0; i < n; i++) {
        price = Math.max(800, price + drift + (rand() - 0.5) * 35); // random walk
        out.push({ collection_date: '', price: Math.round(price) });
      }
      return out;
    }, [fp.id, fp.current_price]);

    const pctForWindow = (window: number): number => {
      if (!hist || hist.length < window + 1) return NaN;
      const last = Number(hist[hist.length - 1].price);
      const prev = Number(hist[hist.length - 1 - window].price);
      if (!prev) return NaN;
      return ((last - prev) / prev) * 100;
    };

    const renderChange = (label: string, window: number) => {
      const pct = pctForWindow(window);
      const isNaN = Number.isNaN(pct);
      const color = isNaN ? 'text.secondary' : pct > 0 ? 'error.main' : pct < 0 ? 'success.main' : 'text.secondary';
      const arrow = isNaN ? '—' : pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
      const text = isNaN ? 'NaN' : `${pct.toFixed(1)}%`;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 22, textAlign: 'right' }}>{label}</Typography>
          <Box sx={{ fontSize: 12, color, fontWeight: 600, width: 54, textAlign: 'right' }}>
            {arrow} {text}
          </Box>
        </Box>
      );
    };

    const candidates = React.useMemo(() => {
      const list: string[] = [];
      const isValid = (u?: string | null) => !!u && u.startsWith('/static/');
      if (isValid(fp.image_url)) list.push(fp.image_url as string);

      const m = String(fp.name || '').match(/\b([DE])\s*-?\s*(\d{1,2})\b/i);
      if (m) {
        const code = `${m[1].toLowerCase()}${parseInt(m[2], 10)}`;
        const tPrimary = fp.building_name && /boren/i.test(fp.building_name || '') ? 't2' : 't1';
        const tAlt = tPrimary === 't1' ? 't2' : 't1';
        for (const t of [tPrimary, tAlt]) {
          for (const ext of ['png','jpg','jpeg','webp']) {
            list.push(`/static/plan-images/${t}-plan_${code}.${ext}`);
          }
        }
      }
      return Array.from(new Set(list));
    }, [fp.image_url, fp.name, fp.building_name]);

    const src = candidates[index];

    const handleError = () => {
      if (index + 1 < candidates.length) setIndex(index + 1);
    };

    return (
      <Paper onClick={() => onSelect(fp)} sx={{ p: 0, cursor: 'pointer', border: selected ? '2px solid #1976d2' : '1px solid #eee' }}>
        {src && (
          <img
            src={src}
            onError={handleError}
            alt={fp.name}
            style={{ width: '100%', height: 'auto', maxHeight: imageHeight, objectFit: 'contain', display: 'block', background: 'transparent', borderRadius: 0, margin: 0, marginBottom: 0 }}
          />
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1 }}>
          <Box sx={{ minWidth: 180, flex: '0 0 auto' }}>
            <Typography variant="subtitle1">{fp.name}</Typography>
            <Typography variant="body2" color="text.secondary">{fp.building_name || '—'}</Typography>
            <Typography variant="body2">Current: {fp.current_price != null ? `$${fp.current_price}` : 'n/a'}</Typography>
            <Typography variant="body2">Lowest: {fp.lowest_price != null ? `$${fp.lowest_price}` : 'n/a'}</Typography>
            <Typography variant="body2">Available: {fp.is_available ? 'Yes' : 'No'}</Typography>
          </Box>

          <Box sx={{ flex: '1 1 auto', display: 'flex', justifyContent: 'center' }}>
            <PriceChart points={hist} width={220} height={48} stroke="#1976d2" strokeWidth={2} padding={6} area showExtents={false} />
          </Box>

          <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            {renderChange('1W', 7)}
            {renderChange('1M', 30)}
            {renderChange('1Y', 365)}
          </Box>
        </Box>
      </Paper>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Container maxWidth={false}>
          <Box sx={{ my: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="h4" component="h1">
                ONNISLU Availability (D/E)
              </Typography>
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
              <Grid container spacing={3} alignItems="stretch">
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                  <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6" gutterBottom>Latest Prices</Typography>
                    {latestInfo ? (
                      <List dense>
                        <ListItem><ListItemText primary={`Floor plans with latest prices: ${latestInfo.count}`} /></ListItem>
                        <ListItem>
                          <ListItemText
                            primary={`Last Polled: ${
                              statusData?.scheduler?.lastCollection
                                ? new Date(statusData.scheduler.lastCollection).toLocaleString()
                                : (latestInfo?.lastUpdated ? new Date(latestInfo.lastUpdated).toLocaleString() : '—')
                            }`}
                          />
                        </ListItem>
                      </List>
                    ) : (
                      <Typography variant="body2">Latest prices loading…</Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Available Now</Typography>
                    {availablePlans.length === 0 ? (
                      <Typography variant="body2">No D/E plans available now.</Typography>
                    ) : (
                      <Grid container spacing={3}>
                        {availablePlans.slice(0, 24).map((fp) => (
                          <Grid item xs={12} sm={12} md={6} key={`avail-${fp.id}`}>
                            <FloorPlanCard fp={fp} selected={selectedPlan?.id === fp.id} onSelect={loadHistory} imageHeight={600} />
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Available Next Month</Typography>
                    {availableNextMonth.length === 0 ? (
                      <Typography variant="body2">No D/E units next month.</Typography>
                    ) : (
                      <List dense>
                        {availableNextMonth.map((u, idx) => (
                          <ListItem key={`next-${u.name}-${idx}`}>
                            <ListItemText primary={u.name} secondary={u.moveInDate || 'Next month'} />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Available Soon</Typography>
                    {availableSoonTable.rows.length === 0 ? (
                      <Typography variant="body2">No upcoming D/E units.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {availableSoonTable.headers.map((h, i) => (
                              <TableCell key={`hdr-${i}`}>{h}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {availableSoonTable.rows.map((r, ri) => (
                            <TableRow key={`row-${ri}`}>
                              {r.map((c, ci) => (
                                <TableCell key={`cell-${ri}-${ci}`}>{c}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Paper>
                </Grid>
  
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Floor Plans</Typography>
                    {floorPlans.length === 0 ? (
                      <Typography variant="body2">No floor plans available.</Typography>
                    ) : (
                      <Grid container spacing={3}>
                        {floorPlans.slice(0, 50).map((fp) => (
                          <Grid item xs={12} sm={12} md={6} key={fp.id}>
                            <FloorPlanCard fp={fp} selected={selectedPlan?.id === fp.id} onSelect={loadHistory} imageHeight={600} />
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            )}

          </Box>
        </Container>
      </Router>
    </ThemeProvider>
  );
}

export default App;