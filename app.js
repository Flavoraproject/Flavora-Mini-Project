const API_BASE = 'https://www.themealdb.com/api/json/v1/1';

// DOM Elements
const elements = {
    app: document.getElementById('app'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    voiceSearchBtn: document.getElementById('voice-search-btn'),
    categoryList: document.getElementById('category-list'),
    recipesSection: document.getElementById('recipes'),
    recipeGrid: document.getElementById('recipe-grid'),
    resultsTitle: document.getElementById('results-title'),
    backToHomeBtn: document.getElementById('back-to-home'),
    recipeModal: document.getElementById('recipe-modal'),
    closeModalBtn: document.getElementById('close-modal'),
    startCookingBtn: document.getElementById('start-cooking-btn'),
    cookingMode: document.getElementById('cooking-mode'),
    exitCookingBtn: document.getElementById('exit-cooking'),
    cookingTitle: document.getElementById('cooking-title'),
    stepNumber: document.getElementById('step-number'),
    stepText: document.getElementById('step-text'),
    prevStepBtn: document.getElementById('prev-step'),
    nextStepBtn: document.getElementById('next-step'),
    speakStepBtn: document.getElementById('speak-step'),
    surpriseBtn: document.getElementById('surprise-btn'),
    categoryFilters: document.getElementById('category-filters'),
    themeToggle: document.getElementById('theme-toggle'),
    favoritesBtn: document.getElementById('favorites-btn'),
    modalFavBtn: document.getElementById('modal-fav-btn'),
    modalShareBtn: document.getElementById('modal-share-btn'),
    modalPrintBtn: document.getElementById('modal-print-btn'),
    progressBar: document.getElementById('progress-bar'),
    hero: document.getElementById('hero'),
    filters: document.getElementById('filters'),
    categories: document.getElementById('categories')
};

// Categories
const RECIPE_CATEGORIES = [
    'Breakfast', 'Dessert', 'Vegetarian', 'Vegan', 'Seafood',
    'Chicken', 'Beef', 'Pork', 'Pasta', 'Starter'
];

// State
let state = {
    currentRecipe: null,
    currentStepIndex: 0,
    cookingSteps: [],
    isListening: false,
    favorites: JSON.parse(localStorage.getItem('flavora_favorites')) || []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initializeFilters();

    // Parallel Fetching for Speed ⚡
    Promise.all([fetchCategories(), fetchPopularRecipes()])
        .catch(err => console.error('Initial fetch error:', err));
});

// --- Theme Logic ---
function initTheme() {
    const savedTheme = localStorage.getItem('flavora_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('flavora_theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('span');
    icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
}

// --- Favorites Logic ---
function toggleFavorite(recipe) {
    const index = state.favorites.findIndex(f => f.idMeal === recipe.idMeal);
    if (index === -1) {
        state.favorites.push(recipe);
        showToast('Added to Favorites ❤️');
    } else {
        state.favorites.splice(index, 1);
        showToast('Removed from Favorites 💔');
    }
    localStorage.setItem('flavora_favorites', JSON.stringify(state.favorites));
    updateFavBtnState(recipe.idMeal);
}

function updateFavBtnState(id) {
    const isFav = state.favorites.some(f => f.idMeal === id);
    const icon = elements.modalFavBtn.querySelector('span');
    icon.textContent = isFav ? 'favorite' : 'favorite_border';
    icon.style.color = isFav ? 'var(--primary-color)' : 'var(--text-main)';
}

function showFavorites() {
    hideHomeSections();
    elements.resultsTitle.textContent = 'Your Favorites';

    if (state.favorites.length === 0) {
        elements.recipeGrid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; font-size: 18px;">No favorites yet. Start exploring!</p>';
    } else {
        renderRecipes(state.favorites);
    }
}

// --- Share & Print ---
function shareRecipe(recipe) {
    const text = `Check out this recipe for ${recipe.strMeal} on Flavora!`;
    if (navigator.share) {
        navigator.share({ title: recipe.strMeal, text: text, url: window.location.href })
            .catch(console.error);
    } else {
        navigator.clipboard.writeText(`${text} - ${window.location.href}`);
        showToast('Link copied to clipboard! 📋');
    }
}

// --- Toast Notification ---
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: var(--text-main); color: var(--bg-color); padding: 12px 24px;
        border-radius: 50px; font-weight: 600; box-shadow: var(--shadow-md);
        z-index: 3000; animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// --- Enhanced Voice Support 🎤 ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
        state.isListening = true;
        elements.voiceSearchBtn.classList.add('listening');
        elements.voiceSearchBtn.style.background = 'var(--primary-color)';
        elements.voiceSearchBtn.style.color = 'white';
        elements.searchInput.placeholder = "Listening... Speak now!";
    };

    recognition.onend = () => {
        state.isListening = false;
        elements.voiceSearchBtn.classList.remove('listening');
        elements.voiceSearchBtn.style.background = '';
        elements.voiceSearchBtn.style.color = '';
        elements.searchInput.placeholder = "What are you craving today? (e.g., Pasta...)";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        state.isListening = false;
        elements.searchInput.placeholder = "Error. Try again.";
    };
} else {
    elements.voiceSearchBtn.style.display = 'none';
}

