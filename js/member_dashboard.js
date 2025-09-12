let currentUser = null;
let currentUserRole = null;
let memberTasks = [];
let workLogs = [];

// Auth state handler for member dashboard
onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  
  currentUser = user;
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userInfo = userDoc.data();
  currentUserRole = userInfo.role;
  
  // Role-based access control - redirect admins to admin dashboard
  if (userInfo.role === 'admin') {
    window.location.href = "dashboard.html";
    return;
  }
  
  // Only allow members
  if (userInfo.role !== 'member') {
    alert('Access denied. Members only.');
    auth.signOut();
    return;
  }
  
  // Initialize member UI
  document.getElementById('welcome').innerText = `Welcome, ${userInfo.email}`;
  document.getElementById('logoutBtn').onclick = () => auth.signOut();
  
  // Update sidebar user info
  document.getElementById('sidebarUserEmail').textContent = userInfo.email;
  document.getElementById('sidebarUserRole').textContent = 'Member';
  
  // Initialize navigation
  initializeMemberNavigation();
  
  // Load member dashboard data
  loadMemberDashboard();
});

// Initialize navigation for member dashboard
function initializeMemberNavigation() {
  // Navigation event listeners
  document.getElementById('navDashboard').addEventListener('click', (e) => {
    e.preventDefault();
    showMemberSection('dashboard');
    updateActiveNav('navDashboard');
  });
  
  document.getElementById('navTasks').addEventListener('click', (e) => {
    e.preventDefault();
    showMemberSection('tasks');
    updateActiveNav('navTasks');
  });
  
  document.getElementById('navProgress').addEventListener('click', (e) => {
    e.preventDefault();
    showMemberSection('progress');
    updateActiveNav('navProgress');
  });
  
  document.getElementById('navProjects').addEventListener('click', (e) => {
    e.preventDefault();
    showMemberSection('projects');
    updateActiveNav('navProjects');
  });
}

// Show different sections of the member dashboard
function showMemberSection(sectionName) {
  // Hide all sections
  const sections = ['dashboardSection', 'tasksSection', 'progressSection', 'projectsSection'];
  sections.forEach(section => {
    const element = document.getElementById(section);
    if (element) {
      element.style.display = 'none';
    }
  });
  
  // Show selected section
  const targetSection = sectionName + 'Section';
  const element = document.getElementById(targetSection);
  if (element) {
    element.style.display = 'block';
  }
  
  // Load section-specific data
  switch(sectionName) {
    case 'tasks':
      loadMemberTasks();
      break;
    case 'progress':
      loadProgressData();
      break;
    case 'projects':
      loadMemberProjects();
      break;
    case 'dashboard':
    default:
      loadMemberDashboard();
      break;
  }
}

// Update active navigation indicator
function updateActiveNav(activeNavId) {
  // Remove active class from all nav items
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('sidebar-active');
  });
  
  // Add active class to selected nav
  document.getElementById(activeNavId).classList.add('sidebar-active');
}

// Load member dashboard data
async function loadMemberDashboard() {
  try {
    // Load tasks assigned to current user
    const tasksSnap = await db.collection('tasks')
      .where('assignedToUid', '==', currentUser.uid)
      .get();
    
    memberTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calculate task statistics
    const completedTasks = memberTasks.filter(task => isCompletedStatus(task.status));
    const pendingTasks = memberTasks.filter(task => isPendingStatus(task.status));
    const overdueTasks = memberTasks.filter(task => isOverdueTask(task));
    
    // Update dashboard cards
    document.getElementById('completedTasksCount').textContent = completedTasks.length;
    document.getElementById('pendingTasksCount').textContent = pendingTasks.length;
    document.getElementById('overdueTasksCount').textContent = overdueTasks.length;
    
    // Load today's time worked
    await loadTodayTimeWorked();
    
  } catch (error) {
    console.error('Error loading member dashboard:', error);
  }
}

