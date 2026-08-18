let tours = [];
let selectedTour = null;
let currentBookingId = null;


/* ================= UTILITIES ================= */

function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


function showMessage(elementId, message, type = "success") {
    const element = document.getElementById(elementId);

    if (!element) return;

    element.innerHTML = `
        <div class="message ${type}">
            ${message}
        </div>
    `;
}


function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}


/* ================= MOBILE MENU ================= */

document
    .getElementById("mobileMenu")
    .addEventListener("click", () => {

        document
            .getElementById("navbar")
            .classList.toggle("open");

    });


document.querySelectorAll(".nav-link").forEach(link => {

    link.addEventListener("click", () => {

        document
            .getElementById("navbar")
            .classList.remove("open");

    });

});


/* ================= LOAD TOURS ================= */

async function loadTours(search = "") {

    const grid = document.getElementById("tourGrid");

    grid.innerHTML = `
        <div class="loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            Loading tours...
        </div>
    `;

    try {

        const response = await fetch(
            `/api/tours?search=${encodeURIComponent(search)}`
        );

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        tours = data.tours;

        if (tours.length === 0) {

            grid.innerHTML = `
                <div class="loading">
                    No tour packages found.
                </div>
            `;

            return;
        }

        grid.innerHTML = tours.map(tour => {

            return `
                <article class="tour-card">

                    <div class="tour-image">

                        <img
                            src="${tour.image}"
                            alt="${escapeHtml(tour.title)}"
                            loading="lazy"
                        >

                        <div class="tour-price">
                            From $${Number(tour.price).toLocaleString()}
                        </div>

                    </div>

                    <div class="tour-content">

                        <div class="tour-destination">
                            ${escapeHtml(tour.destination)}
                        </div>

                        <h3>
                            ${escapeHtml(tour.title)}
                        </h3>

                        <p>
                            ${escapeHtml(tour.description)}
                        </p>

                        <div class="tour-meta">

                            <span>
                                <i class="fa-regular fa-clock"></i>
                                ${escapeHtml(tour.duration)}
                            </span>

                            <span>
                                <i class="fa-solid fa-person-hiking"></i>
                                Adventure
                            </span>

                        </div>

                        <button
                            class="btn btn-primary"
                            onclick="openBookingModal(${tour.id})"
                        >
                            Book This Tour
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>

                    </div>

                </article>
            `;

        }).join("");

    } catch (error) {

        console.error(error);

        grid.innerHTML = `
            <div class="loading">
                Unable to load tour packages.
            </div>
        `;

    }
}


document
    .getElementById("tourSearch")
    .addEventListener("input", event => {

        loadTours(event.target.value);

    });


/* ================= REGISTER ================= */

document
    .getElementById("registerForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const form = event.target;

        const formData = new FormData(form);

        const body = {
            name: formData.get("name"),
            email: formData.get("email"),
            password: formData.get("password")
        };

        try {

            const response = await fetch("/api/register", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)

            });

            const data = await response.json();

            if (!data.success) {
                showMessage(
                    "registerMessage",
                    data.message,
                    "error"
                );
                return;
            }

            showMessage(
                "registerMessage",
                data.message,
                "success"
            );

            form.reset();

            showToast("Welcome to GlobeTrek Adventures!");

            setTimeout(() => {
                updateUI(data.user);
            }, 700);

        } catch (error) {

            showMessage(
                "registerMessage",
                "Unable to register. Please try again.",
                "error"
            );

        }

    });


/* ================= LOGIN ================= */

document
    .getElementById("loginForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const form = event.target;

        const formData = new FormData(form);

        try {

            const response = await fetch("/api/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: formData.get("email"),
                    password: formData.get("password")
                })

            });

            const data = await response.json();

            if (!data.success) {

                showMessage(
                    "loginMessage",
                    data.message,
                    "error"
                );

                return;
            }

            showMessage(
                "loginMessage",
                data.message,
                "success"
            );

            form.reset();

            updateUI(data.user);

            showToast(`Welcome ${data.user.name}`);

        } catch (error) {

            showMessage(
                "loginMessage",
                "Unable to sign in.",
                "error"
            );

        }

    });


/* ================= SESSION ================= */

async function checkSession() {

    try {

        const response = await fetch("/api/me");

        const data = await response.json();

        if (data.loggedIn) {
            updateUI(data.user);
        }

    } catch (error) {

        console.error(error);

    }
}


function updateUI(user) {

    const dashboard = document.getElementById("dashboard");

    if (user) {

        dashboard.classList.remove("hidden");

        document.getElementById("dashboardName").textContent =
            user.name;

        loadBookings();

        if (
            user.role === "admin" ||
            user.role === "staff"
        ) {

            document
                .getElementById("adminPanel")
                .classList.remove("hidden");

            loadAdminDashboard();

        }

        dashboard.scrollIntoView({
            behavior: "smooth"
        });

    }

}


