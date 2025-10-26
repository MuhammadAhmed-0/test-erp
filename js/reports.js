console.log("[reports-debug] reports.js loaded");
var allReports = [];
var filteredReports = [];
var resourceCount = 0;
var currentReportId = null;
var allTeamMembers = [];
var dailyReportsInitialized = false;

function initializeDailyReports() {
  console.log("[reports] initializeDailyReports called", window.currentUser);

  setTodayDate();
  loadTodaysReport();
  
  if (currentUserRole === 'admin') {
    document.getElementById('adminReportTabs').classList.remove('hidden');
    loadAllTeamMembers();
  }
  
  if (!dailyReportsInitialized) {
    setupEventListeners();
    dailyReportsInitialized = true;
  }
}

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('reportDate').value = today;
}

function setupEventListeners() {
  document.getElementById('addResourceBtn').addEventListener('click', addResourceField);
  document.getElementById('dailyReportForm').addEventListener('submit', submitDailyReport);
  document.getElementById('clearReportBtn').addEventListener('click', clearReportForm);
  
  if (currentUserRole === 'admin') {
    document.getElementById('tabSubmitReport').addEventListener('click', () => switchTab('submit'));
    document.getElementById('tabViewReports').addEventListener('click', () => switchTab('view'));
    
    document.getElementById('reportSearchInput').addEventListener('input', applyReportFilters);
    document.getElementById('reportPersonFilter').addEventListener('change', applyReportFilters);
    document.getElementById('reportDateFilter').addEventListener('change', handleDateFilterChange);
    document.getElementById('reportFromDate').addEventListener('change', applyReportFilters);
    document.getElementById('reportToDate').addEventListener('change', applyReportFilters);
    document.getElementById('applyReportFilters').addEventListener('click', applyReportFilters);
    document.getElementById('clearReportFilters').addEventListener('click', clearReportFilters);
    document.getElementById('exportReports').addEventListener('click', exportReportsToCSV);
  }
}

function addResourceField() {
  resourceCount++;
  const resourcesList = document.getElementById('resourcesList');
  
  const resourceDiv = document.createElement('div');
  resourceDiv.className = 'flex gap-2';
  resourceDiv.id = `resource-${resourceCount}`;
  resourceDiv.innerHTML = `
    <input type="text" placeholder="Resource title (e.g., Design File)" 
      class="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-300"
      data-resource-title="${resourceCount}">
    <input type="url" placeholder="https://example.com/file" 
      class="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-300"
      data-resource-url="${resourceCount}">
    <button type="button" onclick="removeResource(${resourceCount})"
      class="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all">
      <i class="fas fa-trash"></i>
    </button>
  `;
  
  resourcesList.appendChild(resourceDiv);
}

function removeResource(id) {
  const resourceDiv = document.getElementById(`resource-${id}`);
  if (resourceDiv) {
    resourceDiv.remove();
  }
}

function getResourcesData() {
  const resources = [];
  const resourcesList = document.getElementById('resourcesList');
  const resourceDivs = resourcesList.querySelectorAll('[id^="resource-"]');
  
  resourceDivs.forEach(div => {
    const titleInput = div.querySelector('[data-resource-title]');
    const urlInput = div.querySelector('[data-resource-url]');
    
    if (titleInput && urlInput && titleInput.value && urlInput.value) {
      resources.push({
        title: titleInput.value.trim(),
        url: urlInput.value.trim()
      });
    }
  });
  
  return resources;
}

