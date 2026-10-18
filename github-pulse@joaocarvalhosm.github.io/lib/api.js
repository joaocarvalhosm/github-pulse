// SPDX-License-Identifier: GPL-3.0-or-later
//
// One GraphQL request returns everything the menu shows: the contribution
// calendar of the last year, the yearly totals, where the commits went and
// the most recently pushed repositories.
//
// The token is only ever sent to ENDPOINT, and redirects are not followed,
// so it cannot be forwarded to another host.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');

const ENDPOINT = 'https://api.github.com/graphql';
const USER_AGENT = 'github-pulse-gnome-extension';
const MAX_ERROR_LENGTH = 200;
const MAX_AVATAR_BYTES = 1024 * 1024;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Bumped when the shape of the parsed data changes; older caches are ignored. */
export const PULSE_VERSION = 1;

export const QUERY = `
query ($repoCount: Int!) {
  viewer {
    login
    name
    url
    avatarUrl(size: 96)
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount contributionLevel }
        }
      }
      commitContributionsByRepository(maxRepositories: 10) {
        repository { nameWithOwner url primaryLanguage { name color } }
        contributions { totalCount }
      }
    }
    repositories(first: $repoCount, ownerAffiliations: OWNER,
                 orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes {
        name
        url
        isPrivate
        isFork
        pushedAt
        stargazerCount
        forkCount
        primaryLanguage { name color }
        issues(states: OPEN) { totalCount }
        pullRequests(states: OPEN) { totalCount }
      }
    }
  }
}`;

const LEVELS = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
};

/** Error with a `kind` the UI can explain: auth, rate, network or api. */
export class GitHubError extends Error {
    constructor(kind, message) {
        super(message);
        this.name = 'GitHubError';
        this.kind = kind;
    }
}

/** The error for a non-OK HTTP status, or null when the status is 200. */
export function errorForStatus(status, rateRemaining = null) {
    if (status === 200)
        return null;
    if (status === 401)
        return new GitHubError('auth', 'O GitHub recusou o token.');
    if (status === 429 || (status === 403 && rateRemaining === '0'))
        return new GitHubError('rate', 'Limite de uso da API do GitHub atingido.');
    if (status === 403)
        return new GitHubError('auth', 'O token não tem permissão para isso.');
    return new GitHubError('api', `O GitHub respondeu ${status}.`);
}

/** The `viewer` of a GraphQL response, or the error it reports. */
export function viewerFromResponse(json) {
    if (json?.errors?.length) {
        let message = json.errors.map(e => String(e?.message ?? '')).join('; ');
        if (message.length > MAX_ERROR_LENGTH)
            message = `${message.slice(0, MAX_ERROR_LENGTH - 1)}…`;
        throw new GitHubError('api', message || 'O GitHub retornou um erro.');
    }
    const viewer = json?.data?.viewer;
    if (!viewer)
        throw new GitHubError('api', 'Resposta do GitHub incompleta.');
    return viewer;
}

/** Turn the GraphQL `viewer` object into the data the UI uses. */
export function parseViewer(viewer, fetchedAt = new Date()) {
    const collection = viewer.contributionsCollection;
    const days = collection.contributionCalendar.weeks
        .flatMap(week => week.contributionDays)
        .map(day => ({
            date: day.date,
            count: day.contributionCount,
            level: LEVELS[day.contributionLevel] ?? 0,
        }));
    const language = l => (l ? {name: l.name, color: l.color} : null);
    return {
        version: PULSE_VERSION,
        fetchedAt: fetchedAt.toISOString(),
        user: {
            login: viewer.login,
            name: viewer.name,
            url: viewer.url,
            avatarUrl: viewer.avatarUrl,
        },
        calendar: {
            total: collection.contributionCalendar.totalContributions,
            days,
        },
        totals: {
            commits: collection.totalCommitContributions,
            pullRequests: collection.totalPullRequestContributions,
            issues: collection.totalIssueContributions,
            reviews: collection.totalPullRequestReviewContributions,
            private: collection.restrictedContributionsCount,
        },
        topRepos: collection.commitContributionsByRepository.map(entry => ({
            name: entry.repository.nameWithOwner,
            url: entry.repository.url,
            language: language(entry.repository.primaryLanguage),
            commits: entry.contributions.totalCount,
        })),
        repos: viewer.repositories.nodes.map(repo => ({
            name: repo.name,
            url: repo.url,
            isPrivate: repo.isPrivate,
            isFork: repo.isFork,
            pushedAt: repo.pushedAt,
            stars: repo.stargazerCount,
            forks: repo.forkCount,
            language: language(repo.primaryLanguage),
            openIssues: repo.issues.totalCount,
            openPullRequests: repo.pullRequests.totalCount,
        })),
    };
}

