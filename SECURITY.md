# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of MacroPal seriously. If you have discovered a security vulnerability, please report it to us privately.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisory** (Preferred)
   - Go to the [Security tab](https://github.com/Zanci19/MacroPal/security/advisories)
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email**
   - Send details to: security@macropal.app (if available)
   - Include the word "SECURITY" in the subject line

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability (what an attacker could do)
- Your suggested fix (if you have one)

### Response Timeline

- **Initial Response**: We'll acknowledge your report within 48 hours
- **Status Updates**: We'll keep you informed of our progress every 5-7 days
- **Disclosure**: We'll work with you to coordinate public disclosure after a fix is released
- **Credit**: We'll credit you in our security advisories (unless you prefer to remain anonymous)

## Security Best Practices for Users

### For End Users

1. **Keep the app updated**: Always use the latest version
2. **Use strong passwords**: Enable two-factor authentication when available
3. **Be cautious with third-party integrations**: Only connect trusted services
4. **Report suspicious activity**: Contact us if you notice anything unusual

### For Developers

1. **Environment Variables**: Never commit `.env` files or expose Firebase credentials
2. **Dependencies**: Run `npm audit` regularly and keep dependencies updated
3. **Code Review**: All PRs should be reviewed for security implications
4. **Authentication**: Never bypass authentication checks, even in development
5. **Data Validation**: Always validate and sanitize user inputs
6. **Error Handling**: Don't expose sensitive information in error messages

## Known Security Considerations

### Firebase Configuration

- Firebase API keys in client-side code are expected and safe
- Security is enforced through Firebase Security Rules
- Ensure Firestore and Storage rules are properly configured

### Demo Mode

- Demo mode is intended for presentations only
- Do not use demo mode in production deployments
- Demo data is stored locally and is not secured

### Third-Party Dependencies

- We regularly audit dependencies using `npm audit`
- Critical vulnerabilities are patched as soon as possible
- See our [package.json](package.json) for the full dependency list

## Security Updates

Security updates will be released as follows:

- **Critical**: Immediate patch release
- **High**: Patch within 7 days
- **Medium**: Included in next minor version
- **Low**: Included in next major version

## Hall of Fame

We'd like to thank the following researchers for responsibly disclosing vulnerabilities:

*No vulnerabilities have been reported yet. Be the first!*

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [React Security Best Practices](https://react.dev/learn/security)

---

*Last updated: 2026-02-10*
