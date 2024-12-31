// ==UserScript==
// @name         Civitai Auto Liker
// @namespace    https://github.com/feveromo/scriptzoo
// @version      1.0.0
// @description  Automatically likes images on Civitai by clicking heart buttons
// @author       feveromo
// @match        https://civitai.com/*
// @grant        none
// ==/UserScript==

/*
 * Civitai Auto Liker
 * Purpose: Automatically likes images on Civitai by scrolling and clicking heart buttons
 * Key functionality:
 * - Rapid button clicking (processes buttons in batches of 15)
 * - Smooth auto-scrolling
 * - Cache management to avoid duplicate clicks
 * - Debug logging for troubleshooting
 */

(function() {
    'use strict';

    // Enable debug mode for detailed console logging
    const DEBUG = true;

    // Track buttons we've already clicked to avoid duplicates
    let cachedButtons = new Set();
    // Prevent multiple click sessions from running simultaneously
    let isProcessing = false;

    /**
     * Creates the floating "turbo click" button with styled appearance
     * @returns {HTMLButtonElement} Styled button element
     */
    const createButton = () => {
        const button = document.createElement('button');
        button.innerText = 'turbo click';
        // Position button in top-right corner with high z-index to ensure visibility
        button.style.cssText = `
            padding: 5px 10px;
            background-color: #ff0000;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
        `;
        return button;
    };

    /**
     * Processes all buttons on the page in batches, clicking heart buttons
     * @returns {Promise<number>} Number of new buttons clicked in this pass
     */
    const rapidClickAllButtons = async () => {
        const currentButtons = Array.from(document.querySelectorAll('button'));
        console.log(`Found ${currentButtons.length} total buttons on page`);
        
        let clickCount = 0;
        let likeButtonsFound = 0;

        // Process buttons in batches of 15 to avoid overwhelming the browser
        for (let i = 0; i < currentButtons.length; i += 15) {
            for (let j = 0; j < 15; j++) {
                const button = currentButtons[i + j];
                if (!button) continue;
                
                // Debug logging for button inspection
                console.log('Checking button:', {
                    className: button.className,
                    innerHTML: button.innerHTML,
                    parentElement: button.parentElement?.className
                });

                // Identify like buttons by their Mantine UI class and heart emoji
                const isLikeButton = (
                    button.className.includes('mantine-Button-root') && 
                    button.innerHTML.includes('❤️') &&
                    button.parentElement?.className.includes('flex items-center justify-center')
                );
                
                if (isLikeButton) {
                    likeButtonsFound++;
                    if (!cachedButtons.has(button)) {
                        try {
                            button.click();
                            cachedButtons.add(button);
                            clickCount++;
                            console.log('Successfully clicked like button');
                        } catch (error) {
                            console.error('Button click error:', error);
                        }
                    }
                }
            }
            // Small delay between batches to prevent browser lag
            await new Promise(resolve => setTimeout(resolve, 4));
        }

        console.log(`Like buttons found: ${likeButtonsFound}`);
        console.log(`New buttons clicked: ${clickCount}`);

        return clickCount;
    };

    /**
     * Smoothly scrolls the page down by 1.5 viewport heights
     * @returns {Promise<boolean>} False if bottom of page reached, true otherwise
     */
    const performScroll = async () => {
        const scrollElement = document.documentElement || document.body;
        const currentPosition = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );

        // Check if we've reached the bottom of the page
        if (currentPosition >= scrollHeight - window.innerHeight) {
            return false;
        }

        // Scroll by 1.5 viewport heights for efficient page coverage
        window.scrollTo({
            top: currentPosition + (window.innerHeight / 1.5),
            behavior: 'smooth'
        });

        // Allow time for new content to load
        await new Promise(resolve => setTimeout(resolve, 100));

        return true;
    };

    /**
     * Main function that coordinates scrolling and clicking
     * Runs for a maximum of 9 seconds before prompting for reload
     */
    const turboScrollAndClick = async () => {
        const totalDuration = 9000; // 9 seconds maximum runtime
        const startTime = Date.now();
        let totalClicks = 0;

        const processFrame = async () => {
            if (Date.now() - startTime < totalDuration) {
                const clicks = await rapidClickAllButtons();
                totalClicks += clicks;

                if (clicks > 0) {
                    console.log(`current clicks: ${totalClicks}`);
                }

                if (!await performScroll()) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                requestAnimationFrame(processFrame);
            } else {
                console.log(`%c=== Final Results ===`, 'color: green; font-weight: bold');
                console.log(`Total time: ${Date.now() - startTime}ms`);
                console.log(`Total clicks: ${totalClicks}`);
                cleanup();
                
                // Ask user before reloading to allow viewing of results
                if (confirm('Clicking complete! Would you like to reload the page?')) {
                    location.reload();
                }
            }
        };

        // Debug session logging
        if (DEBUG) {
            console.log('%c=== Starting New Click Session ===', 'color: blue; font-weight: bold');
            console.log('Time started:', new Date().toLocaleTimeString());
        }

        requestAnimationFrame(processFrame);
    };

    /**
     * Cleans up resources and caches after script completion
     * Important for memory management and preventing duplicate clicks
     */
    const cleanup = () => {
        cachedButtons.clear();
        // Clear browser caches to prevent memory bloat
        if ('caches' in window) {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
        }
        if (window.gc) window.gc();
    };

    /**
     * Initializes the script by creating and attaching the turbo click button
     * Uses body-level attachment for reliable positioning
     */
    const init = () => {
        const button = createButton();
        document.body.appendChild(button);

        button.addEventListener('click', async function() {
            if (isProcessing) return;
            isProcessing = true;

            try {
                await turboScrollAndClick();
            } catch (error) {
                console.error('Error:', error);
                cleanup();
            } finally {
                isProcessing = false;
            }
        });
    };

    // Initialize as soon as possible, but ensure DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();