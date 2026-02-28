// ===== GLOBAL STATE =====

let currentUserRole = null;
let currentFilter = null;
let currentTag = null;

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("popularBtn").addEventListener("click", () => {
        currentFilter = "popular";
        loadIdeas(currentFilter, currentTag);
    });

    document.getElementById("newBtn").addEventListener("click", () => {
        currentFilter = "new";
        loadIdeas(currentFilter, currentTag);
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
        currentFilter = null;
        currentTag = null;
        document.getElementById("tagSelect").value = "All Tags";
        loadIdeas();
    });

    document.getElementById("tagSelect").addEventListener("change", function () {
        console.log("Tag changed to:", this.value);

        const selected = this.value;

        currentTag =
            selected === "All Tags"
                ? null
                : selected.toLowerCase().replace(/\s/g, "-");

        console.log("Normalized tag:", currentTag);

        loadIdeas(currentFilter, currentTag);
    });

});

// ===== CONSTANTS =====

const API_BASE = "http://localhost:3000/api";

// ===== ON LOAD =====
window.onload = () => {
    checkSession();
    loadIdeas();
};

/* ================= AUTH HELPERS ================= */

async function login() {
    const username = prompt(
        "Enter username:\n\nAdmin: admin\nEmployee: user"
    );

    const password = prompt(
        "Enter password:\n\nAdmin: admin123\nEmployee: user123"
    );

    if (!username || !password) return;

    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
        await checkSession();
        await loadIdeas();
    } else {
        alert(data.error);
    }
}

async function logout() {
    await fetch(`${API_BASE}/logout`, {
        method: "POST",
        credentials: "include"
    });

    currentUserRole = null;

    await checkSession();
    await loadIdeas();
}

/* ================= SESSION ================= */

function requireLogin() {
    if (!currentUserRole) {
        login();   // open modal
        return false;
    }
    return true;
}

async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/session`, {
            credentials: "include"
        });

        const data = await res.json();

        const hero = document.getElementById("heroSection");
        const welcome = document.getElementById("welcomeText");
        const loginBtn = document.getElementById("loginBtn");
        const logoutBtn = document.getElementById("logoutBtn");

        if (data.loggedIn) {
            currentUserRole = data.role;

            if (hero) hero.style.display = "none";
            if (loginBtn) loginBtn.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "inline-block";

            welcome.innerText =
                `Welcome ${data.role === "admin" ? "Management" : "Employee"} — what would you like to change today?`;

        } else {
            currentUserRole = null;

            if (hero) hero.style.display = "block";
            if (loginBtn) loginBtn.style.display = "inline-block";
            if (logoutBtn) logoutBtn.style.display = "none";

            welcome.innerText = "Login to participate.";
        }

    } catch (err) {
        console.error("Session check failed:", err);
    }
}

/* ================= LOGIN SYSTEM ================= */

function login() {
    // Clear any previous values
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";

    // Show modal
    document.getElementById("loginModal").style.display = "flex";
}

function hideLoginModal() {
    document.getElementById("loginModal").style.display = "none";
}

function hideModal() {
    document.getElementById("ideaModal").style.display = "none";
}

async function submitLogin() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!username || !password) {
        alert("Please enter both username and password.");
        return;
    }

    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
        hideLoginModal();
        await checkSession();
        await loadIdeas();
    } else {
        alert(data.error);
    }
}

/* ================= BUTTONS ================= */

function expandAllComments(btn) {
    const card = btn.closest(".card");
    const comments = card.querySelectorAll(".comment");

    comments.forEach(comment => {
        comment.classList.remove("collapsed");
        const textDiv = comment.querySelector(".comment-text");
        textDiv.innerText = textDiv.dataset.full;
        comment.querySelector(".expand-comment-btn").innerText = "Collapse";
    });
}

function collapseAllComments(btn) {
    const card = btn.closest(".card");
    const comments = card.querySelectorAll(".comment");

    comments.forEach(comment => {
        comment.classList.add("collapsed");
        const textDiv = comment.querySelector(".comment-text");

        const shortText =
            textDiv.dataset.full.length > 120
                ? textDiv.dataset.full.substring(0, 120) + "..."
                : textDiv.dataset.full;

        textDiv.innerText = shortText;
        comment.querySelector(".expand-comment-btn").innerText = "Expand";
    });
}

/* ================= LOAD IDEAS ================= */

async function loadIdeas(filter = null, tag = null) {

    let url = `${API_BASE}/ideas`;

    const params = new URLSearchParams();

    if (filter) params.append("filter", filter);
    if (tag && tag !== "All Tags") params.append("tag", tag.toLowerCase().replace(/\s/g, "-"));

    if (params.toString()) {
        url += "?" + params.toString();
    }

    const res = await fetch(url, { credentials: "include" });
    const ideas = await res.json();

    renderBoard(ideas);
}

function renderBoard(ideas) {
    document.querySelectorAll(".card-container")
        .forEach(c => c.innerHTML = "");

    ideas.forEach(renderIdea);
}

async function voteIdea(id, value) {
    if (!requireLogin()) return;

    await fetch(`${API_BASE}/ideas/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value })
    });

    loadIdeas(currentFilter, currentTag);
}

