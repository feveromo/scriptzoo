// ==UserScript==
// @name         GitHub Repo Filter
// @namespace    https://github.com/feveromo
// @version      1.1
// @description  Filters GitHub repositories by star count, hiding those with fewer than a specified number of stars.
// @author       feveromo
// @match        https://github.com/topics/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Minimum number of stars to show.
    let minStars = 5;

    // Add debug panel styles
    GM_addStyle(`
        /* Debug Panel */
        #debug-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--color-canvas-default, #fff);
            border: 1px solid var(--color-border-default, #d0d7de);
            border-radius: 6px;
            padding: 12px;
            max-width: 350px;
            max-height: 400px;
            overflow: auto;
            z-index: 9999;
            box-shadow: var(--color-shadow-medium, 0 8px 24px rgba(140,149,159,0.2));
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        }

        .debug-entry {
            margin-bottom: 8px;
            font-size: 12px;
            color: var(--color-fg-default, #24292f);
            line-height: 1.4;
        }

        /* Controls Container */
        #controls-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 8px;
            z-index: 10000;
        }

        /* Common button/input styles */
        .github-filter-btn {
            padding: 5px 12px;
            font-size: 12px;
            font-weight: 500;
            line-height: 20px;
            color: var(--color-btn-text, #24292f);
            background-color: var(--color-btn-bg, #f6f8fa);
            border: 1px solid var(--color-btn-border, rgba(31,35,40,0.15));
            border-radius: 6px;
            box-shadow: var(--color-btn-shadow, 0 1px 0 rgba(31,35,40,0.04));
            cursor: pointer;
            transition: .2s cubic-bezier(0.3, 0, 0.5, 1);
        }

        .github-filter-btn:hover {
            background-color: var(--color-btn-hover-bg, #f3f4f6);
            border-color: var(--color-btn-hover-border, rgba(31,35,40,0.15));
        }

        /* Star Filter Controls */
        #star-filter-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--color-canvas-default, #fff);
            padding: 6px 12px;
            border: 1px solid var(--color-border-default, #d0d7de);
            border-radius: 6px;
            box-shadow: var(--color-shadow-medium, 0 8px 24px rgba(140,149,159,0.2));
        }

        #star-filter-controls label {
            font-size: 12px;
            font-weight: 500;
            color: var(--color-fg-default, #24292f);
        }

        #min-stars-input {
            width: 70px;
            padding: 3px 8px;
            font-size: 12px;
            border: 1px solid var(--color-border-default, #d0d7de);
            border-radius: 4px;
            color: var(--color-fg-default, #24292f);
        }

        #min-stars-input:focus {
            border-color: var(--color-accent-fg, #0969da);
            outline: none;
            box-shadow: 0 0 0 3px rgba(9,105,218,0.3);
        }

        #debug-panel.hidden {
            display: none;
        }
    `);

    // Create a container for all controls
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'controls-container';
    document.body.appendChild(controlsContainer);

    // Create debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.classList.add('hidden');
    document.body.appendChild(debugPanel);

    // Create star filter controls
    const starFilterControls = document.createElement('div');
    starFilterControls.id = 'star-filter-controls';
    starFilterControls.innerHTML = `
        <label for="min-stars-input">Min Stars:</label>
        <input type="number" id="min-stars-input" value="${minStars}" min="0">
    `;

    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-debug';
    toggleButton.className = 'github-filter-btn';
    toggleButton.textContent = 'Toggle Debug';

    // Add controls to container in desired order
    controlsContainer.appendChild(starFilterControls);
    controlsContainer.appendChild(toggleButton);

    // Add event listeners
    toggleButton.addEventListener('click', () => {
        debugPanel.classList.toggle('hidden');
    });

    const minStarsInput = document.getElementById('min-stars-input');
    minStarsInput.addEventListener('change', () => {
        const newValue = parseInt(minStarsInput.value, 10);
        if (!isNaN(newValue) && newValue >= 0) {
            minStars = newValue;
            debugLog(`Updated minimum stars to: ${minStars}`);
            debouncedFilter(); // Re-run the filter with new value
        }
    });

    function debugLog(message, category = 'INFO') {
        const entry = document.createElement('div');
        entry.className = 'debug-entry';
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${category}] ${timestamp}: ${message}`;
        debugPanel.insertBefore(entry, debugPanel.firstChild);
        console.log(`[${category}] ${timestamp}: ${message}`);
    }

    function parseStarCount(text) {
        if (!text) return 0;

        text = text.trim().toLowerCase();

        // Handle 'k' suffix
        if (text.endsWith('k')) {
            return parseFloat(text.replace('k', '')) * 1000;
        }

        // Handle 'm' suffix for millions
        if (text.endsWith('m')) {
            return parseFloat(text.replace('m', '')) * 1000000;
        }

        return parseFloat(text.replace(',', '')) || 0;
    }

    function findRepoContainer() {
        // Try different possible selectors
        const selectors = [
            '[data-testid="grid"]',
            '.topic-repositories',
            '.repo-list',
            '.Box-row',
            '.col-12.d-block'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                debugLog(`Found container with selector: ${selector}`);
                debugLog(`Found repository container using selector: ${selector}`, 'INFO');
                return container;
            }
        }
        debugLog('Repository container not found using any selector', 'WARN');
        return null;
    }

    function dumpPageInfo() {
        debugLog('=== Page Information ===');
        debugLog(`URL: ${window.location.href}`);
        debugLog(`readyState: ${document.readyState}`);

        // Try to find any repository-related elements
        const possibleSelectors = [
            'article.Box-row',
            '.repo-list-item',
            '[data-repository-id]',
            '.col-12.d-block',
            // Add more selectors here
            '.repository-content',
            '#repository-container-header',
            '.repo-list',
            '.topic-repositories'
        ];

        debugLog('=== Element Search Results ===');
        possibleSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            debugLog(`${selector}: ${elements.length} elements found`);
            if (elements.length > 0) {
                debugLog(`First element HTML: ${elements[0].outerHTML.slice(0, 150)}...`);
            }
        });

        // Dump the first level of body content
        debugLog('=== Body Direct Children ===');
        Array.from(document.body.children).forEach((child, index) => {
            debugLog(`Child ${index}: <${child.tagName.toLowerCase()}> class="${child.className}"`);
        });
    }

    function findRepoItems() {
        // Updated selectors based on the current GitHub structure
        const selectors = [
            'article.border.rounded.color-shadow-small', // New GitHub topics page structure
            'article[data-hydro-click]', // Alternative selector
            'article.Box-row', // Keep old selector as fallback
            '.repo-list-item',
            '[data-repository-id]',
            '.col-12.d-block'
        ];

        for (const selector of selectors) {
            const items = document.querySelectorAll(selector);
            if (items.length > 0) {
                debugLog(`Found ${items.length} repos with selector: ${selector}`);
                debugLog(`Found ${items.length} repository items using selector: ${selector}`, 'INFO');
                return items;
            }
        }

        // If we didn't find anything, try looking deeper
        const mainContent = document.querySelector('main');
        if (mainContent) {
            debugLog('Found main content, searching for articles...');
            debugLog('Found main content, searching for articles...', 'DEBUG');
            const articles = mainContent.querySelectorAll('article');
            if (articles.length > 0) {
                debugLog(`Found ${articles.length} articles directly`);
                debugLog(`Found ${articles.length} articles directly`, 'DEBUG');
                return articles;
            }
        }

        debugLog('No repositories found with any selector');
        debugLog('No repositories found on the page', 'WARN');
        dumpPageInfo();
        return [];
    }

    function findStarCount(repoItem) {
        // Try different methods to find star count
        const selectors = [
            // New GitHub format - repo-stars-counter-star
            '#repo-stars-counter-star',
            '[id$="repo-stars-counter-star"]',
            // Counter elements in stargazer links
            '[href$="/stargazers"] .Counter',
            'a[href*="stargazers"] .Counter',
            // Social count elements
            '.social-count[href*="stargazers"]',
            // Backup - any counter near star icon
            '.octicon-star + .Counter',
            '.octicon-star ~ .Counter'
        ];

        for (const selector of selectors) {
            const element = repoItem.querySelector(selector);
            if (element) {
                const text = element.textContent.trim();
                debugLog(`Found star count with selector: ${selector}`);
                // debugLog(`Star count element HTML: ${element.outerHTML}`);
                debugLog(`Raw star count text: "${text}"`);
                debugLog(`Found star count using selector: ${selector}`, 'INFO');
                debugLog(`Raw star count text: "${text}"`, 'DEBUG');
                return text;
            }
        }

        // If we can't find it with selectors, try finding it in the text
        const text = repoItem.textContent;

        // Look for numbers followed by "stars" or "star"
        const starMatch = text.match(/(\d+\.?\d*[km]?)\s*stars?/i);
        if (starMatch) {
            debugLog(`Found star count in text: ${starMatch[1]}`);
            return starMatch[1];
        }

        // Look for numbers in aria-label attributes containing "star"
        const starElements = repoItem.querySelectorAll('[aria-label*="star"]');
        for (const el of starElements) {
            const ariaLabel = el.getAttribute('aria-label');
            const match = ariaLabel?.match(/(\d+\.?\d*[km]?)\s*(?:star|user)/i);
            if (match) {
                debugLog(`Found star count in aria-label: ${match[1]}`);
                return match[1];
            }
        }

        debugLog('No star count found');
        debugLog('Could not find star count for a repository', 'WARN');
        return null;
    }

    let isFiltering = false;
    let filterTimeout = null;
    let filterQueued = false;
    let lastFilterTime = 0;

    function debounce(func, wait) {
        return function executedFunction(...args) {
            const now = Date.now();

            // If we haven't filtered recently, run immediately
            if (now - lastFilterTime > wait) {
                lastFilterTime = now;
                func.apply(this, args);
                return;
            }

            // Otherwise use normal debounce
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                lastFilterTime = Date.now();
                func.apply(this, args);
            }, wait);
        };
    }

    const debouncedFilter = debounce(() => {
        if (isFiltering) {
            filterQueued = true;
            debugLog('Filter operation queued...');
            return;
        }

        isFiltering = true;
        try {
            filterRepositories();
        } finally {
            isFiltering = false;
            if (filterQueued) {
                filterQueued = false;
                debugLog('Processing queued filter operation...');
                setTimeout(debouncedFilter, 100);
            }
        }
    }, 250);

    function handleLoadMore(e) {
        debugLog('Load more detected - scheduling filter');
        debugLog('Load more button clicked, scheduling filter operation', 'INFO');

        // Clear any existing timeouts
        clearTimeout(filterTimeout);

        // Force a new filter operation after content loads
        const checkAndFilter = () => {
            // Check if new repos have been added
            const newRepos = findRepoItems().filter(repo => !repo.hasAttribute('data-star-processed'));
            if (newRepos.length > 0) {
                debugLog(`Found ${newRepos.length} new repos after load more`);
                filterQueued = false; // Reset queue
                debouncedFilter(); // Run filter
            } else {
                debugLog('No repos found yet, retrying...');
                setTimeout(checkAndFilter, 100);
            }
        };

        // Start checking after a short delay
        setTimeout(checkAndFilter, 250);
    }

    // Update click handler
    document.addEventListener('click', (e) => {
        if (e.target.matches('.ajax-pagination-btn')) {
            debugLog('Load more button clicked');
            handleLoadMore(e);
        }
    }, true); // Use capture phase

    // Update form handler
    document.addEventListener('submit', (e) => {
        if (e.target.matches('.ajax-pagination-form')) {
            debugLog('Load more form submitted');
            isFiltering = false; // Reset filtering state
            handleLoadMore(e);
        }
    }, true); // Use capture phase

    // Update the observer to be more aggressive with changes
    function setupObserver() {
        debugLog('Setting up observers...');
        debugLog('Setting up mutation observer to watch for changes', 'INFO');

        const mainContent = document.querySelector('main');
        if (!mainContent) {
            debugLog('Main content not found, observing body');
            return;
        }

        const observer = new MutationObserver((mutations) => {
            let shouldFilter = false;

            for (const mutation of mutations) {
                // Check for new nodes added to the main content
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes.length > 0) {
                        debugLog(`Detected ${mutation.addedNodes.length} new nodes`);
                        shouldFilter = true;
                        break;
                    }
                }
                // Check for specific star count updates
                else if (mutation.type === 'attributes' &&
                         (mutation.target.matches('#repo-stars-counter-star') ||
                          mutation.target.matches('[href$="/stargazers"] .Counter') ||
                          mutation.target.matches('.social-count[href*="stargazers"]') ||
                          mutation.target.matches('[data-repository-id]'))) {
                    shouldFilter = true;
                    break;
                }
            }

            if (shouldFilter) {
                debugLog('Content change detected - triggering filter');
                debouncedFilter();
            }
        });

        observer.observe(mainContent, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id', 'href', 'data-repository-id', 'data-turbo-replace', 'class']
        });

        debugLog('Observer setup complete on main content');
    }

    // Modify the filterRepositories function to be more efficient
    function filterRepositories() {
        debugLog('Starting repository filter...');
        debugLog('Starting repository filtering', 'INFO');

        const repoItems = findRepoItems();
        if (!repoItems.length) {
            debugLog('No repositories found');
            return false;
        }

        debugLog(`Found ${repoItems.length} repositories`);
        let hiddenCount = 0;
        let shownCount = 0;

        repoItems.forEach((repoItem, index) => {
            try {
                const starCountText = findStarCount(repoItem);

                if (!starCountText) {
                    debugLog(`No star count found for repo ${index + 1}`);
                    debugLog(`Could not find star count for repository ${index + 1}`, 'WARN');
                    return;
                }

                const starCount = parseStarCount(starCountText);

                debugLog(`Repo ${index + 1}: "${starCountText}" → ${starCount} stars`);
                debugLog(`Repository ${index + 1}: "${starCountText}" parsed to ${starCount} stars`, 'DEBUG');

                if (starCount < minStars) {
                    repoItem.style.display = 'none';
                    hiddenCount++;
                } else {
                    repoItem.style.display = '';
                    shownCount++;
                    repoItem.setAttribute('data-star-processed', 'true');
                }
            } catch (error) {
                debugLog(`Error processing repo ${index + 1}: ${error.message}`);
                debugLog(`Error processing repository ${index + 1}: ${error.message}`, 'ERROR');
            }
        });

        debugLog(`Filter complete: ${shownCount} shown, ${hiddenCount} hidden`);
        isFiltering = false;
        return true;
    }

    // Retry mechanism
    function retryFilter(maxAttempts = 5, delay = 2000) {
        let attempts = 0;

        function attempt() {
            debugLog(`Attempt ${attempts + 1} of ${maxAttempts}`);

            if (filterRepositories()) {
                debugLog('Successfully filtered repositories');
                setupObserver();
            } else if (attempts < maxAttempts - 1) {
                attempts++;
                debugLog(`Retrying in ${delay}ms...`);
                setTimeout(attempt, delay);
            } else {
                debugLog('Max attempts reached. Please check if you are on a valid GitHub topics or search page.');
            }
        }

        attempt();
    }

    // Start the script with a longer initial delay
    debugLog('Script initialized, waiting for page load...');
    debugLog('Script initialized, waiting for page to load', 'INFO');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            debugLog('DOMContentLoaded fired');
            debugLog('DOMContentLoaded event fired', 'INFO');
            setTimeout(() => {
                debugLog('Running initial page dump...');
                debugLog('Running initial page analysis', 'INFO');
                dumpPageInfo();
                retryFilter();
            }, 3000);
        });
    } else {
        debugLog('Page already loaded, running immediately');
        debugLog('Page already loaded, running script immediately', 'INFO');
        setTimeout(() => {
            dumpPageInfo();
            retryFilter();
        }, 3000);
    }
})();
