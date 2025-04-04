// Global variables
let lastDate = null;
let currentViewMonth = new Date().getMonth();
let currentViewYear = new Date().getFullYear();
let exams = JSON.parse(localStorage.getItem('exams-data')) || [];
let gradeCalculators = JSON.parse(localStorage.getItem('grade-calculators')) || {};

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize everything after DOM is loaded
    updateDateTime();
    renderExams();
    generateCalendar(new Date());
    renderTasks();
    initGradeCalculator();
    
    // Set up event listeners
    document.getElementById('exam-form').addEventListener('submit', addExam);
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
    
    // Existing task event listeners
    document.getElementById('add-task-btn').addEventListener('click', addTask);
    document.getElementById('new-task-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });
    
    // Update date, time and countdowns every second
    setInterval(updateDateTime, 1000);
    
    // Check if exams exist and show/hide grade calculator
    updateGradeCalculatorVisibility();
});

// Update date and time
function updateDateTime() {
    const now = new Date();
    
    // Update date with enhanced styling
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', dateOptions);
    
    // Update time with animated styling
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const timeElement = document.getElementById('current-time');
    const timeStr = now.toLocaleTimeString('en-US', timeOptions);
    timeElement.innerHTML = `<time>${timeStr}</time>`;
    
    // Update all exam countdowns
    updateExamCountdowns(now);
    
    // Update calendar if day changes
    if (!lastDate || lastDate.getDate() !== now.getDate()) {
        generateCalendar(new Date(currentViewYear, currentViewMonth));
        lastDate = now;
    }
}

// Add new exam
function addExam(e) {
    e.preventDefault();
    
    const examName = document.getElementById('exam-name').value.trim();
    const examDate = document.getElementById('exam-date').value;
    const examLocation = document.getElementById('exam-location').value.trim();
    
    if (!examName || !examDate) {
        alert('Please enter both exam name and date.');
        return;
    }
    
    // Check if already at 5 exams limit
    if (exams.length >= 5) {
        alert('You can only track up to 5 exams. Please remove an exam before adding a new one.');
        return;
    }
    
    // Create new exam object
    const newExam = {
        id: Date.now(),
        name: examName,
        date: new Date(examDate).toISOString(),
        location: examLocation
    };
    
    // Add to exams array
    exams.push(newExam);
    
    // Save to localStorage
    saveExams();
    
    // Reset form
    document.getElementById('exam-form').reset();
    
    // Render exams and update calendar
    renderExams();
    generateCalendar(new Date(currentViewYear, currentViewMonth));
    
    // Update grade calculator visibility
    updateGradeCalculatorVisibility();
    
    // Update course select in grade calculator
    populateCourseSelect();
}

// Delete exam
function deleteExam(examId) {
    if (confirm('Are you sure you want to remove this exam?')) {
        exams = exams.filter(exam => exam.id !== examId);
        
        // Also remove this exam from the grade calculators
        if (gradeCalculators[examId]) {
            delete gradeCalculators[examId];
            localStorage.setItem('grade-calculators', JSON.stringify(gradeCalculators));
        }
        
        saveExams();
        renderExams();
        generateCalendar(new Date(currentViewYear, currentViewMonth));
        
        // Update grade calculator visibility
        updateGradeCalculatorVisibility();
        
        // Update course select in grade calculator
        populateCourseSelect();
    }
}

// Save exams to localStorage
function saveExams() {
    localStorage.setItem('exams-data', JSON.stringify(exams));
    
    // Dispatch custom event for exam updates
    const event = new CustomEvent('examsUpdated');
    document.dispatchEvent(event);
}

