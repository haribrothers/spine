# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

Use GitHub's private reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Only the maintainers see the report. Include what you found, how to reproduce it and which version you ran (Settings › About Spine shows it).

We aim to acknowledge a report within 3 working days and to say what we'll do within 10. A fix ships in a patch release, and the release notes credit you unless you'd rather we didn't.

## Supported versions

Security fixes go into the latest release. Spine upgrades in place (`./upgrade.sh`, see the README's Updating section), so stay on the latest release to get them.

## What's in scope

The Spine web app, API, field app and the install, backup and upgrade scripts in this repository. Vulnerabilities in a dependency are in scope when Spine uses the affected code; report the dependency to its own project too.

How Spine is secured, and the pre-1.0 review, are in [docs/prd/07-security.md](docs/prd/07-security.md) and [docs/security-review.md](docs/security-review.md).
