import * as admin from 'firebase-admin';

function loadServiceAccountJson(): any {
  // Prefer the env var you actually deploy with:
  // --set-secrets "...,FIREBASE_ADMIN_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest"
  const raw =
    process.env.FIREBASE_ADMIN_JSON ??
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw || raw.trim().length === 0) {
    throw new Error(
      'FIREBASE_ADMIN_JSON (or FIREBASE_SERVICE_ACCOUNT_JSON) env var is missing',
    );
  }

  let s = raw.trim();

  // Remove wrapping quotes if someone stored it quoted
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }

  // Helper: safely parse JSON string and then fix private_key
  const parseAndFix = (jsonText: string) => {
    const obj = JSON.parse(jsonText);

    // ✅ Fix private_key AFTER parsing (correct place)
    if (typeof obj.private_key === 'string') {
      obj.private_key = obj.private_key.replace(/\\n/g, '\n');
    }
    return obj;
  };

  // Case A) Raw JSON injected by Cloud Run Secret (most common)
  if (s.startsWith('{')) {
    try {
      return parseAndFix(s);
    } catch (e: any) {
      throw new Error(
        `Invalid FIREBASE_ADMIN_JSON raw JSON. Parse error: ${e?.message ?? e}`,
      );
    }
  }

  // Case B) Base64 JSON (fallback for old setups)
  try {
    const decoded = Buffer.from(s, 'base64').toString('utf8').trim();
    if (!decoded.startsWith('{')) {
      throw new Error('Decoded value is not JSON');
    }
    return parseAndFix(decoded);
  } catch (e: any) {
    throw new Error(
      `Invalid Firebase service account JSON. Not raw JSON and base64 decode failed: ${e?.message ?? e}`,
    );
  }
}

export function getFirebaseAdminApp() {
  if (admin.apps.length) return admin.app();

  const serviceAccount = loadServiceAccountJson();

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
