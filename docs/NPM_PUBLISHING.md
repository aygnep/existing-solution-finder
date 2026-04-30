# Fixseek npm Publishing Checklist

Fixseek is prepared for npm distribution, but publishing is a manual maintainer
action. Do not run `npm publish` from automation.

## 1. Confirm Package Metadata

- `package.json` `name`: `fixseek`
- `version`: `0.1.0`
- `license`: `MIT`
- `bin.fixseek`: `dist/cli/index.js`
- Repository metadata still points to `aygnep/existing-solution-finder`.
- Published files are controlled by `package.json` `files`.

## 2. Login

```bash
npm login
```

## 3. Run Prepublish Checks

```bash
npm run prepublishOnly
```

This runs tests, typecheck, and build.

## 4. Inspect Package Contents

```bash
npm publish --dry-run
```

Check that the package includes the expected files:

- `dist`
- `README.md`
- `README.zh-CN.md`
- `LICENSE`
- `package.json`

## 5. Publish

Only run this when you intentionally want to publish:

```bash
npm publish
```

## 6. Verify Global Install

```bash
npm install -g fixseek
fixseek --help
fixseek "reasoning_content error with Claude Code"
fixseek solve "npm package ESM CommonJS error"
```

## Safety Notes

- Do not publish real `.env` files.
- Do not publish tokens or private credentials.
- Do not run `npm publish` as part of normal tests.
