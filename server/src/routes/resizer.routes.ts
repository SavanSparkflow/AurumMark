import { Router } from 'express';
import { ResizerController } from '../controllers/resizerController.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireCompanyWorkspace } from '../middlewares/role.js';

const router = Router();

router.use(requireAuth, requireCompanyWorkspace);

// List available platform presets
router.get('/presets', ResizerController.getPresets);

// Export single platform preset image stream
router.post('/export-single', ResizerController.exportSingle);

// Export multiple selected platform presets as a ZIP bundle
router.post('/export-bundle', ResizerController.exportBundle);

// Batch export multiple selected designs across presets into a master ZIP
router.post('/export-batch-bundle', ResizerController.exportBatchBundle);

export default router;

