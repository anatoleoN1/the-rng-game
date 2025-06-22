import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhxxMOUvM33JRxOS8EnT03odII8BYm7z8",
  authDomain: "the-rng-game.firebaseapp.com",
  projectId: "the-rng-game",
  storageBucket: "the-rng-game.firebasestorage.app",
  messagingSenderId: "108502993948",
  appId: "1:108502993948:web:99a01b8b44593cdaf9a3d9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let inventory = [];
let money = 1000;
let userEmail = ""; // vrai email stocké à l'inscription

// --- ELEMENTS DOM ---
const authSection = document.getElementById("auth-section");
const gameSection = document.getElementById("game-section");
const authStatus = document.getElementById("auth-status");

const loginPseudoInput = document.getElementById("login-pseudo");
const loginPasswordInput = document.getElementById("login-password");
const registerPseudoInput = document.getElementById("register-pseudo");
const registerEmailInput = document.getElementById("register-email");
const registerPasswordInput = document.getElementById("register-password");

const btnLogin = document.getElementById("btn-login");
const btnRegister = document.getElementById("btn-register");
const btnLogout = document.getElementById("btn-logout");
const btnChangePassword = document.getElementById("btn-change-password");
const btnDeleteAccount = document.getElementById("btn-delete-account");

const modalChangePassword = document.getElementById("modal-change-password");
const closeModal = document.getElementById("close-modal");
const btnSubmitPasswordChange = document.getElementById("btn-submit-password-change");
const oldPasswordInput = document.getElementById("old-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const changePasswordStatus = document.getElementById("change-password-status");

const moneySpan = document.getElementById("money");
const btnRoll = document.getElementById("btn-roll");
const resultDiv = document.getElementById("result");
const inventoryList = document.getElementById("inventory-list");
const questList = document.getElementById("quest-list");
const questResult = document.getElementById("quest-result");
const shopList = document.getElementById("shop-list");
const sellItemSelect = document.getElementById("sell-item-select");
const sellPriceInput = document.getElementById("sell-price");
const btnSell = document.getElementById("btn-sell");

// --- Objets du jeu ---
const objects = [
  { name: "1/2", chance: 50, hp: 2 },
  { name: "1/4", chance: 25, hp: 4 },
  { name: "1/10", chance: 10, hp: 10 },
  { name: "1/20", chance: 5, hp: 20 },
  { name: "1/100", chance: 1, hp: 100 },
  { name: "1/1,000", chance: 0.1, hp: 1000 },
  { name: "1/10,000", chance: 0.01, hp: 10000 },
  { name: "1/100,000", chance: 0.001, hp: 100000 },
];

const quests = [
  { id: 1, name: "Offrir 2 HP", requiredHP: 2, reward: 100 },
  { id: 2, name: "Sacrifier 4 HP", requiredHP: 4, reward: 200 },
  { id: 3, name: "Offrir 10 HP", requiredHP: 10, reward: 400 },
];

// --- UTILITAIRES ---
function updateMoney() {
  moneySpan.textContent = money;
}

function updateInventory() {
  inventoryList.innerHTML = "";
  sellItemSelect.innerHTML = "";
  inventory.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${item.name} (HP: ${item.hp})`;
    inventoryList.appendChild(li);

    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${item.name} (HP: ${item.hp})`;
    sellItemSelect.appendChild(option);
  });
  saveData();
}

function rollObject() {
  const totalChance = objects.reduce((sum, obj) => sum + obj.chance, 0);
  const rand = Math.random() * totalChance;
  let cumulative = 0;
  for (let obj of objects) {
    cumulative += obj.chance;
    if (rand <= cumulative) return { ...obj };
  }
}

function displayQuests() {
  questList.innerHTML = "";
  quests.forEach((q) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = `Faire "${q.name}" (HP: ${q.requiredHP}, +${q.reward}€)`;
    btn.onclick = () => attemptQuest(q);
    li.appendChild(btn);
    questList.appendChild(li);
  });
}

