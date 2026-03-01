import { Request, Response } from 'express';
import { checkConfiguration, validateFTPSConfig } from '../utils/configChecker';
import enhancedUploadService from '../utils/enhancedUploadService';

export const getConfigStatus = (req: Request, res: Response) => {
  try {
    const config = checkConfiguration();
    const ftpsValid = validateFTPSConfig();
    const storageType = enhancedUploadService.getStorageType();

    res.status(200).json({
      message: 'Configuration status',
      config: {
        ...config,
        ftpPassword: config.ftpPassword === '***set***' ? true : false
      },
      validation: {
        ftpsConfigValid: ftpsValid,
        currentStorageType: storageType
      },
      recommendations: ftpsValid ? 
        ['FTPS configuration is valid'] : 
        [
          'Set STORAGE_TYPE=ftps in environment variables',
          'Ensure FTP_HOST, FTP_USER, FTP_PASSWORD are set',
          'Ensure BASE_PUBLIC_PATH and BASE_PUBLIC_URL are set'
        ]
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to check configuration',
      error: error.message
    });
  }
};