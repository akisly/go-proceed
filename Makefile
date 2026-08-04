.PHONY: validate validate-canonical validate-contracts validate-prototype validate-qa

validate: validate-canonical validate-prototype validate-qa validate-contracts

validate-canonical:
	node scripts/validate-canonical-docs.mjs

validate-contracts:
	python3 scripts/validate_package.py

validate-prototype:
	npm --prefix prototype run lint
	npm --prefix prototype run build

validate-qa: validate-prototype
	TMPDIR="$(CURDIR)/prototype/qa-runtime-tmp" npm --prefix prototype run qa
