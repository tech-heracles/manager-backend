import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

const PIN_PATTERN = /^\d{6}$/;

interface ResetOperatorPinData {
  uid: string;
  pin: string;
}

export const resetOperatorPin = functions.onCall({
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
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te ndryshoje PIN-in e nje operatori.");
  }

  const data = request.data as ResetOperatorPinData;
  if (!data.uid) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: uid.");
  }
  if (!data.pin || !PIN_PATTERN.test(data.pin)) {
    throw new functions.HttpsError("invalid-argument", "PIN-i duhet te kete sakte 6 shifra.");
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
  if (snap.data()?.role !== "operator") {
    throw new functions.HttpsError("failed-precondition", "PIN-i mund te ndryshohet vetem per Operatoret.");
  }

  try {
    await admin.auth().updateUser(data.uid, { password: data.pin });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gabim i panjohur";
    throw new functions.HttpsError("internal", `Ndryshimi i PIN-it deshtoi: ${message}`);
  }

  return { ok: true };
});
