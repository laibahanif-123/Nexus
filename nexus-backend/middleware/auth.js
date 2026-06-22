const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Login karein pehle' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    // Token was valid, but the user it points to no longer exists in the DB
    // (e.g. stale token from before a DB switch/reset). Without this check,
    // req.user would be null and any route reading req.user.id would crash
    // the whole server.
    if (!user) {
      return res.status(401).json({ success: false, message: 'User nahi mila, dobara login karein' });
    }

    req.user = user;
    next();

  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid hai' });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Sirf ${roles.join(', ')} access kar sakta hai`
      });
    }
    next();
  };
};