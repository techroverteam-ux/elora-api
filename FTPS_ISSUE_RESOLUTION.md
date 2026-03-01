# FTPS Upload Issue Resolution

## Problem Description

The API was failing with error:
```
ENOENT: no such file or directory, mkdir '/var/task/uploads/initial/AKSAKS434494/PUNPUNDLR004'
```

## Root Cause Analysis

1. **Environment Variables Missing**: The production environment (Vercel) doesn't have the FTPS configuration environment variables set
2. **Fallback to Local Storage**: When FTPS config is missing, the system falls back to local storage mode
3. **Serverless Environment Limitation**: Vercel serverless functions have read-only file systems except for `/tmp` directory
4. **Directory Creation Failure**: The system was trying to create directories in `/var/task/` which is read-only

## Solution Implemented

### 1. Enhanced Configuration Validation
- Added `configChecker.ts` utility to validate FTPS configuration
- Enhanced `enhancedUploadService.ts` to properly validate config before choosing storage type
- Added logging to help debug configuration issues

### 2. Improved Error Handling
- Added fallback mechanism: if FTPS fails, automatically fall back to local storage
- Updated local storage to use `/tmp` directory in production environments
- Added comprehensive error logging

### 3. Configuration Status Endpoint
- Added `/api/v1/config` endpoint to check configuration status
- Helps debug environment variable issues in production

### 4. Code Changes Made

#### `src/utils/configChecker.ts` (New File)
```typescript
// Validates FTPS configuration and provides debugging info
export const checkConfiguration = () => { ... }
export const validateFTPSConfig = (): boolean => { ... }
```

#### `src/utils/enhancedUploadService.ts` (Updated)
- Enhanced constructor with proper validation
- Added fallback mechanism for FTPS failures
- Updated local storage to use `/tmp` in production
- Added comprehensive logging

#### `src/controllers/configController.ts` (New File)
```typescript
// Provides configuration status endpoint
export const getConfigStatus = (req: Request, res: Response) => { ... }
```

#### `src/app.ts` (Updated)
- Added `/api/v1/config` endpoint

## Required Actions for Production

### 1. Set Environment Variables in Vercel Dashboard

Navigate to your Vercel project dashboard and add these environment variables:

```bash
STORAGE_TYPE=ftps
FTP_HOST=ftp.enamorimpex.com
FTP_USER=eloraftp@storage.enamorimpex.com
FTP_PASSWORD=AkshayNeriya!@#2026
FTP_SECURE=true
BASE_PUBLIC_PATH=/uploads
BASE_PUBLIC_URL=https://storage.enamorimpex.com/uploads
BASE_LOCAL_URL=http://localhost:3000
```

### 2. Verify Configuration

After deployment, check the configuration status:
```bash
curl https://your-api-domain.vercel.app/api/v1/config
```

This will show:
- Current storage type being used
- Whether FTPS configuration is valid
- Recommendations if configuration is missing

### 3. Test File Upload

Test the recce submission endpoint to ensure files are being uploaded correctly.

## Fallback Behavior

If FTPS configuration is missing or fails:
1. System automatically falls back to local storage
2. Files are stored in `/tmp` directory (writable in Vercel)
3. Files are accessible via the API but not persistent across deployments
4. Logs will show the fallback occurred

## Monitoring and Debugging

### Check Configuration Status
```bash
GET /api/v1/config
```

### Check Logs
The enhanced logging will show:
- Storage type being used
- Configuration validation results
- Upload success/failure details
- Fallback occurrences

### Common Issues and Solutions

1. **"FTPS requested but configuration invalid"**
   - Solution: Set all required environment variables in Vercel

2. **"Failed to upload file locally"**
   - Solution: Check if `/tmp` directory is writable (should be in Vercel)

3. **Files not accessible after deployment**
   - Solution: Ensure FTPS is working, local storage is not persistent

## Testing Checklist

- [ ] Environment variables set in Vercel
- [ ] `/api/v1/config` shows FTPS as valid
- [ ] File upload works without errors
- [ ] Files are accessible via public URLs
- [ ] Logs show successful FTPS uploads

## Benefits of This Solution

1. **Robust Fallback**: System continues working even if FTPS fails
2. **Better Debugging**: Clear logging and status endpoints
3. **Production Ready**: Handles serverless environment limitations
4. **Maintainable**: Clear separation of concerns and validation logic