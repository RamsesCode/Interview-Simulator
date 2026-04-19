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

export type DebuggingSession = {
  id: string;
  user_id: string;
  challenge_title: string;
  challenge_description: string | null;
  language: string;
  status: string;
  initial_code: string | null;
  final_code: string | null;
  started_at: string;
};

export type SpeedRoundSession = {
  id: string;
  user_id: string;
  round_title: string;
  total_questions: number;
  current_question: number;
  language: string;
  status: string;
  time_limit_seconds: number;
  started_at: string;
};

export type DSASession = {
  id: string;
  user_id: string;
  topic: string;
  problem_title: string;
  problem_description: string | null;
  language: string;
  status: string;
  hint_level: number;
  final_code: string | null;
  started_at: string;
};

const ACCOUNTS_KEY = "ai_interview_accounts";
const CURRENT_USER_KEY = "ai_interview_current_user";
const INTERVIEWS_KEY = "ai_interview_sessions";
const CODING_KEY = "ai_coding_sessions";
const DEBUGGING_KEY = "ai_debugging_sessions";
const SPEED_ROUND_KEY = "ai_speed_round_sessions";
const DSA_KEY = "ai_dsa_sessions";

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

// Debugging Challenge Sessions
function getDebuggingSessions() {
  return readJson<DebuggingSession[]>(DEBUGGING_KEY, []);
}

function setDebuggingSessions(sessions: DebuggingSession[]) {
  writeJson(DEBUGGING_KEY, sessions);
}

export function createDebuggingSession(
  userId: string,
  challengeTitle: string,
  challengeDescription: string,
  language: string,
  initialCode: string,
): DebuggingSession {
  const session: DebuggingSession = {
    id: createId(),
    user_id: userId,
    challenge_title: challengeTitle,
    challenge_description: challengeDescription,
    language,
    status: "in_progress",
    initial_code: initialCode,
    final_code: null,
    started_at: new Date().toISOString(),
  };

  const sessions = getDebuggingSessions();
  sessions.push(session);
  setDebuggingSessions(sessions);
  return session;
}

export function listDebuggingSessions(userId: string, limit = 5): DebuggingSession[] {
  return getDebuggingSessions()
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

export function getDebuggingSessionById(sessionId: string): DebuggingSession | null {
  return getDebuggingSessions().find((s) => s.id === sessionId) ?? null;
}

export function saveDebuggingSessionCode(sessionId: string, code: string): boolean {
  const sessions = getDebuggingSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;

  sessions[idx] = {
    ...sessions[idx],
    final_code: code,
  };
  setDebuggingSessions(sessions);
  return true;
}

// Speed Round Sessions
function getSpeedRoundSessions() {
  return readJson<SpeedRoundSession[]>(SPEED_ROUND_KEY, []);
}

function setSpeedRoundSessions(sessions: SpeedRoundSession[]) {
  writeJson(SPEED_ROUND_KEY, sessions);
}

export function createSpeedRoundSession(
  userId: string,
  roundTitle: string,
  totalQuestions: number,
  language: string,
  timeLimitSeconds: number,
): SpeedRoundSession {
  const session: SpeedRoundSession = {
    id: createId(),
    user_id: userId,
    round_title: roundTitle,
    total_questions: totalQuestions,
    current_question: 1,
    language,
    status: "in_progress",
    time_limit_seconds: timeLimitSeconds,
    started_at: new Date().toISOString(),
  };

  const sessions = getSpeedRoundSessions();
  sessions.push(session);
  setSpeedRoundSessions(sessions);
  return session;
}

export function listSpeedRoundSessions(userId: string, limit = 5): SpeedRoundSession[] {
  return getSpeedRoundSessions()
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

export function getSpeedRoundSessionById(sessionId: string): SpeedRoundSession | null {
  return getSpeedRoundSessions().find((s) => s.id === sessionId) ?? null;
}

// DSA Sessions
function getDSASessions() {
  return readJson<DSASession[]>(DSA_KEY, []);
}

function setDSASessions(sessions: DSASession[]) {
  writeJson(DSA_KEY, sessions);
}

export function createDSASession(
  userId: string,
  topic: string,
  problemTitle: string,
  problemDescription: string,
  language: string,
): DSASession {
  const session: DSASession = {
    id: createId(),
    user_id: userId,
    topic,
    problem_title: problemTitle,
    problem_description: problemDescription,
    language,
    status: "in_progress",
    hint_level: 0,
    final_code: null,
    started_at: new Date().toISOString(),
  };

  const sessions = getDSASessions();
  sessions.push(session);
  setDSASessions(sessions);
  return session;
}

export function listDSASessions(userId: string, limit = 5): DSASession[] {
  return getDSASessions()
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

export function getDSASessionById(sessionId: string): DSASession | null {
  return getDSASessions().find((s) => s.id === sessionId) ?? null;
}

export function saveDSASessionCode(sessionId: string, code: string): boolean {
  const sessions = getDSASessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;

  sessions[idx] = {
    ...sessions[idx],
    final_code: code,
  };
  setDSASessions(sessions);
  return true;
}

export function updateDSAHintLevel(sessionId: string, hintLevel: number): boolean {
  const sessions = getDSASessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;

  sessions[idx] = {
    ...sessions[idx],
    hint_level: hintLevel,
  };
  setDSASessions(sessions);
  return true;
}
