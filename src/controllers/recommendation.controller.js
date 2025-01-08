import { getNeo4jSession } from "../db/index.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import qs from "qs";
import { User } from "../models/user.model.js";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const getUserProfile = asyncHandler(async (req, res) => {
    const { userid: kindeAuthId } = req.params;
    const session = await getNeo4jSession();
    try {
        const query = `MATCH (u:User {kindeAuthId: $kindeAuthId})-[m:MAJORED_IN]-(d:Department),
            (u)-[li:LOCATED_IN]-(l:Location),
            (u)-[Ii:INTERESTED_IN]-(i:Interest),
            (u)-[s:STUDIED_IN]-(c:College),
            (u)-[ha:HAS_ACADEMIC_YEAR]-(ay:AcademicYear)
      RETURN u, l.name AS location, c.name AS college, d.name AS department,
             ay.name AS academicYear, collect(i.name) AS interests, collect(s.name) AS skills;`;
        const result = await session.run(query, { kindeAuthId });

        const record = result.records[0];
        const user = record.get('u').properties;
        const profile = {
            name: user.name,
            email: user.email,
            location: record.get('location'),
            college: record.get('college'),
            department: record.get('department'),
            academicYear: record.get('academicYear'),
            interests: record.get('interests'),
            skills: record.get('skills'),
        };
        const mongoData = await User.findOne({ kindeAuthId: kindeAuthId });

        if (mongoData) {
            profile.projects = mongoData.projects;
            profile.hackathons = mongoData.hackathons;
            profile.workshops = mongoData.workshops;
            profile.courses = mongoData.courses;
            profile.certifications = mongoData.certifications;
        } else {
            profile.projects = [];
            profile.hackathons = [];
            profile.workshops = [];
            profile.courses = [];
            profile.certifications = [];
        }
        return res.status(200).json(
            new ApiResponse(200, profile, "User details fetched successfully")
        )
    } catch (error) {
        console.error("Error in try block", error);

    } finally {
        await session.close();
    }
    return null;
});
export const getAllUser = asyncHandler(async (req, res) => {
    const{id:kindeAuthId}=req.user;
    const session = await getNeo4jSession();
    try {
        const query = `MATCH (u:User {kindeAuthId: $kindeAuthId})-[m:MAJORED_IN]-(d:Department),
            (u)-[li:LOCATED_IN]-(l:Location),
            (u)-[Ii:INTERESTED_IN]-(i:Interest),
            (u)-[s:STUDIED_IN]-(c:College),
            (u)-[ha:HAS_ACADEMIC_YEAR]-(ay:AcademicYear)
      RETURN u, l.name AS location, c.name AS college, d.name AS department,
             ay.name AS academicYear, collect(i.name) AS interests, collect(s.name) AS skills;`;
        const result = await session.run(query, { kindeAuthId });

        const record = result.records[0];
        const user = record.get('u').properties;
        const profile = {
            name: user.name,
            email: user.email,
            location: record.get('location'),
            college: record.get('college'),
            department: record.get('department'),
            academicYear: record.get('academicYear'),
            interests: record.get('interests'),
            skills: record.get('skills'),
        };
        const mongoData = await User.findOne({ kindeAuthId: kindeAuthId });

        if (mongoData) {
            profile.projects = mongoData.projects;
            profile.hackathons = mongoData.hackathons;
            profile.workshops = mongoData.workshops;
            profile.courses = mongoData.courses;
            profile.certifications = mongoData.certifications;
        } else {
            profile.projects = [];
            profile.hackathons = [];
            profile.workshops = [];
            profile.courses = [];
            profile.certifications = [];
        }
        return res.status(200).json(
            new ApiResponse(200, profile, "User details fetched successfully")
        )
    } catch (error) {
        console.error("Error in try block", error);

    } finally {
        await session.close();
    }
    return null;
});

