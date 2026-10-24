PYTHON ?= python3

.PHONY: build preview

build:
	$(PYTHON) scripts/build.py

preview:
	BIORACLE_REPO="$(CURDIR)" BIORACLE_PYTHON="$(PYTHON)" bash scripts/preview_bioracle.sh
