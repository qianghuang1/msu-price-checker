// Popup script for Chrome extension
let currentSearchResults = [];
let currentItemDetails = null;

// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const loading = document.getElementById('loading');
const searchResults = document.getElementById('searchResults');
const itemDetails = document.getElementById('itemDetails');
const resultsContainer = document.getElementById('resultsContainer');
const itemDetailsContent = document.getElementById('itemDetailsContent');
const backBtn = document.getElementById('backBtn');

// Enhancement type mappings
const ENHANCEMENT_TYPES = {
    'Black Cube': 5062010,
    'Occult Cube': 2711000,
    'Bonus Occult Cube': 2730000
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Check if there are recent search results
    const storage = await chrome.storage.local.get(['lastSearchResults', 'lastSearchKeyword', 'lastSearchTimestamp']);
    
    if (storage.lastSearchResults && storage.lastSearchTimestamp) {
        const timeDiff = Date.now() - storage.lastSearchTimestamp;
        // Show results if they're less than 5 minutes old
        if (timeDiff < 5 * 60 * 1000) {
            searchInput.value = storage.lastSearchKeyword || '';
            displaySearchResults(storage.lastSearchResults);
        }
    }
});

// Search button event listener
searchBtn.addEventListener('click', () => {
    const keyword = searchInput.value.trim();
    if (keyword) {
        searchItems(keyword);
    }
});

// Enter key support for search
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const keyword = searchInput.value.trim();
        if (keyword) {
            searchItems(keyword);
        }
    }
});

// Back button event listener
backBtn.addEventListener('click', () => {
    showSearchResults();
});

// Search for items
async function searchItems(keyword) {
    showLoading();
    
    try {
        const searchUrl = `https://msu.io/navigator/api/navigator/search?keyword=${encodeURIComponent(keyword)}`;
        const response = await fetch(searchUrl);
        const apiData = await response.json();
        
        // Transform the API response to match expected format
        const data = {
            items: apiData.records ? apiData.records.map(record => ({
                itemId: record.plainItem?.itemId,
                itemName: record.plainItem?.itemName,
                imageUrl: record.imageUrl,
                category: record.plainItem?.category,
                tokenType: record.plainItem?.tokenType
            })).filter(item => item.itemId && item.itemName) : []
        };
        
        // Store results
        chrome.storage.local.set({
            lastSearchResults: data,
            lastSearchKeyword: keyword,
            lastSearchTimestamp: Date.now()
        });
        
        displaySearchResults(data);
    } catch (error) {
        console.error('Error searching items:', error);
        showError('Failed to search items. Please try again.');
    }
}

