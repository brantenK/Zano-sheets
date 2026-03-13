# Troubleshooting Guide

This guide helps diagnose and fix common issues with Zano Sheets.

## Table of Contents
- [Development Issues](#development-issues)
- [Build & Deployment Issues](#build--deployment-issues)
- [Runtime Issues](#runtime-issues)
- [Excel API Issues](#excel-api-issues)
- [AI Provider Issues](#ai-provider-issues)
- [Performance Issues](#performance-issues)

## Development Issues

### Dev Server Won't Start

**Problem:** `pnpm dev-server` fails to start

**Solutions:**
1. Check if port 3000 is already in use:
   ```bash
   # Windows
   netstat -ano | findstr :3000

   # Kill process if needed
   taskkill /PID [PID] /F
   ```

2. Clear Vite cache:
   ```bash
   rm -rf node_modules/.vite
   pnpm dev-server
   ```

3. Check for syntax errors:
   ```bash
   pnpm typecheck
   ```

### Tests Fail After Dependency Update

**Problem:** Tests pass with `@mariozechner/pi-ai@0.57.0` but fail with `@mariozechner/pi-ai@0.57.1`

**Solutions:**
1. Check if patches need updating:
   ```bash
   # View current patches
   cat patches/@mariozechner__pi-ai@*

   # Re-create patches if needed
   rm -rf node_modules/@mariozechner/pi-ai
   pnpm install
   # Make changes to node_modules/@mariozechner/pi-ai
   pnpm patch @mariozechner/pi-ai
   ```

2. Update type definitions in `src/lib/chat/adapter.ts` if API changed

3. Check `docs/PATCHES.md` for patch requirements

### Hot Module Replacement (HMR) Not Working

**Problem:** Changes don't appear in dev server

**Solutions:**
1. Restart dev server
2. Clear browser cache
3. Check Vite HMR configuration in `vite.config.ts`

## Build & Deployment Issues

### Build Fails with TypeScript Errors

**Problem:** `pnpm build` fails with type errors

**Solutions:**
1. Run type check first to see all errors:
   ```bash
   pnpm typecheck
   ```

2. Common fixes:
   - Missing import: Add import statement
   - Type mismatch: Check `src/lib/chat/adapter.ts` for type mappings
   - `any` type: Replace with proper type from `src/lib/chat/stream-types.ts`

3. If using `as never` casts, replace with type-safe alternatives

### Build Output Too Large

**Problem:** Bundle size is several MB

**Solutions:**
1. Analyze bundle:
   ```bash
   pnpm build -- --mode analyze
   ```

2. Check for large dependencies:
   - `pdfjs-dist` - Ensure using tree-shakeable imports
   - `xlsx` - Consider lighter alternatives for Excel operations

3. Enable production optimizations in `vite.config.ts`

### Patches Not Applied in Production Build

**Problem:** Add-in fails in production but works locally

**Solutions:**
1. Verify patches in `package.json`:
   ```json
   "pnpm": {
     "patchedDependencies": {
       "@mariozechner/pi-ai@0.57.1": "patches/@mariozechner__pi-ai@0.57.1.patch"
     }
   }
   ```

2. Ensure postinstall script runs:
   ```bash
   # Check package.json has:
   "scripts": {
     "postinstall": "patch-package"
   }
   ```

3. In CI/CD, ensure `pnpm install` runs (not `npm install`)

## Runtime Issues

### Add-in Won't Load in Excel

**Problem:** "Add-in could not be loaded" error

**Solutions:**
1. Check manifest URL is correct and HTTPS
2. Verify `manifest.xml` or `manifest.prod.xml` is being used
3. Check browser console for errors:
   - In Excel: Right-click task pane → Inspect
   - Look for 404 errors or CORS issues

4. Verify Office.js is loaded:
   ```javascript
   // Should see "Office.js loaded" in console
   Office.onReady(() => console.log("Office.js loaded"));
   ```

### Blank Screen in Task Pane

**Problem:** Task pane opens but shows blank screen

**Solutions:**
1. Check browser console for React errors
2. Verify build output includes all assets:
   ```bash
   ls -la dist/assets/
   ```

3. Check if React root element exists in `index.html`

4. Look for Office.js initialization issues

### State Not Persisting

**Problem:** Chat messages disappear on refresh

**Solutions:**
1. Check IndexedDB is available:
   ```javascript
   // In browser console
   indexedDB.open('zano-sheets-db')
   ```

2. Verify `src/lib/storage/db.ts` is working

3. Check browser settings (Private mode may block IndexedDB)

## Excel API Issues

### "Office is not defined" Error

**Problem:** `ReferenceError: Office is not defined`

**Solutions:**
1. Ensure running in Excel context (not standalone browser)
2. Check `office-js` is loaded before use
3. Use `Office.onReady()` before calling Excel API

### Excel API Calls Fail

**Problem:** `Excel.run()` throws error

**Solutions:**
1. Check if workbook is open
2. Verify user has granted permissions
3. Check Excel API version compatibility:
   ```javascript
   console.log(Excel.context.requirements.isSetSupported('ExcelApi', '1.1'));
   ```

4. Look for specific error messages:
   - "Invalid reference": Cell reference is out of bounds
   - "Busy": Excel is processing another operation

### Large Workbook Performance

**Problem:** Operations are slow on large workbooks

**Solutions:**
1. Use batch operations:
   ```javascript
   await Excel.run(async (context) => {
     const range = context.workbook.getSelectedRange();
     range.load(['rowCount', 'columnCount']);
     await context.sync();
     // Process in chunks
   });
   ```

2. Consider background processing for very large operations

## AI Provider Issues

### API Key Errors

**Problem:** "Invalid API key" error

**Solutions:**
1. Verify API key in settings
2. Check provider supports the key type:
   - OpenAI: `sk-` prefix
   - Anthropic: `sk-ant-` prefix
   - Google: JSON key or API key

3. For OAuth, check token is not expired:
   ```javascript
   // Check token expiry
   const creds = loadOAuthCredentials(provider);
   console.log('Token expires:', new Date(creds.expires));
   ```

### Rate Limiting (429 Errors)

**Problem:** "Rate limit exceeded" errors

**Solutions:**
1. Check provider rate limits:
   - OpenAI: Varies by tier
   - Anthropic: 50 requests/minute (default)
   - Google: 60 requests/minute

2. Implement exponential backoff (built-in to `streamWithRetry`)

3. Consider upgrading provider tier

### Streaming Timeout

**Problem:** "Request timed out after 5 minutes"

**Solutions:**
1. This is a safety limit in `useMessageSender.ts`
2. For long operations, consider:
   - Breaking into smaller requests
   - Increasing timeout (not recommended)
   - Using non-streaming API for very long responses

### Model Not Available

**Problem:** "Model not available" error

**Solutions:**
1. Check model ID matches provider's model names
2. Verify provider is configured correctly
3. Check if model is available in your region
4. See `src/lib/chat/provider-catalog.ts` for supported models

## Performance Issues

### Slow Initial Load

**Problem:** Add-in takes >5 seconds to load

**Solutions:**
1. Check bundle size (should be <2MB)
2. Enable code splitting:
   ```javascript
   // Already implemented for providers
   const { streamSimpleAnthropic } = await import('...');
   ```

3. Lazy load non-critical components

### Memory Leak

**Problem:** Browser memory grows over time

**Solutions:**
1. Check for unmounted React components:
   ```javascript
   useEffect(() => {
     return () => {
       // Cleanup
     };
   }, []);
   ```

2. Release Excel API context:
   ```javascript
   await context.sync();
   context.trackedObjects.clear();
   ```

3. Abort ongoing requests on unmount

### High CPU Usage

**Problem:** Browser uses high CPU during streaming

**Solutions:**
1. Check for unnecessary re-renders
2. Debounce expensive operations
3. Use `requestIdleCallback` for non-critical updates

## Getting Help

### Collect Debug Information

1. Browser console errors
2. Sentry error report URL (if available)
3. Excel version and platform
4. Steps to reproduce

### Resources

- Architecture: `docs/ARCHITECTURE.md`
- Deployment: `docs/DEPLOYMENT.md`
- Patches: `docs/PATCHES.md`
- GitHub Issues: https://github.com/brantenK/Zano-sheets/issues

### Log Locations

- Browser console: F12 → Console tab
- Sentry dashboard: Check for recent errors
- Excel: Right-click task pane → Inspect
