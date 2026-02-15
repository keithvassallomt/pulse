const fs = require('fs');
const path = require('path');

const STANDARD_KEY_NAMES = ['id_ed25519', 'id_rsa', 'id_ecdsa'];

/**
 * Try to discover a default private key if SSH_KEY_PATH is not set.
 */
function discoverDefaultKey() {
    if (process.env.SSH_KEY_PATH) {
        try {
            const key = fs.readFileSync(process.env.SSH_KEY_PATH);
            return key;
        } catch (err) {
            console.warn(`Warning: Could not read SSH key from SSH_KEY_PATH (${process.env.SSH_KEY_PATH}): ${err.message}`);
            return null;
        }
    }

    const sshDir = path.join(process.env.HOME, '.ssh');
    for (const name of STANDARD_KEY_NAMES) {
        const keyPath = path.join(sshDir, name);
        try {
            const key = fs.readFileSync(keyPath);
            return key;
        } catch (_) {
            // Not found, try next.
        }
    }

    return null;
}

/**
 * Parse ~/.ssh/config for host-specific IdentityFile and HostName directives.
 * Returns { hostKeys: { alias -> keyPath }, hostNames: { alias -> realHostname }, wildcardKey: keyPath|null }
 */
function parseSshConfig() {
    const configPath = path.join(process.env.HOME, '.ssh', 'config');
    const hostKeys = {};
    const hostNames = {};
    let wildcardKey = null;
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        let currentHosts = [];
        let isWildcard = false;
        for (const rawLine of content.split('\n')) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;

            const hostMatch = line.match(/^Host\s+(.+)/i);
            if (hostMatch) {
                const patterns = hostMatch[1].split(/\s+/);
                isWildcard = patterns.length === 1 && patterns[0] === '*';
                currentHosts = patterns.filter(h => !h.includes('*') && !h.includes('?'));
                continue;
            }

            const idMatch = line.match(/^IdentityFile\s+(.+)/i);
            if (idMatch) {
                let keyPath = idMatch[1].trim();
                if (keyPath.startsWith('~/')) keyPath = path.join(process.env.HOME, keyPath.slice(2));
                if (isWildcard && !wildcardKey) {
                    wildcardKey = keyPath;
                }
                for (const host of currentHosts) {
                    hostKeys[host] = keyPath;
                }
                continue;
            }

            const hnMatch = line.match(/^HostName\s+(.+)/i);
            if (hnMatch && currentHosts.length > 0) {
                const realHost = hnMatch[1].trim();
                for (const host of currentHosts) {
                    hostNames[host] = realHost;
                }
            }
        }
    } catch (_) {
        // No SSH config found; fall back to defaults.
    }
    return { hostKeys, hostNames, wildcardKey };
}

const defaultPrivateKey = discoverDefaultKey();
const sshConfig = parseSshConfig();

function getKeyForHost(hostname) {
    if (process.env.SSH_KEY_PATH) return defaultPrivateKey;

    // Direct alias match
    if (sshConfig.hostKeys[hostname]) {
        try {
            return fs.readFileSync(sshConfig.hostKeys[hostname]);
        } catch (err) {
            console.warn(`Could not read host-specific key for ${hostname} (${sshConfig.hostKeys[hostname]}): ${err.message}`);
        }
    }

    // Reverse lookup: hostname might match a HostName value
    for (const [alias, realHost] of Object.entries(sshConfig.hostNames)) {
        if (realHost === hostname && sshConfig.hostKeys[alias]) {
            try {
                return fs.readFileSync(sshConfig.hostKeys[alias]);
            } catch (err) {
                console.warn(`Could not read key for ${hostname} via alias ${alias}: ${err.message}`);
            }
        }
    }

    // Wildcard fallback from Host *
    if (!defaultPrivateKey && sshConfig.wildcardKey) {
        try {
            return fs.readFileSync(sshConfig.wildcardKey);
        } catch (_) {
            // Ignore unreadable wildcard key and fall back to defaults.
        }
    }

    return defaultPrivateKey;
}

module.exports = {
    getKeyForHost,
    discoverDefaultKey,
    parseSshConfig
};
