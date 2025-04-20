const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/museum_db', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Museum Schema
const museumSchema = new mongoose.Schema({
  museum_name: String,
  location: String,
  address: String,
  description: String,
  best_time_to_visit: String,
  theme: String,
  timings: String,
  price_per_seat: Number,
  upi_id: String
});

const Museum = mongoose.model('Museum', museumSchema);

// Booking Schema
const bookingSchema = new mongoose.Schema({
  museum: String,
  date: String,
  session: String,
  seats: Number,
  mobileNumber: String,
  ticketNumber: String,
  totalPrice: Number,
  paymentStatus: String,
  upiTransactionId: String
});

const Booking = mongoose.model('Booking', bookingSchema);

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const museum = await Museum.findOne({ museum_name: username });
    if (museum && password === 'admin') {
      res.json({ success: true, museum: museum });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get bookings
app.get('/api/bookings', async (req, res) => {
  const { museum } = req.query;
  const today = new Date().toISOString().split('T')[0];
  try {
    const bookings = await Booking.find({ museum: museum, date: today });
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

// Get available tickets
app.get('/api/available-tickets', async (req, res) => {
  const { museum, date } = req.query;
  
  if (!museum || !date) {
    return res.status(400).json({ message: 'Museum and date are required' });
  }

  try {
    const bookings = await Booking.find({ museum, date });
    const totalBookedSeats = bookings.reduce((total, booking) => total + booking.seats, 0);
    const availableTickets = 10 - totalBookedSeats; // Assuming 10 tickets per day
    res.json({ availableTickets, totalBookedSeats });
  } catch (error) {
    console.error('Error fetching available tickets:', error);
    res.status(500).json({ message: 'Error fetching available tickets' });
  }
});

// Add new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    await newBooking.save();
    res.json({ success: true, booking: newBooking });
  } catch (error) {
    console.error('Error adding booking:', error);
    res.status(500).json({ success: false, message: 'Error adding booking' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));