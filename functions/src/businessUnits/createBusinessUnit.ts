import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface CreateBusinessUnitData {
  name: string;
  address?: string;
  code?: string;
  defaultCustomerCode?: string;
  defaultLocationCode?: string;
}

export const createBusinessUnit = functions.onCall({
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
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te krijoje Business Unit.");
  }

  const data = request.data as CreateBusinessUnitData;
  if (!data.name || !data.name.trim()) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: name.");
  }

  const buRef = admin
    .firestore()
    .collection("companies")
    .doc(companyId)
    .collection("businessUnits")
    .doc();

  await buRef.set({
    name: data.name.trim(),
    address: data.address?.trim() || null,
    code: data.code?.trim() || null,
    defaultCustomerCode: data.defaultCustomerCode || null,
    defaultLocationCode: data.defaultLocationCode || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { businessUnitId: buRef.id };
});