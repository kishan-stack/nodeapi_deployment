import {
    setupKinde,
    GrantType,
} from "@kinde-oss/kinde-node-express";
import dotenv from "dotenv";
dotenv.config()
const config = {
    clientId: process.env.KINDE_CLIENT_ID,
    issuerBaseUrl: process.env.KINDE_ISSUER_BASE_URL,
    siteUrl: process.env.KINDE_SITE_URL,
    secret: process.env.KINDE_SECRET,
    redirectUrl: process.env.KINDE_REDIRECT_URL,
    scope: "openid profile email",
    grantType: GrantType.AUTHORIZATION_CODE, //or CLIENT_CREDENTIALS or PKCE
    unAuthorisedUrl: process.env.KINDE_UNAUTHORISED_URL,
    postLogoutRedirectUrl: process.env.KINDE_POST_LOGOUT_REDIRECT_URL,
};
// console.log(GrantType.AUTHORIZATION_CODE);
export const setUpKindeAuth = (app) => {
    setupKinde(config, app);
}

export { config };
