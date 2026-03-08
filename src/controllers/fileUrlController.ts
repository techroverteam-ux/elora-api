import { Request, Response } from 'express';
import enhancedUploadService from '../../utils/enhancedUploadService';

// Convert relative path to full URL
export const convertPathToUrl = async (req: Request, res: Response) => {
  try {
    const { relativePath } = req.body;
    
    if (!relativePath) {
      return res.status(400).json({ message: 'relativePath is required' });
    }
    
    const fullUrl = enhancedUploadService.convertRelativePathToFullUrl(relativePath);
    const pathComponents = enhancedUploadService.parseRelativePath(relativePath);
    
    res.status(200).json({
      relativePath,
      fullUrl,
      components: pathComponents
    });
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Failed to convert path', 
      error: error.message 
    });
  }
};

// Get full URL for viewing/editing
export const getFileUrl = async (req: Request, res: Response) => {
  try {
    const { relativePath } = req.query;
    
    if (!relativePath || typeof relativePath !== 'string') {
      return res.status(400).json({ message: 'relativePath query parameter is required' });
    }
    
    const fullUrl = enhancedUploadService.convertRelativePathToFullUrl(relativePath);
    
    res.status(200).json({
      success: true,
      relativePath,
      fullUrl
    });
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Failed to get file URL', 
      error: error.message 
    });
  }
};