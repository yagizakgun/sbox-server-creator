# .

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Automatic GitHub Release Build

A GitHub Actions workflow is configured at `.github/workflows/release.yml`.

- Trigger: push a tag that starts with `v` (for example `v0.1.0`)
- What it does: builds Windows, macOS, and Linux packages
- Result: uploads build artifacts to the matching GitHub Release

Example:

```bash
git tag v0.1.0
git push origin v0.1.0
```
