// Configuration checker utility
export const checkConfiguration = () => {
  const config = {
    storageType: process.env.STORAGE_TYPE || 'local',
    ftpHost: process.env.FTP_HOST || 'not set',
    ftpUser: process.env.FTP_USER || 'not set',
    ftpPassword: process.env.FTP_PASSWORD ? '***set***' : 'not set',
    basePublicPath: process.env.BASE_PUBLIC_PATH || 'not set',
    basePublicUrl: process.env.BASE_PUBLIC_URL || 'not set',
    nodeEnv: process.env.NODE_ENV || 'development'
  };

  console.log('=== Configuration Check ===');
  console.log(JSON.stringify(config, null, 2));
  console.log('===========================');

  return config;
};

export const validateFTPSConfig = (): boolean => {
  const required = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'BASE_PUBLIC_PATH', 'BASE_PUBLIC_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing FTPS configuration:', missing);
    return false;
  }
  
  return true;
};