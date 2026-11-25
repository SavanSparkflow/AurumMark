import { Router } from 'express';
import { ForensicController } from '../controllers/forensicController.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireCompanyWorkspace, requireRole } from '../middlewares/role.js';
import { upload } from '../middlewares/upload.js';

const router = Router();

router.use(requireAuth, requireCompanyWorkspace);

// Status
router.get('/status', ForensicController.getForensicStatus);

// Upload suspicious leaked image/screenshot for steganography forensic analysis
router.post(
  '/detect-leak',
  requireRole('Company', 'Designer'),
  upload.single('file'),
  ForensicController.detectLeak
);

export default router;

