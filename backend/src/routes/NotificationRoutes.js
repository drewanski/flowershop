const router = require('express').Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { requireToken } = require('../middlewares/AuthMiddleware');
router.use(require('express-rate-limit')({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many notification requests. Try again shortly.' } }));
router.use(requireToken);
const scope = req => ({ recipient: req.user._id, role: req.user.role });
router.get('/', async (req, res) => {
  try {
    const filter = scope(req);
    let cursor;
    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) return res.status(400).json({ message: 'Invalid notification cursor.' });
      cursor = req.query.before;
    }
    const [items, unreadCount] = await Promise.all([
      Notification.find({ ...filter, ...(cursor ? { _id: { $lt: cursor } } : {}) }).sort({ _id: -1 }).limit(31).select('-recipient -role -eventKey').lean(),
      Notification.countDocuments({ ...filter, readAt: null }),
    ]);
    res.json({ payload: { items: items.slice(0, 30), unreadCount, nextCursor: items.length > 30 ? String(items[29]._id) : null }, message: 'Your notifications.' });
  } catch { res.status(500).json({ message: 'Unable to load notifications. Try again.' }); }
});
router.patch('/read-all', async (req, res) => {
  // A snapshot boundary avoids marking a notification arriving after this click read.
  if (!mongoose.isValidObjectId(req.body?.through)) return res.status(400).json({ message: 'A notification boundary is required.' });
  try {
    await Notification.updateMany({ ...scope(req), readAt: null, _id: { $lte: req.body.through } }, { $set: { readAt: new Date() } });
    res.json({ message: 'Notifications marked read.' });
  } catch { res.status(500).json({ message: 'Unable to mark notifications read.' }); }
});
router.patch('/:id/read', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid notification.' });
  try {
    const item = await Notification.findOneAndUpdate({ ...scope(req), _id: req.params.id }, { $set: { readAt: new Date() } }, { new: true });
    if (!item) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ message: 'Notification marked read.' });
  } catch { res.status(500).json({ message: 'Unable to mark notification read.' }); }
});
module.exports = router;
