import { Router } from 'express';
import { convertPathToUrl, getFileUrl } from '../controllers/fileUrlController';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/v1/files/convert-path - Convert relative path to full URL
router.post('/convert-path', protect, convertPathToUrl);

// GET /api/v1/files/url?relativePath=... - Get full URL for viewing
router.get('/url', protect, getFileUrl);

export default router;