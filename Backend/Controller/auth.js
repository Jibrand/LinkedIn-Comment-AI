import userModal from "../Models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "default_secret";

export const register = async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: "Full name, email, and password are required" });
    }

    const existingUser = await userModal.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await userModal.create({ fullName, email, password: hashedPassword });
    const token = jwt.sign({ email: result.email, id: result._id }, SECRET, { expiresIn: "30d" });

    res.status(201).json({ success: true, message: "Registered successfully", result, token });
  } catch (error) {
    console.error("Error registering:", error);
    res.status(500).json({ success: false, message: "Failed to register" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const existingUser = await userModal.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "User doesn't exist" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ email: existingUser.email, id: existingUser._id }, SECRET, { expiresIn: "30d" });
    res.status(200).json({ success: true, message: "Logged in successfully", result: existingUser, token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ success: false, message: "Failed to log in" });
  }
};

export const getUserInfo = async (req, res) => {
  try {
    const user = await userModal.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Remove password from response
    const { password, ...userInfo } = user._doc;
    res.status(200).json({ success: true, result: userInfo });
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user info" });
  }
};
