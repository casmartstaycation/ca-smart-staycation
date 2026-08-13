const express = require('express');
const app = express();
app.use(express.json());

const adminRoutes = require('./backend/routes/adminRoutes');
app.use('/api', adminRoutes);

app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
