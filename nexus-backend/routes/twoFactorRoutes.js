const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Otp = require('../models/Otp');
const User = require('../models/User');
const sendOtpEmail = require('../utils/sendOtpEmail');
const jwt = require('jsonwebtoken');

// ---------------------------------------------------------------
// POST /api/2fa/send-otp
// Called right after a normal login succeeds (email+password verified).
// Generates a 6-digit code, stores it (expires in 5 min), emails it.
// ---------------------------------------------------------------
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Remove any old OTPs for this user before issuing a new one
    await Otp.deleteMany({ user: user._id });

    const code = crypto.randomInt(100000, 999999).toString(); // 6-digit code
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await Otp.create({ user: user._id, code, expiresAt });
    await sendOtpEmail(user.email, code);

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------
// POST /api/2fa/verify-otp
// Checks the submitted code against the stored OTP. On success, issues
// the final JWT token that completes login.
// ---------------------------------------------------------------
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otpRecord = await Otp.findOne({ user: user._id, code });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await otpRecord.deleteOne();
      return res.status(400).json({ success: false, message: 'Code expired, request a new one' });
    }

    // Code is valid — clean it up so it can't be reused
    await otpRecord.deleteOne();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Verified',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;