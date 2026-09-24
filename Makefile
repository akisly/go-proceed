# `validate` used to mean four things. Three of them validated `prototype/`,
# which commit a85e688 («remove») deleted from the tree on 2026-08-19 along
# with the `_to_delete/` archives:
#
#   validate-prototype   npm --prefix prototype run lint / build
#   validate-qa          the prototype's own puppeteer harness
#   validate-contracts   scripts/validate_package.py, which reads prototype's
#                        App.jsx, its pages, its qa-results.json and its
#                        styles.css in 29 places
#
# All three are gone with their subject. The CI job that ran this target
# (`package-validate`) was removed in the same change — see
# .github/workflows/ci.yml. `validate_package.py` itself stayed in the tree,
# invoked by nothing, until DEV-062 deleted it on 2026-09-24 (BL-063): beyond
# the prototype it asserted a spec-package contract layer (`technical/schema.sql`,
# `openapi.yaml` conventions) the live catalogs no longer follow, so
# retargeting it would have been a rewrite.
#
# What survives is the one target that never needed prototype/, and it is the
# same command `verify` runs in CI on every push.
.PHONY: validate validate-canonical

validate: validate-canonical

validate-canonical:
	node scripts/validate-canonical-docs.mjs