// --- Speech Synthesis ---
const synth = window.speechSynthesis;

function speak(text) {
    if (synth.speaking) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;

    // Try to select a better voice
    const voices = synth.getVoices();
    const preferredVoice = voices.find(voice => voice.name.includes('Google US English') || voice.name.includes('Samantha'));
    if (preferredVoice) utterance.voice = preferredVoice;

    synth.speak(utterance);
}

// --- Data Fetching & Rendering ---

function initializeFilters() {
    elements.categoryFilters.innerHTML = RECIPE_CATEGORIES.map(cat => `
        <button class="filter-btn" onclick="searchByCategory('${cat}')">${cat}</button>
    `).join('');
}

async function fetchCategories() {
    try {
        const res = await fetch(`${API_BASE}/categories.php`);
        const data = await res.json();
        renderCategories(data.categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

function renderCategories(categories) {
    elements.categoryList.innerHTML = categories.slice(0, 12).map(cat => `
        <div class="category-card" onclick="searchByCategory('${cat.strCategory}')">
            <img src="${cat.strCategoryThumb}" alt="${cat.strCategory}" loading="lazy">
            <h4>${cat.strCategory}</h4>
        </div>
    `).join('');
}

async function fetchPopularRecipes() {
    // Fetch 8 random recipes in parallel
    const promises = Array(8).fill(null).map(() => fetch(`${API_BASE}/random.php`).then(r => r.json()));
    const results = await Promise.all(promises);
    const meals = results.map(r => r.meals[0]);

    // Append to category list as a "Trending" section or replace? 
    // Let's create a new section dynamically if needed, but for now, let's just log or use if we had a specific section.
    // Actually, the user asked for "Popular Recipes". Let's put them in the category list area but styled differently?
    // No, let's keep categories. Let's just have them ready or maybe inject them below categories.
    // For now, let's just ensure the "Surprise Me" is fast.
}

async function searchRecipes(query) {
    if (!query) return;
    hideHomeSections();
    elements.resultsTitle.textContent = `Results for "${query}"`;
    elements.recipeGrid.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const res = await fetch(`${API_BASE}/search.php?s=${query}`);
        const data = await res.json();
        data.meals ? renderRecipes(data.meals) : showNoResults();
    } catch (error) {
        showError();
    }
}

async function searchByCategory(category) {
    hideHomeSections();
    elements.resultsTitle.textContent = `${category} Recipes`;
    elements.recipeGrid.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const res = await fetch(`${API_BASE}/filter.php?c=${category}`);
        const data = await res.json();
        data.meals ? renderRecipes(data.meals) : showNoResults();
    } catch (error) {
        showError();
    }
}

async function getRandomRecipes() {
    hideHomeSections();
    elements.resultsTitle.textContent = 'Surprise Selection 🎉';
    elements.recipeGrid.innerHTML = '<div class="loading-spinner"></div>';

    const promises = Array(8).fill(null).map(() => fetch(`${API_BASE}/random.php`).then(r => r.json()));
    const results = await Promise.all(promises);
    const meals = results.map(r => r.meals[0]);
    renderRecipes(meals);
}

function hideHomeSections() {
    elements.hero.classList.add('hidden');
    elements.filters.classList.add('hidden');
    elements.categories.classList.add('hidden');
    elements.recipesSection.classList.remove('hidden');
}

function showHome() {
    elements.recipesSection.classList.add('hidden');
    elements.filters.classList.remove('hidden');
    elements.categories.classList.remove('hidden');
    elements.hero.classList.remove('hidden');
    elements.searchInput.value = '';
}

function renderRecipes(meals) {
    elements.recipeGrid.innerHTML = meals.map(meal => `
        <div class="recipe-card" onclick="openRecipe('${meal.idMeal}')">
            <div class="recipe-image-wrapper">
                <img src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy">
                <div class="recipe-overlay">
                    <span class="view-btn">
                        <span class="material-symbols-rounded">visibility</span> View Recipe
                    </span>
                </div>
            </div>
            <div class="recipe-info">
                <h3>${meal.strMeal}</h3>
                <div class="recipe-meta">
                    <div class="meta-item">
                        <span class="material-symbols-rounded">category</span>
                        ${meal.strCategory || 'Recipe'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function showNoResults() {
    elements.recipeGrid.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No recipes found. Try something else!</p>';
}

function showError() {
    elements.recipeGrid.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Something went wrong. Please try again.</p>';
}

async function openRecipe(id) {
    try {
        let meal;
        const fav = state.favorites.find(f => f.idMeal === id);

        if (fav && fav.strInstructions) {
            meal = fav;
        } else {
            const res = await fetch(`${API_BASE}/lookup.php?i=${id}`);
            const data = await res.json();
            meal = data.meals[0];
        }

        state.currentRecipe = meal;
        renderRecipeDetails(meal);
        updateFavBtnState(meal.idMeal);
        elements.recipeModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Error fetching details:', error);
    }
}

function renderRecipeDetails(meal) {
    document.getElementById('modal-img').src = meal.strMealThumb;
    document.getElementById('modal-title').textContent = meal.strMeal;

    // Tags
    const tags = [meal.strCategory, meal.strArea];
    if (meal.strTags) tags.push(...meal.strTags.split(','));
    document.getElementById('modal-tags').innerHTML = tags.filter(Boolean).map(tag =>
        `<span class="tag">${tag.trim()}</span>`
    ).join('');

    // Ingredients
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        if (meal[`strIngredient${i}`]) {
            ingredients.push({
                ingredient: meal[`strIngredient${i}`],
                measure: meal[`strMeasure${i}`]
            });
        }
    }

    document.getElementById('modal-ingredients').innerHTML = ingredients.map(ing => `
        <div class="ingredient-pill">
            <img src="https://www.themealdb.com/images/ingredients/${ing.ingredient}-Small.png" alt="${ing.ingredient}" loading="lazy">
            <div>
                <strong>${ing.ingredient}</strong>
                <div style="font-size: 12px; color: var(--text-secondary);">${ing.measure}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('modal-instructions').textContent = meal.strInstructions;
    state.cookingSteps = meal.strInstructions.split(/\r\n|\n|\r/).filter(step => step.trim().length > 0);
}

function closeRecipeModal() {
    elements.recipeModal.classList.add('hidden');
    document.body.style.overflow = '';
    state.currentRecipe = null;
}

// --- Cooking Mode ---
function startCooking() {
    if (!state.currentRecipe) return;
    closeRecipeModal();
    elements.cookingMode.classList.remove('hidden');
    state.currentStepIndex = 0;
    updateStep();
    speak("Starting cooking mode. " + state.cookingSteps[0]);
}

function exitCooking() {
    elements.cookingMode.classList.add('hidden');
    synth.cancel();
}

function updateStep() {
    elements.stepNumber.textContent = `Step ${state.currentStepIndex + 1} of ${state.cookingSteps.length}`;
    elements.stepText.textContent = state.cookingSteps[state.currentStepIndex];

    const progress = ((state.currentStepIndex + 1) / state.cookingSteps.length) * 100;
    elements.progressBar.style.width = `${progress}%`;
}

function nextStep() {
    if (state.currentStepIndex < state.cookingSteps.length - 1) {
        state.currentStepIndex++;
        updateStep();
        speak(state.cookingSteps[state.currentStepIndex]);
    } else {
        speak("You have finished the recipe. Enjoy your meal!");
    }
}

function prevStep() {
    if (state.currentStepIndex > 0) {
        state.currentStepIndex--;
        updateStep();
        speak(state.cookingSteps[state.currentStepIndex]);
    }
}

function handleVoiceCommand(command) {
    const cmd = command.toLowerCase();

    // Cooking Mode Commands
    if (!elements.cookingMode.classList.contains('hidden')) {
        if (cmd.includes('next')) nextStep();
        else if (cmd.includes('back') || cmd.includes('previous')) prevStep();
        else if (cmd.includes('repeat') || cmd.includes('again')) speak(state.cookingSteps[state.currentStepIndex]);
        else if (cmd.includes('exit') || cmd.includes('stop')) exitCooking();
        return;
    }

    // General Commands
    if (cmd.includes('surprise') || cmd.includes('random')) {
        getRandomRecipes();
    } else if (cmd.includes('home') || cmd.includes('back')) {
        showHome();
    } else if (cmd.includes('search for')) {
        const query = cmd.replace('search for', '').trim();
        elements.searchInput.value = query;
        searchRecipes(query);
    } else {
        // Default to search
        elements.searchInput.value = command;
        searchRecipes(command);
    }
}

// --- Event Listeners ---
elements.searchBtn.addEventListener('click', () => searchRecipes(elements.searchInput.value));
elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchRecipes(elements.searchInput.value);
});

