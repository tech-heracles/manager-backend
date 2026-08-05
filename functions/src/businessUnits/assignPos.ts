import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface AssignPosData {
  businessUnitId: string;
  deviceId: string;
  name?: string;
}

export const assignPos = functions.onCall({
    region: "europe-west1",
  },async (request) => {
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
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te caktoje POS.");
  }

  const data = request.data as AssignPosData;
  if (!data.businessUnitId || !data.deviceId || !data.deviceId.trim()) {
    throw new functions.HttpsError(
      "invalid-argument",
      "Mungojne fusha te detyrueshme: businessUnitId, deviceId."
    );
  }

  const deviceId = data.deviceId.trim();
  const db = admin.firestore();

  const buRef = db
    .collection("companies")
    .doc(companyId)
    .collection("businessUnits")
    .doc(data.businessUnitId);

  const buSnap = await buRef.get();
  if (!buSnap.exists) {
    throw new functions.HttpsError("not-found", `Business Unit "${data.businessUnitId}" nuk ekziston.`);
  }

  // deviceId duhet unik globalisht (nje POS fizik s'mund te jete ne 2 vende
  // njekohesisht), keshtu qe kontrollojme permes nje collectionGroup query.
  const existing = await db
    .collectionGroup("pos")
    .where("deviceId", "==", deviceId)
    .limit(1)
    .get();

  let posRef: admin.firestore.DocumentReference;

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const existingData = existingDoc.data();

    if (existingData.companyId !== companyId) {
      throw new functions.HttpsError(
        "already-exists",
        `Ky POS (deviceId="${deviceId}") eshte tashme i regjistruar ne nje kompani tjeter.`
      );
    }

    if (existingDoc.ref.parent.parent?.id === data.businessUnitId) {
      // eshte tashme ne kete BU - thjesht update-o.
      posRef = existingDoc.ref;
    } else {
      // eshte ne nje BU tjeter te te njejtes kompani - zhvendose.
      await existingDoc.ref.delete();
      posRef = buRef.collection("pos").doc();
    }
  } else {
    posRef = buRef.collection("pos").doc();
  }

  await posRef.set(
    {
      companyId,
      deviceId,
      name: data.name?.trim() || deviceId,
      businessUnitId: data.businessUnitId,
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { posId: posRef.id, businessUnitId: data.businessUnitId };
});