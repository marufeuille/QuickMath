# Makefile

# Extract the version from manifest.json using grep and sed.
VERSION := $(shell grep '"version"' manifest.json | sed -E 's/.*"version": *"([^"]+)".*/\1/')

build:
	@echo "Building ZIP file: QuickMath.$(VERSION).zip"
	@zip -r QuickMath-$(VERSION).zip . -x "extension_test/*" "resource/*" ".git/*" ".DS_Store"

.PHONY: build
