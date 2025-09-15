// Slide management system
let currentSlideIndex = 0;
const slides = document.querySelectorAll('.slide');
const totalSlides = slides.length;

// Initialize slides
function initializeSlides() {
    // Set background images for each slide
    slides.forEach((slide, index) => {
        const bgImage = slide.getAttribute('data-bg');
        if (bgImage) {
            slide.style.backgroundImage = `url('${bgImage}')`;
        }
    });

    // Update counter
    document.getElementById('current-slide').textContent = currentSlideIndex + 1;
    document.getElementById('total-slides').textContent = totalSlides;
    
    // Update progress bar
    updateProgressBar();
    
    // Add animation classes
    setTimeout(() => {
        const currentSlide = slides[currentSlideIndex];
        if (currentSlide) {
            const content = currentSlide.querySelector('.slide-content');
            if (content) {
                content.classList.add('fade-in');
            }
        }
    }, 100);
}

// Update progress bar
function updateProgressBar() {
    const progressFill = document.querySelector('.progress-fill');
    const progress = ((currentSlideIndex + 1) / totalSlides) * 100;
    progressFill.style.width = `${progress}%`;
}

// Show specific slide
function showSlide(index) {
    // Validate index
    if (index < 0 || index >= totalSlides) {
        return;
    }

    // Remove active class from all slides
    slides.forEach((slide, i) => {
        slide.classList.remove('active', 'prev');
        if (i < index) {
            slide.classList.add('prev');
        }
    });

    // Add active class to current slide
    slides[index].classList.add('active');
    
    // Update current slide index
    currentSlideIndex = index;
    
    // Update counter and progress bar
    document.getElementById('current-slide').textContent = currentSlideIndex + 1;
    updateProgressBar();
    
    // Add entrance animation to slide content
    setTimeout(() => {
        const currentSlide = slides[currentSlideIndex];
        if (currentSlide) {
            const content = currentSlide.querySelector('.slide-content');
            const navigation = currentSlide.querySelector('.slide-navigation');
            
            if (content) {
                content.classList.add('slide-up');
            }
            
            if (navigation) {
                navigation.classList.add('fade-in');
            }
        }
    }, 300);
    
    // Scroll to top of slide for mobile
    if (window.innerWidth <= 768) {
        slides[index].scrollTop = 0;
    }
    
    // Analytics or tracking could go here
    trackSlideView(index);
}

// Navigate to next slide
function nextSlide() {
    if (currentSlideIndex < totalSlides - 1) {
        showSlide(currentSlideIndex + 1);
    }
}

// Navigate to previous slide
function prevSlide() {
    if (currentSlideIndex > 0) {
        showSlide(currentSlideIndex - 1);
    }
}

// Go to specific slide (for navigation menu if needed)
function goToSlide(index) {
    showSlide(index);
}

// Keyboard navigation
function handleKeyNavigation(event) {
    switch(event.key) {
        case 'ArrowRight':
        case ' ': // Spacebar
            event.preventDefault();
            nextSlide();
            break;
        case 'ArrowLeft':
            event.preventDefault();
            prevSlide();
            break;
        case 'Home':
            event.preventDefault();
            showSlide(0);
            break;
        case 'End':
            event.preventDefault();
            showSlide(totalSlides - 1);
            break;
        case 'Escape':
            // Could add exit fullscreen or return to app functionality
            break;
    }
}

// Touch/swipe navigation for mobile
let touchStartX = null;
let touchStartY = null;

function handleTouchStart(event) {
    const firstTouch = event.touches[0];
    touchStartX = firstTouch.clientX;
    touchStartY = firstTouch.clientY;
}

function handleTouchMove(event) {
    if (!touchStartX || !touchStartY) {
        return;
    }

    const touchEndX = event.touches[0].clientX;
    const touchEndY = event.touches[0].clientY;
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    // Only handle horizontal swipes that are more horizontal than vertical
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        event.preventDefault();
        
        if (diffX > 0) {
            // Swipe left - next slide
            nextSlide();
        } else {
            // Swipe right - previous slide
            prevSlide();
        }
        
        touchStartX = null;
        touchStartY = null;
    }
}

function handleTouchEnd(event) {
    touchStartX = null;
    touchStartY = null;
}

