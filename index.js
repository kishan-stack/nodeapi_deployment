// index.js
// imports
import { v4 as uuid } from "uuid"
import express from "express";
import driver from "./conifg/db.js";
import jwt from "jsonwebtoken";
import cors from "cors"
import { User } from "./models/users.model.js";
import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";
import neo4j from "neo4j-driver";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config()
// 


const app = express();
app.use(express.json());
app.use(cors({
  origin: "*",  // Change this to the exact origin you want to allow
}));

const STACKOVERFLOW_API_URL = "https://api.stackexchange.com/2.3/tags";
const API_KEY = process.env.STACKOVERFLOW_API_KEY; // Store the API key in an environment variable
const genAI = new GoogleGenerativeAI("AIzaSyCQ9d9A3LTAkciDGk5r6GnumxV222OP_9o");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


app.post("/register", async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    skills = [],
    collegeName,
    departmentName,
    academicYear,
    location,
    interests = []
  } = req.body;

  // Validate input
  if (!firstName || !lastName || !email || !Array.isArray(skills)) {
    return res.status(400).json({ error: "Invalid input" });
  }

  // Normalize inputs to lowercase
  const normalizedFirstName = firstName.toLowerCase();
  const normalizedLastName = lastName.toLowerCase();
  const normalizedEmail = email.toLowerCase();
  const normalizedSkills = skills.map(skill => skill.toLowerCase());
  const normalizedCollegeName = collegeName ? collegeName.toLowerCase() : null;
  const normalizedDepartmentName = departmentName ? departmentName.toLowerCase() : null;
  const normalizedAcademicYear = academicYear ? academicYear.toLowerCase() : null;
  const normalizedLocation = location ? location.toLowerCase() : null;
  const normalizedInterests = interests.map(interest => interest.toLowerCase());

  const session = driver.session();

  try {
    const userResult = await session.writeTransaction(async (tx) => {
      // Merge the User node by email to ensure it exists and only one node is created
      const user = await tx.run(
        `MERGE (u:User {email: $normalizedEmail})
                 ON CREATE SET u.firstName = $normalizedFirstName, u.lastName = $normalizedLastName
                 RETURN u`,
        { normalizedFirstName, normalizedLastName, normalizedEmail }
      );

      // Get the user node that was created or matched
      const createdUser = user.records[0].get("u");

      // Handle skills
      for (const skillName of normalizedSkills) {
        await tx.run(
          `MERGE (s:Skill {name: $skillName})
                     WITH s
                     MATCH (u:User {email: $normalizedEmail})
                     MERGE (u)-[:HAS_SKILL]->(s)`,
          { skillName, normalizedEmail }
        );
      }

      // Handle collegeName with STUDIED_IN relationship
      if (normalizedCollegeName) {
        await tx.run(
          `MERGE (c:College {name: $normalizedCollegeName})
                     WITH c
                     MATCH (u:User {email: $normalizedEmail})
                     MERGE (u)-[:STUDIED_IN]->(c)`,
          { normalizedCollegeName, normalizedEmail }
        );
      }

      // Handle departmentName with MAJORED_IN relationship
      if (normalizedDepartmentName) {
        await tx.run(
          `MERGE (d:Department {name: $normalizedDepartmentName})
                     WITH d
                     MATCH (u:User {email: $normalizedEmail})
                     MERGE (u)-[:MAJORED_IN]->(d)`,
          { normalizedDepartmentName, normalizedEmail }
        );
      }

      // Handle academic year with ACADEMIC_YEAR relationship
      if (normalizedAcademicYear) {
        await tx.run(
          `MERGE (a:AcademicYear {year: $normalizedAcademicYear})
                     WITH a
                     MATCH (u:User {email: $normalizedEmail})
                     MERGE (u)-[:ACADEMIC_YEAR]->(a)`,
          { normalizedAcademicYear, normalizedEmail }
        );
      }

      // Handle location with LOCATED_IN relationship
      if (normalizedLocation) {
        await tx.run(
          `MERGE (l:Location {name: $normalizedLocation})
                     WITH l
                     MATCH (u:User {email: $normalizedEmail})
                     MERGE (u)-[:LOCATED_IN]->(l)`,
          { normalizedLocation, normalizedEmail }
        );
      }

      // Handle interests with INTERESTED_IN relationship
      for (const interestName of normalizedInterests) {
        await tx.run(
          `MERGE (i:Interest {name: $interestName})
                     WITH i
                     MATCH (u:User {email: $normalizedEmail})
                     MERGE (u)-[:INTERESTED_IN]->(i)`,
          { interestName, normalizedEmail }
        );
      }

      return createdUser.properties;
    });

    res.status(201).json({
      message: "User created with profile details",
      user: userResult,
      skills: normalizedSkills,
      interests: normalizedInterests
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
  // console.log(token);
  try {
    // Decode the token to extract the email
    const { email } = token

    if (!email) {
      return res.status(400).json({ error: "Invalid token" });
    }

    // Query Neo4j for the user
    const session = driver.session();
    const query = `MATCH (u:User {email: $email}) RETURN u`;
    const result = await session.run(query, { email: email });
    session.close();

    if (result.records.length > 0) {
      // User exists
      return res.status(200).json({ userExists: true });
    }

    // User does not exist
    return res.status(200).json({ userExists: false });
  } catch (error) {
    console.error("Error checking user:", error);
    res.status(500).json({ error: "Internal server error" });
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
  const { email } = req.query;
  const session = driver.session();
  // console.log(email);

  try {
    // Query to get all users and their skills based on the HAS_SKILL relationship
    const query = `
            MATCH (u:User)-[:HAS_SKILL]->(s:Skill)
            WHERE u.email <> $email
            RETURN u.firstName AS firstName, u.lastName AS lastName, u.email AS email, collect(s.name) AS skills
        `;

    const result = await session.run(query, { email });

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


app.get("/", async (req, res) => {
  res.send("hello from deployed app")
})

// app.post("/updateUserAcademicInfo", async (req, res) => {

//   let session; // Declare session variable for Neo4j
//   let tx; // Declare transaction variable
//   try {
//     const {
//       email,
//       projects = [],
//       hackathons = [],
//       courses = [],
//       certifications = [],
//       workshops = [],
//     } = req.body;

//     // Validate email
//     if (!email) {
//       return res.status(400).json({ error: "Email is required." });
//     }

//     // Validate input format
//     const sections = { projects, hackathons, courses, certifications, workshops };
//     for (const [sectionName, sectionData] of Object.entries(sections)) {
//       if (!Array.isArray(sectionData)) {
//         return res.status(400).json({ error: `${sectionName} must be an array.` });
//       }
//     }

//     // Check if the user exists in MongoDB
//     let user = await User.findOne({ email });
//     if (!user) {
//       // Create new user
//       user = new User({ email, projects, hackathons, courses, certifications, workshops });
//     } else {
//       // Update existing user
//       user.projects = projects;
//       user.hackathons = hackathons;
//       user.courses = courses;
//       user.certifications = certifications;
//       user.workshops = workshops;
//     }
//     await user.save();

//     // Calculate relevance of user to skills
//     const weights = {
//       projects: 0.4,
//       hackathons: 0.3,
//       courses: 0.15,
//       certifications: 0.1,
//       workshops: 0.05,
//     };

//     const skillScores = {};

//     // Aggregate skills and calculate relevance scores
//     for (const [sectionName, sectionData] of Object.entries(sections)) {
//       const weight = weights[sectionName] || 0; // Use weight for the current section
//       sectionData.forEach((item) => {
//         const tags = item.tags || []; // Ensure tags is an array
//         tags.forEach((tag) => {
//           const skill = tag.toLowerCase(); // Normalize to lowercase
//           if (skill) {
//             skillScores[skill] = (skillScores[skill] || 0) + weight;
//           }
//         });
//       });
//     }

//     // Update skills in Neo4j within a single transaction
//     session = driver.session(); // Initialize Neo4j session
//     tx = session.beginTransaction(); // Start a transaction

//     for (const [skill, score] of Object.entries(skillScores)) {
//       const query = `
//                 MERGE (u:User {email: $email})
//                 MERGE (s:Skill {name: $skill})
//                 MERGE (u)-[r:HAS_SKILL]->(s)
//                 SET r.score = $score
//             `;
//       await tx.run(query, { email, skill, score });
//     }

//     await tx.commit(); // Commit transaction
//     console.log("Skill Scores:", JSON.stringify(skillScores, null, 2));

//     res.status(200).json({ message: "Profile and skill relevance updated successfully.", skillScores });
//   } catch (error) {
//     console.error("Error updating/creating user profile:", error);
//     if (tx) await tx.rollback(); // Rollback transaction on error
//     res.status(500).json({ error: "An error occurred while updating/creating the user profile." });
//   } finally {
//     if (session) {
//       await session.close(); // Close Neo4j session
//     }
//   }
// });




app.get("/api/getTags", async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const response = await axios.get(STACKOVERFLOW_API_URL, {
      params: {
        order: "desc",
        sort: "popular",
        inname: query,
        site: "stackoverflow",
        key: API_KEY, // Include the API key securely
      },
    });

    res.json(response.data); // Forward the response to the frontend
  } catch (error) {
    console.error("Error fetching tags:", error.message);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});
app.post("/updateUserProfile", async (req, res) => {
  let session; // Neo4j session
  let tx; // Neo4j transaction

  try {
    const { email, projects, hackathons, courses, certifications, workshops } = req.body;

    // Validate email and input data
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const sections = { projects, hackathons, courses, certifications, workshops };
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      if (!Array.isArray(sectionData)) {
        return res.status(400).json({ error: `${sectionName} must be an array.` });
      }
    }

    // Save user data in MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, projects, hackathons, courses, certifications, workshops });
    } else {
      user.projects = projects;
      user.hackathons = hackathons;
      user.courses = courses;
      user.certifications = certifications;
      user.workshops = workshops;
    }
    await user.save();

    // Prepare data for Gemini
    const userInput = { email, projects, hackathons, courses, certifications, workshops };
    const prompt = `
     Analyze the input JSON object below and extract relevant skills across projects, hackathons, courses, certifications, and workshops. Assign weightage to each skill based on relevance as follows: projects: 0.4, hackathons: 0.3, courses: 0.15, certifications: 0.1, workshops: 0.05. 

Calculate a score for each skill and return the result as a plain JSON array with the "name" and "score" fields. Ensure the scores are fully calculated numerical values, not formula-like expressions.And keep the score ranging from 0 to 1, o being lowest and 1 being highest

Return the JSON array as plain text without any Markdown formatting or additional text.

Input:
${JSON.stringify(userInput, null, 2)}

    `;

    // Call Gemini for skill extraction
    const result = await model.generateContent(prompt);
    const skillData = JSON.parse(result.response.text());

    // Update skills in Neo4j
    session = driver.session(); // Start Neo4j session
    tx = session.beginTransaction(); // Start transaction

    for (const { name: skill, score } of skillData) {
      const query = `
        MERGE (u:User {email: $email})
        MERGE (s:Skill {name: $skill})
        MERGE (u)-[r:HAS_SKILL]->(s)
        SET r.score = $score
      `;
      await tx.run(query, { email, skill, score });
    }

    await tx.commit(); // Commit the transaction

    // Respond to user
    res.status(200).json({
      message: "Profile and skills updated successfully.",
      skillData,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    if (tx) await tx.rollback(); // Rollback on error
    res.status(500).json({
      error: "An error occurred while updating the user profile.",
      details: error.message,
    });
  } finally {
    if (session) {
      await session.close(); // Close Neo4j session
    }
  }
});
app.post("/getPotentialUsers", async (req, res) => {
  const { userDescriptionOfTeam } = req.body;


  let session;


  if (!userDescriptionOfTeam) {
    return res.status(400).json({ error: "description of team is required." });

  }

  try {
    const session = driver.session()
    const tx = session.beginTransaction()
    const query = ` MATCH (s:Skill) RETURN COLLECT(s.name) as skillNames`;
    const dbResult = await tx.run(query);
    const skillNames = dbResult.records[0].get('skillNames')
    const prompt = `Analyze the user description and provided skill names. From the user description and the list of all skills present in the database, identify and filter out the skills that the user is looking for. Return the JSON array as plain text without any Markdown formatting or additional text.

UserDescriptionInput: ${userDescriptionOfTeam}
allPresentSkillsInDb: ${skillNames}`;

    // const prompt=`Analyse this user description of what things are need in team members, this is in free language from this make a json array of skills that are required by the user and give them in text format, just give this output no extra explanaitons etc, Return the JSON array as plain text without any Markdown formatting or additional text.
    // Input : ${userDescriptionOfTeam}`;
    // console.log("skillnames :: ",skillNames);
    const result = await model.generateContent(prompt)
    const userSkills = JSON.parse(result.response.text());
    // console.log("userSkills ::",userSkills);
    const userSkillNames = userSkills.map((skill) => skill.toLowerCase());
    // console.log( Array.isArray(userSkillNames));

    const skillQuery = `WITH $skills AS skills
    MATCH (u:User)-[r:HAS_SKILL]->(n:Skill)
    WHERE ANY(skill IN skills WHERE toLower(n.name) CONTAINS toLower(skill))
WITH u, SUM(r.score) AS totalScore, COUNT(n) AS matchingSkills,COLLECT(n.name) AS matchedSkills,COUNT($skills) AS totalSkills
WITH u, totalScore, matchingSkills,matchedSkills ,totalScore/totalSkills AS normalizedScore
ORDER BY matchingSkills DESC, normalizedScore DESC
RETURN u, matchingSkills, normalizedScore,matchedSkills;`;
    const userList  = await tx.run(skillQuery,{skills:userSkillNames});
    // console.log(userList.records);
    const responseData = userList.records.map(record => ({
      user:record.get('u').properties,
      matchingSkills:neo4j.integer.toNumber(record.get('matchingSkills')),
      totalScore:neo4j.integer.toNumber(record.get('normalizedScore')),
      matchedSkills:record.get('matchedSkills'),
    }))

    await tx.commit()
    session.close()
    return res.json({
      message:"User skills and recommendations recieved successfully",
      data:responseData
    })

    // console.log(skillNames);
  } catch (error) {

    console.error(error)
    if (session) {
      await session.close()
    }

    return res.status(400).json({
      error:"error doing allthe skill stuff in extractions and..."
    })
  }





})


// API endpoint to receive user input and return extracted skills
// app.get("/extract-skills", async (req, res) => {



//   // Ensure input is provided
//   if (!userInput) {
//     return res.status(400).json({ error: "Input data is required" });
//   }


//   // Prompt for Gemini model
//   try {
//     const prompt = `
//            Analyze the input JSON object below and extract relevant skills across projects, hackathons, courses, certifications, and workshops. Assign weightage to each skill based on relevance as follows: projects: 0.4, hackathons: 0.3, courses: 0.15, certifications: 0.1, workshops: 0.05. 

// Calculate a score for each skill and return the result as a plain JSON array with the "name" and "score" fields. Ensure the scores are fully calculated numerical values, not formula-like expressions. 

// Return the JSON array as plain text without any Markdown formatting or additional text.

// Input:
// ${JSON.stringify(userInput, null, 2)}

//          `;

//     // Call 

//     const result = await model.generateContent(prompt);
//     console.log(result.response.text());
//     res.json(JSON.parse(result.response.text()));

//   } catch (error) {
//     console.error("Error extracting skills:", error);
//     res.status(500).json({
//       error: "Failed to extract skills",
//       details: error.message,
//     });
//   }
// });







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
