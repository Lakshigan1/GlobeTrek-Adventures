const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: "globetrek-academic-project-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 4
        }
    })
);

app.use(express.static(path.join(__dirname, "public")));

const db = new Database("globetrek.db");

db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    duration TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT NOT NULL,
    description TEXT NOT NULL,
    activities TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tour_id INTEGER NOT NULL,
    travel_date TEXT NOT NULL,
    travelers INTEGER NOT NULL,
    custom_plan TEXT,
    total REAL NOT NULL,
    payment_status TEXT DEFAULT 'Pending',
    booking_status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(tour_id) REFERENCES tours(id)
);

CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

function seedDatabase() {
    const tourCount = db.prepare("SELECT COUNT(*) AS count FROM tours").get();

    if (tourCount.count === 0) {
        const insert = db.prepare(`
            INSERT INTO tours
            (title, destination, duration, price, image, description, activities)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const tours = [
            [
                "Sri Lanka Grand Explorer",
                "Colombo • Kandy • Ella • Galle",
                "8 Days / 7 Nights",
                895,
                "/images/kandy.jpeg",
                "Experience Sri Lanka's highlights, from cultural cities and misty mountains to beaches and historic coastal towns.",
                "Temple visits, scenic train ride, tea plantation, wildlife, beach relaxation"
            ],
            [
                "Magical Kandy & Ella",
                "Kandy • Nuwara Eliya • Ella",
                "5 Days / 4 Nights",
                595,
                "/images/9_arch.jpeg",
                "Discover the beautiful hill country of Sri Lanka with cultural attractions, tea estates and spectacular mountain scenery.",
                "Temple of the Tooth, tea factory, waterfalls, Ella viewpoints, train journey"
            ],
            [
                "Southern Coast Escape",
                "Galle • Mirissa • Unawatuna",
                "4 Days / 3 Nights",
                475,
                "/images/mirissa.jpeg",
                "Relax on Sri Lanka's tropical southern coast while exploring colonial Galle and beautiful beaches.",
                "Galle Fort, whale watching, snorkeling, beach activities"
            ],
            [
                "Wildlife Adventure",
                "Sigiriya • Minneriya • Yala",
                "6 Days / 5 Nights",
                720,
                "/images/yala.jpeg",
                "An unforgettable wildlife and nature adventure covering ancient heritage and Sri Lanka's famous national parks.",
                "Safari, elephant watching, Sigiriya, village tour, nature walk"
            ],
            [
                "Cultural Heritage Tour",
                "Anuradhapura • Polonnaruwa • Sigiriya",
                "4 Days / 3 Nights",
                510,
                "/images/polonaruwa.jpeg",
                "Explore Sri Lanka's ancient kingdoms, archaeological wonders and UNESCO heritage attractions.",
                "Ancient cities, Sigiriya Rock, temples, cultural performances"
            ],
            [
                "Negombo Beach Weekend",
                "Negombo",
                "2 Days / 1 Night",
                195,
                "/images/negombo_beach.jpeg",
                "Enjoy a relaxing short escape in Negombo with beaches, seafood and beautiful sunsets.",
                "Beach relaxation, lagoon tour, seafood dinner, city sightseeing"
            ]
        ];

        for (const tour of tours) {
            insert.run(...tour);
        }
    }

    const admin = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@globetrek.lk");

    if (!admin) {
        const password = bcrypt.hashSync("Admin@123", 10);

        db.prepare(`
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `).run(
            "GlobeTrek Administrator",
            "admin@globetrek.lk",
            password,
            "admin"
        );
    }

    const staff = db.prepare("SELECT * FROM users WHERE email = ?").get("staff@globetrek.lk");

    if (!staff) {
        const password = bcrypt.hashSync("Staff@123", 10);

        db.prepare(`
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `).run(
            "GlobeTrek Staff",
            "staff@globetrek.lk",
            password,
            "staff"
        );
    }
}

seedDatabase();

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please sign in to continue."
        });
    }

    next();
}

function requireStaff(req, res, next) {
    if (
        !req.session.user ||
        !["staff", "admin"].includes(req.session.user.role)
    ) {
        return res.status(403).json({
            success: false,
            message: "Staff or administrator access required."
        });
    }

    next();
}

/* ---------------- TOURS ---------------- */

app.get("/api/tours", (req, res) => {
    try {
        const search = req.query.search || "";

        const tours = db.prepare(`
            SELECT *
            FROM tours
            WHERE title LIKE ?
               OR destination LIKE ?
               OR description LIKE ?
            ORDER BY id DESC
        `).all(
            `%${search}%`,
            `%${search}%`,
            `%${search}%`
        );

        res.json({
            success: true,
            tours
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load tour packages."
        });
    }
});

/* ---------------- AUTH ---------------- */

app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const existing = db
            .prepare("SELECT id FROM users WHERE email = ?")
            .get(cleanEmail);

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, 'customer')
        `).run(
            name.trim(),
            cleanEmail,
            hashedPassword
        );

        req.session.user = {
            id: result.lastInsertRowid,
            name: name.trim(),
            email: cleanEmail,
            role: "customer"
        };

        res.json({
            success: true,
            message: "Registration successful.",
            user: req.session.user
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const user = db
            .prepare("SELECT * FROM users WHERE email = ?")
            .get(email.trim().toLowerCase());

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.json({
            success: true,
            message: "Login successful.",
            user: req.session.user
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

app.get("/api/me", (req, res) => {
    res.json({
        loggedIn: !!req.session.user,
        user: req.session.user || null
    });
});

/* ---------------- BOOKINGS ---------------- */

app.post("/api/bookings", requireLogin, (req, res) => {
    try {
        const {
            tourId,
            travelDate,
            travelers,
            customPlan
        } = req.body;

        if (!tourId || !travelDate || !travelers) {
            return res.status(400).json({
                success: false,
                message: "Please complete all booking fields."
            });
        }

        const numberOfTravelers = Number(travelers);

        if (
            !Number.isInteger(numberOfTravelers) ||
            numberOfTravelers < 1 ||
            numberOfTravelers > 30
        ) {
            return res.status(400).json({
                success: false,
                message: "Travelers must be between 1 and 30."
            });
        }

        const tour = db
            .prepare("SELECT * FROM tours WHERE id = ?")
            .get(tourId);

        if (!tour) {
            return res.status(404).json({
                success: false,
                message: "Tour package not found."
            });
        }

        const total = tour.price * numberOfTravelers;

        const result = db.prepare(`
            INSERT INTO bookings
            (user_id, tour_id, travel_date, travelers, custom_plan, total)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            req.session.user.id,
            tourId,
            travelDate,
            numberOfTravelers,
            customPlan || "",
            total
        );

        res.json({
            success: true,
            message: "Booking created successfully.",
            bookingId: result.lastInsertRowid,
            total
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to create booking."
        });
    }
});

app.get("/api/my-bookings", requireLogin, (req, res) => {
    try {
        const bookings = db.prepare(`
            SELECT
                bookings.*,
                tours.title,
                tours.destination,
                tours.image
            FROM bookings
            JOIN tours ON tours.id = bookings.tour_id
            WHERE bookings.user_id = ?
            ORDER BY bookings.created_at DESC
        `).all(req.session.user.id);

        res.json({
            success: true,
            bookings
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load bookings."
        });
    }
});

/* ---------------- DEMO PAYMENT ---------------- */

app.post("/api/payments", requireLogin, (req, res) => {
    try {
        const {
            bookingId,
            cardName,
            cardNumber,
            expiry,
            cvv
        } = req.body;

        if (!bookingId || !cardName || !cardNumber || !expiry || !cvv) {
            return res.status(400).json({
                success: false,
                message: "Please complete all payment fields."
            });
        }

        const cleanCard = cardNumber.replace(/\s/g, "");

        if (!/^\d{16}$/.test(cleanCard)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 16-digit demo card number."
            });
        }

        if (!/^\d{2}\/\d{2}$/.test(expiry)) {
            return res.status(400).json({
                success: false,
                message: "Expiry must use MM/YY format."
            });
        }

        if (!/^\d{3,4}$/.test(cvv)) {
            return res.status(400).json({
                success: false,
                message: "Invalid CVV."
            });
        }

        const booking = db.prepare(`
            SELECT *
            FROM bookings
            WHERE id = ?
              AND user_id = ?
        `).get(
            bookingId,
            req.session.user.id
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        db.prepare(`
            UPDATE bookings
            SET payment_status = 'Paid',
                booking_status = 'Confirmed'
            WHERE id = ?
        `).run(bookingId);

        res.json({
            success: true,
            message: "Demo payment successful. Booking confirmed."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Payment processing failed."
        });
    }
});

/* ---------------- QUERIES ---------------- */

app.post("/api/queries", (req, res) => {
    try {
        const {
            name,
            email,
            subject,
            message
        } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Please complete all contact fields."
            });
        }

        const userId = req.session.user
            ? req.session.user.id
            : null;

        db.prepare(`
            INSERT INTO queries
            (user_id, name, email, subject, message)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            userId,
            name.trim(),
            email.trim().toLowerCase(),
            subject.trim(),
            message.trim()
        );

        res.json({
            success: true,
            message: "Your query has been submitted successfully."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to submit your query."
        });
    }
});

/* ---------------- STAFF / ADMIN ---------------- */

app.get("/api/admin/dashboard", requireStaff, (req, res) => {
    try {
        const users = db
            .prepare("SELECT COUNT(*) AS count FROM users")
            .get().count;

        const bookings = db
            .prepare("SELECT COUNT(*) AS count FROM bookings")
            .get().count;

        const paidBookings = db
            .prepare(`
                SELECT COUNT(*) AS count
                FROM bookings
                WHERE payment_status = 'Paid'
            `)
            .get().count;

        const sales = db
            .prepare(`
                SELECT COALESCE(SUM(total), 0) AS total
                FROM bookings
                WHERE payment_status = 'Paid'
            `)
            .get().total;

        const pendingQueries = db
            .prepare(`
                SELECT COUNT(*) AS count
                FROM queries
                WHERE status = 'Pending'
            `)
            .get().count;

        const recentBookings = db.prepare(`
            SELECT
                bookings.*,
                users.name AS customer_name,
                users.email,
                tours.title
            FROM bookings
            JOIN users ON users.id = bookings.user_id
            JOIN tours ON tours.id = bookings.tour_id
            ORDER BY bookings.created_at DESC
            LIMIT 20
        `).all();

        res.json({
            success: true,
            statistics: {
                users,
                bookings,
                paidBookings,
                sales,
                pendingQueries
            },
            recentBookings
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard."
        });
    }
});

app.get("/api/admin/queries", requireStaff, (req, res) => {
    try {
        const queries = db.prepare(`
            SELECT *
            FROM queries
            ORDER BY created_at DESC
        `).all();

        res.json({
            success: true,
            queries
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load queries."
        });
    }
});

app.put("/api/admin/queries/:id", requireStaff, (req, res) => {
    try {
        const { response, status } = req.body;

        db.prepare(`
            UPDATE queries
            SET response = ?,
                status = ?
            WHERE id = ?
        `).run(
            response || "",
            status || "Answered",
            req.params.id
        );

        res.json({
            success: true,
            message: "Query updated."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to update query."
        });
    }
});

/* ---------------- ERROR HANDLING ---------------- */

app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "API endpoint not found."
        });
    }

    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

app.listen(PORT, () => {
    console.log("======================================");
    console.log(" GlobeTrek Adventures");
    console.log(" Server running successfully");
    console.log(` http://localhost:${PORT}`);
    console.log("======================================");
    console.log("");
    console.log("Demo Admin:");
    console.log("Email: admin@globetrek.lk");
    console.log("Password: Admin@123");
    console.log("");
    console.log("Demo Staff:");
    console.log("Email: staff@globetrek.lk");
    console.log("Password: Staff@123");
});