export const getTags = asyncHandler(async (req, res) => {
    const { query } = req.query;


    //   getAccessToken();

    async function fetchData() {
        try {
            const accessToken = await getAccessToken();

            const response = await axios.get('https://emsiservices.com/skills/versions/latest/skills', {
                headers: {
                    Authorization: `Bearer ${accessToken.access_token}`,

                },
                params: {
                    q: query,
                    limit: 15
                }

            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching data from Lightcast API:', error.response?.data);
        }
    }

    const tags = await fetchData();
    return res.json(tags);


});
async function getAccessToken() {
    const data = qs.stringify({
        grant_type: 'client_credentials',
        client_id: '0jdjfxl3jbfarxzs',
        client_secret: '6ANO69sY',
        scopes: 'emsi_open'
    });

    try {
        const response = await axios.post('https://auth.emsicloud.com/connect/token', data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching access token:', error);
    }
}


export const updateUserProfile = asyncHandler(async (req, res) => {
    const dataToBeUpdated = req.body;
    const { id: kindeAuthId } = req.user;
    // console.log('Received Data:', dataToBeUpdated);

    function calculateSkillScores(data) {
        // Weightage for each section
        const weightage = {
            projects: 0.4,
            hackathons: 0.3,
            courses: 0.15,
            certifications: 0.1,
            workshops: 0.05
        };

        // Initialize a map to store skill scores
        const skillScores = {};

        // Iterate over each section in the data
        for (const section in data) {
            const items = data[section];
            const sectionWeightage = weightage[section];

            // Skip empty sections
            if (items.length === 0) continue;

            // Count the frequency of each skill (tag) in the section
            items.forEach(item => {
                item.tags.forEach(tag => {
                    if (skillScores[tag]) {
                        skillScores[tag] += sectionWeightage;
                    } else {
                        skillScores[tag] = sectionWeightage;
                    }
                });
            });
        }

        return skillScores;
    }

    const skills = calculateSkillScores(dataToBeUpdated);
    // console.log(skills)

    const session = await getNeo4jSession();
    try {
        const skillArray = Object.entries(skills).map(([skillName, score]) => ({
            skillName: skillName,
            score: score
        }));
        await session.run(
            `UNWIND $skillArray AS skill
             MERGE (s:Skill {name: skill.skillName})
             MERGE (u:User {kindeAuthId: $kindeAuthId})
             MERGE (u)-[r:HAS_SKILL]->(s)
             ON CREATE SET r.score = skill.score
             ON MATCH SET r.score = r.score + skill.score`,
            {
                kindeAuthId,
                skillArray: skillArray
            }
        );

        const user = await User.findOneAndUpdate(
            { kindeAuthId: kindeAuthId },
            {
                $push: {
                    projects: { $each: dataToBeUpdated.projects || [] },
                    hackathons: { $each: dataToBeUpdated.hackathons || [] },
                    courses: { $each: dataToBeUpdated.courses || [] },
                    certifications: { $each: dataToBeUpdated.certifications || [] },
                    workshops: { $each: dataToBeUpdated.workshops || [] },
                },
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json(new ApiResponse(404, "User not found"));
        }

        // Return a success response
        return res.status(200).json(new ApiResponse(200, "User profile updated successfully"));

    } catch (error) {
        console.error(error);
        // Send error response in case of failure
        return res.status(500).json(new ApiResponse(500, "An error occurred while updating user profile"));
    }


});

export const getPotentialUsers = asyncHandler(async (req, res) => {
    const { id: kindeAuthId } = req.user;
    const { userDescriptionOfTeam } = req.body;
    // console.log(userDescriptionOfTeam);

    if (!userDescriptionOfTeam) {
        return res.status(400).json({ error: "Description of team is required." });
    }

    const genAI = new GoogleGenerativeAI("AIzaSyAL7Ph9XwDby9OYh3zb4s_ySxP2-LMgH74"); // Use environment variable
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const session = await getNeo4jSession();

    try {
        const tx = session.beginTransaction();

        const query = `MATCH (s:Skill) RETURN COLLECT(s.name) AS skillNames`;
        const dbResult = await tx.run(query);
        const skillNames = dbResult.records[0].get("skillNames");

        const prompt = `Analyze the user description and provided skill names. From the user description and the list of all skills present in the database, identify and filter out the skills that the user is looking for. Return the JSON array as plain text without any Markdown formatting or additional text.
        UserDescriptionInput: ${userDescriptionOfTeam}
        allPresentSkillsInDb: ${skillNames}`;

        const result = await model.generateContent(prompt);

        let userSkills;
        try {
            userSkills = JSON.parse(result.response.text());
        } catch (parseError) {
            console.error("JSON Parsing Error:", parseError.message);
            return res.status(400).json({ error: "Failed to parse user skills" });
        }

        const userSkillNames = userSkills.map((skill) => skill.toLowerCase());
        // console.log("User Skills Identified: ", userSkillNames);

        // Query to get users matching userSkillNames and calculate their total score
        const userQuery = `
              MATCH (u:User)-[r:HAS_SKILL]->(s:Skill)
            WHERE ANY(skill IN $userSkillNames WHERE TOLOWER(s.name) CONTAINS TOLOWER(skill))
            WITH u, 
                 COLLECT(s.name) AS matchedSkills, 
                 COUNT(s) AS numSkills, 
                 SUM(COALESCE(r.score, 0)) AS totalScore
            ORDER BY numSkills DESC, totalScore DESC
            RETURN u, matchedSkills, numSkills, totalScore
        
        `;

        // Running the Neo4j query with the identified skills
        const usersResult = await tx.run(userQuery, { userSkillNames });

        // Prepare response data (you can modify this to format the response as needed)
        const responseData = usersResult.records.map((record) => {
            return {
                user: record.get("u").properties,
                matchedSkills: record.get("matchedSkills"),
                totalScore: record.get("totalScore")
            };
        });

        await tx.commit();

        return res.json({
            message: "User skills and recommendations received successfully",
            data: responseData,
        });
    } catch (error) {
        console.error("Error:", error.message, error.stack);
        if (session) {
            await session.rollback();
        }
        return res.status(500).json({
            error: "Error processing user skills and recommendations",
            details: error.message,
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});






