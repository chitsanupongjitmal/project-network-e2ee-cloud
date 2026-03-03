
const envServerUrl = (import.meta.env.VITE_SERVER_URL || '').trim();

function resolveServerUrl() {
    if (envServerUrl) {
        return envServerUrl.replace(/\/$/, '');
    }

    if (typeof window !== 'undefined' && window.location) {
        return window.location.origin.replace(/\/$/, '');
    }

    return 'http://localhost:4001';
}

export const SERVER_URL = resolveServerUrl();
