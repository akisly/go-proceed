.PHONY: validate validate-contracts validate-prototype validate-qa

validate: validate-prototype validate-qa validate-contracts

validate-contracts:
	python3 scripts/validate_package.py

validate-prototype:
	npm --prefix prototype run lint
	npm --prefix prototype run build

validate-qa: validate-prototype
	TMPDIR="$(CURDIR)/prototype/qa-runtime-tmp" npm --prefix prototype run qa
