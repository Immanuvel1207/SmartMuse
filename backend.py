from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ConversationHandler
from pymongo import MongoClient

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')  # Replace with your MongoDB connection string
db = client['telegram_bot']
collection = db['users']

# Define conversation states
ASK_NAME, SHOW_OPTIONS = range(2)

# Start command: Asks for the user's name
async def start(update: Update, context) -> int:
    await update.message.reply_text("Hello! Please enter your name:")
    return ASK_NAME

# Handle user's name and save it to MongoDB
async def ask_name(update: Update, context) -> int:
    name = update.message.text
    user_id = update.message.from_user.id

    # Save name to MongoDB
    collection.update_one(
        {"user_id": user_id},
        {"$set": {"name": name}},
        upsert=True
    )

    # Show options
    reply_keyboard = [["Continue", "Exit"]]
    await update.message.reply_text(
        f"Thanks {name}, what would you like to do next?",
        reply_markup=ReplyKeyboardMarkup(reply_keyboard, one_time_keyboard=True)
    )

    return SHOW_OPTIONS

# Handle the user's choice from the options
async def show_options(update: Update, context) -> int:
    choice = update.message.text

    if choice == "Continue":
        await update.message.reply_text("Please enter your name again:")
        return ASK_NAME

    elif choice == "Exit":
        await update.message.reply_text("Goodbye!")
        return ConversationHandler.END

# Handle stop and cleanup
async def stop(update: Update, context) -> int:
    await update.message.reply_text("Goodbye!")
    return ConversationHandler.END

# Main function to setup the bot
if __name__ == '__main__':
    app = ApplicationBuilder().token("6921255137:AAEb7Q0iH0fKxgkkPcwaHznUODLz0Chh3h8").build()  # Replace with your bot token

    # Conversation handler to manage states
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            ASK_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, ask_name)],
            SHOW_OPTIONS: [MessageHandler(filters.Regex('^(Continue|Exit)$'), show_options)]
        },
        fallbacks=[CommandHandler('stop', stop)]
    )

    # Add the conversation handler to the app
    app.add_handler(conv_handler)

    # Start the bot
    print("Bot is running...")
    app.run_polling()
