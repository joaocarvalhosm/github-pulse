// SPDX-License-Identifier: GPL-3.0-or-later

import {eq, test} from './harness.js';
import * as urls from '../github-pulse@joaocarvalhosm.github.io/lib/urls.js';

test('urls: github.com pages over https are accepted', () => {
    eq(urls.isGitHubPage('https://github.com/octo/repo'), true);
    eq(urls.isGitHubPage('https://github.com/octo'), true);
});

test('urls: anything else is refused', () => {
    for (const url of [
        'http://github.com/octo/repo',          // not https
        'https://github.com.evil.example/x',    // look-alike host
        'https://evil.example/github.com/x',
        'https://user@github.com/x',            // credentials
        'https://github.com@evil.com/x',        // userinfo trick
        'https://github.com:8443/x',            // other port
        'https://gist.github.com/x',            // other host
        'javascript:alert(1)',
        'file:///etc/passwd',
        'https://',
        '',
        'not a url',
    ])
        eq([url, urls.isGitHubPage(url)], [url, false]);
    eq(urls.isGitHubPage(null), false);
    eq(urls.isGitHubPage(42), false);
});

test('urls: only GitHub avatars are downloaded', () => {
    eq(urls.isAvatarUrl('https://avatars.githubusercontent.com/u/1?s=96'), true);
    eq(urls.isAvatarUrl('http://avatars.githubusercontent.com/u/1'), false);
    eq(urls.isAvatarUrl('https://example.com/a.png'), false);
    eq(urls.isAvatarUrl('https://github.com/a.png'), false);
    eq(urls.isAvatarUrl(undefined), false);
});
