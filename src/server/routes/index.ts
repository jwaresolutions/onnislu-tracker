import { Router } from 'express';
import floorPlansRouter from './floorPlans';
import pricesRouter from './prices';
import alertsRouter from './alerts';
import exportRouter from './export';
import statusRouter from './status';
import availabilityRouter from './availability';
import scraperRouter from './scraper';
import settingsRouter from './settings';

const router = Router();

// Mount all route modules
router.use('/floorplans', floorPlansRouter);
router.use('/prices', pricesRouter);
router.use('/alerts', alertsRouter);
router.use('/export', exportRouter);
router.use('/status', statusRouter);
router.use('/availability', availabilityRouter);
router.use('/scraper', scraperRouter);
router.use('/settings', settingsRouter);

export default router;