// Render exams list and countdowns
function renderExams() {
    const examsContainer = document.getElementById('exams-countdown-container');
    examsContainer.innerHTML = '';
    
    if (exams.length === 0) {
        examsContainer.innerHTML = '<div class="empty-exams-message">No exams added yet. Add your first exam above!</div>';
        return;
    }
    
    // Sort exams by date (closest first)
    exams.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Create countdown elements for each exam
    exams.forEach(exam => {
        const examDate = new Date(exam.date);
        const examElement = document.createElement('div');
        examElement.className = 'exam-countdown';
        examElement.id = `exam-${exam.id}`;
        
        // Generate a color for this exam (could be based on exam name/type)
        const colorClass = getColorClassForExam(exam.name);
        examElement.classList.add(colorClass);
        
        examElement.innerHTML = `
            <div class="exam-header">
                <h3>${exam.name}</h3>
                <button class="delete-exam-btn" title="Delete Exam" onclick="deleteExam(${exam.id})">×</button>
            </div>
            <div class="exam-info">
                <div class="exam-datetime">${formatExamDateTime(examDate)}</div>
                ${exam.location ? `<div class="exam-location">📍 ${exam.location}</div>` : ''}
            </div>
            <div class="countdown-timer">
                <div class="countdown-unit">
                    <span class="count days">--</span>
                    <span class="label">Days</span>
                </div>
                <div class="countdown-unit">
                    <span class="count hours">--</span>
                    <span class="label">Hours</span>
                </div>
                <div class="countdown-unit">
                    <span class="count minutes">--</span>
                    <span class="label">Minutes</span>
                </div>
                <div class="countdown-unit">
                    <span class="count seconds">--</span>
                    <span class="label">Seconds</span>
                </div>
            </div>
        `;
        
        examsContainer.appendChild(examElement);
        
        // Add grade info if available
        if (gradeCalculators[exam.id] && gradeCalculators[exam.id].currentGrade !== undefined) {
            const courseData = gradeCalculators[exam.id];
            const pendingComponents = courseData.components.filter(component => component.marksNA);
            const requiredFinalMark = pendingComponents.length > 0 && 
                                      courseData.requiredMarks ? 
                                      Object.values(courseData.requiredMarks)[pendingComponents.length - 1].toFixed(2) : 
                                      'N/A';
            
            updateExamWithGradeInfo(exam.id, courseData.currentGrade.toFixed(2), requiredFinalMark);
        }
    });
    
    // Initial update for countdowns
    updateExamCountdowns(new Date());
}

// Format exam date for display
function formatExamDateTime(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleDateString('en-US', options);
}

// Get color class based on exam name
function getColorClassForExam(examName) {
    // Simple hashing function to get a consistent color for the same exam name
    const hash = examName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorClasses = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5'];
    return colorClasses[hash % colorClasses.length];
}

// Update all exam countdowns
function updateExamCountdowns(now) {
    exams.forEach(exam => {
        const examDate = new Date(exam.date);
        const examElement = document.getElementById(`exam-${exam.id}`);
        
        if (!examElement) return;
        
        const timeDiff = examDate - now;
        
        // Check if exam is in the past
        if (timeDiff <= 0) {
            examElement.classList.add('exam-passed');
            examElement.querySelector('.countdown-timer').innerHTML = '<div class="exam-passed-message">Exam has passed</div>';
            return;
        }
        
        // Calculate time units
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        // Update countdown display
        examElement.querySelector('.days').textContent = days;
        examElement.querySelector('.hours').textContent = hours;
        examElement.querySelector('.minutes').textContent = minutes;
        examElement.querySelector('.seconds').textContent = seconds;
        
        // Add urgency class for exams coming up soon
        if (days < 1) {
            examElement.classList.add('exam-urgent');
        } else if (days < 3) {
            examElement.classList.add('exam-soon');
        }
    });
}

