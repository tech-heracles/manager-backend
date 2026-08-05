import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface CreateCompanyData {
  companyName: string;
  displayName?: string;
}

export const createCompany = functions.onCall({
    region: "europe-west1",
  },async (request) => {
  const caller = request.auth;

  if (!caller) {
    throw new functions.HttpsError("unauthenticated", "Duhet te jesh i loguar.");
  }

  // Nese token-i ka tashme companyId, perdoruesi eshte pjese e nje kompanie.
  // (Custom claims vendosen nga onUserWrite pasi krijohet user-doc.)
  if (caller.token.companyId) {
    throw new functions.HttpsError(
      "already-exists",
      "Ky perdorues eshte tashme pjese e nje kompanie."
    );
  }

  const data = request.data as CreateCompanyData;

  if (!data.companyName || !data.companyName.trim()) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: companyName.");
  }

  const uid = caller.uid;
  const email = caller.token.email ?? null;
  const displayName = data.displayName?.trim() || caller.token.name || email || "Admin";

  const db = admin.firestore();
  const companyRef = db.collection("companies").doc();
  const companyId = companyRef.id;
  const userRef = companyRef.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    tx.set(companyRef, {
      name: data.companyName.trim(),
      ownerUid: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(userRef, {
      displayName,
      email,
      role: "admin",
      businessUnitIds: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { companyId };
});