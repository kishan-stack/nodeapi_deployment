import { Router } from "express";
import { kindeSetupCheck } from "../controllers/test.controller.js";
import { protectRoute, getUser } from "@kinde-oss/kinde-node-express";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const verifier = require("../middlewares/jwtVerifier.middleware.cjs")
const router = Router();
router.route("/kinde-setup-check").post(kindeSetupCheck);

export default router;