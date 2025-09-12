let timerInterval = null;
let timerStart = null;
let timerTaskId = null;
let timerElapsed = 0;

window.openTimerModal = async function(taskId, taskTitle) {
  timerTaskId = taskId;
  document.getElementById('timerModal').classList.remove('hidden');
  document.getElementById('timerTaskTitle').textContent = taskTitle;
  document.getElementById('timerDisplay').textContent = "00:00:00";
  
  // Check if timer is already running for this task
  const taskDoc = await db.collection('tasks').doc(taskId).get();
  const taskData = taskDoc.data();
  
  if (taskData.timerRunning) {
    // Timer is already running, show stop button and calculate elapsed time
    document.getElementById('startTimerBtn').classList.add('hidden');
    document.getElementById('stopTimerBtn').classList.remove('hidden');
    document.getElementById('statusControls').classList.add('hidden');
    
    // Calculate and display current elapsed time from stored start timestamp
    if (taskData.timerStartAt) {
      timerStart = taskData.timerStartAt;
      timerElapsed = Math.floor((Date.now() - timerStart) / 1000);
      document.getElementById('timerDisplay').textContent = formatTime(timerElapsed);
      
      // Start the interval to continue updating the display
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timerElapsed = Math.floor((Date.now() - timerStart) / 1000);
        document.getElementById('timerDisplay').textContent = formatTime(timerElapsed);
      }, 1000);
    }
  } else {
    // Timer is not running, show start button
    document.getElementById('startTimerBtn').classList.remove('hidden');
    document.getElementById('stopTimerBtn').classList.add('hidden');
    document.getElementById('statusControls').classList.add('hidden');
    
    timerElapsed = 0;
    clearInterval(timerInterval);
    document.getElementById('timerDisplay').textContent = "00:00:00";
  }
}

document.getElementById('closeTimerModal').onclick = async () => {
  // Check if timer is currently running
  if (timerTaskId) {
    const taskDoc = await db.collection('tasks').doc(timerTaskId).get();
    const taskData = taskDoc.data();
    
    if (taskData.timerRunning) {
      // Timer is running - continue in background, just close modal
      clearInterval(timerInterval);
      document.getElementById('timerModal').classList.add('hidden');
      // Timer state remains in database, continues running
    } else {
      // Timer not running - safe to close
      clearInterval(timerInterval);
      document.getElementById('timerModal').classList.add('hidden');
    }
  } else {
    // No timer task, safe to close
    clearInterval(timerInterval);
    document.getElementById('timerModal').classList.add('hidden');
  }
};

document.getElementById('startTimerBtn').onclick = async () => {
  timerStart = Date.now();
  document.getElementById('startTimerBtn').classList.add('hidden');
  document.getElementById('stopTimerBtn').classList.remove('hidden');
  document.getElementById('statusControls').classList.add('hidden');
  
  // Update task to mark timer as running and store start timestamp
  await db.collection('tasks').doc(timerTaskId).update({
    timerRunning: true,
    timerStartAt: timerStart,
    status: 'in-progress'
  });
  
  timerInterval = setInterval(() => {
    timerElapsed = Math.floor((Date.now() - timerStart) / 1000);
    document.getElementById('timerDisplay').textContent = formatTime(timerElapsed);
  }, 1000);
  
  // Refresh task display to show timer is running
  if (typeof loadTasks === "function") loadTasks();
};

document.getElementById('stopTimerBtn').onclick = async () => {
  clearInterval(timerInterval);
  const endTime = Date.now();
  
  // Get the actual start time from database to ensure accuracy
  const taskDoc = await db.collection('tasks').doc(timerTaskId).get();
  const taskData = taskDoc.data();
  const actualStartTime = taskData.timerStartAt || timerStart;
  const duration = Math.floor((endTime - actualStartTime) / 1000);
  
  // Update task with time log and mark timer as stopped
  await db.collection('tasks').doc(timerTaskId).update({
    timeLogs: firebase.firestore.FieldValue.arrayUnion({
      user: auth.currentUser.uid,
      start: actualStartTime,
      end: endTime,
      duration: duration
    }),
    totalTime: firebase.firestore.FieldValue.increment(duration),
    timerRunning: false,
    timerStartAt: firebase.firestore.FieldValue.delete()
  });
  
  // Show status controls after stopping timer
  document.getElementById('startTimerBtn').classList.remove('hidden');
  document.getElementById('stopTimerBtn').classList.add('hidden');
  document.getElementById('statusControls').classList.remove('hidden');
  
  // Update timer display to show final time
  document.getElementById('timerDisplay').textContent = formatTime(duration);
  
  // Refresh displays
  if (typeof loadTasks === "function") loadTasks();
  if (typeof loadDashboardCounts === "function") loadDashboardCounts();
};

function formatTime(sec) {
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Function to update task status (only allowed after timer is stopped)
window.updateTaskStatus = async function(newStatus) {
  if (!timerTaskId) return;
  
  try {
    await db.collection('tasks').doc(timerTaskId).update({
      status: newStatus
    });
    
    // Hide status controls and close modal
    document.getElementById('statusControls').classList.add('hidden');
    document.getElementById('timerModal').classList.add('hidden');
    
    // Refresh task display
    if (typeof loadTasks === "function") loadTasks();
    if (typeof loadDashboardCounts === "function") loadDashboardCounts();
    
    // Show success message
    console.log(`Task status updated to: ${newStatus}`);
  } catch (error) {
    alert(`Error updating task status: ${error.message}`);
  }
}