/* ================= SUBMIT IDEA ================= */

async function submitIdea() {

    if (!requireLogin()) return;

    const title = document.getElementById("titleInput").value.trim();
    const description = document.getElementById("descInput").value.trim();
    const tag = document.getElementById("tagInput").value;

    if (!title || !description) {
        alert("Please fill out both title and description.");
        return;
    }

    const res = await fetch(`${API_BASE}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            title,
            description,
            tag
        })
    });

    const data = await res.json();

    if (data.success) {

        // Clear form
        document.getElementById("titleInput").value = "";
        document.getElementById("descInput").value = "";

        // Hide modal
        hideModal();

        // Reload ideas while preserving filters
        loadIdeas(currentFilter, currentTag);

    } else {
        alert(data.error);
    }
}
/* ================= RENDER IDEA ================= */

function renderIdea(idea) {

    const statusKey = idea.status.toLowerCase().replace(/\s/g, "");
    const container = document.getElementById(statusKey);
    if (!container) return;

    const card = document.createElement("div");
    card.className = "card collapsed";
    card.dataset.id = idea.id;

    // Admin drag capability
    if (currentUserRole === "admin") {
        card.draggable = true;
        card.addEventListener("dragstart", handleDragStart);
    }

    const commentCount = idea.comments ? idea.comments.length : 0;

    card.innerHTML = `
    <div class="card-header">

        <!-- ROW 1 -->
        <div class="card-row row-top">

            <div class="tag-label ${idea.tag}">
                ${idea.tag.replace(/-/g, " ")}
            </div>

            <div class="vote-section">
    <button
        class="vote-btn up ${idea.userVote === 1 ? "active" : ""}"
        onclick="voteIdea(${idea.id},1)">
        ▲
    </button>

    <span>${idea.score}</span>

    <button 
        class="vote-btn down ${idea.userVote === -1 ? "active" : ""}"
        onclick="voteIdea(${idea.id},-1)">
        ▼
    </button>
</div>

            <div class="comment-count">
                💬 ${commentCount}
            </div>

        </div>

        <!-- ROW 2 -->
        <div class="card-row row-title">
            <h4 class="card-title">
                ${escapeHTML(idea.title)}
            </h4>
        </div>

        <!-- ROW 3 -->
        <div class="card-row row-bottom">

            <div class="anon">
                🕶 Anonymous
            </div>

            <button class="expand-btn"
                    onclick="toggleCard(this)">
                Expand
            </button>

        </div>

    </div>

    <div class="card-body">
        <p>${escapeHTML(idea.description)}</p>

        <div class="timestamp">
            ${new Date(idea.created_at).toLocaleString()}
        </div>

        <hr>

<div class="comment-controls">
    <button onclick="expandAllComments(this)">Expand All</button>
    <button onclick="collapseAllComments(this)">Collapse All</button>
</div>

<div class="add-comment">
    <input
        type="text"
        id="commentInput-${idea.id}" 
        placeholder="Add a comment..."
    >
    <button onclick="submitComment(${idea.id})">
        Post
    </button>
</div>

<div class="comment-list">
    ${renderComments(idea)}
</div>
    </div>
`;

    container.appendChild(card);
}

/* ================= COMMENTS ================= */

function renderComments(idea) {

    if (!idea.comments) return "";

    return idea.comments.map(c => {

        const isManagement = c.author_role === "management";

        const shortText =
            c.content.length > 120
                ? escapeHTML(c.content.substring(0, 120)) + "..."
                : escapeHTML(c.content);

        return `
            <div class="comment ${isManagement ? "management-comment" : ""} collapsed">

                <div class="comment-header">

                    <div class="anon">
                        ${isManagement ? "Management:" : "🕶 Anonymous"}
                    </div>

                    <div class="vote-section small">
                        <button onclick="voteComment(${c.id},1)">▲</button>
                        <span>${c.score}</span>
                        <button onclick="voteComment(${c.id},-1)">▼</button>
                    </div>

                    <button class="expand-comment-btn"
                        onclick="toggleComment(this)">
                        Expand
                    </button>
                </div>

                <div class="comment-body">
                    <div class="comment-text"
                        data-full="${escapeHTML(c.content)}">
                        ${shortText}
                    </div>

                    <div class="timestamp">
                        ${new Date(c.created_at).toLocaleString()}
                    </div>
                </div>

            </div>
        `;
    }).join("");
}

/* ================= TOGGLES ================= */

function toggleCard(btn) {

    const card = btn.closest(".card");
    if (!card) return;

    card.classList.toggle("collapsed");

    btn.innerText =
        card.classList.contains("collapsed")
            ? "Expand"
            : "Collapse";
}

function toggleComment(btn) {

    const comment = btn.closest(".comment");
    const textDiv = comment.querySelector(".comment-text");

    const isCollapsed = comment.classList.toggle("collapsed");

    if (!isCollapsed) {
        textDiv.innerText = textDiv.dataset.full;
        btn.innerText = "Collapse";
    } else {
        const shortText =
            textDiv.dataset.full.length > 120
                ? textDiv.dataset.full.substring(0, 120) + "..."
                : textDiv.dataset.full;

        textDiv.innerText = shortText;
        btn.innerText = "Expand";
    }
}

/* ================= DRAG & DROP ================= */

let draggedId = null;

function handleDragStart(e) {
    draggedId = e.target.dataset.id;
}

function allowDrop(e) {
    e.preventDefault();
}

async function handleDrop(e, newStatus) {
    e.preventDefault();

    if (!currentUserRole || currentUserRole !== "admin") return;

    await fetch(`${API_BASE}/ideas/${draggedId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus })
    });

    loadIdeas();
}

/* ================= NEW IDEA ================= */

function handleNewIdea() {

    if (!requireLogin()) return;

    document.getElementById("ideaModal").style.display = "flex";
}

/* ================= SUBMIT COMMENT ================= */

async function submitComment(ideaId) {

    if (!requireLogin()) return;

    const input = document.getElementById(`commentInput-${ideaId}`);
    const content = input.value.trim();

    if (!content) {
        alert("Comment cannot be empty.");
        return;
    }

    const res = await fetch(`${API_BASE}/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content })
    });

    const data = await res.json();

    if (data.success) {
        input.value = "";
        loadIdeas(currentFilter, currentTag);
    } else {
        alert(data.error);
    }
}

/* ================= HELPERS ================= */

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[m]));
}