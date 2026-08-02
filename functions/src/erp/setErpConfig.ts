import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();

type ErpType = "financa5" | "alphaweb" | "nav" | "odoo";

// Shto ketu erpType-in e ri sapo te implementohet validimi i tij me poshte.
const SUPPORTED_ERP_TYPES: ErpType[] = ["financa5"];

interface SetErpConfigData {
  erpType: ErpType;
  config: Record<string, unknown>;
}

// Validon formen e config-ut per cdo erpType. Kur shtohet nje integrim i ri
// (AlphaWEB, NAV, Odoo), shtohet thjesht nje "case" i ri ketu - asgje tjeter
// ne funksionin kryesor nuk duhet te ndryshoje.
function validateConfig(erpType: ErpType, config: Record<string, unknown>): Record<string, unknown> {
  switch (erpType) {
    case "financa5": {
      const { server, database, user, password, encrypt, trustServerCertificate, port } = config;

      if (!server || typeof server !== "string") {
        throw new functions.HttpsError("invalid-argument", "Financa5: mungon 'server'.");
      }
      if (!database || typeof database !== "string") {
        throw new functions.HttpsError("invalid-argument", "Financa5: mungon 'database'.");
      }
      if (!user || typeof user !== "string") {
        throw new functions.HttpsError("invalid-argument", "Financa5: mungon 'user'.");
      }
      if (!password || typeof password !== "string") {
        throw new functions.HttpsError("invalid-argument", "Financa5: mungon 'password'.");
      }
      if (port !== undefined && typeof port !== "number") {
        throw new functions.HttpsError("invalid-argument", "Financa5: 'port' duhet te jete numer.");
      }

      return {
        server,
        database,
        user,
        password,
        encrypt: typeof encrypt === "boolean" ? encrypt : false,
        trustServerCertificate: typeof trustServerCertificate === "boolean" ? trustServerCertificate : true,
        ...(port !== undefined ? { port } : {}),
      };
    }

    case "alphaweb":
    case "nav":
    case "odoo":
      throw new functions.HttpsError(
        "unimplemented",
        `Integrimi "${erpType}" nuk eshte akoma i implementuar.`
      );

    default:
      throw new functions.HttpsError("invalid-argument", `erpType i panjohur: "${erpType}".`);
  }
}

export const setErpConfig = functions.onCall(async (request) => {
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
    throw new functions.HttpsError("permission-denied", "Vetem Admin mund te konfiguroje integrimin ERP.");
  }

  const data = request.data as SetErpConfigData;

  if (!data.erpType || !SUPPORTED_ERP_TYPES.includes(data.erpType)) {
    throw new functions.HttpsError(
      "invalid-argument",
      `erpType duhet te jete nje nga: ${SUPPORTED_ERP_TYPES.join(", ")}.`
    );
  }
  if (!data.config || typeof data.config !== "object") {
    throw new functions.HttpsError("invalid-argument", "Mungon 'config'.");
  }

  const validatedConfig = validateConfig(data.erpType, data.config);

  const db = admin.firestore();
  const companyRef = db.collection("companies").doc(companyId);
  const integrationRef = companyRef.collection("erpIntegrations").doc(data.erpType);

  await db.runTransaction(async (tx) => {
    tx.set(
      integrationRef,
      {
        erpType: data.erpType,
        config: validatedConfig,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(companyRef, { activeErpType: data.erpType }, { merge: true });
  });

  return { ok: true, erpType: data.erpType };
});