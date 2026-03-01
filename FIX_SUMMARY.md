# File Upload Fix - Summary

## Problems Identified

1. **Files not uploading to cPanel** - Wrong FTP path structure
2. **Elements not saved** - Missing field in recce photo object
3. **Malformed URLs** - Double protocol in image URLs
4. **Folder mismatch** - Code vs cPanel structure different

## Solutions Implemented

### 1. Fixed Upload Path Structure

**Before:**
```
/uploads/{folderType}/{clientCode}/{storeId}/
Example: /uploads/recce/AKS/AKS434494/file.jpg
```

**After:**
```
/eloraftp/uploads/{folderType}-images/{clientCode}{storeId}/
Example: /eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg
```

### 2. Fixed Folder Type Mapping

- `initial` → `recce-images`
- `recce` → `recce-images`  
- `installation` → `installation-images`

### 3. Fixed URL Generation

**Before:**
```javascript
return `${process.env.BASE_PUBLIC_URL}/${folderType}/${clientCode}/${storeId}/${fileName}`;
// Result: https://storage.enamorimpex.com/uploads/recce/AKS/AKS434494/file.jpg
```

**After:**
```javascript
return `uploads/${ftpFolderType}/${clientCode}${storeId}/${fileName}`;
// Result: uploads/recce-images/AKSAKS434494MUMMUMDLR001/file.jpg
// Frontend/Image controller adds domain
```

### 4. Fixed Image Serving

**Image Controller now:**
- Tries local file first
- Falls back to FTPS redirect
- Uses correct path: `https://storage.enamorimpex.com/uploads/recce-images/...`

### 5. Added Elements Field

```javascript
reccePhotos.push({
  photo: link,
  measurements: { width, height, unit },
  elements: photoData.elements || [], // ✅ ADDED THIS
});
```

## Files Changed

1. ✅ `src/utils/enhancedUploadService.ts`
   - uploadToFTPS() - Fixed path
   - uploadToLocal() - Fixed path
   - deleteFile() - Fixed path
   - getFileUrl() - Fixed URL generation

2. ✅ `src/modules/store/store.controller.ts`
   - submitRecce() - Added elements field

3. ✅ `src/controllers/imageController.ts`
   - serveImage() - Fixed path and URL

4. ✅ `.env.production` - Created with correct settings

5. ✅ `DEPLOYMENT_GUIDE.md` - Complete deployment instructions

## Deployment Checklist

### Before Deployment
- [ ] Get actual FTP password from cPanel
- [ ] Verify cPanel folder structure exists
- [ ] Backup current code

### Deployment
- [ ] Update Vercel environment variables
- [ ] Set `STORAGE_TYPE=ftps`
- [ ] Set FTP credentials
- [ ] Push code to GitHub
- [ ] Wait for Vercel auto-deploy

### After Deployment
- [ ] Test recce upload
- [ ] Check files in cPanel
- [ ] Verify images load in frontend
- [ ] Check elements are saved
- [ ] Monitor Vercel logs

## Testing

### Local Testing
```bash
# Update .env
STORAGE_TYPE=ftps
FTP_HOST=ftp.enamorimpex.com
FTP_USER=eloraftp@storage.enamorimpex.com
FTP_PASSWORD=<password>
FTP_SECURE=true

# Run server
npm run dev

# Test
node test-recce-installation-api.js
```

### Production Testing
1. Go to https://elora-web.vercel.app/
2. Upload recce for a store
3. Check cPanel File Manager
4. View submitted recce
5. Verify images load

## Expected Results

### Upload Request
```
POST /api/v1/stores/{id}/recce
Files: initialPhoto0, initialPhoto1, reccePhoto0, reccePhoto1
```

### Database Record
```json
{
  "recce": {
    "initialPhotos": [
      "uploads/recce-images/AKSAKS434494MUMMUMDLR001/file1.jpg"
    ],
    "reccePhotos": [
      {
        "photo": "uploads/recce-images/AKSAKS434494MUMMUMDLR001/file2.jpg",
        "measurements": { "width": 30, "height": 40, "unit": "in" },
        "elements": [
          { "elementId": "...", "elementName": "Product 1", "quantity": 1 }
        ]
      }
    ]
  }
}
```

### cPanel Files
```
/eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/
  ├── 1772390394397_f308f21dd419ad04_initial_1772390394397_0.jpg
  ├── 1772390394403_bec31c73bb813937_initial_1772390394403_1.jpg
  └── 1772390394410_cceb17fdfb249199_recce_1772390394410_0.jpg
```

### Frontend Image URLs
```
https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494MUMMUMDLR001/1772390394397_f308f21dd419ad04_initial_1772390394397_0.jpg
```

## Quick Commands

```bash
# Deploy
git add .
git commit -m "Fix: File upload paths for cPanel FTPS"
git push origin main

# Test locally
npm run dev
node test-recce-installation-api.js

# Check logs
vercel logs <deployment-url>
```

## Rollback

If issues occur:
```bash
git revert HEAD
git push origin main
```

Set in Vercel: `STORAGE_TYPE=local`

## Success Indicators

✅ Files appear in cPanel after upload
✅ Images load in frontend (no 404 errors)
✅ Elements saved in database
✅ No malformed URLs in console
✅ Correct folder structure in cPanel

## Next Steps

1. Deploy to Vercel
2. Test with real uploads
3. Monitor for 24 hours
4. Update frontend if needed
5. Document for team

---

**Ready to Deploy!** Follow DEPLOYMENT_GUIDE.md for step-by-step instructions.
