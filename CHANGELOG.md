# Changelog

All notable changes to Sovegent Identity will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [SemVer](https://semver.org/)

---

## [Unreleased]

### Added
- Initial monorepo scaffold: `@sovegent/core`, `@sovegent/zk`, `@sovegent/anchors`, `@sovegent/sdk`
- Core primitives: SHA-256 hashing, secp256k1/Ed25519 signing, W3C VC types
- Attestation creation and verification
- Document notarization (hash + sign + timestamp)
- Hono REST API with SQLite storage
- SIWE (Sign-In with Ethereum) authentication with JWT sessions
- Public verification endpoint (`GET /verify/:id`)
- `verify.identity.sovegent.com` — public proof viewer React app
- `app.identity.sovegent.com` — dashboard React app (notarize, attest, history)
- EVM anchor adapter (viem-based, calldata embedding)
- Liberland blockchain anchor adapter (system.remark)
- Age proof ZK circuit (`ageProof.circom`) with snarkjs
- NGINX configs for all 3 subdomains
- PM2 ecosystem config for Linode deployment
- Docker Compose + Dockerfile for containerized deployment
- GitHub Actions CI (typecheck, test, build, Docker validation)
- GitHub Actions release workflow (npm publish on tag)
- Wallet provider bridge with Sovegent Wallet detection
- In-memory sliding window rate limiter (per-IP)
- Comprehensive test suite for `@sovegent/core`

---

## Links

- Repository: https://github.com/sovegent/sovegent-identity
- Sovegent Wallet: https://github.com/sovegent/sovegent-wallet
- Sovegent: https://sovegent.com
