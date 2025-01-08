// db.js
import mongoose from "mongoose";
import neo4j from "neo4j-driver";
import { DB_NAME } from "../constants.js";
import dotenv from "dotenv"
dotenv.config()
// console.log("Neo4j URI:", process.env.NEO4J_URI);

export const connectMongoDb = async () => {
    try {
        const connectionInstance = await mongoose.connect(
            process.env.MONGO_URI,
            {
                dbName: DB_NAME, // Explicitly set the database name
            }
        );
        console.log(
            `MongoDb Connected !!! at DB Host :: ${connectionInstance.connection.host}`
        );
    } catch (error) {
        console.log("MONGODB connection Error :: ", error);
        process.exit(1);
    }
};

let neo4jDriver;

export const connectNeo4j = async () => {

    neo4jDriver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
    );

    try {
        // testing the connectivity;
        await neo4jDriver.verifyConnectivity()
        console.log("Neo4j connected successfully!!");
        // getting the server connectionHost serverInfo;
        const serverInfo = await neo4jDriver.getServerInfo();
        console.log(`Connected to Neo4j at Host:  ${serverInfo.address}`);
    } catch (error) {
        console.log("Neo4j connection error :: ", error);
        process.exit(1)

    }
}

export const getNeo4jSession = async () => {
    if (!neo4jDriver) {
        throw new Error("Neo4j driver not initialized");
    }
    return neo4jDriver.session();
}
