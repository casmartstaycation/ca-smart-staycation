module.exports = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'CA Smart Staycation API is running',
    timestamp: new Date().toISOString()
  });
};
