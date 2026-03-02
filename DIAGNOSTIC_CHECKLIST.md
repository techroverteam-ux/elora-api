# Diagnostic Checklist

## Check 1: Vercel Environment Variables

Go to: https://vercel.com/dashboard → elora-api → Settings → Environment Variables

**Must have these set:**
```
STORAGE_TYPE=ftps
FTP_HOST=ftp.enamorimpex.com
FTP_USER=eloraftp@storage.enamorimpex.com
FTP_PASSWORD=<your-password>
FTP_SECURE=true
```

**After setting, REDEPLOY the app!**

## Check 2: cPanel Files

Login to cPanel → File Manager

**Check path:** `/eloraftp/uploads/recce-images/AKSAKS434494HYDHYDDLR005/`

**Expected files:**
- 1772394213914_76ffc257bcdf990f_initial_1772394213914_0.jpg
- 1772394213920_97a88fc785ab5018_initial_1772394213920_1.jpg
- 1772394213926_a4ffac876c4f158c_initial_1772394213926_2.jpg
- 1772394213928_8207a0c5055f3cfb_initial_1772394213928_3.jpg
- 1772394213930_377581563a241dc6_recce_1772394213930_0.jpg
- 1772394213932_3fbc1af57c96b427_recce_1772394213932_1.jpg
- 1772394213933_bcc206f4011f2ffd_recce_1772394213933_2.jpg

**Are they there?** YES / NO

## Check 3: Test Direct URL

Try opening this in browser:
```
https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494HYDHYDDLR005/1772394213914_76ffc257bcdf990f_initial_1772394213914_0.jpg
```

**Does it load?** YES / NO

## Check 4: Frontend Issue

The URL being constructed is WRONG:
```
❌ http://localhost:5000/https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494HYDHYDDLR0051772394213914.../undefined

Should be:
✅ https://storage.enamorimpex.com/uploads/recce-images/AKSAKS434494HYDHYDDLR005/1772394213914_76ffc257bcdf990f_initial_1772394213914_0.jpg
```

**Frontend needs fixing!**

## Immediate Actions:

1. **Set Vercel env vars** (if not done)
2. **Redeploy backend** after setting vars
3. **Check cPanel** for files
4. **Fix frontend** URL construction
