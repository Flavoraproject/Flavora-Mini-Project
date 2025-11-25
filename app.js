const API_BASE = 'https://www.themealdb.com/api/json/v1/1';

// DOM Elements
const app = document.getElementById('app');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const voiceSearchBtn = document.getElementById('voice-search-btn');
const categoryList = document.getElementById('category-list');
const recipesSection = document.getElementById('recipes');
const recipeGrid = document.getElementById('recipe-grid');
const resultsTitle = document.getElementById('results-title');
const backToHomeBtn = document.getElementById('back-to-home');
const recipeModal = document.getElementById('recipe-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalBody = document.getElementById('modal-body');
const startCookingBtn = document.getElementById('start-cooking-btn');
const cookingMode = document.getElementById('cooking-mode');
const exitCookingBtn = document.getElementById('exit-cooking');
const cookingTitle = document.getElementById('cooking-title');
const stepNumber = document.getElementById('step-number');
const stepText = document.getElementById('step-text');
const prevStepBtn = document.getElementById('prev-step');
const nextStepBtn = document.getElementById('next-step');
const speakStepBtn = document.getElementById('speak-step');

// State
let currentRecipe = null;
let currentStepIndex = 0;
let cookingSteps = [];
let isListening = false;

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        voiceSearchBtn.classList.add('listening');
    };

    recognition.onend = () => {
        isListening = false;
        voiceSearchBtn.classList.remove('listening');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice Command:', transcript);
        handleVoiceCommand(transcript);
    };
} else {
    console.warn('Speech Recognition not supported');
    voiceSearchBtn.style.display = 'none';
}

// Speech Synthesis Setup
const synth = window.speechSynthesis;
let voices = [];

function loadVoices() {
    voices = synth.getVoices();
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
    if (synth.speaking) {
        synth.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    synth.speak(utterance);
}

// Event Listeners
searchBtn.addEventListener('click', () => searchRecipes(searchInput.value));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchRecipes(searchInput.value);
});

voiceSearchBtn.addEventListener('click', () => {
    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

backToHomeBtn.addEventListener('click', showHome);
closeModalBtn.addEventListener('click', closeRecipeModal);
startCookingBtn.addEventListener('click', startCooking);
exitCookingBtn.addEventListener('click', exitCooking);

prevStepBtn.addEventListener('click', prevStep);
nextStepBtn.addEventListener('click', nextStep);
speakStepBtn.addEventListener('click', () => speak(cookingSteps[currentStepIndex]));

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchCategories();
    loadVoices();
});

// Functions

