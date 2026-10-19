/**
 * Password policy, shared by the browser and the server so the meter and the
 * enforcement always agree.
 *
 * Kept free of `server-only` on purpose: the client imports the same rules that
 * the API enforces.
 *
 * Length is the dominant factor (NIST SP 800-63B), so the minimum is 12 rather
 * than a short complex string. We additionally require three of four character
 * classes to stop `aaaaaaaaaaaa` style passwords.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_REQUIREMENTS = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { id: "case", label: "Upper and lower case letters" },
  { id: "number", label: "At least one number" },
  { id: "symbol", label: "At least one symbol" },
] as const;

export type PasswordRequirementId = (typeof PASSWORD_REQUIREMENTS)[number]["id"];

export interface PasswordAssessment {
  length: boolean;
  case: boolean;
  number: boolean;
  symbol: boolean;
  classes: number;
  /** 0–4, suitable for a 4-segment strength bar. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  valid: boolean;
  problems: string[];
}

/** Common passwords that must never be accepted, checked case-insensitively. */
const BLOCKLIST = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "qwertyuiop",
  "qwerty123456",
  "123456789012",
  "administrator",
  "letmein12345",
  "welcome12345",
  "iloveyou1234",
  "monkey123456",
  "dragon123456",
  "football1234",
  "1security",
  "1security123",
  "changeme1234",
]);

export function assessPassword(password: string): PasswordAssessment {
  const length = password.length >= PASSWORD_MIN_LENGTH;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const caseOk = hasLower && hasUpper;
  const classes =
    Number(caseOk) + Number(hasNumber) + Number(hasSymbol);

  const problems: string[] = [];
  if (!length)
    problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (!caseOk) problems.push("Mix upper and lower case letters.");
  if (classes < 3) problems.push("Add a number and a symbol.");
  if (password.length > PASSWORD_MAX_LENGTH)
    problems.push(`Keep it under ${PASSWORD_MAX_LENGTH} characters.`);
  if (BLOCKLIST.has(password.toLowerCase()))
    problems.push("This password appears in public breach lists.");
  if (/^(.)\1+$/.test(password)) problems.push("Avoid repeating one character.");
  if (/^(?:0123|1234|2345|abcd|qwer)/i.test(password))
    problems.push("Avoid keyboard or number sequences.");
  if (password.length > 0 && password.toLowerCase().includes("1security"))
    problems.push("Do not include the product name.");

  let score: PasswordAssessment["score"] = 0;
  if (password.length > 0) {
    if (!length) score = classes >= 3 ? 1 : 0;
    else if (classes <= 1) score = 1;
    else if (classes === 2) score = 2;
    else if (password.length >= 16) score = 4;
    else score = 3;
  }

  const label: PasswordAssessment["label"] =
    score === 0
      ? "Very weak"
      : score === 1
        ? "Weak"
        : score === 2
          ? "Fair"
          : score === 3
            ? "Strong"
            : "Excellent";

  return {
    length,
    case: caseOk,
    number: hasNumber,
    symbol: hasSymbol,
    classes,
    score,
    label,
    valid: problems.length === 0,
    problems,
  };
}

/** Server-side gate. Returns null when acceptable, otherwise a message. */
export function validatePassword(password: string): string | null {
  const assessment = assessPassword(password);
  if (assessment.valid) return null;
  return assessment.problems[0] ?? "Password does not meet the policy.";
}
