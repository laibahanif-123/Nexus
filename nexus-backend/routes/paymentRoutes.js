const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------------------------------------------------------
// POST /api/payments/deposit
// Creates a Stripe PaymentIntent (test mode) and a Pending transaction.
// Frontend confirms the PaymentIntent with Stripe.js using the returned
// clientSecret + a test card (e.g. 4242 4242 4242 4242).
// ---------------------------------------------------------------
router.post('/deposit', protect, async (req, res) => {
  try {
    const { amount } = req.body; // amount in dollars, e.g. 50.00

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects cents
      currency: 'usd',
      metadata: { userId: req.user._id.toString(), type: 'deposit' },
    });

    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'deposit',
      amount,
      status: 'Pending',
      stripePaymentIntentId: paymentIntent.id,
      description: 'Wallet deposit',
    });

    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      transaction,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------
// POST /api/payments/confirm/:transactionId
// Called by the frontend after Stripe confirms the PaymentIntent succeeded.
// Marks the transaction Completed and credits the user's wallet balance.
// ---------------------------------------------------------------
router.post('/confirm/:transactionId', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      transaction.status = 'Completed';
      await transaction.save();

      await User.findByIdAndUpdate(transaction.user, {
        $inc: { walletBalance: transaction.amount },
      });
    } else {
      transaction.status = 'Failed';
      await transaction.save();
    }

    res.json({ success: true, transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------
// POST /api/payments/withdraw
// Mock withdrawal — deducts from wallet balance immediately (sandbox only,
// no real payout). Fails if balance is insufficient.
// ---------------------------------------------------------------
router.post('/withdraw', protect, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }

    const user = await User.findById(req.user._id);

    if ((user.walletBalance || 0) < amount) {
      const transaction = await Transaction.create({
        user: req.user._id,
        type: 'withdraw',
        amount,
        status: 'Failed',
        description: 'Insufficient balance',
      });
      return res.status(400).json({ success: false, message: 'Insufficient balance', transaction });
    }

    user.walletBalance -= amount;
    await user.save();

    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'withdraw',
      amount,
      status: 'Completed',
      description: 'Wallet withdrawal',
    });

    res.status(201).json({ success: true, transaction, walletBalance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------
// POST /api/payments/transfer
// Mock transfer between two platform users (investor <-> entrepreneur).
// ---------------------------------------------------------------
router.post('/transfer', protect, async (req, res) => {
  try {
    const { amount, recipientId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    }
    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient is required' });
    }

    const sender = await User.findById(req.user._id);
    const recipient = await User.findById(recipientId);

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if ((sender.walletBalance || 0) < amount) {
      const transaction = await Transaction.create({
        user: req.user._id,
        recipient: recipientId,
        type: 'transfer',
        amount,
        status: 'Failed',
        description: 'Insufficient balance',
      });
      return res.status(400).json({ success: false, message: 'Insufficient balance', transaction });
    }

    sender.walletBalance -= amount;
    recipient.walletBalance = (recipient.walletBalance || 0) + amount;
    await sender.save();
    await recipient.save();

    const transaction = await Transaction.create({
      user: req.user._id,
      recipient: recipientId,
      type: 'transfer',
      amount,
      status: 'Completed',
      description: `Transfer to ${recipient.name || recipient.email}`,
    });

    res.status(201).json({ success: true, transaction, walletBalance: sender.walletBalance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------
// GET /api/payments/history
// Returns the logged-in user's transaction history (most recent first).
// ---------------------------------------------------------------
router.get('/history', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ user: req.user._id }, { recipient: req.user._id }],
    })
      .populate('user', 'name email')
      .populate('recipient', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;