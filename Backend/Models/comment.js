import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    model: {
        type: String,
        default: "gpt-4o-mini"
    },
    inputTokens: {
        type: Number,
        default: 0,
        min: 0
    },
    outputTokens: {
        type: Number,
        default: 0,
        min: 0
    },
    totalTokens: {
        type: Number,
        default: 0,
        min: 0
    }
}, { timestamps: true });

const commentData = mongoose.model("comment", commentSchema);
export default commentData;
