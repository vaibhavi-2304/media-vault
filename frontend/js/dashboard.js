const API_URL = "http://localhost:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "index.html";
}

let currentFolder = null;
let currentUser = null;

function headers(json = false) {
  const result = {
    Authorization: `Bearer ${token}`
  };
  if (json) result["Content-Type"] = "application/json";
  return result;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0)} ${units[index]}`;
}

function showMessage(text) {
  document.getElementById("message").textContent = text;
}

async function api(url, options = {}) {
  const response = await fetch(`${API_URL}${url}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

async function loadUser() {
  const data = await api("/api/auth/me", {
    headers: headers()
  });

  currentUser = data.user;

  document.getElementById("welcome").textContent =
    ` — ${currentUser.name}`;

  updateStorage();
}

function updateStorage() {
  const used = currentUser.storageUsed;
  const quota = currentUser.storageQuota;
  const percent = Math.min((used / quota) * 100, 100);

  document.getElementById("storageText").textContent =
    `${formatBytes(used)} / ${formatBytes(quota)}`;

  document.getElementById("progressBar").style.width =
    `${percent}%`;
}

async function loadFolders() {
  const query = currentFolder ? `?parentFolder=${currentFolder}` : "";

  const data = await api(`/api/folders${query}`, {
    headers: headers()
  });

  const container = document.getElementById("folders");
  container.innerHTML = "";

  data.folders.forEach(folder => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="item-title">📁 ${escapeHtml(folder.name)}</div>
      <div class="item-actions">
        <button class="open-folder">Open</button>
        <button class="delete-folder danger">Trash</button>
      </div>
    `;

    div.querySelector(".open-folder").onclick = () => {
      currentFolder = folder._id;
      loadCurrentFolder();
    };

    div.querySelector(".delete-folder").onclick = async () => {
      if (!confirm(`Move "${folder.name}" to trash?`)) return;

      try {
        await api(`/api/folders/${folder._id}`, {
          method: "DELETE",
          headers: headers()
        });
        await loadCurrentFolder();
      } catch (error) {
        showMessage(error.message);
      }
    };

    container.appendChild(div);
  });
}

async function loadFiles() {
  const query = currentFolder ? `?folder=${currentFolder}` : "";

  const data = await api(`/api/files${query}`, {
    headers: headers()
  });

  const container = document.getElementById("files");
  container.innerHTML = "";

  if (data.files.length === 0) {
    container.innerHTML = `<p class="muted">No files here.</p>`;
    return;
  }

  data.files.forEach(file => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div class="item-title">📄 ${escapeHtml(file.name)}</div>
      <p class="muted">${formatBytes(file.size)} · ${escapeHtml(file.mimeType)}</p>
      <div class="item-actions">
        <button class="download">Download</button>
        <button class="trash danger">Trash</button>
      </div>
    `;

    div.querySelector(".download").onclick = async () => {
      try {
        const data = await api(`/api/files/${file._id}/download`, {
          headers: headers()
        });
        window.open(data.downloadUrl, "_blank");
      } catch (error) {
        showMessage(error.message);
      }
    };

    div.querySelector(".trash").onclick = async () => {
      if (!confirm(`Move "${file.name}" to trash?`)) return;

      try {
        await api(`/api/files/${file._id}`, {
          method: "DELETE",
          headers: headers()
        });

        await loadUser();
        await loadCurrentFolder();
      } catch (error) {
        showMessage(error.message);
      }
    };

    container.appendChild(div);
  });
}

async function loadCurrentFolder() {
  document.getElementById("locationTitle").textContent =
    currentFolder ? "Folder" : "My Files";

  showMessage("");

  try {
    await Promise.all([
      loadFolders(),
      loadFiles()
    ]);
  } catch (error) {
    showMessage(error.message);
  }
}

async function createFolder() {
  const name = prompt("Folder name:");

  if (!name) return;

  try {
    await api("/api/folders", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        name,
        parentFolder: currentFolder
      })
    });

    await loadCurrentFolder();
  } catch (error) {
    showMessage(error.message);
  }
}

async function uploadFile(file) {
  try {
    showMessage("Requesting secure upload URL...");

    const urlData = await api("/api/files/upload-url", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
        folderId: currentFolder
      })
    });

    showMessage("Uploading directly to AWS S3...");

    const uploadResponse = await fetch(urlData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error("S3 upload failed");
    }

    showMessage("Saving file metadata...");

    await api("/api/files/complete", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        name: file.name,
        key: urlData.key,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        folderId: currentFolder
      })
    });

    showMessage("File uploaded successfully.");

    await loadUser();
    await loadCurrentFolder();
  } catch (error) {
    showMessage(error.message);
  }
}

async function showTrash() {
  try {
    const data = await api("/api/files/trash", {
      headers: headers()
    });

    document.getElementById("locationTitle").textContent = "Trash";
    document.getElementById("folders").innerHTML = "";
    const container = document.getElementById("files");
    container.innerHTML = "";

    if (data.files.length === 0) {
      container.innerHTML = `<p class="muted">Trash is empty.</p>`;
      return;
    }

    data.files.forEach(file => {
      const div = document.createElement("div");
      div.className = "item";

      div.innerHTML = `
        <div class="item-title">🗑 ${escapeHtml(file.name)}</div>
        <p class="muted">${formatBytes(file.size)}</p>
        <div class="item-actions">
          <button class="restore">Restore</button>
          <button class="permanent danger">Delete permanently</button>
        </div>
      `;

      div.querySelector(".restore").onclick = async () => {
        try {
          await api(`/api/files/${file._id}/restore`, {
            method: "PATCH",
            headers: headers()
          });
          await loadUser();
          await showTrash();
        } catch (error) {
          showMessage(error.message);
        }
      };

      div.querySelector(".permanent").onclick = async () => {
        if (!confirm("Permanently delete this file from S3?")) return;

        try {
          await api(`/api/files/${file._id}/permanent`, {
            method: "DELETE",
            headers: headers()
          });
          await showTrash();
        } catch (error) {
          showMessage(error.message);
        }
      };

      container.appendChild(div);
    });
  } catch (error) {
    showMessage(error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("uploadButton").onclick = () => {
  document.getElementById("fileInput").click();
};

document.getElementById("fileInput").onchange = async (event) => {
  const file = event.target.files[0];
  if (file) await uploadFile(file);
  event.target.value = "";
};

document.getElementById("newFolderButton").onclick = createFolder;
document.getElementById("trashButton").onclick = showTrash;

document.getElementById("rootButton").onclick = async () => {
  currentFolder = null;
  await loadCurrentFolder();
};

document.getElementById("logoutButton").onclick = () => {
  localStorage.removeItem("token");
  window.location.href = "index.html";
};

(async function init() {
  try {
    await loadUser();
    await loadCurrentFolder();
  } catch (error) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
  }
})();