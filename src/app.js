import express from "express";
import cors from "cors"
import cookieParser from "cookie-parser";
import { setUpKindeAuth } from "./auth/kindeAuthSetup.js";
import bodyParser from "body-parser";
const app = express();
setUpKindeAuth(app);

app.use(cors({
    origin: "*",
}))
app.use(bodyParser.json({ strict: false }))
app.use(express.json());
app.use(express.urlencoded({
    extended: true,
    limit: "16kb",
}));
app.use(express.static("public"));
app.use(cookieParser());

// routes imports
import testingRouter from "./routes/test.routes.mjs";
import userRouter from "./routes/user.routes.js"
import recommendationRouter from "./routes/recommendation.routes.js"
app.use("/api/v1/testing", testingRouter);
app.use("/api/v1/auth", userRouter);
app.use("/api/v1/users",recommendationRouter);

export { app };