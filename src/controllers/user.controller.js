import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getNeo4jSession } from "../db/index.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import axios from "axios";
import { updatePropertiesOfUser } from "../utils/updatePropertiesOfUser.js";
export const checkUser = asyncHandler(async (req, res) => {
    const { id: kindeAuthId } = req.user;
    if (!kindeAuthId) {
        throw new ApiError(400, "KindeAuth missing");
    }

    try {
        const session = await getNeo4jSession();
        const query = `MATCH (u:User {kindeAuthId: $kindeAuthId}) RETURN u`;
        const result = await session.run(query, { kindeAuthId });
        await session.close();

        if (result.records.length > 0) {
            return res.redirect("/dashboard");
        } else {
            return res.redirect("/save-info");
        }

    } catch (error) {
        console.error("Error fetching user from db", error);
        throw new ApiError(500, "Internal Server Error");
    } finally {
        await session.close()
    }

});

export const registerUser = asyncHandler(async (req, res) => {
    const { name, email, id: kindeAuthId } = req.user;
    // console.log(req.user);
    // console.log(req.body);

    const { interests = [], collegeName, location, departmentName, academicYear } = req.body;

    if (!kindeAuthId || !name || !email) {
        throw new ApiError(400, "Request is missing required kindeAuth ");
    }


    if (!collegeName || !location || !departmentName || !academicYear || !Array.isArray(interests)) {
        throw new ApiError(400, "Invalid Input schema")
    }

    const normalize = (value) => value.toLowerCase();


    const userRecievedFromReq = {
        kindeAuthId,
        name: normalize(name),
        email: normalize(email),
        collegeName: normalize(collegeName),
        location: normalize(location),
        departmentName: normalize(departmentName),
        academicYear: normalize(academicYear),
        interests: interests.map(normalize),
    }
    const session = await getNeo4jSession();
    try {

        const userExists = await session.run(`
            MATCH (u:User {kindeAuthId: $kindeAuthId}) RETURN u    
        `, { kindeAuthId: userRecievedFromReq.kindeAuthId });

        if (userExists.records.length > 0) {
            return res.status(409).json(
                new ApiResponse(409, "User already exists !, try some different email address !")
            )
        }
        const userResult = await session.executeWrite(async (tx) => {
            const query = `
                MERGE (u:User {kindeAuthId : $kindeAuthId})
                ON CREATE SET u.name = $name,
                            u.email = $email
                WITH u
                UNWIND $interests as interestName
                MERGE(i:Interest {name :interestName})
                MERGE (u)-[:INTERESTED_IN]->(i)
                WITH u
                MERGE (c:College {name: $collegeName})
                MERGE (u)-[:STUDIED_IN]->(c)
                MERGE (d:Department {name:$departmentName })
                MERGE (u)-[:MAJORED_IN]-(d)
                MERGE (a:AcademicYear {name: $academicYear})
                MERGE (u)-[:HAS_ACADEMIC_YEAR]-(a)
                MERGE (l:Location {name: $location})
                MERGE (u)-[:LOCATED_IN]-(l)
                RETURN u
                `;
            const parameters = {
                kindeAuthId: userRecievedFromReq.kindeAuthId,
                name: userRecievedFromReq.name,
                email: userRecievedFromReq.email,
                interests: userRecievedFromReq.interests,
                collegeName: userRecievedFromReq.collegeName,
                departmentName: userRecievedFromReq.departmentName,
                academicYear: userRecievedFromReq.academicYear,
                location: userRecievedFromReq.location
            };
            const result = await tx.run(query, parameters);
            return result.records[0].get("u").properties;
        });

        const data = await updatePropertiesOfUser("PUT", userRecievedFromReq.kindeAuthId, "profile_complete", "true");
        // console.log("data after the update properties :: ", data);
 
        const userForMongoDb = {
            kindeAuthId:kindeAuthId,
            name: name,
            email: email,
            projects:[],
            hackathons:[],
            courses:[],
            certifications:[],
            workshops:[],
        }
        const user = new User(userForMongoDb);
        await user.save();
        return res.status(201).json(
            new ApiResponse(200, {
                user: userResult,
                interests: userRecievedFromReq.interests
            }, "User registeration successfull!😉")
        )


    } catch (error) {
        console.error("Error creating or registering user", error);
        throw new ApiError(500, "Something went wrong while registering user", error)
    } finally {
        await session.close()
    }

});