// Track slide views (for analytics)
function trackSlideView(slideIndex) {
    const slideElement = slides[slideIndex];
    const slideId = slideElement ? slideElement.id : `slide-${slideIndex}`;
    
    // Console log for debugging
    console.log(`Viewing slide: ${slideId} (${slideIndex + 1}/${totalSlides})`);
    
    // Google Analytics tracking (if available)
    if (typeof gtag !== 'undefined') {
        gtag('event', 'slide_view', {
            'slide_name': slideId,
            'slide_index': slideIndex + 1,
            'slide_total': totalSlides
        });
    }
    
    // Alternative tracking methods could go here
    // localStorage tracking for session analytics
    const sessionData = JSON.parse(localStorage.getItem('slideSession') || '{}');
    sessionData[slideId] = (sessionData[slideId] || 0) + 1;
    sessionData.lastViewed = slideIndex;
    sessionData.timestamp = Date.now();
    localStorage.setItem('slideSession', JSON.stringify(sessionData));
}

// Auto-advance slides (optional feature)
let autoAdvanceTimer = null;

function startAutoAdvance(intervalMs = 30000) {
    stopAutoAdvance();
    autoAdvanceTimer = setInterval(() => {
        if (currentSlideIndex < totalSlides - 1) {
            nextSlide();
        } else {
            stopAutoAdvance();
        }
    }, intervalMs);
}

function stopAutoAdvance() {
    if (autoAdvanceTimer) {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }
}

// Pause auto-advance on user interaction
function pauseAutoAdvance() {
    stopAutoAdvance();
    // Restart after 30 seconds of inactivity (if desired)
    setTimeout(() => {
        // Could restart auto-advance here if no recent user activity
    }, 30000);
}

// Full-screen API support
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSlides();
    
    // Add event listeners
    document.addEventListener('keydown', handleKeyNavigation);
    
    // Touch navigation for mobile
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Stop auto-advance on any user interaction
    document.addEventListener('click', pauseAutoAdvance);
    document.addEventListener('keydown', pauseAutoAdvance);
    document.addEventListener('touchstart', pauseAutoAdvance);
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(event) {
        if (event.state && typeof event.state.slideIndex === 'number') {
            showSlide(event.state.slideIndex);
        }
    });
    
    // Update URL when slide changes (for bookmarking)
    const originalShowSlide = showSlide;
    showSlide = function(index) {
        originalShowSlide(index);
        
        // Update URL hash
        const slideElement = slides[index];
        const slideId = slideElement ? slideElement.id : `slide-${index}`;
        
        // Use pushState to update URL without triggering navigation
        history.replaceState(
            { slideIndex: index }, 
            `Slide ${index + 1}`, 
            `#${slideId}`
        );
    };
    
    // Handle direct URL navigation
    const hash = window.location.hash.substring(1);
    if (hash) {
        const targetSlide = document.getElementById(hash);
        if (targetSlide) {
            const slideIndex = Array.from(slides).indexOf(targetSlide);
            if (slideIndex !== -1) {
                showSlide(slideIndex);
            }
        }
    }
    
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Re-initialize any size-dependent features
            updateProgressBar();
        }, 250);
    });
    
    // Handle visibility change (for pausing/resuming auto-advance)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopAutoAdvance();
        }
    });
    
    // Print functionality
    window.addEventListener('beforeprint', function() {
        // Show all slides for printing
        slides.forEach(slide => {
            slide.style.position = 'static';
            slide.style.opacity = '1';
            slide.style.transform = 'none';
            slide.style.pageBreakAfter = 'always';
        });
    });
    
    window.addEventListener('afterprint', function() {
        // Restore slide behavior after printing
        slides.forEach((slide, index) => {
            slide.style.position = 'absolute';
            if (index === currentSlideIndex) {
                slide.style.opacity = '1';
                slide.style.transform = 'translateX(0)';
            } else {
                slide.style.opacity = '0';
                slide.style.transform = index < currentSlideIndex ? 'translateX(-100px)' : 'translateX(100px)';
            }
            slide.style.pageBreakAfter = 'auto';
        });
    });
});

// Export functions for global access
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.goToSlide = goToSlide;
window.toggleFullscreen = toggleFullscreen;
window.startAutoAdvance = startAutoAdvance;
window.stopAutoAdvance = stopAutoAdvance;

// Utility functions for external integration
window.getCurrentSlide = () => currentSlideIndex;
window.getTotalSlides = () => totalSlides;
window.getSlideData = () => ({
    current: currentSlideIndex,
    total: totalSlides,
    progress: ((currentSlideIndex + 1) / totalSlides) * 100
});