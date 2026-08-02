import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface UnassignPosData {
  businessUnitId: string;
  posId: string;
}

export const unassignPos = functions.onCall(async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new functions.HttpsError("unauthenticated", "Duhet te jesh i loguar.");
  }

  const companyId = caller.token.companyId;
  const role = caller.token.role;

  if (!companyId) {
    throw new functions.HttpsError("failed-precondition", "Perdoruesi nuk i perket asnje kompanie.");
  }
  if (role !== "admin") {
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te heqe nje POS.");
  }

  const data = request.data as UnassignPosData;
  if (!data.businessUnitId || !data.posId) {
    throw new functions.HttpsError(
      "invalid-argument",
      "Mungojne fusha te detyrueshme: businessUnitId, posId."
    );
  }

  const posRef = admin
    .firestore()
    .collection("companies")
    .doc(companyId)
    .collection("businessUnits")
    .doc(data.businessUnitId)
    .collection("pos")
    .doc(data.posId);

  const snap = await posRef.get();
  if (!snap.exists) {
    throw new functions.HttpsError("not-found", "Ky POS nuk ekziston ne kete Business Unit.");
  }

  await posRef.delete();

  return { ok: true };
});