async function fetchCategories() {
    try {
        const res = await fetch(`${API_BASE}/categories.php`);
        const data = await res.json();
        renderCategories(data.categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        categoryList.innerHTML = '<p>Failed to load categories.</p>';
    }
}

function renderCategories(categories) {
    categoryList.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="searchRecipes('${cat.strCategory}')">
            <img src="${cat.strCategoryThumb}" alt="${cat.strCategory}">
            <h4>${cat.strCategory}</h4>
        </div>
    `).join('');
}

async function searchRecipes(query) {
    if (!query) return;

    // UI Update
    document.getElementById('hero').classList.add('hidden'); // Optional: hide hero on search
    document.getElementById('categories').classList.add('hidden');
    recipesSection.classList.remove('hidden');
    recipeGrid.innerHTML = '<div class="loading-spinner"></div>';
    resultsTitle.textContent = `Results for "${query}"`;

    try {
        const res = await fetch(`${API_BASE}/search.php?s=${query}`);
        const data = await res.json();

        if (data.meals) {
            renderRecipes(data.meals);
            speak(`Found ${data.meals.length} recipes for ${query}`);
        } else {
            recipeGrid.innerHTML = '<p>No recipes found. Try another term.</p>';
            speak(`No recipes found for ${query}`);
        }
    } catch (error) {
        console.error('Error searching recipes:', error);
        recipeGrid.innerHTML = '<p>Error searching recipes.</p>';
    }
}

function renderRecipes(meals) {
    recipeGrid.innerHTML = meals.map(meal => `
        <div class="recipe-card" onclick="openRecipe('${meal.idMeal}')">
            <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
            <div class="recipe-info">
                <h3>${meal.strMeal}</h3>
                <p>${meal.strArea} | ${meal.strCategory}</p>
            </div>
        </div>
    `).join('');
}

async function openRecipe(id) {
    try {
        const res = await fetch(`${API_BASE}/lookup.php?i=${id}`);
        const data = await res.json();
        currentRecipe = data.meals[0];
        renderRecipeDetails(currentRecipe);
        recipeModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching recipe details:', error);
    }
}

function renderRecipeDetails(meal) {
    // Parse Ingredients
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        if (meal[`strIngredient${i}`]) {
            ingredients.push({
                ingredient: meal[`strIngredient${i}`],
                measure: meal[`strMeasure${i}`]
            });
        }
    }

    // Parse Instructions
    cookingSteps = meal.strInstructions
        .split(/\r\n|\n|\r/)
        .filter(step => step.trim().length > 0);

    modalBody.innerHTML = `
        <div class="modal-header">
            <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="modal-img">
            <div class="modal-details">
                <h2>${meal.strMeal}</h2>
                <div class="tags">
                    <span class="tag">${meal.strCategory}</span>
                    <span class="tag">${meal.strArea}</span>
                </div>
            </div>
        </div>
        <h3>Ingredients</h3>
        <div class="ingredients-list">
            ${ingredients.map(ing => `
                <div class="ingredient-item">
                    <img src="https://www.themealdb.com/images/ingredients/${ing.ingredient}-Small.png" alt="${ing.ingredient}">
                    <span>${ing.measure} ${ing.ingredient}</span>
                </div>
            `).join('')}
        </div>
        <h3>Instructions</h3>
        <p>${meal.strInstructions}</p>
    `;
}

function closeRecipeModal() {
    recipeModal.classList.add('hidden');
    currentRecipe = null;
}

function showHome() {
    recipesSection.classList.add('hidden');
    document.getElementById('categories').classList.remove('hidden');
    document.getElementById('hero').classList.remove('hidden');
    searchInput.value = '';
}

// Cooking Mode Logic
function startCooking() {
    if (!currentRecipe) return;

    closeRecipeModal();
    cookingMode.classList.remove('hidden');
    currentStepIndex = 0;
    updateStep();
    speak("Starting cooking mode. " + cookingSteps[0]);
}

function exitCooking() {
    cookingMode.classList.add('hidden');
    synth.cancel();
}

function updateStep() {
    stepNumber.textContent = `Step ${currentStepIndex + 1} of ${cookingSteps.length}`;
    stepText.textContent = cookingSteps[currentStepIndex];
}

function nextStep() {
    if (currentStepIndex < cookingSteps.length - 1) {
        currentStepIndex++;
        updateStep();
        speak(cookingSteps[currentStepIndex]);
    } else {
        speak("You have finished the recipe. Enjoy your meal!");
    }
}

function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        updateStep();
        speak(cookingSteps[currentStepIndex]);
    }
}

function handleVoiceCommand(command) {
    const cmd = command.toLowerCase();

    // Search Context
    if (!cookingMode.classList.contains('hidden')) {
        // Cooking Mode Commands
        if (cmd.includes('next')) {
            nextStep();
        } else if (cmd.includes('previous') || cmd.includes('back')) {
            prevStep();
        } else if (cmd.includes('repeat') || cmd.includes('read')) {
            speak(cookingSteps[currentStepIndex]);
        } else if (cmd.includes('exit') || cmd.includes('stop')) {
            exitCooking();
        }
    } else {
        // General Search
        searchInput.value = command;
        searchRecipes(command);
    }
}
