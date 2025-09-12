let currentUser = null;
let currentUserRole = null;
let allTasks = [];
let filteredTasks = [];
let selectedTaskIds = new Set();

function onAuthStateChanged(callback) {
  auth.onAuthStateChanged(callback);
}

onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  
  currentUser = user;
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userInfo = userDoc.data();
  currentUserRole = userInfo.role;
  
  document.getElementById('welcome').innerText = `Welcome, ${userInfo.role}: ${userInfo.email}`;
  document.getElementById('logoutBtn').onclick = () => auth.signOut();
  
  // Update sidebar user info
  document.getElementById('sidebarUserEmail').textContent = userInfo.email;
  document.getElementById('sidebarUserRole').textContent = userInfo.role;
  
  // Show/hide admin navigation based on role
  const navAdmin = document.getElementById('navAdmin');
  if (userInfo.role === 'admin') {
    navAdmin.classList.remove('hidden');
  } else {
    navAdmin.classList.add('hidden');
  }
  
  // Initialize navigation
  initializeNavigation();
  
  // Load dashboard counts
  loadDashboardCounts();
  
  // Initialize admin functionality if user is admin
  if (userInfo.role === 'admin') {
    initializeAdminModule();
  }
});

async function loadDashboardCounts() {
  const projectsSnap = await db.collection('projects').get();
  document.getElementById('projectCount').textContent = projectsSnap.size;
  const tasksSnap = await db.collection('tasks').get();
  document.getElementById('taskCount').textContent = tasksSnap.size;

  let totalTime = 0;
  let usersSet = new Set();
  tasksSnap.forEach(doc => {
    const t = doc.data();
    if (t.totalTime) totalTime += t.totalTime;
    if (t.assignedTo) usersSet.add(t.assignedTo);
  });
  document.getElementById('timeSpent').textContent = formatTimeDisplay(totalTime);
  document.getElementById('activeUsers').textContent = usersSet.size;
}

function formatTimeDisplay(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Status normalization helpers
function normalizeStatus(status) {
  return (status || '').toString().trim().toLowerCase();
}

function isCompletedStatus(status) {
  const normalized = normalizeStatus(status);
  return ['completed', 'done', 'closed', 'finished'].includes(normalized);
}

function isPendingStatus(status) {
  const normalized = normalizeStatus(status);
  return ['pending', 'todo', 'in_progress', 'in-progress', 'open', 'not started', 'new', 'active'].includes(normalized) || 
         (!isCompletedStatus(status) && normalized !== 'cancelled' && normalized !== 'canceled');
}

// Navigation System
function initializeNavigation() {
  // Navigation handlers
  document.getElementById('navDashboard').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('dashboard');
    setActiveNav('navDashboard');
  });

  document.getElementById('navProjects').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('projects');
    setActiveNav('navProjects');
  });

  document.getElementById('navTasks').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('tasks');
    setActiveNav('navTasks');
  });

  document.getElementById('navAnalytics').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('analytics');
    setActiveNav('navAnalytics');
  });

  // Admin navigation (only for admin users)
  const navAdmin = document.getElementById('navAdmin');
  if (navAdmin && !navAdmin.classList.contains('hidden')) {
    navAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentUserRole === 'admin') {
        showSection('admin');
        setActiveNav('navAdmin');
      }
    });
  }
}

function showSection(sectionName) {
  // Hide all sections
  const sections = ['dashboardSection', 'projectsSection', 'tasksSection', 'analyticsSection', 'adminSection'];
  sections.forEach(section => {
    const element = document.getElementById(section);
    if (element) {
      element.style.display = 'none';
    }
  });

  // Show requested section
  const targetSection = document.getElementById(sectionName + 'Section');
  if (targetSection) {
    targetSection.style.display = 'block';
  }

  // Load section-specific data
  switch(sectionName) {
    case 'projects':
      loadProjects();
      break;
    case 'tasks':
      loadTasks();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'admin':
      if (currentUserRole === 'admin') {
        loadAdminData();
      }
      break;
    case 'dashboard':
    default:
      loadDashboardCounts();
      break;
  }
}

function setActiveNav(activeId) {
  // Remove active class from all nav items
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('sidebar-active'));
  
  // Add active class to selected nav item
  const activeNav = document.getElementById(activeId);
  if (activeNav) {
    activeNav.classList.add('sidebar-active');
  }
}