// Generate calendar
function generateCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    currentViewMonth = month;
    currentViewYear = year;
    
    const firstDay = new Date(year, month, 1).getDay(); // Day of week (0-6)
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // Days in month
    
    // Set month and year in header
    document.getElementById('calendar-month-year').textContent = 
        date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Clear calendar
    const calendarDaysContainer = document.getElementById('calendar-days');
    calendarDaysContainer.innerHTML = '';
    
    // Add empty days for start of month
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarDaysContainer.appendChild(emptyDay);
    }
    
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = i;
        
        // Check if it's today
        const today = new Date();
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayElement.classList.add('today');
        }
        
        // Check if any exams fall on this day
        exams.forEach(exam => {
            const examDate = new Date(exam.date);
            
            if (i === examDate.getDate() && month === examDate.getMonth() && year === examDate.getFullYear()) {
                dayElement.classList.add('exam-day');
                
                // Get color class for this exam
                const colorClass = getColorClassForExam(exam.name);
                dayElement.classList.add(colorClass);
                
                // Add tooltip with exam name
                dayElement.title = exam.name;
                
                // Add indicator dot
                const indicator = document.createElement('span');
                indicator.className = 'exam-indicator';
                dayElement.appendChild(indicator);
            }
        });
        
        calendarDaysContainer.appendChild(dayElement);
    }
}

// Change month view in calendar
function changeMonth(delta) {
    currentViewMonth += delta;
    
    if (currentViewMonth < 0) {
        currentViewMonth = 11;
        currentViewYear--;
    } else if (currentViewMonth > 11) {
        currentViewMonth = 0;
        currentViewYear++;
    }
    
    generateCalendar(new Date(currentViewYear, currentViewMonth));
}

// Task management (mostly keeping original functionality)
const taskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const assignedTasksList = document.getElementById('assigned-tasks');
const completedTasksList = document.getElementById('completed-tasks');

// Load tasks from localStorage
let assignedTasks = JSON.parse(localStorage.getItem('exam-assigned-tasks')) || [];
let completedTasks = JSON.parse(localStorage.getItem('exam-completed-tasks')) || [];

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem('exam-assigned-tasks', JSON.stringify(assignedTasks));
    localStorage.setItem('exam-completed-tasks', JSON.stringify(completedTasks));
}

