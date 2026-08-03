import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface LookupCompanyData {
  email: string;
}

export const lookupCompanyForEmail = functions.onCall(async (request) => {
  const data = request.data as LookupCompanyData;

  if (!data.email || !data.email.trim()) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: email.");
  }

  const email = data.email.trim().toLowerCase();

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    // Don't distinguish "no account" from "no company yet" in the error
    // itself — just tell the client nothing was found.
    return { found: false };
  }

  const companyId = userRecord.customClaims?.companyId as string | undefined;
  if (!companyId) {
    return { found: false };
  }

  const companySnap = await admin.firestore().collection("companies").doc(companyId).get();
  const companyName = companySnap.data()?.name as string | undefined;

  return { found: true, companyName: companyName ?? "Unnamed company" };
});