export type LocalUser = {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
  };
};

type LocalAccount = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export type InterviewSession = {
  id: string;
  user_id: string;
  job_role: string;
  status: string;
  total_score: number | null;
  started_at: string;
};
//test//
export type CodingSession = {
  id: string;
  user_id: string;
  problem_title: string;
  problem_description: string | null;
  language: string;
  status: string;
  final_code: string | null;
  started_at: string;
};

const ACCOUNTS_KEY = "ai_interview_accounts";
const CURRENT_USER_KEY = "ai_interview_current_user";
const INTERVIEWS_KEY = "ai_interview_sessions";
const CODING_KEY = "ai_coding_sessions";

function createId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fall back to timestamp-based ID.
  }

  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toUser(account: LocalAccount): LocalUser {
  return {
    id: account.id,
    email: account.email,
    user_metadata: {
      full_name: account.name,
    },
  };
}

function getAccounts() {
  return readJson<LocalAccount[]>(ACCOUNTS_KEY, []);
}

function setAccounts(accounts: LocalAccount[]) {
  writeJson(ACCOUNTS_KEY, accounts);
}

export function getCurrentUser(): LocalUser | null {
  return readJson<LocalUser | null>(CURRENT_USER_KEY, null);
}

function setCurrentUser(user: LocalUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }
  writeJson(CURRENT_USER_KEY, user);
}

export function signUpLocal(name: string, email: string, password: string): LocalUser {
  const normalizedEmail = normalizeEmail(email);
  const accounts = getAccounts();
  const exists = accounts.some((a) => a.email === normalizedEmail);
  if (exists) {
    throw new Error("An account with this email already exists.");
  }

  const account: LocalAccount = {
    id: createId(),
    name: name.trim(),
    email: normalizedEmail,
    password,
  };

  accounts.push(account);
  setAccounts(accounts);

  const user = toUser(account);
  setCurrentUser(user);
  return user;
}

export function signInLocal(email: string, password: string): LocalUser {
  const normalizedEmail = normalizeEmail(email);
  const account = getAccounts().find((a) => a.email === normalizedEmail && a.password === password);
  if (!account) {
    throw new Error("Invalid email or password.");
  }

  const user = toUser(account);
  setCurrentUser(user);
  return user;
}

export function signOutLocal() {
  setCurrentUser(null);
}

function getInterviewSessions() {
  return readJson<InterviewSession[]>(INTERVIEWS_KEY, []);
}

function setInterviewSessions(sessions: InterviewSession[]) {
  writeJson(INTERVIEWS_KEY, sessions);
}

export function createInterviewSession(userId: string, jobRole: string): InterviewSession {
  const session: InterviewSession = {
    id: createId(),
    user_id: userId,
    job_role: jobRole,
    status: "in_progress",
    total_score: null,
    started_at: new Date().toISOString(),
  };

  const sessions = getInterviewSessions();
  sessions.push(session);
  setInterviewSessions(sessions);
  return session;
}

export function listInterviewSessions(userId: string, limit = 5): InterviewSession[] {
  return getInterviewSessions()
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

export function getInterviewSessionById(sessionId: string): InterviewSession | null {
  return getInterviewSessions().find((s) => s.id === sessionId) ?? null;
}

function getCodingSessions() {
  return readJson<CodingSession[]>(CODING_KEY, []);
}

function setCodingSessions(sessions: CodingSession[]) {
  writeJson(CODING_KEY, sessions);
}

export function createCodingSession(
  userId: string,
  problemTitle: string,
  problemDescription: string,
  language: string,
): CodingSession {
  const session: CodingSession = {
    id: createId(),
    user_id: userId,
    problem_title: problemTitle,
    problem_description: problemDescription,
    language,
    status: "in_progress",
    final_code: null,
    started_at: new Date().toISOString(),
  };

  const sessions = getCodingSessions();
  sessions.push(session);
  setCodingSessions(sessions);
  return session;
}

export function listCodingSessions(userId: string, limit = 5): CodingSession[] {
  return getCodingSessions()
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

export function getCodingSessionById(sessionId: string): CodingSession | null {
  return getCodingSessions().find((s) => s.id === sessionId) ?? null;
}

export function saveCodingSessionCode(sessionId: string, code: string): boolean {
  const sessions = getCodingSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;

  sessions[idx] = {
    ...sessions[idx],
    final_code: code,
  };
  setCodingSessions(sessions);
  return true;
}
