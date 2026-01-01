# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Latest  | ✅ Yes    |
| < 1.0   | ❌ No     |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly with details of the vulnerability
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours of your report
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity (critical: ASAP, high: 30 days, medium: 90 days)
- **Credit**: Security researchers will be credited (unless anonymity is preferred)

## Security Best Practices

When deploying this software, ensure you:

### Database Security
- Use strong, unique passwords for database connections
- Enable Row Level Security (RLS) on all tables
- Regularly rotate API keys and secrets
- Use SSL/TLS for all database connections

### Environment Variables
- Never commit `.env` files to version control
- Use secret management services in production
- Rotate secrets regularly

### Authentication
- Enforce strong password policies
- Enable multi-factor authentication where possible
- Implement proper session management
- Use secure, HTTP-only cookies

### Deployment
- Keep all dependencies up to date
- Run security audits (`npm audit`, `bun audit`)
- Use HTTPS in production
- Implement rate limiting
- Set up proper CORS policies

## Dependency Security

This project uses automated dependency scanning:

- **Dependabot**: Monitors dependencies for known vulnerabilities
- **OSV-Scanner**: Scans for vulnerabilities using the OSV database

## Disclaimer

Please review our [Terms of Service](./TERMS.md) for important information regarding:

- Limitation of liability
- No warranty guarantees
- Security disclaimers
- Data protection responsibilities

**The maintainers of this software are NOT liable for any security breaches, data loss, or damages arising from the use of this software. Users are responsible for their own security measures and compliance requirements.**

See [TERMS.md](./TERMS.md) for the complete Terms of Service and Disclaimer.

## License

This project is licensed under the [MIT License with Enhanced Liability Protection](./LICENSE).