// Admin Module Functionality
function initializeAdminModule() {
  if (currentUserRole !== 'admin') return;

  // Initialize filters
  initializeAdminFilters();
  
  // Initialize bulk operations
  initializeBulkOperations();
  
  // Initialize export functionality
  initializeExportFunctionality();
  
  // Initialize table sorting
  initializeTableSorting();
  
  // Load admin data
  loadAdminData();
}

function initializeAdminFilters() {
  // Search input
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(applyFilters, 300));
  }

  // Filter dropdowns
  const filters = ['adminPersonFilter', 'adminStatusFilter', 'adminPriorityFilter', 'adminDateFilter'];
  filters.forEach(filterId => {
    const filter = document.getElementById(filterId);
    if (filter) {
      filter.addEventListener('change', applyFilters);
    }
  });

  // Date filter custom range toggle
  const dateFilter = document.getElementById('adminDateFilter');
  const customDateRange = document.getElementById('customDateRange');
  if (dateFilter && customDateRange) {
    dateFilter.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        customDateRange.classList.remove('hidden');
      } else {
        customDateRange.classList.add('hidden');
      }
      applyFilters();
    });
  }

  // Custom date inputs
  const fromDate = document.getElementById('adminFromDate');
  const toDate = document.getElementById('adminToDate');
  if (fromDate) fromDate.addEventListener('change', applyFilters);
  if (toDate) toDate.addEventListener('change', applyFilters);

  // Filter action buttons
  const applyBtn = document.getElementById('applyFilters');
  const clearBtn = document.getElementById('clearFilters');
  
  if (applyBtn) applyBtn.addEventListener('click', applyFilters);
  if (clearBtn) clearBtn.addEventListener('click', clearAllFilters);
}

function initializeBulkOperations() {
  // Select all checkbox
  const selectAllCheckbox = document.getElementById('selectAll');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const taskCheckboxes = document.querySelectorAll('.task-checkbox');
      
      taskCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const taskId = checkbox.dataset.taskId;
        if (isChecked) {
          selectedTaskIds.add(taskId);
        } else {
          selectedTaskIds.delete(taskId);
        }
      });
      
      updateBulkActionsPanel();
    });
  }

  // Bulk status change
  const bulkStatusChange = document.getElementById('bulkStatusChange');
  if (bulkStatusChange) {
    bulkStatusChange.addEventListener('change', async (e) => {
      if (e.target.value && selectedTaskIds.size > 0) {
        if (confirm(`Change status to "${e.target.value}" for ${selectedTaskIds.size} selected tasks?`)) {
          await applyBulkStatusChange(e.target.value);
        }
        e.target.value = ''; // Reset dropdown
      }
    });
  }

  // Export selected
  const exportSelected = document.getElementById('exportSelected');
  if (exportSelected) {
    exportSelected.addEventListener('click', () => {
      if (selectedTaskIds.size > 0) {
        exportTasks(Array.from(selectedTaskIds));
      } else {
        alert('Please select tasks to export.');
      }
    });
  }

  // Delete selected
  const deleteSelected = document.getElementById('deleteSelected');
  if (deleteSelected) {
    deleteSelected.addEventListener('click', async () => {
      if (selectedTaskIds.size > 0) {
        if (confirm(`Are you sure you want to delete ${selectedTaskIds.size} selected tasks? This action cannot be undone.`)) {
          await deleteBulkTasks();
        }
      } else {
        alert('Please select tasks to delete.');
      }
    });
  }
}

function initializeExportFunctionality() {
  // Export all button
  const exportAll = document.getElementById('exportAll');
  if (exportAll) {
    exportAll.addEventListener('click', () => {
      exportTasks(); // Export all filtered tasks
    });
  }

  // Refresh tasks button
  const refreshTasks = document.getElementById('refreshTasks');
  if (refreshTasks) {
    refreshTasks.addEventListener('click', () => {
      loadAdminData();
    });
  }
}

function initializeTableSorting() {
  const sortHeaders = document.querySelectorAll('[data-sort]');
  sortHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const sortField = header.dataset.sort;
      sortTasks(sortField);
    });
  });
}

