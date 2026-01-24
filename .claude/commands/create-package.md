# Create Cross-Platform Rust CLI npm Package

Scaffold a complete setup for distributing a Rust CLI tool via npm with cross-platform binaries.

## Usage

```
/create-package <package-name> [--scope=<npm-scope>]
```

## What This Creates

1. **npm package structure** with platform-specific binary packages
2. **GitHub Actions workflow** for automated cross-compilation and publishing
3. **Cargo.toml** configuration with vendored OpenSSL for cross-compilation

---

## Required Project Structure

```
<package-name>/
├── Cargo.toml                 # Rust project config
├── src/
│   └── main.rs               # CLI entry point
├── npm/
│   ├── package.json          # Main npm package
│   ├── bin/
│   │   └── index.js          # Binary wrapper/launcher
│   └── install.js            # Post-install script
└── .github/
    └── workflows/
        └── release.yml       # CI/CD workflow
```

---

## Critical Configuration Requirements

### 1. Cargo.toml - Vendored OpenSSL

```toml
[dependencies]
# Required for cross-compilation (avoids OpenSSL system dependency)
openssl = { version = "0.10", features = ["vendored"] }
```

### 2. Repository URLs Must Match

The `repository` field in both `Cargo.toml` and `npm/package.json` **MUST** match your GitHub repo URL exactly for npm provenance to work:

```toml
# Cargo.toml
repository = "https://github.com/<owner>/<repo>"
```

```json
// npm/package.json
"repository": {
  "type": "git",
  "url": "git+https://github.com/<owner>/<repo>.git"
}
```

### 3. npm Token Requirements

Create a **Granular Access Token** on npmjs.com with:
- Read and Write permissions for your packages
- **"Allow this token to bypass 2FA"** enabled (under Advanced)
- Add as `NPM_TOKEN` secret in GitHub repo settings

---

## Common Errors & Solutions

### Error: `dtolnay/rust-action` not found
**Fix:** Use `dtolnay/rust-toolchain@stable` (correct action name)

### Error: OpenSSL not found during cross-compilation
**Fix:** Add `openssl = { version = "0.10", features = ["vendored"] }` to Cargo.toml

### Error: macOS-13 runner retired
**Fix:** Use `macos-latest` for all macOS builds (ARM64 runners)

### Error: Linux ARM64 build fails with linker error
**Fix:** Install cross-compiler and set linker:
```yaml
- run: |
    sudo apt-get install -y gcc-aarch64-linux-gnu
    echo "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc" >> $GITHUB_ENV
```

### Error: Windows PowerShell heredoc syntax error
**Fix:** Use separate steps for Unix (bash) and Windows (PowerShell)

### Error: npm version has 'v' prefix (v1.0.0 vs 1.0.0)
**Fix:** Strip prefix in workflow:
- Bash: `VERSION="${VERSION#v}"`
- PowerShell: `$version = "${{ github.ref_name }}" -replace '^v', ''`

### Error: E422 repository URL mismatch for provenance
**Fix:** Ensure `repository.url` in package.json matches the GitHub repo publishing the package

### Error: E403 Two-factor authentication required
**Fix:** Use granular access token with "bypass 2FA" enabled

---

## GitHub Actions Workflow Template