// Render tasks
function renderTasks() {
    // Clear lists
    assignedTasksList.innerHTML = '';
    completedTasksList.innerHTML = '';
    
    // Render assigned tasks
    if (assignedTasks.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No study tasks assigned';
        assignedTasksList.appendChild(emptyMessage);
    } else {
        assignedTasks.forEach(task => {
            const li = document.createElement('li');
            
            const taskText = document.createElement('span');
            taskText.className = 'task-text';
            taskText.textContent = task.text;
            li.appendChild(taskText);
            
            const actionDiv = document.createElement('div');
            actionDiv.className = 'task-actions';
            
            const completeBtn = document.createElement('button');
            completeBtn.className = 'task-btn complete-btn';
            completeBtn.textContent = '✓';
            completeBtn.title = 'Mark as completed';
            completeBtn.addEventListener('click', () => {
                completedTasks.push(task);
                assignedTasks = assignedTasks.filter(t => t.id !== task.id);
                saveTasks();
                renderTasks();
            });
            actionDiv.appendChild(completeBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'task-btn delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Delete task';
            deleteBtn.addEventListener('click', () => {
                assignedTasks = assignedTasks.filter(t => t.id !== task.id);
                saveTasks();
                renderTasks();
            });
            actionDiv.appendChild(deleteBtn);
            
            li.appendChild(actionDiv);
            assignedTasksList.appendChild(li);
        });
    }
    
    // Render completed tasks
    if (completedTasks.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No completed tasks';
        completedTasksList.appendChild(emptyMessage);
    } else {
        completedTasks.forEach(task => {
            const li = document.createElement('li');
            
            const taskText = document.createElement('span');
            taskText.className = 'task-text';
            taskText.textContent = task.text;
            li.appendChild(taskText);
            
            const actionDiv = document.createElement('div');
            actionDiv.className = 'task-actions';
            
            const returnBtn = document.createElement('button');
            returnBtn.className = 'task-btn return-btn';
            returnBtn.textContent = '↩';
            returnBtn.title = 'Move back to assigned';
            returnBtn.addEventListener('click', () => {
                assignedTasks.push(task);
                completedTasks = completedTasks.filter(t => t.id !== task.id);
                saveTasks();
                renderTasks();
            });
            actionDiv.appendChild(returnBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'task-btn delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Delete task';
            deleteBtn.addEventListener('click', () => {
                completedTasks = completedTasks.filter(t => t.id !== task.id);
                saveTasks();
                renderTasks();
            });
            actionDiv.appendChild(deleteBtn);
            
            li.appendChild(actionDiv);
            completedTasksList.appendChild(li);
        });
    }
}

// Add new task
function addTask() {
    const taskText = taskInput.value.trim();
    if (taskText) {
        const newTask = { id: Date.now(), text: taskText };
        assignedTasks.push(newTask);
        taskInput.value = '';
        saveTasks();
        renderTasks();
    }
}

// Grade Calculator Functions
function initGradeCalculator() {
    // Get references to DOM elements
    const courseSelect = document.getElementById('course-select');
    const addComponentBtn = document.getElementById('add-component-btn');
    const calculateBtn = document.getElementById('calculate-btn');
    const desiredGradeInput = document.getElementById('desired-grade');
    
    // Add event listeners
    courseSelect.addEventListener('change', loadGradeComponents);
    addComponentBtn.addEventListener('click', addGradeComponent);
    calculateBtn.addEventListener('click', calculateRequiredMarks);
    desiredGradeInput.addEventListener('change', saveGradeComponents);
    
    // Populate course select with available exams
    populateCourseSelect();
    
    // Listen for exam updates
    document.addEventListener('examsUpdated', function() {
        populateCourseSelect();
    });
}

// Show/hide grade calculator based on whether exams exist
function updateGradeCalculatorVisibility() {
    const gradeCalculatorContainer = document.getElementById('grade-calculator-container');
    
    if (exams.length > 0) {
        gradeCalculatorContainer.classList.remove('hidden');
    } else {
        gradeCalculatorContainer.classList.add('hidden');
    }
}

// Populate course select dropdown with available exams
function populateCourseSelect() {
    const courseSelect = document.getElementById('course-select');
    courseSelect.innerHTML = '<option value="">-- Select an exam --</option>';
    
    exams.forEach(exam => {
        const option = document.createElement('option');
        option.value = exam.id;
        option.textContent = exam.name;
        courseSelect.appendChild(option);
    });
}

// Add a new grade component row
function addGradeComponent() {
    const gradeComponentsTable = document.getElementById('grade-components-body');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="component-name" placeholder="e.g., Midterm"></td>
        <td><input type="number" class="component-weight" min="0" max="100" placeholder="e.g., 25"></td>
        <td><input type="number" class="component-grade" min="0" max="100" placeholder="e.g., 85"></td>
        <td><input type="checkbox" class="marks-na"></td>
        <td>
            <div class="component-actions">
                <button class="delete-component-btn">×</button>
            </div>
        </td>
    `;
    
    // Add event listener to checkbox to disable grade input when checked
    const marksNaCheckbox = row.querySelector('.marks-na');
    const gradeInput = row.querySelector('.component-grade');
    
    marksNaCheckbox.addEventListener('change', function() {
        gradeInput.disabled = this.checked;
        if (this.checked) {
            gradeInput.value = '';
        }
        saveGradeComponents();
    });
    
    // Add event listener to delete button
    row.querySelector('.delete-component-btn').addEventListener('click', function() {
        row.remove();
        saveGradeComponents();
    });
    
    // Add event listeners to inputs to save on change
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('change', saveGradeComponents);
    });
    
    gradeComponentsTable.appendChild(row);
    saveGradeComponents();
}

// Load grade components for selected course
function loadGradeComponents() {
    const courseSelect = document.getElementById('course-select');
    const gradeComponentsTable = document.getElementById('grade-components-body');
    const desiredGradeInput = document.getElementById('desired-grade');
    const calculationResult = document.getElementById('calculation-result');
    
    const courseId = courseSelect.value;
    gradeComponentsTable.innerHTML = '';
    calculationResult.classList.remove('show');
    
    if (!courseId) return;
    
    // Load saved components for this course
    const courseData = gradeCalculators[courseId] || { components: [], desiredGrade: 80 };
    
    // Set desired grade
    desiredGradeInput.value = courseData.desiredGrade || 80;
    
    // Add component rows
    if (courseData.components && courseData.components.length > 0) {
        courseData.components.forEach(component => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" class="component-name" value="${component.name || ''}" placeholder="e.g., Midterm"></td>
                <td><input type="number" class="component-weight" min="0" max="100" value="${component.weight || ''}" placeholder="e.g., 25"></td>
                <td><input type="number" class="component-grade" min="0" max="100" value="${component.marksNA ? '' : (component.grade || '')}" placeholder="e.g., 85" ${component.marksNA ? 'disabled' : ''}></td>
                <td><input type="checkbox" class="marks-na" ${component.marksNA ? 'checked' : ''}></td>
                <td>
                    <div class="component-actions">
                        <button class="delete-component-btn">×</button>
                    </div>
                </td>
            `;
            
            // Add event listener to checkbox to disable grade input when checked
            const marksNaCheckbox = row.querySelector('.marks-na');
            const gradeInput = row.querySelector('.component-grade');
            
            marksNaCheckbox.addEventListener('change', function() {
                gradeInput.disabled = this.checked;
                if (this.checked) {
                    gradeInput.value = '';
                }
                saveGradeComponents();
            });
            
            // Add event listener to delete button
            row.querySelector('.delete-component-btn').addEventListener('click', function() {
                row.remove();
                saveGradeComponents();
            });
            
            // Add event listeners to inputs to save on change
            const inputs = row.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('change', saveGradeComponents);
            });
            
            gradeComponentsTable.appendChild(row);
        });
    } else {
        // Add at least one empty row if none exist
        addGradeComponent();
    }
    
    // Update calculation if there's already data
    if (courseData.currentGrade !== undefined) {
        calculateRequiredMarks();
    }
}

