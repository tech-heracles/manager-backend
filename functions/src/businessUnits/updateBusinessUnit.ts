import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface UpdateBusinessUnitData {
  businessUnitId: string;
  name: string;
  address?: string | null;
  code?: string | null;
  defaultCustomerCode?: string | null;
  defaultLocationCode?: string | null;
}

export const updateBusinessUnit = functions.onCall({
  region: "europe-west1",
}, async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new functions.HttpsError("unauthenticated", "Duhet te jesh i loguar.");
  }

  const companyId = caller.token.companyId;
  const role = caller.token.role;
  const callerBusinessUnitIds = (caller.token.businessUnitIds as string[] | undefined) || [];

  if (!companyId) {
    throw new functions.HttpsError("failed-precondition", "Perdoruesi nuk i perket asnje kompanie.");
  }

  const data = request.data as UpdateBusinessUnitData;
  if (!data.businessUnitId) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: businessUnitId.");
  }

  // Admin mund te ndryshoje cdo Business Unit; Supervisor vetem ato qe i eshte
  // caktuar (per te plotesuar vete code/default-et e njesise se tij).
  const isAssignedSupervisor =
    role === "supervisor" && callerBusinessUnitIds.includes(data.businessUnitId);
  if (role !== "admin" && !isAssignedSupervisor) {
    throw new functions.HttpsError("permission-denied", "S'ke leje te ndryshosh kete Business Unit.");
  }

  if (!data.name || !data.name.trim()) {
    throw new functions.HttpsError("invalid-argument", "Mungon fusha e detyrueshme: name.");
  }

  const buRef = admin
    .firestore()
    .collection("companies")
    .doc(companyId)
    .collection("businessUnits")
    .doc(data.businessUnitId);

  const snap = await buRef.get();
  if (!snap.exists) {
    throw new functions.HttpsError("not-found", "Business Unit nuk u gjet.");
  }

  await buRef.update({
    name: data.name.trim(),
    address: data.address?.trim() || null,
    code: data.code?.trim() || null,
    defaultCustomerCode: data.defaultCustomerCode || null,
    defaultLocationCode: data.defaultLocationCode || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
