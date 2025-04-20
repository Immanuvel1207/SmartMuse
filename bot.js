const TelegramBot = require("node-telegram-bot-api")
const mongoose = require("mongoose")
const axios = require("axios")
const qrcode = require("qrcode")
const crypto = require("crypto")
require("dotenv").config();
const twilio = require("twilio")
const PDFDocument = require("pdfkit")
const fs = require("fs")
const path = require("path")

// MongoDB setup
mongoose
  .connect("mongodb://localhost:27017/museum_db")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Museum schema
const museumSchema = new mongoose.Schema({
  museum_name: String,
  location: String,
  address: String,
  description: String,
  best_time_to_visit: String,
  theme: String,
  timings: String,
  price_per_seat: Number,
  upi_id: String,
  maximum_seats: Number,
})
const Museum = mongoose.model("Museum", museumSchema)

// Booking schema
const bookingSchema = new mongoose.Schema({
  museum: String,
  date: String,
  session: String,
  seats: Number,
  mobileNumber: String,
  ticketNumber: String,
  totalPrice: Number,
  paymentStatus: String,
  ticketid: String,
  upiTransactionId: String,
  visitors: [{ name: String, age: Number }],
  childrenUnder5: Number,
})
const Booking = mongoose.model("Booking", bookingSchema)

// Telegram bot setup
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Twilio setup
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const verifyServiceSid = process.env.TWILIO_VERIFY_SID;

// Booking flow variables
const userSession = {}

// Language options
const languageOptions = {
  reply_markup: {
    keyboard: [["English"], ["Hindi"], ["Tamil"], ["Telugu"]],
    one_time_keyboard: true,
    resize_keyboard: true,
  },
}

// Helper function to get translation
async function translateText(text, targetLanguage) {
  if (targetLanguage === "en") return text
  try {
    const response = await axios.get("https://api.mymemory.translated.net/get", {
      params: {
        q: text,
        langpair: `en|${targetLanguage}`,
      },
    })
    if (response.data.responseStatus === 200) {
      return response.data.responseData.translatedText
    } else {
      console.error("Translation error:", response.data)
      return text
    }
  } catch (error) {
    console.error("Error with translation request:", error)
    return text
  }
}

// Start conversation
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id
  userSession[chatId] = {}
  bot.sendMessage(chatId, "Please choose your language:", languageOptions)
})

