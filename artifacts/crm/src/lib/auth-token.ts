// Utility for storing the auth token cross-origin safe
const TOKEN_KEY = "dientesbot_auth_token";

export function saveAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
