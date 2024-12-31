// ==UserScript==
// @name         Instagram Auto Unfollow
// @namespace    https://github.com/feveromo/scriptzoo
// @version      1.0
// @description  Automatically unfollow Instagram users after manually loading all following list
// @author       feveromo
// @match        https://www.instagram.com/*
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    // Configuration
    const CONFIG = {
        UNFOLLOW_DELAY: 1000,    // 1 second between unfollows
        BATCH_SIZE: 20,          // Number of unfollows per batch
        BATCH_DELAY: 5000,       // 5 second pause between batches
        MAX_UNFOLLOWS: 200       // Maximum number of unfollows per session
    };

    // Helper function for delays
    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function unfollowUser() {
        try {
            // Find all Following buttons that are visible
            const followingBtns = document.querySelectorAll('button._acan._acap._acat._aj1-._ap30');
            
            for (const btn of followingBtns) {
                if (btn.offsetParent !== null) {
                    console.log('Found following button, clicking...');
                    btn.click();
                    await sleep(1000);

                    const unfollowBtn = document.querySelector('button._a9--._ap36._a9-_');
                    if (unfollowBtn) {
                        console.log('Confirming unfollow...');
                        unfollowBtn.click();
                        return true;
                    }
                }
            }
            
            console.log('No more following buttons found');
            return false;
        } catch (error) {
            console.error('Error while unfollowing:', error);
            return false;
        }
    }

    async function startUnfollowing() {
        let unfollowCount = 0;

        try {
            while (unfollowCount < CONFIG.MAX_UNFOLLOWS) {
                // Process batch of users
                for (let i = 0; i < CONFIG.BATCH_SIZE; i++) {
                    const success = await unfollowUser();
                    if (success) {
                        unfollowCount++;
                        console.log(`Unfollowed user #${unfollowCount}/${CONFIG.MAX_UNFOLLOWS}`);
                        await sleep(CONFIG.UNFOLLOW_DELAY);
                    } else {
                        console.log('No more users to unfollow, stopping...');
                        return;
                    }
                }
                
                console.log(`Completed batch. Pausing for ${CONFIG.BATCH_DELAY/1000}s...`);
                await sleep(CONFIG.BATCH_DELAY);
            }
            
            console.log(`Reached maximum unfollows (${CONFIG.MAX_UNFOLLOWS}). Stopping.`);
        } catch (error) {
            console.error('Fatal error in unfollow process:', error);
        }
    }

    // Create floating info panel
    const infoPanel = document.createElement('div');
    infoPanel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 10px;
        z-index: 9999;
        padding: 15px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 4px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        max-width: 300px;
    `;
    infoPanel.innerHTML = `
        <strong>Instructions:</strong><br>
        1. Open your Following list<br>
        2. Manually scroll to load ALL users<br>
        3. Click "Start Unfollowing" button<br>
        <br>
        <em>Note: Script will stop when no more<br>loaded users are found</em>
    `;
    document.body.appendChild(infoPanel);

    // Add start button
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Unfollowing';
    startButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        padding: 10px;
        background: #0095f6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    startButton.addEventListener('click', () => {
        startButton.disabled = true;
        startButton.textContent = 'Unfollowing...';
        startUnfollowing().finally(() => {
            startButton.disabled = false;
            startButton.textContent = 'Start Unfollowing';
        });
    });

    document.body.appendChild(startButton);
})();
