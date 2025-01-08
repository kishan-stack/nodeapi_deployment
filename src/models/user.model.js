import mongoose from "mongoose";

// Remove the tagSchema since it's no longer needed.
const sectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    tags: { type: [String], default: [] }, // Changed to an array of strings
    additionalInfo: { type: String, default: "" }, // Optional field for additional info
});

const userSchema = new mongoose.Schema(
    {
        kindeAuthId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        name: {
            type: String,
            required: true,
            lowercase:true,
        },
        email:{
            type:String,
            required:true,
        },
        projects: { type: [sectionSchema], default: [] }, // Array of project entries
        hackathons: { type: [sectionSchema], default: [] }, // Array of hackathon entries
        courses: { type: [sectionSchema], default: [] }, // Array of course entries
        certifications: { type: [sectionSchema], default: [] }, // Array of certification entries
        workshops: { type: [sectionSchema], default: [] }, // Array of workshop entries
    },
    {
        timestamps: true, // Automatically add createdAt and updatedAt timestamps
    }
);

// Create the User model
export const User = mongoose.model("User", userSchema);
