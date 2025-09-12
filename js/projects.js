const projectModal = document.getElementById('projectModal');
const addProjectBtn = document.getElementById('addProjectBtn');
const closeProjectModal = document.getElementById('closeProjectModal');
const projectForm = document.getElementById('projectForm');

const taskModal = document.getElementById('taskModal');
const addTaskBtn = document.getElementById('addTaskBtn');
const closeTaskModal = document.getElementById('closeTaskModal');
const taskForm = document.getElementById('taskForm');

addProjectBtn.onclick = () => { projectModal.classList.remove('hidden'); };
closeProjectModal.onclick = () => { projectModal.classList.add('hidden'); };
projectModal.onclick = (e) => { if (e.target === projectModal) closeProjectModal.onclick(); };

addTaskBtn.onclick = () => { taskModal.classList.remove('hidden'); populateTaskModal(); };
closeTaskModal.onclick = () => { taskModal.classList.add('hidden'); };
taskModal.onclick = (e) => { if (e.target === taskModal) closeTaskModal.onclick(); };

projectForm.onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('projectName').value;
  const desc = document.getElementById('projectDesc').value;
  await db.collection('projects').add({
    name, desc,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    members: [],
    status: 'active',
  });
  projectModal.classList.add('hidden');
  loadProjects();
};

taskForm.onsubmit = async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskName').value;
  const desc = document.getElementById('taskDesc').value;
  const deadline = document.getElementById('taskDeadline').value;
  const projectId = document.getElementById('taskProject').value;
  const assignedTo = document.getElementById('taskAssignee').value;
  const priority = document.getElementById('taskPriority').value;
  await db.collection('tasks').add({
    title, desc, deadline, projectId, assignedTo, priority,
    status: 'active',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    timeLogs: [],
    totalTime: 0,
    timerRunning: false,
  });
  taskModal.classList.add('hidden');
  loadTasks();
};

async function loadProjects() {
  const list = document.getElementById('projectsList');
  list.innerHTML = '';
  const snap = await db.collection('projects').orderBy('createdAt', 'desc').get();
  snap.forEach(doc => {
    const p = doc.data();
    const card = document.createElement('div');
    card.className = "bg-white rounded-xl shadow-md p-6 flex flex-col gap-2 hover:shadow-xl transition";
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold text-indigo-700">${p.name}</div>
        <span class="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-600">${p.status}</span>
      </div>
      <div class="text-gray-700">${p.desc}</div>
      <div class="flex gap-2 mt-2">
        <button class="text-indigo-600 hover:underline" onclick="editProject('${doc.id}')">Edit</button>
        <button class="text-red-600 hover:underline" onclick="deleteProject('${doc.id}')">Delete</button>
      </div>
    `;
    list.appendChild(card);
  });
}

async function loadTasks() {
  const list = document.getElementById('tasksList');
  list.innerHTML = '';
  const snap = await db.collection('tasks').orderBy('createdAt', 'desc').get();
  snap.forEach(doc => {
    const t = doc.data();
    const priorityColors = {
      'critical': 'bg-red-100 text-red-700 border-red-200',
      'high': 'bg-orange-100 text-orange-700 border-orange-200',
      'medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'low': 'bg-green-100 text-green-700 border-green-200'
    };
    const priorityClass = priorityColors[t.priority] || 'bg-gray-100 text-gray-700 border-gray-200';
    const totalTimeDisplay = formatTimeDisplay(t.totalTime || 0);
    
    const card = document.createElement('div');
    card.className = "bg-white rounded-xl shadow-md p-6 flex flex-col gap-2 hover:shadow-xl transition";
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold text-purple-700">${t.title}</div>
        <div class="flex gap-2">
          <span class="text-xs px-2 py-1 rounded border ${priorityClass}">${(t.priority || 'medium').toUpperCase()}</span>
          <span class="text-xs px-2 py-1 rounded bg-purple-50 text-purple-600">${t.status}</span>
        </div>
      </div>
      <div class="text-gray-700">${t.desc}</div>
      <div class="text-xs text-gray-500 mt-1">Deadline: ${t.deadline}</div>
      <div class="text-xs text-teal-600 mt-1">Total Time: ${totalTimeDisplay}</div>
      ${t.timerRunning ? '<div class="text-xs text-blue-600 mt-1 font-semibold"><i class="fas fa-clock"></i> Timer Running</div>' : ''}
      <div class="flex gap-2 mt-2">
        <button class="bg-teal-600 text-white px-3 py-1 rounded-lg hover:bg-teal-700 text-xs" onclick="openTimerModal('${doc.id}', '${t.title}')">Start Timer</button>
        <button class="text-purple-600 hover:underline" onclick="editTask('${doc.id}')">Edit</button>
        <button class="text-red-600 hover:underline" onclick="deleteTask('${doc.id}')">Delete</button>
      </div>
    `;
    list.appendChild(card);
  });
}

async function populateTaskModal() {
  // Projects dropdown
  const projectSel = document.getElementById('taskProject');
  projectSel.innerHTML = '';
  const projects = await db.collection('projects').orderBy('name').get();
  projects.forEach(doc => {
    const p = doc.data();
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = p.name;
    projectSel.appendChild(opt);
  });
  // Assignees dropdown
  const assigneeSel = document.getElementById('taskAssignee');
  assigneeSel.innerHTML = '';
  const users = await db.collection('users').orderBy('email').get();
  users.forEach(doc => {
    const u = doc.data();
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = u.email + (u.role === 'admin' ? ' (Admin)' : '');
    assigneeSel.appendChild(opt);
  });
}

async function deleteProject(id) {
  if (confirm("Delete this project?")) {
    await db.collection('projects').doc(id).delete();
    loadProjects();
  }
}
async function deleteTask(id) {
  if (confirm("Delete this task?")) {
    await db.collection('tasks').doc(id).delete();
    loadTasks();
  }
}
window.editProject = async function(id) {
  alert('Edit project not implemented yet.');
};
window.editTask = async function(id) {
  alert('Edit task not implemented yet.');
};

function formatTimeDisplay(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

window.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  loadTasks();
});