async function submitDailyReport(e) {
  e.preventDefault();
  
  const reportData = {
    userId: currentUser.uid,
    userEmail: currentUser.email,
    date: document.getElementById('reportDate').value,
    tasksCompleted: document.getElementById('tasksCompleted').value.trim(),
    blockers: document.getElementById('blockers').value.trim(),
    tomorrowPlan: document.getElementById('tomorrowPlan').value.trim(),
    hoursWorked: parseFloat(document.getElementById('hoursWorked').value) || 0,
    additionalNotes: document.getElementById('additionalNotes').value.trim(),
    resources: getResourcesData(),
    submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    if (currentReportId) {
      await db.collection('dailyReports').doc(currentReportId).update({
        ...reportData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('Report updated successfully!');
    } else {
      await db.collection('dailyReports').add(reportData);
      alert('Report submitted successfully!');
    }
    
    loadTodaysReport();
  } catch (error) {
    console.error('Error submitting report:', error);
    alert('Error submitting report. Please try again.');
  }
}

async function loadTodaysReport() {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const snapshot = await db.collection('dailyReports')
      .where('userId', '==', currentUser.uid)
      .where('date', '==', today)
      .get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const report = doc.data();
      currentReportId = doc.id;
      
      document.getElementById('tasksCompleted').value = report.tasksCompleted || '';
      document.getElementById('blockers').value = report.blockers || '';
      document.getElementById('tomorrowPlan').value = report.tomorrowPlan || '';
      document.getElementById('hoursWorked').value = report.hoursWorked || '';
      document.getElementById('additionalNotes').value = report.additionalNotes || '';
      
      document.getElementById('resourcesList').innerHTML = '';
      resourceCount = 0;
      if (report.resources && report.resources.length > 0) {
        report.resources.forEach(resource => {
          addResourceField();
          const lastResource = document.getElementById(`resource-${resourceCount}`);
          lastResource.querySelector('[data-resource-title]').value = resource.title;
          lastResource.querySelector('[data-resource-url]').value = resource.url;
        });
      }
      
      document.getElementById('alreadySubmittedNotice').classList.remove('hidden');
      document.getElementById('submitReportBtn').innerHTML = '<i class="fas fa-edit"></i><span>Update Report</span>';
    } else {
      currentReportId = null;
      document.getElementById('alreadySubmittedNotice').classList.add('hidden');
      document.getElementById('submitReportBtn').innerHTML = '<i class="fas fa-paper-plane"></i><span>Submit Report</span>';
    }
  } catch (error) {
    console.error('Error loading today\'s report:', error);
  }
}

function clearReportForm() {
  if (confirm('Are you sure you want to clear the form?')) {
    document.getElementById('dailyReportForm').reset();
    document.getElementById('resourcesList').innerHTML = '';
    resourceCount = 0;
    setTodayDate();
  }
}

function switchTab(tab) {
  const submitBtn = document.getElementById('tabSubmitReport');
  const viewBtn = document.getElementById('tabViewReports');
  const submitSection = document.getElementById('reportSubmitSection');
  const viewSection = document.getElementById('reportViewSection');
  
  if (tab === 'submit') {
    submitBtn.classList.add('text-teal-600', 'border-b-2', 'border-teal-600');
    submitBtn.classList.remove('text-gray-600');
    viewBtn.classList.remove('text-teal-600', 'border-b-2', 'border-teal-600');
    viewBtn.classList.add('text-gray-600');
    
    submitSection.style.display = 'block';
    viewSection.style.display = 'none';
  } else {
    viewBtn.classList.add('text-teal-600', 'border-b-2', 'border-teal-600');
    viewBtn.classList.remove('text-gray-600');
    submitBtn.classList.remove('text-teal-600', 'border-b-2', 'border-teal-600');
    submitBtn.classList.add('text-gray-600');
    
    submitSection.style.display = 'none';
    viewSection.style.display = 'block';
    
    loadAllReportsLive();
  }
}