// Data Loading Functions
async function loadAdminData() {
  if (currentUserRole !== 'admin') {
    console.error('Access denied: Admin role required');
    return;
  }

  try {
    const loadingIndicator = document.getElementById('resultsCount');
    if (loadingIndicator) {
      loadingIndicator.textContent = 'Loading tasks...';
    }

    // Load all tasks from Firebase
    const tasksSnapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
    allTasks = [];

    for (const doc of tasksSnapshot.docs) {
      const taskData = doc.data();
      allTasks.push({
        id: doc.id,
        ...taskData,
        createdAt: taskData.createdAt?.toDate() || new Date(),
        deadline: taskData.deadline?.toDate() || null,
        totalTime: taskData.totalTime || 0
      });
    }

    // Populate filter dropdowns
    await populateFilterDropdowns();

    // Apply initial filters
    applyFilters();

  } catch (error) {
    console.error('Error loading admin data:', error);
    const loadingIndicator = document.getElementById('resultsCount');
    if (loadingIndicator) {
      loadingIndicator.textContent = 'Error loading tasks';
    }
  }
}

async function populateFilterDropdowns() {
  // Populate person filter
  const personFilter = document.getElementById('adminPersonFilter');
  if (personFilter) {
    const users = new Set();
    allTasks.forEach(task => {
      if (task.assignedTo) users.add(task.assignedTo);
    });

    // Clear existing options except "All Members"
    personFilter.innerHTML = '<option value="">All Members</option>';
    Array.from(users).sort().forEach(user => {
      const option = document.createElement('option');
      option.value = user;
      option.textContent = user;
      personFilter.appendChild(option);
    });
  }
}

// Filtering Functions
function applyFilters() {
  const searchTerm = document.getElementById('adminSearchInput')?.value.toLowerCase() || '';
  const personFilter = document.getElementById('adminPersonFilter')?.value || '';
  const statusFilter = document.getElementById('adminStatusFilter')?.value || '';
  const priorityFilter = document.getElementById('adminPriorityFilter')?.value || '';
  const dateFilter = document.getElementById('adminDateFilter')?.value || '';

  filteredTasks = allTasks.filter(task => {
    // Search filter
    const matchesSearch = !searchTerm || 
      task.title?.toLowerCase().includes(searchTerm) ||
      task.description?.toLowerCase().includes(searchTerm) ||
      task.assignedTo?.toLowerCase().includes(searchTerm);

    // Person filter
    const matchesPerson = !personFilter || task.assignedTo === personFilter;

    // Status filter
    const matchesStatus = !statusFilter || task.status === statusFilter;

    // Priority filter
    const matchesPriority = !priorityFilter || task.priority === priorityFilter;

    // Date filter
    const matchesDate = applyDateFilter(task, dateFilter);

    return matchesSearch && matchesPerson && matchesStatus && matchesPriority && matchesDate;
  });

  renderAdminTaskTable();
  updateResultsCount();
  updateAdminStats();
}

function applyDateFilter(task, dateFilter) {
  if (!dateFilter) return true;

  const taskDate = task.createdAt;
  const now = new Date();
  
  switch (dateFilter) {
    case 'today':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return taskDate >= today && taskDate < tomorrow;
    
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return taskDate >= weekAgo;
    
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return taskDate >= monthAgo;
    
    case 'custom':
      const fromDate = document.getElementById('adminFromDate')?.value;
      const toDate = document.getElementById('adminToDate')?.value;
      
      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999); // Include full end date
        return taskDate >= from && taskDate <= to;
      }
      return true;
    
    default:
      return true;
  }
}

function clearAllFilters() {
  // Clear all filter inputs
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) searchInput.value = '';

  const filters = ['adminPersonFilter', 'adminStatusFilter', 'adminPriorityFilter', 'adminDateFilter'];
  filters.forEach(filterId => {
    const filter = document.getElementById(filterId);
    if (filter) filter.value = '';
  });

  // Clear custom date range
  const customDateRange = document.getElementById('customDateRange');
  if (customDateRange) customDateRange.classList.add('hidden');

  const fromDate = document.getElementById('adminFromDate');
  const toDate = document.getElementById('adminToDate');
  if (fromDate) fromDate.value = '';
  if (toDate) toDate.value = '';

  // Clear selections
  selectedTaskIds.clear();
  const selectAll = document.getElementById('selectAll');
  if (selectAll) selectAll.checked = false;

  // Apply empty filters
  applyFilters();
  updateBulkActionsPanel();
}

