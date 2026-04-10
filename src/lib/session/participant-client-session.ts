const PARTICIPANT_SESSION_TOKEN_KEY = "freshers-match.participant-session-token";

export function saveParticipantSessionToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PARTICIPANT_SESSION_TOKEN_KEY, token);
}

export function getParticipantSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(PARTICIPANT_SESSION_TOKEN_KEY);
}

export function clearParticipantSessionToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PARTICIPANT_SESSION_TOKEN_KEY);
}
