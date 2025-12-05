import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Import middleware and routes
import { requestLogger } from '../middleware/requestLogger';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import apiRoutes from '../routes';

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  
  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  
  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Status Endpoint', () => {
    it('should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          isHealthy: true,
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          version: expect.any(String),
          environment: expect.any(String),
          database: expect.objectContaining({
            connected: expect.any(Boolean),
            message: expect.any(String)
          }),
          scheduler: expect.objectContaining({
            running: expect.any(Boolean),
            message: expect.any(String)
          }),
          scraper: expect.objectContaining({
            status: expect.any(String),
            message: expect.any(String)
          })
        })
      });
    });
  });

  describe('Floor Plans Endpoints', () => {
    it('should get all floor plans', async () => {
      const response = await request(app)
        .get('/api/floorplans')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          floorPlans: expect.any(Array),
          message: expect.any(String)
        })
      });
    });

    it('should get specific floor plan by ID', async () => {
      const response = await request(app)
        .get('/api/floorplans/1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          floorPlan: null, // Will be actual data when database is implemented
          message: expect.any(String)
        })
      });
    });

    it('should validate floor plan ID parameter', async () => {
      const response = await request(app)
        .get('/api/floorplans/invalid')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data'
        })
      });
    });

    it('should get floor plan price history', async () => {
      const response = await request(app)
        .get('/api/floorplans/1/history')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          history: expect.any(Array),
          message: expect.any(String)
        })
      });
    });

    it('should validate date range query parameters', async () => {
      const response = await request(app)
        .get('/api/floorplans/1/history?start=invalid-date')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          type: 'VALIDATION_ERROR'
        })
      });
    });
  });

  describe('Prices Endpoints', () => {
    it('should get latest prices', async () => {
      const response = await request(app)
        .get('/api/prices/latest')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          prices: expect.any(Array),
          lastUpdated: expect.any(String),
          message: expect.any(String)
        })
      });
    });

    it('should get price history with date range', async () => {
      const response = await request(app)
        .get('/api/prices/history?start=2024-01-01&end=2024-12-31&limit=100')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          history: expect.any(Array),
          dateRange: expect.objectContaining({
            start: '2024-01-01',
            end: '2024-12-31'
          }),
          message: expect.any(String)
        })
      });
    });
  });

  describe('Alerts Endpoints', () => {
    it('should get active alerts', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          alerts: expect.any(Array),
          message: expect.any(String)
        })
      });
    });

    it('should update alert settings', async () => {
      const alertSettings = {
        thresholdType: 'percentage',
        thresholdValue: 10
      };

      const response = await request(app)
        .post('/api/alerts/settings')
        .send(alertSettings)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          settings: alertSettings,
          message: expect.any(String)
        })
      });
    });

    it('should validate alert settings', async () => {
      const invalidSettings = {
        thresholdType: 'invalid',
        thresholdValue: -5
      };

      const response = await request(app)
        .post('/api/alerts/settings')
        .send(invalidSettings)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          type: 'VALIDATION_ERROR'
        })
      });
    });

    it('should dismiss alert', async () => {
      const response = await request(app)
        .delete('/api/alerts/1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          alertId: 1, // API returns number, not string
          dismissed: true
        })
      });
    });
  });

  describe('Export Endpoints', () => {
    it('should handle CSV export request', async () => {
      const response = await request(app)
        .get('/api/export/csv')
        .expect(200)
        .expect('Content-Type', /text\/csv/);

      // Verify Content-Disposition header contains filename
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="price_history_\d{8}_\d{6}\.csv"/);
      
      // Verify response is text (CSV)
      expect(typeof response.text).toBe('string');
      
      // Verify CSV has header row
      const lines = response.text.split('\n');
      expect(lines[0]).toContain('floor_plan');
      expect(lines[0]).toContain('building');
      expect(lines[0]).toContain('date');
      expect(lines[0]).toContain('price');
      expect(lines[0]).toContain('is_available');
      expect(lines[0]).toContain('sqft');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          type: 'NOT_FOUND',
          message: expect.stringContaining('Route GET /api/nonexistent not found')
        })
      });
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/alerts/settings')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express automatically handles malformed JSON
      expect(response.status).toBe(400);
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields in request body', async () => {
      const response = await request(app)
        .post('/api/alerts/settings')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          type: 'VALIDATION_ERROR'
        })
      });
    });

    it('should validate numeric parameters', async () => {
      const response = await request(app)
        .get('/api/floorplans/0') // Invalid ID (must be positive)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          type: 'VALIDATION_ERROR'
        })
      });
    });
  });
});