function attemptQuest(quest) {
  let hpToSacrifice = quest.requiredHP;
  let brokeBeforeEnd = false;
  inventory.sort((a, b) => a.hp - b.hp);

  for (let i = 0; i < inventory.length && hpToSacrifice > 0; i++) {
    let item = inventory[i];
    while (item.hp > 0 && hpToSacrifice > 0) {
      item.hp--;
      hpToSacrifice--;
      if (item.hp === 0 && hpToSacrifice > 0) {
        brokeBeforeEnd = true;
        break;
      }
    }
    if (item.hp === 0) {
      inventory.splice(i, 1);
      i--;
    }
    if (brokeBeforeEnd) break;
  }

  if (brokeBeforeEnd || hpToSacrifice > 0) {
    questResult.innerText = `❌ Quête "${quest.name}" échouée, pas assez de HP!`;
  } else {
    money += quest.reward;
    updateMoney();
    updateInventory();
    questResult.innerText = `✅ Quête "${quest.name}" réussie! +${quest.reward}€`;
  }
}

function saveData() {
  if (!currentUser) return;
  const userDoc = doc(db, "users", currentUser.uid);
  setDoc(userDoc, {
    money,
    inventory,
    email: userEmail,
  });
}

async function loadData(uid) {
  const userDoc = doc(db, "users", uid);
  const docSnap = await getDoc(userDoc);
  if (docSnap.exists()) {
    const data = docSnap.data();
    money = data.money || 1000;
    inventory = data.inventory || [];
    userEmail = data.email || "";
  } else {
    money = 1000;
    inventory = [];
    userEmail = "";
  }
  updateMoney();
  updateInventory();
  displayQuests();
}

// --- AUTH ---

function pseudoToEmail(pseudo) {
  // Pour que pseudo soit unique + email formel pour Firebase
  return `${pseudo.trim().toLowerCase()}@rng.fake`;
}

btnRegister.onclick = async () => {
  const pseudo = registerPseudoInput.value.trim();
  const email = registerEmailInput.value.trim();
  const password = registerPasswordInput.value.trim();

  if (!pseudo || !email || !password) {
    alert("Tous les champs sont obligatoires !");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, pseudoToEmail(pseudo), password);
    currentUser = userCredential.user;
    userEmail = email; // email réel pour récupération
    // Sauvegarder email réel dans Firestore (lié au uid)
    const userDoc = doc(db, "users", currentUser.uid);
    await setDoc(userDoc, { money: 1000, inventory: [], email: userEmail });

    authSection.style.display = "none";
    gameSection.style.display = "block";
    authStatus.innerText = `Bienvenue ${pseudo}!`;

    loadData(currentUser.uid);
  } catch (error) {
    alert("Erreur inscription : " + error.message);
  }
};

btnLogin.onclick = async () => {
  const pseudo = loginPseudoInput.value.trim();
  const password = loginPasswordInput.value.trim();

  if (!pseudo || !password) {
    alert("Merci de remplir le pseudo et mot de passe");
    return;
  }

  try {
    const email = pseudoToEmail(pseudo);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;

    // Charger email réel depuis Firestore
    const userDoc = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(userDoc);
    userEmail = docSnap.exists() ? docSnap.data().email : "";

    authSection.style.display = "none";
    gameSection.style.display = "block";
    authStatus.innerText = `Bienvenue ${pseudo}!`;

    loadData(currentUser.uid);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      alert("❌ Aucun compte trouvé pour ce pseudo.");
    } else if (error.code === "auth/wrong-password") {
      alert("❌ Mot de passe incorrect.");
    } else {
      alert("Erreur connexion : " + error.message);
    }
  }
};

btnLogout.onclick = () => {
  signOut(auth).then(() => {
    currentUser = null;
    userEmail = "";
    inventory = [];
    money = 1000;

    authSection.style.display = "block";
    gameSection.style.display = "none";
    authStatus.innerText = "🔓 Déconnecté.";
  });
};

// --- CHANGE PASSWORD ---

btnChangePassword.onclick = () => {
  oldPasswordInput.value = "";
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  changePasswordStatus.innerText = "";
  modalChangePassword.style.display = "block";
};

closeModal.onclick = () => {
  modalChangePassword.style.display = "none";
};

