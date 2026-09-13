import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface SetUserActiveData {
  uid: string;
  active: boolean;
}

export const setUserActive = functions.onCall({
  region: "europe-west1",
}, async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new functions.HttpsError("unauthenticated", "Duhet te jesh i loguar.");
  }

  const companyId = caller.token.companyId;
  const callerRole = caller.token.role;

  if (!companyId) {
    throw new functions.HttpsError("failed-precondition", "Perdoruesi nuk i perket asnje kompanie.");
  }
  if (callerRole !== "admin") {
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te aktivizoje/deaktivizoje nje perdorues.");
  }

  const data = request.data as SetUserActiveData;
  if (!data.uid) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: uid.");
  }
  if (typeof data.active !== "boolean") {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: active.");
  }
  if (data.uid === caller.uid) {
    throw new functions.HttpsError("failed-precondition", "S'mund te deaktivizosh llogarine tende.");
  }

  const userRef = admin
    .firestore()
    .collection("companies")
    .doc(companyId)
    .collection("users")
    .doc(data.uid);

  const snap = await userRef.get();
  if (!snap.exists) {
    throw new functions.HttpsError("not-found", "Perdoruesi nuk u gjet.");
  }

  await admin.auth().updateUser(data.uid, { disabled: !data.active });

  await userRef.update({
    status: data.active ? "active" : "inactive",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
