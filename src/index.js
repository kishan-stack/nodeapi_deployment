import dotenv from "dotenv";
import { connectNeo4j, connectMongoDb } from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: "./.env",
})

const startServer = async () => {
    try {
        await connectMongoDb();
        await connectNeo4j();
        app.listen(process.env.PORT || 8000, () => {
            console.log(`🎶 Server is running on port :: ${process.env.PORT || 8000}`);
        })

    } catch (error) {
        console.log("Error starting server", error);
    }
}

startServer();