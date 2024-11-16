// db.js
import neo4j from "neo4j-driver";
import dotenv from 'dotenv';
dotenv.config();
console.log("Neo4j URI:", process.env.NEO4J_URI);
const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

export default driver;
