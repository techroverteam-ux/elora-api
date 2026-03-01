# File Upload API Testing Guide

## Overview
This document explains how to test the Recce and Installation file upload APIs in the Elora backend.

## Folder Structure

The system uses the following folder structure for uploads:

```
uploads/
├── {folderType}/
│   └── {clientCode}/
│       └── {storeId}/
│           └── {filename}
```

### Folder Types
- `initial` - Initial photos before recce
- `recce` - Recce inspection photos with measurements
- `installation` - Installation completion photos

### Example Paths
- `uploads/initial/BAR/6100046168/initial_1772391633749_abc123_photo.jpg`
- `uploads/recce/BAR/6100046168/recce_1772391633742_def456_photo.jpg`
- `uploads/installation/JOD/6100004530/installation_1772391633745_ghi789_photo.jpg`

## API Endpoints

### 1. Submit Recce
**Endpoint:** `POST /api/v1/stores/:id/recce`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Form Data:**
- `initialPhotosCount` (string) - Number of initial photos (e.g., "2")
- `initialPhoto0` (file) - First initial photo
- `initialPhoto1` (file) - Second initial photo
- `reccePhotosData` (JSON string) - Array of recce photo metadata
- `reccePhoto0` (file) - First recce photo
- `reccePhoto1` (file) - Second recce photo
- `notes` (string) - Optional notes

**reccePhotosData Format:**
```json
[
  {
    "width": 10,
    "height": 8,
    "unit": "ft",
    "elements": ["Banner", "Signage"]
  },
  {
    "width": 12,
    "height": 10,
    "unit": "ft",
    "elements": ["Display"]
  }
]
```

**Response:**
```json
{
  "message": "Recce submitted successfully"
}
```

### 2. Submit Installation
**Endpoint:** `POST /api/v1/stores/:id/installation`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Form Data:**
- `installationPhotosData` (JSON string) - Array of installation photo metadata
- `installationPhoto0` (file) - First installation photo
- `installationPhoto1` (file) - Second installation photo

**installationPhotosData Format:**
```json
[
  {
    "reccePhotoIndex": 0
  },
  {
    "reccePhotoIndex": 1
  }
]
```

**Response:**
```json
{
  "message": "Installation submitted successfully"
}
```

## Testing Scripts

### 1. Test Folder Structure (No API calls)
```bash
node test-folder-structure.js
```

This script:
- Creates test folders in the correct structure
- Generates minimal test images
- Verifies the folder structure
- Lists all created files

### 2. Test Recce & Installation APIs (Full API test)
```bash
node test-recce-installation-api.js
```

This script:
1. Logs in to get authentication token
2. Creates or fetches a test store
3. Submits recce with initial and recce photos
4. Submits installation photos
5. Verifies folder structure
6. Retrieves store details to confirm uploads

**Prerequisites:**
- Backend server must be running on `http://localhost:5000`
- Valid login credentials (update in script if needed)
- MongoDB connection active

## Storage Configuration

The system supports two storage types configured via `.env`:

### Local Storage (Default)
```env
STORAGE_TYPE=local
```
Files are stored in `./uploads/` directory

### FTPS Storage
```env
STORAGE_TYPE=ftps
FTP_HOST=your-ftp-host.com
FTP_USER=your-username
FTP_PASSWORD=your-password
FTP_SECURE=true
BASE_PUBLIC_PATH=/storage/uploads
BASE_PUBLIC_URL=https://your-cdn.com/uploads
```

## File Naming Convention

Files are automatically renamed with the following pattern:
```
{timestamp}_{randomHash}_{originalName}
```

Example:
```
1772391633742_abc123def456_photo.jpg
```

## Implementation Details

### Upload Service
The `enhancedUploadService.ts` handles file uploads with:
- Automatic folder creation
- Unique filename generation
- Support for local and FTPS storage
- Fallback to local storage if FTPS fails

### Controller Logic
The `store.controller.ts` handles:
- Parsing multipart form data
- Validating store existence
- Generating storeId if missing
- Uploading files via enhancedUploadService
- Updating store records in database

## Frontend Integration Guide

### Recce Submission Example

```javascript
const submitRecce = async (storeId, initialPhotos, reccePhotos, notes) => {
  const formData = new FormData();
  
  // Add initial photos
  formData.append('initialPhotosCount', initialPhotos.length.toString());
  initialPhotos.forEach((photo, index) => {
    formData.append(`initialPhoto${index}`, photo);
  });
  
  // Add recce photos with metadata
  const reccePhotosData = reccePhotos.map(photo => ({
    width: photo.width,
    height: photo.height,
    unit: photo.unit,
    elements: photo.elements
  }));
  
  formData.append('reccePhotosData', JSON.stringify(reccePhotosData));
  reccePhotos.forEach((photo, index) => {
    formData.append(`reccePhoto${index}`, photo.file);
  });
  
  formData.append('notes', notes);
  
  const response = await fetch(`/api/v1/stores/${storeId}/recce`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};
```

### Installation Submission Example

```javascript
const submitInstallation = async (storeId, installationPhotos) => {
  const formData = new FormData();
  
  // Add installation photos with recce photo mapping
  const installationPhotosData = installationPhotos.map(photo => ({
    reccePhotoIndex: photo.reccePhotoIndex
  }));
  
  formData.append('installationPhotosData', JSON.stringify(installationPhotosData));
  installationPhotos.forEach((photo, index) => {
    formData.append(`installationPhoto${index}`, photo.file);
  });
  
  const response = await fetch(`/api/v1/stores/${storeId}/installation`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};
```

## Troubleshooting

### Issue: Files not uploading
- Check if backend server is running
- Verify authentication token is valid
- Check file size limits (default: 10MB)
- Ensure file types are allowed (.jpg, .jpeg, .png, .pdf)

### Issue: Folder structure not created
- Check write permissions on uploads directory
- Verify STORAGE_TYPE in .env
- Check server logs for errors

### Issue: FTPS connection fails
- Verify FTP credentials in .env
- Check FTP_SECURE setting
- System will fallback to local storage automatically

## Next Steps

1. ✅ Test folder structure creation (completed)
2. ⏳ Test API endpoints with authentication
3. ⏳ Implement frontend upload components
4. ⏳ Add progress indicators
5. ⏳ Add image preview before upload
6. ⏳ Add validation for image dimensions

## Notes

- All file uploads require authentication
- Files are validated for type and size
- Unique filenames prevent overwrites
- System automatically creates folder structure
- FTPS storage has automatic fallback to local storage
