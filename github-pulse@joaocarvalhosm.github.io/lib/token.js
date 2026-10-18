// SPDX-License-Identifier: GPL-3.0-or-later
//
// The GitHub token lives only in the user's keyring (libsecret, encrypted
// at rest and unlocked with the session). It is never written to GSettings,
// to the cache or to the log. Shared by the extension and its preferences.

import Gio from 'gi://Gio';
import Secret from 'gi://Secret';

const SCHEMA_NAME = 'org.gnome.shell.extensions.github-pulse';
const ATTRIBUTES = {service: 'github', purpose: 'api-token'};
const LABEL = 'GitHub Pulse: token da API do GitHub';

let schema = null;

function getSchema() {
    schema ??= new Secret.Schema(SCHEMA_NAME, Secret.SchemaFlags.NONE, {
        service: Secret.SchemaAttributeType.STRING,
        purpose: Secret.SchemaAttributeType.STRING,
    });
    return schema;
}

function promise(start, finish) {
    return new Promise((resolve, reject) => {
        start((_source, result) => {
            try {
                resolve(finish(result));
            } catch (e) {
                reject(e);
            }
        });
    });
}

/** The saved token, or null. */
export function lookupToken(cancellable = null) {
    return promise(
        cb => Secret.password_lookup(getSchema(), ATTRIBUTES, cancellable, cb),
        result => Secret.password_lookup_finish(result) || null);
}

export function storeToken(token, cancellable = null) {
    return promise(
        cb => Secret.password_store(getSchema(), ATTRIBUTES, Secret.COLLECTION_DEFAULT,
            LABEL, token, cancellable, cb),
        result => Secret.password_store_finish(result));
}

export function clearToken(cancellable = null) {
    return promise(
        cb => Secret.password_clear(getSchema(), ATTRIBUTES, cancellable, cb),
        result => Secret.password_clear_finish(result));
}

/**
 * Rough format check before anything is stored: fine-grained tokens start
 * with `github_pat_`, classic ones with `ghp_`. Rejects pasted spaces or
 * line breaks so they never end up in an HTTP header.
 */
export function looksLikeToken(token) {
    return /^(github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,})$/.test(token);
}

export function isCancelled(error) {
    return error?.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED) ?? false;
}

/** Drop the cached schema when the extension is disabled. */
export function releaseSchema() {
    schema = null;
}
