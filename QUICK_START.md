# Quick Start - Test File Upload APIs

## 🚀 Fastest Way to Test (5 minutes)

### Step 1: Test Folder Structure (No server needed)
```bash
cd elora-api-new
node test-folder-structure.js
```

**Expected Output:**
```
✅ File created: uploads/recce/BAR/6100046168/recce_test_xxx.jpg
✅ File created: uploads/installation/JOD/6100004530/installation_test_xxx.jpg
✅ File created: uploads/initial/TEST/STORE001/initial_test_xxx.jpg
```

### Step 2: Start Backend Server
```bash
# Terminal 1
cd elora-api-new
npm run dev
```

Wait for: `Server running on port 5000`

### Step 3: Test with Postman (Easiest)

1. **Import Collection**
   - Open Postman
   - Click "Import"
   - Select `Elora_Upload_APIs.postman_collection.json`

2. **Run Tests in Order**
   - ✅ 1. Authentication → Login
   - ✅ 2. Store Management → Get All Stores
   - ✅ 3. Recce Submission → Submit Recce with Photos
     - Click on each file field
     - Select test images from `test-images/` folder
   - ✅ 4. Installation Submission → Submit Installation with Photos
     - Select test images

3. **Check Results**
   - Look in `uploads/` folder
   - Files should be organized by type/client/store

## 📝 Alternative: Test with Script

```bash
# Terminal 2 (keep server running in Terminal 1)
cd elora-api-new
node test-recce-installation-api.js
```

**Note:** Update login credentials in script if needed (lines 15-16)

## 🔍 Verify Results

### Check Folder Structure
```bash
# Windows
dir uploads /s

# Or use the test script
node test-folder-structure.js
```

### Check Database
```javascript
// In MongoDB Compass or Shell
db.stores.findOne({ _id: ObjectId("YOUR_STORE_ID") })
```

Look for:
- `recce.photos[]` - Should have uploaded photos
- `recce.initialPhotos[]` - Should have initial photos
- `installation.photos[]` - Should have installation photos

## 📊 Expected Folder Structure

After successful upload:
```
uploads/
├── initial/
│   └── {clientCode}/
│       └── {storeId}/
│           └── initial_1234567890_abc123_photo.jpg
├── recce/
│   └── {clientCode}/
│       └── {storeId}/
│           └── recce_1234567890_def456_photo.jpg
└── installation/
    └── {clientCode}/
        └── {storeId}/
            └── installation_1234567890_ghi789_photo.jpg
```

## ⚡ Quick Commands Reference

```bash
# Start server
npm run dev

# Test folder structure
node test-folder-structure.js

# Test full API
node test-recce-installation-api.js

# Check uploads folder
dir uploads /s

# Clean test files
rmdir /s /q uploads\initial\TEST
rmdir /s /q uploads\recce\BAR
rmdir /s /q uploads\installation\JOD
```

## 🐛 Common Issues

### Issue: "Cannot find module 'form-data'"
```bash
npm install form-data --save-dev
```

### Issue: "Login failed"
Update credentials in `test-recce-installation-api.js`:
```javascript
email: 'your-email@example.com',
password: 'your-password'
```

### Issue: "Store not found"
The script will automatically use the first available store. If no stores exist:
1. Create a store via Postman or frontend
2. Or update the script with a valid store ID

### Issue: "Port 5000 already in use"
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or change port in .env
PORT=5001
```

## ✅ Success Checklist

- [ ] Folder structure test passes
- [ ] Server starts without errors
- [ ] Login returns token
- [ ] Get stores returns data
- [ ] Recce upload succeeds
- [ ] Installation upload succeeds
- [ ] Files appear in uploads folder
- [ ] Database records updated

## 📚 Next Steps

1. ✅ Backend testing complete
2. ⏳ Implement frontend upload forms
3. ⏳ Add progress indicators
4. ⏳ Add image preview
5. ⏳ Add validation

See `FILE_UPLOAD_TESTING_GUIDE.md` for frontend implementation examples.

## 🎯 Ready for Frontend Implementation?

If all tests pass, you're ready to implement the frontend! Use the examples in:
- `FILE_UPLOAD_TESTING_GUIDE.md` - Full documentation
- `Elora_Upload_APIs.postman_collection.json` - API reference
- `TESTING_SUMMARY.md` - Overview and next steps
