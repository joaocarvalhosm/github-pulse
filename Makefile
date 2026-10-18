# SPDX-License-Identifier: GPL-3.0-or-later
UUID := github-pulse@joaocarvalhosm.github.io
ZIP  := dist/$(UUID).shell-extension.zip

.PHONY: test smoke check pack install uninstall clean

# Unit tests, with a throwaway cache directory so ~/.cache is never touched.
test:
	@tmp=$$(mktemp -d) && XDG_CACHE_HOME=$$tmp gjs -m tests/run.js; \
	status=$$?; rm -rf "$$tmp"; exit $$status

# Enable/disable cycle in a headless GNOME Shell, isolated from your session.
smoke: pack
	tests/smoke.sh $(ZIP)

check: test smoke

# Only what the extension needs goes into the zip (extensions.gnome.org
# rejects build scripts, tests and other extra files).
pack:
	mkdir -p dist
	gnome-extensions pack $(UUID) --force --out-dir=dist \
		--extra-source=lib --extra-source=ui --extra-source=icons

install: pack
	gnome-extensions install --force $(ZIP)
	@echo "Installed. Log out and back in, then: gnome-extensions enable $(UUID)"

uninstall:
	gnome-extensions uninstall $(UUID)

clean:
	rm -rf dist