async function loadAllTeamMembers() {
  try {
    const snapshot = await db.collection('users').orderBy('email').get();
    allTeamMembers = [];
    const personFilter = document.getElementById('reportPersonFilter');
    personFilter.innerHTML = '<option value="">All Members</option>';
    
    snapshot.forEach(doc => {
      const user = doc.data();
      allTeamMembers.push({ id: doc.id, ...user });
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = user.email + (user.role === 'admin' ? ' (Admin)' : '');
      personFilter.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading team members:', error);
  }
}

// 🔄 Real-time listener for all reports (admin view)
let reportsUnsubscribe = null;

function loadAllReportsLive() {
  // If listener already active, stop it before creating a new one
  if (reportsUnsubscribe) reportsUnsubscribe();

  reportsUnsubscribe = db.collection('dailyReports')
    .orderBy('date', 'desc')
    .onSnapshot(snapshot => {
      allReports = [];
      snapshot.forEach(doc => {
        allReports.push({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate() || new Date()
        });
      });

      console.log("[reports] Live reports loaded:", allReports.length);
      applyReportFilters(); // refresh table/list automatically
    }, error => {
      console.error("Live reports listener error:", error);
    });
}


function handleDateFilterChange() {
  const dateFilter = document.getElementById('reportDateFilter').value;
  const customRange = document.getElementById('customReportDateRange');
  
  if (dateFilter === 'custom') {
    customRange.classList.remove('hidden');
  } else {
    customRange.classList.add('hidden');
  }
  
  applyReportFilters();
}

function applyReportFilters() {
  const searchTerm = document.getElementById('reportSearchInput')?.value.toLowerCase() || '';
  const personFilter = document.getElementById('reportPersonFilter')?.value || '';
  const dateFilter = document.getElementById('reportDateFilter')?.value || 'today';
  
  filteredReports = allReports.filter(report => {
    const matchesSearch = !searchTerm || 
      report.userEmail?.toLowerCase().includes(searchTerm) ||
      report.tasksCompleted?.toLowerCase().includes(searchTerm) ||
      report.blockers?.toLowerCase().includes(searchTerm);
    
    const matchesPerson = !personFilter || report.userId === personFilter;
    
    const matchesDate = applyReportDateFilter(report, dateFilter);
    
    return matchesSearch && matchesPerson && matchesDate;
  });
  
  renderReportsList();
  updateReportsStats();
}

function applyReportDateFilter(report, dateFilter) {
  if (!dateFilter || dateFilter === 'all') return true;
  
  const reportDate = new Date(report.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (dateFilter) {
    case 'today':
      // Compare by local date instead of UTC
      const localToday = new Date();
      localToday.setHours(0, 0, 0, 0);

      const reportDay = new Date(report.date);
      reportDay.setHours(0, 0, 0, 0);

      return reportDay.getTime() === localToday.getTime();

    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return report.date === yesterdayStr;
    
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return reportDate >= weekAgo;
    
    case 'month':
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return reportDate >= monthAgo;
    
    case 'custom':
      const fromDate = document.getElementById('reportFromDate')?.value;
      const toDate = document.getElementById('reportToDate')?.value;
      
      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        return reportDate >= from && reportDate <= to;
      }
      return true;
    
    default:
      return true;
  }
}

function renderReportsList() {
  const reportsList = document.getElementById('reportsList');
  const resultsCount = document.getElementById('reportResultsCount');
  
  resultsCount.textContent = `${filteredReports.length} report${filteredReports.length !== 1 ? 's' : ''} found`;
  
  if (filteredReports.length === 0) {
    reportsList.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <i class="fas fa-inbox text-4xl mb-3"></i>
        <p>No reports found matching the current filters.</p>
      </div>
    `;
    return;
  }
  
  reportsList.innerHTML = '';
  
  filteredReports.forEach(report => {
    const reportCard = document.createElement('div');
    reportCard.className = 'border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all';
    
    const resourcesHtml = report.resources && report.resources.length > 0
      ? `
        <div class="mt-4 pt-4 border-t border-gray-100">
          <p class="text-sm font-semibold text-gray-700 mb-2">
            <i class="fas fa-link text-indigo-600 mr-1"></i>Resources (${report.resources.length})
          </p>
          <div class="space-y-1">
            ${report.resources.map(r => `
              <a href="${r.url}" target="_blank" 
                class="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-2">
                <i class="fas fa-external-link-alt text-xs"></i>
                ${r.title}
              </a>
            `).join('')}
          </div>
        </div>
      `
      : '';
    
    reportCard.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center">
            <span class="text-white font-bold">${(report.userEmail || 'U')[0].toUpperCase()}</span>
          </div>
          <div>
            <p class="font-semibold text-gray-900">${report.userEmail || 'Unknown User'}</p>
            <p class="text-sm text-gray-500">
              <i class="fas fa-calendar mr-1"></i>${formatDate(report.date)}
              ${report.hoursWorked ? `<span class="ml-3"><i class="fas fa-clock mr-1"></i>${report.hoursWorked} hrs</span>` : ''}
            </p>
          </div>
        </div>
        <span class="text-xs text-gray-500">
          ${formatTimestamp(report.submittedAt)}
        </span>
      </div>
      
      <div class="space-y-3">
        ${report.tasksCompleted ? `
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-1">
              <i class="fas fa-check-circle text-green-600 mr-1"></i>Tasks Completed
            </p>
            <p class="text-sm text-gray-600 whitespace-pre-wrap">${report.tasksCompleted}</p>
          </div>
        ` : ''}
        
        ${report.blockers ? `
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-1">
              <i class="fas fa-exclamation-triangle text-orange-600 mr-1"></i>Blockers
            </p>
            <p class="text-sm text-gray-600 whitespace-pre-wrap">${report.blockers}</p>
          </div>
        ` : ''}
        
        ${report.tomorrowPlan ? `
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-1">
              <i class="fas fa-calendar-day text-blue-600 mr-1"></i>Tomorrow's Plan
            </p>
            <p class="text-sm text-gray-600 whitespace-pre-wrap">${report.tomorrowPlan}</p>
          </div>
        ` : ''}
        
        ${report.additionalNotes ? `
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-1">
              <i class="fas fa-sticky-note text-yellow-600 mr-1"></i>Additional Notes
            </p>
            <p class="text-sm text-gray-600 whitespace-pre-wrap">${report.additionalNotes}</p>
          </div>
        ` : ''}
        
        ${resourcesHtml}
      </div>
    `;
    
    reportsList.appendChild(reportCard);
  });
}

function updateReportsStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayReports = allReports.filter(r => r.date === todayStr);
  
  const totalTeamSize = allTeamMembers.length;
  const todaySubmissions = todayReports.length;
  const pendingToday = totalTeamSize - todaySubmissions;
  const submissionRate = totalTeamSize > 0 ? Math.round((todaySubmissions / totalTeamSize) * 100) : 0;
  
  document.getElementById('totalReportsCount').textContent = allReports.length;
  document.getElementById('todaySubmissionsCount').textContent = todaySubmissions;
  document.getElementById('pendingSubmissionsCount').textContent = Math.max(0, pendingToday);
  document.getElementById('submissionRate').textContent = submissionRate + '%';
}