/* ================= LOGOUT ================= */

async function logout() {

    try {

        await fetch("/api/logout", {
            method: "POST"
        });

        document
            .getElementById("dashboard")
            .classList.add("hidden");

        document
            .getElementById("adminPanel")
            .classList.add("hidden");

        showToast("You have been signed out.");

        window.location.hash = "home";

    } catch (error) {

        showToast("Unable to sign out.");

    }

}


/* ================= BOOKING MODAL ================= */

function openBookingModal(tourId) {

    selectedTour = tours.find(
        tour => tour.id === tourId
    );

    if (!selectedTour) {
        showToast("Tour not found.");
        return;
    }

    document.getElementById("bookingTourId").value =
        selectedTour.id;

    document.getElementById("bookingTourTitle").textContent =
        selectedTour.title;

    document.getElementById("bookingModal")
        .classList.remove("hidden");

    updateBookingPrice();

}


function closeBookingModal() {

    document.getElementById("bookingModal")
        .classList.add("hidden");

}


document
    .getElementById("travelers")
    .addEventListener("input", updateBookingPrice);


function updateBookingPrice() {

    if (!selectedTour) return;

    const travelers =
        Number(document.getElementById("travelers").value) || 1;

    const total =
        selectedTour.price * travelers;

    document.getElementById("bookingPrice").textContent =
        `Total: $${total.toLocaleString()}`;

}


/* ================= BOOKING ================= */

document
    .getElementById("bookingForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const bookingData = {

            tourId:
                Number(
                    document.getElementById("bookingTourId").value
                ),

            travelDate:
                document.getElementById("travelDate").value,

            travelers:
                Number(
                    document.getElementById("travelers").value
                ),

            customPlan:
                document.getElementById("customPlan").value

        };

        try {

            const response = await fetch("/api/bookings", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(bookingData)

            });

            const data = await response.json();

            if (response.status === 401) {

                closeBookingModal();

                showToast(
                    "Please sign in before booking a tour."
                );

                window.location.hash = "signin";

                return;
            }

            if (!data.success) {

                showMessage(
                    "bookingMessage",
                    data.message,
                    "error"
                );

                return;
            }

            currentBookingId = data.bookingId;

            closeBookingModal();

            document
                .getElementById("paymentModal")
                .classList.remove("hidden");

        } catch (error) {

            showMessage(
                "bookingMessage",
                "Unable to create booking.",
                "error"
            );

        }

    });


/* ================= PAYMENT ================= */

document
    .getElementById("paymentForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const body = {

            bookingId: currentBookingId,

            cardName:
                document.getElementById("cardName").value,

            cardNumber:
                document.getElementById("cardNumber").value,

            expiry:
                document.getElementById("expiry").value,

            cvv:
                document.getElementById("cvv").value

        };

        try {

            const response = await fetch("/api/payments", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)

            });

            const data = await response.json();

            if (!data.success) {

                showMessage(
                    "paymentMessage",
                    data.message,
                    "error"
                );

                return;
            }

            document
                .getElementById("paymentModal")
                .classList.add("hidden");

            document
                .getElementById("paymentForm")
                .reset();

            showToast(
                "Booking confirmed successfully!"
            );

            loadBookings();

        } catch (error) {

            showMessage(
                "paymentMessage",
                "Payment failed.",
                "error"
            );

        }

    });


function closePaymentModal() {

    document
        .getElementById("paymentModal")
        .classList.add("hidden");

}


/* ================= MY BOOKINGS ================= */

