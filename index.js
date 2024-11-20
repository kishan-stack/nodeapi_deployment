// index.js
import { v4 as uuid} from "uuid"
import express from "express";
import driver from "./conifg/db.js";
import jwt from "jsonwebtoken";
import cors from "cors"
const app = express();
app.use(express.json());
app.use(cors({
    origin: "*",  // Change this to the exact origin you want to allow
      }));

  app.post("/register", async (req, res) => {
    const { firstName, lastName, email, skills, collegeName, departmentName, academicYear, location, interests } = req.body;

    // Validate input
    if (!firstName || !lastName || !email || !skills || !Array.isArray(skills)) {
        return res.status(400).json({ error: "Invalid input" });
    }

    const session = driver.session();

    try {
        // Generate a unique 'sub' for the user (you can also use something from the auth service if available)
         // Generate unique sub for the user

        // Start a write transaction to ensure atomicity
        const userResult = await session.writeTransaction(async (tx) => {
            // Merge the User node by email to ensure it exists and only one node is created
            const user = await tx.run(
                `MERGE (u:User {email: $email})
                 ON CREATE SET u.firstName = $firstName, u.lastName = $lastName
                 RETURN u`,
                { firstName, lastName, email }
            );

            // Get the user node that was created or matched
            const createdUser = user.records[0].get("u");

            // Handle skills
            for (const skillName of skills) {
                await tx.run(
                    `MERGE (s:Skill {name: $skillName})
                     WITH s
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:HAS_SKILL]->(s)`,
                    { skillName, email }
                );
            }

            // Handle collegeName with STUDIED_IN relationship
            if (collegeName) {
                await tx.run(
                    `MERGE (c:College {name: $collegeName})
                     WITH c
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:STUDIED_IN]->(c)`,
                    { collegeName, email }
                );
            }

            // Handle departmentName with MAJORED_IN relationship
            if (departmentName) {
                await tx.run(
                    `MERGE (d:Department {name: $departmentName})
                     WITH d
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:MAJORED_IN]->(d)`,
                    { departmentName, email }
                );
            }

            // Handle academic year with ACADEMIC_YEAR relationship
            if (academicYear) {
                await tx.run(
                    `MERGE (a:AcademicYear {year: $academicYear})
                     WITH a
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:ACADEMIC_YEAR]->(a)`,
                    { academicYear, email }
                );
            }

            // Handle location with LOCATED_IN relationship
            if (location) {
                await tx.run(
                    `MERGE (l:Location {name: $location})
                     WITH l
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:LOCATED_IN]->(l)`,
                    { location, email }
                );
            }

            // Handle interests with INTERESTED_IN relationship
            for (const interestName of interests || []) {
                await tx.run(
                    `MERGE (i:Interest {name: $interestName})
                     WITH i
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:INTERESTED_IN]->(i)`,
                    { interestName, email }
                );
            }

            return createdUser.properties;
        });

        res.status(201).json({
            message: "User created with profile details",
            user: userResult,
            skills,
            interests
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error creating user" });
    } finally {
        await session.close();
    }
});

app.post("/auth/check-user", async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: "Token is required" });
    }

    try {
        // Decode the token
        const decodedToken = jwt.decode(token);
        if (!decodedToken || !decodedToken.sub) {
            return res.status(400).json({ error: "Invalid token" });
        }
        const userSub = decodedToken.sub;
        console.log("User Sub from Token:", userSub);

        // Create Neo4j session
        const session = driver.session();

        // Run query to check if the user exists
        const query = `MATCH (u:User {sub: $sub}) RETURN u`;
        const result = await session.run(query, { sub: userSub });

        console.log("Query Result:", result.records);

        // Close session
        await session.close();

        // Check if user exists
        if (result.records.length > 0) {
            return res.status(200).json({ userExists: true });
        }

        return res.status(200).json({ userExists: false });
    } catch (error) {
        console.error("Error checking user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.delete("/deleteAllUsers", async (req, res) => {
    const session = driver.session();
    try {
        await session.run(`MATCH (n) DETACH DELETE n`);
        console.log("All nodes and relationships have been deleted.");
        return res.status(200).json({ message: "All users deleted" });
    } catch (error) {
        console.error("Error deleting nodes:", error);
        res.status(500).json({ error: "Error deleting all users" });
    } finally {
        await session.close();
    }
});

app.get("/get-allusers", async (req, res) => {
    const session = driver.session();

    try {
        // Query to get all users and their skills based on the HAS_SKILL relationship
        const query = `
            MATCH (u:User)-[:HAS_SKILL]->(s:Skill)
            RETURN u.firstName AS firstName, u.lastName AS lastName, u.email AS email, collect(s.name) AS skills
        `;

        const result = await session.run(query);

        // Extract the records
        const usersWithSkills = result.records.map(record => ({
            firstName: record.get("firstName"),
            lastName: record.get("lastName"),
            email: record.get("email"),
            skills: record.get("skills")
        }));

        await session.close();

        // Return the users with their skills
        res.status(200).json(usersWithSkills);
    } catch (error) {
        console.error("Error fetching users and skills:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.get("/",async(req,res)=>{
    res.send("hello from deployed app")
})

app.get("/recommendations", async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: "Email is required to get recommendations" });
    }

    const session = driver.session();

    try {
        const result = await session.run(
            `
            MATCH (currentUser:User {email: $email})-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(otherUser:User)
            WHERE currentUser <> otherUser
            RETURN otherUser, collect(s.name) AS sharedSkills
            ORDER BY size(sharedSkills) DESC
            `,
            { email }
        );

        const recommendations = result.records.map(record => ({
            user: record.get("otherUser").properties,
            sharedSkills: record.get("sharedSkills"),
        }));

        res.status(200).json(recommendations);
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        res.status(500).json({ error: "Error fetching recommendations" });
    } finally {
        await session.close();
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
