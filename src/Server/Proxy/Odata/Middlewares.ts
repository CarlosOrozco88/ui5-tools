// import { RequestHandler } from 'express';
import Utils from '../../../Utils/ExtensionVscode';

// export function createAuthMiddleware(index?: number): RequestHandler {
//   return function (req, res, next): void {
//     const userPass = getODATAAuth(index);
//     if (userPass) {
//       const sAuth = Buffer.from(userPass).toString('base64');
//       req.headers.authorization = `Basic ${sAuth}`;
//     }
//     next();
//   };
// }

export function getODATAAuth(index?: number) {
  const oEnv = Utils.loadEnv();
  let auth = '';

  let userKey = 'UI5TOOLS_ODATA_USER';
  let passKey = 'UI5TOOLS_ODATA_PASSWORD';
  if (index) {
    userKey += `_${index + 1}`;
    passKey += `_${index + 1}`;
  }
  if (oEnv[userKey] && oEnv[passKey]) {
    auth = `${oEnv[userKey]}:${oEnv[passKey]}`;
  }

  return auth;
}