// Save grade components for current course
function saveGradeComponents() {
    const courseSelect = document.getElementById('course-select');
    const gradeComponentsTable = document.getElementById('grade-components-body');
    const desiredGradeInput = document.getElementById('desired-grade');
    
    const courseId = courseSelect.value;
    if (!courseId) return;
    
    const components = [];
    const rows = gradeComponentsTable.querySelectorAll('tr');
    
    rows.forEach(row => {
        const nameInput = row.querySelector('.component-name');
        const weightInput = row.querySelector('.component-weight');
        const gradeInput = row.querySelector('.component-grade');
        const marksNaCheckbox = row.querySelector('.marks-na');
        
        if (nameInput && weightInput) {
            components.push({
                name: nameInput.value.trim(),
                weight: parseFloat(weightInput.value) || 0,
                grade: marksNaCheckbox.checked ? null : (parseFloat(gradeInput.value) || 0),
                marksNA: marksNaCheckbox.checked
            });
        }
    });
    
    // Get desired grade
    const desiredGrade = parseFloat(desiredGradeInput.value) || 80;
    
    // Save to grade calculators object
    gradeCalculators[courseId] = {
        components: components,
        desiredGrade: desiredGrade
    };
    
    // Save to localStorage
    localStorage.setItem('grade-calculators', JSON.stringify(gradeCalculators));
}

