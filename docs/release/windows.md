# Windows release

The signed Windows release is built by `.github/workflows/release-windows.yml`
on a version tag (`v*.*.*`) or by manual dispatch. It produces NSIS (`.exe`)
and MSI installers as a GitHub Actions artifact.

Configure these repository secrets before releasing:

- `WINDOWS_CERTIFICATE`: base64-encoded PFX code-signing certificate.
- `WINDOWS_CERTIFICATE_PASSWORD`: PFX password.
- `WINDOWS_TIMESTAMP_URL`: RFC 3161 timestamp service URL.

The workflow fails before bundling if any signing secret is missing. The normal
CI Windows job remains unsigned and exists only to catch build regressions.
