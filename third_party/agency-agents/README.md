# Agency Agents attribution

The development profiles under `agents/roles/` are adapted from [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents), pinned at commit `ad9264e309bd5e5422c04784372d7841b1e5d604`. The copyright notice and MIT terms are preserved in [LICENSE](LICENSE). Exact source paths and SHA-256 checksums are in [upstream.lock.json](../../agents/upstream.lock.json).

## What was changed

The project profiles are edited adaptations, not verbatim copies of the upstream profiles.

- **Retained:** role focus, narrow changes, primary-source research, actionable review and evidence-based verification.
- **Removed:**
  - claims of fictional experience or memory;
  - fixed issue quotas;
  - blanket approval rituals;
  - irrelevant framework commands;
  - unconditional first-pass failure;
  - arbitrary performance targets;
  - external reference catalogues treated as requirements.
- **Added:** GoProceed's invariants, evidence rules, ownership rules and publication rules.

Seven of the eight profiles follow the adaptation shape of a sibling project, which used the same upstream files at commit `6d29a9b08785a0e49ffc9818bbdd381164c2df5f`. Between that commit and this pin, upstream changed only `scripts/*`, so those seven source files are byte-identical at both commits. `gp-ui-reviewer` is new here, adapted from `design/design-ui-finish-gate-reviewer.md`. Its PASS/HOLD gate and design-contract method are kept; its reference catalogue is not a requirement.

## Updating the pin

No upstream installer or converter is run, and auto-update is not enabled.

1. Inspect a new, immutable upstream commit.
2. Review each selected source and the licence.
3. Revise the canonical local profiles deliberately.
4. Update the lock.
5. Regenerate the host files.
6. Validate.

Never replace local policy with an unreviewed upstream download.
