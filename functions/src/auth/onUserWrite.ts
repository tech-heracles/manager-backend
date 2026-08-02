import * as functions from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();

export const onUserWrite = functions.onDocumentWritten(
  'companies/{companyId}/users/{uid}',
  async (event) => {
    const data = event.data?.after.data();
    const { companyId, uid } = event.params;

    if (!data) {
      // user doc deleted -> clear claims
      await admin.auth().setCustomUserClaims(uid, null);
      return;
    }

    await admin.auth().setCustomUserClaims(uid, {
      companyId,
      role: data.role,
      businessUnitIds: data.businessUnitIds || [],
    });
  }
);