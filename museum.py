from pymongo import MongoClient

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')  # Replace with your MongoDB connection string if needed
db = client['museum_db']
collection = db['museums']

# List of museums from the document with added fields
museums = [
    {
        "museum_name": "Government Museum",
        "location": "Chennai",
        "address": "Pantheon Road Egmore Chennai - 600008",
        "description": "One of the oldest museums in India showcasing natural history, art, and archaeology collections.",
        "best_time_to_visit": "November to February",
        "theme": "Art, Archaeology, Natural History",
        "timings": "10:30 am – 6:30 pm",
        "price_per_seat": 10,
        "upi_id": "r.immanuvel12@okhdfcbank"
    },
    {
        "museum_name": "Fort Museum",
        "location": "Chennai",
        "address": "Fort St. George Rajaji Road Chennai - 600009",
        "description": "Displays relics of British colonial rule and the history of Fort St. George.",
        "best_time_to_visit": "November to February",
        "theme": "Colonial History, War",
        "timings": "9:30 AM – 5:00 PM",
        "price_per_seat": 20,
        "upi_id": "r.immanuvel12@okhdfcbank"
    },
    {
        "museum_name": "Gandhi Memorial Museum",
        "location": "Madurai",
        "address": "Tamukkam Madurai - 625020",
        "description": "Memorial for Mahatma Gandhi with exhibits on India's independence movement.",
        "best_time_to_visit": "October to March",
        "theme": "Indian Independence Movement, Gandhi",
        "timings": "10:00 AM – 5:00 PM",
        "price_per_seat": 10,
        "upi_id": "r.immanuvel12@okhdfcbank"
    },
    {
        "museum_name": "Archaeological Museum",
        "location": "Pudukkottai",
        "address": "Pudukkottai Tamil Nadu - 622001",
        "description": "Exhibits from the Sangam era including bronzes, sculptures, and stone carvings.",
        "best_time_to_visit": "November to February",
        "theme": "Sangam Era, Archaeology",
        "timings": "9:00 AM – 5:00 PM",
        "price_per_seat": 20,
        "upi_id": "r.immanuvel12@okhdfcbank"
    },
    {
        "museum_name": "Thanjavur Art Gallery",
        "location": "Thanjavur",
        "address": "Thanjavur Palace Thanjavur - 613001",
        "description": "Famous for its collection of Chola bronzes and Nayak and Maratha art.",
        "best_time_to_visit": "November to March",
        "theme": "Chola Art, Maratha Art",
        "timings": "9:00 AM – 6:00 PM",
        "price_per_seat": 10,
        "upi_id": "r.immanuvel12@okhdfcbank"
    },
    {
        "museum_name": "Dakshinachitra Museum",
        "location": "Chennai",
        "address": "East Coast Road Muttukadu Chennai - 603118",
        "description": "A living history museum of South Indian heritage showcasing traditional crafts and lifestyles.",
        "best_time_to_visit": "October to March",
        "theme": "South Indian Culture, Folk Art",
        "timings": "10:00 AM – 6:00 PM",
        "price_per_seat": 20,
        "upi_id": "r.immanuvel12@okhdfcbank"
    },
    {
        "museum_name": "Raja Ravi Varma Art Gallery",
        "location": "Chennai",
        "address": "Fort Museum Fort St. George Chennai - 600009",
        "description": "Gallery dedicated to Raja Ravi Varma's paintings and his contribution to Indian art.",
        "best_time_to_visit": "November to February",
        "theme": "Indian Art, Painting",
        "timings": "9:30 AM – 5:00 PM",
        "price_per_seat": 10,
        "upi_id": "r.immanuvel12@okhdfcbank"
    },
]

# Insert the museums into MongoDB
result = collection.insert_many(museums)

# Print the inserted IDs
print(f"Inserted museum IDs: {result.inserted_ids}")