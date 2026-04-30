# npm Publishing Checklist

This project is prepared for npm distribution, but publishing is a manual step.
Do not publish from automation unless a maintainer explicitly requests it.

## 1. Confirm Package Metadata

- Confirm `package.json` `name`.
  - Current: `tool-resolver`
  - Possible alternatives: `existing-solution-finder` or `@aygnep/existing-solution-finder`
- Confirm `version`.
- Confirm `license`.
- Confirm `bin.tool-resolver` points to `dist/cli/index.js`.
- Confirm `files` only includes publishable artifacts.

## 2. Login

```bash
npm login
```

## 3. Run Prepublish Checks

```bash
npm run prepublishOnly
```

## 4. Inspect Package Contents

```bash
npm pack --dry-run
```

Check that the package includes only expected files:

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

For scoped packages, the first public publish may need:

```bash
npm publish --access public
```

## 6. Verify Global Install

```bash
npm install -g <package-name>
tool-resolver --help
tool-resolver solve "reasoning_content error with Claude Code"
```

## Safety Notes

- Do not publish real `.env` files.
- Do not publish tokens or private credentials.
- Do not run `npm publish` as part of normal tests.
