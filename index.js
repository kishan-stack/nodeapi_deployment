// index.js

import express from "express";
import driver from "./conifg/db.js";
const app = express();
app.use(express.json());

app.post("/users", async (req, res) => {
    const { firstname, lastname, email, skills, college, department, academicYear, location, interests } = req.body;

    // Validate input
    if (!firstname || !lastname || !email || !skills || !Array.isArray(skills)) {
        return res.status(400).json({ error: "Invalid input" });
    }

    const session = driver.session();

    try {
        // Start a write transaction to ensure atomicity
        const userResult = await session.writeTransaction(async (tx) => {
            // Merge the User node by email to ensure it exists and only one node is created
            const user = await tx.run(
                `MERGE (u:User {email: $email})
                 ON CREATE SET u.firstname = $firstname, u.lastname = $lastname
                 RETURN u`,
                { firstname, lastname, email }
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

            // Handle college with STUDIED_IN relationship
            if (college) {
                await tx.run(
                    `MERGE (c:College {name: $college})
                     WITH c
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:STUDIED_IN]->(c)`,
                    { college, email }
                );
            }

            // Handle department with MAJORED_IN relationship
            if (department) {
                await tx.run(
                    `MERGE (d:Department {name: $department})
                     WITH d
                     MATCH (u:User {email: $email})
                     MERGE (u)-[:MAJORED_IN]->(d)`,
                    { department, email }
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