const isDay = day => typeof day?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
    Number.isInteger(day.count) && Number.isInteger(day.level) && day.level >= 0 && day.level <= 4;

/**
 * Whether `pulse` (read back from the cache) has the shape the UI expects,
 * so a stale or damaged file is fetched again instead of breaking the menu.
 */
export function isValidPulse(pulse) {
    return pulse?.version === PULSE_VERSION &&
        typeof pulse.fetchedAt === 'string' &&
        typeof pulse.user?.login === 'string' &&
        Number.isInteger(pulse.calendar?.total) &&
        Array.isArray(pulse.calendar.days) && pulse.calendar.days.every(isDay) &&
        typeof pulse.totals === 'object' && pulse.totals !== null &&
        Array.isArray(pulse.topRepos) && Array.isArray(pulse.repos);
}

export class GitHubClient {
    constructor() {
        this._session = new Soup.Session({user_agent: USER_AGENT, timeout: 30});
    }

    async _post(token, body, cancellable) {
        const message = Soup.Message.new('POST', ENDPOINT);
        message.set_flags(Soup.MessageFlags.NO_REDIRECT);
        message.request_headers.append('Authorization', `Bearer ${token}`);
        message.set_request_body_from_bytes('application/json',
            new GLib.Bytes(new TextEncoder().encode(JSON.stringify(body))));
        let bytes;
        try {
            bytes = await this._session.send_and_read_async(
                message, GLib.PRIORITY_DEFAULT, cancellable);
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                throw e;
            throw new GitHubError('network', 'Sem conexão com o GitHub.');
        }
        const error = errorForStatus(message.get_status(),
            message.response_headers.get_one('x-ratelimit-remaining'));
        if (error)
            throw error;
        try {
            return JSON.parse(new TextDecoder().decode(bytes.get_data()));
        } catch {
            throw new GitHubError('api', 'Resposta do GitHub ilegível.');
        }
    }

    /** Everything the menu shows, for the owner of `token`. */
    async fetchPulse(token, {repoCount = 6, cancellable = null} = {}) {
        const json = await this._post(token,
            {query: QUERY, variables: {repoCount}}, cancellable);
        return parseViewer(viewerFromResponse(json));
    }

    /**
     * Download the avatar to `file`. The caller checks the URL first
     * (urls.isAvatarUrl); here only a small image is accepted, without
     * following redirects, and no token is sent.
     */
    async download(url, file, cancellable = null) {
        const message = Soup.Message.new('GET', url);
        message.set_flags(Soup.MessageFlags.NO_REDIRECT);
        const bytes = await this._session.send_and_read_async(
            message, GLib.PRIORITY_DEFAULT, cancellable);
        if (message.get_status() !== Soup.Status.OK)
            throw new GitHubError('network', `avatar: ${message.get_status()}`);
        const [type] = message.response_headers.get_content_type();
        if (!AVATAR_TYPES.includes(type) || bytes.get_size() > MAX_AVATAR_BYTES)
            throw new GitHubError('api', 'avatar: not a small image');
        await file.replace_contents_bytes_async(bytes, null, false,
            Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, cancellable);
    }

    destroy() {
        this._session.abort();
        this._session = null;
    }
}
