import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

const VALID_ROLES = ["admin", "supervisor", "operator"] as const;
type Role = (typeof VALID_ROLES)[number];

interface UpdateUserData {
  uid: string;
  role?: Role;
  businessUnitIds?: string[];
}

export const updateUser = functions.onCall({
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
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te ndryshoje nje perdorues.");
  }

  const data = request.data as UpdateUserData;
  if (!data.uid) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: uid.");
  }
  if (data.uid === caller.uid) {
    throw new functions.HttpsError("failed-precondition", "S'mund te ndryshosh rolin/business unit-et e tua.");
  }
  if (data.role && !VALID_ROLES.includes(data.role)) {
    throw new functions.HttpsError("invalid-argument", "Rol i pavlefshem.");
  }
  if (data.businessUnitIds && !Array.isArray(data.businessUnitIds)) {
    throw new functions.HttpsError("invalid-argument", "businessUnitIds duhet te jete nje liste.");
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

  const update: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (data.role) update.role = data.role;
  if (data.businessUnitIds) update.businessUnitIds = data.businessUnitIds;

  await userRef.update(update);

  return { ok: true };
});
