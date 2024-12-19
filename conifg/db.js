// db.js
import neo4j from "neo4j-driver";
import dotenv from 'dotenv';
import mongoose from "mongoose";
dotenv.config();
console.log("Neo4j URI:", process.env.NEO4J_URI);
const DB_NAME="mandli2O"
const connectDb = async ()=>{
    try {
        const connectionInstance = await mongoose.connect(process.env.MONGO_URI, {
            dbName: DB_NAME, // Explicitly set the database name
        })
        console.log(`MongoDb Connected !!! at DB Host :: ${connectionInstance.connection.host}`)
        

    } catch (error) {
        console.log("MONGODB connection Error :: ",error)
        process.exit(1)
    }
}

connectDb()
const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

export default driver;