```yaml
name: Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

permissions:
  contents: write
  id-token: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            target: aarch64-apple-darwin
            npm_pkg: darwin-arm64
          - os: macos-latest
            target: x86_64-apple-darwin
            npm_pkg: darwin-x64
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            npm_pkg: linux-x64
          - os: ubuntu-latest
            target: aarch64-unknown-linux-gnu
            npm_pkg: linux-arm64
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            npm_pkg: win32-x64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install cross-compilation tools (Linux ARM64)
        if: matrix.target == 'aarch64-unknown-linux-gnu'
        run: |
          sudo apt-get update
          sudo apt-get install -y gcc-aarch64-linux-gnu
          echo "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc" >> $GITHUB_ENV

      - name: Build
        run: cargo build --release --target ${{ matrix.target }}

      - name: Package (Unix)
        if: runner.os != 'Windows'
        run: |
          mkdir -p dist
          cp target/${{ matrix.target }}/release/<BINARY_NAME> dist/
          chmod +x dist/<BINARY_NAME>

      - name: Package (Windows)
        if: runner.os == 'Windows'
        run: |
          mkdir dist
          copy target\${{ matrix.target }}\release\<BINARY_NAME>.exe dist\

      - name: Create npm package (Unix)
        if: runner.os != 'Windows'
        run: |
          mkdir -p npm-pkg
          cp dist/<BINARY_NAME> npm-pkg/
          VERSION="${{ github.ref_name }}"
          VERSION="${VERSION#v}"
          cat > npm-pkg/package.json << EOF
          {
            "name": "@<SCOPE>/${{ matrix.npm_pkg }}",
            "version": "${VERSION}",
            "description": "<BINARY_NAME> binary for ${{ matrix.npm_pkg }}",
            "os": ["${{ contains(matrix.npm_pkg, 'darwin') && 'darwin' || 'linux' }}"],
            "cpu": ["${{ contains(matrix.npm_pkg, 'arm64') && 'arm64' || 'x64' }}"],
            "bin": {
              "<BINARY_NAME>": "<BINARY_NAME>"
            }
          }
          EOF

      - name: Create npm package (Windows)
        if: runner.os == 'Windows'
        shell: pwsh
        run: |
          New-Item -ItemType Directory -Force -Path npm-pkg
          Copy-Item dist\<BINARY_NAME>.exe npm-pkg\
          $version = "${{ github.ref_name }}" -replace '^v', ''
          $json = @{
            name = "@<SCOPE>/${{ matrix.npm_pkg }}"
            version = $version
            description = "<BINARY_NAME> binary for ${{ matrix.npm_pkg }}"
            os = @("win32")
            cpu = @("x64")
            bin = @{ "<BINARY_NAME>" = "<BINARY_NAME>.exe" }
          } | ConvertTo-Json -Depth 3
          $json | Out-File -FilePath npm-pkg\package.json -Encoding utf8

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.npm_pkg }}
          path: npm-pkg/

  publish:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"

      - name: Publish platform packages
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          for pkg in darwin-arm64 darwin-x64 linux-x64 linux-arm64 win32-x64; do
            cd artifacts/$pkg
            npm publish --access public --provenance || true
            cd ../..
          done

      - name: Update main package version
        run: |
          cd npm
          VERSION=${{ github.ref_name }}
          VERSION=${VERSION#v}
          sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

      - name: Publish main package
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          cd npm
          npm publish --access public --provenance

  github-release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Package binaries
        run: |
          for pkg in darwin-arm64 darwin-x64 linux-x64 linux-arm64 win32-x64; do
            cd artifacts/$pkg
            if [ -f <BINARY_NAME>.exe ]; then
              zip -r ../../<BINARY_NAME>-$pkg.zip <BINARY_NAME>.exe
            else
              tar -czvf ../../<BINARY_NAME>-$pkg.tar.gz <BINARY_NAME>
            fi
            cd ../..
          done

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            <BINARY_NAME>-*.tar.gz
            <BINARY_NAME>-*.zip
          generate_release_notes: true
```

---

## npm/package.json Template

```json
{
  "name": "<package-name>",
  "version": "0.1.0",
  "description": "Description of your CLI tool",
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/<repo>.git"
  },
  "bugs": {
    "url": "https://github.com/<owner>/<repo>/issues"
  },
  "homepage": "https://github.com/<owner>/<repo>#readme",
  "keywords": ["cli", "your", "keywords"],
  "bin": {
    "<binary-name>": "bin/index.js"
  },
  "files": ["bin", "install.js"],
  "scripts": {
    "postinstall": "node install.js"
  },
  "optionalDependencies": {
    "@<scope>/darwin-arm64": "0.1.0",
    "@<scope>/darwin-x64": "0.1.0",
    "@<scope>/linux-x64": "0.1.0",
    "@<scope>/linux-arm64": "0.1.0",
    "@<scope>/win32-x64": "0.1.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

---

## Publishing Checklist

1. [ ] `Cargo.toml` has `openssl = { version = "0.10", features = ["vendored"] }`
2. [ ] Repository URLs match in `Cargo.toml` and `npm/package.json`
3. [ ] Created npm granular access token with 2FA bypass
4. [ ] Added `NPM_TOKEN` secret to GitHub repo
5. [ ] Tagged release: `git tag v1.0.0 && git push origin v1.0.0`

---

## Release Process

```bash
# Bump version in Cargo.toml and npm/package.json
# Then tag and push
git add -A
git commit -m "release: v1.0.0"
git tag v1.0.0
git push origin main --tags
```

The GitHub Actions workflow will automatically:
1. Build binaries for all 5 platforms
2. Publish platform-specific npm packages (@scope/darwin-arm64, etc.)
3. Publish main npm package
4. Create GitHub release with downloadable binaries
