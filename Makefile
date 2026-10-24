PYTHON ?= python3

.PHONY: build preview

build:
	$(PYTHON) scripts/build.py

preview:
	$(PYTHON) -m http.server --bind 127.0.0.1 --directory dist 8000
