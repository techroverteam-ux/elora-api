# File Upload Fix - Deployment Guide

## Issues Fixed

### 1. ✅ Files Not Uploading to cPanel
**Problem:** Files were not appearing in cPanel FTP storage
**Solution:** 
- Fixed FTP path from `/uploads/{folderType}/{clientCode}/{storeId}/` 
- To: `/eloraftp/uploads/{folderType}-images/{clientCode}{storeId}/`
- Matches cPanel structure: `recce-images` and `installation-images`

### 2. ✅ Elements Not Being Saved
**Problem:** Elements array was empty in recce photos
**Solution:** Added `elements: photoData.elements || []` to recce photo object

### 3. ✅ Malformed Image URLs
**Problem:** URLs like `http://localhost:5000/https://storage.enamorimpex.com/...`
**Solution:** 
- Changed to return relative paths from upload service
- Updated image controller to handle proper redirects
- Hardcoded FTPS URL: `https://storage.enamorimpex.com/uploads/`

### 4. ✅ Folder Structure Mismatch
**Problem:** Code used `initial/recce/installation` but cPanel has `recce-images/installation-images`
**Solution:** 
- Map `initial` → `recce-images`
- Map `recce` → `recce-images`
- Map `installation` → `installation-images`

## Files Modified

1. `src/utils/enhancedUploadService.ts` - Upload paths and URL generation
2. `src/modules/store/store.controller.ts` - Elements field addition
3. `src/controllers/imageController.ts` - Image serving with correct paths
4. `.env.production` - Production environment variables

## Deployment Steps

### Step 1: Update Vercel Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add/Update these variables:

```
STORAGE_TYPE=ftps
FTP_HOST=ftp.enamorimpex.com
FTP_USER=eloraftp@storage.enamorimpex.com
FTP_PASSWORD=<YOUR_ACTUAL_FTP_PASSWORD>
FTP_SECURE=true
MONGO_URI=mongodb+srv://elora_crafting_arts:elora_crafting_arts%402026@elora-art.7osood6.mongodb.net/?appName=elora-art
JWT_SECRET=elora_jwt_secret_key_2024
JWT_REFRESH_SECRET=elora_jwt_refresh_secret_key_2024
```

### Step 2: Deploy to Vercel

```bash
cd elora-api-new
git add .
git commit -m "Fix: File upload paths and URL generation for cPanel FTPS"
git push origin main
```

Vercel will auto-deploy.

### Step 3: Verify cPanel Folder Structure

Ensure your cPanel has this structure:
```
storage.enamorimpex.com/
└── eloraftp/
    └── uploads/
        ├── recce-images/
        │   └── {CLIENTCODE}{STOREID}/
        │       └── files...
        └── installation-images/
            └── {CLIENTCODE}{STOREID}/
                └── files...
```

Example:
```
eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/
eloraftp/uploads/installation-images/AKSAKS434494MUMMUMDLR001/
```

### Step 4: Test Upload

1. Go to https://elora-web.vercel.app/
2. Login
3. Select a store
4. Upload recce with photos
5. Check cPanel - files should appear in correct folders
6. View submitted recce - images should load from `https://storage.enamorimpex.com/uploads/...`

## Expected Behavior After Fix

### Upload Flow
1. User uploads recce photos
2. Backend receives files
3. Files uploaded to: `/eloraftp/uploads/recce-images/{CLIENTCODE}{STOREID}/`
4. Database stores path: `uploads/recce-images/{CLIENTCODE}{STOREID}/{filename}`
5. Frontend displays images from: `https://storage.enamorimpex.com/uploads/recce-images/{CLIENTCODE}{STOREID}/{filename}`

### Example Paths

**Database stored path:**
```
uploads/recce-images/AKSAKS434494MUMMUMDLR001/1772390394397_f308f21dd419ad04_initial_1772390394397_0.jpg
```

**Actual FTP path:**
```
/eloraftp/uploads/recce-images/AKSAKS434494MUMMUMDLR001/1772390394397_f308f21dd419ad04_initial_1772390394397_0.jpg
```

**Public URL:**
```
https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494MUMMUMDLR001/1772390394397_f308f21dd419ad04_initial_1772390394397_0.jpg
```

## Troubleshooting

### Files Still Not Uploading?

1. **Check FTP Credentials**
   ```bash
   # Test FTP connection
   ftp ftp.enamorimpex.com
   # Login with: eloraftp@storage.enamorimpex.com
   ```

2. **Check Vercel Logs**
   - Go to Vercel Dashboard → Deployments → Latest → Logs
   - Look for FTP connection errors

3. **Check FTP Permissions**
   - Ensure `/eloraftp/uploads/` folder exists
   - Ensure write permissions are set

### Images Not Loading?

1. **Check Image URL in Browser**
   - Should be: `https://storage.enamorimpex.com/uploads/recce-images/...`
   - NOT: `http://localhost:5000/https://storage.enamorimpex.com/...`

2. **Check CORS on cPanel**
   - Add `.htaccess` in `/eloraftp/uploads/`:
   ```apache
   <IfModule mod_headers.c>
       Header set Access-Control-Allow-Origin "*"
   </IfModule>
   ```

3. **Check File Exists in cPanel**
   - Login to cPanel File Manager
   - Navigate to `/eloraftp/uploads/recce-images/`
   - Verify files are there

### Elements Still Empty?

Check the request payload format:
```json
{
  "reccePhotosData": "[{\"width\":\"30\",\"height\":\"40\",\"unit\":\"in\",\"elements\":[{\"elementId\":\"...\",\"elementName\":\"Product 1\",\"quantity\":1}]}]"
}
```

The elements should be inside each photo object in the array.

## Testing Locally

### Update Local .env
```env
STORAGE_TYPE=ftps
FTP_HOST=ftp.enamorimpex.com
FTP_USER=eloraftp@storage.enamorimpex.com
FTP_PASSWORD=<YOUR_PASSWORD>
FTP_SECURE=true
```

### Run Server
```bash
npm run dev
```

### Test Upload
```bash
node test-recce-installation-api.js
```

### Check cPanel
Files should appear in `/eloraftp/uploads/recce-images/` or `/installation-images/`

## Rollback Plan

If issues occur, revert these commits:
```bash
git revert HEAD
git push origin main
```

And set `STORAGE_TYPE=local` in Vercel until fixed.

## Success Criteria

- ✅ Files appear in cPanel after upload
- ✅ Images load in frontend when viewing recce
- ✅ Elements are saved in database
- ✅ No malformed URLs in browser console
- ✅ Folder structure matches: `{folderType}-images/{CLIENTCODE}{STOREID}/`

## Next Steps After Deployment

1. Monitor first few uploads
2. Check Vercel logs for any errors
3. Verify file sizes and types are correct
4. Test with different stores and clients
5. Test installation uploads as well

## Support

If issues persist:
1. Check Vercel deployment logs
2. Check cPanel FTP logs
3. Test FTP connection manually
4. Verify environment variables are set correctly
