# Publishing t3-mono to npm

This guide explains how to publish `t3-mono` to npm for global distribution via `npx t3-mono`.

## Prerequisites

1. **npm account** - Create one at [npmjs.com](https://www.npmjs.com/signup)
2. **npm CLI** - Comes with Node.js
3. **Rust toolchain** - For building binaries

## Publishing Methods

### Method 1: Automated (GitHub Actions) - Recommended

The repository includes a GitHub Actions workflow that automatically builds and publishes on tag push.

#### Setup

1. **Create npm access token**:
   ```bash
   npm login
   npm token create --read-only=false
   ```

2. **Add token to GitHub Secrets**:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Create secret `NPM_TOKEN` with your token

3. **Create and push a version tag**:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. The workflow will:
   - Build binaries for all platforms (macOS, Linux, Windows)
   - Publish platform-specific packages (`@t3-mono/darwin-arm64`, etc.)
   - Publish main package (`t3-mono`)
   - Create GitHub release with binaries

### Method 2: Manual Publishing

If you prefer manual control or need to publish without CI:

#### Step 1: Build Binaries

Build for your current platform:
```bash
cd t3-mono
cargo build --release
```

For cross-compilation to other platforms, use [cross](https://github.com/cross-rs/cross):
```bash
# Install cross
cargo install cross

# Build for each target
cross build --release --target aarch64-apple-darwin    # macOS ARM
cross build --release --target x86_64-apple-darwin     # macOS Intel
cross build --release --target x86_64-unknown-linux-gnu # Linux x64
cross build --release --target aarch64-unknown-linux-gnu # Linux ARM
cross build --release --target x86_64-pc-windows-msvc  # Windows
```

#### Step 2: Create Platform Packages

For each platform, create a package directory:

```bash
# Example for darwin-arm64
mkdir -p packages/darwin-arm64
cp target/aarch64-apple-darwin/release/t3-mono packages/darwin-arm64/

# Create package.json
cat > packages/darwin-arm64/package.json << 'EOF'
{
  "name": "@t3-mono/darwin-arm64",
  "version": "0.1.0",
  "description": "t3-mono binary for darwin-arm64",
  "os": ["darwin"],
  "cpu": ["arm64"],
  "bin": {
    "t3-mono": "t3-mono"
  }
}
EOF
```

Repeat for each platform:
- `@t3-mono/darwin-x64` (os: darwin, cpu: x64)
- `@t3-mono/linux-x64` (os: linux, cpu: x64)
- `@t3-mono/linux-arm64` (os: linux, cpu: arm64)
- `@t3-mono/win32-x64` (os: win32, cpu: x64, binary: `t3-mono.exe`)

#### Step 3: Publish Platform Packages

```bash
cd packages/darwin-arm64
npm publish --access public

cd ../darwin-x64
npm publish --access public

# ... repeat for all platforms
```

#### Step 4: Update Main Package Version

Edit `npm/package.json`:
```json
{
  "version": "0.1.0",
  "optionalDependencies": {
    "@t3-mono/darwin-arm64": "0.1.0",
    "@t3-mono/darwin-x64": "0.1.0",
    "@t3-mono/linux-x64": "0.1.0",
    "@t3-mono/linux-arm64": "0.1.0",
    "@t3-mono/win32-x64": "0.1.0"
  }
}
```

#### Step 5: Publish Main Package

```bash
cd npm
npm publish --access public
```

## Package Structure

The publishing system uses npm's optional dependencies for platform-specific binaries:

```
t3-mono (main package)
├── Detects user's platform
├── Downloads correct binary via optionalDependencies
└── @t3-mono/darwin-arm64
    @t3-mono/darwin-x64
    @t3-mono/linux-x64
    @t3-mono/linux-arm64
    @t3-mono/win32-x64
```

## Version Management

Follow semantic versioning:
- `0.1.x` - Patch releases (bug fixes)
- `0.x.0` - Minor releases (new features, backwards compatible)
- `x.0.0` - Major releases (breaking changes)

To release a new version:

1. Update `Cargo.toml`:
   ```toml
   version = "0.2.0"
   ```

2. Update `npm/package.json`:
   ```json
   "version": "0.2.0"
   ```

3. Commit and tag:
   ```bash
   git add -A
   git commit -m "Release v0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```

## Verifying Publication

After publishing, verify the package works:

```bash
# Clear npm cache
npm cache clean --force

# Test installation
npx t3-mono --version

# Test scaffolding
npx t3-mono test-app --no-git
```

## Troubleshooting

### "Package name too similar to existing package"
- npm may reject names similar to existing packages
- Try a different name or contact npm support

### "You must be logged in"
```bash
npm login
# or
npm adduser
```

### "Permission denied" on binary
The binary should be executable. If not:
```bash
chmod +x t3-mono
```

### Platform package not found
Ensure all platform packages are published before the main package, as the main package depends on them.

## npm Organization (Optional)

For better namespace control, create an npm organization:

1. Go to [npmjs.com/org/create](https://www.npmjs.com/org/create)
2. Create organization (e.g., `@t3-mono`)
3. Update package names to use org scope
4. Publish with `--access public`

## Links

- [npm Documentation](https://docs.npmjs.com/)
- [Publishing npm packages](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [npm Organizations](https://docs.npmjs.com/organizations)
- [Semantic Versioning](https://semver.org/)