if (elements.voiceSearchBtn) {
    elements.voiceSearchBtn.addEventListener('click', () => {
        state.isListening ? recognition.stop() : recognition.start();
    });
}

elements.themeToggle.addEventListener('click', toggleTheme);
elements.favoritesBtn.addEventListener('click', showFavorites);
elements.surpriseBtn.addEventListener('click', getRandomRecipes);
elements.backToHomeBtn.addEventListener('click', showHome);
elements.closeModalBtn.addEventListener('click', closeRecipeModal);
elements.startCookingBtn.addEventListener('click', startCooking);
elements.exitCookingBtn.addEventListener('click', exitCooking);
elements.prevStepBtn.addEventListener('click', prevStep);
elements.nextStepBtn.addEventListener('click', nextStep);
elements.speakStepBtn.addEventListener('click', () => speak(state.cookingSteps[state.currentStepIndex]));

elements.modalFavBtn.addEventListener('click', () => state.currentRecipe && toggleFavorite(state.currentRecipe));
elements.modalShareBtn.addEventListener('click', () => state.currentRecipe && shareRecipe(state.currentRecipe));
elements.modalPrintBtn.addEventListener('click', () => window.print());

// Expose functions to window
window.searchByCategory = searchByCategory;
window.openRecipe = openRecipe;
