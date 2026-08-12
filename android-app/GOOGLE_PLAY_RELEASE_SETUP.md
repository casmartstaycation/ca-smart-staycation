# CA Smart Staycation — Google Play Release Setup

The Android project is prepared for a signed Google Play App Bundle.

## Current release

- Application ID: `com.casmartstaycation.app`
- Version name: `1.2`
- Version code: `3`
- Target SDK: 36
- Release artifact: `app-release.aab`

## Required before building the signed AAB

Create a private upload keystore on your own computer. Do not commit the `.jks` file or its passwords to GitHub.

### Windows

Open PowerShell in `android-app` and run:

```powershell
keytool -genkeypair -v -keystore ca-smart-staycation-upload-key.jks -alias casmartstaycation-upload -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=CA Smart Staycation, OU=Mobile, O=CA Smart Staycation, L=San Fernando, ST=Pampanga, C=PH"
```

Export the public certificate if Google Play requests it:

```powershell
keytool -export -rfc -keystore ca-smart-staycation-upload-key.jks -alias casmartstaycation-upload -file ca-smart-staycation-upload-certificate.pem
```

Keep the JKS private and make a secure backup.

## GitHub Actions secrets

In GitHub: Settings → Secrets and variables → Actions → New repository secret.

Create these four secrets:

- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS` = `casmartstaycation-upload`
- `KEY_PASSWORD`

Create `KEYSTORE_BASE64` in PowerShell with:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\ca-smart-staycation-upload-key.jks"))
```

Copy the resulting single-line value into the GitHub secret.

## Publishing strategy

Use Google Play App Signing for the production app. The upload key is used to authenticate uploads; Google Play manages the app-signing key.

The first release should go to an internal or closed testing track before production.

## Future updates

Keep `applicationId` exactly the same. For every update, increase `versionCode` (4, 5, 6, …) and update `versionName` as appropriate. Build a new signed AAB and upload it to the existing Google Play app.

## Important

The existing debug APK is not a production Play Store artifact. Do not upload `app-debug.apk` to Google Play.
