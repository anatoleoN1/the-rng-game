import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC34u7bAW6ydq_cJG6vwUgpcKOSUqflE6w",
  authDomain: "rng-game-d5443.firebaseapp.com",
  projectId: "rng-game-d5443",
  storageBucket: "rng-game-d5443.appspot.com",
  messagingSenderId: "1023848023255",
  appId: "1:1023848023255:web:cd3c06fd73800aa366ba63",
  measurementId: "G-MZ6Y84N5DR",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let inventory = [];
let money = 1000;
let userEmail = "";

// --- DOM ---
document.addEventListener("DOMContentLoaded", () => {
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

  // Objets
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

  async function saveUserData() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      inventory,
      money,
    }, { merge: true });
  } catch (e) {
    console.error("Erreur sauvegarde :", e);
  }
}

  
  function pseudoToEmail(pseudo) {
    return `${pseudo.trim().toLowerCase()}@rng.fake`;
  }

  btnRegister.addEventListener("click", async () => {
  const pseudo = document.getElementById("register-pseudo").value;
  const password = document.getElementById("register-password").value;

  if (!pseudo || !password) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  try {
    // Vérifie si le pseudo existe déjà
    const pseudoDoc = await getDoc(doc(db, "pseudos", pseudo));
    if (pseudoDoc.exists()) {
      alert("Ce pseudo est déjà utilisé.");
      return;
    }

    // Crée l'utilisateur avec un email fictif
    const cred = await createUserWithEmailAndPassword(auth, pseudo + "@game.com", password);

    // Lie le pseudo à l'UID dans une collection séparée
    await setDoc(doc(db, "pseudos", pseudo), { uid: cred.user.uid });

    // Crée un document utilisateur initial
    await setDoc(doc(db, "users", cred.user.uid), {
      pseudo,
      money: 0,
      inventory: [],
      titles: [],
      book: [],
    });

    alert("Inscription réussie !");
  } catch (error) {
    console.error("Erreur d'inscription :", error);
    alert("Erreur d'inscription : " + error.message);
  }
});


  btnLogin.addEventListener("click", async () => {
    const pseudo = loginPseudoInput.value;
    const password = loginPasswordInput.value;
    try {
      await signInWithEmailAndPassword(auth, pseudo + "@game.com", password);
    } catch (err) {
      alert("Connexion échouée : " + err.message);
    }
  });

  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      alert("Erreur déconnexion : " + err.message);
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      authSection.style.display = "none";
      gameSection.style.display = "block";
      await loadUserData(user);
      displayQuests();
      displayShop();
    } else {
      authSection.style.display = "block";
      gameSection.style.display = "none";
    }
  });

  // change password
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

  window.onclick = (e) => {
    if (e.target == modalChangePassword) modalChangePassword.style.display = "none";
  };

  btnSubmitPasswordChange.onclick = async () => {
    const oldPass = oldPasswordInput.value;
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    if (!oldPass || !newPass || !confirmPass) return changePasswordStatus.innerText = "Champs requis.";
    if (newPass !== confirmPass) return changePasswordStatus.innerText = "Les mots de passe ne correspondent pas.";
    if (newPass.length < 6) return changePasswordStatus.innerText = "6 caractères minimum.";

    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, oldPass);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPass);
      changePasswordStatus.innerText = "✅ Mot de passe modifié.";
      modalChangePassword.style.display = "none";
    } catch (e) {
      changePasswordStatus.innerText = "Erreur : " + e.message;
    }
  };

  btnDeleteAccount.onclick = async () => {
    if (!confirm("Supprimer le compte ?")) return;
    const password = prompt("Mot de passe pour confirmer :");
    if (!password) return;

    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await deleteDoc(doc(db, "users", auth.currentUser.uid));
      await deleteUser(auth.currentUser);
      alert("Compte supprimé.");
    } catch (e) {
      alert("Erreur suppression : " + e.message);
    }
  };

  btnRoll.onclick = () => {
    if (money < 100) return alert("Pas assez d'argent !");
    money -= 100;
    const obj = rollObject();
    inventory.push(obj);
    updateMoney();
    updateInventory();
    resultDiv.innerText = `🎉 Vous avez obtenu : ${obj.name} (HP: ${obj.hp})`;
    saveUserData()
  };

  btnSell.onclick = async () => {
    const index = sellItemSelect.value;
    const price = parseInt(sellPriceInput.value);
    if (index === "" || isNaN(price) || price <= 0) return alert("Prix ou objet invalide.");

    const item = inventory[index];
    const pseudo = currentUser.email.split("@")[0];
    try {
      await addDoc(collection(db, "shop"), {
        seller: currentUser.uid,
        sellerPseudo: pseudo,
        item,
        price,
        timestamp: Date.now(),
      });
      inventory.splice(index, 1);
      updateInventory();
      alert("Objet en vente !");
    } catch (e) {
      alert("Erreur mise en vente : " + e.message);
    }
  };

  // Fonctions Utilitaires (updateMoney, updateInventory, rollObject, displayQuests, attemptQuest, loadUserData, saveData, loadData, displayShop) à insérer ici


