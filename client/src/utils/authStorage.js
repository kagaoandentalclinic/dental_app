const TOKEN_KEY = 'dental_token';

export function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);

    if (!token) return;
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
}