// Calculate required marks
function calculateRequiredMarks() {
    const courseSelect = document.getElementById('course-select');
    const calculationResult = document.getElementById('calculation-result');
    
    const courseId = courseSelect.value;
    if (!courseId) {
        alert('Please select a course');
        return;
    }
    
    // Save current components first
    saveGradeComponents();
    
    // Get course data
    const courseData = gradeCalculators[courseId];
    if (!courseData || !courseData.components || courseData.components.length === 0) {
        alert('Please add at least one component');
        return;
    }
    
    // Check if weights sum to 100%
    const totalWeight = courseData.components.reduce((sum, component) => sum + (component.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
        alert('Component weights must sum to 100%. Current total: ' + totalWeight.toFixed(2) + '%');
        return;
    }
    
    // Calculate current grade based on completed components
    let completedWeight = 0;
    let weightedSum = 0;
    
    courseData.components.forEach(component => {
        if (!component.marksNA && component.grade !== null) {
            completedWeight += component.weight;
            weightedSum += component.grade * (component.weight / 100);
        }
    });
    
    const currentGrade = completedWeight > 0 ? (weightedSum * 100 / completedWeight) : 0;
    
    // Find components with marks N/A
    const pendingComponents = courseData.components.filter(component => component.marksNA);
    
    // Calculate required marks for pending components
    let requiredMarks = {};
    
    if (pendingComponents.length > 0) {
        // Get desired grade
        const desiredGrade = courseData.desiredGrade || 80;
        
        // Add 2% buffer to desired grade
        const targetGrade = desiredGrade;
        
        // Calculate what's needed for remaining components
        const remainingWeight = 100 - completedWeight;
        const pointsNeeded = (targetGrade - weightedSum * 100 / 100);
        
        if (remainingWeight > 0) {
            // Sort pending components by their order in the original list
            pendingComponents.sort((a, b) => {
                return courseData.components.indexOf(a) - courseData.components.indexOf(b);
            });
            
            // Start with first pending component
            const firstPending = pendingComponents[0];
            let firstRequiredMark = pointsNeeded * 100 / firstPending.weight;
            
            // Cap at 100%
            firstRequiredMark = Math.min(firstRequiredMark, 100);
            
            requiredMarks[firstPending.name] = firstRequiredMark;
            
            // If there are multiple pending components, distribute the remaining needs
            if (pendingComponents.length > 1) {
                // Recalculate with first component's contribution
                const newWeightedSum = weightedSum + (firstRequiredMark * firstPending.weight / 100);
                const newCompletedWeight = completedWeight + firstPending.weight;
                
                // For remaining components, set to maintain the target
                for (let i = 1; i < pendingComponents.length; i++) {
                    const component = pendingComponents[i];
                    
                    // Calculate required to maintain target
                    const remainingTarget = (targetGrade * 100 - newWeightedSum * 100) / (100 - newCompletedWeight);
                    
                    requiredMarks[component.name] = Math.min(remainingTarget, 100);
                }
            }
        }
    }
    
    // Display results
    calculationResult.innerHTML = '';
    calculationResult.classList.add('show');
    
    // Show current grade
    const currentGradeDiv = document.createElement('div');
    currentGradeDiv.className = 'result-item';
    currentGradeDiv.innerHTML = `
        <span class="result-label">Current Grade:</span>
        <span class="result-value current-grade">${currentGrade.toFixed(2)}%</span>
    `;
    calculationResult.appendChild(currentGradeDiv);
    
    // Show required marks for each pending component
    if (pendingComponents.length > 0) {
        const requiredMarksHeader = document.createElement('div');
        requiredMarksHeader.className = 'result-header';
        requiredMarksHeader.textContent = 'Required Marks for Pending Components:';
        calculationResult.appendChild(requiredMarksHeader);
        
        Object.entries(requiredMarks).forEach(([name, mark]) => {
            const markDiv = document.createElement('div');
            markDiv.className = 'result-item';
            markDiv.innerHTML = `
                <span class="result-label">${name}:</span>
                <span class="result-value required-mark">${mark.toFixed(2)}%</span>
            `;
            calculationResult.appendChild(markDiv);
        });
    }
    
    // Update the exam display with current grade and required mark for final
    const requiredFinalMark = pendingComponents.length > 0 ? 
        Object.values(requiredMarks)[pendingComponents.length - 1].toFixed(2) : 'N/A';
    
    updateExamWithGradeInfo(courseId, currentGrade.toFixed(2), requiredFinalMark);
    
    // Save the calculation results
    courseData.currentGrade = currentGrade;
    courseData.requiredMarks = requiredMarks;
    localStorage.setItem('grade-calculators', JSON.stringify(gradeCalculators));
}

// Update exam countdown display with grade information
function updateExamWithGradeInfo(examId, currentGrade, requiredFinalMark) {
    const examElement = document.getElementById(`exam-${examId}`);
    if (!examElement) return;
    
    // Check if grade info section already exists
    let gradeInfoSection = examElement.querySelector('.exam-grade-info');
    
    if (!gradeInfoSection) {
        // Create grade info section
        gradeInfoSection = document.createElement('div');
        gradeInfoSection.className = 'exam-grade-info';
        
        // Add after countdown timer
        const countdownTimer = examElement.querySelector('.countdown-timer');
        if (countdownTimer) {
            countdownTimer.after(gradeInfoSection);
        } else {
            examElement.appendChild(gradeInfoSection);
        }
    }
    
    // Update content
    gradeInfoSection.innerHTML = `
        <p>
            <span class="label">Current Grade:</span>
            <span class="value current-grade">${currentGrade}%</span>
        </p>
        <p>
            <span class="label">Required Final Mark:</span>
            <span class="value required-mark">${requiredFinalMark}%</span>
        </p>
    `;
}

// Adjust countdown display based on screen size
function adjustForScreenSize() {
    const isMobile = window.innerWidth < 640;
    const examCountdowns = document.querySelectorAll('.exam-countdown');
    
    examCountdowns.forEach(countdown => {
        if (isMobile) {
            // Handle any specific mobile adjustments if needed
            // For example, abbreviating labels or adjusting content
        } else {
            // Handle desktop specific adjustments
        }
    });
    
    // Adjust calendar day sizes on small screens
    const calendarDays = document.querySelectorAll('.calendar-day:not(.empty)');
    calendarDays.forEach(day => {
        if (window.innerWidth < 420) {
            // Small screen adjustments
            day.style.fontSize = '0.875rem';
        } else {
            // Reset to default
            day.style.fontSize = '';
        }
    });
}

// Call initially and add resize listener
adjustForScreenSize();
window.addEventListener('resize', adjustForScreenSize);

// Handle touch interactions for tasks on mobile
const taskItems = document.querySelectorAll('.task-list li');
taskItems.forEach(item => {
    let touchStartTime;
    let touchTimer;
    
    item.addEventListener('touchstart', () => {
        touchStartTime = new Date().getTime();
        touchTimer = setTimeout(() => {
            // Long press handler if needed
            const actions = item.querySelector('.task-actions');
            if (actions) {
                actions.style.opacity = '1';
            }
        }, 500);
    });
    
    item.addEventListener('touchend', () => {
        const touchEndTime = new Date().getTime();
        clearTimeout(touchTimer);
        
        // Reset any touch-specific UI states if needed
        setTimeout(() => {
            const actions = item.querySelector('.task-actions');
            if (actions && window.innerWidth >= 768) {
                actions.style.opacity = '';
            }
        }, 1500);
    });
});

// Improve mobile form behavior
const examForm = document.getElementById('exam-form');
if (examForm) {
    examForm.addEventListener('submit', (e) => {
        // Blur active input to hide keyboard on mobile
        document.activeElement.blur();
    });
}

// Handle touch events for calendar days
const calendarDayElements = document.querySelectorAll('.calendar-day');
calendarDayElements.forEach(day => {
    day.addEventListener('touchstart', () => {
        day.classList.add('calendar-day-touch');
    });
    
    day.addEventListener('touchend', () => {
        setTimeout(() => {
            day.classList.remove('calendar-day-touch');
        }, 150);
    });
});