window.onclick = function(event) {
  if (event.target == modalChangePassword) {
    modalChangePassword.style.display = "none";
  }
};

btnSubmitPasswordChange.onclick = async () => {
  const oldPass = oldPasswordInput.value;
  const newPass = newPasswordInput.value;
  const confirmPass = confirmPasswordInput.value;

  if (!oldPass || !newPass || !confirmPass) {
    changePasswordStatus.innerText = "Tous les champs sont obligatoires.";
    return;
  }
  if (newPass !== confirmPass) {
    changePasswordStatus.innerText = "Le nouveau mot de passe ne correspond pas.";
    return;
  }
  if (newPass.length < 6) {
    changePasswordStatus.innerText = "Le mot de passe doit contenir au moins 6 caractères.";
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    changePasswordStatus.innerText = "Utilisateur non connecté.";
    return;
  }

  // Re-authenticate user before changing password
  try {
    const credential = EmailAuthProvider.credential(user.email, oldPass);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPass);
    changePasswordStatus.innerText = "✅ Mot de passe changé avec succès.";
    modalChangePassword.style.display = "none";
  } catch (error) {
    changePasswordStatus.innerText = "Erreur : " + error.message;
  }
};

// --- DELETE ACCOUNT ---
btnDeleteAccount.onclick = async () => {
  if (!confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.")) return;

  const user = auth.currentUser;
  if (!user) {
    alert("Aucun utilisateur connecté.");
    return;
  }

  // Demande de saisie du mot de passe pour re-authentification
  const password = prompt("Veuillez saisir votre mot de passe pour confirmer la suppression du compte :");
  if (!password) {
    alert("Suppression annulée.");
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    // Supprimer les données Firestore
    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);

    alert("Compte supprimé avec succès.");

    currentUser = null;
    userEmail = "";
    inventory = [];
    money = 1000;

    authSection.style.display = "block";
    gameSection.style.display = "none";
    authStatus.innerText = "🗑️ Compte supprimé.";
  } catch (error) {
    alert("Erreur suppression : " + error.message);
  }
};

// --- JEUX, BOUTIQUE, QUÊTES (idem que précédemment) ---

btnRoll.onclick = () => {
  if (money < 100) {
    alert("Pas assez d'argent.");
    return;
  }
  money -= 100;
  updateMoney();
  const obj = rollObject();
  inventory.push(obj);
  resultDiv.innerText = `Vous avez obtenu : ${obj.name} (HP: ${obj.hp})`;
  updateInventory();
};

btnSell.onclick = async () => {
  const index = sellItemSelect.value;
  const price = parseInt(sellPriceInput.value);
  if (index === "" || isNaN(price) || price <= 0) {
    alert("Sélectionnez un objet valide et un prix supérieur à 0.");
    return;
  }

  const item = inventory[index];
  if (!item) {
    alert("Objet invalide.");
    return;
  }

  // Ajoute à la collection 'shop' dans Firestore
  try {
    await addDoc(collection(db, "shop"), {
      seller: currentUser.uid,
      item,
      price,
      timestamp: Date.now(),
    });

    inventory.splice(index, 1);
    updateInventory();
    alert("Objet mis en vente !");
  } catch (e) {
    alert("Erreur mise en vente : " + e.message);
  }
};

// Pour afficher boutique, à implémenter la récupération shop
// (je laisse ça simple ici)

function displayShop() {
  shopList.innerHTML = "<i>Chargement de la boutique...</i>";
  getDocs(collection(db, "shop")).then((querySnapshot) => {
    shopList.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.textContent = `${data.item.name} (HP:${data.item.hp}) - ${data.price}€ (Vendeur: ${data.seller})`;
      shopList.appendChild(div);
    });
  });
}

// Initialisation
updateMoney();
updateInventory();
displayQuests();
displayShop();

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadData(user.uid);
    authSection.style.display = "none";
    gameSection.style.display = "block";
    authStatus.innerText = "Connecté.";
  } else {
    currentUser = null;
    authSection.style.display = "block";
    gameSection.style.display = "none";
    authStatus.innerText = "Déconnecté.";
  }
});
