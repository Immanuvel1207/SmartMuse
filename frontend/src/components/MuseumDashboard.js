import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MuseumDashboard.css';

const API_BASE_URL = 'http://localhost:3000/api';

const MuseumDashboard = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [museum, setMuseum] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [availableTickets, setAvailableTickets] = useState(0);
  const [error, setError] = useState('');
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [newBooking, setNewBooking] = useState({
    date: '',
    session: '',
    seats: 0,
    mobileNumber: '',
    totalPrice: 0
  });

  useEffect(() => {
    if (isLoggedIn && museum) {
      fetchBookings();
      fetchAvailableTickets();
    }
  }, [isLoggedIn, museum]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, { username, password });
      if (response.data.success) {
        setIsLoggedIn(true);
        setMuseum(response.data.museum);
      } else {
        setError(response.data.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please check your network connection and try again.');
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/bookings`, { params: { museum: museum.museum_name } });
      setBookings(response.data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to fetch bookings. Please try again.');
    }
  };

  const fetchAvailableTickets = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`${API_BASE_URL}/available-tickets`, {
        params: { museum: museum.museum_name, date: today }
      });
      setAvailableTickets(response.data.availableTickets);
    } catch (error) {
      console.error('Error fetching available tickets:', error);
      setError('Failed to fetch available tickets. Please try again.');
    }
  };

  const handleAddBooking = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const bookingData = {
        ...newBooking,
        museum: museum.museum_name,
        paymentStatus: 'offline',
        totalPrice: newBooking.seats * museum.price_per_seat
      };
      const response = await axios.post(`${API_BASE_URL}/bookings`, bookingData);
      if (response.data.success) {
        alert('Booking added successfully!');
        setNewBooking({
          date: '',
          session: '',
          seats: 0,
          mobileNumber: '',
          totalPrice: 0
        });
        fetchBookings();
        fetchAvailableTickets();
        setShowAddBooking(false);  // Close form after submission
      } else {
        setError('Failed to add booking. Please try again.');
      }
    } catch (error) {
      console.error('Error adding booking:', error);
      setError('Failed to add booking. Please try again.');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="loginContainer">
        <h1>Museum Ticket System</h1>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Museum Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <br/>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <br/>
          <button type="submit">Login</button>
        </form>
        {error && <p className="errorMessage">{error}</p>}
      </div>
    );
  }

  return (
    <div className="dashboardContainer">
      <h1>{museum.museum_name} Dashboard</h1>


      <h2>Today's Bookings</h2>
      <div className="bookingsContainer">
        {bookings.map((booking) => (
          <div key={booking._id} className="bookingCard">
            <p>Ticket: {booking.ticketNumber}</p>
            <p>Date: {booking.date}</p>
            <p>Session: {booking.session}</p>
            <p>Seats: {booking.seats}</p>
            <p>Status: {booking.paymentStatus}</p>
          </div>
        ))}
      </div>

      <p className="availableTickets">Available Tickets: {availableTickets}</p>

      <button onClick={() => setShowAddBooking(!showAddBooking)} className="addBookingButton">
        Add a New Booking
      </button>

      {showAddBooking && (
        <form onSubmit={handleAddBooking} className="bookingForm">
          <input
            type="date"
            value={newBooking.date}
            onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Session"
            value={newBooking.session}
            onChange={(e) => setNewBooking({ ...newBooking, session: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Seats"
            value={newBooking.seats}
            onChange={(e) => setNewBooking({ ...newBooking, seats: parseInt(e.target.value) })}
            required
          />
          <input
            type="tel"
            placeholder="Mobile Number"
            value={newBooking.mobileNumber}
            onChange={(e) => setNewBooking({ ...newBooking, mobileNumber: e.target.value })}
            required
          />
          <button type="submit">Add Booking</button>
        </form>
      )}
      
      {error && <p className="errorMessage">{error}</p>}


      {/* <button onClick={setIsLoggedIn(false)}>Logout</button> */}

    </div>
  );
};

export default MuseumDashboard;