// Table Rendering Functions
function renderAdminTaskTable() {
  const tableBody = document.querySelector('#adminTaskTable tbody');
  if (!tableBody) {
    // Create table body if it doesn't exist
    const table = document.getElementById('adminTaskTable');
    if (table) {
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      renderAdminTaskTable();
      return;
    }
    console.error('Admin task table not found');
    return;
  }

  tableBody.innerHTML = '';

  if (filteredTasks.length === 0) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 9;
    cell.className = 'px-4 py-8 text-center text-gray-500';
    cell.textContent = 'No tasks found matching the current filters.';
    return;
  }

  filteredTasks.forEach(task => {
    const row = tableBody.insertRow();
    row.className = 'border-b border-gray-100 hover:bg-gray-50';

    // Checkbox
    const checkboxCell = row.insertCell();
    checkboxCell.innerHTML = `
      <input type="checkbox" class="task-checkbox rounded" data-task-id="${task.id}" ${selectedTaskIds.has(task.id) ? 'checked' : ''}>
    `;

    // Task Title
    const titleCell = row.insertCell();
    titleCell.className = 'px-4 py-3';
    titleCell.innerHTML = `
      <div class="font-medium text-gray-900">${escapeHtml(task.title || 'Untitled Task')}</div>
      <div class="text-sm text-gray-500">${escapeHtml((task.description || '').substring(0, 50))}${task.description && task.description.length > 50 ? '...' : ''}</div>
    `;

    // Assigned To
    const assignedCell = row.insertCell();
    assignedCell.className = 'px-4 py-3';
    assignedCell.innerHTML = `
      <div class="flex items-center">
        <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-2">
          <span class="text-sm font-medium text-indigo-800">${(task.assignedTo || 'U')[0].toUpperCase()}</span>
        </div>
        <span class="text-sm text-gray-900">${escapeHtml(task.assignedTo || 'Unassigned')}</span>
      </div>
    `;

    // Status
    const statusCell = row.insertCell();
    statusCell.className = 'px-4 py-3';
    statusCell.innerHTML = getStatusBadge(task.status);

    // Priority
    const priorityCell = row.insertCell();
    priorityCell.className = 'px-4 py-3';
    priorityCell.innerHTML = getPriorityBadge(task.priority);

    // Created Date
    const createdCell = row.insertCell();
    createdCell.className = 'px-4 py-3 text-sm text-gray-900';
    createdCell.textContent = formatDate(task.createdAt);

    // Due Date
    const deadlineCell = row.insertCell();
    deadlineCell.className = 'px-4 py-3 text-sm text-gray-900';
    deadlineCell.textContent = task.deadline ? formatDate(task.deadline) : 'No deadline';

    // Time Spent
    const timeCell = row.insertCell();
    timeCell.className = 'px-4 py-3 text-sm text-gray-900';
    timeCell.textContent = formatTimeDisplay(task.totalTime);

    // Actions
    const actionsCell = row.insertCell();
    actionsCell.className = 'px-4 py-3';
    actionsCell.innerHTML = `
      <div class="flex items-center gap-2">
        <button class="text-indigo-600 hover:text-indigo-900 text-sm" onclick="editTask('${task.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="text-red-600 hover:text-red-900 text-sm" onclick="deleteTask('${task.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });

  // Add event listeners to checkboxes
  const checkboxes = tableBody.querySelectorAll('.task-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const taskId = e.target.dataset.taskId;
      if (e.target.checked) {
        selectedTaskIds.add(taskId);
      } else {
        selectedTaskIds.delete(taskId);
      }
      updateBulkActionsPanel();
    });
  });
}

// Bulk Operations Functions
async function applyBulkStatusChange(newStatus) {
  try {
    const promises = Array.from(selectedTaskIds).map(taskId =>
      db.collection('tasks').doc(taskId).update({ status: newStatus })
    );

    await Promise.all(promises);
    
    // Update local data
    allTasks.forEach(task => {
      if (selectedTaskIds.has(task.id)) {
        task.status = newStatus;
      }
    });

    selectedTaskIds.clear();
    applyFilters();
    updateBulkActionsPanel();
    
    alert(`Successfully updated ${promises.length} tasks to ${newStatus} status.`);
  } catch (error) {
    console.error('Error updating task statuses:', error);
    alert('Error updating task statuses. Please try again.');
  }
}

async function deleteBulkTasks() {
  try {
    const promises = Array.from(selectedTaskIds).map(taskId =>
      db.collection('tasks').doc(taskId).delete()
    );

    await Promise.all(promises);
    
    // Remove from local data
    allTasks = allTasks.filter(task => !selectedTaskIds.has(task.id));

    selectedTaskIds.clear();
    applyFilters();
    updateBulkActionsPanel();
    
    alert(`Successfully deleted ${promises.length} tasks.`);
  } catch (error) {
    console.error('Error deleting tasks:', error);
    alert('Error deleting tasks. Please try again.');
  }
}

function updateBulkActionsPanel() {
  const bulkPanel = document.getElementById('bulkActionsPanel');
  const selectedCountEl = document.getElementById('selectedCount');

  if (!bulkPanel || !selectedCountEl) return;

  if (selectedTaskIds.size > 0) {
    bulkPanel.classList.remove('hidden');
    selectedCountEl.textContent = `${selectedTaskIds.size} tasks selected`;
  } else {
    bulkPanel.classList.add('hidden');
  }

  // Update select all checkbox
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.indeterminate = selectedTaskIds.size > 0 && selectedTaskIds.size < filteredTasks.length;
    selectAll.checked = selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0;
  }
}

function updateResultsCount() {
  const resultsCount = document.getElementById('resultsCount');
  if (resultsCount) {
    resultsCount.textContent = `Showing ${filteredTasks.length} of ${allTasks.length} tasks`;
  }
}

function updateAdminStats() {
  // Calculate statistics from allTasks
  let completedCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let totalTimeSpent = 0;
  
  const currentDate = new Date();
  
  allTasks.forEach(task => {
    // Count by status using normalized checking
    if (isCompletedStatus(task.status)) {
      completedCount++;
    } else if (isPendingStatus(task.status)) {
      pendingCount++;
    }
    
    // Count overdue tasks (not completed and past deadline)
    if (task.deadline && !isCompletedStatus(task.status)) {
      const deadline = task.deadline < currentDate ? task.deadline : new Date(task.deadline);
      if (deadline < currentDate) {
        overdueCount++;
      }
    }
    
    // Sum total time
    if (task.totalTime) {
      totalTimeSpent += task.totalTime;
    }
  });
  
  // Update admin stat elements
  const adminTotalTasks = document.getElementById('adminTotalTasks');
  const adminCompletedTasks = document.getElementById('adminCompletedTasks');
  const adminPendingTasks = document.getElementById('adminPendingTasks');
  const adminOverdueTasks = document.getElementById('adminOverdueTasks');
  const adminTotalTime = document.getElementById('adminTotalTime');
  
  if (adminTotalTasks) adminTotalTasks.textContent = allTasks.length.toString();
  if (adminCompletedTasks) adminCompletedTasks.textContent = completedCount.toString();
  if (adminPendingTasks) adminPendingTasks.textContent = pendingCount.toString();
  if (adminOverdueTasks) adminOverdueTasks.textContent = overdueCount.toString();
  if (adminTotalTime) adminTotalTime.textContent = formatTimeDisplay(totalTimeSpent);
}

// Export Functions
function exportTasks(taskIds = null) {
  const tasksToExport = taskIds ? 
    allTasks.filter(task => taskIds.includes(task.id)) : 
    filteredTasks;

  if (tasksToExport.length === 0) {
    alert('No tasks to export.');
    return;
  }

  const headers = [
    'Task Title', 'Description', 'Assigned To', 'Status', 'Priority',
    'Created Date', 'Due Date', 'Time Spent (Hours)', 'Project'
  ];

  const csvData = [headers];

  tasksToExport.forEach(task => {
    csvData.push([
      escapeCSV(task.title || ''),
      escapeCSV(task.description || ''),
      escapeCSV(task.assignedTo || ''),
      escapeCSV(task.status || ''),
      escapeCSV(task.priority || ''),
      formatDate(task.createdAt),
      task.deadline ? formatDate(task.deadline) : '',
      (task.totalTime / 3600).toFixed(2), // Convert seconds to hours
      escapeCSV(task.project || '')
    ]);
  });

  const csvContent = csvData.map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tasks-export-${formatDateForFilename(new Date())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Table Sorting Functions
let currentSort = { field: null, direction: 'asc' };

function sortTasks(field) {
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.field = field;
    currentSort.direction = 'asc';
  }

  filteredTasks.sort((a, b) => {
    let aValue = a[field];
    let bValue = b[field];

    // Handle different data types
    if (field === 'createdAt' || field === 'deadline') {
      aValue = aValue ? new Date(aValue) : new Date(0);
      bValue = bValue ? new Date(bValue) : new Date(0);
    } else if (field === 'totalTime') {
      aValue = aValue || 0;
      bValue = bValue || 0;
    } else {
      aValue = (aValue || '').toString().toLowerCase();
      bValue = (bValue || '').toString().toLowerCase();
    }

    let comparison = 0;
    if (aValue > bValue) comparison = 1;
    if (aValue < bValue) comparison = -1;

    return currentSort.direction === 'desc' ? comparison * -1 : comparison;
  });

  renderAdminTaskTable();
  updateSortIcons();
}

function updateSortIcons() {
  // Reset all sort icons
  const sortHeaders = document.querySelectorAll('[data-sort] i');
  sortHeaders.forEach(icon => {
    icon.className = 'fas fa-sort ml-1 text-gray-400';
  });

  // Update active sort icon
  if (currentSort.field) {
    const activeHeader = document.querySelector(`[data-sort="${currentSort.field}"] i`);
    if (activeHeader) {
      activeHeader.className = `fas fa-sort-${currentSort.direction === 'asc' ? 'up' : 'down'} ml-1 text-gray-600`;
    }
  }
}

// Individual Task Actions
async function editTask(taskId) {
  // For now, just show an alert. In a real implementation, you'd open a modal or navigate to an edit page
  const task = allTasks.find(t => t.id === taskId);
  if (task) {
    const newTitle = prompt('Edit task title:', task.title || '');
    if (newTitle !== null && newTitle.trim() !== '') {
      try {
        await db.collection('tasks').doc(taskId).update({ title: newTitle.trim() });
        task.title = newTitle.trim();
        applyFilters();
        alert('Task updated successfully!');
      } catch (error) {
        console.error('Error updating task:', error);
        alert('Error updating task. Please try again.');
      }
    }
  }
}

async function deleteTask(taskId) {
  if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
    try {
      await db.collection('tasks').doc(taskId).delete();
      allTasks = allTasks.filter(task => task.id !== taskId);
      selectedTaskIds.delete(taskId);
      applyFilters();
      updateBulkActionsPanel();
      alert('Task deleted successfully!');
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task. Please try again.');
    }
  }
}

// Utility Functions
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeCSV(text) {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateForFilename(date) {
  return date.toISOString().slice(0, 10);
}

function getStatusBadge(status) {
  const statusConfig = {
    'active': { class: 'bg-green-100 text-green-800', icon: 'fa-play' },
    'in-progress': { class: 'bg-blue-100 text-blue-800', icon: 'fa-spinner' },
    'completed': { class: 'bg-gray-100 text-gray-800', icon: 'fa-check' },
    'pending': { class: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock' }
  };

  const config = statusConfig[status] || statusConfig['pending'];
  return `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}">
      <i class="fas ${config.icon} mr-1"></i>
      ${status || 'pending'}
    </span>
  `;
}

function getPriorityBadge(priority) {
  const priorityConfig = {
    'critical': { class: 'bg-red-100 text-red-800', icon: 'fa-exclamation-triangle' },
    'high': { class: 'bg-orange-100 text-orange-800', icon: 'fa-arrow-up' },
    'medium': { class: 'bg-yellow-100 text-yellow-800', icon: 'fa-minus' },
    'low': { class: 'bg-green-100 text-green-800', icon: 'fa-arrow-down' }
  };

  const config = priorityConfig[priority] || priorityConfig['medium'];
  return `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}">
      <i class="fas ${config.icon} mr-1"></i>
      ${priority || 'medium'}
    </span>
  `;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Basic Section Loading Functions (placeholder implementations)
async function loadProjects() {
  try {
    const projectsSnapshot = await db.collection('projects').get();
    const projectsList = document.getElementById('projectsList');
    if (projectsList) {
      projectsList.innerHTML = '<p class="text-gray-500">Projects section coming soon...</p>';
    }
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

async function loadTasks() {
  try {
    const tasksSnapshot = await db.collection('tasks').get();
    const tasksList = document.getElementById('tasksList');
    if (tasksList) {
      tasksList.innerHTML = '<p class="text-gray-500">Tasks section coming soon...</p>';
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

async function loadAnalytics() {
  try {
    // Load analytics data
    const analyticsElements = {
      'completedTasks': document.getElementById('completedTasks'),
      'overdueTasks': document.getElementById('overdueTasks'),
      'pendingTasks': document.getElementById('pendingTasks'),
      'avgTaskTime': document.getElementById('avgTaskTime'),
      'productivityScore': document.getElementById('productivityScore'),
      'activeProjectsCount': document.getElementById('activeProjectsCount'),
      'completedProjectsCount': document.getElementById('completedProjectsCount')
    };

    // Load tasks data and calculate analytics
    const tasksSnapshot = await db.collection('tasks').get();
    const projectsSnapshot = await db.collection('projects').get();
    
    let completedTasksCount = 0;
    let pendingTasksCount = 0;
    let overdueTasksCount = 0;
    let totalTime = 0;
    let taskCount = 0;
    let activeProjectsCount = 0;
    let completedProjectsCount = 0;
    
    // Calculate task statistics
    const currentDate = new Date();
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      taskCount++;
      
      if (task.totalTime) totalTime += task.totalTime;
      
      // Use normalized status checking
      if (isCompletedStatus(task.status)) {
        completedTasksCount++;
      } else if (isPendingStatus(task.status)) {
        pendingTasksCount++;
      }
      
      // Check if task is overdue (not completed and past deadline)
      if (task.deadline && !isCompletedStatus(task.status)) {
        const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
        if (deadline < currentDate) {
          overdueTasksCount++;
        }
      }
    });
    
    // Calculate project statistics
    projectsSnapshot.forEach(doc => {
      const project = doc.data();
      const normalized = normalizeStatus(project.status);
      if (normalized === 'active') {
        activeProjectsCount++;
      } else if (isCompletedStatus(project.status)) {
        completedProjectsCount++;
      }
    });
    
    // Calculate average task time
    const avgTaskTimeSeconds = taskCount > 0 ? Math.floor(totalTime / taskCount) : 0;
    const productivityScore = taskCount > 0 ? Math.round((completedTasksCount / taskCount) * 100) : 0;
    
    // Update analytics elements
    if (analyticsElements.completedTasks) analyticsElements.completedTasks.textContent = completedTasksCount.toString();
    if (analyticsElements.pendingTasks) analyticsElements.pendingTasks.textContent = pendingTasksCount.toString();
    if (analyticsElements.overdueTasks) analyticsElements.overdueTasks.textContent = overdueTasksCount.toString();
    if (analyticsElements.avgTaskTime) analyticsElements.avgTaskTime.textContent = formatTimeDisplay(avgTaskTimeSeconds);
    if (analyticsElements.productivityScore) analyticsElements.productivityScore.textContent = productivityScore + '%';
    if (analyticsElements.activeProjectsCount) analyticsElements.activeProjectsCount.textContent = activeProjectsCount.toString();
    if (analyticsElements.completedProjectsCount) analyticsElements.completedProjectsCount.textContent = completedProjectsCount.toString();

    // Team performance and recent activity
    const teamPerformance = document.getElementById('teamPerformance');
    const recentActivity = document.getElementById('recentActivity');
    
    if (teamPerformance) {
      teamPerformance.innerHTML = '<p class="text-gray-500">Team performance data will be displayed here...</p>';
    }
    
    if (recentActivity) {
      recentActivity.innerHTML = '<p class="text-gray-500">Recent activity will be displayed here...</p>';
    }

  } catch (error) {
    console.error('Error loading analytics:', error);
    // Set safe defaults on error
    if (analyticsElements.completedTasks) analyticsElements.completedTasks.textContent = '0';
    if (analyticsElements.pendingTasks) analyticsElements.pendingTasks.textContent = '0';
    if (analyticsElements.overdueTasks) analyticsElements.overdueTasks.textContent = '0';
    if (analyticsElements.avgTaskTime) analyticsElements.avgTaskTime.textContent = '00:00:00';
    if (analyticsElements.productivityScore) analyticsElements.productivityScore.textContent = '0%';
    if (analyticsElements.activeProjectsCount) analyticsElements.activeProjectsCount.textContent = '0';
    if (analyticsElements.completedProjectsCount) analyticsElements.completedProjectsCount.textContent = '0';
  }
}