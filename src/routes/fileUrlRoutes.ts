import { Router } from 'express';
import { convertPathToUrl, getFileUrl } from '../controllers/fileUrlController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/v1/files/convert-path - Convert relative path to full URL
router.post('/convert-path', authenticateToken, convertPathToUrl);

// GET /api/v1/files/url?relativePath=... - Get full URL for viewing
router.get('/url', authenticateToken, getFileUrl);

export default router;