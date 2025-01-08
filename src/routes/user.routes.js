import { Router } from "express";
import { protectRoute, getUser } from "@kinde-oss/kinde-node-express";
import { checkUser, registerUser } from "../controllers/user.controller.js";

const router = Router();
router.route("/register").post(protectRoute, getUser, registerUser);
router.route("/check-user").get(protectRoute,getUser,checkUser);

export default router;