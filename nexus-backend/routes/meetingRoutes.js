const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { protect } = require('../middleware/auth');

router.post('/schedule', protect, async (req, res) => {
  try {
    const { title, description, participantId, date, startTime, endTime } = req.body;

    const conflict = await Meeting.findOne({
      participant: participantId,
      date: new Date(date),
      status: { $ne: 'rejected' },
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
      ]
    });

    if (conflict) {
      return res.status(400).json({ success: false, message: 'Is time slot mein pehle se meeting hai!' });
    }

    const meeting = await Meeting.create({
      title,
      description,
      organizer: req.user.id,
      participant: participantId,
      date: new Date(date),
      startTime,
      endTime
    });

    res.status(201).json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/my-meetings', protect, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ organizer: req.user.id }, { participant: req.user.id }]
    })
    .populate('organizer', 'name email role')
    .populate('participant', 'name email role')
    .sort({ date: 1 });

    res.json({ success: true, meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/accept', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { status: 'accepted' },
      { new: true }
    );
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/reject', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;