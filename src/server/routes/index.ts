import { Router } from 'express';
import floorPlansRouter from './floorPlans';
import pricesRouter from './prices';
import alertsRouter from './alerts';
import exportRouter from './export';
import statusRouter from './status';

const router = Router();

// Mount all route modules
router.use('/floorplans', floorPlansRouter);
router.use('/prices', pricesRouter);
router.use('/alerts', alertsRouter);
router.use('/export', exportRouter);
router.use('/status', statusRouter);

export default router;