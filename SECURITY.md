# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.x (alpha) | ✅ Active development |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Email **security@sovegent.com** with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within 48 hours. We will work with you to understand the issue, develop a fix, and coordinate disclosure.

## Scope

### In scope
- Cryptographic signing and verification (`@sovegent/core`)
- Authentication bypass in the API (SIWE flow, JWT handling)
- Authorization issues (accessing other users' proofs)
- Injection vulnerabilities in the API
- ZK circuit soundness issues (`@sovegent/zk`)

### Out of scope
- Issues in third-party dependencies (report to their maintainers)
- Rate limiting bypass (in-scope for production, lower priority for alpha)
- Social engineering attacks

## Cryptographic Assumptions

Sovegent Identity uses the [Noble cryptography](https://paulmillr.com/noble/) library family (`@noble/hashes`, `@noble/curves`) for all signing and hashing operations. These libraries are audited and well-reviewed. Any implementation issues wrapping these primitives are in scope.

## Disclosure Policy

We follow coordinated disclosure. Once a fix is ready, we will:
1. Release a patched version
2. Credit the reporter (unless they prefer anonymity)
3. Publish a security advisory on GitHub
