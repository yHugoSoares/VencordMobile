---
name: vemobile-release
description: Use when creating releases, tagging versions, managing the CI pipeline, or fixing GitHub Actions workflows. Trigger keywords: release, tag, version, bump, CI, GitHub Actions, workflow, publish, APK upload, gh release, git tag, semantic version, beta, changelog.
---

# Vemobile Release Process

## Versioning

Semantic-ish: `v0.MAJOR.MINOR-beta`
- `0.1.x` — beta phase, incremental fixes
- `0.2.0` — first stable release candidate

## Manual Release (current)

```bash
# 1. Build APK
cd vemobile && flutter build apk --debug

# 2. Tag and push
git tag v0.1.X-beta
git push origin master --tags

# 3. Create GitHub release with APK
gh release create v0.1.X-beta \
  --title "v0.1.X-beta — <description>" \
  --notes-file - \
  vemobile/build/app/outputs/flutter-apk/app-debug.apk <<'EOF'
## Changelog
...
EOF
```

## CI Pipeline (`.github/workflows/build.yml`)

The CI runs on `push` to master, on tags (`v*`), and on `workflow_dispatch`.

### Jobs
1. **build-android**: `flutter pub get` → `flutter build apk --debug` → `flutter build apk --release` → upload artifact
2. **release** (only on tags): Downloads APK artifact → creates GitHub Release with `softprops/action-gh-release@v2`

### Required Permissions
The release job needs `permissions: contents: write` to create/modify releases via `GITHUB_TOKEN`.

### Known Issues
- `generate_release_notes: true` in `action-gh-release` fails when releases are created manually — remove it for CI-only releases
- Node 20 deprecation warning from `actions/checkout@v4` is cosmetic, not blocking
- The `build-bundle` job was removed (bundle is pre-built and committed to repo)

## Release Cleanup

To delete old releases and tags:
```bash
gh release delete v0.1.X-beta --yes
git tag -d v0.1.X-beta
git push origin :refs/tags/v0.1.X-beta
```

## Automated CI Releases

After CI fix, just push a tag:
```bash
git tag v0.1.X-beta && git push origin v0.1.X-beta
```

CI will:
1. Build debug + release APKs
2. Create GitHub Release
3. Attach APK artifacts
