import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

interface ZoneTable {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  tables: ZoneTable[];
}

interface UpdateBusinessUnitData {
  businessUnitId: string;
  name: string;
  address?: string | null;
  code?: string | null;
  defaultCustomerCode?: string | null;
  defaultLocationCode?: string | null;
  visibleItemGroupCodes?: string[] | null;
  salesMode?: "simple" | "tables";
  zones?: Zone[];
}

function sanitizeZones(zones: Zone[] | undefined): Zone[] {
  if (!Array.isArray(zones)) return [];
  return zones
    .filter((z) => z && typeof z.id === "string" && typeof z.name === "string")
    .map((z) => ({
      id: z.id,
      name: z.name.trim(),
      tables: Array.isArray(z.tables)
        ? z.tables
            .filter((t) => t && typeof t.id === "string" && typeof t.name === "string")
            .map((t) => ({ id: t.id, name: t.name.trim() }))
        : [],
    }));
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
    visibleItemGroupCodes: data.visibleItemGroupCodes || null,
    salesMode: data.salesMode === "tables" ? "tables" : "simple",
    zones: sanitizeZones(data.zones),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
