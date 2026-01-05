// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const detectedWordElement = document.getElementById('detection-text');
const speakButton = document.getElementById('speak-text');
const copyButton = document.getElementById('copy-text');
const clearButton = document.getElementById('clear-text');
const cameraToggleButton = document.getElementById('camera-toggle');

// Camera control variables
let stream = null;
let isCameraOn = false;

// Speech Synthesis
const synth = window.speechSynthesis;
let recognition;

// Speech control variables
let lastSpokenWord = '';
let isSpeaking = false;

// Gesture to Arabic word mapping
const GESTURES = {
    'hello': 'مرحباً',
    'thanks': 'شكراً',
    'yes': 'نعم',
    'no': 'لا',
    'help': 'مساعدة'
};

// Mobile menu toggle
function setupMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        menuToggle.classList.toggle('active');
    });
    
    // Close menu when clicking on a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    });
}

// Smooth scrolling for anchor links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80, // Adjust for fixed header
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Initialize the application
async function init() {
    try {
        setupMobileMenu();
        setupSmoothScrolling();
        await loadHandpose();
        setupSpeechRecognition();
        setupEventListeners();
        updateCameraUI(); // Set initial UI state
    } catch (error) {
        console.error('Error initializing application:', error);
        showError('حدث خطأ أثناء تهيئة التطبيق. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
    }
}

// Set up the camera
async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            width: 640,
            height: 480,
            facingMode: 'user'
        },
        audio: false
    });
    
    video.srcObject = stream;
    
    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            video.play();
            resolve();
        };
    });
}

// Toggle camera on/off
async function toggleCamera() {
    if (isCameraOn) {
        // Turn off camera
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            stream = null;
        }
        isCameraOn = false;
        updateCameraUI();
    } else {
        // Turn on camera
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user'
                },
                audio: false
            });
            video.srcObject = stream;
            
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    
                    // Set canvas internal dimensions to match video
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    resolve();
                };
            });
            
            isCameraOn = true;
            updateCameraUI();
            detectHands(); // Start hand detection
        } catch (err) {
            console.error('Error accessing camera:', err);
            showError('حدث خطأ في تشغيل الكاميرا. يرجى التأكد من منح الإذن للوصول إلى الكاميرا.');
        }
    }
}

// Update camera UI based on state
function updateCameraUI() {
    const placeholderImage = document.getElementById('placeholder-image');
    
    if (isCameraOn) {
        cameraToggleButton.innerHTML = '<i class="fas fa-video-slash" style="margin-left: 8px;"></i> إيقاف الكاميرا';
        cameraToggleButton.style.background = '#dc3545';
        // Video is hidden, canvas shows landmarks on black background
        if (placeholderImage) placeholderImage.style.display = 'none';
        canvas.style.display = 'block';
        // Ensure canvas has black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        cameraToggleButton.innerHTML = '<i class="fas fa-camera" style="margin-left: 8px;"></i> تشغيل الكاميرا';
        cameraToggleButton.style.background = '#4CAF50';
        // Show placeholder when camera is off
        if (placeholderImage) placeholderImage.style.display = 'block';
        canvas.style.display = 'block';
        // Clear canvas with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Load the HandPose model
async function loadHandpose() {
    try {
        const model = await handpose.load();
        window.handposeModel = model;
        console.log('HandPose model loaded');
    } catch (error) {
        console.error('Error loading HandPose model:', error);
        throw new Error('فشل تحميل نموذج التعرف على اليدين. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.');
    }
}

// Set up speech recognition
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.error('Speech Recognition API not supported in this browser');
        startListeningButton.disabled = true;
        startListeningButton.textContent = 'التعرف على الصوت غير مدعوم في هذا المتصفح';
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        transcriptElement.textContent = transcript;
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        transcriptElement.textContent = 'حدث خطأ في التعرف على الصوت. يرجى المحاولة مرة أخرى.';
    };

    recognition.onspeechend = () => {
        startListeningButton.innerHTML = '<span class="icon">🎤</span><span>اضغط للتحدث</span>';
        startListeningButton.classList.remove('listening');
    };
}

// Detect hands and gestures
async function detectHands() {
    if (!window.handposeModel || !isCameraOn) return;

    const predictions = await window.handposeModel.estimateHands(video);
    
    // Set canvas rendering quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Always clear canvas with black background for clean display
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw hand landmarks
    if (predictions.length > 0) {
        const result = predictions[0];
        drawHandLandmarks(result.landmarks);
        
        // Simple gesture detection (this is a placeholder - you'll need to implement actual gesture detection)
        const detectedGesture = detectGesture(result.landmarks);
        if (detectedGesture) {
            updateDetectedWord(detectedGesture);
        }
    }
    
    if (isCameraOn) {
        requestAnimationFrame(detectHands);
    }
}