// Met à jour l'affichage de l'argent
function updateMoney() {
  moneySpan.textContent = money.toLocaleString("fr-FR") + " €";
}

// Met à jour l'inventaire affiché
function updateInventory() {
  inventoryList.innerHTML = "";
  sellItemSelect.innerHTML = '<option value="">Choisir un objet</option>';
  inventory.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${item.name} (HP: ${item.hp})`;
    inventoryList.appendChild(li);

    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${item.name} (HP: ${item.hp})`;
    sellItemSelect.appendChild(option);
  });
}

// Tirage aléatoire selon les chances définies dans 'objects'
function rollObject() {
  const totalChance = objects.reduce((sum, obj) => sum + obj.chance, 0);
  let rand = Math.random() * totalChance;
  for (const obj of objects) {
    if (rand < obj.chance) {
      return { name: obj.name, hp: obj.hp };
    }
    rand -= obj.chance;
  }
  // Fallback au cas où
  return { name: "1/2", hp: 2 };
}

// Affiche la liste des quêtes disponibles
function displayQuests() {
  questList.innerHTML = "";
  quests.forEach(q => {
    const li = document.createElement("li");
    li.textContent = `${q.name} — Offrir ${q.requiredHP} HP, récompense ${q.reward} ₽`;
    const btn = document.createElement("button");
    btn.textContent = "Tenter";
    btn.onclick = () => attemptQuest(q);
    li.appendChild(btn);
    questList.appendChild(li);
  });
}

// Tente de réaliser une quête (offrir des HP)
function attemptQuest(quest) {
  const totalHP = inventory.reduce((sum, item) => sum + item.hp, 0);
  if (totalHP < quest.requiredHP) {
    questResult.textContent = "Pas assez de HP dans l'inventaire pour cette quête.";
    return;
  }
  let remaining = quest.requiredHP;

  // Sacrifie les objets dans l'inventaire pour couvrir la HP demandée
  inventory = inventory.filter(item => {
    if (remaining <= 0) return true;
    if (item.hp <= remaining) {
      remaining -= item.hp;
      return false; // Supprime cet objet
    } else {
      // Réduit l'HP de l'objet
      item.hp -= remaining;
      remaining = 0;
      return true;
    }
  });

  money += quest.reward;
  updateMoney();
  updateInventory();
  questResult.textContent = `Quête réussie ! Vous avez gagné ${quest.reward} ₽`;
  saveUserData()
}

// Charge les données Firestore utilisateur dans le jeu
async function loadUserData(user) {
  try {
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      inventory = data.inventory || [];
      money = data.money || 1000;
      updateMoney();
      updateInventory();
    } else {
      console.log("Aucune donnée utilisateur trouvée.");
    }
  } catch (err) {
    console.error("Erreur chargement données utilisateur:", err);
  }
}

// Sauvegarde locale (exemple, à adapter si besoin)
function saveData() {
  // Ici tu peux ajouter du stockage local ou sauvegarder Firestore si nécessaire
}

// Charge la sauvegarde locale (exemple)
function loadData() {
  // Idem, selon stockage local ou Firestore
}

// Affiche la boutique (affichage simple ici, à compléter selon besoins)
async function displayShop() {
  shopList.innerHTML = "Chargement de la boutique...";
  try {
    const shopCol = collection(db, "shop");
    const shopSnapshot = await getDocs(shopCol);
    shopList.innerHTML = "";
    shopSnapshot.forEach(doc => {
      if (shopList.innerHTML === "") {
        shopList.innerText = "Aucun objet en vente pour le moment.";
      }
      const data = doc.data();
      const div = document.createElement("div");
      div.textContent = `${data.sellerPseudo} vend ${data.item.name} (HP: ${data.item.hp}) à ${data.price} ₽`;
      const buyBtn = document.createElement("button");
      buyBtn.textContent = "Acheter";
      if (data.seller === currentUser.uid) {
        buyBtn.disabled = true;
        buyBtn.textContent = "C'est votre objet";
      }
      buyBtn.onclick = async () => {
        if (money < data.price) {
          alert("Pas assez d'argent !");
          return;
        }
        money -= data.price;
        updateMoney();
        inventory.push(data.item);
        updateInventory();
        // Supprime de la boutique
        await deleteDoc(doc(db, "shop", doc.id));
        displayShop();
        saveUserData()
      };
      div.appendChild(buyBtn);
      shopList.appendChild(div);
    });
  } catch (e) {
    shopList.innerText = "Erreur chargement boutique : " + e.message;
  }
}
});
