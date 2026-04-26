// middleware/auth.js
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Acceso denegado. Token no proporcionado." });
  }

  // Separamos "Bearer" del token usando el espacio
  // authHeader suele ser: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Formato de token inválido." });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    // Si el token está mal formado o expiró, ahora sí entra aquí con propiedad
    res.status(403).json({ message: "Token inválido o expirado." });
  }
};

module.exports = verifyToken;
