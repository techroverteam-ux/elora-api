# File Upload Flow - Visual Guide

## Current Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                            │
│                   https://elora-web.vercel.app                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ POST /api/v1/stores/{id}/recce
                                  │ FormData: files + metadata
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Vercel)                             │
│                  https://elora-api-smoky.vercel.app                  │
│                                                                       │
│  1. Receive files in store.controller.ts                            │
│  2. Call enhancedUploadService.uploadFile()                         │
│  3. Map folderType: recce → recce-images                            │
│  4. Generate unique filename with timestamp                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ FTPS Upload
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CPANEL FTP SERVER                               │
│                   ftp.enamorimpex.com                                │
│                                                                       │
│  Path: /eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/    │
│  File: 1772390394397_f308f21dd419ad04_initial_0.jpg                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Accessible via HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PUBLIC CDN URL                                  │
│              https://storage.enamorimpex.com                         │
│                                                                       │
│  URL: /uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Image loaded by browser
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND DISPLAYS IMAGE                           │
│                  <img src="https://..." />                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Folder Structure Mapping

```
┌──────────────────────┬──────────────────────┬─────────────────────────┐
│   Code FolderType    │   cPanel Folder      │   Example               │
├──────────────────────┼──────────────────────┼─────────────────────────┤
│   initial            │   recce-images       │   Initial site photos   │
│   recce              │   recce-images       │   Recce measurements    │
│   installation       │   installation-images│   After installation    │
└──────────────────────┴──────────────────────┴─────────────────────────┘
```

## Path Examples

### 1. Initial Photos (Before Recce)
```
Code:        initial
cPanel:      /eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/
Database:    uploads/recce-images/AKSAKS434494MUMMUMDLR001/initial_xxx.jpg
Public URL:  https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494MUMMUMDLR001/initial_xxx.jpg
```

### 2. Recce Photos (With Measurements)
```
Code:        recce
cPanel:      /eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/
Database:    uploads/recce-images/AKSAKS434494MUMMUMDLR001/recce_xxx.jpg
Public URL:  https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494MUMMUMDLR001/recce_xxx.jpg
```

### 3. Installation Photos (After Work)
```
Code:        installation
cPanel:      /eloraftp/uploads/installation-images/AKSAKS434494MUMMUMDLR001/
Database:    uploads/installation-images/AKSAKS434494MUMMUMDLR001/installation_xxx.jpg
Public URL:  https://storage.enamorimpex.com/uploads/installation-images/AKSAKS434494MUMMUMDLR001/installation_xxx.jpg
```

## Store ID Format

```
┌─────────────┬──────────────┬────────────────────────────┐
│ Client Code │  Store ID    │  Combined (Folder Name)    │
├─────────────┼──────────────┼────────────────────────────┤
│ AKSAKS434494│ MUMMUMDLR001 │ AKSAKS434494MUMMUMDLR001   │
│ BAR         │ 6100046168   │ BAR6100046168              │
│ JOD         │ 6100004530   │ JODJOD6100004530           │
└─────────────┴──────────────┴────────────────────────────┘
```

## File Naming Convention

```
{timestamp}_{randomHash}_{prefix}_{timestamp}_{index}.{ext}

Example:
1772390394397_f308f21dd419ad04_initial_1772390394397_0.jpg
│             │                  │       │             │
│             │                  │       │             └─ Index (0, 1, 2...)
│             │                  │       └─ Timestamp again
│             │                  └─ Prefix (initial/recce/installation)
│             └─ Random hash (16 chars)
└─ Timestamp (milliseconds)
```

## Database Structure

```json
{
  "storeId": "MUMMUMDLR001",
  "clientCode": "AKSAKS434494",
  "recce": {
    "initialPhotos": [
      "uploads/recce-images/AKSAKS434494MUMMUMDLR001/initial_xxx_0.jpg",
      "uploads/recce-images/AKSAKS434494MUMMUMDLR001/initial_xxx_1.jpg"
    ],
    "reccePhotos": [
      {
        "photo": "uploads/recce-images/AKSAKS434494MUMMUMDLR001/recce_xxx_0.jpg",
        "measurements": {
          "width": 30,
          "height": 40,
          "unit": "in"
        },
        "elements": [
          {
            "elementId": "699dc8fc51e4fdef3e4f6296",
            "elementName": "Product 1",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "installation": {
    "photos": [
      {
        "reccePhotoIndex": 0,
        "installationPhoto": "uploads/installation-images/AKSAKS434494MUMMUMDLR001/installation_xxx_0.jpg"
      }
    ]
  }
}
```

## URL Resolution Flow

```
Frontend needs to display image:
  ↓
Database path: "uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg"
  ↓
Frontend adds domain: "https://storage.enamorimpex.com/" + path
  ↓
Final URL: "https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg"
  ↓
Browser loads image from cPanel CDN
```

## Error Scenarios (Before Fix)

### ❌ Wrong Path
```
Code tried:     /uploads/recce/AKS/AKS434494/file.jpg
cPanel has:     /eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg
Result:         File not found ❌
```

### ❌ Malformed URL
```
Database:       https://storage.enamorimpex.com/uploads/recce/...
Frontend adds:  http://localhost:5000/ + database path
Result:         http://localhost:5000/https://storage.enamorimpex.com/... ❌
```

### ❌ Missing Elements
```
Code:           reccePhotos.push({ photo, measurements })
Database:       { photo: "...", measurements: {...}, elements: [] }
Result:         Elements not saved ❌
```

## Success Scenarios (After Fix)

### ✅ Correct Path
```
Code uploads:   /eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg
cPanel has:     /eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg
Result:         File uploaded successfully ✅
```

### ✅ Correct URL
```
Database:       uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg
Frontend adds:  https://storage.enamorimpex.com/ + path
Result:         https://storage.enamorimpex.com/uploads/recce-images/... ✅
```

### ✅ Elements Saved
```
Code:           reccePhotos.push({ photo, measurements, elements })
Database:       { photo: "...", measurements: {...}, elements: [{...}] }
Result:         Elements saved correctly ✅
```

## Testing Checklist

```
□ Upload recce with 2 initial photos
□ Upload recce with 2 recce photos (with measurements and elements)
□ Check cPanel: /eloraftp/uploads/recce-images/{CLIENTCODE}{STOREID}/
□ Verify 4 files exist in cPanel
□ View submitted recce in frontend
□ Verify all 4 images load (no 404 errors)
□ Check database record has elements array populated
□ Upload installation with 2 photos
□ Check cPanel: /eloraftp/uploads/installation-images/{CLIENTCODE}{STOREID}/
□ Verify installation images load in frontend
```

## Quick Reference

**FTP Details:**
- Host: `ftp.enamorimpex.com`
- User: `eloraftp@storage.enamorimpex.com`
- Path: `/eloraftp/uploads/`

**Public URL:**
- Base: `https://storage.enamorimpex.com/uploads/`
- Recce: `https://storage.enamorimpex.com/uploads/recce-images/{CLIENTCODE}{STOREID}/`
- Install: `https://storage.enamorimpex.com/uploads/installation-images/{CLIENTCODE}{STOREID}/`

**Environment Variables (Vercel):**
```
STORAGE_TYPE=ftps
FTP_HOST=ftp.enamorimpex.com
FTP_USER=eloraftp@storage.enamorimpex.com
FTP_PASSWORD=<your-password>
FTP_SECURE=true
```