// Load member's tasks
async function loadMemberTasks() {
  try {
    const tasksSnap = await db.collection('tasks')
      .where('assignedToUid', '==', currentUser.uid)
      .orderBy('deadline', 'asc')
      .get();
    
    memberTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    displayMemberTasks(memberTasks);
    
  } catch (error) {
    console.error('Error loading member tasks:', error);
    // If orderBy fails, try without it
    try {
      const tasksSnap = await db.collection('tasks')
        .where('assignedToUid', '==', currentUser.uid)
        .get();
      memberTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      displayMemberTasks(memberTasks);
    } catch (fallbackError) {
      console.error('Error loading member tasks (fallback):', fallbackError);
    }
  }
}

// Display member tasks
function displayMemberTasks(tasks) {
  const tasksList = document.getElementById('tasksList');
  
  if (tasks.length === 0) {
    tasksList.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-tasks text-6xl text-gray-300 mb-4"></i>
        <p class="text-gray-500 text-lg">No tasks assigned yet</p>
        <p class="text-gray-400">New tasks will appear here when assigned by your admin</p>
      </div>
    `;
    return;
  }
  
  tasksList.innerHTML = tasks.map(task => `
    <div class="glass-card rounded-2xl p-6 hover:shadow-2xl transition-all duration-300">
      <div class="flex items-start justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-800 line-clamp-2">${task.title || 'Untitled Task'}</h3>
        <div class="flex items-center gap-2">
          ${getTaskStatusBadge(task.status)}
          ${getTaskPriorityBadge(task.priority)}
        </div>
      </div>
      
      ${task.description ? `<p class="text-gray-600 mb-4 line-clamp-3">${task.description}</p>` : ''}
      
      <div class="space-y-2 mb-4">
        ${task.deadline ? `
          <div class="flex items-center gap-2 text-sm">
            <i class="fas fa-calendar-alt text-gray-400"></i>
            <span class="${isOverdueTask(task) ? 'text-red-600' : 'text-gray-600'}">
              Due: ${formatDate(task.deadline)}
            </span>
          </div>
        ` : ''}
        
        ${task.projectName ? `
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <i class="fas fa-project-diagram text-gray-400"></i>
            <span>${task.projectName}</span>
          </div>
        ` : ''}
        
        <div class="flex items-center gap-2 text-sm text-gray-600">
          <i class="fas fa-clock text-gray-400"></i>
          <span>Time worked: ${formatTimeDisplay(task.totalTime || 0)}</span>
        </div>
      </div>
      
      <div class="flex items-center justify-between">
        <select class="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 text-sm" 
                onchange="memberUpdateTaskStatus('${task.id}', this.value)">
          <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
        
        <button class="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                onclick="startTaskTimer('${task.id}')">
          <i class="fas fa-play mr-1"></i>
          Start Timer
        </button>
      </div>
    </div>
  `).join('');
}

// Update task status (members can only change status, not delete)
async function memberUpdateTaskStatus(taskId, newStatus) {
  try {
    await db.collection('tasks').doc(taskId).update({
      status: newStatus,
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Refresh task list
    loadMemberTasks();
    loadMemberDashboard(); // Refresh dashboard counts
    
  } catch (error) {
    console.error('Error updating task status:', error);
    alert('Error updating task status. Please try again.');
  }
}

// Start task timer - opens the timer modal for a specific task
async function startTaskTimer(taskId) {
  try {
    // Find the task to get its title
    const task = memberTasks.find(t => t.id === taskId);
    const taskTitle = task ? task.title : 'Unknown Task';
    
    // Call the timer modal function from timer.js
    await openTimerModal(taskId, taskTitle);
  } catch (error) {
    console.error('Error starting task timer:', error);
    alert('Error opening timer. Please try again.');
  }
}

// Load member's projects
async function loadMemberProjects() {
  try {
    // Get unique project IDs from member's tasks
    const projectIds = [...new Set(memberTasks.map(task => task.projectId).filter(Boolean))];
    
    if (projectIds.length === 0) {
      document.getElementById('projectsList').innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-project-diagram text-6xl text-gray-300 mb-4"></i>
          <p class="text-gray-500 text-lg">No projects assigned yet</p>
        </div>
      `;
      return;
    }
    
    // Load project details
    const projects = [];
    for (const projectId of projectIds) {
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (projectDoc.exists) {
        projects.push({ id: projectDoc.id, ...projectDoc.data() });
      }
    }
    
    displayMemberProjects(projects);
    
  } catch (error) {
    console.error('Error loading member projects:', error);
  }
}

