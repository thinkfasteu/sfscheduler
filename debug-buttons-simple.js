// NUCLEAR OPTION: Completely new, simple button system
// This bypasses ALL existing systems

console.log('🚀 NUCLEAR BUTTON SYSTEM LOADING...');

// Wait for DOM, then bind buttons with zero complexity
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM ready, binding buttons...');
  
  // Generate button
  const generateBtn = document.getElementById('generateScheduleBtn');
  if (generateBtn) {
    console.log('🎯 Found generate button, binding...');
    generateBtn.onclick = () => {
      alert('🔥 GENERATE BUTTON NUCLEAR SUCCESS! 🔥');
      console.log('Generate clicked - window.handlers:', window.handlers);
      if (window.handlers?.generateNewSchedule) {
        window.handlers.generateNewSchedule();
      }
    };
    console.log('✅ Generate button bound');
  } else {
    console.error('❌ Generate button not found');
  }
  
  // Clear button
  const clearBtn = document.getElementById('clearScheduleBtn');
  if (clearBtn) {
    console.log('🧹 Found clear button, binding...');
    clearBtn.onclick = () => {
      alert('🧹 CLEAR BUTTON NUCLEAR SUCCESS! 🧹');
      console.log('Clear clicked - window.handlers:', window.handlers);
      if (window.handlers?.clearSchedule) {
        window.handlers.clearSchedule();
      }
    };
    console.log('✅ Clear button bound');
  } else {
    console.error('❌ Clear button not found');
  }
  
  console.log('🚀 NUCLEAR BUTTON SYSTEM COMPLETE!');
});

console.log('🚀 NUCLEAR BUTTON SYSTEM INITIALIZED!');