// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    req.user = { id: decoded.id, _id: decoded.id, role: decoded.role, name: decoded.name };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not permitted to perform this action`,
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
