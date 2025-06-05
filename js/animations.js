// Animation functionality for Tech Tee Up Golf & Tennis Charity Auction
document.addEventListener('DOMContentLoaded', () => {
  // Add data-animate attribute to auction items
  const auctionItems = document.querySelectorAll('.auction-item');
  auctionItems.forEach(item => {
    item.setAttribute('data-animate', 'fade-in');
  });

  // Set up the Intersection Observer for fade-in animations
  const animateElements = document.querySelectorAll('[data-animate="fade-in"]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add animated class to trigger the animation
        entry.target.classList.add('animated');
        // Stop observing the element after it's animated
        observer.unobserve(entry.target);
      }
    });
  }, {
    root: null, // viewport
    threshold: 0.1, // trigger when 10% of the element is visible
    rootMargin: '0px 0px -50px 0px' // slightly before the element comes into view
  });

  // Observe each element with data-animate attribute
  animateElements.forEach(element => {
    observer.observe(element);
  });

  // Add scroll event listener for header shadow
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Add animation for current bid updates
  const setupBidPulseAnimation = () => {
    // This will be triggered by the real-time updates in app.js
    window.animateBidUpdate = (itemId) => {
      const bidElement = document.querySelector(`.auction-item[data-id="${itemId}"] .current-bid`);
      if (bidElement) {
        bidElement.classList.add('bid-updated');
        setTimeout(() => {
          bidElement.classList.remove('bid-updated');
        }, 2000);
      }
    };
  };
  
  setupBidPulseAnimation();
});
