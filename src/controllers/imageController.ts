import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export const serveImage = async (req: Request, res: Response) => {
  try {
    const { folderType, clientCode, storeId, fileName } = req.params;
    
    // Try local file first
    const localPath = path.join(process.cwd(), 'uploads', folderType, clientCode, storeId, fileName);
    
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }
    
    // Try /tmp directory for serverless
    const tmpPath = path.join('/tmp', 'uploads', folderType, clientCode, storeId, fileName);
    
    if (fs.existsSync(tmpPath)) {
      return res.sendFile(tmpPath);
    }
    
    // If file not found locally, redirect to FTPS URL
    const ftpsUrl = `${process.env.BASE_PUBLIC_URL}/${folderType}/${clientCode}/${storeId}/${fileName}`;
    return res.redirect(ftpsUrl);
    
  } catch (error: any) {
    console.error('Image serve error:', error);
    res.status(404).json({ message: 'Image not found' });
  }
};