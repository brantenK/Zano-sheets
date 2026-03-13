# Deployment Guide

This guide covers deploying Zano Sheets to production environments.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Build Process](#build-process)
- [Deployment Options](#deployment-options)
- [Environment Configuration](#environment-configuration)
- [Verification](#verification)
- [Rollback](#rollback)

## Prerequisites

### Development Environment
- Node.js 18+ and pnpm
- Office Add-in Debugger for local testing
- Git for version control

### Deployment Environment
- Web server for hosting the add-in files
- Office 365 or Microsoft 365 account for testing
- Sentry account for error tracking (optional but recommended)

## Build Process

### 1. Prepare for Build

```bash
# Ensure clean state
git clean -fdx
rm -rf node_modules dist

# Install dependencies (applies patches automatically)
pnpm install
```

### 2. Run Tests & Checks

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# All checks together
pnpm check
```

### 3. Build

```bash
# Production build
pnpm build

# Verify build output
ls -la dist/
```

Expected build output:
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
├── manifest.xml
└── manifest.prod.xml
```

## Deployment Options

### Option 1: Vercel Deployment (Recommended for Web Preview)

```bash
# Deploy to Vercel
pnpm deploy
```

This builds and deploys to your Vercel project. The deployment URL will be output.

**Update manifest.xml:**
```xml
<DefaultSettings>
  <SourceLocation DefaultValue="https://your-vercel-url.vercel.app/taskpane.html" />
</DefaultSettings>
```

### Option 2: GitHub Pages

1. Build the project: `pnpm build`
2. Push `dist/` contents to `gh-pages` branch
3. Enable GitHub Pages in repository settings

### Option 3: Azure Blob Storage

```bash
# Install Azure CLI
az storage blob upload-batch \
  --source dist \
  --destination '$web' \
  --account-name your-storage-account
```

### Option 4: AWS S3 + CloudFront

```bash
# Sync to S3
aws s3 sync dist/ s3://your-bucket/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Option 5: Office Store (Production Distribution)

1. **Create Provider Account**
   - Go to https://sellerdashboard.microsoft.com/
   - Register as an Office Store seller

2. **Prepare Package**
   - Build production version
   - Test thoroughly in multiple Excel environments
   - Create app icons (following Office Store guidelines)
   - Prepare screenshots and descriptions

3. **Package Add-in**
   ```bash
   # Package for Office Store
   office-addin-package package manifest.prod.xml
   ```

4. **Submit to Store**
   - Upload package to seller dashboard
   - Fill in required metadata
   - Submit for review (typically 3-5 business days)

## Environment Configuration

### Development vs Production

The project uses two manifests:
- `manifest.xml` - Development (localhost)
- `manifest.prod.xml` - Production

### Required Environment Variables

Not currently used (browser-based), but for future reference:

```bash
# Sentry (for error tracking)
VITE_SENTRY_DSN=your-dsn-here

# API endpoints (if backend is added)
VITE_API_URL=https://api.example.com
```

### Configuration Files

1. **package.json** - Version number
   ```json
   {
     "version": "0.2.5"
   }
   ```

2. **manifest.prod.xml** - Production URLs and permissions

3. **vite.config.ts** - Build configuration

## Verification

### Pre-Deployment Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Build succeeds without warnings (`pnpm build`)
- [ ] Patches are documented (`docs/PATCHES.md` is current)
- [ ] Sentry is configured for error tracking
- [ ] Version number is updated

### Post-Deployment Testing

1. **Load Test**
   - Open Excel
   - Insert add-in from deployment URL
   - Verify task pane loads

2. **Feature Test**
   - Send a chat message
   - Verify AI responds
   - Test Excel operations (read cells, write cells)
   - Test file upload
   - Test knowledge base

3. **Multi-Environment Test**
   - Test in Excel on Windows
   - Test in Excel on Mac
   - Test in Excel Online (if supported)

4. **Error Handling**
   - Test with invalid API key
   - Test with network issues
   - Test with large workbooks

## Rollback

### Vercel Rollback

```bash
# List deployments
vercel list

# Rollback to previous deployment
vercel rollback [deployment-url]
```

### Manual Rollback

1. Rebuild previous version
2. Redeploy to hosting service
3. Verify add-in loads correctly

### GitHub Pages Rollback

```bash
# Checkout previous commit
git checkout [previous-tag]

# Rebuild and deploy
pnpm build
git subtree push --prefix dist origin gh-pages
```

## Monitoring

### Sentry Error Tracking

The app integrates with Sentry for error monitoring:

1. Access Sentry dashboard
2. Check for new errors after deployment
3. Monitor error rates and performance

### Key Metrics to Monitor

- Error rate by provider
- Error rate by feature
- Performance of AI responses
- Excel API failure rates

## Versioning

Follow Semantic Versioning:
- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes

Example: `0.2.5` → `0.2.6` (patch), `0.3.0` (minor), `1.0.0` (major)

## Troubleshooting

See `docs/TROUBLESHOOTING.md` for common deployment issues.

## Security Considerations

1. **API Keys**: Never commit API keys to git
2. **Manifest**: Use HTTPS for all URLs
3. **Permissions**: Only request necessary Office.js permissions
4. **Dependencies**: Keep dependencies updated and review security advisories

## Related Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Patches](docs/PATCHES.md)
- [Telemetry](docs/TELEMETRY.md)