function clearReportFilters() {
  document.getElementById('reportSearchInput').value = '';
  document.getElementById('reportPersonFilter').value = '';
  document.getElementById('reportDateFilter').value = 'today';
  document.getElementById('reportFromDate').value = '';
  document.getElementById('reportToDate').value = '';
  document.getElementById('customReportDateRange').classList.add('hidden');
  applyReportFilters();
}

function exportReportsToCSV() {
  const headers = ['Date', 'User Email', 'Tasks Completed', 'Blockers', 'Tomorrow\'s Plan', 'Hours Worked', 'Additional Notes', 'Resources'];
  
  const csvContent = [
    headers.join(','),
    ...filteredReports.map(report => [
      `"${report.date || ''}"`,
      `"${report.userEmail || ''}"`,
      `"${(report.tasksCompleted || '').replace(/"/g, '""')}"`,
      `"${(report.blockers || '').replace(/"/g, '""')}"`,
      `"${(report.tomorrowPlan || '').replace(/"/g, '""')}"`,
      `"${report.hoursWorked || ''}"`,
      `"${(report.additionalNotes || '').replace(/"/g, '""')}"`,
      `"${report.resources ? report.resources.map(r => `${r.title}: ${r.url}`).join('; ') : ''}"`
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily_reports_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

window.removeResource = removeResource;
