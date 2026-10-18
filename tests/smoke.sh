#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Smoke test in a real GNOME Shell, without touching your session: starts a
# headless shell in its own D-Bus session, with a temporary HOME (so no
# keyring, settings or cache of yours), installs the packed extension and
# checks that it enables, disables and enables again without JS errors.
#
#   make smoke
set -u
UUID=github-pulse@joaocarvalhosm.github.io
ZIP=${1:-dist/$UUID.shell-extension.zip}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/run" "$tmp/config/glib-2.0/settings" "$tmp/data/gnome-shell/extensions/$UUID"
chmod 700 "$tmp/run"
unzip -q "$ZIP" -d "$tmp/data/gnome-shell/extensions/$UUID"
# what `gnome-extensions install` does after unpacking
glib-compile-schemas "$tmp/data/gnome-shell/extensions/$UUID/schemas"
cat > "$tmp/config/glib-2.0/settings/keyfile" <<KEYFILE
[org/gnome/shell]
enabled-extensions=['$UUID']
welcome-dialog-last-shown-version='999'
KEYFILE

cat > "$tmp/check.sh" <<'CHECK'
state() { gnome-extensions info "$1" | sed -n 's/^ *State: //p'; }
gnome-shell --headless --wayland --virtual-monitor 1280x800 > "$LOG" 2>&1 &
shell=$!
for _ in $(seq 30); do
    [ "$(state "$UUID" 2>/dev/null)" = ACTIVE ] && break
    sleep 0.5
done
echo "after login: $(state "$UUID")"
gnome-extensions disable "$UUID"; sleep 1
echo "disabled:    $(state "$UUID")"
gnome-extensions enable "$UUID"; sleep 1
echo "enabled:     $(state "$UUID")"
kill "$shell"; wait "$shell" 2>/dev/null
CHECK

out=$(env -i HOME="$tmp" PATH="$PATH" LANG="${LANG:-C.UTF-8}" UUID="$UUID" LOG="$tmp/shell.log" \
    XDG_RUNTIME_DIR="$tmp/run" XDG_CONFIG_HOME="$tmp/config" XDG_DATA_HOME="$tmp/data" \
    XDG_CACHE_HOME="$tmp/cache" GSETTINGS_BACKEND=keyfile \
    timeout 60 dbus-run-session -- bash "$tmp/check.sh" 2>/dev/null \
    | grep -E "^(after login|disabled|enabled):")
echo "$out"

errors=$(grep -E "JS ERROR|uncatchable|Extension $UUID|$UUID.*(Error|error)" "$tmp/shell.log")
if [ -n "$errors" ]; then
    echo "$errors"
fi
expected=$'after login: ACTIVE\ndisabled:    INACTIVE\nenabled:     ACTIVE'
if [ "$out" = "$expected" ] && [ -z "$errors" ]; then
    echo "smoke test passed"
else
    echo "smoke test FAILED"
    tail -40 "$tmp/shell.log"
    exit 1
fi