// Language selection handler
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text

  if (!userSession[chatId]) {
    userSession[chatId] = {}
  }

  if (!userSession[chatId].language) {
    if (["English", "Hindi", "Tamil", "Telugu"].includes(text)) {
      userSession[chatId].language = text
      const targetLanguage = text === "Hindi" ? "hi" : text === "Tamil" ? "ta" : text === "Telugu" ? "te" : "en"

      const greeting = (await translateText("You have selected", targetLanguage)) + ` ${text}.`
      const assistMessage = await translateText("How can I assist you?", targetLanguage)

      bot.sendMessage(chatId, `${greeting} ${assistMessage}`, {
        reply_markup: {
          keyboard: [
            [await translateText("Book a Ticket", targetLanguage)],
            [await translateText("Cancel Booking", targetLanguage)],
            [await translateText("Exit", targetLanguage)],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
    } else {
    //   bot.sendMessage(chatId, "Please select a language to continue.", languageOptions)
    }
    return
  }

  const language = userSession[chatId].language
  const targetLanguage = language === "Hindi" ? "hi" : language === "Tamil" ? "ta" : language === "Telugu" ? "te" : "en"

  // Handle admin login
  if (text === "/admin") {
    userSession[chatId].state = "awaiting_admin_username"
    bot.sendMessage(chatId, await translateText("Please enter the museum name for admin login:", targetLanguage))
    return
  }

  if (userSession[chatId].state === "awaiting_admin_username") {
    userSession[chatId].adminUsername = text
    userSession[chatId].state = "awaiting_admin_password"
    bot.sendMessage(chatId, await translateText("Please enter the admin password:", targetLanguage))
    return
  }

  if (userSession[chatId].state === "awaiting_admin_password") {
    if (text === "admin") {
      const museum = await Museum.findOne({ museum_name: userSession[chatId].adminUsername })
      if (museum) {
        userSession[chatId].isAdmin = true
        userSession[chatId].state = null
        const welcomeMessage = await translateText("Welcome, admin. What would you like to do?", targetLanguage)
        bot.sendMessage(chatId, welcomeMessage, {
          reply_markup: {
            keyboard: [
              [await translateText("View Bookings", targetLanguage)],
              [await translateText("Logout", targetLanguage)],
            ],
            resize_keyboard: true,
          },
        })
      } else {
        bot.sendMessage(chatId, await translateText("Invalid museum name. Please try again.", targetLanguage))
        userSession[chatId].state = null
      }
    } else {
      bot.sendMessage(chatId, await translateText("Invalid credentials. Please try again.", targetLanguage))
      userSession[chatId].state = null
    }
    return
  }

  if (userSession[chatId].isAdmin) {
    if (text === (await translateText("View Bookings", targetLanguage))) {
      const today = new Date().toISOString().split("T")[0]
      const bookings = await Booking.find({
        museum: userSession[chatId].adminUsername,
        date: today,
      })

      let message = await translateText(
        `Today's bookings for ${userSession[chatId].adminUsername}:\n\n`,
        targetLanguage,
      )
      for (const booking of bookings) {
        message += `Ticket: ${booking.ticketNumber}\n`
        message += `Date: ${booking.date}\n`
        message += `Session: ${booking.session}\n`
        message += `Seats: ${booking.seats}\n`
        message += `Status: ${booking.paymentStatus}\n\n`
      }

      bot.sendMessage(chatId, message)
    } else if (text === (await translateText("Logout", targetLanguage))) {
      userSession[chatId].isAdmin = false
      bot.sendMessage(chatId, await translateText("You have been logged out.", targetLanguage), languageOptions)
    }
    return
  }

  if (text === (await translateText("Book a Ticket", targetLanguage))) {
    const prompt = await translateText("Would you like to book by Museum Name or Location?", targetLanguage)
    bot.sendMessage(chatId, prompt, {
      reply_markup: {
        keyboard: [
          [await translateText("Museum Name", targetLanguage)],
          [await translateText("Location", targetLanguage)],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    })
  } else if (text === (await translateText("Cancel Booking", targetLanguage))) {
    const prompt = await translateText("Please enter your ticket number:", targetLanguage)
    userSession[chatId].state = "awaiting_ticket_number"
    bot.sendMessage(chatId, prompt)
  } else if (text === (await translateText("Exit", targetLanguage))) {
    userSession[chatId] = {}
    bot.sendMessage(
      chatId,
      await translateText("You have exited the booking process. Type /start to begin again.", targetLanguage),
    )
  } else if (userSession[chatId].state === "awaiting_ticket_number") {
    const ticketNumber = text
    const booking = await Booking.findOne({ ticketNumber: ticketNumber })

    if (booking) {
      // Perform cancellation
      await Booking.deleteOne({ ticketNumber: ticketNumber })

      // Simulate refund process
      const refundMessage = await translateText(
        `Your booking has been cancelled. A refund of ${booking.totalPrice} INR will be processed to your original payment method within 3-5 business days.`,
        targetLanguage,
      )
      bot.sendMessage(chatId, refundMessage)

      // Reset session
      userSession[chatId] = { language: userSession[chatId].language }

      const doMore = await translateText("Would you like to do anything else?", targetLanguage)
      bot.sendMessage(chatId, doMore, {
        reply_markup: {
          keyboard: [
            [await translateText("Book a Ticket", targetLanguage)],
            [await translateText("Cancel Booking", targetLanguage)],
            [await translateText("Exit", targetLanguage)],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
    } else {
      const errorMessage = await translateText(
        "Invalid ticket number. Please try again or contact support.",
        targetLanguage,
      )
      bot.sendMessage(chatId, errorMessage)
    }

    userSession[chatId].state = null
  } else if (text === (await translateText("Location", targetLanguage))) {
    try {
      const locations = await Museum.distinct("location")
      const locationButtons = locations.map((location) => [{ text: location }])

      const locationPrompt = await translateText("Choose a location:", targetLanguage)
      bot.sendMessage(chatId, locationPrompt, {
        reply_markup: {
          keyboard: locationButtons,
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
    } catch (err) {
      const errorMsg = await translateText("Error fetching locations.", targetLanguage)
      bot.sendMessage(chatId, errorMsg)
    }
  } else if (text === (await translateText("Museum Name", targetLanguage))) {
    try {
      const museums = await Museum.find()
      const museumButtons = []

      for (const museum of museums) {
        const translatedName = await translateText(museum.museum_name, targetLanguage)
        museumButtons.push([{ text: `${museum.museum_name} (${translatedName})` }])
      }

      const museumPrompt = await translateText("Select a museum:", targetLanguage)
      bot.sendMessage(chatId, museumPrompt, {
        reply_markup: {
          keyboard: museumButtons,
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
    } catch (err) {
      const errorMsg = await translateText("Error fetching museum names.", targetLanguage)
      bot.sendMessage(chatId, errorMsg)
    }
} else if (await Museum.findOne({ location: text })) {

    try {
      const museums = await Museum.find({ location: text })
      const museumButtons = []

      for (const museum of museums) {
        const translatedName = await translateText(museum.museum_name, targetLanguage)
        museumButtons.push([{ text: `${museum.museum_name} (${translatedName})` }])
      }

      const museumPrompt = await translateText("Select a museum:", targetLanguage)
      bot.sendMessage(chatId, museumPrompt, {
        reply_markup: {
          keyboard: museumButtons,
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
    } catch (err) {
      const errorMsg = await translateText("Error fetching museums for this location.", targetLanguage)
      bot.sendMessage(chatId, errorMsg)
    }
  } else if (await Museum.findOne({ museum_name: text.split(" (")[0] })) {
    try {
      const selectedMuseum = await Museum.findOne({ museum_name: text.split(" (")[0] })

      const museumLabel = await translateText("Museum", targetLanguage)
      const locationLabel = await translateText("Location", targetLanguage)
      const addressLabel = await translateText("Address", targetLanguage)
      const descriptionLabel = await translateText("Description", targetLanguage)
      const bestTimeToVisitLabel = await translateText("Best Time to Visit", targetLanguage)
      const themeLabel = await translateText("Theme", targetLanguage)
      const timingsLabel = await translateText("Timings", targetLanguage)

      const museumNameInLanguage = await translateText(selectedMuseum.museum_name, targetLanguage)
      const translatedLocation = await translateText(selectedMuseum.location, targetLanguage)
      const translatedAddress = await translateText(selectedMuseum.address, targetLanguage)
      const translatedDescription = await translateText(selectedMuseum.description, targetLanguage)
      const translatedTheme = await translateText(selectedMuseum.theme, targetLanguage)
      const translatedBestTimeToVisit = await translateText(selectedMuseum.best_time_to_visit, targetLanguage)
      const translatedTimings = await translateText(selectedMuseum.timings, targetLanguage)

      const detailsMessage =
        `${museumLabel}: ${selectedMuseum.museum_name} (${museumNameInLanguage})\n` +
        `${locationLabel}: ${translatedLocation}\n` +
        `${addressLabel}: ${translatedAddress}\n` +
        `${descriptionLabel}: ${translatedDescription}\n` +
        `${bestTimeToVisitLabel}: ${translatedBestTimeToVisit}\n` +
        `${themeLabel}: ${translatedTheme}\n` +
        `${timingsLabel}: ${translatedTimings}`

      bot.sendMessage(chatId, detailsMessage, {
        reply_markup: {
          keyboard: [[await translateText("Confirm", targetLanguage)], [await translateText("Exit", targetLanguage)]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })

      userSession[chatId].selectedMuseum = selectedMuseum.museum_name
    } catch (err) {
      const errorMsg = await translateText("Error fetching museum details.", targetLanguage)
      bot.sendMessage(chatId, errorMsg)
    }
  } else if (text === (await translateText("Confirm", targetLanguage))) {
    if (userSession[chatId].selectedMuseum) {
      userSession[chatId].museum = userSession[chatId].selectedMuseum
      userSession[chatId].selectedMuseum = null

      const dates = getNextSevenDays()
      const dateButtons = dates.map((date) => [{ text: date }])

      const datePrompt = await translateText("Select a date:", targetLanguage)
      bot.sendMessage(chatId, datePrompt, {
        reply_markup: {
          keyboard: dateButtons,
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
    }
  } else if (userSession[chatId].museum && getNextSevenDays().includes(text)) {
    userSession[chatId].date = text

    const sessionTimes = ["10:30-12", "12-2", "2-4", "4-5"]
    const sessionButtons = sessionTimes.map((time) => [{ text: time }])

    const sessionPrompt = await translateText("Select a session:", targetLanguage)
    bot.sendMessage(chatId, sessionPrompt, {
      reply_markup: {
        keyboard: sessionButtons,
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    })
  } else if (userSession[chatId].date && ["10:30-12", "12-2", "2-4", "4-5"].includes(text)) {
    if (isSessionInPast(userSession[chatId].date, text)) {
      const pastSessionError = await translateText(
        "This session has already passed. Please select a future session.",
        targetLanguage
      )
      bot.sendMessage(chatId, pastSessionError)
      return
    }

    userSession[chatId].session = text

    // Check if there are available tickets for the selected date and session
    const bookings = await Booking.find({
      museum: userSession[chatId].museum,
      date: userSession[chatId].date,
      session: userSession[chatId].session,
    })

    const selectedMuseum = await Museum.findOne({ museum_name: userSession[chatId].museum })
    const totalBookedSeats = bookings.reduce((total, booking) => total + booking.seats, 0)

    if (totalBookedSeats >= selectedMuseum.maximum_seats) {
      const noTicketsMessage = await translateText(
        "Sorry, all tickets for this date and session have been booked. Please choose another date or session.",
        targetLanguage,
      )
      bot.sendMessage(chatId, noTicketsMessage)
      return
    }

    const availableTickets = selectedMuseum.maximum_seats - totalBookedSeats
    const seatPrompt = await translateText(
      `How many seats would you like to book? (${availableTickets} available)`,
      targetLanguage,
    )
    bot.sendMessage(chatId, seatPrompt)
  } else if (userSession[chatId].session && !userSession[chatId].seats) {
    const seats = Number.parseInt(text)

    if (isNaN(seats) || seats <= 0) {
      const seatError = await translateText("Please enter a valid number of seats.", targetLanguage)
      bot.sendMessage(chatId, seatError)
    } else {
      // Check if the requested number of seats is available
      const bookings = await Booking.find({
        museum: userSession[chatId].museum,
        date: userSession[chatId].date,
        session: userSession[chatId].session,
      })

      const totalBookedSeats = bookings.reduce((total, booking) => total + booking.seats, 0)
      const selectedMuseum = await Museum.findOne({ museum_name: userSession[chatId].museum })
      const availableTickets = selectedMuseum.maximum_seats - totalBookedSeats

      if (seats > availableTickets) {
        const notEnoughSeatsMessage = await translateText(
          `Sorry, only ${availableTickets} seats are available for this session. Please choose a smaller number of seats.`,
          targetLanguage,
        )
        bot.sendMessage(chatId, notEnoughSeatsMessage)
        return
      }

      userSession[chatId].seats = seats
      userSession[chatId].visitors = []
      userSession[chatId].currentVisitor = 1

      const visitorPrompt = await translateText(
        `Please enter the name of visitor ${userSession[chatId].currentVisitor}:`,
        targetLanguage,
      )
      bot.sendMessage(chatId, visitorPrompt)
    }
  } else if (userSession[chatId].seats && userSession[chatId].currentVisitor <= userSession[chatId].seats) {
    if (!userSession[chatId].visitors[userSession[chatId].currentVisitor - 1]) {
      userSession[chatId].visitors[userSession[chatId].currentVisitor - 1] = { name: text }
      const agePrompt = await translateText(`Please enter the age of ${text}:`, targetLanguage)
      bot.sendMessage(chatId, agePrompt)
    } else {
      const age = Number.parseInt(text)
      if (isNaN(age) || age < 0) {
        const ageError = await translateText("Please enter a valid age.", targetLanguage)
        bot.sendMessage(chatId, ageError)
      } else {
        userSession[chatId].visitors[userSession[chatId].currentVisitor - 1].age = age
        userSession[chatId].currentVisitor++

        if (userSession[chatId].currentVisitor <= userSession[chatId].seats) {
          const nextVisitorPrompt = await translateText(
            `Please enter the name of visitor ${userSession[chatId].currentVisitor}:`,
            targetLanguage,
          )
          bot.sendMessage(chatId, nextVisitorPrompt)
        } else {
          const childrenPrompt = await translateText(
            "How many children below 5 years will be accompanying? (Enter 0 if none)",
            targetLanguage,
          )
          bot.sendMessage(chatId, childrenPrompt)
        }
      }
    }
  } else if (
    userSession[chatId].seats &&
    userSession[chatId].currentVisitor > userSession[chatId].seats &&
    !userSession[chatId].childrenUnder5
  ) {
    var childrenCount = Number.parseInt(text)
    childrenCount = childrenCount+1;
    if (childrenCount < 0) {
      const childrenError = await translateText("Please enter a valid number of children.", targetLanguage)
      bot.sendMessage(chatId, childrenError)
    } else {
      userSession[chatId].childrenUnder5 = childrenCount

      // Fetch the museum details to get the price per seat
      const selectedMuseum = await Museum.findOne({ museum_name: userSession[chatId].museum })
      const totalPrice = userSession[chatId].seats * selectedMuseum.price_per_seat
      userSession[chatId].totalPrice = totalPrice

      const priceMessage = await translateText(
        `The total price for ${userSession[chatId].seats} seats is ${totalPrice} INR.`,
        targetLanguage
      )
      const mobilePrompt = await translateText("Please enter your 10-digit mobile number:", targetLanguage)

      bot.sendMessage(chatId, `${priceMessage}\n\n${mobilePrompt}`)
    }
  } else if (userSession[chatId].childrenUnder5 !== undefined && !userSession[chatId].mobileNumber) {
    if (/^\d{10}$/.test(text)) {
      userSession[chatId].mobileNumber = text
      userSession[chatId].awaitingOTP = true

      // Send verification code
      twilioClient.verify.v2
        .services(verifyServiceSid)
        .verifications.create({ to: `+91${userSession[chatId].mobileNumber}`, channel: "sms" })
        .then((verification) => console.log(verification.status))
        .catch((error) => console.error("Error sending verification:", error))

      const otpMessage = await translateText(
        `A verification code has been sent to your mobile number. Please enter the code to confirm your booking.`,
        targetLanguage
      )
      bot.sendMessage(chatId, otpMessage)
    } else {
      const mobileError = await translateText("Please enter a valid 10-digit mobile number.", targetLanguage)
      bot.sendMessage(chatId, mobileError)
    }
  } else if (userSession[chatId].awaitingOTP) {
    twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: `+91${userSession[chatId].mobileNumber}`, code: text })
      .then(async (verification_check) => {
        if (verification_check.status === "approved") {
          userSession[chatId].verified = true
          userSession[chatId].awaitingOTP = false

          const paymentPrompt = await translateText(
            'Your mobile number has been verified. Please click "Pay Now" to proceed with the payment.',
            targetLanguage,
          )

          bot.sendMessage(chatId, paymentPrompt, {
            reply_markup: {
              inline_keyboard: [[{ text: await translateText("Pay Now", targetLanguage), callback_data: "pay_now" }]],
            },
          })
        } else {
          const otpError = await translateText("Incorrect verification code. Please try again.", targetLanguage)
          bot.sendMessage(chatId, otpError)
        }
      })
      .catch(async (error) => {
        console.error("Error verifying code:", error)
        const verificationError = await translateText("Error verifying code. Please try again.", targetLanguage)
        bot.sendMessage(chatId, verificationError)
      })
  }
})

// Handle callback queries (for the "Pay Now" and "Payment Completed" buttons)
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id
  const data = callbackQuery.data

  if (data === "pay_now") {
    try {
      const museum = await Museum.findOne({ museum_name: userSession[chatId].museum })
      const upiId = museum.upi_id
      const amount = userSession[chatId].totalPrice
      const transactionNote = `Booking for ${userSession[chatId].museum}`

      // Generate UPI payment link
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(userSession[chatId].museum)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}`

      // Generate QR code for the UPI link
      const qrImageBuffer = await qrcode.toBuffer(upiLink)

      // Generate a unique transaction ID
      userSession[chatId].upiTransactionId = generateUPITransactionId()

      const targetLanguage =
        userSession[chatId].language === "Hindi"
          ? "hi"
          : userSession[chatId].language === "Tamil"
            ? "ta"
            : userSession[chatId].language === "Telugu"
              ? "te"
              : "en"
      const paymentInstructions = await translateText(
        `Please scan the QR code below to complete your payment of ${amount} INR.\n\nAfter payment, click the "Payment Completed" button to confirm your booking.`,
        targetLanguage
      )

      const paymentCompletedButton = await translateText("Payment Completed", targetLanguage)
      await bot.sendMessage(chatId, paymentInstructions)
      await bot.sendPhoto(chatId, qrImageBuffer, {
        caption: "Scan this QR code to pay",
        reply_markup: {
          inline_keyboard: [[{ text: paymentCompletedButton, callback_data: "payment_completed" }]],
        },
      })
    } catch (error) {
      console.error("Error generating UPI QR code:", error)
      const errorMessage = await translateText(
        "There was an error processing your payment. Please try again later.",
        userSession[chatId].language === "Hindi"
          ? "hi"
          : userSession[chatId].language === "Tamil"
            ? "ta"
            : userSession[chatId].language === "Telugu"
              ? "te"
              : "en",
      )
      bot.sendMessage(chatId, errorMessage)
    }
  } else if (data === "payment_completed") {
    const targetLanguage =
      userSession[chatId].language === "Hindi"
        ? "hi"
        : userSession[chatId].language === "Tamil"
          ? "ta"
          : userSession[chatId].language === "Telugu"
            ? "te"
            : "en"

    // Verify payment status
    const verificationResult = await verifyUPIPayment(userSession[chatId].upiTransactionId)

    if (verificationResult.success) {
      // Check again if tickets are still available
      const bookings = await Booking.find({
        museum: userSession[chatId].museum,
        date: userSession[chatId].date,
        session: userSession[chatId].session,
      })

      const totalBookedSeats = bookings.reduce((total, booking) => total + booking.seats, 0)
      const museum = await Museum.findOne({ museum_name: userSession[chatId].museum })

      if (totalBookedSeats + userSession[chatId].seats > museum.maximum_seats) {
        const noTicketsMessage = await translateText(
          "Sorry, the requested number of tickets are no longer available. Your payment will be refunded.",
          targetLanguage,
        )
        bot.sendMessage(chatId, noTicketsMessage)
        return
      }

      userSession[chatId].paymentStatus = "completed"
      userSession[chatId].ticketNumber = generateTicketNumber()

      // Save booking to the database
      const newBooking = new Booking({
        ...userSession[chatId],
        paymentStatus: "completed",
        tickid: userSession[chatId].ticketNumber,
      })
      await newBooking.save()

      // Generate QR code
      const qrData = JSON.stringify({
        ticketNumber: userSession[chatId].ticketNumber,
        mobileNumber: userSession[chatId].mobileNumber,
        museum: userSession[chatId].museum,
        date: userSession[chatId].date,
        session: userSession[chatId].session,
        seats: userSession[chatId].seats,
        totalPrice: userSession[chatId].totalPrice,
        visitors: userSession[chatId].visitors.map(v => v.name),
        childrenUnder5: userSession[chatId].childrenUnder5
      })

      const qrImageBuffer = await qrcode.toBuffer(qrData)

      const bookingConfirmation = await translateText(
        `Your booking for ${userSession[chatId].museum} on ${userSession[chatId].date} during ${userSession[chatId].session} with ${userSession[chatId].seats} seats has been confirmed!\n\nTotal Price: ${userSession[chatId].totalPrice} INR\nYour ticket number is: ${userSession[chatId].ticketNumber}`,
        targetLanguage,
      )

      // Send confirmation message and QR code
      await bot.sendMessage(chatId, bookingConfirmation)
      await bot.sendPhoto(chatId, qrImageBuffer, { caption: "Scan this QR code for your booking details" })

      // Generate and send PDF
      try {
        const pdfBuffer = await generatePDF(userSession[chatId])
        await bot.sendDocument(chatId, pdfBuffer, {
          filename: `ticket_${userSession[chatId].ticketNumber}.pdf`,
          caption: await translateText("Here's your PDF ticket.", targetLanguage),
        })
      } catch (error) {
        console.error("Error generating or sending PDF:", error)
        const errorMessage = await translateText(
          "There was an error generating your PDF ticket. Please contact support.",
          targetLanguage,
        )
        bot.sendMessage(chatId, errorMessage)
      }

      // Ask if the user wants to do anything else
      const doMore = await translateText("Would you like to do anything else?", targetLanguage)
      bot.sendMessage(chatId, doMore, {
        reply_markup: {
          keyboard: [
            [await translateText("Book a Ticket", targetLanguage)],
            [await translateText("Cancel Booking", targetLanguage)],
            [await translateText("Exit", targetLanguage)],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
    } else {
      const paymentError = await translateText(
        "Payment not completed or verified. Please try again or contact support.",
        targetLanguage,
      )
      bot.sendMessage(chatId, paymentError)
    }
  }
})

// Helper function to get next 7 days
function getNextSevenDays() {
  const days = []
  const today = new Date()

  for (let i = 0; days.length < 7; i++) {
    const nextDay = new Date(today)
    nextDay.setDate(today.getDate() + i)
    if (nextDay.getDay() !== 0) { // 0 is Sunday
      days.push(nextDay.toISOString().split("T")[0]) // Format as YYYY-MM-DD
    }
  }

  return days
}

// Helper function to generate a unique ticket number
function generateTicketNumber() {
  return crypto.randomBytes(8).toString("hex").toUpperCase()
}

// Helper function to generate a unique UPI transaction ID
function generateUPITransactionId() {
  return `UPI${Date.now()}${Math.random().toString(36).substr(2, 5)}`
}

// Helper function to verify UPI payment (mock implementation)
async function verifyUPIPayment(transactionId) {
  // In a real-world scenario, you would integrate with a UPI service provider's API to verify the payment
  // This is a mock implementation that simulates a payment verification process
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate a 90% success rate
      const success = Math.random() < 0.9
      resolve({
        success: success,
        message: success ? "Payment verified successfully" : "Payment verification failed",
      })
    }, 2000) // Simulate a 2-second delay for verification
  })
}

// Helper function to check if a session is in the past
function isSessionInPast(date, session) {
  const now = new Date()
  const [year, month, day] = date.split('-').map(Number)
  const [startHour, startMinute] = session.split('-')[0].split(':').map(Number)
  const sessionDate = new Date(year, month - 1, day, startHour, startMinute)
  return now > sessionDate
}

// Helper function to generate PDF
async function generatePDF(bookingData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 72, right: 72 }
    });
    const chunks = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width - 144; // Accounting for left and right margins

    // Add background color
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f0f0f0');

    // Add Indian flag
    doc.image('./assets/flag.png', 72, 50, { width: 60 })

    // Add national emblem
    doc.image('./assets/emblem.png', doc.page.width - 132, 50, { width: 60 })

    // Add watermark
    doc.fillColor('rgba(200, 200, 200, 0.3)').fontSize(60).rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] })
    doc.text('Government of India', 0, doc.page.height / 2, { width: doc.page.width, align: 'center' })
    doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] })

    // Reset text color and font size
    doc.fillColor('#000000').fontSize(18)

    // Add header
    doc.fontSize(24).text("Government of India", 72, 130, { width: pageWidth, align: "center" })
    doc.fontSize(20).text("Indian Museums", 72, 160, { width: pageWidth, align: "center" })

    // Add colorful separator
    doc.lineWidth(4)
    doc.moveTo(72, 190).lineTo(doc.page.width - 72, 190).stroke('#FF9933') // Saffron
    doc.moveTo(72, 195).lineTo(doc.page.width - 72, 195).stroke('#FFFFFF') // White
    doc.moveTo(72, 200).lineTo(doc.page.width - 72, 200).stroke('#138808') // Green

    // Add QR code
    const qrData = JSON.stringify({
      ticketNumber: bookingData.ticketNumber,
      museum: bookingData.museum,
      date: bookingData.date,
      session: bookingData.session,
      visitors: bookingData.visitors.map(v => v.name),
      childrenUnder5: bookingData.childrenUnder5-1
    })
    qrcode.toDataURL(qrData, (err, url) => {
      if (err) throw err
      doc.image(url, doc.page.width - 172, 220, { width: 100 })
    })

    // Add ticket details
    doc.fontSize(16).fillColor('#FF9933').text('Ticket Details:', 72, 220)
    doc.fontSize(12).fillColor('#000000')
    doc.text(`Museum: ${bookingData.museum}`, 72, 250)
    doc.text(`Date: ${bookingData.date}`, 72, 270)
    doc.text(`Session: ${bookingData.session}`, 72, 290)
    doc.text(`Ticket Number: ${bookingData.ticketNumber}`, 72, 310)

    // Add visitor details
    doc.fontSize(16).fillColor('#138808').text('Visitors:', 72, 350)
    doc.fontSize(12).fillColor('#000000')
    let yPos = 380
    bookingData.visitors.forEach((visitor, index) => {
      doc.text(`${index + 1}. ${visitor.name} (Age: ${visitor.age})`, 72, yPos)
      yPos += 20
    })

    // Add additional details
    doc.text(`Children under 5: ${bookingData.childrenUnder5-1}`, 72, yPos + 20)
    doc.text(`Total Price: ${bookingData.totalPrice} INR`, 72, yPos + 40)
    doc.text(`Payment Status: ${bookingData.paymentStatus}`, 72, yPos + 60)

    // Add digital signature
    doc.fontSize(10).text('Digitally signed by:', doc.page.width - 222, 600)
    doc.fontSize(12).text('Ministry of Indian Museums', doc.page.width - 222, 620)
    doc.image('./assets/sign.png', doc.page.width - 222, 640, { width: 100 })

    // Add footer
    doc.fontSize(10).text('This is an electronically generated document.', 72, 750, { width: pageWidth, align: 'center' })
    doc.text('No physical signature is required.', 72, 770, { width: pageWidth, align: 'center' })

    doc.end()
  })
}

// Start the bot
console.log("Bot is running...")