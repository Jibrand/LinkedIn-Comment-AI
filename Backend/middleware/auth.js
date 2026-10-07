import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "default_secret";

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }

    const decodedData = jwt.verify(token, SECRET);
    req.userId = decodedData?.id;

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
  }
};

export default auth;
