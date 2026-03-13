# Patch Documentation

This document explains the patches applied to the `@mariozechner/pi-ai` library and why they are necessary.

## Overview

Zano Sheets uses patched versions of the `@mariozechner/pi-ai` library to enable features that are not available in the upstream library. Patches are applied automatically via pnpm's native patching mechanism.

## Patches Applied

### 1. OpenAI Store Parameter Patch

**Files Modified:**
- `dist/providers/openai-responses.js`
- `dist/providers/openai-codex-responses.js`

**Change:**
```diff
- store: false,
+ store: true,
```

**Purpose:**

This patch enables the `store: true` parameter for OpenAI API requests. This parameter is required for:

1. **Prompt Caching**: Storing prompts enables OpenAI's prompt caching feature, which can significantly reduce costs and latency for repetitive prompts.

2. **Compliance**: Some enterprise agreements require prompt storage for auditing and compliance purposes.

3. **Future Features**: Storing prompts enables future OpenAI features that may require historical prompt access.

**Why Patching is Necessary:**

The upstream `pi-ai` library hardcodes `store: false` to minimize data retention by default. However, Zano Sheets requires `store: true` for:
- Cost optimization through caching
- Better error tracking and debugging
- Future AI feature integration

**Alternative Approaches Considered:**

1. **Fork the library**: Would require ongoing maintenance of the entire codebase
2. **Upstream contribution**: Would require changing the default behavior for all users
3. **Wrapper library**: Would not work because the parameter is set in compiled code

**Decision**: Patching is the most pragmatic solution because:
- The change is minimal and well-contained
- pnpm's native patching applies patches automatically on install
- The patch can be easily updated when the library is upgraded

### 2. Package Exports Patch

**Files Modified:**
- `package.json`

**Change:**
```diff
 "./bedrock-provider": {
   "types": "./bedrock-provider.d.ts",
   "import": "./bedrock-provider.js"
- }
+ },
+ "./dist/*": "./dist/*"
```

**Purpose:**

This patch adds proper exports for the `dist/*` directory, allowing direct imports from the compiled distribution files.

**Why Patching is Necessary:**

The upstream package.json does not export the dist directory properly, which prevents importing from the compiled provider files. Zano Sheets needs to import specific provider implementations directly.

## Patch Application

Patches are applied automatically by pnpm during installation. No manual steps are required.

### Patch Files

- `patches/@mariozechner__pi-ai@0.55.4.patch` - Legacy patch for version 0.55.4
- `patches/@mariozechner__pi-ai@0.57.1.patch` - Current patch for version 0.57.1

### Applying Patches

Patches are applied automatically when running:
```bash
pnpm install
```

### Creating New Patches

After updating `@mariozechner/pi-ai`, you may need to create a new patch:

1. Make your changes to `node_modules/@mariozechner/pi-ai/`
2. Generate the patch:
   ```bash
   pnpm patch @mariozechner/pi-ai
   ```
3. Update `package.json` if the version changed
4. Commit the new patch file

## Patch Verification

The project includes automated tests to verify that patches are applied correctly. Run:

```bash
pnpm test tests/patch-verification.test.ts
```

## Troubleshooting

### Patches Not Applying

If patches fail to apply:

1. Clean install:
   ```bash
   rm -rf node_modules
   pnpm install
   ```

2. Verify patch file exists and matches version in package.json

3. Check for conflicts in the patch output

### Version Conflicts

When upgrading `@mariozechner/pi-ai`:

1. Install the new version
2. Re-apply your changes to node_modules
3. Generate a new patch file
4. Update package.json
5. Test thoroughly

### Breaking Changes

If the upstream library changes significantly:

1. Review the patch diff
2. Update patch for new version
3. Update this documentation
4. Consider re-evaluating the fork vs patch decision

## Future Considerations

### Long-term Options

1. **Contribute upstream**: Work with the pi-ai maintainer to make `store` configurable
2. **Fork the library**: Create a maintained fork if patches become too extensive
3. **Alternative library**: Evaluate alternative libraries if patching becomes unsustainable

### Decision Criteria

When the patch exceeds 50 lines or touches more than 5 files, we should:
- Re-evaluate the fork decision
- Consider upstream contribution
- Assess maintenance burden

## Related Documentation

- [Architecture Documentation](./ARCHITECTURE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Deployment Guide](./DEPLOYMENT.md)