// Display member projects
function displayMemberProjects(projects) {
  const projectsList = document.getElementById('projectsList');
  
  projectsList.innerHTML = projects.map(project => {
    const projectTasks = memberTasks.filter(task => task.projectId === project.id);
    const completedTasks = projectTasks.filter(task => isCompletedStatus(task.status));
    const progress = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;
    
    return `
      <div class="glass-card rounded-2xl p-6 hover:shadow-2xl transition-all duration-300">
        <div class="flex items-start justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-800">${project.name || 'Untitled Project'}</h3>
          <span class="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-600 rounded-full">
            ${projectTasks.length} tasks
          </span>
        </div>
        
        ${project.description ? `<p class="text-gray-600 mb-4">${project.description}</p>` : ''}
        
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-gray-600">Your Progress</span>
            <span class="text-gray-800 font-medium">${progress}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        </div>
        
        <div class="flex items-center justify-between text-sm text-gray-600">
          <span>${completedTasks.length} / ${projectTasks.length} completed</span>
          ${project.deadline ? `<span>Due: ${formatDate(project.deadline)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Progress section functionality
async function loadProgressData() {
  // Set default to today
  setDateRange('today');
}

// Date range functions for progress section
function setDateRange(range) {
  const today = new Date();
  let fromDate, toDate;
  
  switch (range) {
    case 'today':
      fromDate = toDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      break;
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      fromDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      toDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      break;
    case 'month':
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
      toDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      break;
  }
  
  document.getElementById('customDateRange').classList.add('hidden');
  loadProgressForDateRange(fromDate, toDate);
}

function toggleCustomRange() {
  document.getElementById('customDateRange').classList.toggle('hidden');
}

function applyCustomRange() {
  const fromDate = new Date(document.getElementById('fromDate').value);
  const toDate = new Date(document.getElementById('toDate').value);
  
  if (fromDate && toDate && fromDate <= toDate) {
    loadProgressForDateRange(fromDate, toDate);
  } else {
    alert('Please select valid date range');
  }
}

// Load progress data for date range using workLogs collection
async function loadProgressForDateRange(fromDate, toDate) {
  try {
    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];
    
    // Query workLogs for the date range
    const workLogsQuery = await db.collection('workLogs')
      .where('userId', '==', auth.currentUser.uid)
      .where('date', '>=', fromDateStr)
      .where('date', '<=', toDateStr)
      .orderBy('date')
      .get();
    
    let totalSeconds = 0;
    let dailyBreakdown = {};
    let uniqueDates = new Set();
    
    workLogsQuery.docs.forEach(doc => {
      const data = doc.data();
      totalSeconds += data.duration;
      uniqueDates.add(data.date);
      
      if (!dailyBreakdown[data.date]) {
        dailyBreakdown[data.date] = 0;
      }
      dailyBreakdown[data.date] += data.duration;
    });
    
    // Query completed tasks in the date range
    const completedTasksQuery = await db.collection('tasks')
      .where('assignedToUid', '==', auth.currentUser.uid)
      .where('status', '==', 'completed')
      .get();
    
    let completedTasksCount = 0;
    completedTasksQuery.docs.forEach(doc => {
      const task = doc.data();
      if (task.timeLogs && task.timeLogs.length > 0) {
        // Check if any time logs fall in our date range
        const hasLogsInRange = task.timeLogs.some(log => {
          const logDate = new Date(log.start).toISOString().split('T')[0];
          return logDate >= fromDateStr && logDate <= toDateStr;
        });
        if (hasLogsInRange) {
          completedTasksCount++;
        }
      }
    });
    
    const workingDays = uniqueDates.size;
    const avgDailySeconds = workingDays > 0 ? totalSeconds / workingDays : 0;
    
    // Update progress display
    document.getElementById('progressTotalTime').textContent = formatTimeDisplay(totalSeconds);
    document.getElementById('progressTasksCompleted').textContent = completedTasksCount.toString();
    document.getElementById('progressWorkingDays').textContent = workingDays.toString();
    document.getElementById('progressAvgDaily').textContent = formatTimeDisplay(Math.round(avgDailySeconds));
    
    // Create daily breakdown chart
    const breakdownHTML = Object.keys(dailyBreakdown).length > 0 ? 
      Object.keys(dailyBreakdown).sort().map(date => {
        const hours = (dailyBreakdown[date] / 3600).toFixed(1);
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `
          <div class="flex justify-between items-center py-2 border-b border-gray-100">
            <span class="text-sm text-gray-600">${formattedDate}</span>
            <span class="text-sm font-medium">${formatTimeDisplay(dailyBreakdown[date])}</span>
          </div>
        `;
      }).join('') :
      `<div class="text-center py-8 text-gray-500">
         <i class="fas fa-chart-line text-4xl mb-2"></i>
         <p>No time logged in this date range.</p>
       </div>`;
    
    document.getElementById('dailyBreakdown').innerHTML = breakdownHTML;
    
  } catch (error) {
    console.error('Error loading progress data:', error);
    document.getElementById('progressTotalTime').textContent = '00:00:00';
    document.getElementById('progressTasksCompleted').textContent = '0';
    document.getElementById('progressWorkingDays').textContent = '0';
    document.getElementById('progressAvgDaily').textContent = '00:00:00';
    
    document.getElementById('dailyBreakdown').innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
        <p>Error loading progress data. Please try again.</p>
      </div>
    `;
  }
}

// Load today's time worked
async function loadTodayTimeWorked() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const workLogsQuery = await db.collection('workLogs')
      .where('userId', '==', auth.currentUser.uid)
      .where('date', '==', today)
      .get();
    
    let totalSeconds = 0;
    workLogsQuery.docs.forEach(doc => {
      totalSeconds += doc.data().duration;
    });
    
    document.getElementById('totalTimeWorked').textContent = formatTimeDisplay(totalSeconds);
  } catch (error) {
    console.error('Error loading today time worked:', error);
    document.getElementById('totalTimeWorked').textContent = '00:00:00';
  }
}

// Utility functions
function getTaskStatusBadge(status) {
  const statusColors = {
    'completed': 'bg-green-100 text-green-600',
    'in-progress': 'bg-blue-100 text-blue-600',
    'pending': 'bg-yellow-100 text-yellow-600',
    'overdue': 'bg-red-100 text-red-600'
  };
  
  const normalizedStatus = normalizeStatus(status);
  const color = statusColors[normalizedStatus] || 'bg-gray-100 text-gray-600';
  
  return `<span class="text-xs font-medium px-2 py-1 ${color} rounded-full">${status || 'No Status'}</span>`;
}

function getTaskPriorityBadge(priority) {
  if (!priority) return '';
  
  const priorityColors = {
    'critical': 'bg-red-500 text-white',
    'high': 'bg-orange-500 text-white',
    'medium': 'bg-yellow-500 text-white',
    'low': 'bg-green-500 text-white'
  };
  
  const color = priorityColors[priority.toLowerCase()] || 'bg-gray-500 text-white';
  
  return `<span class="text-xs font-medium px-2 py-1 ${color} rounded-full">${priority}</span>`;
}

function isOverdueTask(task) {
  if (!task.deadline) return false;
  
  const now = new Date();
  const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
  
  return deadline < now && !isCompletedStatus(task.status);
}

function formatDate(date) {
  if (!date) return 'No date';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatTimeDisplay(seconds) {
  if (!seconds || seconds === 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Status normalization helpers (shared with dashboard.js)
function normalizeStatus(status) {
  return (status || '').toString().trim().toLowerCase();
}

function isCompletedStatus(status) {
  const normalized = normalizeStatus(status);
  return ['completed', 'done', 'closed', 'finished'].includes(normalized);
}

function isPendingStatus(status) {
  const normalized = normalizeStatus(status);
  return ['pending', 'todo', 'in_progress', 'in-progress', 'open', 'not started', 'new', 'active'].includes(normalized);
}