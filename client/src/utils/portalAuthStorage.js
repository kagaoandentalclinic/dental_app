const PORTAL_TOKEN_KEY = 'dental_portal_token';

export function getStoredPortalToken() {
    return localStorage.getItem(PORTAL_TOKEN_KEY) || sessionStorage.getItem(PORTAL_TOKEN_KEY);
}

export function storePortalToken(token) {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    sessionStorage.removeItem(PORTAL_TOKEN_KEY);
    if (!token) return;
    localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearStoredPortalToken() {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    sessionStorage.removeItem(PORTAL_TOKEN_KEY);
}
