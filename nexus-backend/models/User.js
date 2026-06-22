const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name required']
  },
  email: {
    type: String,
    required: [true, 'Email required'],
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['investor', 'entrepreneur'],
    required: true
  },
  bio: { type: String, default: '' },
  profilePic: { type: String, default: '' },
  startupInfo: {
    startupName: String,
    industry: String,
    fundingNeeded: Number,
    description: String
  },
  investorInfo: {
    firmName: String,
    investmentRange: String,
    preferredIndustries: [String]
  },
  isVerified: { type: Boolean, default: false },
  walletBalance: { type: Number, default: 0 }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);