// Display search results
function displaySearchResults(data) {
    currentSearchResults = data;
    resultsContainer.innerHTML = '';
    
    if (!data || !data.items || data.items.length === 0) {
        resultsContainer.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.8;">No items found</div>';
        showSearchResults();
        return;
    }
    
    data.items.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                ${item.imageUrl ? `<img src="${item.imageUrl}" style="width: 32px; height: 32px; border-radius: 4px;" alt="${item.itemName}">` : ''}
                <div style="flex: 1;">
                    <div class="item-name">${item.itemName || 'Unknown Item'}</div>
                    <div class="item-id">ID: ${item.itemId}</div>
                    ${item.category ? `<div style="font-size: 10px; opacity: 0.8;">${item.category.label}</div>` : ''}
                </div>
            </div>
        `;
        
        itemCard.addEventListener('click', () => {
            getItemDetails(item.itemId);
        });
        
        resultsContainer.appendChild(itemCard);
    });
    
    showSearchResults();
}

// Get detailed item information
async function getItemDetails(itemId) {
    showLoading();
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getItemMetadata',
            itemId: itemId
        });
        
        if (response && response.metadata) {
            currentItemDetails = response.metadata;
            displayItemDetails(response.metadata);
        } else {
            showError('Failed to load item details.');
        }
    } catch (error) {
        console.error('Error getting item details:', error);
        showError('Failed to load item details.');
    }
}

// Display item details
function displayItemDetails(metadata) {
    const { common, stats, image, required } = metadata;
    
    let detailsHTML = `
        <div class="item-details">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div class="item-name" style="font-size: 18px;">${common.itemName}</div>
                    <div class="item-id">ID: ${common.itemId}</div>
                </div>
                ${image.iconImageUrl ? `<img src="${image.iconImageUrl}" class="item-image" alt="${common.itemName}">` : ''}
            </div>
            
            <div style="margin-top: 10px;">
                <div><strong>Level Requirement:</strong> ${required.level}</div>
                <div><strong>Category:</strong> ${metadata.category?.label || 'Unknown'}</div>
                ${common.isCashItem ? '<div><strong>Cash Item:</strong> Yes</div>' : ''}
                ${common.enableStarforce ? `<div><strong>Max Starforce:</strong> ${common.maxStarforce}</div>` : ''}
            </div>
            
            <div class="stats-grid">
                ${stats.str ? `<div class="stat-item">STR: +${stats.str}</div>` : ''}
                ${stats.dex ? `<div class="stat-item">DEX: +${stats.dex}</div>` : ''}
                ${stats.int ? `<div class="stat-item">INT: +${stats.int}</div>` : ''}
                ${stats.luk ? `<div class="stat-item">LUK: +${stats.luk}</div>` : ''}
                ${stats.pad ? `<div class="stat-item">ATT: +${stats.pad}</div>` : ''}
                ${stats.mad ? `<div class="stat-item">M.ATT: +${stats.mad}</div>` : ''}
                ${stats.maxHp ? `<div class="stat-item">HP: +${stats.maxHp}</div>` : ''}
                ${stats.maxMp ? `<div class="stat-item">MP: +${stats.maxMp}</div>` : ''}
            </div>
        </div>
    `;
    
    // Add pricing section if applicable
    if (common.enableStarforce || !common.blockUpgradePotential) {
        detailsHTML += createPricingSection(common);
    }
    
    itemDetailsContent.innerHTML = detailsHTML;
    showItemDetails();
    
    // Automatically fetch all pricing data
    fetchAllPricingData(common);
}

// Create pricing section
function createPricingSection(common) {
    let pricingHTML = '<div class="pricing-section"><div class="pricing-title">Enhancement Pricing</div>';
    
    // Starforce pricing
    if (common.enableStarforce && common.maxStarforce > 0) {
        pricingHTML += '<div style="margin-bottom: 15px;">';
        pricingHTML += '<div style="font-weight: 600; margin-bottom: 5px;">Starforce Enhancement:</div>';
        pricingHTML += '<div id="starforcePricing"></div>';
        pricingHTML += '</div>';
    }
    
    // Potential pricing
    if (!common.blockUpgradePotential) {
        pricingHTML += '<div>';
        pricingHTML += '<div style="font-weight: 600; margin-bottom: 5px;">Potential Enhancement:</div>';
        pricingHTML += '<div id="potentialPricing"></div>';
        pricingHTML += '</div>';
    }
    
    pricingHTML += '</div>';
    return pricingHTML;
}

// Fetch all pricing data automatically
async function fetchAllPricingData(common) {
    const promises = [];
    
    // Fetch starforce pricing (0-10 stars)
    if (common.enableStarforce && common.maxStarforce > 0) {
        for (let i = 0; i <= Math.min(10, common.maxStarforce); i++) {
            promises.push(
                chrome.runtime.sendMessage({
                    action: 'getEnhancementPricing',
                    itemId: common.itemId,
                    upgradeType: 'starforce',
                    itemUpgrade: i
                }).then(response => ({ type: 'starforce', star: i, data: response }))
            );
        }
    }
    
    // Fetch potential pricing for all cube types
    if (!common.blockUpgradePotential) {
        Object.entries(ENHANCEMENT_TYPES).forEach(([cubeName, cubeId]) => {
            promises.push(
                chrome.runtime.sendMessage({
                    action: 'getEnhancementPricing',
                    itemId: common.itemId,
                    upgradeType: 'potential',
                    upgradeSubType: cubeId
                }).then(response => ({ type: 'potential', cube: cubeName, data: response }))
            );
        });
    }
    
    // Process all pricing data when available
    Promise.allSettled(promises).then(results => {
        const starforceData = {};
        const potentialData = {};
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.data) {
                const { type, star, cube, data } = result.value;
                if (type === 'starforce') {
                    starforceData[star] = data;
                } else if (type === 'potential') {
                    potentialData[cube] = data;
                }
            }
        });
        
        // Display starforce pricing
        if (Object.keys(starforceData).length > 0) {
            displayStarforcePricingTable(starforceData);
        } else if (common.enableStarforce) {
            document.getElementById('starforcePricing').innerHTML = '<div class="error">No starforce pricing data available</div>';
        }
        
        // Display potential pricing
        if (Object.keys(potentialData).length > 0) {
            displayPotentialPricingTable(potentialData);
        } else if (!common.blockUpgradePotential) {
            document.getElementById('potentialPricing').innerHTML = '<div class="error">No potential pricing data available</div>';
        }
    });
}

// Display starforce pricing in a table format
function displayStarforcePricingTable(starforceData) {
    const container = document.getElementById('starforcePricing');
    const formatPrice = (price) => {
        if (price >= 1000000) {
            return (price / 1000000).toFixed(2) + 'M';
        } else if (price >= 1000) {
            return (price / 1000).toFixed(1) + 'K';
        }
        return Math.round(price).toString();
    };
    
    let tableHTML = `
        <div style="margin-top: 10px;">
            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                <thead>
                    <tr style="background: rgba(0,0,0,0.3);">
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Star</th>
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Current</th>
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Avg</th>
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Count</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    for (let i = 0; i <= 10; i++) {
        if (starforceData[i] && starforceData[i].points && starforceData[i].points.length > 0) {
            const lastPoint = starforceData[i].points[starforceData[i].points.length - 1];
            tableHTML += `
                <tr>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: center;">${i}★</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: right;">${formatPrice(lastPoint.endPrice)}</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: right;">${formatPrice(lastPoint.avgPrice)}</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: center;">${lastPoint.sumEnhanceCnt}</td>
                </tr>
            `;
        } else {
            tableHTML += `
                <tr>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: center;">${i}★</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: center;" colspan="3">No data</td>
                </tr>
            `;
        }
    }
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

// Display potential pricing in a table format
function displayPotentialPricingTable(potentialData) {
    const container = document.getElementById('potentialPricing');
    const formatPrice = (price) => {
        if (price >= 1000000) {
            return (price / 1000000).toFixed(2) + 'M';
        } else if (price >= 1000) {
            return (price / 1000).toFixed(1) + 'K';
        }
        return Math.round(price).toString();
    };
    
    let tableHTML = `
        <div style="margin-top: 10px;">
            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                <thead>
                    <tr style="background: rgba(0,0,0,0.3);">
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Cube Type</th>
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Current</th>
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Avg</th>
                        <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.3);">Count</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    Object.keys(ENHANCEMENT_TYPES).forEach(cubeName => {
        if (potentialData[cubeName] && potentialData[cubeName].points && potentialData[cubeName].points.length > 0) {
            const lastPoint = potentialData[cubeName].points[potentialData[cubeName].points.length - 1];
            tableHTML += `
                <tr>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2);">${cubeName}</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: right;">${formatPrice(lastPoint.endPrice)}</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: right;">${formatPrice(lastPoint.avgPrice)}</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: center;">${lastPoint.sumEnhanceCnt}</td>
                </tr>
            `;
        } else {
            tableHTML += `
                <tr>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2);">${cubeName}</td>
                    <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.2); text-align: center;" colspan="3">No data</td>
                </tr>
            `;
        }
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

// Legacy functions kept for backward compatibility but not used
// All pricing is now fetched automatically when item is selected

// UI state management functions
function showLoading() {
    loading.style.display = 'block';
    searchResults.style.display = 'none';
    itemDetails.style.display = 'none';
}

function showSearchResults() {
    loading.style.display = 'none';
    searchResults.style.display = 'block';
    itemDetails.style.display = 'none';
}

function showItemDetails() {
    loading.style.display = 'none';
    searchResults.style.display = 'none';
    itemDetails.style.display = 'block';
}

function showError(message) {
    loading.style.display = 'none';
    resultsContainer.innerHTML = `<div class="error">${message}</div>`;
    showSearchResults();
}

// Make functions global for any legacy onclick handlers (though not used anymore)
// All pricing is now loaded automatically
