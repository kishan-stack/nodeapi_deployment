const {jwtVerify} = require("@kinde-oss/kinde-node-express");

const verifier = jwtVerify(process.env.KINDE_ISSUER_BASE_URL,{
    
});

module.exports = verifier;