async function loadBookings() {

    try {

        const response =
            await fetch("/api/my-bookings");

        if (response.status === 401) return;

        const data = await response.json();

        const container =
            document.getElementById("bookingList");

        if (!data.success) {

            container.innerHTML = `
                <div class="message error">
                    ${data.message}
                </div>
            `;

            return;
        }

        if (data.bookings.length === 0) {

            container.innerHTML = `
                <div class="loading">
                    You do not have any bookings yet.
                    <br><br>
                    <a
                        href="#tours"
                        class="btn btn-primary"
                    >
                        Explore Tours
                    </a>
                </div>
            `;

            return;
        }

        container.innerHTML =
            data.bookings.map(booking => {

                return `
                    <div class="booking-item">

                        <img
                            src="${booking.image}"
                            alt="${escapeHtml(booking.title)}"
                        >

                        <div>

                            <h3>
                                ${escapeHtml(booking.title)}
                            </h3>

                            <p>
                                <strong>Destination:</strong>
                                ${escapeHtml(booking.destination)}
                            </p>

                            <p>
                                <strong>Travel date:</strong>
                                ${escapeHtml(booking.travel_date)}
                            </p>

                            <p>
                                <strong>Travelers:</strong>
                                ${booking.travelers}
                            </p>

                            <p>
                                <strong>Total:</strong>
                                $${Number(booking.total).toLocaleString()}
                            </p>

                        </div>

                        <div>

                            <span class="status">
                                ${escapeHtml(booking.booking_status)}
                            </span>

                            <p style="margin-top:8px;font-size:11px;">
                                Payment:
                                ${escapeHtml(booking.payment_status)}
                            </p>

                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(error);

    }

}


/* ================= CONTACT ================= */

document
    .getElementById("contactForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const form = event.target;

        const formData = new FormData(form);

        const body = {

            name: formData.get("name"),
            email: formData.get("email"),
            subject: formData.get("subject"),
            message: formData.get("message")

        };

        try {

            const response = await fetch("/api/queries", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)

            });

            const data = await response.json();

            if (!data.success) {

                showMessage(
                    "contactMessage",
                    data.message,
                    "error"
                );

                return;
            }

            showMessage(
                "contactMessage",
                data.message,
                "success"
            );

            form.reset();

        } catch (error) {

            showMessage(
                "contactMessage",
                "Unable to submit your query.",
                "error"
            );

        }

    });


/* ================= ADMIN ================= */

async function loadAdminDashboard() {

    try {

        const response =
            await fetch("/api/admin/dashboard");

        const data = await response.json();

        if (!data.success) return;

        const stats =
            document.getElementById("adminStats");

        stats.innerHTML = `

            <div class="admin-stat">

                <i class="fa-solid fa-users"></i>

                <strong>
                    ${data.statistics.users}
                </strong>

                <span>Total Users</span>

            </div>


            <div class="admin-stat">

                <i class="fa-solid fa-calendar-check"></i>

                <strong>
                    ${data.statistics.bookings}
                </strong>

                <span>Total Bookings</span>

            </div>


            <div class="admin-stat">

                <i class="fa-solid fa-money-bill-trend-up"></i>

                <strong>
                    $${Number(
                        data.statistics.sales
                    ).toLocaleString()}
                </strong>

                <span>Paid Sales</span>

            </div>


            <div class="admin-stat">

                <i class="fa-solid fa-envelope"></i>

                <strong>
                    ${data.statistics.pendingQueries}
                </strong>

                <span>Pending Queries</span>

            </div>

        `;


        const table =
            document.getElementById("adminBookings");

        if (data.recentBookings.length === 0) {

            table.innerHTML = `
                <tr>
                    <td colspan="6">
                        No bookings available.
                    </td>
                </tr>
            `;

        } else {

            table.innerHTML =
                data.recentBookings.map(booking => {

                    return `
                        <tr>

                            <td>
                                ${escapeHtml(
                                    booking.customer_name
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    booking.title
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    booking.travel_date
                                )}
                            </td>

                            <td>
                                ${booking.travelers}
                            </td>

                            <td>
                                $${Number(
                                    booking.total
                                ).toLocaleString()}
                            </td>

                            <td>
                                ${escapeHtml(
                                    booking.booking_status
                                )}
                            </td>

                        </tr>
                    `;

                }).join("");

        }

        loadAdminQueries();

    } catch (error) {

        console.error(error);

    }

}


async function loadAdminQueries() {

    try {

        const response =
            await fetch("/api/admin/queries");

        const data = await response.json();

        if (!data.success) return;

        const container =
            document.getElementById("adminQueries");

        if (data.queries.length === 0) {

            container.innerHTML =
                "<p>No customer queries yet.</p>";

            return;
        }

        container.innerHTML =
            data.queries.map(query => {

                return `
                    <div class="query-card">

                        <h4>
                            ${escapeHtml(query.subject)}
                        </h4>

                        <p>
                            <strong>
                                ${escapeHtml(query.name)}
                            </strong>
                            -
                            ${escapeHtml(query.email)}
                        </p>

                        <p>
                            ${escapeHtml(query.message)}
                        </p>

                        <div class="query-response">

                            <textarea
                                id="response-${query.id}"
                                rows="3"
                                placeholder="Write response..."
                            >${escapeHtml(
                                query.response || ""
                            )}</textarea>

                            <button
                                class="btn btn-primary"
                                style="margin-top:8px;"
                                onclick="answerQuery(${query.id})"
                            >
                                Reply to Customer
                            </button>

                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(error);

    }

}


async function answerQuery(queryId) {

    const responseBox =
        document.getElementById(
            `response-${queryId}`
        );

    const responseText =
        responseBox.value.trim();

    if (!responseText) {

        showToast(
            "Please enter a response."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `/api/admin/queries/${queryId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        response: responseText,
                        status: "Answered"
                    })
                }
            );

        const data = await response.json();

        if (!data.success) {

            showToast(data.message);

            return;
        }

        showToast("Customer query answered.");

        loadAdminQueries();

    } catch (error) {

        showToast(
            "Unable to update query."
        );

    }

}


/* ================= DATE ================= */

const today =
    new Date().toISOString().split("T")[0];

document.getElementById("travelDate").min =
    today;


/* ================= START ================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadTours();

        checkSession();

    }
);