// Draw hand landmarks on canvas
function drawHandLandmarks(landmarks) {
    // Since video is hidden, we draw directly on canvas coordinates
    // Scale to fit the canvas display area
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / video.videoWidth;
    const scaleY = canvasRect.height / video.videoHeight;
    
    // Use the smaller scale to fit within bounds
    const scale = Math.min(scaleX, scaleY);
    
    // Center the landmarks
    const offsetX = (canvasRect.width - video.videoWidth * scale) / 2;
    const offsetY = (canvasRect.height - video.videoHeight * scale) / 2;
    
    // Get current time for pulse effect
    const time = Date.now() * 0.005;
    const pulse = Math.sin(time) * 0.1 + 0.9; // Pulse between 0.8 and 1.0
    
    // Draw connections first (behind the points)
    ctx.strokeStyle = 'rgba(74, 111, 165, 0.8)';
    ctx.lineWidth = 3 * pulse;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw all connections
    const connections = [
        // Palm
        [0, 1], [0, 5], [0, 9], [0, 13], [0, 17],
        // Thumb
        [1, 2], [2, 3], [3, 4],
        // Index finger
        [5, 6], [6, 7], [7, 8],
        // Middle finger
        [9, 10], [10, 11], [11, 12],
        // Ring finger
        [13, 14], [14, 15], [15, 16],
        // Pinky
        [17, 18], [18, 19], [19, 20]
    ];
    
    connections.forEach(([start, end]) => {
        const startX = landmarks[start][0] * scale + offsetX;
        const startY = landmarks[start][1] * scale + offsetY;
        const endX = landmarks[end][0] * scale + offsetX;
        const endY = landmarks[end][1] * scale + offsetY;
        drawLine([startX, startY], [endX, endY]);
    });
    
    // Draw landmarks with professional styling
    for (let i = 0; i < landmarks.length; i++) {
        const x = landmarks[i][0] * scale + offsetX;
        const y = landmarks[i][1] * scale + offsetY;
        
        // Add glow effect with pulse
        ctx.shadowColor = '#4a6fa5';
        ctx.shadowBlur = 8 * pulse;
        
        // Outer glow circle
        ctx.beginPath();
        ctx.arc(x, y, 8 * pulse, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(74, 111, 165, 0.3)';
        ctx.fill();
        
        // Reset shadow for inner circle
        ctx.shadowBlur = 0;
        
        // Main landmark point with gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 6 * pulse);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.7, '#89c0e6');
        gradient.addColorStop(1, '#4a6fa5');
        
        ctx.beginPath();
        ctx.arc(x, y, 6 * pulse, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Inner highlight
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, 2 * pulse, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
    }
}

// Helper function to draw a line between two points
function drawLine(start, end) {
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
    
    // Add subtle glow to lines
    ctx.shadowColor = '#4a6fa5';
    ctx.shadowBlur = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// Detect different hand gestures based on finger positions
function detectGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) return null; // Need at least 21 landmarks for a complete hand
    
    // Get the y-coordinates of finger tips and their corresponding base joints
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    // Get base joints
    const thumbBase = landmarks[1];
    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    const ringBase = landmarks[13];
    const pinkyBase = landmarks[17];
    
    // Calculate distances between finger tips and wrist
    const dist = (p1, p2) => Math.sqrt(
        Math.pow(p1[0] - p2[0], 2) + 
        Math.pow(p1[1] - p2[1], 2)
    );
    
    // Check for 'hello' - all fingers extended
    if (checkIfHandOpen(landmarks)) {
        return 'hello';
    }
    
    // Check for 'thanks' - thumb touching middle finger
    const thumbToMiddleDist = dist(thumbTip, middleTip);
    const thumbToMiddleBaseDist = dist(thumbTip, middleBase);
    if (thumbToMiddleDist < thumbToMiddleBaseDist * 0.3) {
        return 'thanks';
    }
    
    // Check for 'yes' - thumb and index finger touching (OK sign)
    const thumbToIndexDist = dist(thumbTip, indexTip);
    const thumbToIndexBaseDist = dist(thumbTip, indexBase);
    if (thumbToIndexDist < thumbToIndexBaseDist * 0.3) {
        // Check if other fingers are closed
        const middleExtended = dist(middleTip, wrist) > dist(middleBase, wrist) * 1.2;
        const ringExtended = dist(ringTip, wrist) > dist(ringBase, wrist) * 1.2;
        const pinkyExtended = dist(pinkyTip, wrist) > dist(pinkyBase, wrist) * 1.2;
        
        if (!middleExtended && !ringExtended && !pinkyExtended) {
            return 'yes';
        }
    }
    
    // Check for 'no' - index finger extended, others closed
    const indexExtended = dist(indexTip, wrist) > dist(indexBase, wrist) * 1.3;
    const middleClosed = dist(middleTip, wrist) < dist(middleBase, wrist) * 1.1;
    const ringClosed = dist(ringTip, wrist) < dist(ringBase, wrist) * 1.1;
    const pinkyClosed = dist(pinkyTip, wrist) < dist(pinkyBase, wrist) * 1.1;
    const thumbClosed = dist(thumbTip, wrist) < dist(thumbBase, wrist) * 1.1;
    
    if (indexExtended && middleClosed && ringClosed && pinkyClosed && thumbClosed) {
        return 'no';
    }
    
    // Check for 'help' - thumb and pinky extended, others closed
    const thumbExtended = dist(thumbTip, wrist) > dist(thumbBase, wrist) * 1.3;
    const pinkyExtended = dist(pinkyTip, wrist) > dist(pinkyBase, wrist) * 1.3;
    const indexClosed = dist(indexTip, wrist) < dist(indexBase, wrist) * 1.1;
    const middleRingClosed = dist(middleTip, wrist) < dist(middleBase, wrist) * 1.1 && 
                           dist(ringTip, wrist) < dist(ringBase, wrist) * 1.1;
    
    if (thumbExtended && pinkyExtended && indexClosed && middleRingClosed) {
        return 'help';
    }
    
    return null;
}

// Check if hand is open (simplified example)
function checkIfHandOpen(landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    
    // Indices of finger tips and their corresponding base joints
    const fingerTips = [4, 8, 12, 16, 20];
    const fingerBases = [2, 6, 10, 14, 18];
    
    // Calculate distance between two points
    const dist = (p1, p2) => Math.sqrt(
        Math.pow(p1[0] - p2[0], 2) + 
        Math.pow(p1[1] - p2[1], 2)
    );
    
    let extendedFingers = 0;
    
    for (let i = 1; i < 5; i++) { // Skip thumb (i=0) for simplicity
        const tipY = landmarks[fingerTips[i]][1];
        const baseY = landmarks[fingerBases[i]][1];
        
        if (tipY < baseY) { // If tip is above base (assuming hand is upright)
            extendedFingers++;
        }
    }
    
    return extendedFingers >= 4; // At least 4 fingers extended
}

// Update the detected word display and speak it immediately
function updateDetectedWord(gesture) {
    if (GESTURES[gesture]) {
        const word = GESTURES[gesture];
        
        // Update display immediately
        detectedWordElement.textContent = word;
        detectedWordElement.style.visibility = 'visible';
        detectedWordElement.style.opacity = '1';
        
        // Speak immediately if it's a new word or not currently speaking
        if (synth && word !== lastSpokenWord) {
            // Cancel any ongoing speech
            synth.cancel();
            
            // Create and speak the utterance
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'ar-SA';
            utterance.rate = 0.9;
            
            // Update tracking variables
            lastSpokenWord = word;
            isSpeaking = true;
            
            // Reset speaking flag when done
            utterance.onend = () => {
                isSpeaking = false;
            };
            
            // Speak the word
            synth.speak(utterance);
        }
    } else {
        detectedWordElement.style.opacity = '0';
        setTimeout(() => {
            detectedWordElement.style.visibility = 'hidden';
        }, 300);
    }
}

// Speak the detected word
function speakWord() {
    const word = speakButton.dataset.word;
    if (!word) return;
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.9;
    
    synth.speak(utterance);
}

// Start/stop voice recognition
function toggleVoiceRecognition() {
    if (recognition) {
        if (startListeningButton.classList.contains('listening')) {
            recognition.stop();
        } else {
            recognition.start();
            startListeningButton.innerHTML = '<span class="icon">🎤</span><span>جاري الاستماع...</span>';
            startListeningButton.classList.add('listening');
            transcriptElement.textContent = 'جاري الاستماع...';
        }
    }
}

// Show error message
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error';
    errorElement.textContent = message;
    
    // Insert at the top of the container
    const container = document.querySelector('.container');
    container.insertBefore(errorElement, container.firstChild);
    
    // Remove after 5 seconds
    setTimeout(() => {
        errorElement.remove();
    }, 5000);
}

// Set up event listeners
function setupEventListeners() {
    // Camera toggle button
    if (cameraToggleButton) {
        cameraToggleButton.addEventListener('click', toggleCamera);
    }
    
    // Speak button
    speakButton.addEventListener('click', speakWord);
    
    // Copy button
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const text = detectedWordElement.textContent;
            if (text && text !== 'سيظهر نص الترجمة هنا...') {
                navigator.clipboard.writeText(text).then(() => {
                    // Show feedback
                    const originalText = copyButton.innerHTML;
                    copyButton.innerHTML = '<i class="far fa-check"></i><span>تم النسخ</span>';
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                    }, 2000);
                });
            }
        });
    }
    
    // Clear button
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            detectedWordElement.textContent = 'سيظهر نص الترجمة هنا...';
        });
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        // Canvas CSS handles the display size, no need to change internal dimensions
        // The drawHandLandmarks function will recalculate scaling on each frame
    });
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners first
    setupEventListeners();
    
    // Initialize canvas with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Then initialize the app
    init().catch(error => {
        console.error('Error initializing app:', error);
        showError('حدث خطأ في تهيئة التطبيق. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
    });
});
