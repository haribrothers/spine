---
title: Contributing
description: How to propose, build and submit a change to Spine.
sidebar:
  order: 5
---

The full guide is [CONTRIBUTING.md](https://github.com/haribrothers/spine/blob/main/CONTRIBUTING.md). In short:

- **Start with an issue** for anything beyond a small fix, and check it's in scope ([roadmap](https://github.com/haribrothers/spine/blob/main/ROADMAP.md)).
- **Use the story id** the maintainer gives the issue in the commit message and the pull request (`US-INV-05: …`).
- **Branches:** work is grouped into phases. Each phase is a branch, `phase-<n>-<name>`, from `main`, with one commit per story and one pull request into `main` when the phase is done. Never commit to `main` directly.
- **Run the checks locally** — lint, typecheck, tests and `pnpm verify` — because CI runs only on the pull request ([Testing](../testing/)).
- **Keep the docs in step:** a `CHANGELOG.md` entry, and the user guide page for anything people see.
- **Sign off every commit** with `git commit -s` (Developer Certificate of Origin; no CLA).

## Licence

Spine is [AGPL-3.0-only](https://github.com/haribrothers/spine/blob/main/LICENSE), copyright Hari Prasad. You can self-host it, change it and share it; anyone running a modified copy as a service must offer its source. Contributions are accepted under the same licence.
