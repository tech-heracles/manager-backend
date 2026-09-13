// functions/src/erp/testErpConnection.ts
import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as sql from "mssql";

if (admin.apps.length === 0) admin.initializeApp();

type ErpType = "financa5" | "alphaweb" | "nav" | "odoo";

interface TestErpConnectionData {
  erpType: ErpType;
  config: {
    server: string;
    database: string;
    user: string;
    password: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    port?: number;
  };
}

export const testErpConnection = functions.onCall(
  { timeoutSeconds: 20, memory: "256MiB" },
  async (request) => {
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
      throw new functions.HttpsError("permission-denied", "Vetem Admin mund te testoje lidhjen ERP.");
    }

    const data = request.data as TestErpConnectionData;

    if (data.erpType !== "financa5") {
      throw new functions.HttpsError("unimplemented", `Test lidhje per "${data.erpType}" s'eshte akoma i mbeshtetur.`);
    }

    const { server, database, user, password, encrypt, trustServerCertificate, port } = data.config || {};

    if (!server || !database || !user || !password) {
      throw new functions.HttpsError("invalid-argument", "Mungojne fusha te detyrueshme per test lidhjeje.");
    }

    let serverHost = server;
    let instanceName: string | undefined;

    if (server.includes("\\")) {
      const parts = server.split("\\");
      serverHost = parts[0] === "" || parts[0] === "." ? "localhost" : parts[0];
      instanceName = parts[1];
    }

    const poolConfig: sql.config = {
      server: serverHost,
      database,
      user,
      password,
      options: {
        encrypt: encrypt ?? false,
        trustServerCertificate: trustServerCertificate ?? true,
        ...(instanceName ? { instanceName } : {}),
      },
      connectionTimeout: 8000,
      requestTimeout: 8000,
      pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
    };

    if (!instanceName && port) {
      poolConfig.port = port;
    }

    let pool: sql.ConnectionPool | undefined;
    try {
      pool = new sql.ConnectionPool(poolConfig);
      await pool.connect();
      await pool.request().query("SELECT 1 AS ok");
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gabim i panjohur";
      throw new functions.HttpsError("unavailable", `Lidhja deshtoi: ${message}`);
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch {
          // ignore close errors
        }
      }
    }
  }
);