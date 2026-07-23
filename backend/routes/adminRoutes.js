const express = require('express');
const router = express.Router();

router.get('/admin', (req, res) => {
  res.json({
    status: 'success',
    message: 'Admin endpoint OK'
  });
});

module.exports = router;
